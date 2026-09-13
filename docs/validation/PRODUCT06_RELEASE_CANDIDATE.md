# P06-11/15 — Windows packaging candidate, 2026-09-13

**Local candidate only; not a final release, not published.** Product requirements
remain in `tasks/MASTER_REQUIREMENTS.md`, including P06-16's notification center,
startup reconciliation and independent per-limit notification preferences.

## Source and concrete outputs

Source/packaging commit: `bd4b89802686` on `feature/v9-theme-runtime`.
The actual desktop diagnostic reports version `0.11.0`, stable channel,
`app.quotaarc.desktop`, matching source commit and dirty=true. The only tracked
uncommitted files during that build were backlog documentation. No GUI was
started by the pure `--print-build-info` diagnostic.

Both builds succeeded: desktop through Tauri `build --ci --no-bundle` (4m04s),
CLI via Cargo in the separate `target/cli-release` directory (2m58s). Separating
targets prevents Windows' case-insensitive executable names from overwriting the
desktop with the CLI. PE-subsystem and CLI stdout checks passed; the legacy alias
is byte-identical to the desktop.

Candidate directory:
`N:/QuotaArc/quotaarc/.local/release-candidates/0.11.0-bd4b8980/`.
`candidate-manifest.json` records the scope, hashes and remaining acceptance.

| Asset under `assets/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `Quotalis-0.11.0-Setup.exe` | 68148858 | `8133d9f6f1e6b0eff42748555c545e469c3e7b1bef14866682bdd5e0cc1f386d` |
| `Quotalis-0.11.0-portable.zip` | 25197289 | `dd2cc8a871eab6b0a5e064a87ec25315eb8ea2b7b6e70684135216225947e71b` |
| `QuotalisCLI-v0.11.0-windows-x64.zip` | 7219459 | `aa368b92f2d42020d18a8a3d378a76634b822c8b0832bcd1368110772594f949` |

All three have matching `.sha256` sidecars. These outputs are not substitutes for
the final candidate after the remaining runtime features land.

## Repairs and verification

The previous portable EXE omitted the native notification image expected at
`BaseDirectory::Resource/quotalis-icon-128.png`. The ZIP now includes the desktop,
original notification PNG, original ICO, LICENSE, NOTICE, third-party notices and
usage guide. The helper packages only these explicitly named files and verifies
each entry against its source hash. It rejects missing resources, mismatched
contents and existing destinations. No build-directory recursion or account data.

The Inno installer includes the same notification image and attribution files.
Publisher/support/update URLs now point to `iModhish1/Quotalis`. Existing installer
AppId, AUMID and upgrade continuity are unchanged. Inno Setup 6 compiled the actual
candidate successfully; bundled VC++/WebView2 bootstrapper signatures were Valid
and issued to Microsoft Corporation. The installer itself is **NotSigned**.

Windows PowerShell 5.1 archive tests and release helper tests passed, as did the
release smoke-boundary tests under PowerShell 7. The real desktop ZIP's exact
contents and source hashes passed verification; the CLI ZIP's executable hash
matches its fresh CLI build. TypeScript/production frontend/locale checks passed
through the Tauri build. Runtime frontend evidence remains 1185 passing tests in
200 files from the preceding unchanged runtime-source packet.

Logs: `.local/qa05/product06-release-{desktop-build,cli-build,installer-build,
secrets}.log` and the two `*-audit.json` reports. Current-tree secret scan was clean
across 3082 files at this check; it is not a complete Git-history scan.

## Explicit remaining release gates

- Native isolated install, upgrade, uninstall, prerequisites/restart behavior and
  installed notification artwork acceptance. The installer was never executed on
  the Personal host; compiled contents alone do not prove runtime behavior.
- Signing, full Git-history secret scanning, remaining live authentication,
  notification/tray and product/visual acceptance; requested new design batches
  and professional real gallery images have not been certified by this packet.
- CLI distribution attribution should also travel inside its archive; this
  candidate retains the existing one-executable CLI archive contract.
- Other OS/architecture packages. Windows x64 is the actual build evidence here.
  Neither macOS/Linux nor native ARM64 full-feature parity has been established.
- Fresh audits found zero pnpm advisories and zero Cargo vulnerability entries,
  but Cargo still reports seven unmaintained dependency warnings and two unsound
  warnings (`glib 0.18.5`, `rand 0.7.3`). Targeted dependency trees show glib absent
  from Windows x64 and rand in the PHF/Tauri build-dependency chain. These findings
  are recorded for follow-up, not reclassified as a wholly clean security audit.
- GitHub actor is `iModhish1`, matching the owner's screenshot. The canonical
  repository lookup still reported nonexistent during this packet. The verified
  email API could not be queried with the current token scope, so the literal
  `mmimodhish@gmail.com` linkage is not newly proven. No account scope was changed,
  no repository/tag/release was created, and no source or artifacts were pushed.

Native Dev carousel acceptance is documented separately in
`PRODUCT06_OWNER_COMPLETION.md`. Packaging does not supersede that evidence or
claim the broad product goal complete.
