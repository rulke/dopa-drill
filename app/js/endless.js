// Endless mode: the rules and the ladder, as pure functions over a run object.
//
// Phase 3 of docs/DESIGN.md shipped the mode WITHOUT the extended show ladder,
// to answer "is this fun" before paying for the content work. Phase 5 has now
// paid for it: the ladder runs to 16 (see tierOf) and the dopa curve no longer
// converges (see endlessTotalL in scoring.js).
//
// Three rules shape it:
//
//   - a life is lost per wrong DIGIT, not per wrong problem, so the pressure is
//     on care rather than on luck
//   - a wave rises only on a first-try solve, which is what stops "guess fast
//     to get further" from working: getting further has to mean getting it right
//   - difficulty rises by widening the curriculum, not by speeding up. Wave 10
//     is grade 5 arithmetic, so the ladder is the syllabus.
import { SKILLS, SKILL } from './skills.js';
import { isUnlocked, isMastered, stateOf, rustyOf } from './session.js';
import { extraPoints } from './scoring.js';

export const LIVES = 3;
export const LIFE_EVERY = 10; // solved problems per life regained
export const WAVE_EVERY = 5; // first-try solves per wave
export const GRADE_MAX = 6;
// Where the grade runs out, the pool widens to the top of the syllabus instead
// of stopping. Design.md says "mix everything unlocked" from there; mixing
// grades 1 and 2 back in at wave 20 would flatten the curve, so this keeps the
// upper grades and varies within them.
export const MIX_FROM_WAVE = 11;
export const MIX_MIN_GRADE = 4;

export const newRun = () => ({
  lives: LIVES,
  solved: 0,
  firstTry: 0,
  misses: 0,
  score: 0,
  wave: 1,
  sinceLife: 0,
  over: false,
});

export const waveOf = (firstTry) => Math.floor(firstTry / WAVE_EVERY) + 1;

// Waves 1-2 are grade 1, 3-4 grade 2, and so on to grade 6.
export const gradeOf = (wave) => Math.min(GRADE_MAX, 1 + Math.floor((Math.max(1, wave) - 1) / 2));

// The show's loudness for a wave, and the rung of the ladder it stands on. These
// are two different questions and phase 5 split them apart: intensity says how
// big this moment is, the tier says how far the run has come. Bound to one
// number they fought each other - the wave count drove intensity past 7, which
// is more particles than the fx layer can render well, while the level it was
// supposed to feed had already pinned at its ceiling.
export const E_MAX = 1.6;
export const intensity = (wave) => 1 + (E_MAX - 1) * (1 - Math.exp(-Math.max(0, wave - 1) / 9));

// Tiers 11 and up belong to the run that outlasts a basic set: one new rung
// every two waves, so the show is still changing at wave 13 rather than
// spending the whole ladder on the first four.
export const BASE_TIER = 10;
export const WAVES_PER_TIER = 2;
export const TIER_MAX = 16;
export const tierOf = (wave) => Math.min(TIER_MAX, BASE_TIER + Math.floor((Math.max(1, wave) - 1) / WAVES_PER_TIER));

// One problem finished. `firstTry` is whether it went in without a wrong digit.
// Returns true when a life came back.
export function noteSolved(run, firstTry) {
  run.score += extraPoints(run.solved); // same ramp as the extra stage
  run.solved += 1;
  run.sinceLife += 1;
  if (firstTry) run.firstTry += 1;
  run.wave = waveOf(run.firstTry);
  if (run.sinceLife >= LIFE_EVERY && run.lives < LIVES) {
    run.sinceLife = 0;
    run.lives += 1;
    return true;
  }
  return false;
}

// One wrong digit. Returns true when that was the last life.
export function noteMiss(run) {
  run.misses += 1;
  run.lives = Math.max(0, run.lives - 1);
  if (!run.lives) run.over = true;
  return run.over;
}

// Which skill the i-th problem of the run should come from. `run` is read live,
// so the pool widens as the waves go by.
export function pickSkill(prog, run, rng) {
  const unlocked = SKILLS.filter((s) => isUnlocked(prog, s.id));
  if (!unlocked.length) return null;
  const grade = gradeOf(run.wave);
  let pool = unlocked;
  if (run.wave >= MIX_FROM_WAVE) pool = unlocked.filter((s) => s.grade >= MIX_MIN_GRADE);
  else pool = unlocked.filter((s) => s.grade === grade);
  // The current grade may not be open to them yet: carry on with what is.
  if (!pool.length) pool = unlocked;
  // Prefer what they are not solid on, so a run keeps teaching.
  const rusty = new Set(rustyOf(prog));
  const weak = pool.filter((s) => !isMastered(prog, s.id) || rusty.has(s.id));
  const from = weak.length ? weak : pool;
  return from[Math.floor(rng() * from.length)].id;
}

// The plan shape nextProblem() understands: an optional skillAt(i) so a run of
// unbounded length still fits the fixed-array plan interface.
export function plan(prog, run, rng) {
  return {
    mode: 'endless',
    skillAt: (i) => pickSkill(prog, run, rng) || SKILLS[0].id,
  };
}
