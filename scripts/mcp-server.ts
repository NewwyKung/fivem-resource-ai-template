#!/usr/bin/env node
/**
 * Context-aware MCP server for this FiveM resource template. See
 * examples/capabilities/mcp-dev-bridge/README.md for activation steps and
 * the FXServer-side HTTP bridge this talks to.
 *
 * Scoped to whatever resource `process.cwd()` sits in, so opening multiple
 * resource workspaces at once (each its own editor/chat session) never
 * crosses wires between them.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------
// Resource context detection
// ---------------------------------------------------------------------

interface ResourceContext {
  resourceName: string;
  resourceRoot: string;
  workingDirectory: string;
  resourceType: "pure-lua" | "nui-svelte" | "nui-react" | "nui-unknown";
  uiDir: string | null;
}

function findFxmanifest(root: string): string | null {
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

function parseResourceName(fxmanifestPath: string): string {
  const content = readFileSync(fxmanifestPath, "utf8");
  const match = content.match(/^\s*name\s+'([^']+)'/m);
  return match ? match[1] : basename(dirname(fxmanifestPath));
}

function detectUiDir(resourceRoot: string): string | null {
  const candidates = [join(resourceRoot, "ui"), join(dirname(resourceRoot), "ui")];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "package.json"))) return candidate;
  }
  return null;
}

function detectResourceType(uiDir: string | null): ResourceContext["resourceType"] {
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

function loadContext(cwd: string): ResourceContext {
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

interface McpConfig {
  resourceName?: string;
  nui?: { enabled?: boolean; devUrl?: string };
  runtimeTests?: { enabled?: boolean };
  database?: { driver?: string; schemaFile?: string };
}

function loadMcpConfig(cwd: string): McpConfig {
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

function truncate(text: string, maxLines = 50, maxChars = 4000): string {
  const allLines = text.split("\n");
  const lines = allLines.slice(0, maxLines);
  let out = lines.join("\n");
  if (out.length > maxChars) out = `${out.slice(0, maxChars)}\n... (truncated)`;
  if (allLines.length > maxLines) out += `\n... (truncated, showing first ${maxLines} of ${allLines.length} lines)`;
  return out;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ---------------------------------------------------------------------
// FXServer dev bridge client (see examples/capabilities/mcp-dev-bridge)
// ---------------------------------------------------------------------

const FXSERVER_URL = (process.env.FXSERVER_URL || "http://127.0.0.1:30120").replace(/\/$/, "");
const FXSERVER_API_KEY = process.env.FXSERVER_API_KEY || "";

class BridgeError extends Error {}

async function callBridge(path: string, options: { method?: string; body?: unknown } = {}): Promise<any> {
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

function runCommand(cmd: string, args: string[], cwd: string) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  const combined = `${result.stdout || ""}${result.stderr || ""}`.trim() || "(no output)";
  return { ok: result.status === 0, output: truncate(combined) };
}

// ---------------------------------------------------------------------
// MCP server + tools
// ---------------------------------------------------------------------

const server = new McpServer({ name: "fivem-auto-dev", version: "0.1.0" });

// Computed once at startup: the editor spawns one MCP server process per
// workspace, so cwd (and therefore the resource it belongs to) never
// changes for the life of this process. This is also what drives which
// tools below get registered at all, not just how they behave.
const ctx = loadContext(process.cwd());
const cfg = loadMcpConfig(process.cwd());
const hasNui = cfg.nui?.enabled !== false && (ctx.resourceType !== "pure-lua" || Boolean(cfg.nui?.enabled));
const hasDatabase = Boolean(cfg.database?.schemaFile) || Boolean(cfg.database?.driver && cfg.database.driver !== "none");

server.registerTool(
  "get_current_context",
  {
    title: "Get current resource context",
    description:
      "Resource name, working directory, and resource type (pure Lua vs NUI) for the FiveM resource open in this workspace. Call this first so every other tool stays scoped to the right resource.",
    inputSchema: {},
  },
  async () => {
    return textResult(
      JSON.stringify(
        {
          resourceName: cfg.resourceName || ctx.resourceName,
          resourceRoot: ctx.resourceRoot,
          workingDirectory: ctx.workingDirectory,
          resourceType: ctx.resourceType,
          uiDir: ctx.uiDir,
          activeTools: [
            "get_current_context",
            "auto_build_and_restart",
            "read_resource_logs",
            "run_in_game_test",
            ...(hasDatabase ? ["inspect_db_schema"] : []),
            ...(hasNui ? ["run_nui_automation"] : []),
          ],
          bridgeConfigured: Boolean(FXSERVER_API_KEY),
          fxserverUrl: FXSERVER_URL,
        },
        null,
        2
      )
    );
  }
);

server.registerTool(
  "auto_build_and_restart",
  {
    title: "Build, type-check, and restart",
    description:
      "Builds the NUI (if present), runs tsc --noEmit, and only if both pass sends /mcp/restart to the FXServer dev bridge for this resource. Aborts before contacting the server on any build or type error.",
    inputSchema: {},
  },
  async () => {
    const resourceName = cfg.resourceName || ctx.resourceName;

    if (ctx.uiDir) {
      const build = runCommand("npm", ["run", "build"], ctx.uiDir);
      if (!build.ok) {
        return textResult(`build failed, restart aborted:\n${build.output}`);
      }

      const tsconfigPath = join(ctx.uiDir, "tsconfig.json");
      if (existsSync(tsconfigPath)) {
        const typecheck = runCommand("npx", ["tsc", "--noEmit", "--project", tsconfigPath], ctx.uiDir);
        if (!typecheck.ok) {
          return textResult(`type check failed, restart aborted:\n${typecheck.output}`);
        }
      }
    }

    try {
      const result = await callBridge("/mcp/restart", { method: "POST", body: { resource: resourceName } });
      return textResult(`restart ok: ${JSON.stringify(result)}`);
    } catch (err) {
      return textResult(`restart failed: ${(err as Error).message}`);
    }
  }
);

server.registerTool(
  "read_resource_logs",
  {
    title: "Read resource logs",
    description:
      "Tail the FXServer dev bridge's captured logs for this resource, or another named resource that has dev_bridge_logger.lua installed.",
    inputSchema: {
      lines: z.number().int().min(1).max(200).optional(),
      level: z.enum(["error", "warn", "info"]).optional(),
      resource: z.string().optional(),
    },
  },
  async ({ lines, level, resource }) => {
    const targetResource = resource || cfg.resourceName || ctx.resourceName;
    const query = new URLSearchParams({
      resource: targetResource,
      lines: String(lines || 20),
      ...(level ? { level } : {}),
    });

    try {
      const result = await callBridge(`/mcp/logs?${query.toString()}`);
      const entries = (result.lines || []) as Array<{ level: string; message: string }>;
      const formatted = entries.map((entry) => `[${entry.level}] ${entry.message}`).join("\n") || "(no matching log lines)";
      return textResult(truncate(formatted));
    } catch (err) {
      return textResult(`could not read logs: ${(err as Error).message}`);
    }
  }
);

// Only registered when .mcp-config.json declares a database — a resource
// with no schema file configured never sees this tool at all, rather than
// seeing it and getting a "not configured" message back.
if (hasDatabase) {
  server.registerTool(
    "inspect_db_schema",
    {
      title: "Inspect database schema",
      description:
        "Reads the schema file declared in .mcp-config.json's database.schemaFile. Does not connect to a live database and does not assume oxmysql or any provider — point database.schemaFile at your resource's own .sql schema/migration file.",
      inputSchema: {},
    },
    async () => {
      if (!cfg.database?.schemaFile) {
        return textResult("database.driver is set but database.schemaFile is missing in .mcp-config.json.");
      }

      const schemaPath = resolve(process.cwd(), cfg.database.schemaFile);
      if (!existsSync(schemaPath)) {
        return textResult(`configured schema file not found: ${schemaPath}`);
      }

      return textResult(truncate(readFileSync(schemaPath, "utf8"), 80, 6000));
    }
  );
}

// Only registered for a resource that actually has a UI: resourceType
// detected a package.json with svelte/react in ui/, or .mcp-config.json
// explicitly set nui.enabled. A pure-Lua resource never sees this tool.
if (hasNui) {
  server.registerTool(
    "run_nui_automation",
    {
      title: "Run NUI browser automation",
      description:
        "Drives the NUI dev URL with Playwright (a short click/fill action script), reports console errors and a screenshot path. Requires `npm i -D playwright && npx playwright install chromium` in this workspace — not installed by default.",
      inputSchema: {
        actions: z
          .array(
            z.object({
              type: z.enum(["click", "fill", "waitFor"]),
              selector: z.string(),
              value: z.string().optional(),
            })
          )
          .optional(),
        url: z.string().optional(),
      },
    },
    async ({ actions, url }) => {
      const targetUrl = url || cfg.nui?.devUrl;
      if (!targetUrl) {
        return textResult("no NUI dev URL; pass `url` or set nui.devUrl in .mcp-config.json.");
      }

      let playwright: any;
      try {
        playwright = await import("playwright");
      } catch {
        return textResult(
          "playwright is not installed in this workspace. Run `npm i -D playwright && npx playwright install chromium` to enable this tool."
        );
      }

      const browser = await playwright.chromium.launch();
      const page = await browser.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (msg: any) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err: Error) => consoleErrors.push(err.message));

      try {
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 10000 });

        for (const action of actions || []) {
          if (action.type === "click") await page.click(action.selector, { timeout: 5000 });
          else if (action.type === "fill") await page.fill(action.selector, action.value || "", { timeout: 5000 });
          else if (action.type === "waitFor") await page.waitForSelector(action.selector, { timeout: 5000 });
        }

        const screenshotPath = join(mkdtempSync(join(tmpdir(), "mcp-nui-")), "screenshot.png");
        await page.screenshot({ path: screenshotPath });

        return textResult(
          JSON.stringify(
            { ok: consoleErrors.length === 0, consoleErrors: consoleErrors.slice(0, 20), screenshotPath },
            null,
            2
          )
        );
      } catch (err) {
        return textResult(`nui automation failed: ${(err as Error).message}`);
      } finally {
        await browser.close();
      }
    }
  );
}

server.registerTool(
  "run_in_game_test",
  {
    title: "Run in-game test scenario",
    description:
      "Runs a short sequence of whitelisted agent actions (teleport/trigger_event/give_item) through the dev bridge against a connected test player, then checks this resource's recent logs for new error lines. Reports PASS/FAIL with evidence.",
    inputSchema: {
      serverId: z.union([z.string(), z.number()]),
      scenario: z
        .array(z.object({ action: z.enum(["teleport", "trigger_event", "give_item"]) }).passthrough())
        .min(1),
      resource: z.string().optional(),
    },
  },
  async ({ serverId, scenario, resource }) => {
    const targetResource = resource || cfg.resourceName || ctx.resourceName;

    const beforeQuery = new URLSearchParams({ resource: targetResource, lines: "50", level: "error" });
    const before = await callBridge(`/mcp/logs?${beforeQuery.toString()}`).catch(() => ({ lines: [] }));
    const beforeCount = (before.lines || []).length;

    const steps: Array<{ action: string; ok: boolean; message: string }> = [];
    for (const step of scenario) {
      try {
        const result = await callBridge("/mcp/agent/action", { method: "POST", body: { serverId, ...step } });
        steps.push({ action: step.action, ok: Boolean(result.ok), message: String(result.message) });
      } catch (err) {
        steps.push({ action: step.action, ok: false, message: (err as Error).message });
      }
    }

    await new Promise((r) => setTimeout(r, 1500));

    const afterQuery = new URLSearchParams({ resource: targetResource, lines: "50", level: "error" });
    const after = await callBridge(`/mcp/logs?${afterQuery.toString()}`).catch(() => ({ lines: [] }));
    const newErrors = (after.lines || []).slice(beforeCount);

    const pass = steps.every((step) => step.ok) && newErrors.length === 0;
    return textResult(JSON.stringify({ verdict: pass ? "PASS" : "FAIL", steps, newErrorLogLines: newErrors }, null, 2));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
