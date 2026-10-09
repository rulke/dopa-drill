// The game clock stops while the page is hidden. Mobile browsers freeze
// requestAnimationFrame in the background but keep performance.now() running,
// so without this a locked phone came back to an already-expired extra stage
// and a stopwatch inflated by however long the app was away.
//
// core.js samples document/performance at import time, so this file installs
// its own stand-ins before importing it and drives the frame loop by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let wall = 1000;
const listeners = new Map();
const frames = [];

globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (type, fn) => listeners.set(type, fn),
};
globalThis.addEventListener = (type, fn) => listeners.set(type, fn);
globalThis.performance = { now: () => wall };
globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
globalThis.location = { search: '' };

const core = await import('../app/js/core.js');

// Run every callback queued for the next frame at the current wall time.
const step = () => { for (const cb of frames.splice(0)) cb(wall); };
const nextTick = () => new Promise((resolve) => setImmediate(resolve));
function setVisibility(state) {
  document.visibilityState = state;
  listeners.get('visibilitychange')();
}
test('time spent hidden does not count against the game clock', () => {
  wall = 1000;
  assert.equal(core.now(), 1000);

  wall = 5000;
  assert.equal(core.now(), 5000, 'visible time counts');

  setVisibility('hidden');
  wall = 65_000;
  assert.equal(core.now(), 5000, 'the clock is frozen while hidden');

  setVisibility('visible');
  assert.equal(core.now(), 5000, 'and picks up where it stopped');

  wall += 1000;
  assert.equal(core.now(), 6000, 'only the visible second is charged');
});

test('a wait() in flight survives a trip to the background', async () => {
  wall = 200_000;
  setVisibility('visible');
  core.startClock();

  let resolved = false;
  core.wait(1000).then(() => { resolved = true; });

  step();
  assert.equal(resolved, false);

  wall += 400;
  step();
  await nextTick();
  assert.equal(resolved, false, 'still 600ms short');

  // A minute in the background must not resolve the wait early.
  setVisibility('hidden');
  wall += 60_000;
  setVisibility('visible');
  step();
  await nextTick();
  assert.equal(resolved, false, 'the hidden minute is not part of the wait');

  wall += 600;
  step();
  await nextTick();
  assert.equal(resolved, true, 'the remaining 600ms completes it');
});

// Two clocks is how this broke in the first place: a display or a timer still
// reading performance.now() would drift ahead of every wait() once the app had
// been in the background, so keep the raw clock confined to core.js.
test('nothing outside core.js reads the raw wall clock for game timing', () => {
  const files = ['main.js', 'dopakichi.js', 'fx.js', 'bg.js', 'guide.js'];
  for (const f of files) {
    const src = readFileSync(fileURLToPath(new URL(`../app/js/${f}`, import.meta.url)), 'utf8');
    const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /performance\.now\(\)/.test(l));
    assert.equal(hits.length, 0, `${f}:${hits[0] ? hits[0][0] : '?'} should use now() from core.js`);
  }
});
