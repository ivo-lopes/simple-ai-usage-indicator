/**
 * @file extension.js
 * @description Main entry point for AI Code Usage Indicator GNOME Shell Extension.
 * Displays AI coding assistant status indicators in the GNOME panel status area
 * with support for multi-indicator layouts and detailed breakdown popup menus.
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    BAR_DISPLAY_ALL,
    BAR_DISPLAY_CYCLE,
    DEFAULT_ENABLED_PROVIDERS,
    DEFAULT_UPDATE_INTERVAL_SECONDS,
    DISPLAY_MODE_LEFT,
    DISPLAY_MODE_PERCENT,
    DISPLAY_MODE_USED,
    ICON_STYLE_BLACK,
    ICON_STYLE_COLOR,
    ICON_STYLE_SYMBOLIC,
    PROVIDER_ANTIGRAVITY,
    PROVIDER_CLAUDE,
    PROVIDER_CODEX,
} from './constants.js';
import {
    detectEarlyLimitResets,
    formatLimitResetMessage,
} from './limitReset.js';
import {ProviderManager} from './providers/index.js';
import {formatResetCreditExpiryList} from './resetCreditExpiry.js';

const PROGRESS_BAR_WIDTH = 360;
const PROGRESS_BAR_HEIGHT = 7;
const PANEL_ICON_SIZE = 16;
const MENU_TITLE_STYLE = 'color: #fff; font-weight: 700;';

/**
 * A scrollable popup menu section that houses multiple provider usage summaries
 * without exceeding screen height or pushing bottom controls off the display.
 */
class PopupScrollMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();

        this._scrollView = new St.ScrollView({
            style_class: 'vfade',
            overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true,
        });

        this._scrollView.clip_to_allocation = true;
        this._scrollView.set_child(this.box);
        this.actor = this._scrollView;
        this.actor._delegate = this;
        this.setMaxHeight(500);
    }

    setMaxHeight(maxHeight) {
        if (maxHeight && maxHeight > 0)
            this._scrollView.style = `max-height: ${maxHeight}px;`;
        else
            this._scrollView.style = '';
    }
}

/**
 * Panel menu button displaying AI assistant metrics in the top bar.
 */
const AiCodeUsageIndicator = GObject.registerClass(
class AiCodeUsageIndicator extends PanelMenu.Button {
    /**
     * Initializes the indicator button, registers settings listeners, and starts refresh loop.
     *
     * @param {AiCodeUsageExtension} extension - Owning extension instance
     */
    _init(extension) {
        super._init(0.5, _('AI Code Usage Indicator'));

        this._extension = extension;
        this._settings = extension.getSettings();
        this._providerManager = new ProviderManager({settings: this._settings});
        this._menuOpenStateChangedId = null;
        this._refreshSourceId = null;
        this._refreshInFlight = null;
        this._state = {
            summaries: new Map(),
            lastUpdated: null,
            previousSnapshots: new Map(),
        };

        this._panelBox = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });
        this.add_child(this._panelBox);

        this._buildMenu();
        this._menuOpenStateChangedId = this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen)
                void this.refresh();
        });

        this._settings.connectObject(
            'changed::update-interval-seconds',
            () => this._restartRefreshTimer(),
            this,
        );
        this._settings.connectObject(
            'changed::display-mode',
            () => this._renderCurrentState(),
            this,
        );
        this._settings.connectObject(
            'changed::bar-display-mode',
            () => this._renderCurrentState(),
            this,
        );
        this._settings.connectObject(
            'changed::enabled-providers',
            () => {
                this._renderCurrentState();
                void this.refresh();
            },
            this,
        );
        this._settings.connectObject(
            'changed::active-provider',
            () => this._renderCurrentState(),
            this,
        );
        this._settings.connectObject(
            'changed::icon-style',
            () => this._renderCurrentState(),
            this,
        );


        this._restartRefreshTimer();
        this._renderCurrentState();
        void this.refresh();
    }

    _buildMenu() {
        this._usageSection = new PopupScrollMenuSection();
        this.menu.addMenuItem(this._usageSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._refreshItem = new PopupMenu.PopupBaseMenuItem();
        this._refreshItem.add_child(new St.Label({
            text: _('Refresh now'),
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        }));
        this._refreshTimestampLabel = new St.Label({
            text: formatLastUpdatedValue(this._state.lastUpdated),
            style_class: 'dim-label',
            x_align: Clutter.ActorAlign.END,
        });
        this._refreshItem.add_child(this._refreshTimestampLabel);
        this._refreshItem.connect('activate', () => {
            void this.refresh();
        });
        this.menu.addMenuItem(this._refreshItem);

        this.menu.addAction(_('Settings'), () => {
            try {
                this._extension.openPreferences().catch(err => {
                    reportError(err, '[ai-code-usage-indicator] openPreferences failed');
                });
            } catch (err) {
                reportError(err, '[ai-code-usage-indicator] openPreferences failed');
            }
        });

        this.menu.connectObject(
            'open-state-changed',
            (menu, open) => {
                if (open)
                    this._updateScrollMaxHeight();
            },
            this,
        );
    }

    /**
     * Dynamically adjusts the max-height of the scrollable section to fit within the work area.
     * @private
     */
    _updateScrollMaxHeight() {
        try {
            const monitorIndex = Main.layoutManager.primaryIndex ?? 0;
            const workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
            const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
            // Reserve space for top panel (~40px), margins (~20px), and bottom fixed items (~140px)
            const availableHeight = Math.round(workArea.height / scaleFactor) - 200;
            const maxHeight = Math.max(260, availableHeight);
            this._usageSection.setMaxHeight(maxHeight);
        } catch {
            this._usageSection.setMaxHeight(500);
        }
    }

    async refresh() {
        if (this._refreshInFlight)
            return this._refreshInFlight;

        this._refreshTimestampLabel.text = _('Refreshing...');
        this._refreshInFlight = this._refreshAllUsage()
            .catch(error => {
                reportError(error, '[ai-code-usage-indicator] refresh failed');
            })
            .finally(() => {
                this._refreshInFlight = null;
                try {
                    this._renderCurrentState();
                } catch (error) {
                    reportError(error, '[ai-code-usage-indicator] render failed');
                }
            });

        return this._refreshInFlight;
    }

    async _refreshAllUsage() {
        const summaries = await this._providerManager.fetchAllUsage();
        const lastUpdated = GLib.DateTime.new_now_local();

        // Detect early limit resets for Codex
        const codexSummary = summaries.get(PROVIDER_CODEX);
        if (codexSummary && !codexSummary.error) {
            const prevSnapshot = this._state.previousSnapshots.get(PROVIDER_CODEX);
            const currentSnapshot = {
                accountId: codexSummary.account || 'codex',
                observedAt: lastUpdated.to_unix(),
                summary: codexSummary.raw || codexSummary,
            };

            if (prevSnapshot) {
                const limitResets = detectEarlyLimitResets(prevSnapshot, currentSnapshot);
                if (limitResets.length > 0) {
                    try {
                        Main.notify(
                            _('Codex limit reset 🎉'),
                            limitResets.map(formatLimitResetMessage).join('\n'),
                        );
                    } catch {}
                }
            }
            this._state.previousSnapshots.set(PROVIDER_CODEX, currentSnapshot);
        }

        this._state.summaries = summaries;
        this._state.lastUpdated = lastUpdated;
    }

    _renderCurrentState() {
        const displayMode = this._getDisplayMode();
        const barDisplayMode = this._getBarDisplayMode();
        const iconStyle = this._getIconStyle();
        const enabledProviders = this._providerManager.getEnabledProviders();

        this._renderPanelBar(enabledProviders, displayMode, barDisplayMode, iconStyle);
        this._refreshTimestampLabel.text = formatLastUpdatedValue(this._state.lastUpdated);
        this._renderPopupUsage(enabledProviders, displayMode, iconStyle);
    }

    _renderPanelBar(enabledProviders, displayMode, barDisplayMode, iconStyle = ICON_STYLE_SYMBOLIC) {
        this._panelBox.destroy_all_children();

        if (enabledProviders.length === 0) {
            const label = new St.Label({
                text: _('AI: off'),
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._panelBox.add_child(label);
            return;
        }

        const activeId = this._getActiveProviderId();
        const providersToShow = barDisplayMode === BAR_DISPLAY_CYCLE
            ? [enabledProviders.find(p => p.id === activeId) || enabledProviders[0]]
            : enabledProviders;

        for (let i = 0; i < providersToShow.length; i++) {
            const provider = providersToShow[i];
            const summary = this._state.summaries.get(provider.id);

            const providerBox = new St.BoxLayout({
                style_class: 'panel-status-menu-box',
                style: i > 0 ? 'margin-left: 8px;' : '',
            });

            const iconFileName = provider.getIconFileName ? provider.getIconFileName(iconStyle) : provider.iconFileName;
            const iconPath = GLib.build_filenamev([
                this._extension.path,
                'icons',
                iconFileName,
            ]);

            const isCustomStyle = iconStyle === ICON_STYLE_COLOR || iconStyle === ICON_STYLE_BLACK;
            const icon = new St.Icon({
                gicon: Gio.icon_new_for_string(iconPath),
                icon_size: PANEL_ICON_SIZE,
                style_class: isCustomStyle ? 'panel-icon' : 'system-status-icon',
                y_align: Clutter.ActorAlign.CENTER,
            });

            const labelText = formatProviderPanelLabel(provider, summary, displayMode);
            const label = new St.Label({
                text: labelText,
                y_align: Clutter.ActorAlign.CENTER,
            });

            providerBox.add_child(icon);
            providerBox.add_child(label);
            this._panelBox.add_child(providerBox);
        }
    }

    _renderPopupUsage(enabledProviders, displayMode, iconStyle = ICON_STYLE_SYMBOLIC) {
        this._usageSection.removeAll();

        if (enabledProviders.length === 0) {
            this._usageSection.addMenuItem(new PopupMenu.PopupMenuItem(
                _('No AI assistants enabled. Go to Settings to enable them.'),
                {reactive: false, can_focus: false},
            ));
            return;
        }

        for (let i = 0; i < enabledProviders.length; i++) {
            const provider = enabledProviders[i];
            const summary = this._state.summaries.get(provider.id);

            if (i > 0)
                this._usageSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._renderProviderSection(provider, summary, displayMode, iconStyle);
        }
    }

    _renderProviderSection(provider, summary, displayMode, iconStyle = ICON_STYLE_SYMBOLIC) {
        // Section Header: Icon + Name + Plan + Account
        const headerItem = createProviderHeaderMenuItem(this._extension.path, provider, summary, iconStyle);
        this._usageSection.addMenuItem(headerItem);

        if (!summary) {
            this._usageSection.addMenuItem(new PopupMenu.PopupMenuItem(
                _('Fetching usage data...'),
                {reactive: false, can_focus: false},
            ));
            return;
        }

        if (summary.error) {
            this._usageSection.addMenuItem(new PopupMenu.PopupMenuItem(
                String(summary.error?.message || summary.error),
                {reactive: false, can_focus: false},
            ));
            return;
        }

        // Primary window (e.g. 5-hour window)
        if (summary.primaryWindow) {
            this._usageSection.addMenuItem(createUsageProgressMenuItem(
                formatWindowLabel(summary.primaryWindow.label) || _('5-hour window'),
                summary.primaryWindow,
                displayMode,
            ));
        }

        // Secondary window (e.g. Weekly window)
        if (summary.weekWindow) {
            this._usageSection.addMenuItem(createUsageProgressMenuItem(
                formatWindowLabel(summary.weekWindow.label) || _('Weekly limit'),
                summary.weekWindow,
                displayMode,
            ));
        }

        // Additional models or quota details
        if (summary.models && summary.models.length > 0) {
            const modelsItem = createModelsSummaryMenuItem(summary.models);
            if (modelsItem)
                this._usageSection.addMenuItem(modelsItem);
        }

        // Extra credits / resets
        if (summary.extraCredits) {
            const creditsItem = createExtraCreditsMenuItem(summary.extraCredits);
            if (creditsItem)
                this._usageSection.addMenuItem(creditsItem);
        }
    }

    _restartRefreshTimer() {
        if (this._refreshSourceId) {
            GLib.Source.remove(this._refreshSourceId);
            this._refreshSourceId = null;
        }

        const interval = Math.max(
            60,
            this._settings.get_int('update-interval-seconds') || DEFAULT_UPDATE_INTERVAL_SECONDS,
        );

        this._refreshSourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                void this.refresh();
                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _getDisplayMode() {
        const mode = this._settings.get_string('display-mode');
        if (mode === DISPLAY_MODE_USED)
            return DISPLAY_MODE_USED;
        if (mode === DISPLAY_MODE_PERCENT)
            return DISPLAY_MODE_PERCENT;
        return DISPLAY_MODE_LEFT;
    }

    _getBarDisplayMode() {
        try {
            return this._settings.get_string('bar-display-mode') || BAR_DISPLAY_ALL;
        } catch {
            return BAR_DISPLAY_ALL;
        }
    }

    _getActiveProviderId() {
        try {
            return this._settings.get_string('active-provider') || PROVIDER_CODEX;
        } catch {
            return PROVIDER_CODEX;
        }
    }

    _getIconStyle() {
        try {
            return this._settings.get_string('icon-style') || ICON_STYLE_SYMBOLIC;
        } catch {
            return ICON_STYLE_SYMBOLIC;
        }
    }

    destroy() {
        if (this._refreshSourceId) {
            GLib.Source.remove(this._refreshSourceId);
            this._refreshSourceId = null;
        }

        this._settings.disconnectObject(this);
        if (this._menuOpenStateChangedId) {
            this.menu.disconnect(this._menuOpenStateChangedId);
            this._menuOpenStateChangedId = null;
        }
        this._providerManager.destroy();
        super.destroy();
    }
});

/**
 * GNOME Shell Extension class lifecycle controller.
 */
export default class AiCodeUsageExtension extends Extension {
    /**
     * Instantiates the indicator button and attaches it to the GNOME Shell status area.
     */
    enable() {
        this._indicator = new AiCodeUsageIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    /**
     * Destroys the indicator and unregisters all hooks.
     */
    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}

/**
 * Standardized error reporter logging either to globalThis.logError or console.error.
 *
 * @param {Error|any} error - Exception to report
 * @param {string} context - Log prefix context
 */
function reportError(error, context) {
    if (typeof globalThis.logError === 'function') {
        globalThis.logError(error, context);
        return;
    }

    const detail = error instanceof Error
        ? error.stack ?? error.message
        : String(error);
    console.error(`${context}: ${detail}`);
}

/**
 * Builds the visual header for a provider section inside the popup menu.
 *
 * @param {string} extensionPath - Filesystem path to extension root
 * @param {import('./providers/baseProvider.js').BaseProvider} provider - Provider adapter
 * @param {import('./providers/baseProvider.js').UsageSummary} [summary] - Telemetry summary
 * @param {string} [iconStyle='symbolic'] - 'symbolic' or 'color'
 * @returns {PopupMenu.PopupBaseMenuItem} Constructed header menu item
 */
function createProviderHeaderMenuItem(extensionPath, provider, summary, iconStyle = ICON_STYLE_SYMBOLIC) {
    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });

    const row = new St.BoxLayout({
        vertical: false,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    const iconFileName = provider.getIconFileName ? provider.getIconFileName(iconStyle) : provider.iconFileName;
    const iconPath = GLib.build_filenamev([extensionPath, 'icons', iconFileName]);
    const isCustomStyle = iconStyle === ICON_STYLE_COLOR || iconStyle === ICON_STYLE_BLACK;
    const icon = new St.Icon({
        gicon: Gio.icon_new_for_string(iconPath),
        icon_size: 18,
        style_class: isCustomStyle ? 'panel-icon' : 'system-status-icon',
        y_align: Clutter.ActorAlign.CENTER,
    });
    row.add_child(icon);

    const titleBox = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style: 'margin-left: 10px;',
    });

    const titleLabel = new St.Label({
        text: provider.name,
        style: MENU_TITLE_STYLE,
        x_align: Clutter.ActorAlign.START,
    });
    titleBox.add_child(titleLabel);

    const subtitleParts = [];
    if (summary?.planType)
        subtitleParts.push(summary.planType);
    if (summary?.account)
        subtitleParts.push(summary.account);

    if (subtitleParts.length > 0) {
        titleBox.add_child(new St.Label({
            text: subtitleParts.join('  ·  '),
            style_class: 'dim-label',
            x_align: Clutter.ActorAlign.START,
        }));
    }

    row.add_child(titleBox);
    menuItem.add_child(row);
    return menuItem;
}

/**
 * Translates standard window labels to the active system locale.
 *
 * @param {string|null} [label] - Window label identifier
 * @returns {string} Translated window label
 */
function formatWindowLabel(label) {
    if (!label)
        return '';
    if (label === '5-hour window')
        return _('5-hour window');
    if (label === 'Weekly limit')
        return _('Weekly limit');
    if (label === 'Tokens today')
        return _('Tokens today');
    return label;
}

/**
 * Builds a progress bar row representing an active usage window (e.g. 5 hours or weekly).
 *
 * @param {string} title - Section title (e.g. '5-hour window')
 * @param {import('./providers/baseProvider.js').UsageWindow} window - Quota window details
 * @param {string} displayMode - 'left' | 'used' | 'percent'
 * @returns {PopupMenu.PopupBaseMenuItem}
 */
function createUsageProgressMenuItem(title, window, displayMode) {
    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });

    const content = new St.BoxLayout({
        vertical: true,
        x_expand: true,
    });

    content.add_child(new St.Label({
        text: title,
        style: 'color: #ddd; font-weight: 600; font-size: 0.95em;',
        x_align: Clutter.ActorAlign.START,
    }));

    content.add_child(new St.Label({
        text: formatWindowValue(window, displayMode),
        style: 'font-weight: 700; font-size: 1.05em; margin-top: 2px;',
        x_align: Clutter.ActorAlign.START,
    }));

    const progressPercent = getWindowProgressPercent(window, displayMode);
    content.add_child(createProgressBar(progressPercent, displayMode));

    const subtitle = formatWindowSubtitle(window);
    if (subtitle) {
        content.add_child(new St.Label({
            text: subtitle,
            style_class: 'dim-label',
            x_align: Clutter.ActorAlign.START,
        }));
    }

    menuItem.add_child(content);
    return menuItem;
}

/**
 * Builds the popup menu section displaying individual model tokens or active quotas.
 *
 * @param {Array<Object>} models - Model usage list
 * @returns {PopupMenu.PopupBaseMenuItem|null}
 */
function createModelsSummaryMenuItem(models) {
    if (!models || models.length === 0)
        return null;

    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });

    const content = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style: 'margin-top: 4px;',
    });

    content.add_child(new St.Label({
        text: _('Active Models & Quota'),
        style: 'color: #bbb; font-weight: 600; font-size: 0.9em;',
        x_align: Clutter.ActorAlign.START,
    }));

    for (const model of models.slice(0, 3)) {
        const lineBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: 'margin-top: 2px;',
        });
        lineBox.add_child(new St.Label({
            text: model.name || model.limitName || _('Model'),
            style_class: 'dim-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        }));

        const val = model.formattedTokens || model.tier || (model.usedPercent !== undefined ? `${Math.round(model.usedPercent * 100)}%` : '');
        lineBox.add_child(new St.Label({
            text: val,
            style: 'color: #ccc; font-size: 0.9em;',
            x_align: Clutter.ActorAlign.END,
        }));
        content.add_child(lineBox);
    }

    menuItem.add_child(content);
    return menuItem;
}

/**
 * Builds a footer label for bonus reset credits or stored conversation sessions.
 *
 * @param {Object} credits - Credits or session stats object
 * @returns {PopupMenu.PopupBaseMenuItem|null}
 */
function createExtraCreditsMenuItem(credits) {
    if (!credits)
        return null;

    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });

    const content = new St.BoxLayout({
        vertical: false,
        x_expand: true,
    });

    let text = '';
    if (typeof credits.availableCount === 'number') {
        text = `${credits.availableCount} ${_('rate limit resets available')}`;
    } else if (credits.conversations) {
        text = `${credits.conversations} ${_('CLI sessions stored locally')}`;
    } else if (credits.totalSessions) {
        text = `${credits.totalSessions} ${_('total Claude Code sessions')}`;
    }

    if (!text)
        return null;

    content.add_child(new St.Label({
        text,
        style_class: 'dim-label',
        x_align: Clutter.ActorAlign.START,
    }));

    menuItem.add_child(content);
    return menuItem;
}

/**
 * Creates a rounded Clutter progress bar actor with dynamic status color.
 *
 * @param {number|null} percent - Normalized fraction (0.0 to 1.0)
 * @param {string} displayMode - 'left' | 'used' | 'percent'
 * @returns {St.Widget} Clutter actor containing track and fill bar
 */
function createProgressBar(percent, displayMode) {
    const normalized = normalizeProgressPercent(percent);
    const fillWidth = normalized === null
        ? 0
        : Math.round(PROGRESS_BAR_WIDTH * normalized);
    const fill = fillWidth > 0
        ? new St.Widget({
            width: fillWidth,
            height: PROGRESS_BAR_HEIGHT,
            style: [
                `background-color: ${getProgressColor(normalized, displayMode)};`,
                `border-radius: ${Math.floor(PROGRESS_BAR_HEIGHT / 2)}px;`,
            ].join(' '),
        })
        : null;

    const track = new St.Widget({
        width: PROGRESS_BAR_WIDTH,
        height: PROGRESS_BAR_HEIGHT,
        x_align: Clutter.ActorAlign.START,
        layout_manager: new Clutter.FixedLayout(),
        style: [
            'background-color: rgba(255, 255, 255, 0.16);',
            `border-radius: ${Math.floor(PROGRESS_BAR_HEIGHT / 2)}px;`,
            'margin-top: 5px;',
            'margin-bottom: 4px;',
        ].join(' '),
    });

    if (fill) {
        fill.set_position(0, 0);
        track.add_child(fill);
    }

    return track;
}

/**
 * Formats the compact status label for an assistant in the GNOME panel top bar.
 *
 * @param {import('./providers/baseProvider.js').BaseProvider} provider - Provider instance
 * @param {import('./providers/baseProvider.js').UsageSummary} [summary] - Telemetry data
 * @param {string} displayMode - User's chosen display mode
 * @returns {string} Text to render in top panel
 */
function formatProviderPanelLabel(provider, summary, displayMode) {
    if (!summary)
        return '--';

    if (summary.error)
        return '!';

    // If percent is available
    if (summary.percent !== null) {
        if (displayMode === DISPLAY_MODE_USED) {
            return `${Math.round(summary.percent * 100)}%`;
        } else if (displayMode === DISPLAY_MODE_PERCENT) {
            return `${Math.round((summary.leftPercent ?? (1 - summary.percent)) * 100)}%`;
        } else {
            return `${Math.round((summary.leftPercent ?? (1 - summary.percent)) * 100)}% ${_('left')}`;
        }
    }

    // If numeric values are available
    const val = displayMode === DISPLAY_MODE_USED ? summary.used : summary.left;
    if (val !== null && val !== undefined) {
        const suffix = displayMode === DISPLAY_MODE_USED ? _('used') : _('left');
        return `${formatCompact(val)} ${suffix}`;
    }

    if (summary.primaryWindow?.status)
        return summary.primaryWindow.status;

    if (summary.primaryWindow?.usedFormatted)
        return summary.primaryWindow.usedFormatted;

    return _('OK');
}

/**
 * Formats the last refreshed timestamp into a human-readable date/time string.
 *
 * @param {GLib.DateTime|null} lastUpdated - GLib DateTime instance
 * @returns {string} Formatted timestamp string (YYYY-MM-DD HH:MM)
 */
function formatLastUpdatedValue(lastUpdated) {
    if (!lastUpdated)
        return _('never');

    return lastUpdated.format('%F %R');
}

/**
 * Formats the primary numeric metric string for a usage window in the popup menu.
 *
 * @param {import('./providers/baseProvider.js').UsageWindow} window - Window metrics
 * @param {string} displayMode - 'left' | 'used' | 'percent'
 * @returns {string}
 */
function formatWindowValue(window, displayMode) {
    if (window.status)
        return window.status;

    if (window.usedFormatted)
        return window.usedFormatted;

    if (displayMode === DISPLAY_MODE_USED) {
        if (window.used !== null && window.used !== undefined)
            return `${formatCompact(window.used)} ${_('used')}`;

        if (window.usedPercent !== null && window.usedPercent !== undefined)
            return `${Math.round(window.usedPercent * 100)}% ${_('used')}`;
    } else {
        if (window.left !== null && window.left !== undefined)
            return `${formatCompact(window.left)} ${_('remaining')}`;

        if (window.leftPercent !== null && window.leftPercent !== undefined)
            return `${Math.round(window.leftPercent * 100)}% ${_('remaining')}`;

        if (window.usedPercent !== null && window.usedPercent !== undefined)
            return `${Math.round((1 - window.usedPercent) * 100)}% ${_('remaining')}`;
    }

    return _('Available');
}

/**
 * Builds the secondary descriptive line underneath a window progress bar.
 *
 * @param {import('./providers/baseProvider.js').UsageWindow} window - Window metrics
 * @returns {string} Subtitle text separated by bullet dots
 */
function formatWindowSubtitle(window) {
    const parts = [];

    const resetText = formatWindowReset(window);
    if (resetText)
        parts.push(resetText);

    if (window.limit !== null && window.limit !== undefined)
        parts.push(`${formatNumber(window.limit)} ${_('total')}`);

    if (window.used !== null && window.used !== undefined)
        parts.push(`${formatNumber(window.used)} ${_('used')}`);

    return parts.join('  •  ');
}

/**
 * Resolves and formats window reset countdown or clock time string.
 *
 * @param {import('./providers/baseProvider.js').UsageWindow} window - Window metrics
 * @returns {string}
 */
function formatWindowReset(window) {
    if (typeof window.resetsAt === 'string') {
        try {
            const date = new Date(window.resetsAt);
            return `${_('Resets')} ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
        } catch {}
    }

    if (typeof window.resetAt === 'number' && Number.isFinite(window.resetAt)) {
        const resetDateTime = GLib.DateTime.new_from_unix_local(Math.round(window.resetAt));
        if (resetDateTime)
            return `${_('Resets')} ${resetDateTime.format('%H:%M')}`;
    }

    if (typeof window.resetAfterSeconds === 'number' && Number.isFinite(window.resetAfterSeconds))
        return `${_('Resets in')} ${formatDuration(window.resetAfterSeconds)}`;

    return '';
}

/**
 * Derives normalized 0.0..1.0 value for the progress bar fill based on displayMode.
 *
 * @param {import('./providers/baseProvider.js').UsageWindow} window - Window metrics
 * @param {string} displayMode - 'left' | 'used' | 'percent'
 * @returns {number|null}
 */
function getWindowProgressPercent(window, displayMode) {
    if (window.usedPercent !== null && window.usedPercent !== undefined) {
        return displayMode === DISPLAY_MODE_USED
            ? window.usedPercent
            : Math.max(1 - window.usedPercent, 0);
    }

    if (window.percent !== null && window.percent !== undefined) {
        return displayMode === DISPLAY_MODE_USED
            ? window.percent
            : Math.max(1 - window.percent, 0);
    }

    return null;
}

/**
 * Clamps numeric values strictly between 0.0 and 1.0.
 *
 * @param {number|null} percent
 * @returns {number|null}
 */
function normalizeProgressPercent(percent) {
    if (typeof percent !== 'number' || !Number.isFinite(percent))
        return null;

    return Math.max(0, Math.min(percent, 1));
}

/**
 * Computes Adwaita color hex based on fill fraction and whether it represents remaining or used quota.
 *
 * @param {number} percent - Normalized fraction (0.0 to 1.0)
 * @param {string} displayMode - 'left' | 'used' | 'percent'
 * @returns {string} Hex color code
 */
function getProgressColor(percent, displayMode) {
    if (displayMode !== DISPLAY_MODE_USED) {
        if (percent <= 0.15)
            return '#ed333b';
        if (percent <= 0.35)
            return '#f6d32d';
        return '#2ec27e';
    }

    if (percent >= 0.85)
        return '#ed333b';
    if (percent >= 0.65)
        return '#f6d32d';
    return '#62a0ea';
}

/**
 * Formats a number with locale-specific thousands separators.
 *
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
    return new Intl.NumberFormat().format(Math.round(value));
}

/**
 * Formats numeric values into compact notation (e.g. 1.2k, 4.5M).
 *
 * @param {number} value
 * @returns {string}
 */
function formatCompact(value) {
    return new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

/**
 * Formats seconds into human-readable duration strings (e.g. "4h 12m", "35m", "15s").
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0 && minutes > 0)
        return `${hours}h ${minutes}m`;
    if (hours > 0)
        return `${hours}h`;
    if (minutes > 0)
        return `${minutes}m`;
    return `${seconds}s`;
}

