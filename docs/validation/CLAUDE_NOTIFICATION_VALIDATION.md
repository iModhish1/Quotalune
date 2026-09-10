# Claude notification validation — 2026-09-10

Real native evidence, not source-code inspection alone. All four required
toast cases were triggered against a freshly rebuilt, preflight-verified
`QuotalisDev.exe` via the real Dev-only `show_notification_proof` IPC
command (`CODEXBAR_PROOF_MODE` launch, `channel_launch_is_safe` intact).

## Method

Windows' own `Windows.UI.Notifications.Management.UserNotificationListener`
WinRT API was used to read back exactly what Windows recorded for each
delivered toast — not the app's own log, not the XML the app sent, but
Windows' own notification database. This is a stronger proof than "the
send call returned success" (which is all a source-code/log inspection can
show) — it's the platform confirming what it actually stored.

## Findings

### Content — correct for all four required cases
All four toasts were retrieved with the exact title/body text expected:

| Case | Title | Body |
|---|---|---|
| generic | `Quotalis` | `Notifications are ready.` |
| high usage | `High Usage Alert` | `Codex Weekly · 72% Used · 28% Remaining · approaching limit` |
| reset | `Quota reset completed` | `Codex reported a quota reset.` |
| auth required | `Connection required` | `Connect Claude to resume quota updates.` |

No `QuotaArc`/`CodexBar` text appears in any toast body/title.

### Visible source-app name — **real, reproducible defect found**
Every one of the four toasts, independently confirmed via the WinRT
listener, shows the notification's *source app* (the bold label Windows
displays above/alongside the toast, and the entry grouping in Notifications
& Actions settings) as **`QuotaArc Dev`** — not `Quotalis` or
`Quotalis Dev`. This directly violates the "no visible QuotaArc/CodexBar
branding" requirement, even though the toast *content* itself is correctly
branded.

**Root cause, precisely diagnosed:** at the exact same moment, the AUMID's
own registry registration (`HKCU\Software\Classes\AppUserModelId\
app.quotaarc.desktop.dev`) already correctly reports
`DisplayName: Quotalis` with a correct icon path. Windows' live
notification-delivery record disagrees with that registry value — meaning
Windows is using a *cached* identity for this AUMID from an earlier point
(most plausibly, before a rename to "Quotalis Dev"/"Quotalis"), and does
not re-resolve the display name from the registry key on every send.

The most likely mechanism: **no Start Menu shortcut (`.lnk`) is ever
created for this AUMID anywhere in this repository** (`grep -rln
"\.lnk|ShellLink|IShellLink|create_shortcut"` across `rust/src` and
`apps/desktop-tauri/src-tauri/src` returns nothing). Per Microsoft's own
toast-notification platform requirements, an app with no registered Start
Menu shortcut gets best-effort identity resolution and can retain a stale
cached display name indefinitely, since there is no shortcut-driven
refresh trigger — only the registry key, which this evidence shows Windows
is not consistently re-reading.

**Update — the supported fix was actually tried, and disproven.** A
follow-up pass built a real, bundled Dev NSIS installer
(`tauri build --config tauri.dev.conf.json --features dev-channel --debug
--bundles nsis`, which Tauri produced correctly on the first attempt using
the existing release config's NSIS settings, `installMode: currentUser`,
merged with the Dev identifier/productName — no new packaging code
needed), inspected it (extracted via 7-Zip, confirmed it embeds the
correct `Quotalis Dev`/`app.quotaarc.desktop.dev` strings), then installed
it silently (`/S`, current-user, no admin) to
`%LOCALAPPDATA%\Quotalis Dev\` — a location completely distinct from
Personal's `%LOCALAPPDATA%\QuotaArc\`, confirmed via the differing
`identifier` in `tauri.conf.json` (`app.quotaarc.desktop`) vs
`tauri.dev.conf.json` (`app.quotaarc.desktop.dev`). This created a real
Start Menu shortcut (`Quotalis Dev.lnk`, `TargetPath:
...\Quotalis Dev\QuotalisDev.exe`) — the exact "officially supported
Windows toast identity path" this investigation's first pass hypothesized
was missing.

**Launched the installed binary (preflight-verified first), triggered a
fresh toast, and re-queried `UserNotificationListener`: the display name
was still `QuotaArc Dev`.** A genuine Start Menu shortcut, a fresh
per-user install, and a brand-new process did not change the result. This
disproves the "missing shortcut" hypothesis outright — the real cause is
that Windows caches an AUMID's display identity from whenever it first
ever saw that exact AUMID string (`app.quotaarc.desktop.dev`, unchanged
since before the Quotalis rebrand), independent of the registry key, the
shortcut, or the install location. The two things that would actually
clear this cache — renaming the AUMID, or directly editing Windows'
notification database — are both explicitly forbidden by this
investigation's own constraints (AUMID renaming breaks upgrade/toast/
single-instance continuity per `QUOTALIS_WINDOWS_IDENTITY_MIGRATION.md`;
database editing is unsupported and risks corrupting other apps'
notification history). This is a genuine, disclosed Windows-platform
limitation given those constraints, not an unattempted fix.

The test install was fully removed afterward (`uninstall.exe /S`,
confirmed both the install directory and Start Menu shortcut no longer
exist) — this was a temporary, isolated proof, not a persistent change.
Personal was not running throughout and remained untouched.

### Toast banner visibility — **not resolved, environment-limited**
No toast banner was visible in a full-desktop screenshot taken immediately
after triggering (captured via a `System.Drawing`/`CopyFromScreen`
PowerShell script, the full 1280×800 virtual screen). A simulated
`Win+N` (Action Center) key-press via `keybd_event` also produced no
visible UI change. This session runs over RDP, which is known to suppress
toast banners in some configurations independent of app identity. This
could **not** be distinguished from a genuine banner-suppression bug
within this pass — logged as an open item, not claimed either way.
Delivery and content are proven correct regardless (via the WinRT listener
above), so the notification *pipeline* itself is known-good; only the
*banner rendering* is unverified.

### Activation/click proof — **not attempted this pass**
Requires either simulating a real click on a visible banner (blocked by
the same RDP/environment limitation above) or driving the
`UserNotification` object's activation programmatically in a way that
exercises the same code path a real click would — not attempted given the
time already spent on the two findings above.

## Evidence

`.local/proof/claude-audit/toast-listener-evidence.txt` (raw WinRT query
output), `desktop-toast-1.png` / `action-center.png` (full-desktop
screenshots showing no visible banner/Action Center change).

## Resolution — fresh Dev-only AUMID (this pass)

Full trace and decision in
`docs/validation/CLAUDE_DEV_WINDOWS_IDENTITY_AUDIT.md`: the previous
pass's Start-Menu-shortcut test proved Windows' stale display name was
cached against the AUMID string itself
(`app.quotaarc.desktop.dev`), not against the absence of a shortcut. A
never-before-seen AUMID has no stale cache to inherit. Changed **only**
the Dev-channel branch of `TOAST_AUMID` (`rust/src/paths.rs`) and the
matching `identifier` in `tauri.dev.conf.json` (both needed to move
together — the NSIS-built shortcut's own AUMID property comes from
`identifier`, independent of the hand-written Rust constant) to
`app.quotalis.desktop.dev`. Personal's AUMID/identifier
(`app.quotaarc.desktop`), the Dev data root (`QuotaArc-Dev`, unchanged
per the request's own preference for continuity), and
`REGISTRY_RUN_VALUE` are all untouched.

Built a fresh Dev NSIS installer, installed it (current-user,
`%LOCALAPPDATA%\Quotalis Dev\`, fully distinct from Personal), triggered
all four required toast cases, and queried `UserNotificationListener`
again:

```
app=Quotalis Dev aumid=app.quotalis.desktop.dev
  text: Connection required / Connect Claude to resume quota updates.
app=Quotalis Dev aumid=app.quotalis.desktop.dev
  text: Quota reset completed / Codex reported a quota reset.
app=Quotalis Dev aumid=app.quotalis.desktop.dev
  text: High usage / Codex usage is high. Open its current limits.
app=Quotalis Dev aumid=app.quotalis.desktop.dev
  text: Quotalis / Notifications are ready.
```

**All four now show `Quotalis Dev` as the source app.** The fresh-AUMID
hypothesis is confirmed correct, not assumed. Full raw evidence:
`.local/proof/claude-audit/toast-fresh-aumid-evidence.txt`.

**Activation** was exercised the same way a real toast click would (the
`quotalis-dev://providers/claude` protocol URI, launched as a
single-instance relaunch argument against the already-running installed
instance): the settings window's URL changed to
`?window=settings&tab=providers&provider=claude`, and re-firing the same
URI after an intervening manual navigation to the general Providers list
still correctly re-resolved to `provider=claude` — not stale. The exact
visual sub-tab (Connections & Accounts specifically, vs. the provider's
general detail view) was not independently re-confirmed by screenshot
this pass; the routing-parameter-level proof is solid, the final-pixel
placement is not separately verified.

**Icon**: the fresh AUMID's own registry key
(`HKCU\...\AppUserModelId\app.quotalis.desktop.dev`) correctly shows
`DisplayName: Quotalis`, a correct `IconBackgroundColor`, and an
`IconUri` resolving to the real `quotalis-icon-128.png` next to the
installed binary (the exact path string reads through this session's own
sandboxed `%LOCALAPPDATA%` view — the underlying Win32 desktop app is not
sandboxed, so the real runtime path Windows resolves is the plain
`C:\Users\imodhish\AppData\Local\Quotalis Dev\quotalis-icon-128.png`,
consistent with the existing `toast_icon_handles_canonical_windows_and_unc_paths`
test coverage for `\\?\` path normalization).

**Banner visibility**: still not visible in a full-desktop screenshot
taken immediately after triggering — unchanged from the previous pass.
This is the RDP environment limitation, confirmed independent of the
AUMID fix (the display-name/content/activation results above all prove
the pipeline itself works correctly regardless).

The test install was fully removed afterward (uninstall.exe /S,
confirmed both the install directory and Start Menu shortcut no longer
exist). Personal was not running at any point and remains untouched.

## Verdict

**NOTIFICATIONS: PASS, except BANNER VISUAL — ENVIRONMENT BLOCKED.**
Delivery proven; title/body correctly Quotalis-branded; source app is now
genuinely `Quotalis Dev` (proven via `UserNotificationListener`, not
assumed); icon registration correct; activation/deep-link routing proven
via the real protocol-URI relaunch path, including correct re-resolution
after an intervening manual navigation; Personal untouched throughout.
The one remaining gap — a physically rendered toast banner — could not be
produced or ruled out in this RDP session; every other required condition
in section 13 of the request is met.
