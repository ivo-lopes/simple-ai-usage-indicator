/**
 * @file index.js
 * @description Centralized ProviderManager registry and lifecycle manager.
 * Coordinates instantiating, querying, filtering, and destroying AI telemetry providers.
 */

import {PROVIDER_ANTIGRAVITY, PROVIDER_CLAUDE, PROVIDER_CODEX} from '../constants.js';
import {AntigravityProvider} from './antigravityProvider.js';
import {ClaudeProvider} from './claudeProvider.js';
import {CodexProvider} from './codexProvider.js';

/**
 * Mapping of provider identifiers to their concrete class constructors.
 */
export const PROVIDER_CLASSES = {
    [PROVIDER_CODEX]: CodexProvider,
    [PROVIDER_CLAUDE]: ClaudeProvider,
    [PROVIDER_ANTIGRAVITY]: AntigravityProvider,
};

/**
 * Manages provider instances, reads enablement status from GSettings,
 * and orchestrates concurrent asynchronous usage metric polling.
 */
export class ProviderManager {
    /**
     * @param {Object} [options]
     * @param {Gio.Settings|null} [options.settings=null] - Extension GSettings instance
     */
    constructor({settings = null} = {}) {
        this._settings = settings;
        this._providers = new Map();
        this._initProviders();
    }

    /**
     * Instantiates all supported provider adapters.
     * @private
     */
    _initProviders() {
        this._providers.set(PROVIDER_CODEX, new CodexProvider());
        this._providers.set(PROVIDER_CLAUDE, new ClaudeProvider({settings: this._settings}));
        this._providers.set(PROVIDER_ANTIGRAVITY, new AntigravityProvider());
    }

    /**
     * Retrieves a provider instance by its unique identifier.
     *
     * @param {string} id - Provider identifier ('codex', 'claude', 'antigravity')
     * @returns {import('./baseProvider.js').BaseProvider|null}
     */
    getProvider(id) {
        return this._providers.get(id) || null;
    }

    /**
     * Returns an array of all registered provider instances.
     *
     * @returns {Array<import('./baseProvider.js').BaseProvider>}
     */
    getAllProviders() {
        return Array.from(this._providers.values());
    }

    /**
     * Returns an array of providers currently enabled in GSettings.
     *
     * @returns {Array<import('./baseProvider.js').BaseProvider>}
     */
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

    /**
     * Asynchronously queries all enabled providers in parallel using Promise.allSettled.
     * Prevents failures in one provider from blocking telemetry from the others.
     *
     * @returns {Promise<Map<string, import('./baseProvider.js').UsageSummary>>} Map of providerId -> UsageSummary
     */
    async fetchAllUsage() {
        const enabled = this.getEnabledProviders();
        const results = await Promise.allSettled(
            enabled.map(provider => provider.fetchUsage()),
        );

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

    /**
     * Destroys all provider instances and aborts active network sessions.
     */
    destroy() {
        for (const provider of this._providers.values()) {
            try {
                provider.destroy();
            } catch {}
        }
        this._providers.clear();
    }
}

