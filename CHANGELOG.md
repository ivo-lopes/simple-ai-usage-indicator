# Changelog

GitHub tags identify source/releases; EGO's internal version is assigned by EGO.
This file summarizes relevant snapshots rather than reconstructing every old commit.

## Unreleased

- Prepare the Codex icon replacement from Flaticon's Chat Gpt artwork with explicit
  source/authorization attribution and the existing three icon modes. A complete
  icon release remains pending corresponding Claude/Google Antigravity assets.

## v23 — 2026-11-03

- Extract pure quota/panel presentation from extension.js for focused tests and
  smaller Shell review scope (partial SAUI-14).

- Strengthen Claude percentage/reset parsing and unknown-payload handling; preserve
  independent model windows and mark local statistics as unavailable quota. Codex
  explicit percentages and optional reset-credit failures now degrade safely.

- Merge upstream through `5096c4f`, preserving fork identity and ancestry. Add
  Codex credit-balance popup/panel near main quota exhaustion and relative/absolute
  reset-credit expiry; retain independent model quota semantics.

- Add independent Codex/Claude account instances using existing CLI directories,
  Preferences account management, safe legacy migration, incremental refresh and
  cancellation per instance. Antigravity remains a single shared session until
  an independent authentication selector is verified (GitHub #1).

- Antigravity: regression fixture from CLI 1.4.12 with three groups/five buckets,
  independent Argon weekly quota, group headings, two-decimal popup percentages
  and no availability bar for missing metrics. Backend fractions/resets remain exact;
  the topbar retains its most constrained five-hour policy (GitHub #2 / SAUI-3).

### Validation and known limits

- Eighteen automated GJS tests, lint, schemas, Portuguese catalogs and package checks passed.
- Native popup/Preferences/lifecycle/scroll checks passed on GNOME Shell 48.7.
  The declared 45–51 matrix has historical evidence and was not repeated for v23;
  AT-SPI failed on the private bus and was explicitly skipped in the final run.
- Independent Antigravity accounts remain unsupported; GitHub #1 stays open.
  Codex/Claude isolation passed synthetic-file/loopback tests; two live accounts
  per provider and authenticated Claude quota were not available.
- GitHub #2 has real agy 1.4.12, five-bucket parser and native popup evidence.
  See docs/validation/2026-11-03/README.md and docs/ACCOUNTS.md.

## v22 — 2026-10-05

### Added

- Deterministic provider/lifecycle tests, lint and CI runtime ZIP artifact checks.
- Reproducible real GNOME Shell compatibility and UI laboratory procedures.
- Security/privacy/contributing guidance, support templates and pre-submission checklist.

### Changed

- Port selected upstream St.BoxLayout orientation and theme fixes; preserve the fork's multi-provider UI.
- Complete Portuguese UI/error/auth translations and plurals; long resets include relative duration.
- Use native themed quota bars and explicit accessible labels; simplify redundant reviewer-facing code.
- Remove the manually maintained EGO metadata version; keep GitHub release tags independent.
- Document upstream fetch/review decisions and release preparation.

### Fixed

- Prevent late asynchronous results from touching destroyed Shell/Preferences widgets.
- Cancel HTTP/file operations and terminate the quota subprocess during teardown.

### Security

- Remove persistent Claude token settings; rely on CLI OAuth credentials or the optional OAuth environment variable.
- Remove the Antigravity Google UserInfo request and credential reads during quota refresh.
- Keep credentials and response bodies out of user-visible errors/artifacts.

Compatibility/UI results and remaining limits are recorded in PRE_SUBMISSION.md.
GitHub publication is independent of GNOME Extensions review and approval.

## v21 — 2026-10-05

- Prefer structured Antigravity quotas, preserve all groups/buckets and real weekly resets.
- Add offline parser regressions, explicit unavailable/cache/stale states and force refresh.
- Restore GPL-3.0-only licensing, upstream NOTICE and SPDX attribution.
- Replace unverified provider artwork with nine original generic SVGs; sanitize packaging.
- Publish the runtime ZIP and SHA256SUMS on GitHub. No EGO upload occurred.

## v20 — 2026-09-17

- Adjust icon spacing/sizing and add stylesheet/conformity tests.
- Introduce the packaging script and exclude compiled schemas.
- This historical release used provider artwork replaced in v21. Its release notes'
  “EGO-P-006” label is not an identifier in the currently consulted review guidelines.
- The historical support declaration is not evidence of the later real-Shell matrix.
