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
| `c22087d` | Mixed: not relevant / superseded | Includes release metadata and a new reset-credit expiry preference/formatting feature (defer SAUI-13/18). Its standalone usageError helper/tests are not imported by upstream runtime; the fork already displays native GLib.Error.message and now sanitizes HTTP errors. The bundled upstream dist ZIP is not copied; the fork builds its own allowlisted artifact. |
| `60e1513` | Not relevant to hardening scope | New credit-balance popup feature; parsed credits already reach the fork provider, but this new presentation is deferred to existing upstream/API backlog SAUI-13/20. |
| `c0008d1` | Not relevant to hardening scope | New panel credit-balance behavior near quota exhaustion; defer with SAUI-13/20, preserving existing panel semantics. |
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
describe metadata `version` as assigned internally by EGO. Fork metadata stays
at its published GitHub baseline 21 in this wave; UUID, schema ID and name are
unchanged. Source schema XML is distributed, while `gschemas.compiled` is
excluded. The old project's numbered “EGO-P-006” label is not an official current
guideline identifier and has been removed from packaging documentation.

## Compatibility evidence and limit

GNOME Shell 48.7 on the workstation and GNOME Shell/Mutter 51.0 in a Fedora 45
container passed disable during synthetic agy execution and repeated enable,
completed structured quota refresh and disable, without JavaScript errors.
The container had network disabled, no host system bus or credentials, a private
D-Bus bus and an explicitly synthetic login1 service. This proves the Shell API
and extension lifecycle smoke in that lab, not a complete GNOME desktop session.
The compatibility metadata now includes 51; version stays 21. Real lifecycle
coverage on existing declared 45/46/47/49/50 and complete desktop/preferences/theme
validation are still NOT TESTED. SAUI-12 retains that original matrix gap.
