'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const Mastery = require('../public/mastery.js');
const catalog = require('../catalog.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (err) { results.push(['FAIL', name, err.message]); }
}

const { DAY, INT, SPACING, RATE, PLACEMENT, FLUENCY, DAILY, FIRE } = Mastery;

function toy() {
  return {
    topics: [
      { id: 'a', name: 'Adding', unit: 'c0', pre: [], kps: [{ id: 'a.kp0', position: 0, name: 'Add', staged: true }], keyPrereqs: [] },
      { id: 'b', name: 'Multiplying', unit: 'c0', pre: ['a'], kps: [
        { id: 'b.kp0', position: 0, name: 'Times tables', keyPrereq: 'a', staged: true },
        { id: 'b.kp1', position: 1, name: 'Two-digit multiplication', keyPrereq: 'a', staged: true },
      ], keyPrereqs: ['a'] },
      { id: 'c', name: 'Long multiplication', unit: 'c0', pre: ['b'], kps: [
        { id: 'c.kp0', position: 0, name: 'The standard algorithm', keyPrereq: 'a', staged: true },
      ], keyPrereqs: ['b'] },
      { id: 'exp-int', name: 'Integer exponents', unit: 'c0', pre: [], kps: [{ id: 'e.0', position: 0, name: 'Laws', staged: true }], keyPrereqs: [] },
      { id: 'exp-rat', name: 'Rational exponents', unit: 'c0', pre: ['exp-int'], kps: [{ id: 'r.0', position: 0, name: 'Roots', staged: true }], keyPrereqs: ['exp-int'] },
      { id: 'radicals', name: 'Surds', unit: 'c0', pre: ['exp-rat'], kps: [{ id: 's.0', position: 0, name: 'Simplify', staged: true }], keyPrereqs: ['exp-rat'] },
      { id: 'func-eval', name: 'Function values', unit: 'c0', pre: [], kps: [{ id: 'f.0', position: 0, name: 'Evaluate', staged: true }], keyPrereqs: [] },
      { id: 'linear-ineq', name: 'Linear inequalities', unit: 'c0', pre: [], kps: [{ id: 'i.0', position: 0, name: 'Solve', staged: true }], keyPrereqs: [] },
      { id: 'domain', name: 'Domain', unit: 'c0', pre: ['func-eval', 'linear-ineq'], kps: [{ id: 'd.0', position: 0, name: 'Domain', staged: true }], keyPrereqs: ['func-eval'] },
    ],
  };
}

function start(skills) {
  const p = Mastery.emptyProgress();
  p.skills = { ...skills };
  return p;
}

function mastered(lv, due, extra) {
  return { a: 6, c: 6, s: 0, lv, due, ...(extra || {}) };
}

function review(progress, id, ok, now, extra) {
  return Mastery.applyAnswer(progress, { id, ok, mode: 'review', now, ...(extra || {}) }, toy());
}

// ---------- config ----------
t('spacing, rate, placement and fluency live in one config each, with documented keys', () => {
  assert.equal(SPACING.defaultEase, 1);
  assert.equal(SPACING.minEase, 0.5);
  assert.equal(SPACING.maxEase, 1.6);
  assert.equal(SPACING.failStep, 0.15);
  assert.equal(SPACING.slowStep, 0.08);
  assert.equal(SPACING.cleanStep, 0.08);
  assert.equal(SPACING.cleanNeeded, 2);
  assert.equal(SPACING.quickMs, 45000);
  assert.equal(SPACING.slowMs, 90000);
  assert.equal(RATE.window, 6);
  assert.equal(RATE.minAccuracy, 0.5);
  assert.equal(PLACEMENT.unit, 'c0');
  assert.equal(PLACEMENT.maxItems, 14);
  assert.equal(PLACEMENT.passMs, 90000);
  assert.equal(PLACEMENT.firstIntervalDays, 1);
  assert.deepEqual(FLUENCY.topics, ['exp-int', 'exp-rat', 'radicals', 'factoring', 'special-angles', 'basic-identities', 'power-rule']);
  assert.equal(FLUENCY.setSize, 5);
  assert.equal(FLUENCY.targetMs, 20000);
  assert.equal(FLUENCY.cooldownDays, 1);
  assert.equal(DAILY.weights.fluency, 1);
  assert.ok(DAILY.weights.fluency < DAILY.weights.review);
  assert.ok(DAILY.weights.fluency <= DAILY.weights.mixed);
});

t('intervalMs at default ease matches the fixed schedule, and is bounded when ease is extreme', () => {
  assert.equal(Mastery.intervalMs(3), INT[3] * DAY);
  assert.equal(Mastery.intervalMs(4, 1), INT[4] * DAY);
  assert.equal(Mastery.intervalMs(4, 1.6), Math.round(INT[4] * 1.6 * DAY));
  assert.equal(Mastery.intervalMs(4, 0.5), Math.round(INT[4] * 0.5 * DAY));
  assert.equal(Mastery.intervalMs(4, 99), Math.round(INT[4] * SPACING.maxEase * DAY));
  assert.equal(Mastery.intervalMs(4, 0), Math.round(INT[4] * SPACING.minEase * DAY));
});

// ---------- adaptive spacing ----------
t('a failed due review shortens the next ease factor and clears the clean streak', () => {
  const now = 2_000_000_000_000;
  const p = start({ b: mastered(3, now) });
  const out = review(p, 'b', false, now, { ms: 8_000 });
  const s = out.progress.skills.b;
  assert.equal(s.fix, 1);
  assert.equal(s.ease, 0.85);
  assert.equal(s.clean || 0, 0);
  assert.equal(out.event.k, 'failedReview');
  assert.equal(out.event.ease, 0.85);
});

t('a slow or hinted pass shortens ease; a quick hinted pass does not count as clean', () => {
  const now = 2_000_000_000_000;
  let p = start({ b: mastered(3, now) });
  p = review(p, 'b', true, now, { ms: SPACING.slowMs }).progress;
  assert.equal(p.skills.b.ease, 0.92);
  assert.equal(p.skills.b.clean || 0, 0);
  p = start({ b: mastered(3, now) });
  p = review(p, 'b', true, now, { ms: 8_000, hint: true }).progress;
  assert.equal(p.skills.b.ease, 0.92);
  assert.equal(p.skills.b.clean || 0, 0);
});

t('two clean, quick due-review passes lengthen ease, then the streak resets', () => {
  const now = 2_000_000_000_000;
  let p = start({ b: mastered(3, now) });
  const first = review(p, 'b', true, now, { ms: 9_000 });
  assert.equal(first.progress.skills.b.ease || undefined, undefined); // still default, stripped
  assert.equal(Mastery.skillOf(first.progress, 'b').clean, 1);
  assert.equal(first.event.d, INT[4]); // lv 3→4, ease 1 → 16 days
  // next due review at the new date
  const due = first.progress.skills.b.due;
  const second = review(first.progress, 'b', true, due, { ms: 10_000 });
  const s = Mastery.skillOf(second.progress, 'b');
  assert.equal(s.ease, 1.08);
  assert.equal(s.clean, 0);
  assert.equal(second.event.d, Math.round(INT[5] * 1.08));
  assert.equal(second.progress.skills.b.due - due, Mastery.intervalMs(5, 1.08));
});

t('ease stays inside its bounds after many fails or many clean streaks', () => {
  const now = 2_000_000_000_000;
  let p = start({ b: mastered(3, now, { ease: 0.55 }) });
  p = review(p, 'b', false, now).progress;
  assert.equal(Mastery.skillOf(p, 'b').ease, SPACING.minEase);
  p = start({ b: mastered(3, now, { ease: 1.56, clean: 1 }) });
  p = review(p, 'b', true, now, { ms: 8_000 }).progress;
  assert.equal(Mastery.skillOf(p, 'b').ease, SPACING.maxEase);
});

t('a successful due review with no timing data leaves ease unchanged', () => {
  const now = 2_000_000_000_000;
  const p = start({ b: mastered(3, now) });
  const out = review(p, 'b', true, now);
  assert.equal(out.event.d, INT[4]);
  assert.equal(out.progress.skills.b.ease, undefined);
  assert.equal(Mastery.skillOf(out.progress, 'b').clean, 0);
});

t('ease is only applied to due reviews, and mixed practice of a not-due topic does not change it', () => {
  const now = 2_000_000_000_000;
  const p = start({ b: mastered(3, now + 10 * DAY, { ease: 1.2 }) });
  const out = Mastery.applyAnswer(p, { id: 'b', ok: true, mode: 'mixed', now, ms: 8_000 }, toy());
  assert.equal(Mastery.skillOf(out.progress, 'b').ease, 1.2);
  assert.equal(out.progress.skills.b.due, now + 10 * DAY);
});

t('older progress without ease or rec still records a review on the original interval', () => {
  const now = 2_000_000_000_000;
  const p = Mastery.emptyProgress();
  p.skills.b = { a: 4, c: 4, lv: 2, due: now };
  const out = review(p, 'b', true, now);
  assert.equal(out.event.k, 'reviewed');
  assert.equal(out.event.d, INT[3]);
  assert.equal(out.progress.skills.b.due, now + INT[3] * DAY);
  assert.equal(out.progress.skills.b.ease, undefined);
});

t('FIRe credit scales with the learner\'s current eased interval', () => {
  const now = 2_000_000_000_000;
  const due = now + 0.5 * DAY;
  // c encompasses b (manual? default hops). Use a as ancestor of b? catalog: c→b→a
  let p = start({
    a: mastered(2, due, { ease: 1.6 }),
    c: mastered(2, now),
  });
  const out = Mastery.applyFire(p, 'c', true, now, toy(), { early: false });
  const next = out.progress.skills.a.due;
  const weight = FIRE.directWeight * FIRE.directWeight * FIRE.hopDecay;
  const expectedCredit = weight * FIRE.creditScale * Mastery.intervalMs(2, 1.6);
  const cap = now + FIRE.maxHorizonIntervals * Mastery.intervalMs(2, 1.6);
  const expected = Math.min(due + expectedCredit, cap);
  assert.ok(Math.abs(next - expected) < 1, `got ${next - due}, want ${expected - due}`);
});

// ---------- rate check ----------
t('rate check does not fire until the window is full, and does not backfill from lifetime accuracy', () => {
  const now = 2_000_000_000_000;
  // four misses plus one more is still short of the 6-try window
  let p = start({
    a: mastered(3, now + 10 * DAY),
    b: mastered(2, now + DAY, { a: 20, c: 2, rec: [0, 0, 0, 0] }),
  });
  const out = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'mixed', now }, toy());
  assert.notEqual(out.event && out.event.k, 'shore');
  assert.equal(out.progress.skills.b.rec.length, 5);
  // a poor lifetime record with a full window of recent hits also stays quiet
  p = start({
    a: mastered(3, now + 10 * DAY),
    b: mastered(2, now + DAY, { a: 20, c: 2, rec: [1, 1, 1, 1, 1] }),
  });
  const hit = Mastery.applyAnswer(p, { id: 'b', ok: true, mode: 'mixed', now }, toy());
  assert.notEqual(hit.event && hit.event.k, 'shore');
  assert.equal(hit.progress.skills.b.rec.length, 6);
});

t('accuracy below 50% over the last 6 tries queues the same key-prerequisite shore as two misses', () => {
  const now = 2_000_000_000_000;
  const p = start({
    a: mastered(3, now + 10 * DAY),
    b: mastered(2, now + DAY, { rec: [0, 0, 0, 1, 0] }),
  });
  const out = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'mixed', now }, toy());
  assert.equal(out.event.k, 'shore');
  assert.equal(out.event.reason, 'rate');
  assert.equal(out.event.rate.n, 6);
  assert.ok(out.event.rate.accuracy < RATE.minAccuracy);
  assert.ok(out.event.shore.some(s => s.id === 'a'));
  assert.equal((out.progress.skills.b.rec || []).length, 0);
  assert.ok((out.progress.shore || []).some(s => s.id === 'a'));
});

t('accuracy of exactly 50% over the window does not trigger, and a second trigger needs a fresh window', () => {
  const now = 2_000_000_000_000;
  let p = start({
    a: mastered(3, now + 10 * DAY),
    b: mastered(2, now + DAY, { rec: [1, 0, 1, 0, 1] }),
  });
  let out = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'mixed', now }, toy());
  assert.notEqual(out.event && out.event.k, 'shore');
  assert.equal(out.event && out.event.k, 'pulled');
  // already below after a previous trigger: rec was cleared, 5 more misses then one more
  p = start({
    a: mastered(3, now + 10 * DAY),
    b: mastered(2, now + DAY, { rec: [0, 0, 0, 0, 0] }),
  });
  out = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'mixed', now }, toy());
  assert.equal(out.event.k, 'shore');
  assert.equal((out.progress.skills.b.rec || []).length, 0);
  // immediately another miss must not re-trigger
  const again = Mastery.applyAnswer(out.progress, { id: 'b', ok: false, mode: 'mixed', now: now + 1000 }, toy());
  assert.notEqual(again.event && again.event.k, 'shore');
});

t('rate check does not double-fire when the two-misses rule already shored this turn', () => {
  const now = 2_000_000_000_000;
  const p = start({
    a: mastered(3, now + 10 * DAY),
    b: { a: 4, c: 1, s: 0, lv: 0, kp: 0, kpS: 0, kpFails: 1, rec: [0, 0, 0, 0, 0] },
  });
  const out = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'new', now }, toy());
  assert.equal(out.event.k, 'shore');
  assert.notEqual(out.event.reason, 'rate');
});

// ---------- placement ----------
t('the default path does not start a placement, and nextPlacementTopic is null until one is started', () => {
  const p = Mastery.emptyProgress();
  assert.equal(Mastery.nextPlacementTopic(p, toy()), null);
  assert.equal(Mastery.placementState(p).status, '');
});

t('placement starts with a highest-depth Unit 0 topic and walks down after a miss or I don\'t know', () => {
  let p = Mastery.startPlacement(Mastery.emptyProgress(), toy(), 1);
  const first = Mastery.nextPlacementTopic(p, toy());
  assert.ok(first === 'c' || first === 'radicals' || first === 'domain', 'start high, got ' + first);
  // force a high miss on radicals, expect a direct prereq next
  p = Mastery.startPlacement(p, toy(), 1);
  let out = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: false, now: 1 }, toy());
  assert.equal(out.kind, 'wrong');
  assert.equal(out.nextId, 'exp-rat');
  out = Mastery.applyPlacementAnswer(out.progress, { id: 'exp-rat', idk: true, now: 2 }, toy());
  assert.equal(out.kind, 'idk');
  assert.equal(out.nextId, 'exp-int');
});

t('only a confident, reasonably quick correct answer is credited; slow, wrong and IDK stay on the path', () => {
  const now = 3_000_000_000_000;
  let p = Mastery.startPlacement(Mastery.emptyProgress(), toy(), now);
  p = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: true, ms: 20_000, now }, toy()).progress;
  p = Mastery.applyPlacementAnswer(p, { id: 'domain', ok: true, ms: PLACEMENT.passMs + 1, now }, toy()).progress;
  p = Mastery.applyPlacementAnswer(p, { id: 'c', ok: false, now }, toy()).progress;
  p = Mastery.applyPlacementAnswer(p, { id: 'b', idk: true, now }, toy()).progress;
  const fin = Mastery.finalizePlacement(p, toy(), now);
  assert.ok(fin.credited.includes('radicals'));
  assert.ok(fin.inferred.includes('exp-rat'));
  assert.ok(fin.inferred.includes('exp-int'));
  assert.ok(!fin.credited.includes('domain'));
  assert.ok(!fin.inferred.includes('func-eval'));
  assert.ok(!fin.inferred.includes('linear-ineq'));
  assert.ok(!fin.credited.includes('c'));
  assert.ok(!fin.credited.includes('b'));
  assert.equal(fin.progress.skills.radicals.lv, 1);
  assert.equal(fin.progress.skills.radicals.placed, 1);
  assert.equal(fin.progress.skills['exp-int'].inferred, 1);
  assert.equal(fin.progress.skills.radicals.due, now + PLACEMENT.firstIntervalDays * DAY);
  assert.deepEqual((fin.progress.qz || {}).recent || [], []);
  assert.ok(fin.remains.includes('domain'));
  assert.equal(fin.progress.place.status, 'done');
});

t('a strong pass on a join topic infers both ancestors when nothing below them was missed', () => {
  const now = 3_000_000_000_000;
  let p = Mastery.startPlacement(Mastery.emptyProgress(), toy(), now);
  p = Mastery.applyPlacementAnswer(p, { id: 'domain', ok: true, ms: 15_000, now }, toy()).progress;
  const fin = Mastery.finalizePlacement(p, toy(), now);
  assert.ok(fin.credited.includes('domain'));
  assert.ok(fin.inferred.includes('func-eval'));
  assert.ok(fin.inferred.includes('linear-ineq'));
});

t('an ancestor is not inferred when a descendant was missed, and practised topics are not overwritten', () => {
  const now = 3_000_000_000_000;
  let p = start({ 'exp-int': mastered(3, now + 20 * DAY) });
  p = Mastery.startPlacement(p, toy(), now);
  p = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: false, now }, toy()).progress;
  p = Mastery.applyPlacementAnswer(p, { id: 'exp-rat', ok: true, ms: 10_000, now }, toy()).progress;
  const fin = Mastery.finalizePlacement(p, toy(), now);
  assert.ok(fin.credited.includes('exp-rat'));
  assert.ok(!fin.inferred.includes('exp-int'), 'exp-int was practised, leave it');
  assert.equal(fin.progress.skills['exp-int'].lv, 3);
  assert.equal(fin.progress.skills['exp-int'].placed || 0, 0);
  assert.ok(!fin.credited.includes('radicals'));
});

t('a retake clears earlier placement marks and re-applies, without adding placement items to the quiz recent list or awarding XP', () => {
  const now = 3_000_000_000_000;
  let p = Mastery.startPlacement(Mastery.emptyProgress(), toy(), now);
  p = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: true, ms: 12_000, now }, toy()).progress;
  p = Mastery.finalizePlacement(p, toy(), now).progress;
  assert.equal(p.skills.radicals.placed, 1);
  const logBefore = { ...(p.log || {}) };
  p = Mastery.startPlacement(p, toy(), now + DAY);
  p = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: false, now: now + DAY }, toy()).progress;
  const fin = Mastery.finalizePlacement(p, toy(), now + DAY);
  assert.ok(!fin.credited.includes('radicals'));
  assert.equal(fin.progress.skills.radicals && fin.progress.skills.radicals.lv || 0, 0);
  assert.deepEqual(fin.progress.log || {}, logBefore);
  assert.deepEqual((fin.progress.qz || {}).recent || [], []);
});

t('placement stops after the configured item cap and does not ask inferred ancestors', () => {
  let p = Mastery.startPlacement(Mastery.emptyProgress(), toy(), 1);
  const seen = [];
  for (let i = 0; i < 20; i++) {
    const id = Mastery.nextPlacementTopic(p, toy());
    if (!id) break;
    seen.push(id);
    const ok = id === 'radicals' || id === 'domain' || id === 'c';
    p = Mastery.applyPlacementAnswer(p, { id, ok, ms: 8_000, now: 1 + i }, toy()).progress;
  }
  assert.ok(seen.length <= PLACEMENT.maxItems);
  assert.ok(!seen.includes('exp-int') || seen.indexOf('exp-int') < seen.indexOf('radicals') || !seen.includes('radicals'));
  // after a strong radicals, exp-rat/exp-int should be skipped
  p = Mastery.startPlacement(Mastery.emptyProgress(), toy(), 1);
  p = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: true, ms: 8_000, now: 1 }, toy()).progress;
  const next = Mastery.nextPlacementTopic(p, toy());
  assert.notEqual(next, 'exp-rat');
  assert.notEqual(next, 'exp-int');
});

// ---------- fluency ----------
t('fluency sets are only offered for mastered, not-due, cooled-down foundation skills, in sets of five', () => {
  const now = 4_000_000_000_000;
  const p = start({
    'exp-int': mastered(2, now + 5 * DAY),
    'radicals': mastered(2, now), // due, so skipped
    'factoring': mastered(2, now + 5 * DAY, { fluencyAt: now - 2 * 3600 * 1000 }), // still cooling
  });
  const due = Mastery.fluencyDueTopics(p, toy(), now);
  assert.deepEqual(due, ['exp-int']);
  const set = Mastery.pickFluencySet(p, toy(), now);
  assert.equal(set.length, FLUENCY.setSize);
  assert.ok(set.every(id => id === 'exp-int'));
});

t('a fluency item awards modest XP, stamps the cooldown, and does not change review ease when the topic is not due', () => {
  const now = 4_000_000_000_000;
  const p = start({ 'exp-int': mastered(2, now + 5 * DAY, { ease: 1.2 }) });
  const out = Mastery.applyAnswer(p, { id: 'exp-int', ok: true, mode: 'fluency', now, ms: 4_000 }, toy());
  assert.equal(out.progress.skills['exp-int'].fluencyAt, now);
  assert.equal(Mastery.skillOf(out.progress, 'exp-int').ease, 1.2);
  const key = Object.keys(out.progress.log)[0];
  assert.equal(out.progress.log[key], DAILY.weights.fluency);
  const cooled = Mastery.fluencyDueTopics(out.progress, toy(), now + 2 * 3600 * 1000);
  assert.ok(!cooled.includes('exp-int'));
  const later = Mastery.fluencyDueTopics(out.progress, toy(), now + FLUENCY.cooldownDays * DAY);
  assert.ok(later.includes('exp-int'));
});

t('fluency is not picked for unmastered topics or topics in repair', () => {
  const now = 4_000_000_000_000;
  const p = start({
    'exp-int': { a: 2, c: 1, lv: 0, due: 0 },
    'radicals': mastered(2, now + 5 * DAY, { fix: 1 }),
  });
  assert.deepEqual(Mastery.fluencyDueTopics(p, toy(), now), []);
  assert.deepEqual(Mastery.pickFluencySet(p, toy(), now), []);
});

// ---------- live CAPS catalog wiring ----------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-batch2-'));
const db = new DatabaseSync(path.join(dir, 't.sqlite'));
catalog.init(db);

t('the CAPS catalog exports spacing, rate, placement and fluency config', () => {
  const course = catalog.learner(db, 'gr12-caps');
  assert.equal(course.spacing.minEase, 0.5);
  assert.equal(course.rate.window, 6);
  assert.equal(course.placement.unit, 'c0');
  assert.equal(course.fluency.setSize, 5);
  assert.equal(course.daily.weights.fluency, 1);
  const unit0 = course.topics.filter(tp => tp.unit === 'c0');
  assert.ok(unit0.length >= 10, 'Unit 0 should have a foundation graph');
  const byId = new Map(course.topics.map(tp => [tp.id, tp]));
  for (const id of FLUENCY.topics) {
    assert.ok(byId.has(id), id + ' should be in the CAPS course');
  }
});

t('on the live Unit 0 graph, a strong radicals pass infers exponent-law ancestors and starts with a high topic', () => {
  const course = catalog.learner(db, 'gr12-caps');
  let p = Mastery.startPlacement(Mastery.emptyProgress(), course, 1);
  const first = Mastery.nextPlacementTopic(p, course);
  const g = Mastery.unit0Graph(course);
  assert.ok(g.topics.some(tp => tp.id === first));
  const maxDepth = Math.max(...[...g.depth.values()]);
  assert.ok(g.depth.get(first) >= maxDepth - 1, `first ${first} depth ${g.depth.get(first)} vs max ${maxDepth}`);
  p = Mastery.applyPlacementAnswer(p, { id: 'radicals', ok: true, ms: 20_000, now: 1 }, course).progress;
  const fin = Mastery.finalizePlacement(p, course, 1);
  assert.ok(fin.credited.includes('radicals'));
  assert.ok(fin.inferred.includes('exp-rat'), 'infer exp-rat, got ' + fin.inferred.join(','));
  assert.ok(fin.inferred.includes('exp-int'), 'infer exp-int, got ' + fin.inferred.join(','));
});

let failed = 0;
for (const [ok, name, msg] of results) {
  if (ok === 'ok') console.log('  ok  ' + name);
  else { failed++; console.log('  FAIL  ' + name + ' — ' + msg); }
}
console.log(results.length + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
