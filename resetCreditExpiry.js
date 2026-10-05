// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

export function formatResetCreditExpiryList(rateLimitResetCredits, nowSeconds = Date.now() / 1000) {
    if (!Number.isFinite(nowSeconds))
        return '';

    return (rateLimitResetCredits?.credits ?? [])
        .filter(isAvailableResetCredit)
        .map(credit => credit.expiresAt)
        .filter(expiresAt => Number.isFinite(expiresAt) && expiresAt > nowSeconds)
        .sort((left, right) => left - right)
        .map(expiresAt => formatCompactExpiryDuration(expiresAt - nowSeconds))
        .join(' | ');
}

export function formatCompactExpiryDuration(totalSeconds) {
    if (!Number.isFinite(totalSeconds))
        return '';

    const seconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0)
        return hours > 0 ? `${days}d${hours}h` : `${days}d`;

    if (hours > 0)
        return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;

    if (minutes > 0)
        return `${minutes}m`;

    return '<1m';
}

function isAvailableResetCredit(credit) {
    const status = credit?.status?.toLowerCase();
    if (status)
        return status === 'available';

    return credit?.redeemedAt === null;
}
