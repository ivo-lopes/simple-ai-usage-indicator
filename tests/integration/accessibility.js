// SPDX-License-Identifier: GPL-3.0-only
// Enumerate native AT-SPI in a synthetic, private Preferences session.
import Atspi from 'gi://Atspi';
import GLib from 'gi://GLib';
import Gettext from 'gettext';
Gettext.setlocale(Gettext.LocaleCategory.ALL, '');
Gettext.bindtextdomain('simple-ai-usage-indicator', ARGV[1] + '/locale');
const updateTitle = Gettext.dgettext('simple-ai-usage-indicator', 'Update interval');
const displayTitle = Gettext.dgettext('simple-ai-usage-indicator', 'Display mode');
let nodes = [];
function visit(node, depth = 0) {
    if (nodes.length >= 3000 || depth > 60)
        return;
    nodes.push({name: node.get_name(), role: node.get_role_name()});
    for (let i = 0; i < node.get_child_count(); i++)
        visit(node.get_child_at_index(i), depth + 1);
}
const loop = new GLib.MainLoop(null, false);
let attempts = 0;
let passed = false;
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
    nodes = [];
    const desktop = Atspi.get_desktop(0);
    nodes.push({name: desktop.get_name(), role: desktop.get_role_name()});
    // GTK controls must not be hidden behind the Shell's large actor tree.
    const applications = [];
    for (let i = 0; i < desktop.get_child_count(); i++)
        applications.push(desktop.get_child_at_index(i));
    applications.filter(app => app.get_name() === 'org.gnome.Shell.Extensions').forEach(app => visit(app));
    const matches = nodes.filter(n => n.name === updateTitle || n.name === displayTitle || /Simple AI Usage Indicator|Antigravity/.test(n.name || ''));
    passed = matches.some(n => n.name === updateTitle) && matches.some(n => n.name === displayTitle);
    if (!passed && ++attempts < 20)
        return GLib.SOURCE_CONTINUE;
    GLib.file_set_contents(ARGV[0], JSON.stringify({matches, nodes}, null, 2));
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
loop.run();
if (!passed)
    throw new Error('Preferences/controls missing from native AT-SPI tree; see saved enumeration');
print('PASS: native AT-SPI exposes Preferences and named controls');
