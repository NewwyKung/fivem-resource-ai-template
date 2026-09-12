# Optional MCP Dev Bridge

This pack is opt-in because it opens an HTTP control surface on a development
FXServer and adds a Node/TypeScript MCP server to the toolchain. Discovery
must confirm the user wants an automated write -> build -> restart -> log
loop before this is activated, and it must never ship in a production
manifest.

Use it when:

- an AI coding agent needs to build, restart, and inspect logs for the
  resource in the currently open workspace without a human tabbing to the
  server console;
- multiple resources are developed in parallel (each with its own chat/agent
  session) and each agent must stay scoped to its own resource;
- QA scenarios need a scripted player action (teleport, trigger event, give
  item hook) plus a pass/fail read of that resource's recent logs.

Do not activate it for a resource with no development server, or when the
user only wants a one-off manual test.

## What's in this pack

- `mcp_dev_bridge/` — a standalone, dev-only FXServer resource. It owns the
  HTTP control endpoints (`/mcp/restart`, `/mcp/agent/action`, `/mcp/logs`,
  `/mcp/players`) and never enters a production manifest, mirroring the
  [runtime-tests](../runtime-tests/README.md) pattern.
- `dev_bridge_logger.lua` — a small shim copied into the *target* resource
  (the one under active development) so `mcp_dev_bridge` can read that
  resource's own recent log lines through a normal FXServer `export`. Without
  this shim, `/mcp/logs` only reports the bridge's own logs.
- `../../../scripts/mcp-server.ts` (repo root `scripts/`) — the MCP server an
  editor (Cursor, Claude Desktop) launches. It is context-aware: it reads
  `fxmanifest.lua` from the open workspace to scope every tool call to that
  one resource, and it never talks to the FXServer directly for anything the
  bridge doesn't already expose. Its tool set is also dynamic per resource:
  `inspect_db_schema` only registers when `.mcp-config.json` declares a
  database, and `run_nui_automation` only registers when the resource has a
  detected UI (or `nui.enabled` is set) — a pure-Lua resource never sees
  either tool.
- `.mcp-config.json.example` — copy to the resource's repo root as
  `.mcp-config.json` to describe that resource to the MCP server (NUI dev
  URL, whether runtime tests are wired up, etc). Optional; the MCP server
  falls back to auto-detection when it is absent.

## Why the bridge is a separate resource, not a file inside `resource/server/`

The HTTP control surface (restart any resource, trigger events, move a
player) is server-wide authority, not something the resource under test
should carry in its own manifest. Keeping it a standalone resource means:

- it can be started only on a development server and never copied into a
  release package;
- restarting the resource under test does not also kill the bridge that
  issued the restart;
- one bridge instance can serve every resource being developed on that
  server, instead of duplicating an HTTP listener per resource.

Per-resource log visibility is opt-in separately via `dev_bridge_logger.lua`
so a resource is never silently instrumented.

## Activation

**Faster path:** ask an AI agent to run `.ai/skills/init-mcp-bridge/SKILL.md`
("mcp init" / "set up MCP against my server") with your `resources/` and
`server.cfg` paths — it checks what's already installed, installs only
what's missing via `scripts/mcp-init.mjs`, and verifies the result against
the real server. The manual steps below are what it automates.

1. Copy `mcp_dev_bridge/` into your FXServer's resources folder (do **not**
   place it under `resource/`, which is packaged for release).
2. Copy `dev_bridge_logger.lua` into the `server/` folder of each resource
   you want `/mcp/logs` to cover, and add it to that resource's
   `server_scripts` (first in the list, so it captures everything printed
   after it).
3. In `server.cfg` (development server only):
   ```
   # Only required if this server restricts console commands via ACE (many
   # do, e.g. an existing "Restarter"-style setup). Confirmed against a real
   # server: FXServer's restart command internally runs stop then start, so
   # both need their own grant — command.restart alone is not enough.
   add_ace resource.mcp_dev_bridge command.restart allow
   add_ace resource.mcp_dev_bridge command.start allow
   add_ace resource.mcp_dev_bridge command.stop allow

   ensure mcp_dev_bridge
   setr mcp_dev_mode true
   set mcp_token "<a long random string, not committed anywhere>"
   # Optional, default false. Leave false unless the FXServer and the MCP
   # client genuinely run on different machines — this is a live control
   # endpoint, not something to expose past localhost by default.
   setr mcp_bridge_allow_remote false
   ```
   If you paste these into a live console instead of restarting to pick up
   `server.cfg`, send each `add_ace` line as its own separate command —
   FXServer's console does not split multiple commands out of one line, and
   sending two at once fails with an argument-count error that silently
   voids both.
4. Copy `.mcp-config.json.example` to the resource repo root as
   `.mcp-config.json` and adjust it (optional).
5. From the resource repo root: `npm install` then `npm run mcp` to start
   the MCP server standalone, or copy `.cursor/mcp.json.example` to
   `.cursor/mcp.json` (gitignored — never commit the real one) and fill in
   `FXSERVER_URL`/`FXSERVER_API_KEY` (the latter must match `mcp_token`
   above) to let Cursor/Claude Desktop launch it.
6. Optional: `npm run mcp:watch` runs the same build -> lint -> restart loop
   as `auto_build_and_restart`, automatically, on every file change in the
   resource (and its `ui/`, if present) — for when you'd rather not have the
   agent call the tool manually after each edit.

## Security notes

- The bridge refuses to start (`mcp_dev_mode` on but no `mcp_token` set) so
  it can never come up silently unauthenticated.
- Every request must carry `Authorization: Bearer <mcp_token>`; requests are
  rejected before any action runs otherwise.
- Requests are rejected unless they originate from localhost, unless you
  explicitly opt into `mcp_bridge_allow_remote true`.
- `/mcp/agent/action` only runs a fixed whitelist (`teleport`,
  `trigger_event`, `give_item`, `restart`). It intentionally does **not**
  accept arbitrary console/client commands — that would turn a dev
  convenience into an unauthenticated remote-code-execution surface the
  moment the token or convar gate is misconfigured. `trigger_event` still
  only reaches event handlers the resource itself registered.
- `give_item` never assumes an inventory system. It fires
  `<resource>:mcp:giveItem` and expects the resource under test to register
  a handler if it wants this capability — matching this template's rule
  against inventing framework bridges speculatively.
- `/mcp/db/schema` only ever executes `SHOW TABLES` and `DESCRIBE` — no
  caller-supplied query, no write/update/delete path exists in the bridge at
  all. It no-ops with a 501 when `oxmysql` isn't running.
- Every action is logged to console with actor IP, action name, and result
  for audit.
- Remove `mcp_dev_bridge` and every `dev_bridge_logger.lua` copy from any
  server or branch that is not a personal development environment.

## API reference

All endpoints require `Authorization: Bearer <mcp_token>`, and — confirmed
against a real FXServer — must be called through the resource-name prefix
FXServer uses to route `SetHttpHandler`: `http://<host>:<port>/mcp_dev_bridge/mcp/...`,
**not** a bare `/mcp/...` path (that 404s with FXServer's own generic router
message, not the bridge's). `scripts/lib/mcp-shared.ts` adds this prefix
automatically (override the resource name with the `FXSERVER_BRIDGE_RESOURCE`
env var if you renamed the `mcp_dev_bridge` folder); a manual `curl` needs it
written out, e.g.:
```
curl -H "Authorization: Bearer <mcp_token>" \
  "http://127.0.0.1:30120/mcp_dev_bridge/mcp/resource/state?resource=my_resource"
```

- `POST /mcp/restart` — body `{ "resource": "my_resource" }`.
- `POST /mcp/agent/action` — body `{ "action": "teleport" | "trigger_event" | "give_item" | "restart", ...params }`:
  - `teleport`: `{ action: "teleport", serverId, coords: { x, y, z, heading? } }`
  - `trigger_event`: `{ action: "trigger_event", event, args?: [...], target?: "server" | serverId }`
  - `give_item`: `{ action: "give_item", serverId, item, count? }` — fires `<resource>:mcp:giveItem(serverId, item, count)` server-side.
  - `restart`: same as `POST /mcp/restart`.
- `GET /mcp/logs?resource=<name>&lines=20&level=error|warn|info` — `resource`
  defaults to the bridge itself; pass the name of a resource that has
  `dev_bridge_logger.lua` installed to read its logs instead.
- `GET /mcp/logs/watch?resource=<name>&level=error&since=<seq>&timeoutMs=5000` —
  long-polls (server-side, capped at 6000ms) for log lines newer than
  `since` instead of the caller polling `/mcp/logs` in a loop. Call once
  with no `since` to get a starting cursor (`lastSeq` in the response, no
  wait), then call again passing that value as `since` to actually wait.
  Repeated identical messages are collapsed into one entry with a
  `repeatCount` so a noisy loop doesn't flood the response. Behind the
  `watch_resource_logs` MCP tool.
- `POST /mcp/logs/clear` — body `{ "resource": "my_resource" }` (defaults
  to the bridge itself). Clears that resource's log ring buffer for a
  clean baseline before a test run. Behind `clear_resource_logs`.
- `GET /mcp/resource/state?resource=<name>` — returns
  `{ resource, state }` from `GetResourceState`, for any resource on the
  server (no `dev_bridge_logger.lua` required). Use after
  `auto_build_and_restart` to confirm the resource actually started
  rather than trusting that the restart request was merely accepted.
  Behind `get_resource_state`.
- `GET /mcp/players` — connected players as `{ players: [{ serverId, name, coords }] }`.
  Use this (via the `list_players` MCP tool) to find a `serverId` before a
  `teleport`/`give_item` agent action or `run_in_game_test`.
- `GET /mcp/db/schema` — only when `oxmysql` is running on the server;
  returns `{ tables: [{ table, columns }] }` from a live `SHOW TABLES` +
  `DESCRIBE` per table. Read-only: no caller-supplied query ever reaches
  the database, so there is no write path and no SQL injection surface.
  501 if `oxmysql` isn't started. Used by `inspect_db_schema` when
  `.mcp-config.json`'s `database.driver` is `"oxmysql"`.

## Token-efficient AI rule

The MCP server truncates every tool response to a short summary (build
errors, last N log lines, pass/fail) instead of returning raw JSON, stdout,
or HTML. `auto_build_and_restart` (and `npm run mcp:watch`) run the NUI
build, `tsc --noEmit`, and a LuaLS error-level check locally before any
restart request is sent, so a build, type, or Lua error never reaches the
FXServer. The Lua check is skipped (not a hard failure) when LuaLS isn't
installed — set `LUALS_BIN` to enable it, same as `npm run check:lua`.
