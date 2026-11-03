// SPDX-License-Identifier: GPL-3.0-only
// Credit presentation adapted from upstream 60e1513/c0008d1 by Denny Huang.

export function creditBalance(credits) {
    const value = credits?.balance;
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !value.trim()))
        return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

export function formatCreditBalance(credits, compact = false, translate = text => text) {
    if (credits?.unlimited === true)
        return compact ? `∞ ${translate('credits')}` : translate('Unlimited');
    const number = creditBalance(credits);
    if (number === null)
        return translate('Unavailable');
    const formatter = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
    let value = formatter.format(number);
    if (number > 0 && number < .01)
        value = `<${formatter.format(.01)}`;
    else if (compact && number >= 1000)
        value = new Intl.NumberFormat(undefined, {notation: 'compact', maximumFractionDigits: 1}).format(number);
    return `${value} ${translate(compact ? 'credits' : 'credits remaining')}`;
}

// Return null to preserve the caller's existing quota label. Only Codex callers
// opt into this; independent model limits never imply the main quota is exhausted.
export function formatCodexCreditPanel(summary, mode, translate = text => text) {
    if (!summary || summary.error || summary.quotaUnavailable)
        return null;
    const balance = creditBalance(summary.credits);
    if (summary.credits?.unlimited !== true && !(balance > 0))
        return null;
    const windows = [summary.primaryWindow, summary.weekWindow]
        .filter(w => w && (!w.rootKey || w.rootKey === 'rate_limit') &&
            typeof w.usedPercent === 'number' && Number.isFinite(w.usedPercent));
    const critical = windows.reduce((a, b) => !a || b.usedPercent > a.usedPercent ? b : a, null);
    const limitReached = summary.raw?.rateLimit?.limitReached ?? (critical ? critical.usedPercent >= 1 : false);
    const credits = formatCreditBalance(summary.credits, true, translate);
    if (limitReached)
        return credits;
    if (!critical || critical.usedPercent < .9)
        return null;
    const period = critical === summary.weekWindow ? translate('Week') : translate('5h');
    const used = mode === 'used';
    const count = used ? critical.used : critical.left;
    const fraction = used ? critical.usedPercent : critical.leftPercent ?? 1 - critical.usedPercent;
    const value = typeof count === 'number' && Number.isFinite(count)
        ? new Intl.NumberFormat(undefined, {notation: 'compact', maximumFractionDigits: 1}).format(count)
        : `${Math.round(fraction * 100)}%`;
    const suffix = mode === 'percent' ? '' : ` ${translate(used ? 'used' : 'left')}`;
    return `${period} ${value}${suffix} · ${credits}`;
}
