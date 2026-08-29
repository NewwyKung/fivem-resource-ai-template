import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) { args.set(key, next); i += 1; }
  else args.set(key, true);
}

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const metadata = readJson('resource.json');
const policy = readJson('release.config.json');
const resourceName = String(args.get('--name') || metadata.name || 'resource').trim().replace(/[^A-Za-z0-9_-]+/g, '-');
const resourceRoot = path.join(root, policy.sourceDirectory || 'resource');
const outputRoot = path.join(root, policy.outputDirectory || 'release');
const uiSource = path.join(root, metadata.ui?.source || 'resource/ui');
const uiOutput = path.join(root, metadata.ui?.output || 'resource/html');
const skipUiBuild = args.has('--skip-ui-build');
const dryRun = args.has('--dry-run');
const skipValidation = args.has('--skip-validation');

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value || ''));
  if (!match) throw new Error(`Invalid semantic version: ${value}`);
  return match.slice(1).map(Number);
}
const formatVersion = (parts) => parts.join('.');
function bumpVersion([major, minor, patch], type) {
  if (type === 'major') return [major + 1, 0, 0];
  if (type === 'minor') return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}
function resolveVersion() {
  if (args.get('--version')) return formatVersion(parseVersion(args.get('--version')));
  const current = parseVersion(metadata.version || '1.0.0');
  const released = fs.existsSync(outputRoot)
    ? fs.readdirSync(outputRoot)
      .filter((name) => name.startsWith(`${resourceName}-`))
      .map((name) => { try { return parseVersion(name.slice(resourceName.length + 1)); } catch { return null; } })
      .filter(Boolean)
    : [];
  if (!released.length) return formatVersion(current);
  const highest = released.reduce((max, item) => {
    for (let i = 0; i < 3; i += 1) {
      if (item[i] !== max[i]) return item[i] > max[i] ? item : max;
    }
    return max;
  }, current);
  return formatVersion(bumpVersion(highest, args.get('--bump') || 'patch'));
}

function findHighestReleaseFolder() {
  if (!fs.existsSync(outputRoot)) return null;
  const entries = fs.readdirSync(outputRoot)
    .filter((name) => name.startsWith(`${resourceName}-`))
    .map((name) => { try { return { name, version: parseVersion(name.slice(resourceName.length + 1)) }; } catch { return null; } })
    .filter(Boolean);
  if (!entries.length) return null;
  return entries.reduce((max, item) => {
    for (let i = 0; i < 3; i += 1) {
      if (item.version[i] !== max.version[i]) return item.version[i] > max.version[i] ? item : max;
    }
    return max;
  });
}

const version = resolveVersion();
const previousRelease = findHighestReleaseFolder();
const releaseName = `${resourceName}-${version}`;
const destination = path.join(outputRoot, releaseName);
const stagingDestination = path.join(outputRoot, `.${releaseName}.tmp-${process.pid}-${Date.now()}`);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} failed.`);
}
function wildcard(pattern) {
  const normalized = pattern.replaceAll('\\', '/');
  let source = '^';

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        index += 1;
        if (normalized[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  return new RegExp(`${source}$`);
}
function excluded(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  return (policy.exclude || []).some((pattern) => wildcard(pattern).test(normalized));
}
function copyEntry(source, target, relativePath) {
  if (excluded(relativePath)) return;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const child of fs.readdirSync(source)) copyEntry(path.join(source, child), path.join(target, child), path.join(relativePath, child));
    if (fs.existsSync(target) && fs.readdirSync(target).length === 0) fs.rmSync(target, { recursive: true, force: true });
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}
function walk(directory, callback) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, callback); else callback(full);
  }
}
function patchManifest(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/^\s*--\s*ui_page\s+['"]html\/index\.html['"]\s*$/m, "ui_page 'html/index.html'");
  content = content.replace(/^\s*ui_page\s+['"]https?:\/\/localhost:[^'"]+['"]\s*$/gm, '');
  content = content.replace(/^version\s+['"][^'"]+['"]$/m, `version '${version}'`);
  if (!/^\s*ui_page\s+['"]html\/index\.html['"]\s*$/m.test(content) && fs.existsSync(path.join(stagingDestination, 'html/index.html'))) content += "\nui_page 'html/index.html'\n";
  fs.writeFileSync(file, content.replace(/\n{3,}/g, '\n\n'));
}
function setJsonPath(target, jsonPath, replacement) {
  const parts = jsonPath.split('.').filter(Boolean);
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!current || typeof current !== 'object' || !(parts[i] in current)) return false;
    current = current[parts[i]];
  }
  const key = parts.at(-1);
  if (!current || typeof current !== 'object' || !(key in current)) return false;
  current[key] = replacement ?? null;
  return true;
}
function applyExplicitSanitizers(changes) {
  for (const rule of policy.jsonSecretPaths || []) {
    const file = path.join(stagingDestination, rule.file);
    if (!fs.existsSync(file)) throw new Error(`Configured secret JSON file is missing: ${rule.file}`);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!setJsonPath(parsed, rule.path, rule.replacement)) throw new Error(`Configured JSON secret path was not found: ${rule.file}:${rule.path}`);
    fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`);
    changes.push(`${rule.file}:${rule.path}`);
  }
  for (const rule of policy.textSanitizers || []) {
    const file = path.join(stagingDestination, rule.file);
    if (!fs.existsSync(file)) throw new Error(`Configured sanitizer file is missing: ${rule.file}`);
    const regex = new RegExp(rule.pattern, rule.flags || 'gm');
    const content = fs.readFileSync(file, 'utf8');
    if (!regex.test(content)) throw new Error(`Configured sanitizer pattern did not match: ${rule.file}`);
    fs.writeFileSync(file, content.replace(new RegExp(rule.pattern, rule.flags || 'gm'), rule.replacement));
    changes.push(`${rule.file}:text-pattern`);
  }
}
function scanSecrets() {
  const valuePatterns = (policy.secretValuePatterns || []).map((pattern) => new RegExp(pattern, 'i'));
  const keyHints = (policy.secretKeyHints || []).map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const suspiciousAssignment = keyHints ? new RegExp(`\\b(?:${keyHints})\\b\\s*[=:]\\s*['\"][^'\"]+['\"]`, 'i') : null;
  const findings = [];
  walk(stagingDestination, (file) => {
    if (fs.statSync(file).size > 5_000_000) return;
    const extension = path.extname(file).toLowerCase();
    if (!['.lua', '.json', '.js', '.mjs', '.cjs', '.ts', '.cfg', '.env', '.txt', '.md'].includes(extension)) return;
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of valuePatterns) if (pattern.test(content)) findings.push(`${path.relative(stagingDestination, file)} matched secret value pattern`);
    if (suspiciousAssignment?.test(content)) findings.push(`${path.relative(stagingDestination, file)} contains a credential-like assignment; add an explicit sanitizer or remove it`);
  });
  if (findings.length) throw new Error(`Secret scan failed:\n${findings.join('\n')}`);
}

const changeLogIgnored = new Set(['RELEASE.json', 'CHANGES.md']);
function collectFiles(directory) {
  const files = new Map();
  if (!fs.existsSync(directory)) return files;
  walk(directory, (file) => files.set(path.relative(directory, file).replaceAll('\\', '/'), file));
  return files;
}
function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function buildChangeLog(previousDirectory, currentDirectory) {
  const previous = collectFiles(previousDirectory);
  const current = collectFiles(currentDirectory);
  const added = [];
  const modified = [];
  const removed = [];
  for (const [relativePath, file] of current) {
    if (changeLogIgnored.has(relativePath)) continue;
    if (!previous.has(relativePath)) { added.push(relativePath); continue; }
    if (hashFile(file) !== hashFile(previous.get(relativePath))) modified.push(relativePath);
  }
  for (const relativePath of previous.keys()) {
    if (changeLogIgnored.has(relativePath) || current.has(relativePath)) continue;
    removed.push(relativePath);
  }
  return { added: added.sort(), modified: modified.sort(), removed: removed.sort() };
}
function formatChangeLog(previousReleaseName, currentReleaseName, changes) {
  const section = (title, entries) => (entries.length ? [`## ${title}`, ...entries.map((entry) => `- ${entry}`), ''] : []);
  const lines = [
    `# Changes: ${previousReleaseName} -> ${currentReleaseName}`,
    '',
    ...section('Added', changes.added),
    ...section('Modified', changes.modified),
    ...section('Removed', changes.removed),
  ];
  if (!changes.added.length && !changes.modified.length && !changes.removed.length) lines.push('No packaged file changes detected.', '');
  return `${lines.join('\n').trimEnd()}\n`;
}

if (!fs.existsSync(path.join(resourceRoot, 'fxmanifest.lua'))) throw new Error(`Resource source is missing fxmanifest.lua: ${path.relative(root, resourceRoot)}`);
if (fs.existsSync(destination)) throw new Error(`Release already exists: ${path.relative(root, destination)}`);
if (dryRun) {
  console.log(JSON.stringify({ releaseName, version, sourceDirectory: path.relative(root, resourceRoot), destination: path.relative(root, destination), skipUiBuild }, null, 2));
  process.exit(0);
}
if (!skipValidation) run(process.execPath, ['scripts/run-validation.mjs', '--release']);
if (!skipUiBuild && metadata.ui?.enabled !== false) run('npm', ['run', 'build', '--prefix', path.relative(root, uiSource)]);
if (metadata.ui?.enabled !== false && !fs.existsSync(path.join(uiOutput, 'index.html'))) throw new Error(`${path.relative(root, uiOutput)}/index.html is missing. Build the UI or provide an existing production build.`);

const sourceManifestPath = path.join(resourceRoot, 'fxmanifest.lua');
const metadataPath = path.join(root, 'resource.json');
const originalMetadata = fs.readFileSync(metadataPath, 'utf8');
const originalManifest = fs.readFileSync(sourceManifestPath, 'utf8');
let sourceFilesTouched = false;

try {
  fs.mkdirSync(stagingDestination, { recursive: true });
  for (const include of policy.include || []) {
    const source = path.join(resourceRoot, include);
    if (fs.existsSync(source)) copyEntry(source, path.join(stagingDestination, include), include);
  }

  const manifestPath = path.join(stagingDestination, 'fxmanifest.lua');
  if (!fs.existsSync(manifestPath)) throw new Error('Release is missing fxmanifest.lua.');
  patchManifest(manifestPath);

  const sanitized = [];
  applyExplicitSanitizers(sanitized);
  scanSecrets();

  let changeLog = null;
  if (policy.changeLog?.enabled && previousRelease) {
    changeLog = buildChangeLog(path.join(outputRoot, previousRelease.name), stagingDestination);
    fs.writeFileSync(path.join(stagingDestination, 'CHANGES.md'), formatChangeLog(previousRelease.name, releaseName, changeLog));
  }

  fs.writeFileSync(path.join(stagingDestination, 'RELEASE.json'), `${JSON.stringify({
    resource: resourceName,
    version,
    generatedAt: new Date().toISOString(),
    uiBuildSkipped: skipUiBuild,
    sanitizedFields: sanitized,
    previousVersion: previousRelease ? formatVersion(previousRelease.version) : null,
    changeLog: changeLog ? { added: changeLog.added.length, modified: changeLog.modified.length, removed: changeLog.removed.length } : null,
  }, null, 2)}\n`);

  sourceFilesTouched = true;
  fs.writeFileSync(metadataPath, `${JSON.stringify({ ...metadata, name: resourceName, version }, null, 2)}\n`);
  fs.writeFileSync(sourceManifestPath, originalManifest.replace(/^version\s+['"][^'"]+['"]$/m, `version '${version}'`));
  fs.renameSync(stagingDestination, destination);
} catch (error) {
  if (sourceFilesTouched) {
    fs.writeFileSync(metadataPath, originalMetadata);
    fs.writeFileSync(sourceManifestPath, originalManifest);
  }
  fs.rmSync(stagingDestination, { recursive: true, force: true });
  throw error;
}

console.log(`Release created: ${path.relative(root, destination)}`);
