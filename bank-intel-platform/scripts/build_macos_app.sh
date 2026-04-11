#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x ".venv312/bin/pyinstaller" && ! -x ".venv/bin/pyinstaller" ]]; then
  echo "PyInstaller is not installed. Install desktop deps first:"
  echo "  pip install -e '.[desktop]'"
  exit 1
fi

PYINSTALLER=".venv312/bin/pyinstaller"
if [[ ! -x "$PYINSTALLER" ]]; then
  PYINSTALLER=".venv/bin/pyinstaller"
fi

rm -rf build dist

"$PYINSTALLER" \
  --name "BankIntelCLI" \
  --onefile \
  --console \
  --add-data "app/static:app/static" \
  --add-data "app/config:app/config" \
  --collect-submodules app \
  app/cli.py

APP_ROOT="dist/BankIntel.app/Contents"
mkdir -p "$APP_ROOT/MacOS" "$APP_ROOT/Resources"

cat > "$APP_ROOT/MacOS/BankIntel" <<'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/BankIntelCLI" desktop
EOF
chmod +x "$APP_ROOT/MacOS/BankIntel"

cp "dist/BankIntelCLI" "$APP_ROOT/MacOS/BankIntelCLI"

cat > "$APP_ROOT/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>BankIntel</string>
  <key>CFBundleIdentifier</key>
  <string>com.bankintel.desktop</string>
  <key>CFBundleName</key>
  <string>BankIntel</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
</dict>
</plist>
EOF

echo "Built:"
echo "  dist/BankIntelCLI"
echo "  dist/BankIntel.app"
