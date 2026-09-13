# Product 06 — owner completion evidence

Starting revision: `b93812f9`. This is an active work record, not release acceptance.
The full requirement set is P06-01 through P06-12 in `tasks/MASTER_REQUIREMENTS.md`.
The preceding QA turn made progress: committed native notification tests, stable
field labels, corrected arc preview, and evidence. No goal scope was removed.

## Reviewed inputs and changes

All nine owner images were inspected. Images 1/2 show short cards sharing a grid
row with much taller cards, leaving large voids. General and Notifications now
flow in content-sized sections; their internal control groups retain responsive
columns. Advanced keeps its independent grid. Image 4's identity editor was
outside the ancestor selector that widened its field controls; its own identity
class now controls layout, with a bounded horizontal logo-choice grid.

Image 3's unstyled Menu Bar details now has a full-width bordered disclosure,
large focusable summary, contained content and bottom clearance. Image 5's profile
membership rows now keep the switch, account name and provider together in compact
cards; theme controls share a row at wide sizes, and surfaces/membership span it.

Alibaba already had a light contrast plate and its bundled artwork is unchanged.
The analytics attention queue, however, explicitly replaced icon backgrounds with
transparent, defeating those plates. That override now respects the plate. Other
dark marks (DeepInfra, ElevenLabs, Manus, Venice and Devin) receive explicit light
plates; letter fallbacks propagate the same metadata. A regression test preserves
Alibaba's exact SVG and checks the explicit plate metadata. This is not yet visual
acceptance for every provider, theme or native tray raster.

## Additional Codex account recovery

Image 6 reports `The codex command could not be found`. Read-only host discovery
found `codex.exe` under `OpenAI/Codex/bin/bffc5354119c8421/`, with another version
directory beside it. The old fallback checked only `bin/codex.exe`, Bun and the
WindowsApps alias. PATH remains first; fallback now examines only immediate
directories in the known Codex bin directory, ordering executable candidates by
modification time and path. No account files were read or rewritten.

Review also found a deterministic mutex deadlock: the completed-child branch held
the process lock and called a helper that acquired that same lock. It now takes
the child through the existing guard, releases the guard and then collects output.
Focused tests cover version-directory discovery, exclusion of deeper/unrelated
files, missing root and successful child completion. Both passed. These tests do
not perform OAuth or prove second-account isolation.

The initial independent review identified two adjacent lifecycle defects. Both
are now repaired: explicit completion/cancellation/timeout/failure outcomes replace
ambiguous optional output, and bounded nonblocking drainage reuses the existing
owned Job Object/process-group supervisor. Capture is limited to 16 KiB per stream;
user-visible output retains the 4,000-character cap. Timeout, cancellation and
exit release the owned process tree without waiting for inherited-pipe EOF.

A 2 MiB stderr fixture reproduced timeout before the fix. Nine runner tests now
pass, including pressure, inherited-pipe descendant cleanup, cancellation, timeout,
completion and error paths; all 43 account tests passed. Fresh read-only Astra
review found no production-code blocker in this lifecycle packet. These are
synthetic children, not a completed OAuth sign-in.

Independent account instances, ordinal badges, reordering and account-specific
tray identities are still pending. Do not infer them from fixing CLI discovery.

## Build and QA evidence

The first layout build compiled successfully but could not overwrite the fixed
proof copy: PID 18324 was running that file. Evidence artifacts now live under a
SHA-256 directory; an existing matching artifact is reused, and source/copy hash
and compiled Dev-channel checks remain mandatory. The original running copy was
not closed, deleted or overwritten. The repaired build procedure passed while
that original process remained open.

Layout build `.local/qa05/product06-layout-build-final.log`: PASS, including
TypeScript, locales, frontend production bundle and Dev identity. Hash:
`97e00c01db20422a95a8d0eda15fe33b2f2006b4f2dcf4290273972bc8cf0db8`.
This build precedes the Rust login fixes; it is not represented as their binary.

Full frontend: **1,149 passed / 193 files**, log
`.local/qa05/product06-frontend-tests.log`. Workspace Clippy with warnings denied
passed (`product06-clippy.log`). Focused login tests: two passed
(`product06-login-tests.log`). Full Rust and final integrated Dev build results
are recorded below when complete.

Native current-state inspection found the owner-opened Dev Settings HWND 1180662,
PID 18324, minimized with zero rectangle and no matching accessible controls.
New-layout native comparisons therefore remain unverified. Prior screenshots are
baseline evidence only. The global adapter was stopped in finally; no physical
input, forced restoration or unrelated window changes were used.

## Owner About and workflow guide

The About page now credits Mohammed Modhish and links the expressly requested
WhatsApp contact through the existing HTTP URL bridge. Upstream credits remain
separate for Win-CodexBar, CodexBar and codexcontrol, grounded in LICENSE, NOTICE
and THIRD_PARTY_NOTICES.md. Runtime technology names come from the manifests.
The old product-labelled upstream GitHub/issue shortcuts were removed. An
expandable Arabic/English guide covers every destination in the actual primary
navigation registry; its exhaustive type prevents silently missing a new page.
Original logo assets are unchanged. These changes still require native comparison.

## GitHub ownership and release boundaries

The owner explicitly confirmed iModhish1 in their GitHub screenshot, matching a
fresh `gh api user` read. This resolves the intended publishing account by owner
confirmation. The private email endpoint was unavailable; no claim is made that
it was technically verified. No credentials/scopes were changed.

The planned canonical target is iModhish1/Quotalis. No matching repository was
returned by the authenticated repository listing, and no repository/release was
created. Updater metadata and release tooling now target this owner/project,
without upstream fallback. Release pages and assets must match the canonical
GitHub repository and tag. Publisher and local write wrapper check the actor.

Independent review found two further release-boundary defects and verified their
repairs using offline probes: a stale cached upstream checkout is now rejected
before fetch/reset/clean, and the wrapper's repository-only mode permits supported
creates rather than arbitrary existing-object mutations. Existing objects require
exact identifiers; foreign positional URLs and compact repository overrides fail.
The new default managed release directory is C:\code\Quotalis-release. Original
cached checkouts are preserved. The ordering regression now also requires both
guard and fetch positions to exist, avoiding a false pass from IndexOf == -1.

Offline shell guard and PowerShell release-helper tests passed. Full source gates:
1,149 frontend tests / 193 files; Rust desktop 484 passed + one existing ignored,
core 1,747 passed, CLI one passed, zero doc tests; workspace Clippy with warnings
denied, Rust formatting, TypeScript, locales, production frontend build and diff
check passed. Logs: product06-final-frontend-tests.log,
product06-final-frontend-build.log, product06-final-rust-tests.log and
product06-final-clippy.log under .local/qa05. Secret scan clean across 3,048 files
(product06-final-secrets.log). No remote release or installer execution occurred.

## Remaining acceptance

P06-01/02 are partially implemented, pending native comparison and full logo
coverage. P06-03's CLI/process defects are repaired; independent account instances,
ordinal badges, reordering, account-specific tray identities and actual OAuth
remain open. P06-04 through P06-08 remain active: browser/API flows, native brand
propagation, animated catalog/new batches, multi-icon tray, richer Profiles and
Collections. P06-09/10 now have source-backed in-product guide/owner About, still
requiring native acceptance. P06-11 has owner-confirmed release boundaries, while
repository creation, real release artifacts, installer validation and publication
remain pending. P06-12 is not an exhaustive or cross-version QA PASS.

Native recovery update: using the guarded, hash-verified launcher invoked the app's
normal single-instance activation. The helper exited with code 0 while the old
PID 18324 opened its dashboard HWND 1116728. This was explicitly identified as the
old build. Its inspected `Quit Ctrl+Q` control succeeded through InvokePattern;
a follow-up window inventory showed no Quotalis windows. No physical input,
forced process kill, or unrelated application operation was used. A new integrated
build was then completed before native comparison.

## Fresh native capture review — 7ea33671

Canonical Dev build SHA-256:
`f092a4f7d3e04aae25794d5cfdd2ca5b49264e37592434fa6320ac6977adb5ec`.
Guarded UIA navigation and PrintWindow capture ran against its owned Settings
window at 1846 x 1088. Every image below was opened and visually inspected.
Images live locally under `C:\Users\imodhish\AI-Tools\Desktop-Visual-QA\screenshots`.
These are initial viewport samples, not complete feature or lower-content coverage.

| Requested route | Observed coverage | Capture filename |
| --- | --- | --- |
| dashboard | Initial viewport captured and visually inspected | `window-395700-1d21e7d73f284898ba86d6220eef7fd1.png` |
| analytics | Initial viewport captured and visually inspected | `window-395700-b9c47443dbf24a9ea7b01c3215e26f66.png` |
| usageSpend | Initial viewport captured and visually inspected | `window-395700-86c625d03baf418a96058edb6604d256.png` |
| providers | Initial viewport captured and visually inspected | `window-395700-624efafd447748a99008bf5b0ed2d155.png` |
| profiles | Initial viewport captured and visually inspected | `window-395700-5b5147c4c0a64d8289b21ec64f97e1ef.png` |
| collections | Initial viewport captured and visually inspected | `window-395700-40a261d2f3a241c690e456aa10de4879.png` |
| appearance | Initial viewport captured and visually inspected | `window-395700-0eb2ffca25564288b5a14336d5ee53bf.png` |
| surfaceStudio | Initial viewport captured and visually inspected | `window-395700-d35c09ce884742aeb32a234b52281247.png` |
| trayStudio | Initial viewport captured and visually inspected | `window-395700-ec8a867a9a974a7087a564287bd85f96.png` |
| about | Initial viewport captured and visually inspected | `window-395700-cc2a99c245c7477686881ad3c677892b.png` |
| settings | About remained open; excluded from page coverage | `window-395700-1d9f017c0d1748ee971c9d0e7d166805.png` |

Findings:
- Providers: compact header, inset detail card and explicit switches are visible;
  original provider marks remain intact. Long source labels truncate. Additional
  account/tray workflows have not been accepted from this screenshot.
- Profiles: account membership names now stay together in bounded cards; the
  previous alignment defect is repaired in the observed two-provider state.
- About: original app mark, owner/contact card, technology chips and separated
  upstream cards render legibly. The lower guide still needs expanded capture.
- General baseline (`window-461366-99f699eee1b84f0fbc963f45001bbe17.png`):
  Navigation Layout consumes roughly 439 physical pixels, and Language roughly
  199. Diagram cards and stacked description margins cause avoidable whitespace.
  Follow-up reduces diagram size and assigns vertical spacing to the section gap.
- Analytics and Usage & Spend were captured during Measuring/Scanning states;
  they establish loading-state appearance only. Do not infer completed data or
  stalled execution without waiting and rechecking.
- Appearance was captured while Saving; disabled cards are not evidence that
  controls are broken. Paired static/animated entries remain a separate open
  taxonomy/motion requirement; the screenshot does not prove animation.
- Collections has an oversized grey preview stage in this two-provider state.
  Dashboard's two-provider rail still leaves substantial horizontal space.
- The last Settings click toggled the branch while About remained open. This
  duplicate is excluded; future scripts must verify visible destination content.

The adapter was stopped in finally after each batch. No physical input was used.

## Native comparison after the spacing repair

The CSS changes committed in `191de639` were built and exercised before commit
as a dirty `7ea33671` worktree. Exact canonical binary hash:
`baad781690eb718207af7608fa6617e60d7fede0bee158092146f9a7c0f8dfd5`.
`product06-spacing-dev-build.log` passed frontend TypeScript/locales/Vite and the
compiled Dev identity/source hash checks. This is not a build of a later commit.
No Rust or data logic changed after the full source gates listed above.

At the same 1846 x 1088 window size, Navigation Layout reduced from approximately
439 to 263 physical pixels (about 40%); Language reduced from about 199 to 175.
Descriptions and all three click targets remain legible. Notifications shows a
continuous stack, with preview, test control and settings in bounded sections.
Appearance's five original logo finishes now appear in one horizontal row. Menu
Bar's expanded content has a complete border and bottom clearance. About's guide
expands into legible two-column workflow cards; lower cards remain scrollable.

The Windows accessibility bridge exposes disclosure buttons with ExpandCollapse,
not Invoke. LegacyIAccessible.DoDefaultAction returned success without changing
their state. Those earlier captures are NOT accepted as expanded-state proof.
Using the existing guarded ExpandCollapsePattern changed `expanded_state` from
0 to 1 for About help and Settings. Menu Bar was likewise verified expanded.
No adapter restrictions or native input boundaries were weakened.

Demo was exercised through native TogglePattern with observed state 0 -> 1.
Dashboard showed the explicit DEMO banner and six synthetic providers. Analytics
Usage trends rendered the scenario's chart; Resets rendered the six-provider
schedule. Tokens and Overview explicitly withheld real local-activity data in
Demo. Monetary also currently shows the local-activity Demo explanation: this is
an unresolved presentation/capability limitation, not accepted monetary scenario
coverage. No live token counts were re-labelled as synthetic. Finally, Demo was
restored through expected-state 1 -> 0 and the off state was read back.

All captures below were visually inspected. The Demo configuration capture shows
the enable toggle; its lower controls are outside that viewport. These samples do
not prove every scenario, count, chart interaction, language or narrow-window state.

| Observed state | Capture filename (same local directory as above) |
| --- | --- |
| general | `window-7277268-4f921385e60c4a42886767c4affbbf04.png` |
| notifications | `window-7277268-060d7ae88af844eda589a9774f38b7b3.png` |
| about | `window-7277268-dd2c08e5ed704b7984563a49f22fbf1e.png` |
| guide-expanded | `window-658264-721f2e63f96c4a39b276c0e6e82a7103.png` |
| demo-config | `window-2296236-7fdddd1fe7f74edc8993cb15b23d48cb.png` |
| demo-dashboard | `window-2296236-78b5269310514e0780f31bb59b7d6ace.png` |
| demo-analytics-overview | `window-2296236-b37e3b3e80104a9abb18543c282d0cf1.png` |
| demo-Usage trends | `window-2296236-2c7acb6acebe42f5bda96d343a1d47f0.png` |
| demo-Tokens | `window-2296236-afcd9a4fe616425fbc8d07463a377f74.png` |
| demo-Resets | `window-2296236-4f8c806cdac44568bf67574f8e312d97.png` |
| demo-Monetary | `window-2296236-da3ac95eab4744a3aed766eedace07ab.png` |
| menu-expanded-bottom | `window-3738136-9e2215ae53bd4d5f996622f338286522.png` |
| appearance-logo | `window-3738136-dc7e3d2a0a3648e1931c955f9f05a3a5.png` |

Remaining visual findings include the oversized Collections preview stage,
remaining large presentation/settings cards, and Grok's existing bundled mark
looking unlike the requested reference. No provider asset was replaced by guess.
P06 remains PARTIAL; no exhaustive QA, installer, publication or cross-version PASS.


## P06-03 account-instance dashboard increment — 2026-09-13

The operational provider rail now has a separate instance identity. Persisted
Codex accounts use `codex:<uuid>` while their original brand remains `codex`.
Each account can be selected separately, retains its own plan/windows/observation
time, and has a numbered badge. A missing or identity-conflicting observation
remains unavailable. Account snapshots never inherit ambient money, pace, token
counts, or provider-only history. Account-specific history is explicitly unavailable.
The existing provider-wide analytics, KPIs and reset summary have not been widened
to aggregate these extra accounts; this is still a partial dashboard integration.

From a planet's detail panel, Move earlier/later reorders provider/account cards;
number visibility and the logical start/end badge corner are persisted through
`providerInstancePresentation`. These presentation settings do not authenticate,
change provider order semantics, switch the active account, or migrate credentials.
Refresh on an extra account targets its exact UUID. Account management continues
in Providers. The new passive bridge reads persisted metadata and snapshots only;
it deliberately excludes unpersisted discoveries whose UUID would otherwise change
on every scan. Successful addition/persistence is required before a new lane appears.

Independent read-only review identified and resolved two defects before delivery:
- A select list portalled outside an HTML modal becomes inert/hidden. The shared
  select now retains its owning dialog as portal parent; non-dialog selects still
  use the document body. A regression covers containment, selection and focus.
- Including unpersisted discovered accounts would make Refresh and saved ordering
  refer to expired UUIDs. The passive bridge now uses AccountStore directly.

Source evidence: full frontend 1158 tests / 195 files; workspace Rust desktop
496 passed + 1 existing ignored, core 1749 passed, CLI 1 passed, doc tests 0.
The post-review backend command repair passed its 11 focused tests. Workspace
Clippy with all targets and -D warnings, formatting, TypeScript, locale parity
(1585 keys), secret scan (3057 files), and diff whitespace checks passed.
No new skip/focus directives were found in the touched frontend tests.
Logs: `.local/qa05/product06-instance-*.log`.

Native modal interaction and saved setting readback are recorded below when tested.
Live second-account OAuth, independent native account tray icons, per-account
provider-management rows, account history, and exhaustive connection-method tests
remain open. This increment does not establish a full P06 or release PASS.


### Native account-card and modal proof

The first account-card candidate was built from 19781e2a plus the reviewed source
changes, Dev binary SHA-256
`b18ecb8b70e708e3d26d5299486e41cd1cac2d3f6bf9f239418f92c309795ebd`.
The guarded adapter verified `app.quotalis.desktop.dev` and `QuotaArc-Dev`, launched
its owned process, and used UIA without physical input. The local account store did
not expose a saved second account, so native proof is for the ordinary Codex card,
its numbered badge and shared preferences. Multi-account separation is covered by
source fixtures; it is not claimed as live second-account OAuth evidence.

Native semantics matter: the planet advertises ExpandCollapse, so Legacy default
Invoke reported success but did not open it. Using the inspected ExpandCollapse
pattern opened the actual `Provider details` modal. The badge select also uses
ExpandCollapse; options expose InvokePattern. Selecting Upper start corner changed
the visible preference, then Upper end corner restored the initial setting. The
picker remained visible above the modal contents and accepted the native action.
All images below were inspected. No failed default-invoke screenshot is counted
as successful dialog coverage.

Capture directory: `C:/Users/imodhish/AI-Tools/Desktop-Visual-QA/screenshots/`.

| State | Capture |
| --- | --- |
| Original provider artwork and account 1 badge | `window-68848-6e9fe35b96d14ae78eb935a133b49e3e.png` |
| Real expanded details modal | `window-331014-b358fb17028b4affba306e6fe23f89f6.png` |
| Interactive modal picker, two options | `window-265474-d83d6e0503404764a01dcb6e7235913a.png` |
| Selected start corner | `window-265474-8c3cbd482f20443e9d8c7cd845272ce1.png` |
| Restored end corner | `window-265474-963a0b6b3f514984b4e914054cdf67de.png` |

This visual pass found a transient account-number disappearance during preference
saving and an unfilled `{}` in the provider-dashboard action. Both were fixed in
0c0fe30f. Settings events now retain cards until the newest cache read completes;
error, removal-result and Demo boundaries still replace/mask them. Independent
review accepted this stabilization; 24 focused frontend tests passed. The popup
fix is 50f19dcd. A final rebuilt native check follows below.

### Final account increment native readback (2026-09-13)

Final Dev SHA256: `b0ab9011bc3d32b25cf0aedc33981a449dce6a8e45b610bc926925c35b58947b`;
embedded source `0c0fe30f9c26` dirty (documentation/test edits). Latest complete
frontend suite: **1159 passed / 195 files**, log
`.local/qa05/product06-instance-final-full-frontend.log`.

Guarded native WebView2 UIA verified selection of Upper start, retained account
number while saving, readback after Providers -> Dashboard remount, and persistence
across app relaunch. Original Upper end setting was restored and read back as
selected. Screenshots under the global Desktop-Visual-QA/screenshots directory:
- `window-1510368-dd40fe8db39f48a4904f9a9a860f9b8a.png`: selected start, stable number.
- `window-1510368-a9dc4f06ab8440e79c71b3008b80e1d4.png`: remount readback.
- `window-658676-cef05bb2c08340729a6ab30126cd3e51.png`: original end restored.
Transient COM Invoke failures were not counted as successful actions; the last
restore succeeded in a fresh guarded launch and its selected state was inspected.
Every adapter batch stopped in finally; no owned Dev process remains. Native
fixture did not contain a second persisted account: account isolation is covered
by source tests, not claimed as live multi-account OAuth evidence. P06-13/P06-14
are subsequent requirements and remain open until their own evidence is recorded.

## P06-13 / P06-14 — typed resets and circular provider navigation

Source commits: `82ff9701` (typed reset contract/source/bridge) and `79899d95`
(presentation, circular navigation, persistence and shared reset views).

### Accepted source behavior

- Eight physical account badge positions; separate eight-position reset badge,
  independent visibility switches, three/four foreground preference. Legacy
  start/end remains compatible. RTL rearrangement labels mean physical left/right.
- Circular wheel, arrows, keyboard and swipe navigation mount at most four cards
  (narrow windows may show fewer). Stable instance keys preserve account identity.
  Saved order and first foreground instance restore the visible group. Finite
  entry/reorder animation respects reduced motion; no idle animation loop.
- Serial/coalesced presentation writes retain independent fields and the last
  gesture. Independent Demo local storage never mutates the real presentation.
- Typed ResetDatum distinguishes known/unsupported/unavailable. Explicit zero
  remains zero; missing counts/statuses/expiries do not become invented values.
  Cards retain individual expiries and incomplete detail provenance. Reset badges
  show +1 Reset / +N Resets / No Reset; missing evidence is a dash with a label.
- Ambient Codex and persisted managed-account observations carry separate reset
  facts. An account with no usable quota can still carry its own reset inventory;
  conflicting provider-account identity withholds both. Additional account facts
  do not enter provider-wide history.
- Shared detail UI is used in current limits, rail detail, provider usage settings,
  tray menu card, Codex account menu, reset horizon and reset schedule. Legacy
  informational reset-credit rows are excluded from quota/extra usage selection
  and stage quota windows. Unknown inventory cannot re-arm banked notifications
  by pretending a confirmed zero was observed.
- Managed inventory requests use the supported HTTPS origins only. Test-only
  loopback mock allowance is absent from production. Optional inventory failure
  cannot invalidate verified quota equivalence.

### Review and validation

Independent Astra review found and rechecked four repaired defects: completion
microtask lost-write race, rejected/past weekly timestamp fallback, Demo anchor
leaking into real navigation, and insufficient custom-backend origin validation.
The reviewer independently replayed 12 queue completion boundaries successfully.

- Full frontend: **1171 passed / 198 files**,
  `.local/qa05/product06-reset-reviewed-frontend.log`.
- Workspace Rust: desktop **496 passed + 1 existing ignored**; core **1763 passed**;
  CLI **1 passed**; doc tests 0, `.local/qa05/product06-reset-workspace-final.log`.
- Workspace Clippy all targets / -D warnings: passed,
  `.local/qa05/product06-reset-clippy-final.log`.
- TypeScript and 1614-key locale parity passed. Secret scan: **3066 files clean**.
- Focused tests include eight-position settings roundtrip, 70-provider wrap,
  saved anchor, RTL reorder, Demo transitions, zero/one/multiple/unknown cards,
  past/explicitly rejected weekly dates, authenticated managed endpoint isolation,
  two-account snapshot roundtrip and notification unknown-state guard.

### Explicit remaining scope

No current source proves a company-wide reset event or a reliable persisted last
actual reset; those fields stay unavailable. A quota drop is not upgraded into
company-issued evidence. Managed verified reads currently fetch optional inventory
per quota sample, which may add endpoint latency. Native tray glyph/tooltip reset
inventory and the remaining stage-specific surfaces need their own layout work;
this increment is not a blanket claim of coverage of every tray/floatbar theme.
Native screenshots for the rebuilt reviewed candidate follow below. Whole-product
QA, live OAuth, release/installer and remaining P06 work are still open.

### Native reset and position acceptance (2026-09-13)

The reviewed reset candidate `b838169d` was launched through the guarded,
hash-verified Dev adapter. Actual Codex inventory displayed **+2 Resets** and
separate available cards with expiries on October 4 and October 5, 2026. Last
actual reset and provider-issued reset evidence remained unavailable. The next
weekly timestamp was reported independently. This does not prove a company-wide
reset event. The native detail tree contained both cards; the first screenshot
shows the first card, with the second below the fold.

The original two position dropdowns had no visible field captions. They were
replaced with labeled, physical 3-by-3 position grids (center reserved, eight
buttons) in `9881c7a7`; `c2ccc9c9` also normalizes legacy start/end reset values.
The grids keep physical left/right in RTL, expose pressed state, and inherit
the existing theme. No provider or application logo asset was modified.

Native acceptance on `c2ccc9c9`, Dev SHA256
`8f4f04baf99087f603f004ddd3fcd20a071e5bb095957096e7015ed06d3f06bd`:

| Physical position | Account selected readback | Reset selected readback |
| --- | --- | --- |
| Top left | Passed | Passed |
| Top center | Passed | Passed |
| Top right | Passed | Passed |
| Middle left | Passed | Passed |
| Middle right | Passed | Passed |
| Bottom left | Passed | Passed |
| Bottom center | Passed | Passed |
| Bottom right | Passed | Passed |

Each row used inspected native TogglePattern state and expected_value=0, followed
by a selected-state=1 readback. Account bottom-left and reset bottom-center also
survived a fresh guarded app launch. Original account top-right and reset
bottom-center were restored and read back. Initial option Invoke/Legacy RPCs
either failed or did not change the setting; these were not counted as passes.
The grid controls worked through their exposed TogglePattern. No physical input,
adapter bypass, personal profile edits, or OAuth actions were used.

Native Demo was enabled using its actual setting. Six simulated providers yielded
four mounted cards: Codex, Claude, Gemini, Perplexity. Next produced Claude,
Gemini, Perplexity, DeepSeek; Previous restored the first group. The screenshot
shows the explicit Demo label and zero/one/two/three reset inventory examples.
Demo was switched off and its native unchecked state read back in finally.
Three-card layout, wheel gestures, 70-provider wrap and cross-mode anchor isolation
remain source-test evidence; this batch is not native proof of 70 providers or
physical wheel input. Native adapter batches always released in finally.

Screenshots in `C:/Users/imodhish/AI-Tools/Desktop-Visual-QA/screenshots/`:

| Evidence | File |
| --- | --- |
| Real reset details / first card expiry | `window-724186-dc0d28a643094e97942fbc8a42a7cde5.png` |
| Account bottom-left and reset bottom-center selected | `window-1248498-91142086704b4d3e92d39a9ce4f915e4.png` |
| Both original positions restored after sixteen selections | `window-2493290-54acda34d70746058a4a95d004993cf0.png` |
| Six-provider Demo, four visible and reset count cases | `window-1314020-a027a01458034c17b2cc0cf31220cdf7.png` |

All listed images were visually inspected. Latest full frontend suite after the
grid change: **1172 passed / 198 files**, log
`.local/qa05/product06-position-grid-frontend.log`; tsc passed. Backend source is
unchanged from the full Rust/Clippy gates above. `4ca2a255` adds spacing when both
badges use the same top or bottom edge; final build and native evidence follow.

Final Dev build: embedded source **4ca2a2552c06**, SHA256
`7b149820d3c651d89a1a82b84640c725908fe62d8cfcfdf554d027bec589c4ab`.
Verified builder passed, including the production frontend bundle;
`.local/qa05/product06-position-final-dev-build.log`. Subsequent changes are docs.
Final secret scan: **3069 files clean**;
`.local/qa05/product06-position-final-secrets.log`. TypeScript and diff checks pass.

Fresh final-binary launch read back the restored account top-right and reset
bottom-center settings. Both badges were then selected at top-center and the
actual dashboard captured: the inventory sits above the number with clear space,
and the provider logo remains visible. Original positions were restored again
with native readback and an unblurred dashboard capture:

- Shared top edge: `window-1969230-fff7a6895c5f4717a8057d1d643f42e2.png`.
- Final real-data/restored state: `window-1969230-4f7e331856aa4bac9d742610fcbebb53.png`.

Both final screenshots were visually inspected. Dev was released by the adapter
in finally; no owned QA process remains. This increment does not close the broad
all-feature, installer, live authentication or remaining reset-surface backlog.

## P06-08 — profile workspace increment

Source `4f1dcfd1` prevents an inactive profile deletion from explicitly reapplying
the active profile to global settings. It preserves provider account records and
does not call credential removal. Active-profile deletion still selects a valid
fallback and reconciles its settings/surfaces. Existing load-time migrations and
the preexisting two-file active-deletion save sequence are not redesigned here.

Source `6705738e` exposes the existing persisted profile ordering command through
earlier/later buttons, adds account/provider search, original provider icons,
distinct copy names, explicit rename save/cancel, contextual accessible action
labels, localized English/Arabic controls and a compact detail heading. The old
rename input nested inside a button and blur-triggered save are removed. A ref
lock and disabled workspace block duplicate mutations within this mounted page;
this is not a cross-window transaction lock. Deletion has a scoped confirmation
explaining that accounts/credentials remain. Search never changes membership.

Independent read-only Astra review caught a malformed Fluent placeholder, repaired
with the existing literal-placeable convention. A real English/Arabic locale
lookup test now covers it. Repair review found no introduced blocker in scope.
Frontend mocks alone were not accepted as native locale evidence.

- Full frontend: **1178 passed / 199 files**,
  `.local/qa05/product06-profiles-frontend.log`.
- Post-review focused frontend: **17 passed** (workspace and pure order/copy logic).
- Workspace Rust: desktop **498 passed / 1 existing ignored**, core **1764 passed**,
  CLI **1 passed**, docs 0; `.local/qa05/product06-profiles-workspace.log`.
- Actual locale placeholder lookup passed in the workspace run. Workspace Clippy
  all targets with warnings denied passed: `product06-profiles-clippy.log`.
- TypeScript passed; secret scan **3071 files clean** (`product06-profiles-secrets.log`).

Remaining findings, not disguised as acceptance: profile nullable-theme clearing
and restoration of the global light/dark preference need backend reconciliation.
Copy-name uniqueness currently uses the UI snapshot, not a backend uniqueness
constraint. Collections' detach serial restarts at zero after mount; with a saved
`solo-1` group its first detach can fail the duplicate-id guard while changing the
existing group's position. Add a persisted-layout regression and unique group-id
allocation in the following collection packet. Broader P06-08 remains open.

Native profile workflow on `6705738e`, Dev SHA256
`328cb42138ff2d3967fb11ecf5ab42d9fd23f5ddf7ca4df6a52e44484b015ee9`:
created a QA-owned profile, renamed it using ValuePattern and explicit Save,
duplicated it with a distinct name, and moved the copy earlier. An adapter COM
subscriber error interrupted the first readback/cleanup; this was not recorded
as a pass. A fresh guarded launch then read back the saved order (copy before
original), confirming persistence. Both QA profiles were deleted through their
uniquely named Delete and Confirm deletion buttons. Final inspection reported
no QA profiles; Default remained active. No owner account membership or theme
was changed. All native batches released the adapter in finally.

Visually inspected local captures:
- Before: `window-1510228-0e7bf3772de043328d0b1ddb7a537e4f.png`.
- After cleanup: `window-4459298-c931e886feab4bcbaa100c3f7be7a93b.png`.

The captures exposed an unthemed search input; `e0d60928` applies theme surface,
border, padding and keyboard-focus styling to profile search/name inputs.
The native accessibility tree needs an initial inspect followed by a fresh
inspect after WebView initialization; an initial pane-only tree did not mean
the application was blank (a PrintWindow capture confirmed rendered content).
Final cargo fmt check and changed-code skip/focus scan passed.

Final verified Dev source **e0d60928be29**, SHA256
`0a0bb7a9a499eecf72ea9917d434772261352b841f3ff20ef628dfd5c760d05e`;
builder (including final TypeScript, locale parity and production bundle) passed:
`.local/qa05/product06-profiles-final-build.log`.
Native ValuePattern search for Codex returned only its membership row; screenshot
`window-1641746-32dedf97977b441591af3ab8f688e12e.png` was visually inspected and
confirms the repaired themed field. The attempt to clear the search hit an adapter
COM error. Search is component-local, and a fresh launch confirmed both Claude
and Codex rows, Default active, and zero QA profiles. Final inspected capture:
`window-4262492-c9e815ceaf824f2d8e01760be24bbd42.png`.
No claim of complete profile theme/surface or all-application acceptance is made.

## P06-08 — Collections persistence and accessible regrouping

Source `72e476c2` fixes two reproduced defects: a saved `solo-1` collided with the
first detached group after remount and changed that existing group's position;
Gather all rebuilt from current snapshots and discarded temporarily unavailable
items while resetting user order. Detached IDs now avoid both current groups and
retained positions, and no positions change when detach rejects the item. Gathering
retains current group/item order and includes newly available providers afterward.

Targeted regrouping buttons now move the selected provider into a specific group
without dragging; they preserve target placement and expose contextual accessible
names. English/Arabic guidance explains the workflow. Existing Collections controls
are not all localized by this increment. No schema, auth, quota or pricing contract
changed.

Regression tests were run failing before repairs, then green: saved group placement,
order/offline retention, and targeted regrouping preserving placement. Focused
Collections tests: **11 passed**; full frontend: **1181 passed / 199 files**.
Logs: `.local/qa05/product06-collections-{red,move-red,green,frontend}.log`.
TypeScript, formatting, diff checks and secret scan (**3071 files**) passed.

The initial full Rust run hit two existing subprocess test timeouts during
concurrent frontend load. Nine focused login tests passed in isolation and an
unchanged full workspace rerun passed. Investigation found the descendant fixture
allowed a three-second startup while its outer test supplied only two seconds.
The test-only repair uses the existing five-second fixture allowance, retains
parent/descendant termination checks and adds a lower-bound assertion for timeout.
Production login deadlines were not changed. Final gates/native evidence follow.

Test-only deadline repair: `0f5fd5ab`. Final workspace tests: desktop **498 passed
/ 1 preexisting ignored**, core **1764 passed**, CLI **1 passed**, docs 0
(`product06-collections-workspace-final.log`). Clippy all targets with warnings
denied passed (`product06-collections-clippy.log`).

Native Dev source `0f5fd5ab2eaa`, SHA256
`09b3f8b33fc505a478e183dbf2934a8d46dda69fe98682f09e73f5903e7a9ed5`:
guarded UIA detached Claude from the two-provider group, exposed the exact
`Move selected to Codex` button, regrouped it, and showed Codex then Claude in
one group. Navigating away/back restored the original Claude/Codex saved order.
Save was never invoked, so the owner's layout was preserved. Screenshots opened
and visually inspected under the global QA screenshots directory:

- Before: `window-5966496-10d4930e144540d6b52881b5c0a7d410.png`.
- Detached: `window-5966496-c6c96b88154c45149209237fd9102ccd.png`.
- Regrouped: `window-5966496-594b775d70094e10af9cc1e1793aecc0.png`.
- Original draft restored: `window-5966496-693f7bcd05d6488a83c59b47205eab67.png`.

The screenshots exposed a tall editor pushing Save below the initial viewport
beside a mostly empty gray canvas. `b335fa30` uses the page width for related
controls and replaces that gray canvas with a bounded, theme-aware dotted
workspace. Provider widget pixels and user-saved coordinates remain unchanged.

Final verified Dev build: **b335fa30bca9**, SHA256
`4bd5c9badfbcb124c016a342a93322cace18c30ece3cfc20ccf1ea05bb34d779`;
`product06-collections-final-build.log` includes successful final TypeScript,
locale parity and production frontend build. Fresh native captures were visually
inspected:

- Compact initial page: `window-9307030-20280eccbd564f8980aeb900a051a2c8.png`.
  Save is visible at y654–706 instead of below the initial viewport.
- Detached draft controls: `window-9307030-ad2ed1ef63894a68873b0945e8deb9e8.png`.
- Lower preview revealed through ScrollItemPattern:
  `window-4524636-62a758401b4d40a9ae9df088a355b602.png`; both detached widgets
  are reachable and visible. The editor and preview scroll when content exceeds
  their bounds; this is not a claim that all content fits every viewport.

All native sessions stopped in finally. No physical input or Save action was
used. The saved-reload collision is covered by the persisted-layout component
regression, not by a fabricated native saved-layout scenario. Broader detached
window, RTL, 70-provider and all-control native acceptance remains open.
