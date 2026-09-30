// Scoring and dopa curves for the public app (id014).
import test from 'node:test';
import assert from 'node:assert/strict';
import { extraPoints, extraTotal, basicDopaL, extraDopaL, extraProblemGain, fmtDopa, unitOf, unitLabel, addDopa, comboMult, comboMaxed, comboWindowMs, comboMilestone, DOPA_MAX_L } from '../app/js/scoring.js';
import { setLocale, getLocale } from '../app/js/i18n.js';

test('extra points grow gently and stay in the 1000s for a very fast run', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(extraPoints), [10, 15, 20, 25, 30]);
  let sum = 0;
  for (let k = 0; k < 23; k++) sum += extraPoints(k);
  assert.equal(sum, extraTotal(23));
  const total23 = 100 + extraTotal(23);
  assert.ok(total23 >= 1000 && total23 < 2000, `23 extras -> ${total23}`);
  assert.ok(100 + extraTotal(28) < 2500);
});

// Plays a run cell by cell (3 cells per problem) the way main.js does.
function run({ basic = 10, extras = 0, combo = true, cells = 3 }) {
  let L = 0; let c = 0; const T = basic * cells;
  for (let i = 1; i <= T; i++) { c = combo ? c + 1 : 0; L = addDopa(L, basicDopaL(i / T) - basicDopaL((i - 1) / T), c); }
  const afterBasic = L; c = 0; // the extra stage starts a new combo
  for (let k = 0; k < extras; k++) for (let d = 0; d < cells; d++) { c = combo ? c + 1 : 0; L = addDopa(L, extraProblemGain(k) / cells, c); }
  return { afterBasic, L };
}

test('no-combo base curves are low (id046)', () => {
  assert.equal(fmtDopa(basicDopaL(1)), '200');
  assert.ok(Math.abs(extraDopaL(0) - basicDopaL(1)) < 1e-9);
  let L = basicDopaL(1);
  for (let k = 0; k < 5; k++) L += extraProblemGain(k);
  assert.ok(Math.abs(L - extraDopaL(5)) < 1e-9);
  const plain = run({ extras: 23, combo: false });
  assert.ok(plain.L < 5.5, `23 extras without combo: ${fmtDopa(plain.L)}`);
});

test('combo multiplier rises evenly to x2.0 at 20 and stays there (id046)', () => {
  assert.equal(comboMult(0), 1);
  assert.equal(comboMult(10), 1.5);
  assert.equal(comboMult(20), 2);
  assert.equal(comboMult(500), 2);
  assert.ok(!comboMaxed(19) && comboMaxed(20));
  const plain = run({ extras: 5, combo: false }); const full = run({ extras: 5 });
  assert.ok(full.afterBasic > plain.afterBasic && full.L > plain.L);
  assert.ok(full.afterBasic > 3.8 && full.afterBasic < 4.1, `basic with combo: ${fmtDopa(full.afterBasic)}`); // about 1万
});

test('even a very fast full-combo run stays at a few 亿 and never passes the ceiling (id046)', () => {
  const fast = run({ extras: 23 });
  assert.match(fmtDopa(fast.L), /亿$/);
  assert.ok(fast.L < 8.8, `23 extras: ${fmtDopa(fast.L)}`);
  assert.ok(run({ extras: 200 }).L <= DOPA_MAX_L);
  assert.ok(run({ extras: 200, combo: false }).L < DOPA_MAX_L);
});

test('combo time limit grows with the grade and adds reading time on the first cell (id032)', () => {
  for (let g = 2; g <= 6; g++) assert.ok(comboWindowMs(g) > comboWindowMs(g - 1));
  assert.ok(comboWindowMs(3, true) > comboWindowMs(3));
  assert.equal(comboWindowMs(undefined), comboWindowMs(3));
  assert.deepEqual([5, 10, 20, 30, 40, 50, 75, 100, 125, 150].map(comboMilestone), [false, true, true, true, false, true, true, true, false, true]);
});

test('basic curve rises monotonically from small numbers', () => {
  let prev = -1;
  for (let i = 0; i <= 40; i++) { const L = basicDopaL(i / 40); assert.ok(L > prev); prev = L; }
  assert.equal(fmtDopa(basicDopaL(0.5)), Math.round(10 ** basicDopaL(0.5)).toLocaleString('zh-CN'));
});

test('milestone units below 万', () => {
  assert.equal(unitOf(1.9), '');
  assert.equal(unitOf(2.1), '百');
  assert.equal(unitOf(3.5), '千');
  assert.equal(unitOf(4.5), '万');
  assert.equal(unitOf(6.2), '百万');
  assert.equal(unitLabel('千万'), '1000万');
  assert.equal(unitOf(8.3), '亿');
  assert.equal(unitLabel('百'), '100');
  assert.equal(unitLabel('亿'), '1亿');
});

test('dopa units localise per language (id050)', () => {
  const L = getLocale();
  setLocale('ja');
  assert.equal(unitOf(8.3), '亿'); // unitOf always returns the zh key
  assert.match(fmtDopa(8.3), /億$/);
  assert.equal(unitLabel('亿'), '1億');
  assert.equal(fmtDopa(4.5), '3.2万');
  setLocale('en');
  assert.equal(fmtDopa(4.5), '31K');
  assert.equal(fmtDopa(9), '1B');
  assert.equal(unitLabel('万'), '10K');
  assert.equal(unitLabel('亿'), '100M');
  setLocale(L);
});
