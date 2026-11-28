/* ===== mastery: knowledge points, key-prerequisite remediation, FIRe =====
   Shared by the browser and the server. No DOM.

   Parameters live in Mastery.FIRE and Mastery.LESSON. They are the single
   config for hierarchical spaced repetition and staged lessons.

   FIRe follows The Math Academy Way, Ch. 29:
   - Encompassing edges point from an advanced topic to a simpler subskill,
     with weight w in [0, 1] (the fraction of the simpler topic practised
     by a random problem on the advanced one).
   - A success on topic T sends credit *down* the graph: it pushes back the
     due dates of simpler topics that T encompasses, in proportion to the
     strongest path weight (product of edge weights).
   - A failure on topic T sends a penalty *up* the graph: it pulls in the due
     dates of more advanced topics that encompass T. (A miss on a component
     skill is evidence that the advanced skill has slipped too.)
   - Implicit credit is discounted when the answered item was early (the
     topic was not yet due), because memory is still high.
   - Implicit penalties never put a topic into repair or change its level;
     they only move due dates. Direct failures still use the existing
     repair / level-down rules.
*/
'use strict';
(function (root) {

const DAY = 864e5;
const INT = [0, 1, 3, 7, 16, 35, 70];
const DAILY = {
  // XP is roughly one point per minute of focused work. The default daily goal is half an hour;
  // a learner can pick another preset in Settings (stored on the progress document as `goal`).
  goalXp: 30,
  goalPresets: [20, 30, 45, 60],
  weights: {
    new: 3,       // a new topic or knowledge-point item
    example: 1,   // reading a worked example
    repair: 3,
    shore: 3,
    quiz: 5,      // a quiz item, including a pre-2022 NSC question
    nsc: 5,
    review: 2,    // a scheduled due review
    mixed: 1,     // easy mixed review of already-mastered work
    fluency: 1,   // a short timed item inside mixed review
    practice: 2,
  },
  quiz: {
    maxDefers: 2,
    deferDays: 2,
    minMastered: 3,
    recentWaitDays: 4,
  },
};
const GOAL = DAILY.goalXp;

// The learner's daily XP goal: one of the presets, else the default.
function goalOf(progress) {
  const g = progress && Number(progress.goal);
  return DAILY.goalPresets.includes(g) ? g : DAILY.goalXp;
}
function setGoal(progress, goal) {
  const g = Number(goal);
  if (!DAILY.goalPresets.includes(g)) throw new Error('Pick a daily goal of ' + DAILY.goalPresets.join(', ') + ' XP.');
  return { ...(progress || emptyProgress()), goal: g };
}

const FIRE = {
  // Weight used for a direct prerequisite when no manual encompassing exists.
  directWeight: 0.75,
  // Extra decay applied per hop after the first on a default (non-manual) path.
  // Manual edges are left as written; the path product still compounds them.
  hopDecay: 0.7,
  // Paths weaker than this are ignored.
  minWeight: 0.08,
  // A successful item of weight 1 pushes an ancestor's due date by this
  // fraction of that ancestor's current interval.
  creditScale: 0.85,
  // A failed item of weight 1 pulls a descendant's due date earlier by this
  // fraction of that descendant's current interval.
  penaltyScale: 0.5,
  // Multiplier for implicit credit when the answered topic was not yet due.
  earlyCredit: 0.4,
  // Do not push a due date more than this many intervals past now.
  maxHorizonIntervals: 1,
};

const LESSON = {
  // Correct close-variants required to pass a knowledge point (after the
  // worked example). A topic with one knowledge point therefore needs this
  // many correct items, not three mixed-difficulty items.
  passCount: 2,
  // Failed repair attempts (or failed answers on the same knowledge point)
  // before a key-prerequisite review is queued.
  failsBeforeShore: 2,
  // Max repair tries in a session before the session stops, same as before.
  maxRepairTries: 6,
};

// Per-learner, per-topic review spacing. The next interval is
// INT[level] * ease * 1 day. Ease starts at 1 (same as the fixed
// schedule) and is stored on the skill; missing ease reads as 1, so
// older progress is unchanged. FIRe credit and penalties use the same
// eased interval, so implicit reviews stay in proportion.
const SPACING = {
  defaultEase: 1,
  minEase: 0.5,
  maxEase: 1.6,
  failStep: 0.15,
  slowStep: 0.08,
  cleanStep: 0.08,
  cleanNeeded: 2,
  quickMs: 45000,
  slowMs: 90000,
};

// Backup to the two-misses rule: if recent accuracy on a topic falls
// below the threshold over this many tries, queue a key-prerequisite
// review. One config, used everywhere.
const RATE = {
  window: 6,
  minAccuracy: 0.5,
};

// Optional Unit 0 placement. Unit 0 stays the default taught path.
// A strong pass can mark that topic mastered; ancestors are inferred
// only when they are necessary for a strong pass and nothing in their
// subtree was missed, slow, or skipped.
const PLACEMENT = {
  unit: 'c0',
  maxItems: 14,
  passMs: 90000,
  firstIntervalDays: 1,
};

// Short, lightly timed fluency sets, only inside mixed review of
// already-mastered automatic skills. Never in new lessons.
const FLUENCY = {
  topics: ['exp-int', 'exp-rat', 'radicals', 'factoring', 'special-angles', 'basic-identities', 'power-rule'],
  setSize: 5,
  targetMs: 20000,
  cooldownDays: 1,
};

function clampEase(value) {
  const n = Number(value);
  const e = Number.isFinite(n) ? n : SPACING.defaultEase;
  return Math.max(SPACING.minEase, Math.min(SPACING.maxEase, e));
}

function easeOf(skill) {
  if (!skill || skill.ease == null) return SPACING.defaultEase;
  return clampEase(skill.ease);
}

function intervalMs(lv, ease) {
  const i = Math.max(1, Math.min(INT.length - 1, lv | 0));
  return Math.round(INT[i] * clampEase(ease == null ? SPACING.defaultEase : ease) * DAY);
}

function adjustEase(skill, input) {
  const sp = SPACING;
  let ease = easeOf(skill);
  let clean = skill.clean || 0;
  const ms = input && input.ms;
  const hint = !!(input && input.hint);
  const ok = !!(input && input.ok);
  const hasTime = ms != null && Number.isFinite(ms);
  const quick = hasTime && ms <= sp.quickMs;
  const slow = hasTime && ms >= sp.slowMs;
  if (!ok) {
    ease = Math.max(sp.minEase, +(ease - sp.failStep).toFixed(4));
    clean = 0;
  } else if (hint || slow) {
    ease = Math.max(sp.minEase, +(ease - sp.slowStep).toFixed(4));
    clean = 0;
  } else if (quick && !hint) {
    clean += 1;
    if (clean >= sp.cleanNeeded) {
      ease = Math.min(sp.maxEase, +(ease + sp.cleanStep).toFixed(4));
      clean = 0;
    }
  }
  return { ease, clean };
}

function pushRecent(skill, ok) {
  const rec = Array.isArray(skill.rec) ? skill.rec.slice() : [];
  rec.push(ok ? 1 : 0);
  const max = Math.max(RATE.window * 2, 12);
  if (rec.length > max) rec.splice(0, rec.length - max);
  return rec;
}

function recentRate(skill) {
  const rec = (Array.isArray(skill.rec) ? skill.rec : []).slice(-RATE.window);
  const hits = rec.reduce((n, x) => n + (x ? 1 : 0), 0);
  return { n: rec.length, ok: hits, accuracy: rec.length ? hits / rec.length : 1 };
}

function rateBelow(skill) {
  const r = recentRate(skill);
  return r.n >= RATE.window && r.accuracy < RATE.minAccuracy;
}

function asSkill(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    a: s.a || 0,
    c: s.c || 0,
    s: s.s || 0,
    lv: s.lv || 0,
    due: s.due || 0,
    last: s.last || 0,
    lq: s.lq || 0,
    fix: s.fix || 0,
    kp: s.kp || 0,
    kpS: s.kpS || 0,
    kpFails: s.kpFails || 0,
    repairFails: s.repairFails || 0,
    ex: s.ex == null ? -1 : s.ex,
    shore: Array.isArray(s.shore) ? s.shore.slice() : (s.shore ? [s.shore] : []),
    ease: s.ease == null ? SPACING.defaultEase : clampEase(s.ease),
    clean: s.clean || 0,
    rec: Array.isArray(s.rec) ? s.rec.slice() : [],
    placed: s.placed || 0,
    inferred: s.inferred || 0,
    fluencyAt: s.fluencyAt || 0,
  };
}

function emptyProgress() {
  return { skills: {}, log: {}, t: 0, qz: { recent: [], last: 0, hist: [] }, qzByCourse: {}, seen: {}, resetAt: 0, shore: [] };
}

function skillOf(progress, id) {
  return asSkill(progress.skills && progress.skills[id]);
}

function writeSkill(progress, id, skill) {
  const next = { ...progress, skills: { ...(progress.skills || {}) } };
  const clean = { ...skill };
  if (!clean.fix) delete clean.fix;
  if (clean.ex == null || clean.ex < 0) delete clean.ex;
  if (!clean.shore || !clean.shore.length) delete clean.shore;
  if (!clean.kp) delete clean.kp;
  if (!clean.kpS) delete clean.kpS;
  if (!clean.kpFails) delete clean.kpFails;
  if (!clean.repairFails) delete clean.repairFails;
  if (!clean.lq) delete clean.lq;
  if (clean.ease == null || clean.ease === SPACING.defaultEase) delete clean.ease;
  if (!clean.clean) delete clean.clean;
  if (!clean.rec || !clean.rec.length) delete clean.rec;
  if (!clean.placed) delete clean.placed;
  if (!clean.inferred) delete clean.inferred;
  if (!clean.fluencyAt) delete clean.fluencyAt;
  next.skills[id] = clean;
  return next;
}

function topicMeta(catalog, id) {
  const t = catalog && catalog.topics && (catalog.topics[id] || catalog.topics.find && catalog.topics.find(x => x.id === id));
  if (t) return t;
  const map = catalog && catalog.byId;
  return (map && map[id]) || null;
}

function indexCatalog(catalog) {
  if (!catalog) return { byId: {}, list: [] };
  if (catalog.byId && catalog.list) return catalog;
  const list = Array.isArray(catalog.topics) ? catalog.topics : [];
  const byId = {};
  for (const t of list) byId[t.id] = t;
  return { ...catalog, byId, list };
}

function stagedKps(topic) {
  const kps = topic && Array.isArray(topic.kps) ? topic.kps.filter(k => k && k.staged !== false) : [];
  return kps;
}

function isStaged(topic) {
  return !!(topic && topic.fallback !== true && stagedKps(topic).length);
}

function prereqsOf(topic) {
  return (topic && Array.isArray(topic.pre) ? topic.pre : []).map(String);
}

function keyPrereqsOf(topic, kpIndex) {
  const kps = stagedKps(topic);
  const kp = kps[kpIndex];
  if (kp && kp.keyPrereq) return [String(kp.keyPrereq)];
  if (topic && Array.isArray(topic.keyPrereqs) && topic.keyPrereqs.length) {
    return topic.keyPrereqs.map(String);
  }
  return prereqsOf(topic);
}

/* ---------- encompassing graph ---------- */

function defaultEdges(catalog) {
  const { list } = indexCatalog(catalog);
  const edges = [];
  for (const topic of list) {
    for (const pre of prereqsOf(topic)) {
      edges.push({ from: topic.id, to: pre, weight: FIRE.directWeight, source: 'prereq-default', hops: 1 });
    }
  }
  return edges;
}

function edgeMap(catalog) {
  const map = new Map();
  const add = (from, to, weight, source) => {
    const key = from + '\0' + to;
    const prev = map.get(key);
    // Manual edges win; otherwise keep the larger weight.
    if (!prev || source === 'manual' || (prev.source !== 'manual' && weight > prev.weight)) {
      map.set(key, { from, to, weight, source: source || 'prereq-default' });
    }
  };
  for (const e of defaultEdges(catalog)) add(e.from, e.to, e.weight, e.source);
  const extra = (catalog && catalog.encompassing) || [];
  for (const e of extra) {
    if (!e || !e.from || !e.to) continue;
    const w = Number(e.weight);
    if (!(w >= 0 && w <= 1)) continue;
    add(String(e.from), String(e.to), w, e.source || 'manual');
  }
  return map;
}

function outgoing(edges, from) {
  const out = [];
  for (const e of edges.values()) if (e.from === from) out.push(e);
  return out;
}

function incoming(edges, to) {
  const out = [];
  for (const e of edges.values()) if (e.to === to) out.push(e);
  return out;
}

// Strongest path weight from `start` walking encompassing edges (advanced → simpler).
// Hop decay applies only to default (inferred) edges after the first hop.
function weightsDown(edges, start) {
  const best = new Map();
  const stack = [{ id: start, weight: 1, hops: 0, defaultHops: 0 }];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of outgoing(edges, cur.id)) {
      let w = cur.weight * e.weight;
      const defaultHops = cur.defaultHops + (e.source === 'manual' ? 0 : 1);
      if (e.source !== 'manual' && defaultHops > 1) w *= FIRE.hopDecay;
      if (w < FIRE.minWeight) continue;
      const prev = best.get(e.to) || 0;
      if (w <= prev) continue;
      best.set(e.to, w);
      stack.push({ id: e.to, weight: w, hops: cur.hops + 1, defaultHops });
    }
  }
  return best;
}

// Strongest path weight from a simpler topic *up* to the advanced topics that encompass it.
function weightsUp(edges, start) {
  const best = new Map();
  const stack = [{ id: start, weight: 1, defaultHops: 0 }];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of incoming(edges, cur.id)) {
      let w = cur.weight * e.weight;
      const defaultHops = cur.defaultHops + (e.source === 'manual' ? 0 : 1);
      if (e.source !== 'manual' && defaultHops > 1) w *= FIRE.hopDecay;
      if (w < FIRE.minWeight) continue;
      const prev = best.get(e.from) || 0;
      if (w <= prev) continue;
      best.set(e.from, w);
      stack.push({ id: e.from, weight: w, defaultHops });
    }
  }
  return best;
}

function applyFire(progress, topicId, ok, now, catalog, opts) {
  const options = opts || {};
  const early = !!options.early;
  const edges = edgeMap(catalog);
  const updates = [];
  if (ok) {
    const down = weightsDown(edges, topicId);
    for (const [id, weight] of down) {
      const skill = skillOf(progress, id);
      if (skill.lv <= 0 || skill.fix) continue;
      const interval = intervalMs(skill.lv, skill.ease);
      let credit = weight * FIRE.creditScale * interval;
      if (early) credit *= FIRE.earlyCredit;
      const cap = now + FIRE.maxHorizonIntervals * interval;
      const base = Math.max(skill.due || 0, now);
      const due = Math.min(base + credit, cap);
      if (due > (skill.due || 0)) {
        progress = writeSkill(progress, id, { ...skill, due });
        updates.push({ id, dir: 'credit', weight, due, prev: skill.due || 0 });
      }
    }
  } else {
    const up = weightsUp(edges, topicId);
    for (const [id, weight] of up) {
      const skill = skillOf(progress, id);
      if (skill.lv <= 0 || skill.fix) continue;
      const interval = intervalMs(skill.lv, skill.ease);
      const pull = weight * FIRE.penaltyScale * interval;
      const due = Math.max(now, (skill.due || 0) - pull);
      if (due < (skill.due || 0)) {
        progress = writeSkill(progress, id, { ...skill, due });
        updates.push({ id, dir: 'penalty', weight, due, prev: skill.due || 0 });
      }
    }
  }
  return { progress, updates };
}

/* ---------- remediation ---------- */

function globalShore(progress) {
  return Array.isArray(progress.shore) ? progress.shore.slice() : [];
}

function queueShore(progress, items) {
  const have = new Map(globalShore(progress).map(s => [s.id, s]));
  for (const item of items) {
    if (!item || !item.id) continue;
    have.set(item.id, {
      id: String(item.id),
      from: item.from || null,
      kp: item.kp == null ? null : item.kp,
      name: item.name || item.id,
      reason: item.reason || null,
    });
  }
  return { ...progress, shore: [...have.values()] };
}

function clearShore(progress, id) {
  const shore = globalShore(progress).filter(s => s.id !== id);
  const skill = skillOf(progress, id);
  let next = { ...progress, shore };
  if (skill.shore && skill.shore.length) {
    next = writeSkill(next, id, { ...skill, shore: [] });
  }
  return next;
}

function shoreTargets(progress, catalog, fromId, kpIndex) {
  const { byId } = indexCatalog(catalog);
  const topic = byId[fromId];
  const ids = keyPrereqsOf(topic, kpIndex);
  const out = [];
  for (const id of ids) {
    const pre = byId[id];
    if (!pre) continue;
    out.push({ id, from: fromId, kp: kpIndex, name: pre.name || id });
  }
  return out;
}

function makeDueForReview(progress, id, now) {
  const skill = skillOf(progress, id);
  if (skill.lv <= 0) return progress;
  if (skill.fix) return progress;
  const due = Math.min(skill.due || now, now);
  return writeSkill(progress, id, { ...skill, due, shore: [id] });
}

/* ---------- answer application ---------- */

function dayKey(t) {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}


// CAPS Examination Guidelines (2021) paper marks. Unit 0 has no direct allocation;
// foundations become core when they are ancestors of a core Grade 12 topic.
const CORE = {
  unitMarks: {
    c0: 0, c1: 25, c2: 25, c3: 35, c4: 15, c5: 35,
    c6: 15, c7: 20, c8: 40, c9: 40, c10: 50,
  },
  laterTopicWeight: 2,
  nscLeafWeight: 1,
  // A topic is seed-core if its score meets this. Finance (15) still qualifies
  // once its later topics or NSC leaves are counted; seq-sum-proof and some
  // interpretive side-topics may stay supplemental. Ancestors of seed-core
  // topics are then marked core.
  threshold: 28,
};

function descendantsCount(topics, id) {
  const children = new Map();
  for (const t of topics) {
    for (const p of t.pre || []) {
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(t.id);
    }
  }
  const seen = new Set();
  const stack = [...(children.get(id) || [])];
  while (stack.length) {
    const x = stack.pop();
    if (seen.has(x)) continue;
    seen.add(x);
    for (const c of children.get(x) || []) stack.push(c);
  }
  return seen.size;
}

function tagCore(topics, nscLeaves) {
  const leaves = nscLeaves || {};
  const scores = new Map();
  for (const t of topics) {
    const unitMarks = CORE.unitMarks[t.unit] != null ? CORE.unitMarks[t.unit] : 0;
    const later = descendantsCount(topics, t.id);
    const nsc = Number(leaves[t.id] || 0);
    const score = unitMarks + CORE.laterTopicWeight * later + CORE.nscLeafWeight * nsc;
    scores.set(t.id, { score, later, nsc, unitMarks, core: score >= CORE.threshold });
  }
  const preOf = new Map(topics.map(t => [t.id, t.pre || []]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of topics) {
      const tag = scores.get(t.id);
      if (!tag || !tag.core) continue;
      for (const p of preOf.get(t.id) || []) {
        const pt = scores.get(p);
        if (pt && !pt.core) { pt.core = true; pt.via = t.id; changed = true; }
      }
    }
  }
  return scores;
}

function xpFor(mode) {
  const w = DAILY.weights;
  if (mode && w[mode] != null) return w[mode];
  return w.practice;
}

function addXp(progress, amount, now) {
  if (!amount) return progress;
  const log = { ...(progress.log || {}) };
  const k = dayKey(now);
  log[k] = (log[k] || 0) + amount;
  return { ...progress, log };
}

const QUIZ_COURSE_DEFAULT = 'algebra';

function emptyQuiz() {
  return { recent: [], last: 0, hist: [] };
}

function missingCoursePrereqs(progress, topicId, catalog) {
  const byId = indexCatalog(catalog).byId;
  const topic = byId[topicId];
  if (!topic) return [];
  const mastered = (id, seen) => {
    if (seen.has(id)) return true;
    seen.add(id);
    const node = byId[id];
    const skill = skillOf(progress, id);
    if (skill.lv <= 0 || skill.fix) return false;
    if (!node) return true;
    return (node.pre || []).every(p => mastered(p, seen));
  };
  return (topic.pre || []).filter(p => !mastered(p, new Set()));
}

function isCourseMastered(progress, topicId, catalog) {
  const skill = skillOf(progress, topicId);
  if (skill.lv <= 0 || skill.fix) return false;
  return missingCoursePrereqs(progress, topicId, catalog).length === 0;
}

function courseMasteredIds(progress, catalog) {
  return ((catalog && catalog.topics) || []).filter(t => isCourseMastered(progress, t.id, catalog)).map(t => t.id);
}

function courseAnswerStats(progress, catalog) {
  let correct = 0, answered = 0;
  for (const topic of (catalog && catalog.topics) || []) {
    const skill = skillOf(progress, topic.id);
    correct += skill.c || 0;
    answered += skill.a || 0;
  }
  return { correct, answered };
}

function holdingPrereqIds(progress, catalog) {
  const held = new Set();
  for (const topic of (catalog && catalog.topics) || []) {
    const skill = skillOf(progress, topic.id);
    if (skill.lv <= 0 || skill.fix) continue;
    for (const id of missingCoursePrereqs(progress, topic.id, catalog)) held.add(id);
  }
  return [...held];
}

function quizState(progress, courseId) {
  const id = courseId || QUIZ_COURSE_DEFAULT;
  const by = progress && progress.qzByCourse;
  if (by && by[id]) {
    return { ...emptyQuiz(), ...by[id], recent: [...(by[id].recent || [])], hist: [...(by[id].hist || [])] };
  }
  // A pre-existing global qz is treated as the algebra course only, so a
  // due quiz there cannot block a different course.
  if (id === QUIZ_COURSE_DEFAULT && progress && progress.qz && Array.isArray(progress.qz.recent)) {
    return { ...emptyQuiz(), ...progress.qz, recent: [...(progress.qz.recent || [])], hist: [...(progress.qz.hist || [])] };
  }
  return emptyQuiz();
}

function writeQuizState(progress, courseId, quiz) {
  const id = courseId || QUIZ_COURSE_DEFAULT;
  const q = {
    recent: [...(quiz.recent || [])],
    last: quiz.last || 0,
    hist: [...(quiz.hist || [])],
    defers: quiz.defers || 0,
    firstDueAt: quiz.firstDueAt || 0,
    lastDeferAt: quiz.lastDeferAt || 0,
  };
  const qzByCourse = { ...((progress && progress.qzByCourse) || {}) };
  qzByCourse[id] = q;
  const next = { ...progress, qzByCourse };
  if (id === QUIZ_COURSE_DEFAULT) next.qz = q;
  else if (progress && progress.qz) next.qz = progress.qz;
  return next;
}

function markQuizRecent(progress, topicId, courseId) {
  const q = quizState(progress, courseId);
  if (q.recent.includes(topicId)) return progress;
  q.recent = q.recent.concat([topicId]);
  return writeQuizState(progress, courseId, q);
}

function quizIsDue(progress, courseId, now, catalog) {
  const q = quizState(progress, courseId);
  const mastered = courseMasteredIds(progress, catalog);
  if (mastered.length < (DAILY.quiz.minMastered || 3)) return false;
  const wait = (DAILY.quiz.recentWaitDays || 4) * DAY;
  return q.recent.length >= 2 || (q.recent.length >= 1 && (now - (q.last || 0)) > wait);
}

function canDeferQuiz(progress, now, courseId) {
  const q = quizState(progress, courseId);
  const defers = q.defers || 0;
  const first = q.firstDueAt || now;
  return defers < DAILY.quiz.maxDefers && (now - first) < DAILY.quiz.deferDays * DAY;
}

function noteQuizDue(progress, now, due, courseId) {
  if (!due) return progress;
  const q = quizState(progress, courseId);
  if (!q.firstDueAt) q.firstDueAt = now;
  return writeQuizState(progress, courseId, q);
}

function deferQuiz(progress, now, courseId) {
  if (!canDeferQuiz(progress, now, courseId)) return { progress, ok: false, remaining: 0 };
  const q = quizState(progress, courseId);
  if (!q.firstDueAt) q.firstDueAt = now;
  q.defers = (q.defers || 0) + 1;
  q.lastDeferAt = now;
  return {
    progress: writeQuizState(progress, courseId, q),
    ok: true,
    remaining: DAILY.quiz.maxDefers - q.defers,
  };
}

function clearQuizDefer(progress, courseId) {
  const q = quizState(progress, courseId);
  q.defers = 0;
  q.firstDueAt = 0;
  q.lastDeferAt = 0;
  return writeQuizState(progress, courseId, q);
}

function mustTakeQuiz(progress, now, due, courseId) {
  return !!due && !canDeferQuiz(progress, now, courseId);
}

function pickRecommended(candidates) {
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;
  const inProgress = list.filter(s => s.inProgress);
  const holds = list.filter(s => s.holds);
  const pool = inProgress.length ? inProgress : (holds.length ? holds : list);
  const core = pool.filter(s => s.core);
  const ranked = (core.length ? core : pool).slice().sort((a, b) => (b.coreScore || 0) - (a.coreScore || 0));
  return ranked[0] || null;
}

// Topics this one builds on, directly or indirectly, inside the current catalog.
function ancestorIds(catalog, topicId) {
  const byId = indexCatalog(catalog).byId;
  const out = new Set();
  const walk = (id) => {
    const topic = byId[id];
    if (!topic) return;
    for (const pre of topic.pre || []) {
      if (!out.has(pre)) {
        out.add(pre);
        walk(pre);
      }
    }
  };
  walk(topicId);
  return out;
}

// Same gates as the course-map "can I practise this now?" check: missing
// prerequisites, a repair or shore-up underneath, or a due quiz that this
// topic builds on.
function isOpenForNew(progress, topicId, catalog, now, courseId) {
  const s = skillOf(progress, topicId);
  if (s.lv > 0 || s.fix) return false;
  if (missingCoursePrereqs(progress, topicId, catalog).length) return false;
  const ancestors = ancestorIds(catalog, topicId);
  const topics = (catalog && catalog.topics) || [];
  if (topics.some(topic => ancestors.has(topic.id) && skillOf(progress, topic.id).fix)) return false;
  const shore = (progress.shore || []).filter(item => item && item.id);
  if (shore.some(item => ancestors.has(item.id)) && !shore.some(item => item.id === topicId)) return false;
  const cid = courseId || (catalog && catalog.courseId);
  if (quizIsDue(progress, cid, now, catalog)) {
    const recent = quizState(progress, cid).recent || [];
    if (recent.some(id => ancestors.has(id))) return false;
  }
  return true;
}

// What to offer after a lesson ends (mastery, or a "what's next?" prompt).
// Same order as the home "Today" list: repairs, shore-ups, a due quiz, due
// reviews, then the next open frontier topic. `opts.skip` drops topics the
// learner just finished so we do not send them straight back into one.
function pickNextTask(progress, catalog, now, opts) {
  const t = now != null ? now : Date.now();
  const skip = new Set(((opts && opts.skip) || []).map(String));
  const courseId = (opts && opts.courseId) || (catalog && catalog.courseId);
  const topics = ((catalog && catalog.topics) || []).filter(topic => topic && topic.id);
  const asTask = (topic, kind, extra) => Object.assign({ kind, id: topic.id, name: topic.name || topic.id }, extra || {});

  const repair = topics.find(topic => !skip.has(String(topic.id)) && skillOf(progress, topic.id).fix);
  if (repair) return asTask(repair, 'repair');

  const shore = (progress.shore || []).find(item => item && item.id && !skip.has(String(item.id)) && topics.some(topic => topic.id === item.id));
  if (shore) {
    const topic = topics.find(item => item.id === shore.id);
    return asTask(topic, 'shore', { from: shore.from, reason: shore.reason });
  }

  if (quizIsDue(progress, courseId, t, catalog)) return { kind: 'quiz' };

  const due = topics.filter(topic => {
    if (skip.has(String(topic.id))) return false;
    const s = skillOf(progress, topic.id);
    return s.lv > 0 && !s.fix && !missingCoursePrereqs(progress, topic.id, catalog).length && s.due <= t;
  }).sort((a, b) => skillOf(progress, a.id).due - skillOf(progress, b.id).due);
  if (due[0]) return asTask(due[0], 'review');

  const holds = new Set(holdingPrereqIds(progress, catalog));
  const candidates = topics.filter(topic => !skip.has(String(topic.id)) && isOpenForNew(progress, topic.id, catalog, t, courseId)).map(topic => {
    const s = skillOf(progress, topic.id);
    return Object.assign({}, topic, {
      inProgress: s.a > 0,
      holds: holds.has(topic.id),
      core: !!topic.core,
      coreScore: topic.coreScore || 0,
    });
  });
  const rec = pickRecommended(candidates);
  if (rec) return asTask(rec, 'new', { core: !!rec.core });

  return { kind: 'mixed' };
}

function applyAnswer(progress, input, catalog) {
  const id = String(input.id);
  const ok = !!input.ok;
  const mode = input.mode || 'practice';
  const now = input.now != null ? input.now : Date.now();
  const cat = indexCatalog(catalog);
  const topic = cat.byId[id] || { id, pre: [], kps: [], fallback: true };
  let s = skillOf(progress, id);
  let ev = null;
  const staged = isStaged(topic);
  const kps = stagedKps(topic);
  const priorDue = s.lv > 0 && s.due <= now;
  const earlyCredit = s.lv > 0 && !priorDue && mode !== 'quiz';

  s = { ...s, a: s.a + 1, last: now };
  s.rec = pushRecent(s, ok);
  const rateWasBelow = rateBelow({ rec: s.rec.slice(0, -1) });
  if (ok) {
    s.c = (s.c || 0) + 1;
    progress = addXp(progress, xpFor(mode), now);
  }
  if (mode === 'quiz') s.lq = now;
  if (mode === 'fluency') s.fluencyAt = now;

  if (s.fix && mode === 'quiz') {
    // A quiz miss already flagged the topic; a later quiz hit does not repair it.
  } else if (s.fix) {
    if (ok) {
      s.s = (s.s || 0) + 1;
      if (s.s >= 2) {
        delete s.fix;
        s.s = 0;
        s.repairFails = 0;
        s.lv = Math.max(1, s.lv);
        s.due = now + DAY;
        ev = { k: 'repaired' };
      } else ev = { k: 'repairing', n: s.s };
    } else {
      s.s = 0;
      s.repairFails = (s.repairFails || 0) + 1;
      ev = { k: 'repairing', n: 0, repairFails: s.repairFails };
      if (s.repairFails >= LESSON.failsBeforeShore) {
        const targets = shoreTargets(progress, cat, id, s.kp || 0);
        progress = queueShore(progress, targets);
        for (const t of targets) progress = makeDueForReview(progress, t.id, now);
        ev = { k: 'shore', n: 0, repairFails: s.repairFails, shore: targets };
        s.repairFails = 0;
      }
    }
  } else if (s.lv === 0) {
    if (staged && mode !== 'quiz') {
      const kpIndex = s.kp || 0;
      const total = kps.length;
      if (ok) {
        s.kpFails = 0;
        s.kpS = (s.kpS || 0) + 1;
        s.s = s.kpS;
        if (s.kpS >= LESSON.passCount) {
          if (kpIndex + 1 >= total) {
            s.lv = 1;
            s.s = 0;
            s.kp = 0;
            s.kpS = 0;
            s.due = now + DAY;
            ev = { k: 'mastered', kp: kpIndex };
            progress = markQuizRecent(progress, id, (input && input.courseId) || (catalog && catalog.courseId));
          } else {
            s.kp = kpIndex + 1;
            s.kpS = 0;
            ev = { k: 'kp-passed', kp: kpIndex, next: s.kp };
          }
        } else ev = { k: 'kp-progress', kp: kpIndex, n: s.kpS, need: LESSON.passCount };
      } else {
        s.kpS = 0;
        s.s = 0;
        s.kpFails = (s.kpFails || 0) + 1;
        ev = { k: 'kp-progress', kp: kpIndex, n: 0, need: LESSON.passCount, kpFails: s.kpFails };
        if (s.kpFails >= LESSON.failsBeforeShore) {
          const targets = shoreTargets(progress, cat, id, kpIndex);
          progress = queueShore(progress, targets);
          for (const t of targets) progress = makeDueForReview(progress, t.id, now);
          ev = { k: 'shore', kp: kpIndex, n: 0, shore: targets };
          s.kpFails = 0;
        }
      }
    } else if (ok) {
      s.s = (s.s || 0) + 1;
      if (s.s >= 3) {
        s.lv = 1;
        s.s = 0;
        s.due = now + DAY;
        ev = { k: 'mastered' };
        progress = markQuizRecent(progress, id, (input && input.courseId) || (catalog && catalog.courseId));
      }
    } else s.s = 0;
  } else if (mode === 'quiz') {
    if (ok) {
      if (s.due <= now) {
        s.lv = Math.min(6, s.lv + 1);
        s.due = now + intervalMs(s.lv, s.ease);
      }
    } else {
      s.fix = 1;
      s.s = 0;
      s.lv = 1;
      s.due = now;
      s.repairFails = 0;
    }
  } else if (s.due <= now) {
    if (mode === 'review' || mode === 'practice' || mode === 'mixed') {
      const nextEase = adjustEase(s, { ok, ms: input.ms, hint: input.hint });
      s.ease = nextEase.ease;
      s.clean = nextEase.clean;
    }
    if (ok) {
      s.lv = Math.min(6, s.lv + 1);
      const gap = intervalMs(s.lv, s.ease);
      s.due = now + gap;
      ev = { k: 'reviewed', d: Math.round(gap / DAY), ease: easeOf(s) };
      progress = clearShore(progress, id);
    } else {
      s.fix = 1;
      s.s = 0;
      s.lv = Math.max(1, s.lv - 1);
      s.due = now;
      s.repairFails = 0;
      ev = { k: 'failedReview', ease: easeOf(s) };
    }
  } else if (!ok) {
    s.due = Math.min(s.due, now + DAY);
    ev = { k: 'pulled' };
  }

  if ((!ev || ev.k !== 'shore') && rateBelow(s) && !rateWasBelow) {
    const kpIndex = s.kp || 0;
    const targets = shoreTargets(progress, cat, id, kpIndex);
    if (targets.length) {
      const rated = targets.map(x => ({ ...x, reason: 'rate' }));
      progress = queueShore(progress, rated);
      for (const t of rated) progress = makeDueForReview(progress, t.id, now);
      ev = { k: 'shore', reason: 'rate', n: 0, shore: rated, rate: recentRate(s) };
      s.rec = [];
    }
  }

  progress = writeSkill(progress, id, s);
  progress = { ...progress, t: now };

  const fire = applyFire(progress, id, ok, now, cat, { early: earlyCredit });
  progress = fire.progress;
  if (ev && fire.updates.length) ev = { ...ev, fire: fire.updates };
  else if (!ev && fire.updates.length) ev = { k: 'fire', fire: fire.updates };

  return { progress, event: ev, fire: fire.updates };
}

function markExampleSeen(progress, id, now) {
  const s = skillOf(progress, id);
  let next = writeSkill(progress, id, { ...s, ex: s.kp || 0 });
  return addXp(next, xpFor('example'), now != null ? now : Date.now());
}

function exampleDue(progress, id, catalog) {
  const topic = indexCatalog(catalog).byId[id];
  if (!isStaged(topic)) return false;
  const s = skillOf(progress, id);
  if (s.lv > 0 || s.fix) return false;
  return s.ex !== (s.kp || 0);
}

function currentKp(progress, id, catalog) {
  const topic = indexCatalog(catalog).byId[id];
  const kps = stagedKps(topic);
  if (!kps.length) return null;
  const s = skillOf(progress, id);
  return kps[Math.min(s.kp || 0, kps.length - 1)] || null;
}


function practisedByWork(progress, id) {
  const s = skillOf(progress, id);
  return s.lv > 0 && !s.placed;
}

function unit0Graph(catalog) {
  const cat = indexCatalog(catalog);
  const topics = (catalog && catalog.topics || []).filter(t => t && t.unit === PLACEMENT.unit);
  const ids = new Set(topics.map(t => t.id));
  const pre = new Map(topics.map(t => [t.id, (t.pre || []).filter(p => ids.has(p))]));
  const children = new Map();
  for (const [id, ps] of pre) {
    for (const p of ps) {
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(id);
    }
  }
  const depth = new Map();
  const dep = id => {
    if (depth.has(id)) return depth.get(id);
    const ps = pre.get(id) || [];
    const d = ps.length ? Math.max(...ps.map(p => dep(p) + 1)) : 0;
    depth.set(id, d);
    return d;
  };
  for (const topic of topics) dep(topic.id);
  const isAncestor = (a, b, seen) => {
    if (a === b) return false;
    const walk = (x, visiting) => {
      if (x === a) return true;
      if (visiting.has(x)) return false;
      visiting.add(x);
      return (pre.get(x) || []).some(p => walk(p, visiting));
    };
    return walk(b, new Set());
  };
  return { topics, ids, pre, children, depth, isAncestor, byId: cat.byId };
}

function placementState(progress) {
  const place = progress && progress.place && typeof progress.place === 'object' ? progress.place : {};
  return {
    status: place.status || '',
    at: place.at || 0,
    items: Array.isArray(place.items) ? place.items.slice() : [],
    credited: Array.isArray(place.credited) ? place.credited.slice() : [],
    inferred: Array.isArray(place.inferred) ? place.inferred.slice() : [],
    remains: Array.isArray(place.remains) ? place.remains.slice() : [],
  };
}

function classifyPlacement(input) {
  if (input && input.idk) return 'idk';
  if (!input || !input.ok) return 'wrong';
  const ms = input.ms;
  if (ms != null && Number.isFinite(ms) && ms > PLACEMENT.passMs) return 'slow';
  return 'strong';
}

function startPlacement(progress, catalog, now) {
  const t = now != null ? now : Date.now();
  return {
    ...progress,
    place: { status: 'active', at: t, items: [], credited: [], inferred: [], remains: [] },
  };
}

function nextPlacementTopic(progress, catalog) {
  const g = unit0Graph(catalog);
  if (!g.topics.length) return null;
  const place = placementState(progress);
  if (place.status !== 'active') return null;
  if (place.items.length >= PLACEMENT.maxItems) return null;
  const asked = new Set(place.items.map(x => x.id));
  const last = place.items[place.items.length - 1];
  if (last && (last.kind === 'wrong' || last.kind === 'idk')) {
    const pres = (g.pre.get(last.id) || [])
      .filter(id => !asked.has(id) && !practisedByWork(progress, id));
    if (pres.length) {
      pres.sort((a, b) => (g.depth.get(b) || 0) - (g.depth.get(a) || 0));
      return pres[0];
    }
  }
  const inferable = new Set();
  for (const item of place.items) {
    if (item.kind !== 'strong') continue;
    const stack = [...(g.pre.get(item.id) || [])];
    while (stack.length) {
      const id = stack.pop();
      if (inferable.has(id) || asked.has(id)) continue;
      inferable.add(id);
      for (const p of g.pre.get(id) || []) stack.push(p);
    }
  }
  const candidates = g.topics.map(topic => topic.id).filter(id => (
    !asked.has(id) && !inferable.has(id) && !practisedByWork(progress, id)
  ));
  if (!candidates.length) return null;
  candidates.sort((a, b) => (g.depth.get(b) || 0) - (g.depth.get(a) || 0) || a.localeCompare(b));
  return candidates[0];
}

function applyPlacementAnswer(progress, input, catalog) {
  const now = input && input.now != null ? input.now : Date.now();
  const id = String(input.id);
  const kind = classifyPlacement(input);
  const place = placementState(progress);
  const items = place.items.concat([{
    id,
    kind,
    ok: kind === 'strong',
    ms: input && input.ms != null ? Number(input.ms) : null,
    at: now,
  }]);
  const next = { ...progress, place: { ...place, status: 'active', items, at: place.at || now } };
  const more = nextPlacementTopic(next, catalog);
  return { progress: next, kind, nextId: more, done: !more };
}

function finalizePlacement(progress, catalog, now) {
  const t = now != null ? now : Date.now();
  const g = unit0Graph(catalog);
  const place = placementState(progress);
  const items = place.items;
  const strong = new Set(items.filter(x => x.kind === 'strong').map(x => x.id));
  const blocked = new Set(items.filter(x => x.kind !== 'strong').map(x => x.id));

  // Retake: clear earlier placement marks, never demote topics mastered by practice.
  let next = progress;
  for (const topic of g.topics) {
    const s = skillOf(next, topic.id);
    if (s.placed && !practisedByWork(progress, topic.id)) {
      next = writeSkill(next, topic.id, {
        ...s, lv: 0, due: 0, s: 0, placed: 0, inferred: 0, kp: 0, kpS: 0,
      });
    }
  }

  const inferred = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    const sources = new Set([...strong, ...inferred]);
    for (const id of sources) {
      for (const p of g.pre.get(id) || []) {
        if (blocked.has(p) || strong.has(p) || inferred.has(p)) continue;
        if (practisedByWork(progress, p)) continue;
        const descBlocked = [...blocked].some(b => b === p || g.isAncestor(p, b));
        if (descBlocked) continue;
        inferred.add(p);
        changed = true;
      }
    }
  }

  const due = t + PLACEMENT.firstIntervalDays * DAY;
  const credited = [];
  for (const id of strong) {
    if (practisedByWork(progress, id)) continue;
    const s = skillOf(next, id);
    next = writeSkill(next, id, {
      ...s, lv: 1, s: 0, due, last: t, placed: 1, inferred: 0, fix: 0,
    });
    credited.push(id);
  }
  const inferredIds = [];
  for (const id of inferred) {
    if (practisedByWork(progress, id) || strong.has(id)) continue;
    const s = skillOf(next, id);
    next = writeSkill(next, id, {
      ...s, lv: 1, s: 0, due, last: t, placed: 1, inferred: 1, fix: 0,
    });
    inferredIds.push(id);
  }

  const touched = new Set([...credited, ...inferredIds, ...items.map(x => x.id)]);
  const remains = g.topics.map(topic => topic.id).filter(id => !credited.includes(id) && !inferredIds.includes(id) && !practisedByWork(progress, id));

  next = {
    ...next,
    place: {
      status: 'done',
      at: t,
      items,
      credited: credited.slice(),
      inferred: inferredIds.slice(),
      remains,
    },
    t,
  };
  return { progress: next, credited, inferred: inferredIds, remains };
}

function isFluencyTopic(id, catalog) {
  const allow = new Set(FLUENCY.topics);
  if (!allow.has(id)) return false;
  if (!catalog || !catalog.topics) return true;
  const topic = indexCatalog(catalog).byId[id];
  return !!topic;
}

function fluencyDueTopics(progress, catalog, now) {
  const t = now != null ? now : Date.now();
  const cool = FLUENCY.cooldownDays * DAY;
  const ids = FLUENCY.topics.filter(id => {
    if (!isFluencyTopic(id, catalog)) return false;
    const s = skillOf(progress, id);
    if (s.lv <= 0 || s.fix) return false;
    if (s.due && s.due <= t) return false; // a scheduled review takes priority
    if (s.fluencyAt && t - s.fluencyAt < cool) return false;
    return true;
  });
  return ids;
}

function pickFluencySet(progress, catalog, now) {
  const due = fluencyDueTopics(progress, catalog, now);
  if (!due.length) return [];
  const last = progress && progress.fluencyLast;
  const ordered = last && due.includes(last)
    ? due.filter(id => id !== last).concat([last])
    : due;
  const id = ordered[0];
  return Array.from({ length: FLUENCY.setSize }, () => id);
}

const Mastery = {
  DAY, INT, GOAL, DAILY, goalOf, setGoal, dayKey, FIRE, LESSON, CORE, SPACING, RATE, PLACEMENT, FLUENCY,
  asSkill, emptyProgress, skillOf, writeSkill,
  indexCatalog, stagedKps, isStaged, keyPrereqsOf, prereqsOf,
  defaultEdges, edgeMap, weightsDown, weightsUp, applyFire,
  queueShore, clearShore, shoreTargets, makeDueForReview, globalShore,
  applyAnswer, markExampleSeen, exampleDue, currentKp,
  tagCore, xpFor, addXp, canDeferQuiz, noteQuizDue, deferQuiz, clearQuizDefer, mustTakeQuiz, pickRecommended, pickNextTask, intervalMs,
  QUIZ_COURSE_DEFAULT, emptyQuiz, quizState, writeQuizState, markQuizRecent, quizIsDue,
  missingCoursePrereqs, isCourseMastered, courseMasteredIds, courseAnswerStats, holdingPrereqIds,
  easeOf, clampEase, adjustEase, recentRate, rateBelow, pushRecent,
  startPlacement, nextPlacementTopic, applyPlacementAnswer, finalizePlacement, classifyPlacement, placementState, unit0Graph,
  isFluencyTopic, fluencyDueTopics, pickFluencySet,
};

  if (typeof module !== 'undefined' && module.exports) module.exports = Mastery;
  root.Mastery = Mastery;
})(typeof globalThis !== 'undefined' ? globalThis : this);
