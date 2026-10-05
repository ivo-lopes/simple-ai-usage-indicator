# Urgent task validation — 2026-10-05

Scope: SAUI-1, SAUI-9, SAUI-10. Personal project of Ivo Lopes; Mindsite's
Plane is only a backlog tracker. Initial branch: main; initial HEAD:
`df93ddb0c8913a03fa481e28b345cf38290d0dfe` (v20). Existing untracked `.serena/`
was preserved and locally excluded with `.git/info/exclude`, not committed.

## Implementation and evidence

- `76ccb39`: structured Antigravity quota handling, per-bucket display, truthful
  unavailable state, local reset dates, manual force and bounded subprocess.
- `f72266e`: deterministic offline fixtures and 67 assertions; fixes the GJS
  Antigravity/Codex async test harness so it actually waits for completion.
- `46f4959`: verbatim upstream GPL license, NOTICE, SPDX and fork attribution.
- `59e5424`: nine original generic SVGs, ten unused artwork files removed,
  ASSETS inventory, translated icon labels and package allowlist.

`agy --version` returned 1.2.17. A read-only authenticated command
`agy --print /usage --output-format json --print-timeout 8s` returned
`status: SUCCESS`, `num_turns: 0` and four quota buckets in
`command.data.groups[].buckets[]`. Only sanitized quota structure was inspected;
credentials, account identifiers and conversations were not printed or saved.
The offline fixture preserves that observed shape with synthetic values.
Official [headless documentation](https://antigravity.google/docs/cli/headless/)
and [changelog](https://antigravity.google/docs/changelog/) were consulted.
The public [CLI repository](https://github.com/google-antigravity/antigravity-cli)
provides product information/issue tracking; no undocumented backend fields or
private implementation are assumed by this adapter.

Weekly reset is the backend `reset_time`, never observation time plus seven days.
Durations 5h/weekly describe the reported window, not its next reset. Fractions
retain precision; all groups/buckets survive normalization. The panel selects
the most constrained known 5h bucket, and the popup names and displays every
bucket. Legacy relative human wording leaves the timestamp unknown. CLI failure
shows unavailable quota, with local session counts separately labeled.

## Checks executed

| Command / check | Result |
|---|---|
| `gjs -m tests/antigravityProvider.test.js` | PASS — 67 offline assertions, real missing/failed subprocess and destroy cleanup |
| `gjs -m tests/claudeProvider.test.js` | PASS |
| `gjs -m tests/codexProvider.test.js` | PASS — async auth inspection now awaited; accepts available/unavailable auth |
| `gjs -m tests/iconsConformity.test.js` | PASS |
| `gjs -m tests/limitReset.test.js` | PASS |
| `gjs -m tests/resetCreditExpiry.test.js` | PASS |
| `gjs -m tests/usageApi.test.js` | PASS |
| `gjs -m tests/usageApiHttp.test.js` | PASS — loopback server, no internet |
| `glib-compile-schemas --strict --dry-run schemas` | PASS |
| `msgfmt -c` for `po/pt.po` and `po/pt_BR.po` | PASS — both shipped MO files rebuilt |
| `bash -n package.sh`, `git diff --check` | PASS |
| Live `_fetchAgyQuota({force: true})` via GJS | PASS — structured source and four buckets |
| GNOME Shell 48.7 headless Wayland in isolated `dbus-run-session` and XDG directories | PASS — enable ACTIVE, disable INACTIVE; no extension JS error in captured logs |
| SVG rendering with GJS/Rsvg/Cairo and visual inspection | PASS — nine generic variants |
| `./package.sh`, `unzip -tq`, ZIP entry allowlist | PASS |
| LICENSE/NOTICE/ASSETS byte comparison in ZIP | PASS |
| ZIP SVG XML, no embedded image/script, credential-pattern scan | PASS — no matches; this is a bounded pattern check, not a universal secret detector |
| GNOME 45/46/47/49/50 enable/disable | NOT TESTED — only 48.7 installed |
| Full interactive popup/preferences, screen-reader and theme matrix | NOT TESTED — headless lifecycle check and SVG preview do not establish these |
| Real old Antigravity CLI versions | NOT TESTED — installed version is 1.2.17; compatibility fixtures/stubs passed |

Intermediate failures corrected before the final pass: package.sh lacked execute
permission; GJS has no global URL constructor (fixture loading now uses Gio);
a cache regression initially expected a JSON bucket ID after a legacy response
(which has no ID). A legal-notice byte comparison also detected an intermediate
archive predating the final NOTICE wording; the regenerated archive passed.

## GNOME review findings

Current [review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
were consulted, specifically licensing, copyrights/trademarks, external processes,
fork naming, metadata and unnecessary files. Distributed derivative code needs
attribution; this ZIP contains NOTICE plus relevant source headers. The fork's
name/UUID were already distinct and remain unchanged. Metadata version stays 20;
the guidelines say the EGO version field is assigned by EGO. GPL v3 source is in
LICENSE, with the exact chronology in NOTICE. Assets without demonstrated owner
permission were replaced, rather than treating an upstream code license as a
provider-logo permission.

The current guideline page requires schema XML and does not present the project's
numbered “EGO-P-006” label as an official rule identifier. This package still
excludes `gschemas.compiled`, as explicitly required by this task and the existing
packaging contract. External agy is needed to read its own quota command; it is
not bundled or installed by the extension. Processes have a timeout, exit checks
and disable cleanup. Reviewer discretion still applies, including descriptive
provider names and the use of external subprocesses. No review acceptance is
claimed from these local checks.

## Package and release disposition

ZIP: `simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip`.
31 regular files: 14 runtime JS modules, stylesheet, metadata, raw schema,
nine original SVGs, two compiled message catalogs and LICENSE/NOTICE/ASSETS.
No development tests/fixtures, PO/POT, build scripts, git files, credentials,
compiled schemas, PNGs or Gemini artwork. The ZIP itself is ignored by Git.

No EGO upload, no pending-submission changes, no tag or GitHub Release creation.
Suggested next version: 21, continuing the project's existing integer sequence
for the quota correction and legal/asset changes, after the maintainer decides
to release. This validation covers the three urgent items; it does not certify
all backlog work or all supported Shell versions.

Existing follow-ups remain in the backlog: SAUI-2/3 (richer relative display and
general quota contract), SAUI-4/5/6/15 (broader lifecycle/parser/cache work),
SAUI-7/8 (credential handling), SAUI-11 (general package hygiene), SAUI-12/13
(compatibility/upstream sync), SAUI-16/17 (CI and remaining environment-independent
tests), SAUI-18/19 (complete i18n/accessibility). Only changes necessary to the
urgent criteria were made; these items were not marked complete or duplicated.

## v21 release preparation — 2026-10-05

After the urgent-task validation above, Ivo Lopes explicitly requested publishing
the next GitHub release. Metadata and the README version badge now identify 21;
the earlier version-20 disposition remains the historical validation record.
The release packages the completed SAUI-1, SAUI-9 and SAUI-10 changes. Its notes
retain the test limitations above. The packaging command reruns all eight test
files, compiles both translations and checks the runtime/asset/legal allowlist.
All passed again for v21, together with strict schema validation, shell syntax
and diff checks, archive/source byte comparisons, SVG inspection and a bounded
credential-pattern scan. The v21 ZIP also passed isolated GNOME Shell 48.7
enable (ACTIVE) and disable (INACTIVE), with no extension JavaScript errors.
Archive: 69,481 bytes, 31 regular files. SHA256:
`add347a4533b29892bc0fd4fad5e86e0b0c4d2eb71901d418ca4f7f3c670d344`.
GitHub publication is separate from EGO: no upload or change to the pending
GNOME Extensions submission is authorized or performed by this release step.
