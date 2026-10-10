// Error attribution. The point of this module is to be right, so the tests are
// mostly about what it refuses to claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, makeProblem } from '../app/js/problems.js';
import { SKILLS } from '../app/js/skills.js';
import { emptyProgress, skillRecord } from '../app/js/session.js';
import { classifySlip, parseStep, noteSlip, slipTotals, slipSkills, CAUSES, SLIP_DAYS_MAX } from '../app/js/slips.js';

const cellTextOf = (p) => {
  const byId = new Map(p.cells.map((c) => [c.id, c.text]));
  return (id) => byId.get(id);
};
const mod10 = (n) => ((Math.round(n) % 10) + 10) % 10;

// A spread of problems per skill: enough to hit carries, zero-borrows and
// partial-product rows without making the suite slow.
function sample(skillId, n = 12, seed = 7) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    try { out.push(makeProblem(skillId, rng)); } catch { /* some skills are picky */ }
  }
  return out;
}

const allSkills = () => SKILLS.map((s) => s.id);

// The parser reads numbers back out of strings a child would see. If it ever
// mis-assigns a term - the padding zeros of a decimal, a carry that arrives in
// a cell instead of in the text - the sum stops matching the digit the builder
// wrote into the step, so this walks every generator and checks that where it
// parses at all, it parses to the right arithmetic.
//
// Most steps do NOT parse, and that is the design: only the column builders
// emit column arithmetic. The other skills' help is a conceptual hint
// ("分母乘分母，分子乘分子"), so there is nothing to check the digit against and
// those steps stay unclassified.
test('what parses, parses to arithmetic that sums to the step digit', () => {
  let parsedCount = 0; let skipped = 0; const byKind = {};
  for (const id of allSkills()) {
    for (const p of sample(id)) {
      const cellText = cellTextOf(p);
      for (const st of p.steps) {
        const parsed = parseStep(st, p, cellText);
        if (!parsed) { skipped += 1; continue; }
        byKind[parsed.kind] = (byKind[parsed.kind] || 0) + 1;
        if (parsed.kind === 'carryOnly') continue;
        // Subtraction has its own identity: the column is the post-borrow
        // minuend minus the subtrahend, which also proves the borrow marks were
        // read from the right column.
        const sum = parsed.kind === 'mul'
          ? parsed.x * parsed.factor + (parsed.carry || 0)
          : parsed.kind === 'sub'
            ? parsed.minuend - parsed.subtrahend
            // Horizontal: the step's own digit of the answer, which also proves
            // the step index to decimal place mapping is the right way round.
            : parsed.kind === 'h'
              ? Math.floor(parsed.answer / 10 ** parsed.place) % 10
              : parsed.terms.reduce((a, b) => a + b, 0);
        assert.equal(
          mod10(sum),
          mod10(Number(st.digit)),
          `${id} ${p.text}: "${st.help.text}" sums to ${sum} but the step wants ${st.digit}`,
        );
        parsedCount += 1;
      }
    }
  }
  assert.ok(parsedCount > 500, `expected a broad sample, only checked ${parsedCount} steps`);
  // All three arithmetic kinds have to show up, or the walk is not exercising
  // the parsers it is supposed to be testing.
  for (const kind of ['add', 'sub', 'mul']) {
    assert.ok(byKind[kind] > 0, `no ${kind} steps in the sample`);
  }
  assert.ok(skipped > 0, 'the design leaves non-column skills unparsed');
});

test('a hint that is not column arithmetic is not mistaken for it', () => {
  const hints = ['分母乘分母，分子乘分子', '将十位四舍五入', '5的口诀 5 10 15', '把7/9颠倒后相乘', '先算5 × 5', '1加几等于10'];
  for (const text of hints) {
    assert.equal(parseStep({ cell: 's1', help: { text, ids: [] } }, { cells: [], cols: 4 }), null, text);
  }
});

test('a correct digit is never blamed for anything', () => {
  for (const id of allSkills()) {
    for (const p of sample(id, 6)) {
      for (const st of p.steps) {
        assert.equal(classifySlip(st, st.digit, p), null, `${id} ${p.text}: blamed a correct answer`);
      }
    }
  }
});

test('forgetting the carry is named when the digit proves it', () => {
  let found = 0;
  for (const id of allSkills()) {
    for (const p of sample(id, 10)) {
      for (const st of p.steps) {
        const parsed = parseStep(st, p, cellTextOf(p));
        if (!parsed || parsed.kind === 'carryOnly' || !parsed.carry) continue;
        const sum = parsed.kind === 'mul'
          ? parsed.x * parsed.factor + parsed.carry
          : parsed.terms.reduce((a, b) => a + b, 0);
        const withoutCarry = mod10(sum - parsed.carry);
        if (withoutCarry === Number(st.digit)) continue; // the carry did not change the digit
        assert.equal(classifySlip(st, withoutCarry, p), 'carry', `${id} ${p.text}: ${st.help.text}`);
        found += 1;
      }
    }
  }
  assert.ok(found > 0, 'the sample should contain problems with a carry');
});

test('borrowing through a zero is named', () => {
  let found = 0;
  for (const id of allSkills()) {
    for (const p of sample(id, 24, 11)) {
      for (const st of p.steps) {
        const parsed = parseStep(st, p, cellTextOf(p));
        if (!parsed || parsed.kind !== 'sub' || !parsed.crossedZero) continue;
        // Any wrong digit on that column, as long as it is not the "borrowed
        // value minus subtrahend" case, which is a different slip.
        const plain = mod10(parsed.borrowedValue != null ? parsed.borrowedValue - parsed.subtrahend : -1);
        const typed = mod10(Number(st.digit) + 3);
        if (typed === plain) continue;
        assert.equal(classifySlip(st, typed, p), 'borrowZero', `${id} ${p.text}: ${st.help.text}`);
        found += 1;
      }
    }
  }
  assert.ok(found > 0, 'the sample should contain a borrow that crosses a zero');
});

test('taking the smaller from the larger is named', () => {
  let found = 0;
  for (const id of allSkills()) {
    for (const p of sample(id, 20, 5)) {
      for (const st of p.steps) {
        const parsed = parseStep(st, p, cellTextOf(p));
        if (!parsed || parsed.kind !== 'sub' || parsed.borrowedValue == null) continue;
        const smaller = mod10(parsed.subtrahend - (parsed.borrowedValue - 10));
        if (smaller === Number(st.digit)) continue; // the two readings agree on this digit
        assert.equal(classifySlip(st, smaller, p), 'borrowMiss', `${id} ${p.text}: ${st.help.text}`);
        found += 1;
      }
    }
  }
  assert.ok(found > 0, 'the sample should contain a borrow where the two readings differ');
});

test('a product written the wrong way round is named', () => {
  let found = 0;
  for (const id of allSkills()) {
    for (const p of sample(id, 20, 3)) {
      for (const st of p.steps) {
        const parsed = parseStep(st, p, cellTextOf(p));
        if (!parsed || parsed.kind !== 'mul') continue;
        const tens = mod10(Math.floor((parsed.x * parsed.factor) / 10));
        if (tens === Number(st.digit)) continue; // nothing to swap
        const got = classifySlip(st, tens, p);
        // A carry makes "tens of the fact" equal the digit that belongs one
        // column along; that is a carry slip and is named as one, not as this.
        assert.ok(got === 'swap' || got === 'carry', `${id} ${p.text}: ${st.help.text} -> ${got}`);
        if (got === 'swap') found += 1;
      }
    }
  }
  assert.ok(found > 0, 'the sample should contain a product whose digits differ');
});

// The whole point: an unrecognised digit must stay unrecognised.
test('an arbitrary wrong digit is not blamed on anything', () => {
  const rng = makeRng(99);
  let wrong = 0; let blamed = 0;
  for (const id of allSkills()) {
    for (const p of sample(id, 8, 42)) {
      for (const st of p.steps) {
        const typed = mod10(Number(st.digit) + 1 + Math.floor(rng() * 9));
        if (typed === Number(st.digit)) continue;
        wrong += 1;
        const cause = classifySlip(st, typed, p);
        if (cause) {
          blamed += 1;
          assert.ok(CAUSES.includes(cause), `unknown cause ${cause}`);
        }
      }
    }
  }
  // Off-by-one on a digit is a genuinely common slip (neighbouring count), so
  // some blame is expected - but most arbitrary digits must stay unexplained.
  assert.ok(blamed < wrong * 0.5, `blamed ${blamed} of ${wrong} arbitrary digits`);
});

// Horizontal problems put one step per answer digit and a hint for the whole
// problem, so the carry that matters is the one arriving from the column to the
// right - "8 + 5 = 13", where the 1 is the carry and a child who writes 0 has
// dropped it.
test('a dropped carry is named on the digit it arrives in', () => {
  const problem = {
    text: '8 + 5',
    cols: 4,
    cells: [
      { id: 'g0', text: '8', kind: 'given' },
      { id: 'g2', text: '5', kind: 'given' },
      { id: 'x3', text: '1', kind: 'input' },
      { id: 'x4', text: '3', kind: 'input' },
    ],
    steps: [],
  };
  problem.steps = [
    { cell: 'x3', digit: '1', label: '答案', help: { ids: ['g0', 'g2'], text: '8加2凑成10' } },
    { cell: 'x4', digit: '3', label: '答案', help: { ids: ['g0', 'g2'], text: '8加2凑成10' } },
  ];
  const [tens, units] = problem.steps;

  assert.equal(classifySlip(tens, '0', problem), 'carry', 'the tens digit is the carry');
  assert.equal(classifySlip(tens, '1', problem), null, 'the right answer is never blamed');
  assert.equal(classifySlip(units, '3', problem), null);
  assert.equal(classifySlip(units, '0', problem), null, 'nothing to drop in the ones column');
});

test('a horizontal borrow read as smaller-from-larger is named', () => {
  const problem = {
    text: '42 − 18',
    cols: 4,
    cells: [
      { id: 'g0', text: '42', kind: 'given' },
      { id: 'g2', text: '18', kind: 'given' },
      { id: 'x3', text: '2', kind: 'input' },
      { id: 'x4', text: '4', kind: 'input' },
    ],
    steps: [],
  };
  problem.steps = [
    { cell: 'x3', digit: '2', label: '答案', help: { ids: ['g0', 'g2'], text: '42 − 18' } },
    { cell: 'x4', digit: '4', label: '答案', help: { ids: ['g0', 'g2'], text: '42 − 18' } },
  ];
  const [tens, units] = problem.steps;
  // Ones column needs a borrow: 2 − 8 read the other way round is 6.
  assert.equal(classifySlip(units, '6', problem), 'borrowMiss');
  // Tens column receives that borrow: dropping it gives 4 − 1 = 3, not 2.
  assert.equal(classifySlip(tens, '3', problem), 'borrowMiss');
  assert.equal(classifySlip(tens, '2', problem), null);
  assert.equal(classifySlip(units, '4', problem), null);
});

// ---------------------------------------------------------------- recording

test('slips are counted per skill and per day, and old days are dropped', () => {
  const prog = emptyProgress();
  noteSlip(prog, 'g1-add-nc', 'carry', '2026-10-10');
  noteSlip(prog, 'g1-add-nc', 'carry', '2026-10-10');
  noteSlip(prog, 'g1-add-nc', null, '2026-10-10');

  const r = skillRecord(prog, 'g1-add-nc');
  assert.deepEqual(r.slips, { carry: 2, unclassified: 1 });
  assert.deepEqual(r.slipDays['2026-10-10'], { carry: 2, unclassified: 1 });

  // Recording creates the skill record if the problem never finished.
  assert.ok(prog.skills['g1-add-nc']);

  // A day far outside the window prunes everything older.
  noteSlip(prog, 'g1-add-nc', 'swap', '2026-12-31');
  assert.deepEqual(Object.keys(r.slipDays), ['2026-12-31']);
});

test('totals can be taken over all time or over a window', () => {
  const prog = emptyProgress();
  noteSlip(prog, 'a', 'carry', '2026-01-01');
  noteSlip(prog, 'a', 'carry', '2026-10-10');
  noteSlip(prog, 'b', 'swap', '2026-10-09');

  assert.deepEqual(slipTotals(prog), { carry: 2, swap: 1 });
  assert.deepEqual(slipTotals(prog, { day: '2026-10-10', days: 7 }), { carry: 1, swap: 1 });
  assert.deepEqual(slipTotals(prog, { day: '2026-10-10', days: 1 }), { carry: 1 });
});

test('the worst skills for a cause come back first', () => {
  const prog = emptyProgress();
  noteSlip(prog, 'a', 'carry', '2026-10-10');
  for (let i = 0; i < 3; i++) noteSlip(prog, 'b', 'carry', '2026-10-10');
  noteSlip(prog, 'c', 'swap', '2026-10-10');
  assert.deepEqual(slipSkills(prog, 'carry'), [{ skill: 'b', n: 3 }, { skill: 'a', n: 1 }]);
  assert.deepEqual(slipSkills(prog, 'nothing'), []);
});

test('the day window is the documented length', () => {
  assert.equal(SLIP_DAYS_MAX, 30);
});
