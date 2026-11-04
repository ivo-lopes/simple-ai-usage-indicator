// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    BAR_DISPLAY_ALL,
    BAR_DISPLAY_CYCLE,
    DEFAULT_UPDATE_INTERVAL_SECONDS,
    DISPLAY_MODE_LEFT,
    DISPLAY_MODE_PERCENT,
    DISPLAY_MODE_USED,
    ICON_STYLE_BLACK,
    ICON_STYLE_COLOR,
    ICON_STYLE_SYMBOLIC,
} from './constants.js';
import {ProviderManager} from './providers/index.js';
import {format} from './i18n.js';
import {readAccounts, writeAccounts, ACCOUNT_PROVIDERS, PROVIDER_NAMES} from './providers/accounts.js';

const SimpleAiUsagePreferencesPage = GObject.registerClass(
class SimpleAiUsagePreferencesPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });

        this._disposed = false;
        this._signals = [];
        this._settings = settings;
        this.connect('unrealize', () => this.dispose());
        this._providerManager = new ProviderManager({settings});

        this.add(this._buildGeneralGroup());
        this._accountSignalStart = this._signals.length;
        this._accountGeneration = 0;
        this._rebuildAccounts();
    }

    _connect(object, signal, callback) {
        const id = object.connect(signal, (...args) => {
            if (!this._disposed)
                callback(...args);
        });
        this._signals.push([object, id]);
    }

    dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        this._chooser?.destroy();
        this._chooser = null;
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        this._providerManager.destroy();
    }

    _buildGeneralGroup() {
        const group = new Adw.PreferencesGroup({
            title: _('Display and Refresh'),
            description: _('Configure refresh rates and appearance in the top panel.'),
        });

        const adjustment = new Gtk.Adjustment({
            lower: 60,
            upper: 3600,
            step_increment: 60,
            page_increment: 300,
            value: this._settings.get_int('update-interval-seconds') || DEFAULT_UPDATE_INTERVAL_SECONDS,
        });

        const refreshRow = new Adw.ActionRow({
            use_markup: false,
            title: _('Update interval'),
            subtitle: _('Seconds between automatic usage refreshes'),
        });
        // A native SpinButton exposes its labeled value consistently through AT-SPI.
        const refreshSpin = new Gtk.SpinButton({
            adjustment,
            climb_rate: 1,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
        });
        refreshSpin.update_property([Gtk.AccessibleProperty.LABEL], [_('Update interval')]);
        refreshRow.add_suffix(refreshSpin);
        refreshRow.activatable_widget = refreshSpin;

        this._settings.bind(
            'update-interval-seconds',
            refreshSpin,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        group.add(refreshRow);

        const currentDisplayMode = this._settings.get_string('display-mode');
        const displayRow = new Adw.ComboRow({
            use_markup: false,
            title: _('Display mode'),
            subtitle: _('Choose whether to show remaining quota, consumed quota, or percentage.'),
            model: Gtk.StringList.new([
                _('Remaining quota (left)'),
                _('Consumed quota (used)'),
                _('Percentage (%)'),
            ]),
            selected: currentDisplayMode === DISPLAY_MODE_USED ? 1 : (currentDisplayMode === DISPLAY_MODE_PERCENT ? 2 : 0),
        });
        this._connect(displayRow, 'notify::selected', combo => {
            let mode = DISPLAY_MODE_LEFT;
            if (combo.selected === 1)
                mode = DISPLAY_MODE_USED;
            else if (combo.selected === 2)
                mode = DISPLAY_MODE_PERCENT;
            this._settings.set_string('display-mode', mode);
        });
        group.add(displayRow);

        const currentBarMode = this._getBarDisplayMode();
        const barRow = new Adw.ComboRow({
            use_markup: false,
            title: _('Top bar layout'),
            subtitle: _('Show all enabled assistants or only the selected assistant.'),
            model: Gtk.StringList.new([
                _('Show all enabled assistants'),
                _('Show selected assistant'),
            ]),
            selected: currentBarMode === BAR_DISPLAY_CYCLE ? 1 : 0,
        });
        this._connect(barRow, 'notify::selected', combo => {
            this._settings.set_string(
                'bar-display-mode',
                combo.selected === 1 ? BAR_DISPLAY_CYCLE : BAR_DISPLAY_ALL,
            );
        });
        group.add(barRow);

        const currentIconStyle = this._getIconStyle();
        const iconStyleValues = [
            ICON_STYLE_SYMBOLIC,
            ICON_STYLE_BLACK,
            ICON_STYLE_COLOR,
        ];
        let selectedIconIndex = 0;
        if (currentIconStyle === ICON_STYLE_BLACK)
            selectedIconIndex = 1;
        else if (currentIconStyle === ICON_STYLE_COLOR)
            selectedIconIndex = 2;

        const iconStyleRow = new Adw.ComboRow({
            use_markup: false,
            title: _('Icon style'),
            subtitle: _('Choose themed symbolic, black, or colored provider icons in the panel and menu.'),
            model: Gtk.StringList.new([
                _('Symbolic (theme color)'),
                _('Monochrome black (Black)'),
                _('Colored icons (Color)'),
            ]),
            selected: selectedIconIndex,
        });
        this._connect(iconStyleRow, 'notify::selected', combo => {
            const chosen = iconStyleValues[combo.selected] || ICON_STYLE_SYMBOLIC;
            this._settings.set_string('icon-style', chosen);
        });
        group.add(iconStyleRow);

        const expiry = new Adw.ComboRow({title: _('Reset credit expiry'), use_markup: false,
            subtitle: _('Choose how expiry times appear below the reset credit count.'),
            model: Gtk.StringList.new([_('Time left'), _('Date and time')]),
            selected: this._settings.get_string('reset-credit-expiry-mode') === 'date' ? 1 : 0});
        this._connect(expiry, 'notify::selected', combo => {
            this._settings.set_string('reset-credit-expiry-mode', combo.selected === 1 ? 'date' : 'left');
        });
        group.add(expiry);
        const credits = new Adw.ActionRow({title: _('Icon credits'), use_markup: false,
            subtitle: _('OpenAI symbol by Magnific / Flaticon')});
        credits.add_suffix(new Gtk.LinkButton({label: 'Flaticon',
            uri: 'https://www.flaticon.com/free-icon/chat-gpt_11865326', valign: Gtk.Align.CENTER}));
        group.add(credits);
        return group;
    }

    _rebuildAccounts() {
        this._accountGeneration++;
        for (const [object, id] of this._signals.splice(this._accountSignalStart))
            object.disconnect(id);
        if (this._accountsGroup)
            this.remove(this._accountsGroup);
        this._accountsGroup = this._buildAssistantsGroup();
        this.add(this._accountsGroup);
    }

    _saveAccounts(accounts) {
        try {
            writeAccounts(this._settings, accounts);
            this._providerManager.syncAccounts();
            this._rebuildAccounts();
        } catch {
            this._accountStatus.subtitle = _('Invalid or duplicate CLI directory. Use a separate authenticated directory.');
        }
    }

    _buildAssistantsGroup() {
        const group = new Adw.PreferencesGroup({
            title: _('Coding Assistants'),
            description: _('Monitor existing CLI sessions. Removing an account keeps its credentials.'),
        });
        let accounts;
        try { accounts = readAccounts(this._settings); } catch {
            group.add(new Adw.ActionRow({title: _('Invalid account configuration'),
                subtitle: _('Configuration was preserved. Repair accounts-config before continuing.'), use_markup: false}));
            return group;
        }
        this._accountStatus = new Adw.ActionRow({title: _('Accounts'), use_markup: false});
        group.add(this._accountStatus);
        if (accounts.length) {
            const selected = Math.max(0, accounts.findIndex(a => a.instanceId === this._settings.get_string('active-provider')));
            const active = new Adw.ComboRow({title: _('Selected account'), use_markup: false,
                model: Gtk.StringList.new(accounts.map(a => a.displayName)), selected});
            this._connect(active, 'notify::selected', () => {
                this._settings.set_string('active-provider', accounts[active.selected].instanceId);
            });
            group.add(active);
        }
        for (const [index, account] of accounts.entries()) {
            const provider = this._providerManager.getProvider(account.instanceId);
            const expander = new Adw.ExpanderRow({use_markup: false, title: account.displayName,
                subtitle: PROVIDER_NAMES[account.providerId], show_enable_switch: true,
                enable_expansion: account.enabled});
            this._connect(expander, 'notify::enable-expansion', () => {
                const current = readAccounts(this._settings);
                current[index].enabled = expander.get_enable_expansion();
                this._saveAccounts(current);
            });
            const name = new Adw.EntryRow({title: _('Account name'), text: account.displayName});
            expander.add_row(name);
            const directory = new Adw.EntryRow({title: _('CLI configuration directory'), text: account.credentialReference || ''});
            directory.sensitive = account.providerId !== 'antigravity';
            expander.add_row(directory);
            const browse = new Gtk.Button({label: _('Choose directory'), valign: Gtk.Align.CENTER});
            browse.sensitive = account.providerId !== 'antigravity';
            directory.add_suffix(browse);
            this._connect(browse, 'clicked', () => this._chooseDirectory(directory));
            const save = new Gtk.Button({label: _('Save account'), valign: Gtk.Align.CENTER});
            name.add_suffix(save);
            this._connect(save, 'clicked', () => {
                const current = readAccounts(this._settings);
                current[index] = {...account, displayName: name.text.trim(), credentialReference: directory.text.trim() || null};
                this._saveAccounts(current);
            });
            const authRow = new Adw.ActionRow({use_markup: false, title: _('Local authentication'), subtitle: _('Checking status...')});
            const test = new Gtk.Button({label: _('Test connection'), valign: Gtk.Align.CENTER});
            this._connect(test, 'clicked', async () => {
                test.sensitive = false;
                const generation = this._accountGeneration;
                await this._testProvider(provider, authRow, expander);
                if (!this._disposed && generation === this._accountGeneration)
                    test.sensitive = true;
            });
            authRow.add_suffix(test);
            expander.add_row(authRow);
            const actions = new Adw.ActionRow({title: _('Order and removal'), use_markup: false});
            for (const [label, offset] of [[_('Move up'), -1], [_('Move down'), 1], [_('Remove account'), 0]]) {
                const button = new Gtk.Button({label, valign: Gtk.Align.CENTER});
                button.sensitive = offset === 0 || (index + offset >= 0 && index + offset < accounts.length);
                this._connect(button, 'clicked', () => {
                    const current = readAccounts(this._settings);
                    if (offset === 0)
                        current.splice(index, 1);
                    else
                        [current[index], current[index + offset]] = [current[index + offset], current[index]];
                    this._saveAccounts(current);
                });
                actions.add_suffix(button);
            }
            expander.add_row(actions);
            group.add(expander);
            void this._checkProviderAuth(provider, authRow, expander);
        }
        const type = new Adw.ComboRow({title: _('Provider'), use_markup: false,
            model: Gtk.StringList.new(ACCOUNT_PROVIDERS.map(id => PROVIDER_NAMES[id]))});
        const add = new Gtk.Button({label: _('Add account'), valign: Gtk.Align.CENTER});
        type.add_suffix(add);
        group.add(type);
        this._connect(add, 'clicked', () => {
            const providerId = ACCOUNT_PROVIDERS[type.selected];
            const current = readAccounts(this._settings);
            if (current.some(a => a.providerId === providerId && (providerId === 'antigravity' || a.credentialReference === null))) {
                this._accountStatus.subtitle = providerId === 'antigravity'
                    ? _('Antigravity supports one shared session. Independent authentication is not available.')
                    : _('Choose a separate CLI directory for the new account.');
                if (providerId !== 'antigravity')
                    this._chooseDirectory(null, path => this._addAccount(providerId, path));
                return;
            }
            this._addAccount(providerId, null);
        });
        return group;
    }

    _addAccount(providerId, credentialReference) {
        const accounts = readAccounts(this._settings);
        const accountId = GLib.uuid_string_random();
        accounts.push({instanceId: `${providerId}:${accountId}`, providerId, accountId,
            displayName: `${PROVIDER_NAMES[providerId]} ${accounts.filter(a => a.providerId === providerId).length + 1}`,
            enabled: true, credentialReference});
        this._saveAccounts(accounts);
    }

    _chooseDirectory(entry, callback = null) {
        const chooser = new Gtk.FileChooserNative({title: _('CLI configuration directory'),
            transient_for: this.get_root(), action: Gtk.FileChooserAction.SELECT_FOLDER,
            accept_label: _('Select'), cancel_label: _('Cancel')});
        const generation = this._accountGeneration;
        chooser.connect('response', (_dialog, response) => {
            if (!this._disposed && generation === this._accountGeneration && response === Gtk.ResponseType.ACCEPT) {
                const path = chooser.get_file()?.get_path();
                if (path) {
                    if (entry) entry.text = path;
                    callback?.(path);
                }
            }
            chooser.destroy();
            this._chooser = null;
        });
        this._chooser?.destroy();
        this._chooser = chooser;
        chooser.show();
    }

    async _checkProviderAuth(provider, authRow, expander) {
        const generation = this._accountGeneration;
        if (this._disposed)
            return;
        try {
            const auth = await provider.checkAuth({allowExpired: true});
            if (this._disposed || generation !== this._accountGeneration)
                return;
            const statusText = auth.details || (auth.available ? _('Available') : _('Not found'));
            authRow.subtitle = statusText;
            expander.subtitle = auth.available
                ? (auth.expired ? _('Token expired') : _('Connected'))
                : _('Not configured');
        } catch (error) {
            if (this._disposed || generation !== this._accountGeneration)
                return;
            authRow.subtitle = _('Authentication check unavailable.');
            expander.subtitle = _('Error');
        }
    }

    async _testProvider(provider, authRow, expander) {
        const generation = this._accountGeneration;
        if (this._disposed)
            return;
        authRow.subtitle = _('Testing connection...');
        try {
            const usage = await provider.fetchUsage({force: true});
            if (this._disposed || generation !== this._accountGeneration)
                return;
            if (usage.error || usage.quotaUnavailable) {
                authRow.subtitle = format(_('Error: %s'), usage.error?.message || usage.error || _('Quota unavailable'));
                expander.subtitle = _('Failed');
                return;
            }

            const parts = [];
            if (usage.planType)
                parts.push(usage.planType);
            if (usage.account)
                parts.push(usage.account);
            if (usage.percent !== null)
                parts.push(format(_('%s%% used'), Math.round(usage.percent * 100)));

            authRow.subtitle = format(_('Success! %s'), parts.join(' · '));
            expander.subtitle = _('Connected');
        } catch (error) {
            if (this._disposed || generation !== this._accountGeneration)
                return;
            authRow.subtitle = _('Test failed. Check authentication and connectivity.');
            expander.subtitle = _('Error');
        }
    }

    _getBarDisplayMode() {
        return this._settings.get_string('bar-display-mode') || BAR_DISPLAY_ALL;
    }

    _getIconStyle() {
        return this._settings.get_string('icon-style') || ICON_STYLE_SYMBOLIC;
    }
});

export default class SimpleAiUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new SimpleAiUsagePreferencesPage(this.getSettings());
        window.connect('close-request', () => {
            page.dispose();
            return false;
        });
        window.add(page);
    }
}

