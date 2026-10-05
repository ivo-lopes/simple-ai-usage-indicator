// SPDX-License-Identifier: GPL-3.0-only

import GLib from 'gi://GLib';
import {CodexCliAuthError} from '../codexAuth.js';
import {CodexProvider} from '../providers/codexProvider.js';
import {PROVIDER_CODEX} from '../constants.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message || 'Assertion failed');
}

async function runTests() {
    let missing = false;
    let observedToken = null;
    const provider = new CodexProvider({
        authPath: () => '/nonexistent/saui-unit/auth.json',
        loadAuth: async () => {
            if (missing)
                throw new CodexCliAuthError('Synthetic credential absent');
            return {accessToken: 'synthetic-oauth', accountId: 'fixture', expiresAt: null, expiresInSeconds: null};
        },
        client: {
            destroy() {},
            fetchSummary: async token => {
                observedToken = token;
                return {percent: .25, used: null, limit: null, left: null, primaryWindow: {percent: .25, resetAt: 2000000000}};
            },
        },
    });
    assert(provider.id === PROVIDER_CODEX, 'Codex provider id must match');
    assert(provider.iconFileName === 'codex-symbolic.svg', 'Codex icon must match');
    assert(provider.getIconFileName('symbolic') === 'codex-symbolic.svg', 'Codex symbolic icon');
    assert(provider.getIconFileName('black') === 'codex-black.svg', 'Codex black icon');
    assert(provider.getIconFileName('color') === 'codex-color.svg', 'Codex color icon');

    // Test checkAuth
    const authStatus = await provider.checkAuth({allowExpired: true});
    assert(typeof authStatus.available === 'boolean', 'available must be boolean');
    assert(typeof authStatus.details === 'string', 'details must be string');
    assert(authStatus.available, 'Injected OAuth credential available');
    const summary = await provider.fetchUsage();
    assert(summary.primaryWindow.usedPercent === .25 && summary.leftPercent === .75, 'Quota normalized');
    assert(observedToken === 'synthetic-oauth', 'Injected credential used');
    missing = true;
    assert(!(await provider.checkAuth()).available, 'Missing fixture unavailable');
    assert((await provider.fetchUsage()).error instanceof CodexCliAuthError, 'Missing credential fails safely');

    provider.destroy();
    print('codexProvider tests passed (offline injected auth/client)');
}

const loop = new GLib.MainLoop(null, false);
let testError = null;
runTests().catch(error => { testError = error; }).finally(() => loop.quit());
loop.run();
if (testError)
    throw testError;
