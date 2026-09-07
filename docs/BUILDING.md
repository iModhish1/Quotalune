# Building from Source

## Prerequisites

- **Rust** stable with the `x86_64-pc-windows-msvc` target
- **Microsoft Visual Studio Build Tools** with the **Desktop development with C++** workload
- **Node.js** 22.13+ (24 recommended) and pnpm 11

Install the tools manually with rustup/winget/corepack, or use a tool manager
such as mise. There is no automatic Windows bootstrap script in this port.

## Build the Desktop App

```powershell
cd apps/desktop-tauri
pnpm install --frozen-lockfile
cd ../..
pnpm --dir apps/desktop-tauri run tauri:build
```

The release binary lands at `target/release/Quotalis.exe`.

For a debug build (faster compile, no optimisations):
```powershell
cd apps/desktop-tauri
pnpm run tauri:build:debug
```

## Build the CLI Only

```powershell
cargo build --manifest-path rust/Cargo.toml --release --bin quotalis
# Binary at: target/release/quotalis.exe
```

## Dev Mode (Hot Reload)

```powershell
.\scripts\dev.ps1           # default debug build + launch
.\scripts\dev.ps1 -Release  # optimised build
.\scripts\dev.ps1 -Verbose  # debug logging
.\scripts\dev.ps1 -SkipBuild # run last build without rebuilding
```

Or directly:
```powershell
cd apps/desktop-tauri && pnpm run tauri:dev
```

## Windows installer packaging — NSIS is the primary Personal installer

The Tauri-native NSIS/MSI bundler is the primary, actively-used Personal
installer path:

```powershell
cd apps/desktop-tauri
pnpm exec tauri build --bundles nsis,msi
```

Tauri fetches its own NSIS/WiX tooling automatically on first use — no
manual toolchain install is required. This is what actually produces
Personal's real installed build today (verified directly: the real
installed Personal app's install path matches this pipeline's output
shape, not the Inno Setup pipeline's — see
`docs/validation/QUOTALIS_INNO_RELEASE_AUDIT.md`).

### Legacy: Inno Setup release pipeline (`rust/installer/quotalis.iss`)

`scripts/windows-release-build.ps1` drives a separate, older Inno Setup
pipeline that also packages a standalone CLI binary and a portable zip.
It requires Inno Setup 6 (`winget install JRSoftware.InnoSetup` — free,
open-source) pre-installed, unlike the self-provisioning NSIS path. Treat
this as the **secondary** packaging path (CLI/portable distribution), not
the source of truth for what "the Quotalis Personal installer" is:

```powershell
.\scripts\windows-release-build.ps1 -Ref v0.27.4
```

It builds from a clean managed checkout but keeps Cargo output, the pnpm store,
and signed installer bootstrapper downloads in `C:\code\Win-CodexBar-release\cache`
(the script's actual default `-WorkRoot`; pass `-WorkRoot` explicitly to use
a different location). Release assets land in `<WorkRoot>\assets`. Keep the
`.sha256` sidecars; they are the copy/paste source for Winget's
`InstallerSha256`.

Useful release flags:

```powershell
.\scripts\windows-release-build.ps1 -Ref vX.Y.Z -WarmCacheOnly
.\scripts\windows-release-build.ps1 -Ref vX.Y.Z -SmokeInstall
.\scripts\release-doctor.ps1 -Version X.Y.Z
```

`windows-release-build.ps1` only builds and smoke-tests. It has no upload
switch. The hosted release path is the approval-gated CircleCI workflow
documented in `docs/release/ci-cd.md`; publication uses its no-clobber,
SHA-256-checked draft publisher.

## macOS Windows Cross Build

For a fast compile check from macOS, use the cross-build wrapper:

```bash
./scripts/macos-windows-cross-build.sh
```

Or call the desktop package script directly:

```bash
pnpm --dir apps/desktop-tauri run tauri:build:windows-cross
```

This uses `cargo-xwin` plus Homebrew `llvm`/`lld` to build the Windows MSVC
Tauri executable at `target/x86_64-pc-windows-msvc/release/Quotalis.exe`.
It is useful for catching frontend, Tauri, and Windows-target Rust compile
failures from a Mac. It does not replace the Windows server release path:
installer packaging, tray behavior, WebView2, DPAPI, startup integration, and
smoke install validation still need a real Windows machine.

## Project Structure

```
Quotalis/
├── apps/desktop-tauri/          # Tauri desktop shell
│   ├── src/                     # React frontend (TypeScript)
│   └── src-tauri/               # Tauri/Rust backend
│       └── src/
│           ├── commands/        # Tauri IPC commands
│           ├── shell/           # Window management, DWM, tray bridge
│           └── main.rs          # App entry point
├── rust/                        # Shared backend crate + CLI
│   └── src/
│       ├── providers/           # Per-provider fetch/parse/auth
│       ├── core/                # Provider IDs, cost pricing
│       ├── browser/             # Browser cookie extraction (DPAPI)
│       ├── tray/                # Tray icon rendering
│       └── main.rs              # CLI entry point
├── docs/                        # Documentation
└── scripts/                     # Dev/release helper scripts
```

## Documentation map

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Modules, entry points, data flow (Windows/Tauri) |
| [CLI.md](./CLI.md) | `codexbar.exe` commands |
| [CONFIGURATION.md](./CONFIGURATION.md) | Config paths, `codexbar config`, settings tabs |
| [PROVIDERS.md](./PROVIDERS.md) | Provider factory and sources |
| [COOKIES.md](./COOKIES.md) | Browser cookie import (DPAPI) |
| [WSL.md](./WSL.md) | WSL limitations |
| [WINDOWS_PROOF.md](./WINDOWS_PROOF.md) | Manual/runtime proof checklist |
| [release/ci-cd.md](./release/ci-cd.md) | Hosted PR check + local release |
| [../AGENTS.md](../AGENTS.md) | Agent/contributor guidelines |

Upstream macOS docs (`steipete/QuotaArc`) are a **read-only** concept source. Do not copy Swift/Keychain/Sparkle instructions here without a Windows rewrite.


## Running Tests

```bash
# Shared crate tests
cargo test --manifest-path rust/Cargo.toml

# Tauri crate tests
cargo test --manifest-path apps/desktop-tauri/src-tauri/Cargo.toml

# TypeScript type check
cd apps/desktop-tauri && pnpm exec tsc --noEmit

# Lint
cargo clippy --all-targets -- -D warnings
cargo fmt --all --check
```
