# Public release readiness

Status tracker for the future publication of QuotaArc to public GitHub.
**Nothing is published in this wave** — this file is the checklist.

## READY

- Source tree: builds, full test gates green, clippy/rustfmt clean.
- Licensing: MIT with upstream copyright chain (LICENSE, NOTICE,
  THIRD_PARTY_NOTICES.md, docs/UPSTREAM_PROVENANCE.md).
- Documentation set complete and machine-neutral.
- Secret-scan gate in CI-able form (`scripts/scan-secrets.mjs`).
- Installer/portable/MSI packaging reproducible from a clean checkout.
- No personal assets, profiles, provider data, or machine paths in the tree.

## NOT READY ( blockers before publish )

- Full git-history secret scan with gitleaks (the local gate covers the
  working tree; history needs one pass before going public).
- README hero media must be re-captured with demo data or Privacy Mode.
- Upstream sync review: decide/record which upstream commits are included.

## REQUIRES OWNER ACTION

- Create the public GitHub repository and push (never done automatically by
  the project).
- Obtain a code-signing certificate or SignPath Foundation onboarding.
- Decide the initial public version tag and publish the first release.
