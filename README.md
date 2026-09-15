# Simple AI Usage Indicator

[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%20--%2050-blue.svg)](https://extensions.gnome.org)
[![Version](https://img.shields.io/badge/version-19-green.svg)](https://github.com/ivo-lopes/simple-ai-usage-indicator/releases)
[![License](https://img.shields.io/badge/license-GPL--3.0-orange.svg)](LICENSE)

A modern, high-performance GNOME Shell extension (compatible with **GNOME Shell 45, 46, 47, 48, 49, and 50**) that monitors real-time quotas, rolling rate limits, token usage, and countdown timers for your AI coding assistants directly in the GNOME top bar and popup menu.

### Supported Coding Assistants:
- 🟢 **OpenAI Codex CLI**
- 🟣 **Claude Code** (Anthropic)
- 🔵 **Antigravity CLI** (`agy` / Google Gemini)

---

## Key Features

- **Multi-Assistant Top Panel Bar**:
  - **All Mode**: Display compact status badges for all active assistants side-by-side in the top bar with their official icons.
  - **Cycle Mode**: Show one assistant at a time with click-to-cycle functionality.
- **Scrollable Popup Menu with Pinned Footer Controls**:
  - Integrated `St.ScrollView` with dynamic monitor workarea calculations (`max-height`).
  - When all assistants are expanded, the menu scrolls smoothly with mouse wheel or touchpad.
  - **Always Visible**: The manual refresh button ("Refresh now" with last-updated timestamp) and "Settings" button remain permanently pinned at the bottom and never disappear off-screen.
- **Customizable Icon Styles (White, Black, or Vibrant Brand Colors)**:
  - **Monochrome White (Symbolic)**: Classic GNOME Shell aesthetic that blends seamlessly with dark shell themes.
  - **Monochrome Black (Black)**: Sleek high-contrast dark style, ideal for light panel themes or customized setups.
  - **Vibrant Brand Colors (Color)**: Eye-catching official brand colors (OpenAI emerald green `#10A37F`, Claude terracotta orange `#D97757`, and Google Antigravity blue).
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
  - **Claude Code**: Integrates seamlessly with OAuth credentials in `~/.claude/.credentials.json`, `~/.claude.json`, and local token caches in `~/.claude/stats-cache.json`. Supports optional custom token override in preferences.
  - **Antigravity CLI**: Directly interfaces with GNOME Keyring (`gi://Secret`, service: `gemini`, username: `antigravity`) via native GObject Introspection. No terminal wrappers or shell hacks required.
- **Real-Time Antigravity Quota Parser**:
  - Interrogates `agy --print /usage` asynchronously via non-blocking `Gio.Subprocess`.
  - Features intelligent 45-second telemetry caching to maintain instantaneous UI responsiveness without spawning extraneous processes.
- **Modern Preferences Dialog (Libadwaita / GTK4)**:
  - Configure background polling interval (60s to 3600s).
  - Select display metrics: Remaining quota (`left`), Consumed quota (`used`), or Numeric percentage (`percent`).
  - Toggle between **Monochrome White**, **Monochrome Black**, and **Vibrant Brand Colors** icon styles.
  - Toggle individual assistants on or off.
  - Interactive **Test connection** buttons for instant diagnostics.

---

## Architecture & File Structure

```
.
├── extension.js               # Top bar indicators, layout controller, and popup menu
├── prefs.js                   # Libadwaita preferences page (GTK4 / Adw)
├── constants.js               # Endpoints, schema identifiers, and display modes
├── limitReset.js              # Early quota reset detection and desktop notifications
├── resetCreditExpiry.js       # Reset credit expiration calculator
├── icons/                     # Complete white, black & colored icon sets
│   ├── codex-symbolic.svg     # Codex monochrome white icon
│   ├── codex-black.svg        # Codex monochrome black icon
│   ├── codex-color.svg        # Codex / OpenAI emerald green icon
│   ├── claude-symbolic.svg    # Claude Code white icon (UXWing)
│   ├── claude-black.svg       # Claude Code black icon (UXWing)
│   ├── claude-color.svg       # Claude Code terracotta color icon
│   ├── antigravity-symbolic.svg # Google Antigravity white icon
│   ├── antigravity-black.svg  # Google Antigravity black icon
│   └── antigravity-color.svg  # Google Antigravity official color icon
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
├── schemas/                   # GSettings schema definitions
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

### Method 1: Using gnome-extensions (Recommended)

1. Clone or copy the repository into your GNOME Shell extensions directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/simple-ai-usage-indicator@ivo-lopes.github.com
   cp -r . ~/.local/share/gnome-shell/extensions/simple-ai-usage-indicator@ivo-lopes.github.com
   ```

2. Compile the GSettings schemas:
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

You can generate a distributable zip bundle:

```bash
gnome-extensions pack --extra-source=providers/ --extra-source=icons/ --extra-source=locale/ --extra-source=constants.js --extra-source=limitReset.js --extra-source=resetCreditExpiry.js --extra-source=codexAuth.js --extra-source=usageApi.js --force
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
  - `Vibrant brand colors (Color)`: Full-color brand logos for Codex (green), Claude Code (orange), and Antigravity (blue).
- **Top bar layout**:
  - `Show all enabled assistants`: Shows multiple icons side-by-side.
  - `Cycle one at a time`: Displays a single assistant, clicking toggles to the next.
- **Assistants**: Enable or disable Codex, Claude Code, or Antigravity individually.
- **Test Connection**: Run instant diagnostics on your local token files or GNOME Keyring entries.

---

## Running the Test Suite

All provider adapters, API clients, reset logic, and HTTP endpoints are covered by automated unit tests using `gjs`:

```bash
# Run all tests
gjs -m tests/usageApi.test.js
gjs -m tests/usageApiHttp.test.js
gjs -m tests/limitReset.test.js
gjs -m tests/resetCreditExpiry.test.js
gjs -m tests/codexProvider.test.js
gjs -m tests/claudeProvider.test.js
gjs -m tests/antigravityProvider.test.js
```

---

## Privacy & Security

- **Read-only**: The extension never alters your CLI configuration files, session histories, or cloud parameters.
- **Local Secret Storage**:
  - Antigravity tokens are accessed using the native Linux Secret Service API (`libsecret` / GNOME Keyring).
  - No plain-text credentials are leaked or sent to third-party endpoints.
- **Direct Telemetry**: All requests communicate exclusively with the official API endpoints of the respective AI providers (ChatGPT, Anthropic, Google).

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
