# Phase E — external URL / outbound request audit

Date: 2026-09-26. Source: `9b3b711f`. Covers the "external URL allowlist"
item the master goal's release security audit requires and that
`PHASE_E_SECURITY_AND_DEPENDENCY_AUDIT.md` listed as open.

## The question that matters

Quotalune talks to roughly 70 providers, so it necessarily contains many
outbound URLs. The number is not the risk. The risk is **whether
attacker-influenced input can choose or alter an outbound destination**, which
would turn a local desktop app into an SSRF proxy or a data-exfiltration path.

## 1. Provider endpoints are compile-time constants

Provider base URLs are declared as constants or closed enums, never as
free-form configuration:

- `fn base_url(self) -> &'static str` (e.g. `kimik2`, `minimax`)
- `fn api_base() -> Result<Url, ProviderError>` (e.g. `codebuff`)
- `pub fn base_url(self) -> &str` (e.g. `infini`)

There is no settings field, environment variable, or user input that supplies
a provider's host.

## 2. Selectable endpoints are closed enums, not URLs

Where a provider genuinely offers more than one plane, the choice is modelled
as an enum with a fixed mapping, not as a URL the user or config supplies.

`providers/zai/region.rs` is the clearest example:

```rust
pub enum ZaiRegion { Global, BigModelCn }

pub fn base_url(self) -> Url {
    Url::parse(match self {
        ZaiRegion::Global    => "https://api.z.ai",
        ZaiRegion::BigModelCn => "https://open.bigmodel.cn",
    })
    .expect("region base URL is a valid constant")
}
```

Selecting a region can only choose between two known upstream hosts. It cannot
carry an arbitrary destination, so there is no SSRF surface in this path.

## 3. Most URLs interpolate only a path onto a fixed host

A sweep for `format!` calls that build an `http(s)://` literal returns 14 hits.
Inspected individually, they fall into two groups.

**Path interpolation onto a constant host** — the host is fixed and only the
path varies, for example:

- `rust/src/providers/cursor/token_cost.rs:166` —
  `format!("https://cursor.com{EVENTS_PATH}")`
- `rust/src/providers/deepseek/mod.rs:241` —
  `format!("https://platform.deepseek.com{path}")`
- `rust/src/providers/bedrock/mod.rs:339` —
  `format!("https://monitoring.{region}.amazonaws.com")`, where `region` is an
  AWS region chosen from a closed set, not free text
- `rust/src/updater.rs:127` — `api.github.com/repos/{GITHUB_REPO}/releases`,
  where `GITHUB_REPO` is a project constant

The interpolated values are internal identifiers or enum-derived values, not
user-supplied hosts.

**Deliberate, validated endpoint overrides.** Two sites accept a
config-supplied host, and this is the part worth stating explicitly rather
than glossing:

- `rust/src/providers/zai/settings.rs:200-215` — `normalized_https_url`
  promotes a bare host to `https://` and then **rejects** any result that is
  not HTTPS, or that carries userinfo (`user:pass@`), returning `None`
  otherwise.
- `rust/src/providers/zai/settings.rs:190-192` —
  `validate_endpoint_region` additionally rejects an override whose host does
  not match the credential's declared region
  (`EndpointRegionMismatch`).
- `rust/src/providers/azureopenai.rs:361` carries a test named
  `rejects_insecure_or_tricky_endpoint_overrides`, which shows the validation
  is intentional and covered.

These overrides are read through `ZaiSettingsReader` from the process
environment, which is a deliberate self-hosted / enterprise-deployment
affordance. They are **not** reachable from arbitrary application input, and
they are constrained to HTTPS, no userinfo, and region-consistent hosts.

So the correct statement is not "no URL is built from input" but: **no URL is
built from unvalidated input**. Two providers accept a validated override, and
the validation is enforced and tested.

## 4. Endpoint count is expected, not a finding

The tree contains 178 distinct `https://` hosts after excluding licence,
schema and documentation URLs. For an aggregator that integrates dozens of
AI providers this is proportionate, and each is a first-party provider API
declared in source. There is no evidence of a host that is unrelated to a
supported provider.

## Findings

**No unvalidated SSRF or arbitrary-destination path was found.** Most outbound
destinations are compile-time constants or values selected from closed enums.
Two providers accept a configuration-supplied endpoint override, and both
enforce HTTPS-only, reject userinfo, and (for z.ai) require the host to match
the credential's declared region; the validation is covered by tests.

This conclusion is stated more narrowly than a first pass suggested. A naive
grep-based reading would have concluded "no URL is built from input", which is
false — 14 sites interpolate into URL literals and two accept a configured
host. The accurate claim is that none of them accepts **unvalidated** input.

## Limits of this audit

This covers URL construction and destination selection in the Rust backend. It
does not cover:

- response handling, redirects, or whether any client follows redirects to an
  unvalidated host;
- the frontend's own outbound requests, which were not enumerated here;
- TLS enforcement (certificate validation) or proxy configuration, which are
  governed by the shared `reqwest` client rather than per-provider code;
- the updater's download host allowlist, which is configured separately in
  `rust/src/updater.rs`.