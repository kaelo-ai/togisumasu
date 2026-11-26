// Master graph, CAPS course slice, and NSC import.
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-caps-'));
process.env.QUESTION_SEED_PER_SKILL = '1';
const { mailbox, registerVerified } = require('./helpers.js');
const sent = mailbox();
const { server, db } = require('../server.js');
const catalog = require('../catalog.js');
const caps = require('../caps.js');
const nsc = require('../nsc.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

let base;
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const r = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
    let json = null; try { json = await r.json(); } catch (err) { json = null; }
    return { status: r.status, json };
  };
}

t('exp-int is one node shared by both courses', () => {
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM topics WHERE id = 'exp-int'`).get().n, 1);
  const courses = db.prepare(`SELECT course_id FROM course_topics WHERE topic_id = 'exp-int' ORDER BY course_id`).all().map(r => r.course_id);
  assert.deepEqual(courses, ['algebra', 'gr12-caps']);
});

t('CAPS slice has Unit 0 and units 1–10, and Unit 0 is required', () => {
  const course = catalog.learner(db, 'gr12-caps');
  assert.equal(course.course.id, 'gr12-caps');
  assert.equal(course.units.length, 11);
  assert.equal(course.units[0].id, 'c0');
  assert.equal(course.units[0].required, true);
  assert.equal(course.units.map(u => u.id).join(','), 'c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10');
  assert.ok(course.topics.filter(topic => topic.unit === 'c0').length >= 18);
  assert.equal(new Set(course.topics.map(topic => topic.id)).size, course.topics.length);
});

t('off-CAPS topics stay in algebra and are not CAPS prerequisites', () => {
  const algebra = catalog.learner(db, 'algebra');
  const course = catalog.learner(db, 'gr12-caps');
  const capsIds = new Set(course.topics.map(topic => topic.id));
  for (const id of caps.OFF_CAPS) {
    assert.ok(algebra.topics.some(topic => topic.id === id), id);
    assert.ok(!capsIds.has(id), id);
  }
  for (const topic of course.topics) {
    for (const pre of topic.pre) assert.ok(!caps.OFF_CAPS.includes(pre), `${topic.id} → ${pre}`);
  }
  assert.ok(!algebra.topics.some(topic => topic.id === 'seq-linear'));
  assert.ok(algebra.topics.some(topic => topic.id === 'special-angles'));
});

t('CAPS prerequisite projection has no cycles and only in-course targets', () => {
  const course = catalog.learner(db, 'gr12-caps');
  const ids = new Set(course.topics.map(topic => topic.id));
  const pre = new Map(course.topics.map(topic => [topic.id, topic.pre]));
  for (const [id, list] of pre) for (const p of list) assert.ok(ids.has(p), `${id} → ${p}`);
  const visiting = new Set(), done = new Set();
  const visit = id => {
    if (visiting.has(id)) throw new Error('cycle at ' + id);
    if (done.has(id)) return;
    visiting.add(id);
    for (const p of pre.get(id) || []) visit(p);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of ids) visit(id);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM topic_prereqs').get().n > 40);
});

t('default catalog is still the algebra course', () => {
  const course = catalog.learner(db);
  assert.equal(course.course.id, 'algebra');
  assert.ok(course.units.some(unit => unit.id === 'A'));
  assert.ok(course.topics.some(topic => topic.id === 'exp-int' && topic.unit === 'A'));
  assert.ok(!course.units.some(unit => unit.id === 'c0'));
});

t('NSC import is idempotent and every paper is 150 marks', () => {
  const first = db.prepare('SELECT COUNT(*) AS n FROM nsc_papers').get().n;
  assert.equal(first, 20);
  const again = nsc.importAll(db);
  assert.equal(again.unchanged, 20);
  assert.equal(again.inserted, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nsc_papers').get().n, 20);
  const bad = db.prepare(`
    SELECT p.id, p.total_marks, COALESCE(SUM(n.marks), 0) AS got
    FROM nsc_papers p JOIN nsc_nodes n ON n.paper_id = p.id AND n.is_leaf = 1
    GROUP BY p.id HAVING got <> 150 OR p.total_marks <> 150
  `).all();
  assert.deepEqual(bad, []);
});

t('2016 Paper 2 Q2.2 keeps the histogram reading note', () => {
  const row = db.prepare(`SELECT notes FROM nsc_nodes WHERE id = '2016-nov-p2-2.2'`).get();
  assert.match(row.notes, /1,39/);
  const figure = db.prepare(`SELECT caption FROM nsc_figures WHERE id = '2016-nov-p2-fig-2'`).get();
  assert.match(figure.caption, /histogram/i);
});

t('practice and exam pools are enforced in the schema and the views', () => {
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_papers WHERE year < 2022 AND pool <> 'practice'`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_papers WHERE year >= 2022 AND pool <> 'exam'`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_papers WHERE pool = 'practice'`).get().n, 12);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_papers WHERE pool = 'exam'`).get().n, 8);
  const practiceSql = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'nsc_practice_leaves'`).get().sql;
  assert.match(practiceSql, /pool = 'practice'/);
  assert.match(practiceSql, /year < 2022/);
  const examSql = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'nsc_exam_papers'`).get().sql;
  assert.match(examSql, /pool = 'exam'/);
  assert.match(examSql, /year >= 2022/);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_practice_leaves WHERE paper_id IN (SELECT id FROM nsc_papers WHERE year >= 2022)`).get().n, 0);
  assert.equal(nsc.examPapers(db).length, 8);
  assert.ok(nsc.practiceLeaves(db).length > 100);
  assert.throws(() => nsc.recordPaper(db, {
    id: '2099-nov-p1', year: 2099, session: 'november', paper: 1, totalMarks: 150, pool: 'practice', contentHash: 'x',
  }));
  assert.throws(() => db.prepare(`UPDATE nsc_papers SET pool = 'practice' WHERE year >= 2022`).run());
  assert.equal(db.prepare(`SELECT pool FROM nsc_papers WHERE year >= 2022 LIMIT 1`).get().pool, 'exam');
});

t('question skills map to topics through the lookup, not a foreign key', () => {
  assert.deepEqual(nsc.topicsForNode(db, '2016-nov-p1-1.1.1'), ['quad-factor']);
  const orphans = db.prepare(`
    SELECT COUNT(*) AS n FROM nsc_node_skills s
    LEFT JOIN bank_skill_map m ON m.bank_code = s.bank_code
    WHERE m.bank_code IS NULL
  `).get().n;
  assert.equal(orphans, 0);
  db.prepare(`UPDATE bank_skill_map SET topic_id = 'quad-formula' WHERE bank_code = 'alg.zero-product'`).run();
  assert.deepEqual(nsc.topicsForNode(db, '2016-nov-p1-1.1.1'), ['quad-formula']);
  assert.ok(db.prepare(`SELECT 1 AS ok FROM nsc_node_skills WHERE node_id = '2016-nov-p1-1.1.1' AND bank_code = 'alg.zero-product'`).get());
  db.prepare(`UPDATE bank_skill_map SET topic_id = 'quad-factor' WHERE bank_code = 'alg.zero-product'`).run();
});

server.listen(0, async () => {
  base = `http://127.0.0.1:${server.address().port}`;
  const anon = client(), user = client();
  const http = async (name, fn) => {
    try { await fn(); results.push(['ok', name]); }
    catch (e) { results.push(['FAIL', name, e.message]); }
  };
  await http('catalog requires sign-in', async () => {
    assert.equal((await anon('GET', '/api/catalog?course=gr12-caps')).status, 401);
  });
  await http('signed-in learner can load the CAPS course', async () => {
    assert.equal((await registerVerified(user, { email: 'caps@example.com', name: 'Caps', password: 'long-password' }, sent)).status, 200);
    const r = await user('GET', '/api/catalog?course=gr12-caps');
    assert.equal(r.status, 200);
    assert.equal(r.json.course.id, 'gr12-caps');
    assert.ok(r.json.topics.some(topic => topic.id === 'exp-int' && topic.unit === 'c0'));
    assert.equal((await user('GET', '/api/catalog?course=nope')).status, 404);
    const courses = await user('GET', '/api/courses');
    assert.ok(courses.json.courses.some(course => course.id === 'gr12-caps'));
    assert.ok(courses.json.courses.some(course => course.id === 'algebra'));
  });
  const failed = results.filter(r => r[0] === 'FAIL');
  for (const r of results) console.log(r[0] === 'ok' ? '  ok  ' + r[1] : '  FAIL  ' + r[1] + ' — ' + r[2]);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  server.close();
  process.exit(failed.length ? 1 : 0);
});
