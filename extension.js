// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as BarLevel from 'resource:///org/gnome/shell/ui/barLevel.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

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
    PROVIDER_ANTIGRAVITY,
    PROVIDER_CODEX,
} from './constants.js';
import {
    detectEarlyLimitResets,
    formatLimitResetMessage,
} from './limitReset.js';
import {formatQuotaReset} from './quotaReset.js';
import {formatResetCreditExpiryList} from './resetCreditExpiry.js';
import {formatCodexCreditPanel, formatCreditBalance} from './providers/codexCredits.js';
import {ProviderManager} from './providers/index.js';
import {format, ngettext} from './i18n.js';

const PANEL_ICON_SIZE = 16;
const MENU_TITLE_STYLE = 'font-weight: 700;';
// Select the St API property without constructing an actor at import time.
const VERTICAL_BOX_LAYOUT_PROPS = 'orientation' in St.BoxLayout.prototype
    ? {orientation: Clutter.Orientation.VERTICAL}
    : {vertical: true};

class PopupScrollMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();

        this._scrollView = new St.ScrollView({
            accessible_name: _('Usage details'),
            overlay_scrollbars: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true,
        });

        this._scrollView.clip_to_allocation = true;
        // GNOME 45's inherited St.Bin.set_child bypasses ScrollView's scroll adjustments.
        if (this._scrollView.add_actor)
            this._scrollView.add_actor(this.box);
        else
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

const SimpleAiUsageIndicator = GObject.registerClass(
class SimpleAiUsageIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, _('Simple AI Usage Indicator'));

        // Async refresh promises may settle after actors are destroyed.
        this._destroyed = false;
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
            'changed::accounts-config',
            () => {
                this._providerManager.syncAccounts();
                this._state.summaries.clear();
                this._state.previousSnapshots.clear();
                this._renderCurrentState();
                void this.refresh({force: true});
            }, this,
        );
        this._settings.connectObject(
            'changed::active-provider',
            () => this._renderCurrentState(),
            this,
        );
        this._settings.connectObject(
            'changed::reset-credit-expiry-mode',
            () => this._renderCurrentState(), this,
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
        this._refreshItem.accessible_name = _('Refresh now');
        const refreshLabel = new St.Label({
            text: _('Refresh now'),
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        this._refreshItem.add_child(refreshLabel);
        this._refreshItem.label_actor = refreshLabel;
        this._refreshTimestampLabel = new St.Label({
            text: formatLastUpdatedValue(this._state.lastUpdated),
            style_class: 'dim-label',
            x_align: Clutter.ActorAlign.END,
        });
        this._refreshItem.add_child(this._refreshTimestampLabel);
        this._refreshItem.connect('activate', () => {
            void this.refresh({force: true});
        });
        this.menu.addMenuItem(this._refreshItem);

        this.menu.addAction(_('Settings'), () => {
            this._extension.openPreferences().catch(err => {
                if (!this._destroyed)
                    reportError(err, '[simple-ai-usage-indicator] openPreferences failed');
            });
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

    _updateScrollMaxHeight() {
        if (this._destroyed)
            return;
        try {
            const monitorIndex = Main.layoutManager.primaryIndex ?? 0;
            const workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
            const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
            // Reserve space for top panel (~40px), margins (~20px), and bottom fixed items (~140px)
            const availableHeight = Math.round(workArea.height / scaleFactor) - 200;
            const maxHeight = Math.max(120, availableHeight);
            this._usageSection.setMaxHeight(maxHeight);
        } catch {
            this._usageSection.setMaxHeight(500);
        }
    }

    async refresh({force = false} = {}) {
        if (this._destroyed)
            return;
        while (this._refreshInFlight) {
            if (!force)
                return this._refreshInFlight;
            await this._refreshInFlight;
            if (this._destroyed)
                return;
        }

        this._refreshTimestampLabel.text = _('Refreshing...');
        this._refreshInFlight = this._refreshAllUsage({force})
            .catch(error => {
                if (!this._destroyed)
                    reportError(new Error('Provider refresh failed'), '[simple-ai-usage-indicator] refresh failed');
            })
            .finally(() => {
                this._refreshInFlight = null;
                if (this._destroyed)
                    return;
                try {
                    this._renderCurrentState();
                } catch (error) {
                    reportError(error, '[simple-ai-usage-indicator] render failed');
                }
            });

        return this._refreshInFlight;
    }

    async _refreshAllUsage(options = {}) {
        const summaries = await this._providerManager.fetchAllUsage({...options, onSummary: (id, summary) => {
            if (this._destroyed)
                return;
            this._state.summaries.set(id, summary);
            this._renderCurrentState();
        }});
        if (this._destroyed)
            return;
        const lastUpdated = GLib.DateTime.new_now_local();

        for (const [instanceId, codexSummary] of summaries) {
            if ((codexSummary.providerId ?? instanceId) !== PROVIDER_CODEX || codexSummary.error)
                continue;
            const prevSnapshot = this._state.previousSnapshots.get(instanceId);
            const currentSnapshot = {
                accountId: codexSummary.account || 'codex',
                observedAt: lastUpdated.to_unix(),
                summary: codexSummary.raw || codexSummary,
            };

            if (prevSnapshot) {
                const limitResets = detectEarlyLimitResets(prevSnapshot, currentSnapshot);
                if (limitResets.length > 0) {
                    Main.notify(
                        _('Codex limit reset'),
                        limitResets.map(reset => formatLimitResetMessage(reset, {translate: _, plural: ngettext})).join('\n'),
                    );
                }
            }
            this._state.previousSnapshots.set(instanceId, currentSnapshot);
        }

        this._state.summaries = summaries;
        this._state.lastUpdated = lastUpdated;
    }

    _renderCurrentState() {
        if (this._destroyed)
            return;
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
            this.accessible_name = _('AI: off');
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

        this.accessible_name = _('Simple AI Usage Indicator') + '. ' + providersToShow.map(provider => {
            const summary = this._state.summaries.get(provider.id);
            const value = !summary ? _('Fetching usage data...') : summary.error
                ? _('Quota unavailable') : formatWindowValue(summary.primaryWindow ?? summary.weekWindow ?? {}, displayMode);
            return `${provider.name}: ${value}`;
        }).join(', ');

        for (let i = 0; i < providersToShow.length; i++) {
            const provider = providersToShow[i];
            const summary = this._state.summaries.get(provider.id);

            const providerBox = new St.BoxLayout({
                style_class: 'panel-status-menu-box',
                style: i > 0 ? 'margin-left: 8px;' : '',
            });

            const iconFileName = provider.getIconFileName(iconStyle);
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
                style: isCustomStyle ? 'margin: 0 4px; padding: 0 6px;' : '-st-icon-style: symbolic;',
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
                {reactive: true, activate: false, hover: false, can_focus: false},
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
        const headerItem = createProviderHeaderMenuItem(this._extension.path, provider, summary, iconStyle);
        this._usageSection.addMenuItem(headerItem);

        if (!summary) {
            this._usageSection.addMenuItem(new PopupMenu.PopupMenuItem(
                _('Fetching usage data...'),
                {reactive: true, activate: false, hover: false, can_focus: false},
            ));
            return;
        }

        if (summary.error) {
            const errorItem = new PopupMenu.PopupMenuItem(
                summary.quotaUnavailable ? _('Quota unavailable') : String(summary.error?.message || summary.error),
                {reactive: true, activate: false, hover: false, can_focus: false},
            );
            errorItem.label.clutter_text.line_wrap = true;
            errorItem.label.style = 'max-width: 30em;';
            this._usageSection.addMenuItem(errorItem);
            if (summary.extraCredits) {
                const creditsItem = createExtraCreditsMenuItem(summary.extraCredits);
                if (creditsItem)
                    this._usageSection.addMenuItem(creditsItem);
            }
            return;
        }

        const stale = summary.stale || ((provider.providerId ?? provider.id) === PROVIDER_ANTIGRAVITY &&
            Date.now() - summary.lastUpdated?.getTime() >= 45000);
        if (summary.cached || stale) {
            this._usageSection.addMenuItem(new PopupMenu.PopupMenuItem(
                `${stale ? _('Stale quota') : _('Cached quota')} · ${summary.lastUpdated.toLocaleString()}`,
                {reactive: true, activate: false, hover: false, can_focus: false},
            ));
        }
        // Antigravity buckets are independent quotas, all labeled by their group.
        const windows = (provider.providerId ?? provider.id) === PROVIDER_ANTIGRAVITY && summary.windows
            ? summary.windows : [summary.primaryWindow, summary.weekWindow].filter(Boolean);
        let previousGroup = null;
        for (const window of windows) {
            const group = window.groupId ?? window.groupName;
            if (group && group !== previousGroup) {
                const heading = new PopupMenu.PopupMenuItem(window.groupName === 'Unknown group'
                    ? _('Unknown group') : window.groupName,
                {reactive: true, activate: false, hover: false, can_focus: false});
                heading.label.style = MENU_TITLE_STYLE;
                this._usageSection.addMenuItem(heading);
                previousGroup = group;
            }
            this._usageSection.addMenuItem(createUsageProgressMenuItem(
                formatBucketLabel(window), window, displayMode,
            ));
        }

        if ((provider.providerId ?? provider.id) === PROVIDER_CODEX) {
            if (summary.credits) {
                this._usageSection.addMenuItem(createUsageProgressMenuItem(_('Credit balance'),
                    {usedFormatted: formatCreditBalance(summary.credits, false, _)}, displayMode));
            }
            const expiry = formatResetCreditExpiryList(summary.extraCredits, Date.now() / 1000,
                this._settings.get_string('reset-credit-expiry-mode'));
            if (expiry) {
                this._usageSection.addMenuItem(new PopupMenu.PopupMenuItem(
                    `${_('Reset credit expiry')}: ${expiry}`,
                    {reactive: true, activate: false, hover: false, can_focus: false}));
            }
        }

        if (summary.models && summary.models.length > 0) {
            const modelsItem = createModelsSummaryMenuItem(summary.models);
            if (modelsItem)
                this._usageSection.addMenuItem(modelsItem);
        }

        if (summary.extraCredits) {
            const creditsItem = createExtraCreditsMenuItem(summary.extraCredits);
            if (creditsItem)
                this._usageSection.addMenuItem(creditsItem);
        }
    }

    _restartRefreshTimer() {
        if (this._destroyed)
            return;
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
        return this._settings.get_string('bar-display-mode') || BAR_DISPLAY_ALL;
    }

    _getActiveProviderId() {
        return this._settings.get_string('active-provider') || PROVIDER_CODEX;
    }

    _getIconStyle() {
        return this._settings.get_string('icon-style') || ICON_STYLE_SYMBOLIC;
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (this._refreshSourceId) {
            GLib.Source.remove(this._refreshSourceId);
            this._refreshSourceId = null;
        }

        this._settings.disconnectObject(this);
        if (this._menuOpenStateChangedId) {
            this.menu.disconnect(this._menuOpenStateChangedId);
            this._menuOpenStateChangedId = null;
        }
        this.menu.disconnectObject(this);
        this._providerManager.destroy();
        this._state.summaries.clear();
        this._state.previousSnapshots.clear();
        super.destroy();
    }
});

export default class SimpleAiUsageExtension extends Extension {
    enable() {
        this._indicator = new SimpleAiUsageIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}

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

function createProviderHeaderMenuItem(extensionPath, provider, summary, iconStyle = ICON_STYLE_SYMBOLIC) {
    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: true,
        activate: false,
        hover: false,
        can_focus: false,
    });

    const row = new St.BoxLayout({
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });

    const iconFileName = provider.getIconFileName(iconStyle);
    const iconPath = GLib.build_filenamev([extensionPath, 'icons', iconFileName]);
    const isCustomStyle = iconStyle === ICON_STYLE_COLOR || iconStyle === ICON_STYLE_BLACK;
    const icon = new St.Icon({
        gicon: Gio.icon_new_for_string(iconPath),
        icon_size: 18,
        style_class: isCustomStyle ? 'panel-icon' : 'system-status-icon',
        style: isCustomStyle ? null : '-st-icon-style: symbolic;',
        y_align: Clutter.ActorAlign.CENTER,
    });
    row.add_child(icon);

    const titleBox = new St.BoxLayout({
        ...VERTICAL_BOX_LAYOUT_PROPS,
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
    if (provider.providerName && provider.providerName !== provider.name)
        subtitleParts.push(provider.providerName);
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

function formatBucketLabel(window) {
    if (!window.source?.startsWith('agy-'))
        return formatWindowLabel(window.label);
    const group = window.groupName === 'Unknown group' ? _('Unknown group') : window.groupName;
    const bucket = window.bucketName || window.raw?.name || (window.period === '5h' ? '5-hour window'
        : window.period === 'weekly' ? 'Weekly limit' : window.period);
    return `${group} · ${formatWindowLabel(bucket) || _('Quota')}`;
}

function formatWindowLabel(label) {
    if (!label)
        return '';
    if (label === 'Five Hour Limit Remaining')
        return _('5-hour window');
    if (label === 'Weekly Limit Remaining')
        return _('Weekly limit');
    if (label === '5h')
        return _('5-hour window');
    if (label === 'Week')
        return _('Weekly limit');
    if (label === 'Window')
        return _('Window');
    if (label === 'Weekly tokens')
        return _('Weekly tokens');
    if (label === '5-hour window')
        return _('5-hour window');
    if (label === 'Weekly limit')
        return _('Weekly limit');
    if (label === 'Tokens today')
        return _('Tokens today');
    return label;
}

function createUsageProgressMenuItem(title, window, displayMode) {
    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: true,
        activate: false,
        hover: false,
        can_focus: false,
    });

    const content = new St.BoxLayout({
        ...VERTICAL_BOX_LAYOUT_PROPS,
        x_expand: true,
    });

    content.add_child(new St.Label({
        text: title,
        style: 'font-weight: 600; font-size: 0.95em;',
        x_align: Clutter.ActorAlign.START,
    }));

    content.add_child(new St.Label({
        text: formatWindowValue(window, displayMode),
        style: 'font-weight: 700; font-size: 1.05em; margin-top: 2px;',
        x_align: Clutter.ActorAlign.START,
    }));

    const progressPercent = getWindowProgressPercent(window, displayMode);
    if (progressPercent !== null)
        content.add_child(createProgressBar(progressPercent, `${title}: ${formatWindowValue(window, displayMode)}`));

    const subtitle = formatWindowSubtitle(window);
    if (subtitle) {
        content.add_child(new St.Label({
            text: subtitle,
            x_align: Clutter.ActorAlign.START,
        }));
    }

    menuItem.add_child(content);
    return menuItem;
}

function createModelsSummaryMenuItem(models) {
    if (!models || models.length === 0)
        return null;

    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: true,
        activate: false,
        hover: false,
        can_focus: false,
    });

    const content = new St.BoxLayout({
        ...VERTICAL_BOX_LAYOUT_PROPS,
        x_expand: true,
        style: 'margin-top: 4px;',
    });

    content.add_child(new St.Label({
        text: _('Active Models & Quota'),
        style: 'font-weight: 600; font-size: 0.9em;',
        x_align: Clutter.ActorAlign.START,
    }));

    for (const model of models.slice(0, 3)) {
        const lineBox = new St.BoxLayout({
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
            style: 'font-size: 0.9em;',
            x_align: Clutter.ActorAlign.END,
        }));
        content.add_child(lineBox);
    }

    menuItem.add_child(content);
    return menuItem;
}

function createExtraCreditsMenuItem(credits) {
    if (!credits)
        return null;

    const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: true,
        activate: false,
        hover: false,
        can_focus: false,
    });

    const content = new St.BoxLayout({
        x_expand: true,
    });

    let text = '';
    if (typeof credits.availableCount === 'number') {
        text = format(ngettext('%s rate limit reset available', '%s rate limit resets available', credits.availableCount), formatNumber(credits.availableCount));
    } else if (credits.conversations) {
        text = format(ngettext('%s CLI session stored locally', '%s CLI sessions stored locally', credits.conversations), formatNumber(credits.conversations));
    } else if (credits.totalSessions) {
        text = format(ngettext('%s Claude Code session', '%s Claude Code sessions', credits.totalSessions), formatNumber(credits.totalSessions));
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

function createProgressBar(percent, accessibleName) {
    const bar = new BarLevel.BarLevel({
        x_expand: true,
        style_class: 'slider',
        accessible_name: accessibleName,
        style: 'min-width: 240px; margin-top: 5px; margin-bottom: 4px;',
    });
    bar.value = normalizeProgressPercent(percent) ?? 0;
    return bar;
}

function formatProviderPanelLabel(provider, summary, displayMode) {
    if (!summary)
        return '--';

    if (summary.quotaUnavailable)
        return '?';
    if (summary.error)
        return '!';

    if ((provider.providerId ?? provider.id) === PROVIDER_CODEX) {
        const credits = formatCodexCreditPanel(summary, displayMode, _);
        if (credits)
            return credits;
    }

    if (typeof summary.percent === 'number' && Number.isFinite(summary.percent)) {
        if (displayMode === DISPLAY_MODE_USED) {
            return `${Math.round(summary.percent * 100)}%`;
        } else if (displayMode === DISPLAY_MODE_PERCENT) {
            return `${Math.round((summary.leftPercent ?? (1 - summary.percent)) * 100)}%`;
        } else {
            return `${Math.round((summary.leftPercent ?? (1 - summary.percent)) * 100)}% ${_('left')}`;
        }
    }

    const val = displayMode === DISPLAY_MODE_USED ? summary.used : summary.left;
    if (val !== null && val !== undefined) {
        const suffix = displayMode === DISPLAY_MODE_USED ? _('used') : _('left');
        return `${formatCompact(val)} ${suffix}`;
    }

    if (summary.primaryWindow?.status)
        return summary.primaryWindow.status;

    if (summary.primaryWindow?.usedFormatted)
        return summary.primaryWindow.usedFormatted;

    return (provider.providerId ?? provider.id) === PROVIDER_ANTIGRAVITY ? '?' : _('OK');
}

function formatLastUpdatedValue(lastUpdated) {
    if (!lastUpdated)
        return _('never');

    return new Date(lastUpdated.to_unix() * 1000).toLocaleString(undefined, {dateStyle: 'short', timeStyle: 'short'});
}

function formatWindowValue(window, displayMode) {
    if (window.status)
        return window.status;

    if (window.usedFormatted)
        return window.usedFormatted;

    if (displayMode === DISPLAY_MODE_USED) {
        if (window.used !== null && window.used !== undefined)
            return `${formatCompact(window.used)} ${_('used')}`;

        if (window.usedPercent !== null && window.usedPercent !== undefined)
            return `${formatQuotaPercent(window.usedPercent)} ${_('used')}`;
    } else {
        if (window.left !== null && window.left !== undefined)
            return `${formatCompact(window.left)} ${_('remaining')}`;

        if (window.leftPercent !== null && window.leftPercent !== undefined)
            return `${formatQuotaPercent(window.leftPercent)} ${_('remaining')}`;

        if (window.usedPercent !== null && window.usedPercent !== undefined)
            return `${formatQuotaPercent(1 - window.usedPercent)} ${_('remaining')}`;
    }

    return _('Unknown');
}

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

function formatQuotaPercent(fraction) {
    return new Intl.NumberFormat(undefined, {
        style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(fraction);
}

function formatWindowReset(window) {
    return formatQuotaReset(window, {translate: _});
}

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

function normalizeProgressPercent(percent) {
    if (typeof percent !== 'number' || !Number.isFinite(percent))
        return null;

    return Math.max(0, Math.min(percent, 1));
}


function formatNumber(value) {
    return new Intl.NumberFormat().format(Math.round(value));
}

function formatCompact(value) {
    return new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

