---
name: init-mcp-bridge
description: Detect what's already installed and install whatever's missing to wire up the MCP dev bridge against a specific FXServer (resources folder + server.cfg), then verify it actually works. Use when the user asks to set up, install, or check MCP against their server ("mcp init").
---

# Init MCP Bridge

## Goal
Turn the manual activation steps in
`examples/capabilities/mcp-dev-bridge/README.md` into one guided flow: check
what's already there, install only what's missing, and verify the result
against the real server — instead of the user (or a fresh agent) rediscovering
the same setup steps and real-server gotchas each time.

## Read first
- `examples/capabilities/mcp-dev-bridge/README.md` — the manual steps and
  security notes this skill automates.
- `.ai/memory/requirements/delivered/mcp-dev-bridge.md`'s "real-server
  verification" section — two real bugs were found there that this skill
  must not reintroduce (see Known gotchas below).

## Inputs needed
Ask for whatever isn't already obvious from context:
- The FXServer `resources/` folder path.
- The `server.cfg` path.
- Which resource to target: an existing one (`--target-resource <name>`) or
  a fresh isolated one for testing (`--create-test-resource`). Default to
  creating a test resource unless the user names an existing one — wiring
  `dev_bridge_logger.lua` into a resource already used by real players adds
  log-capture overhead to something that matters; an isolated resource has
  none of that risk.

## Mandatory safety gate — read this before touching anything
**Before running `--confirm`, determine whether this is a live/production
server, not just "a server."** Signals: real player-facing `sv_hostname`,
non-trivial `sv_maxclients`, live Discord/webhook/license-key values,
established player connections (check with the resources folder contents —
many real gameplay resources vs. a handful of dev/test ones — or ask). If
it looks production, **stop and ask the user explicitly**, the way you would
for any other action that could affect a shared/live system — do not infer
consent from "set up MCP for me" alone, because that request doesn't specify
which server. If they confirm, proceed, but keep `mcp_bridge_allow_remote`
false regardless of what they say next (that one specific setting is not
up for negotiation — everything else about scope is).

## Steps
1. Run `node scripts/mcp-init.mjs --resources-path <path> --server-cfg <path> [--target-resource <name> | --create-test-resource] --check-only`.
   This is always safe and read-only. Show the user the checklist.
2. If anything is missing, apply the safety gate above, then re-run the same
   command with `--confirm` instead of `--check-only`.
3. The script never restarts the server or sends console commands itself.
   If its output lists lines to apply live, hand them to the user **as
   separate messages/lines**, explicitly telling them not to paste multiple
   `add_ace`/`ensure`/`set` lines as one combined line — FXServer's console
   does not split a multi-command paste, and a botched multi-line paste can
   silently void every command in it (confirmed the hard way; see the
   Known gotchas section in the requirements memory file).
4. Verify, don't just assume: once the user confirms they've run the console
   commands (or restarted), test:
   - `curl -H "Authorization: Bearer <token>" "http://<host>:<port>/<bridge-resource-name>/mcp/resource/state?resource=<target>"`
     — note the bridge-resource-name URL prefix; a bare `/mcp/...` path
     always 404s with FXServer's own router message, not the bridge's.
   - Then call `auto_build_and_restart` (or `get_resource_state` before/after
     a manual restart) through the actual MCP tool layer, and if a server
     log file is reachable (e.g. txAdmin's `txData/<profile>/logs/fxserver.log`),
     grep it for `[mcp-dev-bridge]` / the target resource's own startup
     lines to confirm a real stop→start cycle happened — a `{"ok":true}`
     response from the bridge does not by itself prove the restart command
     was not silently denied by ACE (this exact false-positive happened
     during development).
5. Report a short summary: what was already installed, what got added, what
   the user still needs to do live (if anything), and what verification
   passed/failed.

## Known gotchas (do not rediscover these)
- **URL routing:** FXServer dispatches a resource's `SetHttpHandler` via a
  `/<resourceName>/<path>` prefix. `scripts/lib/mcp-shared.ts`'s
  `callBridge` already does this (`FXSERVER_BRIDGE_RESOURCE` env var,
  defaults to `mcp_dev_bridge`) — only matters for a manual `curl` check.
- **Restart needs ACE grants.** `command.restart` alone is not enough —
  FXServer's `restart` decomposes into `stop` + `start` internally, each
  separately ACE-gated. `mcp-init.mjs` adds all three grants.
- **One console command per line.** Sending `add_ace X; add_ace Y` or two
  commands concatenated on one line as a single paste can fail with an
  argument-count error that voids both, with no indication either one
  landed.
- **Resources can be nested in category subfolders**
  (`resources/[SomeCategory]/my_resource`), not always directly under
  `resources/`. `mcp-init.mjs` searches a few levels deep rather than
  assuming a flat layout — do not shortcut this if scripting anything
  yourself.

## Safety rule
Never edit an existing target resource's `fxmanifest.lua` to wire in
`dev_bridge_logger.lua` automatically — manifest formats and script-list
conventions vary too much to patch safely. Copy the logger file, then tell
the user the exact one-line change to make themselves.
