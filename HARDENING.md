# Second-wave hardening validation — 2026-10-05

Ivo Lopes's personal project. Mindsite's Plane is only a backlog tracker.

## Baseline and release gate

`git fetch --all --tags` confirmed clean `main`, HEAD
`420e468fc7722472b180b5c21f4ca93b18866e60`, metadata version 21 and latest tag v21.
[GitHub Release v21](https://github.com/ivo-lopes/simple-ai-usage-indicator/releases/tag/v21)
was published on 2026-10-05 at 18:08:56 UTC, stable/latest, not a draft.
Its 69,481-byte runtime ZIP and SHA256SUMS were downloaded and checked:
`add347a4533b29892bc0fd4fad5e86e0b0c4d2eb71901d418ca4f7f3c670d344`.
The previous publication succeeded; no duplicate release was created.

## Backlog reconciliation before implementation

The entire 25-item SAUI backlog was read. Each original criterion was compared
with code/tests from the first wave and packaging was rerun before reconciliation.

| Plane | Before | Evidence | Reconciliation |
|---|---|---|---|
| SAUI-4 | Backlog | Tracked process, direct argv, executable init/exit checks, 12s timeout, force_exit on destroy, teardown test | Done |
| SAUI-5 | Backlog | Pure structured parser, sanitized JSON/text fixtures, 67 offline assertions covering the listed regressions | Done |
| SAUI-6 | Backlog | Unavailable fallback, manual force, observedAt/source/cached/stale, UI labels, cache/fallback tests | Done |
| SAUI-11 | Backlog | Runtime allowlist, only used SVGs, no PNG/Gemini/PO/POT/tests/fixtures/git/compiled schema; ZIP inspection | Done |

Evidence: `76ccb39`, `f72266e`, `59e5424`, `e030ca2`, VALIDATION.md and v21.
No task was duplicated or reimplemented by association.

## Implemented hardening

- `d41d444`: remove Claude secret GSettings key, password row and settings access.
  Official local OAuth has priority; CLAUDE_CODE_OAUTH_TOKEN is a fallback.
  ANTHROPIC_API_KEY is an inference API key, not sent to the OAuth quota endpoint.
  Account metadata alone is not a credential. Errors never include HTTP bodies.
  README documents `dconf reset /org/gnome/shell/extensions/simple-ai-usage-indicator/claude-token`.
  The old value was not read, displayed or automatically migrated/deleted.
- `c3653c3`: feature-detect St orientation, remove obsolete horizontal vertical
  properties, inherit text colors from Shell themes; three API generations tested.
- `52b04fa`: explicit disposed state, guards on refresh/render/timers and post-await
  callbacks, HTTP/file/Secret cancellables, process teardown, signal disconnection,
  empty provider-manager results after destroy and idempotent cleanup. Preferences
  disposes on close/unrealize and drops late successful/failed row updates.
  HTTP tests use a paused loopback server to prove cancellation and safe errors.
- `18638f7`: Codex tests inject auth/client dependencies; auth parsing uses temporary
  synthetic files; real GNOME integration lives outside the standard test glob.
- `e0e14f0`: read-only GitHub Actions, minimal native Oxlint dev dependency, syntax,
  schemas, translations, all unit tests and package checks, uploaded ZIP artifact.
- `d4bb319`: whitespace-only local OAuth correctly identifies the environment source.
- `d459e49`: real isolated GNOME 51.0 lifecycle evidence, declared 51 without a
  version bump, explicit container-login1 fixture, improved integration diagnostics,
  late Preferences rejection/signal tests and documented upstream decisions.

[UPSTREAM.md](UPSTREAM.md) classifies all eleven commits through
`7d8c20ef0f3d959d45f3c31ac2cc6fe9a5e49984`. Orientation and theme corrections
were adapted; GPL was already restored. Credit-balance/expiry features, unused
upstream diagnostic helper and upstream dist/version changes were not merged.
No new providers, broad quota/UI refactor or release automation were added.

## Validation executed

| Test / command | Result and evidence |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund`, `npm run lint` | PASS locally and remotely; pinned Oxlint 1.87.0 with native platform bindings only, explicit GJS globals, no formatting rules |
| Linter negative control with an undefined global | PASS — rejected as expected; production sources lint clean |
| `node --check --input-type=module` for tracked JS; `bash -n` | PASS through scripts/validate.sh |
| All twelve `tests/*.test.js` with GJS | PASS locally and on a clean Ubuntu 24.04 CI runner, without AI CLIs/credentials; 67 Antigravity assertions retained |
| Codex auth/provider fixtures; Claude OAuth/env/schema/prefs checks | PASS — absent/present/malformed/expired synthetic credentials, no personal files or Keyring |
| Lifecycle tests | PASS — refresh completes after disable, no render/notification/row access, repeated enable/disable, cancellables and signal/timer cleanup |
| HTTP lifecycle + usage HTTP tests | PASS — paused loopback cancellation, no subsequent request, safe errors, account/reset-credit headers |
| `glib-compile-schemas --strict --dry-run schemas` | PASS |
| `msgfmt -c` both PO catalogs | PASS — packaging rebuilt both MO files |
| `git diff --check`, `./package.sh`, `unzip -tq` | PASS |
| Runtime allowlist + scripts/inspect-package.py | PASS — 31 regular files match source bytes, LICENSE/NOTICE/ASSETS, nine SVGs without embedded images/scripts, bounded credential-pattern scan |
| GNOME 48.7 smoke | PASS — isolated XDG/D-Bus, disable during synthetic agy refresh with process exit; re-enable, completed structured refresh, disable; no JS errors |
| GNOME 51.0 smoke | PASS — Fedora 45 container with network off, private system/session buses and synthetic login1; same lifecycle/structured refresh, Preferences open request, no captured JS errors |
| Full desktop GNOME 51 session with real OS services | NOT TESTED — container uses synthetic login1, no GDM/system services; smoke is explicitly narrower |
| Real enable/disable on 45/46/47/49/50 | NOT TESTED — structural old/transitional St tests passed; those desktop runtimes were not available locally |
| Full theme, HiDPI, keyboard/screen-reader and Preferences interaction matrix | NOT TESTED — open request/log inspection is not full interaction testing |
| Live Claude/Codex authentication and quota requests | NOT TESTED in this wave — security/default-suite checks use synthetic credentials; no need to access private accounts |

CI evidence: [successful initial run 37356034409](https://github.com/ivo-lopes/simple-ai-usage-indicator/actions/runs/37356034409).
A subsequent [successful hardening run 37357652371](https://github.com/ivo-lopes/simple-ai-usage-indicator/actions/runs/37357652371)
validated commit `61a66f7679173bcf7adfb0bc3746466e58abf41c`.
All steps and artifact upload passed; the downloaded artifact contains the
expected 31 runtime/legal files and no Claude secret schema key. Final commit
CI evidence is recorded in Plane and the execution report.

Initial lab failures are not passes: Docker bridge DNS prevented package install;
host networking was used only for building the lab. GNOME 51 needed a private
system bus/login1 fixture and the harness needed to tolerate D-Bus startup before
calling list. Fixed harness/lab runs passed. Product APIs were not mocked in the
GNOME 51 smoke; OS login1 and quota responses were explicitly synthetic.

## Scope limits and task outcome

SAUI-7, 15, 16 and 17 meet their original criteria. SAUI-12 remains In Progress:
selected upstream fixes and GNOME 51 lab smoke are complete, but its original
45–51 real lifecycle matrix is incomplete. This is an exact validation gap, not
a claim that all Shell versions are fully validated or a formal external blocker.
Existing SAUI-18/19/24 cover broader translation/accessibility/pre-submission work.
No unrelated backlog task was closed.

No GitHub release/tag or EGO upload was created in this wave. Latest remains v21;
metadata version remains 21, while shell-version now lists 45–51. A subsequent
v22 is appropriate for security/lifecycle fixes, deterministic tests/CI and
selective compatibility changes after explicit release authorization. Before a
new EGO submission, finish the applicable real compatibility/pre-submission checks.

Verdict for the entire requested wave: PARTIALLY_READY because SAUI-12 retains
its original validation gap. Implemented fixes and CI are validated and pushed;
this report does not claim GNOME review acceptance.
