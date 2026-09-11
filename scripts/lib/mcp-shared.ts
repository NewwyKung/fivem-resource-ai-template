/**
 * Shared context detection, bridge client, and build/lint/restart logic for
 * both scripts/mcp-server.ts (MCP tools) and scripts/dev-watch.ts (file
 * watcher). Kept dependency-free beyond Node built-ins so neither entry
 * point needs anything not already in package.json.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------
// Resource context detection
// ---------------------------------------------------------------------

export interface ResourceContext {
  resourceName: string;
  resourceRoot: string;
  workingDirectory: string;
  resourceType: "pure-lua" | "nui-svelte" | "nui-react" | "nui-unknown";
  uiDir: string | null;
}

export function findFxmanifest(root: string): string | null {
  const direct = [join(root, "fxmanifest.lua"), join(root, "resource", "fxmanifest.lua")];
  for (const candidate of direct) {
    if (existsSync(candidate)) return candidate;
  }

  try {
    for (const entry of readdirSync(root)) {
      const full = join(root, entry);
      if (statSync(full).isDirectory()) {
        const candidate = join(full, "fxmanifest.lua");
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {
    // root not readable; fall through to null
  }
  return null;
}

export function parseResourceName(fxmanifestPath: string): string {
  const content = readFileSync(fxmanifestPath, "utf8");
  const match = content.match(/^\s*name\s+'([^']+)'/m);
  return match ? match[1] : basename(dirname(fxmanifestPath));
}

export function detectUiDir(resourceRoot: string): string | null {
  const candidates = [join(resourceRoot, "ui"), join(dirname(resourceRoot), "ui")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "package.json"))) return candidate;
  }
  return null;
}

export function detectResourceType(uiDir: string | null): ResourceContext["resourceType"] {
  if (!uiDir) return "pure-lua";
  try {
    const pkg = JSON.parse(readFileSync(join(uiDir, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.svelte) return "nui-svelte";
    if (deps.react) return "nui-react";
  } catch {
    // unreadable/invalid package.json; report unknown rather than guessing
  }
  return "nui-unknown";
}

export function loadContext(cwd: string): ResourceContext {
  const fxmanifestPath = findFxmanifest(cwd);
  const resourceRoot = fxmanifestPath ? dirname(fxmanifestPath) : cwd;
  const uiDir = detectUiDir(resourceRoot);
  return {
    resourceName: fxmanifestPath ? parseResourceName(fxmanifestPath) : basename(cwd),
    resourceRoot,
    workingDirectory: cwd,
    resourceType: detectResourceType(uiDir),
    uiDir,
  };
}

export interface McpConfig {
  resourceName?: string;
  nui?: { enabled?: boolean; devUrl?: string };
  runtimeTests?: { enabled?: boolean };
  database?: { driver?: string; schemaFile?: string };
}

export function loadMcpConfig(cwd: string): McpConfig {
  const configPath = join(cwd, ".mcp-config.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------
// Token-economy helpers
// ---------------------------------------------------------------------

export function truncate(text: string, maxLines = 50, maxChars = 4000): string {
  const allLines = text.split("\n");
  const lines = allLines.slice(0, maxLines);
  let out = lines.join("\n");
  if (out.length > maxChars) out = `${out.slice(0, maxChars)}\n... (truncated)`;
  if (allLines.length > maxLines) out += `\n... (truncated, showing first ${maxLines} of ${allLines.length} lines)`;
  return out;
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ---------------------------------------------------------------------
// FXServer dev bridge client (see examples/capabilities/mcp-dev-bridge)
// ---------------------------------------------------------------------

export const FXSERVER_URL = (process.env.FXSERVER_URL || "http://127.0.0.1:30120").replace(/\/$/, "");
export const FXSERVER_API_KEY = process.env.FXSERVER_API_KEY || "";

export class BridgeError extends Error {}

export async function callBridge(path: string, options: { method?: string; body?: unknown } = {}): Promise<any> {
  if (!FXSERVER_API_KEY) {
    throw new BridgeError(
      "FXSERVER_API_KEY is not set. Set it in .cursor/mcp.json's env block; it must match the mcp_token convar on the FXServer."
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${FXSERVER_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${FXSERVER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const raw = await res.text();
    let body: any;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = { raw: truncate(raw, 20, 2000) };
    }

    if (!res.ok) {
      throw new BridgeError(`bridge responded ${res.status}: ${JSON.stringify(body)}`);
    }
    return body;
  } catch (err) {
    if (err instanceof BridgeError) throw err;
    throw new BridgeError(`could not reach FXServer dev bridge at ${FXSERVER_URL}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function runCommand(cmd: string, args: string[], cwd: string) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  const combined = `${result.stdout || ""}${result.stderr || ""}`.trim() || "(no output)";
  return { ok: result.status === 0, output: truncate(combined) };
}

// ---------------------------------------------------------------------
// Lua lint gate (LuaLS, same binary/env var as npm run check:lua). Skips
// gracefully — does not block a restart — when LuaLS is not installed,
// mirroring how run_nui_automation degrades when Playwright is absent.
// ---------------------------------------------------------------------

export interface LintResult {
  ok: boolean;
  skipped: boolean;
  output: string;
}

export function runLuaLint(resourceRoot: string): LintResult {
  const executable = process.env.LUALS_BIN || "lua-language-server";
  const versionCheck = spawnSync(executable, ["--version"], { encoding: "utf8" });
  if (versionCheck.error) {
    return {
      ok: true,
      skipped: true,
      output: `LuaLS not found (set LUALS_BIN or install it) — skipped, restart not blocked on Lua diagnostics.`,
    };
  }

  const logPath = mkdtempSync(join(tmpdir(), "mcp-luals-"));
  const diagnosis = spawnSync(
    executable,
    [`--check=${resourceRoot}`, "--checklevel=Error", `--logpath=${logPath}`],
    { encoding: "utf8" }
  );

  const rawOutput = `${diagnosis.stdout || ""}\n${diagnosis.stderr || ""}`;
  const reportPath = join(logPath, "check.json");
  if (!existsSync(reportPath)) {
    if (/no problems found/i.test(rawOutput)) {
      return { ok: true, skipped: false, output: "LuaLS: no errors." };
    }
    return { ok: true, skipped: true, output: `LuaLS check produced no report; skipped.\n${truncate(rawOutput, 10, 500)}` };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const diagnostics = Object.entries(report).flatMap(([file, entries]) =>
      Array.isArray(entries) ? entries.map((d: any) => ({ file, ...d })) : []
    );
    if (diagnostics.length === 0) {
      return { ok: true, skipped: false, output: "LuaLS: no errors." };
    }
    const summary = diagnostics
      .slice(0, 20)
      .map((d: any) => `${d.file}:${(d.range?.start?.line ?? 0) + 1}: ${d.message}`)
      .join("\n");
    return { ok: false, skipped: false, output: truncate(summary) };
  } catch (err) {
    return { ok: true, skipped: true, output: `could not parse LuaLS report; skipped: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------
// Shared build -> lint -> restart loop, used by both the MCP tool and
// the file-watch script so they never drift apart.
// ---------------------------------------------------------------------

export interface BuildAndRestartResult {
  ok: boolean;
  summary: string;
}

export async function buildAndRestart(ctx: ResourceContext, cfg: McpConfig): Promise<BuildAndRestartResult> {
  const resourceName = cfg.resourceName || ctx.resourceName;

  if (ctx.uiDir) {
    const build = runCommand("npm", ["run", "build"], ctx.uiDir);
    if (!build.ok) {
      return { ok: false, summary: `build failed, restart aborted:\n${build.output}` };
    }

    const tsconfigPath = join(ctx.uiDir, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      const typecheck = runCommand("npx", ["tsc", "--noEmit", "--project", tsconfigPath], ctx.uiDir);
      if (!typecheck.ok) {
        return { ok: false, summary: `type check failed, restart aborted:\n${typecheck.output}` };
      }
    }
  }

  const lint = runLuaLint(ctx.resourceRoot);
  if (!lint.ok) {
    return { ok: false, summary: `Lua diagnostics failed, restart aborted:\n${lint.output}` };
  }

  try {
    const result = await callBridge("/mcp/restart", { method: "POST", body: { resource: resourceName } });
    const lintNote = lint.skipped ? ` (${lint.output})` : "";
    return { ok: true, summary: `restart ok: ${JSON.stringify(result)}${lintNote}` };
  } catch (err) {
    return { ok: false, summary: `restart failed: ${(err as Error).message}` };
  }
}
