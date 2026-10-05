#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Optional Linux/GNOME integration test; isolated XDG/D-Bus, synthetic agy only."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--expected-major')
parser.add_argument('--allow-unsupported', action='store_true', help='Lab-only version validation bypass, never changes the ZIP')
args = parser.parse_args()
for command in ('gnome-shell', 'gnome-extensions', 'gjs', 'dbus-run-session'):
    if not shutil.which(command):
        print(f'NOT TESTED: {command} unavailable')
        raise SystemExit(77)
version = subprocess.check_output(['gnome-shell', '--version'], text=True).strip()
if args.expected_major and version.split()[-1].split('.')[0] != args.expected_major:
    raise SystemExit(f'FAIL: expected GNOME {args.expected_major}, found {version}')
root = Path(tempfile.mkdtemp(prefix='saui-shell-smoke-'))
uuid = 'simple-ai-usage-indicator@ivo-lopes.github.com'
ext = root / 'data/gnome-shell/extensions' / uuid
ext.mkdir(parents=True)
with zipfile.ZipFile(args.archive) as archive:
    archive.extractall(ext)
subprocess.run(['glib-compile-schemas', '--strict', str(ext / 'schemas')], check=True)
(root / 'config').mkdir()
(root / 'cache').mkdir()
(root / 'runtime').mkdir(mode=0o700)
(root / 'bin').mkdir()
fixture = Path(__file__).resolve().parents[1] / 'fixtures/agy-usage-1.2.17.json'
marker = root / 'agy.pid'
delay = root / 'delay'
delay.write_text('30')
fake = root / 'bin/agy'
fake.write_text(f'''#!/usr/bin/gjs -m
import GLib from 'gi://GLib';
const pid = new TextDecoder().decode(GLib.file_get_contents('/proc/self/stat')[1]).split(' ')[0];
GLib.file_set_contents({json.dumps(str(marker))}, pid);
const seconds = Number(new TextDecoder().decode(GLib.file_get_contents({json.dumps(str(delay))})[1]));
const loop = new GLib.MainLoop(null, false);
GLib.timeout_add(GLib.PRIORITY_DEFAULT, seconds * 1000, () => {{
    print({json.dumps(fixture.read_text())});
    loop.quit();
    return GLib.SOURCE_REMOVE;
}});
loop.run();
''')
fake.chmod(0o755)
script = root / 'session.py'
script.write_text(f'''
import os, pathlib, subprocess, time
root = pathlib.Path({str(root)!r})
uuid = {uuid!r}
marker = root / 'agy.pid'
def cli(*args):
    return subprocess.run(['gnome-extensions', *args], check=True, capture_output=True, text=True).stdout
def wait(predicate, seconds=15):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if predicate(): return
        time.sleep(.2)
    raise RuntimeError('Condition timed out')
def inactive():
    return 'INACTIVE' in cli('info', uuid)
with (root / 'cache/shell.log').open('w') as log:
    shell = subprocess.Popen(['gnome-shell', '--headless', '--wayland', '--no-x11', '--virtual-monitor', '1280x720'], stdout=log, stderr=log)
    try:
        wait(lambda: uuid in cli('list'), 25)
        subprocess.run(['gsettings', 'set', 'org.gnome.shell.extensions.simple-ai-usage-indicator', 'enabled-providers', "['antigravity']"], check=True)
        if {args.allow_unsupported!r}:
            subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'disable-extension-version-validation', 'true'], check=True)
        cli('enable', uuid)
        wait(marker.exists)
        pid = int(marker.read_text())
        assert 'ACTIVE' in cli('info', uuid)
        cli('disable', uuid)
        wait(inactive)
        def exited():
            try: os.kill(pid, 0); return False
            except ProcessLookupError: return True
        wait(exited, 5)
        print('PASS: disable during agy refresh; subprocess terminated')
        marker.unlink()
        (root / 'delay').write_text('0.1')
        cli('enable', uuid)
        wait(marker.exists)
        time.sleep(2)
        assert 'State: ACTIVE' in cli('info', uuid), cli('info', uuid)
        cli('disable', uuid)
        wait(inactive)
        print('PASS: enable → disable → enable → disable with completed structured quota refresh')
    finally:
        shell.terminate()
        try: shell.wait(timeout=8)
        except subprocess.TimeoutExpired: shell.kill(); shell.wait()
''')
env = os.environ.copy()
env.update({
    'XDG_DATA_HOME': str(root / 'data'), 'XDG_CONFIG_HOME': str(root / 'config'),
    'XDG_CACHE_HOME': str(root / 'cache'), 'XDG_RUNTIME_DIR': str(root / 'runtime'),
    'GSETTINGS_SCHEMA_DIR': str(ext / 'schemas'), 'LIBGL_ALWAYS_SOFTWARE': '1',
    'PATH': str(root / 'bin') + os.pathsep + env['PATH'], 'LC_ALL': 'C.UTF-8',
})
result = subprocess.run(['dbus-run-session', '--', 'python3', str(script)], env=env,
                        capture_output=True, text=True, timeout=65)
print(version)
print(result.stdout.strip())
log = (root / 'cache/shell.log').read_text(errors='replace')
js_errors = [line for line in log.splitlines() if 'JS ERROR' in line or 'JS CRITICAL' in line]
print('Evidence directory:', root)
if result.returncode or js_errors:
    print(result.stderr[-3000:])
    print('\n'.join(js_errors))
    raise SystemExit('FAIL: isolated GNOME lifecycle')
print('PASS: no JavaScript errors in isolated Shell log')
