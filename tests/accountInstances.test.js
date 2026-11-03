// SPDX-License-Identifier: GPL-3.0-only
// Controlled integration: real synthetic files + loopback HTTP, never CLI logins.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {readAccounts, validateAccounts, writeAccounts} from '../providers/accounts.js';
import {ProviderManager} from '../providers/index.js';
import {UsageApiClient} from '../usageApi.js';
import {SUMMARY_ENDPOINT, CLAUDE_USAGE_ENDPOINT} from '../constants.js';
function assert(value, message) { if (!value) throw new Error(message); }
function rejects(callback, message) { let caught = false; try { callback(); } catch { caught = true; } assert(caught, message); }
const directory = GLib.dir_make_tmp('saui-accounts-XXXXXX');
const paths = [];
const config = {value: '', get_string() { return this.value; }, get_strv() { return ['codex']; }, set_string(_key, value) { this.value = value; }};
assert(readAccounts(config).filter(a => a.enabled).length === 1, 'legacy enable state preserved');
assert(config.value === '', 'reading implicit migration writes nothing');
const accounts = [];
for (const providerId of ['codex', 'claude']) {
    for (let index = 1; index <= 2; index++) {
        const id = `${providerId}-${index}`;
        const path = `${directory}/${id}`;
        GLib.mkdir_with_parents(path, 0o700);
        const credential = `${path}/${providerId === 'codex' ? 'auth.json' : '.credentials.json'}`;
        const payload = providerId === 'codex' ? {tokens: {access_token: `synthetic-${id}`, account_id: id}}
            : {claudeAiOauth: {accessToken: `synthetic-${id}`}};
        GLib.file_set_contents(credential, JSON.stringify(payload));
        paths.push(credential, path);
        accounts.push({instanceId: id, accountId: id, providerId, displayName: id,
            enabled: true, credentialReference: path});
    }
}
writeAccounts(config, accounts);
assert(readAccounts(config).length === 4 && !config.value.includes('synthetic'), 'persistence contains references only');
rejects(() => validateAccounts({version: 1, accounts: [...accounts, {...accounts[0], instanceId: 'duplicate'}]}), 'same reference rejected');
const alias = `${directory}/alias`;
GLib.mkdir_with_parents(alias, 0o700);
Gio.File.new_for_path(`${alias}/auth.json`).make_symbolic_link(paths[0], null);
paths.push(`${alias}/auth.json`, alias);
rejects(() => validateAccounts({version: 1, accounts: [...accounts, {...accounts[0], instanceId: 'alias', credentialReference: alias}]}), 'symlinked credential store cannot fake an independent account');
rejects(() => validateAccounts({version: 1, accounts: [{...accounts[0], credentialReference: 'relative'}]}), 'relative reference rejected');
rejects(() => validateAccounts({version: 1, accounts: [{...accounts[0], providerId: 'antigravity'}]}), 'unverified Antigravity isolation rejected');
const requests = [];
let failFirst = false;
let delayFirst = false;
const paused = [];
const server = new Soup.Server();
server.add_handler(null, (_server, message, path) => {
    const token = message.get_request_headers().get_one('Authorization');
    const id = token?.replace('Bearer synthetic-', '');
    requests.push({id, account: message.get_request_headers().get_one('ChatGPT-Account-Id'), path});
    if (delayFirst && id === 'codex-1') { message.pause(); paused.push(message); return; }
    message.set_status(failFirst && id === 'codex-1' ? 503 : 200, null);
    const used = id?.endsWith('1') ? 25 : 75;
    const payload = path === SUMMARY_ENDPOINT
        ? {rate_limit: {primary_window: {used_percent: used, window_seconds: 18000}}}
        : path === CLAUDE_USAGE_ENDPOINT ? {five_hour: {used_percentage: used, resets_at: 4070908800}}
            : {available_count: 0, credits: []};
    message.set_response('application/json', Soup.MemoryUse.COPY, new TextEncoder().encode(JSON.stringify(payload)));
});
server.listen_local(0, Soup.ServerListenOptions.IPV4_ONLY);
const base = `http://127.0.0.1:${server.get_uris()[0].get_port()}`;
const manager = new ProviderManager({settings: config});
for (const instance of manager.getAllProviders()) {
    if (instance.providerId === 'codex') {
        instance._provider._client.destroy();
        instance._provider._client = new UsageApiClient({apiBaseUrl: base, proxyResolver: Gio.SimpleProxyResolver.new(null, null)});
    } else {
        instance._provider._apiBaseUrl = base;
        instance._provider._getenv = () => 'shared-token-must-not-be-used';
        assert(instance._provider._getOAuthToken({}) === null, 'explicit Claude account cannot use shared environment');
    }
}
async function run() {
    const first = await manager.fetchAllUsage();
    for (const provider of ['codex', 'claude']) {
        assert(first.get(`${provider}-1`).percent === .25 && first.get(`${provider}-2`).percent === .75,
            `${provider} files and headers yield independent quotas`);
        assert(first.get(`${provider}-1`).instanceId === `${provider}-1`, 'summary carries stable instance identity');
    }
    assert(requests.filter(r => r.path === SUMMARY_ENDPOINT).every(r => r.account === r.id), 'Codex token/account headers stay paired');
    failFirst = true;
    const failure = await manager.fetchAllUsage();
    assert(failure.get('codex-1').error && !failure.get('codex-2').error, 'one unavailable account leaves others successful');
    failFirst = false;
    const other = manager.getProvider('codex-2');
    accounts[0].enabled = false;
    writeAccounts(config, accounts);
    manager.syncAccounts();
    assert(manager.getProvider('codex-2') === other, 'disabling one account preserves another adapter/cache');
    assert(manager.getEnabledProviders().length === 3, 'individual enable state respected');
    accounts[0].enabled = true;
    writeAccounts(config, accounts);
    manager.syncAccounts();
    // Re-created adapter needs loopback routing again.
    const slow = manager.getProvider('codex-1');
    slow._provider._client.destroy();
    slow._provider._client = new UsageApiClient({apiBaseUrl: base, proxyResolver: Gio.SimpleProxyResolver.new(null, null)});
    delayFirst = true;
    const seen = new Set();
    const pending = manager.fetchAllUsage({onSummary: id => seen.add(id)});
    await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => { resolve(); return GLib.SOURCE_REMOVE; }));
    assert(seen.has('codex-2') && !seen.has('codex-1'), 'fast instance renders before slow instance completes');
    writeAccounts(config, accounts.slice(1).reverse());
    manager.syncAccounts();
    const result = await pending;
    assert(!result.has('codex-1') && slow._destroyed, 'removed in-flight instance is cancelled and cannot return');
    assert(manager.getEnabledProviders()[0].id === 'claude-2', 'saved ordering respected');
    assert(Gio.File.new_for_path(paths[0]).query_exists(null), 'removal never deletes CLI credentials');
    writeAccounts(config, []);
    manager.syncAccounts();
    assert(manager.getEnabledProviders().length === 0, 'explicit empty list does not resurrect defaults');
    const invalid = '{bad'; config.value = invalid; manager.syncAccounts();
    assert(manager.getAllProviders().length === 0 && config.value === invalid, 'invalid config fails closed without overwriting');
}
const loop = new GLib.MainLoop(null, false);
let failure;
run().catch(error => { failure = error; }).finally(() => {
    manager.destroy();
    for (const message of paused) { message.set_status(503, null); message.unpause(); }
    server.disconnect();
    for (const path of paths) Gio.File.new_for_path(path).delete(null);
    Gio.File.new_for_path(directory).delete(null);
    loop.quit();
});
loop.run();
if (failure) throw failure;
print('Account isolation: real synthetic credential files + loopback HTTP; identity, headers, quotas, failures, cancellation, migration and ordering passed');
