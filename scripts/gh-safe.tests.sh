#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d)"
trap '[[ "$(dirname "$(realpath "$test_root")")" == "$(realpath /tmp)" ]] && rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin"
log="$test_root/gh.log"

cat > "$test_root/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%q ' "$@" >> "${GH_SAFE_TEST_LOG:?}"
printf '\n' >> "${GH_SAFE_TEST_LOG:?}"
if [[ "${FAKE_GH_MODE:-ok}" == cross && "${2:-}" != user ]]; then
  printf '%s\n' 'steipete/CodexBar|https://github.com/steipete/CodexBar'
  exit 0
fi
if [[ "${1:-}" == api && "${2:-}" == user ]]; then
  printf '%s\n' "${FAKE_GH_USER:-iModhish1}"
elif [[ "${1:-}" == repo && "${2:-}" == view ]]; then
  printf '%s\n' 'iModhish1/Quotalis|https://github.com/iModhish1/Quotalis'
elif [[ "${1:-}" == pr && "${2:-}" == view ]]; then
  printf '%s\n' 'https://github.com/iModhish1/Quotalis/pull/361'
elif [[ "${1:-}" == issue && "${2:-}" == view ]]; then
  printf '%s\n' 'https://github.com/iModhish1/Quotalis/issues/123'
elif [[ "${1:-}" == release && "${2:-}" == view ]]; then
  printf '%s\n' "${FAKE_RELEASE:-v1.2.3|https://github.com/iModhish1/Quotalis/releases/tag/v1.2.3|false}"
elif [[ "${1:-}" == api ]]; then
  printf '%s\n' 'https://github.com/iModhish1/Quotalis/releases/tag/v1.2.3'
fi
EOF
chmod +x "$test_root/bin/gh"
export PATH="$test_root/bin:$PATH"
export GH_SAFE_TEST_LOG="$log"
export GH_SAFE_TEST_MOCK="$test_root/bin/gh"
gh() { "$BASH" "$GH_SAFE_TEST_MOCK" "$@"; }
export -f gh

expect_fail() {
  if "$@" >/dev/null 2>&1; then
    echo "Expected failure: $*" >&2
    exit 1
  fi
}

bash -n "$repo_root/scripts/gh-safe.sh"

bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --what-if -- \
  pr create --title test --body test >/dev/null

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo steipete/CodexBar --verify-kind repo --what-if -- \
  pr create --title test --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo other/repo --verify-kind repo --what-if -- \
  pr create --title test --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind pr --target 361 --what-if -- \
  pr comment 362 --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind pr --target 361 --what-if -- \
  pr comment 999 --comment 361

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind pr --target 361 --what-if -- \
  pr close

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind pr --target 361 --what-if -- \
  pr comment 361 --repo steipete/CodexBar --body test

FAKE_GH_MODE=cross expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --what-if -- \
  pr create --title test --body test

FAKE_GH_USER=someone-else expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --what-if -- \
  pr create --title test --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo nesszer/Win-CodexBar --verify-kind repo --what-if -- \
  pr create --title test --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --what-if -- \
  pr comment https://github.com/nesszer/Win-CodexBar/pull/361 --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --what-if -- \
  pr create -Rnesszer/Win-CodexBar --title test --body test

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --what-if -- \
  release upload v1.2.3 app.zip

expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind repo --target v1.2.3 --what-if -- \
  release create v1.2.4 --title test

: > "$log"
bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind pr --target 361 -- \
  pr comment 361 --body test >/dev/null

grep -Fq 'pr comment 361 --body test --repo iModhish1/Quotalis' "$log" || {
  echo 'Safe wrapper did not bind the canonical repo on mutation.' >&2
  cat "$log" >&2
  exit 1
}
: > "$log"
bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind issue --target 123 --what-if -- \
  issue close 123 >/dev/null

: > "$log"
bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind release --target v1.2.3 --what-if -- \
  release upload v1.2.3 dist/app.zip >/dev/null

echo 'GitHub write-safety shell tests passed.'

FAKE_RELEASE='v1.2.3|https://github.com/iModhish1/Quotalis/releases/tag/untagged-test|true' bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind release --target v1.2.3 --what-if -- release edit v1.2.3 --draft=false >/dev/null
FAKE_RELEASE='v9.9.9|https://github.com/iModhish1/Quotalis/releases/tag/untagged-test|true' expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind release --target v1.2.3 --what-if -- release edit v1.2.3 --draft=false
FAKE_RELEASE='v1.2.3|https://github.com/other/repo/releases/tag/untagged-test|true' expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind release --target v1.2.3 --what-if -- release edit v1.2.3 --draft=false
FAKE_RELEASE='v1.2.3|https://github.com/iModhish1/Quotalis/releases/tag/untagged-test|false' expect_fail bash "$repo_root/scripts/gh-safe.sh" \
  --repo iModhish1/Quotalis --verify-kind release --target v1.2.3 --what-if -- release edit v1.2.3 --draft=false
echo 'Draft release tag and owner verification tests passed.'
