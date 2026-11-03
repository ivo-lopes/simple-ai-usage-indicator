# Development evidence — 2026-11-03

Personal open-source project; no corporate runtime dependency.

Start: clean main/origin `a4a899678c127186555a02d0d6a6e6d2e2fb42a0` (v22).
Recovery ref: `recovery/pre-issues-20261103`. Isolated worktree `/tmp/saui-20261103`,
branch `fix/accounts-quotas-upstream-20261103`. Original working tree/main untouched.
After fetch: upstream `5096c4f3affec02619be3d802a8a83552bc98382`, fork 35 ahead /
12 behind; base `f2bd496acb648bbf343e3ea7a4a1a54f6c0bbb55`.

## Baseline and sources

Baseline `scripts/validate.sh`: PASS (14 GJS tests, schema, translations, package,
31 byte-matched members). No baseline code failure. Host Node is present but npm
is absent: npm-cli 10.9.4 downloaded to `/tmp/saui-devtools`, `npm ci --ignore-scripts
--no-audit --no-fund` and `npm run lint` via that CLI: PASS. No system installation.

Mindsite IVOAI memory_read_page, memory_query and context_search returned internal
errors. Voicecorp memory search returned unrelated Voicehub pages; Context empty.
No relevant shared reference or canonical SAUI page was established. Nothing was
written to either service. Plane consent discovery authorizes only `mindsite`;
explicit project list in `pessoal-ivo` returned `WORKSPACE_UNAUTHORIZED`. No changes
made to another workspace. SAUI-3/14/20 states supplied by the operator cannot be
independently confirmed or updated with the current connection.

## GitHub #2 / SAUI-3

Real integration command: `agy --print /usage --print-timeout 8s --output-format json`,
CLI 1.4.12, successful exit. Captured in memory and filtered to a strict allowlist
before writing `tests/fixtures/agy-usage-1.4.12.json`: no account, conversation ID,
response, logs or credentials. Three groups/five buckets observed. Argon has only
`gemini-argon-wtu-weekly`, remaining_fraction 0.007979599758982658 and reset
2026-11-03T22:43:52Z. These values are an observation, not an ongoing entitlement.

The original source parser already retained all five buckets with this payload;
the missing group could not be reproduced on current source/CLI. Installed extension
version was not inferred or changed. Confirm deployment/version before diagnosing
an older installed ZIP. Source gaps fixed: popup rounded 0.80% to 1%, lacked group
headings and rendered an empty bar for unknown metrics; legacy parsing discarded
nonstandard bucket names. Future periods remain unknown rather than guessed.

Tests cover original 1.2.17 format, current 1.4.12 format, weekly-only Argon, malformed
entries, unknown metrics/periods, exact fractions/reset timestamps, force/cache,
coalescing, missing CLI, process teardown and actual popup source render. Lint and
full validation/package: PASS. Real CLI verification is distinct from synthetic
Gio/process and native-Shell lab fixtures.

Contract: bucket `usedPercent`/`leftPercent` are fractions and `resetsAt` is the
canonical reset. Codex/Claude's existing `percent` bucket alias is transitional;
summary `percent`/`resetAt` are documented topbar projections, never quota aggregation.

## GitHub #1

Implemented `ProviderInstance` identity separate from adapter `providerId` and logical
`accountId`, using existing file-backed Codex/Claude directories. Tests with real
synthetic files and loopback Soup HTTP prove two simultaneous accounts per supported
provider, correct token/account headers, distinct quotas, no Claude environment
fallback, independent failure, early per-instance rendering, cancellation/removal,
ordering and lossless implicit migration. No real login/logout or credential copy.
Preferences has native GTK add/rename/directory selection/enable/test/order/remove
and selected-account controls. Portuguese catalogs updated. See docs/ACCOUNTS.md.

Antigravity multi-account is BLOCKED: installed 1.4.12 help and official auth/config
docs do not establish an independent consumer OAuth credential selector. Shared
keyring profiles, HOME changes and token-switching tools cannot prove isolation.
Only one shared session is exposed; unsupported duplication is rejected. Two live
Codex/Claude accounts were not supplied, so loopback evidence is not claimed as a
real provider multi-account test. GitHub #1 remains open.

Native GNOME 48.7 at 800×600: initial P0 run and first account run passed popup,
keyboard focus, light/dark/high contrast bounds and native GTK controls but the
optional AT-SPI reader SIGTRAPed connecting to its private bus (no extension JS errors).
The complete commands are FAIL, not PASS. A separate run explicitly excludes only
that optional reader (`--skip-atspi`); the runner records SKIPPED in result.json.
The account GTK test clicks actual save/move/remove buttons and checks persistence,
identity and directory preservation. No host desktop/settings/credentials changed.
Docker lab unavailable: rootless Docker socket absent. Current native validation is
48.7 only; the historical 45–51 evidence in PRE_SUBMISSION is not re-used as a new run.

A second real integration query used the production `ProviderManager` →
`ProviderInstance` → `AntigravityProvider` → Gio subprocess path, forcing refresh.
`antigravity-live.json` is its allowlisted output: `agy-json`, three groups/five
buckets, no unavailable state, original observation time. No raw CLI response,
account identifier, conversation data or credentials were persisted.
Baseline GitHub Actions run 37377926229 at original `a4a8996`: success.

P1 final pre-merge native run `/tmp/saui-p1-controls48`: PASS on GNOME 48.7,
including actual GTK account buttons/persistence, popup with all five buckets,
light/dark/high contrast at 800×600, refresh and repeated enable/disable with process
cleanup. AT-SPI explicitly SKIPPED; `accounts-native48.json` / `popup-native48.json`
are compact evidence. One intervening runner attempt failed because the test helper
called the Shell gettext wrapper outside the extension; fixed to use prefs.gettext.
This was a lab-helper error, and that failed run was not counted as validation.
Symlinked credential files are also rejected as duplicate references, tested with
synthetic files. Full lint/GJS/schema/catalog/package inspector passed before merge.

## Upstream merge

Controlled `git merge --no-commit --no-ff upstream/main` produced eight conflicted
paths; each resolution is recorded in UPSTREAM.md. Preserved fork identity,
accounts/providers, Portuguese catalogs, icons, license and packaging; LICENSE SHA256
matches upstream exactly. Added compatible Codex credits/expiry features and adapted
upstream regression cases. Removed upstream dist ZIPs/obsolete schema/unused diagnostic
helper from the proposed result. All conflicts were staged explicitly after review.
Full lint/17 GJS tests/schema/catalog/package passed (35 byte-matched ZIP members).
Native merge run GNOME 48.7 at 800×600: PASS with GTK account controls, popup five
buckets, themes, focus, refresh, enable/disable/process cleanup. AT-SPI SKIPPED.
