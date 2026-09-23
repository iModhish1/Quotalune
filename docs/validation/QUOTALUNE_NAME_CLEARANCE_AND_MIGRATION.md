# Quotalune name screening and migration — preliminary

Date: 2026-09-23. This is an internal working record, not a trademark opinion or release approval.

## Why the name changes

`Quotalis` is already used by multiple public GitHub repositories, including
[`mbogdan0/claude-quotalis`](https://github.com/mbogdan0/claude-quotalis),
a Claude quota browser extension. This is a particularly close product category.
The owner requested a distinct name before the next publication.

## Provisional product name

**Quotalune** (quota + lune). It preserves the quota-monitoring meaning and the
product's cosmic visual direction while differing audibly and visually from
Quotalis. The official product mark and its geometry remain unchanged.

Preliminary exact-string checks on 2026-09-23: general web search returned no
exact-match result for `Quotalune`; GitHub repository-name search returned zero;
the npm package lookup returned 404. These checks are narrow and may miss
unindexed uses, similar marks, unpublished applications and other countries.
USPTO/WIPO/Saudi trademark database clearance and similarity analysis were **not**
completed. Do not claim that the name is globally unused or legally cleared.
The [USPTO trademark search](https://www.uspto.gov/trademarks/search) is a
starting point, not a substitute for counsel in intended release markets.

## Compatibility contract for the text rebrand

- Change visible UI, notifications, About, installer display name and future
  release presentation together, then verify every surface in Dev.
- Keep the existing Windows installer `AppId`, stable AUMID, user-data roots,
  database paths, update ancestry and existing public URLs until each migration
  is separately audited. Do not replace or migrate the owner's Personal install.
- Do not rename code identifiers, locale keys or historical documentation merely
  for appearance; old names can be valid compatibility/provenance references.
- A public repository rename, update-channel change or new release requires
  separate verified CI, package and link-redirect evidence. Existing `v0.11.0`
  remains an immutable historical Quotalis release.

The candidate is **provisional** until formal clearance and product-wide
rebrand validation are complete. No public release may assert legal uniqueness.
