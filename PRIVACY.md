# Privacy and provider data flow

Audited against the current source for the next release on 2026-10-05. This is Ivo
Lopes's personal project. Mindsite's Plane workspace only tracks work.

Usage and account information are displayed locally in the panel/Preferences.
There is no extension-owned analytics service, tracking SDK, centralized collection,
telemetry upload or data sale. Provider requests still disclose the credential and
request metadata to that provider; their policies govern those services. Screenshots
or user-posted diagnostics can expose account information, so sanitize them.

| Provider | Local reads | Direct network requests | Purpose |
|---|---|---|---|
| Codex CLI | `$CODEX_HOME/auth.json`, or `~/.codex/auth.json`; token, account ID, JWT expiry | `https://chatgpt.com/backend-api/wham/usage` and `/backend-api/wham/rate-limit-reset-credits` | Authorized quota/reset/credit reads; bearer token and optional ChatGPT account ID sent to ChatGPT |
| Claude Code | `~/.claude/.credentials.json`, `~/.claude.json`, `~/.claude/stats-cache.json`; optional `CLAUDE_CODE_OAUTH_TOKEN` from the GNOME process environment | `https://api.anthropic.com/api/oauth/usage` | Subscription quota with bearer OAuth token, beta and CLI User-Agent headers; local token/session statistics as fallback |
| Antigravity CLI | Preferences auth check uses Secret Service attributes `service=gemini`, `username=antigravity`; only expiry/auth-method status is displayed. Local fallback counts directory entries under `~/.gemini/antigravity-cli/brain` without reading conversations | **None directly from the extension** | Runs `agy --print /usage --print-timeout 8s --output-format json`; older CLI text fallback. The CLI owns its authentication and backend access. No UserInfo request or token read during quota refresh |

Codex/Claude endpoints are provider-specific integrations and can change; see the
open API-contract work in the backlog (SAUI-20). `ANTHROPIC_API_KEY` is not used for
the Claude subscription quota endpoint. The extension writes only ordinary display
settings to GSettings, never custom credentials. Existing CLI stores are read-only.

Automatic reads start on enable, run at the configured interval and can occur when
opening the popup. `Refresh now` and Preferences' `Test connection` force a quota
read. Preferences' initial auth checks inspect local credential availability.
Disabling a provider prevents its automatic quota reads; disabling the extension
cancels HTTP/file/Secret Service operations and terminates an active `agy` process.

Antigravity's 45-second quota cache is in memory, preserves observation time and
clears on destruction. Provider results/errors are not written as a local history.
Credentials may exist transiently in memory during their read/request; they are
not added to logs, fixtures, CI artifacts or arguments. Cancellation bounds I/O;
JavaScript does not provide guaranteed secret-memory zeroization.

[SECURITY.md](SECURITY.md) documents removal of the old Claude dconf value.
