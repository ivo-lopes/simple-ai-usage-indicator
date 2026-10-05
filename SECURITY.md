# Security

Use [GitHub private vulnerability reporting](https://github.com/ivo-lopes/simple-ai-usage-indicator/security/advisories/new).
Include the affected tag/commit, GNOME/provider versions, impact and a reproduction
using synthetic values. Never submit tokens, cookies, credential files or Keyring
contents, including in a private report. Public Issues are for sanitized ordinary bugs.

The current `main` branch and latest public GitHub release are maintained. Fixes
are delivered in a subsequent release; older releases have no promised backports.
`v22` is the current public release and includes the credential/lifecycle hardening
described below. It does not retroactively change the v21 ZIP.

The extension reads existing CLI credential stores and uses credentials in memory
for the provider's quota request. It does not refresh tokens, persist custom tokens
or create its own credential store. CLI-managed files may themselves contain
plaintext secrets; their security remains the CLI/user's responsibility. See
[PRIVACY.md](PRIVACY.md) for the exact paths, endpoints and data flow.

Versions through v21 offered a Claude token field stored in dconf. Version v22
removes that field and schema key. Removing the key does not erase an old dconf
value. To discard it without reading or printing the secret:

```sh
dconf reset /org/gnome/shell/extensions/simple-ai-usage-indicator/claude-token
```

Do not paste `dconf dump`, credential file contents or a token into an Issue.
Requests use HTTPS, cancellation and bounded timeouts. The Antigravity executable
runs directly without a shell and is terminated during disable; no bearer token
is passed in its arguments. Error messages avoid response bodies and secrets.
