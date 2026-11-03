# Independent accounts

Preferences → Coding Assistants lists logical accounts, with provider, friendly
name, CLI configuration directory, enable switch, connection test, order and removal.
Use **Add account**, choose the provider, then select an existing directory for each
additional Codex/Claude account. Set a friendly name and **Save account**. A blank
directory uses the original CLI session. **Selected account** controls the existing
single-account topbar layout; the all-account layout respects the saved order.
Each popup section identifies its account; each refresh/error belongs to that instance.

The extension only monitors existing sessions. Authenticate the separate CLI directory
yourself before selecting it. It never performs login/logout, copies or deletes
credentials, or switches your primary CLI session. Removing/disabling an account only
changes the extension configuration and cancels that instance's work. For an expired
token, renew it in the corresponding CLI session yourself.

| Provider | Supported reference | Limits |
|---|---|---|
| Codex | Absolute `CODEX_HOME` directory containing `auth.json` | Existing file-backed ChatGPT OAuth credentials only. Config `--profile` is not a separate authentication store. Keyring-only/ephemeral/API-key sessions are not read by this adapter. |
| Claude Code | Absolute `CLAUDE_CONFIG_DIR` containing `.credentials.json` | Linux subscription OAuth only. Explicit accounts never fall back to `CLAUDE_CODE_OAUTH_TOKEN` or the default credentials/stats. Console profiles, API keys and custom credential helpers are outside this adapter. |
| Antigravity 1.4.12 | Original shared session | Independent consumer OAuth session selection could not be verified. Only one logical Antigravity account is permitted; a custom directory or duplicate shared session is rejected. |

Official sources checked on 2026-11-03:
[Codex authentication](https://learn.chatgpt.com/docs/auth),
[Codex state directories](https://learn.chatgpt.com/docs/config-file/config-advanced),
[Claude multiple accounts and credential storage](https://code.claude.com/docs/en/authentication),
[Claude environment variables](https://code.claude.com/docs/en/env-vars),
[Antigravity authentication](https://antigravity.google/docs/install/),
[Antigravity CLI configuration](https://antigravity.google/docs/cli/using).
Antigravity's installed `agy --help` has no account/profile credential selector;
its documented settings path and shared Secret Service login do not establish
isolation. Third-party switchers that replace the active token, copied plaintext
stores, or changing HOME while reusing the same keyring do not satisfy isolation.
An API-key/ADC session also cannot be assumed to represent consumer subscription
quotas. Multi-account Antigravity remains blocked pending a supported selector.

## Configuration contract and migration

`accounts-config` is versioned JSON `{version:1, accounts:[...]}`. Records contain
`instanceId` (stable Map key), `providerId` (adapter type), `accountId` (logical ID),
`displayName`, `enabled`, `credentialReference` (absolute directory or null). It never
contains OAuth tokens. `ProviderInstance` owns the adapter, independent cancellable,
in-flight refresh and usage/error/lastUpdated; Antigravity's cache remains per adapter.
Summary `providerId` always identifies the integration; `instanceId` identifies the
account. `id`/`name` on the wrapper are compatibility aliases for existing UI callers.

The empty default string projects the old `enabled-providers` list into the original
three stable IDs without writing, deleting preferences or requiring a new login.
The first account edit persists that projection. An explicit empty accounts list
means no monitored accounts. Malformed/unsupported configuration fails closed,
remains untouched and displays a Preferences diagnostic. Legacy keys remain for
rollback; once an explicit account list exists, its enabled flags/order govern.

Two records cannot reference the same canonical directory/provider, including a
blank default and its explicit path or a symlink to the same credential file. Use independent CLI directories; symlinked
aliases or copied sessions do not establish distinct backend accounts. Tests use
synthetic files and loopback HTTP. Two real paid accounts were not available for
end-to-end provider verification; that limitation is not a successful live test.
