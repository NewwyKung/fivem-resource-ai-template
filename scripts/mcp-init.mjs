import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const bridgePackDir = path.join(repoRoot, 'examples', 'capabilities', 'mcp-dev-bridge');

const DEFAULT_BRIDGE_RESOURCE_NAME = 'mcp_dev_bridge';
const DEFAULT_TEST_RESOURCE_NAME = 'mcp_test_resource';

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);

    const separator = argument.indexOf('=');
    if (separator !== -1) {
      values[argument.slice(2, separator)] = argument.slice(separator + 1);
      continue;
    }

    const key = argument.slice(2);
    if (key === 'help' || key === 'check-only' || key === 'confirm' || key === 'create-test-resource') {
      values[key] = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for --${key}`);
    values[key] = next;
    index += 1;
  }
  return values;
}

function printHelp() {
  console.log(`Check and/or install the MCP dev bridge against a specific FXServer.

Two-step by design: run --check-only first (always safe, read-only) to see
exactly what's already installed vs missing, decide (or ask the user) if
this is safe to touch, then re-run with --confirm to apply only what's
missing. Never restarts or sends any live console command itself, and never
touches an existing target resource's fxmanifest.lua (formats vary too much
to safely auto-patch) -- it prints the exact manual step instead.

Usage:
  node scripts/mcp-init.mjs --resources-path "<path>" --server-cfg "<path>" --check-only
  node scripts/mcp-init.mjs --resources-path "<path>" --server-cfg "<path>" --create-test-resource --confirm
  node scripts/mcp-init.mjs --resources-path "<path>" --server-cfg "<path>" --target-resource my_resource --confirm

Options:
  --resources-path <path>     FXServer resources/ folder (required)
  --server-cfg <path>         server.cfg path (required)
  --bridge-resource <name>    Bridge resource folder name (default: ${DEFAULT_BRIDGE_RESOURCE_NAME})
  --target-resource <name>    Existing resource to wire dev_bridge_logger.lua into
  --create-test-resource      Create an isolated ${DEFAULT_TEST_RESOURCE_NAME} instead of using --target-resource
  --check-only                Report status only; changes nothing
  --confirm                   Actually write files/server.cfg (required to apply; default is a no-op report)
  --help                      Show this help`);
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function detectPort(cfgContent) {
  const match = cfgContent.match(/endpoint_add_tcp\s+"[^:"]*:(\d+)"/);
  return match ? Number(match[1]) : 30120;
}

function detectToken(cfgContent) {
  const match = cfgContent.match(/set\s+mcp_token\s+"([^"]+)"/);
  return match ? match[1] : null;
}

// FXServer resources are commonly organized in category subfolders (e.g.
// resources/[servertest]/my_resource), not always directly under
// resources/. A resource is identified by folder name + owning an
// fxmanifest.lua, wherever it actually lives, so this searches a few
// levels deep instead of assuming a flat layout.
function findResourceDir(resourcesPath, resourceName, maxDepth = 4) {
  const queue = [{ dir: resourcesPath, depth: 0 }];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === resourceName && fs.existsSync(path.join(full, 'fxmanifest.lua'))) {
        return full;
      }
      if (depth < maxDepth) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

function checkStatus({ resourcesPath, serverCfgPath, bridgeResourceName, targetResourceName }) {
  const cfgContent = readIfExists(serverCfgPath) ?? '';
  const bridgeDir = findResourceDir(resourcesPath, bridgeResourceName);
  const targetDir = targetResourceName ? findResourceDir(resourcesPath, targetResourceName) : null;
  const loggerPath = targetDir ? path.join(targetDir, 'server', 'dev_bridge_logger.lua') : null;

  return {
    serverCfgExists: fs.existsSync(serverCfgPath),
    resourcesPathExists: fs.existsSync(resourcesPath),
    port: detectPort(cfgContent),
    existingToken: detectToken(cfgContent),
    bridgeResourceInstalled: bridgeDir !== null,
    bridgeResourceDir: bridgeDir,
    targetResourceExists: targetDir !== null,
    targetResourceDir: targetDir,
    loggerInstalled: loggerPath ? fs.existsSync(loggerPath) : false,
    cfgHasEnsureBridge: new RegExp(`^\\s*ensure\\s+${bridgeResourceName}\\s*$`, 'm').test(cfgContent),
    cfgHasEnsureTarget: targetResourceName
      ? new RegExp(`^\\s*ensure\\s+${targetResourceName}\\s*$`, 'm').test(cfgContent)
      : false,
    cfgHasDevMode: /setr\s+mcp_dev_mode\s+true/.test(cfgContent),
    cfgHasToken: /set\s+mcp_token\s+"/.test(cfgContent),
    cfgHasAllowRemoteFalse: /setr\s+mcp_bridge_allow_remote\s+false/.test(cfgContent),
    cfgHasAceRestart: new RegExp(`add_ace\\s+resource\\.${bridgeResourceName}\\s+command\\.restart\\s+allow`).test(
      cfgContent
    ),
    cfgHasAceStart: new RegExp(`add_ace\\s+resource\\.${bridgeResourceName}\\s+command\\.start\\s+allow`).test(
      cfgContent
    ),
    cfgHasAceStop: new RegExp(`add_ace\\s+resource\\.${bridgeResourceName}\\s+command\\.stop\\s+allow`).test(
      cfgContent
    ),
  };
}

function printStatus(status, { bridgeResourceName, targetResourceName }) {
  const line = (ok, label) => console.log(`  [${ok ? 'x' : ' '}] ${label}`);
  console.log('[mcp-init] status:');
  line(status.bridgeResourceInstalled, `${bridgeResourceName}/ copied into resources/`);
  if (targetResourceName) {
    line(status.targetResourceExists, `resources/${targetResourceName}/ exists`);
    line(status.loggerInstalled, `dev_bridge_logger.lua present in resources/${targetResourceName}/server/`);
  }
  line(status.cfgHasEnsureBridge, `server.cfg: ensure ${bridgeResourceName}`);
  if (targetResourceName) line(status.cfgHasEnsureTarget, `server.cfg: ensure ${targetResourceName}`);
  line(status.cfgHasDevMode, 'server.cfg: setr mcp_dev_mode true');
  line(status.cfgHasToken, `server.cfg: mcp_token set${status.existingToken ? ' (reusing existing value)' : ''}`);
  line(status.cfgHasAllowRemoteFalse, 'server.cfg: setr mcp_bridge_allow_remote false');
  line(status.cfgHasAceRestart, `server.cfg: add_ace resource.${bridgeResourceName} command.restart allow`);
  line(status.cfgHasAceStart, `server.cfg: add_ace resource.${bridgeResourceName} command.start allow`);
  line(status.cfgHasAceStop, `server.cfg: add_ace resource.${bridgeResourceName} command.stop allow`);
  console.log(`  detected HTTP port: ${status.port} (from endpoint_add_tcp, defaults to 30120 if not found)`);
}

function copyRecursive(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyRecursive(sourcePath, destPath);
    else fs.copyFileSync(sourcePath, destPath);
  }
}

const TEST_RESOURCE_MAIN_LUA = `local resourceName = GetCurrentResourceName()

print(('[%s] ready for MCP dev-bridge testing.'):format(resourceName))

-- give_item hook contract: <resource>:mcp:giveItem(serverId, item, count)
RegisterNetEvent(('%s:mcp:giveItem'):format(resourceName), function(serverId, item, count)
    print(('[%s] mcp:giveItem serverId=%s item=%s count=%s'):format(resourceName, tostring(serverId), tostring(item), tostring(count)))
end)

-- Target for the trigger_event agent action, e.g.
-- { action = "trigger_event", event = "mcp_test:ping" }
RegisterNetEvent('mcp_test:ping', function()
    print(('[%s] received mcp_test:ping (trigger_event action test)'):format(resourceName))
end)

RegisterNetEvent('mcp_test:simulateError', function(reason)
    print(('[%s] ERROR: simulated error for log testing (%s)'):format(resourceName, tostring(reason or 'no reason given')))
end)

RegisterNetEvent('mcp_test:simulateWarn', function()
    print(('[%s] WARNING: simulated warning for log-level filter testing'):format(resourceName))
end)
`;

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args['resources-path'] || !args['server-cfg']) {
    console.error('[mcp-init] --resources-path and --server-cfg are required. See --help.');
    process.exit(1);
  }

  const resourcesPath = path.resolve(args['resources-path']);
  const serverCfgPath = path.resolve(args['server-cfg']);
  const bridgeResourceName = args['bridge-resource'] || DEFAULT_BRIDGE_RESOURCE_NAME;
  const targetResourceName = args['create-test-resource']
    ? DEFAULT_TEST_RESOURCE_NAME
    : args['target-resource'] || null;

  if (!fs.existsSync(resourcesPath)) {
    console.error(`[mcp-init] resources path not found: ${resourcesPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(serverCfgPath)) {
    console.error(`[mcp-init] server.cfg not found: ${serverCfgPath}`);
    process.exit(1);
  }

  const status = checkStatus({ resourcesPath, serverCfgPath, bridgeResourceName, targetResourceName });
  printStatus(status, { bridgeResourceName, targetResourceName });

  if (args['check-only']) return;

  if (targetResourceName && !args['create-test-resource'] && !status.targetResourceExists) {
    console.error(
      `[mcp-init] --target-resource ${targetResourceName} was not found anywhere under ${resourcesPath}.` +
        ` Check the name, or use --create-test-resource instead.`
    );
    process.exit(1);
  }

  if (!args.confirm) {
    console.log('\n[mcp-init] dry run only (pass --confirm to apply the missing pieces above).');
    return;
  }

  if (!status.bridgeResourceInstalled) {
    const bridgeDest = path.join(resourcesPath, bridgeResourceName);
    copyRecursive(path.join(bridgePackDir, 'mcp_dev_bridge'), bridgeDest);
    console.log(`[mcp-init] copied ${bridgeResourceName}/ into ${resourcesPath}`);
  } else {
    console.log(`[mcp-init] ${bridgeResourceName}/ already present at ${status.bridgeResourceDir}, leaving as-is`);
  }

  if (targetResourceName && args['create-test-resource'] && !status.targetResourceExists) {
    const testDest = path.join(resourcesPath, targetResourceName);
    fs.mkdirSync(path.join(testDest, 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(testDest, 'fxmanifest.lua'),
      `fx_version 'cerulean'\ngame 'gta5'\n\nauthor 'fivem-resource-ai-template'\ndescription 'Isolated resource for exercising the MCP dev bridge tools end to end. Safe to remove after testing.'\nversion '0.1.0'\n\nserver_scripts {\n    'server/dev_bridge_logger.lua',\n    'server/main.lua',\n}\n`
    );
    fs.copyFileSync(path.join(bridgePackDir, 'dev_bridge_logger.lua'), path.join(testDest, 'server', 'dev_bridge_logger.lua'));
    fs.writeFileSync(path.join(testDest, 'server', 'main.lua'), TEST_RESOURCE_MAIN_LUA);
    console.log(`[mcp-init] created isolated test resource at ${testDest}`);
  } else if (targetResourceName && !args['create-test-resource'] && status.targetResourceExists && !status.loggerInstalled) {
    const targetServerDir = path.join(status.targetResourceDir, 'server');
    fs.mkdirSync(targetServerDir, { recursive: true });
    fs.copyFileSync(path.join(bridgePackDir, 'dev_bridge_logger.lua'), path.join(targetServerDir, 'dev_bridge_logger.lua'));
    console.log(
      `[mcp-init] copied dev_bridge_logger.lua into ${targetServerDir}\n` +
        `[mcp-init] MANUAL STEP REQUIRED: add 'server/dev_bridge_logger.lua' as the FIRST entry in\n` +
        `           ${targetResourceName}'s fxmanifest.lua server_scripts list. This tool will not edit an\n` +
        `           existing resource's manifest -- formats vary too much to do that safely.`
    );
  }

  const token = status.existingToken || crypto.randomBytes(32).toString('hex');
  const cfgAdditions = [];
  if (!status.cfgHasAceRestart) cfgAdditions.push(`add_ace resource.${bridgeResourceName} command.restart allow`);
  if (!status.cfgHasAceStart) cfgAdditions.push(`add_ace resource.${bridgeResourceName} command.start allow`);
  if (!status.cfgHasAceStop) cfgAdditions.push(`add_ace resource.${bridgeResourceName} command.stop allow`);
  if (!status.cfgHasEnsureBridge) cfgAdditions.push(`ensure ${bridgeResourceName}`);
  if (targetResourceName && !status.cfgHasEnsureTarget) cfgAdditions.push(`ensure ${targetResourceName}`);
  if (!status.cfgHasDevMode) cfgAdditions.push('setr mcp_dev_mode true');
  if (!status.cfgHasToken) cfgAdditions.push(`set mcp_token "${token}"`);
  if (!status.cfgHasAllowRemoteFalse) cfgAdditions.push('setr mcp_bridge_allow_remote false');

  if (cfgAdditions.length > 0) {
    const block =
      `\n#------------------------------------------------------------------------------------\n` +
      `### MCP Dev Bridge (added by mcp-init.mjs -- local dev tooling, not part of gameplay)\n` +
      `### Safe to remove: delete this block + resources/${bridgeResourceName}` +
      (targetResourceName && args['create-test-resource'] ? ` + resources/${targetResourceName}` : '') +
      `.\n${cfgAdditions.join('\n')}\n`;
    fs.appendFileSync(serverCfgPath, block);
    console.log(`[mcp-init] appended ${cfgAdditions.length} missing line(s) to ${serverCfgPath}`);
  }

  fs.writeFileSync(path.join(repoRoot, '.mcp-config.json'), `${JSON.stringify({ resourceName: targetResourceName || undefined }, null, 2)}\n`);
  fs.writeFileSync(
    path.join(repoRoot, '.cursor', 'mcp.json'),
    `${JSON.stringify(
      {
        mcpServers: {
          'fivem-auto-dev': {
            command: 'npx',
            args: ['-y', 'tsx', './scripts/mcp-server.ts'],
            env: { FXSERVER_URL: `http://127.0.0.1:${status.port}`, FXSERVER_API_KEY: token },
          },
        },
      },
      null,
      2
    )}\n`
  );
  console.log('[mcp-init] wrote local .mcp-config.json and .cursor/mcp.json (both gitignored).');

  console.log(
    `\n[mcp-init] If the server is already running, apply the new lines live -- one command per` +
      ` console line, never combined:\n${cfgAdditions.map((line) => `  ${line}`).join('\n')}` +
      (cfgAdditions.length > 0 ? '\n  refresh' : '') +
      `\nOtherwise these are already in server.cfg for the next natural restart.`
  );
}

main();
