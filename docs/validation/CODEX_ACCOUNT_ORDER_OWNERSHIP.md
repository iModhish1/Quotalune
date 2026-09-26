# Codex account order ownership

Current source checkpoint: the release integration branch after the Wave 3
multi-account Structure projection. This note is about order ownership, not
native multi-account acceptance.

- The persisted Codex `AccountStore` sequence owns account order in floating
  Structures. The backend returns Codex lanes in that sequence. It can place
  the ordinary ambient lane according to the store only when exactly one
  persisted ambient identity is known; the cached ordinary quota remains
  unattributed because it may predate an account switch.
- `providerInstancePresentation.order` owns the Dashboard carousel. Existing
  saved orders, including account instance IDs, stay intact. It no longer
  reorders floating Structures. This is the migration rule for settings saved
  before the two surfaces were separated; no persisted values are rewritten.
- Moving an account in Providers changes the store sequence and therefore the
  Structure lane order. Moving a card in Dashboard changes only the carousel
  preference. Both paths continue to use the same provider/account identity
  keys and actual snapshot data.

The backend regression covers a managed account moved before the uniquely
known ambient account without assigning the cached ambient quota to it. The
frontend regression checks a legacy Dashboard order with account IDs, then
reorders the backend account sequence and verifies that only the Structure
order changes. Structure tests cover 1, 2, 3, 6 and 12 configured Codex
accounts mixed with another provider, and a separate 70-provider scene model.

Still required: restart readback of the saved account order, real native
Dashboard/Structure captures with two accounts and an unavailable account,
and carousel/compact-surface navigation at larger counts. Ambiguous ambient
identity remains unattributed; no account-wide quota is inferred from it.
