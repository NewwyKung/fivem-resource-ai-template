import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const source = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fivem-release-test-'));

function fail(message) {
  console.error(`[release-test] ${message}`);
  process.exitCode = 1;
}
function copyFilter(entry) {
  const relative = path.relative(source, entry).replaceAll('\\', '/');
  return !relative.startsWith('.git') && !relative.startsWith('release/') && !relative.startsWith('resource/ui/node_modules');
}

try {
  fs.cpSync(source, temp, { recursive: true, filter: copyFilter });
  fs.mkdirSync(path.join(temp, 'resource/config'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'resource/config/nested/deep'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'resource/html/assets/chunks'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'resource/config/release-test.json'), JSON.stringify({ service: { webhook: 'https://discord.com/api/webhooks/test/secret' } }, null, 2));
  fs.writeFileSync(path.join(temp, 'resource/config/nested/deep/fixture.example.json'), '{}');
  fs.writeFileSync(path.join(temp, 'resource/config/nested/deep/.gitkeep'), '');
  fs.writeFileSync(path.join(temp, 'resource/html/index.html'), '<!doctype html><title>release test</title>');
  fs.writeFileSync(path.join(temp, 'resource/html/assets/chunks/app.js.map'), '{}');
  fs.writeFileSync(path.join(temp, 'resource/config/removable.lua'), '-- present only in the first release\n');

  const policyPath = path.join(temp, 'release.config.json');
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  policy.jsonSecretPaths = [{ file: 'config/release-test.json', path: 'service.webhook', replacement: null }];
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);

  const gated = spawnSync(process.execPath, ['scripts/create-release.mjs', '--name', 'release_test', '--version', '0.0.1', '--skip-ui-build'], { cwd: temp, encoding: 'utf8' });
  if (gated.status === 0) throw new Error('release generation bypassed its validation gate');
  if (fs.existsSync(path.join(temp, 'release/release_test-0.0.1'))) fail('failed validation left release output behind');

  const result = spawnSync(process.execPath, ['scripts/create-release.mjs', '--name', 'release_test', '--version', '0.0.1', '--skip-ui-build', '--skip-validation'], { cwd: temp, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

  const release = path.join(temp, 'release/release_test-0.0.1');
  const required = ['fxmanifest.lua', 'RELEASE.json', 'config/release-test.json'];
  for (const file of required) if (!fs.existsSync(path.join(release, file))) fail(`missing ${file}`);

  for (const excluded of [
    'config/nested/deep/fixture.example.json',
    'config/nested/deep/.gitkeep',
    'html/assets/chunks/app.js.map',
  ]) {
    if (fs.existsSync(path.join(release, excluded))) fail(`nested exclusion was packaged: ${excluded}`);
  }

  for (const forbidden of ['.ai', '.github', 'docs', 'examples', 'tests', 'scripts', 'resource', 'ui']) {
    if (fs.existsSync(path.join(release, forbidden))) fail(`forbidden path included: ${forbidden}`);
  }

  const manifest = fs.readFileSync(path.join(release, 'fxmanifest.lua'), 'utf8');
  if (manifest.includes('localhost')) fail('release manifest contains localhost');
  if (!manifest.includes("version '0.0.1'")) fail('release manifest version was not patched');
  if (!manifest.includes("ui_page 'html/index.html'")) fail('production ui_page is missing');

  const sanitized = JSON.parse(fs.readFileSync(path.join(release, 'config/release-test.json'), 'utf8'));
  if (sanitized.service.webhook !== null) fail('explicit JSON secret path was not sanitized');

  const metadata = JSON.parse(fs.readFileSync(path.join(release, 'RELEASE.json'), 'utf8'));
  if (!metadata.sanitizedFields.includes('config/release-test.json:service.webhook')) fail('sanitization evidence is missing');
  if (!metadata.uiBuildSkipped) fail('release metadata did not record UI build reuse');

  const sourceManifest = fs.readFileSync(path.join(temp, 'resource/fxmanifest.lua'), 'utf8');
  const sourceMetadata = JSON.parse(fs.readFileSync(path.join(temp, 'resource.json'), 'utf8'));
  if (!sourceManifest.includes("version '0.0.1'")) fail('source manifest version was not synchronized');
  if (sourceMetadata.version !== '0.0.1') fail('resource metadata version was not synchronized');

  const metadataBeforeFailure = fs.readFileSync(path.join(temp, 'resource.json'), 'utf8');
  const manifestBeforeFailure = fs.readFileSync(path.join(temp, 'resource/fxmanifest.lua'), 'utf8');
  policy.jsonSecretPaths = [{ file: 'config/release-test.json', path: 'service.missing', replacement: null }];
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);

  const failedBuild = spawnSync(process.execPath, ['scripts/create-release.mjs', '--name', 'release_test', '--version', '0.0.2', '--skip-ui-build', '--skip-validation'], { cwd: temp, encoding: 'utf8' });
  if (failedBuild.status === 0) fail('release generation ignored a failing sanitizer');
  if (fs.existsSync(path.join(temp, 'release/release_test-0.0.2'))) fail('failed release left a final package behind');
  const temporaryReleases = fs.readdirSync(path.join(temp, 'release')).filter((entry) => entry.startsWith('.release_test-0.0.2.tmp-'));
  if (temporaryReleases.length > 0) fail(`failed release left staging output: ${temporaryReleases.join(', ')}`);
  if (fs.readFileSync(path.join(temp, 'resource.json'), 'utf8') !== metadataBeforeFailure) fail('failed release changed resource metadata');
  if (fs.readFileSync(path.join(temp, 'resource/fxmanifest.lua'), 'utf8') !== manifestBeforeFailure) fail('failed release changed the source manifest');

  // Second successful release: the change log is opt-in, so it must stay off by default
  // even though a previous release now exists to diff against.
  policy.jsonSecretPaths = [{ file: 'config/release-test.json', path: 'service.webhook', replacement: null }];
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);

  const secondBuild = spawnSync(process.execPath, ['scripts/create-release.mjs', '--name', 'release_test', '--version', '0.0.2', '--skip-ui-build', '--skip-validation'], { cwd: temp, encoding: 'utf8' });
  if (secondBuild.status !== 0) throw new Error(`${secondBuild.stdout}\n${secondBuild.stderr}`);

  const secondRelease = path.join(temp, 'release/release_test-0.0.2');
  if (fs.existsSync(path.join(secondRelease, 'CHANGES.md'))) fail('change log was generated while disabled by default');
  const secondMetadata = JSON.parse(fs.readFileSync(path.join(secondRelease, 'RELEASE.json'), 'utf8'));
  if (secondMetadata.previousVersion !== '0.0.1') fail('previousVersion metadata was not recorded');
  if (secondMetadata.changeLog !== null) fail('change log summary should be null when the feature is disabled');

  // Third release: opt in to the change log and prove it reports the real file diff
  // (added/modified/removed) against the previous release, plus README packaging.
  policy.changeLog = { enabled: true };
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  fs.writeFileSync(path.join(temp, 'resource/README.md'), '# Release Test Resource\n');
  fs.writeFileSync(path.join(temp, 'resource/config/release-test.json'), JSON.stringify({ service: { webhook: 'https://discord.com/api/webhooks/test/secret', extra: 'changed' } }, null, 2));
  fs.writeFileSync(path.join(temp, 'resource/config/new-feature.lua'), '-- added for the change log test\n');
  fs.rmSync(path.join(temp, 'resource/config/removable.lua'));

  const thirdBuild = spawnSync(process.execPath, ['scripts/create-release.mjs', '--name', 'release_test', '--version', '0.0.3', '--skip-ui-build', '--skip-validation'], { cwd: temp, encoding: 'utf8' });
  if (thirdBuild.status !== 0) throw new Error(`${thirdBuild.stdout}\n${thirdBuild.stderr}`);

  const thirdRelease = path.join(temp, 'release/release_test-0.0.3');
  if (!fs.existsSync(path.join(thirdRelease, 'README.md'))) fail('resource README.md was not packaged into the release');
  const changesPath = path.join(thirdRelease, 'CHANGES.md');
  if (!fs.existsSync(changesPath)) fail('change log was not generated when enabled');
  const changes = fs.readFileSync(changesPath, 'utf8');
  if (!/## Added[\s\S]*README\.md/.test(changes)) fail('change log did not report the added README.md');
  if (!/## Added[\s\S]*config\/new-feature\.lua/.test(changes)) fail('change log did not report the added Lua file');
  if (!/## Modified[\s\S]*config\/release-test\.json/.test(changes)) fail('change log did not report the modified config file');
  if (!/## Removed[\s\S]*config\/removable\.lua/.test(changes)) fail('change log did not report the removed file');
  if (changes.includes('RELEASE.json') || changes.includes('CHANGES.md')) fail('change log must not report its own release metadata files');

  const thirdMetadata = JSON.parse(fs.readFileSync(path.join(thirdRelease, 'RELEASE.json'), 'utf8'));
  if (thirdMetadata.previousVersion !== '0.0.2') fail('previousVersion metadata did not track the latest prior release');
  if (!thirdMetadata.changeLog || thirdMetadata.changeLog.added < 2) fail('change log summary metadata is missing or incomplete');

  if (!process.exitCode) console.log('[release-test] release package validation passed.');
} catch (error) {
  fail(error.stack || error.message);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
