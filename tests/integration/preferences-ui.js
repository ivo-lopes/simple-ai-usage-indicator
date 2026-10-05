// SPDX-License-Identifier: GPL-3.0-only
// Runs actual preferences against GTK/Adwaita inside the private Shell laboratory.
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
const {ExtensionPreferences} = await import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js');
const path = ARGV[0];
const metadata = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(`${path}/metadata.json`)[1]));
metadata.path = path;
metadata.dir = Gio.File.new_for_path(path);
const {default: Preferences} = await import(Gio.File.new_for_path(`${path}/prefs.js`).get_uri());
const prefs = new Preferences(metadata);
ExtensionPreferences.lookupByUUID = uuid => uuid === metadata.uuid ? prefs : null;
const app = new Adw.Application({application_id: 'org.example.SauiLabPreferences', flags: Gio.ApplicationFlags.NON_UNIQUE});
let failure = null;
app.connect('activate', () => {
    const window = new Adw.PreferencesWindow({application: app, title: 'SAUI preferences laboratory'});
    prefs.fillPreferencesWindow(window);
    window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
        try {
            const widgets = [];
            const walk = widget => {
                widgets.push(widget);
                for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
                    walk(child);
            };
            walk(window);
            const rows = widgets.filter(w => w instanceof Adw.PreferencesRow);
            const expanders = rows.filter(w => w instanceof Adw.ExpanderRow);
            if (expanders.length !== 3 || !widgets.some(w => w instanceof Gtk.SpinButton))
                throw new Error('Missing native preference controls');
            if (rows.some(w => w instanceof Adw.PasswordEntryRow))
                throw new Error('Persistent secret field returned');
            expanders.forEach(w => w.expanded = true);
            const focus = [];
            const pressTab = `(async () => {
                const {default: Clutter} = await import('gi://Clutter');
                const {default: GLib} = await import('gi://GLib');
                global.sauiLabKeyboard ??= (global.stage.context?.get_backend() || Clutter.get_default_backend()).get_default_seat().create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
                const now = GLib.get_monotonic_time();
                global.sauiLabKeyboard.notify_keyval(now, Clutter.KEY_Tab, Clutter.KeyState.PRESSED);
                global.sauiLabKeyboard.notify_keyval(now + 1, Clutter.KEY_Tab, Clutter.KeyState.RELEASED);
                return true;
            })()`;
            let step = 0;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                try {
                    if (step > 0) {
                        const target = window.get_focus();
                        focus.push({type: target.constructor.name, title: target.title || target.label || '', role: target.get_accessible_role()});
                    }
                    if (step++ < 12) {
                        const result = Gio.DBus.session.call_sync('org.gnome.Shell', '/org/gnome/Shell',
                            'org.gnome.Shell', 'Eval', new GLib.Variant('(s)', [pressTab]),
                            null, Gio.DBusCallFlags.NONE, 5000, null).deep_unpack();
                        if (!result[0])
                            throw new Error('Native keyboard injection failed: ' + result[1]);
                        return GLib.SOURCE_CONTINUE;
                    }
                    if (new Set(focus.map(f => f.type + f.title)).size < 3)
                        throw new Error('Keyboard traversal did not advance: ' + JSON.stringify(focus));
                    GLib.file_set_contents(ARGV[1], JSON.stringify({rows: rows.map(w => w.title), focus}, null, 2));
                } catch (error) {
                    failure = error;
                }
                window.close();
                app.quit();
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        } catch (error) {
            failure = error;
        }
        window.close();
        app.quit();
        return GLib.SOURCE_REMOVE;
    });
});
app.run([]);
if (failure)
    throw failure;
print('PASS: actual native preferences rows, no password field, keyboard focus and cleanup');
