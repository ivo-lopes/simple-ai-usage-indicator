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
        this.add(this._buildAssistantsGroup());
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

        const refreshRow = new Adw.SpinRow({
            use_markup: false,
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
            subtitle: _('Choose themed symbolic, black, or colored generic icons in the panel and menu.'),
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

        return group;
    }

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

    _createProviderExpander(provider) {
        const expander = new Adw.ExpanderRow({
            use_markup: false,
            title: provider.name,
            subtitle: _('Checking auth...'),
            show_enable_switch: true,
            enable_expansion: true,
        });

        const isEnabled = this._isProviderEnabled(provider.id);
        expander.set_enable_expansion(isEnabled);

        this._connect(expander, 'notify::enable-expansion', () => {
            this._setProviderEnabled(provider.id, expander.get_enable_expansion());
        });

        const authRow = new Adw.ActionRow({
            use_markup: false,
            title: _('Local authentication'),
            subtitle: _('Checking status...'),
        });
        const checkButton = new Gtk.Button({
            label: _('Test connection'),
            valign: Gtk.Align.CENTER,
        });
        this._connect(checkButton, 'clicked', () => {
            void this._testProvider(provider, authRow, expander);
        });
        authRow.add_suffix(checkButton);
        expander.add_row(authRow);

        void this._checkProviderAuth(provider, authRow, expander);

        return expander;
    }

    async _checkProviderAuth(provider, authRow, expander) {
        if (this._disposed)
            return;
        try {
            const auth = await provider.checkAuth({allowExpired: true});
            if (this._disposed)
                return;
            const statusText = auth.details || (auth.available ? _('Available') : _('Not found'));
            authRow.subtitle = statusText;
            expander.subtitle = auth.available
                ? (auth.expired ? _('Token expired') : _('Connected'))
                : _('Not configured');
        } catch (error) {
            if (this._disposed)
                return;
            authRow.subtitle = _('Authentication check unavailable.');
            expander.subtitle = _('Error');
        }
    }

    async _testProvider(provider, authRow, expander) {
        if (this._disposed)
            return;
        authRow.subtitle = _('Testing connection...');
        try {
            const usage = await provider.fetchUsage({force: true});
            if (this._disposed)
                return;
            if (usage.error) {
                authRow.subtitle = format(_('Error: %s'), usage.error.message || usage.error);
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
            if (this._disposed)
                return;
            authRow.subtitle = _('Test failed. Check authentication and connectivity.');
            expander.subtitle = _('Error');
        }
    }

    _isProviderEnabled(providerId) {
        const enabled = this._settings.get_strv('enabled-providers');
        return enabled.includes(providerId);
    }

    _setProviderEnabled(providerId, enable) {
        const enabled = this._settings.get_strv('enabled-providers');

        const set = new Set(enabled);
        if (enable) {
            set.add(providerId);
        } else {
            set.delete(providerId);
        }

        this._settings.set_strv('enabled-providers', Array.from(set));
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

