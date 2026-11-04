#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail
cd "$(dirname "$0")/.."
while IFS= read -r -d '' source; do
    node --check --input-type=module < "$source"
done < <(git ls-files -z '*.js')
bash -n install.sh package.sh scripts/validate.sh
python3 tests/installer.test.py
glib-compile-schemas --strict --dry-run schemas
git diff --check
# package.sh compiles/validates translations, runs every unit test, packs,
# checks unzip integrity, rejects entries outside the allowlist and checks notices.
./package.sh
python3 scripts/inspect-package.py
