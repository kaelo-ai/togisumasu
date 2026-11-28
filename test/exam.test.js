// Mock exam redesign: grouped papers, attempt persistence, timer expiry into review, results by topic.
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-exam-'));
process.env.QUESTION_SEED_PER_SKILL = '1';
const { mailbox, registerVerified } = require('./helpers.js');
const sent = mailbox();
const { server, db } = require('../server.js');
const quiz = require('../quiz.js');
const Exam = require('../public/exam.js');
const Mastery = require('../public/mastery.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const paper = quiz.examPaper(db, '2024-nov-p1');
const H = 3600e3, MIN = 60e3;

/* ---------- grouping ---------- */
t('a paper is grouped into its top-level questions with marks that add up', () => {
  assert.equal(paper.title, 'November 2024 · Paper 1');
  assert.deepEqual(paper.groups.map(g => g.number), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  assert.equal(paper.groups.reduce((s, g) => s + g.marks, 0), 150);
  assert.equal(paper.groups[0].marks, 27);
  assert.equal(paper.groups.reduce((s, g) => s + g.parts.length, 0), paper.questions.length);
  for (const g of paper.groups) {
    const parts = paper.questions.filter(q => q.group === g.number);
    assert.deepEqual(parts.map(q => q.id), g.parts, `Q${g.number} parts in paper order`);
    assert.equal(parts.reduce((s, q) => s + q.marks, 0), g.marks);
  }
});

t('every question has a CAPS topic heading from the taxonomy', () => {
  const q1 = paper.groups[0];
  assert.equal(q1.heading, 'Algebra · Exponents & surds');
  assert.equal(q1.topics[0].code, 'M2');
  assert.equal(q1.topics[0].name, 'Algebra');
  assert.ok(paper.groups.every(g => g.heading && g.heading !== 'Mixed'));
  assert.equal(paper.groups.find(g => g.number === '11').heading, 'Probability');
  assert.equal(paper.topicNames.M7.name, 'Differential calculus');
});

t('a shared stem and diagram appear once, not on every part', () => {
  const q6 = paper.groups.find(g => g.number === '6');
  assert.equal((q6.stem.match(/<svg/g) || []).length, 1, 'the Q6 graph is drawn in the stem');
  for (const id of q6.parts) assert.ok(!/<svg/.test(paper.questions.find(q => q.id === id).html), id + ' repeats the figure');
  const q1 = paper.groups[0];
  const stems = q1.blocks.filter(b => b.kind === 'stem');
  assert.equal(stems.length, 1);
  assert.equal(stems[0].number, '1.1');
  assert.match(stems[0].html, /Solve for/);
  const solves = q1.parts.filter(id => /-1\.1\.\d$/.test(id) && /Solve for/.test(paper.questions.find(q => q.id === id).html));
  assert.equal(solves.length, 0, 'the 1.1 stem is not copied into 1.1.1 to 1.1.5');
  const first = paper.questions.find(q => q.id === '2024-nov-p1-1.1.1');
  assert.equal(first.depth, 2);
  assert.match(first.html, /x\(x-3\)=0/);
});

t('the picker lists proper titles and a topic line per paper', () => {
  const list = quiz.listExams(db);
  assert.equal(list.length, 8);
  const p1 = list.find(p => p.id === '2024-nov-p1'), p2 = list.find(p => p.id === '2024-nov-p2');
  assert.equal(p1.title, 'November 2024 · Paper 1');
  assert.equal(p2.title, 'November 2024 · Paper 2');
  assert.equal(p1.questionCount, 12);
  assert.ok(p1.topics.includes('Calculus') && p1.topics.includes('Probability'));
  assert.ok(p2.topics.includes('Euclidean geometry') && p2.topics.includes('Statistics'));
  assert.ok(!p1.topics.includes('Euclidean geometry'));
});

/* ---------- attempt state ---------- */
t('answers, flags and remaining time survive a save and reload of the progress document', () => {
  const t0 = 1_000_000;
  let a = Exam.newAttempt(paper, t0);
  assert.equal(Exam.remainingMs(a, t0), 3 * H);
  a = Exam.setAnswer(a, '2024-nov-p1-1.1.1', '0; 3');
  a = Exam.toggleFlag(a, '2024-nov-p1-1.1.2');
  a = Exam.pause(a, t0 + 40 * MIN);
  let progress = Exam.saveCurrent(Mastery.emptyProgress(), paper.id, a);
  progress = Mastery.addXp(progress, 3, t0);                 // other progress writes keep the attempt
  const reloaded = JSON.parse(JSON.stringify(progress));
  const back = Exam.recover(Exam.current(reloaded, paper.id));
  assert.equal(back.answers['2024-nov-p1-1.1.1'], '0; 3');
  assert.equal(back.flags['2024-nov-p1-1.1.2'], 1);
  assert.equal(Exam.remainingMs(back, t0 + 5 * H), 3 * H - 40 * MIN, 'the clock does not run while paused');
  const resumed = Exam.resume(back, t0 + 5 * H);
  assert.equal(Exam.remainingMs(resumed, t0 + 5 * H + 10 * MIN), 3 * H - 50 * MIN);
});

t('a tab that closed without pausing banks time only up to its last heartbeat', () => {
  const t0 = 2_000_000;
  let a = Exam.newAttempt(paper, t0);
  a = Exam.heartbeat(a, t0 + 20 * MIN);
  const back = Exam.recover(JSON.parse(JSON.stringify(a)));
  assert.equal(back.resumedAt, null);
  assert.equal(back.elapsedMs, 20 * MIN);
});

t('blank answers do not count as answered, and clearing an answer removes it', () => {
  let a = Exam.newAttempt(paper, 0);
  a = Exam.setAnswer(a, '2024-nov-p1-1.2', '   ');
  assert.equal(Exam.counts(paper, a).answered, 0);
  a = Exam.setAnswer(a, '2024-nov-p1-1.2', 'x = 1');
  a = Exam.setAnswer(a, '2024-nov-p1-1.3', 'x');
  assert.equal(Exam.groupProgress(paper.groups[0], a).answered, 2);
  a = Exam.setAnswer(a, '2024-nov-p1-1.3', '');
  assert.equal(Exam.counts(paper, a).answered, 1);
  assert.ok(!('2024-nov-p1-1.3' in a.answers));
});

t('the timer turns amber at 30 minutes and red at 10', () => {
  assert.equal(Exam.phase(31 * MIN), 'calm');
  assert.equal(Exam.phase(30 * MIN), 'warn');
  assert.equal(Exam.phase(10 * MIN + 1), 'warn');
  assert.equal(Exam.phase(10 * MIN), 'danger');
  assert.equal(Exam.phase(0), 'over');
  assert.equal(Exam.formatClock(3 * H), '3:00:00');
  assert.equal(Exam.formatClock(9 * MIN + 59e3), '9:59');
});

t('time running out saves the answers, locks them and opens review', () => {
  const t0 = 3_000_000;
  let a = Exam.newAttempt(paper, t0);
  a = Exam.setAnswer(a, '2024-nov-p1-1.1.1', '0; 3');
  assert.equal(Exam.tick(a, t0 + 3 * H - 1).status, 'active');
  const over = Exam.tick(a, t0 + 3 * H + 5000);
  assert.equal(over.status, 'review');
  assert.equal(over.timeUp, true);
  assert.equal(Exam.remainingMs(over, t0 + 4 * H), 0);
  assert.equal(over.answers['2024-nov-p1-1.1.1'], '0; 3');
  assert.ok(Exam.locked(over));
  assert.equal(Exam.setAnswer(over, '2024-nov-p1-1.1.2', '1').answers['2024-nov-p1-1.1.2'], undefined);
  assert.equal(Exam.backToPaper(over, t0 + 4 * H).status, 'review', 'no going back after time is up');
  // A paused attempt reopened after its time is used goes straight to review too.
  const paused = Exam.pause(Exam.newAttempt(paper, 0), 3 * H);
  assert.equal(Exam.remainingMs(paused, 9 * H), 0);
});

t('review lists blank parts first, then flagged ones', () => {
  let a = Exam.newAttempt(paper, 0);
  for (const q of paper.questions.slice(0, 40)) a = Exam.setAnswer(a, q.id, '1');
  a = Exam.toggleFlag(a, paper.questions[5].id);
  a = Exam.toggleFlag(a, paper.questions[45].id); // blank and flagged stays with the blanks
  const r = Exam.reviewList(paper, a);
  assert.equal(r.unanswered.length, paper.questions.length - 40);
  assert.deepEqual(r.flagged.map(x => x.id), [paper.questions[5].id]);
  assert.equal(r.ordered[0].id, paper.questions[40].id);
  assert.equal(r.ordered[r.unanswered.length].id, paper.questions[5].id);
  assert.ok(r.unanswered.find(x => x.id === paper.questions[45].id).flagged);
  const reviewing = Exam.toReview(a, 1000);
  assert.equal(reviewing.status, 'review');
  assert.equal(Exam.backToPaper(reviewing, 2000).status, 'active');
});

t('results add up by question and by topic, keeping memo-checked marks apart', () => {
  const marked = paper.questions.map((q, i) => ({ id: q.id, checkable: i % 5 !== 4, ok: i % 2 === 0 }));
  const r = Exam.results(paper, marked);
  assert.equal(r.total.marks, 150);
  assert.equal(r.total.auto + r.total.review, 150);
  const expEarned = paper.questions.reduce((s, q, i) => s + (i % 5 !== 4 && i % 2 === 0 ? q.marks : 0), 0);
  assert.equal(r.total.earned, expEarned);
  assert.equal(r.byQuestion.length, 12);
  assert.equal(r.byQuestion.reduce((s, q) => s + q.earned, 0), expEarned);
  assert.equal(r.byTopic.reduce((s, x) => s + x.marks, 0), 150);
  const calc = r.byTopic.find(x => x.code === 'M7');
  const calcMarks = paper.questions.filter(q => q.topic === 'M7').reduce((s, q) => s + q.marks, 0);
  assert.equal(calc.marks, calcMarks);
  assert.equal(calc.name, 'Differential calculus');
  assert.equal(calc.short, 'Calculus');
  assert.ok(r.byTopic[0].marks >= r.byTopic[r.byTopic.length - 1].marks, 'heaviest topic first');
});

t('a finished attempt is recorded for the picker and the next attempt starts clean', () => {
  let progress = Mastery.emptyProgress();
  let a = Exam.setAnswer(Exam.newAttempt(paper, 0), '2024-nov-p1-1.2', 'x');
  progress = Exam.saveCurrent(progress, paper.id, a);
  const done = Exam.finish(a, [{ id: '2024-nov-p1-1.2', checkable: true, ok: true }], { earned: 5, auto: 100, review: 50, marks: 150 }, 5000);
  progress = Exam.recordFinished(progress, paper.id, done);
  assert.equal(Exam.current(progress, paper.id), null);
  assert.equal(Exam.slot(progress, paper.id).last.status, 'done');
  assert.deepEqual(Exam.lastSummary(progress, paper.id), { at: 5000, earned: 5, auto: 100, review: 50, marks: 150, timeUp: false });
  assert.equal(Exam.current(progress, '2024-nov-p2'), null);
});

/* ---------- over HTTP ---------- */
function client(base) {
  let cookie = '';
  return async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
    let json = null; try { json = await r.json(); } catch (e) { /* empty */ }
    return { status: r.status, json };
  };
}

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const user = client(base);
  const http = async (name, fn) => {
    try { await fn(); results.push(['ok', name]); }
    catch (e) { results.push(['FAIL', name, e.message]); }
  };
  await http('an attempt in progress is stored on the server with the progress document', async () => {
    assert.equal((await registerVerified(user, { email: 'exam@example.com', name: 'Exam', password: 'long-password' }, sent)).status, 200);
    const exam = (await user('GET', '/api/exams/2024-nov-p1')).json.exam;
    assert.equal(exam.groups.length, 12);
    assert.ok(exam.questions.every(q => q.group && q.html !== undefined && q.prompt === undefined));
    let a = Exam.setAnswer(Exam.newAttempt(exam, 10), '2024-nov-p1-1.1.1', '0; 3');
    a = Exam.pause(Exam.toggleFlag(a, '2024-nov-p1-6.2'), 10 + 25 * MIN);
    const data = Exam.saveCurrent({ ...Mastery.emptyProgress(), t: 99 }, exam.id, a);
    assert.equal((await user('PUT', '/api/progress', { data })).status, 200);
    const got = (await user('GET', '/api/progress')).json.data;
    const back = Exam.current(got, exam.id);
    assert.equal(back.answers['2024-nov-p1-1.1.1'], '0; 3');
    assert.equal(back.flags['2024-nov-p1-6.2'], 1);
    assert.equal(Exam.remainingMs(back, Date.now()), 3 * H - 25 * MIN);
  });
  await http('marking returns every part, and results group them by question and topic', async () => {
    const exam = (await user('GET', '/api/exams/2025-nov-p2')).json.exam;
    const marked = await user('POST', '/api/exams/2025-nov-p2/mark', { answers: { '2025-nov-p2-2.1.1': '70', '2025-nov-p2-2.1.2': '28' } });
    assert.equal(marked.status, 200);
    assert.equal(marked.json.results.length, exam.questions.length);
    const r = Exam.results(exam, marked.json.results);
    assert.equal(r.total.marks, 150);
    const q2 = r.byQuestion.find(q => q.number === '2');
    assert.ok(q2.earned >= exam.questions.find(q => q.id === '2025-nov-p2-2.1.1').marks);
    assert.ok(r.byTopic.some(x => x.code === 'M13' && x.earned > 0));
  });
  const failed = results.filter(row => row[0] === 'FAIL');
  for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  server.close();
  process.exit(failed.length ? 1 : 0);
});
