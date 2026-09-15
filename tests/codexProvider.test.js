import {CodexProvider} from '../providers/codexProvider.js';
import {PROVIDER_CODEX} from '../constants.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

async function runTests() {
    const provider = new CodexProvider();
    assert(provider.id === PROVIDER_CODEX, 'Codex provider id must match');
    assert(provider.iconFileName === 'codex-symbolic.svg', 'Codex icon must match');
    assert(provider.getIconFileName('symbolic') === 'codex-symbolic.svg', 'Codex symbolic icon');
    assert(provider.getIconFileName('black') === 'codex-black.svg', 'Codex black icon');
    assert(provider.getIconFileName('color') === 'codex-color.svg', 'Codex color icon');

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
