# QuotaArc 0.10.0 local release manifest

Built on 2026-09-06 from source commit `28f412ac` on `feature/v9-theme-runtime`.
This is a local Personal candidate. It has not been tagged, pushed, signed or published.

## Quality gates

- Frontend: 119 files, 652 tests passed.
- Rust core: 1,470 tests passed.
- Desktop shell: 427 tests passed.
- `cargo clippy --workspace --all-targets -- -D warnings`: passed.
- `cargo fmt --all -- --check`: passed.
- Locale parity: 953 Rust/TypeScript keys matched.
- TypeScript and Vite production build: passed; 725 modules transformed.
- `git diff --check`: passed before the release commit.
- Secret-pattern review found identifiers and explicit test placeholders only; no private-key block or committed live credential was identified.

## Artifacts

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `target/release/bundle/nsis/QuotaArc_0.10.0_x64-setup.exe` | 8,459,079 | `112739E3A51EA0CD22FDE7DA4A43FE38B184AC1CB3B2511EAB252DD907C4CF00` |
| `.local/release/QuotaArc_0.10.0_x64-portable.zip` | 11,959,406 | `C39B44DE4843C39A3429F60F39DD3B94FEF0285A536EAA1D18DAC7C8CDE77A57` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_en-US.msi` | 11,808,768 | `D666B3F994577B901AC2927F58FE7401411257212E4065FD953AC1C8780B3776` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_es-ES.msi` | 11,808,768 | `C76336C92DB8DAB1B82DC9F36DE2842574DC7FEF085CB4366BDBE2B64621CB06` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_ja-JP.msi` | 11,808,768 | `FA2BC96AFCA04431FB5403FB1CFBD2D3A96A4FC937AE7A4F8F12B1B4F1F27CC2` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_ko-KR.msi` | 11,808,768 | `AD06017F8E3BFF21EDB88CD3C63E7D1E56BBF2C65E4538EDCFA4B1D1A1C1C73E` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_ru-RU.msi` | 11,808,768 | `00416A4CFF8A5D93E8D5CE37CC6900380D6732261B7DDD9175AAC5830D203868` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_tr-TR.msi` | 11,808,768 | `D3652F913E41C4C97AF2DF912975560558759D0011A9D9F4F7FB97815A3F37F1` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_zh-CN.msi` | 11,804,672 | `6DCD5E079D71F0AF0632F46315B12705CE2A8A696DB9A0EB56235BB769ED8D1F` |
| `target/release/bundle/msi/QuotaArc_0.10.0_x64_zh-TW.msi` | 11,804,672 | `9C34FB6F816A33B640D318E5C50E78ADAA4385E5A5D154DC4D695D18346599AD` |

## Forensic handoff archive

- Path: `.local/release/QuotaArc_0.10.0_forensic-handoff.zip`
- Entries: 36 (README, state JSON, five reports, requirement/plan/backlog, recovery text/diffs, six proof manifests, NSIS, portable and eight MSI packages).
- Bytes: 113,009,023.
- SHA-256: `A24D89E6AAD483FFA5C5DA5D39EFCB9B7238735BCE3C6174E49B243C0A644809`.
- ZIP inventory verification: passed; README/state/reports/NSIS/portable/all eight MSI entries present.

## Personal promotion

- Complete rollback copy: `.local/recovery/personal-backup-complete-20260906-232817/` (4,051 files; 176,790,104 bytes).
- NSIS silent install exit code: 0.
- Installed executable: `%LOCALAPPDATA%\QuotaArc\QuotaArc.exe`.
- Installed file version: 0.10.0, x64, 32,367,104 bytes.
- Installed SHA-256: `DCE2C1A426B8347EBBCFCF09217B83771D4B58E4ABE27A5E50024485483DD9F2`.
- Post-install launch: succeeded as PID 34440.

The installed executable hash differs from the intermediate release executable because Tauri patches bundle-type metadata while producing NSIS/MSI. Version, size, installer result and successful launch were checked independently.

## Remaining acceptance limits

See `docs/CODEX_UNFINISHED_WORK.md`. In particular, full physical DPI, OS-input, multi-monitor and native Collections acceptance remain open. Therefore this candidate is suitable for continued Personal validation, not a public release claim.
