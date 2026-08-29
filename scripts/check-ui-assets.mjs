import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const requested = process.argv.slice(2);
const allowedKinds = new Set(['shell', 'mask', 'scale', 'texture', 'illustration', 'icon', 'state-overlay']);
const allowedBehaviors = new Set(['static', 'horizontal-clip', 'vertical-clip', 'mask', 'state-overlay']);
const allowedRuntimeExtensions = new Set(['.png', '.webp', '.svg']);

function normalize(value) {
  return value.replaceAll('\\', '/');
}

function collectManifests(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectManifests(absolute, output);
    else if (entry.name === 'asset-manifest.json') output.push(absolute);
  }
  return output;
}

function isSafeRelative(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return false;
  const normalized = normalize(relativePath);
  return !path.isAbsolute(relativePath)
    && !/^[A-Za-z]:/.test(normalized)
    && !normalized.split('/').includes('..');
}

function pngMetadata(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 26 || buffer.subarray(0, 8).toString('hex') !== signature) return null;
  const colorType = buffer[25];
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    alpha: colorType === 4 || colorType === 6 || buffer.includes(Buffer.from('tRNS')),
  };
}

function webpMetadata(buffer) {
  if (buffer.length < 16 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  let offset = 12;
  let alphaChunk = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'ALPH') alphaChunk = true;
    if (type === 'VP8X' && data + 10 <= buffer.length) {
      const flags = buffer[data];
      const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
      return { width, height, alpha: Boolean(flags & 0x10) || alphaChunk };
    }
    if (type === 'VP8 ' && data + 10 <= buffer.length && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
        alpha: alphaChunk,
      };
    }
    if (type === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
        alpha: true,
      };
    }
    offset = data + size + (size % 2);
  }
  return null;
}

function svgMetadata(content) {
  const tag = content.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const number = (name) => Number(tag.match(new RegExp(`\\b${name}=["']([0-9.]+)(?:px)?["']`, 'i'))?.[1]);
  let width = number('width');
  let height = number('height');
  if (!(width > 0 && height > 0)) {
    const viewBox = tag.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
    width = Number(viewBox?.[1]);
    height = Number(viewBox?.[2]);
  }
  return width > 0 && height > 0 ? { width, height, alpha: true } : null;
}

function imageMetadata(absolute, extension) {
  const buffer = fs.readFileSync(absolute);
  if (extension === '.png') return pngMetadata(buffer);
  if (extension === '.webp') return webpMetadata(buffer);
  if (extension === '.svg') return svgMetadata(buffer.toString('utf8'));
  return null;
}

function report(manifestPath, message) {
  errors.push(`${normalize(path.relative(root, manifestPath))}: ${message}`);
}

const manifests = (requested.length > 0
  ? requested.map((value) => path.resolve(root, value))
  : collectManifests(path.join(root, 'docs', 'ui-spec', 'assets'))
).sort();

for (const manifestPath of manifests) {
  if (!fs.existsSync(manifestPath)) {
    report(manifestPath, 'manifest does not exist.');
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    report(manifestPath, `invalid JSON: ${error.message}`);
    continue;
  }

  if (manifest.schemaVersion !== 1) report(manifestPath, 'schemaVersion must be 1.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.screen ?? '')) report(manifestPath, 'screen must be kebab-case.');
  if (typeof manifest.screen === 'string') {
    const expectedManifest = path.join(root, 'docs', 'ui-spec', 'assets', manifest.screen, 'asset-manifest.json');
    if (path.resolve(manifestPath) !== path.resolve(expectedManifest)) {
      report(manifestPath, `manifest location must be docs/ui-spec/assets/${manifest.screen}/asset-manifest.json.`);
    }
  }
  if (!Number.isInteger(manifest.designCanvas?.width) || manifest.designCanvas.width < 1
      || !Number.isInteger(manifest.designCanvas?.height) || manifest.designCanvas.height < 1) {
    report(manifestPath, 'designCanvas must contain positive integer width and height.');
  }
  if (!Number.isInteger(manifest.budgets?.runtimeBytes) || manifest.budgets.runtimeBytes < 1
      || !Number.isInteger(manifest.budgets?.maxAssetBytes) || manifest.budgets.maxAssetBytes < 1) {
    report(manifestPath, 'budgets must contain positive runtimeBytes and maxAssetBytes.');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    report(manifestPath, 'assets must contain at least one entry.');
    continue;
  }

  const ids = new Set();
  let runtimeBytes = 0;
  for (const asset of manifest.assets) {
    const label = asset?.id || '<missing-id>';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset?.id ?? '')) report(manifestPath, `${label} has an invalid id.`);
    if (ids.has(asset?.id)) report(manifestPath, `${label} is duplicated.`);
    ids.add(asset?.id);
    if (!allowedKinds.has(asset?.kind)) report(manifestPath, `${label} has an unsupported kind.`);
    if (!allowedBehaviors.has(asset?.behavior)) report(manifestPath, `${label} has an unsupported behavior.`);
    if (typeof asset?.alpha !== 'boolean') report(manifestPath, `${label}.alpha must be boolean.`);
    if (asset?.dynamicContentInCode !== true) report(manifestPath, `${label} must keep dynamicContentInCode true.`);
    if (!Number.isInteger(asset?.width) || asset.width < 1 || !Number.isInteger(asset?.height) || asset.height < 1) {
      report(manifestPath, `${label} must declare positive integer width and height.`);
    }
    if (!Number.isInteger(asset?.layer) || asset.layer < 0) report(manifestPath, `${label} must declare a non-negative layer.`);

    for (const key of ['source', 'runtime', 'consumer']) {
      if (!isSafeRelative(asset?.[key])) report(manifestPath, `${label}.${key} must be a safe repository-relative path.`);
    }
    const sourcePrefix = `docs/ui-spec/assets/${manifest.screen}/`;
    const runtimePrefix = `resource/ui/public/assets/${manifest.screen}/`;
    if (typeof asset?.source === 'string' && !normalize(asset.source).startsWith(sourcePrefix)) {
      report(manifestPath, `${label}.source must stay under ${sourcePrefix}`);
    }
    if (typeof asset?.runtime === 'string' && !normalize(asset.runtime).startsWith(runtimePrefix)) {
      report(manifestPath, `${label}.runtime must stay under ${runtimePrefix}`);
    }
    if (typeof asset?.consumer === 'string' && (!normalize(asset.consumer).startsWith('resource/ui/src/') || !asset.consumer.endsWith('.svelte'))) {
      report(manifestPath, `${label}.consumer must reference a Svelte component under resource/ui/src/.`);
    }

    for (const key of ['source', 'runtime', 'consumer']) {
      if (isSafeRelative(asset?.[key]) && !fs.existsSync(path.join(root, asset[key]))) {
        report(manifestPath, `${label}.${key} does not exist: ${normalize(asset[key])}`);
      }
    }

    if (asset?.safeZone) {
      const { x, y, width, height } = asset.safeZone;
      if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1
          || x + width > manifest.designCanvas?.width || y + height > manifest.designCanvas?.height) {
        report(manifestPath, `${label}.safeZone must fit inside designCanvas.`);
      }
    }

    if (!['supplied', 'generated', 'derived', 'authored'].includes(asset?.provenance?.method)) {
      report(manifestPath, `${label}.provenance.method is invalid.`);
    }
    if (asset?.provenance?.method === 'generated' && !(typeof asset.provenance.promptSummary === 'string' && asset.provenance.promptSummary.trim())) {
      report(manifestPath, `${label} generated provenance requires promptSummary.`);
    }
    if (asset?.provenance?.reference !== undefined) {
      if (!isSafeRelative(asset.provenance.reference)) {
        report(manifestPath, `${label}.provenance.reference must be a safe repository-relative path.`);
      } else if (!fs.existsSync(path.join(root, asset.provenance.reference))) {
        report(manifestPath, `${label}.provenance.reference does not exist: ${normalize(asset.provenance.reference)}`);
      }
    }

    if (!isSafeRelative(asset?.runtime)) continue;
    const runtime = path.join(root, asset.runtime);
    if (!fs.existsSync(runtime)) continue;
    const extension = path.extname(runtime).toLowerCase();
    if (!allowedRuntimeExtensions.has(extension)) {
      report(manifestPath, `${label}.runtime must be PNG, WebP, or SVG.`);
      continue;
    }
    const bytes = fs.statSync(runtime).size;
    runtimeBytes += bytes;
    const perAssetBudget = asset.maxBytes ?? manifest.budgets?.maxAssetBytes;
    if (Number.isInteger(perAssetBudget) && bytes > perAssetBudget) {
      report(manifestPath, `${label} is ${bytes} bytes, above its ${perAssetBudget}-byte budget.`);
    }
    const metadata = imageMetadata(runtime, extension);
    if (!metadata) {
      report(manifestPath, `${label} has unreadable image metadata.`);
      continue;
    }
    if (metadata.width !== asset.width || metadata.height !== asset.height) {
      report(manifestPath, `${label} dimensions are ${metadata.width}x${metadata.height}; manifest declares ${asset.width}x${asset.height}.`);
    }
    if (asset.alpha === true && !metadata.alpha) report(manifestPath, `${label} declares alpha but the runtime image has no alpha channel.`);
  }

  if (Number.isInteger(manifest.budgets?.runtimeBytes) && runtimeBytes > manifest.budgets.runtimeBytes) {
    report(manifestPath, `runtime assets total ${runtimeBytes} bytes, above the ${manifest.budgets.runtimeBytes}-byte budget.`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[ui-assets] ${error}`);
  process.exit(1);
}

console.log(`[ui-assets] validated ${manifests.length} manifest(s).`);
