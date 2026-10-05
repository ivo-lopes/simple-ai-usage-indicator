// SPDX-License-Identifier: GPL-3.0-only
import {format} from '../i18n.js';
import {formatLimitResetMessage} from '../limitReset.js';
import {formatQuotaReset} from '../quotaReset.js';
import {loadSource, Actor} from './helpers/shellSource.js';
function assert(value, message) {
    if (!value) throw new Error(message);
}
assert(format('%2$s · %1$s · %%', 'first', 'second') === 'second · first · %', 'Reordered translation placeholders and literal percent');
const translations = {
    'Weekly': 'Uso semanal', 'Resets': 'Reinicia', 'in': 'em',
    '%s usage returned to %s%% remaining, %s before its scheduled reset.': '%s voltou a %s%% restante, %s antes do reinício previsto.',
    'Error: %s': 'Erro: %s', 'Success! %s': 'Sucesso! %s', '%s%% used': '%s%% usado',
};
const translate = text => translations[text] || text;
const notification = formatLimitResetMessage({type: 'weekly', remainingPercent: .98, secondsEarly: 172800}, {
    translate, plural: (s, p, n) => n === 1 ? '%s dia' : '%s dias',
});
assert(notification === 'Uso semanal voltou a 98% restante, 2 dias antes do reinício previsto.', 'Notification and relative plural translated');
assert(formatQuotaReset({resetsAt: '2026-10-07T14:30:00Z'}, {
    now: Date.parse('2026-10-05T10:30:00Z'), locale: 'pt-BR', timeZone: 'America/Recife', translate,
}).endsWith('· em 2d 4h'), 'Reset countdown translated');
const {SimpleAiUsagePreferencesPage} = loadSource('prefs.js', {
    Adw: {PreferencesPage: Actor}, GObject: {registerClass: klass => klass}, ExtensionPreferences: class {}, _: translate, format,
}, ['SimpleAiUsagePreferencesPage']);
const page = Object.create(SimpleAiUsagePreferencesPage.prototype);
const row = {};
const expander = {};
await page._testProvider({fetchUsage: async () => ({percent: .5})}, row, expander);
assert(row.subtitle === 'Sucesso! 50% usado', 'Actual Preferences success/usage text translated');
await page._testProvider({fetchUsage: async () => ({error: 'fixture'})}, row, expander);
assert(row.subtitle === 'Erro: fixture', 'Actual Preferences error prefix translated');
print('i18n tests passed: actual prefs, notifications/plurals, long reset and reordered placeholders');
