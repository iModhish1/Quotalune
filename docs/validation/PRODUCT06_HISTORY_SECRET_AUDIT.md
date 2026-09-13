# Product 06 — first-publication history scan

2026-09-13 checkpoint, not a clean-history verdict. Authenticated GitHub actor
read-back is `iModhish1`, ID 66481531. Canonical `iModhish1/Quotalis` returned 404;
no repository, release or public upload was created by this checkpoint.

Gitleaks 8.30.1 Windows x64 was downloaded into an ignored local tools directory
from the official gitleaks/gitleaks release. SHA-256 matched the release API:
`d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`.
No global installation or project dependency change was made.

The default rules were used with a dedicated configuration, empty ignore file,
inline allow comments disabled, 100% redaction and `--all --full-history`.
Result: 5256 commits, 41.48 MB, 12.6 seconds, exit 1, 43 findings: 36 generic
API-key heuristics and 7 curl Authorization-header heuristics. These are findings
requiring classification, not 43 confirmed leaked credentials.

Initial source checks identify UI/local-storage key names, documentation/model
identifiers, public-key/client-ID constants and synthetic test-token cases.
The remaining test/account-reference cases still require explicit validation;
test-file placement alone is not an exemption. No broad allowlist or history
rewrite was applied. Complete per-finding disposition before declaring this gate
passed. Keep the redacted scan and raw source analysis local; never print tokens.

Local evidence:
- `.local/qa05/product06-gitleaks-history.log`
- `.local/qa05/product06-gitleaks-history-redacted.json`
- `.local/qa05/gitleaks-default-only.toml`

Current-tree scan separately passed (3095 files). It does not replace this
history gate. Remaining publication gates also include installer/upgrade proof,
the unfinished notification-center UI/subscriptions, and the product acceptance
items in MASTER_REQUIREMENTS.md. Only Windows x64 artifacts have been built.
