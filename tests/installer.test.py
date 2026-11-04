#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Controlled installer tests: real ZIP/hash/schemas/GSettings; fake Shell/network CLI."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent.parent
UUID = 'simple-ai-usage-indicator@ivo-lopes.github.com'
BUNDLE = UUID + '.shell-extension.zip'
SCHEMA = 'org.gnome.shell.extensions.simple-ai-usage-indicator'


class InstallerTests(unittest.TestCase):
    def setUp(self):
        if os.geteuid() == 0:
            self.skipTest('User installation tests require a non-root user')
        self.temp = tempfile.TemporaryDirectory(prefix='saui installer ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ('bin', 'home', 'data', 'config', 'cache'):
            (self.root / name).mkdir()
        self.env = {**os.environ, 'HOME': str(self.root / 'home'),
                    'XDG_DATA_HOME': str(self.root / 'data'), 'XDG_CONFIG_HOME': str(self.root / 'config'),
                    'XDG_CACHE_HOME': str(self.root / 'cache'), 'GSETTINGS_BACKEND': 'keyfile',
                    'PATH': str(self.root / 'bin') + os.pathsep + os.environ['PATH'],
                    'SAUI_TEST_ROOT': str(self.root), 'LC_ALL': 'C.UTF-8'}
        for name in ('GSETTINGS_SCHEMA_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'CODEX_HOME',
                     'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'):
            self.env.pop(name, None)
        self.destination = self.root / 'data/gnome-shell/extensions' / UUID
        self.archive = self.root / BUNDLE
        self.checksums = self.root / 'SHA256SUMS'
        self.fake('gnome-shell', '#!/bin/sh\nprintf "GNOME Shell 48.7\\n"\n')
        self.fake('gnome-extensions', '''#!/usr/bin/env python3
import os, pathlib, sys
p = pathlib.Path(os.environ['SAUI_TEST_ROOT']) / 'cli.log'
with p.open('a') as f: f.write(' '.join(sys.argv[1:]) + '\\n')
if sys.argv[1] == 'enable' and os.environ.get('SAUI_ENABLE_FAIL'): raise SystemExit(1)
raise SystemExit(0 if os.environ.get('SAUI_KNOWN') else 1)
''')
        self.fake('curl', '''#!/usr/bin/env python3
import os, pathlib, sys
root = pathlib.Path(os.environ['SAUI_TEST_ROOT']); args = sys.argv[1:]
url = next(x for x in args if x.startswith('https://'))
with (root / 'network.log').open('a') as f: f.write(url + '\\n')
out = pathlib.Path(args[args.index('--output') + 1])
if url.endswith('/releases/latest'): out.write_text('{"tag_name":"v25"}')
elif '/releases/download/v25/' in url: out.write_bytes((root / url.rsplit('/', 1)[1]).read_bytes())
else: raise SystemExit(22)
''')
        self.make_archive()
        self.settings('s.set_strv("enabled-extensions", ["other@one", "other@two"]);'
                      f's.set_strv("disabled-extensions", ["{UUID}", "other@disabled"]);')

    def fake(self, name, content):
        path = self.root / 'bin' / name
        path.write_text(content)
        path.chmod(0o755)

    def settings(self, code):
        result = subprocess.run(['gjs', '-c', 'const Gio = imports.gi.Gio;'
                                 'const s = new Gio.Settings({schema_id:"org.gnome.shell"});'
                                 + code + 'Gio.Settings.sync();'], env=self.env,
                                capture_output=True, text=True, check=True)
        return result.stdout

    def make_archive(self, uuid=UUID, versions=None, extra=None, bad_schema=False):
        files = {'metadata.json': json.dumps({'uuid': uuid, 'shell-version': versions or ['48']}),
                 'extension.js': '// synthetic installer fixture\n', 'prefs.js': '// fixture\n',
                 'LICENSE': 'synthetic notice', 'NOTICE': 'synthetic notice', 'ASSETS.md': 'synthetic notice',
                 f'schemas/{SCHEMA}.gschema.xml': '<invalid' if bad_schema else
                 f'<schemalist><schema id="{SCHEMA}" path="/test/saui/">'
                 '<key name="test-setting" type="i"><default>5</default></key></schema></schemalist>'}
        files.update(extra or {})
        with zipfile.ZipFile(self.archive, 'w') as archive:
            for name, data in files.items():
                archive.writestr(name, data)
        self.checksums.write_text(hashlib.sha256(self.archive.read_bytes()).hexdigest() + '  ' + BUNDLE + '\n')

    def run_installer(self, *args, success=True):
        if not args:
            args = ('--archive', str(self.archive))
        result = subprocess.run(['dbus-run-session', '--', 'bash', str(ROOT / 'install.sh'), *args],
                                env=self.env, capture_output=True, text=True, timeout=30)
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def test_install_deferred_activation_preserves_settings_and_repeated_update(self):
        result = self.run_installer()
        self.assertIn('activation is saved', result.stdout)
        self.assertTrue((self.destination / 'schemas/gschemas.compiled').is_file())
        self.assertFalse((self.root / 'network.log').exists())
        values = json.loads(self.settings('print(JSON.stringify([s.get_strv("enabled-extensions"), s.get_strv("disabled-extensions")]));'))
        self.assertEqual(values, [['other@one', 'other@two', UUID], ['other@disabled']])
        prefs = self.root / 'config/preserved-user-settings'
        prefs.write_text('synthetic preferences')
        self.env['SAUI_KNOWN'] = '1'
        self.settings('s.set_boolean("disable-user-extensions", true);')
        result = self.run_installer()
        self.assertIn('Updated successfully', result.stdout)
        self.assertIn('globally disabled', result.stdout)
        self.assertEqual(prefs.read_text(), 'synthetic preferences')
        self.assertEqual(json.loads(self.settings('print(JSON.stringify(s.get_strv("enabled-extensions")));')), ['other@one', 'other@two', UUID])
        self.assertIn('disable ' + UUID, (self.root / 'cli.log').read_text())
        self.assertFalse(list(self.destination.parent.glob('.saui-install.*')))

    def test_latest_download_resolves_once_then_pins_both_assets(self):
        self.run_installer('--version', 'latest')
        self.assertEqual((self.root / 'network.log').read_text().splitlines(), [
            'https://api.github.com/repos/ivo-lopes/simple-ai-usage-indicator/releases/latest',
            'https://github.com/ivo-lopes/simple-ai-usage-indicator/releases/download/v25/' + BUNDLE,
            'https://github.com/ivo-lopes/simple-ai-usage-indicator/releases/download/v25/SHA256SUMS'])

    def test_bad_hash_does_not_touch_installation(self):
        self.destination.mkdir(parents=True)
        sentinel = self.destination / 'keep'
        sentinel.write_text('previous installation')
        self.checksums.write_text('0' * 64 + '  ' + BUNDLE + '\n')
        result = self.run_installer(success=False)
        self.assertIn('SHA256 mismatch', result.stderr)
        self.assertEqual(sentinel.read_text(), 'previous installation')
        self.assertFalse((self.root / 'cli.log').exists())

    def test_incompatible_or_wrong_uuid_is_rejected(self):
        for options, message in [({'uuid': 'wrong@provider'}, 'Unexpected extension UUID'),
                                 ({'versions': ['51']}, 'does not declare compatibility')]:
            with self.subTest(options=options):
                self.make_archive(**options)
                self.assertIn(message, self.run_installer(success=False).stderr)
                self.assertFalse(self.destination.exists())

    def test_unsafe_archive_and_bad_schema_leave_old_files_intact(self):
        self.destination.mkdir(parents=True)
        sentinel = self.destination / 'keep'
        sentinel.write_text('previous installation')
        for options in ({'extra': {'../escape': 'unsafe'}},
                        {'extra': {'./metadata.json': '{"uuid":"wrong@provider"}'}},
                        {'bad_schema': True}):
            with self.subTest(options=options):
                self.make_archive(**options)
                self.run_installer(success=False)
                self.assertEqual(sentinel.read_text(), 'previous installation')
                self.assertFalse((self.root / 'cli.log').exists())
                self.assertFalse(list(self.destination.parent.glob('.saui-install.*')))

    def test_symlink_installation_is_preserved(self):
        checkout = self.root / 'checkout'
        checkout.mkdir()
        self.destination.parent.mkdir(parents=True)
        self.destination.symlink_to(checkout, target_is_directory=True)
        self.assertIn('symlink', self.run_installer(success=False).stderr)
        self.assertTrue(self.destination.is_symlink())

    def test_download_failure_does_not_modify_files(self):
        self.run_installer('--version', 'v999', success=False)
        self.assertFalse(self.destination.exists())
        self.assertFalse((self.root / 'cli.log').exists())

    def test_known_extension_activation_failure_is_not_reported_as_success(self):
        self.destination.mkdir(parents=True)
        (self.destination / 'keep').write_text('previous installation')
        self.env.update(SAUI_KNOWN='1', SAUI_ENABLE_FAIL='1')
        result = self.run_installer(success=False)
        self.assertIn('GNOME refused activation', result.stderr)
        self.assertIn('Previous installation preserved', result.stderr)
        backup = list(self.destination.parent.glob('.saui-install.*/previous/keep'))
        self.assertEqual(len(backup), 1)
        self.assertEqual(backup[0].read_text(), 'previous installation')


if __name__ == '__main__':
    unittest.main(verbosity=2)
