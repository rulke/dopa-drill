// Placement regressions use the reviewer's actual pc-4 geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankGuideSpots, guidePages } from '../app/js/guide.js';

const card = { left: 460, top: 452.4, right: 820, bottom: 663.4 };
const hole = { left: 443, top: 371.4, right: 643.6, bottom: 433.4 };
const scene = { obstacles: [card, hole], labels: [], width: 1280, height: 800 };
const spot = (id, bounds, distance = 100) => ({ id, bounds, distance });
const old = spot('old', { left: 659.9, top: 345.4, right: 809.6, bottom: 455.2 });
const left = spot('left', { left: 266, top: 345.4, right: 416, bottom: 455.2 }, 200);

test('pc-4 chooses empty left space instead of the recorded caption overlap', () => {
  const ranked = rankGuideSpots([old, left], scene);
  assert.equal(ranked[0].id, 'left');
  assert.equal(ranked[0].hard, 0);
  assert.ok(ranked[1].hard > 0);
});

test('12px clearance plus breathing reserve outranks any soft preference', () => {
  const near = spot('near', { left: 660, top: 200, right: 810, bottom: 300 }, 0);
  const far = spot('far', { left: 900, top: 200, right: 1050, bottom: 300 }, 10000);
  const options = { ...scene, obstacles: [{ left: 460, top: 320, right: 820, bottom: 400 }] };
  assert.equal(rankGuideSpots([near], options)[0].hard, 0);
  near.bounds.bottom += 0.1;
  const ranked = rankGuideSpots([near, far], { ...options, labels: [far.bounds] });
  assert.equal(ranked[0].id, 'far');
  assert.equal(ranked[0].hard, 0);
  assert.ok(ranked[1].hard > 0);
});

test('title label coverage breaks ties between collision-free positions', () => {
  const right = spot('right', { left: 900, top: 345, right: 1050, bottom: 455 }, 100);
  assert.equal(rankGuideSpots([left, right], scene)[0].id, 'right');
  assert.equal(rankGuideSpots([left, right], { ...scene, labels: [right.bounds] })[0].id, 'left');
});

test('phone placement rejects side positions outside the viewport', () => {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    const phone = { width, height, labels: [], obstacles: [{ left: 10, top: 290, right: width - 10, bottom: 410 }, { left: 16, top: 440, right: width - 16, bottom: 620 }] };
    const above = spot('above', { left: 120, top: 125, right: 245, bottom: 245 });
    const outside = spot('right', { left: width - 20, top: 260, right: width + 100, bottom: 375 }, 0);
    assert.equal(rankGuideSpots([outside, above], phone)[0].id, 'above');
    assert.equal(rankGuideSpots([above], phone)[0].hard, 0);
  }
});

// ------------------------------------------------- the tour's page list
// The tour is the only place the title screen's entries are explained, and it
// reaches t() through page objects, so nothing about it is visible to the
// ordinary key scan. 无尽挑战 and 成长 sat on the title screen for two releases
// without a page; these checks make the next entry that goes unmentioned fail
// here instead.
test('the "?" tour has a page for every entry the title screen offers', async () => {
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const modes = html.slice(html.indexOf('id="modes"'), html.indexOf('id="quests"'));
  // Match the whole tag: `hidden` comes after the id, so a matcher that stops at
  // the id cannot see it and would demand a page for the review button.
  const buttons = [...modes.matchAll(/<button\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => !/\bhidden\b/.test(tag))
    .map((tag) => (tag.match(/\bid="([a-z-]+)"/) || [])[1])
    .filter(Boolean);
  assert.ok(buttons.length >= 5, `only found ${buttons.join(',')} in .modes`);
  const targets = new Set(guidePages(true).map((p) => p.target));
  for (const id of buttons) {
    assert.ok(targets.has(`#${id}`), `#${id} is on the title screen but the "?" tour never mentions it`);
  }
});

test('every page target is an element that exists', () => {
  const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  for (const page of [...guidePages(false), ...guidePages(true)]) {
    if (!page.target) continue;
    const attr = page.target.startsWith('#') ? `id="${page.target.slice(1)}"` : `class="${page.target.slice(1)}"`;
    assert.ok(html.includes(attr), `${page.target} is not in index.html`);
  }
});

test('the first run stays short and the new pages belong to the "?" only', () => {
  assert.equal(guidePages(false).length, 5, 'a first launch must not become a long tour');
  assert.equal(guidePages(true).length, 9);
  for (const target of ['#endless', '#open-growth']) {
    assert.ok(!guidePages(false).some((p) => p.target === target), `${target} must not be in the first run`);
    assert.ok(guidePages(true).some((p) => p.target === target));
  }
  // The tour order has to match the screen, or the spotlight jumps around it.
  const order = guidePages(true).map((p) => p.target).filter(Boolean);
  assert.deepEqual(order, ['#start', '#endless', '.grades', '#open-tree', '#open-trophy', '#open-collect', '#open-growth', '#start']);
});

test('every caption the tour shows is translated', async () => {
  const { en } = await import('../app/js/lang/en.js');
  const { ja } = await import('../app/js/lang/ja.js');
  for (const page of [...guidePages(false), ...guidePages(true)]) {
    for (const key of [page.title, page.text]) {
      assert.equal(typeof en[key], 'string', `no English for ${JSON.stringify(key)}`);
      assert.equal(typeof ja[key], 'string', `no Japanese for ${JSON.stringify(key)}`);
    }
  }
});
