# Dev build freshness — failure-mode proof

Phase 3J, section 4: prove `scripts/build-dev-verified.mjs` catches or
eliminates the exact stale-`QuotalisDev.exe` scenario Phase 3I found.
Real fixture, no code changes.

## Setup

1. Built a verified `QuotalisDev.exe` at commit `8be5d713` (the dev
   build freshness commit itself) and saved a byte-identical copy aside
   as `.local/proof/claude-audit/phase3j/stale-fixture-8be5d713.exe`.
2. Committed real Token Analytics work, moving HEAD to `d7757468`
   (two commits later) -- without rebuilding.
3. Overwrote `target/debug/QuotalisDev.exe` with the saved
   `8be5d713`-era fixture, simulating "forgot to rebuild/re-copy after
   the next commit."

## Proof 1 — the old workflow's blind spot

```
$ node scripts/dev-preflight.mjs target/debug/QuotalisDev.exe
[dev-preflight] PASS: target/debug/QuotalisDev.exe
  channel=dev  exe=QuotalisDev.exe  app_dir_name=QuotaArc-Dev

$ target/debug/QuotalisDev.exe --print-build-info
channel=dev
git_head=8be5d7132367
git_dirty=false
version=0.11.0
exe=QuotalisDev.exe

$ git rev-parse --short=12 HEAD
d7757468f074
```

`dev-preflight.mjs` alone reports PASS on a binary that is two commits
stale (embeds `8be5d713`, worktree is at `d7757468`) -- it was designed
to prove channel isolation, never build freshness, and it does exactly
that: correctly, but insufficiently on its own. This is precisely the
Phase 3I incident shape: a stale-but-channel-valid binary passing the
only gate that existed at the time.

## Proof 2 — the new workflow self-heals, never leaves the stale binary in place

```
$ node scripts/build-dev-verified.mjs
...
[build-dev-verified] FRESHNESS PROOF
  git HEAD (worktree):     d7757468f074
  git HEAD (embedded):     d7757468f074
  source sha256:           4300c84e...
  QuotalisDev.exe sha256:  4300c84e...
  channel:                 dev
  app_dir_name:            QuotaArc-Dev

[build-dev-verified] PASS -- ... a verified, fresh, Dev-isolated build of d7757468f074.
```

One invocation rebuilt, overwrote the stale file, and its own
freshness cross-check (`git_head` embedded vs. `git rev-parse HEAD`)
would have failed loudly had they disagreed. There is no code path in
`build-dev-verified.mjs` that copies without immediately re-verifying
in the same run -- "forgetting to re-copy" is not a state this script
can be left in.

## Conclusion

The primary failure mode (a separate, skippable manual copy step) is
closed by construction: the copy is now inseparable from the build
inside one script. The `git_head` cross-check is a secondary, narrower
safety net that catches stale-COMMIT staleness specifically; per
`build-dev-verified.mjs`'s own header comment, it cannot detect a
rebuild from a dirty (uncommitted) tree producing different output at
the same HEAD. Topic closed per Phase 3J section 4.
