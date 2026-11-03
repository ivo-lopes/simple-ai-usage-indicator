// SPDX-License-Identifier: GPL-3.0-only
import {parseClaudeUsage} from '../providers/claudeUsage.js';
function assert(value, message) { if (!value) throw new Error(message); }
const now = Date.parse('2026-11-03T10:00:00Z');
const parsed = parseClaudeUsage({five_hour: {used_percentage: .5, resets_at: 1793703600},
    seven_day: {utilization: 42.125, resets_at: '2026-11-09T10:00:00+00:00'},
    seven_day_sonnet: {utilization: 0, resets_at: null}}, now);
assert(parsed.primary.usedPercent === .005, '0.5 percent is not 50 percent');
assert(parsed.week.usedPercent === .42125, 'utilization percentage precision retained');
assert(parsed.week.resetsAt === '2026-11-09T10:00:00+00:00', 'real ISO timestamp/offset preserved');
assert(parsed.windows[2].usedPercent === 0 && parsed.windows[2].resetsAt === null, 'zero model quota and absent reset');
for (const value of [null, {}, [], 'changed', {five_hour: []}, {five_hour: {utilization: '5'}}, {five_hour: {used_percentage: -1}}, {five_hour: {utilization: Infinity}}, {five_hour: {utilization: 101}}])
    assert(parseClaudeUsage(value) === null, 'unknown or invalid payload fails closed');
const partial = parseClaudeUsage({five_hour: {utilization: null}, seven_day: {used_percentage: 100, resets_at: 'invalid'}}, now);
assert(partial.primary.usedPercent === null && partial.week.usedPercent === 1 && partial.week.resetsAt === null, 'partial quota survives without invented reset');
print('Claude quota contract: explicit percentage scale, ISO/epoch resets, model windows, partial and invalid payloads passed');
