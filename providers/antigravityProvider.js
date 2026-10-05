// SPDX-License-Identifier: GPL-3.0-only

import {gettext as _, format} from '../i18n.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Secret from 'gi://Secret';

import {parseAgyUsage} from './agyUsage.js';
import {BaseProvider, createEmptySummary} from './baseProvider.js';
import {
    ANTIGRAVITY_KEYRING_SERVICE,
    ANTIGRAVITY_KEYRING_USERNAME,
    PROVIDER_ANTIGRAVITY,
} from '../constants.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

export class AntigravityProvider extends BaseProvider {
    constructor({agyPath = null} = {}) {
        super({
            id: PROVIDER_ANTIGRAVITY,
            name: 'Antigravity CLI',
            iconFileName: 'antigravity-symbolic.svg',
            colorIconFileName: 'antigravity-color.svg',
            blackIconFileName: 'antigravity-black.svg',
        });
        this._cancellable = new Gio.Cancellable();
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

    destroy() {
        this._destroyed = true;
        this._cancellable.cancel();
        this._quotaProcess?.force_exit();
        if (this._quotaTimeout) {
            GLib.Source.remove(this._quotaTimeout);
            this._quotaTimeout = null;
        }
        this._cachedQuota = null;
    }

    async checkAuth() {
        try {
            const secretData = await this._lookupKeyringSecret();
            if (this._destroyed)
                throw new Error('Provider destroyed');
            if (!secretData) {
                return {
                    available: false,
                    details: _('Credentials not found in GNOME Keyring. Run agy to log in.'),
                    path: 'keyring://gemini/antigravity',
                };
            }

            const token = secretData.token;
            const expiryStr = token?.expiry;
            let expired = false;
            let expiryFormatted = _('Unknown');

            if (expiryStr) {
                const expiryDate = new Date(expiryStr);
                expired = expiryDate.getTime() <= Date.now();
                expiryFormatted = expiryDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
            }

            return {
                available: true,
                details: format(_('Keyring token found (expires: %s)'), expiryFormatted),
                path: 'keyring://gemini/antigravity',
                expired,
                account: secretData.auth_method || _('Google account'),
            };
        } catch (error) {
            return {
                available: false,
                details: _('Keyring lookup unavailable'),
                path: 'keyring://gemini/antigravity',
            };
        }
    }

    async fetchUsage({force = false} = {}) {
        let quotaData;
        try {
            quotaData = await this._fetchAgyQuota({force});
        } catch {
            if (this._destroyed)
                throw new Error('Provider destroyed');
            const summary = createEmptySummary({
                providerId: this.id, providerName: this.name,
                iconFileName: this.iconFileName,
                error: _('Antigravity quota unavailable. Check CLI authentication and connectivity.'),
            });
            const stats = await this._getBrainStats();
            if (this._destroyed)
                throw new Error('Provider destroyed');
            summary.extraCredits = {conversations: stats.conversationCount};
            summary.quotaUnavailable = true;
            return summary;
        }
        if (this._destroyed)
            throw new Error('Provider destroyed');
        const primary = quotaData.primary;
        return {
            ...createEmptySummary({
                providerId: this.id, providerName: this.name, iconFileName: this.iconFileName,
                planType: 'Antigravity CLI',
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
        if (this._destroyed)
            throw new Error('Provider destroyed');
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

    _lookupKeyringSecret() {
        if (this._destroyed)
            return Promise.reject(new Error('Provider destroyed'));
        return new Promise((resolve, reject) => {
            Secret.password_lookup(
                this._schema,
                {
                    'service': ANTIGRAVITY_KEYRING_SERVICE,
                    'username': ANTIGRAVITY_KEYRING_USERNAME,
                },
                this._cancellable,
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

    async _getBrainStats() {
        const brainDir = GLib.build_filenamev([GLib.get_home_dir(), '.gemini', 'antigravity-cli', 'brain']);
        let enumerator = null;
        try {
            const dir = Gio.File.new_for_path(brainDir);
            enumerator = await new Promise((resolve, reject) => {
                dir.enumerate_children_async(
                    'standard::name',
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    this._cancellable,
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
                    enumerator.next_files_async(10, GLib.PRIORITY_DEFAULT, this._cancellable, (s, r) => {
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
        } finally {
            enumerator?.close(null);
        }
    }
}

