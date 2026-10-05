# Reproducible pre-submission checklist

Use a reviewed commit and a private test session. Record date, commit, command,
PASS/FAIL/NOT TESTED and evidence in PRE_SUBMISSION.md. A missing environment is
NOT TESTED; a failed command remains FAIL until a corrected run passes. This is a
human workflow, not permission to publish/upload. No automatic EGO submission.

1. **Baseline:** `git fetch --all --tags`; `git status --porcelain`; `git rev-parse HEAD`.
   Confirm latest GitHub release/tag/assets with `gh release view --repo ivo-lopes/simple-ai-usage-indicator`.
   Follow UPSTREAM.md; review new changes selectively, preserve authorship/license.
2. **Current guidance:** read the [Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html),
   [Best Practices](https://gjs.guide/extensions/review-guidelines/best-practices.html),
   [Preferences](https://gjs.guide/extensions/development/preferences.html) and
   [Accessibility](https://gjs.guide/extensions/development/accessibility.html),
   plus the relevant [45–51 porting guides](https://gjs.guide/extensions/upgrading/gnome-shell-51.html).
   Record access date and any actual changes. Do not treat an old numbered rule label as current authority.
3. **Code:** review extension.js/prefs.js/providers/helpers yourself. Verify readable
   bounded functions, justified compatibility/security comments, no dead imports,
   no excessive logging, no Shell UI import from Preferences and no object allocation
   at module import. Follow async lifecycle tests: cancellation, process force_exit,
   sources/signals removed, late results cannot render; disable is synchronous.
   Subprocess argv must be direct, never a shell string; never install software or
   request privileges from the extension. The maintainer must understand and be
   willing to maintain the submitted JavaScript.
4. **Local checks:** `npm ci --ignore-scripts --no-audit --no-fund`; `npm run lint`;
   `./scripts/validate.sh`. This executes syntax, all GJS unit tests, schema strict
   validation, msgfmt/catalog coverage, whitespace checks, package and ZIP inspector.
   Read the output; do not infer PASS from the existence of a ZIP.
5. **Metadata:** inspect metadata.json: stable fork UUID/name/schema ID, public support
   URL, gettext-domain, description, only genuinely supported shell-version majors.
   No manual deprecated `version` key; no unnecessary session-modes. GitHub tags are
   independent of EGO's internal version. Check actual Shell numbers in the matrix.
6. **Legal:** compare LICENSE against the applicable upstream GPL text. Read NOTICE,
   ASSETS.md and README attribution. Every bundled SVG has provenance and SPDX;
   no proprietary logo or unnecessary raster survives. Provider names describe
   integration, not endorsement; final trademark review remains EGO's discretion.
7. **Shell matrix:** follow tests/integration/README.md with actual GNOME 45–51 binaries.
   Verify `gnome-shell --version`, installation, enable, structured refresh, popup,
   Preferences window, disable/re-enable and disable during in-flight refresh.
   Preserve result JSON plus full sanitized Shell/Preferences/session logs. Review
   warnings as well as JS errors. Headless lifecycle smoke is not full desktop QA.
8. **UI:** in the private Shell, test all providers, narrow bar, light/dark/high
   contrast, 100%/200% St rendering, keyboard Refresh/Settings, native Preferences
   controls and focus order, named quota bars/panel, local dates and pt/pt_BR.
   Inspect screenshots. Record screen-reader/AT-SPI and hardware HiDPI limitations;
   do not claim those from unit mocks. Repeat in an interactive desktop when available.
9. **Install/update:** test the inspected ZIP in a clean private home and upgrade from
   the published v21 ZIP with its checksum verified. Disable/stop the old Shell before
   replacement, compile raw schemas locally, preserve ordinary dconf settings, restart
   and repeat lifecycle/Preferences. Never read/migrate an old Claude token.
10. **ZIP:** `unzip -tq *.shell-extension.zip`; `python3 scripts/inspect-package.py`.
    The inspector compares every regular member byte for byte with allowed sources,
    checks legal files/metadata/original SVGs and bounded credential patterns. Inspect
    `unzip -Z1` yourself. Include runtime JS, used SVGs, stylesheet, raw schema XML,
    compiled MO, metadata and LICENSE/NOTICE/ASSETS only. Exclude .git, .github,
    tests/fixtures, docs/public-support files, CHANGELOG, build scripts, npm manifests,
    node_modules, PO/POT, PNG, temp files and gschemas.compiled. Compile schemas only
    in the private installed copy. Never include credential files or real-account fixtures.
11. **Public support:** verify Issues enabled, templates, SECURITY private reporting,
    CONTRIBUTING, accurate privacy inventory, UPSTREAM and CHANGELOG. Do not ask
    reporters for credentials. A CLI compatibility report must use sanitized values.
12. **CI:** push validated commits, verify a green run for the exact commit, download
    its artifact, unzip and inspect it against a checkout of that commit. Record run URL,
    artifact ID and SHA256; do not assume a previous green run covers current code.
13. **Decision:** reconcile Plane criteria with commits/tests, preserve exact gaps.
    Finish PRE_SUBMISSION.md recommendations. Check `git status --porcelain` is empty
    and local HEAD equals origin/main. Follow docs/RELEASING.md for a separately
    authorized release and separately authorized manual EGO upload. This execution
    stops with the inspected package; it does not publish v22 or upload to EGO.
