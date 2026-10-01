#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

export CGO_ENABLED=1
# pdftilecut's cgo flags predate Windows support and do not list QPDF's
# Advapi32 dependency. Keep the MinGW runtime libraries static; do not
# whole-archive this import library because Go repeats CGO_LDFLAGS for each
# cgo package.
export CGO_LDFLAGS="-static -ladvapi32 ${CGO_LDFLAGS:-}"
"$project_root/scripts/build-native-deps-windows.sh"

go run github.com/wailsapp/wails/v2/cmd/wails@v2.16.0 build \
  -platform windows/amd64 \
  -clean

binary="$project_root/build/bin/FacePrint.exe"
bundle="$project_root/build/bin/FacePrint-windows-amd64"
[[ -f "$binary" ]] || { echo "Wails did not produce $binary" >&2; exit 1; }

if objdump -p "$binary" | grep -Eiq 'DLL Name: (libgcc|libstdc\+\+|libwinpthread|libqpdf|zlib|libjpeg)'; then
  echo "Packaged binary unexpectedly depends on a developer runtime DLL:" >&2
  objdump -p "$binary" | grep -i 'DLL Name:' >&2
  exit 1
fi

rm -rf "$bundle"
mkdir -p "$bundle/licenses"
cp "$binary" "$bundle/"
cp "$project_root/LICENSE" "$bundle/"
cp -R "$project_root/resources/licenses/." "$bundle/licenses/"

echo "Packaged self-contained app directory: $bundle"
objdump -p "$binary" | grep -i 'DLL Name:' || true
