# QuotaArc

**Your AI capacity, always in sight.**

QuotaArc is a premium open-source AI usage / quota / capacity monitor for Windows. It answers one question exceptionally well: *how much AI capacity do I have right now, how quickly am I burning it, and when should I switch provider or model?* — without opening a dozen provider dashboards.

> Windows 11 first · 67 provider integrations · local-first & private · no account, no telemetry

![hero](docs/images/hero-placeholder.png)

## Highlights

- **Surface Engine** — QuotaArc's signature surfaces:
  - **Edge Arc** — a glass capacity strip snapped to a screen edge, one capacity arc per provider, hover for details, optional click-through.
  - **Top Arc** — a top-center capacity pill that morphs open on hover into usage windows, reset countdowns, and plan context.
  - **Tray** — full functionality with every visual surface disabled; quick usage summary, refresh, surface toggles.
  - **Dashboard & settings** — polished per-provider cards, multiple usage windows, costs, pace, and a live surface editor.
- **67 providers** — Codex, Claude, Copilot, Cursor, Gemini, Antigravity, OpenRouter, DeepSeek, Groq, Windsurf, Kiro, OpenCode, MiniMax and many more, with OAuth / API-key / cookie / CLI credential modes.
- **Quota intelligence** — pace, session-equivalent forecasts, reset ETA, and cost projections computed locally; the UI says "not enough history" instead of inventing numbers.
- **Credential safety** — app-managed secrets live behind Windows DPAPI / user-scoped secure storage; browser cookie import is explicit opt-in per provider.
- **Privacy-first** — no QuotaArc account, no cloud backend, no telemetry, no ads. Data stays on your machine. See [PRIVACY.md](docs/PRIVACY.md).
- **Performance-minded** — adaptive polling with backoff, animation only on change, essentially zero idle CPU. See [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Installation

Download the latest release from [GitHub Releases](https://github.com/quotaarc/quotaarc/releases):

| Artifact | Purpose |
|---|---|
| `QuotaArc-X.Y.Z-x64-Setup.exe` | Per-user NSIS installer — no admin required |
| `QuotaArc-X.Y.Z-x64.msi` | Managed/enterprise deployment |
| `QuotaArc-X.Y.Z-x64-Portable.zip` | Portable, no installer |

Install: download → double-click `Setup.exe` → launch **QuotaArc** → onboarding → done. No terminal, no Rust, no Node required.

## Surfaces at a glance

| Surface | Best for |
|---|---|
| Edge Arc | Glanceable per-provider capacity while you work |
| Top Arc | Focus-mode monitoring with hover-for-detail |
| Tray only | Minimal footprint; everything still one click away |
| Dashboard | Deep dives: usage windows, costs, pace, forecasts |

Configure them live in **Settings → Surfaces** (opacity, scale, click-through, hide during fullscreen games, edge side).

## Development

```powershell
# Prerequisites: Rust stable (MSVC), Node 24, pnpm 11, VS Build Tools (C++)
pnpm --dir apps/desktop-tauri install
cargo test --manifest-path rust/Cargo.toml
pnpm --dir apps/desktop-tauri test
pnpm --dir apps/desktop-tauri run tauri:build:debug   # fast local run
pnpm --dir apps/desktop-tauri exec tauri build --bundles nsis   # installer
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/BUILDING.md](docs/BUILDING.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

## Acknowledgments

QuotaArc inherits its provider engine, credential security layer, and Tauri shell from the excellent open-source **[Win-CodexBar](https://github.com/nesszer/Win-CodexBar)** (MIT), which in turn ports ideas from **[CodexBar](https://github.com/steipete/CodexBar)** for macOS, and includes portions of **codexcontrol** (MIT) — see [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The QuotaArc product experience — brand, design system, Surface Engine, and motion — is original work.

## License

[MIT](LICENSE)
