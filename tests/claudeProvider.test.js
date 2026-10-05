// SPDX-License-Identifier: GPL-3.0-only

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ClaudeProvider, formatTokenCount} from '../providers/claudeProvider.js';
import {PROVIDER_CLAUDE} from '../constants.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

async function runTests() {
    let credentials = null;
    let config = null;
    let env = null;
    const provider = new ClaudeProvider({
        homeDir: '/nonexistent/saui-unit',
        getenv: name => name === 'CLAUDE_CODE_OAUTH_TOKEN' ? env : null,
        readJsonFile: async path => path.endsWith('.credentials.json') ? credentials :
            (path.endsWith('.claude.json') ? config : null),
    });
    assert(provider.id === PROVIDER_CLAUDE, 'Provider id must match');
    assert(provider.iconFileName === 'claude-symbolic.svg', 'Icon must match');
    assert(provider.getIconFileName('symbolic') === 'claude-symbolic.svg', 'Claude symbolic icon');
    assert(provider.getIconFileName('black') === 'claude-black.svg', 'Claude black icon');
    assert(provider.getIconFileName('color') === 'claude-color.svg', 'Claude color icon');

    // Test token formatting
    assert(formatTokenCount(500) === '500', 'formatTokenCount small');
    assert(formatTokenCount(1500) === '1.5k', 'formatTokenCount thousands');
    assert(formatTokenCount(2500000) === '2.5M', 'formatTokenCount millions');

    // Test API response normalization
    const mockApiData = {
        five_hour: {
            used_percentage: 35.5,
            resets_at: 1738425600,
        },
        seven_day: {
            used_percentage: 12.0,
            resets_at: 1738857600,
        },
    };

    const mockStats = {
        modelUsage: {
            'claude-sonnet-5': {
                inputTokens: 1000,
                outputTokens: 2000,
                cacheReadInputTokens: 5000,
                cacheCreationInputTokens: 1000,
            },
        },
        dailyModelTokens: [
            {
                date: new Date().toISOString().slice(0, 10),
                tokensByModel: {
                    'claude-sonnet-5': 9000,
                },
            },
        ],
    };

    const summary = provider._normalizeApiSummary(
        mockApiData,
        mockStats,
        'user@example.com',
        'Claude Pro',
    );

    assert(summary.providerId === PROVIDER_CLAUDE, 'Summary providerId');
    assert(summary.planType === 'Claude Pro', 'Summary planType');
    assert(summary.primaryWindow.label === '5-hour window', 'Primary window label');
    assert(Math.abs(summary.primaryWindow.usedPercent - 0.355) < 0.001, 'Primary used percent');
    assert(Math.abs(summary.primaryWindow.leftPercent - 0.645) < 0.001, 'Primary left percent');
    assert(summary.weekWindow.label === 'Weekly limit', 'Week window label');
    assert(Math.abs(summary.weekWindow.usedPercent - 0.12) < 0.001, 'Week used percent');
    assert(summary.models.length === 1, 'Models count');
    assert(summary.models[0].name === 'claude-sonnet-5', 'Model name');
    assert(summary.models[0].totalTokens === 9000, 'Model total tokens');

    // Test Local Summary fallback
    const localSummary = provider._normalizeLocalSummary(
        mockStats,
        'user@example.com',
        'Claude Team',
    );
    assert(localSummary.primaryWindow.label === 'Tokens today', 'Local primary label');
    assert(localSummary.primaryWindow.usedFormatted === '9.0k', 'Local formatted tokens');

    assert(!(await provider.checkAuth()).available, 'Absent official/env OAuth is unavailable');
    credentials = {claudeAiOauth: {accessToken: 'synthetic-local-oauth', subscriptionType: 'pro'}};
    env = 'synthetic-env-oauth';
    assert((await provider.checkAuth()).available, 'Official OAuth found');
    assert(provider._getOAuthToken(credentials) === 'synthetic-local-oauth', 'Official OAuth has priority');
    let apiCalls = 0;
    provider._fetchUsageApi = async token => {
        apiCalls++;
        assert(token === 'synthetic-local-oauth', 'Correct credential source');
        return mockApiData;
    };
    await provider.fetchUsage();
    assert(apiCalls === 1, 'Official credential queries quota');
    credentials = null;
    assert((await provider.checkAuth()).path === 'env:CLAUDE_CODE_OAUTH_TOKEN', 'Environment OAuth fallback');
    env = null;
    config = {oauthAccount: {emailAddress: 'fixture@example.invalid'}};
    assert(!(await provider.checkAuth()).available, 'Account metadata alone is not an OAuth credential');
    await provider.fetchUsage();
    assert(apiCalls === 1, 'No OAuth means no API request');
    env = 'synthetic-env-oauth';
    provider._fetchUsageApi = async () => { throw new Error('synthetic-env-oauth echoed server body'); };
    const safe = await provider.fetchUsage();
    assert(!safe.error.includes(env), 'Remote errors cannot expose credential');
    const keyOnly = new ClaudeProvider({
        readJsonFile: async () => null,
        getenv: name => name === 'ANTHROPIC_API_KEY' ? 'synthetic-api-key' : null,
    });
    assert(!(await keyOnly.checkAuth()).available, 'API key is not an OAuth quota token');
    keyOnly.destroy();
    const root = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent();
    const read = name => new TextDecoder().decode(root.get_child(name).load_contents(null)[1]);
    assert(!read('schemas/org.gnome.shell.extensions.simple-ai-usage-indicator.gschema.xml').includes('claude-token'), 'Schema stores no Claude secret');
    assert(!read('prefs.js').includes('PasswordEntryRow'), 'Preferences offers no persisted token');
    assert(!read('providers/claudeProvider.js').includes('get_string'), 'Provider does not read GSettings');
    provider.destroy();
    print('claudeProvider tests passed (offline)');
}

const loop = new GLib.MainLoop(null, false);
let testError = null;
runTests().catch(error => { testError = error; }).finally(() => loop.quit());
loop.run();
if (testError)
    throw testError;
