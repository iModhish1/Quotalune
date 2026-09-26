# Published v0.12.1 installer smoke — disposable Windows runner

Source workflow commit: `3ec32fa3`. Published release tag: `v0.12.1`, pointing
to `cc3af3d8d9094d834e112b540d531536deb6e42c`. The release asset was not
replaced or modified.

The first two release-asset runs failed in the smoke harness. After correcting
its versioned uninstall-name expectation, run `36268510628` downloaded the
published Setup, verified SHA-256, installed into a runner-owned temporary
directory, checked the desktop/CLI binaries and Start Menu shortcut, then
failed cleanup because `Quotalune.exe` remained after uninstall. The published
installer predates the `/NOLAUNCH` check added in `583e0790`; the harness's
`/NOLAUNCH` switch therefore could not suppress its silent-install relaunch.

The follow-up harness permits process shutdown only when explicitly opted into
in the disposable release-asset workflow. It first resolves the installed
executable's path and compares each candidate process's executable path for
exact equality. A process elsewhere causes a refusal; no process is stopped by
name alone. The installed directory and uninstaller are separately required to
resolve inside the existing disposable test root.

[Run 36274368183](https://github.com/iModhish1/Quotalune/actions/runs/36274368183)
**passed** on the GitHub Windows runner. Its log records the published Setup
SHA-256 `7e87062c24aa4a1223255fa5817ae27647a4b35323fdaf97a94b3b8011e2aad0`,
successful silent install, desktop/CLI/shortcut verification, exact-path
shutdown of installed PID 5996, silent uninstall, and `[smoke] ok`. The local
guard suite `scripts/windows-smoke-install.tests.ps1` passed as well.

This closes the **fresh-install/uninstall smoke for that published asset in a
disposable runner**. It does not prove a v0.11.0 or v0.12.1 upgrade, rollback,
live GUI/tray behavior, or the next candidate installer. The asset is unsigned
(`NotSigned` in the same log), and its CLI still prints `codexbar 0.12.1`.
