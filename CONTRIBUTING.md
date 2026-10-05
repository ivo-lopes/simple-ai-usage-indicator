# Contributing

This is Ivo Lopes's personal GPL-3.0-only project. Keep changes focused and preserve
upstream attribution in NOTICE. Read [UPSTREAM.md](UPSTREAM.md) before a release.

Install Node.js/npm, Python 3, GJS, GNOME Shell's `gnome-extensions` tool, gettext,
GLib schema tools, unzip, libsecret introspection and Soup 3 introspection. On
Debian/Ubuntu the relevant packages include `gjs gnome-shell gir1.2-secret-1
 gir1.2-soup-3.0 libglib2.0-bin gettext unzip python3 nodejs npm`.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
./scripts/validate.sh
```

Validation checks syntax, schemas, whitespace, translations, every `tests/*.test.js`,
packaging and the ZIP inspector. Individual unit tests use `gjs -m tests/NAME.test.js`.
Unit tests use synthetic files, dependency injection and loopback HTTP; they need
no credentials, provider CLI, Keyring or internet. Packaging compiles the catalogs
before testing. Use `msgmerge --backup=none` when updating PO files; do not commit
editor/gettext backups. `msgfmt -c` and `scripts/check-translations.py` must pass.

The tests in `tests/integration/` are optional real-Shell laboratory tests. Use the
matrix procedure documented there; build dependencies may require network, while
container execution uses `--network none`. Private homes, XDG directories and buses
prevent access to host account credentials. Do not run the lab driver in your
normal desktop session. Keep lifecycle smoke distinct from interactive desktop QA.

Never include tokens, cookies, private CLI conversations or credential files in
fixtures, logs, screenshots, Issues or artifacts. Report vulnerabilities using
[SECURITY.md](SECURITY.md). Prefer native GNOME widgets and small changes that are
straightforward to review. Test delayed callbacks during disable and preserve
separation between Shell and Preferences imports.

Follow [docs/RELEASING.md](docs/RELEASING.md) for GitHub releases and the
[pre-submission checklist](docs/EGO-CHECKLIST.md) for manual EGO preparation.
