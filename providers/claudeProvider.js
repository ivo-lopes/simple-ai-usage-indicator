/**
 * @file claudeProvider.js
 * @description Provider adapter for Anthropic Claude Code CLI.
 * Integrates with local OAuth credentials (~/.claude/.credentials.json, ~/.claude.json),
 * queries Anthropic OAuth usage telemetry endpoints (/api/oauth/usage),
 * and provides seamless fallback to local token cache files (~/.claude/stats-cache.json).
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {BaseProvider, createEmptySummary} from './baseProvider.js';
import {
    CLAUDE_API_BASE_URL,
    CLAUDE_BETA_HEADER,
    CLAUDE_USAGE_ENDPOINT,
    CLAUDE_USER_AGENT,
    PROVIDER_CLAUDE,
} from '../constants.js';

Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

/**
 * Adapter for monitoring Anthropic Claude Code usage, token metrics, and rate limit windows.
 *
 * @augments BaseProvider
 */
export class ClaudeProvider extends BaseProvider {
    /**
     * @param {Object} [options]
     * @param {Gio.Settings|null} [options.settings=null] - Extension GSettings instance for token overrides
     */
    constructor({settings = null} = {}) {
        super({
            id: PROVIDER_CLAUDE,
            name: 'Claude Code',
            iconFileName: 'claude-symbolic.svg',
            colorIconFileName: 'claude-color.svg',
        });
        this._settings = settings;
        this._session = new Soup.Session({timeout: 20});
    }

    /**
     * Aborts any in-flight HTTP requests and cleans up the Soup session.
     */
    destroy() {
        this._session.abort();
    }

    /**
     * Returns the absolute file path to ~/.claude/.credentials.json.
     * @returns {string}
     */
    getCredentialsPath() {
        return GLib.build_filenamev([GLib.get_home_dir(), '.claude', '.credentials.json']);
    }

    /**
     * Returns the absolute file path to ~/.claude.json.
     * @returns {string}
     */
    getConfigPath() {
        return GLib.build_filenamev([GLib.get_home_dir(), '.claude.json']);
    }

    /**
     * Returns the absolute file path to ~/.claude/stats-cache.json.
     * @returns {string}
     */
    getStatsCachePath() {
        return GLib.build_filenamev([GLib.get_home_dir(), '.claude', 'stats-cache.json']);
    }


    /**
     * Checks local Claude credentials availability.
     * Evaluates custom token settings, environment variables, ~/.claude/.credentials.json,
     * and ~/.claude.json.
     *
     * @returns {Promise<{available: boolean, details: string, path: string, account?: string}>}
     */
    async checkAuth() {
        const credPath = this.getCredentialsPath();
        const configPath = this.getConfigPath();

        const customToken = this._getCustomToken();
        if (customToken) {
            return {
                available: true,
                details: 'Using custom token from settings/env',
                path: 'custom',
            };
        }

        const credPayload = await this._readJsonFile(credPath);
        const oauth = credPayload?.claudeAiOauth;
        const accessToken = oauth?.accessToken?.trim();

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
                available: true,
                details: `Connected as ${oauthAccount.emailAddress} (${plan})`,
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

    /**
     * Fetches current Claude Code usage metrics.
     * First attempts to query the Anthropic OAuth usage API if a token is present;
     * if absent or upon error, falls back to local token cache in ~/.claude/stats-cache.json.
     *
     * @returns {Promise<import('./baseProvider.js').UsageSummary>}
     */
    async fetchUsage() {
        const credPayload = await this._readJsonFile(this.getCredentialsPath());
        const configPayload = await this._readJsonFile(this.getConfigPath());
        const statsPayload = await this._readJsonFile(this.getStatsCachePath());

        const oauth = credPayload?.claudeAiOauth;
        const oauthAccount = configPayload?.oauthAccount;
        const token = this._getCustomToken() || oauth?.accessToken?.trim();

        const account = oauthAccount?.emailAddress || oauth?.subscriptionType || null;
        const planType = formatClaudePlan(oauthAccount?.seatTier || oauth?.subscriptionType);

        // Try API fetch if we have an access token
        if (token) {
            try {
                const apiData = await this._fetchUsageApi(token);
                return this._normalizeApiSummary(apiData, statsPayload, account, planType);
            } catch (error) {
                // If API fails, fall back to local stats cache
                return this._normalizeLocalSummary(statsPayload, account, planType, error);
            }
        }

        // If no direct token, use rich local statistics from stats-cache.json
        return this._normalizeLocalSummary(statsPayload, account, planType, null);
    }

    /**
     * Retrieves custom token from extension GSettings or environment variables.
     *
     * @private
     * @returns {string|null}
     */
    _getCustomToken() {
        const settingToken = this._settings?.get_string?.('claude-token')?.trim();
        if (settingToken)
            return settingToken;

        const envToken = GLib.getenv('CLAUDE_CODE_OAUTH_TOKEN') || GLib.getenv('ANTHROPIC_API_KEY');
        if (envToken && envToken.trim())
            return envToken.trim();

        return null;
    }

    /**
     * Queries Anthropic OAuth usage API endpoint asynchronously using Soup.Session.
     *
     * @private
     * @param {string} token - Bearer access token
     * @returns {Promise<Object>} Raw API JSON payload
     */
    async _fetchUsageApi(token) {
        const url = `${CLAUDE_API_BASE_URL}${CLAUDE_USAGE_ENDPOINT}`;
        const message = Soup.Message.new('GET', url);
        const headers = message.get_request_headers();
        headers.append('Authorization', `Bearer ${token}`);
        headers.append('anthropic-beta', CLAUDE_BETA_HEADER);
        headers.append('User-Agent', CLAUDE_USER_AGENT);
        headers.append('Accept', 'application/json');

        const bytes = await this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
        );

        const status = message.status_code;
        const text = new TextDecoder().decode(bytes.get_data());

        if (status < 200 || status >= 300) {
            throw new Error(`Claude API returned HTTP ${status}: ${text.substring(0, 100)}`);
        }

        return JSON.parse(text);
    }

    /**
     * Normalizes remote Anthropic OAuth usage API response and merges with model stats.
     *
     * @private
     * @param {Object} apiData - Payload from /api/oauth/usage
     * @param {Object|null} statsPayload - Local stats from stats-cache.json
     * @param {string|null} account - Account or tier name
     * @param {string} planType - Human-readable plan label
     * @returns {import('./baseProvider.js').UsageSummary}
     */
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

    /**
     * Constructs a normalized usage summary from local stats-cache.json when OAuth API is unavailable.
     *
     * @private
     * @param {Object|null} statsPayload - Local stats from ~/.claude/stats-cache.json
     * @param {string|null} account - Account identifier or tier
     * @param {string} planType - Human-readable plan type
     * @param {Error|null} [apiError=null] - Optional API error if remote query failed
     * @returns {import('./baseProvider.js').UsageSummary}
     */
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
            error: apiError ? `Remote API: ${apiError.message}` : null,
        };
    }

    /**
     * Reads and parses a JSON file asynchronously from disk.
     *
     * @private
     * @param {string} path - Absolute file path
     * @returns {Promise<Object|null>} Parsed JSON or null if missing/invalid
     */
    async _readJsonFile(path) {
        try {
            const [contents] = await Gio.File.new_for_path(path).load_contents_async(null);
            return JSON.parse(new TextDecoder().decode(contents));
        } catch {
            return null;
        }
    }
}

/**
 * Normalizes percentage values that may be passed either as 0..100 or 0..1 into a 0.0..1.0 fraction.
 *
 * @param {number} val - Percentage value
 * @returns {number} Normalized fraction between 0.0 and 1.0
 */
function normalizePercentValue(val) {
    if (val > 1)
        return Math.min(Math.max(val / 100, 0), 1);
    return Math.min(Math.max(val, 0), 1);
}

/**
 * Calculates remaining seconds until a Unix timestamp in the future.
 *
 * @param {number|null} unixTimestamp - Unix epoch in seconds
 * @returns {number|null} Remaining seconds, or null if timestamp missing
 */
function calculateSecondsUntil(unixTimestamp) {
    if (!unixTimestamp)
        return null;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(unixTimestamp - now, 0);
}

/**
 * Converts a Unix epoch timestamp in seconds to an ISO 8601 string.
 *
 * @param {number|null} unixTimestamp - Unix epoch in seconds
 * @returns {string|null} ISO 8601 date string or null
 */
function formatUnixTime(unixTimestamp) {
    if (!unixTimestamp)
        return null;
    const date = new Date(unixTimestamp * 1000);
    return date.toISOString();
}

/**
 * Normalizes Claude Code subscription tier identifiers into human-friendly strings.
 *
 * @param {string|null} tier - Subscription tier identifier (e.g. 'claude_pro', 'team')
 * @returns {string} Human-friendly tier name
 */
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

/**
 * Extracts per-model token breakdown from Claude Code stats-cache.json.
 *
 * @param {Object|null} stats - Raw stats payload
 * @returns {Array<Object>} List of model token summaries
 */
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

/**
 * Calculates total tokens consumed today from dailyModelTokens list.
 *
 * @param {Object|null} stats - Raw stats payload
 * @returns {number} Total tokens consumed today
 */
function getTodayTokens(stats) {
    if (!stats?.dailyModelTokens || !Array.isArray(stats.dailyModelTokens))
        return 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEntry = stats.dailyModelTokens.find(entry => entry.date === todayStr);
    if (!todayEntry?.tokensByModel)
        return 0;

    return Object.values(todayEntry.tokensByModel).reduce((sum, val) => sum + (val || 0), 0);
}

/**
 * Calculates rolling 7-day total token count from dailyModelTokens list.
 *
 * @param {Object|null} stats - Raw stats payload
 * @returns {number} Total tokens consumed over the past 7 days
 */
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

/**
 * Formats token quantities into compact SI units (e.g. 1.2M, 45.3k, 120).
 *
 * @param {number} num - Numeric token count
 * @returns {string} Formatted compact string
 */
export function formatTokenCount(num) {
    if (!num || num === 0)
        return '0';
    if (num >= 1000000)
        return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000)
        return `${(num / 1000).toFixed(1)}k`;
    return String(num);
}

