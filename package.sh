#!/usr/bin/env bash
# ==============================================================================
# Simple AI Usage Indicator - GNOME Shell Extension Packaging Script
# Compliant with GNOME Extensions (EGO) guidelines and EGO-P-006 rule:
# "Compiled GSettings schemas should not be shipped for 45+ packages"
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== [1/5] Cleaning unnecessary build artifacts (EGO-P-006 compliance) ==="
# Strictly remove any compiled gschemas binary to comply with EGO review rule EGO-P-006
if [ -f "schemas/gschemas.compiled" ]; then
    echo "Removing schemas/gschemas.compiled..."
    rm -f "schemas/gschemas.compiled"
fi
rm -f ./*.shell-extension.zip

echo "=== [2/5] Compiling Gettext translation catalogs ==="
if command -v msgfmt >/dev/null 2>&1; then
    mkdir -p locale/pt/LC_MESSAGES locale/pt_BR/LC_MESSAGES
    msgfmt -c -o locale/pt/LC_MESSAGES/simple-ai-usage-indicator.mo po/pt.po
    msgfmt -c -o locale/pt_BR/LC_MESSAGES/simple-ai-usage-indicator.mo po/pt_BR.po
    echo "Translations compiled successfully."
else
    echo "Warning: msgfmt not found, using existing .mo files."
fi

echo "=== [3/5] Running automated test suite ==="
for test_file in tests/*.test.js; do
    echo "  Running $test_file..."
    gjs -m "$test_file"
done
echo "All tests passed."

echo "=== [4/5] Packing GNOME Shell Extension bundle ==="
UUID=$(grep -o '"uuid": *"[^"]*"' metadata.json | head -1 | cut -d'"' -f4)
ZIP_NAME="${UUID}.shell-extension.zip"

gnome-extensions pack \
    --extra-source=providers/ \
    --extra-source=icons/ \
    --extra-source=locale/ \
    --extra-source=stylesheet.css \
    --extra-source=constants.js \
    --extra-source=limitReset.js \
    --extra-source=resetCreditExpiry.js \
    --extra-source=codexAuth.js \
    --extra-source=usageApi.js \
    --force \
    .

echo "=== [5/5] Verifying bundle contents & EGO-P-006 compliance ==="
if unzip -l "$ZIP_NAME" | grep -q "gschemas.compiled"; then
    echo "ERROR: EGO-P-006 violation! schemas/gschemas.compiled found in package archive!" >&2
    exit 1
fi

echo "Verification SUCCESS: schemas/gschemas.compiled is NOT present in bundle."
echo "Bundle generated: $ZIP_NAME ($(du -h "$ZIP_NAME" | cut -f1))"
echo "Ready for submission to https://extensions.gnome.org"
