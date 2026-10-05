# Changelog

GitHub tags identify source/releases; EGO's internal version is assigned by EGO.
This file summarizes relevant snapshots rather than reconstructing every old commit.

## Unreleased — proposed v22

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

Compatibility/UI results and remaining limits are recorded in PRE_SUBMISSION.md;
this entry does not imply publication or EGO approval.

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
