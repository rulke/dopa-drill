// The numbers behind the growth page.
//
// Pure functions over the saved state, like growth.js, so every figure can be
// tested without a browser. Nothing here writes or reads storage except the
// shared day-key helper.
//
// Two definitions matter and are deliberately not re-derived:
//
//   - "week" starts on Monday, in local time, because store.js keys days by
//     local date (`getFullYear`/`getMonth`/`getDate`).
//   - retention is measured from the same instant as the rust marker on the
//     skill tree (session.js's rustClock). If the two used different notions of
//     "last done well", the page and the tree would eventually disagree in
//     front of a parent.
import { dayKey } from './store.js';
import { SKILLS, SKILL } from './skills.js';
import { stateOf, starsOf, STAR_MAX, RUST, rustClock } from './session.js';
import { slipTotals, slipSkills } from './slips.js';

export const RETAIN_DAYS = RUST.days; // 21, the same threshold the rust marker uses
const DAY = 864e5;

const partsOf = (key) => key.split('-').map(Number);
const addDays = (key, n) => {
  const [y, m, d] = partsOf(key);
  return dayKey(new Date(y, m - 1, d + n)); // the Date constructor rolls months and years over
};
const dayOfMs = (ms) => dayKey(new Date(ms));

// The weekday label for bar `i` of a Monday-first week.
//
// weekday.N is Sunday-based (weekday.0 is Sunday), the bars are not, so this
// mapping is the one place the two conventions meet - and it is here, in a pure
// function, so the off-by-one gets caught by a test rather than by a parent.
const WEEKDAY_KEYS = ['weekday.0', 'weekday.1', 'weekday.2', 'weekday.3', 'weekday.4', 'weekday.5', 'weekday.6'];
export const barLabelKey = (i) => WEEKDAY_KEYS[(i + 1) % 7];

// Monday of the week the given day falls in.
export function weekStart(key) {
  const [y, m, d] = partsOf(key);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

// The seven day keys of that week, Monday first.
export function weekDays(key) {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Minutes and plays per day for the current week, plus the totals. Minutes come
// from `timeMs`, which is the basic round's elapsed time only - the same figure
// the practice-time trophies use.
export function week(history, today) {
  const days = weekDays(today);
  const bars = days.map((day) => ({ day, minutes: 0, plays: 0 }));
  const byDay = new Map(bars.map((b) => [b.day, b]));
  let ms = 0; let plays = 0;
  for (const h of history || []) {
    const bar = byDay.get(h.day);
    if (!bar) continue;
    bar.minutes += (h.timeMs || 0) / 60000;
    bar.plays += 1;
    ms += h.timeMs || 0;
    plays += 1;
  }
  for (const bar of bars) bar.minutes = Math.round(bar.minutes);
  return { days, minutes: Math.round(ms / 60000), plays, bars };
}

// How much of the curriculum is done, and how much of that happened this week.
export function mastery(prog, today) {
  const inWeek = new Set(weekDays(today));
  let mastered = 0; let stars = 0; let gained = 0;
  for (const sk of SKILLS) {
    if (stateOf(prog, sk.id) !== 'mastered') continue;
    mastered += 1;
    stars += starsOf(prog, sk.id);
    const r = prog.skills[sk.id];
    if (r && r.masteredAt && inWeek.has(dayOfMs(r.masteredAt))) gained += 1;
  }
  return { mastered, total: SKILLS.length, stars, starMax: SKILLS.length * STAR_MAX, gained };
}

// Do the skills they learned still work?
//
// Counted over EVERY mastered skill, not over rustyOf(): that one is trimmed to
// the three the skill tree displays, and using it as a denominator would make
// this figure say 100% forever.
export function retention(prog, today, days = RETAIN_DAYS) {
  const cutoff = new Date(partsOf(today)[0], partsOf(today)[1] - 1, partsOf(today)[2] - days + 1).getTime();
  let mastered = 0; let held = 0;
  const rusty = [];
  for (const [id, r] of Object.entries((prog && prog.skills) || {})) {
    // Same guard as the rust marker: a record for a skill that no longer exists
    // must not inflate the denominator, or this figure and the mastery count
    // above it would disagree on the same page.
    if (!SKILL[id] || !r || !r.mastered) continue;
    mastered += 1;
    const at = rustClock(r);
    if (at && at >= cutoff) held += 1;
    else rusty.push({ skill: id, at });
  }
  rusty.sort((a, b) => (a.at || 0) - (b.at || 0)); // longest neglected first
  return {
    mastered,
    held,
    rate: mastered ? held / mastered : null,
    rusty,
    days,
  };
}

// The last day anything was practised, as a day key, and how long ago that was.
export function lastPractice(history, today) {
  let last = null;
  for (const h of history || []) if (!last || h.day > last) last = h.day;
  if (!last) return { day: null, daysAgo: null };
  const a = new Date(partsOf(last)[0], partsOf(last)[1] - 1, partsOf(last)[2]).getTime();
  const b = new Date(partsOf(today)[0], partsOf(today)[1] - 1, partsOf(today)[2]).getTime();
  return { day: last, daysAgo: Math.round((b - a) / DAY) };
}

// Where a child keeps slipping, and what to do about it.
//
// The recommendation is data-driven rather than a hand-written table of
// "carry errors -> practise carrying": the skill named is the one where that
// cause actually happens most, so the advice is about the problems they really
// got wrong rather than about a category.
//
// Coverage is reported alongside, because it is the honest half of the story.
// Only proved slips are named, and a page listing three causes without saying
// how many slips went unexplained would read as more complete than it is.
export function slips(prog, { day, days = 30, limit = 3 } = {}) {
  const totals = slipTotals(prog || { skills: {} }, { day, days });
  const all = Object.values(totals).reduce((a, b) => a + b, 0);
  const unexplained = totals.unclassified || 0;
  const top = Object.entries(totals)
    .filter(([cause]) => cause !== 'unclassified')
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([cause, n]) => {
      const worst = slipSkills(prog, cause, { limit: 1 })[0];
      return { cause, n, skill: worst ? worst.skill : null };
    });
  return {
    days,
    total: all,
    explained: all - unexplained,
    unexplained,
    top,
    // The skill to practise: where the worst cause bites.
    next: (top[0] && top[0].skill) || null,
  };
}

// Everything the page needs, in one call. `streaks` comes from store.js because
// it needs the no-count days the hammer writes.
export function build(state, today, streaks) {
  return {
    today,
    week: week(state.history, today),
    mastery: mastery(state.progress, today),
    retention: retention(state.progress, today),
    last: lastPractice(state.history, today),
    slips: slips(state.progress, { day: today }),
    streak: streaks,
  };
}
