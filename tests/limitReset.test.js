// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

import {
    detectEarlyLimitResets,
    formatLimitResetMessage,
} from '../limitReset.js';

const HOUR = 3600;
const DAY = 24 * HOUR;
const NOW = 2_000_000_000;

function assertEqual(actual, expected, message) {
    if (!Object.is(actual, expected))
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertIncludes(actual, expected, message) {
    if (!actual.includes(expected))
        throw new Error(`${message}: expected "${actual}" to include "${expected}"`);
}

function makeWindow(leftPercent, resetAt, overrides = {}) {
    return {
        id: overrides.id ?? 'rate_limit.primary_window',
        rootKey: overrides.rootKey ?? 'rate_limit',
        leftPercent,
        percent: 1 - leftPercent,
        resetAt,
        resetAfterSeconds: null,
        ...overrides,
    };
}

function makeSnapshot({
    accountId = 'account-1',
    observedAt = NOW,
    primaryWindow = null,
    weekWindow = null,
    limitName = 'codex',
} = {}) {
    return {
        accountId,
        observedAt,
        summary: {
            limitName,
            meteredFeature: 'codex',
            primaryWindow,
            weekWindow,
        },
    };
}

const earlyWeeklyReset = detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.75, NOW + 2 * DAY, {
            id: 'rate_limit.secondary_window',
        }),
    }),
    makeSnapshot({
        weekWindow: makeWindow(0.98, NOW + 9 * DAY, {
            id: 'rate_limit.secondary_window',
        }),
    }),
);

assertEqual(earlyWeeklyReset.length, 1,
    'an early weekly recovery should be detected');
assertEqual(earlyWeeklyReset[0].type, 'weekly',
    'the detected reset should retain its window type');
assertEqual(earlyWeeklyReset[0].remainingPercent, 0.98,
    'the detected reset should retain its remaining percentage');
assertEqual(earlyWeeklyReset[0].secondsEarly, 2 * DAY,
    'lead time should use the previous scheduled reset');

const notificationMessage = formatLimitResetMessage(earlyWeeklyReset[0]);
assertIncludes(notificationMessage, 'Weekly usage returned to 98% remaining',
    'the notification should describe the reset');
assertIncludes(notificationMessage, '2 days before its scheduled reset',
    'the notification should describe how early the reset occurred');
assertEqual(notificationMessage.includes('unexpected'), false,
    'the notification should not say unexpected');
assertEqual(notificationMessage.includes('restored'), false,
    'the notification should not say restored');

assertEqual(detectEarlyLimitResets(
    null,
    makeSnapshot({
        weekWindow: makeWindow(1, NOW + 7 * DAY),
    }),
).length, 0, 'the initial sample should not trigger a notification');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.80, NOW + 5 * 60),
    }),
    makeSnapshot({
        weekWindow: makeWindow(1, NOW + 7 * DAY),
    }),
).length, 0, 'a reset near its scheduled time should be ignored');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.70, NOW + DAY),
    }),
    makeSnapshot({
        weekWindow: makeWindow(0.94, NOW + 8 * DAY),
    }),
).length, 0, 'a recovery below 95 percent remaining should be ignored');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.90, NOW + DAY),
    }),
    makeSnapshot({
        weekWindow: makeWindow(0.98, NOW + 8 * DAY),
    }),
).length, 0, 'a recovery below ten percentage points should be ignored');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.85, NOW + DAY),
    }),
    makeSnapshot({
        weekWindow: makeWindow(0.95, NOW + 8 * DAY),
    }),
).length, 1, 'an exact ten percentage point recovery should be detected');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        accountId: 'account-1',
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.60, NOW + DAY),
    }),
    makeSnapshot({
        accountId: 'account-2',
        weekWindow: makeWindow(1, NOW + 8 * DAY),
    }),
).length, 0, 'an account change should be ignored');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.60, null, {
            resetAfterSeconds: DAY + HOUR,
        }),
    }),
    makeSnapshot({
        weekWindow: makeWindow(1, NOW + 7 * DAY),
    }),
).length, 1, 'a relative scheduled reset should be supported');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        primaryWindow: makeWindow(0.70, NOW + 2 * HOUR),
        weekWindow: makeWindow(0.60, NOW + 2 * DAY, {
            id: 'rate_limit.secondary_window',
        }),
    }),
    makeSnapshot({
        primaryWindow: makeWindow(1, NOW + 7 * HOUR),
        weekWindow: makeWindow(0.99, NOW + 9 * DAY, {
            id: 'rate_limit.secondary_window',
        }),
    }),
).length, 2, 'simultaneous primary and weekly resets should be combined');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.98, NOW + DAY),
    }),
    makeSnapshot({
        weekWindow: makeWindow(1, NOW + 8 * DAY),
    }),
).length, 0, 'remaining near full should not notify repeatedly');

assertEqual(detectEarlyLimitResets(
    makeSnapshot({
        observedAt: NOW - HOUR,
        weekWindow: makeWindow(0.60, NOW + DAY),
        limitName: 'codex',
    }),
    makeSnapshot({
        weekWindow: makeWindow(1, NOW + 8 * DAY),
        limitName: 'code-review',
    }),
).length, 0, 'a limit identity change should be ignored');

print('limit reset tests passed');
