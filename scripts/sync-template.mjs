import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');

const DEFAULT_REMOTE_URL = 'https://github.com/NewwyKung/fivem-resource-ai-template.git';
const DEFAULT_REMOTE_NAME = 'fivem-template';
const DEFAULT_REF = 'main';
const TRACKING_FILE = '.template-sync.json';

// Template-owned plumbing only. Never resource-specific state or the dev's
// own game code — see the "excluded on purpose" list below for why.
const DEFAULT_SYNC_PATHS = [
  '.agents',
  '.ai/CONTEXT_BUDGET.md',
  '.ai/examples',
  '.ai/integrations',
  '.ai/matrices',
  '.ai/rules',
  '.ai/skills',
  '.gemini',
  '.github/ISSUE_TEMPLATE',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/copilot-instructions.md',
  '.github/workflows/validate.yml',
  '.luarc.json',
  'AGENTS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/ai-agents.md',
  'docs/development.md',
  'docs/schemas',
  'examples',
  'scripts',
  'secret-scan.config.json',
  'tooling.config.json',
  'types',
];

// Never included by default, and require --yes to sync even when passed
// explicitly via --paths: this is state specific to the resource that owns
// this repo, not template plumbing. Syncing it would silently overwrite a
// resource's own confirmed environment, in-flight requirements, generated
// index, or actual game code.
const GUARDED_PREFIXES = ['resource', '.ai/memory', '.ai/work'];
const GUARDED_EXACT = ['.ai/index.json', 'integrations.json', 'package.json', 'package-lock.json'];

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
    if (key === 'yes' || key === 'help' || key === 'dry-run' || key === 'list-only') {
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
  console.log(`Pull template plumbing updates into a resource cloned from this template.

Never touches resource/ (the resource's own game code) or resource-specific
state (.ai/memory, .ai/work, .ai/index.json, integrations.json, package.json)
unless explicitly requested with --paths and confirmed with --yes.

Two ways to choose what to sync:
  1. Default path list (deterministic, see DEFAULT_SYNC_PATHS in this file).
  2. --list-only: prints every changed file repo-wide (or under --paths, if
     given), each marked [guarded] or not, and changes nothing. Meant to be
     read by an AI agent (see .ai/skills/sync-template/SKILL.md), which
     decides what's genuinely template plumbing worth pulling in versus
     resource-specific or intentionally diverged, then re-runs with an
     explicit --paths built from that judgment.

Usage:
  npm run sync:template
  npm run sync:template -- --dry-run
  npm run sync:template -- --list-only
  npm run sync:template -- --paths ".ai/rules,examples" --yes
  npm run sync:template -- --ref v0.3.0

Options:
  --remote-url <url>   Template repository URL (default: ${DEFAULT_REMOTE_URL})
  --remote-name <name> Local git remote name to use/create (default: ${DEFAULT_REMOTE_NAME})
  --ref <ref>          Branch, tag, or commit to sync from (default: ${DEFAULT_REF})
  --paths <list>       Comma-separated paths to sync instead of the default list; with
                        --list-only, narrows the listing instead (whole repo if omitted)
  --list-only          List every changed file (marked [guarded] or not) and exit; changes nothing
  --dry-run            Show what would change without touching the working tree
  --yes                Required to proceed when any resolved path is guarded (see above)
  --help                Show this help`);
}

function run(args, options = {}) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', ...options });
}

function requireCleanGitRepo() {
  if (!fs.existsSync(path.join(root, '.git'))) {
    console.error('[sync-template] not a git repository; initialize git before syncing.');
    process.exit(1);
  }
}

function resolveGuardedPaths(paths) {
  return paths.filter((candidate) => {
    const normalized = candidate.replace(/\\/g, '/').replace(/\/+$/, '');
    if (GUARDED_EXACT.includes(normalized)) return true;
    return GUARDED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  });
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  requireCleanGitRepo();

  const remoteUrl = args['remote-url'] || DEFAULT_REMOTE_URL;
  const remoteName = args['remote-name'] || DEFAULT_REMOTE_NAME;
  const ref = args.ref || DEFAULT_REF;

  const remotes = run(['remote']).stdout.split('\n').map((line) => line.trim());
  if (!remotes.includes(remoteName)) {
    console.log(`[sync-template] adding remote "${remoteName}" -> ${remoteUrl}`);
    const addResult = run(['remote', 'add', remoteName, remoteUrl]);
    if (addResult.status !== 0) {
      console.error(`[sync-template] failed to add remote: ${addResult.stderr}`);
      process.exit(addResult.status ?? 1);
    }
  }

  console.log(`[sync-template] fetching ${remoteName} ${ref}...`);
  const fetchResult = run(['fetch', remoteName, ref]);
  if (fetchResult.status !== 0) {
    console.error(`[sync-template] fetch failed: ${fetchResult.stderr}`);
    process.exit(fetchResult.status ?? 1);
  }

  const sourceRef = `${remoteName}/${ref}`;
  const resolveResult = run(['rev-parse', 'FETCH_HEAD']);
  const sourceCommit = resolveResult.stdout.trim();

  if (args['list-only']) {
    const scopePaths = args.paths ? args.paths.split(',').map((value) => value.trim()).filter(Boolean) : [];
    const diffArgs = ['diff', '--name-status', 'HEAD', 'FETCH_HEAD'];
    if (scopePaths.length > 0) diffArgs.push('--', ...scopePaths);
    const changed = run(diffArgs)
      .stdout.split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [status, ...fileParts] = line.split('\t');
        return { status, file: fileParts.join('\t') };
      });

    if (changed.length === 0) {
      console.log(`[sync-template] no differences from ${sourceRef} (${sourceCommit.slice(0, 12)}) in scope.`);
      return;
    }

    console.log(`[sync-template] ${changed.length} changed file(s) vs ${sourceRef} (${sourceCommit.slice(0, 12)}):`);
    for (const { status, file } of changed) {
      const guarded = resolveGuardedPaths([file]).length > 0 ? ' [guarded — needs --yes]' : '';
      console.log(`  ${status}\t${file}${guarded}`);
    }
    console.log(
      '\n[sync-template] nothing was changed (list-only). Re-run with --paths "<comma-separated files/dirs>"' +
        ' (add --yes only if the chosen set includes a [guarded] path you specifically intend to sync).'
    );
    return;
  }

  const paths = args.paths ? args.paths.split(',').map((value) => value.trim()).filter(Boolean) : DEFAULT_SYNC_PATHS;

  const guarded = resolveGuardedPaths(paths);
  if (guarded.length > 0 && !args.yes) {
    console.error(
      `[sync-template] refusing to sync resource-specific path(s) without --yes: ${guarded.join(', ')}\n` +
        `These hold this resource's own state (game code, confirmed environment, in-flight requirements, or a` +
        ` generated index/selection file), not template plumbing. Re-run with --yes only if you are certain.`
    );
    process.exit(1);
  }

  // Only paths that actually exist at the source ref; git checkout errors
  // on a pathspec that matches nothing.
  const existingPaths = paths.filter((candidate) => {
    const check = run(['cat-file', '-e', `FETCH_HEAD:${candidate}`]);
    return check.status === 0;
  });
  const missing = paths.filter((candidate) => !existingPaths.includes(candidate));
  if (missing.length > 0) {
    console.log(`[sync-template] not present at ${ref}, skipping: ${missing.join(', ')}`);
  }
  if (existingPaths.length === 0) {
    console.log('[sync-template] nothing to sync.');
    return;
  }

  const dirty = run(['status', '--porcelain', '--', ...existingPaths]).stdout.trim();
  if (dirty && !args.yes) {
    console.error(
      `[sync-template] uncommitted changes under paths to sync; commit or stash first, or re-run with --yes to overwrite them:\n${dirty}`
    );
    process.exit(1);
  }

  const diffStat = run(['diff', '--stat', 'HEAD', 'FETCH_HEAD', '--', ...existingPaths]).stdout.trim();
  if (!diffStat) {
    console.log('[sync-template] already up to date for the selected paths.');
    return;
  }

  console.log(`[sync-template] changes from ${sourceRef} (${sourceCommit.slice(0, 12)}):\n${diffStat}`);

  if (args['dry-run']) {
    console.log('[sync-template] --dry-run: no files were changed.');
    return;
  }

  const checkoutResult = run(['checkout', 'FETCH_HEAD', '--', ...existingPaths]);
  if (checkoutResult.status !== 0) {
    console.error(`[sync-template] checkout failed: ${checkoutResult.stderr}`);
    process.exit(checkoutResult.status ?? 1);
  }

  fs.writeFileSync(
    path.join(root, TRACKING_FILE),
    `${JSON.stringify(
      { remoteUrl, remoteName, ref, lastSyncedCommit: sourceCommit, lastSyncedAt: new Date().toISOString() },
      null,
      2
    )}\n`
  );
  run(['add', TRACKING_FILE]);

  console.log(
    `[sync-template] synced. Review with "git diff --cached", run "npm run validate", regenerate .ai/index.json` +
      ` (node scripts/build-ai-index.mjs) if rule/skill files changed, then commit.` +
      ` package.json/package-lock.json were not touched — check the template's for new dependencies manually.`
  );
}

main();
