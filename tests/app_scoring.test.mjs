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
  // The claim is that this never converges, so compare the two curves where it
  // matters - far out, past anything a player reaches. The extra stage's step is
  // gone to zero there; this one is merely tiny, and addDopa's 0.003 floor is
  // what keeps the figure moving regardless.
  assert.ok(endlessProblemGain(100000) > 1e-6, 'the endless step must still be there');
  assert.ok(extraProblemGain(100000) < 1e-6, 'while the extra step must be gone');
  assert.ok(addDopa(0, endlessProblemGain(100000), 1, ENDLESS_DOPA_MAX_L) >= 0.003,
    'and the floor keeps the far tail moving even when the raw step is smaller');
});

test('兆 is a long-run goal, and still reachable', () => {
  // span 1.2 deliberately gives up the design's "60-80 problems to reach 兆".
  // What is left to hold onto is that the top units happen at all, inside a run a
  // person could finish: 388 problems of flawless play. The bounds are loose
  // because this is a shape, not a stopwatch.
  const at = crossesAt(12, 2);
  assert.ok(at > 300 && at < 420, `兆 must be a long run, not a session: got ${at}`);
  assert.ok(playOf(60, 2) < 8, `60 problems must not reach 亿: 10^${playOf(60, 2).toFixed(2)}`);
  assert.ok(playOf(120, 2) < 9, `nor 120 problems: 10^${playOf(120, 2).toFixed(2)}`);
  // And a session should still climb through the named units. unitOf returns the
  // milestone the slam fires on, which is why 10^6.9 reads as 百万 and not 万.
  assert.equal(unitOf(playOf(60, 2)), '百万', '60 problems lands in the 百万 milestone');
  assert.equal(unitOf(playOf(300, 2)), '亿', 'and 300 in 亿');
});

test('the unit rhythm holds at both ends of the combo', () => {
  // The combo end is what a player meets: the multiplier maxes at 20 cells and
  // stays. The no-combo end is the same curve with it pinned at 1.05 (the first
  // correct cell always gets that much). Both are asserted, because a retune that
  // helps one silently breaks the other.
  assert.deepEqual([17, 96, 388, 721, 1054].map((n) => unitOf(playOf(n, 2))),
    ['万', '亿', '兆', '京', '垓']);
  assert.deepEqual([46, 819, 2089].map((n) => unitOf(runOf(n))), ['万', '亿', '兆']);
  // The no-combo end is not a mode anyone plays - it exists so that a run which
  // never chains still moves - and it takes better than twice as long to a unit.
  assert.ok(crossesAt(4, 0) > 2 * crossesAt(4, 2), 'a sustained combo must be worth having');
});

test('the first minutes still show a number that moves', () => {
  // The whole point of the curve is that a child watches the figure grow. A
  // slower span must not flatten the opening: each of the first six problems
  // should still be visibly bigger than the one before it.
  const shown = [];
  for (let k = 1; k <= 6; k++) shown.push(Math.round(10 ** playOf(k, 1)));
  for (let i = 1; i < shown.length; i++) {
    assert.ok(shown[i] > shown[i - 1], `problem ${i + 1} must read higher than ${i}: ${shown.join(', ')}`);
    assert.ok(shown[i] - shown[i - 1] >= 2, `and by more than a rounding error: ${shown.join(', ')}`);
  }
  assert.equal(shown[0], 3, 'the first problem is a small, readable number');
});

test('the ceiling is a backstop, not a destination', () => {
  // The cap exists so fmtDopa and the 10^68 unit table never see a figure they
  // cannot print. At this span it takes a run nobody can play to touch it, which
  // is the point: a cap a good player reaches is the saturation this curve was
  // written to avoid.
  assert.ok(runOf(120, 20) < ENDLESS_DOPA_MAX_L, 'even a 120-problem full-combo run stays under');
  assert.ok(runOf(1888, 20) < ENDLESS_DOPA_MAX_L, 'and a 1888-problem one still stays under');
  assert.equal(runOf(1e6, 20), ENDLESS_DOPA_MAX_L, 'but it is still a ceiling');
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
