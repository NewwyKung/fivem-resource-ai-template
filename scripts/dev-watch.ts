#!/usr/bin/env node
/**
 * Watches the current resource's Lua and NUI source for changes and runs
 * the same build -> lint -> restart loop as the auto_build_and_restart MCP
 * tool, without an agent having to call it manually each time. Plain CLI,
 * not an MCP tool, since it runs a long-lived loop rather than a single
 * request/response.
 *
 * Requires the same env as the MCP server: FXSERVER_URL / FXSERVER_API_KEY.
 * See examples/capabilities/mcp-dev-bridge/README.md.
 */
import { watch } from "node:fs";
import { sep } from "node:path";
import { loadContext, loadMcpConfig, buildAndRestart } from "./lib/mcp-shared.js";

const ctx = loadContext(process.cwd());
const cfg = loadMcpConfig(process.cwd());

// Generated/dependency output that a build writes to. Watching these would
// make the watcher re-trigger itself on its own build output forever —
// "html" in particular is this template's generated NUI output directory
// (see .gitignore: resource/html/*), rebuilt by every ui build.
const IGNORED_SEGMENTS = new Set(["html", "node_modules", ".git", "dist", "build", ".svelte-kit", "release"]);

function isIgnored(filename: string | null): boolean {
  if (!filename) return false;
  return filename.split(sep).some((segment) => IGNORED_SEGMENTS.has(segment));
}

const DEBOUNCE_MS = 500;
let pending: NodeJS.Timeout | null = null;
let running = false;
let rerunQueued = false;

async function trigger(reason: string) {
  if (running) {
    rerunQueued = true;
    return;
  }
  running = true;
  console.log(`[mcp-watch] ${reason}, running build -> lint -> restart...`);
  const result = await buildAndRestart(ctx, cfg);
  console.log(`[mcp-watch] ${result.ok ? "OK" : "FAILED"}: ${result.summary}`);
  running = false;
  if (rerunQueued) {
    rerunQueued = false;
    void trigger("changes queued during last run");
  }
}

function onChange(source: string) {
  return (_event: string, filename: string | null) => {
    if (isIgnored(filename)) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => void trigger(`${source} changed (${filename ?? "unknown file"})`), DEBOUNCE_MS);
  };
}

function watchDir(dir: string, label: string) {
  try {
    watch(dir, { recursive: true }, onChange(label));
    console.log(`[mcp-watch] watching ${dir}`);
  } catch (err) {
    console.error(
      `[mcp-watch] could not watch ${dir}: ${(err as Error).message}. Recursive fs.watch may be unsupported on this platform/filesystem.`
    );
  }
}

watchDir(ctx.resourceRoot, "resource");
if (ctx.uiDir) watchDir(ctx.uiDir, "ui");

console.log(
  `[mcp-watch] ready for "${cfg.resourceName || ctx.resourceName}". Ctrl+C to stop. Running an initial build -> lint -> restart now.`
);
void trigger("startup");
