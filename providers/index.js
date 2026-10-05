// SPDX-License-Identifier: GPL-3.0-only

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
        if (providers) {
            for (const provider of providers)
                this._providers.set(provider.id, provider);
        } else {
            this._initProviders();
        }
    }

    _initProviders() {
        this._providers.set(PROVIDER_CODEX, new CodexProvider());
        this._providers.set(PROVIDER_CLAUDE, new ClaudeProvider());
        this._providers.set(PROVIDER_ANTIGRAVITY, new AntigravityProvider());
    }

    getProvider(id) {
        return this._providers.get(id) || null;
    }

    getAllProviders() {
        return Array.from(this._providers.values());
    }

    getEnabledProviders() {
        if (!this._settings)
            return this.getAllProviders();

        const enabledIds = this._settings.get_strv('enabled-providers');
        if (!enabledIds || enabledIds.length === 0)
            return this.getAllProviders();

        return enabledIds
            .map(id => this.getProvider(id))
            .filter(p => p !== null);
    }

    async fetchAllUsage(options = {}) {
        if (this._destroyed)
            return new Map();
        const enabled = this.getEnabledProviders();
        const results = await Promise.allSettled(
            enabled.map(provider => provider.fetchUsage(options)),
        );

        if (this._destroyed)
            return new Map();
        const summaries = new Map();
        enabled.forEach((provider, index) => {
            const res = results[index];
            if (res.status === 'fulfilled') {
                summaries.set(provider.id, res.value);
            } else {
                summaries.set(provider.id, {
                    providerId: provider.id,
                    providerName: provider.name,
                    iconFileName: provider.iconFileName,
                    error: res.reason,
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

