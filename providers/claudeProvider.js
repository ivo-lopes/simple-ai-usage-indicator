// SPDX-License-Identifier: GPL-3.0-only

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {BaseProvider} from './baseProvider.js';
import {
    CLAUDE_API_BASE_URL,
    CLAUDE_BETA_HEADER,
    CLAUDE_USAGE_ENDPOINT,
    CLAUDE_USER_AGENT,
    PROVIDER_CLAUDE,
} from '../constants.js';

Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

export class ClaudeProvider extends BaseProvider {
    constructor({readJsonFile = null, getenv = GLib.getenv, homeDir = GLib.get_home_dir(), apiBaseUrl = CLAUDE_API_BASE_URL, proxyResolver = null} = {}) {
        super({
            id: PROVIDER_CLAUDE,
            name: 'Claude Code',
            iconFileName: 'claude-symbolic.svg',
            colorIconFileName: 'claude-color.svg',
            blackIconFileName: 'claude-black.svg',
        });
        this._destroyed = false;
        this._cancellable = new Gio.Cancellable();
        this._readFile = readJsonFile;
        this._getenv = getenv;
        this._homeDir = homeDir;
        this._apiBaseUrl = apiBaseUrl;
        const sessionProperties = {timeout: 20};
        if (proxyResolver)
            sessionProperties.proxy_resolver = proxyResolver;
        this._session = new Soup.Session(sessionProperties);
    }

    destroy() {
        this._destroyed = true;
        this._cancellable.cancel();
        this._session.abort();
    }

    getCredentialsPath() {
        return GLib.build_filenamev([this._homeDir, '.claude', '.credentials.json']);
    }

    getConfigPath() {
        return GLib.build_filenamev([this._homeDir, '.claude.json']);
    }

    getStatsCachePath() {
        return GLib.build_filenamev([this._homeDir, '.claude', 'stats-cache.json']);
    }

    async checkAuth() {
        const credPath = this.getCredentialsPath();
        const configPath = this.getConfigPath();

        const credPayload = await this._readJsonFile(credPath);
        const oauth = credPayload?.claudeAiOauth;
        const accessToken = this._getOAuthToken(credPayload);
        if (accessToken && !(typeof oauth?.accessToken === 'string' && oauth.accessToken.trim())) {
            return {available: true, details: 'Using OAuth token from environment', path: 'env:CLAUDE_CODE_OAUTH_TOKEN'};
        }

        if (accessToken) {
            const exp = oauth?.expiresAt ? new Date(oauth.expiresAt).toLocaleTimeString() : 'Unknown';
            return {
                available: true,
                details: `OAuth token found (Expires: ${exp}, Tier: ${oauth.subscriptionType || 'Pro'})`,
                path: credPath,
                account: oauth.subscriptionType || null,
            };
        }

        // Check ~/.claude.json account info
        const configPayload = await this._readJsonFile(configPath);
        const oauthAccount = configPayload?.oauthAccount;
        if (oauthAccount?.emailAddress) {
            const plan = oauthAccount.seatTier || oauthAccount.organizationType || 'Claude User';
            return {
                available: false,
                details: `Account profile found (${plan}), but no OAuth credential. Run claude login.`,
                path: configPath,
                account: oauthAccount.emailAddress,
            };
        }

        return {
            available: false,
            details: `Claude credentials not found at ${credPath}. Run claude login.`,
            path: credPath,
        };
    }

    async fetchUsage() {
        const credPayload = await this._readJsonFile(this.getCredentialsPath());
        const configPayload = await this._readJsonFile(this.getConfigPath());
        const statsPayload = await this._readJsonFile(this.getStatsCachePath());

        const oauth = credPayload?.claudeAiOauth;
        const oauthAccount = configPayload?.oauthAccount;
        const token = this._getOAuthToken(credPayload);

        const account = oauthAccount?.emailAddress || oauth?.subscriptionType || null;
        const planType = formatClaudePlan(oauthAccount?.seatTier || oauth?.subscriptionType);

        // Try API fetch if we have an access token
        if (token) {
            try {
                const apiData = await this._fetchUsageApi(token);
                if (this._destroyed)
                    throw new Error('Provider destroyed');
                return this._normalizeApiSummary(apiData, statsPayload, account, planType);
            } catch (error) {
                if (this._destroyed)
                    throw new Error('Provider destroyed');
                // If API fails, fall back to local stats cache
                return this._normalizeLocalSummary(statsPayload, account, planType, error);
            }
        }

        // If no direct token, use rich local statistics from stats-cache.json
        return this._normalizeLocalSummary(statsPayload, account, planType, null);
    }

    _getOAuthToken(payload) {
        const stored = payload?.claudeAiOauth?.accessToken;
        if (typeof stored === 'string' && stored.trim())
            return stored.trim();
        const env = this._getenv('CLAUDE_CODE_OAUTH_TOKEN');
        return typeof env === 'string' && env.trim() ? env.trim() : null;
    }

    async _fetchUsageApi(token) {
        if (this._destroyed)
            throw new Error('Provider destroyed');
        const url = `${this._apiBaseUrl}${CLAUDE_USAGE_ENDPOINT}`;
        const message = Soup.Message.new('GET', url);
        const headers = message.get_request_headers();
        headers.append('Authorization', `Bearer ${token}`);
        headers.append('anthropic-beta', CLAUDE_BETA_HEADER);
        headers.append('User-Agent', CLAUDE_USER_AGENT);
        headers.append('Accept', 'application/json');

        const bytes = await this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            this._cancellable,
        );

        if (this._destroyed)
            throw new Error('Provider destroyed');
        const status = message.status_code;
        const text = new TextDecoder().decode(bytes.get_data());

        if (status < 200 || status >= 300) {
            throw new Error(`Claude API returned HTTP ${status}`);
        }

        try {
            return JSON.parse(text);
        } catch {
            throw new Error('Claude API returned invalid JSON');
        }
    }

    _normalizeApiSummary(apiData, statsPayload, account, planType) {
        const fiveHour = apiData?.five_hour || apiData?.fiveHour || null;
        const sevenDay = apiData?.seven_day || apiData?.sevenDay || null;

        const fiveHourUsedPercent = typeof fiveHour?.used_percentage === 'number'
            ? normalizePercentValue(fiveHour.used_percentage)
            : null;

        const sevenDayUsedPercent = typeof sevenDay?.used_percentage === 'number'
            ? normalizePercentValue(sevenDay.used_percentage)
            : null;

        const primaryWindow = fiveHour ? {
            label: '5-hour window',
            usedPercent: fiveHourUsedPercent,
            percent: fiveHourUsedPercent,
            leftPercent: fiveHourUsedPercent !== null ? Math.max(1 - fiveHourUsedPercent, 0) : null,
            resetsAt: formatUnixTime(fiveHour.resets_at),
            resetAfterSeconds: calculateSecondsUntil(fiveHour.resets_at),
        } : null;

        const weekWindow = sevenDay ? {
            label: 'Weekly limit',
            usedPercent: sevenDayUsedPercent,
            percent: sevenDayUsedPercent,
            leftPercent: sevenDayUsedPercent !== null ? Math.max(1 - sevenDayUsedPercent, 0) : null,
            resetsAt: formatUnixTime(sevenDay.resets_at),
            resetAfterSeconds: calculateSecondsUntil(sevenDay.resets_at),
        } : null;

        const activeWindow = primaryWindow ?? weekWindow;
        const percent = activeWindow?.usedPercent ?? null;
        const leftPercent = percent !== null ? Math.max(1 - percent, 0) : null;

        return {
            providerId: this.id,
            providerName: this.name,
            iconFileName: this.iconFileName,
            planType,
            account,
            used: percent !== null ? Math.round(percent * 100) : null,
            limit: 100,
            left: leftPercent !== null ? Math.round(leftPercent * 100) : null,
            percent,
            leftPercent,
            resetAt: activeWindow?.resetsAt ?? null,
            resetAfterSeconds: activeWindow?.resetAfterSeconds ?? null,
            primaryWindow,
            weekWindow,
            models: extractModelUsage(statsPayload),
            extraCredits: null,
            raw: apiData,
            lastUpdated: new Date(),
            error: null,
        };
    }

    _normalizeLocalSummary(statsPayload, account, planType, apiError = null) {
        const models = extractModelUsage(statsPayload);
        const todayTokens = getTodayTokens(statsPayload);
        const weeklyTokens = getWeeklyTokens(statsPayload);

        return {
            providerId: this.id,
            providerName: this.name,
            iconFileName: this.iconFileName,
            planType: planType || 'Claude Code',
            account,
            used: todayTokens,
            limit: null,
            left: null,
            percent: null,
            leftPercent: null,
            resetAt: null,
            resetAfterSeconds: null,
            primaryWindow: {
                label: 'Tokens today',
                usedFormatted: formatTokenCount(todayTokens),
                percent: null,
                usedPercent: null,
                resetsAt: null,
            },
            weekWindow: {
                label: 'Weekly tokens',
                usedFormatted: formatTokenCount(weeklyTokens),
                percent: null,
                usedPercent: null,
                resetsAt: null,
            },
            models,
            extraCredits: statsPayload?.totalSessions ? {
                totalSessions: statsPayload.totalSessions,
                totalMessages: statsPayload.totalMessages || 0,
            } : null,
            raw: statsPayload,
            lastUpdated: new Date(),
            error: apiError ? 'Claude quota API unavailable; showing local statistics.' : null,
        };
    }

    async _readJsonFile(path) {
        if (this._destroyed)
            throw new Error('Provider destroyed');
        if (this._readFile) {
            const value = await this._readFile(path);
            if (this._destroyed)
                throw new Error('Provider destroyed');
            return value;
        }
        try {
            const [contents] = await Gio.File.new_for_path(path).load_contents_async(this._cancellable);
            if (this._destroyed)
                throw new Error('Provider destroyed');
            return JSON.parse(new TextDecoder().decode(contents));
        } catch {
            if (this._destroyed)
                throw new Error('Provider destroyed');
            return null;
        }
    }
}

function normalizePercentValue(val) {
    if (val > 1)
        return Math.min(Math.max(val / 100, 0), 1);
    return Math.min(Math.max(val, 0), 1);
}

function calculateSecondsUntil(unixTimestamp) {
    if (!unixTimestamp)
        return null;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(unixTimestamp - now, 0);
}

function formatUnixTime(unixTimestamp) {
    if (!unixTimestamp)
        return null;
    const date = new Date(unixTimestamp * 1000);
    return date.toISOString();
}

function formatClaudePlan(tier) {
    if (!tier)
        return 'Claude Pro';
    if (tier.includes('team'))
        return 'Claude Team';
    if (tier.includes('max'))
        return 'Claude Max';
    if (tier.includes('pro'))
        return 'Claude Pro';
    return tier.replace(/_/g, ' ');
}

function extractModelUsage(stats) {
    if (!stats?.modelUsage || typeof stats.modelUsage !== 'object')
        return [];

    return Object.entries(stats.modelUsage).map(([modelName, data]) => {
        const totalTokens = (data.inputTokens || 0) + (data.outputTokens || 0) +
            (data.cacheReadInputTokens || 0) + (data.cacheCreationInputTokens || 0);
        return {
            name: modelName,
            totalTokens,
            formattedTokens: formatTokenCount(totalTokens),
            inputTokens: data.inputTokens || 0,
            outputTokens: data.outputTokens || 0,
        };
    });
}

function getTodayTokens(stats) {
    if (!stats?.dailyModelTokens || !Array.isArray(stats.dailyModelTokens))
        return 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEntry = stats.dailyModelTokens.find(entry => entry.date === todayStr);
    if (!todayEntry?.tokensByModel)
        return 0;

    return Object.values(todayEntry.tokensByModel).reduce((sum, val) => sum + (val || 0), 0);
}

function getWeeklyTokens(stats) {
    if (!stats?.dailyModelTokens || !Array.isArray(stats.dailyModelTokens))
        return 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return stats.dailyModelTokens
        .filter(entry => entry.date >= sevenDaysAgo)
        .reduce((sum, entry) => {
            const dayTokens = Object.values(entry.tokensByModel || {}).reduce((s, v) => s + (v || 0), 0);
            return sum + dayTokens;
        }, 0);
}

export function formatTokenCount(num) {
    if (!num || num === 0)
        return '0';
    if (num >= 1000000)
        return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000)
        return `${(num / 1000).toFixed(1)}k`;
    return String(num);
}

