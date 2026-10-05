// SPDX-License-Identifier: GPL-3.0-only
import Gio from 'gi://Gio';

// Evaluate the actual Shell/prefs implementation against narrow test doubles.
// GI/resource imports cannot resolve in ordinary GJS outside GNOME Shell.
export function loadSource(name, bindings, exports) {
    const root = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_parent();
    const [, bytes] = root.get_child(name).load_contents(null);
    const source = new TextDecoder().decode(bytes)
        .replace(/^import[\s\S]*?;\n/gm, '')
        .replace('export default class', 'class');
    return new Function(...Object.keys(bindings), `${source}\nreturn {${exports.join(',')}};`)(...Object.values(bindings));
}

export class Actor {
    constructor(params = {}) {
        Object.assign(this, params);
        this.children = [];
    }
    add_child(child) { this.children.push(child); }
    set_position() {}
}
