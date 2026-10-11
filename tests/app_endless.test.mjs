// Endless mode's rules. The interesting ones are the conditions that decide how
// far a run gets, so that is where the tests are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../app/js/problems.js';
import { SKILLS, SKILL } from '../app/js/skills.js';
import { emptyProgress, masterWithAncestors, isUnlocked, skillRecord } from '../app/js/session.js';
import { extraPoints } from '../app/js/scoring.js';
import {
  LIVES, LIFE_EVERY, WAVE_EVERY, MIX_FROM_WAVE, MIX_MIN_GRADE,
  newRun, waveOf, gradeOf, intensity, tierOf, BASE_TIER, TIER_MAX, E_MAX,
  noteSolved, noteMiss, pickSkill, plan,
} from '../app/js/endless.js';

test('a run starts with three lives and nothing done', () => {
  const r = newRun();
  assert.equal(r.lives, LIVES);
  assert.equal(r.lives, 3);
  assert.equal(r.solved, 0);
  assert.equal(r.wave, 1);
  assert.equal(r.over, false);
});

test('waves rise on first-try solves only', () => {
  assert.equal(waveOf(0), 1);
  assert.equal(waveOf(WAVE_EVERY - 1), 1);
  assert.equal(waveOf(WAVE_EVERY), 2);
  assert.equal(waveOf(WAVE_EVERY * 4 + 1), 5);

  const r = newRun();
  // Five solves that each needed a second attempt: no rise.
  for (let i = 0; i < WAVE_EVERY; i++) noteSolved(r, false);
  assert.equal(r.wave, 1, 'careless solves do not advance the run');
  noteSolved(r, true);
  assert.equal(r.wave, 1, 'still one short of the fifth first-try');
  for (let i = 0; i < WAVE_EVERY - 1; i++) noteSolved(r, true);
  assert.equal(r.wave, 2, 'the fifth first-try opens wave 2');
});

test('the waves walk up the grades and stop at six', () => {
  assert.equal(gradeOf(1), 1);
  assert.equal(gradeOf(2), 1);
  assert.equal(gradeOf(3), 2);
  assert.equal(gradeOf(4), 2);
  assert.equal(gradeOf(11), 6);
  assert.equal(gradeOf(20), 6);
  assert.equal(gradeOf(99), 6);
});

test('a wrong digit costs a life, and the third one ends the run', () => {
  const r = newRun();
  assert.equal(noteMiss(r), false);
  assert.equal(r.lives, 2);
  assert.equal(noteMiss(r), false);
  assert.equal(r.lives, 1);
  assert.equal(noteMiss(r), true, 'the third miss ends it');
  assert.equal(r.lives, 0);
  assert.equal(r.over, true);
  assert.equal(r.misses, 3);
});

test('a life comes back every ten solved problems, never above three', () => {
  const r = newRun();
  noteMiss(r); // two lives left
  let regained = 0;
  for (let i = 0; i < LIFE_EVERY - 1; i++) regained += noteSolved(r, true) ? 1 : 0;
  assert.equal(regained, 0, 'not yet');
  assert.equal(noteSolved(r, true), true, 'the tenth solve gives one back');
  assert.equal(r.lives, 3);

  // Already full: no life is banked, and the counter starts over rather than
  // firing again on the next solve.
  noteMiss(r);
  let extra = 0;
  for (let i = 0; i < LIFE_EVERY; i++) extra += noteSolved(r, false) ? 1 : 0;
  assert.equal(extra, 1, 'one regain');
  assert.equal(r.lives, 3);
  assert.equal(noteSolved(r, false), false, 'and not another straight after');
});

test('a life lost late is not refunded early', () => {
  // The clock restarts on a loss, so a loss during problem k comes back during
  // problem k+9: the problem being answered counts as the first of the ten.
  // Without the reset the counter ran from the start of the run, and a loss on
  // problem 7 was refunded on problem 10 - three problems later - so the hearts
  // looked like they never dropped. Found by playing, not by a test.
  const regains = (losses, upto) => {
    const r = newRun();
    const when = [];
    for (let solved = 1; solved <= upto; solved++) {
      if (losses.includes(solved)) noteMiss(r);
      if (noteSolved(r, true)) when.push(solved);
    }
    return { when, run: r };
  };

  assert.deepEqual(regains([1], 14).when, [10], 'a loss during the first problem');
  assert.deepEqual(regains([7], 24).when, [16], 'and during the seventh');
  assert.deepEqual(regains([5, 22], 40).when, [14, 31], 'each loss moves its own refund');
  const late = regains([7], 24).run;
  assert.equal(late.lives, LIVES, 'back to full');
  assert.equal(late.misses, 1, 'and the miss is counted once');
});

test('the score follows the same ramp as the extra stage', () => {
  const r = newRun();
  for (let i = 0; i < 5; i++) noteSolved(r, true);
  const expected = [0, 1, 2, 3, 4].reduce((a, k) => a + extraPoints(k), 0);
  assert.equal(r.score, expected);
  assert.equal(r.solved, 5);
});

test('the show climbs with the wave, and keeps climbing after the grade stops', () => {
  assert.ok(intensity(1) < intensity(5));
  assert.ok(intensity(5) < intensity(10));
  assert.ok(intensity(10) < intensity(20));
  // Bounded, because this number is read straight into particle counts and
  // speeds: the previous unbounded version asked for 48 firework shells at a
  // wave a good run reaches.
  assert.ok(intensity(20) <= E_MAX, 'bounded, so nothing runs away');
});

test('the wave count climbs the ladder instead of pinning it', () => {
  assert.equal(tierOf(1), BASE_TIER, 'a run starts where a basic set ended');
  assert.equal(tierOf(2), BASE_TIER);
  assert.equal(tierOf(3), BASE_TIER + 1);
  let prev = tierOf(1);
  for (let w = 1; w <= 40; w++) {
    const rung = tierOf(w);
    assert.ok(rung >= prev, `rung must not fall back at wave ${w}`);
    assert.ok(rung <= TIER_MAX, `rung must stop at the ceiling, wave ${w}`);
    if (w > 2) assert.ok(rung >= prev, 'never walks backwards');
    prev = rung;
  }
  assert.equal(tierOf(40), TIER_MAX, 'the top is reachable, and stays put');
  // Reaching it is a real run, not a formality: the waves are first-try solves.
  const waveAtTop = 1 + (TIER_MAX - BASE_TIER) * 2;
  assert.equal(tierOf(waveAtTop), TIER_MAX);
  assert.equal(tierOf(waveAtTop - 1), TIER_MAX - 1, 'and it is the wave before that tops out');
});

// ---------------------------------------------------------------- selection

const fresh = () => emptyProgress();

test('early waves draw from the earliest grade the child can reach', () => {
  const prog = fresh();
  const run = newRun();
  const rng = makeRng(3);
  const picked = new Set();
  for (let i = 0; i < 40; i++) picked.add(pickSkill(prog, run, rng));
  assert.ok(picked.size > 1, 'not always the same skill');
  for (const id of picked) {
    assert.ok(isUnlocked(prog, id), `${id} should be unlocked`);
    assert.equal(SKILL[id].grade, 1, `${id} should be grade 1 at wave 1`);
  }
});

test('the pool widens with the wave, and never leaves what is unlocked', () => {
  // A child who has mastered the whole of grade 1 and nothing else.
  const prog = fresh();
  for (const s of SKILLS) if (s.grade === 1) masterWithAncestors(prog, s.id, Date.now());

  const run = newRun();
  const rng = makeRng(11);
  run.wave = gradeOf(3); // grade 2
  const atTwo = new Set();
  for (let i = 0; i < 60; i++) atTwo.add(pickSkill(prog, run, rng));
  for (const id of atTwo) {
    assert.ok(isUnlocked(prog, id), `${id} must be unlocked`);
    assert.ok(SKILL[id].grade <= 2, `${id} should not jump ahead of the wave`);
  }
});

test('a grade the child cannot reach yet falls back instead of failing', () => {
  const prog = fresh(); // nothing mastered: only the no-prerequisite skills are open
  const run = newRun();
  run.wave = 8; // grade 4, far beyond what is unlocked
  const rng = makeRng(5);
  for (let i = 0; i < 20; i++) {
    const id = pickSkill(prog, run, rng);
    assert.ok(id, 'a skill is always returned');
    assert.ok(SKILL[id], `${id} must be a real skill`);
    assert.ok(isUnlocked(prog, id), `${id} must be unlocked`);
  }
});

test('past the top grade the pool is the upper syllabus, not the easy end', () => {
  const prog = fresh();
  for (const s of SKILLS) masterWithAncestors(prog, s.id, Date.now());
  const run = newRun();
  run.wave = MIX_FROM_WAVE;
  const rng = makeRng(7);
  const seen = new Set();
  for (let i = 0; i < 80; i++) seen.add(SKILL[pickSkill(prog, run, rng)].grade);
  for (const g of seen) assert.ok(g >= 0, 'sanity');
  assert.ok([...seen].every((g) => g >= 4), `grades seen: ${[...seen].sort().join(',')} - all should be ${MIX_MIN_GRADE}+`);
  assert.ok(seen.size > 1, 'and more than one of them, so it interleaves');
});

test('a run picks what the child is not solid on when it can', () => {
  const prog = fresh();
  // Master one grade-1 skill, leave its siblings untouched.
  const g1 = SKILLS.filter((s) => s.grade === 1);
  masterWithAncestors(prog, g1[0].id, Date.now());
  const r = skillRecord(prog, g1[0].id);
  r.lastOk = Date.now(); // not rusty, so it is only "solid"
  const run = newRun();
  const rng = makeRng(13);
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(pickSkill(prog, run, rng));
  assert.ok(!seen.has(g1[0].id), 'the solid one is skipped while weaker ones are available');
});

test('the plan hands nextProblem an unbounded sequence', () => {
  const prog = fresh();
  const run = newRun();
  const p = plan(prog, run, makeRng(2));
  assert.equal(p.mode, 'endless');
  assert.equal(typeof p.skillAt, 'function');
  for (const i of [0, 1, 50, 500]) {
    const id = p.skillAt(i);
    assert.ok(SKILL[id], `skillAt(${i}) must name a real skill`);
  }
});
