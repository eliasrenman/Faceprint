#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-13.0}"
export CGO_CFLAGS="-mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET ${CGO_CFLAGS:-}"
export CGO_CXXFLAGS="-mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET ${CGO_CXXFLAGS:-}"
export CGO_LDFLAGS="-mmacosx-version-min=$MACOSX_DEPLOYMENT_TARGET ${CGO_LDFLAGS:-}"
"$project_root/scripts/build-native-deps.sh"

go run github.com/wailsapp/wails/v2/cmd/wails@v2.16.0 build -platform darwin/arm64 -clean

app="$project_root/build/bin/FacePrint.app"
binary="$app/Contents/MacOS/FacePrint"
mkdir -p "$app/Contents/Resources/licenses" "$app/Contents/Resources/docs"
cp "$project_root/LICENSE" "$app/Contents/Resources/LICENSE"
cp -R "$project_root/resources/licenses/." "$app/Contents/Resources/licenses/"
cp "$project_root/docs/dependency-versions.md" "$app/Contents/Resources/docs/"
cp "$project_root/docs/kernel-replacement.md" "$app/Contents/Resources/docs/"
cp "$project_root/docs/printing.md" "$app/Contents/Resources/docs/"

if otool -L "$binary" | grep -Eq '/opt/homebrew|libqpdf|libjpeg'; then
  echo "Packaged binary unexpectedly depends on developer QPDF/jpeg libraries:" >&2
  otool -L "$binary" >&2
  exit 1
fi

codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"

echo "Packaged self-contained app: $app"
echo "Size: $(du -sh "$app" | awk '{print $1}')"
otool -L "$binary"
"$project_root/scripts/test-packaged-macos.sh"
