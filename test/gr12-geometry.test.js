// Grade 12 circle and similarity lessons: structure kept, every idea taught
// with key words, a figure and worked examples, every reason explained, and
// every figure drawn to the numbers in its question.
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const core = require('../public/core.js');
const CapsGen = require('../public/caps-gen.js');
const KpLessons = require('../public/kp-lessons.js');
const { CAPS_KPS } = require('../caps-kps.js');
const caps = require('../caps.js');
const questions = require('../questions.js');

const TOPICS = ['euc-chords', 'euc-cyclic', 'euc-tan-chord', 'euc-similar', 'euc-circle-riders', 'euc-mixed'];
const KP_NAMES = {
  'euc-chords': ['The perpendicular from the centre bisects a chord', 'The line from the centre to the midpoint of a chord'],
  'euc-cyclic': ['The angle at the centre', 'Opposite angles of a cyclic quadrilateral'],
  'euc-tan-chord': ['A tangent is perpendicular to the radius', 'The tan-chord theorem'],
  'euc-similar': ['AAA similarity', 'Corresponding sides of similar triangles'],
  'euc-circle-riders': ['A rider step with the angle at the centre', 'A cyclic-quadrilateral rider'],
  'euc-mixed': ['Tan-chord with the angle at the centre', 'Midpoint theorem in a mixed rider'],
};
const results = [];
function t(name, fn) { try { fn(); results.push(['ok', name]); } catch (err) { results.push(['FAIL', name, err.message]); } }
const base = r => String(r).split(';')[0].trim();
const glossOf = list => new Set(list.flatMap(k => k.steps.flatMap(S => S.reasons.flatMap(([a]) => base(a).split(' / ')))));
const UNIT0 = glossOf(KpLessons.LESSONS['euc-revision']);
// Reasons a learner has met by knowledge point kp of a topic: Unit 0 plus this topic so far.
const known = (id, kp) => new Set([...UNIT0, ...glossOf(KpLessons.LESSONS[id].slice(0, kp + 1))]);
const stepReason = s => { const m = String(s).match(/\(([^()$]+)\)\.?$/); return m ? base(m[1]) : null; };

t('the six topics keep their knowledge points, and each has a lesson with the same title', () => {
  for (const id of TOPICS) {
    assert.deepEqual(CAPS_KPS[id].map(k => k.name), KP_NAMES[id], id);
    assert.equal(CapsGen.BRANCHED[id], 2, id);
    assert.deepEqual(KpLessons.LESSONS[id].map(l => l.title), KP_NAMES[id], id);
  }
});

t('every lesson has key words, an explanation, a figure, three or more worked examples, a tip and the CC BY credit', () => {
  for (const id of TOPICS) for (const L of KpLessons.LESSONS[id]) for (const S of L.steps) {
    const at = `${id} / ${L.title}`;
    assert.ok(S.words.length >= 2 && S.words.every(([w, d]) => w && d.length > 15), at + ': key words');
    assert.ok(S.explain.replace(/<[^>]+>/g, '').length > 200, at + ': explanation');
    assert.match(S.fig(), /<svg/, at + ': figure');
    assert.ok(S.examples.length >= 3, at + ': examples');
    for (const e of S.examples) { assert.match(e.fig(), /<svg/, at + ': example figure'); assert.ok(e.rows.length >= 1 && e.answer, at); }
    assert.ok(S.tip && S.tip.length > 40, at + ': tip');
    assert.ok(S.sources.some(x => /Siyavula.*CC BY/.test(x)), at + ': Siyavula credit');
  }
});

t('every reason in a worked example is explained in that lesson, an earlier one in the topic, or Unit 0', () => {
  for (const id of TOPICS) KpLessons.LESSONS[id].forEach((L, kp) => {
    const ok = known(id, kp);
    for (const S of L.steps) for (const e of S.examples) for (const [, r] of e.rows) {
      if (!r || /^given/.test(r)) continue;
      assert.ok(ok.has(base(r)), `${id} kp${kp}: "${r}" is not explained`);
    }
  });
});

t('practice items use only reasons the lessons explain, carry a figure, and check out', () => {
  let n = 0;
  for (const id of TOPICS) for (let kp = 0; kp < 2; kp++) {
    const ok = known(id, kp);
    for (let i = 0; i < 150; i++) {
      const q = CapsGen.GENERATORS[id](kp);
      assert.equal(q.genRev, 'gr12geo-v1', id);
      assert.match(q.prompt, /<svg/, id + ' figure');
      assert.ok(!/NaN|undefined/.test(q.prompt + q.steps.join(' ')), id + ' text');
      const inp = q.type === 'mc' ? q.options.findIndex(o => o.ok) : q.type === 'geom' ? q.chain : q.ans;
      assert.ok(core.check(q, inp).ok, id + ' self-check');
      questions.normalizeQuestion(q);
      const rs = (q.type === 'geom' ? q.reasons.map(r => r.text) : []).concat(q.steps.map(stepReason).filter(Boolean));
      for (const r of rs) { if (r === 'given' || r === 'r9') continue; n++; if (q.type === 'geom' && q.reasons.some(x => x.id === 'r9' && x.text === r)) continue; assert.ok(ok.has(base(r)), `${id} kp${kp}: "${r}" is not explained`); }
    }
  }
  assert.ok(n > 500, 'reasons were found');
});

t('each knowledge point offers plenty of different practice', () => {
  for (const id of TOPICS) for (let kp = 0; kp < 2; kp++) {
    const prompts = new Set(), kinds = new Set();
    for (let i = 0; i < 400; i++) {
      const q = CapsGen.GENERATORS[id](kp);
      prompts.add(q.prompt.replace(/<figure[\s\S]*?<\/figure>/g, ''));
      kinds.add(q.type + ':' + String(q.hint).replace(/[\d.]+/g, '#').slice(0, 40));
    }
    assert.ok(prompts.size >= 80, `${id} kp${kp}: only ${prompts.size} different items`);
    assert.ok(kinds.size >= 4, `${id} kp${kp}: only ${kinds.size} kinds of item`);
  }
});

t('every labelled angle in a figure is drawn at that size, and a ? angle matches the answer', () => {
  const GF = CapsGen.GF, orig = GF.arc; let rec = [];
  GF.arc = function (v, p, q, tx) { rec.push({ v, p, q, t: tx }); return orig.apply(this, arguments); };
  const ang = (v, p, q) => { let d = Math.abs(Math.atan2(p.y - v.y, p.x - v.x) - Math.atan2(q.y - v.y, q.x - v.x)) * 180 / Math.PI; return d > 180 ? 360 - d : d; };
  const bad = [];
  try {
    for (const id of TOPICS.concat(['euc-revision'])) for (let kp = 0; kp < CapsGen.BRANCHED[id]; kp++) for (let i = 0; i < 150; i++) {
      rec = []; const q = CapsGen.GENERATORS[id](kp);
      for (const r of rec) {
        const m = String(r.t || '').match(/^(\d+)°$/), want = m ? +m[1] : r.t === '?' && q.deg ? q.val : null;
        if (want != null && Math.abs(ang(r.v, r.p, r.q) - want) > 1.5) bad.push(`${id} kp${kp} ${r.t}`);
      }
    }
    for (const list of Object.values(KpLessons.LESSONS)) for (const L of list) for (const S of L.steps) for (const f of [S.fig].concat(S.examples.map(e => e.fig))) {
      rec = []; f();
      for (const r of rec) { const m = String(r.t || '').match(/^(\d+)°$/); if (m && Math.abs(ang(r.v, r.p, r.q) - +m[1]) > 1.5) bad.push(`${L.title} ${r.t}`); }
    }
  } finally { GF.arc = orig; }
  assert.equal(bad.length, 0, bad.slice(0, 5).join('; '));
});

t('the topic intros are plain: no “Prove:” instructions or undefined exam words, and only unedited text is replaced', () => {
  for (const id of TOPICS) {
    const tp = caps.TOPICS.find(x => x.id === id), txt = tp.notes.replace(/<[^>]+>/g, '');
    assert.ok(!/Prove:|AAA|riders are where|capped/.test(txt), id);
    assert.ok(Array.isArray(tp.oldNotes) && tp.oldNotes.length === 1, id + ' keeps its old text for the guarded refresh');
    for (const w of ['supplementary', 'equiangular', 'cyclic quadrilateral', 'bookwork', 'rider', 'tangent', 'chord']) {
      if (new RegExp(w, 'i').test(txt)) assert.ok(new RegExp(`${w}[^.]{0,4}(is|,|:|\\()|(called|means|or) (a |the )?${w}`, 'i').test(txt), `${id}: “${w}” is used without being explained`);
    }
  }
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE topics (id TEXT PRIMARY KEY, notes TEXT, name TEXT, updated_at INTEGER)');
  const tp = caps.TOPICS.find(x => x.id === 'euc-chords');
  db.prepare('INSERT INTO topics (id, notes, name) VALUES (?, ?, ?)').run('euc-chords', tp.oldNotes[0], tp.name);
  db.prepare('INSERT INTO topics (id, notes, name) VALUES (?, ?, ?)').run('euc-cyclic', '<p>A teacher edited this.</p>', 'x');
  const upd = db.prepare('UPDATE topics SET notes=?, updated_at=? WHERE id=? AND notes=?');
  for (const id of ['euc-chords', 'euc-cyclic']) { const x = caps.TOPICS.find(y => y.id === id); for (const old of x.oldNotes) upd.run(x.notes, 1, id, old); }
  assert.equal(db.prepare("SELECT notes FROM topics WHERE id='euc-chords'").get().notes, tp.notes);
  assert.equal(db.prepare("SELECT notes FROM topics WHERE id='euc-cyclic'").get().notes, '<p>A teacher edited this.</p>');
});

t('old cached items for these topics are retired, new ones are kept', () => {
  for (const id of TOPICS) assert.equal(questions.GEN_REVISIONS[id], 'gr12geo-v1', id);
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0] === 'ok' ? '  ok  ' + r[1] : '  FAIL  ' + r[1] + ' — ' + r[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
