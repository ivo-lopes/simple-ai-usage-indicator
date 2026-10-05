#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
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
    --extra-source=quotaReset.js \
    --extra-source=LICENSE \
    --extra-source=NOTICE \
    --extra-source=ASSETS.md \
    --force \
    .

echo "=== [5/5] Verifying bundle contents & EGO-P-006 compliance ==="
unzip -tq "$ZIP_NAME"
while IFS= read -r entry; do
    case "$entry" in
        extension.js|prefs.js|metadata.json|stylesheet.css|constants.js|codexAuth.js|usageApi.js|limitReset.js|resetCreditExpiry.js|quotaReset.js|LICENSE|NOTICE|ASSETS.md) ;;
        providers/|providers/baseProvider.js|providers/index.js|providers/codexProvider.js|providers/claudeProvider.js|providers/antigravityProvider.js|providers/agyUsage.js) ;;
        icons/|icons/codex-symbolic.svg|icons/codex-black.svg|icons/codex-color.svg|icons/claude-symbolic.svg|icons/claude-black.svg|icons/claude-color.svg|icons/antigravity-symbolic.svg|icons/antigravity-black.svg|icons/antigravity-color.svg) ;;
        schemas/|schemas/org.gnome.shell.extensions.simple-ai-usage-indicator.gschema.xml) ;;
        locale/|locale/pt/|locale/pt_BR/|locale/pt/LC_MESSAGES/|locale/pt_BR/LC_MESSAGES/|locale/pt/LC_MESSAGES/simple-ai-usage-indicator.mo|locale/pt_BR/LC_MESSAGES/simple-ai-usage-indicator.mo) ;;
        *) echo "ERROR: unexpected archive entry: $entry" >&2; exit 1 ;;
    esac
done < <(unzip -Z1 "$ZIP_NAME")
for required in LICENSE NOTICE ASSETS.md; do
    unzip -p "$ZIP_NAME" "$required" | cmp - "$required"
done

echo "Verification SUCCESS: runtime allowlist and legal notices verified."
echo "Bundle generated: $ZIP_NAME ($(du -h "$ZIP_NAME" | cut -f1))"
echo "Local bundle validated. No upload performed; review release readiness separately."
