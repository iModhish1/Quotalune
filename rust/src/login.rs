//! Login flow runners for various providers
//!
//! Runs CLI login commands and captures output/URLs

#![allow(
    dead_code,
    reason = "login flow types reserved for future session management integration"
)]

use regex_lite::Regex;
use std::io;
use std::process::{Command, ExitStatus};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::time::{Duration, Instant};
mod process;
use process::{LoginProcess, read_available};

const MAX_OUTPUT_BYTES: usize = 64 * 1024;
const MAX_LINE_BYTES: usize = 8 * 1024;
const POLL_INTERVAL: Duration = Duration::from_millis(10);

/// Result of a login attempt
#[derive(Debug, Clone)]
pub struct LoginResult {
    pub outcome: LoginOutcome,
    pub output: String,
    pub auth_link: Option<String>,
}

/// Outcome of login attempt
#[derive(Debug, Clone)]
pub enum LoginOutcome {
    Success,
    TimedOut,
    Canceled,
    Failed { status: i32 },
    MissingBinary,
    LaunchFailed(String),
}

/// Cloneable, request-scoped cancellation signal for a supervised login.
#[derive(Debug, Clone, Default)]
pub struct LoginCancellation(Arc<AtomicBool>);

impl LoginCancellation {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }

    pub fn is_canceled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

/// Phase of the login process
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LoginPhase {
    Idle,
    Requesting,
    WaitingBrowser,
    Complete,
}

/// Run Claude CLI login
pub async fn run_claude_login<F>(timeout_secs: u64, on_phase: F) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_claude_login_cancellable(timeout_secs, LoginCancellation::new(), on_phase).await
}

pub async fn run_claude_login_cancellable<F>(
    timeout_secs: u64,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_cli_login(
        "claude",
        &["auth", "login"],
        timeout_secs,
        cancellation,
        on_phase,
    )
    .await
}

/// Run Codex CLI login
pub async fn run_codex_login<F>(timeout_secs: u64, on_phase: F) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_codex_login_cancellable(timeout_secs, LoginCancellation::new(), on_phase).await
}

pub async fn run_codex_login_cancellable<F>(
    timeout_secs: u64,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_cli_login("codex", &["login"], timeout_secs, cancellation, on_phase).await
}

/// Run the Google Cloud application-default login used by Vertex AI.
pub async fn run_vertexai_login<F>(timeout_secs: u64, on_phase: F) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_vertexai_login_cancellable(timeout_secs, LoginCancellation::new(), on_phase).await
}

pub async fn run_vertexai_login_cancellable<F>(
    timeout_secs: u64,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_cli_login(
        "gcloud",
        &["auth", "application-default", "login"],
        timeout_secs,
        cancellation,
        on_phase,
    )
    .await
}

/// Run Copilot/GitHub device flow login
pub async fn run_copilot_login<F>(timeout_secs: u64, on_phase: F) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_cli_login(
        "gh",
        &["auth", "login", "-w"],
        timeout_secs,
        LoginCancellation::new(),
        on_phase,
    )
    .await
}

/// Run Kiro CLI login
pub async fn run_kiro_login<F>(timeout_secs: u64, on_phase: F) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    run_kiro_login_cancellable(timeout_secs, LoginCancellation::new(), on_phase).await
}

pub async fn run_kiro_login_cancellable<F>(
    timeout_secs: u64,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    // Use Kiro's own binary resolver which checks well-known Windows install
    // locations in addition to PATH.
    let binary_path = match crate::providers::kiro::find_kiro_cli() {
        Some(p) => p,
        None => return missing_binary_result("kiro-cli"),
    };

    run_cli_login_path(
        &binary_path,
        &["login"],
        timeout_secs,
        cancellation,
        on_phase,
    )
    .await
}

/// Generic CLI login runner (resolves binary via PATH)
async fn run_cli_login<F>(
    binary: &str,
    args: &[&str],
    timeout_secs: u64,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    let binary_path = match which::which(binary) {
        Ok(p) => p,
        Err(_) => return missing_binary_result(binary),
    };

    run_cli_login_path(&binary_path, args, timeout_secs, cancellation, on_phase).await
}

/// Generic CLI login runner (uses a pre-resolved binary path).
/// The one blocking worker polls bounded, nonblocking reads; it never creates
/// pipe reader threads or waits for EOF from a browser/CLI descendant.
async fn run_cli_login_path<F>(
    binary_path: &std::path::Path,
    args: &[&str],
    timeout_secs: u64,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase) + Send + 'static,
{
    let mut command = Command::new(binary_path);
    command.args(args);
    match tokio::task::spawn_blocking(move || {
        supervise_login_cancellable(
            command,
            Duration::from_secs(timeout_secs),
            cancellation,
            on_phase,
        )
    })
    .await
    {
        Ok(result) => result,
        Err(error) => launch_failed_result(format!("login worker failed: {error}")),
    }
}

fn supervise_login<F>(command: Command, timeout: Duration, on_phase: F) -> LoginResult
where
    F: Fn(LoginPhase),
{
    supervise_login_cancellable(command, timeout, LoginCancellation::new(), on_phase)
}

fn supervise_login_cancellable<F>(
    mut command: Command,
    timeout: Duration,
    cancellation: LoginCancellation,
    on_phase: F,
) -> LoginResult
where
    F: Fn(LoginPhase),
{
    on_phase(LoginPhase::Requesting);
    if cancellation.is_canceled() {
        return LoginResult {
            outcome: LoginOutcome::Canceled,
            output: String::new(),
            auth_link: None,
        };
    }
    let deadline = Instant::now() + timeout;
    let mut process = match LoginProcess::spawn(&mut command) {
        Ok(process) => process,
        Err(error) => return launch_failed_result(error.to_string()),
    };
    let mut state = CliLoginState::new(&on_phase);
    let mut stdout = process.child.stdout.take().expect("piped stdout");
    let mut stderr = process.child.stderr.take().expect("piped stderr");
    let mut stdout_line = Vec::new();
    let mut stderr_line = Vec::new();
    loop {
        if cancellation.is_canceled() {
            process.stop();
            state.finish_line(&mut stdout_line);
            state.finish_line(&mut stderr_line);
            return state.into_result(LoginOutcome::Canceled);
        }
        if Instant::now() >= deadline {
            process.stop();
            state.finish_line(&mut stdout_line);
            state.finish_line(&mut stderr_line);
            return state.into_result(LoginOutcome::TimedOut);
        }
        // At most 32 KiB per stream per tick: output pressure cannot starve
        // the deadline/exit checks or allocate an unbounded queue or line.
        drain_stream(&mut stdout, &mut stdout_line, &mut state);
        drain_stream(&mut stderr, &mut stderr_line, &mut state);
        match process.child.try_wait() {
            Ok(Some(status)) => {
                // End surviving descendants before closing/draining their pipes.
                // Success is the CLI exit status, never a message it printed.
                process.stop();
                drain_stream(&mut stdout, &mut stdout_line, &mut state);
                drain_stream(&mut stderr, &mut stderr_line, &mut state);
                state.finish_line(&mut stdout_line);
                state.finish_line(&mut stderr_line);
                return exit_status_result(status, state, &on_phase);
            }
            Ok(None) => std::thread::sleep(POLL_INTERVAL),
            Err(error) => {
                process.stop();
                return state.into_result(LoginOutcome::LaunchFailed(error.to_string()));
            }
        }
    }
}

#[cfg(windows)]
trait LoginStream: io::Read + std::os::windows::io::AsRawHandle {}
#[cfg(windows)]
impl<T: io::Read + std::os::windows::io::AsRawHandle> LoginStream for T {}
#[cfg(not(windows))]
trait LoginStream: io::Read {}
#[cfg(not(windows))]
impl<T: io::Read> LoginStream for T {}

fn drain_stream<F: Fn(LoginPhase)>(
    stream: &mut impl LoginStream,
    pending: &mut Vec<u8>,
    state: &mut CliLoginState<'_, F>,
) {
    let mut buffer = [0_u8; 4096];
    for _ in 0..8 {
        match read_available(stream, &mut buffer) {
            Ok(0) | Err(_) => return,
            Ok(count) => {
                for byte in &buffer[..count] {
                    if *byte == b'\n' {
                        state.finish_line(pending);
                    } else if pending.len() < MAX_LINE_BYTES {
                        pending.push(*byte);
                    } else {
                        // Bound even newline-free output. Process this fragment
                        // as text, then continue draining to avoid backpressure.
                        state.finish_line(pending);
                        pending.push(*byte);
                    }
                }
            }
        }
    }
}

fn missing_binary_result(binary: &str) -> LoginResult {
    LoginResult {
        outcome: LoginOutcome::MissingBinary,
        output: format!("{binary} not found in PATH"),
        auth_link: None,
    }
}
fn launch_failed_result(error: String) -> LoginResult {
    LoginResult {
        outcome: LoginOutcome::LaunchFailed(error),
        output: String::new(),
        auth_link: None,
    }
}

struct CliLoginState<'a, F: Fn(LoginPhase)> {
    output: String,
    auth_link: Option<String>,
    url_regex: Regex,
    on_phase: &'a F,
}
impl<'a, F: Fn(LoginPhase)> CliLoginState<'a, F> {
    fn new(on_phase: &'a F) -> Self {
        Self {
            output: String::new(),
            auth_link: None,
            url_regex: Regex::new(r"https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+").unwrap(),
            on_phase,
        }
    }
    fn finish_line(&mut self, pending: &mut Vec<u8>) {
        if pending.is_empty() {
            return;
        }
        self.handle_line(&String::from_utf8_lossy(pending));
        pending.clear();
    }
    fn handle_line(&mut self, line: &str) {
        let mut bytes = line
            .len()
            .min(MAX_OUTPUT_BYTES.saturating_sub(self.output.len()));
        while !line.is_char_boundary(bytes) {
            bytes -= 1;
        }
        self.output.push_str(&line[..bytes]);
        if self.output.len() < MAX_OUTPUT_BYTES {
            self.output.push('\n');
        }
        // Continue discovering the login link after the diagnostic output cap.
        if self.auth_link.is_none()
            && let Some(found) = self.url_regex.find(line)
        {
            self.auth_link = Some(found.as_str().to_string());
            (self.on_phase)(LoginPhase::WaitingBrowser);
            // Opening a browser must not wait for the browser to exit.
            let _result = open::that_detached(found.as_str());
        }
    }
    fn into_result(self, outcome: LoginOutcome) -> LoginResult {
        LoginResult {
            outcome,
            output: self.output,
            auth_link: self.auth_link,
        }
    }
}
fn exit_status_result<F: Fn(LoginPhase)>(
    status: ExitStatus,
    state: CliLoginState<'_, F>,
    on_phase: &F,
) -> LoginResult {
    if status.success() {
        on_phase(LoginPhase::Complete);
        state.into_result(LoginOutcome::Success)
    } else {
        state.into_result(LoginOutcome::Failed {
            status: status.code().unwrap_or(-1),
        })
    }
}

#[cfg(test)]
mod tests;

/// Open a URL in the default browser
pub fn open_auth_url(url: &str) -> anyhow::Result<()> {
    open::that(url)?;
    Ok(())
}
