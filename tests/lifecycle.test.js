// SPDX-License-Identifier: GPL-3.0-only
import GLib from 'gi://GLib';
import {format, ngettext} from '../i18n.js';
import {ProviderManager} from '../providers/index.js';
import {ClaudeProvider} from '../providers/claudeProvider.js';
import {CodexProvider} from '../providers/codexProvider.js';
import {AntigravityProvider} from '../providers/antigravityProvider.js';
import {Actor, loadSource} from './helpers/shellSource.js';

function assert(value, message) {
    if (!value)
        throw new Error(message);
}
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((r, j) => { resolve = r; reject = j; });
    return {promise, resolve, reject};
}
let pending;
let renders = 0;
let requests = 0;
let timersRemoved = 0;
let disconnected = 0;
let destroyed = 0;
let notifications = 0;
class Button {
    constructor() {
        this._destroyed = false;
        this._refreshInFlight = null;
        this._refreshSourceId = 1;
        this._menuOpenStateChangedId = 2;
        this._settings = {disconnectObject: () => disconnected++};
        this.menu = {disconnect: () => disconnected++, disconnectObject: () => disconnected++};
        this._state = {summaries: new Map(), previousSnapshots: new Map()};
        this._providerManager = {
            fetchAllUsage: () => { requests++; return pending.promise; },
            destroy: () => destroyed++,
        };
        this._refreshTimestampLabel = {
            set text(value) { if (this.dead) throw new Error('Destroyed label accessed'); },
        };
        this._renderPanelBar = () => { renders++; };
        this._renderPopupUsage = () => { renders++; };
        this._getDisplayMode = () => 'left';
        this._getBarDisplayMode = () => 'all';
        this._getIconStyle = () => 'symbolic';
        this._providerManager.getEnabledProviders = () => [];
    }
    destroy() { this._refreshTimestampLabel.dead = true; }
}
const {SimpleAiUsageIndicator, SimpleAiUsageExtension} = loadSource('extension.js', {
    St: {BoxLayout: Actor}, Clutter: {}, GObject: {registerClass: klass => klass},
    PanelMenu: {Button}, PopupMenu: {PopupMenuSection: Actor}, Extension: class {},
    GLib: {Source: {remove: () => timersRemoved++}, DateTime: {new_now_local: () => ({to_unix: () => 0})}},
    Main: {notify: () => notifications++, panel: {addToStatusArea() {}}},
    PROVIDER_CODEX: 'codex', _: text => text, format, ngettext,
}, ['SimpleAiUsageIndicator', 'SimpleAiUsageExtension']);
const {SimpleAiUsagePreferencesPage} = loadSource('prefs.js', {
    Adw: {PreferencesPage: Actor}, GObject: {registerClass: klass => klass}, ExtensionPreferences: class {}, _: text => text, format, ngettext,
}, ['SimpleAiUsagePreferencesPage']);

async function run() {
    const extension = new SimpleAiUsageExtension();
    for (let cycle = 0; cycle < 2; cycle++) {
        pending = deferred();
        extension.enable();
        const indicator = extension._indicator;
        assert(indicator instanceof SimpleAiUsageIndicator, 'Actual indicator constructed');
        const first = indicator.refresh();
        const forced = indicator.refresh({force: true});
        extension.disable();
        indicator.destroy(); // Idempotent teardown.
        const before = requests;
        await indicator.refresh();
        indicator._renderCurrentState();
        indicator._restartRefreshTimer();
        pending.resolve(new Map([['codex', {account: 'fixture'}]]));
        await Promise.all([first, forced]);
        assert(requests === before, 'No request after disable, including waiting manual refresh');
        assert(renders === 0 && notifications === 0, 'No render/notification after teardown');
        assert(indicator._state.summaries.size === 0, 'No state resurrection');
    }
    assert(timersRemoved === 2 && disconnected === 6 && destroyed === 2, 'Timers/signals/providers cleaned exactly once');

    for (const method of ['_checkProviderAuth', '_testProvider']) {
      for (const outcome of ['resolve', 'reject']) {
        const page = Object.create(SimpleAiUsagePreferencesPage.prototype);
        page._disposed = false;
        page._signals = [];
        page._providerManager = {destroy() {}};
        const work = deferred();
        let writes = 0;
        const row = {set subtitle(value) { if (page._disposed) throw new Error('Disposed row accessed'); writes++; }};
        const provider = {checkAuth: () => work.promise, fetchUsage: () => work.promise};
        const task = page[method](provider, row, row);
        page.dispose();
        const previousWrites = writes;
        work[outcome](outcome === 'resolve' ? {available: true, percent: .5} : new Error('Synthetic request failure'));
        await task;
        assert(writes === previousWrites, 'No prefs row update after close');
        await page[method](provider, row, row);
      }
    }
    const signalPage = Object.create(SimpleAiUsagePreferencesPage.prototype);
    signalPage._disposed = false;
    signalPage._signals = [];
    signalPage._providerManager = {destroy() {}};
    let callback;
    let signalCalls = 0;
    let signalDisconnects = 0;
    const signalObject = {connect: (_name, fn) => { callback = fn; return 1; }, disconnect: () => signalDisconnects++};
    signalPage._connect(signalObject, 'changed', () => signalCalls++);
    callback();
    signalPage.dispose();
    callback();
    assert(signalCalls === 1 && signalDisconnects === 1, 'Prefs signal disconnected and queued callback suppressed');

    for (const Kind of [ClaudeProvider, CodexProvider]) {
        const work = deferred();
        let http = 0;
        const provider = Kind === ClaudeProvider
            ? new Kind({getenv: () => null, readJsonFile: () => work.promise})
            : new Kind({loadAuth: () => work.promise, client: {destroy() {}, fetchSummary() { http++; }}});
        provider._fetchUsageApi = async () => { http++; };
        const task = provider.fetchUsage().then(() => false, () => true);
        provider.destroy();
        work.resolve({accessToken: 'synthetic', claudeAiOauth: {accessToken: 'synthetic'}});
        assert(await task, 'Pending credential read is discarded after destroy');
        assert(http === 0 && provider._cancellable.is_cancelled(), 'No post-destroy HTTP; cancellable cancelled');
    }
    const quota = deferred();
    const agy = new AntigravityProvider({agyPath: '/nonexistent/saui-tests'});
    agy._fetchAgyQuota = () => quota.promise;
    const result = agy.fetchUsage().then(() => false, () => true);
    agy.destroy();
    quota.resolve({primary: {}, windows: []});
    assert(await result, 'Pending quota cannot update the summary after destroy');
    assert(agy._quotaProcess === null && agy._cancellable.is_cancelled(), 'Antigravity resources cancelled');

    const managerWork = deferred();
    let managerCalls = 0;
    let managerDestroy = 0;
    const manager = new ProviderManager({providers: [{id: 'stub', fetchUsage: () => { managerCalls++; return managerWork.promise; }, destroy: () => managerDestroy++}]});
    const task = manager.fetchAllUsage();
    manager.destroy(); manager.destroy();
    managerWork.resolve({providerId: 'stub'});
    assert((await task).size === 0, 'Manager drops late allSettled results');
    assert((await manager.fetchAllUsage()).size === 0 && managerCalls === 1 && managerDestroy === 1, 'Manager stays disposed');
    print('lifecycle tests passed: late refresh/prefs/credential promises, repeated enable/disable, timers/signals');
}
const loop = new GLib.MainLoop(null, false);
let error = null;
run().catch(e => { error = e; }).finally(() => loop.quit());
loop.run();
if (error)
    throw error;
