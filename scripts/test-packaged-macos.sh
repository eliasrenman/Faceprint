#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
app_binary="$project_root/build/bin/FacePrint.app/Contents/MacOS/FacePrint"
kernel_override="${FACEPRINT_TEST_KERNEL_OVERRIDE:-$project_root/frontend/node_modules/occt-wasm/dist/occt-wasm.wasm}"

[[ -x "$app_binary" ]] || { echo "Build the app with scripts/package-macos.sh first." >&2; exit 1; }
[[ -f "$kernel_override" ]] || { echo "Missing kernel override fixture: $kernel_override" >&2; exit 1; }

selftest_dir="$(mktemp -d)"
result_path="$selftest_dir/result.json"
app_pid=""
cleanup() {
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then kill "$app_pid"; fi
  rm -rf "$selftest_dir"
}
trap cleanup EXIT

FACEPRINT_INTEGRATION_SELFTEST=1 \
FACEPRINT_SELFTEST_RESULT="$result_path" \
FACEPRINT_TEST_KERNEL_OVERRIDE="$kernel_override" \
  "$app_binary" >"$selftest_dir/stdout.log" 2>"$selftest_dir/stderr.log" &
app_pid=$!

for _ in $(seq 1 90); do
  if [[ -s "$result_path" ]] && grep -q '"finished": true' "$result_path"; then break; fi
  if ! kill -0 "$app_pid" 2>/dev/null; then break; fi
  sleep 1
done

if [[ ! -s "$result_path" ]]; then
  echo "Packaged self-test produced no result." >&2
  sed -n '1,200p' "$selftest_dir/stderr.log" >&2
  exit 1
fi
cat "$result_path"
grep -q '"finished": true' "$result_path"
grep -q '"passed": true' "$result_path"
grep -q '"kernelOverrideUsed": true' "$result_path"
