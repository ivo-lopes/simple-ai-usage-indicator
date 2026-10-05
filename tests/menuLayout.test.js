// SPDX-License-Identifier: GPL-3.0-only
// Compatibility approach derived from upstream 2fc4bcb by Denny Huang; see NOTICE.
import {format, ngettext} from '../i18n.js';
import {formatQuotaReset} from '../quotaReset.js';
import {Actor, loadSource} from './helpers/shellSource.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
for (const properties of [['vertical'], ['vertical', 'orientation'], ['orientation']]) {
    class BoxLayout extends Actor {
        constructor(params = {}) {
            for (const key of ['vertical', 'orientation']) {
                if (key in params && !properties.includes(key))
                    throw new Error(`Unsupported St property: ${key}`);
            }
            super(params);
        }
    }
    for (const property of properties)
        Object.defineProperty(BoxLayout.prototype, property, {value: null, writable: true});
    class MenuItem extends Actor {
        constructor(params = {}) {
            for (const key of Object.keys(params))
                assert(['reactive', 'can_focus', 'style_class', 'activate', 'hover'].includes(key), `Unknown popup constructor option: ${key}`);
            super(params);
        }
    }
    const bindings = {
        BarLevel: {BarLevel: Actor},
        St: {BoxLayout, Label: Actor, Icon: Actor, Widget: Actor},
        Clutter: {Orientation: {VERTICAL: 1}, ActorAlign: {START: 0, CENTER: 1, END: 2}, FixedLayout: class {}},
        GObject: {registerClass: klass => klass},
        PanelMenu: {Button: Actor},
        PopupMenu: {PopupMenuSection: Actor, PopupBaseMenuItem: MenuItem},
        Gio: {icon_new_for_string: path => path},
        GLib: {build_filenamev: parts => parts.join('/')},
        formatQuotaReset, Extension: class {}, _: text => text, format, ngettext,
        ICON_STYLE_SYMBOLIC: 'symbolic', ICON_STYLE_BLACK: 'black', ICON_STYLE_COLOR: 'color',
        DISPLAY_MODE_USED: 'used', DISPLAY_MODE_PERCENT: 'percent', DISPLAY_MODE_LEFT: 'left',
    };
    const m = loadSource('extension.js', bindings, [
        'createProviderHeaderMenuItem', 'createUsageProgressMenuItem',
        'createModelsSummaryMenuItem', 'createExtraCreditsMenuItem',
    ]);
    const header = m.createProviderHeaderMenuItem('/tmp', {name: 'Test', getIconFileName: () => 'test.svg'}, {planType: 'Fixture'});
    const usage = m.createUsageProgressMenuItem('Weekly', {leftPercent: .75, usedPercent: .25}, 'left');
    const models = m.createModelsSummaryMenuItem([{name: 'Model', formattedTokens: '100'}]);
    const credits = m.createExtraCreditsMenuItem({availableCount: 2});
    for (const content of [header.children[0].children[1], usage.children[0], models.children[0]])
        assert(content.orientation === 1 || content.vertical === true, 'Vertical content preserved');
    assert(!credits.children[0].vertical, 'Credits remain horizontal');
    const labels = actor => [actor, ...actor.children.flatMap(labels)];
    for (const item of [header, usage, models, credits]) {
        for (const actor of labels(item))
            assert(!/(?:^|;)\s*color:/.test(actor.style || ''), 'Text color inherits Shell theme');
    }
}
print('menu layout tests passed: old/transitional/GNOME 51 St APIs');

for (const legacy of [true, false]) {
    class ScrollView extends Actor {
        set_child(child) {
            assert(!legacy, 'GNOME 45 inherited St.Bin.set_child must not be used');
            this.scrollChild = child;
        }
    }
    if (legacy)
        ScrollView.prototype.add_actor = function(child) { this.scrollChild = child; };
    class Section extends Actor { constructor() { super(); this.box = new Actor(); } }
    const {PopupScrollMenuSection} = loadSource('extension.js', {
        Clutter: {Orientation: {VERTICAL: 1}},
        St: {BoxLayout: Actor, ScrollView, PolicyType: {NEVER: 0, AUTOMATIC: 1}},
        PopupMenu: {PopupMenuSection: Section}, PanelMenu: {Button: Actor},
        GObject: {registerClass: klass => klass}, Extension: class {}, _: text => text,
    }, ['PopupScrollMenuSection']);
    const section = new PopupScrollMenuSection();
    assert(section._scrollView.scrollChild === section.box, 'Scroll container installs child using supported API');
}
print('ScrollView regression passed: GNOME 45 container API and GNOME 46+ child API');
