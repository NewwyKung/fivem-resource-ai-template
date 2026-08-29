---
name: release-resource
description: Build a production-ready FiveM resource package under release/<resource-name>-<version>.
---

# Release Resource

## Context budget
Follow `.ai/CONTEXT_BUDGET.md`. Read release metadata/policy, selected runtime/integrations, affected manifest/config, and release checklist only. Do not load unrelated design/provider/history files.

## Inputs
Resolve from `resource.json`, active approved requirements, and the user's instruction:
- resource name
- patch/minor/major/explicit version intent
- whether UI build is required; default yes
- runtime roots to package
- public config defaults and exact secret-bearing paths/patterns

Do not ask for a version when semantic-version inference is sufficient.

## Versioning
- first release: current `resource.json.version`
- later release: patch by default
- compatible feature: minor
- approved breaking change: major
- explicit user version overrides inference

Keep source metadata and packaged manifest on the created version.

## Commands

```bash
node scripts/create-release.mjs
node scripts/create-release.mjs --bump minor
node scripts/create-release.mjs --bump major
node scripts/create-release.mjs --version 2.4.0
node scripts/create-release.mjs --name my_resource
node scripts/create-release.mjs --skip-ui-build
node scripts/create-release.mjs --dry-run --skip-ui-build
```

## Workflow
1. Read `release.config.json`; update allowlist only for approved runtime roots.
2. Remove inactive bridges, drivers, provider configs, dependencies, tests, and manifest entries.
3. Run template/integration/index validation and relevant tests.
4. Build `resource/ui` unless explicitly skipped; when skipped require valid existing `resource/html/index.html`.
5. Create `release/<resource_name>-<version>` and copy allowlisted contents of `resource/` directly to the release root.
6. Patch packaged manifest to production UI and release version.
7. Apply only explicit `jsonSecretPaths` and `textSanitizers`.
8. Fail when configured paths/patterns do not match; never assume cleanup succeeded.
9. Run secret-value and credential-like assignment scans.
10. Write `RELEASE.json` with exact sanitization evidence, previous version, and change-log summary.
11. When `resource/README.md` exists, confirm it packaged automatically; no config is required.
12. When `release.config.json.changeLog.enabled` is `true` and a prior release exists, confirm `CHANGES.md` lists the real added/modified/removed files. Leave the toggle untouched unless the user asks to enable/disable it — it is opt-in per project.
13. Run `node tests/release/create-release.integration.mjs` when changing release logic.
14. Inspect output as a standalone server resource.

## Secret policy
- Never auto-clear a value from a broad key-name match alone.
- Add exact JSON paths or exact text/Lua regex replacements for known credentials.
- Keep public operational config; replace only secret values with explicit safe placeholders such as `nil`/`null`.
- A suspicious unconfigured assignment is a release blocker requiring review.
- Never copy `.env`, private config, AI memory, provider docs, or credentials.

## Completion evidence
Report output path, version rationale, UI build/reuse, runtime roots, exact sanitizers applied, secret scan, tests/validation, omitted checks, and deployment risks.
