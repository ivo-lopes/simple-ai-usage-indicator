# Manual release policy

GitHub versions (`v21`, `v22`, etc.) are independent of EGO's internal
metadata version. Do not reintroduce a manual `version` key or change the UUID/schema
ID to match a GitHub tag. EGO manages its version on upload.

1. Fetch origin/upstream/tags and follow UPSTREAM.md; review the divergence and record decisions in CHANGELOG.md.
2. Complete local validation and the relevant real-Shell/UI tests in docs/EGO-CHECKLIST.md. Keep PASS/FAIL/NOT TESTED distinct.
3. Commit and push validated code with a clean tree. Wait for CI on that exact commit and download/inspect its ZIP artifact.
4. Check PRE_SUBMISSION.md and remaining blockers. Update Unreleased with the chosen tag/date only when actually preparing a release.
5. Create an annotated tag for the reviewed commit. Publish a GitHub release only after an explicit operator instruction.
6. Attach the inspected `.shell-extension.zip` and `SHA256SUMS` (`sha256sum ZIP > SHA256SUMS`, then `sha256sum -c SHA256SUMS`). Confirm tag/commit, assets and hashes after publication.
7. EGO upload is a separate **manual** operation requiring an explicit instruction and the EGO checklist. Do not upload automatically or alter a pending submission as a side effect.

CI validates and produces an artifact; it does not publish GitHub releases or upload
to EGO. Review/maintain the JavaScript yourself before any submission, and keep
sanitized compatibility evidence linked from the release notes.
