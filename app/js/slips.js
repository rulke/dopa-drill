// Error attribution: turn "that digit was wrong" into a named cause.
//
// The rule that shapes everything here: only name a cause when the digit the
// child pressed *proves* it. A report that says "you always forget the carry"
// had better be right, so anything that does not match a known pattern stays
// unnamed and is counted as unclassified instead. A wrong diagnosis is worse
// than no diagnosis.
//
// Everything comes from the step object problems.js already builds:
//   help.text  the arithmetic the child is meant to do, e.g. "7 ＋ 8 ＋ 1"
//   help.ids   the cells it is read from (a carry cell is "k7")
//   marks      subtraction: the borrow marks, where a "9" means the borrow had
//              to walk through a zero
//   digit      the right answer for this cell
//
// Deliberately not detected yet - each needs a pattern that holds for the whole
// column, not one digit, and guessing would break the rule above: place-value
// misalignment across the partial products, quotient estimation, decimal point
// placement, and input order on horizontal problems. They land in unclassified.
import { skillRecord } from './session.js';

export const CAUSES = ['carry', 'borrowZero', 'borrowMiss', 'swap', 'wrongFactor'];

// ---------------------------------------------------------------- parsing

const MUL = /^(\d+) × (\d+)(?: ＋ (\d+))?$/;
const SUB = /^(\d+) − (\d+)$/;
const CARRY_ONLY = /^进位的(\d+)$/;

// Read one step's arithmetic out of the shape problems.js built it in.
//
// Only column arithmetic is recognised: the seven forms the column builders
// emit ("2 − 1", "1 ＋ 1", "1 × 2", "1 × 4 ＋ 1", "1 ＋ 4 ＋ 1", "进位的1", and a
// bare digit). Every other skill's help is a hint for a child - "分母乘分母，
// 分子乘分子", "将十位四舍五入", "5的口诀 5 10 15 …" - and there is no column
// arithmetic in it to reconstruct, so those steps stay unclassified by design.
//
// Two ambiguities have to be resolved from facts rather than wording:
//   - where a carry comes from: its own cell ("k7"), a trailing term in the
//     text, or (in a partial-product sum) either one depending on the column
//   - whether a middle term is a second addend or a carry
export function parseStep(step, problem, cellText) {
  const help = step && step.help;
  if (!help || !help.text) return null;
  const text = help.text;

  const only = CARRY_ONLY.exec(text);
  if (only) return { kind: 'carryOnly', carry: Number(only[1]) };

  // Only cells belonging to a column layout count as column arithmetic. The
  // horizontal builders (buildH) name their cells g0/x1/w2 - but they are not
  // skipped, they are read a different way, below.
  const ids = Array.isArray(help.ids) ? help.ids : [];
  const column = ids.length > 0 && ids.every((id) => /^[abkpqm]\d+$/.test(id));
  if (!column) return horizontal(step, problem);

  const mul = MUL.exec(text);
  if (mul) {
    const factor = Number(mul[2]);
    // The multiplier's other digits, so "multiplied by the wrong one" can be
    // checked. Only the multiplier's cells are read, and only in this branch.
    const others = problem && Array.isArray(problem.cells)
      ? problem.cells
        .filter((c) => /^b\d+$/.test(c.id))
        .map((c) => Number(c.text))
        .filter((d) => Number.isFinite(d) && d !== factor)
      : [];
    return {
      kind: 'mul',
      x: Number(mul[1]),
      factor,
      // In this form the only possible trailing term is the carry.
      carry: mul[3] == null ? null : Number(mul[3]),
      others,
    };
  }

  const sub = SUB.exec(text);
  if (sub) {
    // The borrow marks are what make a column of subtraction knowable; the
    // horizontal format has none, so its "a − b" help is the whole problem.
    if (!Array.isArray(step.marks)) return null;
    const c = Number(String(step.cell).slice(1));
    const marks = step.marks;
    const borrowed = marks.find((m) => m.c === c);
    return {
      kind: 'sub',
      minuend: Number(sub[1]),
      subtrahend: Number(sub[2]),
      // A "9" only ever comes from the loop that walks back over zeros, so its
      // presence proves the borrow crossed one.
      crossedZero: marks.some((m) => m.text === '9'),
      borrowedValue: borrowed ? Number(borrowed.text) : null,
    };
  }

  const terms = text.split(' ＋ ').map(Number);
  // A lone digit parses as NaN-free but carries no arithmetic, and prose with a
  // ＋ inside it does not survive the numeric filter.
  if (terms.length < 2 || !terms.every(Number.isFinite)) return null;

  const kCell = ids.find((id) => id.startsWith('k'));
  if (kCell) {
    // Column addition: the carry has a cell of its own, and the text already
    // counts it among the terms.
    const carry = cellText ? Number(cellText(kCell)) : NaN;
    return { kind: 'add', terms, carry: Number.isFinite(carry) ? carry : null };
  }
  if (ids.some((id) => /^[pq]\d+$/.test(id))) {
    // Summing the partial products: the carry never has a cell, so whether the
    // middle term is the carry or the second partial product comes down to the
    // column. In the ones column there is no second partial product to add.
    const i = problem && problem.cols != null
      ? problem.cols - 1 - Number(String(step.cell).slice(1))
      : null;
    if (terms.length === 3) return { kind: 'add', terms, carry: terms[2] };
    return { kind: 'add', terms, carry: i === 0 ? terms[1] : null };
  }
  return null;
}

// The sum the child is meant to compute, or null where there is nothing to add
// up (subtraction is handled entirely by the borrow marks, and a carry-only
// step is just the carry itself).
function total(parsed) {
  if (!parsed) return null;
  if (parsed.kind === 'mul') return parsed.x * parsed.factor + (parsed.carry || 0);
  if (parsed.kind === 'add') return parsed.terms.reduce((a, b) => a + b, 0);
  return null;
}

const mod10 = (n) => ((Math.round(n) % 10) + 10) % 10;

// ---------------------------------------------------------------- horizontal

const HEXPR = /^(\d+)\s*([+＋]|[−-])\s*(\d+)$/;

// The horizontal format (grade 1's carrying and borrowing skills, among others)
// has one step per answer digit and a help string that hints at the whole
// problem rather than one column - "20 − 10" there is the problem itself. So the
// arithmetic is rebuilt from the expression, and the two slips that matter for
// this format are the two ways to skip the carry or the borrow:
//
//   carry   wrote the column sum without carrying into it
//   borrow  took the smaller digit from the larger instead of borrowing
//
// Both are read at the decimal place the step is filling, which comes from the
// step's position in the answer. Operands come from the given cells, which hold
// whole numbers in this format.
function horizontal(step, problem) {
  if (!problem || !Array.isArray(problem.cells) || !Array.isArray(problem.steps)) return null;
  const m = HEXPR.exec(String(problem.text || '').trim());
  if (!m) return null;
  const a = Number(m[1]); const b = Number(m[3]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  const add = m[2] === '+' || m[2] === '＋';
  const answer = add ? a + b : a - b;
  if (answer < 0) return null;
  const s = String(answer);
  const k = problem.steps.indexOf(step);
  if (k < 0 || k >= s.length) return null;
  // Answers are entered left to right, so the first step is the highest place.
  return { kind: 'h', add, a, b, place: s.length - 1 - k, answer };
}

const digitAt = (n, p) => Math.floor(n / 10 ** p) % 10;

// The digit the child lands on by skipping the carry or the borrow. For this
// format the interesting column is not the one that *generates* the carry but
// the one it arrives in: 8 + 5 = 13, and the tens digit 1 is the carry from the
// units. A child who writes 0 there has done the columns but dropped what came
// across. Null when there is nothing at this place to drop.
function looseDigit(p) {
  if (p.kind !== 'h') return null;
  const place = p.place;
  const low = place - 1;
  if (p.add) {
    if (low < 0) return null;
    const carries = digitAt(p.a, low) + digitAt(p.b, low) >= 10;
    return carries ? (digitAt(p.a, place) + digitAt(p.b, place)) % 10 : null;
  }
  if (low >= 0 && digitAt(p.a, low) < digitAt(p.b, low)) {
    // A borrow arrives from the right and is ignored: "12 − 7" read as "2 − 7".
    return mod10(digitAt(p.a, place) - digitAt(p.b, place));
  }
  const da = digitAt(p.a, place); const db = digitAt(p.b, place);
  // Or the borrow this column needs is never taken: the classic smaller from
  // the larger, "7 − 2" for a column that means "12 − 7".
  return da < db ? db - da : null;
}

// ---------------------------------------------------------------- classify

// step: the step object; typed: the digit the child pressed; problem: the whole
// problem. Returns one of CAUSES, or null when nothing is proven.
export function classifySlip(step, typed, problem) {
  if (!step || typed == null || problem == null) return null;
  const typedN = Number(typed);
  if (!Number.isFinite(typedN)) return null;
  const right = Number(step.digit);
  if (!Number.isFinite(right) || typedN === right) return null;

  const cellText = (() => {
    if (!Array.isArray(problem.cells)) return null;
    const byId = new Map(problem.cells.map((c) => [c.id, c.text]));
    return (id) => byId.get(id);
  })();

  const p = parseStep(step, problem, cellText);
  if (!p) return null;

  // --- subtraction: borrowing is the whole story -------------------------
  if (p.kind === 'sub') {
    // Took the smaller digit from the larger instead of borrowing: the classic
    // "7 − 2" for a column that means "12 − 7". Only provable where a borrow
    // actually happened, since that is what makes the two differ.
    if (p.borrowedValue != null) {
      const raw = p.borrowedValue - 10;
      if (typedN === mod10(p.subtrahend - raw)) return 'borrowMiss';
      // The value in the cell is the post-borrow minuend, so the plain
      // difference must not be mistaken for a slip.
      if (typedN === mod10(p.borrowedValue - p.subtrahend)) return null;
    }
    if (p.crossedZero) return 'borrowZero';
    return null;
  }

  // --- horizontal: the two ways to skip the carry or the borrow ----------
  if (p.kind === 'h') {
    const loose = looseDigit(p);
    if (loose != null && typedN === mod10(loose)) return p.add ? 'carry' : 'borrowMiss';
    return null;
  }

  if (p.kind === 'carryOnly') return null;

  const sum = total(p);
  if (sum == null) return null;

  // --- forgot the carry --------------------------------------------------
  if (p.carry) {
    if (typedN === mod10(sum - p.carry)) return 'carry';
  }

  // --- multiplication ----------------------------------------------------
  if (p.kind === 'mul') {
    const fact = p.x * p.factor;
    // Wrote the tens digit of the product where the ones digit belongs.
    if (typedN === mod10(Math.floor(fact / 10))) return 'swap';
    // Multiplied by the other digit of the multiplier.
    if (p.others.some((d) => typedN === mod10(p.x * d))) return 'wrongFactor';
  }

  return null;
}

// ---------------------------------------------------------------- recording

export const SLIP_DAYS_MAX = 30; // keep a month of daily counts, then forget

const blankSlips = () => ({});
const blankDays = () => ({});

// Count one slip against a skill. `cause` may be null (unclassified); both are
// kept, because the report shows how much of the total is actually explained.
// `day` is a store dayKey ("2026-10-10").
export function noteSlip(prog, skillId, cause, day) {
  if (!prog || !skillId) return;
  const r = skillRecord(prog, skillId);
  const key = cause || 'unclassified';
  if (!r.slips) r.slips = blankSlips();
  r.slips[key] = (r.slips[key] || 0) + 1;
  if (!day) return;
  if (!r.slipDays) r.slipDays = blankDays();
  const today = r.slipDays[day] || (r.slipDays[day] = {});
  today[key] = (today[key] || 0) + 1;
  pruneDays(r.slipDays, day);
}

// Drop days older than the window. `today` is a dayKey; comparing the strings
// directly is enough because they are zero-padded ISO dates.
function pruneDays(slipDays, today) {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - SLIP_DAYS_MAX + 1);
  const from = cutoff.toISOString().slice(0, 10);
  for (const day of Object.keys(slipDays)) if (day < from) delete slipDays[day];
}

// Totals across skills: { cause: count }, optionally limited to the last
// `days` days. Used by the growth page.
export function slipTotals(prog, { day, days = SLIP_DAYS_MAX } = {}) {
  const out = {};
  const add = (bag, weight) => {
    for (const [k, v] of Object.entries(bag || {})) out[k] = (out[k] || 0) + v * weight;
  };
  for (const r of Object.values((prog && prog.skills) || {})) {
    if (!r) continue;
    if (!day) { add(r.slips, 1); continue; }
    const cutoff = new Date(`${day}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
    const from = cutoff.toISOString().slice(0, 10);
    for (const [d, bag] of Object.entries(r.slipDays || {})) if (d >= from && d <= day) add(bag, 1);
  }
  return out;
}

// The skills where one cause shows up most, worst first.
export function slipSkills(prog, cause, { limit = 3 } = {}) {
  const rows = [];
  for (const [id, r] of Object.entries((prog && prog.skills) || {})) {
    const n = r && r.slips ? r.slips[cause] || 0 : 0;
    if (n) rows.push({ skill: id, n });
  }
  rows.sort((a, b) => b.n - a.n);
  return rows.slice(0, limit);
}
