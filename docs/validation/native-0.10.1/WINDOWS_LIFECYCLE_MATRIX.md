# Windows lifecycle matrix — 0.10.1

## Deliberately not attempted, and why

`explorer.exe` restart, display sleep/resume, lock/unlock, and a real DPI/
resolution change all affect **the owner's entire live desktop session**, not
just this app — this machine has other work in progress (Personal is
installed and in daily use; a text editor and other windows were observed
open during this session). Triggering any of these from an unattended
automated session risks disrupting or losing the owner's unrelated work for
a test that only benefits this one app. This falls under the same judgment
this session already applied elsewhere (e.g. never touching Personal without
an explicit, scoped request): a system-wide, disruptive action on shared
state needs the owner doing it themselves, at a time of their choosing, not
an agent doing it opportunistically.

## What was verified instead (a safe proxy, not a substitute)

- **Process-level restart persistence**: Dev and Personal were both
  independently stopped and relaunched multiple times this session (see this
  session's transcript and `docs/CODEX_UNFINISHED_WORK.md`'s Personal-
  promotion section) — settings, saved collection layout, and provider state
  all survived every relaunch.
- **Window-lifecycle edge case found and fixed**: while testing the
  Collections window, a `set_size` IPC call left the window minimized (Win32
  `(-32000,-32000)` sentinel rect) — an unplanned real lifecycle event.
  Recovered via `ShowWindow(SW_RESTORE)` with no data loss, and the
  `collections_window.rs` tests added this session (`clamps_a_stored_
  position_that_is_now_off_the_work_area`, monitor-loss fallback) directly
  target the class of bug a botched restore could cause.

## Genuinely open

Explorer restart, sleep/resume, lock/unlock, and live DPI/resolution change
all remain unverified. **Recommendation**: the owner runs a short manual
pass (open a couple of surfaces, restart Explorer or lock/unlock once, confirm
everything reappears correctly) at a convenient time — this is a five-minute
check that shouldn't be done unattended on a live machine.
