// SPDX-License-Identifier: GPL-3.0-only
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const ACCOUNT_PROVIDERS = ['codex', 'claude', 'antigravity'];
export const PROVIDER_NAMES = {codex: 'Codex CLI', claude: 'Claude Code', antigravity: 'Antigravity CLI'};

// Empty setting is an implicit, lossless migration; [] explicitly means no accounts.
export function readAccounts(settings) {
    const value = settings?.get_string?.('accounts-config') || '';
    if (!value) {
        const enabled = settings?.get_strv('enabled-providers') ?? ACCOUNT_PROVIDERS;
        return ACCOUNT_PROVIDERS.map(providerId => ({
            instanceId: providerId, providerId, accountId: `${providerId}:default`,
            displayName: PROVIDER_NAMES[providerId], enabled: enabled.includes(providerId),
            credentialReference: null,
        }));
    }
    return validateAccounts(JSON.parse(value));
}

export function validateAccounts(config) {
    if (config?.version !== 1 || !Array.isArray(config.accounts))
        throw new Error('Invalid account configuration');
    const ids = new Set();
    const references = new Set();
    return config.accounts.map(account => {
        if (!account || !ACCOUNT_PROVIDERS.includes(account.providerId) ||
            typeof account.instanceId !== 'string' || !/^[a-zA-Z0-9:_-]{1,80}$/.test(account.instanceId) ||
            typeof account.accountId !== 'string' || !account.accountId ||
            typeof account.displayName !== 'string' || !account.displayName.trim() ||
            account.displayName.length > 100 || typeof account.enabled !== 'boolean' || ids.has(account.instanceId))
            throw new Error('Invalid account configuration');
        const reference = account.credentialReference;
        if (reference !== null && (typeof reference !== 'string' || !GLib.path_is_absolute(reference) || Array.from(reference).some(c => c.charCodeAt(0) < 32)))
            throw new Error('Select an absolute CLI configuration directory');
        if (account.providerId === 'antigravity' && reference !== null)
            throw new Error('Antigravity has no verified independent credential selector');
        const resolved = reference ?? defaultConfigDirectory(account.providerId);
        const key = `${account.providerId}:${resolved ? credentialIdentity(account.providerId, resolved) : 'shared'}`;
        if (references.has(key))
            throw new Error('This CLI configuration is already monitored');
        ids.add(account.instanceId);
        references.add(key);
        // Persist only the contract; never unknown keys (e.g. pasted credentials).
        return {instanceId: account.instanceId, providerId: account.providerId,
            accountId: account.accountId, displayName: account.displayName.trim(),
            enabled: account.enabled, credentialReference: reference};
    });
}

function credentialIdentity(providerId, directory) {
    const filename = providerId === 'codex' ? 'auth.json' : '.credentials.json';
    // Follow file symlinks too: two directory aliases must not fake two sessions.
    try {
        const info = Gio.File.new_for_path(GLib.build_filenamev([directory, filename]))
            .query_info('id::filesystem,id::file', Gio.FileQueryInfoFlags.NONE, null);
        if (info.get_attribute_string('id::file'))
            return `${info.get_attribute_string('id::filesystem')}:${info.get_attribute_string('id::file')}`;
    } catch { /* Missing files remain configurable and fail their connection test. */ }
    return GLib.canonicalize_filename(directory, null);
}

export function defaultConfigDirectory(providerId) {
    if (providerId === 'codex')
        return GLib.getenv('CODEX_HOME') || GLib.build_filenamev([GLib.get_home_dir(), '.codex']);
    if (providerId === 'claude')
        return GLib.getenv('CLAUDE_CONFIG_DIR') || GLib.build_filenamev([GLib.get_home_dir(), '.claude']);
    return null;
}

export function writeAccounts(settings, accounts) {
    settings.set_string('accounts-config', JSON.stringify({version: 1,
        accounts: validateAccounts({version: 1, accounts})}));
}
