// SPDX-License-Identifier: GPL-3.0-only
// Controlled subprocess integration; synthetic executable, no provider credentials.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {AntigravityProvider} from '../../providers/antigravityProvider.js';
const directory = GLib.dir_make_tmp('saui-agy-timeout-XXXXXX');
const path = `${directory}/agy`;
GLib.file_set_contents(path, '#!/bin/sh\nexec sleep 60\n');
Gio.File.new_for_path(path).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
const provider = new AntigravityProvider({agyPath: path});
let ticks = 0;
const heartbeat = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { ticks++; return GLib.SOURCE_CONTINUE; });
const start = GLib.get_monotonic_time();
const loop = new GLib.MainLoop(null, false);
let failure;
provider._runAgy(true).then(() => { throw new Error('Hung CLI unexpectedly succeeded'); }, () => {
    const elapsed = (GLib.get_monotonic_time() - start) / 1000000;
    if (elapsed < 10 || elapsed > 18 || ticks < 50 || provider._quotaProcess || provider._quotaTimeout)
        throw new Error('Timeout failed to bound or release the asynchronous subprocess');
    print(JSON.stringify({result: 'PASS', elapsedSeconds: elapsed, eventLoopTicks: ticks,
        processReleased: true, timeoutReleased: true, source: 'synthetic executable; real Gio subprocess'}));
}).catch(error => { failure = error; }).finally(() => {
    provider.destroy();
    GLib.Source.remove(heartbeat);
    Gio.File.new_for_path(path).delete(null);
    Gio.File.new_for_path(directory).delete(null);
    loop.quit();
});
loop.run();
if (failure) throw failure;
