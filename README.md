<p align="center"><img src="assets/brand/icons/quotaarc-icon-256.png" width="112" alt="Quotalune app mark"></p>

# Quotalune

**Your AI workspace, in one orbit.**

Quotalune brings AI-provider limits, reset schedules and usage history into a customizable Windows desktop workspace. Keep your providers in view with a planetary dashboard, compact floating surfaces and system-tray controls.

[Explore the desktop experience](#a-workspace-that-feels-like-yours) · [Get started](docs/GETTING_STARTED.md) · [Build from source](#build-from-source) · [Windows downloads](#windows-downloads)

The official application mark is unchanged. The interface previews below were
captured from a verified Windows build of this release, cropped to the
application window so no operating-system title bar is shown.

## Interface previews

Settings, with the Monitor, Workspace and Appearance sections:

![Quotalune settings](docs/validation/evidence/PHASE_NATIVE_quotalune_settings_2026-09-26.png)

The menu bar configuration workspace:

![Quotalune menu bar settings](docs/validation/evidence/PHASE_NATIVE_settings_menubar_2026-09-26.png)

The About surface, where version, license and third-party notices live:

![Quotalune about](docs/validation/evidence/PHASE_NATIVE_settings_about_2026-09-26.png)

These are real captures of the current release candidate on Windows. Previews
of the dashboard tray panel, providers, analytics and the appearance, surface
and tray studios are published as they are captured from the verified build.

## A workspace that feels like yours

- **Planetary dashboard.** Original provider logos, reported plan details, current limits and reset times. Browse a compact carousel, arrange providers left or right, and keep your chosen order and position between visits.
- **Dedicated analytics.** Explore observed quota history, individual provider windows and available usage records, with filters and detailed values alongside charts.
- **Reset visibility.** Distinguish scheduled resets, observed changes and provider-reported banked reset inventory, including expiry dates when supplied.
- **Provider connections.** Manage supported OAuth, API-key, browser-cookie and CLI-backed integrations from a dedicated provider workspace. Connection methods follow each provider's capabilities.
- **Notification history.** Revisit recorded reset and quota-change observations, search and filter them, mark items read, and see an unread badge. Observation and receipt times stay visible.
- **Personal presentation.** Structure themes, original logo finishes, provider presentation styles, backgrounds, resizable navigation and configurable floating surfaces.
- **Profiles and collections.** Organize providers and presentation choices for different workflows.
- **Demo Mode.** Explore simulated provider data in a clearly marked workspace, separate from real history.
- **English and Arabic.** Localized controls, right-to-left layouts and customizable time/reset presentation.

Quotalune displays provider-reported values and preserves their meaning: quotas, Spend, Balance and Credits are distinct. Analytics use available observations rather than inventing missing values.

## Windows downloads

The [current public release](https://github.com/iModhish1/Quotalis/releases/tag/v0.11.0) was published under the earlier **Quotalis** name. Its original filenames and executable name remain accurate:

| Download | Use |
| --- | --- |
| `Quotalis-0.11.0-x64-Setup.exe` | Per-user installation with desktop integration and runtime setup |
| `Quotalis-0.11.0-x64-Portable.zip` | Extract the complete folder and open `Quotalis.exe` |
| `Quotalis-0.11.0-x64-CLI.zip` | Command-line tools for usage and configuration |

Windows x64, Microsoft Edge WebView2 Runtime and the Microsoft Visual C++ x64 runtime are required. Setup can install missing runtimes. The ZIP edition uses the normal per-user settings and history location; keep its supplied icons beside the executable.

Open **Providers** to configure your integrations, or enable **Demo Mode** in Dashboard Studio to explore first. Customize your workspace through Appearance, Provider Display and the surface controls.

## Data and privacy

Settings and usage history stay on your device. Connecting a provider uses that provider's supported authentication method; Quotalune does not require a Quotalune account or a credential relay service. Demo Mode is labeled and kept separate from real provider data. Share screenshots only after checking them for account details, cookies and usage history.

## Build from source

Use Windows with Rust stable (MSVC), Visual Studio C++ Build Tools, Node.js 24 and pnpm 11.24.0.

```powershell
pnpm --dir apps/desktop-tauri install --frozen-lockfile
pnpm --dir apps/desktop-tauri test
cargo test --workspace
node scripts/build-dev-verified.mjs
```

The final command builds the isolated Dev channel. For the standard desktop executable:

```powershell
pnpm --dir apps/desktop-tauri run tauri:build
```

The React/TypeScript UI is in `apps/desktop-tauri/src`; the Tauri shell is in `apps/desktop-tauri/src-tauri`; provider adapters and domain logic are in `rust/src`. Desktop builds use Tauri so the frontend is embedded in the executable.

## Created by

**Mohammed Modhish ([iModhish1](https://github.com/iModhish1))** · [TAWAJUD AI](https://tawajud.net)

Quotalune builds on [Win-CodexBar](https://github.com/nesszer/Win-CodexBar), [CodexBar](https://github.com/steipete/CodexBar), and portions of codexcontrol. Their contributions and licenses are preserved in [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Quotalis and QuotaArc are earlier names retained in compatibility identifiers and historical releases.

[MIT License](LICENSE)
