#!/usr/bin/env node
// Audits the language packs: every t() key, HTML data-i18n key, data name and
// problem template used by the app must have an entry in the en and ja packs.
// Run: node tools/check-i18n.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { en } from '../app/js/lang/en.js';
import { ja } from '../app/js/lang/ja.js';
import { zh } from '../app/js/lang/zh.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');

export function collectKeys() {
  return buildKeys();
}

function buildKeys() {
  const keys = new Set();

for (const f of readdirSync(join(app, 'js')).filter((f) => f.endsWith('.js') && !f.startsWith('i18n'))) {
  const s = readFileSync(join(app, 'js', f), 'utf8');
  for (const m of s.matchAll(/\bt\('([^']+)'/g)) keys.add(m[1]);
}
const html = readFileSync(join(app, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) keys.add(m[1]);

for (const f of ['skills.js', 'unlocks.js']) {
  const s = readFileSync(join(app, 'js', f), 'utf8');
  for (const m of s.matchAll(/\bname: '([^']+)'/g)) keys.add(m[1]);
}
const skills = readFileSync(join(app, 'js', 'skills.js'), 'utf8');
keys.add(...skills.match(/LANES = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1)));

const problems = readFileSync(join(app, 'js', 'problems.js'), 'utf8');
for (const m of problems.matchAll(/tpl: '([^']+)'|PLACE = \[([^\]]+)\]|DEC_PLACE = \[([^\]]+)\]|title: '([^']+)'|w: '([^']+)'|label: '([^']+)'|help: '([^']+)'|(?:text|help): `([^`]+)`/g)) {
  const v = Object.values(m).slice(1).find(Boolean);
  if (!v || v.includes('${')) continue; // runtime expressions are not keys
  const quoted = v.match(/'([^']+)'/g);
  if (quoted) quoted.forEach((k) => keys.add(k.slice(1, -1)));
  else keys.add(v);
}
const trophies = readFileSync(join(app, 'js', 'trophies.js'), 'utf8');
for (const m of trophies.matchAll(/title: '([^']+)'|cat: '([^']+)'/g)) keys.add(m[1] || m[2]);
const scoring = readFileSync(join(app, 'js', 'scoring.js'), 'utf8');
for (const m of scoring.matchAll(/\[\d+, '([^']+)'\]/g)) keys.add(m[1]);

// Keys that only appear through variables (guide pages, caps, marks).
keys.add('正确', '100分', '100分！', '多巴胺口算', '怎么玩', '我的等级', '技能树', '奖杯', '收藏', '复习', '练习', '演示', '口算');
for (const k of [
  '题目有3种\n选择方式哦', '适合现在水平的题目。\n先从实力测试开始', '1年级～6年级', '按年级集中练习\n各类题目',
  '选一道想练的题目\n开始练习', '边玩边收集。\n坚持玩会越攒越多', '用奖杯奖励兑换的\n背景、音乐、装扮等\n都可以在这里选择',
  '犹豫就选我的等级！', '本说明随时可以\n用？再看一遍', '本说明随时可以', '再看一遍', '推荐',
]) keys.add(k);

  return keys;
}

const keys = buildKeys();
const missing = { en: [], ja: [] };
for (const k of keys) {
  if (!(k in en)) missing.en.push(k);
  if (!(k in ja)) missing.ja.push(k);
}
const empty = { en: [], ja: [], zh: [] };
for (const [name, pack] of Object.entries({ en, ja, zh })) {
  for (const [k, v] of Object.entries(pack)) {
    if (typeof v !== 'string') { empty[name].push(`${k} (not a string)`); continue; }
    if (v.trim() === '' && !['题', '把'].includes(k)) empty[name].push(k);
  }
}
const zhOnly = Object.keys(zh).filter((k) => !['logo.top', 'logo.ribbon', ...Array.from({ length: 7 }, (_, i) => `weekday.${i}`), ...Array.from({ length: 6 }, (_, i) => `grade.${i + 1}`)].includes(k));

let bad = 0;
for (const [name, list] of Object.entries(missing)) {
  if (list.length) { bad = 1; console.error(`MISSING in ${name} (${list.length}):`); list.forEach((k) => console.error('  ' + JSON.stringify(k))); }
}
for (const [name, list] of Object.entries(empty)) {
  if (list.length) { bad = 1; console.error(`EMPTY/BAD values in ${name}:`); list.forEach((k) => console.error('  ' + k)); }
}
if (zhOnly.length) { bad = 1; console.error('Unexpected keys in zh pack:', zhOnly); }
console.log(`checked ${keys.size} keys against en/ja`);
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].split(/[\\/]/).pop();
if (isMain) process.exit(bad);
