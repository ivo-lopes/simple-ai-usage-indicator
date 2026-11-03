// SPDX-License-Identifier: GPL-3.0-only
// Cases adapted from upstream c0008d1's menuLayout regression suite.
import {creditBalance, formatCreditBalance, formatCodexCreditPanel} from '../providers/codexCredits.js';
import {normalizeSummary} from '../usageApi.js';
import {CodexProvider} from '../providers/codexProvider.js';
import {loadSource, Actor} from './helpers/shellSource.js';
function assert(value, message) { if (!value) throw new Error(message); }
function fixture(primary, weekly, credits = {balance: '12'}, flag = null, independent = false) {
    return normalizeSummary({rate_limit: {
        limit_reached: flag,
        primary_window: primary === null ? null : {used_percent: primary, window_seconds: 18000},
        secondary_window: weekly === null ? null : {used_percent: weekly, window_seconds: 604800},
    }, additional_rate_limits: independent ? [{limit_name: 'other-model', rate_limit: {
        limit_reached: true, primary_window: {used_percent: 100, window_seconds: 18000},
    }}] : undefined, credits});
}
function adapt(raw) {
    const window = w => w ? {...w, usedPercent: w.percent} : null;
    return {raw, credits: raw.credits, percent: raw.percent,
        leftPercent: raw.leftPercent, primaryWindow: window(raw.primaryWindow), weekWindow: window(raw.weekWindow)};
}
for (const [primary, week, flag, mode, expected] of [
    [25, 89.9, null, 'left', null], [25, 95, null, 'left', 'Week 5% left · 12 credits'],
    [95, 90, null, 'used', '5h 95% used · 12 credits'], [90, 95, null, 'used', 'Week 95% used · 12 credits'],
    [100, 30, null, 'left', '12 credits'], [25, 100, null, 'used', '12 credits'],
    [99.9, 30, null, 'left', '5h 0% left · 12 credits'], [100, 30, false, 'left', '5h 0% left · 12 credits'],
    [25, 30, true, 'left', '12 credits'], [null, null, null, 'left', null],
    [null, 95, null, 'left', 'Week 5% left · 12 credits'], [95, 30, null, 'percent', '5h 5% · 12 credits'],
]) {
    const s = adapt(fixture(primary, week, {balance: '12'}, flag));
    assert(formatCodexCreditPanel(s, mode) === expected, `credits near primary/weekly: ${expected}`);
    assert(formatCodexCreditPanel({...s, error: 'offline'}, mode) === null, 'failed refresh never shows available cached credits');
}
for (const value of [0, '0', -1, null, 'invalid', 'Infinity', '', false]) {
    const s = adapt(fixture(100, 95, {balance: value}));
    assert(formatCodexCreditPanel(s, 'left') === null, 'zero/invalid balance preserves normal topbar');
}
assert(formatCreditBalance({balance: 0}).startsWith('0 '), 'popup includes zero balance');
assert(formatCreditBalance({unlimited: true, balance: 0}) === 'Unlimited', 'unlimited is explicit');
assert(formatCreditBalance({balance: null}) === 'Unavailable', 'null never coerces to zero');
assert(creditBalance({balance: false}) === null, 'boolean never coerces to credits');
assert(formatCreditBalance({balance: .0001}, true).startsWith('<'), 'tiny positive amount not shown as zero');
assert(formatCodexCreditPanel(adapt(fixture(10, 20, {balance: 12}, false, true)), 'left') === null, 'independent exhausted model cannot trigger credits');
const modelOnly = normalizeSummary({additional_rate_limits: [{limit_name: 'other', rate_limit: {
    limit_reached: true, primary_window: {used_percent: 95, window_seconds: 18000},
}}], credits: {balance: 12}});
assert(formatCodexCreditPanel(adapt(modelOnly), 'left') === null, 'model-only window cannot trigger main allowance warning');
const m = loadSource('extension.js', {St: {BoxLayout: Actor}, Clutter: {},
    GObject: {registerClass: k => k}, PanelMenu: {Button: Actor}, PopupMenu: {PopupMenuSection: Actor},
    Extension: class {}, _: s => s, PROVIDER_CODEX: 'codex', PROVIDER_ANTIGRAVITY: 'antigravity',
    DISPLAY_MODE_USED: 'used', DISPLAY_MODE_PERCENT: 'percent', formatCodexCreditPanel,
}, ['formatProviderPanelLabel']);
const summary = adapt(fixture(95, 10));
assert(m.formatProviderPanelLabel({id: 'codex:account2', providerId: 'codex'}, summary, 'left').includes('credits'), 'Codex custom instance opts into credits');
assert(m.formatProviderPanelLabel({id: 'claude:account2', providerId: 'claude'}, summary, 'left') === '5% left', 'Claude panel policy unchanged');
assert(m.formatProviderPanelLabel({id: 'antigravity'}, summary, 'left') === '5% left', 'Antigravity panel policy unchanged');
// Verify the production adapter retains origin, counts, and credit data.
const raw = fixture(95, 10);
const provider = new CodexProvider({loadAuth: async () => ({accessToken: 'synthetic', accountId: 'synthetic'}),
    client: {fetchSummary: async () => raw, destroy() {}}});
try {
    const s = await provider.fetchUsage();
    assert(!s.error && s.primaryWindow.rootKey === 'rate_limit', 'adapter preserves quota origin');
    assert(formatCodexCreditPanel(s, 'left') === '5h 5% left · 12 credits', 'production summary reaches credit formatter');
} finally { provider.destroy(); }
print('Codex credits: popup zero/unlimited/unknown, near-limit panel, independent model exclusion and adapter origin passed');
