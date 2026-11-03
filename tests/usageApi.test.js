// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

import {normalizeSummary} from '../usageApi.js';

function assertEqual(actual, expected, message) {
    if (!Object.is(actual, expected))
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const exhaustedWeeklyLimit = normalizeSummary({
    rate_limit: {
        primary_window: {
            used_percent: 100,
            window_seconds: 7 * 86400,
        },
    },
});

assertEqual(exhaustedWeeklyLimit.weekWindow?.percent, 1,
    'weekly window should be fully used');
assertEqual(exhaustedWeeklyLimit.weekWindow?.leftPercent, 0,
    'weekly window should have no usage remaining');
assertEqual(exhaustedWeeklyLimit.percent, 1,
    'summary should preserve the normalized weekly percentage');
assertEqual(exhaustedWeeklyLimit.leftPercent, 0,
    'summary should match the exhausted weekly window');

print('usageApi tests passed');

const small = normalizeSummary({rate_limit: {primary_window: {used_percent: .5, window_seconds: 18000,
    reset_at: '2026-11-03T12:00:00+00:00'}}});
assertEqual(small.percent, .005, 'explicit used_percent 0.5 means 0.5%, not 50%');
assertEqual(small.resetAt, Date.parse('2026-11-03T12:00:00Z') / 1000, 'ISO reset normalized via existing timestamp adapter');
for (const percent of [-1, 101, Infinity]) {
    assertEqual(normalizeSummary({rate_limit: {primary_window: {used_percent: percent, window_seconds: 18000}}}).percent,
        null, 'impossible percentage never becomes available quota');
}
