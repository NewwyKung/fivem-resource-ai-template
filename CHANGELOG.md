# Changelog

All notable public changes to this project are documented here. The project follows Semantic Versioning for template releases.

## [Unreleased]

### Planned

- Collect Windows and Linux FXServer smoke-test evidence.
- Refine onboarding based on Public Preview feedback.

## [0.2.0] - 2026-08-29

### Added

- Asset-first UI phase for decomposing approved visual designs into separate shells, masks, scales, textures, and state overlays before Svelte assembly.
- Canonical UI asset manifest schema with source/runtime separation, dimensions, transparency, behavior, ownership, provenance, safe zones, and byte budgets.
- `assetize-ui` project skill and FiveM UI router support.
- Deterministic UI asset validation and integration coverage through `npm run check:ui-assets` and `npm run test:ui-assets`.
- Automatic packaging of `resource/README.md` into a release when the file exists.
- Optional per-project packaged change log: when `release.config.json.changeLog.enabled` is `true`, releases from the second version onward include `CHANGES.md` with an added/modified/removed file diff against the previous release; off by default.
- `examples/github-workflows/release.yml` now publishes an actual GitHub release (zipped package attached, notes from `CHANGES.md` when present or auto-generated otherwise) instead of only uploading a workflow artifact.

### Changed

- UI specifications now track asset approval, decomposition, dynamic safe zones, and provenance.
- Design pipeline and agent guidance now route artwork-heavy screens through asset approval before implementation.
- GitHub Actions now use the Node 24-based `checkout` and `setup-node` v5 actions.

### Fixed

- Restored the canonical `resource/ui` Svelte scaffold, lockfile, hardened NUI bridge, production `ui_page`, and generated-output boundary so CI can install and validate the template.
- Removed stale duplicate development resources that conflicted with repository validation and dependency caching.
- Windows: quoted the Node executable path used to shell out to `npm`/validation scripts during release creation, fixing a failure when Node was installed under a path containing spaces (e.g. `C:\Program Files\nodejs`).

## [0.1.0] - 2026-08-05

### Added

- Public Preview status and concise first-time onboarding.
- MIT license and repository security/contribution policies.
- Guarded GitHub Actions validation for the upstream repository.
- Cross-platform development-resource setup command.
- Interactive and non-interactive template initializer.
- GitHub issue and pull-request templates.
- Public release readiness validation.

### Changed

- Canonical internal project name to `fivem-resource-ai-template`.
- README reorganized around setup, validation, agent compatibility, release use, and limitations.
- Credits and development background moved to `docs/credits.md`.

### Known limitations

- Real FXServer runtime verification is still required.
- Coding-agent discovery must be verified in the selected product and version.
