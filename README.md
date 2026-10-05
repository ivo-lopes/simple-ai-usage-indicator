# Simple AI Usage Indicator

[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%20--%2051-blue.svg)](https://extensions.gnome.org)
[![Version](https://img.shields.io/badge/version-21-green.svg)](https://github.com/ivo-lopes/simple-ai-usage-indicator/releases)
[![License](https://img.shields.io/badge/license-GPL--3.0-orange.svg)](LICENSE)

A GNOME Shell extension for GNOME Shell **45–51** that displays usage and quotas
for multiple AI coding assistants in the top bar and popup menu.

This is **Ivo Lopes's personal project**, derived from
[Codex Usage Indicator by stone (stonega)](https://github.com/stonega/codex-usage-indicator).
It extends the original Codex integration with Claude Code and Antigravity adapters,
provider orchestration, a scrolling popup, Portuguese translations and icon styles.
Mindsite's Plane workspace is used only for backlog tracking. This is not a
Mindsite product, service or project. See [NOTICE](NOTICE) for authorship and
license provenance.

### Supported Coding Assistants:
- 🟢 **OpenAI Codex CLI**
- 🟣 **Claude Code** (Anthropic)
- 🔵 **Antigravity CLI** (`agy` / Google Gemini)

---

## Key Features

- **Multi-Assistant Top Panel Bar**:
  - **All Mode**: Display compact status badges for all active assistants side-by-side in the top bar with original generic icons.
  - **Cycle Mode**: Show one assistant at a time with click-to-cycle functionality.
- **Scrollable Popup Menu with Pinned Footer Controls**:
  - Integrated `St.ScrollView` with dynamic monitor workarea calculations (`max-height`).
  - When all assistants are expanded, the menu scrolls smoothly with mouse wheel or touchpad.
  - **Always Visible**: The manual refresh button ("Refresh now" with last-updated timestamp) and "Settings" button remain permanently pinned at the bottom and never disappear off-screen.
- **Customizable Icon Styles (White, Black, or Color)**:
  - **Monochrome White (Symbolic)**: Classic GNOME Shell aesthetic that blends seamlessly with dark shell themes.
  - **Monochrome Black (Black)**: Sleek high-contrast dark style, ideal for light panel themes or customized setups.
  - **Color**: Distinct neutral colors for the original generic icons. These are not provider logos. See [ASSETS.md](ASSETS.md).
  - **Consistent icon dimensions**: All color variations adhere to exact dimensions, bounding boxes, and panel spacing taking the symbolic white icons as reference.
- **Internationalization (i18n)**:
  - Native Brazilian Portuguese (`pt_BR` / `pt`) translation support via GNU Gettext.
  - Automatically adheres to your desktop language.
- **Detailed Popup Menu**:
  - **5-Hour Rolling Limit Window**: Smooth Cairo-based progress bar with real-time percentage and countdown to quota reset.
  - **Weekly Quota Window**: Long-term quota capacity tracking with reset timestamps.
  - **Active Model Breakdown**: Detailed list of active models (e.g. Gemini 2.5 Pro, Claude 3.7 Sonnet, GPT-4o) with remaining capacity and token counts.
  - **Rate Limit Reset Credits & Notifications**: Tracks bonus rate-limit resets and desktop notifications whenever a quota window resets early.
- **Zero-Config Local Authentication**:
  - **Codex CLI**: Automatically discovers bearer credentials in `~/.codex/auth.json`.
  - **Claude Code**: Integrates seamlessly with OAuth credentials in `~/.claude/.credentials.json`, `~/.claude.json`, and local token caches in `~/.claude/stats-cache.json`. Uses local OAuth credentials or the session environment variable `CLAUDE_CODE_OAUTH_TOKEN`; the extension does not persist manual tokens.
  - **Antigravity CLI**: Directly interfaces with GNOME Keyring (`gi://Secret`, service: `gemini`, username: `antigravity`) via native GObject Introspection. No terminal wrappers or shell hacks required.
- **Real-Time Antigravity Quota Parser**:
  - Prioritizes `agy --print /usage --output-format json` via non-blocking `Gio.Subprocess` (verified with CLI 1.2.17).
  - Preserves every model-group bucket and backend reset timestamp; the panel uses the most constrained observed 5-hour bucket, while the popup lists them all.
  - Uses legacy text only for compatibility. Missing quota is shown as unavailable.
  - Resets outside the current local day include date and time, without assuming a fixed timezone.
  - Automatic reads can reuse a 45-second cache with the original observation time. Manual refresh bypasses it; cached/stale observations are labeled.
- **Modern Preferences Dialog (Libadwaita / GTK4)**:
  - Configure background polling interval (60s to 3600s).
  - Select display metrics: Remaining quota (`left`), Consumed quota (`used`), or Numeric percentage (`percent`).
  - Toggle between **Monochrome White**, **Monochrome Black**, and **Color** icon styles.
  - Toggle individual assistants on or off.
  - Interactive **Test connection** buttons for instant diagnostics.

---

## Architecture & File Structure

```
.
├── extension.js               # Top bar indicators, layout controller, and popup menu
├── prefs.js                   # Libadwaita preferences page (GTK4 / Adw)
├── stylesheet.css             # Panel styling ensuring icon spacing conformity
├── package.sh                 # Runtime-only packaging script and ZIP allowlist
├── constants.js               # Endpoints, schema identifiers, and display modes
├── limitReset.js              # Early quota reset detection and desktop notifications
├── resetCreditExpiry.js       # Reset credit expiration calculator
├── icons/                     # Complete white, black & colored icon sets
│   ├── codex-symbolic.svg     # Generic code symbol, white
│   ├── codex-black.svg        # Generic code symbol, black
│   ├── codex-color.svg        # Generic code symbol, colored
│   ├── claude-symbolic.svg    # Generic conversation symbol, white
│   ├── claude-black.svg       # Generic conversation symbol, black
│   ├── claude-color.svg       # Generic conversation symbol, colored
│   ├── antigravity-symbolic.svg # Generic usage chart, white
│   ├── antigravity-black.svg  # Generic usage chart, black
│   └── antigravity-color.svg  # Generic usage chart, colored
├── po/                        # GNU Gettext translation source files
│   ├── simple-ai-usage-indicator.pot # Template catalog
│   └── pt_BR.po               # Brazilian Portuguese translation
├── locale/                    # Compiled binary message catalogs (.mo)
│   └── pt_BR/LC_MESSAGES/     # Compiled simple-ai-usage-indicator.mo
├── providers/                 # Pluggable telemetry provider architecture
│   ├── baseProvider.js        # BaseProvider abstract class & UsageSummary contract
│   ├── codexProvider.js       # OpenAI Codex CLI authentication & WHAM API adapter
│   ├── claudeProvider.js      # Claude Code OAuth & local token statistics adapter
│   ├── antigravityProvider.js # Antigravity Keyring & CLI quota parser adapter
│   └── index.js               # ProviderManager orchestration & parallel polling
├── schemas/                   # GSettings schema definitions (raw XML only)
└── tests/                     # Automated unit and integration test suite
```

### Telemetry Pipeline
1. **`ProviderManager`**: Coordinates enabled providers and polls their telemetry asynchronously via `Promise.allSettled`.
2. **`BaseProvider`**: Enforces a normalized schema (`UsageSummary`), standardizing 5-hour windows, weekly limits, model statistics, and reset times across all providers.
3. **Resilience & Fallback**:
   - If Claude Code API is offline, the provider automatically falls back to reading `~/.claude/stats-cache.json` for token totals and daily model breakdowns.
   - If Antigravity CLI is offline, local session totals from `~/.gemini/antigravity-cli/brain` are displayed gracefully.

---

## Installation

### Method 1: Local Development Installation

1. Clone or copy the repository into your GNOME Shell extensions directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/simple-ai-usage-indicator@ivo-lopes.github.com
   cp -r . ~/.local/share/gnome-shell/extensions/simple-ai-usage-indicator@ivo-lopes.github.com
   ```

2. Compile the GSettings schemas locally:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/simple-ai-usage-indicator@ivo-lopes.github.com/schemas
   ```

3. Enable the extension:
   ```bash
   gnome-extensions enable simple-ai-usage-indicator@ivo-lopes.github.com
   ```

4. *(Wayland sessions)* If newly installed, log out and log back in, or restart your session so GNOME Shell discovers the new extension UUID.

---

### Method 2: Pack as Extension Zip

To generate a clean zip bundle for [GNOME Extensions (EGO)](https://extensions.gnome.org), run:

```bash
./package.sh
```

This script:
- Excludes precompiled `schemas/gschemas.compiled` and distributes the source XML schema.
- Validates the test suite.
- Re-compiles translation message catalogs (`.mo`).
- Bundles only runtime sources, nine used SVGs, compiled translations, LICENSE, NOTICE and ASSETS.md; verifies the archive.

Or manually using `gnome-extensions pack`:

```bash
rm -f schemas/gschemas.compiled
gnome-extensions pack --extra-source=providers/ --extra-source=icons/ --extra-source=locale/ --extra-source=stylesheet.css --extra-source=constants.js --extra-source=limitReset.js --extra-source=resetCreditExpiry.js --extra-source=codexAuth.js --extra-source=usageApi.js --extra-source=quotaReset.js --extra-source=LICENSE --extra-source=NOTICE --extra-source=ASSETS.md --force
```

Then install the generated archive:
```bash
gnome-extensions install --force simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip
```

---

## Configuration & Preferences

Open preferences from your terminal or through the GNOME Extensions application:

```bash
gnome-extensions prefs simple-ai-usage-indicator@ivo-lopes.github.com
```

### Available Settings:
- **Update interval**: Set how frequently (in seconds) the extension fetches fresh quotas in the background (default: 300 seconds).
- **Display mode**:
  - `Remaining quota (left)`: e.g. `74% left`
  - `Consumed quota (used)`: e.g. `26% used`
  - `Percentage (%)`: e.g. `74%`
- **Icon style**:
  - `Monochrome white (Symbolic)`: Clean white icons.
  - `Monochrome black (Black)`: High-contrast black icons.
  - `Colored icons (Color)`: Original generic code, conversation and usage-chart symbols.
- **Top bar layout**:
  - `Show all enabled assistants`: Shows multiple icons side-by-side.
  - `Cycle one at a time`: Displays a single assistant, clicking toggles to the next.
- **Assistants**: Enable or disable Codex, Claude Code, or Antigravity individually.
- **Test Connection**: Run instant diagnostics on your local token files or GNOME Keyring entries.

---

## Running the Test Suite

The default suite uses injected credentials/clients, synthetic fixtures and
loopback HTTP. It does not read personal credentials, contact Keyring, invoke
installed AI CLIs or require internet. Packaging runs every `tests/*.test.js`.

```bash
for test in tests/*.test.js; do gjs -m "$test"; done
```

CI runs the same validation on every push and pull request and uploads the ZIP
as an artifact, without publishing releases. Install development lint tools with
`npm ci --ignore-scripts`, then run `npm run lint` and `./scripts/validate.sh`.
System dependencies: GJS, GNOME Shell packaging tools, libsecret/Soup 3 GI
bindings, GLib tools, gettext, unzip, Python 3 and Node.js 22 (CI).

ESLint's flat config was evaluated, but its dependency tree is unnecessary here.
Oxlint 1.87.0 has no JavaScript dependencies and one installed platform binding;
it checks syntax/correctness and undeclared variables with explicit GJS globals,
without formatter rules or runtime dependencies. `node --check` also validates
all tracked ES modules without executing their GI/resource imports.

Optional real GNOME integration is separate:

```bash
python3 tests/integration/gnome-shell-smoke.py simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip
```

It requires Linux, a usable headless GNOME Shell and D-Bus. It uses isolated XDG
and D-Bus state plus a synthetic `agy` executable to test disable during refresh
and repeated enable/disable; evidence is left in the reported temporary directory.
It is not part of the normal CI suite and does not change the desktop extension.

---

## Privacy & Security

- **Read-only**: The extension never alters your CLI configuration files, session histories, or cloud parameters.
- **Local Secret Storage**:
  - Antigravity tokens are accessed using the native Linux Secret Service API (`libsecret` / GNOME Keyring).
  - Quota fixtures contain synthetic values and no credentials.
- **Direct Telemetry**: All requests communicate exclusively with the official API endpoints of the respective AI providers (ChatGPT, Anthropic, Google).

---

## License

This fork is distributed under [GNU GPL version 3](LICENSE), SPDX `GPL-3.0-only`.
The complete license was copied from upstream commit `ebf5609` (2026-09-16),
after the shared ancestor `f2bd496`. [NOTICE](NOTICE) records that history and
attributes the inherited code without inventing copyright notices. The source
and translation catalogs are available in this repository.

## Removing a legacy Claude token

Versions through v21 offered a manual Claude token field stored in GSettings/dconf.
The field and schema key have been removed. The extension neither reads nor
migrates the old value; existing non-secret settings and the schema ID are unchanged.
To delete that legacy value without displaying it, run:

```bash
dconf reset /org/gnome/shell/extensions/simple-ai-usage-indicator/claude-token
```

Use `claude login` for the local OAuth credential. If needed,
`CLAUDE_CODE_OAUTH_TOKEN` must be present in the GNOME Shell/preferences process
environment, not just a terminal. `~/.claude.json` account metadata alone does
not establish authentication. `ANTHROPIC_API_KEY` authenticates the Anthropic
inference API, not this subscription OAuth quota endpoint, and is not used here.

GNOME 51 menu orientation is adapted from upstream and tested against old,
transitional and new St APIs. Isolated lifecycle smoke tests passed on GNOME
48.7 and 51.0 with synthetic quotas. The 51.0 container used a private system
bus with synthetic login1 responses; this does not validate a complete desktop
session. Real lifecycle tests on 45/46/47/49/50 and the full theme/accessibility
matrix remain NOT TESTED; see HARDENING.md.

To reproduce the optional Fedora 45/GNOME 51 container lab:

```bash
docker build --network host -f tests/integration/Containerfile -t saui-gnome51-lab tests/integration
docker run --rm --network none --mount type=bind,src="$PWD",dst=/saui,readonly saui-gnome51-lab python3 /saui/tests/integration/gnome-shell-smoke.py /saui/simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip --expected-major 51 --isolated-system-bus --login1-stub /saui/tests/integration/login1-stub.js --prefs
```

Only the lab build needs network. Runtime is isolated and does not mount the host
system bus or credential directories. The base image is pinned; installed distro
package updates may change the resulting Shell version, which the smoke verifies.
