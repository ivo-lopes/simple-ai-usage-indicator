// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

import {
    formatCompactExpiryDuration,
    formatResetCreditExpiryList,
} from '../resetCreditExpiry.js';

const HOUR = 3600;
const DAY = 24 * HOUR;
const NOW = 2_000_000_000;

function assertEqual(actual, expected, message) {
    if (!Object.is(actual, expected))
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const expiryList = formatResetCreditExpiryList({
    credits: [
        {status: 'available', expiresAt: NOW + 20 * DAY + 20 * HOUR},
        {status: 'redeemed', expiresAt: NOW + DAY},
        {status: 'available', expiresAt: NOW + 12 * HOUR + 23 * 60},
        {status: 'available', expiresAt: NOW + 12 * DAY + 12 * HOUR},
        {status: 'available', expiresAt: null},
    ],
}, NOW);

assertEqual(expiryList, '12h23m | 12d12h | 20d20h',
    'available reset expiries should be compact, ordered, and unlabeled');
assertEqual(formatCompactExpiryDuration(12 * HOUR), '12h',
    'exact hours should omit minutes');
assertEqual(formatCompactExpiryDuration(45 * 60), '45m',
    'sub-hour durations should show minutes');
assertEqual(formatCompactExpiryDuration(30), '<1m',
    'sub-minute durations should remain visible');

print('reset credit expiry tests passed');
