# FiveM Resource AI Template

[![Validate template](https://github.com/NewwyKung/fivem-resource-ai-template/actions/workflows/validate.yml/badge.svg)](https://github.com/NewwyKung/fivem-resource-ai-template/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status: Public Preview](https://img.shields.io/badge/status-public%20preview-orange.svg)](CHANGELOG.md)
[![Node.js 24](https://img.shields.io/badge/node-24.x-339933.svg)](package.json)

An AI-first template for building maintainable FiveM resources with modular Lua architecture, optional Svelte 5 NUI, requirements discovery, reusable integration knowledge, automated validation, and production release packaging.

> **Status:** Public Preview (`0.2.0`). Static repository checks and release tooling are automated. FiveM natives, lifecycle behavior, disconnect handling, integrations, and NUI focus still require verification on a real FXServer.

## What this repository is

This is a repository template and development workflow for creating a FiveM resource. It gives human developers and coding agents one shared project agreement, bounded context loading, explicit requirements, provider-neutral architecture, validation scripts, and a clean release builder.

It is not a drop-in gameplay resource, a replacement for testing on FXServer, or a guarantee that every coding-agent product discovers project instructions identically.

## Highlights

- Standalone by default; ESX, QBCore, Qbox, oxmysql, ox_lib, and custom resources are opt-in.
- Clear `client`, `server`, `shared`, `config`, UI, and provider boundaries.
- Requirements discovery before substantial implementation.
- Server-authoritative gameplay and security rules.
- Wireframe-first, asset-aware UI workflow with Svelte 5 and Vite.
- Reusable provider profiles without speculative runtime bridges.
- Small, task-specific AI context instead of loading the entire repository.
- Secret scanning, schema validation, integration tests, LuaLS support, and release packaging.
- Cross-platform development-resource linking through Node.js, with a guarded PowerShell helper retained for Windows.
- Optional AI dev-loop: an FXServer HTTP bridge plus an MCP server for build → restart → log-analysis automation, with an install/check command for setting it up against a real server.
- A sync command for pulling later template updates into a resource already cloned from it, and a workflow for compiling a developer's own freeform style notes into an AI-followed rule file.

## Requirements

- Git
- Node.js 24 and npm
- An FXServer development environment for runtime verification
- Lua Language Server for Lua diagnostics; CI installs the pinned version automatically
- Windows, Linux, or macOS for the Node-based setup script

## Quick Start

### 1. Create a repository

Use GitHub's **Use this template** button so the new project starts without this repository's commit history.

Cloning is also supported:

```bash
git clone <repository-url> my_resource
cd my_resource
```

### 2. Initialize project metadata

Interactive mode:

```bash
npm run init
```

Non-interactive example:

```bash
npm run init -- \
  --name my_resource \
  --author "Your Name" \
  --description "A concise resource description" \
  --framework standalone \
  --database none \
  --shared-library none
```

The initializer updates `resource.json`, `resource/fxmanifest.lua`, UI package metadata and lockfile, and `.ai/memory/environment.md`. Run `npm run init -- --help` for all options. It never writes credentials.

### 3. Install UI dependencies and validate

```bash
npm ci --prefix resource/ui --no-audit --no-fund
npm run validate
```

Useful focused checks:

```bash
npm run validate:fast
npm run check:lua
npm run check:secrets
npm run check:agents
npm run check:skills
npm run check:ui
```

### 4. Connect the resource to FXServer

Cross-platform command:

```bash
npm run setup:dev -- \
  --resources "/path/to/server-data/resources/[local]" \
  --name my_resource
```

On Windows, the guarded PowerShell helper remains available:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev-resource.ps1
```

Both expose the canonical `resource/` directory directly instead of maintaining a copied development tree. Add the resulting name to `server.cfg`:

```cfg
ensure my_resource
```

### 5. Define the resource before implementation

For a new resource or substantial feature, ask the coding agent to start with:

```text
Use .ai/skills/discover-requirements/SKILL.md.
Help me define this resource before implementation.
Ask only about unresolved behavior, authority, framework, database,
integrations, permissions, failure cases, tests, and UI requirements.
```

Confirmed server-wide choices belong in `.ai/memory/environment.md`. Active approved requirements and feature ownership belong in:

```text
.ai/memory/requirements/active/<feature>.md
.ai/features/<feature>.md
```

Do not store secrets in AI memory, provider profiles, examples, or source-controlled configuration.

## Coding-agent compatibility

`AGENTS.md` is the canonical project agreement. Vendor-specific files remain thin adapters.

| Agent surface | Discovery path |
|---|---|
| GPT / OpenAI Codex | `AGENTS.md`, project skills under `.agents/skills/` |
| Claude Code | `CLAUDE.md` imports `AGENTS.md` |
| Gemini CLI | `.gemini/settings.json` discovers the shared agreement |
| Cursor | `AGENTS.md` and `.ai/skills/INDEX.md` |
| GitHub Copilot | `AGENTS.md` where supported, with `.github/copilot-instructions.md` as a compact fallback |
| Kimi Code | `AGENTS.md` and project skills |

See [`docs/ai-agents.md`](docs/ai-agents.md) for verification commands and limitations. A web chat that has not opened the repository cannot automatically discover local files.

## Context flow

Agents should load a bounded route rather than every document:

```text
AGENTS.md
→ .ai/CONTEXT_BUDGET.md
→ one primary skill
→ relevant rules
→ one active requirement
→ one feature registry
→ selected provider profiles
→ affected source files
```

For long or cross-model work, create `.ai/work/current-task.md` from `.ai/work/TEMPLATE.md`.

## UI workflow

New UI work follows:

```text
Requirements
→ Low-fidelity wireframe
→ Wireframe approval
→ Visual design
→ Visual approval
→ Asset decomposition and approval when custom artwork is required
→ Svelte implementation
→ UI review
→ FiveM validation
```

Complex HUD shells, masks, textures, and state overlays can be created as separate image parts before implementation. Approved references and masters stay under `docs/ui-spec/assets/<screen>/`; optimized runtime files stay under `resource/ui/public/assets/<screen>/` and are declared in `asset-manifest.json`.

```bash
npm run check:ui-assets
```

UI source lives in `resource/ui/` and builds to `resource/html/`.

```bash
npm run dev --prefix resource/ui
npm run build --prefix resource/ui
```

Never edit generated `resource/html/` files directly.

## Integrations

External frameworks, databases, libraries, and custom resources follow this lifecycle:

```text
Register documentation once
→ store a concise provider profile
→ activate only when required
→ generate only required adapter operations
→ remove unused runtime bridges
```

- Selected providers: `integrations.json`
- Registered provider knowledge: `.ai/integrations/providers/`
- Sending documentation does not authorize runtime integration.
- Feature code should use stable capability boundaries instead of direct provider calls.

## AI dev-loop tooling (optional)

An opt-in capability pack closes the write → build → restart → log-analysis
loop for AI-assisted development against a real FXServer:

- An FXServer-side HTTP bridge (whitelisted actions only — no arbitrary
  command execution) for restarting a resource, running scripted in-game
  test actions, and reading a resource's captured logs.
- A context-aware MCP server (`npm run mcp`) exposing that loop as tools an
  editor or agent can call directly — build/lint/restart, tail or long-poll
  logs, list connected players, read a live `oxmysql` schema, and drive NUI
  automation — with the tool set adjusted per resource (a pure-Lua resource
  never sees the NUI/database tools).
- `npm run mcp:init` checks what's already installed against a given
  `resources/` + `server.cfg` and installs only what's missing.

Never part of a production manifest; see
[`examples/capabilities/mcp-dev-bridge/README.md`](examples/capabilities/mcp-dev-bridge/README.md)
for activation, security notes, and the full API reference.

## Keeping a cloned resource in sync with this template

Resources are typically created once via **Use this template** and then
diverge. `npm run sync:template` pulls later template-owned changes
(`.ai/rules`, `.ai/skills`, `examples/`, `scripts/`, etc.) back in without
touching the resource's own game code or its confirmed environment/
requirements memory — see `--help` for the default path list, `--dry-run`,
and `--list-only` (lets an AI agent decide what's safe to pull in instead of
hand-picking `--paths`).

## Production releases

Create a deployable resource folder with:

```bash
node scripts/create-release.mjs
```

Common options:

```bash
node scripts/create-release.mjs --bump minor
node scripts/create-release.mjs --bump major
node scripts/create-release.mjs --version 1.0.0
node scripts/create-release.mjs --name my_resource
node scripts/create-release.mjs --skip-ui-build
```

Generated output is written to `release/<resource_name>-<version>/`.

The builder validates the repository, builds NUI by default, copies allowlisted runtime files, patches the production manifest, applies explicit sanitizers, scans for credentials, and writes `RELEASE.json`. See [`docs/releasing.md`](docs/releasing.md).

## Repository map

```text
resource/               canonical FiveM development resource
resource/config/        owner-editable resource configuration
resource/shared/        cross-runtime Lua code
resource/client/        client behavior and bootstrap
resource/server/        server authority and bootstrap
resource/ui/            Svelte 5 NUI source
resource/html/          ignored generated NUI output
release/                ignored generated production packages
examples/               runnable examples and optional capability packs
scripts/                initialization, validation, setup, and release tooling
tests/                  executable checks and runtime test plans
docs/                   decisions, specifications, and references
.ai/                    AI rules, skills, memory, recipes, and registries
AGENTS.md                canonical AI project agreement
integrations.json        selected provider metadata
release.config.json      release allowlist and sanitizer policy
resource.json            machine-readable resource metadata
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — repository invariants and AI routing
- [`.ai/CONTEXT_BUDGET.md`](.ai/CONTEXT_BUDGET.md) — token-efficient context policy
- [`.ai/skills/INDEX.md`](.ai/skills/INDEX.md) — task workflow index
- [`.ai/rules/INDEX.md`](.ai/rules/INDEX.md) — domain rule index
- [`docs/development.md`](docs/development.md) — development and validation
- [`docs/ai-agents.md`](docs/ai-agents.md) — coding-agent compatibility
- [`docs/ci-cd.md`](docs/ci-cd.md) — guarded origin CI and downstream examples
- [`docs/releasing.md`](docs/releasing.md) — production release workflow
- [`docs/credits.md`](docs/credits.md) — acknowledgements and development background
- [`examples/capabilities/mcp-dev-bridge/README.md`](examples/capabilities/mcp-dev-bridge/README.md) — AI dev-loop bridge and MCP server

## Known limitations

- Static checks do not prove correct FiveM runtime behavior.
- Provider integrations require real-environment verification.
- Browser clicks, animation playback, CEF profiling, 4K rendering, and NUI focus require runtime evidence.
- Agent discovery conventions can change; verify active instructions in the selected tool.
- The PowerShell helper is Windows-specific; `npm run setup:dev` is cross-platform.

## Contributing, security, and license

Focused fixes and improvements are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

Report vulnerabilities according to [`SECURITY.md`](SECURITY.md), without publishing credentials or exploitable details.

This project is licensed under the [MIT License](LICENSE).
