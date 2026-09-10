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

**Not fixed this pass.** The registry-key path (already correct) is not
the actual bug; the real fix requires either (a) creating a genuine Start
Menu shortcut for Dev launches with the correct AUMID (the officially
supported fix for this exact class of platform behavior), or (b) directly
manipulating Windows' notification cache/database, which is unsupported
and risks corrupting unrelated notification history for other apps on this
machine. Given the risk profile of (b) and the non-trivial implementation
and verification surface of (a) — it requires COM `IShellLinkW`/
`IPersistFile` shortcut creation code that does not exist anywhere in this
codebase yet, plus a full rebuild-and-re-verify cycle to prove Windows
actually re-resolves after a shortcut appears — this was documented
precisely rather than attempted under time pressure in the same pass that
found it.

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

## Verdict

**NOTIFICATIONS: NOT PASSED.** Content is correct; a real, precisely
root-caused branding defect (stale "QuotaArc Dev" display name) was found
via direct platform introspection and left open with a clear fix
direction; banner visibility and click/activation remain unverified due to
environment constraints this pass could not resolve.
