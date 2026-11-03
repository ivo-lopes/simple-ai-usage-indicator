// SPDX-License-Identifier: GPL-3.0-only
import {gettext as _} from '../i18n.js';

// A provider adapter belongs to exactly one logical account. No shared I/O/cache.
export class ProviderInstance {
    constructor(account, provider) {
        Object.assign(this, account);
        this.id = account.instanceId; // compatibility for panel/manager callers
        this.name = account.displayName;
        this.providerName = provider.name;
        this.iconFileName = provider.iconFileName;
        this._provider = provider;
        this._destroyed = false;
        this._inFlight = null;
        this.usageSummary = null;
        this.lastUpdated = null;
        this.error = null;
    }

    getIconFileName(style) { return this._provider.getIconFileName(style); }
    checkAuth(options) { return this._provider.checkAuth(options); }

    fetchUsage(options = {}) {
        if (this._destroyed)
            return Promise.reject(new Error('Instance destroyed'));
        if (this._inFlight)
            return this._inFlight;
        this._inFlight = this._provider.fetchUsage(options).then(summary => {
            if (this._destroyed)
                throw new Error('Instance destroyed');
            this.usageSummary = {...summary, instanceId: this.instanceId,
                providerId: this.providerId, accountId: this.accountId,
                providerName: this.name};
            this.lastUpdated = summary.lastUpdated;
            this.error = summary.error;
            return this.usageSummary;
        }).catch(() => {
            this.error = _('Usage unavailable. Check authentication and connectivity.');
            throw new Error(this.error);
        }).finally(() => { this._inFlight = null; });
        return this._inFlight;
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        this._provider.destroy();
        this.usageSummary = null;
    }
}
