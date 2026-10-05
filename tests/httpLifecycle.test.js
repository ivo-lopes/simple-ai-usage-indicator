// SPDX-License-Identifier: GPL-3.0-only
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {UsageApiClient} from '../usageApi.js';
import {ClaudeProvider} from '../providers/claudeProvider.js';

function assert(value, message) {
    if (!value)
        throw new Error(message);
}
const server = new Soup.Server();
let mode = 'error';
let paused = null;
let ready = null;
let requests = 0;
server.add_handler(null, (_server, message) => {
    requests++;
    if (mode === 'pause') {
        message.pause();
        paused = message;
        ready();
    } else {
        message.set_status(401, null);
        message.set_response('application/json', Soup.MemoryUse.COPY,
            new TextEncoder().encode(JSON.stringify({message: 'synthetic-oauth echoed in response'})));
    }
});
server.listen_local(0, Soup.ServerListenOptions.IPV4_ONLY);
const apiBaseUrl = `http://127.0.0.1:${server.get_uris()[0].get_port()}`;
const proxyResolver = Gio.SimpleProxyResolver.new(null, null);
const loop = new GLib.MainLoop(null, false);
let error = null;
const watchdog = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
    error = new Error('HTTP lifecycle test timed out');
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
async function run() {
    for (const Kind of [UsageApiClient, ClaudeProvider]) {
        const client = new Kind({apiBaseUrl, proxyResolver, getenv: () => null, readJsonFile: async () => null});
        const fetch = () => Kind === UsageApiClient
            ? client._getJson('/error', 'synthetic-oauth') : client._fetchUsageApi('synthetic-oauth');
        const safe = await fetch().then(() => null, e => e);
        assert(safe && !safe.message.includes('synthetic-oauth'), 'HTTP errors must not echo credentials');
        mode = 'pause';
        const received = new Promise(resolve => { ready = resolve; });
        const task = (Kind === UsageApiClient
            ? client.fetchSummary('synthetic-oauth') : client._fetchUsageApi('synthetic-oauth'))
            .then(() => false, () => true);
        await received;
        const before = requests;
        client.destroy();
        assert(await task, 'Destroy rejects an in-flight Soup request');
        assert(client._cancellable.is_cancelled(), 'HTTP cancellable is cancelled');
        assert(requests === before, 'No reset-credit follow-up after cancellation');
        assert(await fetch().then(() => false, () => true), 'Disposed client rejects new requests');
        paused.set_status(200, null);
        paused.unpause();
        paused = null;
        mode = 'error';
    }
    print('HTTP lifecycle tests passed: loopback cancellation and credential-safe errors');
}
run().catch(e => { error = e; }).finally(() => loop.quit());
loop.run();
if (!error || error.message !== 'HTTP lifecycle test timed out')
    GLib.Source.remove(watchdog);
server.disconnect();
if (error)
    throw error;
