/**
 * @file prefs.js
 * @description Modern Libadwaita / GTK4 preferences dialog for AI Code Usage Indicator.
 * Provides controls for update intervals, display formats, top bar layouts,
 * assistant enablement toggles, and real-time authentication test buttons.
 */

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
    PROVIDER_ANTIGRAVITY,
    PROVIDER_CLAUDE,
    PROVIDER_CODEX,
} from './constants.js';
import {ProviderManager} from './providers/index.js';

/**
 * Preferences page rendered inside Adw.PreferencesWindow.
 */
const AiCodeUsagePreferencesPage = GObject.registerClass(
class AiCodeUsagePreferencesPage extends Adw.PreferencesPage {
    /**
     * @param {Gio.Settings} settings - Extension GSettings instance
     */
    _init(settings) {
        super._init({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });

        this._settings = settings;
        this._providerManager = new ProviderManager({settings});

        this.add(this._buildGeneralGroup());
        this.add(this._buildAssistantsGroup());
    }

    /**
     * Builds the "Display & Refresh" preferences group.
     * @private
     * @returns {Adw.PreferencesGroup}
     */
    _buildGeneralGroup() {
        const group = new Adw.PreferencesGroup({
            title: _('Display & Refresh'),
            description: _('Configure refresh rates and appearance in the top panel.'),
        });

        const adjustment = new Gtk.Adjustment({
            lower: 60,
            upper: 3600,
            step_increment: 60,
            page_increment: 300,
            value: this._settings.get_int('update-interval-seconds') || DEFAULT_UPDATE_INTERVAL_SECONDS,
        });

        const refreshRow = new Adw.SpinRow({
            title: _('Update interval'),
            subtitle: _('Seconds between automatic usage refreshes'),
            adjustment,
            climb_rate: 1,
            digits: 0,
        });

        this._settings.bind(
            'update-interval-seconds',
            refreshRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT,
        );
        group.add(refreshRow);

        const currentDisplayMode = this._settings.get_string('display-mode');
        const displayRow = new Adw.ComboRow({
            title: _('Display mode'),
            subtitle: _('Choose whether to show remaining quota, consumed quota, or percentage.'),
            model: Gtk.StringList.new([
                _('Remaining quota (left)'),
                _('Consumed quota (used)'),
                _('Percentage (%)'),
            ]),
            selected: currentDisplayMode === DISPLAY_MODE_USED ? 1 : (currentDisplayMode === DISPLAY_MODE_PERCENT ? 2 : 0),
        });
        displayRow.connect('notify::selected', combo => {
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
            title: _('Top bar layout'),
            subtitle: _('Show all enabled assistants side-by-side or cycle with a click.'),
            model: Gtk.StringList.new([
                _('Show all enabled assistants'),
                _('Cycle one at a time'),
            ]),
            selected: currentBarMode === BAR_DISPLAY_CYCLE ? 1 : 0,
        });
        barRow.connect('notify::selected', combo => {
            this._settings.set_string(
                'bar-display-mode',
                combo.selected === 1 ? BAR_DISPLAY_CYCLE : BAR_DISPLAY_ALL,
            );
        });
        group.add(barRow);

        return group;
    }

    /**
     * Builds the "Coding Assistants" preferences group containing per-assistant expanders.
     * @private
     * @returns {Adw.PreferencesGroup}
     */
    _buildAssistantsGroup() {
        const group = new Adw.PreferencesGroup({
            title: _('Coding Assistants'),
            description: _('Manage monitored assistants and test their local authentication.'),
        });

        const providers = this._providerManager.getAllProviders();
        for (const provider of providers) {
            const expander = this._createProviderExpander(provider);
            group.add(expander);
        }

        return group;
    }

    /**
     * Creates an expander row for a single assistant with toggle switches and auth testing.
     *
     * @private
     * @param {import('./providers/baseProvider.js').BaseProvider} provider
     * @returns {Adw.ExpanderRow}
     */
    _createProviderExpander(provider) {
        const expander = new Adw.ExpanderRow({
            title: provider.name,
            subtitle: _('Checking auth...'),
            show_enable_switch: true,
            enable_expansion: true,
        });

        const isEnabled = this._isProviderEnabled(provider.id);
        expander.set_enable_expansion(isEnabled);

        expander.connect('notify::enable-expansion', () => {
            this._setProviderEnabled(provider.id, expander.get_enable_expansion());
        });

        const authRow = new Adw.ActionRow({
            title: _('Local authentication'),
            subtitle: _('Checking status...'),
        });
        const checkButton = new Gtk.Button({
            label: _('Test connection'),
            valign: Gtk.Align.CENTER,
        });
        checkButton.connect('clicked', () => {
            void this._testProvider(provider, authRow, expander);
        });
        authRow.add_suffix(checkButton);
        expander.add_row(authRow);

        if (provider.id === PROVIDER_CLAUDE) {
            const tokenRow = new Adw.PasswordEntryRow({
                title: _('Custom Claude Token (optional)'),
            });
            tokenRow.text = this._settings.get_string('claude-token') || '';
            tokenRow.connect('changed', entry => {
                this._settings.set_string('claude-token', entry.text.trim());
            });
            expander.add_row(tokenRow);
        }

        void this._checkProviderAuth(provider, authRow, expander);

        return expander;
    }

    /**
     * Inspects local credentials for an assistant and updates row subtitles.
     *
     * @private
     * @param {import('./providers/baseProvider.js').BaseProvider} provider
     * @param {Adw.ActionRow} authRow
     * @param {Adw.ExpanderRow} expander
     */
    async _checkProviderAuth(provider, authRow, expander) {
        try {
            const auth = await provider.checkAuth({allowExpired: true});
            const statusText = auth.details || (auth.available ? _('Available') : _('Not found'));
            authRow.subtitle = statusText;
            expander.subtitle = auth.available
                ? (auth.expired ? _('Token expired') : _('Connected'))
                : _('Not configured');
        } catch (error) {
            authRow.subtitle = error.message;
            expander.subtitle = _('Error');
        }
    }

    /**
     * Executes an active telemetry request to verify live connectivity.
     *
     * @private
     * @param {import('./providers/baseProvider.js').BaseProvider} provider
     * @param {Adw.ActionRow} authRow
     * @param {Adw.ExpanderRow} expander
     */
    async _testProvider(provider, authRow, expander) {
        authRow.subtitle = _('Testing connection...');
        try {
            const usage = await provider.fetchUsage();
            if (usage.error) {
                authRow.subtitle = `Error: ${usage.error.message || usage.error}`;
                expander.subtitle = _('Failed');
                return;
            }

            const parts = [];
            if (usage.planType)
                parts.push(usage.planType);
            if (usage.account)
                parts.push(usage.account);
            if (usage.percent !== null)
                parts.push(`${Math.round(usage.percent * 100)}% used`);

            authRow.subtitle = `Success! ${parts.join(' · ')}`;
            expander.subtitle = _('Connected');
        } catch (error) {
            authRow.subtitle = `Test failed: ${error.message}`;
            expander.subtitle = _('Error');
        }
    }

    /**
     * Checks whether a provider is enabled in GSettings.
     *
     * @private
     * @param {string} providerId
     * @returns {boolean}
     */
    _isProviderEnabled(providerId) {
        const enabled = this._settings.get_strv('enabled-providers');
        if (!enabled || enabled.length === 0)
            return true;
        return enabled.includes(providerId);
    }

    /**
     * Toggles provider enablement in GSettings.
     *
     * @private
     * @param {string} providerId
     * @param {boolean} enable
     */
    _setProviderEnabled(providerId, enable) {
        let enabled = this._settings.get_strv('enabled-providers');
        if (!enabled || enabled.length === 0)
            enabled = [PROVIDER_CODEX, PROVIDER_CLAUDE, PROVIDER_ANTIGRAVITY];

        const set = new Set(enabled);
        if (enable) {
            set.add(providerId);
        } else {
            set.delete(providerId);
        }

        this._settings.set_strv('enabled-providers', Array.from(set));
    }

    /**
     * Reads top bar layout mode ('all' or 'cycle').
     *
     * @private
     * @returns {string}
     */
    _getBarDisplayMode() {
        try {
            return this._settings.get_string('bar-display-mode') || BAR_DISPLAY_ALL;
        } catch {
            return BAR_DISPLAY_ALL;
        }
    }
});

/**
 * Extension preferences entry point for GNOME Extensions app / gnome-extensions prefs.
 */
export default class AiCodeUsagePreferences extends ExtensionPreferences {
    /**
     * Populates preferences window with the modern Libadwaita preferences page.
     *
     * @param {Adw.PreferencesWindow} window
     */
    fillPreferencesWindow(window) {
        const page = new AiCodeUsagePreferencesPage(this.getSettings());
        window.add(page);
    }
}

