#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Require complete, non-fuzzy compiled Portuguese catalogs without locale dependencies."""
import ast
import gettext
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
messages = []
for block in (root / 'po/simple-ai-usage-indicator.pot').read_text().split('\n\n'):
    match = re.search(r'^msgid (.+)((?:\n".*")*)', block, re.M)
    if match:
        message = ast.literal_eval(match[1]) + ''.join(ast.literal_eval(s) for s in match[2].splitlines() if s)
        if message:
            messages.append((message, 'msgid_plural ' in block))
for language in ('pt', 'pt_BR'):
    with (root / f'locale/{language}/LC_MESSAGES/simple-ai-usage-indicator.mo').open('rb') as file:
        catalog = gettext.GNUTranslations(file)
    for message, plural in messages:
        for key in [(message, 0), (message, 1)] if plural else [message]:
            assert catalog._catalog.get(key), f'{language}: missing translation {key}'
    assert 'fuzzy' not in (root / f'po/{language}.po').read_text(), f'{language}: fuzzy translation'
    print(f'PASS: {language}: {len(messages)} translated messages, including plurals')
