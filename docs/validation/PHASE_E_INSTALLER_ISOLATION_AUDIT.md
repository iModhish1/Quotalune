# Phase E — installer / Dev-Personal isolation audit

Date: 2026-09-26. Source: `821e6004`. Closes the last item the master goal's
release security audit listed as open under this phase.

## The question that matters

The owner's Personal installation is a frozen baseline that must never be
overwritten by development work. The question is whether a Dev build and a
Personal install can collide in Windows' installer and identity registries —
which would let a QA build uninstall, replace, or impersonate the real
application.

## 1. There is no Dev installer, so uninstall metadata cannot collide

The repository contains exactly one installer definition:

- `rust/installer/quotalis.iss` — the Personal/stable Inno Setup script

There is no Dev installer, and `rust/wix/main.wxs` is a legacy upstream WiX
fragment rather than a second shipping installer. Because a Dev channel has no
installer at all, there is no Dev uninstall entry that could be confused with,
or could overwrite, the Personal one.

This is a structural answer rather than a check: the collision the audit is
worried about cannot occur because one of the two participants does not exist.

## 2. The stable installer never writes a Dev identity

A sweep of both `rust/installer/` and `rust/wix/` for the Dev AUMID
(`app.quotalis.desktop.dev`) returns **no matches**. The stable installer writes
only:

| Purpose | Identity |
| --- | --- |
| Inno AppId | `QuotaArcDesktop` |
| Install directory | `%LOCALAPPDATA%\Programs\Quotalune` |
| Shortcut AUMID | `app.quotaarc.desktop` |
| Toast AUMID registry key | `Software\Classes\AppUserModelId\app.quotaarc.desktop` |

Every one of those is a Personal identity. The installer has no path by which a
Dev identity reaches the registry.

## 3. The Dev AUMID exists only at runtime, and is channel-checked

The Dev AUMID is applied by the running application when it was built with the
`dev-channel` Cargo feature, not by any installer. Identity consistency is
enforced by `channel_identity_is_safe`, which requires a build's identifier to
equal its expected channel identity.

The test `channel_identity_rejects_mixed_and_missing_config`
(`apps/desktop-tauri/src-tauri/src/main.rs:822-825`) pins the two identities
apart — `app.quotalis.desktop.dev` for Dev and `app.quotaarc.desktop` for
Personal — and asserts that a build cannot present one while expecting the
other.

## 4. This is consistent with the fixture-isolation finding

Both audits rest on the same property: the Dev/Personal split is a
**compile-time** distinction (`cfg!(feature = "dev-channel")`), not a runtime
mode that could be toggled. See `PHASE_E_FIXTURE_ISOLATION_AUDIT.md`.

## Findings

**Dev and Personal cannot collide through installation.** A Dev build has no
installer; the stable installer writes no Dev identity; and the two runtime
identities are both channel-scoped and checked against the build's expected
channel.

## Limits of this audit

This covers identity and uninstall separation in the installer definitions. It
does not cover:

- whether an actual upgrade from a real v0.11.0 install preserves shortcuts,
  notification identity and the install directory — that requires running the
  installer on a disposable Windows environment, which is part of the release
  verification and remains outstanding;
- `rust/wix/main.wxs`, which still carries upstream `codexbar` naming and is
  not part of the current Inno packaging path. It is not shipped, but it is
  stale and could confuse a future maintainer.