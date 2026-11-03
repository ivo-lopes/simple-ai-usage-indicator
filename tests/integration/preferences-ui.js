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
const _ = text => prefs.gettext(text);
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
            // Exercise real native account controls with an empty synthetic CLI directory.
            const page = widgets.find(w => typeof w._addAccount === 'function');
            const settings = prefs.getSettings();
            const accountDirectory = GLib.dir_make_tmp('saui-native-account-XXXXXX');
            page._addAccount('codex', accountDirectory);
            const configured = () => JSON.parse(settings.get_string('accounts-config')).accounts;
            const added = configured().at(-1);
            if (configured().length !== 4 || added.credentialReference !== accountDirectory)
                throw new Error('Native add did not persist independent account');
            const descendants = root => {
                const found = [root];
                for (let child = root.get_first_child(); child; child = child.get_next_sibling())
                    found.push(...descendants(child));
                return found;
            };
            let accountRow = descendants(window).find(w => w instanceof Adw.ExpanderRow && w.title === added.displayName);
            let controls = descendants(accountRow);
            const name = controls.find(w => w instanceof Adw.EntryRow && w.title === _('Account name'));
            name.text = 'Synthetic second Codex';
            controls.find(w => w instanceof Gtk.Button && w.label === _('Save account')).emit('clicked');
            if (configured().at(-1).displayName !== name.text)
                throw new Error('Native name edit not saved');
            accountRow = descendants(window).find(w => w instanceof Adw.ExpanderRow && w.title === 'Synthetic second Codex');
            accountRow.enable_expansion = false;
            if (configured().at(-1).enabled)
                throw new Error('Native disable affected wrong instance');
            accountRow = descendants(window).find(w => w instanceof Adw.ExpanderRow && w.title === 'Synthetic second Codex');
            descendants(accountRow).find(w => w instanceof Gtk.Button && w.label === _('Move up')).emit('clicked');
            if (configured()[2].instanceId !== added.instanceId)
                throw new Error('Native move did not preserve instance identity');
            accountRow = descendants(window).find(w => w instanceof Adw.ExpanderRow && w.title === 'Synthetic second Codex');
            descendants(accountRow).find(w => w instanceof Gtk.Button && w.label === _('Remove account')).emit('clicked');
            if (configured().length !== 3 || !Gio.File.new_for_path(accountDirectory).query_exists(null))
                throw new Error('Native removal changed CLI directory');
            Gio.File.new_for_path(accountDirectory).delete(null);
            settings.reset('accounts-config');
            page._rebuildAccounts();
            print('PASS: native GTK add, rename, disable, reorder and remove account (no credentials)');
            descendants(window).filter(w => w instanceof Adw.ExpanderRow).forEach(w => w.expanded = true);
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
