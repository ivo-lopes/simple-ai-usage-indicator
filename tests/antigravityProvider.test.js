import {AntigravityProvider} from '../providers/antigravityProvider.js';
import {PROVIDER_ANTIGRAVITY} from '../constants.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

async function runTests() {
    const provider = new AntigravityProvider();
    assert(provider.id === PROVIDER_ANTIGRAVITY, 'Provider id must match');
    assert(provider.iconFileName === 'antigravity-symbolic.svg', 'Icon file name must match');
    assert(provider.getIconFileName('symbolic') === 'antigravity-symbolic.svg', 'Antigravity symbolic icon');
    assert(provider.getIconFileName('black') === 'antigravity-black.svg', 'Antigravity black icon');
    assert(provider.getIconFileName('color') === 'antigravity-color.svg', 'Antigravity color icon');

    // Test checkAuth (checks GNOME Keyring in this environment)
    const auth = await provider.checkAuth();
    assert(typeof auth.available === 'boolean', 'available must be boolean');
    assert(typeof auth.details === 'string', 'details must be string');
    assert(auth.path.includes('keyring://'), 'path must be keyring URL');

    // Test brain stats
    const stats = await provider._getBrainStats();
    assert(typeof stats.conversationCount === 'number', 'conversationCount must be number');
    assert(typeof stats.sessionCount === 'number', 'sessionCount must be number');

    provider.destroy();
    log('antigravityProvider tests passed');
}

runTests().catch(err => {
    log('antigravityProvider test failed: ' + (err.stack || err));
    imports.system.exit(1);
});
