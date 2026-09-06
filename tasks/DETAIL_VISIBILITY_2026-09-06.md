# Independent detail visibility

Implemented: session and weekly checkboxes per provider, all-limits preset retained for model/extra limits, and a persisted `none` selection. Turning both off does not remove the compact primary quota instrument or affect another provider. Live Flow/Notch/Reel detail renderers distinguish deliberately hidden details from missing provider limits.

Transport: existing `set_provider_detail_window`, per-provider incremental mutation, validation, persistence and broadcast. `all` still removes the explicit override; old saved choices remain valid. No credential or Personal settings changes.

Evidence: UI test drives all → weekly → none → session → both, verifies other provider unchanged and no usage-mode command. Resolver checks empty windows plus retained primary metric. Rust command test validates `none` and serde round-trip with other-provider preservation.

Native Dev PID 72412 launched in preceding packet includes reference materials but predates this detail-visibility packet. Do not claim current native checkbox proof. Native input automation remains unavailable; source/test progress is possible. Arabic translation, complete settings redesign and full native acceptance remain open.
