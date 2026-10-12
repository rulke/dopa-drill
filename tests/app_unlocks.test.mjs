// Unlockable show (id041-id044).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, ITEMS, ITEM, pickLook, unlockedIn, isUnlocked, defaultEquip, variant } from '../app/js/unlocks.js';
import { TROPHY } from '../app/js/trophies.js';
import { readFileSync } from 'node:fs';

test('catalogue: one base item per category, rewards point at real trophies, no trophy gives two', () => {
  for (const c of CATS) assert.equal(ITEMS.filter((it) => it.cat === c.key && it.base).length, 1, c.key);
  const seen = new Set();
  for (const it of ITEMS.filter((x) => !x.base)) {
    assert.ok(TROPHY[it.trophy], `${it.id} -> ${it.trophy}`);
    assert.equal(TROPHY[it.trophy].reward, it.id);
    assert.ok(!seen.has(it.trophy), `${it.trophy} used twice`); seen.add(it.trophy);
  }
  assert.equal(new Set(ITEMS.map((it) => it.id)).size, ITEMS.length);
  for (const c of CATS) assert.ok(ITEMS.filter((it) => it.cat === c.key).length >= 2, `${c.key} has a variant`);
});

test('the look: fixed choices stay, auto picks among unlocked ones only', () => {
  const got = { 'days-1': 1, 'streak-3': 1 };
  assert.ok(isUnlocked(ITEM['costume:cap'], got));
  assert.ok(!isUnlocked(ITEM['color:blue'], got));
  assert.deepEqual(unlockedIn('bg', got).map((it) => it.id), ['bg:classic', 'bg:night']);
  const eq = { ...defaultEquip(), bg: 'bg:night', color: 'color:blue' }; // blue is not unlocked: falls back to auto
  const seenBg = new Set(); const seenCostume = new Set();
  let r = 0;
  const rng = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  for (let i = 0; i < 40; i++) {
    const look = pickLook(eq, got, rng);
    seenBg.add(look.bg); seenCostume.add(look.costume);
    assert.equal(look.color, 'color:pink');
    for (const c of CATS) assert.ok(isUnlocked(ITEM[look[c.key]], got));
  }
  assert.deepEqual([...seenBg], ['bg:night']);
  assert.deepEqual([...seenCostume].sort(), ['costume:cap', 'costume:none']);
  assert.equal(variant('bg:night'), 'night');
});

// ------------------------------------------------- the collection's tab strip
// Eight categories do not fit one row on a phone. The strip used to be a hidden
// horizontal scroller, which is reachable by touch but not by a wheel or a mouse
// drag - 多巴奇的颜色, 观众 and 谢幕 were simply unopenable on a desktop, and two of
// the endless rewards live behind those tabs. Wrapping is the fix; this keeps it.
test('the category strip wraps instead of hiding tabs off the edge', () => {
  const css = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');
  const rule = css.match(/^\.co-tabs \{[^}]*\}/m);
  assert.ok(rule, 'the tab strip rule went missing');
  assert.match(rule[0], /flex-wrap:\s*wrap/, 'the strip must wrap: a hidden horizontal scroller cannot be used with a mouse');
  assert.doesNotMatch(rule[0], /overflow-x:\s*(auto|scroll|hidden)/, 'and must not rely on scrolling sideways');
});

test('the two longest tab labels have a short form', () => {
  // The full names still go to the banner, the reward toasts and the docs.
  for (const key of ['mark', 'color']) {
    const cat = CATS.find((c) => c.key === key);
    assert.ok(cat, `no ${key} category`);
    assert.ok(cat.short, `${cat.name} needs a short label or it pushes the row over`);
    assert.ok(cat.short.length < cat.name.length);
  }
});
