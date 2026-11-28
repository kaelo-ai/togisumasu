/* ===== pace: course progress squares and the finish-date estimate =====
   Shared by the browser and the tests. No DOM.

   Remaining work for one course is measured in XP:
     unmastered topic x 11  (a lesson, its practice items and the first reviews)
     topic in repair  x 6
     mastered topic that is due for review x 2
   A topic that is mastered but held back by a prerequisite this course adds (see
   Mastery.missingCoursePrereqs, PR #24) costs nothing itself: it counts as soon as
   the prerequisite does, and the prerequisite is already counted.

   Pace is the average XP per day over the last 14 days once there are at least 3
   active days; until then it is the daily goal. A learner who started less than 14
   days ago is averaged over the days since they started, not over 14.
   Dates are phrased as part of a month ("mid-January") until there is a week of
   history, then as a day ("14 January"). The estimate is recomputed at most once a
   day per course and goal, so it does not wobble after every answer. */
'use strict';
(function (root) {
const M = root.Mastery || (typeof require === 'function' ? require('./mastery.js') : null);
const DAY = 864e5;
const XP = { unmastered: 11, repair: 6, due: 2 };
const PACE = { windowDays: 14, minActiveDays: 3, preciseAfterDays: 7, maxDays: 3650 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
// Whole local days from a to b (DST-safe).
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const keyToTime = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const addDays = (t, n) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() + n); return d.getTime(); };

function topicsOf(catalog) {
  if (!catalog) return [];
  if (Array.isArray(catalog.topics)) return catalog.topics;
  if (Array.isArray(catalog.units)) return catalog.units.flatMap(u => (u.topics || []).map(t => ({ ...t, unit: t.unit || u.id })));
  return [];
}
// The Mastery helpers want { topics: [...] } with `pre` arrays.
const asCatalog = catalog => ({ ...(catalog || {}), topics: topicsOf(catalog).map(t => ({ ...t, pre: t.pre || [] })) });

/* ---------- what is left in one course ---------- */
function remaining(progress, catalog, now) {
  const cat = asCatalog(catalog), t = now == null ? Date.now() : now;
  const n = { total: cat.topics.length, mastered: 0, unmastered: 0, repair: 0, due: 0, held: 0 };
  for (const topic of cat.topics) {
    const s = M.skillOf(progress || {}, topic.id);
    if (s.fix) { n.repair++; continue; }
    if (s.lv > 0) {
      if (M.isCourseMastered(progress, topic.id, cat)) { n.mastered++; if (s.due && s.due <= t) n.due++; }
      else n.held++;
      continue;
    }
    n.unmastered++;
  }
  n.xp = n.unmastered * XP.unmastered + n.repair * XP.repair + n.due * XP.due;
  return n;
}

/* ---------- how fast the learner goes ---------- */
function pace(log, goal, now) {
  const t = now == null ? Date.now() : now, L = log || {};
  const days = Object.keys(L).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(L[k]) > 0 && keyToTime(k) <= t);
  const first = days.length ? Math.min(...days.map(keyToTime)) : null;
  const history = first == null ? 0 : daysBetween(first, t) + 1;        // days since the first active day, today included
  const span = Math.max(1, Math.min(PACE.windowDays, history));
  let sum = 0, active = 0;
  for (let i = 0; i < span; i++) {
    const x = Number(L[M.dayKey(addDays(t, -i))]) || 0;
    if (x > 0) { sum += x; active++; }
  }
  const fromLog = active >= PACE.minActiveDays;
  return { xpPerDay: fromLog ? sum / span : goal, source: fromLog ? 'log' : 'goal', activeDays: active, historyDays: history, span };
}

/* ---------- turning XP into a date ---------- */
function finishAt(xp, perDay, now) {
  if (xp <= 0) return { days: 0, at: startOfDay(now) };
  if (!(perDay > 0)) return { days: Infinity, at: null };
  const days = Math.ceil(xp / perDay);
  if (days > PACE.maxDays) return { days: Infinity, at: null };
  return { days, at: addDays(now, days) };
}
function phrase(at, precise, now) {
  if (at == null) return 'more than a few years away';
  const d = new Date(at), n = new Date(now == null ? Date.now() : now);
  const year = d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : '';
  const month = MONTHS[d.getMonth()];
  if (daysBetween(n.getTime(), at) <= 0) return 'today';
  if (precise) return d.getDate() + ' ' + month + year;
  const day = d.getDate();
  return (day <= 10 ? 'early ' + month : day <= 20 ? 'mid-' + month : 'late ' + month) + year;
}

function estimate(progress, catalog, opts) {
  const o = opts || {}, now = o.now == null ? Date.now() : o.now;
  const goal = o.goal || M.goalOf(progress);
  const left = remaining(progress, catalog, now);
  const p = pace(progress && progress.log, goal, now);
  const precise = p.historyDays >= PACE.preciseAfterDays;
  const atGoal = finishAt(left.xp, goal, now), atPace = finishAt(left.xp, p.xpPerDay, now);
  return {
    day: M.dayKey(now), goal, remainingXp: left.xp, counts: left, done: left.xp === 0,
    pct: left.total ? left.mastered / left.total : 0,
    pace: p, precise,
    goalDays: atGoal.days, goalAt: atGoal.at, goalText: phrase(atGoal.at, precise, now),
    paceDays: atPace.days, paceAt: atPace.at, paceText: p.source === 'log' ? phrase(atPace.at, precise, now) : null,
  };
}

/* ---------- once a day ----------
   cache: any object with get(key) / set(key, value) (localStorage in the browser, a Map in tests).
   The key carries the course, user and goal, so a new goal shows straight away. */
function daily(cache, key, now, compute) {
  const day = M.dayKey(now == null ? Date.now() : now);
  let hit = null;
  try { hit = cache && cache.get(key); if (typeof hit === 'string') hit = JSON.parse(hit); } catch (e) { hit = null; }
  if (hit && hit.day === day && hit.v) return hit.v;
  const v = compute();
  try { if (cache) cache.set(key, cache instanceof Map ? { day, v } : JSON.stringify({ day, v })); } catch (e) {}
  return v;
}

/* ---------- per-topic squares for the open book ----------
   mastered | partial (started, or in repair) | next | held (mastered, needs a prerequisite) | todo */
function topicStates(progress, catalog, nextId) {
  const cat = asCatalog(catalog), out = [];
  const ready = id => (M.indexCatalog(cat).byId[id] || { pre: [] }).pre.every(p => M.isCourseMastered(progress, p, cat));
  let next = nextId && cat.topics.some(t => t.id === nextId) ? nextId : null;
  for (const t of cat.topics) {
    const s = M.skillOf(progress || {}, t.id);
    let k;
    if (s.fix) k = 'partial';
    else if (s.lv > 0) k = M.isCourseMastered(progress, t.id, cat) ? 'mastered' : 'held';
    else if (s.a > 0 || s.kp > 0 || s.kpS > 0) k = 'partial';
    else k = 'todo';
    out.push({ id: t.id, name: t.name, unit: t.unit, core: !!t.core, state: k });
  }
  if (!next) {
    const open = out.filter(x => (x.state === 'partial' || x.state === 'todo') && ready(x.id));
    const pick = open.find(x => x.state === 'partial') || open[0];
    next = pick ? pick.id : null;
  }
  for (const x of out) if (x.id === next && x.state !== 'mastered' && x.state !== 'held') x.next = true;
  return out;
}

const Pace = { XP, PACE, remaining, pace, finishAt, phrase, estimate, daily, topicStates, asCatalog };
if (typeof module !== 'undefined' && module.exports) module.exports = Pace;
root.Pace = Pace;
})(typeof globalThis !== 'undefined' ? globalThis : this);
