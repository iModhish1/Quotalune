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
