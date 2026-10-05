#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Build signed distro packages and test real Shells on private buses without network."""
import argparse
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path)
parser.add_argument('--versions', nargs='+', default=['45', '46', '47', '48', '49', '50', '51'])
parser.add_argument('--docker', default='docker')
parser.add_argument('--build', action='store_true')
parser.add_argument('--image-suffix', default='20261005')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
versions = json.loads((HERE / 'versions.json').read_text())
args.output.mkdir(parents=True, exist_ok=True)
archive = args.archive.resolve().relative_to(REPO)
failed = []
for version in args.versions:
    spec = versions[version]
    image = f'saui-gnome{version}-lab:{args.image_suffix}'
    if args.build:
        subprocess.run([args.docker, 'build', '--network', 'host', '-f', str(HERE / 'Containerfile'),
            '--build-arg', 'BASE_IMAGE=fedora@sha256:' + spec['digest'],
            '--build-arg', 'FEDORA_VERSION=' + str(spec['fedora']),
            '--build-arg', 'ARCHIVE=' + str(spec['archive']).lower(), '-t', image, str(HERE)], check=True)
    root = (args.output / version).resolve()
    root.mkdir()  # Refuse to overwrite earlier evidence.
    root.chmod(0o777)  # Rootless Docker's UID mapping; this directory contains only synthetic test data.
    with (args.output / (version + '.out')).open('w') as log:
        result = subprocess.run([args.docker, 'run', '--rm', '--network', 'none',
            '--mount', f'type=bind,src={REPO},dst=/saui,readonly',
            '--mount', f'type=bind,src={root},dst=/evidence', image,
            'python3', '/saui/tests/integration/gnome-shell-smoke.py', '/saui/' + str(archive),
            '--expected-major', version, '--isolated-system-bus', '--login1-stub',
            '/saui/tests/integration/login1-stub.js', '--prefs', '--popup', '--output-dir', '/evidence'],
            stdout=log, stderr=subprocess.STDOUT)
    print(version, 'PASS' if result.returncode == 0 else 'FAIL', flush=True)
    if result.returncode:
        failed.append(version)
raise SystemExit(bool(failed))
