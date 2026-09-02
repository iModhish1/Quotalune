# Code signing policy

> **Status: UNSIGNED.** QuotaArc does not yet have a code-signing
> certificate. Release artifacts are built unsigned and published with
> SHA-256 checksums so users can verify integrity. SmartScreen may show a
> warning for unsigned installers — verify the SHA-256 published alongside
> each release. We do not fake signatures or claim signing we do not have.

## Architecture (ready, inactive)

The release workflow (`.github/workflows/release.yml`) contains a signing
step that activates when repository secrets are configured:

- `WINDOWS_PFX_BASE64` — base64 of the Authenticode PFX certificate
- `WINDOWS_PFX_PASSWORD` — PFX password

When present, artifacts are signed with `signtool /fd SHA256` plus an RFC
3161 timestamp (`http://timestamp.digicert.com`). Certificates are never
committed; signing happens only in CI from secrets.

## Options for obtaining a certificate

1. **OV certificate** (e.g. Sectigo/DigiCert via a reseller): cheapest path
   to removing the SmartScreen warning over time; requires organization
   validation.
2. **Azure Trusted Signing**: per-signing pricing, Microsoft-managed; good
   for open source, requires identity validation.
3. **SignPath Foundation**: free for open-source projects; requires onboarding
   and manual approval of each signing request. (The inherited upstream used
   this route; QuotaArc has NOT applied yet.)

## Release checklist items related to signing

- [ ] Certificates configured as CI secrets
- [ ] Signed artifacts verified with `Get-AuthenticodeSignature`
- [ ] SHA256SUMS.txt regenerated after signing
