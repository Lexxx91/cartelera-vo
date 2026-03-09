/**
 * VOSE PWA Icon & Splash Screen Generator
 * Generates all required PWA icons and iOS splash screens from SVG templates.
 *
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const ICONS_DIR = join(PUBLIC, 'icons');
const SPLASH_DIR = join(PUBLIC, 'splash');

// Ensure directories exist
mkdirSync(ICONS_DIR, { recursive: true });
mkdirSync(SPLASH_DIR, { recursive: true });

// ── SVG Template: Standard Icon ─────────────────────────────────────────
function logoSvg(size, { maskable = false } = {}) {
  // For maskable icons, use 80% safe zone (text smaller, more padding)
  const fontSize = maskable ? size * 0.28 : size * 0.36;
  const cx = size / 2;
  const cy = size / 2 + fontSize * 0.12; // slight vertical adjustment for caps baseline
  const rx = maskable ? 0 : size * 0.15; // rounded corners for standard icons

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000000" rx="${rx}" ry="${rx}"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
    font-family="'Arial Black', 'Impact', 'Helvetica Neue', sans-serif"
    font-size="${fontSize}" font-weight="900" letter-spacing="${fontSize * 0.02}">
    <tspan fill="#ffffff">VO</tspan><tspan fill="#ff3b3b">SE</tspan>
  </text>
</svg>`;
}

// ── SVG Template: Favicon (just "V" at tiny size) ───────────────────────
function faviconSvg(size) {
  const fontSize = size * 0.65;
  const cx = size / 2;
  const cy = size / 2 + fontSize * 0.1;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000000" rx="${size * 0.15}" ry="${size * 0.15}"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
    font-family="'Arial Black', 'Impact', 'Helvetica Neue', sans-serif"
    font-size="${fontSize}" font-weight="900" fill="#ffffff">V</text>
</svg>`;
}

// ── SVG Template: Splash Screen ─────────────────────────────────────────
function splashSvg(w, h) {
  const logoSize = Math.min(w, h) * 0.14;
  const cx = w / 2;
  const cy = h * 0.43;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#000000"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
    font-family="'Arial Black', 'Impact', 'Helvetica Neue', sans-serif"
    font-size="${logoSize}" font-weight="900" letter-spacing="${logoSize * 0.02}">
    <tspan fill="#ffffff">VO</tspan><tspan fill="#ff3b3b">SE</tspan>
  </text>
  <text x="${cx}" y="${cy + logoSize * 1.1}" text-anchor="middle"
    font-family="'Helvetica Neue', 'Arial', sans-serif"
    font-size="${logoSize * 0.2}" font-weight="300" letter-spacing="${logoSize * 0.01}"
    fill="rgba(255,255,255,0.4)">Tu app de cine social</text>
</svg>`;
}

// ── Generate Standard Icons ─────────────────────────────────────────────
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('Generating standard icons...');
for (const size of ICON_SIZES) {
  const svg = Buffer.from(logoSvg(size));
  await sharp(svg).png().toFile(join(ICONS_DIR, `icon-${size}x${size}.png`));
  console.log(`  ✓ icon-${size}x${size}.png`);
}

// ── Generate Apple Touch Icon ───────────────────────────────────────────
console.log('Generating Apple touch icon...');
const appleSvg = Buffer.from(logoSvg(180));
await sharp(appleSvg).png().toFile(join(ICONS_DIR, 'apple-touch-icon.png'));
console.log('  ✓ apple-touch-icon.png (180x180)');

// ── Generate Maskable Icon ──────────────────────────────────────────────
console.log('Generating maskable icon...');
const maskableSvg = Buffer.from(logoSvg(512, { maskable: true }));
await sharp(maskableSvg).png().toFile(join(ICONS_DIR, 'icon-maskable-512x512.png'));
console.log('  ✓ icon-maskable-512x512.png (512x512, safe zone)');

// ── Generate Favicon ────────────────────────────────────────────────────
console.log('Generating favicon...');
const favSvg = Buffer.from(faviconSvg(32));
await sharp(favSvg).png().toFile(join(PUBLIC, 'favicon.ico'));
console.log('  ✓ favicon.ico (32x32)');

// ── Generate iOS Splash Screens ─────────────────────────────────────────
const SPLASH_SIZES = [
  [640, 1136],   // iPhone SE
  [750, 1334],   // iPhone 8
  [1170, 2532],  // iPhone X/11/12/13/14
  [1290, 2796],  // iPhone 14 Pro Max / 15
  [1668, 2388],  // iPad
];

console.log('Generating iOS splash screens...');
for (const [w, h] of SPLASH_SIZES) {
  const svg = Buffer.from(splashSvg(w, h));
  await sharp(svg).png().toFile(join(SPLASH_DIR, `splash-${w}x${h}.png`));
  console.log(`  ✓ splash-${w}x${h}.png`);
}

console.log('\n✅ All icons and splash screens generated successfully!');
