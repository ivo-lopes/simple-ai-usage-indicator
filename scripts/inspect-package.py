#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Additional bounded security/content checks for the already allowlisted ZIP."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parent.parent
name = 'simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip'
pattern = re.compile(rb'(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
with zipfile.ZipFile(root / name) as archive:
    files = [n for n in archive.namelist() if not n.endswith('/')]
    for required in ['LICENSE', 'NOTICE', 'ASSETS.md', 'metadata.json']:
        assert required in files, f'Missing {required}'
    for name in files:
        data = archive.read(name)
        assert data == (root / name).read_bytes(), f'Source mismatch: {name}'
        assert not pattern.search(data), f'Credential pattern in {name}'
        if name.endswith('.svg'):
            svg = ET.fromstring(data)
            assert not any(e.tag.split('}')[-1] in ('image', 'script') for e in svg.iter()), f'Embedded content: {name}'
    assert len([n for n in files if n.endswith('.svg')]) == 9
print(f'PASS: {len(files)} archive files match sources; original SVGs and bounded credential-pattern scan')
