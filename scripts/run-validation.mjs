import { spawnSync } from 'node:child_process';
import process from 'node:process';

const fast = process.argv.includes('--fast');
const releaseMode = process.argv.includes('--release');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const checks = [
  ['Node syntax: validation orchestrator', process.execPath, ['--check', 'scripts/run-validation.mjs']],
  ['Node syntax: secret scanner', process.execPath, ['--check', 'scripts/scan-secrets.mjs']],
  ['Node syntax: LuaLS runner', process.execPath, ['--check', 'scripts/run-luals.mjs']],
  ['Node syntax: agent adapter validator', process.execPath, ['--check', 'scripts/validate-agent-adapters.mjs']],
  ['Node syntax: UI asset validator', process.execPath, ['--check', 'scripts/check-ui-assets.mjs']],
  ['Template policy', process.execPath, ['scripts/validate-template.mjs']],
  ['Integration profiles', process.execPath, ['scripts/validate-integrations.mjs']],
  ['AI registry', process.execPath, ['scripts/build-ai-index.mjs', '--check']],
  ['AI registry integration', process.execPath, ['tests/ai/build-ai-index.integration.mjs']],
  ['Canonical schemas', process.execPath, ['scripts/validate-schemas.mjs']],
  ['AI skills', process.execPath, ['scripts/validate-skills.mjs']],
  ['AI agent adapters', process.execPath, ['scripts/validate-agent-adapters.mjs']],
  ['AI agent adapter integration', process.execPath, ['tests/ai/validate-agent-adapters.integration.mjs']],
  ['Secret scan', process.execPath, ['scripts/scan-secrets.mjs']],
  ['Secret scanner integration', process.execPath, ['tests/security/scan-secrets.integration.mjs']],
  ['Optional i18n contract', process.execPath, ['examples/capabilities/i18n/tests/locale.integration.mjs']],
  ['UI practice policy', process.execPath, ['scripts/check-ui-practices.mjs']],
  ['UI practice policy integration', process.execPath, ['tests/ui/check-ui-practices.integration.mjs']],
  ['UI asset policy', process.execPath, ['scripts/check-ui-assets.mjs']],
  ['UI asset policy integration', process.execPath, ['tests/ui/check-ui-assets.integration.mjs']],
  ['NUI bridge integration', process.execPath, ['tests/ui/nui-bridge.integration.mjs']],
  ['Svelte diagnostics', npm, ['run', 'check', '--prefix', 'resource/ui']],
];

if (!fast && !releaseMode) {
  checks.push(
    ['Release integration', process.execPath, ['tests/release/create-release.integration.mjs']],
    ['Svelte production build', npm, ['run', 'build', '--prefix', 'resource/ui']],
  );
}

for (const [label, command, args] of checks) {
  console.log(`\n[validate] ${label}`);
  const windowsCommand = process.platform === 'win32' && command.endsWith('.cmd');
  const executable = windowsCommand ? (process.env.ComSpec || 'cmd.exe') : command;
  const executableArgs = windowsCommand ? ['/d', '/s', '/c', command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`[validate] unable to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n[validate] ${fast ? 'fast validation' : 'full validation'} passed.`);
