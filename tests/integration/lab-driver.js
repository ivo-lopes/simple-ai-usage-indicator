// SPDX-License-Identifier: GPL-3.0-only
// Test-only companion extension, installed only on a private disposable Shell bus.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
export default class LabDriver extends Extension {
    enable() {
        this._previous = global.context.unsafe_mode;
        global.context.unsafe_mode = true;
    }
    disable() {
        global.sauiLabKeyboard?.run_dispose();
        global.sauiLabKeyboard = null;
        global.context.unsafe_mode = this._previous;
    }
}
