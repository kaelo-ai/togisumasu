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
const GOAL = 20;

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

function intervalMs(lv) {
  const i = Math.max(1, Math.min(INT.length - 1, lv | 0));
  return INT[i] * DAY;
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
  };
}

function emptyProgress() {
  return { skills: {}, log: {}, t: 0, qz: { recent: [], last: 0, hist: [] }, seen: {}, resetAt: 0, shore: [] };
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
      const interval = intervalMs(skill.lv);
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
      const interval = intervalMs(skill.lv);
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
  if (ok) {
    s.c = (s.c || 0) + 1;
    const log = { ...(progress.log || {}) };
    const k = dayKey(now);
    log[k] = (log[k] || 0) + 1;
    progress = { ...progress, log };
  }
  if (mode === 'quiz') s.lq = now;

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
            const recent = ((progress.qz || {}).recent || []).slice();
            if (!recent.includes(id)) {
              progress = { ...progress, qz: { ...(progress.qz || { recent: [], last: 0, hist: [] }), recent: recent.concat([id]) } };
            }
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
        const recent = ((progress.qz || {}).recent || []).slice();
        if (!recent.includes(id)) {
          progress = { ...progress, qz: { ...(progress.qz || { recent: [], last: 0, hist: [] }), recent: recent.concat([id]) } };
        }
      }
    } else s.s = 0;
  } else if (mode === 'quiz') {
    if (ok) {
      if (s.due <= now) {
        s.lv = Math.min(6, s.lv + 1);
        s.due = now + INT[s.lv] * DAY;
      }
    } else {
      s.fix = 1;
      s.s = 0;
      s.lv = 1;
      s.due = now;
      s.repairFails = 0;
    }
  } else if (s.due <= now) {
    if (ok) {
      s.lv = Math.min(6, s.lv + 1);
      s.due = now + INT[s.lv] * DAY;
      ev = { k: 'reviewed', d: INT[s.lv] };
      progress = clearShore(progress, id);
    } else {
      s.fix = 1;
      s.s = 0;
      s.lv = Math.max(1, s.lv - 1);
      s.due = now;
      s.repairFails = 0;
      ev = { k: 'failedReview' };
    }
  } else if (!ok) {
    s.due = Math.min(s.due, now + DAY);
    ev = { k: 'pulled' };
  }

  progress = writeSkill(progress, id, s);
  progress = { ...progress, t: now };

  const fire = applyFire(progress, id, ok, now, cat, { early: earlyCredit });
  progress = fire.progress;
  if (ev && fire.updates.length) ev = { ...ev, fire: fire.updates };
  else if (!ev && fire.updates.length) ev = { k: 'fire', fire: fire.updates };

  return { progress, event: ev, fire: fire.updates };
}

function markExampleSeen(progress, id) {
  const s = skillOf(progress, id);
  return writeSkill(progress, id, { ...s, ex: s.kp || 0 });
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

const Mastery = {
  DAY, INT, GOAL, FIRE, LESSON,
  asSkill, emptyProgress, skillOf, writeSkill,
  indexCatalog, stagedKps, isStaged, keyPrereqsOf, prereqsOf,
  defaultEdges, edgeMap, weightsDown, weightsUp, applyFire,
  queueShore, clearShore, shoreTargets, makeDueForReview, globalShore,
  applyAnswer, markExampleSeen, exampleDue, currentKp, intervalMs,
};

  if (typeof module !== 'undefined' && module.exports) module.exports = Mastery;
  root.Mastery = Mastery;
})(typeof globalThis !== 'undefined' ? globalThis : this);
