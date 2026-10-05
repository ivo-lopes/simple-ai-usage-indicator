# Native validation evidence — 2026-10-05

matrix.json records actual Shell versions, Fedora image manifests/local image IDs,
installed bundle member hashes and native popup/Preferences results. The adjacent
Shell/session logs come from private homes and buses with synthetic quota fixtures;
trailing whitespace is normalized only. No host credentials or network are mounted
into the containers. The helper scripts are in tests/integration/.

host48-ptBR files record native 48.7 GTK/AT-SPI/Orca enumeration, Portuguese UI,
St scale 2, all-provider light/dark/high-contrast bounds and the published v21
install/update smoke. gnome51-ui records native 51.0 controls, keyboard/AT-SPI and
800x600 theme/bounds. host48-pt-narrow records the partially successful pt_PT
run: the overall command FAILED at the private AT-SPI connection; it is not a PASS.
Diagnostic failures and corrected reruns are distinguished in diagnostic-attempts.json.

visual-inspection.json records manual image inspection and hashes of local captures.
Screenshots include distro backgrounds and are retained locally, not redistributed.
Hardware DPI, a full GDM desktop and actual screen-reader speech were NOT TESTED.
See PRE_SUBMISSION.md for commands, results, limits and release recommendations.
