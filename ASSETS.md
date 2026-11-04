# Asset provenance and distribution audit

## Current icon preparation

The Codex variants now use a vector adaptation of **Chat Gpt by Magnific**, downloaded
from [Flaticon icon 11865326](https://www.flaticon.com/free-icon/chat-gpt_11865326).
[Downloaded PNG](https://cdn-icons-png.flaticon.com/512/11865/11865326.png):
SHA256 `a8a35e0bbaa9171dcd64937c39aeb6fa4acfcf0b76a0830e341f2e96a5ef69f3`.
The 512-pixel silhouette was traced with VTracer's Python package 0.6.15 in binary
spline mode, fitted inside a 20×20 region of the existing 24×24 canvas, and adapted
for the existing symbolic/black/color settings. No generated/reimagined logo,
embedded raster or remote request is used at runtime. The source PNG and temporary
conversion tools are not included in the extension ZIP.

| Files | Origin | Distribution basis |
|---|---|---|
| `codex-symbolic.svg`, `codex-black.svg`, `codex-color.svg` | Chat Gpt by Magnific / Flaticon, icon 11865326; vectorized and recolored for GNOME | `LicenseRef-Flaticon-Authorized`; maintainer confirmed specific permission for the requested redistribution in the development conversation on 2026-11-03. The grant document was not supplied to this repository. This records the maintainer's confirmation, not a claim that Flaticon's standard license is GPL. |
| Three `claude-*.svg` variants | Original conversation symbol in this repository | GPL-3.0-only; unchanged pending a corresponding Flaticon asset |
| Three `antigravity-*.svg` variants | Original usage-chart symbol in this repository | GPL-3.0-only; unchanged pending a corresponding Flaticon asset |

The code remains GPL-3.0-only. Flaticon-derived artwork is separately identified and
must not be represented as original project artwork or automatically relicensed
under GPL. Its [published terms](https://www.flaticon.com/legal) and the maintainer's
specific authorization are distinct. OpenAI marks belong to their owner; descriptive
provider identification does not imply endorsement. Preferences includes a visible
source credit and link. Preserve this attribution when redistributing these files.

Validation of this partial icon preparation: all 18 GJS tests, lint, strict schemas,
Portuguese catalogs and the 37-file package inspection passed. A native GNOME 48.7
run passed popup, light/dark/high-contrast bounds, scroll, Preferences, refresh and
repeated enable/disable, with AT-SPI explicitly skipped. OpenAI artwork was visually
inspected in the native light/dark popup. This does not validate missing provider assets.

A complete three-provider icon release is pending the Claude and Google Antigravity
assets. Searches in Flaticon's catalog did not establish corresponding brand icons;
the inspected Antigravity results 17118691 and 3332592 depict levitating people.
They were not substituted for the Google product's mark. Search access was also
rejected by the site's security filter. This is not proof that no matching asset
exists in Flaticon's full catalog.

## Historical audit — 2026-10-05

The following audit describes the icons distributed before the preparation above.
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
in light/dark themes; the generic shapes and GPL provenance remain unchanged.
Black and color variants are explicitly selected custom colors.
