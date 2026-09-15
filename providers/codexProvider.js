/**
 * @file codexProvider.js
 * @description Provider adapter for OpenAI Codex CLI.
 * Inspects ~/.codex/auth.json, retrieves rate limit metrics and reset windows
 * from ChatGPT WHAM API, and normalizes them into UsageSummary.
 */

import {BaseProvider, createEmptySummary} from './baseProvider.js';
import {CodexCliAuthError, getCodexCliAuthPath, loadCodexCliAuth} from '../codexAuth.js';
import {PROVIDER_CODEX} from '../constants.js';
import {UsageApiClient} from '../usageApi.js';

/**
 * Adapter for monitoring OpenAI Codex CLI usage and quota windows.
 *
 * @augments BaseProvider
 */
export class CodexProvider extends BaseProvider {
    /**
     * Initializes the CodexProvider with default identifiers and a dedicated HTTP client.
     */
    constructor() {
        super({
            id: PROVIDER_CODEX,
            name: 'Codex CLI',
            iconFileName: 'codex-symbolic.svg',
        });
        this._client = new UsageApiClient();
    }

    /**
     * Frees resources and aborts active Soup HTTP sessions.
     */
    destroy() {
        this._client.destroy();
    }

    /**
     * Verifies if valid local credentials exist in ~/.codex/auth.json.
     *
     * @param {Object} [options]
     * @param {boolean} [options.allowExpired=false] - If true, returns token info even if expired
     * @returns {Promise<{available: boolean, path: string, account?: string, details: string, expired?: boolean}>}
     */
    async checkAuth({allowExpired = false} = {}) {
        const path = getCodexCliAuthPath();
        try {
            const auth = await loadCodexCliAuth({allowExpired});
            const expiryDetails = auth.expiresAt !== null
                ? `Expires ${formatTimestamp(auth.expiresAt)}`
                : 'Expiry unknown';
            return {
                available: true,
                path,
                account: auth.accountId,
                details: `Token found (${auth.accountId ? `Account: ${auth.accountId}, ` : ''}${expiryDetails})`,
                expired: auth.expiresInSeconds !== null && auth.expiresInSeconds <= 0,
            };
        } catch (error) {
            return {
                available: false,
                path,
                details: error instanceof CodexCliAuthError ? error.message : String(error),
                expired: error?.expired ?? false,
            };
        }
    }

    /**
     * Retrieves current usage metrics from ChatGPT WHAM endpoint.
     *
     * @returns {Promise<import('./baseProvider.js').UsageSummary>} Normalized usage summary
     */
    async fetchUsage() {
        try {
            const auth = await loadCodexCliAuth();
            const summary = await this._client.fetchSummary(auth.accessToken, auth.accountId);

            const primaryWindow = summary.primaryWindow ? {
                label: summary.primaryWindow.label || '5-hour window',
                used: summary.primaryWindow.used,
                limit: summary.primaryWindow.limit,
                percent: summary.primaryWindow.percent,
                usedPercent: summary.primaryWindow.percent,
                leftPercent: summary.primaryWindow.percent !== null ? Math.max(1 - summary.primaryWindow.percent, 0) : null,
                resetsAt: summary.primaryWindow.resetAt,
                resetAfterSeconds: summary.primaryWindow.resetAfterSeconds,
            } : null;

            const weekWindow = summary.weekWindow ? {
                label: summary.weekWindow.label || 'Weekly limit',
                used: summary.weekWindow.used,
                limit: summary.weekWindow.limit,
                percent: summary.weekWindow.percent,
                usedPercent: summary.weekWindow.percent,
                leftPercent: summary.weekWindow.percent !== null ? Math.max(1 - summary.weekWindow.percent, 0) : null,
                resetsAt: summary.weekWindow.resetAt,
                resetAfterSeconds: summary.weekWindow.resetAfterSeconds,
            } : null;

            const activeWindow = primaryWindow ?? weekWindow;
            const percent = activeWindow?.percent ?? summary.percent ?? null;
            const leftPercent = percent !== null ? Math.max(1 - percent, 0) : null;

            return {
                providerId: this.id,
                providerName: this.name,
                iconFileName: this.iconFileName,
                planType: summary.planType,
                account: summary.email || summary.accountId || auth.accountId,
                used: summary.used,
                limit: summary.limit,
                left: summary.left,
                percent,
                leftPercent,
                resetAt: activeWindow?.resetsAt ?? summary.resetAt,
                resetAfterSeconds: activeWindow?.resetAfterSeconds ?? summary.resetAfterSeconds,
                primaryWindow,
                weekWindow,
                windows: summary.windows || [],
                extraCredits: summary.rateLimitResetCredits || null,
                credits: summary.credits || null,
                spendControl: summary.spendControl || null,
                models: summary.additionalRateLimits || [],
                raw: summary,
                lastUpdated: new Date(),
                error: null,
            };
        } catch (error) {
            const summary = createEmptySummary({
                providerId: this.id,
                providerName: this.name,
                iconFileName: this.iconFileName,
                error,
            });
            summary.error = error;
            return summary;
        }
    }
}

/**
 * Formats epoch unix timestamp into a local 2-digit time string (HH:MM).
 *
 * @param {number|null} unixSeconds - Unix epoch in seconds
 * @returns {string} Formatted time string, or empty if null
 */
function formatTimestamp(unixSeconds) {
    if (!unixSeconds)
        return '';
    const date = new Date(unixSeconds * 1000);
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

