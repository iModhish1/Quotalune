//! Runs `codex login` inside an isolated `CODEX_HOME`, with cancellation,
//! timeouts, and combined output capture. Split out of `account_manager.rs`
//! (port of the login-running slice of `windows/.../account_manager.py`, MIT).

use std::io;
use std::path::{Path, PathBuf};
use std::process::{ChildStderr, ChildStdout, Command, ExitStatus};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

// This legacy synchronous runner needs the same process-tree and nonblocking
// pipe supervisor as `crate::login`. Reusing that source keeps the security
// behavior in one implementation until these two login APIs are consolidated.
#[allow(
    clippy::duplicate_mod,
    reason = "reuse the canonical login process supervisor instead of cloning security-sensitive code"
)]
#[path = "../login/process.rs"]
mod supervised_process;
use supervised_process::{LoginProcess, read_available};

const MAX_CAPTURE_BYTES_PER_STREAM: usize = 16 * 1024;
const MAX_DRAIN_READS_PER_TICK: usize = 8;
const POLL_INTERVAL: Duration = Duration::from_millis(10);

/// Outcome of a `codex login` subprocess run.
#[derive(Debug, Clone)]
pub enum CodexLoginOutcome {
    MissingBinary,
    LaunchFailed(String),
    TimedOut(String),
    Cancelled,
    Failed(String),
    Success(String),
}

impl CodexLoginOutcome {
    pub fn as_str(&self) -> &'static str {
        match self {
            CodexLoginOutcome::MissingBinary => "missing_binary",
            CodexLoginOutcome::LaunchFailed(_) => "launch_failed",
            CodexLoginOutcome::TimedOut(_) => "timed_out",
            CodexLoginOutcome::Cancelled => "cancelled",
            CodexLoginOutcome::Failed(_) => "failed",
            CodexLoginOutcome::Success(_) => "success",
        }
    }

    pub fn output(&self) -> &str {
        match self {
            CodexLoginOutcome::MissingBinary => "",
            CodexLoginOutcome::LaunchFailed(output)
            | CodexLoginOutcome::TimedOut(output)
            | CodexLoginOutcome::Failed(output)
            | CodexLoginOutcome::Success(output) => output,
            CodexLoginOutcome::Cancelled => "",
        }
    }
}

/// Result of a `codex login` subprocess run.
#[derive(Debug, Clone)]
pub struct CodexLoginResult {
    pub outcome: CodexLoginOutcome,
}

/// Handle around an in-flight `codex login` process, for cancellation.
#[derive(Debug, Default, Clone)]
pub struct ManagedLoginProcess {
    inner: Arc<Mutex<Option<RunningLogin>>>,
    cancelled: Arc<AtomicBool>,
}

impl ManagedLoginProcess {
    fn lock(&self) -> MutexGuard<'_, Option<RunningLogin>> {
        self.inner
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn bind(&self, process: RunningLogin) {
        *self.lock() = Some(process);
        self.cancelled.store(false, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        if let Some(process) = self.lock().as_mut() {
            process.process.stop();
        }
    }
}

#[derive(Debug, Default)]
struct CapturedOutput {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

struct RunningLogin {
    process: LoginProcess,
    stdout: ChildStdout,
    stderr: ChildStderr,
    captured: CapturedOutput,
}

impl std::fmt::Debug for RunningLogin {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("RunningLogin")
            .field("pid", &self.process.child.id())
            .field("stdout_bytes", &self.captured.stdout.len())
            .field("stderr_bytes", &self.captured.stderr.len())
            .finish_non_exhaustive()
    }
}

impl RunningLogin {
    fn spawn(command: &mut Command) -> io::Result<Self> {
        let mut process = LoginProcess::spawn(command)?;
        let stdout = process
            .child
            .stdout
            .take()
            .ok_or_else(|| io::Error::other("Codex login stdout was not captured"))?;
        let stderr = process
            .child
            .stderr
            .take()
            .ok_or_else(|| io::Error::other("Codex login stderr was not captured"))?;
        Ok(Self {
            process,
            stdout,
            stderr,
            captured: CapturedOutput::default(),
        })
    }

    fn drain_available(&mut self) -> io::Result<()> {
        drain_stream(&mut self.stdout, &mut self.captured.stdout)?;
        drain_stream(&mut self.stderr, &mut self.captured.stderr)
    }

    fn stop_and_capture(mut self) -> CapturedOutput {
        // Closing the owned job/process group first prevents descendants from
        // retaining the pipes. The final reads are nonblocking and bounded, so
        // teardown never waits for EOF.
        self.process.stop();
        let _ignored = self.drain_available();
        self.captured
    }
}

/// Runs `codex login` inside an isolated `CODEX_HOME`.
pub struct CodexLoginRunner;

impl CodexLoginRunner {
    /// Resolve the `codex` executable, falling back to known install paths.
    pub fn locate_codex_binary() -> Option<PathBuf> {
        if let Ok(found) = which::which("codex") {
            return Some(found);
        }
        path_candidates()
            .into_iter()
            .find(|candidate| candidate.is_file())
    }

    pub fn run(
        home_path: &Path,
        timeout: Duration,
        handle: Option<&ManagedLoginProcess>,
    ) -> CodexLoginResult {
        let active_handle = handle.cloned().unwrap_or_default();
        let Some(binary) = Self::locate_codex_binary() else {
            return CodexLoginResult {
                outcome: CodexLoginOutcome::MissingBinary,
            };
        };

        let mut command = Command::new(binary);
        command.arg("login").env("CODEX_HOME", home_path);
        let process = match RunningLogin::spawn(&mut command) {
            Ok(process) => process,
            Err(error) => {
                return CodexLoginResult {
                    outcome: CodexLoginOutcome::LaunchFailed(error.to_string()),
                };
            }
        };
        active_handle.bind(process);

        let (status, output) = match wait_for_child(&active_handle, timeout) {
            ChildWaitResult::Completed { status, output } => (status, output),
            ChildWaitResult::TimedOut(output) => {
                return CodexLoginResult {
                    outcome: CodexLoginOutcome::TimedOut(combine_output(&output)),
                };
            }
            ChildWaitResult::Cancelled => {
                return CodexLoginResult {
                    outcome: CodexLoginOutcome::Cancelled,
                };
            }
            ChildWaitResult::Failed { error, output } => {
                let captured = combine_output(&output);
                let details = if captured == "No output captured." {
                    error
                } else {
                    format!("{error}\n{captured}")
                };
                return CodexLoginResult {
                    outcome: CodexLoginOutcome::Failed(details),
                };
            }
        };

        let combined = combine_output(&output);
        if active_handle.is_cancelled() {
            return CodexLoginResult {
                outcome: CodexLoginOutcome::Cancelled,
            };
        }
        if status.success() {
            return CodexLoginResult {
                outcome: CodexLoginOutcome::Success(combined),
            };
        }
        CodexLoginResult {
            outcome: CodexLoginOutcome::Failed(combined),
        }
    }
}

fn path_candidates() -> Vec<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("AppData")
                .join("Local")
        });
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let codex_bin = local_app_data.join("OpenAI").join("Codex").join("bin");
    let mut candidates = vec![codex_bin.join("codex.exe")];
    candidates.extend(versioned_codex_candidates(&codex_bin));
    candidates.extend([
        home.join(".bun").join("bin").join("codex.exe"),
        local_app_data
            .join("Microsoft")
            .join("WindowsApps")
            .join("codex.exe"),
    ]);
    candidates
}

/// Desktop installs can keep the CLI in a version directory. Only inspect
/// immediate directories under the known installation root, never arbitrary
/// recursive matches or account directories. PATH keeps precedence above.
fn versioned_codex_candidates(root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut candidates: Vec<_> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .map(|entry| entry.path().join("codex.exe"))
        .filter(|path| path.is_file())
        .collect();
    candidates.sort_by_cached_key(|path| {
        (
            std::cmp::Reverse(path.metadata().and_then(|m| m.modified()).ok()),
            path.clone(),
        )
    });
    candidates
}

#[derive(Debug)]
enum ChildWaitResult {
    Completed {
        status: ExitStatus,
        output: CapturedOutput,
    },
    TimedOut(CapturedOutput),
    Cancelled,
    Failed {
        error: String,
        output: CapturedOutput,
    },
}

enum PollResult {
    Running,
    Completed(ExitStatus),
    Failed(String),
}

fn wait_for_child(handle: &ManagedLoginProcess, timeout: Duration) -> ChildWaitResult {
    let deadline = Instant::now() + timeout;
    loop {
        if handle.is_cancelled() {
            if let Some(process) = take_process(handle) {
                let _output = process.stop_and_capture();
            }
            return ChildWaitResult::Cancelled;
        }

        let (poll_result, finished_process) = {
            let mut guard = handle.lock();
            let Some(process) = guard.as_mut() else {
                return ChildWaitResult::Failed {
                    error: "Codex login process handle was unavailable.".to_string(),
                    output: CapturedOutput::default(),
                };
            };
            let poll_result = match process.drain_available() {
                Err(error) => {
                    PollResult::Failed(format!("Could not capture Codex login output: {error}"))
                }
                Ok(()) => poll_child(process.process.child.try_wait()),
            };
            let finished_process = if matches!(poll_result, PollResult::Running) {
                None
            } else {
                guard.take()
            };
            (poll_result, finished_process)
        };

        match poll_result {
            PollResult::Running => {}
            PollResult::Completed(status) => {
                let Some(process) = finished_process else {
                    return ChildWaitResult::Failed {
                        error: "Codex login process disappeared during completion.".to_string(),
                        output: CapturedOutput::default(),
                    };
                };
                return ChildWaitResult::Completed {
                    status,
                    output: process.stop_and_capture(),
                };
            }
            PollResult::Failed(error) => {
                let output = finished_process
                    .map(RunningLogin::stop_and_capture)
                    .unwrap_or_default();
                return ChildWaitResult::Failed { error, output };
            }
        }

        if Instant::now() >= deadline {
            if handle.is_cancelled() {
                continue;
            }
            let output = take_process(handle)
                .map(RunningLogin::stop_and_capture)
                .unwrap_or_default();
            return ChildWaitResult::TimedOut(output);
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}

fn poll_child(result: io::Result<Option<ExitStatus>>) -> PollResult {
    match result {
        Ok(Some(status)) => PollResult::Completed(status),
        Ok(None) => PollResult::Running,
        Err(error) => PollResult::Failed(format!(
            "Could not monitor the Codex login process: {error}"
        )),
    }
}

fn take_process(handle: &ManagedLoginProcess) -> Option<RunningLogin> {
    handle.lock().take()
}

#[cfg(windows)]
trait LoginStream: io::Read + std::os::windows::io::AsRawHandle {}
#[cfg(windows)]
impl<T: io::Read + std::os::windows::io::AsRawHandle> LoginStream for T {}
#[cfg(not(windows))]
trait LoginStream: io::Read {}
#[cfg(not(windows))]
impl<T: io::Read> LoginStream for T {}

fn drain_stream(stream: &mut impl LoginStream, captured: &mut Vec<u8>) -> io::Result<()> {
    let mut buffer = [0_u8; 4096];
    for _ in 0..MAX_DRAIN_READS_PER_TICK {
        match read_available(stream, &mut buffer) {
            Ok(0) => return Ok(()),
            Ok(count) => {
                let remaining = MAX_CAPTURE_BYTES_PER_STREAM.saturating_sub(captured.len());
                captured.extend_from_slice(&buffer[..count.min(remaining)]);
            }
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock
                        | io::ErrorKind::BrokenPipe
                        | io::ErrorKind::UnexpectedEof
                ) =>
            {
                return Ok(());
            }
            Err(error) => return Err(error),
        }
    }
    Ok(())
}

fn combine_output(output: &CapturedOutput) -> String {
    let mut parts: Vec<String> = Vec::new();
    for bytes in [&output.stdout, &output.stderr] {
        let text = String::from_utf8_lossy(bytes);
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            parts.push(trimmed.to_string());
        }
    }
    let merged = parts.join("\n");
    let merged = merged.trim();
    if merged.is_empty() {
        "No output captured.".to_string()
    } else {
        merged.chars().take(4000).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn login_runner_process_fixture() {
        let Ok(scenario) = std::env::var("QUOTALIS_CODEX_LOGIN_RUNNER_FIXTURE") else {
            return;
        };
        match scenario.as_str() {
            "pressure" => {
                let mut stderr = std::io::stderr().lock();
                let block = [b'x'; 4096];
                for _ in 0..512 {
                    stderr.write_all(&block).unwrap();
                }
                stderr.flush().unwrap();
            }
            "quiet" => {
                let pid_path = std::path::PathBuf::from(
                    std::env::var_os("QUOTALIS_CODEX_LOGIN_RUNNER_PID").unwrap(),
                );
                std::fs::write(pid_path, std::process::id().to_string()).unwrap();
                std::thread::sleep(Duration::from_secs(30));
            }
            "descendant" => {
                let pid_path = std::path::PathBuf::from(
                    std::env::var_os("QUOTALIS_CODEX_LOGIN_RUNNER_PID").unwrap(),
                );
                let mut command = fixture_command("quiet");
                command.env("QUOTALIS_CODEX_LOGIN_RUNNER_PID", &pid_path);
                #[expect(
                    clippy::zombie_processes,
                    reason = "intentional orphan fixture; the outer supervisor owns its process tree"
                )]
                let _descendant = command.spawn().unwrap();
                let deadline = Instant::now() + Duration::from_secs(3);
                while !pid_path.exists() && Instant::now() < deadline {
                    std::thread::sleep(Duration::from_millis(10));
                }
                assert!(pid_path.exists(), "fixture descendant started");
            }
            _ => panic!("unknown login runner fixture scenario"),
        }
    }

    fn fixture_command(scenario: &str) -> Command {
        let mut command = Command::new(std::env::current_exe().expect("test executable"));
        command.args([
            "--exact",
            "codex_accounts::login_runner::tests::login_runner_process_fixture",
            "--nocapture",
        ]);
        command.env("QUOTALIS_CODEX_LOGIN_RUNNER_FIXTURE", scenario);
        command
    }

    #[test]
    fn finds_versioned_cli_without_searching_nested_or_unrelated_files() {
        let root = tempfile::tempdir().unwrap();
        let version = root.path().join("bffc5354119c8421");
        std::fs::create_dir(&version).unwrap();
        let cli = version.join("codex.exe");
        std::fs::write(&cli, b"fixture only, never executed").unwrap();
        std::fs::create_dir_all(root.path().join("nested/other")).unwrap();
        std::fs::write(root.path().join("nested/other/codex.exe"), b"ignored").unwrap();
        std::fs::write(root.path().join("other.exe"), b"ignored").unwrap();
        assert_eq!(versioned_codex_candidates(root.path()), vec![cli]);
        assert!(versioned_codex_candidates(&root.path().join("missing")).is_empty());
    }

    #[test]
    fn completed_login_child_releases_handle_without_relocking_it() {
        #[cfg(windows)]
        let mut command = Command::new("cmd.exe");
        #[cfg(windows)]
        command.args(["/D", "/C", "exit", "0"]);
        #[cfg(not(windows))]
        let mut command = Command::new("true");
        let process = RunningLogin::spawn(&mut command).unwrap();
        let handle = ManagedLoginProcess::default();
        handle.bind(process);
        let ChildWaitResult::Completed { status, .. } =
            wait_for_child(&handle, Duration::from_secs(5))
        else {
            panic!("completed child was not reported as completed");
        };
        assert!(status.success());
        assert!(handle.lock().is_none());
    }

    #[test]
    fn verbose_child_cannot_fill_stderr_pipe_and_stall_login() {
        let mut command = fixture_command("pressure");
        let process = RunningLogin::spawn(&mut command).unwrap();
        let handle = ManagedLoginProcess::default();
        handle.bind(process);
        let started = Instant::now();
        let ChildWaitResult::Completed { status, output } =
            wait_for_child(&handle, Duration::from_secs(5))
        else {
            panic!("verbose child did not complete before the deadline");
        };
        assert!(status.success());
        assert_eq!(output.stderr.len(), MAX_CAPTURE_BYTES_PER_STREAM);
        assert!(combine_output(&output).chars().count() <= 4000);
        assert!(started.elapsed() < Duration::from_secs(7));
    }

    #[test]
    fn wait_error_is_a_failure_not_a_timeout() {
        let PollResult::Failed(message) = poll_child(Err(io::Error::other("synthetic wait error")))
        else {
            panic!("wait error was not classified as a failure");
        };
        assert!(message.contains("synthetic wait error"));
    }

    #[test]
    fn missing_bound_process_is_a_failure_not_a_timeout_or_panic() {
        let handle = ManagedLoginProcess::default();
        let ChildWaitResult::Failed { error, .. } =
            wait_for_child(&handle, Duration::from_millis(1))
        else {
            panic!("missing process was not classified as a failure");
        };
        assert!(error.contains("unavailable"));
    }

    #[test]
    fn timeout_stops_and_releases_the_owned_process() {
        let temp = tempfile::tempdir().unwrap();
        let pid_path = temp.path().join("quiet.pid");
        let mut command = fixture_command("quiet");
        command.env("QUOTALIS_CODEX_LOGIN_RUNNER_PID", &pid_path);
        let process = RunningLogin::spawn(&mut command).unwrap();
        let handle = ManagedLoginProcess::default();
        handle.bind(process);
        wait_for_fixture_start(&pid_path);

        let started = Instant::now();
        assert!(matches!(
            wait_for_child(&handle, Duration::from_millis(250)),
            ChildWaitResult::TimedOut(_)
        ));
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(handle.lock().is_none());
        assert_process_stopped(&pid_path);
    }

    #[test]
    fn cancellation_stops_and_releases_the_owned_process() {
        let temp = tempfile::tempdir().unwrap();
        let pid_path = temp.path().join("cancelled.pid");
        let mut command = fixture_command("quiet");
        command.env("QUOTALIS_CODEX_LOGIN_RUNNER_PID", &pid_path);
        let process = RunningLogin::spawn(&mut command).unwrap();
        let handle = ManagedLoginProcess::default();
        handle.bind(process);
        wait_for_fixture_start(&pid_path);

        handle.cancel();
        assert!(matches!(
            wait_for_child(&handle, Duration::from_secs(1)),
            ChildWaitResult::Cancelled
        ));
        assert!(handle.lock().is_none());
        assert_process_stopped(&pid_path);
    }

    #[test]
    fn exiting_wrapper_cannot_leave_a_descendant_or_hold_output_open() {
        let temp = tempfile::tempdir().unwrap();
        let pid_path = temp.path().join("descendant.pid");
        let mut command = fixture_command("descendant");
        command.env("QUOTALIS_CODEX_LOGIN_RUNNER_PID", &pid_path);
        let process = RunningLogin::spawn(&mut command).unwrap();
        let handle = ManagedLoginProcess::default();
        handle.bind(process);

        let started = Instant::now();
        assert!(matches!(
            wait_for_child(&handle, Duration::from_secs(5)),
            ChildWaitResult::Completed { .. }
        ));
        assert!(started.elapsed() < Duration::from_secs(7));
        assert_process_stopped(&pid_path);
    }

    fn assert_process_stopped(pid_path: &Path) {
        let pid: u32 = std::fs::read_to_string(pid_path)
            .expect("fixture PID recorded")
            .parse()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(1);
        while process_running(pid) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(
            !process_running(pid),
            "owned process {pid} survived cleanup"
        );
    }

    fn wait_for_fixture_start(pid_path: &Path) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while !pid_path.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(pid_path.exists(), "fixture process started");
    }

    #[cfg(windows)]
    fn process_running(pid: u32) -> bool {
        use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::Threading::{
            GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
        };
        // SAFETY: read-only query of the exact PID emitted by our synthetic child.
        let Ok(handle) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return false;
        };
        // SAFETY: successful OpenProcess transferred this unique handle.
        let handle = unsafe { OwnedHandle::from_raw_handle(handle.0) };
        let mut code = 0;
        // SAFETY: live owned process handle and valid initialized output pointer.
        if unsafe { GetExitCodeProcess(HANDLE(handle.as_raw_handle()), &mut code) }.is_err() {
            return false;
        }
        code == 259
    }

    #[cfg(unix)]
    fn process_running(pid: u32) -> bool {
        let Ok(pid) = i32::try_from(pid) else {
            return false;
        };
        // SAFETY: signal zero performs a read-only existence/permission query.
        let result = unsafe { libc::kill(pid, 0) };
        result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
    }
}
