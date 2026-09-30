#!/usr/bin/env node
// Rebuild the subset WOFF2 fonts for the Chinese UI from the @fontsource
// packages (OFL-licensed Google Fonts). The Japanese subsets are committed
// and only need a rebuild when Japanese wording changes.
//   cd tools && npm i                       (once: subset-font, fontkit, @fontsource/*)
//   node build_fonts.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import * as fontkit from 'fontkit';
import { collectKeys } from './check-i18n.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');

const SOURCES = {
  'zcool-kuaile': 'zcool-kuaile/files/zcool-kuaile-chinese-simplified-400-normal.woff2',
  'zcool-qingke-huangyou': 'zcool-qingke-huangyou/files/zcool-qingke-huangyou-chinese-simplified-400-normal.woff2',
};

// Characters every font carries regardless of language: ASCII, full-width
// digits and operators, CJK punctuation.
const BASE = new Set([...Array(0x7f).keys()].map((c) => String.fromCharCode(c)));
for (const ch of '０１２３４５６７８９＋−×÷＝、。！？「」（）；：～…％·—') BASE.add(ch);

const charsOf = (text) => new Set([...text].filter((c) => c.charCodeAt(0) >= 0x20));

async function main() {
  // Chinese font charset: exactly the strings the app can render — the
  // audited i18n keys plus the pack values (comments and the legacy
  // Japanese rewrite table never render, so they stay out of the subset).
  const { zh } = await import('file://' + join(app, 'js', 'lang', 'zh.js').replace(/\\/g, '/'));
  const { en } = await import('file://' + join(app, 'js', 'lang', 'en.js').replace(/\\/g, '/'));
  const text = [...BASE, ...collectKeys(), ...charsOf(Object.values(zh).join('')), ...charsOf(Object.values(en).join(''))];
  const chars = [...new Set(text)].sort();

  for (const [name, rel] of Object.entries(SOURCES)) {
    const src = readFileSync(join(root, 'tools', 'node_modules', '@fontsource', rel));
    const out = await subsetFont(src, chars.join(''), { targetFormat: 'woff2' });
    const outPath = join(app, 'fonts', `${name}.woff2`);
    writeFileSync(outPath, out);
    // Coverage check: every requested CJK char must exist in the subset.
    const font = fontkit.openSync(outPath);
    const missing = chars.filter((c) => c.charCodeAt(0) > 0x2e7f && !font.hasGlyphForCodePoint(c.charCodeAt(0)));
    console.log(`${name}.woff2: ${(out.length / 1024).toFixed(0)} KiB, ${chars.length} chars, missing CJK: ${missing.length ? missing.join('') : 'none'}`);
    if (missing.length) process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
