# Full upstream integration — 2026-11-03

This section supersedes the historical selective-only decisions below. A real
non-fast-forward merge integrates upstream/main `5096c4f3affec02619be3d802a8a83552bc98382`
into the fork after the Antigravity and supported Codex/Claude account changes were
validated. Antigravity independent authentication remains a documented GitHub #1
blocker; no false second session is exposed.

Original fork: `a4a899678c127186555a02d0d6a6e6d2e2fb42a0` (35 ahead / 12 behind).
Pre-merge fork: `e3428cc` (38 ahead / 12 behind), recovery ref
`recovery/pre-upstream-20261103`. Shared base: `f2bd496acb648bbf343e3ea7a4a1a54f6c0bbb55`.
The final merge SHA and ancestry checks are recorded after the merge below.

| Upstream commit | Classification | Current decision |
|---|---|---|
| `2fc4bcb`, `df97bd4` | Already present | Preserve fork's feature-detected vertical layout and real 45 ScrollView compatibility. |
| `e03c322` | Intentionally not applicable | Upstream v15 metadata/README; keep fork name, UUID, schema, translations and build. |
| `ebf5609` | Already present | GPL-3.0 LICENSE byte content and attribution preserved. |
| `601e5a4`, `bc5a383` | Already present | Inherit theme colors; original generic SVG icons and native BarLevel retained. |
| `c22087d` | Incorporated / partly superseded | Adopt reset-credit expiry modes/helper/tests under the fork schema. Release metadata/ZIP not applicable; unused usageError helper superseded by sanitized provider errors. |
| `60e1513`, `d5ea173` | Incorporated | Codex-only popup credit balance: zero, unlimited, unknown and tiny positive amounts handled explicitly. |
| `c0008d1`, `7d8c20e` | Incorporated with adapter changes | Codex credit panel near the most constrained main quota (>=90% consumed) and at exhaustion. Preserve model quota origin; independent model limits cannot trigger main billing warnings. Other providers keep their panel policy. Failed reads show an error rather than stale available credits. |
| `5096c4f` | Already present / intentionally not applicable | Fork titles already use inherited foreground with bold hierarchy, checked in native light/dark/high contrast. Upstream inactive-title class is redundant for that appearance. Upstream v18 badge/metadata and dist ZIP are not the fork's distribution. |

## Real conflicts and resolutions

| Path | Resolution |
|---|---|
| `README.md` | Retain personal multi-provider fork instructions; document compatible Codex credit behavior. Upstream badge/release links belong to the original project. |
| `extension.js` | Retain multi-account lifecycle, scrolling popup and fixed footer. Adapt credit popup/panel and expiry rendering; use a tested pure `providers/codexCredits.js` formatter instead of the upstream single-account state shape. |
| `metadata.json` | Preserve Simple AI Usage Indicator, own UUID/schema/gettext domain, GNOME 45–51 and fork URL. EGO assigns its own version. |
| `prefs.js` | Retain native multi-account controls and disposal; add upstream's expiry-mode preference using tracked signals. |
| `resetCreditExpiry.js` | Incorporate upstream date/relative mode and compact zero-unit behavior, preserving SPDX/NOTICE attribution. |
| `schemas/org.gnome.shell.extensions.codex-usage-indicator.gschema.xml` | Resolve modify/delete by retaining deletion of the obsolete schema. Add expiry preference to the fork's own schema alongside accounts-config. |
| `tests/menuLayout.test.js` | Preserve fork's actual builder/ScrollView API regressions; translate upstream credit cases into separate adapter-aware codexCredits tests. |
| `tests/resetCreditExpiry.test.js` | Combine attribution with upstream relative/exact-hours/date-order regression cases. |

Auto-merged constants include expiry-mode values. No upstream changes exist to the
Codex auth or HTTP adapter in this range. Preserve fork cancellation, bounded HTTP
and agy subprocess timeout, safe errors and read-only credentials. Do not introduce
upstream `dist/*.zip` or the unused `usageError.js`/test into the final tree. Build
only the fork allowlisted ZIP; newly used formatter/expiry helper are included.

Before concluding: full lint/GJS/schema/gettext/package validation, native Shell
48.7 popup/Preferences lifecycle, refresh upstream refs again and verify:

```sh
git merge-base --is-ancestor upstream/main HEAD
git rev-list --left-right --count upstream/main...HEAD
```

For future updates, use a controlled merge in an isolated branch after reviewing
the new delta and repeat those checks. Keep the original review below as history;
its previous deferrals are superseded by the decisions above.

---

# Upstream review — 2026-10-05

Personal project of Ivo Lopes, derived from
[stonega/codex-usage-indicator](https://github.com/stonega/codex-usage-indicator).
Reviewed after fetching the upstream origin, from shared ancestor
`f2bd496acb648bbf343e3ea7a4a1a54f6c0bbb55` to upstream HEAD
`7d8c20ef0f3d959d45f3c31ac2cc6fe9a5e49984`.

| Commit | Classification | Decision |
|---|---|---|
| `2fc4bcb` | Applicable | Port orientation feature detection to all vertical menu boxes; remove explicit horizontal `vertical: false`. Test old/transitional/51 property sets against actual menu builders. |
| `df97bd4` | Already incorporated through selected change | Merge of the orientation patch; no additional delta to merge. |
| `e03c322` | Not relevant | Upstream release 15 metadata/README; retain fork identity/version. |
| `ebf5609` | Already incorporated | Complete GPL v3 LICENSE restored in `46f4959`, with documented chronology. |
| `601e5a4` | Applicable | Titles/text inherit the Shell theme; retain existing font weights/layout. |
| `bc5a383` | Already incorporated through selected change | Merge of theme patch; no additional delta. |
| `c22087d` | Mixed: not relevant / superseded | Includes release metadata and a new reset-credit expiry preference/formatting feature (defer feature work after submission). Its standalone usageError helper/tests are not imported by upstream runtime; the fork already displays native GLib.Error.message and now sanitizes HTTP errors. The bundled upstream dist ZIP is not copied; the fork builds its own allowlisted artifact. |
| `60e1513` | Not relevant to hardening scope | New credit-balance popup feature; parsed credits already reach the fork provider, but this new presentation is deferred to existing upstream/API backlog SAUI-20. |
| `c0008d1` | Not relevant to hardening scope | New panel credit-balance behavior near quota exhaustion; defer with SAUI-20, preserving existing panel semantics. |
| `d5ea173` | Not relevant to hardening scope | Merge of popup credit feature, same decision as `60e1513`. |
| `7d8c20e` | Not relevant to hardening scope | Merge of panel credit feature, same decision as `c0008d1`. |

No authentication/HTTP adapter changes exist in this upstream range. The
usageError helper is a standalone diagnostic addition, and upstream also checks
in a release ZIP. The fork preserves its own lifecycle and packaging controls. No blind merge/cherry-pick was performed.
The GPL license and known authorship are retained in LICENSE/NOTICE.

The current [GNOME 51 upgrade guide](https://gjs.guide/extensions/upgrading/gnome-shell-51.html)
confirms removal of St `vertical` and requires synchronous `disable()`; this fork
uses detected `orientation` where available and retains synchronous teardown.
Its direct actor event signals remain supported (deprecated); it does not use
the removed pointerWatcher, GLSLEffect or Clutter.get_default_backend APIs, or
explicit PopupMenu open/close animation parameters. No GTK libraries enter the
Shell process. Source tests cover menu constructors and delayed asynchronous
teardown rather than claiming a complete desktop compatibility matrix.

The [review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
describe metadata `version` as assigned internally by EGO. Current metadata omits that deprecated key; UUID, schema ID and name are
unchanged. GitHub release tags have a separate version policy. Source schema XML is distributed, while `gschemas.compiled` is
excluded. The old project's numbered “EGO-P-006” label is not an official current
guideline identifier and has been removed from packaging documentation.

## Compatibility evidence

The current real-Shell 45–51 matrix, native GTK Preferences, theme/accessibility
checks and laboratory limits are recorded in PRE_SUBMISSION.md. The 45 ScrollView
fix is specific to the fork's scrolling section: use Clutter.Container.add_actor on
45 and ScrollView.set_child on later Shells. Native source inspection and the
real 45.10 disable test exposed the inherited St.Bin.set_child lifecycle bug.
The isolated services support the lab session; they do not emulate Shell versions.

## Before every release

The local upstream remote is `https://github.com/stonega/codex-usage-indicator.git`.
If absent, add it with `git remote add upstream URL`. Never merge blindly.

```sh
git fetch --all --tags
git merge-base main upstream/main
git log --oneline f2bd496..upstream/main
git diff f2bd496 upstream/main -- extension.js prefs.js metadata.json package.sh LICENSE
```

Compare upstream HEAD against the last reviewed HEAD above; if it advanced, review
only the new range as well as relevant dependent changes. Classify every change as
applicable/already incorporated/superseded/incompatible/not relevant. Port compatible
fixes selectively, run regression and real-Shell tests, preserve NOTICE/authorship,
and update this table and CHANGELOG.md before tagging. The 2026-10-05 re-fetch still
found `7d8c20ef0f3d959d45f3c31ac2cc6fe9a5e49984`; no additional commits to reconcile.

Current evidence is in PRE_SUBMISSION.md. Current metadata omits `version` because EGO assigns it internally;
GitHub releases remain separately tagged. Credit-balance presentation and reset-credit
expiry preference changes remain deferred; completing this review routine does not
mean all optional upstream features were adopted.
