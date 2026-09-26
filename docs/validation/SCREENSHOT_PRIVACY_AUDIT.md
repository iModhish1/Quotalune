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

Seven more historical captures explicitly labeled `REAL_DATA` were reviewed
across Analytics V3/V4, Dashboard phases 3/5/final and Product V2. They show
the former Quotalis brand; several also show observed provider readings. Three
Phase 3 `AUTH_REQUIRED` / `NO_COST` captures were byte-for-byte copies of the
withdrawn real-data captures (SHA-256 verified), so those copies were removed
too. All ten audit copies are in ignored
`.local/historical-real-data-2026-09-27/`. This is a current-tree withdrawal,
not a claim that every historical screenshot or old Git object is cleared.

Representative full-resolution review of Product V3's native Dashboard,
Providers, RTL, theme and large-provider captures found former Quotalis
branding, observed readings and the already documented channel-isolation
caveat for early iterations. Conservatively, all 43 historical native captures
and five review boards assembled from them were withdrawn from the public tree
to ignored `.local/historical-product-v3-native-2026-09-27/`. The eleven
separate design concepts remain in `docs/images/product-v3/design/`; they are
not native proof. This family-level withdrawal does not claim each individual
image passed a pixel-by-pixel review.

The 71-image Analytics Superstack archive was likewise withdrawn as a family.
Representative full-resolution frames showed former Quotalis branding and
observed local token/model totals. The older validation notes explicitly say
the source was genuine local activity. Audit copies are kept only under ignored
`.local/historical-analytics-superstack-2026-09-27/`; historical Markdown
citations now explain that these are no longer public assets. The individual
frames were conservatively rejected as a family, not individually approved.

Eight V9 Settings artifacts were withdrawn after full-resolution inspection:
six obsolete or failed QuotaArc-era Settings captures, the old theme-gallery
capture, and its evidence manifest. Several frames include unrelated desktop
work behind the application window; one is entirely black. Local audit copies
are under ignored `.local/historical-v9-settings-2026-09-27/`. The old direct
CUA capture script is retired so it cannot repopulate the public image path;
current native QA must use the guarded desktop-visual-qa adapter. This does
not establish that the rest of V9 or the repository image archive is clean.

The remaining V9 native proof family was reviewed at representative full
resolution across usage, themes, and surface geometry. Its boards explicitly
say QuotaArc V9 and display historical provider readings, so none is current
Quotalune release imagery. All 30 PNGs and four evidence manifests were moved
to ignored `.local/historical-v9-native-2026-09-27/`. The historical capture
and board scripts now default to ignored `.local/` output; explicit paths and
the old documentation still describe earlier experiments, not current native
acceptance. This family-level withdrawal does not certify every frame or
remove older public Git objects.

A SHA-256 scan of the remaining 444 tracked images found 11 byte-identical
groups with 15 redundant files. All 15 redundant copies were verified against
their retained counterpart before moving to ignored
`.local/duplicate-screenshot-audit-2026-09-27/`. Some duplicates had different
scenario names (Trend/Reset Horizon, Heatmap/Data Quality, narrow/reduced
motion, RTL/reduced motion); their historical validation documents now state
that the withdrawn copy was not independent visual proof. This eliminates
byte-identical duplicates from the current image tree, not visually similar
copies or the need for current Quotalune captures.

The rest of the V9 image family (60 PNGs and three evidence manifests) was
withdrawn after representative full-resolution inspection of its theme
matrix, reference index, and Dashboard audit image. These are former QuotaArc
concept/proof materials with fixed illustrative values, not current Quotalune
release captures. Audit copies are in ignored
`.local/historical-v9-remaining-2026-09-27/`. Two legacy compose scripts now
default to ignored `.local/` output. This family-level decision does not claim
pixel-by-pixel approval or remove the images from older Git history.

The 12-image Claude-continuation archive was also withdrawn as historical
Quotalis-era proof. Representative full-resolution inspection included the
local-activity view, which displayed observed token totals. Both historical
validation notes now distinguish their earlier observations from current
release evidence. Ignored local copies are under
`.local/historical-claude-continuation-2026-09-27/`.

The Product Upgrade archive was withdrawn after representative full-resolution
review found former Quotalis branding and real provider readings. Its nine
PNGs and 13 JSON companions are retained in ignored
`.local/historical-product-upgrade-2026-09-27/`. The historical validation
document now names the earlier states without links to withdrawn public files.

## Remaining scope

Continue visual review of every tracked screenshot, including the remaining
`docs/images/` archive and any images linked from public Markdown. Check for
QA chrome, development controls, private identifiers/paths/usage, OS overlays
and stale branding. Re-run the inventory at final RC and verify the README and
release page use only approved current images. The raw historical captures must
not be recommitted.
