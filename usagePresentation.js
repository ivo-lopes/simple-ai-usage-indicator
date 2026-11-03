// SPDX-License-Identifier: GPL-3.0-only
// Pure usage/panel presentation; no Shell actors, timers or provider I/O.
// Derived presentation retains upstream attribution; see NOTICE.
import {gettext as _} from './i18n.js';
import {DISPLAY_MODE_USED, DISPLAY_MODE_PERCENT, PROVIDER_CODEX, PROVIDER_ANTIGRAVITY} from './constants.js';
import {formatQuotaReset} from './quotaReset.js';
import {formatCodexCreditPanel} from './providers/codexCredits.js';

export function formatBucketLabel(window) {
    if (!window.source?.startsWith('agy-'))
        return formatWindowLabel(window.label);
    const group = window.groupName === 'Unknown group' ? _('Unknown group') : window.groupName;
    const bucket = window.bucketName || window.raw?.name || (window.period === '5h' ? '5-hour window'
        : window.period === 'weekly' ? 'Weekly limit' : window.period);
    return `${group} · ${formatWindowLabel(bucket) || _('Quota')}`;
}

function formatWindowLabel(label) {
    if (!label)
        return '';
    if (label === 'Five Hour Limit Remaining')
        return _('5-hour window');
    if (label === 'Weekly Limit Remaining')
        return _('Weekly limit');
    if (label === '5h')
        return _('5-hour window');
    if (label === 'Week')
        return _('Weekly limit');
    if (label === 'Window')
        return _('Window');
    if (label === 'Weekly tokens')
        return _('Weekly tokens');
    if (label === '5-hour window')
        return _('5-hour window');
    if (label === 'Weekly limit')
        return _('Weekly limit');
    if (label === 'Tokens today')
        return _('Tokens today');
    return label;
}

export function formatProviderPanelLabel(provider, summary, displayMode) {
    if (!summary)
        return '--';

    if (summary.quotaUnavailable)
        return '?';
    if (summary.error)
        return '!';

    if ((provider.providerId ?? provider.id) === PROVIDER_CODEX) {
        const credits = formatCodexCreditPanel(summary, displayMode, _);
        if (credits)
            return credits;
    }

    if (typeof summary.percent === 'number' && Number.isFinite(summary.percent)) {
        if (displayMode === DISPLAY_MODE_USED) {
            return `${Math.round(summary.percent * 100)}%`;
        } else if (displayMode === DISPLAY_MODE_PERCENT) {
            return `${Math.round((summary.leftPercent ?? (1 - summary.percent)) * 100)}%`;
        } else {
            return `${Math.round((summary.leftPercent ?? (1 - summary.percent)) * 100)}% ${_('left')}`;
        }
    }

    const val = displayMode === DISPLAY_MODE_USED ? summary.used : summary.left;
    if (val !== null && val !== undefined) {
        const suffix = displayMode === DISPLAY_MODE_USED ? _('used') : _('left');
        return `${formatCompact(val)} ${suffix}`;
    }

    if (summary.primaryWindow?.status)
        return summary.primaryWindow.status;

    if (summary.primaryWindow?.usedFormatted)
        return summary.primaryWindow.usedFormatted;

    return (provider.providerId ?? provider.id) === PROVIDER_ANTIGRAVITY ? '?' : _('OK');
}

export function formatWindowValue(window, displayMode) {
    if (window.status)
        return window.status;

    if (window.usedFormatted)
        return window.usedFormatted;

    if (displayMode === DISPLAY_MODE_USED) {
        if (window.used !== null && window.used !== undefined)
            return `${formatCompact(window.used)} ${_('used')}`;

        if (window.usedPercent !== null && window.usedPercent !== undefined)
            return `${formatQuotaPercent(window.usedPercent)} ${_('used')}`;
    } else {
        if (window.left !== null && window.left !== undefined)
            return `${formatCompact(window.left)} ${_('remaining')}`;

        if (window.leftPercent !== null && window.leftPercent !== undefined)
            return `${formatQuotaPercent(window.leftPercent)} ${_('remaining')}`;

        if (window.usedPercent !== null && window.usedPercent !== undefined)
            return `${formatQuotaPercent(1 - window.usedPercent)} ${_('remaining')}`;
    }

    return _('Unknown');
}

export function formatWindowSubtitle(window) {
    const parts = [];

    const resetText = formatWindowReset(window);
    if (resetText)
        parts.push(resetText);

    if (window.limit !== null && window.limit !== undefined)
        parts.push(`${formatNumber(window.limit)} ${_('total')}`);

    if (window.used !== null && window.used !== undefined)
        parts.push(`${formatNumber(window.used)} ${_('used')}`);

    return parts.join('  •  ');
}

function formatQuotaPercent(fraction) {
    return new Intl.NumberFormat(undefined, {
        style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(fraction);
}

function formatWindowReset(window) {
    return formatQuotaReset(window, {translate: _});
}

export function getWindowProgressPercent(window, displayMode) {
    if (window.usedPercent !== null && window.usedPercent !== undefined) {
        return displayMode === DISPLAY_MODE_USED
            ? window.usedPercent
            : Math.max(1 - window.usedPercent, 0);
    }

    if (window.percent !== null && window.percent !== undefined) {
        return displayMode === DISPLAY_MODE_USED
            ? window.percent
            : Math.max(1 - window.percent, 0);
    }

    return null;
}

export function normalizeProgressPercent(percent) {
    if (typeof percent !== 'number' || !Number.isFinite(percent))
        return null;

    return Math.max(0, Math.min(percent, 1));
}

export function formatNumber(value) {
    return new Intl.NumberFormat().format(Math.round(value));
}

export function formatCompact(value) {
    return new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}
