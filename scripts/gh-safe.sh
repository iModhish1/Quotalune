#!/usr/bin/env bash
set -euo pipefail

repo=""
verify_kind=""
target=""
what_if=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/gh-safe.sh --repo owner/repo --verify-kind repo|pr|issue|release [--target id-or-tag] [--what-if] -- <gh args...>

Examples:
  bash scripts/gh-safe.sh --repo iModhish1/Quotalis --verify-kind pr --target 361 --what-if -- pr comment 361 --body-file .review/comment.md
  bash scripts/gh-safe.sh --repo iModhish1/Quotalis --verify-kind repo --what-if -- pr create --title "..." --body-file body.md
EOF
}

while (($#)); do
  case "$1" in
    --repo) repo="${2:-}"; shift 2 ;;
    --verify-kind) verify_kind="${2:-}"; shift 2 ;;
    --target) target="${2:-}"; shift 2 ;;
    --what-if) what_if=1; shift ;;
    --) shift; break ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown wrapper argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

gh_args=("$@")

[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "Invalid --repo '$repo'; expected owner/repo." >&2; exit 2; }
case "$verify_kind" in repo|pr|issue|release) ;; *) echo "Invalid --verify-kind '$verify_kind'." >&2; exit 2 ;; esac
((${#gh_args[@]} > 0)) || { echo 'No gh command supplied after --.' >&2; exit 2; }

# The owner explicitly confirmed iModhish1. Never fall back to the upstream fork.
if [[ "${repo,,}" != "imodhish1/quotalis" ]]; then
  echo "GitHub writes are not allowlisted for '$repo'. Expected iModhish1/Quotalis." >&2
  exit 3
fi
actor="$(gh api user --jq .login)"
[[ "${actor,,}" == "imodhish1" ]] || { echo 'Authenticated GitHub account is not the confirmed Quotalis owner.' >&2; exit 3; }

for arg in "${gh_args[@]}"; do
  case "$arg" in --repo|--repo=*|-R*) echo 'Forwarded gh args may not override the repository.' >&2; exit 3 ;; esac
done

if [[ "$verify_kind" == repo ]]; then
  case "${gh_args[0]:-}:${gh_args[1]:-}" in
    pr:create|issue:create) ;;
    release:create)
      [[ -n "$target" && "${gh_args[2]:-}" == "$target" ]] || { echo 'Release creation requires an exact --target tag.' >&2; exit 3; }
      ;;
    *) echo 'Repository verification permits only PR/issue/release creation. Existing objects require exact object verification.' >&2; exit 3 ;;
  esac
else
  [[ -n "$target" ]] || { echo "--target is required for verify kind '$verify_kind'." >&2; exit 2; }
  case "$verify_kind" in
    pr|issue) [[ "$target" =~ ^[1-9][0-9]*$ ]] || { echo 'PR/issue target must be a positive number.' >&2; exit 3; } ;;
    release) [[ "$target" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { echo 'Release target must be a plain tag.' >&2; exit 3; } ;;
  esac
  [[ "${gh_args[0]}" == "$verify_kind" ]] || { echo "Forwarded command must target '$verify_kind'." >&2; exit 3; }
  ((${#gh_args[@]} >= 3)) || { echo "Forwarded command must carry its object as the third token (gh <object> <verb> <number>)." >&2; exit 3; }
  [[ "${gh_args[2]}" == "$target" ]] || { echo "Forwarded command object '${gh_args[2]:-}' is not the verified target '$target'." >&2; exit 3; }
fi

case "$verify_kind" in
  repo)
    readback="$(gh repo view "$repo" --json url,nameWithOwner --jq '.nameWithOwner + "|" + .url')"
    readback_repo="${readback%%|*}"
    verified_url="${readback#*|}/"
    [[ "${readback_repo,,}" == "${repo,,}" ]] || { echo "Repository read-back mismatch: '$readback_repo' != '$repo'." >&2; exit 4; }
    ;;
  pr) verified_url="$(gh pr view "$target" --repo "$repo" --json url --jq .url)" ;;
  issue) verified_url="$(gh issue view "$target" --repo "$repo" --json url --jq .url)" ;;
  release) verified_url="$(gh api "repos/$repo/releases/tags/$target" --jq .html_url)" ;;
esac

expected_prefix="https://github.com/$repo/"
shopt -s nocasematch
[[ "$verified_url" == "$expected_prefix"* ]] || { echo "GitHub target mismatch: '$verified_url' is not under '$expected_prefix'." >&2; exit 4; }
case "$verify_kind" in
  pr) [[ "$verified_url" == *"/pull/$target" ]] || { echo "GitHub target mismatch: '$verified_url' does not end with '/pull/$target'." >&2; exit 4; } ;;
  issue) [[ "$verified_url" == *"/issues/$target" ]] || { echo "GitHub target mismatch: '$verified_url' does not end with '/issues/$target'." >&2; exit 4; } ;;
  release) [[ "$verified_url" == *"/releases/tag/$target" ]] || { echo "GitHub target mismatch: '$verified_url' does not end with '/releases/tag/$target'." >&2; exit 4; } ;;
esac
shopt -u nocasematch

echo "Verified GitHub write target: $verified_url"
if ((what_if == 1)); then
  printf 'WhatIf: gh'
  printf ' %q' "${gh_args[@]}"
  printf ' --repo %q\n' "$repo"
  exit 0
fi

gh "${gh_args[@]}" --repo "$repo"
