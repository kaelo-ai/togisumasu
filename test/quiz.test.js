// Quiz assembly must include a gated pre-2022 past-paper question, never a 2022+ paper.
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-quiz-'));
process.env.QUESTION_SEED_PER_SKILL = '1';
const { server, db } = require('../server.js');
const quiz = require('../quiz.js');
const nsc = require('../nsc.js');
const catalog = require('../catalog.js');
const keys = require('../keys.js');

keys.init(db);
const stamp = db.prepare(`
  INSERT OR REPLACE INTO nsc_answer_keys
    (node_id, provenance, answer_json, steps_json, solver_a, solver_b, updated_at)
  VALUES (?, 'llm_double', ?, '[]', NULL, NULL, ?)
`);
const stampedAt = Date.now();
for (const leaf of nsc.practiceLeaves(db)) {
  stamp.run(leaf.id, JSON.stringify({ type: 'text', ans: '0', ansTex: '0', steps: ['test key'] }), stampedAt);
}

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const capsIds = catalog.learner(db, 'gr12-caps').topics.map(topic => topic.id);

t('a past-paper question is locked until its topics and prerequisites are mastered', () => {
  const blocked = quiz.eligibleLeaves(db, ['quad-factor'], 'gr12-caps');
  assert.ok(!blocked.some(leaf => leaf.id === '2016-nov-p1-1.1.1'));
  const open = quiz.eligibleLeaves(db, ['quad-factor', 'factoring', 'poly-mult'], 'gr12-caps');
  assert.ok(open.some(leaf => leaf.id === '2016-nov-p1-1.1.1'));
  const none = quiz.assembleQuiz(db, { mastered: ['quad-factor'], courseId: 'gr12-caps', shuffle: false });
  assert.equal(none.ok, false);
  assert.equal(none.reason, 'no-eligible-past-paper');
});

t('a question tagged with two topics waits for both', () => {
  const leaves = nsc.practiceLeaves(db);
  let multi = null;
  for (const leaf of leaves) {
    const topics = nsc.topicsForNode(db, leaf.id);
    if (new Set(topics).size >= 2) { multi = { id: leaf.id, topics }; break; }
  }
  assert.ok(multi, 'expected a practice leaf tagged with two topics');
  const one = quiz.eligibleLeaves(db, [multi.topics[0]], 'gr12-caps');
  assert.ok(!one.some(leaf => leaf.id === multi.id));
  const both = quiz.eligibleLeaves(db, capsIds, 'gr12-caps');
  assert.ok(both.some(leaf => leaf.id === multi.id));
});

t('every quiz includes a practice-pool paper and never a 2022+ paper', () => {
  const built = quiz.assembleQuiz(db, { mastered: capsIds, courseId: 'gr12-caps', shuffle: false, choice: 0 });
  assert.equal(built.ok, true);
  const papers = built.items.filter(item => item.kind === 'paper');
  assert.ok(papers.length >= 1);
  for (const item of papers) {
    assert.ok(item.year < 2022, item.id);
    assert.equal(db.prepare('SELECT pool FROM nsc_papers WHERE id = ?').get(item.paperId).pool, 'practice');
    assert.equal(db.prepare('SELECT id FROM nsc_exam_papers WHERE id = ?').get(item.paperId), undefined);
  }
  const years = db.prepare(`
    SELECT DISTINCT year FROM nsc_papers WHERE id IN (${papers.map(() => '?').join(',')})
  `).all(...papers.map(item => item.paperId));
  assert.ok(years.every(row => row.year < 2022));
});

t('eligible leaves are read from the practice view', () => {
  const sql = quiz.eligibleLeaves.toString();
  assert.match(sql, /nsc_practice_leaves/);
  assert.match(sql, /llm_double/);
  assert.match(sql, /memo/);
  const leaked = quiz.eligibleLeaves(db, capsIds, 'gr12-caps').filter(leaf => leaf.year >= 2022);
  assert.equal(leaked.length, 0);
});

t('exams are the 2022+ papers and practice papers are not exams', () => {
  const exams = quiz.listExams(db);
  assert.equal(exams.length, 8);
  assert.ok(exams.every(paper => paper.year >= 2022 && paper.pool === 'exam'));
  assert.equal(quiz.examPaper(db, '2016-nov-p1'), null);
  const paper = quiz.examPaper(db, '2022-nov-p1');
  assert.ok(paper);
  assert.equal(paper.pool, 'exam');
  assert.equal(paper.year, 2022);
  const marks = paper.questions.reduce((sum, q) => sum + q.marks, 0);
  assert.equal(marks, 150);
  assert.ok(paper.questions.every(q => q.prompt));
});

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

server.listen(0, async () => {
  base = `http://127.0.0.1:${server.address().port}`;
  const anon = client(), user = client();
  const http = async (name, fn) => {
    try { await fn(); results.push(['ok', name]); }
    catch (e) { results.push(['FAIL', name, e.message]); }
  };
  await http('quiz and exams require sign-in', async () => {
    assert.equal((await anon('POST', '/api/quiz', { mastered: capsIds, courseId: 'gr12-caps' })).status, 401);
    assert.equal((await anon('GET', '/api/exams')).status, 401);
  });
  await http('signed-in quiz refuses 2022 papers and exam route serves them', async () => {
    assert.equal((await user('POST', '/api/auth/register', { email: 'quiz@example.com', name: 'Quiz', password: 'long-password' })).status, 201);
    const built = await user('POST', '/api/quiz', { mastered: capsIds, courseId: 'gr12-caps', shuffle: false, choice: 0 });
    assert.equal(built.status, 200);
    assert.equal(built.json.ok, true);
    const papers = built.json.items.filter(item => item.kind === 'paper');
    assert.ok(papers.length >= 1);
    assert.ok(papers.every(item => item.year < 2022));
    const exams = await user('GET', '/api/exams');
    assert.equal(exams.status, 200);
    assert.ok(exams.json.exams.every(paper => paper.year >= 2022));
    assert.equal((await user('GET', '/api/exams/2016-nov-p1')).status, 404);
    const one = await user('GET', '/api/exams/2024-nov-p2');
    assert.equal(one.status, 200);
    assert.equal(one.json.exam.year, 2024);
    assert.equal(one.json.exam.questions.reduce((sum, q) => sum + q.marks, 0), 150);
  });
  await http('finishing an exam posts to its mark route and gets every part back', async () => {
    const marked = await user('POST', '/api/exams/2025-nov-p2/mark', { answers: { '2025-nov-p2-2.1.1': '70', '2025-nov-p2-2.1.2': '28', '2025-nov-p2-5.1.3': '1 - 2/(k^2+1)' } });
    assert.equal(marked.status, 200);
    const byId = Object.fromEntries(marked.json.results.map(item => [item.id, item]));
    assert.equal(byId['2025-nov-p2-2.1.1'].ok, true);
    assert.equal(byId['2025-nov-p2-2.1.2'].ok, false);
    assert.equal(byId['2025-nov-p2-5.1.3'].ok, true);
    assert.equal(byId['2025-nov-p2-6.1'].checkable, false);
    assert.ok(byId['2025-nov-p2-6.1'].answer);
    assert.equal((await user('POST', '/api/exams/2016-nov-p1/mark', { answers: {} })).status, 404);
  });
  const failed = results.filter(row => row[0] === 'FAIL');
  for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  server.close();
  process.exit(failed.length ? 1 : 0);
});
