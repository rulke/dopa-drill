// Unlockable show (id041): backgrounds, correct marks, particles, music,
// Dopakichi's costume and colour, the crowd and the finale. Each item is the
// reward of one trophy (never random), so what is unlocked follows from the
// trophies earned; only the player's choice per category is saved.
// Names are Chinese source strings used as i18n keys (wrap with t() when shown).
import { TROPHY } from './trophies.js';

export const CATS = [
  { key: 'bg', name: '背景' },
  { key: 'mark', name: '答对标记', short: '标记' },
  { key: 'particle', name: '彩纸屑' },
  { key: 'music', name: '音乐' },
  { key: 'costume', name: '装扮' },
  { key: 'color', name: '多巴奇的颜色', short: '颜色' },
  { key: 'crowd', name: '观众' },
  { key: 'finale', name: '谢幕' },
];

// base: available from the start. trophy: the trophy whose reward it is.
export const ITEMS = [];
export const ITEM = {};
export function addItems(list) {
  for (const it of list) {
    ITEMS.push(it); ITEM[it.id] = it;
    if (it.trophy && TROPHY[it.trophy]) TROPHY[it.trophy].reward = it.id;
  }
}
addItems([
  { id: 'bg:classic', cat: 'bg', name: '放射线', base: true },
  { id: 'mark:hanamaru', cat: 'mark', name: '小红花', base: true },
  { id: 'particle:classic', cat: 'particle', name: '彩纸屑', base: true },
  { id: 'music:classic', cat: 'music', name: '马林巴进行曲', base: true },
  { id: 'costume:none', cat: 'costume', name: '无装扮', base: true },
  { id: 'color:pink', cat: 'color', name: '粉色', base: true },
  { id: 'crowd:classic', cat: 'crowd', name: '撞色观众', base: true },
  { id: 'finale:classic', cat: 'finale', name: '巨型多巴奇', base: true },
]);
// id041: one sample per category, to prove the pipeline end to end.
// Rewards follow effort and coming back (plays, days, streaks, stars earned by
// practice), not the placement check, which can master many skills at once.
addItems([
  { id: 'costume:cap', cat: 'costume', name: '帽子', trophy: 'days-1' },
  { id: 'particle:note', cat: 'particle', name: '音符', trophy: 'days-3' },
  { id: 'mark:stamp', cat: 'mark', name: '正确印章', trophy: 'plays-3' },
  { id: 'bg:night', cat: 'bg', name: '夜空', trophy: 'streak-3' },
  { id: 'color:blue', cat: 'color', name: '蓝色', trophy: 'plays-5' },
  { id: 'finale:fireworks', cat: 'finale', name: '烟花大会', trophy: 'extras-5' },
  { id: 'music:chip', cat: 'music', name: '8比特', trophy: 'plays-10' },
  { id: 'crowd:costume', cat: 'crowd', name: '换装观众', trophy: 'firstTry-50' },
]);
// id042: backgrounds, correct marks and particles.
addItems([
  { id: 'bg:sea', cat: 'bg', name: '大海与泡泡', trophy: 'problems-100' },
  { id: 'bg:festival', cat: 'bg', name: '祭典', trophy: 'days-15' },
  { id: 'bg:paper', cat: 'bg', name: '纸工作品', trophy: 'problems-200' },
  { id: 'bg:space', cat: 'bg', name: '宇宙', trophy: 'extras-10' },
  { id: 'mark:medal', cat: 'mark', name: '奖牌', trophy: 'streak-7' },
  { id: 'mark:crown', cat: 'mark', name: '皇冠', trophy: 'perfects-3' },
  { id: 'mark:ring', cat: 'mark', name: '烟花环', trophy: 'combo-30' },
  { id: 'particle:petal', cat: 'particle', name: '花瓣', trophy: 'stickers-7' },
  { id: 'particle:digit', cat: 'particle', name: '数字', trophy: 'cells-1000' },
  { id: 'particle:bubble', cat: 'particle', name: '泡泡', trophy: 'review-10' },
  { id: 'particle:candy', cat: 'particle', name: '糖果', trophy: 'extraBest-10' },
]);
// id043: songs (8比特 is the id041 sample).
addItems([
  { id: 'music:matsuri', cat: 'music', name: '祭典太鼓', trophy: 'streak-5' },
  { id: 'music:brass', cat: 'music', name: '铜管乐队', trophy: 'days-5' },
  { id: 'music:electro', cat: 'music', name: '电子乐', trophy: 'extras-3' },
]);
// id044: costumes, colours, crowd and finales (id045 moved three rewards to the new series).
addItems([
  { id: 'costume:hachimaki', cat: 'costume', name: '头巾', trophy: 'problems-50' },
  { id: 'costume:cape', cat: 'costume', name: '披风', trophy: 'combo-20' },
  { id: 'costume:glasses', cat: 'costume', name: '圆眼镜', trophy: 'firstTry-100' },
  { id: 'costume:ribbon', cat: 'costume', name: '蝴蝶结', trophy: 'stickers-14' },
  { id: 'costume:crown', cat: 'costume', name: '皇冠', trophy: 'streak-14' },
  { id: 'costume:wizard', cat: 'costume', name: '魔法帽', trophy: 'star5-1' },
  { id: 'costume:headphones', cat: 'costume', name: '耳机', trophy: 'capsules-1' },
  { id: 'color:mint', cat: 'color', name: '薄荷绿', trophy: 'days-7' },
  { id: 'color:snow', cat: 'color', name: '雪白', trophy: 'questDays-7' },
  { id: 'color:yellow', cat: 'color', name: '黄色', trophy: 'problems-300' },
  { id: 'color:violet', cat: 'color', name: '紫色', trophy: 'extraSolved-100' },
  { id: 'color:gold', cat: 'color', name: '金色', trophy: 'streak-30' },
  { id: 'color:rainbow', cat: 'color', name: '彩虹色', trophy: 'days-100' },
  { id: 'crowd:rainbow', cat: 'crowd', name: '彩虹观众', trophy: 'days-30' },
  { id: 'crowd:twins', cat: 'crowd', name: '同款观众', trophy: 'starsTotal-100' },
  { id: 'finale:parade', cat: 'finale', name: '游行', trophy: 'streak-10' },
  { id: 'finale:rocket', cat: 'finale', name: '火箭', trophy: 'extras-20' },
]);
// id046: the endless mode's rewards. Its twelve trophies used to unlock nothing
// at all, so the mode that is played for its own sake fed no part of the
// collection. One item per trophy, spread over the categories the mode can speak
// to; the two most expensive rewards sit on its two hardest feats.
addItems([
  { id: 'crowd:full', cat: 'crowd', name: '满座', trophy: 'endlessRuns-3' },
  { id: 'color:nebula', cat: 'color', name: '星云', trophy: 'endlessRuns-30' },
  { id: 'mark:heart', cat: 'mark', name: '心心', trophy: 'endlessRunBest-20' },
  { id: 'particle:twinkle', cat: 'particle', name: '星星', trophy: 'endlessRunBest-50' },
  { id: 'bg:steps', cat: 'bg', name: '光阶', trophy: 'endlessBest-10' },
  { id: 'costume:laurel', cat: 'costume', name: '月桂冠', trophy: 'endlessBest-20' },
  { id: 'finale:curtain', cat: 'finale', name: '落幕', trophy: 'endlessClean-12' },
  { id: 'music:endless', cat: 'music', name: '无尽', trophy: 'endlessBest-30' },
]);

export const isUnlocked = (it, got = {}) => !!(it && (it.base || (it.trophy && got[it.trophy])));
export const unlockedIn = (cat, got) => ITEMS.filter((it) => it.cat === cat && isUnlocked(it, got));
export const defaultEquip = () => Object.fromEntries(CATS.map((c) => [c.key, 'auto']));

// The look for one play: fixed choices stay; "auto" picks among the unlocked
// ones so every play can look and sound a little different.
export function pickLook(equip = {}, got = {}, rng = Math.random) {
  const look = {};
  for (const { key } of CATS) {
    const want = equip[key];
    const own = unlockedIn(key, got);
    if (want && want !== 'auto' && own.some((it) => it.id === want)) look[key] = want;
    else look[key] = own[Math.floor(rng() * own.length)].id;
  }
  return look;
}
// The part after "cat:" (what the show modules switch on).
export const variant = (id) => (id ? id.split(':')[1] : 'classic');
