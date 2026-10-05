// SPDX-License-Identifier: GPL-3.0-only
// Requires the opt-in lab driver on an isolated test bus, never the user's Shell.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
const [success, value] = Gio.DBus.session.call_sync(
    'org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
    new GLib.Variant('(s)', [ARGV[0]]), new GLib.VariantType('(bs)'),
    Gio.DBusCallFlags.NONE, 15000, null,
).deep_unpack();
if (!success)
    throw new Error(value || 'Lab driver did not enable evaluation');
print(value || 'null');
