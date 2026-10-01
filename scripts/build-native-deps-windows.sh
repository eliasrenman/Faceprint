#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
tiler_root="${PDFTILECUT_DIR:-$project_root/../pdftilecut}"
jobs="${BUILD_JOBS:-$(nproc)}"
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
for command in cmake ninja make gcc g++ go; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing build command: $command" >&2
    exit 1
  fi
done

(
  cd "$tiler_root/c-deps/zlib"
  make -f win32/Makefile.gcc -j"$jobs" libz.a
)

(
  cd "$tiler_root/c-deps/libjpeg-turbo"
  cmake -S . -B build-faceprint -G Ninja \
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    -DCMAKE_BUILD_TYPE=Release \
    -DENABLE_SHARED=OFF \
    -DENABLE_STATIC=ON \
    -DWITH_SIMD=OFF
  cmake --build build-faceprint --parallel "$jobs"
  cp build-faceprint/libjpeg.a libjpeg.a
)

(
  cd "$tiler_root/c-deps/qpdf"
  # jpeglib.h includes the generated jconfig.h from libjpeg-turbo's build tree.
  export CFLAGS="-I../zlib -I../libjpeg-turbo -I../libjpeg-turbo/build-faceprint"
  export CXXFLAGS="$CFLAGS"
  export CPPFLAGS="$CFLAGS"
  export LDFLAGS="-L../zlib -L../libjpeg-turbo"
  ./configure --disable-shared
  make -j"$jobs"
)

for archive in \
  "$tiler_root/c-deps/zlib/libz.a" \
  "$tiler_root/c-deps/libjpeg-turbo/libjpeg.a" \
  "$tiler_root/c-deps/qpdf/libqpdf/build/.libs/libqpdf.a"; do
  [[ -f "$archive" ]] || { echo "Native build did not produce $archive" >&2; exit 1; }
done

echo "Built static pdftilecut dependencies for Windows amd64"
echo "pdftilecut revision: $actual_tiler_revision"
