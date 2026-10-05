// SPDX-License-Identifier: GPL-3.0-only
import {formatQuotaReset} from '../quotaReset.js';
function assert(value, message) {
    if (!value) throw new Error(message);
}
const now = Date.parse('2026-10-05T10:30:00Z');
const options = {now, locale: 'pt-BR', timeZone: 'America/Recife', translate: text => ({Resets: 'Reinicia', in: 'em'}[text] || text)};
const window = {resetsAt: '2026-10-07T14:30:00Z', resetAfterSeconds: 1};
const text = formatQuotaReset(window, options);
assert(text.includes('07/10') && text.includes('11:30') && text.endsWith('· em 2d 4h'), 'Long reset: local date/time plus relative duration from the authoritative timestamp');
assert(formatQuotaReset({...window, resetsAt: '2026-10-07T11:30:00-03:00'}, options) === text, 'Equivalent timezone offsets');
assert(formatQuotaReset({resetAt: Date.parse(window.resetsAt) / 1000}, options) === text, 'Legacy Unix timestamp uses identical display');
const short = formatQuotaReset({resetsAt: '2026-10-05T14:30:00Z'}, options);
assert(short === 'Reinicia 11:30', 'Short same-day reset stays compact');
assert(!formatQuotaReset({resetsAt: '2026-10-06T10:30:00Z'}, options).includes('·'), 'Exactly 24h does not append long duration');
assert(formatQuotaReset({resetsAt: '2027-01-01T14:30:00Z'}, options).includes('2027'), 'Different year is explicit');
assert(!formatQuotaReset({resetsAt: '2026-10-01T14:30:00Z'}, options).includes('·'), 'Past reset has no misleading countdown');
assert(formatQuotaReset({resetsAt: 'invalid'}, options) === '', 'Invalid reset unavailable');
print('quotaReset tests passed: long/short boundaries, timestamp precedence, timezone, legacy and translated countdown');
