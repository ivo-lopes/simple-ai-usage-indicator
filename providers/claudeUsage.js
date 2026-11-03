// SPDX-License-Identifier: GPL-3.0-only

// Pure adapter for explicit 0–100 percentage fields. Never guess a fractional
// scale from magnitude: 0.5 means 0.5% consumed, not 50%.
export function parseClaudeUsage(payload, now = Date.now()) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        return null;
    const windows = [];
    for (const [id, value] of Object.entries(payload)) {
        if (!['five_hour', 'fiveHour', 'seven_day', 'sevenDay'].includes(id) && !/^seven_day_[a-z0-9_]+$/.test(id))
            continue;
        if (!value || typeof value !== 'object' || Array.isArray(value))
            continue;
        const metric = value.utilization ?? value.used_percentage;
        const usedPercent = typeof metric === 'number' && Number.isFinite(metric) && metric >= 0 && metric <= 100
            ? metric / 100 : null;
        const reset = value.resets_at;
        const date = typeof reset === 'number' && Number.isFinite(reset) && reset >= 0
            ? new Date(reset * 1000)
            : typeof reset === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(reset) ? new Date(reset) : null;
        const validReset = date && Number.isFinite(date.getTime());
        const period = id === 'five_hour' || id === 'fiveHour' ? '5h' : 'weekly';
        windows.push({id, period, windowSeconds: period === '5h' ? 18000 : 604800,
            usedPercent, leftPercent: usedPercent === null ? null : 1 - usedPercent,
            // ISO offsets from the backend are preserved; epoch seconds are normalized.
            resetsAt: validReset ? (typeof reset === 'string' ? reset : date.toISOString()) : null,
            resetAfterSeconds: validReset ? Math.max((date.getTime() - now) / 1000, 0) : null,
        });
    }
    if (!windows.some(w => w.usedPercent !== null))
        return null;
    return {windows,
        primary: windows.find(w => w.id === 'five_hour' || w.id === 'fiveHour') ?? null,
        week: windows.find(w => w.id === 'seven_day' || w.id === 'sevenDay') ?? null};
}
