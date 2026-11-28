/* ===== exam: attempt state for timed mock exams =====
   Shared by the browser and the tests. No DOM.

   An attempt lives in the progress document under progress.exams[paperId]:
     { current: attempt | null, last: finished attempt | null, history: [summary] }
   so it syncs to the server through the existing PUT /api/progress.

   The clock only runs while the paper is on screen. elapsedMs is banked when the
   learner leaves (pause) and resumedAt marks the start of the running stretch.
   seenAt is a heartbeat: if the tab dies without a clean pause, the next load
   banks time up to the last heartbeat rather than the whole gap.
*/
'use strict';
(function (root) {

const WARN_MS = 30 * 60000;   // amber
const DANGER_MS = 10 * 60000; // red
const HISTORY_MAX = 10;

function isAnswered(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value != null && String(value).trim() !== '';
}

function newAttempt(paper, now) {
  return {
    v: 1,
    paperId: paper.id,
    status: 'active',       // active | review | done
    timeUp: false,
    startedAt: now,
    durationMs: (paper.durationMinutes || 180) * 60000,
    elapsedMs: 0,
    resumedAt: now,
    seenAt: now,
    answers: {},
    flags: {},
  };
}

function runningMs(a, now) {
  return a.resumedAt != null ? Math.max(0, now - a.resumedAt) : 0;
}
function remainingMs(a, now) {
  return Math.max(0, a.durationMs - a.elapsedMs - runningMs(a, now));
}

function pause(a, now) {
  if (a.resumedAt == null) return a;
  return { ...a, elapsedMs: Math.min(a.durationMs, a.elapsedMs + runningMs(a, now)), resumedAt: null, seenAt: now };
}
function resume(a, now) {
  if (a.status !== 'active' || a.resumedAt != null) return a;
  return { ...a, resumedAt: now, seenAt: now };
}
function heartbeat(a, now) {
  return a.resumedAt == null ? a : { ...a, seenAt: now };
}
// After a reload: an attempt that never paused cleanly banks time up to its last heartbeat.
function recover(a) {
  if (!a || a.resumedAt == null) return a;
  const until = Math.max(a.resumedAt, a.seenAt || a.resumedAt);
  return { ...a, elapsedMs: Math.min(a.durationMs, a.elapsedMs + (until - a.resumedAt)), resumedAt: null };
}

// Time running out moves the attempt to review with answers locked.
function tick(a, now) {
  if (a.status !== 'active') return a;
  if (remainingMs(a, now) > 0) return a;
  return { ...a, status: 'review', timeUp: true, elapsedMs: a.durationMs, resumedAt: null, seenAt: now };
}

function toReview(a, now) {
  if (a.status !== 'active') return a;
  return { ...pause(a, now), status: 'review' };
}
function backToPaper(a, now) {
  if (a.status !== 'review' || a.timeUp) return a;
  return resume({ ...a, status: 'active' }, now);
}

function phase(ms) {
  if (ms <= 0) return 'over';
  if (ms <= DANGER_MS) return 'danger';
  if (ms <= WARN_MS) return 'warn';
  return 'calm';
}

function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
function spokenClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 60000);
  const h = Math.floor(total / 60), m = total % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

function locked(a) { return a.status === 'done' || (a.status === 'review' && a.timeUp); }

function setAnswer(a, id, value) {
  if (locked(a)) return a;
  const answers = { ...a.answers };
  if (isAnswered(value)) answers[id] = value; else delete answers[id];
  return { ...a, answers };
}
function toggleFlag(a, id) {
  if (a.status === 'done') return a;
  const flags = { ...a.flags };
  if (flags[id]) delete flags[id]; else flags[id] = 1;
  return { ...a, flags };
}

function partIndex(paper) {
  const byId = {};
  for (const q of paper.questions) byId[q.id] = q;
  return byId;
}

function groupProgress(group, a) {
  let answered = 0, flagged = 0;
  for (const id of group.parts) {
    if (isAnswered(a.answers[id])) answered++;
    if (a.flags[id]) flagged++;
  }
  return { answered, total: group.parts.length, flagged };
}

function counts(paper, a) {
  let answered = 0, flagged = 0;
  for (const q of paper.questions) {
    if (isAnswered(a.answers[q.id])) answered++;
    if (a.flags[q.id]) flagged++;
  }
  return { answered, total: paper.questions.length, flagged, unanswered: paper.questions.length - answered };
}

// Review order: unanswered first, then flagged (answered), then the rest, each in paper order.
function reviewList(paper, a) {
  const unanswered = [], flagged = [], done = [];
  for (const q of paper.questions) {
    const item = { id: q.id, number: q.number, group: q.group, marks: q.marks, topic: q.topic,
      answered: isAnswered(a.answers[q.id]), flagged: !!a.flags[q.id] };
    if (!item.answered) unanswered.push(item);
    else if (item.flagged) flagged.push(item);
    else done.push(item);
  }
  return { unanswered, flagged, done, ordered: unanswered.concat(flagged, done) };
}

// Marks by question and by topic. Auto-marking is all-or-nothing per part; parts
// the memo has to judge (sketches, proofs, explanations) are counted separately.
function results(paper, marked) {
  const byId = partIndex(paper);
  const names = paper.topicNames || {};
  const blank = () => ({ marks: 0, auto: 0, earned: 0, review: 0, right: 0, parts: 0 });
  const total = blank();
  const qMap = new Map(), tMap = new Map();
  for (const g of paper.groups) qMap.set(g.number, { number: g.number, heading: g.heading, ...blank() });
  for (const row of marked || []) {
    const q = byId[row.id];
    if (!q) continue;
    const marks = q.marks || 0;
    const code = q.topic || 'other';
    if (!tMap.has(code)) tMap.set(code, { code, name: names[code] ? names[code].name : 'Other', short: names[code] ? names[code].short : 'Other', ...blank() });
    for (const bucket of [total, qMap.get(q.group), tMap.get(code)]) {
      if (!bucket) continue;
      bucket.marks += marks; bucket.parts++;
      if (row.checkable) { bucket.auto += marks; if (row.ok) { bucket.earned += marks; bucket.right++; } }
      else bucket.review += marks;
    }
  }
  const pct = b => (b.auto ? Math.round(b.earned / b.auto * 100) : null);
  const byQuestion = [...qMap.values()].map(b => ({ ...b, pct: pct(b) }));
  const byTopic = [...tMap.values()].map(b => ({ ...b, pct: pct(b) }))
    .sort((x, y) => y.marks - x.marks);
  return { total: { ...total, pct: pct(total) }, byQuestion, byTopic };
}

function finish(a, marked, summary, now) {
  return { ...pause(a, now), status: 'done', finishedAt: now, marked, summary };
}

/* ---------- progress document ---------- */
function slot(progress, paperId) {
  const all = (progress && progress.exams) || {};
  const s = all[paperId] || {};
  return { current: s.current || null, last: s.last || null, history: Array.isArray(s.history) ? s.history : [] };
}
function writeSlot(progress, paperId, next) {
  return { ...progress, exams: { ...((progress && progress.exams) || {}), [paperId]: next } };
}
function current(progress, paperId) { return slot(progress, paperId).current; }
function saveCurrent(progress, paperId, attempt) {
  return writeSlot(progress, paperId, { ...slot(progress, paperId), current: attempt });
}
function discardCurrent(progress, paperId) {
  return writeSlot(progress, paperId, { ...slot(progress, paperId), current: null });
}
function recordFinished(progress, paperId, attempt) {
  const s = slot(progress, paperId);
  const t = attempt.summary || { earned: 0, auto: 0, review: 0, marks: 0 };
  const history = s.history.concat([{ at: attempt.finishedAt, earned: t.earned, auto: t.auto, review: t.review, marks: t.marks, timeUp: !!attempt.timeUp }]).slice(-HISTORY_MAX);
  return writeSlot(progress, paperId, { current: null, last: attempt, history });
}
function lastSummary(progress, paperId) {
  const h = slot(progress, paperId).history;
  return h.length ? h[h.length - 1] : null;
}

const api = {
  WARN_MS, DANGER_MS, isAnswered, newAttempt, remainingMs, pause, resume, heartbeat, recover, tick,
  toReview, backToPaper, phase, formatClock, spokenClock, locked, setAnswer, toggleFlag, groupProgress,
  counts, reviewList, results, finish, slot, current, saveCurrent, discardCurrent, recordFinished, lastSummary,
};
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Exam = api;
})(typeof self !== 'undefined' ? self : this);
