# Asset provenance and distribution audit

## Current provider artwork — v24, 2026-11-04

All nine provider SVGs are adapted from downloads selected by the maintainer:
OpenAI from Flaticon, Claude from Icons8, and Antigravity from Google's own press
page. Artwork remains under separate terms; the extension code is GPL-3.0-only.
The maintainer stated possession of authorization for the requested icon
replacement on 2026-11-03 and selected the additional sources on 2026-11-04.
No grant document was supplied to this repository. This records that confirmation;
it does not assert that the standard artwork licenses are GPL or grant downstream
users unrestricted relicensing. Preserve the credits and consult the respective
terms when redistributing. Provider trademarks belong to their owners; descriptive
identification does not imply endorsement. No EGO approval is asserted.

| Runtime variants | Download / author | Adaptation and terms identifier |
|---|---|---|
| `codex-{symbolic,black,color}.svg` | [Chat Gpt 11865326 by Magnific / Flaticon](https://www.flaticon.com/free-icon/chat-gpt_11865326) | PNG vector tracing, 24×24 canvas, themed/black/green fills; `LicenseRef-Flaticon-Authorized` |
| `claude-{symbolic,black,color}.svg` | [Claude Ai 1G3UNEZHMjPH by Icons8](https://icons8.com/icon/1G3UNEZHMjPH/claude-ai) | iOS Filled PNG vector tracing, 24×24 canvas, themed/black/terracotta fills; `LicenseRef-Icons8` |
| `antigravity-{symbolic,black,color}.svg` | [Google Antigravity press assets](https://antigravity.google/press/) | Published SVG paths preserved and scaled from 180×180 to the common 24×24 canvas; monochrome fills adapted for theme/black; full-color gradients/masks retained; `LicenseRef-Google-Brand` |

### Download hashes and transformations

SHA256 values below identify the **unmodified downloaded sources**, not the
adapted runtime files:

| Download | SHA256 |
|---|---|
| [OpenAI PNG, 512 px](https://cdn-icons-png.flaticon.com/512/11865/11865326.png) | `a8a35e0bbaa9171dcd64937c39aeb6fa4acfcf0b76a0830e341f2e96a5ef69f3` |
| [Claude PNG, 100 px](https://img.icons8.com/ios-filled/100/claude-ai.png) | `30f026a66105070e67004d56883d608c04c0a9ca412273399df56671509b8cd1` |
| [Antigravity full-color SVG](https://antigravity.google/assets/image/brand/antigravity-icon__full-color.svg) | `d775965ea1f8060538c15f758a3e22487317211fcb6051333b5e023f35aa726f` |
| [Antigravity one-color SVG](https://antigravity.google/assets/image/brand/antigravity-icon__one-color.svg) | `5b5d0cfd07cb79ba5d299d80b754e7c91d782dc1199811688dec67a0a11ba240` |
| [Antigravity white SVG](https://antigravity.google/assets/image/brand/antigravity-icon__white.svg) | `5b8121138dcb017642ccf15d9f5cda738e61d8d70a12277c9cf5aeec3e575e81` |

The two PNG silhouettes were traced with VTracer Python 0.6.15, binary spline
mode, corner threshold 60, 10 iterations, splice threshold 45, path precision 3.
OpenAI uses speckle filter 4/length threshold 4 and a 20×20 region within the
24×24 canvas; Claude uses filter 1/length 1 and fits its 96×96 alpha bounds into
that same region. This is an adaptation of downloaded artwork, not an AI-generated
logo. Conversion tools and source PNGs are development-only and absent from the ZIP.
All runtime artwork is local SVG with no script, embedded raster or remote fetch.
Symbolic files use filled paths for GNOME foreground theming; black/color modes
keep explicit colors. No application, provider API, credential or setting contract
changed for this replacement.

### Credits and source terms

Preferences contains visible source links for all three providers, including
[Icons8](https://icons8.com) credit. NOTICE and README retain the same attribution.
Relevant source pages: [Flaticon terms](https://www.flaticon.com/legal),
[Icons8 license](https://icons8.com/license) and
[full Icons8 agreement](https://intercom.help/icons8-7fb7577e8170/en/articles/5534926-universal-multimedia-license-agreement-for-icons8),
and [Google Antigravity press page](https://antigravity.google/press/).
The maintainer's permission statement above is distinct from these standard terms;
no source asset is automatically relicensed under the code's GPL notice.

### Validation scope

All 18 GJS tests, lint, strict schemas, Portuguese catalogs and the 37-file package
inspection passed. Native GNOME Shell 48.7 checks passed popup/Preferences,
all three icon modes across light/dark/high-contrast, scroll, refresh and repeated
activation/deactivation with no JavaScript errors. The nine SVGs and native
screenshots were visually inspected, including the Preferences source links.
The 45–51 declared matrix was not repeated; AT-SPI is
explicitly skipped in the native run. These UI checks use synthetic provider data
and are not live provider-authentication integration tests. The final test results
are recorded in the v24 release/PR. IvoAI memory and Context returned internal
errors during the source consultation; no memory content was inferred or written.
Plane required reauthentication, so no task update was possible. GitHub PR #4
and the release notes retain this delivery's evidence.

Reproduce the native run from a validated ZIP:

```sh
python3 tests/integration/gnome-shell-smoke.py \
  simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip \
  --expected-major 48 --isolated-system-bus \
  --login1-stub tests/integration/login1-stub.js --popup --prefs --ui \
  --skip-atspi --monitor 800x600 --output-dir /tmp/saui-v24-native
```

## Historical audit — 2026-10-05

The following audit describes the icons distributed before v24.
Its statements about all nine original icons apply to that historical snapshot.

Audit date: 2026-10-05, SAUI-10. Scope: all files in `icons/` at v20
(`df93ddb`), embedded images, compiled translations and every asset in the ZIP.

The distributed icons are now original, simple geometric SVGs authored for this
repository: code brackets, a conversation bubble and a usage chart. They do not
trace or imitate provider logos. Each has a `GPL-3.0-only` SPDX identifier and is
covered by LICENSE. White, black and color variants remain for existing settings.
Names such as `codex-color.svg` are runtime compatibility identifiers, not claims
that the artwork is an official logo. No fonts, screenshots, remote images,
JavaScript or embedded raster payloads are included in these SVGs.

## Inventory at v20 and decisions

“Used” refers to runtime at the audited v20 revision. All remaining SVG filenames
are still used by provider constructors, `getIconFileName()`, panel and popup.
Each replacement has origin “original artwork in this repository”, license
GPL-3.0-only, no provider trademark artwork and permission to redistribute under
LICENSE. The original artwork listed below is no longer in HEAD or the ZIP.

| File | Purpose | Used | Original source / known origin | Original license / permission evidence | Trademark artwork | Decision |
|---|---|---|---|---|---|---|
| `codex-symbolic.svg` | Panel/menu, white | Yes | Upstream, introduced in `71f9b85`; OpenAI-shaped artwork | No owner permission recorded for artwork | OpenAI | Replace with original code brackets |
| `codex-black.svg` | Panel/menu, black | Yes | Fork variant, `43ae8b4` | No owner permission recorded | OpenAI | Replace with original code brackets |
| `codex-color.svg` | Panel/menu, color | Yes | Fork variant, `bc14411` | No owner permission recorded | OpenAI | Replace with original code brackets |
| `codex-symbolic.png` | Raster variant | No | Fork `bc14411`; exact external origin undocumented | No owner permission recorded | OpenAI | Remove |
| `codex-black.png` | Raster variant | No | Fork `43ae8b4`; exact external origin undocumented | No owner permission recorded | OpenAI | Remove |
| `codex-color.png` | Raster variant | No | Fork `bc14411`; exact external origin undocumented | No owner permission recorded | OpenAI | Remove |
| `claude-symbolic.svg` | Panel/menu, white | Yes | UXWing according to README and `bc14411` | UXWing terms prohibit redistribution/sublicensing; no owner permission | Anthropic/Claude | Replace with original conversation bubble |
| `claude-black.svg` | Panel/menu, black | Yes | Fork variant, `43ae8b4`, of reported UXWing artwork | Same unresolved distribution rights | Anthropic/Claude | Replace with original conversation bubble |
| `claude-color.svg` | Panel/menu, color | Yes | Fork variant, `bc14411`; reported UXWing artwork | Same unresolved distribution rights | Anthropic/Claude | Replace with original conversation bubble |
| `claude-symbolic.png` | Raster variant | No | Fork `bc14411`; presumed same artwork, exact download undocumented | No adequate distribution grant evidenced | Anthropic/Claude | Remove |
| `claude-black.png` | Raster variant | No | Fork `43ae8b4`; exact conversion source undocumented | No adequate distribution grant evidenced | Anthropic/Claude | Remove |
| `claude-color.png` | Raster variant | No | Fork `bc14411`; exact download undocumented | No adequate distribution grant evidenced | Anthropic/Claude | Remove |
| `antigravity-symbolic.svg` | Panel/menu, white | Yes | Fork `bc14411`; embedded PNG; original download undocumented | No owner permission recorded | Google/Antigravity | Replace with original usage chart |
| `antigravity-black.svg` | Panel/menu, black | Yes | Fork `43ae8b4`; embedded PNG | No owner permission recorded | Google/Antigravity | Replace with original usage chart |
| `antigravity-color.svg` | Panel/menu, color | Yes | Fork `bc14411`; embedded PNG | No owner permission recorded | Google/Antigravity | Replace with original usage chart |
| `antigravity-symbolic.png` | Raster variant | No | Fork `bc14411`; exact external origin undocumented | No owner permission recorded | Google/Antigravity | Remove |
| `antigravity-black.png` | Raster variant | No | Fork `43ae8b4`; exact external origin undocumented | No owner permission recorded | Google/Antigravity | Remove |
| `antigravity-color.png` | Raster variant | No | Fork `bc14411`; exact external origin undocumented | No owner permission recorded | Google/Antigravity | Remove |
| `gemini-color.svg` | Unreferenced artwork | No | Fork `bc14411`; exact external origin undocumented | No owner permission recorded | Google/Gemini | Remove |

## Evidence

- [Original audited tree](https://github.com/ivo-lopes/simple-ai-usage-indicator/tree/df93ddb0c8913a03fa481e28b345cf38290d0dfe/icons).
- [Fork asset introduction](https://github.com/ivo-lopes/simple-ai-usage-indicator/commit/bc14411ad5251db8b7a1c51a34413e5826ea2549), whose message reports UXWing for Claude.
- [UXWing Claude page](https://uxwing.com/claude-ai-icon/) and
  [full terms](https://uxwing.com/license/): general project-use language does
  not erase the specific redistribution and sublicensing prohibition. Trademark
  ownership is separately acknowledged there. No owner permission is in the repo.
- [OpenAI brand guidance](https://openai.com/brand/) governs logo use and changes;
  the repo contains no express permission for the distributed variants.
- [Google brand guidance](https://about.google/brand-resource-center/guidance/)
  and [brand terms](https://about.google/intl/en/brand-resource-center/brand-terms/)
  do not provide the missing permission for these downloaded/recolored assets.
- [Anthropic terms](https://www.anthropic.com/legal/commercial-terms) do not
  supply a redistribution grant for the UXWing artwork in this repo.
- [GNOME review rules](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#copyrights-and-trademarks)
  require proof of permission for protected artwork and trademarks.

This is an evidence-based packaging decision, not an assertion that every
possible use of provider trademarks is unlawful. Provider names remain descriptive
integration/compatibility labels, separately from the removed artwork; no
endorsement is claimed. EGO retains discretion over textual trademark references.
Older commits and previously published releases retain their historical assets;
this audit does not retroactively authorize them or rewrite public history.

## Other distributed assets

`locale/pt/LC_MESSAGES/simple-ai-usage-indicator.mo` and the `pt_BR` counterpart
are generated by `msgfmt` from `po/pt.po` and `po/pt_BR.po`. The existing sources
credit Ivo Lopes (2026) and use the project GPL license; their notices are preserved.
PO/POT sources remain in the repository, excluded from the extension ZIP. There
are no other distributed images, fonts or media. README badge images are external
links, not bundled artwork. LICENSE is the verbatim upstream GPL text, not an icon.

The symbolic variants use filled geometric paths so GNOME's symbolic SVG loader
can apply the theme foreground color. Stroke-only SVGs retained their source color
in light/dark themes; v24 retains filled symbolic paths, with the separate artwork terms above.
Black and color variants are explicitly selected custom colors.
