import {ClaudeProvider, formatTokenCount} from '../providers/claudeProvider.js';
import {PROVIDER_CLAUDE} from '../constants.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

async function runTests() {
    const provider = new ClaudeProvider();
    assert(provider.id === PROVIDER_CLAUDE, 'Provider id must match');
    assert(provider.name === 'Claude Code', 'Provider name must match');
    assert(provider.iconFileName === 'claude-symbolic.svg', 'Icon must match');

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

    provider.destroy();
    log('claudeProvider tests passed');
}

runTests().catch(err => {
    log('claudeProvider test failed: ' + (err.stack || err));
    imports.system.exit(1);
});
