# Notification center acceptance slice — internal

Date: 2026-09-14. Base: 1a69d362; subsequent current-tree changes.

Implemented Settings-only journal IPC, a native notification workspace, unread
badge (+99 above 99), search/provider/unread filters, bounded pagination,
per-item/mark-all read actions and separate observed/detected/received times.
Demo history and read flags remain local React data and never call real journal IPC.

Validation: full frontend 1203/202 before review; Rust desktop 504 passed + 1
existing Personal-only ignored, core 1774 passed, CLI1, doc tests0. Workspace
Clippy -D warnings, formatting, locale parity1694 and Dev build passed.
Added deferred mutation/filter regression: failed before latest-callback fix,
passed afterward; focused hook+component13 tests passed. Fullwidth layout focused
four-file20 tests passed. Logs .local/qa05/p06-center-* and p06-history-filter-*.

Native original fullwidth candidate SHA256
317253fa20d41def159ce1f91a19d1bddca4c129ca504c4b85ed428f1fd17dfd.
PrintWindow images actually viewed under Desktop-Visual-QA/screenshots:
window-9176830-b41265d2fb0945b2a3ee1ce2fe12af3b.png (fullwidth center, Demo3)
window-9176830-f8d676f281f84663985ef1a85cf150e4.png (Demo dashboard).
Earlier real Demo mark-all test changed items to Read and hid unread badge;
no real journal read state changed. Demo exited in cleanup, owned process stopped.
Physical input and Personal app were not used. The final callback/wording repair
postdates these pixels and requires the final build provenance to remain distinct.

Independent reviewer found and mother fixed stale-filter mutation completion;
retention wording now correctly says 90-day/5000 pruning occurs on observations.
Only four reset/quota-change event kinds are currently journaled. Other alert
producers, granular subscriptions and full offline/runtime matrix remain open.
No claim of all original product objectives passing or installer execution.
Public README/release copy excludes this report and other internal QA material.
