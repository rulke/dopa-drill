// The growth page's figures. Every one of them has to be right in front of a
// parent, so the tests are about the definitions as much as the arithmetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, weekDays, week, mastery, retention, lastPractice, barLabelKey, slips, build, RETAIN_DAYS } from '../app/js/report.js';
import { noteSlip } from '../app/js/slips.js';
import { emptyProgress, skillRecord } from '../app/js/session.js';
import { SKILLS } from '../app/js/skills.js';
import { STAR_MAX } from '../app/js/session.js';

test('the week runs Monday to Sunday', () => {
  // 2026-10-10 is a Saturday.
  assert.equal(new Date(2026, 9, 10).getDay(), 6);
  assert.equal(weekStart('2026-10-10'), '2026-10-05');
  assert.equal(weekStart('2026-10-05'), '2026-10-05', 'a Monday is its own week start');
  assert.equal(weekStart('2026-10-11'), '2026-10-05', 'Sunday belongs to the week that began on Monday');
  assert.deepEqual(weekDays('2026-10-10'), [
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
  ]);
});

test('the week crosses month and year boundaries', () => {
  assert.equal(weekStart('2026-01-01'), '2025-12-29'); // a Thursday
  assert.deepEqual(weekDays('2025-12-31').slice(0, 3), ['2025-12-29', '2025-12-30', '2025-12-31']);
});

test('weekly minutes and plays only count days inside the week', () => {
  const history = [
    { day: '2026-10-04', timeMs: 60000 },   // the Sunday before
    { day: '2026-10-05', timeMs: 90000 },   // Monday
    { day: '2026-10-10', timeMs: 120000 },
    { day: '2026-10-10', timeMs: 60000 },
    { day: '2026-10-12', timeMs: 60000 },   // the Monday after
  ];
  const w = week(history, '2026-10-10');
  assert.equal(w.minutes, 5, '90s + 120s + 60s = 4.5 min, rounded');
  assert.equal(w.plays, 3);
  const saturday = w.bars.find((b) => b.day === '2026-10-10');
  assert.equal(saturday.minutes, 3);
  assert.equal(saturday.plays, 2);
  assert.equal(w.bars.find((b) => b.day === '2026-10-05').minutes, 2, 'rounds to the nearest minute');
  assert.equal(w.bars.length, 7);
});

test('a round with no recorded time still counts as a play', () => {
  const w = week([{ day: '2026-10-06' }], '2026-10-10');
  assert.equal(w.plays, 1);
  assert.equal(w.minutes, 0);
});

test('mastery counts the tree, and this week separately', () => {
  const prog = emptyProgress();
  const week = weekDays('2026-10-10');
  // One mastered this week, one mastered long ago.
  for (const [id, when] of [[SKILLS[0].id, new Date(2026, 9, 8).getTime()], [SKILLS[1].id, new Date(2026, 0, 5).getTime()]]) {
    const r = skillRecord(prog, id);
    r.mastered = true; r.masteredAt = when; r.grantedAt = when; r.lastOk = when; r.stars = 3;
  }
  const m = mastery(prog, '2026-10-10');
  assert.equal(m.mastered, 2);
  assert.equal(m.total, SKILLS.length);
  assert.equal(m.stars, 6);
  assert.equal(m.starMax, SKILLS.length * STAR_MAX);
  assert.equal(m.gained, 1, 'only the one mastered inside this week');
});

test('retention counts every mastered skill, not the three the tree shows', () => {
  const prog = emptyProgress();
  const recent = new Date(2026, 9, 9).getTime();
  const stale = new Date(2026, 7, 1).getTime();   // well past the threshold
  for (let i = 0; i < 5; i++) {
    const r = skillRecord(prog, SKILLS[i].id);
    r.mastered = true; r.masteredAt = stale; r.grantedAt = stale;
    r.lastOk = i < 2 ? recent : stale;
  }
  const t = retention(prog, '2026-10-10');
  assert.equal(t.mastered, 5, 'all five are in the denominator');
  assert.equal(t.held, 2);
  assert.equal(t.rate, 2 / 5);
  assert.equal(t.rusty.length, 3);
  assert.equal(t.days, RETAIN_DAYS);
});

test('retention falls back to the mastery date when nothing was answered well since', () => {
  const prog = emptyProgress();
  const r = skillRecord(prog, SKILLS[0].id);
  r.mastered = true; r.masteredAt = new Date(2026, 9, 9).getTime(); // no lastOk, no grantedAt
  const t = retention(prog, '2026-10-10');
  assert.equal(t.held, 1, 'the same fallback the rust marker uses');
});

test('retention is undefined rather than perfect with nothing mastered', () => {
  const t = retention(emptyProgress(), '2026-10-10');
  assert.equal(t.mastered, 0);
  assert.equal(t.rate, null, 'no denominator, no percentage');
});

test('the neglected skills come back worst first', () => {
  const prog = emptyProgress();
  for (const [id, month] of [[SKILLS[0].id, 5], [SKILLS[1].id, 7], [SKILLS[2].id, 6]]) {
    const r = skillRecord(prog, id);
    r.mastered = true; r.masteredAt = new Date(2026, month, 1).getTime();
    r.lastOk = new Date(2026, month, 1).getTime();
  }
  const t = retention(prog, '2026-10-10');
  assert.deepEqual(t.rusty.map((x) => x.skill), [SKILLS[0].id, SKILLS[2].id, SKILLS[1].id]);
});

test('last practice is the most recent day with a record', () => {
  assert.deepEqual(lastPractice([], '2026-10-10'), { day: null, daysAgo: null });
  const l = lastPractice([{ day: '2026-10-08' }, { day: '2026-10-10' }, { day: '2026-10-09' }], '2026-10-10');
  assert.equal(l.day, '2026-10-10');
  assert.equal(l.daysAgo, 0);
  assert.equal(lastPractice([{ day: '2026-09-30' }], '2026-10-10').daysAgo, 10);
});

// weekday.N is Sunday-based, the bar row starts on Monday. Getting this wrong
// shifts every label by one, which is invisible in a test that only counts bars
// and glaring on the screen.
test('the Monday-first bars take the weekday labels shifted, not straight', () => {
  assert.deepEqual(
    Array.from({ length: 7 }, (_, i) => barLabelKey(i)),
    ['weekday.1', 'weekday.2', 'weekday.3', 'weekday.4', 'weekday.5', 'weekday.6', 'weekday.0'],
  );
  assert.equal(barLabelKey(0), 'weekday.1', 'the first bar is Monday');
  assert.equal(barLabelKey(6), 'weekday.0', 'the last bar is Sunday');
});

// A record for a skill that no longer exists must not count, or the retention
// denominator disagrees with the mastery count printed just above it.
test('retention ignores records for skills that are not in the tree', () => {
  const prog = emptyProgress();
  const at = new Date(2026, 9, 9).getTime();
  const real = SKILLS[0].id;
  const ghost = 'not-a-skill';
  for (const id of [real, ghost]) {
    const r = skillRecord(prog, id);
    r.mastered = true; r.masteredAt = at; r.grantedAt = at; r.lastOk = at;
  }
  const m = mastery(prog, '2026-10-10');
  const t = retention(prog, '2026-10-10');
  assert.equal(m.mastered, 1, 'mastery only walks the tree');
  assert.equal(t.mastered, 1, 'so retention must agree');
  assert.equal(t.rate, 1);
  assert.deepEqual(t.rusty, []);
});

test('the neglected list never carries an unnamed skill', () => {
  const prog = emptyProgress();
  const r = skillRecord(prog, 'not-a-skill');
  r.mastered = true; r.masteredAt = new Date(2026, 0, 1).getTime();
  assert.deepEqual(retention(prog, '2026-10-10').rusty, []);
});

// ---------------------------------------------------------------- slips

test('the worst causes come back in order, with the skill they bite in', () => {
  const prog = emptyProgress();
  const day = '2026-10-10';
  noteSlip(prog, SKILLS[0].id, 'carry', day);
  noteSlip(prog, SKILLS[0].id, 'carry', day);
  noteSlip(prog, SKILLS[1].id, 'borrowZero', day);
  noteSlip(prog, SKILLS[2].id, 'swap', day);

  const s = slips(prog, { day });
  assert.deepEqual(s.top.map((x) => x.cause), ['carry', 'borrowZero', 'swap']);
  assert.equal(s.top[0].n, 2);
  assert.equal(s.top[0].skill, SKILLS[0].id, 'the skill where that cause happens most');
  assert.equal(s.next, SKILLS[0].id, 'and that is what to practise next');
});

test('the skill named is the one the cause actually happens in', () => {
  const prog = emptyProgress();
  const day = '2026-10-10';
  noteSlip(prog, SKILLS[0].id, 'carry', day);
  for (let i = 0; i < 4; i++) noteSlip(prog, SKILLS[3].id, 'carry', day);
  assert.equal(slips(prog, { day }).top[0].skill, SKILLS[3].id);
});

test('unexplained slips are counted but never recommended', () => {
  const prog = emptyProgress();
  const day = '2026-10-10';
  noteSlip(prog, SKILLS[0].id, null, day);
  noteSlip(prog, SKILLS[0].id, null, day);
  noteSlip(prog, SKILLS[0].id, 'carry', day);

  const s = slips(prog, { day });
  assert.equal(s.total, 3);
  assert.equal(s.explained, 1);
  assert.equal(s.unexplained, 2);
  assert.deepEqual(s.top.map((x) => x.cause), ['carry'], 'unclassified is not a "cause" to report');
});

test('a child with nothing attributed yet gets no advice, not bad advice', () => {
  const prog = emptyProgress();
  const s = slips(prog, { day: '2026-10-10' });
  assert.equal(s.total, 0);
  assert.deepEqual(s.top, []);
  assert.equal(s.next, null, 'the caller decides what to suggest instead');
});

test('only the configured window of days is reported', () => {
  const prog = emptyProgress();
  noteSlip(prog, SKILLS[0].id, 'carry', '2026-10-10');
  noteSlip(prog, SKILLS[0].id, 'borrowZero', '2026-01-01');
  const s = slips(prog, { day: '2026-10-10', days: 30 });
  assert.deepEqual(s.top.map((x) => x.cause), ['carry']);
  assert.equal(s.total, 1);
});

test('the report carries the slip section and it survives an empty save', () => {
  const prog = emptyProgress();
  const r = build({ history: [], progress: prog }, '2026-10-10', { current: 0, best: 0 });
  assert.equal(r.slips.total, 0);
  assert.equal(r.week.plays, 0);
  assert.equal(r.mastery.mastered, 0);
});
