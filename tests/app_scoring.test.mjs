// Scoring and dopa curves for the public app (id014).
import test from 'node:test';
import assert from 'node:assert/strict';
import { extraPoints, extraTotal, basicDopaL, extraDopaL, extraProblemGain, endlessTotalL, endlessProblemGain, fmtDopa, unitOf, unitLabel, addDopa, comboMult, comboMaxed, comboWindowMs, comboMilestone, DOPA_MAX_L, ENDLESS_DOPA_MAX_L } from '../app/js/scoring.js';
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


// ---------------------------------------------------------------- endless dopa
// The extra stage saturates on purpose: it ends inside a round, so its figure
// has a ceiling to respect. An endless run has none, and the unit table (up to
// 10^68) was written for a run that keeps going.
//
// These tests drive bumpDopa's actual arithmetic - add one problem's gain at a
// time - rather than reading the curve. Measuring the curve is how a two-unit
// error hid here: the curve looked high enough while the number on screen, which
// only ever accumulates differences, was a 600亿 instead of a 兆.
const runOf = (problems, combo = 1) => {
  let L = 0; // S.dopa.L starts at zero, as it does for every mode
  for (let k = 0; k < problems; k++) L = addDopa(L, endlessProblemGain(k), combo, ENDLESS_DOPA_MAX_L);
  return L;
};

// The same accumulation one answer cell at a time, so the combo can climb the
// way it does in play. `cells` is how many digits a problem asks for. This is
// the end of the curve a player actually meets: a no-miss run maxes the combo at
// 20 cells and keeps it there, which roughly triples how fast the units arrive.
const playOf = (problems, cells) => {
  let L = 0; let combo = 0;
  for (let k = 0; k < problems; k++) {
    for (let j = 0; j < cells; j++) {
      combo += 1;
      L = addDopa(L, endlessProblemGain(k) / cells, combo, ENDLESS_DOPA_MAX_L);
    }
  }
  return L;
};
const crossesAt = (target, cells) => {
  let n = 1;
  while (n < 3000 && (cells ? playOf(n, cells) : runOf(n)) < target) n += 1;
  return n;
};

test('the endless total starts at nothing and never flattens', () => {
  assert.equal(endlessTotalL(0), 0, 'a run starts from zero like every other mode');
  let prev = 0;
  for (const n of [1, 5, 20, 100, 500, 2000, 10000]) {
    const now = endlessTotalL(n);
    assert.ok(now > prev, `must keep climbing at n=${n}`);
    assert.ok(endlessProblemGain(n) > 0, `the step at n=${n} must stay positive`);
    prev = now;
  }
  // Compare against the curve endless would otherwise have borrowed: the extra
  // stage's, which is flat by n=40.
  assert.ok(endlessProblemGain(30) > extraDopaL(40) - extraDopaL(30),
    'the endless step must still be worth something where the extra step is not');
});

test('a good endless run reaches 兆', () => {
  // The design's target, at its slowest reading: with no combo at all, 60
  // problems is not there yet and 80 is.
  assert.ok(10 ** runOf(60) < 1e12, `60 problems must not be there yet: 10^${runOf(60).toFixed(2)}`);
  assert.ok(runOf(80) >= 12, `80 problems must be: 10^${runOf(80).toFixed(2)}`);
  // Each unit on the way is a milestone the pad can actually print.
  assert.equal(unitOf(runOf(80)), '兆', 'and the figure reads in 兆');
});

test('the unit rhythm holds at both ends of the combo', () => {
  // A real no-miss run of 60 problems, measured in the browser, crossed 万 at
  // problem 4, 亿 at 11, 兆 at 22 and 京 at 41 - the combo end of this table. The
  // no-combo column is the same curve with the multiplier pinned at 1. Both are
  // asserted, because a retune that helps one silently breaks the other.
  const withCombo = [4, 10, 20, 38, 70].map((n, i) => unitOf(playOf(n, 2)));
  assert.deepEqual(withCombo, ['万', '亿', '兆', '京', '垓']);
  const noCombo = [5, 21, 74, 254].map((n) => unitOf(runOf(n)));
  assert.deepEqual(noCombo, ['万', '亿', '兆', '京']);
  // The unit table is not decoration: a good run should exhaust the four units a
  // child can name and still have room above.
  assert.ok(crossesAt(12, 2) < 40, 'the combo case must not take a whole session to reach 兆');
  assert.ok(crossesAt(12, 0) < 90, 'and the no-combo case must still get there inside a long run');
});

test('the units keep coming after 兆', () => {
  // Not just "it grows": the point of an unsaturated curve is that the UNIT
  // changes, which is what the player actually sees. 京 is the next one up.
  const units = [5, 20, 80, 300, 1200].map((n) => unitOf(runOf(n)));
  assert.deepEqual(units, ['万', '亿', '兆', '京', '垓']);
});

test('the ceiling is a backstop, not a destination', () => {
  // The cap exists so fmtDopa and the 10^68 unit table never see a figure they
  // cannot print. A great run must not touch it - a cap a good player reaches is
  // the saturation this curve was written to avoid.
  assert.ok(runOf(120, 20) < ENDLESS_DOPA_MAX_L, 'even a 120-problem full-combo run stays under');
  assert.ok(runOf(10000, 20) === ENDLESS_DOPA_MAX_L, 'but it is still a ceiling');
});

test('the cap belongs to the mode, not to the arithmetic', () => {
  const base = 5; // a fat step, as if from a long combo
  assert.equal(addDopa(9, base, 20), DOPA_MAX_L, 'the default cap is the extra stage cap');
  const kept = addDopa(9, base, 20, ENDLESS_DOPA_MAX_L);
  assert.equal(kept, 9 + base * comboMult(20), 'and an endless run keeps the whole step');
  assert.ok(kept > DOPA_MAX_L, 'which the default cap would have swallowed');
  assert.ok(addDopa(ENDLESS_DOPA_MAX_L, base, 20, ENDLESS_DOPA_MAX_L) === ENDLESS_DOPA_MAX_L,
    'while still respecting its own ceiling');
});
