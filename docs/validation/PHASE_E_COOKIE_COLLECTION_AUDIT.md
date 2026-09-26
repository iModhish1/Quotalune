# Phase E — browser cookie collection audit

Date: 2026-09-26. Source: `1b042ce0`. Covers the "cookie-domain and collection
minimisation" item that the master goal's release security audit requires and
that `PHASE_E_SECURITY_AND_DEPENDENCY_AUDIT.md` listed as open.

## The question that matters

Not "does the app read cookies" — it does, by design, for providers that offer
only a browser session. The question is whether it can read *more* than it
needs. Concretely: can it enumerate a user's unrelated browsing session, and
does it touch the browser's own database destructively?

## 1. The query is domain-scoped in the database itself

`extract_chromium_cookies` (`browser/cookies.rs:209-213`) prepares:

```sql
SELECT name, encrypted_value, host_key, path, expires_utc, is_secure, is_httponly
FROM cookies
WHERE host_key LIKE ?1 OR host_key LIKE ?2
```

Two properties matter here:

- **The filter is in SQL.** Cookies for other domains are never loaded into
  process memory, so they cannot leak through logging, error paths, or a
  debugger.
- **Only named columns are selected.** The query never touches history,
  bookmarks, autofill, or any other browser store. There is no
  `SELECT *`.

## 2. Suffix-boundary matching, with a second validation pass

A `LIKE` filter is inherently loose, so the code does not rely on it alone.
Each returned row is re-checked at `cookies.rs:231`:

```rust
if !domain_matches(&host_key, domain) { continue; }
```

`domain_matches` (`cookies.rs:637-645`) requires an exact match, a leading-dot
form, or a **dotted** suffix. That last part is the security-relevant one, and
it is pinned by tests at `cookies.rs:749-754`:

| Case | Expected | Why it matters |
| --- | --- | --- |
| `chatgpt.com` vs `chatgpt.com` | match | the target itself |
| `.chatgpt.com` vs `chatgpt.com` | match | browser host-key form |
| `auth.chatgpt.com` vs `chatgpt.com` | match | legitimate subdomain |
| `AUTH.CHATGPT.COM.` vs `chatgpt.com` | match | case and trailing-dot normalisation |
| `evilchatgpt.com` vs `chatgpt.com` | **reject** | prefix confusion, no dot boundary |
| `chatgpt.com.evil.test` vs `chatgpt.com` | **reject** | suffix confusion |

A naive `ends_with` implementation would accept both rejected rows. This one
does not, and the tests exist specifically to prove it.

## 3. The browser's own database is not touched

`cookies.rs:193` copies the live `Cookies` database to a temp file before
opening it, and `cookies.rs:275` removes that temp file afterwards
(`let _cleanup = std::fs::remove_file(&temp_db);`). SQLite handles are
deliberately scoped to a block so Windows can delete the file
(`cookies.rs:206`).

Consequences: the browser's database is never locked, never modified, and never
opened in a mode that could alter it. Decryption uses DPAPI against the
user-level key (`cookies.rs:335`).

## 4. Encryption failure fails closed and says so

Chromium App-Bound Encryption (Chrome 127+) replaces the user-level cookie key
with a system-level key that third-party tools cannot read. The code does not
paper over this: ABE failures are counted separately
(`cookies.rs:238-243`), surfaced as a distinct `CookieError::AppBoundEncryption`
(`cookies.rs:658-659`), and logged with an explicit explanation
(`cookies.rs:285-291`).

It does not return partial or wrong data, and it does not silently report
"no cookies" for a cryptographic reason.

## Findings

**No over-collection was found.** The implementation reads only the named
cookie columns, only for the requested domain, with a dot-boundary check that
is tested against both prefix- and suffix-confusion, from a temporary copy that
is deleted afterwards, and it reports encryption failure rather than hiding it.

## Limits of this audit

This covers the Chromium cookie extraction path. It does not cover:

- non-Chromium browsers, if any other engine is supported;
- whether each provider's configured domain is the *minimum* set needed for
  that provider, which is a per-provider configuration question tracked
  separately in the capability matrix;
- what happens to cookie material after extraction, which is covered by
  `PROVIDER_CREDENTIAL_SECURITY_AUDIT.md`;
- the cookie-related UI text, which is a localisation and privacy-disclosure
  question rather than a collection one.