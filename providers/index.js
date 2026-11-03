// SPDX-License-Identifier: GPL-3.0-only

import {gettext as _} from '../i18n.js';
import GLib from 'gi://GLib';
import {loadCodexCliAuth} from '../codexAuth.js';
import {readAccounts} from './accounts.js';
import {ProviderInstance} from './providerInstance.js';

import {PROVIDER_ANTIGRAVITY, PROVIDER_CLAUDE, PROVIDER_CODEX} from '../constants.js';
import {AntigravityProvider} from './antigravityProvider.js';
import {ClaudeProvider} from './claudeProvider.js';
import {CodexProvider} from './codexProvider.js';

export const PROVIDER_CLASSES = {
    [PROVIDER_CODEX]: CodexProvider,
    [PROVIDER_CLAUDE]: ClaudeProvider,
    [PROVIDER_ANTIGRAVITY]: AntigravityProvider,
};

export class ProviderManager {
    constructor({settings = null, providers = null} = {}) {
        this._settings = settings;
        this._destroyed = false;
        this._providers = new Map();
        this._managed = !providers;
        if (providers) {
            for (const provider of providers)
                this._providers.set(provider.id, provider);
        } else {
            this._initProviders();
        }
    }

    _initProviders() {
        this.syncAccounts();
    }

    syncAccounts() {
        if (!this._managed || this._destroyed)
            return;
        // Invalid persisted configuration fails closed and is never overwritten.
        let accounts;
        try { accounts = readAccounts(this._settings); } catch { accounts = []; }
        const next = new Map();
        for (const account of accounts) {
            const previous = this._providers.get(account.instanceId);
            const reusable = previous && previous.providerId === account.providerId &&
                previous.credentialReference === account.credentialReference && previous.enabled === account.enabled;
            if (reusable) {
                Object.assign(previous, account, {name: account.displayName});
                next.set(account.instanceId, previous);
                continue;
            }
            let adapter;
            const directory = account.credentialReference;
            if (account.providerId === PROVIDER_CODEX && directory) {
                const path = GLib.build_filenamev([directory, 'auth.json']);
                adapter = new CodexProvider({authPath: () => path,
                    loadAuth: options => loadCodexCliAuth({...options, path})});
            } else if (account.providerId === PROVIDER_CLAUDE && directory) {
                adapter = new ClaudeProvider({configDir: directory});
            } else {
                adapter = new PROVIDER_CLASSES[account.providerId]();
            }
            next.set(account.instanceId, new ProviderInstance(account, adapter));
        }
        for (const [id, instance] of this._providers) {
            if (next.get(id) !== instance)
                instance.destroy();
        }
        this._providers = next;
    }

    getProvider(id) {
        return this._providers.get(id) || null;
    }

    getAllProviders() {
        this.syncAccounts();
        return Array.from(this._providers.values());
    }

    getEnabledProviders() {
        if (this._managed) {
            this.syncAccounts();
            return Array.from(this._providers.values()).filter(p => p.enabled);
        }
        if (!this._settings)
            return this.getAllProviders();

        const enabledIds = this._settings.get_strv('enabled-providers');
        return enabledIds
            .map(id => this.getProvider(id))
            .filter(p => p !== null);
    }

    async fetchAllUsage(options = {}) {
        if (this._destroyed)
            return new Map();
        const enabled = this.getEnabledProviders();
        const results = await Promise.allSettled(
            enabled.map(async provider => {
                const summary = await provider.fetchUsage(options);
                if (!this._destroyed && (!this._managed || this._providers.get(provider.id) === provider))
                    options.onSummary?.(provider.id, summary);
                return summary;
            }),
        );

        if (this._destroyed)
            return new Map();
        const summaries = new Map();
        enabled.forEach((provider, index) => {
            if (this._managed && this._providers.get(provider.id) !== provider)
                return;
            const res = results[index];
            if (res.status === 'fulfilled') {
                summaries.set(provider.id, res.value);
            } else {
                summaries.set(provider.id, {
                    instanceId: provider.id,
                    providerId: provider.providerId ?? provider.id,
                    providerName: provider.name,
                    iconFileName: provider.iconFileName,
                    error: _('Usage unavailable. Check authentication and connectivity.'),
                });
            }
        });

        return summaries;
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        for (const provider of this._providers.values())
            provider.destroy();
        this._providers.clear();
    }
}

