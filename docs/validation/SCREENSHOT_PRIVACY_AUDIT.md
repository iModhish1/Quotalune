# Screenshot privacy and presentation audit — in progress

Checkpoint: 2026-09-27, release integration branch. This is a current-tree
cleanup, not a claim that historical Git objects or all remaining images have
been audited.

## Reviewed and removed from the tracked tree

- Ten raw native proof captures under `docs/validation/evidence/` visibly
  included the Desktop QA control panel. Audit copies are retained only in the
  ignored `.local/native-evidence-2026-09-26/` directory. The public crop
  script now reads that local directory and fails when it is unavailable.
- Four screenshots named `PERSONAL_*` or `personal-v09-live` showed real owner
  activity or desktop content; five `LIVE_THEME_*` screenshots showed real
  activity totals; five `v8/live-*` screenshots showed OS/development surfaces
  and stale branding. All fourteen were unreferenced by current documentation
  and were removed from the tracked tree. No Personal app or files were opened
  to make this decision; only previously committed images were read.

Removal in a new commit does not erase the files from existing public Git
history or third-party clones. A separate history-remediation decision and
remote-host procedure would be required to address that exposure; no history
rewrite has been performed.

## README showcase review

The eight linked screenshots were inspected at full resolution. They show the
current Quotalune name and omit the OS title bar and Desktop QA panel. Each
still shows a clipped circular floating surface at the right edge of the app
capture. The About image says `0.12.0` while the published prerelease is
`0.12.1`; the Analytics image was captured while a value read `Measuring…`.
These are not approved as final release images. Replace them with clean,
current, verified Dev captures rather than trimming inside the app or painting
over defects. Use an isolated/demo state or redact private readings before
public display, with demo data clearly identified.

Seven additional post-release Dev screenshots were then reviewed. They carried
the former Quotalis name, and several displayed real activity readings. Their
current-tree copies were withdrawn; local audit copies are under ignored
`.local/historical-images-post-release/`. The historical handoff now points
there instead of to the public images directory.

## Remaining scope

Continue visual review of every tracked screenshot, including the remaining
`docs/images/` archive and any images linked from public Markdown. Check for
QA chrome, development controls, private identifiers/paths/usage, OS overlays
and stale branding. Re-run the inventory at final RC and verify the README and
release page use only approved current images. The raw historical captures must
not be recommitted.
