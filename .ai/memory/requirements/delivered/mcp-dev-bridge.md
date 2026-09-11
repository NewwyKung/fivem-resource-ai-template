# MCP Dev Bridge Requirements

## Status
Delivered (opt-in capability pack; not activated by default)

## Last updated
2026-09-11

## Source
User request (Thai): unified multi-resource MCP system for an AI coding
agent's write -> build -> test -> log-analysis loop, with an FXServer HTTP
bridge and a context-aware MCP server, so multiple resource dev chats can run
concurrently without cross-resource confusion and with minimal token usage.

## Problem and outcome
- Problem: no automated loop for an AI agent to build, restart, and inspect
  logs for a FiveM resource under development, or to script in-game QA
  scenarios, without a human at the server console.
- Desired outcome: an opt-in dev-only HTTP bridge plus an MCP server that
  scope every tool call to the resource open in the current workspace.
- Primary users: developers/AI agents on a personal FXServer dev environment.
- Success measure: `auto_build_and_restart`, `read_resource_logs`, and
  `run_in_game_test` complete a full loop against a local dev server without
  a human touching the console.

## Scope
### Included
- `examples/capabilities/mcp-dev-bridge/mcp_dev_bridge/` — standalone,
  dev-only FXServer resource exposing the HTTP bridge.
- `examples/capabilities/mcp-dev-bridge/dev_bridge_logger.lua` — opt-in
  per-resource log-capture shim exported via `mcp_getLogs`.
- `scripts/mcp-server.ts` — context-aware MCP server (Node/TS,
  `@modelcontextprotocol/sdk`) with tools: `get_current_context`,
  `auto_build_and_restart`, `read_resource_logs`, `inspect_db_schema`,
  `run_nui_automation`, `run_in_game_test`.
- `.cursor/mcp.json`, `package.json` (`mcp` script + deps), example
  `.mcp-config.json.example`.

### Excluded
- Arbitrary client/server command execution over HTTP (see Decisions).
- Any live database connection/inventory/framework bridge — none of those
  are registered in `.ai/memory/environment.md`, and none were required to
  deliver this capability.
- Playwright is not installed by default; `run_nui_automation` degrades to
  an instructional message until a consumer opts in with `npm i -D playwright`.

### Future-compatible requirements
- `/mcp/logs` and `/mcp/agent/action` are structured so a future consumer
  resource can add actions without changing the transport/auth layer.

## Recommended solution
Standalone dev-only bridge resource (not embedded in `resource/server/`) so
restart authority and HTTP exposure never ship in a release package or die
when the resource under test restarts. Per-resource log visibility is a
separate opt-in shim so a resource is never silently instrumented. The MCP
server never touches the FXServer directly for anything the bridge does not
already expose, and detects resource context from `fxmanifest.lua` plus an
optional `.mcp-config.json` so concurrent per-resource chats stay scoped.

## Contracts
- HTTP: `POST /mcp/restart`, `POST /mcp/agent/action`, `GET /mcp/logs` — see
  `examples/capabilities/mcp-dev-bridge/README.md` for the full reference.
- Export: `mcp_getLogs(lines, levelFilter)` from any resource carrying
  `dev_bridge_logger.lua`.
- Event hook: `<resource>:mcp:giveItem(serverId, item, count)` — fired, not
  implemented; the resource under test owns the grant logic.

## Security and fault handling
- Bridge refuses to start with `mcp_dev_mode=true` and an empty `mcp_token`.
- Bearer-token auth on every route; localhost-only unless
  `mcp_bridge_allow_remote` is explicitly set.
- `/mcp/agent/action` is a fixed whitelist (`teleport`, `trigger_event`,
  `give_item`, `restart`) — no generic command execution, so a
  misconfigured token/convar cannot become unauthenticated RCE.
- Simple per-IP rate limiting; every action audit-logged with actor IP,
  action, and result.
- `auto_build_and_restart` runs the NUI build and `tsc --noEmit` locally and
  aborts before contacting the server on any failure.

## Testing and acceptance criteria
- `npm run check:secrets`: clean (placeholder token values only).
- `npm run validate:fast`: passed (template policy, registries, schemas,
  skills, agent adapters, secret/i18n/UI-practice fixtures, Svelte
  diagnostics all green).
- `npx tsx scripts/mcp-server.ts` boots without import/syntax errors.
- Lua files reviewed manually; no Lua interpreter available in this
  environment to run `luac`/`check:lua` against the new files — flagged as
  an unverified check below.

## Decisions and rationale
| Decision | Chosen option | Alternatives considered | Rationale |
|---|---|---|---|
| Placement | Opt-in `examples/capabilities/mcp-dev-bridge/` | Embed `dev_bridge.lua` directly in `resource/server/` | Matches existing i18n/runtime-tests pattern; keeps dev-only HTTP surface out of every generated resource's default manifest |
| `/mcp/agent/action` scope | Whitelisted actions only (teleport, trigger_event, give_item, restart) | Arbitrary client/server command execution as originally specified | Arbitrary command execution over HTTP is effectively RCE on the FXServer if the token/convar gate is ever misconfigured; whitelist keeps the blast radius bounded to actions the resource itself already exposes handlers for |
| Bridge topology | Standalone dev-only resource + opt-in per-resource logger shim | Single file embedded per-resource (original literal spec) | Standalone resource matches the runtime-tests convention, survives target-resource restarts, and serves multiple resources from one instance; the shim solves per-resource log capture via a normal FXServer `export` instead of relying on inaccessible full-console capture |
| Database inspection | Reads a locally configured `.sql` schema file only | Live oxmysql/database connection | `environment.md` has no database driver confirmed; a live DB bridge would be a speculative provider bridge, which the repo's core invariants forbid |

## Assumptions
- Consumers running this pack copy the two Lua files into their own
  FXServer resources directory per `examples/capabilities/mcp-dev-bridge/README.md`;
  neither file is referenced from `resource/fxmanifest.lua`.
- `FXSERVER_API_KEY` in `.cursor/mcp.json` must be set by each developer
  locally to match the `mcp_token` convar; the committed value is a
  placeholder (`replace-me`).

## Unresolved questions
- None blocking; `check:lua`/LuaLS verification of the two new Lua files is
  outstanding because no Lua toolchain was available in this environment.

## Approval
- Approved by: repository owner, via in-chat discovery questions.
- Approval date: 2026-09-11.
- Approved defaults: opt-in capability-pack placement; whitelisted
  `/mcp/agent/action` scope (no arbitrary command execution).
