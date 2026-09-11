# MCP Dev Bridge

## Purpose
Opt-in write -> build -> restart -> log-analysis automation loop for an AI
coding agent, via a dev-only FXServer HTTP bridge and a context-aware MCP
server. See `examples/capabilities/mcp-dev-bridge/README.md` for activation
and the full API reference; `.ai/memory/requirements/delivered/mcp-dev-bridge.md`
for the approved decisions.

## Ownership
- Client: none.
- Server: `examples/capabilities/mcp-dev-bridge/mcp_dev_bridge/server/dev_bridge.lua` (standalone dev resource); `examples/capabilities/mcp-dev-bridge/dev_bridge_logger.lua` (opt-in shim copied into the resource under test).
- Shared: none.
- UI: none (an activated resource's own NUI dev server is driven externally via `run_nui_automation`, not modified by this pack).
- Tooling: `scripts/mcp-server.ts` (repo root, MCP stdio server).

## Files
- Config: `.mcp-config.json.example` (copy to repo root as `.mcp-config.json`); `.cursor/mcp.json`; `package.json` (`mcp`/`mcp:watch` scripts, `@modelcontextprotocol/sdk`, `zod`, `tsx`).
- Modules: `mcp_dev_bridge/fxmanifest.lua`, `mcp_dev_bridge/server/dev_bridge.lua`, `dev_bridge_logger.lua`, `scripts/lib/mcp-shared.ts`, `scripts/dev-watch.ts`.
- Tests: none automated (dev-only, environment-dependent); `npm run validate:fast` and `npm run check:secrets` cover the surrounding repo policy.
- UI specification: none.

## Contracts
- Events: `<resource>:mcp:giveItem(serverId, item, count)` — fired by the bridge, the resource under test implements it.
- Callbacks: none.
- Exports: `mcp_getLogs(lines, levelFilter)`, `mcp_getLogsSince(sinceSeq, levelFilter)`, `mcp_clearLogs()` from any resource carrying `dev_bridge_logger.lua`; `exports.oxmysql:executeSync` consumed read-only by the bridge itself when present.
- State bags: none.
- HTTP: `POST /mcp/restart`, `POST /mcp/agent/action`, `GET /mcp/logs`, `GET /mcp/logs/watch`, `POST /mcp/logs/clear`, `GET /mcp/resource/state`, `GET /mcp/players`, `GET /mcp/db/schema` on the `mcp_dev_bridge` resource, Bearer-token authenticated.

## Data
- Database tables: none.
- Cache/state: in-memory ring buffer of the last ~300 log lines per instrumented resource; not persisted.
- Authority: server-only; the bridge never trusts client input, and every HTTP request is authenticated and audited.

## Dependencies
- `@modelcontextprotocol/sdk`, `zod`, `tsx` (Node/TS side, added to root `package.json`).
- Optional, not installed by default: `playwright` (only for `run_nui_automation`).

## Failure and cleanup
- Bridge refuses to start without an explicit `mcp_token`; all routes 401 without a matching Bearer header and 403 for non-localhost callers unless `mcp_bridge_allow_remote` is set.
- `auto_build_and_restart` aborts before any network call on a build or `tsc --noEmit` failure.
- Cleanup gate: remove `mcp_dev_bridge` and every `dev_bridge_logger.lua` copy, and unset `mcp_dev_mode`/`mcp_token`, before any server or branch stops being a personal dev environment.

## Status
Active
