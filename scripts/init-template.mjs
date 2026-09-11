import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');

const frameworkValues = new Set(['standalone', 'esx', 'qbcore', 'qbox', 'custom']);
const databaseValues = new Set(['none', 'oxmysql', 'custom']);

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
    if (key === 'yes' || key === 'help') {
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
  console.log(`Initialize resource metadata and confirmed environment choices.

Usage:
  npm run init
  npm run init -- --name my_resource --author "Your Name"

Options:
  --name <value>             FiveM resource directory name
  --author <value>           Resource author
  --description <value>      Resource description
  --version <semver>         Initial resource version (default: 0.1.0)
  --framework <value>        standalone, esx, qbcore, qbox, or custom
  --database <value>         none, oxmysql, or custom
  --shared-library <value>   none, ox_lib, or a custom provider name
  --yes                      Accept defaults for omitted values
  --help                     Show this help

The initializer updates repository files only. It never stores credentials.`);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function ensureResourceName(value) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
    throw new Error('Resource name must use lowercase letters, numbers, underscores, or hyphens and start with a letter or number.');
  }
  return normalized;
}

function ensureSemver(value) {
  const normalized = value.trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
    throw new Error('Version must be a semantic version such as 0.1.0 or 1.0.0-beta.1.');
  }
  return normalized;
}

function ensureChoice(label, value, allowed) {
  const normalized = value.trim().toLowerCase();
  if (!allowed.has(normalized)) {
    throw new Error(`${label} must be one of: ${[...allowed].join(', ')}`);
  }
  return normalized;
}

function luaString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function replaceManifestLine(content, key, value) {
  const expression = new RegExp(`^${key}\\s+['"].*['"]\\s*$`, 'm');
  if (!expression.test(content)) throw new Error(`resource/fxmanifest.lua is missing ${key} metadata.`);
  return content.replace(expression, `${key} '${luaString(value)}'`);
}

function replaceEnvironmentRow(content, setting, value, notes) {
  const expression = new RegExp(`^\\| ${setting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\|.*$`, 'm');
  if (!expression.test(content)) throw new Error(`Environment profile is missing the ${setting} row.`);
  return content.replace(expression, `| ${setting} | ${value} | confirmed | ${notes} |`);
}

async function ask(terminal, label, defaultValue, acceptDefaults) {
  if (acceptDefaults) return defaultValue;
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = (await terminal.question(`${label}${suffix}: `)).trim();
  return answer || defaultValue;
}

const argumentsMap = parseArguments(process.argv.slice(2));
if (argumentsMap.help) {
  printHelp();
  process.exit(0);
}

const resourceMetadata = readJson('resource.json');
const defaultName = path.basename(root)
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'my_resource';

const interactive = !argumentsMap.yes;
if (interactive && (!process.stdin.isTTY || !process.stdout.isTTY)) {
  throw new Error('Interactive initialization requires a terminal. Pass explicit options with --yes for automation.');
}

const terminal = interactive
  ? readline.createInterface({ input: process.stdin, output: process.stdout })
  : null;

try {
  const name = ensureResourceName(argumentsMap.name ?? await ask(terminal, 'Resource name', defaultName, !interactive));
  const author = (argumentsMap.author ?? await ask(terminal, 'Author', resourceMetadata.author || 'Your Name', !interactive)).trim();
  const description = (argumentsMap.description ?? await ask(
    terminal,
    'Description',
    'A maintainable FiveM resource',
    !interactive,
  )).trim();
  const version = ensureSemver(argumentsMap.version ?? await ask(terminal, 'Version', '0.1.0', !interactive));
  const framework = ensureChoice(
    'Framework',
    argumentsMap.framework ?? await ask(terminal, 'Framework', 'standalone', !interactive),
    frameworkValues,
  );
  const database = ensureChoice(
    'Database',
    argumentsMap.database ?? await ask(terminal, 'Database', 'none', !interactive),
    databaseValues,
  );
  const sharedLibrary = (
    argumentsMap['shared-library'] ?? await ask(terminal, 'Shared library', 'none', !interactive)
  ).trim().toLowerCase();

  if (!author) throw new Error('Author must not be empty.');
  if (!description) throw new Error('Description must not be empty.');
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(sharedLibrary)) {
    throw new Error('Shared library must be "none" or a lowercase provider identifier.');
  }

  resourceMetadata.name = name;
  resourceMetadata.author = author;
  resourceMetadata.version = version;
  resourceMetadata.framework.mode = framework;
  resourceMetadata.database.required = database !== 'none';
  resourceMetadata.database.provider = database === 'none' ? null : database;
  writeJson('resource.json', resourceMetadata);

  const manifestPath = path.join(root, 'resource/fxmanifest.lua');
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = replaceManifestLine(manifest, 'author', author);
  manifest = replaceManifestLine(manifest, 'version', version);
  manifest = replaceManifestLine(manifest, 'description', description);
  fs.writeFileSync(manifestPath, manifest);

  const uiPackage = readJson('resource/ui/package.json');
  uiPackage.name = `${name}-ui`;
  uiPackage.version = version;
  writeJson('resource/ui/package.json', uiPackage);

  const lockPath = path.join(root, 'resource/ui/package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = readJson('resource/ui/package-lock.json');
    lock.name = uiPackage.name;
    lock.version = version;
    if (lock.packages?.['']) {
      lock.packages[''].name = uiPackage.name;
      lock.packages[''].version = version;
    }
    writeJson('resource/ui/package-lock.json', lock);
  }

  const environmentPath = path.join(root, '.ai/memory/environment.md');
  let environment = fs.readFileSync(environmentPath, 'utf8');
  environment = environment.replace(/^Status:.*$/m, 'Status: Configured');
  environment = environment.replace(/^Last updated:.*$/m, `Last updated: ${new Date().toISOString().slice(0, 10)}`);
  environment = replaceEnvironmentRow(environment, 'Framework', framework, 'Confirmed by template initializer');
  environment = replaceEnvironmentRow(
    environment,
    'Database driver',
    database,
    database === 'none' ? 'No database selected' : 'Confirmed by template initializer',
  );
  environment = replaceEnvironmentRow(
    environment,
    'Shared library',
    sharedLibrary,
    sharedLibrary === 'none' ? 'No shared library selected' : 'Confirmed by template initializer',
  );
  fs.writeFileSync(environmentPath, environment);

  console.log('\nTemplate initialization complete.');
  console.log(`Resource: ${name}`);
  console.log(`Framework: ${framework}`);
  console.log(`Database: ${database}`);
  console.log(`Shared library: ${sharedLibrary}`);
  console.log('\nNext: install UI dependencies, run npm run validate, and review .ai/memory/environment.md.');
  console.log(
    '\nresource/client/main.lua and resource/server/main.lua are a working bootstrap (Init flow, '
    + 'NUI ready handshake, Debug/ENUM helpers), not throwaway sample code — build your own resource on '
    + 'top of it. Add feature modules under resource/client/modules/, resource/server/modules/, and shared '
    + 'utilities under resource/shared/lib/ (see docs/module-loading.md), then declare each new file in '
    + 'resource/fxmanifest.lua the same way the existing bootstrap files are declared.',
  );
} finally {
  terminal?.close();
}
