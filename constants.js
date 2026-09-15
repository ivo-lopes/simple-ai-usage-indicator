/**
 * @file constants.js
 * @description Centralized configuration constants, schema IDs, display modes, and API endpoints
 * for the Simple AI Usage Indicator GNOME Shell extension.
 */

/** Primary GSettings schema ID for Simple AI Usage Indicator */
export const SETTINGS_SCHEMA_ID = 'org.gnome.shell.extensions.simple-ai-usage-indicator';

/** Default interval between background usage refreshes (5 minutes) */
export const DEFAULT_UPDATE_INTERVAL_SECONDS = 300;

/** Display mode: show remaining quota capacity (e.g. "82% left") */
export const DISPLAY_MODE_LEFT = 'left';

/** Display mode: show consumed quota units (e.g. "18% used") */
export const DISPLAY_MODE_USED = 'used';

/** Display mode: show pure numeric percentage */
export const DISPLAY_MODE_PERCENT = 'percent';

/** Top bar layout: display all enabled assistant indicators side-by-side */
export const BAR_DISPLAY_ALL = 'all';

/** Top bar layout: display a single active assistant, cycling on click */
export const BAR_DISPLAY_CYCLE = 'cycle';

/** Icon appearance style: monochrome white / symbolic */
export const ICON_STYLE_SYMBOLIC = 'symbolic';

/** Icon appearance style: monochrome black */
export const ICON_STYLE_BLACK = 'black';

/** Icon appearance style: vibrant brand color */
export const ICON_STYLE_COLOR = 'color';

/** Unique identifier for OpenAI Codex CLI provider */
export const PROVIDER_CODEX = 'codex';


/** Unique identifier for Anthropic Claude Code provider */
export const PROVIDER_CLAUDE = 'claude';

/** Unique identifier for Google Antigravity CLI provider */
export const PROVIDER_ANTIGRAVITY = 'antigravity';

/** Default list of enabled provider IDs */
export const DEFAULT_ENABLED_PROVIDERS = [
    PROVIDER_CODEX,
    PROVIDER_CLAUDE,
    PROVIDER_ANTIGRAVITY,
];

/** Codex primary rate limit window span in hours */
export const PRIMARY_WINDOW_HOURS = 5;

/** Codex secondary rate limit window span in days */
export const WEEK_WINDOW_DAYS = 7;

// --- Codex CLI Endpoints ---
/** Base URL for ChatGPT backend services */
export const API_BASE_URL = 'https://chatgpt.com';

/** Endpoint for querying OpenAI Codex rate limits and usage windows */
export const SUMMARY_ENDPOINT = '/backend-api/wham/usage';

/** Endpoint for inspecting available rate limit reset credits */
export const RATE_LIMIT_RESET_CREDITS_ENDPOINT = '/backend-api/wham/rate-limit-reset-credits';

// --- Claude Code Endpoints & Headers ---
/** Base URL for Anthropic Claude API */
export const CLAUDE_API_BASE_URL = 'https://api.anthropic.com';

/** Endpoint for retrieving OAuth token usage limits and window resets */
export const CLAUDE_USAGE_ENDPOINT = '/api/oauth/usage';

/** Official User-Agent header expected by Anthropic Claude Code OAuth endpoints */
export const CLAUDE_USER_AGENT = 'claude-code/2.1.251';

/** Required Anthropic beta header for accessing OAuth usage telemetry */
export const CLAUDE_BETA_HEADER = 'oauth-2025-04-20';

// --- Antigravity CLI Endpoints & Secret Storage ---
/** Google OAuth userinfo endpoint to verify token validity and resolve user profile */
export const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

/** FreeDesktop Secret Service / GNOME Keyring service label used by Antigravity CLI */
export const ANTIGRAVITY_KEYRING_SERVICE = 'gemini';

/** FreeDesktop Secret Service / GNOME Keyring username attribute for Antigravity */
export const ANTIGRAVITY_KEYRING_USERNAME = 'antigravity';

