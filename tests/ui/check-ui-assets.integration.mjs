import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const checker = path.join(repositoryRoot, 'scripts', 'check-ui-assets.mjs');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fivem-ui-assets-'));
const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XfZVAAAAAElFTkSuQmCC', 'base64');

function write(relative, content) {
  const absolute = path.join(fixtureRoot, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function run() {
  return spawnSync(process.execPath, [checker], { cwd: fixtureRoot, encoding: 'utf8' });
}

const manifestPath = 'docs/ui-spec/assets/test-hud/asset-manifest.json';
const manifest = {
  schemaVersion: 1,
  screen: 'test-hud',
  designCanvas: { width: 2560, height: 1440 },
  budgets: { runtimeBytes: 4096, maxAssetBytes: 2048 },
  assets: [{
    id: 'test-shell',
    kind: 'shell',
    source: 'docs/ui-spec/assets/test-hud/source/test-shell.png',
    runtime: 'resource/ui/public/assets/test-hud/test-shell.png',
    consumer: 'resource/ui/src/lib/TestHud.svelte',
    width: 1,
    height: 1,
    alpha: true,
    behavior: 'static',
    layer: 0,
    dynamicContentInCode: true,
    safeZone: { x: 0, y: 0, width: 1, height: 1 },
    provenance: { method: 'generated', promptSummary: 'Empty transparent HUD shell.' }
  }]
};

try {
  write('docs/ui-spec/assets/test-hud/source/test-shell.png', transparentPng);
  write('resource/ui/public/assets/test-hud/test-shell.png', transparentPng);
  write('resource/ui/src/lib/TestHud.svelte', '<div></div>\n');
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const valid = run();
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);

  manifest.assets[0].dynamicContentInCode = false;
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const dynamicText = run();
  assert.notEqual(dynamicText.status, 0);
  assert.match(dynamicText.stderr, /dynamicContentInCode true/);

  manifest.assets[0].dynamicContentInCode = true;
  manifest.budgets.maxAssetBytes = 10;
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const oversized = run();
  assert.notEqual(oversized.status, 0);
  assert.match(oversized.stderr, /above its 10-byte budget/);

  manifest.budgets.maxAssetBytes = 2048;
  manifest.assets[0].runtime = 'resource/ui/public/assets/test-hud/missing.png';
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const missing = run();
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /does not exist/);

  console.log('[ui-assets-test] manifest validation scenarios passed.');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
