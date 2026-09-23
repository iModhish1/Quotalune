//! Detection and curated installation of official provider CLIs.
//!
//! Every probe runs an explicitly resolved executable with an argument vector
//! (never a shell string), a timeout, bounded captured output, and is killed
//! on timeout or cancellation. "Executable found" is reported separately from
//! "signed in": neither alone means a provider is connected.

use crate::connection_capabilities::{
    CliDependency, InstallPlan, InstallPolicy, SessionDetection, cli_dependency,
};
use crate::core::{ProviderId, UserFacingText};
use serde::{Deserialize, Serialize};
use std::ffi::{OsStr, OsString};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use tokio::sync::watch;

pub const PROBE_TIMEOUT: Duration = Duration::from_secs(15);
pub const INSTALL_TIMEOUT: Duration = Duration::from_secs(600);
/// Bytes of stdout/stderr retained from any child process.
pub const OUTPUT_CAP: usize = 16 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CliStatus {
    Missing,
    Installed,
    TooOld {
        installed: String,
        required: &'static str,
    },
    VersionUnknown,
    /// The executable exists but the version probe failed to run cleanly.
    Broken,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CliSessionState {
    Authenticated,
    NotSignedIn,
    /// Only the usage fetch can tell.
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliDetection {
    pub provider: ProviderId,
    pub tool: &'static str,
    pub status: CliStatus,
    /// Resolved executable path; shown to the user only as its directory
    /// portion is not sensitive, but sanitized anyway.
    pub path: Option<String>,
    pub version: Option<String>,
    pub session: CliSessionState,
    pub install_available: bool,
    pub docs_url: &'static str,
    pub sign_in_hint: &'static str,
}

/// Home-relative credential files each CLI writes after sign-in, used for
/// `SessionDetection::AuthFile`. Presence and non-emptiness are checked;
/// contents are never read.
fn auth_files(provider: ProviderId) -> &'static [&'static str] {
    match provider {
        ProviderId::Codex => &[".codex/auth.json"],
        ProviderId::Claude => &[".claude/.credentials.json"],
        ProviderId::Gemini => &[".gemini/oauth_creds.json"],
        ProviderId::VertexAI => &[
            "AppData/Roaming/gcloud/application_default_credentials.json",
            ".config/gcloud/application_default_credentials.json",
        ],
        ProviderId::Grok => &[".grok/auth.json"],
        _ => &[],
    }
}

fn home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

#[derive(Debug, Clone)]
struct DiscoveryRoots {
    protected_roots: Vec<PathBuf>,
}

impl DiscoveryRoots {
    fn system() -> Self {
        #[cfg(windows)]
        {
            use winreg::RegKey;
            use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY};

            let mut protected_roots = Vec::new();
            if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey_with_flags(
                r"SOFTWARE\Microsoft\Windows\CurrentVersion",
                KEY_READ | KEY_WOW64_64KEY,
            ) {
                for value in ["ProgramFilesDir", "ProgramFilesDir (x86)"] {
                    if let Ok(path) = key.get_value::<String, _>(value) {
                        let path = PathBuf::from(path);
                        if !protected_roots.contains(&path) {
                            protected_roots.push(path);
                        }
                    }
                }
            }
            Self { protected_roots }
        }
        #[cfg(unix)]
        {
            Self {
                protected_roots: vec![PathBuf::from("/usr/local"), PathBuf::from("/usr")],
                // User-owned npm trees are not accepted on Unix without a
                // platform provenance service.
            }
        }
        #[cfg(not(any(windows, unix)))]
        Self {
            protected_roots: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
struct ResolvedExecutable {
    program: PathBuf,
    prefix_args: Vec<OsString>,
    display_path: PathBuf,
}

#[derive(Deserialize)]
struct NpmPackageMetadata {
    name: String,
    bin: serde_json::Value,
}

fn canonical_file_within(candidate: &Path, root: &Path) -> Option<PathBuf> {
    let root = std::fs::canonicalize(root).ok()?;
    let candidate = std::fs::canonicalize(candidate).ok()?;
    let metadata = std::fs::metadata(&candidate).ok()?;
    (metadata.is_file() && candidate.starts_with(&root)).then_some(candidate)
}

fn safe_relative_path(value: &str) -> Option<PathBuf> {
    let path = Path::new(value);
    (!path.as_os_str().is_empty()
        && path
            .components()
            .all(|part| matches!(part, Component::Normal(_))))
    .then(|| path.to_path_buf())
}

fn package_root(node_modules: &Path, package: &str) -> Option<PathBuf> {
    let components: Vec<_> = package.split('/').collect();
    match components.as_slice() {
        [name] if !name.is_empty() && !name.starts_with('@') => Some(node_modules.join(name)),
        [scope, name]
            if scope.starts_with('@')
                && scope.len() > 1
                && !name.is_empty()
                && !name.contains(['\\', '/']) =>
        {
            Some(node_modules.join(scope).join(name))
        }
        _ => None,
    }
}

fn npm_entry(node_modules: &Path, package: &str, executable_names: &[&str]) -> Option<PathBuf> {
    let package_root = package_root(node_modules, package)?;
    let package_root = std::fs::canonicalize(&package_root).ok()?;
    let node_modules = std::fs::canonicalize(node_modules).ok()?;
    if !package_root.starts_with(&node_modules) {
        return None;
    }
    let metadata_path = canonical_file_within(&package_root.join("package.json"), &package_root)?;
    if std::fs::metadata(&metadata_path).ok()?.len() > 64 * 1024 {
        return None;
    }
    let metadata: NpmPackageMetadata =
        serde_json::from_slice(&std::fs::read(metadata_path).ok()?).ok()?;
    if metadata.name != package {
        return None;
    }
    let entry = match &metadata.bin {
        serde_json::Value::String(path) if executable_names.len() == 1 => path.as_str(),
        serde_json::Value::Object(entries) => executable_names
            .iter()
            .find_map(|name| entries.get(*name).and_then(serde_json::Value::as_str))?,
        _ => return None,
    };
    let relative = safe_relative_path(entry)?;
    let entry = canonical_file_within(&package_root.join(relative), &package_root)?;
    matches!(
        entry.extension().and_then(OsStr::to_str),
        Some("js" | "cjs" | "mjs")
    )
    .then_some(entry)
}

#[cfg(windows)]
fn trusted_node(root: &Path) -> Option<PathBuf> {
    canonical_file_within(&root.join("nodejs/node.exe"), root)
}

#[cfg(unix)]
fn trusted_node(root: &Path) -> Option<PathBuf> {
    canonical_file_within(&root.join("bin/node"), root)
}

#[cfg(not(any(windows, unix)))]
fn trusted_node(_root: &Path) -> Option<PathBuf> {
    None
}

fn resolve_npm_executable(
    dependency: &CliDependency,
    package: &str,
    roots: &DiscoveryRoots,
) -> Option<ResolvedExecutable> {
    let node = roots
        .protected_roots
        .iter()
        .find_map(|root| trusted_node(root))?;
    let mut node_modules = Vec::new();
    #[cfg(windows)]
    {
        for root in &roots.protected_roots {
            node_modules.push(root.join("nodejs/node_modules"));
        }
    }
    #[cfg(unix)]
    for root in &roots.protected_roots {
        node_modules.push(root.join("lib/node_modules"));
    }
    let entry = node_modules
        .iter()
        .filter(|modules| {
            std::fs::canonicalize(modules).ok().is_some_and(|path| {
                roots.protected_roots.iter().any(|root| {
                    std::fs::canonicalize(root)
                        .ok()
                        .is_some_and(|root| path.starts_with(root))
                })
            })
        })
        .find_map(|modules| npm_entry(modules, package, dependency.executables))?;
    Some(ResolvedExecutable {
        program: node,
        prefix_args: vec![entry.as_os_str().to_owned()],
        display_path: entry,
    })
}

fn resolve_native_executable(
    dependency: &CliDependency,
    roots: &DiscoveryRoots,
) -> Option<ResolvedExecutable> {
    #[cfg(windows)]
    let relatives: &[&str] = match dependency.provider {
        ProviderId::Copilot => &["GitHub CLI/gh.exe"],
        ProviderId::Kiro => &["Kiro/kiro-cli.exe"],
        _ => &[],
    };
    #[cfg(unix)]
    let relatives: &[&str] = match dependency.provider {
        ProviderId::Copilot => &["bin/gh"],
        ProviderId::VertexAI => &["bin/gcloud"],
        ProviderId::Kiro => &["bin/kiro-cli"],
        _ => &[],
    };
    #[cfg(not(any(windows, unix)))]
    let relatives: &[&str] = &[];

    roots.protected_roots.iter().find_map(|root| {
        relatives.iter().find_map(|relative| {
            canonical_file_within(&root.join(relative), root).map(|program| ResolvedExecutable {
                display_path: program.clone(),
                program,
                prefix_args: Vec::new(),
            })
        })
    })
}

fn resolve_cli_command(
    dependency: &CliDependency,
    roots: &DiscoveryRoots,
) -> Option<ResolvedExecutable> {
    match dependency.install {
        InstallPolicy::Npm { package } => resolve_npm_executable(dependency, package, roots),
        // Ark CLI is installed manually, so no automated install plan is
        // offered. Its official npm package can still be verified and run
        // from a protected, machine-wide Node installation.
        InstallPolicy::ManualOnly if dependency.provider == ProviderId::Doubao => {
            resolve_npm_executable(dependency, "@volcengine/ark-cli", roots)
        }
        InstallPolicy::Winget { .. } | InstallPolicy::ManualOnly => {
            resolve_native_executable(dependency, roots)
        }
    }
}

/// Resolve a CLI only when its location and package metadata establish a
/// curated provenance. Arbitrary PATH entries and filename-only home shims are
/// deliberately ignored. For npm CLIs this is the validated package entry;
/// execution uses a protected Node runtime rather than the user-writable shim.
pub fn resolve_executable(dependency: &CliDependency) -> Option<PathBuf> {
    resolve_cli_command(dependency, &DiscoveryRoots::system()).map(|r| r.display_path)
}

/// Build a provider CLI command only after curated provenance validation.
///
/// This is the shared entry point for interactive login transports: npm shims
/// are never executed, caller arguments stay an argument vector, and the
/// child receives only the small non-secret environment required by supported
/// CLIs. `None` means the caller must offer the provider's official manual
/// instructions rather than falling back to PATH.
pub fn trusted_cli_command(provider: ProviderId, args: &[&str]) -> Option<Command> {
    let dependency = cli_dependency(provider)?;
    let resolved = resolve_cli_command(dependency, &DiscoveryRoots::system())?;
    let mut command = Command::new(resolved.program);
    command.args(resolved.prefix_args).args(args);
    scrub_environment(&mut command);
    Some(command)
}

#[derive(Debug)]
pub struct ProbeOutput {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ProbeFailure {
    Timeout,
    Cancelled,
    Launch,
    Capture,
}

struct SupervisedProcess {
    child: Child,
    stopped: bool,
    #[cfg(windows)]
    job: Option<std::os::windows::io::OwnedHandle>,
    #[cfg(unix)]
    group_id: i32,
}

impl SupervisedProcess {
    fn spawn(command: &mut Command) -> io::Result<Self> {
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            supervised_windows::spawn(command)
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
            if let Err(error) = nonblocking(process.child.stdout.as_ref().unwrap())
                .and_then(|()| nonblocking(process.child.stderr.as_ref().unwrap()))
            {
                process.stop();
                return Err(error);
            }
            Ok(process)
        }
        #[cfg(not(any(windows, unix)))]
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "supervised CLI execution is unsupported on this platform",
        ))
    }

    fn stop(&mut self) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        #[cfg(windows)]
        drop(self.job.take());
        #[cfg(unix)]
        {
            // SAFETY: this group was created exclusively for the child above.
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

impl Drop for SupervisedProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(windows)]
fn read_available<R: Read + std::os::windows::io::AsRawHandle>(
    stream: &mut R,
    buffer: &mut [u8],
) -> io::Result<usize> {
    use ::windows::Win32::Foundation::HANDLE;
    use ::windows::Win32::System::Pipes::PeekNamedPipe;
    let mut available = 0;
    // SAFETY: the stream owns a live anonymous pipe handle; PeekNamedPipe does
    // not consume bytes and this supervisor is the sole reader.
    unsafe {
        PeekNamedPipe(
            HANDLE(stream.as_raw_handle()),
            None,
            0,
            None,
            Some(&mut available),
            None,
        )
    }
    .map_err(|error| io::Error::from_raw_os_error(error.code().0 & 0xffff))?;
    if available == 0 {
        return Err(io::ErrorKind::WouldBlock.into());
    }
    let count = buffer.len().min(available as usize);
    stream.read(&mut buffer[..count])
}

#[cfg(unix)]
fn nonblocking(stream: &impl std::os::fd::AsRawFd) -> io::Result<()> {
    use std::os::fd::AsRawFd;
    // SAFETY: the borrowed stream owns the descriptor during both calls.
    let flags = unsafe { libc::fcntl(stream.as_raw_fd(), libc::F_GETFL) };
    if flags == -1 {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: same live descriptor and valid file-status flags.
    if unsafe { libc::fcntl(stream.as_raw_fd(), libc::F_SETFL, flags | libc::O_NONBLOCK) } == -1 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

#[cfg(unix)]
fn read_available<R: Read>(stream: &mut R, buffer: &mut [u8]) -> io::Result<usize> {
    stream.read(buffer)
}

#[cfg(windows)]
fn drain_stream<R: Read + std::os::windows::io::AsRawHandle>(
    stream: &mut R,
    retained: &mut Vec<u8>,
) -> io::Result<()> {
    drain_stream_impl(stream, retained)
}

#[cfg(unix)]
fn drain_stream<R: Read>(stream: &mut R, retained: &mut Vec<u8>) -> io::Result<()> {
    drain_stream_impl(stream, retained)
}

#[cfg(any(windows, unix))]
fn drain_stream_impl<R>(stream: &mut R, retained: &mut Vec<u8>) -> io::Result<()>
where
    R: Read + ReadAvailable,
{
    let mut drained = 0;
    let mut chunk = [0_u8; 4096];
    while drained < 32 * 1024 {
        match ReadAvailable::read_available(stream, &mut chunk) {
            Ok(0) => break,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::BrokenPipe
                ) =>
            {
                break;
            }
            Err(error) => return Err(error),
            Ok(count) => {
                drained += count;
                // One extra byte detects truncation for secret reads, where
                // using a partial credential would be unsafe.
                if retained.len() < OUTPUT_CAP + 1 {
                    let room = OUTPUT_CAP + 1 - retained.len();
                    retained.extend_from_slice(&chunk[..count.min(room)]);
                }
            }
        }
    }
    Ok(())
}

#[cfg(any(windows, unix))]
trait ReadAvailable: Read {
    fn read_available(&mut self, buffer: &mut [u8]) -> io::Result<usize>;
}

#[cfg(windows)]
impl<T: Read + std::os::windows::io::AsRawHandle> ReadAvailable for T {
    fn read_available(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        read_available(self, buffer)
    }
}

#[cfg(unix)]
impl<T: Read> ReadAvailable for T {
    fn read_available(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        read_available(self, buffer)
    }
}

fn scrub_environment(command: &mut Command) {
    command.env_clear();
    for key in [
        "SystemRoot",
        "WINDIR",
        "USERPROFILE",
        "HOME",
        "APPDATA",
        "LOCALAPPDATA",
        "TEMP",
        "TMP",
    ] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    command
        .env("CI", "1")
        .env("NO_COLOR", "1")
        .env("GH_PROMPT_DISABLED", "1")
        .env("GIT_TERMINAL_PROMPT", "0");
}

// Intentionally neither Debug nor Serialize: a credential command's output
// must never enter diagnostics or an IPC payload.
struct CapturedOutput {
    exit_code: Option<i32>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn run_capture_blocking(
    program: PathBuf,
    args: Vec<OsString>,
    timeout: Duration,
    cancel: watch::Receiver<bool>,
    terminal_hint: Option<&'static str>,
) -> Result<CapturedOutput, ProbeFailure> {
    run_capture_blocking_with_env(program, args, timeout, cancel, terminal_hint, &[])
}

fn run_capture_blocking_with_env(
    program: PathBuf,
    args: Vec<OsString>,
    timeout: Duration,
    cancel: watch::Receiver<bool>,
    terminal_hint: Option<&'static str>,
    additional_env: &[(OsString, OsString)],
) -> Result<CapturedOutput, ProbeFailure> {
    if *cancel.borrow() {
        return Err(ProbeFailure::Cancelled);
    }
    if timeout.is_zero() {
        return Err(ProbeFailure::Timeout);
    }
    let mut command = Command::new(program);
    command.args(args);
    scrub_environment(&mut command);
    for (key, value) in additional_env {
        command.env(key, value);
    }
    if let Some(term) = terminal_hint {
        command.env("TERM", term);
    }
    let mut process = SupervisedProcess::spawn(&mut command).map_err(|_| ProbeFailure::Launch)?;
    let mut stdout = process.child.stdout.take().ok_or(ProbeFailure::Launch)?;
    let mut stderr = process.child.stderr.take().ok_or(ProbeFailure::Launch)?;
    let mut out = Vec::new();
    let mut err = Vec::new();
    let deadline = Instant::now() + timeout;
    loop {
        if *cancel.borrow() {
            process.stop();
            return Err(ProbeFailure::Cancelled);
        }
        if Instant::now() >= deadline {
            process.stop();
            return Err(ProbeFailure::Timeout);
        }
        drain_stream(&mut stdout, &mut out).map_err(|_| ProbeFailure::Capture)?;
        drain_stream(&mut stderr, &mut err).map_err(|_| ProbeFailure::Capture)?;
        match process.child.try_wait() {
            Ok(Some(status)) => {
                drain_stream(&mut stdout, &mut out).map_err(|_| ProbeFailure::Capture)?;
                drain_stream(&mut stderr, &mut err).map_err(|_| ProbeFailure::Capture)?;
                return Ok(CapturedOutput {
                    exit_code: status.code(),
                    stdout: out,
                    stderr: err,
                });
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(_) => return Err(ProbeFailure::Launch),
        }
    }
}

fn run_probe_blocking(
    program: PathBuf,
    args: Vec<OsString>,
    timeout: Duration,
    cancel: watch::Receiver<bool>,
) -> Result<ProbeOutput, ProbeFailure> {
    let mut captured = run_capture_blocking(program, args, timeout, cancel, None)?;
    captured.stdout.truncate(OUTPUT_CAP);
    captured.stderr.truncate(OUTPUT_CAP);
    Ok(ProbeOutput {
        exit_code: captured.exit_code,
        stdout: UserFacingText::sanitize(&String::from_utf8_lossy(&captured.stdout)),
        stderr: UserFacingText::sanitize(&String::from_utf8_lossy(&captured.stderr)),
    })
}

struct CancelOnDrop(watch::Sender<bool>);

impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        let _send_result = self.0.send(true);
    }
}

fn credential_stdout(output: CapturedOutput) -> Option<String> {
    if output.exit_code != Some(0) || output.stdout.len() > OUTPUT_CAP {
        return None;
    }
    // Do not sanitize a secret into a different credential. Reject invalid
    // encoding; discard stderr regardless of exit status.
    String::from_utf8(output.stdout).ok()
}

async fn read_resolved_credential(
    resolved: ResolvedExecutable,
    args: &[&str],
    timeout: Duration,
) -> Option<String> {
    let (tx, rx) = watch::channel(false);
    let _cancel_on_drop = CancelOnDrop(tx);
    let mut all_args = resolved.prefix_args;
    all_args.extend(args.iter().map(OsString::from));
    let output = tokio::task::spawn_blocking(move || {
        run_capture_blocking(resolved.program, all_args, timeout, rx, None)
    })
    .await
    .ok()?
    .ok()?;
    credential_stdout(output)
}

/// Read a credential from a curated CLI, with bounded in-memory capture and
/// process-tree cleanup even when the awaiting provider fetch is dropped.
/// Never fall back to PATH, expose stderr, or put output in a probe report.
pub(crate) async fn read_cli_credential(provider: ProviderId, args: &[&str]) -> Option<String> {
    let dependency = cli_dependency(provider)?;
    let resolved = resolve_cli_command(dependency, &DiscoveryRoots::system())?;
    read_resolved_credential(resolved, args, PROBE_TIMEOUT).await
}

/// Capture a curated CLI's read-only JSON output with the same bounded,
/// cancellable process-tree supervision used for credential reads. Callers
/// must not forward stderr or stdout into user-facing error messages.
pub(crate) struct CliReadOutput {
    pub exit_code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub(crate) async fn read_cli_json(
    provider: ProviderId,
    args: &[&str],
) -> Option<Result<CliReadOutput, ProbeFailure>> {
    let dependency = cli_dependency(provider)?;
    let resolved = resolve_cli_command(dependency, &DiscoveryRoots::system())?;
    let (tx, rx) = watch::channel(false);
    let _cancel_on_drop = CancelOnDrop(tx);
    let mut all_args = resolved.prefix_args;
    all_args.extend(args.iter().map(OsString::from));
    Some(
        tokio::task::spawn_blocking(move || {
            run_capture_blocking(resolved.program, all_args, PROBE_TIMEOUT, rx, None).map(
                |output| CliReadOutput {
                    exit_code: output.exit_code,
                    stdout: output.stdout,
                    stderr: output.stderr,
                },
            )
        })
        .await
        .unwrap_or(Err(ProbeFailure::Launch)),
    )
}

/// Supervise an already-discovered provider CLI without routing it through a
/// second executable registry. The caller must validate the path and use fixed
/// arguments. Raw output is for local parsing only and must never be returned
/// in a user-facing error. Dropping the future stops the owned process tree.
pub(crate) async fn read_provider_cli(
    program: &Path,
    args: &[&str],
    terminal_hint: Option<&'static str>,
) -> Result<CliReadOutput, ProbeFailure> {
    let (tx, rx) = watch::channel(false);
    let _cancel_on_drop = CancelOnDrop(tx);
    let program = program.to_path_buf();
    let args = args.iter().map(OsString::from).collect();
    let output = tokio::task::spawn_blocking(move || {
        run_capture_blocking(program, args, PROBE_TIMEOUT, rx, terminal_hint)
    })
    .await
    .map_err(|_| ProbeFailure::Launch)??;
    Ok(CliReadOutput {
        exit_code: output.exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
    })
}

fn aws_credential_export_args(profile: &str) -> Vec<OsString> {
    vec![
        OsString::from("configure"),
        OsString::from("export-credentials"),
        OsString::from("--profile"),
        OsString::from(profile),
        OsString::from("--format"),
        OsString::from("process"),
    ]
}

fn aws_credential_export_env(get: impl Fn(&str) -> Option<OsString>) -> Vec<(OsString, OsString)> {
    [
        "AWS_CONFIG_FILE",
        "AWS_SHARED_CREDENTIALS_FILE",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
        "AWS_CA_BUNDLE",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_ROLE_ARN",
        "AWS_ROLE_SESSION_NAME",
        "AWS_WEB_IDENTITY_TOKEN_FILE",
        "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
        "AWS_CONTAINER_CREDENTIALS_FULL_URI",
        "AWS_CONTAINER_AUTHORIZATION_TOKEN",
        "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE",
        "AWS_EC2_METADATA_DISABLED",
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "NO_PROXY",
    ]
    .into_iter()
    .filter_map(|key| get(key).map(|value| (OsString::from(key), value)))
    .collect()
}

/// Read AWS profile credentials through the same supervised process-tree
/// runner. The caller supplies an already-validated executable and an explicit
/// allowlist of AWS configuration and source-credential variables; PATH is not
/// inherited. Some profiles use `credential_source = Environment` to assume a
/// role, so removing ambient AWS access keys would break those profiles. Raw
/// output must remain local to credential parsing, never user-facing errors.
pub(crate) async fn read_aws_credentials_cli(
    program: &Path,
    profile: &str,
) -> Result<CliReadOutput, ProbeFailure> {
    let (tx, rx) = watch::channel(false);
    let _cancel_on_drop = CancelOnDrop(tx);
    let program = program.to_path_buf();
    let args = aws_credential_export_args(profile);
    let additional_env = aws_credential_export_env(|key| std::env::var_os(key));
    let output = tokio::task::spawn_blocking(move || {
        run_capture_blocking_with_env(program, args, PROBE_TIMEOUT, rx, None, &additional_env)
    })
    .await
    .map_err(|_| ProbeFailure::Launch)??;
    Ok(CliReadOutput {
        exit_code: output.exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
    })
}

/// Synchronous variant for CLI metadata lookup performed before async fetch.
/// Its short timeout and process-tree ownership also apply to `--version`.
pub(crate) fn read_provider_cli_sync(
    program: &Path,
    args: &[&str],
) -> Result<CliReadOutput, ProbeFailure> {
    let (_tx, rx) = watch::channel(false);
    let args = args.iter().map(OsString::from).collect();
    let output = run_capture_blocking(program.to_path_buf(), args, PROBE_TIMEOUT, rx, None)?;
    Ok(CliReadOutput {
        exit_code: output.exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
    })
}

/// Run `program args...` non-interactively with a timeout and a cancellation
/// watch. The child is killed on either. Output is capped and sanitized.
pub async fn run_probe(
    program: &Path,
    args: &[&str],
    timeout: Duration,
    cancel: watch::Receiver<bool>,
) -> Result<ProbeOutput, ProbeFailure> {
    if *cancel.borrow() {
        return Err(ProbeFailure::Cancelled);
    }
    let program = program.to_path_buf();
    let args = args.iter().map(OsString::from).collect();
    tokio::task::spawn_blocking(move || run_probe_blocking(program, args, timeout, cancel))
        .await
        .map_err(|_| ProbeFailure::Launch)?
}

async fn run_resolved_probe(
    resolved: &ResolvedExecutable,
    args: &[&str],
    timeout: Duration,
    cancel: watch::Receiver<bool>,
) -> Result<ProbeOutput, ProbeFailure> {
    if *cancel.borrow() {
        return Err(ProbeFailure::Cancelled);
    }
    let mut all_args = resolved.prefix_args.clone();
    all_args.extend(args.iter().map(OsString::from));
    let program = resolved.program.clone();
    tokio::task::spawn_blocking(move || run_probe_blocking(program, all_args, timeout, cancel))
        .await
        .map_err(|_| ProbeFailure::Launch)?
}

/// First `major.minor[.patch]` in the output.
pub fn parse_version(output: &str) -> Option<String> {
    let bytes = output.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i].is_ascii_digit() {
            let start = i;
            while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
                i += 1;
            }
            let candidate = output[start..i].trim_end_matches('.');
            if candidate.split('.').count() >= 2
                && candidate
                    .split('.')
                    .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
            {
                return Some(candidate.to_string());
            }
        } else {
            i += 1;
        }
    }
    None
}

fn version_tuple(version: &str) -> Vec<u64> {
    version
        .split('.')
        .map(|p| p.parse::<u64>().unwrap_or(0))
        .collect()
}

pub fn version_satisfies(installed: &str, required: &str) -> bool {
    let a = version_tuple(installed);
    let b = version_tuple(required);
    for i in 0..a.len().max(b.len()) {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    true
}

pub fn classify_version(
    dependency: &CliDependency,
    output: Option<&ProbeOutput>,
) -> (CliStatus, Option<String>) {
    let Some(output) = output else {
        return (CliStatus::Broken, None);
    };
    if output.exit_code != Some(0) {
        return (CliStatus::Broken, None);
    }
    let text = format!("{}\n{}", output.stdout, output.stderr);
    match parse_version(&text) {
        Some(version) => {
            let status = match dependency.min_version {
                Some(required) if !version_satisfies(&version, required) => CliStatus::TooOld {
                    installed: version.clone(),
                    required,
                },
                _ => CliStatus::Installed,
            };
            (status, Some(version))
        }
        None => (CliStatus::VersionUnknown, None),
    }
}

fn detect_auth_file_session(provider: ProviderId, home: Option<&Path>) -> CliSessionState {
    let Some(home) = home else {
        return CliSessionState::Unknown;
    };
    let files = auth_files(provider);
    if files.is_empty() {
        return CliSessionState::Unknown;
    }
    let present = files.iter().any(|relative| {
        let path = home.join(relative);
        std::fs::metadata(&path).is_ok_and(|m| m.is_file() && m.len() > 0)
    });
    if present {
        CliSessionState::Authenticated
    } else {
        CliSessionState::NotSignedIn
    }
}

fn path_for_display(path: &Path) -> String {
    UserFacingText::sanitize(&path.display().to_string())
}

/// Detect one provider's CLI. Never installs, never runs a sign-in.
pub async fn detect(provider: ProviderId, cancel: watch::Receiver<bool>) -> Option<CliDetection> {
    let dependency = cli_dependency(provider)?;
    let base = CliDetection {
        provider,
        tool: dependency.tool,
        status: CliStatus::Missing,
        path: None,
        version: None,
        session: CliSessionState::Unknown,
        // Automated installs remain disabled until the downloaded artifact can
        // be authenticated before any package lifecycle code runs.
        install_available: false,
        docs_url: dependency.docs_url,
        sign_in_hint: dependency.sign_in_hint,
    };
    let Some(resolved) = resolve_cli_command(dependency, &DiscoveryRoots::system()) else {
        return Some(base);
    };
    let probe = run_resolved_probe(
        &resolved,
        dependency.version_args,
        PROBE_TIMEOUT,
        cancel.clone(),
    )
    .await;
    let (status, version) = classify_version(dependency, probe.as_ref().ok());
    let session = match (&status, dependency.session_detection) {
        (CliStatus::Missing | CliStatus::Broken, _) => CliSessionState::Unknown,
        (_, SessionDetection::AuthFile) => {
            detect_auth_file_session(provider, home_dir().as_deref())
        }
        (_, SessionDetection::StatusCommand) => {
            match run_resolved_probe(&resolved, &["auth", "status"], PROBE_TIMEOUT, cancel).await {
                Ok(out) if out.exit_code == Some(0) => CliSessionState::Authenticated,
                Ok(out) if out.exit_code == Some(1) => CliSessionState::NotSignedIn,
                _ => CliSessionState::Unknown,
            }
        }
        (_, SessionDetection::UsageFetch) => CliSessionState::Unknown,
    };
    Some(CliDetection {
        status,
        path: Some(path_for_display(&resolved.display_path)),
        version,
        session,
        ..base
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum InstallOutcome {
    Succeeded,
    PackageManagerMissing,
    PackageNotFound,
    NetworkError,
    PermissionDenied,
    Cancelled,
    TimedOut,
    /// Package manager exited 0 but the executable still cannot be resolved.
    BinaryNotFound,
    Failed {
        summary: String,
    },
}

/// Classify a finished install command from its exit code and capped,
/// sanitized output. Raw output never leaves this function.
pub fn classify_install(plan: &InstallPlan, output: &ProbeOutput) -> InstallOutcome {
    let text = format!("{}\n{}", output.stdout, output.stderr).to_ascii_lowercase();
    if output.exit_code == Some(0) {
        return InstallOutcome::Succeeded;
    }
    let network = [
        "enotfound",
        "econnreset",
        "etimedout",
        "network",
        "0x80072ee7",
        "0x80072efd",
    ];
    let permission = [
        "eacces",
        "eperm",
        "access is denied",
        "0x80070005",
        "administrator",
        "elevat",
        "1223",
        "cancelled by user",
        "canceled by user",
    ];
    let missing = [
        "no package found",
        "e404",
        "not found matching input",
        "0x8a150014",
    ];
    if network.iter().any(|n| text.contains(n)) {
        InstallOutcome::NetworkError
    } else if permission.iter().any(|n| text.contains(n)) {
        InstallOutcome::PermissionDenied
    } else if missing.iter().any(|n| text.contains(n)) {
        InstallOutcome::PackageNotFound
    } else {
        InstallOutcome::Failed {
            summary: format!(
                "{} {} exited with {}",
                plan.package_manager,
                plan.package,
                output
                    .exit_code
                    .map_or("no code".to_string(), |c| c.to_string())
            ),
        }
    }
}

/// Run a curated install plan. Callers must have obtained explicit user
/// confirmation; this function never decides to install on its own.
pub async fn run_install(plan: &InstallPlan, cancel: watch::Receiver<bool>) -> InstallOutcome {
    if *cancel.borrow() {
        return InstallOutcome::Cancelled;
    }
    InstallOutcome::Failed {
        summary: format!(
            "Automated {} installation is unavailable; use the official instructions",
            plan.package_manager
        ),
    }
}

#[cfg(windows)]
mod supervised_windows {
    use super::SupervisedProcess;
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

    pub(super) fn spawn(command: &mut Command) -> io::Result<SupervisedProcess> {
        // SAFETY: null attributes/name create an unnamed, noninheritable job;
        // every returned handle is immediately owned.
        let job =
            unsafe { CreateJobObjectW(None, ::windows::core::PCWSTR::null()) }.map_err(error)?;
        // SAFETY: successful creation transferred this unique handle.
        let job = unsafe { OwnedHandle::from_raw_handle(job.0) };
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        // SAFETY: correctly sized initialized information and a live job.
        unsafe {
            SetInformationJobObject(
                HANDLE(job.as_raw_handle()),
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                u32::try_from(std::mem::size_of_val(&limits)).unwrap(),
            )
        }
        .map_err(error)?;

        // Suspend before assignment so a cmd/node wrapper cannot create an
        // uncontained descendant in the spawn-to-job-assignment interval.
        command.creation_flags(CREATE_NO_WINDOW.0 | CREATE_SUSPENDED.0);
        let child = command.spawn()?;
        let process = SupervisedProcess {
            child,
            job: Some(job),
            stopped: false,
        };
        // SAFETY: both handles remain owned and live for this call.
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
        // SAFETY: documented snapshot flag and no borrowed buffers.
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) }.map_err(error)?;
        // SAFETY: successful creation transferred this unique handle.
        let snapshot = unsafe { OwnedHandle::from_raw_handle(snapshot.0) };
        let mut entry = THREADENTRY32 {
            dwSize: u32::try_from(std::mem::size_of::<THREADENTRY32>()).unwrap(),
            ..Default::default()
        };
        // SAFETY: initialized entry has the required size; snapshot stays live.
        unsafe { Thread32First(HANDLE(snapshot.as_raw_handle()), &mut entry) }.map_err(error)?;
        loop {
            if entry.th32OwnerProcessID == pid {
                // SAFETY: this is the initial thread of our suspended child.
                let thread =
                    unsafe { OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID) }
                        .map_err(error)?;
                // SAFETY: successful open transferred this unique handle.
                let thread = unsafe { OwnedHandle::from_raw_handle(thread.0) };
                // SAFETY: live thread handle with THREAD_SUSPEND_RESUME.
                if unsafe { ResumeThread(HANDLE(thread.as_raw_handle())) } == u32::MAX {
                    return Err(io::Error::last_os_error());
                }
                return Ok(());
            }
            // SAFETY: same initialized buffer and live snapshot.
            if unsafe { Thread32Next(HANDLE(snapshot.as_raw_handle()), &mut entry) }.is_err() {
                return Err(io::Error::other("suspended CLI thread was not found"));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection_capabilities::{CLI_DEPENDENCIES, install_plan};

    #[test]
    fn aws_export_keeps_explicit_profile_and_only_required_environment() {
        assert_eq!(
            aws_credential_export_args("role profile"),
            [
                "configure",
                "export-credentials",
                "--profile",
                "role profile",
                "--format",
                "process",
            ]
            .map(OsString::from)
        );

        let synthetic = std::collections::HashMap::from([
            ("AWS_CONFIG_FILE", OsString::from("fixture-config")),
            ("AWS_ACCESS_KEY_ID", OsString::from("fixture-access-key")),
            ("AWS_SECRET_ACCESS_KEY", OsString::from("fixture-secret")),
            ("AWS_SESSION_TOKEN", OsString::from("fixture-session")),
            ("PATH", OsString::from("untrusted-path")),
            ("OTHER_SECRET", OsString::from("unrelated-secret")),
        ]);
        let captured = aws_credential_export_env(|key| synthetic.get(key).cloned());
        for required in [
            "AWS_CONFIG_FILE",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_SESSION_TOKEN",
        ] {
            assert!(
                captured.iter().any(|(key, _)| key == required),
                "missing {required} for environment-backed role profiles"
            );
        }
        assert!(!captured.iter().any(|(key, _)| key == "PATH"));
        assert!(!captured.iter().any(|(key, _)| key == "OTHER_SECRET"));
    }

    #[tokio::test]
    async fn aws_export_wrapper_reads_only_a_bounded_synthetic_credential() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("aws_fixture.rs");
        #[cfg(windows)]
        let program = temp.path().join("aws.exe");
        #[cfg(not(windows))]
        let program = temp.path().join("aws");
        std::fs::write(
            &source,
            r##"fn main() {
                let args: Vec<String> = std::env::args().skip(1).collect();
                assert_eq!(args, ["configure", "export-credentials", "--profile", "fixture", "--format", "process"]);
                assert!(std::env::var_os("PATH").is_none());
                println!("{}", r#"{"Version":1,"AccessKeyId":"fixture-id","SecretAccessKey":"fixture-secret"}"#);
            }"##,
        )
        .unwrap();
        let rustc = std::env::var_os("RUSTC").unwrap_or_else(|| OsString::from("rustc"));
        let build = Command::new(rustc)
            .arg(&source)
            .arg("--edition=2021")
            .arg("-o")
            .arg(&program)
            .output()
            .expect("compile owned synthetic AWS CLI fixture");
        assert!(
            build.status.success(),
            "synthetic AWS CLI fixture must compile"
        );

        let output = read_aws_credentials_cli(&program, "fixture")
            .await
            .expect("bounded synthetic credential export");
        assert_eq!(output.exit_code, Some(0));
        assert!(output.stderr.is_empty());
        assert!(output.stdout.len() <= OUTPUT_CAP);
        let json: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(json["AccessKeyId"], "fixture-id");
    }

    fn probe(code: Option<i32>, stdout: &str, stderr: &str) -> ProbeOutput {
        ProbeOutput {
            exit_code: code,
            stdout: stdout.into(),
            stderr: stderr.into(),
        }
    }

    #[test]
    fn version_parsing_and_comparison() {
        assert_eq!(
            parse_version("codex-cli 0.42.1 (build)").as_deref(),
            Some("0.42.1")
        );
        assert_eq!(
            parse_version("gh version 2.55.0 (2024-08-01)\nhttps://x/2.55.0").as_deref(),
            Some("2.55.0")
        );
        assert_eq!(parse_version("v1.2").as_deref(), Some("1.2"));
        assert_eq!(parse_version("no digits here 42"), None);
        assert!(version_satisfies("2.55.0", "2.0"));
        assert!(version_satisfies("2.0.0", "2.0.0"));
        assert!(!version_satisfies("1.9.9", "2.0"));
        assert!(!version_satisfies("0.9", "0.10"));
    }

    #[test]
    fn version_status_distinguishes_missing_supported_old_unknown_broken() {
        let mut dep = CLI_DEPENDENCIES[0].clone();
        dep.min_version = Some("1.0.0");
        assert_eq!(classify_version(&dep, None).0, CliStatus::Broken);
        assert_eq!(
            classify_version(&dep, Some(&probe(Some(0), "1.4.0", ""))).0,
            CliStatus::Installed
        );
        assert_eq!(
            classify_version(&dep, Some(&probe(Some(0), "0.9.1", ""))).0,
            CliStatus::TooOld {
                installed: "0.9.1".into(),
                required: "1.0.0"
            }
        );
        assert_eq!(
            classify_version(&dep, Some(&probe(Some(0), "ok", ""))).0,
            CliStatus::VersionUnknown
        );
        assert_eq!(
            classify_version(&dep, Some(&probe(Some(2), "", "boom"))).0,
            CliStatus::Broken
        );
        assert_eq!(
            classify_version(
                &dep,
                Some(&probe(Some(9), "codex-cli 9.9.9", "probe failed"))
            ),
            (CliStatus::Broken, None),
            "a failed version command must never report the CLI as installed"
        );
    }

    #[test]
    fn auth_file_presence_is_not_confused_with_an_empty_or_missing_file() {
        let home = tempfile::tempdir().unwrap();
        assert_eq!(
            detect_auth_file_session(ProviderId::Codex, Some(home.path())),
            CliSessionState::NotSignedIn
        );
        std::fs::create_dir_all(home.path().join(".codex")).unwrap();
        std::fs::write(home.path().join(".codex/auth.json"), "").unwrap();
        assert_eq!(
            detect_auth_file_session(ProviderId::Codex, Some(home.path())),
            CliSessionState::NotSignedIn
        );
        std::fs::write(home.path().join(".codex/auth.json"), "{}").unwrap();
        assert_eq!(
            detect_auth_file_session(ProviderId::Codex, Some(home.path())),
            CliSessionState::Authenticated
        );
        assert_eq!(
            detect_auth_file_session(ProviderId::Doubao, Some(home.path())),
            CliSessionState::Unknown
        );
        assert_eq!(
            detect_auth_file_session(ProviderId::Codex, None),
            CliSessionState::Unknown
        );
    }

    #[test]
    fn every_auth_file_dependency_declares_its_files() {
        for dep in CLI_DEPENDENCIES {
            if dep.session_detection == SessionDetection::AuthFile {
                assert!(!auth_files(dep.provider).is_empty(), "{}", dep.tool);
            }
        }
    }

    #[test]
    fn install_outcomes_are_classified_without_leaking_raw_output() {
        let plan = install_plan(&CLI_DEPENDENCIES[0]).unwrap();
        assert_eq!(
            classify_install(&plan, &probe(Some(0), "added 1 package", "")),
            InstallOutcome::Succeeded
        );
        assert_eq!(
            classify_install(&plan, &probe(Some(1), "", "npm ERR! code E404")),
            InstallOutcome::PackageNotFound
        );
        assert_eq!(
            classify_install(&plan, &probe(Some(1), "", "npm ERR! code EACCES")),
            InstallOutcome::PermissionDenied
        );
        assert_eq!(
            classify_install(&plan, &probe(Some(1), "", "getaddrinfo ENOTFOUND registry")),
            InstallOutcome::NetworkError
        );
        let other = classify_install(
            &plan,
            &probe(Some(7), "", "Bearer sk-secret-123456789 failed"),
        );
        match other {
            InstallOutcome::Failed { summary } => {
                assert!(!summary.contains("sk-secret"));
                assert!(summary.contains("exited with 7"));
            }
            other => panic!("{other:?}"),
        }
    }

    #[cfg(windows)]
    fn system_cmd() -> PathBuf {
        // cmd parses a forward slash in its own executable path as a switch.
        PathBuf::from(std::env::var_os("SystemRoot").expect("SystemRoot"))
            .join("System32")
            .join("cmd.exe")
    }

    #[cfg(windows)]
    #[test]
    fn resolver_rejects_filename_only_shims_and_requires_exact_npm_metadata() {
        let temp = tempfile::tempdir().unwrap();
        let protected = temp.path().join("protected");
        let roaming = temp.path().join("roaming");
        std::fs::create_dir_all(protected.join("nodejs")).unwrap();
        std::fs::write(protected.join("nodejs/node.exe"), b"fixture").unwrap();
        std::fs::create_dir_all(roaming.join("npm")).unwrap();
        std::fs::write(roaming.join("npm/codex.cmd"), b"@echo hostile").unwrap();
        let roots = DiscoveryRoots {
            protected_roots: vec![protected.clone()],
        };
        let dependency = cli_dependency(ProviderId::Codex).unwrap();
        assert!(resolve_cli_command(dependency, &roots).is_none());

        let package = roaming.join("npm/node_modules/@openai/codex");
        std::fs::create_dir_all(package.join("bin")).unwrap();
        std::fs::write(package.join("bin/codex.js"), b"fixture").unwrap();
        std::fs::write(
            package.join("package.json"),
            br#"{"name":"@attacker/codex","bin":{"codex":"bin/codex.js"}}"#,
        )
        .unwrap();
        assert!(resolve_cli_command(dependency, &roots).is_none());

        std::fs::write(
            package.join("package.json"),
            br#"{"name":"@openai/codex","bin":{"codex":"bin/codex.js"}}"#,
        )
        .unwrap();
        // Even a perfect manifest in a user-writable npm tree is not provenance.
        assert!(resolve_cli_command(dependency, &roots).is_none());
        let package = protected.join("nodejs/node_modules/@openai/codex");
        std::fs::create_dir_all(package.join("bin")).unwrap();
        std::fs::write(package.join("bin/codex.js"), b"fixture").unwrap();
        std::fs::write(
            package.join("package.json"),
            br#"{"name":"@openai/codex","bin":{"codex":"bin/codex.js"}}"#,
        )
        .unwrap();
        let resolved = resolve_cli_command(dependency, &roots).expect("protected fixture CLI");
        assert_eq!(
            resolved.program,
            std::fs::canonicalize(protected.join("nodejs/node.exe")).unwrap()
        );
        assert_eq!(
            resolved.display_path,
            std::fs::canonicalize(package.join("bin/codex.js")).unwrap()
        );
    }

    #[cfg(windows)]
    #[test]
    fn doubao_manual_cli_resolves_only_the_official_protected_npm_package() {
        let temp = tempfile::tempdir().unwrap();
        let protected = temp.path().join("protected");
        let roaming = temp.path().join("roaming");
        std::fs::create_dir_all(protected.join("nodejs")).unwrap();
        std::fs::write(protected.join("nodejs/node.exe"), b"fixture").unwrap();
        let roots = DiscoveryRoots {
            protected_roots: vec![protected.clone()],
        };
        let dependency = cli_dependency(ProviderId::Doubao).unwrap();
        let roaming_package = roaming.join("npm/node_modules/@volcengine/ark-cli");
        std::fs::create_dir_all(roaming_package.join("scripts")).unwrap();
        std::fs::write(roaming_package.join("scripts/run.js"), b"fixture").unwrap();
        std::fs::write(
            roaming_package.join("package.json"),
            br#"{"name":"@volcengine/ark-cli","bin":{"arkcli":"scripts/run.js"}}"#,
        )
        .unwrap();
        assert!(resolve_cli_command(dependency, &roots).is_none());

        let package = protected.join("nodejs/node_modules/@volcengine/ark-cli");
        std::fs::create_dir_all(package.join("scripts")).unwrap();
        std::fs::write(package.join("scripts/run.js"), b"fixture").unwrap();
        std::fs::write(
            package.join("package.json"),
            br#"{"name":"@attacker/ark-cli","bin":{"arkcli":"scripts/run.js"}}"#,
        )
        .unwrap();
        assert!(resolve_cli_command(dependency, &roots).is_none());
        std::fs::write(
            package.join("package.json"),
            br#"{"name":"@volcengine/ark-cli","bin":{"arkcli":"scripts/run.js"}}"#,
        )
        .unwrap();
        let resolved = resolve_cli_command(dependency, &roots).expect("official Ark CLI");
        assert_eq!(
            resolved.program,
            std::fs::canonicalize(protected.join("nodejs/node.exe")).unwrap()
        );
        assert_eq!(
            resolved.display_path,
            std::fs::canonicalize(package.join("scripts/run.js")).unwrap()
        );
        assert!(
            install_plan(dependency).is_none(),
            "manual install policy remains unchanged"
        );
    }

    #[cfg(windows)]
    #[test]
    fn kiro_resolver_accepts_only_a_protected_native_executable() {
        let temp = tempfile::tempdir().unwrap();
        let protected = temp.path().join("protected");
        let user_local = temp.path().join("user-local");
        std::fs::create_dir_all(protected.join("Kiro")).unwrap();
        std::fs::create_dir_all(user_local.join("Programs/Kiro")).unwrap();
        std::fs::write(user_local.join("Programs/Kiro/kiro-cli.exe"), b"fixture").unwrap();
        let dependency = cli_dependency(ProviderId::Kiro).unwrap();
        let roots = DiscoveryRoots {
            protected_roots: vec![protected.clone()],
        };
        assert!(resolve_cli_command(dependency, &roots).is_none());

        let trusted = protected.join("Kiro/kiro-cli.exe");
        std::fs::write(&trusted, b"fixture").unwrap();
        let resolved = resolve_cli_command(dependency, &roots).expect("protected Kiro CLI");
        assert_eq!(resolved.program, std::fs::canonicalize(trusted).unwrap());
        assert_eq!(resolved.display_path, resolved.program);
        assert!(install_plan(dependency).is_none());
    }

    #[cfg(unix)]
    #[test]
    fn kiro_resolver_accepts_a_protected_unix_binary() {
        let temp = tempfile::tempdir().unwrap();
        let protected = temp.path().join("protected");
        std::fs::create_dir_all(protected.join("bin")).unwrap();
        let trusted = protected.join("bin/kiro-cli");
        std::fs::write(&trusted, b"fixture").unwrap();
        let roots = DiscoveryRoots {
            protected_roots: vec![protected],
        };
        let dependency = cli_dependency(ProviderId::Kiro).unwrap();
        let resolved = resolve_cli_command(dependency, &roots).expect("protected Kiro CLI");
        assert_eq!(resolved.program, std::fs::canonicalize(trusted).unwrap());
    }

    #[test]
    fn credential_capture_rejects_failed_truncated_or_invalid_output_without_sanitizing() {
        let captured = |exit_code, stdout| CapturedOutput {
            exit_code,
            stdout,
            stderr: b"never use stderr as a credential".to_vec(),
        };
        assert_eq!(
            credential_stdout(captured(Some(0), b"Bearer fixture.secret\r\n".to_vec())),
            Some("Bearer fixture.secret\r\n".into())
        );
        assert!(credential_stdout(captured(Some(1), b"fixture".to_vec())).is_none());
        assert!(credential_stdout(captured(None, b"fixture".to_vec())).is_none());
        assert!(credential_stdout(captured(Some(0), vec![b'x'; OUTPUT_CAP + 1])).is_none());
        assert!(credential_stdout(captured(Some(0), vec![0xff])).is_none());
    }

    #[test]
    fn dropping_credential_guard_signals_cancellation() {
        let (tx, rx) = watch::channel(false);
        let guard = CancelOnDrop(tx);
        assert!(!*rx.borrow());
        drop(guard);
        assert!(*rx.borrow());
    }

    #[cfg(windows)]
    fn fixture_command() -> ResolvedExecutable {
        ResolvedExecutable {
            program: system_cmd(),
            prefix_args: vec![],
            display_path: system_cmd(),
        }
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn credential_process_keeps_secret_out_of_probe_sanitization_and_rejects_overflow() {
        let value = read_resolved_credential(
            fixture_command(),
            &["/d", "/c", "echo Bearer fixture.secret"],
            Duration::from_secs(5),
        )
        .await;
        assert_eq!(
            value.as_deref().map(str::trim),
            Some("Bearer fixture.secret")
        );
        let value = read_resolved_credential(
            fixture_command(),
            &[
                "/d",
                "/c",
                "for /L %i in (1,1,3000) do @echo fixture.secret",
            ],
            Duration::from_secs(5),
        )
        .await;
        assert!(value.is_none(), "never accept a truncated token");
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn dropped_credential_future_kills_its_started_process() {
        let temp = tempfile::tempdir().unwrap();
        let started = temp.path().join("started.txt");
        let escaped = temp.path().join("escaped.txt");
        let script = temp.path().join("credential.cmd");
        let ping = system_cmd().parent().unwrap().join("ping.exe");
        std::fs::write(
            &script,
            format!(
                "@echo off\r\necho started>\"{}\"\r\n\"{}\" -n 4 127.0.0.1 >nul\r\necho escaped>\"{}\"\r\n",
                started.display(), ping.display(), escaped.display()
            ),
        ).unwrap();
        let script_arg = script.to_string_lossy().into_owned();
        let task = tokio::spawn(async move {
            read_resolved_credential(
                fixture_command(),
                &["/d", "/s", "/c", &script_arg],
                Duration::from_secs(20),
            )
            .await
        });
        let deadline = Instant::now() + Duration::from_secs(5);
        while !started.exists() && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        let did_start = started.exists();
        task.abort();
        assert!(task.await.unwrap_err().is_cancelled());
        assert!(did_start, "fixture never reached the cancellation boundary");
        tokio::time::sleep(Duration::from_secs(4)).await;
        assert!(
            !escaped.exists(),
            "credential process survived future cancellation"
        );
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn credential_timeout_discards_partial_stdout() {
        let temp = tempfile::tempdir().unwrap();
        let script = temp.path().join("timeout.cmd");
        let marker = temp.path().join("started.txt");
        let ping = system_cmd().parent().unwrap().join("ping.exe");
        std::fs::write(
            &script,
            format!(
                "@echo started>\"{}\"\r\n@echo fixture.secret\r\n@\"{}\" -n 30 127.0.0.1 >nul\r\n",
                marker.display(),
                ping.display()
            ),
        )
        .unwrap();
        let started = Instant::now();
        let result = read_resolved_credential(
            fixture_command(),
            &["/d", "/s", "/c", &script.to_string_lossy()],
            Duration::from_millis(300),
        )
        .await;
        assert!(result.is_none());
        assert!(marker.exists(), "timeout fixture must actually start");
        assert!(started.elapsed() >= Duration::from_millis(300));
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[cfg(windows)]
    #[test]
    fn unexpected_pipe_read_error_is_not_treated_as_complete_output() {
        let mut not_a_pipe = tempfile::tempfile().unwrap();
        let mut retained = b"incomplete-credential".to_vec();
        assert!(drain_stream(&mut not_a_pipe, &mut retained).is_err());
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn pre_cancelled_probe_never_spawns() {
        let temp = tempfile::tempdir().unwrap();
        let marker = temp.path().join("spawned.txt");
        let script = temp.path().join("spawn.cmd");
        std::fs::write(
            &script,
            format!("@echo spawned>\"{}\"\r\n", marker.display()),
        )
        .unwrap();
        let (_tx, rx) = watch::channel(true);
        let script = script.to_string_lossy().into_owned();
        let result = run_probe(
            &system_cmd(),
            &["/d", "/s", "/c", &script],
            Duration::from_secs(5),
            rx,
        )
        .await;
        assert_eq!(result.unwrap_err(), ProbeFailure::Cancelled);
        assert!(!marker.exists());
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn probe_environment_does_not_inherit_path_or_node_options() {
        for variable in ["PATH", "NODE_OPTIONS"] {
            let (_tx, rx) = watch::channel(false);
            // `set PATH` also matches cmd's own PATHEXT. Test the exact
            // variable, and require a successful fixture execution.
            let check = format!("if defined {variable} (exit /b 1) else (echo absent)");
            let out = run_probe(
                &system_cmd(),
                &["/d", "/c", &check],
                Duration::from_secs(5),
                rx,
            )
            .await
            .unwrap();
            assert_eq!(out.exit_code, Some(0), "{variable}: {out:?}");
            assert_eq!(out.stdout.trim(), "absent", "{variable}: {}", out.stdout);
        }
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn cancellation_kills_the_spawned_process_tree() {
        let temp = tempfile::tempdir().unwrap();
        let marker = temp.path().join("descendant-survived.txt");
        let child = temp.path().join("child.cmd");
        let parent = temp.path().join("parent.cmd");
        let system32 = system_cmd().parent().unwrap().to_path_buf();
        std::fs::write(
            &child,
            format!(
                "@echo off\r\n\"{}\" -n 4 127.0.0.1 >nul\r\necho survived>\"{}\"\r\n",
                system32.join("ping.exe").display(),
                marker.display()
            ),
        )
        .unwrap();
        std::fs::write(
            &parent,
            format!(
                "@echo off\r\nstart \"\" /b \"{}\" /d /s /c call \"{}\"\r\n\"{}\" -n 30 127.0.0.1 >nul\r\n",
                system_cmd().display(),
                child.display(),
                system32.join("ping.exe").display()
            ),
        )
        .unwrap();

        let (tx, rx) = watch::channel(false);
        let parent_arg = parent.to_string_lossy().into_owned();
        let handle = tokio::spawn(async move {
            run_probe(
                &system_cmd(),
                &["/d", "/s", "/c", &parent_arg],
                Duration::from_secs(20),
                rx,
            )
            .await
        });
        tokio::time::sleep(Duration::from_millis(400)).await;
        tx.send(true).unwrap();
        assert_eq!(handle.await.unwrap().unwrap_err(), ProbeFailure::Cancelled);
        tokio::time::sleep(Duration::from_secs(4)).await;
        assert!(!marker.exists(), "descendant escaped the owned job");
    }

    #[tokio::test]
    async fn automated_install_fails_closed_without_launching_a_package_manager() {
        let plan = InstallPlan {
            program: "definitely-untrusted-package-manager",
            args: vec!["install", "attacker/package"],
            requires_admin: false,
            package_manager: "fixture-manager",
            package: "official/package",
        };
        let (_tx, rx) = watch::channel(false);
        let outcome = run_install(&plan, rx).await;
        match outcome {
            InstallOutcome::Failed { summary } => {
                assert!(summary.contains("official instructions"));
                assert!(!summary.contains("attacker/package"));
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[tokio::test]
    async fn probes_time_out_and_cancel_with_the_child_killed() {
        #[cfg(windows)]
        let program = system_cmd().parent().unwrap().join("ping.exe");
        #[cfg(windows)]
        let args: &[&str] = &["-n", "30", "127.0.0.1"];
        #[cfg(unix)]
        let program = which::which("sh").unwrap();
        #[cfg(unix)]
        let args: &[&str] = &["-c", "sleep 30"];
        let (_tx, rx) = watch::channel(false);
        let started = std::time::Instant::now();
        let result = run_probe(&program, args, Duration::from_millis(300), rx).await;
        assert_eq!(result.unwrap_err(), ProbeFailure::Timeout);
        assert!(started.elapsed() < Duration::from_secs(10));

        let (tx, rx) = watch::channel(false);
        let started = std::time::Instant::now();
        let owned = program.clone();
        let handle =
            tokio::spawn(async move { run_probe(&owned, args, Duration::from_secs(30), rx).await });
        tokio::time::sleep(Duration::from_millis(200)).await;
        tx.send(true).unwrap();
        assert_eq!(handle.await.unwrap().unwrap_err(), ProbeFailure::Cancelled);
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[tokio::test]
    async fn probe_output_is_capped_and_sanitized() {
        let program = which::which("cmd").or_else(|_| which::which("sh")).unwrap();
        let args: &[&str] = if program.ends_with("cmd.exe") || program.ends_with("cmd") {
            &[
                "/c",
                "echo Bearer abc.def token && echo C:\\Users\\JaneDoe\\x",
            ]
        } else {
            &["-c", "echo Bearer abc.def token; echo /home/jane/x"]
        };
        let (_tx, rx) = watch::channel(false);
        let out = run_probe(&program, args, PROBE_TIMEOUT, rx).await.unwrap();
        assert_eq!(out.exit_code, Some(0));
        assert!(!out.stdout.trim().is_empty());
        assert!(!out.stdout.contains("abc.def"));
        assert!(!out.stdout.contains("JaneDoe") && !out.stdout.contains("/home/jane"));
        assert!(out.stdout.len() <= OUTPUT_CAP);
    }

    #[tokio::test]
    async fn provider_cli_capture_and_sync_version_use_the_supervisor() {
        #[cfg(windows)]
        let (program, args): (PathBuf, &[&str]) = (system_cmd(), &["/c", "echo supervised"]);
        #[cfg(unix)]
        let (program, args): (PathBuf, &[&str]) =
            (which::which("sh").unwrap(), &["-c", "echo supervised"]);

        let usage = read_provider_cli(&program, args, Some("xterm-256color"))
            .await
            .expect("supervised async provider command");
        assert_eq!(usage.exit_code, Some(0));
        assert!(String::from_utf8_lossy(&usage.stdout).contains("supervised"));
        let version = read_provider_cli_sync(&program, args)
            .expect("supervised synchronous provider command");
        assert_eq!(version.exit_code, Some(0));
        assert!(String::from_utf8_lossy(&version.stdout).contains("supervised"));
    }

    #[tokio::test]
    async fn missing_cli_reports_missing_without_any_probe() {
        let (_tx, rx) = watch::channel(false);
        // Doubao's `ark` CLI is not expected on CI machines; a missing tool
        // must never claim a session state.
        if resolve_executable(cli_dependency(ProviderId::Doubao).unwrap()).is_none() {
            let d = detect(ProviderId::Doubao, rx).await.unwrap();
            assert_eq!(d.status, CliStatus::Missing);
            assert_eq!(d.session, CliSessionState::Unknown);
            assert!(!d.install_available);
        }
        assert!(
            detect(ProviderId::OpenRouter, watch::channel(false).1)
                .await
                .is_none()
        );
    }
}
