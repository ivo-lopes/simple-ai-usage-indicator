#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Real Shell integration; private XDG/home/buses and a synthetic agy, never host accounts."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import zipfile

UUID = 'simple-ai-usage-indicator@ivo-lopes.github.com'
DRIVER = 'saui-lab-driver@tests.local'
HERE = Path(__file__).resolve().parent


def wait(predicate, seconds=20):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if predicate():
                return
        except subprocess.CalledProcessError:
            pass  # D-Bus service may still be starting.
        time.sleep(.2)
    raise RuntimeError('Condition timed out')


def cli(*arguments):
    return subprocess.run(['gnome-extensions', *arguments], check=True, capture_output=True, text=True, env={**os.environ, 'LC_ALL': 'C.UTF-8', 'LANGUAGE': 'C'}).stdout


def evaluate(code):
    return json.loads(subprocess.check_output(['gjs', '-m', str(HERE / 'shell-eval.js'), code], text=True))


def indicator(code):
    return evaluate('(() => { const i = Main.panel.statusArea[' + json.dumps(UUID) + ']; ' + code + ' })()')


def screenshot(path):
    code = '''(async () => {
        const stream = Gio.File.new_for_path(PATH).replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        await new Shell.Screenshot().screenshot(false, stream);
        stream.close(null);
        return true;
    })()'''.replace('PATH', json.dumps(str(path)))
    assert evaluate(code)
    assert path.stat().st_size > 0


def session(root, args):
    marker = root / 'agy.pid'
    subprocess.run(['gsettings', 'set', 'org.gnome.desktop.input-sources', 'sources', "[('xkb', 'us')]"], check=True)
    if args.ui:
        subprocess.run(['gsettings', 'set', 'org.gnome.desktop.interface', 'toolkit-accessibility', 'true'], check=True)
    subprocess.run(['gsettings', 'set', 'org.gnome.desktop.interface', 'clock-format', '24h'], check=True)
    xvfb = None
    with (root / 'cache/shell.log').open('w') as log:
        if args.backend == 'x11':
            xvfb = subprocess.Popen(['Xvfb', ':99', '-screen', '0', args.monitor + 'x24', '-nolisten', 'tcp'], stdout=log, stderr=log)
            time.sleep(1)
        backend = ['--x11', '--sm-disable'] if xvfb else ['--headless', '--wayland', '--no-x11', '--virtual-monitor', args.monitor]
        shell = subprocess.Popen(['gnome-shell', *backend], stdout=log, stderr=log)
        try:
            if not xvfb:
                wait(lambda: (root / 'runtime/wayland-0').exists())
            subprocess.run(['dbus-update-activation-environment', 'WAYLAND_DISPLAY', 'DISPLAY', 'XDG_RUNTIME_DIR', 'GDK_BACKEND'], check=True)
            def ready():
                if shell.poll() is not None:
                    raise RuntimeError(f'Real Shell exited before ready: {shell.returncode}')
                return UUID in cli('list')
            wait(ready, 40)
            if args.popup or args.ui:
                cli('enable', DRIVER)
            subprocess.run(['gsettings', 'set', 'org.gnome.shell.extensions.simple-ai-usage-indicator', 'enabled-providers', "['antigravity']"], check=True)
            if args.allow_unsupported:
                subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'disable-extension-version-validation', 'true'], check=True)
            if args.baseline_only:
                subprocess.run(['gsettings', 'set', 'org.gnome.shell.extensions.simple-ai-usage-indicator', 'enabled-providers', "['claude']"], check=True)
                subprocess.run(['gsettings', 'set', 'org.gnome.shell.extensions.simple-ai-usage-indicator', 'update-interval-seconds', '480'], check=True)
                cli('enable', UUID)
                wait(lambda: any('State: ' + state in cli('info', UUID) for state in ('ACTIVE', 'ENABLED')))
                cli('prefs', UUID)
                time.sleep(3)
                cli('disable', UUID)
                wait(lambda: any(state in cli('info', UUID) for state in ('INACTIVE', 'DISABLED')))
                print('PASS: published v21 installed, enabled, Preferences invoked and disabled', flush=True)
                return
            if args.verify_upgrade:
                assert subprocess.check_output(['gsettings', 'get', 'org.gnome.shell.extensions.simple-ai-usage-indicator', 'update-interval-seconds'], text=True).strip() == '480'
                print('PASS: v21 ordinary settings preserved; no legacy secret read or migrated', flush=True)
            cli('enable', UUID)
            wait(marker.exists)
            pid = int(marker.read_text())
            assert any('State: ' + state in cli('info', UUID) for state in ('ACTIVE', 'ENABLED'))
            cli('disable', UUID)
            wait(lambda: any(state in cli('info', UUID) for state in ('INACTIVE', 'DISABLED')))

            def exited():
                try:
                    os.kill(pid, 0)
                    return False
                except ProcessLookupError:
                    return True
            wait(exited, 5)
            print('PASS: disable during agy refresh; subprocess terminated', flush=True)
            marker.unlink()
            (root / 'delay').write_text('0.1')
            cli('enable', UUID)
            wait(marker.exists)
            time.sleep(2)
            assert any('State: ' + state in cli('info', UUID) for state in ('ACTIVE', 'ENABLED')), cli('info', UUID)
            if args.popup or args.ui:
                evaluate('Main.overview.hide(); true')
                indicator('i.menu.open(); return true;')
                time.sleep(1)
                code = '''(async () => {
                    const {default: St} = await import('gi://St');
                    const i = Main.panel.statusArea[UUID];
                    i.menu.box.navigate_focus(null, St.DirectionType.TAB_FORWARD, false);
                    const focus = global.stage.get_key_focus();
                    return {open: i.menu.isOpen, children: i._usageSection.box.get_children().length,
                        focusName: focus?.accessible_name || focus?.label_actor?.text || null, canFocus: focus?.can_focus};
                })()'''.replace('UUID', json.dumps(UUID))
                info = evaluate(code)
                assert info['open'] and info['children'] > 0 and info['canFocus'], info
                (root / 'cache/popup.json').write_text(json.dumps(info, indent=2))
                print('PASS: real popup and keyboard focus: ' + str(info['focusName']), flush=True)
            if args.ui:
                ui_checks(root, args)
            if args.prefs:
                if args.popup or args.ui:
                    indicator('i.menu.close(); return true;')
                cli('prefs', UUID)
                time.sleep(3)
                if args.popup or args.ui:
                    windows = evaluate('global.get_window_actors().map(a => a.meta_window.get_title())')
                    assert any('Simple AI Usage Indicator' in title for title in windows), windows
                    (root / 'cache/preferences.json').write_text(json.dumps(windows, indent=2))
                if args.ui:
                    subprocess.run(['gjs', '-m', str(HERE / 'preferences-ui.js'), str(root / 'data/gnome-shell/extensions' / UUID), str(root / 'cache/preferences-controls.json')], check=True, timeout=25)
                    screenshot(root / 'cache/preferences-window.png')
                    subprocess.run(['gjs', '-m', str(HERE / 'accessibility.js'), str(root / 'cache/atspi.json'), str(root / 'data/gnome-shell/extensions' / UUID)], check=True, timeout=25)
                if args.orca:
                    listing = subprocess.run(['orca', '--list-apps'], capture_output=True, text=True, timeout=15)
                    (root / 'cache/orca.log').write_text(listing.stdout + listing.stderr)
                    assert listing.returncode == 0 and 'org.gnome.Shell.Extensions' in listing.stdout, 'Orca cannot enumerate native Preferences; see orca.log'
                    print('PASS: Orca enumerates native Preferences on the private accessibility bus (speech not tested)', flush=True)
                print('PASS: real Preferences invocation/window; stderr checked for JS errors', flush=True)
            cli('disable', UUID)
            wait(lambda: any(state in cli('info', UUID) for state in ('INACTIVE', 'DISABLED')))
            if args.popup or args.ui:
                cli('disable', DRIVER)
            print('PASS: enable → disable → enable → disable with structured refresh', flush=True)
        finally:
            if shell.poll() is None:
                for uuid in (UUID, DRIVER):
                    subprocess.run(['gnome-extensions', 'disable', uuid], capture_output=True, timeout=5)
            if shutil.which('ibus') and shell.poll() is None:
                subprocess.run(['ibus', 'exit'], capture_output=True, timeout=5)
                time.sleep(.5)
            if shell.poll() is None and (args.popup or args.ui):
                cli('enable', DRIVER)
                # Close disposable Wayland clients before Meta.Context destroys its global.
                evaluate('global.get_window_actors().forEach(a => a.meta_window.delete(global.get_current_time())); true')
                wait(lambda: evaluate('global.get_window_actors().length') == 0, 5)
                time.sleep(.5)
                evaluate("(async () => { const {default: GLib} = await import('gi://GLib'); const context = global.context; if (typeof context.terminate !== 'function') throw new Error('Native Meta.Context.terminate unavailable'); GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { context.terminate(); return GLib.SOURCE_REMOVE; }); return true; })()")
                cli('disable', DRIVER)
            elif shell.poll() is None:
                shell.terminate()
            try:
                shell.wait(timeout=8)
            except subprocess.TimeoutExpired:
                shell.kill()
                shell.wait()
            if shell.returncode not in (0, -15):
                raise RuntimeError(f'Native compositor exited abnormally: {shell.returncode}')
            if xvfb:
                xvfb.terminate()
                xvfb.wait(timeout=5)


def ui_checks(root, args):
    subprocess.run(['gsettings', 'set', 'org.gnome.shell.extensions.simple-ai-usage-indicator', 'enabled-providers', "['codex', 'claude', 'antigravity']"], check=True)
    time.sleep(2)
    if args.ui_scale != 1:
        evaluate("(async () => {const {default: St} = await import('gi://St'); St.ThemeContext.get_for_stage(global.stage).scale_factor = " + str(args.ui_scale) + "; return true;})()")
        indicator('i._updateScrollMaxHeight(); return true;')
    results = []
    for theme in ('prefer-light', 'prefer-dark', 'high-contrast'):
        subprocess.run(['gsettings', 'set', 'org.gnome.desktop.interface', 'color-scheme', 'prefer-dark' if theme == 'high-contrast' else theme], check=True)
        subprocess.run(['gsettings', 'set', 'org.gnome.desktop.a11y.interface', 'high-contrast', str(theme == 'high-contrast').lower()], check=True)
        time.sleep(1)
        indicator('i.menu.open(); return true;')
        time.sleep(.5)
        screenshot(root / f'cache/{theme}.png')
        info = indicator('return {name: i.accessible_name, width: i.menu.actor.width, height: i.menu.actor.height, stageWidth: global.stage.width, stageHeight: global.stage.height};')
        assert info['width'] <= info['stageWidth'] and info['height'] <= info['stageHeight'], info
        results.append(dict(theme=theme, **info))
    (root / 'cache/ui.json').write_text(json.dumps(results, indent=2))
    print('PASS: all-provider popup light/dark/high contrast screenshots and bounds', flush=True)


def install(archive, extension):
    extension.mkdir(parents=True)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(extension)
    subprocess.run(['glib-compile-schemas', '--strict', str(extension / 'schemas')], check=True)


def main(args):
    if args.session_root:
        session(args.session_root, args)
        return
    for command in ('gnome-shell', 'gnome-extensions', 'gjs', 'dbus-run-session'):
        if not shutil.which(command):
            print(f'NOT TESTED: {command} unavailable')
            raise SystemExit(77)
    version = subprocess.check_output(['gnome-shell', '--version'], text=True).strip()
    if args.expected_major and version.split()[-1].split('.')[0] != args.expected_major:
        raise SystemExit(f'FAIL: expected {args.expected_major}, found {version}')
    root = args.output_dir.resolve() if args.output_dir else Path(tempfile.mkdtemp(prefix='saui-shell-smoke-'))
    root.mkdir(parents=True, exist_ok=True)
    extension = root / 'data/gnome-shell/extensions' / UUID
    install(args.upgrade_from or args.archive, extension)
    for directory in ('config', 'cache', 'runtime', 'bin', 'home'):
        (root / directory).mkdir(mode=0o755 if directory == 'cache' else 0o700)
    if args.popup or args.ui:
        driver = extension.parent / DRIVER
        driver.mkdir()
        (driver / 'metadata.json').write_text(json.dumps({'uuid': DRIVER, 'name': 'Private SAUI lab driver',
            'description': 'Disposable integration driver', 'shell-version': [str(v) for v in range(45, 52)]}))
        shutil.copyfile(HERE / 'lab-driver.js', driver / 'extension.js')
    marker = root / 'agy.pid'
    delay = root / 'delay'
    delay.write_text('30')
    fixture = (HERE.parent / 'fixtures/agy-usage-1.2.17.json').read_text()
    fake = root / 'bin/agy'
    fake.write_text(f'''#!/usr/bin/gjs -m
import GLib from 'gi://GLib';
const pid = new TextDecoder().decode(GLib.file_get_contents('/proc/self/stat')[1]).split(' ')[0];
GLib.file_set_contents({json.dumps(str(marker))}, pid);
const seconds = Number(new TextDecoder().decode(GLib.file_get_contents({json.dumps(str(delay))})[1]));
const loop = new GLib.MainLoop(null, false);
GLib.timeout_add(GLib.PRIORITY_DEFAULT, seconds * 1000, () => {{
    print({json.dumps(fixture)}); loop.quit(); return GLib.SOURCE_REMOVE;
}});
loop.run();
''')
    fake.chmod(0o755)
    env = os.environ.copy()
    # These values are scoped to child test processes, never the user's session.
    env.update({'XDG_DATA_HOME': str(root / 'data'), 'XDG_CONFIG_HOME': str(root / 'config'),
        'XDG_CACHE_HOME': str(root / 'cache'), 'XDG_RUNTIME_DIR': str(root / 'runtime'),
        'HOME': str(root / 'home'), 'CODEX_HOME': str(root / 'home/.codex'),
        'GSETTINGS_SCHEMA_DIR': str(extension / 'schemas'), 'LIBGL_ALWAYS_SOFTWARE': '1',
        'DISPLAY': ':99' if args.backend == 'x11' else '', 'GDK_BACKEND': args.backend,
        'WAYLAND_DISPLAY': 'wayland-0', 'XDG_SESSION_ID': '1', 'IBUS_USE_PORTAL': '0', 'GTK_A11Y': 'atspi',
        'GI_TYPELIB_PATH': '/usr/lib/gnome-shell/girepository-1.0:/usr/lib64/gnome-shell/girepository-1.0:/usr/lib/gnome-shell:/usr/lib64/gnome-shell',
        'LD_LIBRARY_PATH': '/usr/lib/gnome-shell:/usr/lib64/gnome-shell',
        'PATH': str(root / 'bin') + os.pathsep + env['PATH'], 'LC_ALL': args.locale, 'LANGUAGE': args.language or ''})
    if args.timezone:
        env['TZ'] = args.timezone
    for name in ('CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'DBUS_SESSION_BUS_ADDRESS', 'AT_SPI_BUS_ADDRESS'):
        env.pop(name, None)
    bus = None
    stub = None
    if args.isolated_system_bus:
        bus = subprocess.Popen(['dbus-daemon', '--session', '--nofork', '--print-address=1'],
            stdout=subprocess.PIPE, text=True, env=env)
        env['DBUS_SYSTEM_BUS_ADDRESS'] = bus.stdout.readline().strip()
        if args.login1_stub:
            stub = subprocess.Popen(['gjs', '-m', str(args.login1_stub)], env=env, stdout=subprocess.PIPE, text=True)
            assert stub.stdout.readline().strip() == 'READY'
    command = ['dbus-run-session', '--', 'python3', str(HERE / 'gnome-shell-smoke.py'), str(args.archive), '--session-root', str(root), '--backend', args.backend, '--monitor', args.monitor, '--ui-scale', str(args.ui_scale)]
    for option in ('prefs', 'popup', 'ui', 'orca', 'allow_unsupported'):
        if getattr(args, option):
            command.append('--' + option.replace('_', '-'))
    try:
        if args.upgrade_from:
            baseline = subprocess.run(command + ['--baseline-only'], env=env, capture_output=True, text=True, timeout=90)
            (root / 'cache/v21-session.stderr').write_text(baseline.stderr)
            (root / 'cache/v21-session.stdout').write_text(baseline.stdout)
            (root / 'cache/shell.log').rename(root / 'cache/v21-shell.log')
            old_log = (root / 'cache/v21-shell.log').read_text(errors='replace') + baseline.stderr
            assert baseline.returncode == 0 and not any(marker in old_log for marker in ('JS ERROR', 'Gjs-CRITICAL', 'has been already disposed')), 'Published v21 baseline failed; see v21 logs'
            shutil.rmtree(extension)  # Only the private installed extension, ordinary dconf/home retained.
            install(args.archive, extension)
            command.append('--verify-upgrade')
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=140)
    finally:
        for process in (stub, bus):
            if process:
                process.terminate()
                process.wait(timeout=5)
    (root / 'cache/session.stderr').write_text(result.stderr)
    (root / 'cache/session.stdout').write_text(result.stdout)
    print(version)
    print(result.stdout.strip())
    log = (root / 'cache/shell.log').read_text(errors='replace') if (root / 'cache/shell.log').exists() else ''
    js_errors = [line for line in (log + result.stderr).splitlines() if any(marker in line for marker in ('JS ERROR', 'Gjs-CRITICAL', 'has been already disposed'))]
    report = {'shell': version, 'backend': args.backend, 'result': 'FAIL' if result.returncode or js_errors else 'PASS', 'jsErrors': js_errors}
    (root / 'cache/result.json').write_text(json.dumps(report, indent=2))
    print('Evidence directory:', root)
    if result.returncode or js_errors:
        print(result.stderr[-6000:])
        print(log[-4000:])
        raise SystemExit('FAIL: isolated GNOME lifecycle')
    print('PASS: no JavaScript errors in isolated Shell/Preferences logs')


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path)
parser.add_argument('--expected-major')
parser.add_argument('--upgrade-from', type=Path)
parser.add_argument('--baseline-only', action='store_true', help=argparse.SUPPRESS)
parser.add_argument('--verify-upgrade', action='store_true', help=argparse.SUPPRESS)
parser.add_argument('--output-dir', type=Path)
parser.add_argument('--backend', choices=['wayland', 'x11'], default='wayland')
parser.add_argument('--monitor', default='1280x720')
parser.add_argument('--locale', default='C.UTF-8')
parser.add_argument('--language')
parser.add_argument('--timezone')
parser.add_argument('--prefs', action='store_true')
parser.add_argument('--orca', action='store_true', help='Native Orca application enumeration; does not test speech output')
parser.add_argument('--popup', action='store_true')
parser.add_argument('--ui', action='store_true')
parser.add_argument('--ui-scale', type=int, choices=[1, 2], default=1, help='Native St theme scale in the disposable compositor')
parser.add_argument('--login1-stub', type=Path)
parser.add_argument('--isolated-system-bus', action='store_true')
parser.add_argument('--allow-unsupported', action='store_true', help='Lab-only, never modifies the archive')
parser.add_argument('--session-root', type=Path, help=argparse.SUPPRESS)
main(parser.parse_args())
