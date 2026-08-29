# Release Automation Enhancements

Status: Delivered

## Source
Maintainer request via `NextFeature.md` (root-level note, removed after delivery): automate GitHub release creation, package a resource's own readme when present, and add an optional per-file change log starting from a resource's second release.

## Goal
Close three gaps in local release tooling and the opt-in release workflow example without adding required dependencies or activating anything by default.

## Delivered
- `release.config.json` now includes `README.md` in the packaging allowlist, so `resource/README.md` ships in the release automatically when the file exists. No file exists in the template by default.
- `release.config.json` gained an opt-in `changeLog.enabled` toggle (default `false`). When enabled, `scripts/create-release.mjs` diffs the newly packaged files against the immediately preceding release folder (by content hash) and writes `CHANGES.md` with `Added`/`Modified`/`Removed` sections. `RELEASE.json` always records `previousVersion` and a `changeLog` summary (`null` when disabled or there is no prior release). The first release of a resource never produces `CHANGES.md`, since there is nothing to diff against.
- `examples/github-workflows/release.yml` (opt-in, not active by default) now publishes an actual GitHub release: it zips the packaged release folder, attaches it as a release asset, and uses `CHANGES.md` as release notes when present or `gh release create --generate-notes` otherwise. Requires `contents: write`, uses the built-in `GITHUB_TOKEN`, and adds no new dependency (`gh` is preinstalled on GitHub-hosted runners).

## Preserved decisions
- The change log stays project-optional; nothing enables it without an explicit `release.config.json` edit.
- Release publishing lives only in the opt-in `examples/github-workflows/` copy, matching the existing convention that CI/release automation is not active until a maintainer copies it into `.github/workflows/`.
- No new runtime dependency, provider, or required workflow was introduced.

## Validation evidence
- `node scripts/validate-template.mjs`: passed.
- `node tests/release/create-release.integration.mjs`: extended and passed — covers README packaging, the change log staying off by default across a second release, and an enabled third release reporting an accurate added/modified/removed diff while excluding `RELEASE.json`/`CHANGES.md` from the diff itself.
- `node scripts/create-release.mjs --dry-run --skip-ui-build` against the real repository: passed, no regression in version/name resolution.
- GitHub Actions `gh release create` behavior was not executed live (would require pushing a tag); reviewed against `gh` CLI documented behavior only.
