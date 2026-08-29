# Production Releases

A release is a clean FiveM resource folder created under:

```text
release/<resource_name>-<version>/
```

The generated folder is intended to be copied directly into the server's `resources/` directory and started with:

```cfg
ensure <resource_name>-<version>
```

## Create a release

```bash
node scripts/create-release.mjs
```

Release generation runs local template, integration, schema, secret, registry, and Svelte diagnostics first. It builds into a same-volume staging directory, completes sanitization and secret scanning, then renames the finished package into place. A failed build removes staging output and restores source version files.

The UI is built by default. Skip the build only when an existing production build under `resource/html/` is intentionally reused:

```bash
node scripts/create-release.mjs --skip-ui-build
```

Preview name/version without creating files:

```bash
node scripts/create-release.mjs --dry-run --skip-ui-build
```

Automation that already completed `npm run validate` may pass `--skip-validation` to avoid running the release subset twice. Do not use that flag as a workaround for failing checks.

## Versioning

The builder uses Semantic Versioning:

- first release: current version from `resource.json`
- later release: patch increment by default
- backward-compatible feature: `--bump minor`
- breaking release: `--bump major`
- explicit override: `--version 2.3.0`

The output folder, packaged `fxmanifest.lua`, source `resource/fxmanifest.lua`, and `resource.json` use the same version.

## Packaging allowlist

`release.config.json` controls which paths under `resource/` are allowed into a release. The builder copies those contents directly to the release root, so it may include `fxmanifest.lua`, runtime Lua/config folders, built `html/`, and optional runtime assets/data/sql without nesting them under `resource/`.

It intentionally excludes AI instructions, docs, examples, tests, scripts, UI source, GitHub configuration, development dependencies, source maps, and placeholders. Add new runtime roots deliberately; never copy the repository wholesale.

`resource/README.md` is packaged automatically when present, so a resource-specific readme reaches server owners without extra configuration. There is no such file in the template by default.

## UI behavior

Default behavior:
1. run `npm run build --prefix resource/ui`;
2. require `resource/html/index.html`;
3. copy `resource/html/` to release `html/`;
4. patch the packaged manifest to `ui_page 'html/index.html'`;
5. remove localhost development entries.

`--skip-ui-build` reuses existing `resource/html/`; it does not disable UI.

## Explicit config sanitization

The builder does not erase values merely because a key contains words such as `token`, `password`, or `secret`. Broad key-name cleanup can destroy legitimate gameplay configuration.

Declare exact sanitizers in `release.config.json`:

### JSON path

```json
{
  "jsonSecretPaths": [
    {
      "file": "config/server.json",
      "path": "discord.webhook",
      "replacement": null
    }
  ]
}
```

### Text/Lua pattern

```json
{
  "textSanitizers": [
    {
      "file": "config/server.lua",
      "pattern": "Config\\.Webhook\\s*=\\s*['\"][^'\"]+['\"]",
      "replacement": "Config.Webhook = nil",
      "flags": "gm"
    }
  ]
}
```

Configured paths and patterns must exist and match. Otherwise release creation fails, preventing stale cleanup rules from silently doing nothing.

After explicit sanitization, the builder scans for known webhook/private-key values and credential-like assignments. A suspicious value without an approved sanitizer causes a failure and must be reviewed manually.

Never store secrets in AI memory, provider profiles, public examples, or source-controlled release configuration.

## Output metadata

Each release contains `RELEASE.json` with resource name, version, generation time, UI-build status, exact fields/patterns sanitized, the previous packaged version (if any), and a change-log summary (`null` when the change log is disabled or there is no previous release).

## Optional packaged change log

Starting from a resource's second release, the builder can compare the newly packaged files against the immediately preceding release folder and list what changed. This is off by default; enable it per project in `release.config.json`:

```json
{
  "changeLog": {
    "enabled": true
  }
}
```

When enabled and a previous release exists, the builder writes `CHANGES.md` into the release package with `Added`, `Modified`, and `Removed` file lists (by content hash, ignoring `RELEASE.json` and `CHANGES.md` themselves). The first release of a resource never produces this file because there is nothing prior to diff against.

## Automated integration test

The local integration test builds a real temporary release using:

```bash
node tests/release/create-release.integration.mjs
```

It verifies allowlisted output, root/nested glob exclusions, production manifest patching, explicit secret sanitization, metadata evidence, exclusion of development/AI folders, rollback after a forced sanitizer failure, that the packaged change log stays off by default across successive releases, and that enabling it reports an accurate added/modified/removed file diff plus `resource/README.md` packaging.

## Final deployment check

Verify:
- manifest references only included files;
- no localhost URL remains;
- built UI exists when enabled;
- required integrations/dependencies are declared;
- inactive bridges are absent;
- explicit sanitizers and secret scan passed;
- start/restart/player-drop cleanup was tested;
- the folder runs without repository-only files.
