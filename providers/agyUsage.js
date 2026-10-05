// SPDX-License-Identifier: GPL-3.0-only

// Antigravity 1.2.17: command.data.groups[].buckets[]. See tests/fixtures/.
// Only observed quota fields are normalized; window duration never predicts reset.
export function parseAgyUsage(output) {
    if (typeof output !== 'string' || !output.trim())
        return null;
    const text = output.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            return null;
        }
        if (payload.status && payload.status !== 'SUCCESS')
            return null;
        if (payload.command?.name && payload.command.name !== 'usage')
            return null;
        if (payload.command?.name === 'usage' && Array.isArray(payload.command.data?.groups)) {
            const windows = [];
            for (const group of payload.command.data.groups) {
                if (!group || !Array.isArray(group.buckets))
                    continue;
                for (const bucket of group.buckets) {
                    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket))
                        continue;
                    windows.push({
                        ...normalizeBucket(group.name, bucket, 'agy-json'),
                        groupDescription: typeof group.description === 'string' ? group.description : null,
                        raw: bucket,
                    });
                }
            }
            return selectWindows(windows);
        }
        // Older print-mode envelopes may contain only the human response.
        return typeof payload.response === 'string' ? parseLegacy(payload.response) : null;
    }
    return parseLegacy(text);
}

function normalizeBucket(groupName, bucket, source) {
    const leftPercent = fraction(bucket.remaining_fraction);
    const usedPercent = leftPercent === null ? null : 1 - leftPercent;
    const period = typeof bucket.window === 'string' ? bucket.window : null;
    const resetTime = typeof bucket.reset_time === 'string' ? bucket.reset_time : null;
    const resetsAt = resetTime && Number.isFinite(Date.parse(resetTime)) ? resetTime : null;
    return {
        id: typeof bucket.id === 'string' ? bucket.id : null,
        groupName: typeof groupName === 'string' ? groupName : 'Unknown group',
        label: `${typeof groupName === 'string' ? groupName : 'Unknown group'} · ${bucket.name || period || 'Quota'}`,
        period,
        windowSeconds: period === '5h' ? 18000 : period === 'weekly' ? 604800 : null,
        usedPercent,
        leftPercent,
        resetsAt,
        resetAfterSeconds: nonNegative(bucket.reset_after_seconds),
        source,
    };
}

function parseLegacy(text) {
    const windows = [];
    for (const line of text.split('\n')) {
        const columns = line.trim().split(/\t+|\s{2,}/);
        if (columns.length < 3)
            continue;
        const [group, name, percent, reset] = columns;
        const period = /^Five Hour Limit Remaining$/i.test(name) ? '5h'
            : /^Weekly Limit Remaining$/i.test(name) ? 'weekly' : null;
        const match = percent.match(/^(\d+(?:\.\d+)?)%$/);
        if (!period || !match)
            continue;
        const remaining = fraction(Number(match[1]) / 100);
        if (remaining === null)
            continue;
        // Human relative descriptions are not timestamps and stay unknown.
        windows.push(normalizeBucket(group, {
            name, window: period, remaining_fraction: remaining, reset_time: reset,
        }, 'agy-text'));
    }
    return selectWindows(windows);
}

function selectWindows(windows) {
    if (!windows.length)
        return null;
    // The panel represents the most constrained observed short window, labeled
    // by group in the popup. All buckets remain visible; no cross-group total.
    const candidates = windows.filter(w => w.period === '5h' && w.leftPercent !== null);
    const primary = candidates.reduce((a, b) => !a || b.leftPercent < a.leftPercent ? b : a, null)
        ?? windows.find(w => w.period === '5h') ?? windows[0];
    const week = windows.find(w => w.period === 'weekly' && w.groupName === primary.groupName) ?? null;
    return {windows, primary, week, source: windows[0].source};
}

function fraction(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function nonNegative(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
