#!/bin/bash
# Builds "CTRL ROOM.app" and CTRL-ROOM.dmg. Runs on macOS (GitHub Actions does this automatically).
set -euo pipefail
cd "$(dirname "$0")"
VERSION="${VERSION:-1.0}"
BUILD="${BUILD:-1}"
OUT=build
APP="$OUT/CTRL ROOM.app"
rm -rf "$OUT" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "› Compiling (Apple silicon + Intel)"
swiftc -O -target arm64-apple-macos12 -o "$OUT/CTRLROOM-arm64" Sources/main.swift -framework Cocoa -framework WebKit
swiftc -O -target x86_64-apple-macos12 -o "$OUT/CTRLROOM-x86_64" Sources/main.swift -framework Cocoa -framework WebKit
lipo -create -output "$APP/Contents/MacOS/CTRLROOM" "$OUT/CTRLROOM-arm64" "$OUT/CTRLROOM-x86_64"

echo "› Bundle"
cp Info.plist "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD" "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"

echo "› Icon"
ICONSET="$OUT/AppIcon.iconset"; mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s AppIcon.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) AppIcon.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

echo "› Sign"
if [ -n "${MAC_SIGN_IDENTITY:-}" ]; then
  codesign --force --deep --options runtime --timestamp --sign "$MAC_SIGN_IDENTITY" "$APP"
else
  codesign --force --deep --sign - "$APP"   # ad-hoc: runs fine, macOS asks once before first open
fi
codesign --verify --deep --strict "$APP"

echo "› Disk image"
STAGE="$OUT/dmg"; mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "CTRL ROOM" -srcfolder "$STAGE" -ov -format UDZO "$OUT/CTRL-ROOM.dmg" >/dev/null
echo "✓ $OUT/CTRL-ROOM.dmg"
