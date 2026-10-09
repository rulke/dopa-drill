// Tiny gettext-style i18n. Chinese is the source language: the string
// literals in the code ARE the Chinese text and double as lookup keys;
// lang/ja.js and lang/en.js translate them. A missing entry falls back to
// the key itself, so the Chinese UI always renders even if a pack is
// incomplete. {name} placeholders in keys and translations are filled by t().
import { zh } from './lang/zh.js';
import { en } from './lang/en.js';
import { ja } from './lang/ja.js';

const PACKS = { zh, en, ja };

export const LOCALES = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

let locale = 'zh';
let pack = null;

export function setLocale(l) {
  locale = PACKS[l] ? l : 'zh';
  pack = PACKS[locale] || null;
}

export const getLocale = () => locale;

// No saved language yet: a Japanese browser keeps Japanese, everything
// else defaults to Chinese.
export function detectLocale(nav = '') {
  const l = String(nav || '').toLowerCase();
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('en')) return 'en';
  return 'zh';
}

// Look up a string, filling {name} placeholders from `args`. Unfilled
// placeholders stay visible so missed args are easy to spot.
export function t(key, args) {
  const tpl = (pack && pack[key]) || key;
  if (!args || !tpl.includes('{')) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in args ? String(args[k]) : m));
}

// Whether the active pack has an entry (lets callers prefer a specialised
// key but fall back to the generic one for languages without it).
export const has = (key) => !!(pack && pack[key] != null);

const intlLocale = () => (locale === 'en' ? 'en-US' : locale === 'ja' ? 'ja-JP' : 'zh-CN');

// 1,234 grouping for scores, counts and points (identical in zh and ja).
export const fmtNum = (n) => Number(n).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN');

// Shared calendar: 2026年9月 / September 2026, 9月30日 / Sep 30.
const ymCache = {};
export function fmtYearMonth(y, m) { // m: 0-11
  const key = `${locale}:${y}:${m}`;
  return ymCache[key] || (ymCache[key] = new Intl.DateTimeFormat(intlLocale(), { year: 'numeric', month: 'long' }).format(new Date(y, m, 1)));
}
export function fmtMonthDay(m, d) { // m: 1-12
  const key = `${locale}:${m}:${d}`;
  return key in ymCache ? ymCache[key] : (ymCache[key] = new Intl.DateTimeFormat(intlLocale(), { month: 'short', day: 'numeric' }).format(new Date(2024, m - 1, d)));
}

// Swap the marked static text and labels for the active language. Called on
// every language change, not just the first paint: switching back to Chinese has
// to overwrite the English or Japanese that is in the DOM by then. Assigning
// unconditionally is safe because a key with no entry in the pack is the Chinese
// text itself (see t's fallback) - the only keys that must be in every pack are
// the structural ones, and app_i18n.test.mjs holds that invariant.
export function applyDomTexts(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
