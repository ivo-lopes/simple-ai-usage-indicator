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
