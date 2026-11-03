// SPDX-License-Identifier: GPL-3.0-only
import * as usagePresentation from '../usagePresentation.js';
import Gio from 'gi://Gio';
import {parseAgyUsage} from '../providers/agyUsage.js';
import {formatQuotaReset} from '../quotaReset.js';
import {Actor, loadSource} from './helpers/shellSource.js';
function assert(value, message) { if (!value) throw new Error(message); }
class Item extends Actor {
    constructor(text) { super(); this.label = new Actor({text, clutter_text: {}}); this.add_child(this.label); }
}
const m = loadSource('extension.js', {...usagePresentation,
    St: {BoxLayout: Actor, Label: Actor, Icon: Actor},
    Clutter: {Orientation: {VERTICAL: 1}, ActorAlign: {START: 0, CENTER: 1, END: 2}},
    BarLevel: {BarLevel: Actor}, GObject: {registerClass: k => k}, PanelMenu: {Button: Actor},
    PopupMenu: {PopupMenuSection: Actor, PopupBaseMenuItem: Actor, PopupMenuItem: Item, PopupSeparatorMenuItem: Actor},
    Gio, GLib: {build_filenamev: p => p.join('/')}, Extension: class {}, _: s => s,
    PROVIDER_CODEX: 'codex', PROVIDER_ANTIGRAVITY: 'antigravity', ICON_STYLE_SYMBOLIC: 'symbolic',
    ICON_STYLE_COLOR: 'color', ICON_STYLE_BLACK: 'black', DISPLAY_MODE_USED: 'used',
    formatQuotaReset,
}, ['SimpleAiUsageIndicator', 'createUsageProgressMenuItem', 'formatWindowValue']);
const root = Gio.File.new_for_uri(import.meta.url).get_parent();
const json = new TextDecoder().decode(root.get_child('fixtures/agy-usage-1.4.12.json').load_contents(null)[1]);
const parsed = parseAgyUsage(json);
const items = [];
const indicator = Object.create(m.SimpleAiUsageIndicator.prototype);
indicator._extension = {path: '/tmp'};
indicator._usageSection = {addMenuItem: item => items.push(item)};
indicator._renderProviderSection({id: 'antigravity', name: 'Antigravity', getIconFileName: () => 'test.svg'},
    {windows: parsed.windows}, 'left');
assert(items.length === 9, 'one provider, three group headers and all five quota rows');
assert(items.some(i => i.label?.text === 'Gemini 4 Argon'), 'Argon has independent group heading');
const labels = a => [a, ...a.children.flatMap(labels)];
assert(items.flatMap(labels).some(a => /0[.,]80.*%/.test(a.text || '')), 'Argon fraction displayed to two decimals');
const unknown = m.createUsageProgressMenuItem('Unknown quota', {leftPercent: null, usedPercent: null}, 'left');
assert(!labels(unknown).some(a => a.style_class === 'slider'), 'unknown quota has no misleading availability bar');
assert(m.formatWindowValue({leftPercent: 0, usedPercent: 1}, 'left').includes('0.00'), 'zero remains zero');
const accounts = ['first', 'second'].map(id => ({id, providerId: 'claude', name: id, getIconFileName: () => 'test.svg'}));
indicator._state = {summaries: new Map(accounts.map((a, index) => [a.id, {
    primaryWindow: {usedPercent: index ? .75 : .25, leftPercent: index ? .25 : .75},
}]))};
indicator._usageSection.removeAll = () => { items.length = 0; };
indicator._renderPopupUsage(accounts, 'left');
const accountLabels = items.flatMap(labels).map(a => a.text || '');
assert(accountLabels.includes('first') && accountLabels.includes('second'), 'each account has its own popup section');
assert(accountLabels.some(t => t.includes('25.00')) && accountLabels.some(t => t.includes('75.00')), 'account popup quotas stay independent');
print('Antigravity popup: actual render path, 3 groups / 5 buckets, precision and unknown metrics passed');
