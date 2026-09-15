/**
 * @file antigravityProvider.js
 * @description Provider adapter for Google Antigravity CLI (`agy`).
 * Connects directly to FreeDesktop Secret Service / GNOME Keyring (`gi://Secret`)
 * to discover Google credentials, executes `agy --print /usage` asynchronously
 * with Gio.Subprocess, parses real-time remaining quota percentages, and normalizes
 * metrics into a unified UsageSummary.
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Secret from 'gi://Secret';
import Soup from 'gi://Soup';

import {BaseProvider, createEmptySummary} from './baseProvider.js';
import {
    ANTIGRAVITY_KEYRING_SERVICE,
    ANTIGRAVITY_KEYRING_USERNAME,
    GOOGLE_USERINFO_ENDPOINT,
    PROVIDER_ANTIGRAVITY,
} from '../constants.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

/**
 * Adapter for monitoring Google Antigravity CLI quota, limits, and active models.
 *
 * @augments BaseProvider
 */
export class AntigravityProvider extends BaseProvider {
    /**
     * Initializes the AntigravityProvider with GNOME Keyring schema and HTTP session.
     */
    constructor() {
        super({
            id: PROVIDER_ANTIGRAVITY,
            name: 'Antigravity CLI',
            iconFileName: 'antigravity-symbolic.svg',
            colorIconFileName: 'antigravity-color.svg',
            blackIconFileName: 'antigravity-black.svg',
        });
        this._session = new Soup.Session({timeout: 10});
        this._schema = new Secret.Schema(
            'org.freedesktop.Secret.Generic',
            Secret.SchemaFlags.NONE,
            {
                'service': Secret.SchemaAttributeType.STRING,
                'username': Secret.SchemaAttributeType.STRING,
            },
        );
        this._cachedQuota = null;
        this._cachedQuotaTime = 0;
    }

    /**
     * Frees HTTP sessions and resources.
     */
    destroy() {
        this._session.abort();
    }


    /**
     * Checks if Antigravity credentials exist in GNOME Keyring.
     * Looks up Secret schema for service "gemini" and username "antigravity".
     *
     * @returns {Promise<{available: boolean, details: string, path: string, expired?: boolean, account?: string}>}
     */
    async checkAuth() {
        try {
            const secretData = await this._lookupKeyringSecret();
            if (!secretData) {
                return {
                    available: false,
                    details: 'Credentials not found in GNOME Keyring. Run agy to log in.',
                    path: 'keyring://gemini/antigravity',
                };
            }

            const token = secretData.token;
            const expiryStr = token?.expiry;
            let expired = false;
            let expiryFormatted = 'unknown';

            if (expiryStr) {
                const expiryDate = new Date(expiryStr);
                expired = expiryDate.getTime() <= Date.now();
                expiryFormatted = expiryDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
            }

            return {
                available: true,
                details: `Keyring token found (Expires: ${expiryFormatted})`,
                path: 'keyring://gemini/antigravity',
                expired,
                account: secretData.auth_method || 'Google Account',
            };
        } catch (error) {
            return {
                available: false,
                details: `Keyring lookup failed: ${error.message}`,
                path: 'keyring://gemini/antigravity',
            };
        }
    }

    /**
     * Fetches current usage and real-time remaining quota for Antigravity CLI.
     * Resolves Google user profile from OAuth userinfo endpoint, queries `agy --print /usage`
     * for exact model quotas and reset dates, and falls back to local session counts if offline.
     *
     * @returns {Promise<import('./baseProvider.js').UsageSummary>}
     */
    async fetchUsage() {
        let secretData;
        try {
            secretData = await this._lookupKeyringSecret();
        } catch (error) {
            return createEmptySummary({
                providerId: this.id,
                providerName: this.name,
                iconFileName: this.iconFileName,
                error,
            });
        }

        const accessToken = secretData?.token?.access_token;
        let userInfo = null;

        if (accessToken) {
            try {
                userInfo = await this._fetchUserInfo(accessToken);
            } catch {}
        }

        const account = userInfo?.email || userInfo?.name || 'Google Account';
        const planType = secretData?.auth_method === 'consumer' ? 'Google AI Pro / Ultra' : 'Google Antigravity';

        // Fetch real quota and remaining percentage from agy CLI
        let quotaData = null;
        try {
            quotaData = await this._fetchAgyQuota();
        } catch (err) {
            // CLI quota fetch error
        }

        if (quotaData && quotaData.primary) {
            const primary = quotaData.primary;
            const week = quotaData.week || null;

            const remainingFraction = primary.remainingPercent / 100;
            const usedFraction = Math.max(1 - remainingFraction, 0);

            const primaryWindow = {
                label: `${primary.modelGroup} (5h)`,
                usedPercent: usedFraction,
                percent: usedFraction,
                leftPercent: remainingFraction,
                resetsAt: primary.resetTime,
                resetAfterSeconds: calculateSecondsUntil(primary.resetTime),
                remainingPercent: primary.remainingPercent,
            };

            const weekWindow = week ? {
                label: `${week.modelGroup} (Weekly)`,
                usedPercent: Math.max(1 - (week.remainingPercent / 100), 0),
                percent: Math.max(1 - (week.remainingPercent / 100), 0),
                leftPercent: week.remainingPercent / 100,
                resetsAt: week.resetTime,
                resetAfterSeconds: calculateSecondsUntil(week.resetTime),
                remainingPercent: week.remainingPercent,
            } : null;

            return {
                providerId: this.id,
                providerName: this.name,
                iconFileName: this.iconFileName,
                planType,
                account,
                used: Math.round(usedFraction * 100),
                limit: 100,
                left: primary.remainingPercent,
                percent: usedFraction,
                leftPercent: remainingFraction,
                resetAt: primary.resetTime,
                resetAfterSeconds: calculateSecondsUntil(primary.resetTime),
                primaryWindow,
                weekWindow,
                models: quotaData.models || [],
                extraCredits: null,
                raw: quotaData,
                lastUpdated: new Date(),
                error: null,
            };
        }

        // Fallback to local session count if agy --print /usage is unavailable
        const brainStats = await this._getBrainStats();
        return {
            providerId: this.id,
            providerName: this.name,
            iconFileName: this.iconFileName,
            planType,
            account,
            used: brainStats.sessionCount,
            limit: null,
            left: null,
            percent: null,
            leftPercent: null,
            resetAt: null,
            resetAfterSeconds: null,
            primaryWindow: {
                label: '5-hour window',
                status: 'Active',
                usedPercent: null,
                percent: null,
                resetsAt: null,
            },
            weekWindow: {
                label: 'Weekly quota',
                status: 'Available',
                usedPercent: null,
                percent: null,
                resetsAt: null,
            },
            extraCredits: brainStats.conversationCount ? {
                conversations: brainStats.conversationCount,
            } : null,
            models: [],
            raw: null,
            lastUpdated: new Date(),
            error: null,
        };
    }

    /**
     * Executes `agy --print /usage --print-timeout 8s` asynchronously via Gio.Subprocess.
     * Caches successful responses for 45 seconds to minimize child process overhead.
     *
     * @private
     * @returns {Promise<Object>} Parsed quota object with primary and weekly windows
     */
    async _fetchAgyQuota() {
        const now = Date.now();
        // Cache quota for 45 seconds to keep responses instant
        if (this._cachedQuota && (now - this._cachedQuotaTime < 45000))
            return this._cachedQuota;

        const agyPath = GLib.find_program_in_path('agy') ||
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'agy']);

        const proc = new Gio.Subprocess({
            argv: [agyPath, '--print', '/usage', '--print-timeout', '8s'],
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        proc.init(null);

        const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
        if (!stdout || !stdout.trim())
            throw new Error(stderr?.trim() || 'Empty output from agy');

        const parsed = this._parseAgyUsageOutput(stdout);
        if (parsed) {
            this._cachedQuota = parsed;
            this._cachedQuotaTime = now;
        }

        return parsed;
    }

    /**
     * Parses the tabular output emitted by `agy /usage`.
     * Handles tab-delimited or multi-space columnar formats containing model groups,
     * limit windows (5h/weekly), remaining percentages, and ISO reset timestamps.
     *
     * @private
     * @param {string} output - Raw stdout string from agy
     * @returns {Object|null} Parsed quota breakdown or null if no valid entries found
     */
    _parseAgyUsageOutput(output) {
        const lines = output.split('\n');
        const items = [];

        for (const line of lines) {
            // Matches formats like:
            // Gemini Models \t Five Hour Limit Remaining \t 75% \t 2026-09-16T00:44:09Z
            // Claude and GPT models \t Weekly Limit Remaining \t 100% \t 2026-09-22T20:41:47Z
            const match = line.match(/(.+?)\t+(Weekly|Five Hour)\s+Limit Remaining\t+(\d+)%\t+([0-9T:Z-]+)/i) ||
                          line.match(/(.+?)\s{2,}(Weekly|Five Hour)\s+Limit Remaining\s{2,}(\d+)%\s{2,}([0-9T:Z-]+)/i);
            if (match) {
                const [, modelGroup, period, percentStr, resetTime] = match;
                items.push({
                    modelGroup: modelGroup.trim(),
                    period: period.toLowerCase().includes('five') ? '5h' : 'weekly',
                    remainingPercent: parseInt(percentStr, 10),
                    resetTime: resetTime.trim(),
                });
            }
        }

        if (items.length === 0)
            return null;

        const primary = items.find(i => i.modelGroup.toLowerCase().includes('gemini') && i.period === '5h') ||
                        items.find(i => i.period === '5h') || items[0];

        const week = items.find(i => i.modelGroup.toLowerCase().includes('gemini') && i.period === 'weekly') ||
                     items.find(i => i.period === 'weekly') || null;

        const models = items.map(i => ({
            name: `${i.modelGroup} (${i.period})`,
            formattedTokens: `${i.remainingPercent}% left`,
            tier: `Resets ${formatIsoTime(i.resetTime)}`,
        }));

        return {primary, week, items, models};
    }

    /**
     * Looks up stored credentials in GNOME Keyring using libsecret.
     *
     * @private
     * @returns {Promise<Object|null>} Parsed JSON credential object or null
     */
    _lookupKeyringSecret() {
        return new Promise((resolve, reject) => {
            Secret.password_lookup(
                this._schema,
                {
                    'service': ANTIGRAVITY_KEYRING_SERVICE,
                    'username': ANTIGRAVITY_KEYRING_USERNAME,
                },
                null,
                (source, result) => {
                    try {
                        const password = Secret.password_lookup_finish(result);
                        if (!password) {
                            resolve(null);
                            return;
                        }
                        resolve(JSON.parse(password));
                    } catch (err) {
                        reject(err);
                    }
                },
            );
        });
    }

    /**
     * Queries Google OAuth userinfo endpoint to verify token and obtain user profile.
     *
     * @private
     * @param {string} accessToken - Bearer token
     * @returns {Promise<Object>} Google user profile JSON
     */
    async _fetchUserInfo(accessToken) {
        const message = Soup.Message.new('GET', GOOGLE_USERINFO_ENDPOINT);
        message.get_request_headers().append('Authorization', `Bearer ${accessToken}`);
        message.get_request_headers().append('Accept', 'application/json');

        const bytes = await this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
        );

        const status = message.status_code;
        if (status < 200 || status >= 300) {
            throw new Error(`Google UserInfo returned HTTP ${status}`);
        }

        const text = new TextDecoder().decode(bytes.get_data());
        return JSON.parse(text);
    }

    /**
     * Counts conversations and sessions in the local Antigravity brain directory.
     *
     * @private
     * @returns {Promise<{conversationCount: number, sessionCount: number}>}
     */
    async _getBrainStats() {
        const brainDir = GLib.build_filenamev([GLib.get_home_dir(), '.gemini', 'antigravity-cli', 'brain']);
        try {
            const dir = Gio.File.new_for_path(brainDir);
            const enumerator = await new Promise((resolve, reject) => {
                dir.enumerate_children_async(
                    'standard::name',
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (source, res) => {
                        try {
                            resolve(dir.enumerate_children_finish(res));
                        } catch (e) {
                            reject(e);
                        }
                    },
                );
            });

            let count = 0;
            while (true) {
                const fileInfos = await new Promise((resolve, reject) => {
                    enumerator.next_files_async(10, GLib.PRIORITY_DEFAULT, null, (s, r) => {
                        try {
                            resolve(enumerator.next_files_finish(r));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                if (!fileInfos || fileInfos.length === 0)
                    break;
                count += fileInfos.length;
            }

            return {conversationCount: count, sessionCount: count};
        } catch {
            return {conversationCount: 0, sessionCount: 0};
        }
    }
}

/**
 * Calculates remaining seconds until an ISO 8601 timestamp.
 *
 * @param {string|null} isoTimestamp - ISO 8601 string
 * @returns {number|null} Seconds until expiration, or null
 */
function calculateSecondsUntil(isoTimestamp) {
    if (!isoTimestamp)
        return null;
    const target = new Date(isoTimestamp).getTime();
    const now = Date.now();
    return Math.max(Math.round((target - now) / 1000), 0);
}

/**
 * Formats an ISO 8601 timestamp into a local 2-digit time string (HH:MM).
 *
 * @param {string|null} isoTimestamp - ISO 8601 string
 * @returns {string} Formatted time string
 */
function formatIsoTime(isoTimestamp) {
    if (!isoTimestamp)
        return '';
    try {
        const date = new Date(isoTimestamp);
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    } catch {
        return '';
    }
}

