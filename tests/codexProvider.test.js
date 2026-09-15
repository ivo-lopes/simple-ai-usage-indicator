import {CodexProvider} from '../providers/codexProvider.js';
import {PROVIDER_CODEX} from '../constants.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

async function runTests() {
    const provider = new CodexProvider();
    assert(provider.id === PROVIDER_CODEX, 'Codex provider id must match');
    assert(provider.name === 'Codex CLI', 'Codex provider name must match');
    assert(provider.iconFileName === 'codex-symbolic.svg', 'Codex icon must match');

    // Test checkAuth
    const authStatus = await provider.checkAuth({allowExpired: true});
    assert(typeof authStatus.available === 'boolean', 'available must be boolean');
    assert(typeof authStatus.details === 'string', 'details must be string');

    provider.destroy();
    print('codexProvider tests passed');
}

runTests().catch(err => {
    printerr('codexProvider test failed: ' + (err.stack || err));
    imports.system.exit(1);
});
