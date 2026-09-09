//! Owned login process supervision. No pipe reader threads are started.
use std::io::{self, Read};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub(super) struct LoginProcess {
    pub child: Child,
    stopped: bool,
    #[cfg(windows)]
    job: Option<std::os::windows::io::OwnedHandle>,
    #[cfg(unix)]
    group_id: i32,
}

impl LoginProcess {
    pub fn spawn(command: &mut Command) -> io::Result<Self> {
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            windows::spawn(command)
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
            let child = command.spawn()?;
            let group_id = i32::try_from(child.id()).expect("Unix PID fits pid_t");
            let mut process = Self {
                child,
                group_id,
                stopped: false,
            };
            if let Err(error) = unix::nonblocking(process.child.stdout.as_ref().unwrap())
                .and_then(|()| unix::nonblocking(process.child.stderr.as_ref().unwrap()))
            {
                process.stop();
                return Err(error);
            }
            Ok(process)
        }
        #[cfg(not(any(windows, unix)))]
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Supervised login is unsupported on this platform",
        ))
    }

    /// Kill only this login's owned process tree, then give the direct child a
    /// bounded interval to be reaped. Never block on inherited stdout/stderr.
    pub fn stop(&mut self) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        #[cfg(windows)]
        drop(self.job.take()); // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE.
        #[cfg(unix)]
        {
            // SAFETY: this positive group ID was created exclusively for our
            // child. A negative PID targets that group, never our parent group.
            let _result = unsafe { libc::kill(-self.group_id, libc::SIGKILL) };
        }
        let _result = self.child.kill();
        let deadline = Instant::now() + Duration::from_secs(1);
        while Instant::now() < deadline {
            match self.child.try_wait() {
                Ok(Some(_)) | Err(_) => return,
                Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            }
        }
    }
}

impl Drop for LoginProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(windows)]
pub(super) fn read_available<R: Read + std::os::windows::io::AsRawHandle>(
    stream: &mut R,
    buffer: &mut [u8],
) -> io::Result<usize> {
    use ::windows::Win32::Foundation::HANDLE;
    use ::windows::Win32::System::Pipes::PeekNamedPipe;
    let mut available = 0;
    // SAFETY: the stream owns a live anonymous pipe handle. Peek never consumes
    // bytes. This supervisor is its sole reader, so reading at most the observed
    // available count cannot wait for new bytes from a surviving descendant.
    let result = unsafe {
        PeekNamedPipe(
            HANDLE(stream.as_raw_handle()),
            None,
            0,
            None,
            Some(&mut available),
            None,
        )
    };
    if let Err(error) = result {
        return Err(io::Error::from_raw_os_error(error.code().0 & 0xffff));
    }
    if available == 0 {
        return Err(io::ErrorKind::WouldBlock.into());
    }
    let count = buffer.len().min(available as usize);
    stream.read(&mut buffer[..count])
}

#[cfg(unix)]
pub(super) fn read_available<R: Read>(stream: &mut R, buffer: &mut [u8]) -> io::Result<usize> {
    stream.read(buffer)
}

#[cfg(unix)]
mod unix {
    use std::io;
    use std::os::fd::AsRawFd;

    pub(super) fn nonblocking(stream: &impl AsRawFd) -> io::Result<()> {
        // SAFETY: the borrowed stream owns the live descriptor throughout both
        // calls; F_SETFL preserves all existing flags and adds O_NONBLOCK.
        let flags = unsafe { libc::fcntl(stream.as_raw_fd(), libc::F_GETFL) };
        if flags == -1 {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: same live descriptor and valid file-status flags as above.
        if unsafe { libc::fcntl(stream.as_raw_fd(), libc::F_SETFL, flags | libc::O_NONBLOCK) } == -1
        {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}

#[cfg(windows)]
mod windows {
    use super::LoginProcess;
    use ::windows::Win32::Foundation::HANDLE;
    use ::windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, TH32CS_SNAPTHREAD, THREADENTRY32, Thread32First, Thread32Next,
    };
    use ::windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    };
    use ::windows::Win32::System::Threading::{
        CREATE_NO_WINDOW, CREATE_SUSPENDED, OpenThread, ResumeThread, THREAD_SUSPEND_RESUME,
    };
    use std::io;
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    fn error(error: ::windows::core::Error) -> io::Error {
        io::Error::other(error.to_string())
    }

    pub(super) fn spawn(command: &mut Command) -> io::Result<LoginProcess> {
        // SAFETY: null attributes/name create an unnamed, noninheritable owned
        // job. All API-created handles are immediately wrapped in OwnedHandle.
        let job =
            unsafe { CreateJobObjectW(None, ::windows::core::PCWSTR::null()) }.map_err(error)?;
        // SAFETY: successful CreateJobObjectW transferred this unique handle.
        let job = unsafe { OwnedHandle::from_raw_handle(job.0) };
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        // SAFETY: correctly sized initialized information and a live job handle.
        unsafe {
            SetInformationJobObject(
                HANDLE(job.as_raw_handle()),
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                u32::try_from(std::mem::size_of_val(&limits)).unwrap(),
            )
        }
        .map_err(error)?;

        // Suspending before assignment prevents a .cmd wrapper from spawning
        // an uncontained descendant in the spawn-to-job-assignment interval.
        command.creation_flags(CREATE_NO_WINDOW.0 | CREATE_SUSPENDED.0);
        let child = command.spawn()?;
        let process = LoginProcess {
            child,
            job: Some(job),
            stopped: false,
        };
        // SAFETY: both handles are live and owned by process for this entire call.
        unsafe {
            AssignProcessToJobObject(
                HANDLE(process.job.as_ref().unwrap().as_raw_handle()),
                HANDLE(process.child.as_raw_handle()),
            )
        }
        .map_err(error)?;
        resume_initial_thread(process.child.id())?;
        Ok(process)
    }

    fn resume_initial_thread(pid: u32) -> io::Result<()> {
        // std::process::Child does not retain the initial thread handle. The
        // suspended child has exactly one thread; enumerate and resume that one.
        // SAFETY: documented snapshot flag; no borrowed buffers.
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) }.map_err(error)?;
        // SAFETY: successful snapshot call transferred this unique handle.
        let snapshot = unsafe { OwnedHandle::from_raw_handle(snapshot.0) };
        let mut entry = THREADENTRY32 {
            dwSize: u32::try_from(std::mem::size_of::<THREADENTRY32>()).unwrap(),
            ..Default::default()
        };
        // SAFETY: initialized entry has the required size; snapshot stays live.
        unsafe { Thread32First(HANDLE(snapshot.as_raw_handle()), &mut entry) }.map_err(error)?;
        loop {
            if entry.th32OwnerProcessID == pid {
                // SAFETY: exact thread from our still-suspended child's snapshot.
                let thread =
                    unsafe { OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID) }
                        .map_err(error)?;
                // SAFETY: successful OpenThread transferred this unique handle.
                let thread = unsafe { OwnedHandle::from_raw_handle(thread.0) };
                // SAFETY: live owned thread handle with THREAD_SUSPEND_RESUME.
                if unsafe { ResumeThread(HANDLE(thread.as_raw_handle())) } == u32::MAX {
                    return Err(io::Error::last_os_error());
                }
                return Ok(());
            }
            // SAFETY: same correctly sized buffer and live snapshot as above.
            if unsafe { Thread32Next(HANDLE(snapshot.as_raw_handle()), &mut entry) }.is_err() {
                return Err(io::Error::other("Suspended login thread was not found"));
            }
        }
    }
}
