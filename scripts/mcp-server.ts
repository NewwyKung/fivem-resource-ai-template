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
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  loadContext,
  loadMcpConfig,
  truncate,
  textResult,
  callBridge,
  buildAndRestart,
  FXSERVER_URL,
  FXSERVER_API_KEY,
} from "./lib/mcp-shared.js";

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
            "watch_resource_logs",
            "clear_resource_logs",
            "get_resource_state",
            "list_players",
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
    title: "Build, lint, type-check, and restart",
    description:
      "Builds the NUI (if present) and runs tsc --noEmit, runs a LuaLS error-level check over the resource (skipped gracefully if LuaLS isn't installed), and only if everything passes sends /mcp/restart to the FXServer dev bridge. Aborts before contacting the server on any build, type, or Lua error.",
    inputSchema: {},
  },
  async () => {
    const result = await buildAndRestart(ctx, cfg);
    return textResult(result.summary);
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

server.registerTool(
  "watch_resource_logs",
  {
    title: "Watch resource logs for new errors",
    description:
      "Long-polls the FXServer dev bridge for new log lines past a cursor, instead of you polling read_resource_logs in a loop. " +
      "Call once with no `since` to get a starting cursor (`lastSeq`), then call again passing that value as `since` to actually " +
      "wait (up to `timeoutMs`, capped at 6000ms server-side) for a matching new line. Repeats of the same message are " +
      "collapsed server-side into one entry with a repeatCount. Loop this call (reusing the returned `lastSeq` as the next " +
      "`since`) for continuous monitoring across multiple calls.",
    inputSchema: {
      resource: z.string().optional(),
      level: z.enum(["error", "warn", "info"]).optional(),
      since: z.number().int().optional(),
      timeoutMs: z.number().int().min(0).max(6000).optional(),
    },
  },
  async ({ resource, level, since, timeoutMs }) => {
    const targetResource = resource || cfg.resourceName || ctx.resourceName;
    const query = new URLSearchParams({
      resource: targetResource,
      level: level || "error",
      ...(since !== undefined ? { since: String(since) } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs: String(timeoutMs) } : {}),
    });

    try {
      const result = await callBridge(`/mcp/logs/watch?${query.toString()}`, { timeoutMs: 7000 });
      const entries = (result.entries || []) as Array<{ level: string; message: string; repeatCount?: number }>;
      if (entries.length === 0) {
        return textResult(
          JSON.stringify({ resource: targetResource, lastSeq: result.lastSeq, timedOut: Boolean(result.timedOut), entries: [] })
        );
      }
      const formatted = entries
        .map((entry) => `[${entry.level}] ${entry.message}${entry.repeatCount ? ` (repeated ${entry.repeatCount}x)` : ""}`)
        .join("\n");
      return textResult(truncate(`lastSeq=${result.lastSeq}\n${formatted}`));
    } catch (err) {
      return textResult(`could not watch logs: ${(err as Error).message}`);
    }
  }
);

server.registerTool(
  "clear_resource_logs",
  {
    title: "Clear resource logs",
    description:
      "Clears the FXServer dev bridge's captured log ring buffer for this resource (or another named resource with " +
      "dev_bridge_logger.lua installed). Use it to get a clean baseline before a test run instead of scrolling past old lines.",
    inputSchema: {
      resource: z.string().optional(),
    },
  },
  async ({ resource }) => {
    const targetResource = resource || cfg.resourceName || ctx.resourceName;
    try {
      await callBridge("/mcp/logs/clear", { method: "POST", body: { resource: targetResource } });
      return textResult(`cleared logs for ${targetResource}`);
    } catch (err) {
      return textResult(`could not clear logs: ${(err as Error).message}`);
    }
  }
);

server.registerTool(
  "get_resource_state",
  {
    title: "Get resource state",
    description:
      "Reads the actual FXServer resource state (started/stopped/starting/...) via GetResourceState through the dev bridge. " +
      "Call this after auto_build_and_restart to confirm the resource is actually running rather than trusting that the " +
      "restart request was merely accepted.",
    inputSchema: {
      resource: z.string().optional(),
    },
  },
  async ({ resource }) => {
    const targetResource = resource || cfg.resourceName || ctx.resourceName;
    try {
      const result = await callBridge(`/mcp/resource/state?${new URLSearchParams({ resource: targetResource }).toString()}`);
      return textResult(`${targetResource}: ${result.state}`);
    } catch (err) {
      return textResult(`could not read resource state: ${(err as Error).message}`);
    }
  }
);

server.registerTool(
  "list_players",
  {
    title: "List connected players",
    description:
      "Lists players currently connected to the FXServer (serverId, name, coords) via the dev bridge. Use this to find a serverId before calling run_in_game_test or triggering an agent action against a real test player.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await callBridge("/mcp/players");
      const players = (result.players || []) as Array<{ serverId: string; name: string }>;
      if (players.length === 0) {
        return textResult("no players connected");
      }
      return textResult(truncate(JSON.stringify(players, null, 2), 80, 4000));
    } catch (err) {
      return textResult(`could not list players: ${(err as Error).message}`);
    }
  }
);

if (hasDatabase) {
  server.registerTool(
    "inspect_db_schema",
    {
      title: "Inspect database schema",
      description:
        "For database.driver \"oxmysql\": queries live table/column names via the dev bridge's read-only SHOW TABLES/DESCRIBE endpoint (never a write, never a caller-supplied query). Otherwise reads the local .sql file at database.schemaFile. Never assumes a provider beyond what .mcp-config.json declares.",
      inputSchema: {},
    },
    async () => {
      if (cfg.database?.driver === "oxmysql") {
        try {
          const result = await callBridge("/mcp/db/schema");
          const tables = (result.tables || []) as Array<{ table: string; columns?: Array<{ Field: string; Type: string }> }>;
          if (tables.length === 0) return textResult("(no tables)");
          const formatted = tables
            .map((t) => `${t.table}: ${(t.columns || []).map((c) => `${c.Field} ${c.Type}`).join(", ")}`)
            .join("\n");
          return textResult(truncate(formatted, 80, 6000));
        } catch (err) {
          return textResult(`could not query live schema: ${(err as Error).message}`);
        }
      }

      if (!cfg.database?.schemaFile) {
        return textResult(
          "database.driver is not \"oxmysql\" and database.schemaFile is missing in .mcp-config.json; nothing to inspect."
        );
      }

      const schemaPath = resolve(process.cwd(), cfg.database.schemaFile);
      if (!existsSync(schemaPath)) {
        return textResult(`configured schema file not found: ${schemaPath}`);
      }

      return textResult(truncate(readFileSync(schemaPath, "utf8"), 80, 6000));
    }
  );
}

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
