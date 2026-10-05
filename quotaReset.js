// SPDX-License-Identifier: GPL-3.0-only

// Pure formatting helper shared by runtime and offline regression tests.
export function formatQuotaReset(window, {
    now = Date.now(), locale = undefined, timeZone = undefined, translate = text => text,
} = {}) {
    const value = window.resetsAt ?? window.resetAt;
    const date = typeof value === 'number' ? new Date(value * 1000)
        : typeof value === 'string' ? new Date(value) : null;
    if (date && Number.isFinite(date.getTime())) {
        const options = {hour: '2-digit', minute: '2-digit', timeZone};
        const today = new Intl.DateTimeFormat(locale, {year: 'numeric', month: 'numeric', day: 'numeric', timeZone});
        if (today.format(date) !== today.format(new Date(now))) {
            options.day = '2-digit';
            options.month = '2-digit';
            if (new Intl.DateTimeFormat(locale, {year: 'numeric', timeZone}).format(date) !==
                new Intl.DateTimeFormat(locale, {year: 'numeric', timeZone}).format(new Date(now)))
                options.year = 'numeric';
        }
        return `${translate('Resets')} ${new Intl.DateTimeFormat(locale, options).format(date)}`;
    }
    if (typeof window.resetAfterSeconds === 'number' && Number.isFinite(window.resetAfterSeconds))
        return `${translate('Resets in')} ${formatQuotaDuration(window.resetAfterSeconds)}`;
    return '';
}

export function formatQuotaDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0)
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0)
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}
