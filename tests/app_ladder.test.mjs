// The show's ladder is an agreement between five files. endless.js names the rung
// a wave stands on, main.js applies it, and style.css, index.html and audio.js
// each have to answer for it. Nothing checks that agreement at runtime, and the
// failure is invisible: a rung that only some of them know about is not an error,
// it is a level that looks and sounds exactly like the one below it. A screenshot
// of rung 14 tells you nothing about whether 13 fired.
//
// So the contract is asserted here, from the outside, against the real files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SONGS, AudioEngine } from '../app/js/audio.js';
import { TIER_MAX, BASE_TIER, tierOf } from '../app/js/endless.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const css = read('app/style.css');
const html = read('app/index.html');
const main = read('app/js/main.js');

const declaredMax = () => {
  const m = main.match(/const LEVEL_MAX = (\d+);/);
  assert.ok(m, 'main.js must declare LEVEL_MAX');
  return Number(m[1]);
};

test('the ladder has one ceiling and both ends agree on it', () => {
  // main.js decides what the CSS is asked for; endless.js decides how far a run
  // climbs. If endless names a rung main.js has no class for, the last waves of a
  // run are silent.
  assert.equal(declaredMax(), TIER_MAX, 'main.js and endless.js disagree about the ceiling');
  assert.ok(TIER_MAX > BASE_TIER, 'the new rungs must be above a basic set');
});

test('the ceiling is tall enough for the run that climbs it', () => {
  let top = 0;
  for (let w = 1; w <= 500; w++) top = Math.max(top, tierOf(w));
  assert.equal(top, TIER_MAX, 'an endless run must be able to reach the top rung');
  assert.ok(top <= declaredMax(), 'and main.js must be able to render it');
});

test('every rung above a basic set has something new to show', () => {
  for (let L = BASE_TIER; L <= TIER_MAX; L++) {
    assert.match(css, new RegExp(`body\\.lv${L}\\b`),
      `rung ${L} has no CSS of its own, so it looks exactly like rung ${L - 1}`);
  }
});

test('the pieces those rungs style are actually rendered', () => {
  for (const piece of ['class="lights"', 'class="rain"', 'spot-l2', 'spot-r2', 'beat-flash']) {
    assert.ok(html.includes(piece), `${piece} is styled in style.css but never rendered`);
  }
  // The footlights are built at runtime; each bulb carries its own place in the
  // chase, and without it the string blinks as one instead of running.
  assert.match(main, /\$\('#lights'\)/, 'nothing builds the footlights');
  assert.match(main, /--i:\$\{i\}/, 'the bulbs are not given a place in the chase');
});

test('reduce-motion drops what moves and keeps what shows', () => {
  for (const sel of ['.lights i', '.rain', '.beat-flash']) {
    assert.ok(css.includes(`body.reduced ${sel}`),
      `${sel} keeps moving for a player who asked it to stop`);
  }
});

test('the show is keyed to the rung, not to the intensity', () => {
  // Both of these were fed E until the new rungs existed. An endless run's E
  // starts above every one of their thresholds, so the house was full and the
  // confetti mix was complete on the first problem - and every rung after it had
  // nothing left to add. The rung is the only number that keeps climbing.
  assert.ok(!/ensureCrowd\(S\.E\)/.test(main), 'the crowd still reads the intensity');
  assert.ok(!/burstKinds\(E\)/.test(main), 'the confetti mix still reads the intensity');
  assert.match(main, /ensureCrowd\(L\)/, 'the crowd must be filled by the rung');
  assert.match(main, /burstKinds\(S\.level\)/, 'the confetti mix must be chosen by the rung');
});

test('the rung a mode names is the rung that gets applied', () => {
  // The wiring, end to end, because it is the part a screenshot cannot check:
  // two rungs look alike only when this chain is broken somewhere, and a broken
  // chain still renders *a* level - just the wrong one.
  assert.match(main, /function applyLevel\(E, \{ key, bpm, tier \} = \{\}\)/,
    'applyLevel must accept the rung a mode names');
  assert.match(main, /tier === undefined \? Math\.round\(E \* 10\) : Math\.round\(tier\)/,
    'and it must use it for the level instead of deriving one from intensity');
  assert.match(main, /for \(let i = 0; i <= LEVEL_MAX; i\+\+\)/,
    'setLevelClasses must walk the whole ladder, or the top rungs never light up');
  assert.match(main, /tier: endless\.tierOf\(S\.endless\.wave\)/,
    'and the endless run must actually hand its rung over');
  // A basic set still has to walk the first ten rungs on its own intensity.
  assert.match(main, /E = basicE\(S\.qi\)/, 'the basic set must keep its own arc');
});

test('a rung lights only the piece it owns', () => {
  // Rung 10 first read `body.lv10 .spot`. So did rung 5. Both match the second
  // pair as well, so the second pair was already lit from rung 5 and rung 12 -
  // whose entire content is that pair - had nothing left to reveal. Caught by
  // reading back the computed opacity of each pair at each rung, which is why the
  // assertions below are about WHICH spots a rule names, not that a rule exists.
  for (const [rung, body] of [[5, /\{ opacity: \.7; \}/], [10, /\{ opacity: 1; filter:/]]) {
    const line = css.match(new RegExp(`^body\\.lv${rung}[^\\n]*`, 'm'));
    assert.ok(line, `rung ${rung} has no rule`);
    assert.match(line[0], new RegExp(`body\\.lv${rung} \\.spot-l, body\\.lv${rung} \\.spot-r`),
      `rung ${rung} must name the first pair explicitly`);
    assert.ok(!/^body\.lv\d+ \.spot[ ,{]/.test(line[0]), 'a bare .spot lights both pairs');
    assert.match(line[0], body, `rung ${rung}'s rule lost its body`);
  }
  // And the rung that owns the second pair is the one that lights it.
  assert.equal((css.match(/body\.lv12 \.spot-l2/g) || []).length, 1);
  assert.equal((css.match(/body\.lv12 \.spot-r2/g) || []).length, 1);
  // Nothing below rung 5 lights any of them.
  assert.ok(!/^body\.lv[0-4] \.spot/m.test(css), 'the spots must stay dark before rung 5');
});

test('a rung that reads the beat still shows without it', () => {
  // --kick is zero for a muted player and before the music starts, so any rung
  // whose only content is beat-driven is invisible to them.
  const line = css.match(/^body\.lv16 \.beat-flash[^\n]*/m);
  assert.ok(line, 'rung 16 has no beat-flash rule');
  assert.match(line[0], /calc\(\.\d+ \+ var\(--kick\)/, 'rung 16 must have a floor, not only a pulse');
  assert.match(css, /^body\.lv16 \.card \{/m, 'and something of its own that does not pulse at all');
});

test('every arrangement answers the new rungs', () => {
  const rungs = [11, 13, 15];
  const songs = Object.entries(SONGS);
  assert.ok(songs.length >= 4, 'a song went missing, and this test would not have noticed');
  for (const [name, song] of songs) {
    const src = String(song.step);
    for (const n of rungs) {
      assert.match(src, new RegExp(`L >= ${n}\\b`), `${name} adds nothing at rung ${n}`);
    }
  }
  const classic = String(AudioEngine.prototype.scheduleStep);
  for (const n of rungs) {
    assert.match(classic, new RegExp(`L >= ${n}\\b`), `the default arrangement adds nothing at rung ${n}`);
  }
});

// ------------------------------------------------- endless run's own counters
// Both of these were counted or printed twice in the endless mode and neither
// showed up as an error: one wrong digit read as two in the tally, and the wave
// on the result page said "3波波". They are wiring faults between main.js and the
// module or the markup it shares the job with, so that is where they are checked.
test('one wrong digit is one miss', () => {
  assert.ok(!/S\.endless\.misses \+= 1/.test(main),
    'main.js must not count the miss itself: noteMiss() already does, and the doubling also reached the saved history');
  assert.match(main, /const out = endless\.noteMiss\(S\.endless\)/, 'the decrement must still go through noteMiss');
});

test('the result page prints each unit once', () => {
  // #e-wave's unit is the sibling span in index.html, which carries data-i18n so
  // a language switch still translates it. Writing it from main.js as well
  // printed it twice, and the copy landed inside the <b> and took its 92px size.
  const markup = html.match(/<b id="e-wave">[^<]*<\/b>\s*<span[^>]*data-i18n="波"/);
  assert.ok(markup, 'the wave field must keep its own translated unit next to it');
  assert.ok(!/\$\('#e-wave'\)\.innerHTML/.test(main), 'main.js must not rewrite the wave field');
  assert.match(main, /\$\('#e-wave'\)\.textContent = String\(e\.wave\)/, 'and must write the number only');
  // #e-ok, the field beside it, has no such span, so main.js owns that unit - and
  // it must keep owning it, or the count would lose its 题 entirely.
  assert.ok(!/<dd id="e-ok">[^<]*<\/dd>\s*题/.test(html), 'the 答对 field must not gain a second unit');
  assert.match(main, /\$\('#e-ok'\)\.innerHTML = `\$\{e\.solved\}<small>\$\{t\('题'\)\}<\/small>`/);
});
