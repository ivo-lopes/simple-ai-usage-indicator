# Disposable GNOME Shell laboratory

These are optional integration tests, separate from the deterministic unit suite.
They execute the real `gnome-shell` binary and assert its major, not a simulated
version. Build signed distro packages with pinned official Fedora image digests
from versions.json. Repository updates can change patch versions; the result JSON
records the binary actually run. Old Fedora archives are test environments only.

```sh
./package.sh
python3 tests/integration/matrix.py "$PWD/simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip" \
  --build --output /tmp/saui-matrix-NEW-DIRECTORY
```

A first build needs several GB per image and network. Execution uses `--network
none`, a read-only repository and an output mount containing only synthetic data.
It never mounts host credential directories, the host bus or the normal desktop.
The output directory is writable for rootless Docker's UID mapping; no private
account data belongs there. Use an empty directory; previous evidence is not overwritten.
`--versions 45 46` selects a subset; without `--build`, existing matching image tags
are reused. Do not fake the expected major if a distro image has upgraded.

For a locally installed Shell, use private buses and synthetic system services:

```sh
python3 tests/integration/gnome-shell-smoke.py *.shell-extension.zip \
  --expected-major 48 --isolated-system-bus \
  --login1-stub tests/integration/login1-stub.js --popup --prefs --ui \
  --monitor 800x600 --output-dir /tmp/saui-ui-NEW-DIRECTORY
```

Use `--monitor 1600x1200 --ui-scale 2` to check native St 200% theme rendering.
This changes the theme scale in the disposable compositor, not hardware DPI or a
real monitor configuration. `--ui` records light/dark/high-contrast screenshots,
all-provider bounds, panel names and native GTK Preferences focus/controls.
The test-only lab driver permits Shell Eval on the private bus; never install it
in your normal session. It is excluded from the submitted ZIP.

login1, AccountsService and localed responses are synthetic session scaffolding,
not replacements for Shell/St/GTK. A native libgnome-desktop crash before Shell
startup on 45/47 was traced to missing localed keyboard defaults; the private
locale1 stub and explicit input source avoid that lab defect. IBus is stopped
while the compositor is alive to avoid unrelated Shell-core shutdown callbacks.
The harness closes its native Preferences windows before terminating Meta.Context.
Leaving Wayland clients open during Fedora 45/Shell 51.0 headless shutdown caused
a native crash in gnome_shell_plugin_kill_window_effects after all extension
lifecycle checks passed; GDB isolated this lab teardown defect. The runner checks
the compositor exit status, so such failures cannot silently become PASS.

The synthetic agy returns a sanitized real-format fixture. The first process delays
30 seconds; disable must terminate it within five seconds. Re-enable returns JSON,
opens the actual popup, checks keyboard focus, invokes the official Preferences
window and disables again. Logs are retained under OUTPUT/cache/, including
session.stderr, shell.log, result.json, popup.json and preferences.json.
The script fails on JS errors and disposed-object warnings rather than masking them.

A lifecycle smoke validates the loaded extension with real native widgets; it does
not validate a complete GDM desktop, actual provider credentials/backend availability,
hardware HiDPI, speech output or every distro theme. Keep those separate in
PRE_SUBMISSION.md. Do not turn absent integration dependencies into PASS.
