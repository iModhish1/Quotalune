use super::*;
use std::io::Write;

// The full library suite starts many subprocesses concurrently. Allow its test
// executable (and the extra cmd.exe wrapper) to load before expecting a PID;
// this is still far shorter than the fixture's 30-second silent lifetime.
const SILENT_FIXTURE_TIMEOUT: Duration = Duration::from_secs(5);
const CLEANUP_AND_SCHEDULING_ALLOWANCE: Duration = Duration::from_secs(2);

fn fixture_command(scenario: &str, pid_path: &std::path::Path) -> Command {
    let mut command = Command::new(std::env::current_exe().expect("test executable"));
    command.args([
        "--exact",
        "login::tests::login_process_fixture",
        "--nocapture",
    ]);
    command.env("QUOTALIS_LOGIN_TEST_SCENARIO", scenario);
    command.env("QUOTALIS_LOGIN_TEST_PID", pid_path);
    command
}

// A synthetic subprocess entry point, also harmless when the normal test suite
// invokes it. No provider CLI, browser, credential, or network is involved.
#[test]
fn login_process_fixture() {
    let Ok(scenario) = std::env::var("QUOTALIS_LOGIN_TEST_SCENARIO") else {
        return;
    };
    let pid_path = std::path::PathBuf::from(std::env::var_os("QUOTALIS_LOGIN_TEST_PID").unwrap());
    std::fs::write(&pid_path, std::process::id().to_string()).unwrap();
    match scenario.as_str() {
        "quiet" => std::thread::sleep(Duration::from_secs(30)),
        "marker_failure" => {
            eprintln!("Login successful");
            std::io::stderr().flush().unwrap();
            std::thread::sleep(Duration::from_millis(80));
            std::process::exit(23);
        }
        "pressure" => {
            let mut stderr = std::io::stderr().lock();
            let block = [b'x'; 4096];
            for _ in 0..512 {
                stderr.write_all(&block).unwrap();
            }
            stderr.flush().unwrap();
        }
        "descendant" | "descendant_timeout" => {
            let descendant_path = pid_path.with_extension("descendant");
            let mut command = fixture_command("quiet", &descendant_path);
            command
                .stdout(std::process::Stdio::inherit())
                .stderr(std::process::Stdio::inherit());
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            // This intentionally emulates a wrapper whose descendant keeps its
            // output pipes open after the wrapper exits or reaches the timeout.
            // The fixture deliberately exits before its descendant, so the
            // supervisor tests can verify owned-tree termination and pipe EOF.
            #[expect(
                clippy::zombie_processes,
                reason = "intentional orphan fixture; outer supervisor verifies descendant termination"
            )]
            let _descendant = command.spawn().unwrap();
            let deadline = Instant::now() + Duration::from_secs(3);
            while !descendant_path.exists() && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(10));
            }
            assert!(descendant_path.exists(), "fixture descendant started");
            if scenario == "descendant_timeout" {
                std::thread::sleep(Duration::from_secs(30));
            }
        }
        _ => panic!("unknown fixture scenario"),
    }
}

#[test]
fn quiet_child_obeys_wall_timeout_and_is_reaped() {
    let temp = tempfile::tempdir().unwrap();
    let pid_path = temp.path().join("pid");
    let start = Instant::now();
    let result = supervise_login(
        fixture_command("quiet", &pid_path),
        SILENT_FIXTURE_TIMEOUT,
        |_| {},
    );
    assert!(
        matches!(result.outcome, LoginOutcome::TimedOut),
        "{result:?}"
    );
    assert_silent_timeout_elapsed(start.elapsed());
    assert_process_stopped(&pid_path);
}

#[cfg(windows)]
#[test]
fn windows_cmd_wrapper_is_contained_before_it_spawns_the_cli() {
    let temp = tempfile::tempdir().unwrap();
    let wrapper = temp.path().join("login wrapper.cmd");
    let pid_path = temp.path().join("pid");
    std::fs::write(
        &wrapper,
        format!(
            "@echo off\r\n\"{}\" --exact login::tests::login_process_fixture --nocapture\r\n",
            std::env::current_exe().unwrap().display()
        ),
    )
    .unwrap();
    let mut command = Command::new(wrapper);
    command.env("QUOTALIS_LOGIN_TEST_SCENARIO", "quiet");
    command.env("QUOTALIS_LOGIN_TEST_PID", &pid_path);
    let start = Instant::now();
    let result = supervise_login(command, SILENT_FIXTURE_TIMEOUT, |_| {});
    assert!(
        matches!(result.outcome, LoginOutcome::TimedOut),
        "{result:?}"
    );
    assert_silent_timeout_elapsed(start.elapsed());
    assert_process_stopped(&pid_path);
}

fn assert_silent_timeout_elapsed(elapsed: Duration) {
    assert!(
        elapsed >= SILENT_FIXTURE_TIMEOUT,
        "silent child ended before its configured deadline: {elapsed:?}"
    );
    assert!(
        elapsed < SILENT_FIXTURE_TIMEOUT + CLEANUP_AND_SCHEDULING_ALLOWANCE,
        "silent child exceeded its deadline plus bounded cleanup: {elapsed:?}"
    );
}

#[test]
fn stderr_pressure_and_newline_free_output_are_drained_with_bounded_memory() {
    let temp = tempfile::tempdir().unwrap();
    let result = supervise_login(
        fixture_command("pressure", &temp.path().join("pid")),
        Duration::from_secs(10),
        |_| {},
    );
    assert!(
        matches!(result.outcome, LoginOutcome::Success),
        "{result:?}"
    );
    assert_eq!(result.output.len(), MAX_OUTPUT_BYTES);
}

#[test]
fn success_text_followed_by_failure_requires_successful_exit() {
    let temp = tempfile::tempdir().unwrap();
    let phases = std::cell::RefCell::new(Vec::new());
    let result = supervise_login(
        fixture_command("marker_failure", &temp.path().join("pid")),
        Duration::from_secs(5),
        |phase| phases.borrow_mut().push(phase),
    );
    assert!(
        matches!(result.outcome, LoginOutcome::Failed { status: 23 }),
        "{result:?}"
    );
    assert!(result.output.contains("Login successful"));
    assert!(!phases.into_inner().contains(&LoginPhase::Complete));
}

#[test]
fn exiting_wrapper_cannot_leave_descendant_or_block_on_inherited_pipe() {
    check_descendant_cleanup("descendant", false);
}

#[test]
fn timed_out_wrapper_cannot_leave_descendant_or_block_on_inherited_pipe() {
    check_descendant_cleanup("descendant_timeout", true);
}

#[test]
fn cancellation_stops_the_owned_cli_process_tree() {
    let temp = tempfile::tempdir().unwrap();
    let pid_path = temp.path().join("pid");
    let descendant_path = pid_path.with_extension("descendant");
    let cancellation = LoginCancellation::new();
    let cancel_from_watcher = cancellation.clone();
    let descendant_for_watcher = descendant_path.clone();
    let watcher = std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(3);
        while !descendant_for_watcher.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(
            descendant_for_watcher.exists(),
            "fixture descendant started"
        );
        cancel_from_watcher.cancel();
    });

    let start = Instant::now();
    let result = supervise_login_cancellable(
        fixture_command("descendant_timeout", &pid_path),
        Duration::from_secs(10),
        cancellation,
        |_| {},
    );
    watcher.join().unwrap();

    assert!(
        matches!(result.outcome, LoginOutcome::Canceled),
        "{result:?}"
    );
    assert!(start.elapsed() < Duration::from_secs(5));
    assert_process_stopped(&pid_path);
    assert_process_stopped(&descendant_path);
}

fn check_descendant_cleanup(scenario: &str, timed_out: bool) {
    let temp = tempfile::tempdir().unwrap();
    let pid_path = temp.path().join("pid");
    let start = Instant::now();
    let result = supervise_login(
        fixture_command(scenario, &pid_path),
        // Match the other subprocess fixtures: the wrapper itself allows up to
        // three seconds for its descendant to start. A two-second outer limit
        // could kill it before that handshake under concurrent suite load.
        SILENT_FIXTURE_TIMEOUT,
        |_| {},
    );
    if timed_out {
        assert!(
            matches!(result.outcome, LoginOutcome::TimedOut),
            "{result:?}"
        );
        assert_silent_timeout_elapsed(start.elapsed());
    } else {
        assert!(
            matches!(result.outcome, LoginOutcome::Success),
            "{result:?}"
        );
    }
    assert!(start.elapsed() < SILENT_FIXTURE_TIMEOUT + CLEANUP_AND_SCHEDULING_ALLOWANCE);
    assert_process_stopped(&pid_path);
    assert_process_stopped(&pid_path.with_extension("descendant"));
}

fn assert_process_stopped(pid_path: &std::path::Path) {
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
        "owned fixture process {pid} survived cleanup"
    );
}

#[cfg(windows)]
fn process_running(pid: u32) -> bool {
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    // SAFETY: read-only query of the exact PID emitted by our synthetic child.
    let Ok(handle) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }) else {
        return false;
    };
    // SAFETY: successful OpenProcess transferred this unique handle.
    let handle = unsafe { OwnedHandle::from_raw_handle(handle.0) };
    let mut code = 0;
    // SAFETY: live owned process handle and valid initialized output pointer.
    unsafe { GetExitCodeProcess(HANDLE(handle.as_raw_handle()), &mut code) }.is_ok() && code == 259
}

#[cfg(unix)]
fn process_running(pid: u32) -> bool {
    // SAFETY: signal 0 only queries existence, without delivering a signal.
    unsafe { libc::kill(i32::try_from(pid).unwrap(), 0) == 0 }
}

#[test]
fn unicode_output_cap_preserves_utf8() {
    let callback = |_| {};
    let mut state = CliLoginState::new(&callback);
    state.handle_line(&"س".repeat(MAX_OUTPUT_BYTES));
    assert!(state.output.len() <= MAX_OUTPUT_BYTES);
    assert!(state.output.is_char_boundary(state.output.len()));
}
