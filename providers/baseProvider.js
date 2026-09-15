import GLib from 'gi://GLib';

/**
 * @typedef {Object} UsageWindow
 * @property {string} label - Human-readable window description (e.g. '5-hour window', 'Weekly limit')
 * @property {number|null} [used] - Numeric count of units consumed in the window
 * @property {number|null} [limit] - Maximum numeric capacity of the window
 * @property {number|null} [percent] - Normalized fraction (0.0 to 1.0) of quota consumed
 * @property {number|null} [usedPercent] - Normalized fraction (0.0 to 1.0) of quota consumed
 * @property {number|null} [leftPercent] - Normalized fraction (0.0 to 1.0) of quota remaining
 * @property {string|number|null} [resetsAt] - ISO timestamp or Unix epoch seconds when the quota window resets
 * @property {number|null} [resetAfterSeconds] - Remaining seconds until quota resets
 * @property {number|null} [remainingPercent] - Integer percentage (0 to 100) remaining
 * @property {string|null} [status] - Textual status if numeric metrics are unavailable
 * @property {string|null} [usedFormatted] - Formatted representation of units consumed
 */

/**
 * @typedef {Object} UsageSummary
 * @property {string} providerId - Unique identifier of the provider ('codex', 'claude', 'antigravity')
 * @property {string} providerName - Display name (e.g. 'OpenAI Codex CLI', 'Claude Code', 'Antigravity CLI')
 * @property {string} iconFileName - Filename of the symbolic icon in icons/ directory
 * @property {string|null} planType - Subscription plan name (e.g. 'Pro', 'Team', 'Google AI Pro')
 * @property {string|null} account - Account identifier (email, username, or account UUID)
 * @property {number|null} used - Primary consumed value (or percentage)
 * @property {number|null} limit - Primary limit value (or 100)
 * @property {number|null} left - Primary remaining value (or percentage)
 * @property {number|null} percent - Fraction of primary quota used (0.0 to 1.0)
 * @property {number|null} leftPercent - Fraction of primary quota remaining (0.0 to 1.0)
 * @property {string|number|null} resetAt - Reset timestamp for the active window
 * @property {number|null} resetAfterSeconds - Seconds until reset for the active window
 * @property {UsageWindow|null} primaryWindow - Rolling short-term window (e.g. 5 hours)
 * @property {UsageWindow|null} weekWindow - Rolling long-term window (e.g. 7 days / weekly)
 * @property {Array<Object>} models - Array of model-specific quota or token metrics
 * @property {Object|null} extraCredits - Additional credits, resets, or billing info
 * @property {any} raw - Raw API response payload for inspection or debugging
 * @property {Date|GLib.DateTime} lastUpdated - Timestamp when the data was retrieved
 * @property {Error|string|null} error - Error instance or message if retrieval encountered issues
 */

/**
 * Base class for all AI coding assistant telemetry providers.
 * Each subclass encapsulates provider-specific authentication detection,
 * HTTP API requests, local cache parsing, and response normalization.
 */
export class BaseProvider {
    /**
     * @param {Object} options
     * @param {string} options.id - Provider unique identifier (e.g. 'codex')
     * @param {string} options.name - Human-readable display name (e.g. 'Codex CLI')
     * @param {string} options.iconFileName - Symbolic/white icon filename in icons/ (e.g. 'codex-symbolic.svg')
     * @param {string} [options.colorIconFileName] - Brand colored icon filename in icons/ (e.g. 'codex-color.svg')
     */
    constructor({id, name, iconFileName, colorIconFileName = null}) {
        this.id = id;
        this.name = name;
        this.iconFileName = iconFileName;
        this.colorIconFileName = colorIconFileName || iconFileName;
    }

    /**
     * Resolves the icon filename based on preferred visual style ('symbolic' or 'color').
     *
     * @param {string} [style='symbolic'] - 'symbolic' (monochrome white) or 'color' (vibrant brand)
     * @returns {string} Icon filename
     */
    getIconFileName(style = 'symbolic') {
        if (style === 'color')
            return this.colorIconFileName;
        return this.iconFileName;
    }


    /**
     * Check if local authentication is available and return its status.
     * Subclasses must override this to check files, environment, or keyrings.
     *
     * @param {Object} [options]
     * @param {boolean} [options.allowExpired=false] - Whether to accept expired tokens as available
     * @returns {Promise<{available: boolean, details: string, path?: string, expired?: boolean, account?: string}>}
     */
    async checkAuth(options = {}) {
        throw new Error('checkAuth() must be implemented by subclass');
    }

    /**
     * Fetch current usage metrics from local caches or remote APIs.
     * Subclasses must override this to return a normalized UsageSummary.
     *
     * @returns {Promise<UsageSummary>} Normalized UsageSummary
     */
    async fetchUsage() {
        throw new Error('fetchUsage() must be implemented by subclass');
    }

    /**
     * Clean up any active sessions, timers, or child processes.
     */
    destroy() {}
}

/**
 * Creates an empty UsageSummary boilerplate object.
 *
 * @param {Object} options
 * @param {string} options.providerId
 * @param {string} options.providerName
 * @param {string} options.iconFileName
 * @param {string|null} [options.planType=null]
 * @param {string|null} [options.account=null]
 * @param {Error|string|null} [options.error=null]
 * @returns {UsageSummary}
 */
export function createEmptySummary({
    providerId,
    providerName,
    iconFileName,
    planType = null,
    account = null,
    error = null,
} = {}) {
    return {
        providerId,
        providerName,
        iconFileName,
        planType,
        account,
        used: null,
        limit: null,
        left: null,
        percent: null,
        leftPercent: null,
        resetAt: null,
        resetAfterSeconds: null,
        primaryWindow: null,
        weekWindow: null,
        extraCredits: null,
        models: [],
        raw: null,
        lastUpdated: GLib.DateTime.new_now_local(),
        error,
    };
}
