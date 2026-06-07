/**
 * Generate PWA icons from an inline SVG matching the Logomark design.
 * Run via:  node scripts/generate-icons.mjs
 *
 * Outputs to public/icons/:
 *   icon-192.png            (standard, any-purpose, 192×192)
 *   icon-512.png            (standard, any-purpose, 512×512)
 *   icon-maskable-192.png   (with safe-zone padding, Android adaptive icons)
 *   icon-maskable-512.png   (same, larger)
 *   apple-touch-icon.png    (180×180 for iOS)
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');

const BRAND_700 = '#1c6878';        // matches --brand-700 in globals.css
const BRAND_300 = '#7ab4be';        // approx --brand-300 dot color
const BG_WHITE = '#ffffff';

// Standard icon — fills the canvas. Used for browser tab favicon & Android any-purpose.
function standardSvg(size) {
  const cx = size / 2;
  const cy = size / 2;
  const cross = size * 0.45;   // length of each cross arm
  const stroke = size * 0.08;  // cross thickness
  const dotR = size * 0.08;
  const r = size * 0.22;       // rounded corner of background square
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="${BRAND_700}"/>
  <line x1="${cx}" y1="${cy - cross / 2}" x2="${cx}" y2="${cy + cross / 2}" stroke="${BG_WHITE}" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${cx - cross / 2}" y1="${cy}" x2="${cx + cross / 2}" y2="${cy}" stroke="${BG_WHITE}" stroke-width="${stroke}" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${BRAND_300}"/>
</svg>`.trim();
}

// Maskable icon — Android adaptive-icon spec requires the artwork to fit
// inside an 80%-diameter "safe zone" because the OS may apply circular,
// rounded-square, etc. masks. Background fills edge-to-edge.
function maskableSvg(size) {
  const cx = size / 2;
  const cy = size / 2;
  const cross = size * 0.32;   // smaller (safe-zone)
  const stroke = size * 0.064;
  const dotR = size * 0.064;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" fill="${BRAND_700}"/>
  <line x1="${cx}" y1="${cy - cross / 2}" x2="${cx}" y2="${cy + cross / 2}" stroke="${BG_WHITE}" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${cx - cross / 2}" y1="${cy}" x2="${cx + cross / 2}" y2="${cy}" stroke="${BG_WHITE}" stroke-width="${stroke}" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${BRAND_300}"/>
</svg>`.trim();
}

async function svgToPng(svg, outPath, size) {
  const png = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(outPath, png);
  console.log(`  wrote ${outPath} (${png.length} bytes)`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  await svgToPng(standardSvg(192), resolve(outDir, 'icon-192.png'), 192);
  await svgToPng(standardSvg(512), resolve(outDir, 'icon-512.png'), 512);
  await svgToPng(maskableSvg(192), resolve(outDir, 'icon-maskable-192.png'), 192);
  await svgToPng(maskableSvg(512), resolve(outDir, 'icon-maskable-512.png'), 512);
  await svgToPng(standardSvg(180), resolve(outDir, 'apple-touch-icon.png'), 180);

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
