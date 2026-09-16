# Notification History — schema compatibility and rollback contract

Wave 2C, 2026-09-16. Storage/code compatibility only; no native pixels involved.

## Versions

| Build | Journal source | `PRAGMA user_version` it writes | What it rejects |
| --- | --- | --- | --- |
| Published Quotalis 0.11.0 (`iModhish1/Quotalis` @ `c1902e9a`; identical to this repo's `5c287764`) | `rust/src/notification_journal.rs`, SHA-256 `a3301bc6…f76b`, frozen verbatim as `rust/src/notification_journal/legacy_v0_11_0.rs` | 1 | `user_version > 1`; any `kind` outside its four observation kinds; `NULL` in `previous_value`/`current_value` |
| Wave 2B (`c98d339a`…`627c0e29`, never published) | rebuilt `notification_events` (nullable values, `detail` column), migrated v1→v2 | 2 | `user_version > 2` |
| Current (Wave 2C) | additive layout below | **1** (unchanged, 0.11.0-owned) | `user_version > 2`; converts a v2 file back on open |

File: `<config root>/notifications.db`, next to `notification-dedupe.json`
(the dedupe/predictive-key store is a separate JSON file the journal never
opens or writes).

## The exact downgrade break (reproduced, `legacy_reader_rejects_the_wave2b_layout_for_three_independent_reasons`)

A 0.11.0 build could not read a Wave 2B file for three independent reasons,
each sufficient on its own:

1. **Strict version check.** 0.11.0 refuses `user_version > 1` before reading
   any row (`"Notification history was created by a newer version"`), so the
   whole history — including every pre-upgrade row — became invisible.
2. **Closed enum.** 0.11.0 deserializes `notification_events.kind` into a
   four-variant enum. One row with a new kind (`usageHighReached` etc.) fails
   `page()` for the entire result, not just that row.
3. **Nullability.** 0.11.0 reads both values into `f64`. Wave 2B made them
   nullable and stored `NULL` for status/pricing rows; one `NULL` fails the
   page.

Affected feature: the Notification Center in Settings, plus reset/quota
observations (`observe`) which share the table. Dedupe state was never
affected (separate file).

## Chosen strategy: A — additive, backward-compatible schema

- `notification_events` keeps **exactly** the 0.11.0 definition (`NOT NULL`
  values, no `detail`, same index) and `user_version` stays **1**. Only the
  four observation kinds, always with two real values, are ever written there
  — the precise row shape 0.11.0 parses.
- Issued notifications (threshold, milestone, session, pace, provider status,
  pricing) live in the additive table `quotalis_notification_records`
  (nullable values, closed `detail` codes) with its own index. 0.11.0 never
  queries it; SQLite ignores tables a reader does not name.
- The additive component's version lives in `quotalis_storage_version`
  (`notification_records` = 1), so future additive changes never touch the
  legacy-owned `user_version`.
- Both tables share one id space: every insert raises the legacy
  `sqlite_sequence` high-water mark, and the current reader pages a
  `UNION ALL` of both tables ordered by id. Ids stay unique and chronological
  even when 0.11.0 inserts rows after a rollback.
- A file left by the short-lived Wave 2B build is converted **back** on open:
  rows 0.11.0 cannot parse (non-legacy or unknown kind, `NULL` value, any
  `detail`) move to the additive table with id/timestamps/read state intact;
  the legacy table is rebuilt to the 0.11.0 definition; `user_version`
  returns to 1. Nothing is dropped, including rows of unknown future kinds.

Strategies B–D were not needed: the additive layout is a strict superset the
old reader tolerates, so no sidecar file, dual representation, or backup/
restore machinery is required — and none of those would have protected a
user who had already installed 0.11.0 before running new code.

## Why the current reader keeps full Wave 2 semantics

Type, severity (derived from kind), nullable values, detail code, provider,
hashed account reference, read state and destination derivation are all read
back from the union; `current_round_trip_preserves_every_field_for_every_category`
proves equality after restart for all nine issued categories. No fake `0` or
`0%` is ever written to satisfy the old reader: rows without numeric evidence
simply never enter the legacy table.

## Migration behaviour

- **One immediate transaction** per open covers table creation, row move,
  legacy-table rebuild, `user_version` reset and component-version write.
- **Failure at any point** (before additive tables, after row move, after
  rebuild, before commit — `migration_is_atomic_at_every_interruption_point`)
  leaves the file byte-for-byte in its previous valid state (schema, rows,
  version); a later uninterrupted open completes normally.
- **Idempotent**: five consecutive opens produce identical row counts, unread
  counts, `sqlite_master` object counts, component version and baselines
  (`repeated_opens_are_idempotent`). No destructive step re-runs once the
  component version is recorded.
- **Preserved**: ids, all timestamps, values, read/unread state,
  `notification_baselines` (untouched by migration), hashed `account_ref`.

## Rollback drill (`rollback_drill_legacy_to_current_to_legacy_reader`)

1. Frozen 0.11.0 code writes the fixture (3 events, one read, 3 baselines).
2. Frozen reader verifies it.
3. Current build opens/migrates: same 3 events, `user_version` 1.
4. Current writes all 9 issued categories plus a new observation; marks one read.
5. Current restarts: 13 events, unique descending ids.
6. Frozen 0.11.0 reader reopens: sees the 3 originals **byte-for-byte equal**
   plus the new observation (4 rows), can insert its own observation and mark
   it read — i.e. rollback to stable is fully usable.
7. Current reopens: 14 events, including the row the old reader inserted, with
   its read state.
8. Baselines unchanged.

Result: **PASS** (temporary files only; Personal never touched).

## Privacy guarantees (unchanged from Wave 2B)

Structured fields only: bounded numbers (0..=100 or absent), a closed
per-kind detail code (free text such as `Bearer sk-…` is rejected), hashed
account reference, provider id, window key. No error text, paths, emails or
secrets are stored. History activation derives its destination from the
stored kind and a *registered* provider id through the same typed model as
toast activation; forged or case-mangled ids resolve to nothing.

## Unknown/future categories

A row whose kind this build does not recognise (in either table) is neither
shown, counted nor rewritten; its id is respected by later inserts. A file
with `user_version > 2` is refused without modification.

## Known limitations

- A history file must not be opened by the unpublished Wave 2B builds
  (`c98d339a`…`627c0e29`) after Wave 2C has touched it: those builds would
  re-migrate to v2. They were Dev-only and never released.
- 0.11.0 shows only observation rows after a rollback; issued-notification
  rows are invisible to it by design (they did not exist in 0.11.0).
- Retention (90 days / 5 000 rows) is applied per table.

## Release-gate invariant (added to release validation)

A new Quotalis release must not leave the immediately previous published
stable version unable to read its existing user history unless compatibility
is proven by the frozen-reader test above, or a fully proven non-destructive
rollback restoration exists. See `PRODUCT06_RELEASE_CANDIDATE.md`.
