#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
tiler_root="${PDFTILECUT_DIR:-$project_root/../pdftilecut}"
deployment_target="${MACOSX_DEPLOYMENT_TARGET:-13.0}"
jobs="${BUILD_JOBS:-$(sysctl -n hw.logicalcpu)}"
expected_tiler_revision="5f288f69661cbf13e5a4db859ca265b80498b8d0"

if [[ ! -f "$tiler_root/tiler.go" || ! -d "$tiler_root/c-deps/qpdf" ]]; then
  echo "Expected the owner pdftilecut checkout at: $tiler_root" >&2
  echo "Set PDFTILECUT_DIR to its checkout path." >&2
  exit 1
fi
actual_tiler_revision="$(git -C "$tiler_root" rev-parse HEAD)"
if [[ "$actual_tiler_revision" != "$expected_tiler_revision" ]]; then
  echo "pdftilecut is at $actual_tiler_revision; expected $expected_tiler_revision" >&2
  exit 1
fi
for command in cmake make clang go; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing build command: $command" >&2
    exit 1
  fi
done

common_flags="-O2 -UTARGET_OS_MAC -mmacosx-version-min=$deployment_target"

(
  cd "$tiler_root/c-deps/zlib"
  CFLAGS="$common_flags" ./configure --static
  make -j"$jobs" CFLAGS="$common_flags"
)

(
  cd "$tiler_root/c-deps/libjpeg-turbo"
  cmake -G 'Unix Makefiles' \
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    -DENABLE_SHARED=0 \
    -DCMAKE_OSX_DEPLOYMENT_TARGET="$deployment_target" \
    -DCMAKE_C_FLAGS="$common_flags"
  make -j"$jobs"
)

(
  cd "$tiler_root/c-deps/qpdf"
  export CFLAGS="-I../zlib -I../libjpeg-turbo -mmacosx-version-min=$deployment_target"
  export CXXFLAGS="$CFLAGS"
  export CPPFLAGS="$CFLAGS"
  export LDFLAGS="-L../zlib -L../libjpeg-turbo -mmacosx-version-min=$deployment_target"
  ./configure --disable-shared
  make -j"$jobs"
)

for archive in \
  "$tiler_root/c-deps/zlib/libz.a" \
  "$tiler_root/c-deps/libjpeg-turbo/libjpeg.a" \
  "$tiler_root/c-deps/qpdf/libqpdf/build/.libs/libqpdf.a"; do
  [[ -f "$archive" ]] || { echo "Native build did not produce $archive" >&2; exit 1; }
done

echo "Built static pdftilecut dependencies for macOS $deployment_target+"
echo "pdftilecut revision: $actual_tiler_revision"
