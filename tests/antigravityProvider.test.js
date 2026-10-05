import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {AntigravityProvider} from '../providers/antigravityProvider.js';
import {parseAgyUsage} from '../providers/agyUsage.js';
import {formatQuotaReset, formatQuotaDuration} from '../quotaReset.js';
import {ProviderManager} from '../providers/index.js';

let assertions = 0;
function assert(condition, message) {
    assertions++;
    if (!condition)
        throw new Error(message);
}
function equal(actual, expected, message) {
    assert(Object.is(actual, expected), `${message}: expected ${expected}, got ${actual}`);
}
function fixture(name) {
    const file = Gio.File.new_for_uri(import.meta.url).get_parent().get_child('fixtures').get_child(name);
    return new TextDecoder().decode(file.load_contents(null)[1]);
}
const json = fixture('agy-usage-1.2.17.json');
function changedBucket(changes) {
    const data = JSON.parse(json);
    data.command.data.groups[0].buckets[0] = {...data.command.data.groups[0].buckets[0], ...changes};
    return parseAgyUsage(JSON.stringify(data)).windows[0];
}
const parsed = parseAgyUsage(json);
const extended = JSON.parse(json);
extended.command.data.groups[0].buckets.push({id: 'extra', window: 'daily'});
equal(parseAgyUsage(JSON.stringify(extended)).windows.length, 5, 'extra partial bucket preserved');
equal(parsed.windows[0].raw.id, 'gemini-weekly', 'original bucket data retained');
equal(parsed.windows.length, 4, 'all groups and buckets preserved');
equal(parsed.source, 'agy-json', 'structured data source');
equal(parsed.windows[0].leftPercent, 0.998567, 'fraction precision retained');
equal(parsed.windows[1].usedPercent, 0, '100% remaining');
equal(parsed.windows[2].usedPercent, 1, '0% remaining');
equal(parsed.primary.id, '3p-5h', 'panel uses most constrained short window');
equal(parsed.week.id, '3p-weekly', 'weekly selection stays within same group');
equal(parsed.windows[0].windowSeconds, 604800, 'weekly duration');
equal(parsed.windows[1].windowSeconds, 18000, '5h duration');
equal(parsed.windows[0].resetsAt, '2026-10-09T16:28:59Z', 'weekly backend timestamp regression');
assert(Date.parse(parsed.windows[0].resetsAt) !== Date.parse('2026-10-05T17:38:42Z') + 604800000,
    'weekly reset is not observation plus seven days');
equal(changedBucket({reset_time: undefined}).resetsAt, null, 'missing reset stays unknown');
equal(changedBucket({reset_time: 'invalid'}).resetsAt, null, 'invalid reset stays unknown');
equal(changedBucket({remaining_fraction: undefined}).usedPercent, null, 'missing metric stays unknown');
equal(changedBucket({remaining_fraction: 1.1}).usedPercent, null, 'out of range rejected');
equal(changedBucket({remaining_fraction: '0.5'}).usedPercent, null, 'string fraction rejected');
equal(changedBucket({window: 'daily'}).windowSeconds, null, 'unknown duration is not mislabeled');
equal(changedBucket({reset_after_seconds: 90000}).resetAfterSeconds, 90000, 'relative field retained when supplied');
equal(changedBucket({reset_time: '2026-10-09T13:28:59-03:00'}).resetsAt,
    '2026-10-09T13:28:59-03:00', 'offset retained');
for (const malformed of ['{broken', '[]', '{}', '', 'noise', 'null', '{"status":"ERROR","response":"noise"}'])
    equal(parseAgyUsage(malformed), null, 'malformed/empty payload fails closed');
const legacy = parseAgyUsage(fixture('agy-usage-legacy.txt'));
equal(legacy.windows.length, 4, 'legacy groups and buckets preserved');
equal(legacy.source, 'agy-text', 'legacy source explicit');
equal(legacy.windows[0].resetsAt, '2026-10-09T16:28:59Z', 'legacy weekly timestamp');
equal(parseAgyUsage(JSON.stringify({response: fixture('agy-usage-legacy.txt')})).source,
    'agy-text', 'legacy envelope compatibility');
equal(parseAgyUsage('Gemini Models\tWeekly Limit Remaining\t0%\tRefreshes in 4d').windows[0].resetsAt,
    null, 'human relative text never fabricates timestamp');
const now = Date.parse('2026-10-05T17:38:42Z');
const options = {now, locale: 'pt-BR', timeZone: 'America/Recife'};
const weeklyText = formatQuotaReset(parsed.windows[0], options);
assert(weeklyText.includes('09/10') && weeklyText.includes('13:28'), 'weekly reset includes local date and time');
assert(!formatQuotaReset(parsed.windows[1], options).includes('05/10'), 'same-day short reset keeps time only');
assert(formatQuotaReset({resetsAt: '2026-10-06T00:00:00Z'}, {...options, timeZone: 'UTC'}).includes('06/10'),
    'next-day reset includes date even below 24h');
assert(formatQuotaReset(parsed.windows[0], {...options, timeZone: 'UTC'}).includes('16:28'), 'timezone conversion');
assert(formatQuotaReset({resetAt: Date.parse(parsed.windows[0].resetsAt) / 1000}, options).includes('09/10'),
    'numeric resets used by other providers include date');
equal(formatQuotaReset({resetsAt: 'invalid'}, options), '', 'invalid date never displays Invalid Date');
equal(formatQuotaReset({resetAfterSeconds: 187200}, options), 'Resets in 2d 4h', 'compact long duration');
equal(formatQuotaDuration(3660), '1h 1m', 'short duration');

async function runAsyncTests() {
    const provider = new AntigravityProvider();
    try {
        equal(provider.getIconFileName('black'), 'antigravity-black.svg', 'icon contract');
        // Every I/O boundary is stubbed: no login, Keyring, network or CLI required.
        provider._lookupKeyringSecret = async () => null;
        provider._getBrainStats = async () => ({conversationCount: 7, sessionCount: 7});
        let calls = [];
        provider._runAgy = async structured => { calls.push(structured); return json; };
        const first = await provider.fetchUsage();
        equal(first.windows.length, 4, 'normalized summary retains all buckets');
        equal(first.percent, 0.5, 'summary fraction');
        const second = await provider.fetchUsage();
        equal(calls.length, 1, 'automatic cache avoids redundant process');
        equal(second.cached, true, 'cached observation identified');
        equal(first.lastUpdated.getTime(), second.lastUpdated.getTime(), 'cache preserves observation timestamp');
        await provider.fetchUsage({force: true});
        equal(calls.length, 2, 'manual force bypasses cache');
        provider._cachedQuotaTime -= 45000;
        await provider.fetchUsage();
        equal(calls.length, 3, 'expired cache refetched');
        await Promise.all([provider.fetchUsage({force: true}), provider.fetchUsage({force: true})]);
        equal(calls.length, 4, 'concurrent queries coalesced');
        calls = [];
        provider._runAgy = async structured => {
            calls.push(structured);
            if (structured) { const e = new Error('unsupported'); e.unsupportedFormat = true; throw e; }
            return fixture('agy-usage-legacy.txt');
        };
        equal((await provider.fetchUsage({force: true})).source, 'agy-text', 'old CLI supported');
        equal(calls.join(','), 'true,false', 'JSON attempted before legacy');
        calls = [];
        provider._runAgy = async structured => { calls.push(structured); throw new Error('unavailable'); };
        const unknown = await provider.fetchUsage({force: true});
        equal(calls.length, 1, 'CLI failures do not launch pointless legacy query');
        equal(unknown.primaryWindow, null, 'unavailable short quota never Active');
        equal(unknown.weekWindow, null, 'unavailable weekly quota never Available');
        equal(unknown.percent, null, 'local sessions never become quota');
        equal(unknown.quotaUnavailable, true, 'UI receives explicit unavailable state');
        equal(unknown.extraCredits.conversations, 7, 'local session counts preserved separately');
        const lastCache = provider._cachedQuota;
        provider._runAgy = async () => '{malformed';
        equal((await provider.fetchUsage({force: true})).quotaUnavailable, true, 'invalid payload fails closed');
        equal(provider._cachedQuota, lastCache, 'malformed response does not replace successful cache');
        provider._lookupKeyringSecret = async () => { throw new Error('Keyring absent'); };
        provider._runAgy = async () => json;
        equal((await provider.fetchUsage({force: true})).windows.length, 4, 'CLI works without extension Keyring lookup');
        const manager = Object.create(ProviderManager.prototype);
        let forceSeen = false;
        manager.getEnabledProviders = () => [{id: 'antigravity', fetchUsage: async options => {
            forceSeen = options.force; return first;
        }}];
        await manager.fetchAllUsage({force: true});
        equal(forceSeen, true, 'manager forwards force option');
    } finally {
        provider.destroy();
    }
    // Missing executable and nonzero exit are real Gio.Subprocess regressions.
    const missing = new AntigravityProvider({agyPath: '/nonexistent-saui-test/agy'});
    missing._lookupKeyringSecret = async () => null;
    missing._getBrainStats = async () => ({conversationCount: 0});
    try {
        equal((await missing.fetchUsage()).quotaUnavailable, true, 'missing CLI fails closed');
    } finally {
        missing.destroy();
    }
    const tmpDir = GLib.dir_make_tmp('saui-process-test-XXXXXX');
    const script = GLib.build_filenamev([tmpDir, 'agy']);
    GLib.file_set_contents(script, '#!/bin/sh\nexec sleep 60\n');
    Gio.File.new_for_path(script).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
    const running = new AntigravityProvider({agyPath: script});
    const request = running._runAgy(true);
    running.destroy();
    try { await request; } catch {}
    equal(running._quotaProcess, null, 'disable releases active subprocess');
    equal(running._quotaTimeout, null, 'disable releases timeout source');
    Gio.File.new_for_path(script).delete(null);
    Gio.File.new_for_path(tmpDir).delete(null);
    const failing = new AntigravityProvider({agyPath: '/bin/false'});
    try {
        let rejected = false;
        try { await failing._runAgy(true); } catch (error) {
            rejected = true;
            equal(error.message, 'Antigravity CLI query failed', 'process errors are sanitized');
        }
        assert(rejected, 'nonzero process exit is rejected');
    } finally {
        failing.destroy();
    }

}
const loop = new GLib.MainLoop(null, false);
let testError = null;
runAsyncTests().catch(error => { testError = error; }).finally(() => loop.quit());
loop.run();
if (testError) throw testError;
print(`antigravityProvider: ${assertions} assertions passed (offline)`);
