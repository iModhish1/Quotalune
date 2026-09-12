# SHELL-03 — compact provider workspace and background library

Request: compress excess page chrome; give provider list/detail safe independent space; switches follow logo identity without checkmarks; hover/focus resize affordances; categorized imported backgrounds; eight primary destinations including About.

## Implementation

- Primary navigation: Dashboard, Analytics, Usage & Spend; Providers, Profiles, Collections; Settings, About. Related settings editors remain in one expandable hierarchy. Legacy tab IDs and deep links remain valid.
- Shared page chrome is compact. Providers gains a persisted list width (184–360 CSS px, default 256), bounded by the available detail area. Below 620 px of available workspace the panes stack. Pointer capture, cancel, keyboard arrows/Home/End, double-click reset and RTL direction reuse the main sidebar handle.
- Provider monitoring switches update `enabledProviders` only. They do not remove accounts or establish authentication. A provider without a snapshot remains in the catalog. The OAuth-specific label is only used for an observed OAuth source needing authentication; other methods keep their existing truthful state.
- Switches use a quiet silver off state and a restrained logo-variant on accent. Original app/provider logo assets are unchanged. Position conveys state in addition to color. Shared scrollbar and safe gutter styling covers workspace pages.
- About is a primary page with the original mark, live application version, support links and the existing update controls. Failed application-info loading has an explicit error state.

## Background architecture

28 bundled choices: four existing designs and three new collections, each with four static and four animated choices. The library filters All / Static / Animated / My backgrounds. Gradients are local code, and the original cosmic image remains bundled. No video, canvas render loop, remote asset, new package or per-frame React update was added.

Animated choices opt into motion. One CSS transform layer moves slowly; previews remain static. Animation pauses while unfocused/hidden, with reduced motion, disabled app animation or Low CPU. Existing event-driven pointer glow keeps its 30 Hz cap and no idle JS loop. These controls are budget measures, not a claim of zero GPU usage.

Imported PNG/JPEG/WebP files are limited to 20 MiB. Format headers and a 32 million source pixel ceiling are checked before browser bitmap decoding. The browser resizes/re-encodes to PNG at most 2560 px, with a 240 px thumbnail. The backend independently validates/re-encodes bounded PNG payloads (8 MiB main, 256 KiB thumbnail), using decoder allocation/dimension limits. Animated WebP is unsupported.

The managed directory is the current channel's config root plus `workspace-backgrounds`. Only canonical generated UUID v4 IDs cross read/delete commands. No source paths enter these commands. Original files are never changed. Catalog size is 40. Commands serialize off the UI thread; deletion also shares the settings transaction lock and refuses an active image. The UI verifies the saved fallback before deleting and reads current preferences after asynchronous import.

Metadata is synced and atomically published without overwriting an existing item. Partial writes clean up owned files. Missing owned images/thumbnails leave a removable library entry; invalid/unsafe entries fail closed. Existing reparse points and symlinks are rejected. File systems lacking hard-link support report an import error. Interrupted operations can leave bounded ignored orphan files; automatic broad cleanup is intentionally absent.

## Review and checks

Independent read-only review found four defects during development: decode before bounds, partial metadata publication, swallowed settings-save failure before delete, and stale import preference writes. All were repaired and re-reviewed with no remaining actionable finding in that scope.

- Frontend: 189 files, 1132 tests passed (full final suite).
- Rust workspace: desktop 475 passed / one pre-existing ignored; core 1713 passed; CLI one passed; doc tests zero.
- Type checking, production build and locale parity (1513 keys) passed.
- Clippy all targets with warnings denied, format check, Dev identity tests (13) and secret scan passed.
- No added focused/skipped tests; `git diff --check` passed. Final secret scan: 2322 files clean.

## Native Dev verification

Code candidate **d0bb016520bd**, built with both the Dev channel feature and Dev Tauri config. The embedded revision matches. Binary: `target/debug/QuotalisDev.exe`; SHA-256 `ada34a4efc0a67a559461cc368775a0658eec67e95180369232347eb9ff8a488`. Identity: `app.quotalis.desktop.dev`, config root `QuotaArc-Dev`. The final owned process was PID 31452; primary HWND 5963870. No Personal instance was launched, closed, migrated or changed.

Native testing found and repaired three defects that source tests alone had not caught:

1. Legacy sticky provider-header margins overlapped content; the header now remains in normal flow, with only the tabs sticky and wrapped labels.
2. A large imported data URL persisted successfully but failed to paint as a CSS custom property in WebView2. Imported pixels now render in a decorative image element, under a separate theme scrim.
3. Native pointer moves could leave the narrow separator despite pointer capture, leaving a drag active. Both separators now keep temporary window-level move/release/cancel/blur listeners and remove them on every exit, including unmount. Regression tests cover outside-handle release in both directions, cancellation and listener cleanup.

Final observations:

- Cua Drivers clicked the main collapse/expand control; native DOM readback confirmed hidden navigation and recovered content width. A Cua click and Right key on the provider separator persisted width **296 → 312**. The driver sometimes reports an unverifiable delivery; acceptance used the actual persisted state.
- Native WebView2 CDP mouse press/move/release verified both drags: provider width **256 → 296**, main navigation **232 → 256**. Cua's drag injection was unavailable on this Windows session (AccessDenied); CDP input was used for this gesture, not reported as Cua drag success.
- **32 route checks**: all eight primary pages at native 1216 and 800 CSS-pixel widths, in English and Arabic. No document horizontal overflow or error-boundary fallback. All routes retained the shared background. Narrow provider panes stack and scroll; the toolbar toggle moves to the right in RTL.
- Final toolbar height approximately **44.7 CSS px** at wide width. Provider navigation begins directly below the compact title/filter area. Safe detail padding and slim arrowless scrollbars are visible in the native capture.
- Native monitoring toggle persisted Claude off and back on; it remained a catalog row while disconnected. No sign-in, account switching or credential mutation was exercised. Switch pseudo-element checkmark content was `none`.
- All five existing logo variants were exercised live: enabled switch colors changed to their restrained accents; the translucent silver off color remained identical. Original logo assets were not modified.
- Background filters showed **28 bundled / 16 static / 12 animated**, plus one owned import fixture under My backgrounds. The 16 static choices include the plain theme-color option.
- The image imported through the native file input survived process restart in the managed library. The repaired backdrop loaded at **1659 × 948**, persisted its selection across reload and remained visible. Backend deletion of the active image was rejected; UI deletion first saved the cosmic fallback and then removed the owned copy. Source-image SHA-256 remained unchanged. The owned test import was removed after verification.
- Independent motion guards were exercised: Low CPU, disabled app animation, reduced-motion preference, and native window minimization. The first three removed the animation; minimization changed the computed animation play state to `paused`. Baseline animation ran. Media/focus preferences were explicitly emulated for the baseline and reduced-motion checks.

## Performance sample

Native Dev WebView2, About page, balanced preset unless stated. Three five-second samples per mode, with focus and no-reduced-motion emulated. These are whole-renderer main-thread measurements, **not system CPU or GPU percentages**.

| Mode | Main-thread task time in each 5 s sample | Script time | Layout count | JS heap |
| --- | --- | --- | --- | --- |
| Plain background | 0.836 / 0.618 / 0.582 ms | 0 / 0 / 0 ms | 0 / 0 / 0 | 10.48 MiB |
| Animated background | 3.705 / 3.107 / 2.845 ms | 0 / 0 / 0 ms | 0 / 0 / 0 | 10.56 MiB |
| Same selection, Low CPU | 0.519 / 6.093 / 0.772 ms | 0 / 1.096 / 0 ms | 0 / 0 / 0 | 10.64 MiB |

The animated transform changed over the sample, while no repeated JavaScript or layout work appeared. The guarded renderer still has unrelated application activity, as the middle Low CPU sample shows. This short debug-build sample does not establish battery use, long-session GPU cost or performance on every device. The static option and resource guards remain available.

## Evidence and outcome

- [Providers, Cua native capture](../images/shell03/providers-final-cua.png)
- [Collapsed navigation](../images/shell03/collapsed-native.png)
- [Narrow English providers](../images/shell03/providers-english-800.png)
- [Wide Arabic providers](../images/shell03/providers-arabic-1216.png)
- [Narrow Arabic providers](../images/shell03/providers-arabic-800.png)
- [Background library](../images/shell03/background-library.png)
- [Imported image rendered across the workspace](../images/shell03/imported-background.png)
- [Custom library before owned-fixture cleanup](../images/shell03/custom-background-library.png)
- [Standalone About](../images/shell03/about-final.png)

Local reproduction/evidence logs: `.local/shell03-native-build-final3.log`, `shell03-frontend-final3.log`, `shell03-rust-final2.log`, `shell03-clippy-final.log`, `shell03-layout-final.json`, `shell03-resize.json`, `shell03-library-final.json`, `shell03-brand-final.json`, `shell03-guards-final.json`, `shell03-performance.json`. Native helper scripts are local proof tooling, not production code.

**SHELL-03 implementation and validation passed for the scope above.** Visual preference remains the owner's decision. Existing untranslated provider-detail labels in Arabic are still visible; this work did not claim a complete locale rewrite. Imported backgrounds support static PNG/JPEG/WebP, not video or animated image playback. Dev presentation settings were restored after testing; no production deployment was performed.
