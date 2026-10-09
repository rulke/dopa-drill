#!/usr/bin/env node
// Rasterise the app icons from app/icon.svg into the PNG sizes the stores and
// the web app manifest ask for. Android also gets a maskable variant: the
// mascot sits inside the safe zone so a round or squircle launcher crop never
// clips its ears.
//   cd tools && npm i          (once: @resvg/resvg-js)
//   node build_icons.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const outDir = join(app, 'icons');

// The source art is a wide 220x100 viewBox of the mascot's head. An icon canvas
// is square, so the head is placed on a coloured field; these two factors put it
// at 72% width for a normal icon and 56% for the maskable one, which keeps it
// inside Android's guaranteed-visible circle.
const PAPER = '#fff8ec';
const BLUE = '#3b6bff';

const inner = readFileSync(join(app, 'icon.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>[\s\S]*$/, '')
  .trim();

// viewBox of the source art.
const ART = { x: -110, y: -155, w: 220, h: 100 };

function iconSvg(size, { width = 0.72, bg = PAPER, rounded = false } = {}) {
  const artW = size * width;
  const artH = artW * (ART.h / ART.w);
  const x = (size - artW) / 2;
  const y = (size - artH) / 2;
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/>
  <g transform="translate(${x} ${y}) scale(${artW / ART.w}) translate(${-ART.x} ${-ART.y})">${inner}</g>
</svg>`;
}

function write(name, svg) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: Number(/width="(\d+)"/.exec(svg)[1]) } }).render().asPng();
  writeFileSync(join(outDir, name), png);
  console.log(`${name}: ${(png.length / 1024).toFixed(1)} KiB`);
}

mkdirSync(outDir, { recursive: true });
// Home screen / store listings: the mascot on the paper colour, rounded to sit
// like an app tile on platforms that do not crop it themselves.
write('icon-192.png', iconSvg(192, { rounded: true }));
write('icon-512.png', iconSvg(512, { rounded: true }));
// Maskable: full-bleed blue, art inside the safe zone, no rounding of our own.
write('icon-maskable-512.png', iconSvg(512, { width: 0.56, bg: BLUE }));
// iOS ignores the manifest icons and uses apple-touch-icon.
write('apple-touch-icon-180.png', iconSvg(180, { rounded: false }));
console.log(`icons written to ${outDir}`);
