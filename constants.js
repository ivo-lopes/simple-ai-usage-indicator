// SPDX-License-Identifier: GPL-3.0-only
// Derived from Codex Usage Indicator by stone (stonega); see NOTICE.


export const DEFAULT_UPDATE_INTERVAL_SECONDS = 300;

export const DISPLAY_MODE_LEFT = 'left';

export const DISPLAY_MODE_USED = 'used';

export const DISPLAY_MODE_PERCENT = 'percent';

export const BAR_DISPLAY_ALL = 'all';

export const BAR_DISPLAY_CYCLE = 'cycle';

export const ICON_STYLE_SYMBOLIC = 'symbolic';

export const ICON_STYLE_BLACK = 'black';

export const ICON_STYLE_COLOR = 'color';

export const PROVIDER_CODEX = 'codex';

export const PROVIDER_CLAUDE = 'claude';

export const PROVIDER_ANTIGRAVITY = 'antigravity';


export const PRIMARY_WINDOW_HOURS = 5;

export const WEEK_WINDOW_DAYS = 7;

// --- Codex CLI Endpoints ---
export const API_BASE_URL = 'https://chatgpt.com';

export const SUMMARY_ENDPOINT = '/backend-api/wham/usage';

export const RATE_LIMIT_RESET_CREDITS_ENDPOINT = '/backend-api/wham/rate-limit-reset-credits';

// --- Claude Code Endpoints & Headers ---
export const CLAUDE_API_BASE_URL = 'https://api.anthropic.com';

export const CLAUDE_USAGE_ENDPOINT = '/api/oauth/usage';

export const CLAUDE_USER_AGENT = 'claude-code/2.1.251';

export const CLAUDE_BETA_HEADER = 'oauth-2025-04-20';

// --- Antigravity CLI Secret Storage ---
export const ANTIGRAVITY_KEYRING_SERVICE = 'gemini';

export const ANTIGRAVITY_KEYRING_USERNAME = 'antigravity';

