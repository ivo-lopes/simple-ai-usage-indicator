// SPDX-License-Identifier: GPL-3.0-only
// Shared by providers in Shell and Preferences; imports no UI libraries.
import Gettext from 'gettext';
const DOMAIN = 'simple-ai-usage-indicator';
export function gettext(message) {
    return Gettext.dgettext(DOMAIN, message);
}
export function ngettext(singular, plural, count) {
    return Gettext.dngettext(DOMAIN, singular, plural, count);
}
// Supports reordered string placeholders without depending on Shell's format module.
export function format(pattern, ...values) {
    let index = 0;
    return pattern.replace(/%%|%(?:(\d+)\$)?s/g, (match, position) =>
        match === '%%' ? '%' : String(values[position ? Number(position) - 1 : index++]));
}
