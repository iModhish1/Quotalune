# Phase E — fixture isolation audit

Date: 2026-09-26. Source: `87b43c76`. Covers the "fixture isolation" item
the master goal's release security audit requires and that
`PHASE_E_SECURITY_AND_DEPENDENCY_AUDIT.md` listed as open.

## The question that matters

Quotalune carries a Dev-only QA fixture system and a Demo Mode, both of which
present synthetic data. The security question is whether synthetic data can
reach a real user's stored state — credentials, history, or the Personal
installation — or whether a shipped stable binary can be turned into a fixture
writer at all.

## 1. The channel is a compile-time constant, not a runtime switch

`rust/src/paths.rs` defines:

```rust
pub const fn is_dev_channel() -> bool {
    cfg!(feature = "dev-channel")
}
```

This is a Cargo **feature** resolved at compile time. A Personal build does not
merely default to stable: the Dev-gated code paths are not compiled into it at
all. There is no configuration file, environment variable, CLI flag, or IPC
call that can turn a shipped binary into a Dev channel at runtime.

That is a stronger guarantee than a runtime boolean check, because it removes
the question of "what could set the flag" entirely.

## 2. Fixture writes are refused before the store is touched

`apps/desktop-tauri/src-tauri/src/surfaces/qa_fixture.rs:77-83` checks the
channel first and returns an error **before** any write:

```rust
fn store_fixture(...) {
    if !dev_channel_active() {
        return Err("Structure QA fixture is Dev-channel only.".to_string());
    }
```

The corresponding test,
`store_fixture_refuses_and_writes_nothing_outside_the_dev_channel`
(`qa_fixture.rs:139`), asserts two separate things: the call returns the
expected error, **and** the target slot is still empty afterwards.

Asserting only "it returned an error" would be weak — a rejected call that had
already mutated state would still pass. Asserting that nothing was written is
the property that actually matters, and that is what the test checks.

## 3. The proof harness fails closed

`apps/desktop-tauri/src-tauri/src/proof_harness.rs:89` and `:116` both gate on
the same condition:

```rust
if !quotalis_core::paths::is_dev_channel() || !is_proof_mode(&app) { ... }
```

Both the channel and the proof mode must hold, so neither one alone is
sufficient to activate harness behaviour.

## 4. Verification

| Suite | Result |
| --- | --- |
| `qa_fixture` | 10 passed, 0 failed |
| `proof_harness` | 27 passed, 0 failed |

## Findings

**Fixture isolation holds.** Synthetic data cannot reach production state: the
Dev channel is a compile-time constant, fixture writes are refused before any
mutation and that refusal is tested for the absence of a write, and the proof
harness requires both the channel and an explicit proof mode.

## Limits of this audit

This covers the fixture and proof-harness gating in the Rust backend. It does
not cover:

- Demo Mode's own isolation guarantees, which are a separate product feature
  and are governed by their own tests;
- the frontend's handling of fixture-provided data;
- the installer-isolation audit, which is the remaining open item in this
  phase.