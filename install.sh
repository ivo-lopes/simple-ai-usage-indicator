#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Install a verified release for the current user; never access provider credentials.
set -euo pipefail

UUID='simple-ai-usage-indicator@ivo-lopes.github.com'
REPOSITORY='ivo-lopes/simple-ai-usage-indicator'
BUNDLE="${UUID}.shell-extension.zip"
version=latest
archive=''
checksums=''

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
usage() {
    cat <<'EOF'
Simple AI Usage Indicator — user installer
Usage: bash install.sh [--version v25]
       bash install.sh --archive PATH.zip [--checksum PATH/SHA256SUMS]

Downloads the latest release by default, verifies its SHA256, installs locally,
compiles schemas and enables the extension. Run in your desktop terminal, without
sudo. GNOME may require logout/login to discover the extension or load new code;
activation is also saved for the next session. No logout is performed for you.

--version TAG     Download a specific release (v followed by digits).
--archive PATH    Install a local release ZIP; no network requests.
--checksum PATH   SHA256SUMS for the local ZIP (defaults to its sibling file).
--help           Show this help.
EOF
}
while (($#)); do
    case "$1" in
        --help|-h) usage; exit 0 ;;
        --version|--archive|--checksum)
            (($# >= 2)) || fail "Missing value for $1"
            case "$1" in
                --version) version=$2 ;;
                --archive) archive=$2 ;;
                --checksum) checksums=$2 ;;
            esac
            shift 2 ;;
        *) fail "Unknown option: $1 (use --help)" ;;
    esac
done
((EUID != 0)) || fail 'Run as your desktop user, without sudo.'
[[ $version == latest || $version =~ ^v[0-9]+$ ]] || fail 'Invalid release tag.'
[[ -z $checksums || -n $archive ]] || fail '--checksum requires --archive.'
[[ -z $archive || $version == latest ]] || fail 'Use either --version or --archive.'
for tool in python3 gnome-shell gnome-extensions glib-compile-schemas gjs; do
    command -v "$tool" >/dev/null || fail "Required command not found: $tool"
done
[[ -n ${HOME:-} ]] || fail 'HOME is not set.'
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
[[ $data_home == /* ]] || fail 'XDG_DATA_HOME must be an absolute path.'
destination="$data_home/gnome-shell/extensions/$UUID"
[[ ! -L $destination ]] || fail 'The installed extension is a symlink; preserve that development checkout and install manually.'
[[ ! -e $destination || -d $destination ]] || fail 'The installation path is not a directory.'

download_dir=$(mktemp -d)
stage=''
cleanup() {
    rm -rf -- "$download_dir"
    if [[ -n $stage ]]; then
        if [[ -d $stage/previous ]]; then
            printf 'Previous installation preserved at: %s/previous\n' "$stage" >&2
        else
            rm -rf -- "$stage"
        fi
    fi
}
trap cleanup EXIT
if [[ -z $archive ]]; then
    command -v curl >/dev/null || fail 'Required command not found: curl'
    download() {
        curl --disable --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
            --connect-timeout 10 --max-time 120 --retry 2 "$1" --output "$2"
    }
    if [[ $version == latest ]]; then
        download "https://api.github.com/repos/$REPOSITORY/releases/latest" "$download_dir/release.json"
        version=$(python3 - "$download_dir/release.json" <<'PY'
import json, re, sys
tag = json.load(open(sys.argv[1], encoding='utf-8'))['tag_name']
if not isinstance(tag, str) or not re.fullmatch(r'v[0-9]+', tag):
    raise SystemExit('Invalid latest release tag')
print(tag)
PY
        )
    fi
    printf 'Downloading %s…\n' "$version"
    base="https://github.com/$REPOSITORY/releases/download/$version"
    archive="$download_dir/$BUNDLE"
    checksums="$download_dir/SHA256SUMS"
    download "$base/$BUNDLE" "$archive"
    download "$base/SHA256SUMS" "$checksums"
else
    checksums=${checksums:-"$(dirname -- "$archive")/SHA256SUMS"}
fi

# Validate before touching the installed extension. The checksum checks integrity;
# it is not an independent publisher signature.
shell_version=$(gnome-shell --version)
python3 - "$archive" "$checksums" "$UUID" "$BUNDLE" "$shell_version" <<'PY'
import hashlib, json, re, stat, sys, zipfile
from pathlib import Path, PurePosixPath
archive, checksums, uuid, bundle, shell = sys.argv[1:]
try:
    matches = [line.split() for line in Path(checksums).read_text().splitlines()
               if len(line.split()) == 2 and line.split()[1].lstrip('*') == bundle]
    if len(matches) != 1 or not re.fullmatch(r'[a-fA-F0-9]{64}', matches[0][0]):
        raise ValueError('Missing or ambiguous release ZIP checksum')
    path = Path(archive)
    if path.stat().st_size > 20 * 1024 * 1024:
        raise ValueError('Release ZIP is too large')
    if hashlib.sha256(path.read_bytes()).hexdigest() != matches[0][0].lower():
        raise ValueError('SHA256 mismatch; installation was not changed')
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        if len(infos) > 200 or sum(i.file_size for i in infos) > 30 * 1024 * 1024:
            raise ValueError('Release ZIP exceeds extraction limits')
        names = [i.filename for i in infos]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP entries')
        for i in infos:
            p = PurePosixPath(i.filename)
            mode = stat.S_IFMT(i.external_attr >> 16)
            if (p.is_absolute() or '..' in p.parts or '\\' in i.filename
                    or i.filename != str(p) + ('/' if i.is_dir() else '')
                    or i.filename != i.orig_filename
                    or mode not in (0, stat.S_IFREG, stat.S_IFDIR)):
                raise ValueError('Unsafe ZIP entry')
        for required in ('extension.js', 'prefs.js', 'LICENSE', 'NOTICE', 'ASSETS.md',
                         'schemas/org.gnome.shell.extensions.simple-ai-usage-indicator.gschema.xml'):
            if required not in names:
                raise ValueError('Missing extension file: ' + required)
        meta = json.loads(z.read('metadata.json'))
        if meta.get('uuid') != uuid:
            raise ValueError('Unexpected extension UUID')
        major = re.search(r'(\d+)\.', shell)
        if not major or major[1] not in meta.get('shell-version', []):
            raise ValueError('This release does not declare compatibility with ' + shell)
        if z.testzip():
            raise ValueError('Corrupt ZIP')
except (OSError, ValueError, KeyError, zipfile.BadZipFile) as e:
    raise SystemExit('Error: ' + str(e))
print('SHA256, ZIP, UUID and GNOME compatibility verified.')
PY

# Require a working session bus and writable activation settings before replacing
# files. The extension can be undiscovered in this session, including on Wayland.
gjs -c 'const Gio = imports.gi.Gio;
Gio.DBus.session;
const s = new Gio.Settings({schema_id: "org.gnome.shell"});
for (const key of ["enabled-extensions", "disabled-extensions"])
    if (!s.is_writable(key)) throw new Error("GNOME activation settings are locked");'

mkdir -p -- "$(dirname -- "$destination")"
stage=$(mktemp -d "$(dirname -- "$destination")/.saui-install.XXXXXXXX")
python3 - "$archive" "$stage/new" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    z.extractall(sys.argv[2])
PY
glib-compile-schemas --strict "$stage/new/schemas"
had_existing=false
if [[ -d $destination ]]; then
    had_existing=true
    # Only this extension is disabled; other extensions and preferences are retained.
    if gnome-extensions info "$UUID" >/dev/null 2>&1; then
        gnome-extensions disable "$UUID"
    fi
    mv -- "$destination" "$stage/previous"
fi
if ! mv -- "$stage/new" "$destination"; then
    if [[ -d $stage/previous ]]; then mv -- "$stage/previous" "$destination"; fi
    fail 'Could not replace the extension directory.'
fi

# Append without replacing other UUIDs, and remove only our explicit disable flag.
# Saving this before trying the CLI also handles an unknown UUID in this session.
gjs -c 'const Gio = imports.gi.Gio;
const s = new Gio.Settings({schema_id: "org.gnome.shell"});
const uuid = ARGV[0];
const enabled = s.get_strv("enabled-extensions");
if (!enabled.includes(uuid)) enabled.push(uuid);
if (!s.set_strv("enabled-extensions", enabled) ||
    !s.set_strv("disabled-extensions", s.get_strv("disabled-extensions").filter(x => x !== uuid)))
    throw new Error("Could not save extension activation");
Gio.Settings.sync();' "$UUID"

if gnome-extensions enable "$UUID" >"$download_dir/activation.log" 2>&1; then
    printf 'Activation requested in the current GNOME session.\n'
elif gnome-extensions info "$UUID" >/dev/null 2>&1; then
    fail 'Files installed, but GNOME refused activation. Check the Extensions app; log out and back in to load the installed release.'
else
    printf 'GNOME has not discovered the extension yet; activation is saved for your next session.\n'
fi
if [[ $had_existing == true ]]; then
    printf 'Updated successfully. Log out and back in to load the updated JavaScript.\n'
else
    printf 'Installed successfully. If the indicator is not visible, log out and back in; it will activate automatically.\n'
fi
if [[ $(gjs -c 'print(new imports.gi.Gio.Settings({schema_id: "org.gnome.shell"}).get_boolean("disable-user-extensions"));') == true ]]; then
    printf 'GNOME has globally disabled user extensions. Turn on the main switch in the Extensions app.\n'
fi
if [[ -d $stage/previous ]]; then rm -rf -- "$stage/previous"; fi
printf 'Preferences: gnome-extensions prefs %s\n' "$UUID"
