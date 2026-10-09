// i18n core: lookup, interpolation, fallback, detection and the display
// normalisers that rewrite problems saved by the Japanese build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { t, setLocale, getLocale, detectLocale, fmtNum, fmtYearMonth, fmtMonthDay, has } from '../app/js/i18n.js';
import { normText, normWord, displayAnswer } from '../app/js/problems.js';

const html = readFileSync(fileURLToPath(new URL('../app/index.html', import.meta.url)), 'utf8');
const mainJs = readFileSync(fileURLToPath(new URL('../app/js/main.js', import.meta.url)), 'utf8');

test('t() returns the zh source for missing entries and translates via packs', () => {
  assert.equal(getLocale(), 'zh');
  assert.equal(t('返回'), '返回');
  setLocale('ja');
  assert.equal(t('返回'), 'もどる');
  setLocale('en');
  assert.equal(t('返回'), 'Back');
  setLocale('zh');
});

test('t() fills {name} placeholders and keeps unknown languages on zh', () => {
  assert.equal(t('{g}年级', { g: 3 }), '3年级');
  setLocale('en');
  assert.equal(t('{g}年级', { g: 3 }), 'Grade 3');
  setLocale('xx');
  assert.equal(getLocale(), 'zh');
  setLocale('zh');
});

test('detectLocale: Japanese browsers stay Japanese, the rest default to Chinese', () => {
  assert.equal(detectLocale('ja-JP'), 'ja');
  assert.equal(detectLocale('en-US'), 'en');
  assert.equal(detectLocale('zh-CN'), 'zh');
  assert.equal(detectLocale('fr'), 'zh');
  assert.equal(detectLocale(''), 'zh');
});

test('numbers and calendar dates follow the locale', () => {
  assert.equal(fmtNum(12345), '12,345');
  setLocale('en');
  assert.equal(fmtYearMonth(2026, 8), 'September 2026');
  assert.equal(fmtMonthDay(9, 30), 'Sep 30');
  setLocale('zh');
  assert.equal(fmtYearMonth(2026, 8), '2026年9月');
  assert.equal(fmtMonthDay(9, 30), '9月30日');
  setLocale('ja');
  assert.equal(fmtYearMonth(2026, 8), '2026年9月');
  setLocale('zh');
});

test('has() reports pack coverage for structural keys', () => {
  assert.ok(has('weekday.0'));
  assert.ok(!has('返回')); // zh source keys are not in the zh pack
  setLocale('en');
  assert.ok(has('返回'));
  setLocale('zh');
});

// applyDomTexts assigns t(key) to every marked element, and t falls back to the
// key itself. That only holds while every key that is NOT Chinese source text
// has a zh entry - otherwise switching back to Chinese would print the raw key
// ("grade.1") into the interface. The old code hid that behind a `has()` guard,
// which also meant switching back to Chinese never restored anything.
test('every data-i18n key resolves to real Chinese', async () => {
  const { zh } = await import('../app/js/lang/zh.js');
  for (const lang of ['en', 'ja']) {
    const pack = (await import(`../app/js/lang/${lang}.js`))[lang];
    for (const key of Object.keys(zh)) {
      assert.ok(key in pack, `${lang} pack is missing the structural key "${key}"`);
    }
  }

  // A marked element must either carry its own Chinese text, or name a key the
  // zh pack defines. Anything else renders as the bare key.
  const offenders = [];
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*?)data-i18n="([^"]+)"([^>]*?)>([^<]*)</gi)) {
    const [, tag, , key, , inner] = m;
    const text = inner.trim();
    if (!text) continue;                 // filled in by a script after load
    if (!(key in zh) && text !== key) offenders.push(`<${tag} data-i18n="${key}">${text}`);
  }
  assert.deepEqual(offenders, [], `key is neither the Chinese text nor in the zh pack: ${offenders.join(', ')}`);
});

test('normText rewrites legacy Japanese wording for display', () => {
  setLocale('zh');
  assert.equal(normText('たしざん'), '加法');
  assert.equal(normText('一の位'), '个位');
  assert.equal(normText('商の十の位'), '商的十位');
  assert.equal(normText('5のだん 5 10 15'), '5的口诀 5 10 15');
  assert.equal(normText('35の中に5はいくつ'), '35里有几个5');
  assert.equal(normText('12345を千の位までのがい数に'), '把12345四舍五入到千位');
  assert.equal(normText('12 + 34'), '12 + 34'); // neutral text passes through
  setLocale('ja');
  assert.equal(normText('商的十位'), '商の十の位');
  setLocale('zh');
});

test('normWord handles the legacy compose reading of は', () => {
  setLocale('zh');
  assert.equal(normWord('は', { title: 'いくつといくつ' }), '可以分成');
  assert.equal(normWord('は', { title: 'ぶんすう' }), '是');
  assert.equal(normWord('あまり'), '余');
  setLocale('en');
  assert.equal(normWord('あまり'), 'r');
  assert.equal(normWord('可以分成', { title: '几和几' }), '=');
  assert.equal(normWord('和', { title: '几和几' }), '+');
  assert.equal(normWord('和', { title: '最大公因数' }), 'and');
  setLocale('zh');
});

test('displayAnswer converts remainders and mixed numbers', () => {
  setLocale('zh');
  assert.equal(displayAnswer('7 余 3'), '7余3');
  assert.equal(displayAnswer('7 あまり 3'), '7余3'); // legacy ja save
  assert.equal(displayAnswer('12.5'), '12.5');
  setLocale('ja');
  assert.equal(displayAnswer('7 余 3'), '7 あまり 3');
  setLocale('en');
  assert.equal(displayAnswer('7 余 3'), '7 r 3');
  setLocale('zh');
});

// The settings dialog holds two radiogroups that share the `.pick` class, and
// the problem-count code reads the checked button by selector. When both used
// the bare class, clicking a language stored `count: NaN` and the next play
// read the language button instead, leaving S.N = NaN and a blank problem card.
test('problem count and language radiogroups never share a selector', () => {
  assert.match(html, /class="pick count-pick"/);
  assert.match(html, /class="pick lang-pick"/);
  // No settings lookup may fall back to the bare `.pick` group.
  assert.doesNotMatch(mainJs, /[$(]\$\$?\('\.pick\b(?![\w-])/);
  assert.match(mainJs, /\.count-pick \[aria-checked="true"\]/);
});

test('setCount keeps exactly one button checked for a stale or corrupt save', () => {
  // The clamping itself is DOM-bound, so assert the guard the fix relies on.
  assert.match(mainJs, /const counts = \$\$?\('\.count-pick button'\)/);
  assert.match(mainJs, /counts\.includes\(Number\(n\)\)/);
});

// `t` is the translator, so any local that rebinds the name shadows it. A
// shadowed `t` throws a TDZ ReferenceError, which used to freeze the game
// silently (see core.js keeping the frame loop alive).
test('no scope rebinds the translator name t', () => {
  const files = ['main.js', 'guide.js', 'session.js', 'problems.js', 'scoring.js', 'skills.js', 'trophies.js', 'unlocks.js', 'quests.js', 'growth.js'];
  const binds = [
    /\b(?:const|let|var)\s+t\s*=/,
    /function\s*\w*\s*\([^)]*\bt\b[^)]*\)/,
    /\(\s*[^)]*\bt\b[^)]*\)\s*=>/,
    /for\s*\(\s*(?:const|let|var)\s+t\s+of\b/,
    /catch\s*\(\s*t\s*\)/,
  ];
  for (const f of files) {
    const src = readFileSync(fileURLToPath(new URL(`../app/js/${f}`, import.meta.url)), 'utf8');
    const lines = src.split('\n');
    const calls = lines.map((l, i) => [i, l]).filter(([, l]) => /(?<![A-Za-z0-9_$.'])t\s*\(/.test(l));
    for (const [i, line] of lines.entries()) {
      if (!binds.some((rx) => rx.test(line))) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) if (/^\}/.test(lines[j])) { end = j; break; }
      const clash = calls.find(([c]) => c > i && c < end);
      assert.equal(clash, undefined, `${f}:${i + 1} rebinds t but calls t() at line ${clash ? clash[0] + 1 : '?'}`);
    }
  }
});
