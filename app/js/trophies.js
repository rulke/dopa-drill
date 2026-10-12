// Trophies (id036): many small achievements, like the ones in mobile games.
// Each series is one measure with rising steps; every step is a trophy.
// Days and streaks get dense steps; volume series get wide ones so long
// sessions are not pushed too hard (docs/SPEC.md 14.7). Nothing is
// random, conditions are always shown (except a few secrets), and a trophy,
// once earned, is kept.
// Names and descriptions are resolved at display time via trophyName() /
// trophyDesc() so a language switch only needs the pack, not a rebuild.
import { SKILLS, LANES } from './skills.js';
import { isUnlocked, isMastered, starsOf } from './session.js';
import { t, fmtNum, getLocale } from './i18n.js';
import { fmtDopa } from './scoring.js';

export const CATS = ['坚持', '数量', '技能', '成长', '加时挑战', '无尽', '连击', '准确', '多巴', '复习', '年级', '收藏', '秘密'];

// Compact number for trophy names: 1万 / 10K style.
const fmt = (n) => {
  if (getLocale() === 'en') return n >= 1000000 ? `${n / 1000000}M` : n >= 10000 ? `${n / 1000}K` : fmtNum(n);
  return n >= 10000 && n % 10000 === 0 ? `${n / 10000}万` : fmtNum(n);
};
const RANKS = ['bronze', 'silver', 'gold', 'rainbow'];
export const RANK_NAME = { bronze: '铜', silver: '银', gold: '金', rainbow: '彩虹', secret: '秘密' };

// Rank by position in its series: first ~30% bronze, then silver, gold, and the last step rainbow.
function rankAt(i, n) {
  if (n === 1) return 'gold';
  if (i === n - 1) return 'rainbow';
  return RANKS[Math.min(2, Math.floor((i / (n - 1)) * 3.3))];
}

// A series: { key, cat, title, metric, steps, name(v), desc(v) } or explicit items.
const SERIES_DEFS = [
  { key: 'streak', cat: '坚持', title: '连续来玩', metric: 'bestStreak', steps: [3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 365], name: (v) => t('连续{n}天', { n: v }), desc: (v) => t('连续{n}天来玩', { n: v }) },
  { key: 'days', cat: '坚持', title: '打卡天数', metric: 'days', steps: [1, 3, 5, 7, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 365, 500, 730, 1000], name: (v) => t('打卡{n}天', { n: fmt(v) }), desc: (v) => t('累计打卡{n}天', { n: fmt(v) }) },
  { key: 'stickers', cat: '坚持', title: '登录贴纸', metric: 'stickers', steps: [1, 7, 14, 30, 50, 100, 200, 365], name: (v) => t('贴纸{n}张', { n: v }), desc: (v) => t('收集{n}张登录贴纸', { n: v }) },
  { key: 'crowns', cat: '坚持', title: '皇冠贴纸', metric: 'crowns', steps: [1, 3, 5, 10, 20, 52], name: (v) => t('{n}个皇冠', { n: v }), desc: (v) => t('收集{n}个第7天的皇冠贴纸', { n: v }) },
  { key: 'problems', cat: '数量', title: '解过的题', metric: 'problems', steps: [10, 30, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 20000, 30000, 50000, 100000], name: (v) => t('解题{n}道', { n: fmt(v) }), desc: (v) => t('累计解题{n}道', { n: fmt(v) }) },
  { key: 'cells', cat: '数量', title: '输入的数字', metric: 'cells', steps: [100, 500, 1000, 3000, 5000, 10000, 30000, 50000, 100000, 300000], name: (v) => t('输入{n}位', { n: fmt(v) }), desc: (v) => t('累计正确输入{n}位数字', { n: fmt(v) }) },
  { key: 'plays', cat: '数量', title: '练习次数', metric: 'plays', steps: [1, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000], name: (v) => t('练习{n}次', { n: fmt(v) }), desc: (v) => t('累计完整练习{n}次', { n: fmt(v) }) },
  { key: 'minutes', cat: '数量', title: '练习时间', metric: 'minutes', steps: [10, 30, 60, 120, 300, 600, 1200, 3000], name: (v) => (v >= 60 ? t('累计{n}小时', { n: v / 60 }) : t('累计{n}分钟', { n: v })), desc: (v) => (v >= 60 ? t('累计练习{n}小时', { n: v / 60 }) : t('累计练习{n}分钟', { n: v })) },
  { key: 'unlocked', cat: '技能', title: '解锁技能', metric: 'unlocked', steps: [3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58], name: (v) => t('解锁{n}项', { n: v }), desc: (v) => t('解锁{n}项技能', { n: v }) },
  { key: 'mastered', cat: '技能', title: '掌握技能', metric: 'mastered', steps: [1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58], name: (v) => t('掌握{n}项', { n: v }), desc: (v) => t('掌握{n}项技能', { n: v }) },
  { key: 'gradeDone', cat: '技能', title: '按年级全部掌握', items: [1, 2, 3, 4, 5, 6].map((g) => ({ id: `gradeDone-${g}`, metric: `gradeDone${g}`, need: 1, arg: g, name: (v) => t('掌握全部{g}年级', { g: v }), desc: (v) => t('掌握{g}年级的全部技能', { g: v }) })) },
  { key: 'laneDone', cat: '技能', title: '按系统全部掌握', items: LANES.map((l, i) => ({ id: `laneDone-${i}`, metric: `laneDone${i}`, need: 1, arg: l, name: (v) => t('掌握{l}', { l: t(v) }), desc: (v) => t('掌握「{l}」的全部技能', { l: t(v) }) })) },
  { key: 'extras', cat: '加时挑战', title: '进入加时挑战', metric: 'extras', steps: [1, 3, 5, 10, 20, 30, 50, 100, 200, 300], name: (v) => t('加时挑战{n}次', { n: v }), desc: (v) => t('进入加时挑战{n}次', { n: v }) },
  { key: 'extraBest', cat: '加时挑战', title: '加时单次最佳', metric: 'extraBest', steps: [3, 5, 7, 10, 12, 15, 18, 20, 23, 25, 30], name: (v) => t('单次{n}题', { n: v }), desc: (v) => t('单次加时挑战解题{n}道', { n: v }) },
  { key: 'extraSolved', cat: '加时挑战', title: '加时解题', metric: 'extraSolved', steps: [10, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000], name: (v) => t('加时{n}题', { n: fmt(v) }), desc: (v) => t('加时挑战累计解题{n}道', { n: fmt(v) }) },
  { key: 'combo', cat: '连击', title: '连击', metric: 'maxCombo', steps: [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300], name: (v) => t('{n}连击', { n: v }), desc: (v) => t('达成{n}连击', { n: v }) },
  { key: 'perfects', cat: '准确', title: '零失误完成', metric: 'perfects', steps: [1, 3, 5, 10, 20, 30, 50, 100, 200, 300], name: (v) => t('零失误{n}次', { n: v }), desc: (v) => t('以100%一次答对率完整练习{n}次', { n: v }) },
  { key: 'firstTry', cat: '准确', title: '一次答对', metric: 'firstTry', steps: [10, 50, 100, 300, 500, 1000, 3000, 5000, 10000, 30000], name: (v) => t('一次答对{n}题', { n: fmt(v) }), desc: (v) => t('累计{n}题一次答对', { n: fmt(v) }) },
  // Steps past 9 (10億) are only reachable in the endless run: its curve does not
  // converge, so 兆 and 京 are what the long run is for.
  { key: 'dopa', cat: '多巴', title: '多巴', metric: 'bestDopaL', steps: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16], name: (v) => t('{l}多巴', { l: fmtDopa(v) }), desc: (v) => t('单次练习多巴超过{l}', { l: fmtDopa(v) }) },
  { key: 'review', cat: '复习', title: '复习', metric: 'reviewSolved', steps: [1, 5, 10, 30, 50, 100, 200, 300], name: (v) => t('复习{n}题', { n: v }), desc: (v) => t('重做{n}道错题', { n: v }) },
  ...[1, 2, 3, 4, 5, 6].map((g) => ({ key: `grade${g}`, cat: '年级', title: () => t('用{g}年级练习', { g }), metric: `gradePlays${g}`, steps: [1, 10, 30], name: (v) => t('{g}年级练习{n}次', { g, n: v }), desc: (v) => t('用「{g}年级」练习{n}次', { g, n: v }) })),
  { key: 'secret', cat: '秘密', title: '秘密', items: [
    { id: 'secret-perfect14', metric: 'flag:perfect14', need: 1, name: () => t('14题零失误'), desc: () => t('以14题的题量零失误完成'), secret: true },
    { id: 'secret-extraClean', metric: 'flag:extraClean', need: 1, name: () => t('加时挑战零失误'), desc: () => t('加时挑战答对5题以上且零失误'), secret: true },
    { id: 'secret-sunday', metric: 'flag:sunday', need: 1, name: () => t('周日口算'), desc: () => t('在周日练习'), secret: true },
    { id: 'secret-newyear', metric: 'flag:newyear', need: 1, name: () => t('元旦口算'), desc: () => t('在1月1日练习'), secret: true },
    { id: 'secret-comeback', metric: 'flag:comeback', need: 1, name: () => t('欢迎回来！'), desc: () => t('隔了1周以上再回来练习'), secret: true },
    { id: 'secret-allmodes', metric: 'allModes', need: 1, name: () => t('体验所有玩法'), desc: () => t('把我的等级、按年级、练习、复习都玩一遍'), secret: true },
  ] },
];

// Other features add their own series (id045). Keep this list append-only.
export const SERIES = [];
export const TROPHIES = [];
export const TROPHY = {};
export function addSeries(def) {
  const items = def.items
    ? def.items.map((it, i, a) => ({ rank: it.secret ? 'secret' : rankAt(i, a.length), ...it }))
    : def.steps.map((v, i, a) => ({ id: `${def.key}-${v}`, metric: def.metric, need: v, arg: v, name: def.name, desc: def.desc, rank: rankAt(i, a.length) }));
  const series = { key: def.key, cat: def.cat, title: def.title, items: items.map((it) => ({ ...it, series: def.key, cat: def.cat, reward: it.reward || null })) };
  SERIES.push(series);
  for (const it of series.items) { TROPHIES.push(it); TROPHY[it.id] = it; }
  return series;
}
SERIES_DEFS.forEach(addSeries);

// Display helpers: names and descs are functions of their stored arg;
// titles may be a function (series built in a loop) or a key.
export const trophyName = (it) => (typeof it.name === 'function' ? it.name(it.arg) : t(it.name));
export const trophyDesc = (it) => (typeof it.desc === 'function' ? it.desc(it.arg) : t(it.desc));
export const seriesTitle = (s) => (typeof s.title === 'function' ? s.title() : t(s.title));

// id045: the features added after id036 (stars, quests, hammer, rust,
// time capsule, "进步啦", collection).
[
  { key: 'questDays', cat: '坚持', title: '任务全部完成', metric: 'questDays', steps: [1, 3, 7, 14, 30, 50, 100, 200, 365], name: (v) => t('全部完成{n}天', { n: v }), desc: (v) => t('有{n}天完成了全部今日任务', { n: v }) },
  { key: 'questRun', cat: '坚持', title: '任务连续', metric: 'questRun', steps: [2, 3, 5, 7, 14, 30], name: (v) => t('任务连续{n}天', { n: v }), desc: (v) => t('连续{n}天完成全部任务', { n: v }) },
  { key: 'hammer', cat: '坚持', title: '补签锤', metric: 'hammerUsed', steps: [1, 3, 10], name: (v) => (v === 1 ? t('第一次补签') : t('补签{n}次', { n: v })), desc: (v) => t('使用{n}次补签锤', { n: v }) },
  { key: 'starsTotal', cat: '技能', title: '星星数', metric: 'starsTotal', steps: [5, 10, 25, 50, 75, 100, 150, 200, 250, 290], name: (v) => t('{n}颗星', { n: v }), desc: (v) => t('累计收集{n}颗技能星', { n: v }) },
  { key: 'star5', cat: '技能', title: '☆5技能', metric: 'star5', steps: [1, 3, 5, 10, 20, 30, 58], name: (v) => t('☆5 {n}项', { n: v }), desc: (v) => t('把{n}项技能练到☆5', { n: v }) },
  { key: 'gradeStar3', cat: '技能', title: '按年级全部☆3', items: [1, 2, 3, 4, 5, 6].map((g) => ({ id: `gradeStar3-${g}`, metric: `gradeStar3${g}`, need: 1, arg: g, name: (v) => t('{g}年级全部☆3', { g: v }), desc: (v) => t('把{g}年级的全部技能练到☆3以上', { g: v }) })) },
  { key: 'endlessBest', cat: '无尽', title: '最高波次', metric: 'endlessBest', steps: [3, 5, 10, 15, 20, 30], name: (v) => t('最高{n}波', { n: v }), desc: (v) => t('无尽模式打到第{n}波', { n: v }) },
  { key: 'endlessSolved', cat: '无尽', title: '无尽解题', metric: 'endlessSolved', steps: [10, 30, 50, 100, 300, 1000], name: (v) => t('无尽答对{n}题', { n: v }), desc: (v) => t('在无尽模式里累计答对{n}题', { n: v }) },
  // The endless mode's other two axes. Wave and total only reward going further or
  // playing more; these catch showing up, surviving long in one run, and never
  // erring - so a child who never beats their record still has something to earn.
  { key: 'endlessRuns', cat: '无尽', title: '无尽局数', metric: 'endlessRuns', steps: [1, 3, 10, 30, 100, 300], name: (v) => t('无尽{n}局', { n: v }), desc: (v) => t('玩{n}局无尽挑战', { n: v }) },
  { key: 'endlessRunBest', cat: '无尽', title: '单局答对', metric: 'endlessRunBest', steps: [10, 20, 30, 50, 80, 120], name: (v) => t('单局答对{n}题', { n: v }), desc: (v) => t('无尽模式一局里答对{n}题', { n: v }) },
  { key: 'endlessClean', cat: '无尽', title: '零失误到第几波', metric: 'endlessCleanWave', steps: [2, 3, 5, 8, 12], name: (v) => t('零失误到第{n}波', { n: v }), desc: (v) => t('一次都没错地打到第{n}波', { n: v }) },
  { key: 'polished', cat: '成长', title: '擦亮生锈', metric: 'polished', steps: [1, 3, 5, 10, 30, 50], name: (v) => t('擦亮{n}次', { n: v }), desc: (v) => t('擦亮{n}次生锈技能', { n: v }) },
  { key: 'capsules', cat: '成长', title: '时间胶囊', metric: 'capsules', steps: [1, 3, 5, 10, 30], name: (v) => t('打开{n}个', { n: v }), desc: (v) => t('打开{n}个时间胶囊', { n: v }) },
  { key: 'capsuleFaster', cat: '成长', title: '比那天更快', metric: 'capsuleFaster', steps: [1, 5, 10], name: (v) => t('比那天快{n}次', { n: v }), desc: (v) => t('在时间胶囊中比那天更快解出（{n}次）', { n: v }) },
  { key: 'grew', cat: '成长', title: '进步啦！', metric: 'grew', steps: [1, 5, 10, 30, 50, 100], name: (v) => t('进步{n}次', { n: v }), desc: (v) => t('结算页出现{n}次「进步啦！」', { n: v }) },
  { key: 'items', cat: '收藏', title: '收藏', metric: 'itemsOwned', steps: [10, 20, 30, 40, 47, 55], name: (v) => t('收藏{n}项', { n: v }), desc: (v) => t('收集{n}项收藏', { n: v }) },
  { key: 'catComplete', cat: '收藏', title: '集齐一套', metric: 'catComplete', steps: [1, 3, 5, 8], name: (v) => t('{n}类全部集齐', { n: v }), desc: (v) => t('把{n}类收藏全部集齐', { n: v }) },
].forEach(addSeries);

// Numbers every trophy is measured against, from the saved state.
// snap: { stats, prog, bestStreak, stickers, crowns, ...extra metrics }
export function trophyMetrics(snap) {
  const s = snap.stats || {};
  const prog = snap.prog || { skills: {} };
  const m = {
    bestStreak: snap.bestStreak || 0, days: s.days || 0, stickers: snap.stickers || 0, crowns: snap.crowns || 0,
    problems: s.problems || 0, cells: s.cells || 0, plays: s.plays || 0, minutes: Math.floor((s.playMs || 0) / 60000),
    unlocked: SKILLS.filter((x) => isUnlocked(prog, x.id)).length, mastered: SKILLS.filter((x) => isMastered(prog, x.id)).length,
    extras: s.extras || 0, extraBest: s.extraBest || 0, extraSolved: s.extraSolved || 0, maxCombo: s.maxCombo || 0,
    endlessRuns: s.endlessRuns || 0, endlessSolved: s.endlessSolved || 0, endlessBest: s.endlessBest || 0,
    endlessRunBest: s.endlessRunBest || 0, endlessCleanWave: s.endlessCleanWave || 0,
    perfects: s.perfects || 0, firstTry: s.firstTry || 0, bestDopaL: Math.floor((s.bestDopaL || 0) + 1e-9), reviewSolved: s.reviewSolved || 0,
  };
  const stars = Object.fromEntries(SKILLS.map((x) => [x.id, starsOf(prog, x.id)]));
  m.starsTotal = Object.values(stars).reduce((a, b) => a + b, 0);
  m.star5 = Object.values(stars).filter((n) => n >= 5).length;
  m.polished = s.polished || 0; m.capsules = s.capsules || 0; m.capsuleFaster = s.capsuleFaster || 0; m.grew = s.grew || 0;
  for (let g = 1; g <= 6; g++) {
    m[`gradeStar3${g}`] = SKILLS.filter((x) => x.grade === g).every((x) => stars[x.id] >= 3) ? 1 : 0;
    m[`gradeDone${g}`] = SKILLS.filter((x) => x.grade === g).every((x) => isMastered(prog, x.id)) ? 1 : 0;
    m[`gradePlays${g}`] = (s.grades || {})[g] || 0;
  }
  LANES.forEach((_, i) => { m[`laneDone${i}`] = SKILLS.filter((x) => x.lane === i).every((x) => isMastered(prog, x.id)) ? 1 : 0; });
  for (const [k, v] of Object.entries(s.flags || {})) if (v) m[`flag:${k}`] = 1;
  const modes = s.modes || {};
  m.allModes = ['level', 'grade', 'practice', 'review'].every((k) => modes[k]) ? 1 : 0;
  Object.assign(m, snap.extra || {});
  return m;
}
export const valueOf = (m, metric) => m[metric] || 0;

// Earn every trophy whose condition is met. Returns the new ones (in list order).
// `state` is the saved { got: { id: time } }; the first call earns what the
// existing records already reach and marks them as a batch.
export function evaluate(state, metrics, at = Date.now()) {
  state.got = state.got || {};
  const fresh = [];
  for (const tr of TROPHIES) {
    if (state.got[tr.id]) continue;
    if (valueOf(metrics, tr.metric) >= tr.need) { state.got[tr.id] = at; fresh.push(tr); }
  }
  if (!state.init) { state.init = true; state.batch = fresh.map((tr) => tr.id); return []; }
  return fresh;
}

export const earnedCount = (state) => TROPHIES.filter((tr) => state.got && state.got[tr.id]).length;

// Progress of one series for the list screen.
export function seriesView(series, state, metrics) {
  const got = series.items.filter((tr) => state.got && state.got[tr.id]);
  const next = series.items.find((tr) => !(state.got && state.got[tr.id]));
  const top = got[got.length - 1] || null;
  return { series, got, next, top, value: next ? valueOf(metrics, next.metric) : null };
}
