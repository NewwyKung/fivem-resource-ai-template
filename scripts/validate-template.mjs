import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];

function normalize(relativePath) {
  return relativePath.replaceAll('\\', '/');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function requirePath(relativePath) {
  if (!exists(relativePath)) errors.push(`Missing required path: ${relativePath}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readTrackedFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    errors.push(`Unable to inspect tracked files: ${(result.stderr || result.stdout).trim()}`);
    return [];
  }
  return result.stdout.split(/\r?\n/).filter(Boolean).map(normalize);
}

for (const required of [
  'AGENTS.md',
  'CLAUDE.md',
  '.gemini/settings.json',
  '.github/copilot-instructions.md',
  '.github/workflows/validate.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  '.ai/CONTEXT_BUDGET.md',
  '.ai/index.json',
  '.ai/work/README.md',
  '.ai/work/TEMPLATE.md',
  '.ai/memory/environment.md',
  '.ai/memory/requirements/README.md',
  '.ai/memory/requirements/active',
  '.ai/memory/requirements/delivered',
  '.ai/memory/requirements/superseded',
  '.ai/rules/integrations.md',
  '.ai/skills/discover-requirements/SKILL.md',
  '.ai/skills/setup-dev-resource/SKILL.md',
  '.ai/examples/adapter-pattern/README.md',
  '.ai/examples/database-port/README.md',
  '.ai/examples/server-authoritative-event/README.md',
  '.ai/examples/resource-with-nui/README.md',
  'examples/resources/example_interaction/fxmanifest.lua',
  'tests/examples/example_interaction.md',
  'tests/release/create-release.integration.mjs',
  'tests/ai/build-ai-index.integration.mjs',
  'tests/ai/validate-agent-adapters.integration.mjs',
  'tests/security/scan-secrets.integration.mjs',
  'tests/ui/check-ui-practices.integration.mjs',
  'tests/ui/check-ui-assets.integration.mjs',
  'tests/ui/nui-bridge.integration.mjs',
  'scripts/build-ai-index.mjs',
  'scripts/create-release.mjs',
  'scripts/init-template.mjs',
  'scripts/setup-dev-resource.mjs',
  'scripts/run-validation.mjs',
  'scripts/run-luals.mjs',
  'scripts/scan-secrets.mjs',
  'scripts/validate-schemas.mjs',
  'scripts/check-ui-practices.mjs',
  'scripts/check-ui-assets.mjs',
  'scripts/validate-skills.mjs',
  'scripts/validate-agent-adapters.mjs',
  'scripts/setup-dev-resource.ps1',
  'package.json',
  'tooling.config.json',
  'secret-scan.config.json',
  'release.config.json',
  'resource/fxmanifest.lua',
  'resource/config/config.main.lua',
  'resource/client/main.lua',
  'resource/server/main.lua',
  'resource/ui/src/app.css',
  'resource/ui/package-lock.json',
  'resource/ui/src/global.d.ts',
  'resource/html/.gitkeep',
  'release/.gitkeep',
  'examples/README.md',
  'examples/hello-world/fxmanifest.lua',
  'examples/shop-system/fxmanifest.lua',
  'examples/capabilities/runtime-tests/test_runner/fxmanifest.lua',
  'examples/github-workflows/ci.yml',
  'examples/github-workflows/release.yml',
  'examples/git-hooks/pre-commit',
  'docs/ci-cd.md',
  'docs/credits.md',
  'docs/development.md',
  'docs/schemas/runtime-contracts.schema.json',
  'docs/schemas/provider-operation.schema.json',
  'docs/schemas/ai-task.schema.json',
  'docs/schemas/ui-asset-manifest.schema.json',
  'docs/ui-spec/assets/.gitkeep',
  '.ai/matrices/architecture-tiers.json',
  '.ai/rules/source-trust.md',
  '.ai/rules/contracts.md',
  '.ai/recipes/concurrent-mutation.md',
  '.ai/skills/refactor-feature/SKILL.md',
  '.ai/skills/assetize-ui/SKILL.md',
  '.agents/skills/fivem-ui-workflow/SKILL.md',
  '.agents/skills/fivem-ui-workflow/agents/openai.yaml',
  '.agents/skills/fivem-ui-workflow/references/motion.md',
  '.ai/matrices/ui-tool-routing.json',
  '.ai/matrices/agent-entrypoints.json',
  '.ai/integrations/providers/v0.md',
  '.ai/prompts/ui-external-handoff.md',
  'docs/ai-agents.md',
]) requirePath(required);

const forbiddenPaths = [
  'Development',
  'web',
  'fivem-development.skill',
  'client',
  'server',
  'shared',
  'config',
  'ui',
  'html',
  'fxmanifest.lua',
  'resource/config/client',
  'resource/config/server',
  'resource/config/shared',
  'resource/config/functions',
  'resource/config/config.integrations.lua',
  'resource/shared/modules/integrations.lua',
  'resource/ui/src/provider/Visible.svelte',
  `resource/ui/src/lib/${['Component', 'Showcase'].join('')}.svelte`,
  'resource/ui/src/lib/tokens.css',
  'SUPPORT.md',
  'ROADMAP.md',
  'ARCHITECTURE.md',
  'FAQ.md',
  'GEMINI.md',
  '.cursor/rules/project.mdc',
];

for (const file of forbiddenPaths) {
  if (exists(file)) errors.push(`Legacy, duplicate, generated, or inactive path must not exist: ${file}`);
}

const trackedFiles = readTrackedFiles();
const generatedHtml = trackedFiles.filter((file) => file.startsWith('resource/html/') && file !== 'resource/html/.gitkeep');
if (generatedHtml.length > 0) errors.push(`Generated resource/html output is tracked: ${generatedHtml.join(', ')}`);

const generatedReleases = trackedFiles.filter((file) => file.startsWith('release/') && file !== 'release/.gitkeep');
if (generatedReleases.length > 0) errors.push(`Generated release output is tracked: ${generatedReleases.join(', ')}`);

const misplacedSvelte = trackedFiles.filter((file) => file.endsWith('.svelte') && !file.startsWith('resource/ui/'));
if (misplacedSvelte.length > 0) errors.push(`Svelte source exists outside resource/ui: ${misplacedSvelte.join(', ')}`);

if (exists('resource/ui/src/app.css')) {
  const css = read('resource/ui/src/app.css');
  const tokens = [
    '--scale: 1',
    '--base-screen-height: 1440',
    '--px-to-vh: calc(1vh / var(--base-screen-height) * 100 * var(--scale))',
  ];
  for (const token of tokens) {
    if (!css.includes(token)) errors.push(`resource/ui/src/app.css is missing ${token}`);
  }
  if (/var\(--px-to-vh\)\s*\*\s*var\(--scale\)|var\(--scale\)\s*\*\s*var\(--px-to-vh\)/.test(css)) {
    errors.push('resource/ui/src/app.css multiplies --scale after --px-to-vh already applied it.');
  }
}

if (exists('resource/fxmanifest.lua')) {
  const manifest = read('resource/fxmanifest.lua');
  if (/^\s*lua54\s+/m.test(manifest)) errors.push("resource/fxmanifest.lua must not use deprecated lua54 metadata.");
  if (!/^\s*ui_page\s+['"]html\/index\.html['"]\s*$/m.test(manifest)) {
    errors.push('resource/fxmanifest.lua must use production ui_page html/index.html.');
  }
  if (/https?:\/\/localhost/i.test(manifest)) errors.push('resource/fxmanifest.lua must not contain a localhost ui_page.');
  if (manifest.includes('config/functions/')) errors.push('resource/fxmanifest.lua still references config/functions/.');

  const entries = [...manifest.matchAll(/^\s*['"]([^'"]+)['"],?\s*$/gm)].map((match) => normalize(match[1]));
  for (const entry of entries) {
    if (entry.startsWith('resource/') || entry.startsWith('/') || entry.includes('../')) {
      errors.push(`Manifest path must stay relative to resource/: ${entry}`);
      continue;
    }
    if (entry.startsWith('html/')) continue;
    const wildcardIndex = entry.search(/[?*[]/);
    const base = (wildcardIndex === -1 ? entry : entry.slice(0, wildcardIndex)).replace(/\/$/, '');
    if (base && !exists(path.posix.join('resource', base))) errors.push(`Manifest path does not exist: ${entry}`);
  }
}

for (const manifestPath of [
  'examples/hello-world/fxmanifest.lua',
  'examples/shop-system/fxmanifest.lua',
  'examples/resources/example_interaction/fxmanifest.lua',
  'examples/capabilities/runtime-tests/test_runner/fxmanifest.lua',
]) {
  if (!exists(manifestPath)) continue;
  const manifest = read(manifestPath);
  if (/^\s*lua54\s+/m.test(manifest)) errors.push(`${manifestPath} must not use deprecated lua54 metadata.`);
  const manifestRoot = path.posix.dirname(manifestPath);
  const entries = [...manifest.matchAll(/^\s*['"]([^'"]+)['"],?\s*$/gm)].map((match) => normalize(match[1]));

  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('../')) {
      errors.push(`Example manifest path must stay relative to ${manifestRoot}: ${entry}`);
      continue;
    }
    const wildcardIndex = entry.search(/[?*[]/);
    const base = (wildcardIndex === -1 ? entry : entry.slice(0, wildcardIndex)).replace(/\/$/, '');
    if (base && !exists(path.posix.join(manifestRoot, base))) {
      errors.push(`Example manifest path does not exist: ${manifestPath}:${entry}`);
    }
  }
}

if (exists('resource/ui/vite.config.js')) {
  const vite = read('resource/ui/vite.config.js');
  if (!/outDir:\s*['"]\.\.\/html['"]/.test(vite)) errors.push('resource/ui/vite.config.js must build to ../html.');
  if (!/emptyOutDir:\s*true/.test(vite)) errors.push('resource/ui/vite.config.js must clear stale generated output.');
  if (!/base:\s*['"]\.\/['"]/.test(vite)) errors.push('resource/ui/vite.config.js must use relative asset paths.');
}

if (exists('.claude/launch.json')) {
  const launch = read('.claude/launch.json');
  if (!launch.includes('resource/ui')) errors.push('.claude/launch.json must run the UI from resource/ui.');
}

if (exists('scripts/setup-dev-resource.ps1')) {
  const junction = read('scripts/setup-dev-resource.ps1');
  for (const token of ["Join-Path $repoRoot 'resource'", "-Target $resourceRoot", "resourceRoot 'fxmanifest.lua'", 'ReparsePoint']) {
    if (!junction.includes(token)) errors.push(`scripts/setup-dev-resource.ps1 is missing safety/target logic: ${token}`);
  }
}

if (exists('scripts/setup-dev-resource.mjs')) {
  const setup = read('scripts/setup-dev-resource.mjs');
  for (const token of ["path.join(root, 'resource')", "stats.isSymbolicLink()", "Refusing to remove a real directory or file", "fs.symlinkSync"]) {
    if (!setup.includes(token)) errors.push(`scripts/setup-dev-resource.mjs is missing safety/target logic: ${token}`);
  }
}

if (exists('scripts/init-template.mjs')) {
  const initializer = read('scripts/init-template.mjs');
  for (const token of ["resource.json", "resource/fxmanifest.lua", "resource/ui/package-lock.json", ".ai/memory/environment.md", "never stores credentials"]) {
    if (!initializer.includes(token)) errors.push(`scripts/init-template.mjs is missing expected behavior: ${token}`);
  }
}

if (exists('release.config.json')) {
  try {
    const policy = JSON.parse(read('release.config.json'));
    if (policy.sourceDirectory !== 'resource') errors.push('release.config.json sourceDirectory must be resource.');
    if (policy.secretKeys) errors.push('release.config.json must not use broad secretKeys auto-sanitization.');
    if (!Array.isArray(policy.jsonSecretPaths) || !Array.isArray(policy.textSanitizers)) {
      errors.push('release.config.json must define explicit jsonSecretPaths and textSanitizers arrays.');
    }
    for (const requiredInclude of ['fxmanifest.lua', 'client', 'server', 'shared', 'config']) {
      if (!policy.include?.includes(requiredInclude)) errors.push(`release.config.json is missing include: ${requiredInclude}`);
    }
    if (policy.include?.some((entry) => entry === 'resource' || entry === 'ui' || entry.startsWith('resource/'))) {
      errors.push('release.config.json must include resource contents, not resource/ or UI source.');
    }
  } catch (error) {
    errors.push(`release.config.json is invalid JSON: ${error.message}`);
  }
}

function listFiles(directory, extension) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension) && entry.name !== 'INDEX.md')
    .map((entry) => entry.name);
}

function listDirs(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

if (exists('.ai/rules/INDEX.md')) {
  const rulesIndex = read('.ai/rules/INDEX.md');
  for (const file of listFiles('.ai/rules', '.md')) {
    if (!rulesIndex.includes(`\`${file}\``)) errors.push(`.ai/rules/INDEX.md does not reference ${file}`);
  }
}

if (exists('.ai/skills/INDEX.md')) {
  const skillsIndex = read('.ai/skills/INDEX.md');
  for (const dir of listDirs('.ai/skills')) {
    if (!skillsIndex.includes(`\`${dir}/SKILL.md\``)) errors.push(`.ai/skills/INDEX.md does not reference ${dir}/SKILL.md`);
  }
}

const staleTerms = [
  ['Development', 'Svelte'].join('/'),
  ['Development', 'Svelte'].join('\\'),
  ['OVERLORD UI', 'COMPONENTS'].join(' '),
  ['Component', 'Showcase'].join(''),
  ['localhost', '3301'].join(':'),
  ['v.2', 'Template-FiveM'].join('-'),
];
const historicalFiles = new Set([
  'docs/resource-restructure-audit.md',
  '.ai/memory/requirements/active/resource-restructure.md',
]);
const allowedExtensions = new Set(['.md', '.json', '.js', '.mjs', '.ts', '.svelte', '.css', '.lua', '.ps1', '.html', '.yml', '.yaml']);

for (const relativePath of trackedFiles) {
  if (historicalFiles.has(relativePath) || relativePath === 'scripts/validate-template.mjs') continue;
  if (relativePath.startsWith('.ai/memory/requirements/delivered/')) continue;
  if (!exists(relativePath)) continue;
  if (!allowedExtensions.has(path.extname(relativePath))) continue;
  const content = read(relativePath);
  for (const term of staleTerms) {
    if (content.includes(term)) errors.push(`Stale reference '${term}' found in ${relativePath}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`[template] ${error}`);
  process.exit(1);
}

console.log('[template] validation passed.');
