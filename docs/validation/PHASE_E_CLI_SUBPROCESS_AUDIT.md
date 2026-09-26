# Phase E — CLI subprocess execution audit

Date: 2026-09-26. Source: `2c7e45cc`. Covers the "CLI subprocess audit" item the
master goal's release security audit requires, which
`PHASE_E_SECURITY_AND_DEPENDENCY_AUDIT.md` listed as open.

## Scope

Every process-spawn site in `rust/src` and
`apps/desktop-tauri/src-tauri/src` was enumerated and classified. The
security-relevant question is not "does the app spawn processes" — it does, by
design, to read provider CLIs — but whether an attacker-influenced input can
reach a shell, or an untrusted executable can be launched.

## 1. Shell-string execution: none in production code

A sweep for `cmd /C`, `sh -c`, `bash -c` and `powershell -Command` across both
trees returns exactly one hit:

```
rust/src/codex_accounts/login_runner.rs:514:  command.args(["/D", "/C", "exit", "0"]);
```

That line is inside a `#[cfg(test)]` module, uses three fixed literals, and
interpolates nothing. **No production code path executes a shell string.**

Every real spawn uses an argument vector: `Command::new(program)` followed by
`.args(...)`, so arguments are passed as discrete values and are never
re-parsed by a shell.

## 2. Executable resolution does not trust bare PATH

`DiscoveryRoots::system()` derives its protected roots from the Windows
registry values `ProgramFilesDir` and `ProgramFilesDir (x86)`
(`cli_dependencies.rs:106-124`). Resolution is confined to those machine-wide
roots rather than whatever the current process's `PATH` happens to contain.

The intent is stated in the source itself:

- `cli_dependencies.rs:351` — "Never execute a filename-only PATH shim or a
  user-writable script here."
- `cli_dependencies.rs:494` — "Arbitrary PATH entries and filename-only home
  shims are" not accepted.
- `cli_dependencies.rs:920` — "Never fall back to PATH, expose stderr, or put
  output in a probe report."

## 3. Claude CLI: Authenticode + signer verification

`trusted_claude_native_executable_cancellable` accepts a candidate only after
`verify_anthropic_windows_binary_cancellable` (`cli_dependencies.rs:453-481`),
which:

1. rejects anything that is not an existing file with an `.exe` extension;
2. canonicalises the path, so symlink/junction games resolve to a real target;
3. runs a **fixed** PowerShell verification script, passing
   `CLAUDE_SIGNATURE_VERIFY_SCRIPT` — a compile-time constant, with no
   interpolated input, so there is no injection surface;
4. validates the Authenticode signature and the signer common name, matching
   Anthropic's documented "Anthropic, PBC" signing identity.

A filename-only PATH shim cannot satisfy step 4, so a hijacked `PATH` entry
fails closed for this provider rather than executing.

## 4. Child environment is scrubbed, and PATH is not passed through

`scrub_environment` (`cli_dependencies.rs:750-771`) calls `env_clear()` and then
re-adds only:

`SystemRoot`, `WINDIR`, `USERPROFILE`, `HOME`, `APPDATA`, `LOCALAPPDATA`,
`TEMP`, `TMP`, plus the explicit non-interactive settings `CI=1`, `NO_COLOR=1`,
`GH_PROMPT_DISABLED=1`, `GIT_TERMINAL_PROMPT=0`.

**`PATH` is deliberately absent**, so even a resolved absolute executable
cannot itself re-resolve a library or helper through an inherited `PATH`.
Tests at `cli_dependencies.rs:1690`, `:1705` and `:1722` assert that a hostile
`PATH` does not reach the child environment.

The signature probe additionally runs with an isolated `PSModulePath` pointing
at an empty scratch directory, so a user-planted shadow module cannot subvert
the verification step. This behaviour is pinned by
`claude_signature_probe_never_loads_user_shadow_module`.

## 5. Lifecycle controls are present

- Bounded output: `OUTPUT_CAP` (16 KiB) and `run_capture_blocking` enforce a
  capture cap, so a chatty CLI cannot exhaust memory.
- Timeouts: every probe takes an explicit `Duration`; the default interactive
  budget is `PROBE_TIMEOUT` (15s), and `INSTALL_TIMEOUT` (600s) covers installs.
- Cancellation: probes poll a `watch` channel and return
  `ProbeFailure::Cancelled` promptly.
- Reaping: children are started through `SupervisedProcess::spawn`, so a
  dropped future or a cancelled operation still terminates the owned process
  rather than orphaning it.

## Findings

**No vulnerability was found in the CLI subprocess execution path.** The
design already addresses shell injection (argument vectors only), PATH
hijacking (protected roots, no `PATH` inheritance, signature verification for
the highest-risk provider), environment leakage (`env_clear` plus an
allowlist), and process lifecycle (timeouts, cancellation, supervision,
output caps).

## Limits of this audit

This covers process spawning and execution trust. It does not by itself prove:

- that every provider's dependency metadata is correct and current;
- that the protected-root model covers every install layout a user may have;
- the credential-storage audit, which is tracked in
  `PROVIDER_CREDENTIAL_SECURITY_AUDIT.md`;
- cookie collection minimisation, which remains open.