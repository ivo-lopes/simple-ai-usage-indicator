// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

export const LIMIT_RESET_NEAR_FULL_THRESHOLD = 0.95;
export const LIMIT_RESET_MIN_RECOVERY = 0.10;
export const LIMIT_RESET_EARLY_MARGIN_SECONDS = 10 * 60;

const WINDOW_SPECS = [
    {
        key: 'primaryWindow',
        type: 'primary',
        label: '5-hour',
    },
    {
        key: 'weekWindow',
        type: 'weekly',
        label: 'Weekly',
    },
];

export function detectEarlyLimitResets(previous, current) {
    if (!hasSameAccount(previous, current))
        return [];

    const observedAt = finiteNumber(current?.observedAt);
    if (observedAt === null)
        return [];

    const resets = [];
    for (const spec of WINDOW_SPECS) {
        const previousWindow = previous.summary?.[spec.key];
        const currentWindow = current.summary?.[spec.key];
        if (!previousWindow || !currentWindow)
            continue;

        if (!hasSameWindow(previous.summary, current.summary, previousWindow, currentWindow))
            continue;

        const previousRemaining = getRemainingPercent(previousWindow);
        const currentRemaining = getRemainingPercent(currentWindow);
        if (previousRemaining === null || currentRemaining === null)
            continue;

        const crossedNearFullThreshold =
            previousRemaining < LIMIT_RESET_NEAR_FULL_THRESHOLD &&
            currentRemaining >= LIMIT_RESET_NEAR_FULL_THRESHOLD;
        const meaningfulRecovery =
            currentRemaining - previousRemaining + Number.EPSILON >=
                LIMIT_RESET_MIN_RECOVERY;
        if (!crossedNearFullThreshold || !meaningfulRecovery)
            continue;

        const scheduledResetAt = getScheduledResetAt(previousWindow, previous.observedAt);
        if (
            scheduledResetAt === null ||
            observedAt >= scheduledResetAt - LIMIT_RESET_EARLY_MARGIN_SECONDS
        ) {
            continue;
        }

        resets.push({
            type: spec.type,
            label: spec.label,
            remainingPercent: currentRemaining,
            scheduledResetAt,
            secondsEarly: scheduledResetAt - observedAt,
        });
    }

    return resets;
}

export function formatLimitResetMessage(reset) {
    const percentage = Math.round(reset.remainingPercent * 100);
    const leadTime = formatLeadTime(reset.secondsEarly);
    return `${reset.label} usage returned to ${percentage}% remaining, ` +
        `${leadTime} before its scheduled reset.`;
}

function hasSameAccount(previous, current) {
    const previousAccountId = normalizedIdentity(previous?.accountId);
    const currentAccountId = normalizedIdentity(current?.accountId);
    return previousAccountId !== null &&
        currentAccountId !== null &&
        previousAccountId === currentAccountId;
}

function hasSameWindow(
    previousSummary,
    currentSummary,
    previousWindow,
    currentWindow,
) {
    const identityPairs = [
        [previousSummary?.limitName, currentSummary?.limitName],
        [previousSummary?.meteredFeature, currentSummary?.meteredFeature],
        [previousWindow.rootKey, currentWindow.rootKey],
        [previousWindow.id, currentWindow.id],
    ];

    return identityPairs.every(([previousValue, currentValue]) => {
        const normalizedPrevious = normalizedIdentity(previousValue);
        const normalizedCurrent = normalizedIdentity(currentValue);
        return normalizedPrevious === null ||
            normalizedCurrent === null ||
            normalizedPrevious === normalizedCurrent;
    });
}

function getRemainingPercent(window) {
    const leftPercent = finiteNumber(window.leftPercent);
    if (leftPercent !== null)
        return clampPercent(leftPercent);

    const usedPercent = finiteNumber(window.percent);
    return usedPercent !== null ? 1 - clampPercent(usedPercent) : null;
}

function getScheduledResetAt(window, observedAt) {
    const resetAt = finiteNumber(window.resetAt);
    if (resetAt !== null)
        return resetAt;

    const previousObservedAt = finiteNumber(observedAt);
    const resetAfterSeconds = finiteNumber(window.resetAfterSeconds);
    if (previousObservedAt === null || resetAfterSeconds === null)
        return null;

    return previousObservedAt + resetAfterSeconds;
}

function formatLeadTime(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];

    if (days > 0)
        parts.push(formatUnit(days, 'day'));
    if (hours > 0)
        parts.push(formatUnit(hours, 'hour'));
    if (days === 0 && minutes > 0)
        parts.push(formatUnit(minutes, 'minute'));

    return parts.length > 0 ? parts.join(' ') : 'less than a minute';
}

function formatUnit(value, unit) {
    return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

function normalizedIdentity(value) {
    if (typeof value !== 'string')
        return null;

    const normalized = value.trim();
    return normalized || null;
}

function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampPercent(value) {
    return Math.max(0, Math.min(value, 1));
}
