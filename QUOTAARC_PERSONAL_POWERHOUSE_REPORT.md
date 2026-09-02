# QUOTAARC_PERSONAL_POWERHOUSE_REPORT

Wave: Personal Powerhouse · Version 0.2.0 · Date: 2026-09-02
Public-safe report. Machine-specific details live in `.local/personal-powerhouse-notes.md`
(git-ignored).

## A. Executive summary

QuotaArc is now the owner's installed daily-driver application (0.2.0, per-user NSIS install,
running from the installed location at validation time). This wave added the personal
architecture the brief asked for: a first-class Profile + ProviderAccount model with a tested
legacy migration (verified end-to-end on the real installed app), a compile-time Dev channel
fully isolated from Personal data, a Local update channel that never polls a remote, Privacy
Mode, tray profile switching, and public-release sanitation (secret-scan gate, hardened
gitignore, machine paths scrubbed). Real provider validation on this machine: **Codex and
GitHub Copilot return live authenticated usage**; Claude/OpenCode/Gemini/Antigravity correctly
report their auth states; Claude requires an owner re-login (see G/H).

## B. Exact personal build installed

`QuotaArc_0.2.0_x64-setup.exe` (NSIS, per-user) — built from this tree, installed silently,
launched, and verified running as `QuotaArc.exe` from `%LOCALAPPDATA%\QuotaArc`. The DPAPI
`profiles.json` store was created by the running app on first load with the migrated Default
profile.

## C. Personal vs Dev architecture

Compile-time cargo feature `dev-channel` switches every identity primitive in
`rust/src/paths.rs` (directories → `QuotaArc-Dev`, registry Run value, toast AUMID
`QuotaArc.Dev`, installer stem). Dev packaging uses `tauri.dev.conf.json`
(`app.quotaarc.desktop.dev`, "QuotaArc Dev"). Isolation is guaranteed by construction, not
runtime configuration. Commands and guarantees: `docs/LOCAL_DEVELOPMENT.md`.

## D. Profile architecture

`rust/src/profiles.rs`: `QuotaArcProfile` (id/name/theme/accent/mark/surfaces/account
membership/thresholds) stored in a versioned `profiles.json` through the DPAPI secure-file
layer. Operations: create, rename, duplicate, delete (last-profile guarded), reorder, update,
switch — all exposed as Tauri commands. Switching atomically updates enabled providers, theme,
and surface visibility, reconciles surface windows, rebuilds the tray, and emits
`profiles-changed`. Legacy 0.1.0 installs migrate into one "Default" profile with a "Main"
account per enabled provider — **verified on the real install**.

## E. Multi-account architecture

`ProviderAccount` records are UUID-keyed, user-named, and reference credentials only by
source/id (`cli-session`, `api-keys-store`, `codex-token-account`, …) — never values.
Profile↔account membership is many-to-many. History remains keyed by account id (UUID), never
display names. Per-account fetch pipelines for API-key providers are the next wave; the account
model, capability gating, and profile application are in place now, and Codex's inherited
token-account machinery maps directly onto `ProviderAccount`.

## F. Provider capability matrix

Derived per provider (not user-configurable), conservative by default:

- **Multiple stored accounts / concurrent monitoring**: API-key providers (OpenRouter, DeepSeek,
  Groq, Fireworks, DeepInfra, Mistral, Venice, NanoGPT, OpenAI API, Azure OpenAI, xAI, LiteLLM,
  LLM Proxy) + Codex (inherited token accounts).
- **Single active CLI account**: Claude, Cursor, Gemini, Antigravity, Copilot, OpenCode(-Go),
  Kiro, Windsurf, Kimi — the UI states this instead of faking multi-account.
- Unknown providers: usage-only.

## G. Real providers detected on this machine

Claude Code (CLI + credential file), Codex (auth.json), Gemini CLI, Antigravity, OpenCode CLI,
GitHub Copilot (gh). Detection read file **existence only**; no secrets printed.

## H. Live providers successfully validated

| Provider | Result |
|---|---|
| Codex | **Live**: ChatGPT Pro plan, weekly 38% used, reset in ~4d, pace on track |
| GitHub Copilot | **Live**: Copilot Individual, premium 0% used, reset ~28d |
| Antigravity | Detected; reports offline with conversation count |
| OpenCode | Installed; "Authentication required" (correct state) |
| Gemini | Installed; "Not logged in" (correct state) |
| Claude | Credential file present but access+refresh tokens empty → **requires owner action**: run the official `claude` CLI login once; QuotaArc's OAuth path (consent flag) will then refresh |

## I. Accounts configured

Default profile migration created "Main" accounts for the enabled providers (aliases only —
Claude Main, Codex Main). No emails/tokens anywhere in the store (asserted by tests and by
inspecting the decrypted store).

## J. Surfaces status

Edge Arc, Top Arc, Tray, Dashboard, Float Bar all working; surfaces now follow the active
profile's visibility switches. Taskbar Arc: **not implemented this wave** (next wave; the
surface_kit + positioning groundwork is ready).

## K. Personalization status

Profile-scoped theme + accent + surfaces switching is live; profile mark supports Default and
Monogram variants (Image mark implemented in the model; the asset import pipeline is next
wave). Backgrounds/presets/animated backgrounds: next wave (design notes in
docs/PERSONALIZATION roadmap section below).

## L. History / intelligence status

Pace, session-equivalent forecasts, reset ETA, cost projections remain inherited and
account-capable in the engine; the account-scoped history database (retention/downsampling UI)
is the largest open item, deliberately deferred to keep this wave's migration safe and tested.

## M. Windows hardening results

Installed-app launch, tray startup, DPAPI store creation verified. Explorer-restart /
sleep-resume / multi-monitor scripted matrices remain from the previous wave's list; the
surface windows already reassert z-order/attributes on system events.

## N. Performance

Tray-only release build (0.1.0 measurements, unchanged architecture this wave): 139 ms launch,
0% idle CPU over 30 s, 162 MB tree working set. Profile switching adds no steady-state cost
(store load is event-driven, not polled). Re-benchmark at 0.2.0 queued with the next wave.

## O. Security / secret scan

`scripts/scan-secrets.mjs` (586 files) clean; committed binary removed from git; `.gitignore`
now blocks keys/pems/pfx, personal trees (`.local/`, `private/`, `artifacts-local/`,
`backups/`), profile stores, and seed files. No secrets in the new stores by construction
(asserted in unit tests + verified on the decrypted real store). Full gitleaks history pass is
a pre-publication checklist item, not needed for local use.

## P. Public-release sanitation

Tracked docs scanned for machine paths/usernames — cleaned. `docs/PUBLIC_RELEASE_READINESS.md`
records READY / NOT READY / REQUIRES OWNER ACTION. Nothing was pushed, published, or uploaded.

## Q. Known issues

1. Claude live validation blocked by an empty local Claude Code session (owner re-login needed).
2. Per-account fetch pipelines for API-key providers not yet wired into the refresh loop
   (accounts gate visibility today; independent monitoring lands next wave).
3. Taskbar Arc, command palette, setup wizard, background engine, auto profile rules: next wave.
4. History DB UI deferred (see L).

## R. Recommended next personal enhancements

1. History database + Intelligence dashboard cards with confidence labels.
2. Per-account live refresh for API-key providers + polling scheduler upgrades.
3. Taskbar Arc; Top Arc state machine expansion (Auth Required, Reset, Profile Changed morphs).
4. Setup wizard + Add Account UX polish (avatar/accent pickers, asset import pipeline).
5. Auto profile switching rules engine (process foreground + time windows, opt-in).
