/**
 * @file antigravityProvider.js
 * @description Provider adapter for Google Antigravity CLI (`agy`).
 * Connects directly to FreeDesktop Secret Service / GNOME Keyring (`gi://Secret`)
 * to discover Google credentials, executes `agy --print /usage` asynchronously
 * with Gio.Subprocess, parses real-time remaining quota percentages, and normalizes
 * metrics into a unified UsageSummary. Structured buckets are preferred.
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Secret from 'gi://Secret';
import Soup from 'gi://Soup';

import {parseAgyUsage} from './agyUsage.js';
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
    constructor({agyPath = null} = {}) {
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
        this._agyPath = agyPath;
        this._cachedQuota = null;
        this._cachedQuotaTime = 0;
        this._quotaInFlight = null;
        this._quotaProcess = null;
        this._quotaTimeout = null;
        this._destroyed = false;
    }

    /**
     * Frees HTTP sessions and resources.
     */
    destroy() {
        this._destroyed = true;
        this._quotaProcess?.force_exit();
        if (this._quotaTimeout) {
            GLib.Source.remove(this._quotaTimeout);
            this._quotaTimeout = null;
        }
        this._cachedQuota = null;
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
    async fetchUsage({force = false} = {}) {
        let secretData = null;
        try {
            secretData = await this._lookupKeyringSecret();
        } catch {
            // CLI may authenticate through another supported credential store.
        }
        let quotaData;
        try {
            quotaData = await this._fetchAgyQuota({force});
        } catch {
            const summary = createEmptySummary({
                providerId: this.id, providerName: this.name,
                iconFileName: this.iconFileName,
                error: 'Antigravity quota unavailable. Check CLI authentication and connectivity.',
            });
            const stats = await this._getBrainStats();
            summary.extraCredits = {conversations: stats.conversationCount};
            summary.quotaUnavailable = true;
            return summary;
        }
        let userInfo = null;
        if (secretData?.token?.access_token) {
            try {
                userInfo = await this._fetchUserInfo(secretData.token.access_token);
            } catch {}
        }
        const primary = quotaData.primary;
        return {
            ...createEmptySummary({
                providerId: this.id, providerName: this.name, iconFileName: this.iconFileName,
                account: userInfo?.email || userInfo?.name || 'Google Account',
                planType: 'Google Antigravity',
            }),
            percent: primary.usedPercent,
            leftPercent: primary.leftPercent,
            resetAt: primary.resetsAt,
            resetAfterSeconds: primary.resetAfterSeconds,
            primaryWindow: primary,
            weekWindow: quotaData.week,
            windows: quotaData.windows,
            source: quotaData.source,
            raw: quotaData.windows.map(window => window.raw).filter(Boolean),
            cached: quotaData.cached,
            stale: Date.now() - quotaData.observedAt >= 45000,
            lastUpdated: new Date(quotaData.observedAt),
        };
    }

    /** Automatic reads reuse quota for 45s; explicit refresh bypasses the cache. */
    async _fetchAgyQuota({force = false} = {}) {
        if (this._destroyed)
            throw new Error('Provider destroyed');
        if (!force && this._cachedQuota && Date.now() - this._cachedQuotaTime < 45000)
            return {...this._cachedQuota, cached: true};
        // Coalesce concurrent reads; the in-flight process is already a fresh query.
        if (this._quotaInFlight)
            return this._quotaInFlight;
        this._quotaInFlight = this._queryQuota().finally(() => {
            this._quotaInFlight = null;
        });
        return this._quotaInFlight;
    }

    async _queryQuota() {
        let output;
        try {
            output = await this._runAgy(true);
        } catch (error) {
            if (!error.unsupportedFormat || this._destroyed)
                throw error;
            output = await this._runAgy(false);
        }
        const parsed = parseAgyUsage(output);
        if (!parsed || this._destroyed)
            throw new Error('Antigravity quota unavailable');
        const observedAt = Date.now();
        this._cachedQuota = {...parsed, observedAt, cached: false};
        this._cachedQuotaTime = observedAt;
        return this._cachedQuota;
    }

    async _runAgy(structured) {
        const agyPath = this._agyPath || GLib.find_program_in_path('agy') ||
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'agy']);
        const argv = [agyPath, '--print', '/usage', '--print-timeout', '8s'];
        if (structured)
            argv.push('--output-format', 'json');
        const proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        proc.init(null);
        this._quotaProcess = proc;
        // Enforce a bound independently of CLI versions that ignore print-timeout.
        this._quotaTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 12, () => {
            this._quotaTimeout = null;
            proc.force_exit();
            return GLib.SOURCE_REMOVE;
        });
        try {
            const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
            if (!proc.get_successful()) {
                const error = new Error('Antigravity CLI query failed');
                error.unsupportedFormat = /(?:unknown|unrecognized|not defined).*output-format/i.test(stderr || '');
                throw error;
            }
            return stdout;
        } finally {
            if (this._quotaTimeout) {
                GLib.Source.remove(this._quotaTimeout);
                this._quotaTimeout = null;
            }
            this._quotaProcess = null;
        }
    }

    _parseAgyUsageOutput(output) {
        return parseAgyUsage(output);
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

            enumerator.close(null);
            return {conversationCount: count, sessionCount: count};
        } catch {
            return {conversationCount: 0, sessionCount: 0};
        }
    }
}

