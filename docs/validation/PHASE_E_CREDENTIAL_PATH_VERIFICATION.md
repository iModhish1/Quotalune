# Phase E — credential path verification

Date: 2026-09-26. Source: `0ac7958a`. This does **not** re-audit credentials
from scratch. `PROVIDER_CREDENTIAL_SECURITY_AUDIT.md` already documents the
credential model; this record verifies its load-bearing claims against the
*current* source, per the master goal's rule that current code wins over
documentation.

## Verified claims

### 1. Stored credentials are protected with DPAPI

`rust/src/secure_file.rs` wraps every credential payload through
`CryptProtectData` (`secure_file.rs:163-188`) and unwraps with the matching
`CryptUnprotectData`. The encrypted form is written with a wrapper so it is
distinguishable from a legacy plaintext file, and
`secure_file.rs:369` carries a test asserting the protected file **must not
contain plaintext JSON**.

### 2. Credential types persist only through that layer

Every read and write for the three credential-bearing types goes through
`secure_file`. None of them contains a raw filesystem write:

| Type | Read | Write |
| --- | --- | --- |
| `ApiKeys` | `settings/api_keys.rs:30` | `settings/api_keys.rs:47` |
| `ManualCookies` | `settings/manual_cookies.rs:27` | `settings/manual_cookies.rs:44` |
| `TokenAccountStore` | `core/token_accounts.rs:670` | `core/token_accounts.rs:703` |

A sweep of those three files finds no `fs::write`, `File::create`, or other
unprotected persistence path.

### 3. Settings never carries secret material

The Settings model exposes no API-key, cookie, token or secret field. Credential
material has no serialisation route into `settings.json`, so it cannot leak
there by accident.

### 4. The legacy-plaintext tolerance does not reach credentials — **newly
clarified here**

`secure_file` deliberately still reads a legacy unwrapped plaintext file so
pre-existing data keeps working. This is the one place where a weaker statement
would have been easy to make, so it is worth being exact about *which* files
that applies to.

The plaintext-tolerant call site is `codex_accounts/stores.rs:145-151`, in
`AccountUsageSnapshot::load`. That type holds **quota usage snapshots** — limit
readings, percentages and reset times — not credentials. The in-code comment
says as much: "existing snapshot caches remain readable and are upgraded on the
next save."

The three credential types above do not go through that path; they are written
only through the protecting layer. So a plaintext file that `secure_file` will
happily read is a usage cache, and credential files written by Quotalune are
encrypted.

## Findings

**The credential path claims in the existing audit hold against current source.**
Storage is DPAPI-protected, credential types have no unprotected write path,
Settings cannot carry secrets, and the one legacy-plaintext tolerance is scoped
to non-sensitive usage caches.

## Limits of this verification

This confirms the storage and typing properties. It does not re-open the
behavioural claims in `PROVIDER_CREDENTIAL_SECURITY_AUDIT.md` — single-flight
ownership, cancellation, atomic saves, fixture isolation and redaction — which
remain governed by that document and its regression tests. It also certifies
Windows only: the non-Windows `secure_file` path is a different implementation
and is not covered here.