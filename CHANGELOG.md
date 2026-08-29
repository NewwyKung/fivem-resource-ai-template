# Changelog

All notable public changes to this project are documented here. The project follows Semantic Versioning for template releases.

## [Unreleased]

### Added

- Asset-first UI phase for decomposing approved visual designs into separate shells, masks, scales, textures, and state overlays before Svelte assembly.
- Canonical UI asset manifest schema with source/runtime separation, dimensions, transparency, behavior, ownership, provenance, safe zones, and byte budgets.
- `assetize-ui` project skill and FiveM UI router support.
- Deterministic UI asset validation and integration coverage through `npm run check:ui-assets` and `npm run test:ui-assets`.

### Changed

- UI specifications now track asset approval, decomposition, dynamic safe zones, and provenance.
- Design pipeline and agent guidance now route artwork-heavy screens through asset approval before implementation.

### Planned

- Collect Windows and Linux FXServer smoke-test evidence.
- Refine onboarding based on Public Preview feedback.

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
