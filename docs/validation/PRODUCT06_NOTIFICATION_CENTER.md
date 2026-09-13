# P06-16 — notification center and subscription contract

Status: source audit and implementation contract; the center is **not implemented**
by this document. The latest owner objective is attachment
`5f46054a-7d34-47d8-a851-a6ff8e5689d9/goal-objective.md`.

## Implementation checkpoint — 2026-09-13

The reset/banked foundation now exists in `notification_journal.rs`, with a
separate per-channel SQLite store and an atomic event/baseline transaction.
Known-account baselines survive restart; unidentified accounts use a per-process
lane. Records contain hashed account references, never the raw account identifier.
They preserve observation intervals and receipt/detection time, leaving exact
occurrence time unknown. Schema/corruption failures do not replace the database.
Paging, bounded retention, unread state and boundary-limited mark-all are core
APIs only; they are not yet connected to a notification-center UI or IPC.

Reset and banked producers now capture changes before toast preference gates.
The first observation is quiet; repeated/older observations do not create events.
Banked rearming also clears count-bearing in-memory keys, covering 0→2→0→2.
Nine journal tests and 36 notification tests pass. Remaining work includes other
event producers, subscriptions/sounds, UI/IPC, redacted log view and native
restart evidence. This checkpoint does not claim the full center is complete.

Latest objective `ae46db11-c88d-408a-b0eb-c8978f343a25` explicitly gates
publication on native notification-header icon evidence. The installer now uses
its bundled PNG for AUMID IconUri, consistent with runtime PNG registration;
shortcut/taskbar ICOs remain separate. This source correction is not native proof.

Native header proof on 2026-09-13: guarded UIA opened Dev Settings → Notifications
and invoked Send test notification using the Quotalis identity. Read-only Helix
full-screen captures `quotalis-toast-header-test-early.png` and
`quotalis-toast-header-test-later.png` were both visually inspected. Windows shows
the app mark in the small header icon beside Quotalis, and a larger original mark
beside the data-free test message. Files remain private in the global
Desktop-Visual-QA/screenshots/helix directory because full-desktop captures include
unrelated host chrome. Do not publish those full-desktop images as marketing art.

The Windows-exe generic screenshot endpoint rejected capture as background-only;
the documented read-only Helix screenshot without a target window was used. No
physical input, focus injection or adapter bypass was used. Both backends were
stopped in finally and the owned Dev app exited normally. The test proves the
current runtime Dev registration/artwork, not installation/upgrade of the changed
installer, provider-specific body artwork, every logo finish or Windows version.
Header icon size is Windows-controlled. Installed/portable release checks remain.

## Current source findings

- `rust/src/notifications.rs::NotificationManager` detects usage thresholds,
  percentage steps, session transitions, predictive pace, expected/unexpected
  reset observations, banked inventory, pricing transitions and service issues.
- `load_persisted` restores hashes used for duplicate suppression. Its
  `PersistedNotificationDedupe` does not restore prior reset observations or
  inventory counts, nor does it contain an event journal or read state. The first
  observation after restart therefore lacks the previous baseline for detecting
  changes that occurred while the app was stopped.
- `check_and_notify` and other producer paths return when toast preferences are
  disabled. Capturing events only in `show_toast` would omit muted events and
  cannot satisfy the requested complete in-app history. Detection, history,
  delivery eligibility and native delivery must become separate steps.
- `commands/providers.rs::notify_usage_thresholds` already inspects primary,
  secondary, model-specific, tertiary and named extra windows. Informational
  placeholders and the reset-credit pseudo-window are excluded from quota checks.
  The existing `previous_reset_observations` keys include provider/account/window.
- Codex API parsing emits distinct `codex-spark` and `codex-spark-weekly` windows.
  Normal notification keys are `fiveHour` and `weekly`; named keys become
  `extra-codex-spark` and `extra-codex-spark-weekly`. Keep all four independently
  selectable. A model/window display label must never serve as its identity.
- `NotificationEventPreferences` currently contains global event booleans, not
  per-account/physical-window delivery subscriptions. Existing threshold overrides
  are not equivalent to the requested independent notification switches.
- `sound.rs` has seven bundled WAV clips, Windows sound aliases and per-event
  custom WAV paths. Reset sounds reuse existing clips. It does not yet supply the
  requested expanded sound library or per-limit sound overrides.
- Explicit test toasts use `commands/notification_test.rs`; proof harness toasts
  have another entry point. These must be labeled test/demo and kept out of the
  real unread count. Generic app toasts must also enter the center through a
  bounded, redacting public event API, not arbitrary raw log ingestion.

## Implementation order and ownership boundaries

1. Core persistent event store and baseline reconciliation. Use the existing
   SQLite dependency, a separate per-channel notification database, transactions,
   explicit schema versions, bounded retention, stable dedup keys and read state.
   Do not alter analytics observations or provider credentials. Store account
   references without email/cookie/token text. Match accounts exactly; missing
   identity must not import another account's baseline.
2. Convert producers into typed events with source evidence before delivery gates.
   Commit the event and updated observation baseline together. Retryable delivery
   metadata must not duplicate the event or silently mark it read. A store failure
   is visible and logged through the existing redactor, not claimed as success.
3. Add typed subscriptions resolved global → provider → account → physical limit.
   Each scope supports inherit/explicit on/explicit off, event kinds and sound.
   Expose four independent ordinary/Spark weekly/five-hour switches when observed.
   Persist disabled choices across restart and provider-list refreshes.
4. Add a dedicated center, navigation badge, in-app update event and typed IPC:
   paginated list, unread count, mark one/all read, filters, search and retention.
   Selecting an item opens its exact provider/account/window when still present;
   deleted accounts retain a safe historical label without reassignment.
5. Add the sound catalog and preview, per-event/per-limit controls, and a separate
   redacted technical-log view. Do not turn each debug line into an unread alert.
   Document quiet hours, muted delivery versus recorded history, unavailable
   sources, and the practical limits of offline recovery.

## Event semantics and visual behavior

- Keep `occurredAt` nullable and separate from `receivedAt` and `detectedAt`.
  Provider-stated timestamps have explicit provenance. A change found on startup
  can provide an interval between observations; never invent an exact event time.
- A quota drop or moved boundary is an observed account/window change. It is not
  proof that the company reset every user's limits. Name the event accordingly.
- Unknown banked inventory cannot become zero. Expired cards, new cards and
  inventory changes require stable source identifiers or qualified count evidence.
- Red unread badge: omit at zero; display exact 1–99, then `+99` above 99. Supply
  the exact count to assistive technology. Reading a list alone need not mark all
  items read. Mark-all applies to a captured event boundary, so concurrent new
  arrivals remain unread.
- Separate unread/read state from notification delivery and from diagnostic logs.
  Use original provider/app artwork with its contrast plate, compact timestamps,
  event-kind labels and honest empty/loading/error states. Support RTL and narrow
  windows; no permanent animation or polling loop just for the unread badge.

## Required acceptance evidence

Unit/integration tests must cover known and unknown identity, all four Codex
windows, independent switches, inheritance, sound resolution, dedup, paging,
99/100 unread counts, concurrent mark-all/new arrivals, bounded retention,
corruption/migration, muted toast with stored event, and redaction of provider
error text. Startup tests require persisted baselines and explicit offline change
fixtures; they must not simulate a server event that cannot actually be retrieved.

Native Dev acceptance must exercise center navigation, badge/read controls,
per-limit switches, sound previews, persistence after normal exit/relaunch, new
events while the page is open, theme/RTL/narrow layouts and account-specific links.
Use labeled Demo data for deterministic visual coverage and test notification
producers independently. No physical input or Personal data changes.
