// SPDX-License-Identifier: GPL-3.0-only
import GLib from 'gi://GLib';
import {CodexCliAuthError, loadCodexCliAuth} from '../codexAuth.js';

function assert(value, message) { if (!value) throw new Error(message); }
const directory = GLib.dir_make_tmp('saui-auth-unit-XXXXXX');
const path = GLib.build_filenamev([directory, 'auth.json']);
async function failure() {
    return loadCodexCliAuth({path}).then(() => null, error => error);
}
async function run() {
    assert(await failure() instanceof CodexCliAuthError, 'Missing isolated auth fixture');
    GLib.file_set_contents(path, '{invalid');
    assert((await failure()).message.includes('not valid JSON'), 'Malformed fixture safe error');
    GLib.file_set_contents(path, '{}');
    assert((await failure()).message.includes('does not contain'), 'Missing access token');
    GLib.file_set_contents(path, JSON.stringify({tokens: {access_token: 'synthetic-fixture', account_id: 'fixture'}}));
    assert((await loadCodexCliAuth({path})).accountId === 'fixture', 'Synthetic credential parsed');
    const claims = GLib.base64_encode(new TextEncoder().encode(JSON.stringify({exp: 1})));
    GLib.file_set_contents(path, JSON.stringify({tokens: {access_token: `fixture.${claims}.fixture`}}));
    assert((await failure()).expired, 'Expired synthetic JWT');
    assert((await loadCodexCliAuth({path, allowExpired: true})).expiresAt === 1, 'Expired diagnostic allowed');
    print('codexAuth tests passed: isolated synthetic files only');
}
const loop = new GLib.MainLoop(null, false);
let error = null;
run().catch(e => { error = e; }).finally(() => loop.quit());
loop.run();
GLib.unlink(path); GLib.rmdir(directory);
if (error) throw error;
