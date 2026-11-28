// Bookshelf, finish-date estimate and daily goal: node test/shelf.test.js  (uses a throwaway data directory)
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-shelf-'));
const Mastery = require('../public/mastery.js');
const Pace = require('../public/pace.js');
const ShelfLayout = require('../public/shelf-layout.js');

const results = [];
async function t(name, fn) { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }
const DAY = 864e5;
const NOW = new Date(2026, 10, 28, 12, 0, 0).getTime();       // Sat 28 Nov 2026, midday local
const dk = t => Mastery.dayKey(t);
const logOf = entries => Object.fromEntries(entries.map(([daysAgo, xp]) => [dk(NOW - daysAgo * DAY), xp]));
const mastered = (extra) => ({ a: 4, c: 4, s: 2, lv: 2, due: NOW + 3 * DAY, ...(extra || {}) });

// Two courses sharing topic b; course B also asks for x before b (cross-course prerequisites, PR #24).
const A = { topics: [{ id: 'a', pre: [] }, { id: 'b', pre: ['a'] }, { id: 'c', pre: ['b'] }, { id: 'd', pre: ['c'] }] };
const B = { topics: [{ id: 'x', pre: [] }, { id: 'a', pre: [] }, { id: 'b', pre: ['a', 'x'] }] };

(async () => {
  /* ---------- remaining XP ---------- */
  await t('remaining XP is unmastered x11 + repair x6 + due x2', () => {
    const p = { ...Mastery.emptyProgress(), skills: { a: mastered({ due: NOW - DAY }), b: { a: 3, c: 1, lv: 1, fix: 1, due: NOW }, c: { a: 2, c: 1 } } };
    const r = Pace.remaining(p, A, NOW);
    assert.equal(r.mastered, 1); assert.equal(r.due, 1); assert.equal(r.repair, 1); assert.equal(r.unmastered, 2);
    assert.equal(r.xp, 2 * 11 + 1 * 6 + 1 * 2);
  });
  await t('remaining XP is per course: a topic held by a missing prerequisite costs nothing itself', () => {
    const p = { ...Mastery.emptyProgress(), skills: { a: mastered(), b: mastered() } };
    const inA = Pace.remaining(p, A, NOW), inB = Pace.remaining(p, B, NOW);
    assert.equal(inA.mastered, 2); assert.equal(inA.xp, 2 * 11);
    assert.equal(inB.mastered, 1, 'b is held in B until x is mastered');
    assert.equal(inB.held, 1); assert.equal(inB.unmastered, 1); assert.equal(inB.xp, 11, 'only x is left to learn');
    const later = { ...p, skills: { ...p.skills, x: mastered() } };
    assert.equal(Pace.remaining(later, B, NOW).xp, 0);
    assert.equal(Pace.estimate(later, B, { now: NOW }).done, true);
  });
  await t('the Courses page table of contents works as a catalogue', () => {
    const toc = { units: [{ id: 'u1', topics: [{ id: 'a', name: 'A', pre: [] }, { id: 'b', name: 'B', pre: ['a'] }] }] };
    const p = { ...Mastery.emptyProgress(), skills: { a: mastered() } };
    const r = Pace.remaining(p, toc, NOW);
    assert.equal(r.total, 2); assert.equal(r.mastered, 1); assert.equal(r.xp, 11);
  });

  /* ---------- pace ---------- */
  await t('pace falls back to the daily goal until there are 3 active days', () => {
    assert.deepEqual([Pace.pace({}, 30, NOW).source, Pace.pace({}, 30, NOW).xpPerDay], ['goal', 30]);
    const two = Pace.pace(logOf([[0, 50], [1, 50]]), 45, NOW);
    assert.equal(two.source, 'goal'); assert.equal(two.xpPerDay, 45); assert.equal(two.activeDays, 2);
  });
  await t('pace is the 14-day average once there are 3 active days, ignoring older days', () => {
    const log = logOf([[0, 20], [3, 30], [6, 40], [10, 10], [13, 40], [14, 999], [30, 999]]);
    const p = Pace.pace(log, 30, NOW);
    assert.equal(p.source, 'log'); assert.equal(p.span, 14); assert.equal(p.activeDays, 5);
    assert.equal(p.xpPerDay, (20 + 30 + 40 + 10 + 40) / 14);
  });
  await t('a learner with under 14 days of history is averaged over the last 7 calendar days', () => {
    const p = Pace.pace(logOf([[0, 30], [1, 30], [4, 30]]), 30, NOW);
    assert.equal(p.span, 7); assert.equal(p.historyDays, 5); assert.equal(p.activeDays, 3);
    assert.equal(p.source, 'log'); assert.equal(p.xpPerDay, 90 / 7);
  });
  await t('the 7-day window still needs 3 active days, even if earlier days exist', () => {
    const p = Pace.pace(logOf([[0, 50], [1, 50], [8, 50]]), 30, NOW);
    assert.equal(p.historyDays, 9); assert.equal(p.span, 7); assert.equal(p.activeDays, 2);
    assert.equal(p.source, 'goal'); assert.equal(p.xpPerDay, 30);
  });
  await t('14 days of history uses the 14-day window, 13 days still uses 7', () => {
    const at13 = Pace.pace(logOf([[0, 20], [3, 20], [6, 20], [12, 20]]), 30, NOW);
    assert.equal(at13.historyDays, 13); assert.equal(at13.span, 7);
    assert.equal(at13.source, 'log'); assert.equal(at13.xpPerDay, (20 + 20 + 20) / 7);
    const at14 = Pace.pace(logOf([[0, 20], [3, 20], [6, 20], [13, 20]]), 30, NOW);
    assert.equal(at14.historyDays, 14); assert.equal(at14.span, 14);
    assert.equal(at14.source, 'log'); assert.equal(at14.xpPerDay, (20 + 20 + 20 + 20) / 14);
  });

  /* ---------- dates ---------- */
  await t('dates read as part of a month until there is a week of history, then as a day', () => {
    const p = { ...Mastery.emptyProgress(), log: logOf([[0, 30], [1, 30], [2, 30]]) };
    const e = Pace.estimate(p, { topics: Array.from({ length: 60 }, (_, i) => ({ id: 't' + i, pre: [] })) }, { now: NOW, goal: 30 });
    assert.equal(e.remainingXp, 660); assert.equal(e.goalDays, 22); assert.equal(e.precise, false);
    assert.equal(e.goalText, 'mid-December');                         // 28 Nov + 22 days = 20 Dec
    assert.equal(e.pace.source, 'log'); assert.equal(e.paceText, 'mid-January 2027');  // 90/7 XP a day, 52 days → 19 Jan
    const week = { ...p, log: logOf([[0, 30], [1, 30], [2, 30], [7, 30]]) };
    const w = Pace.estimate(week, { topics: Array.from({ length: 60 }, (_, i) => ({ id: 't' + i, pre: [] })) }, { now: NOW, goal: 30 });
    assert.equal(w.precise, true); assert.equal(w.goalText, '20 December');
    assert.equal(Pace.phrase(new Date(2027, 0, 3).getTime(), false, NOW), 'early January 2027');
    assert.equal(Pace.phrase(new Date(2027, 0, 25).getTime(), false, NOW), 'late January 2027');
    assert.equal(Pace.phrase(new Date(2027, 0, 14).getTime(), true, NOW), '14 January 2027');
  });
  await t('both dates come out: the goal pace and the actual pace', () => {
    const cat = { topics: Array.from({ length: 30 }, (_, i) => ({ id: 't' + i, pre: [] })) };
    const p = { ...Mastery.emptyProgress(), goal: 45, log: logOf([[0, 15], [1, 15], [2, 15], [3, 15], [4, 15], [5, 15], [6, 15], [7, 15], [8, 15], [9, 15], [10, 15], [11, 15], [12, 15], [13, 15]]) };
    const e = Pace.estimate(p, cat, { now: NOW });
    assert.equal(e.goal, 45); assert.equal(e.goalDays, Math.ceil(330 / 45)); assert.equal(e.paceDays, 22);
    assert.ok(e.paceAt > e.goalAt);
  });

  /* ---------- once a day ---------- */
  await t('the estimate is recomputed once a day per course and goal', () => {
    const cache = new Map(); let runs = 0;
    const calc = v => () => { runs++; return { v }; };
    assert.deepEqual(Pace.daily(cache, 'u:gr12:30', NOW, calc(1)), { v: 1 });
    assert.deepEqual(Pace.daily(cache, 'u:gr12:30', NOW + 3 * 3600e3, calc(2)), { v: 1 }, 'same day: kept');
    assert.equal(runs, 1);
    assert.deepEqual(Pace.daily(cache, 'u:algebra:30', NOW, calc(3)), { v: 3 }, 'another course has its own');
    assert.deepEqual(Pace.daily(cache, 'u:gr12:45', NOW, calc(4)), { v: 4 }, 'a new goal shows at once');
    assert.deepEqual(Pace.daily(cache, 'u:gr12:30', NOW + DAY, calc(5)), { v: 5 }, 'next day: recomputed');
    assert.equal(runs, 4);
    const strings = { m: {}, get(k) { return this.m[k]; }, set(k, v) { this.m[k] = v; } };
    Pace.daily(strings, 'k', NOW, calc(6));
    assert.equal(typeof strings.m.k, 'string', 'a string store (localStorage) gets JSON');
    assert.deepEqual(Pace.daily(strings, 'k', NOW, calc(7)), { v: 6 });
  });

  /* ---------- squares ---------- */
  await t('topic squares: mastered, started, next, held', () => {
    const p = { ...Mastery.emptyProgress(), skills: { a: mastered(), b: mastered(), x: { a: 2, c: 1 } } };
    const s = Object.fromEntries(Pace.topicStates(p, B).map(x => [x.id, x]));
    assert.equal(s.a.state, 'mastered'); assert.equal(s.b.state, 'held'); assert.equal(s.x.state, 'partial'); assert.equal(s.x.next, true);
    const forced = Object.fromEntries(Pace.topicStates({ ...Mastery.emptyProgress(), skills: { a: mastered() } }, A, 'b').map(x => [x.id, x]));
    assert.equal(forced.b.next, true); assert.ok(!forced.c.next);
  });

  /* ---------- daily goal ---------- */
  await t('the daily goal is one of 20/30/45/60 and defaults to 30', () => {
    assert.deepEqual(Mastery.DAILY.goalPresets, [20, 30, 45, 60]);
    assert.equal(Mastery.goalOf(Mastery.emptyProgress()), 30);
    assert.equal(Mastery.goalOf({ goal: 25 }), 30);
    assert.equal(Mastery.goalOf({ goal: '45' }), 45);
    assert.equal(Mastery.setGoal(Mastery.emptyProgress(), 60).goal, 60);
    assert.throws(() => Mastery.setGoal(Mastery.emptyProgress(), 25));
  });
  await t('answering keeps the goal on the progress document', () => {
    const p = Mastery.setGoal(Mastery.emptyProgress(), 45);
    const out = Mastery.applyAnswer(p, { id: 'a', ok: true, mode: 'new', now: NOW }, A);
    assert.equal(out.progress.goal, 45);
    assert.equal(Mastery.goalOf(out.progress), 45);
  });
  await t('the app reads the goal from the progress document, not a constant', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    assert.ok(!/\bGOAL\b/.test(html.replace(/<style[\s\S]*?<\/style>/g, '')), 'no hardcoded GOAL left in the app');
    assert.match(html, /Mastery\.goalOf\(Store\.data\)/);
    assert.match(html, /name="goal" value="20"[\s\S]*value="30"[\s\S]*value="45"[\s\S]*value="60"/);
  });

  /* ---------- shelf layout ---------- */
  const books = (n, w, groups) => Array.from({ length: n }, (_, i) => ({ id: 'b' + i, w: typeof w === 'function' ? w(i) : w, h: 200 + (i % 3) * 10, group: groups ? groups(i) : 'maths' }));
  await t('the shelf wraps onto more planks when the books do not fit', () => {
    const bs = books(12, i => 44 + (i % 4) * 5, i => (i < 6 ? 'maths' : i < 9 ? 'stats' : 'physics'));
    const wide = ShelfLayout.layout(bs, 1000), narrow = ShelfLayout.layout(bs, 390);
    assert.equal(wide.rows, 1); assert.ok(narrow.rows >= 2, 'a phone needs at least two planks');
    for (const L of [wide, narrow]) for (const b of bs) {
      const p = L.pos[b.id]; assert.ok(p, b.id + ' placed');
      assert.ok(p.x >= ShelfLayout.DEF.pad && p.x + b.w <= L.width - ShelfLayout.DEF.pad + 0.01, b.id + ' inside the case');
      assert.equal(p.y + b.h, p.row * L.pitch + ShelfLayout.DEF.area, b.id + ' stands on its plank');
    }
    assert.equal(narrow.planks.length, narrow.rows);
  });
  await t('books on a plank never overlap, runs of a subject stand apart and keep their order', () => {
    const bs = books(20, 50, i => ['maths', 'stats', 'physics'][Math.floor(i / 7)]);
    const L = ShelfLayout.layout(bs, 640);
    for (let i = 1; i < bs.length; i++) {
      const a = L.pos[bs[i - 1].id], b = L.pos[bs[i].id];
      if (a.row !== b.row) { assert.ok(b.row === a.row + 1, 'order is kept across planks'); continue; }
      const gap = b.x - (a.x + 50);
      assert.ok(gap >= ShelfLayout.DEF.gap, 'no overlap');
      if (bs[i].group !== bs[i - 1].group) assert.ok(gap >= ShelfLayout.DEF.groupGap, 'runs stand apart');
    }
  });
  await t('labels sit under their run and never touch on one plank', () => {
    const bs = books(9, 34, i => ['maths', 'stats', 'physics', 'science', 'maths', 'stats', 'physics', 'science', 'maths'][i]);
    const L = ShelfLayout.layout(bs.map(b => ({ ...b, label: { maths: 'Mathematics', stats: 'Statistics', physics: 'Physics', science: 'Science' }[b.group] })), 700);
    assert.equal(L.labels.length, 9);
    const byRow = {};
    for (const l of L.labels) (byRow[l.row] = byRow[l.row] || []).push(l);
    for (const ls of Object.values(byRow)) for (let i = 1; i < ls.length; i++) assert.ok(ls[i].x >= ls[i - 1].x + ls[i - 1].w, 'labels do not overlap');
    for (const l of L.labels) assert.ok(l.x >= 0 && l.x + l.w <= L.width, 'label inside the case');
  });
  await t('every level of the real catalogue lays out cleanly from phone to desktop widths', () => {
    const Library = require('../public/course-catalog.js');
    for (const shelf of Library.SHELVES) {
      const bs = shelf.books.map((b, i) => ({ id: b.id, w: 40 + (i * 7) % 24, h: 190 + (i * 13) % 45, group: b.subject, label: Library.SUBJECTS[b.subject] }));
      for (let width = 320; width <= 1200; width += 23) {
        const L = ShelfLayout.layout(bs, width);
        assert.equal(Object.keys(L.pos).length, bs.length, shelf.id + ' every book placed at ' + width);
        for (const b of bs) assert.ok(L.pos[b.id].x + b.w <= L.width - ShelfLayout.DEF.pad + 0.01, shelf.id + ' ' + b.id + ' fits at ' + width);
        const byRow = {};
        for (const l of L.labels) (byRow[l.row] = byRow[l.row] || []).push(l);
        for (const ls of Object.values(byRow)) for (let i = 1; i < ls.length; i++) assert.ok(ls[i].x >= ls[i - 1].x + ls[i - 1].w, shelf.id + ' labels clear at ' + width);
      }
    }
  });
  await t('the layout is deterministic and an empty shelf has no planks', () => {
    const bs = books(10, 52);
    assert.deepEqual(ShelfLayout.layout(bs, 500), ShelfLayout.layout(bs, 500));
    const none = ShelfLayout.layout([], 500);
    assert.equal(none.rows, 0); assert.equal(none.height, 0); assert.deepEqual(none.planks, []);
  });

  /* ---------- server: the goal persists, the contents carry prerequisites ---------- */
  const { mailbox, registerVerified } = require('./helpers.js');
  const sent = mailbox();
  const { server } = require('../server.js');
  await new Promise(res => server.listen(0, res));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const req = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  await registerVerified(req, { email: 'goal@example.com', name: 'Goal', password: 'goal-pass-123' }, sent);
  await t('the daily goal is saved with progress and comes back after a reload', async () => {
    const data = Mastery.setGoal({ ...Mastery.emptyProgress(), t: Date.now() }, 45);
    const put = await req('PUT', '/api/progress', { data });
    assert.equal(put.status, 200);
    const got = await req('GET', '/api/progress');
    assert.equal(got.status, 200);
    assert.equal(got.json.data.goal, 45);
    assert.equal(Mastery.goalOf(got.json.data), 45);
  });
  await t('the Courses contents list each topic with its prerequisites', async () => {
    const r = await req('GET', '/api/courses?toc=1');
    assert.equal(r.status, 200);
    const caps = r.json.courses.find(c => c.id === 'gr12-caps');
    const topics = caps.units.flatMap(u => u.topics);
    assert.ok(topics.every(x => Array.isArray(x.pre)), 'every topic has a pre array');
    assert.ok(topics.some(x => x.pre.length), 'some topics have prerequisites');
    const e = Pace.estimate(Mastery.emptyProgress(), caps, { now: NOW });
    assert.equal(e.remainingXp, topics.length * 11);
  });
  server.close();

  for (const [s, n, m] of results) console.log(`${s === 'ok' ? 'ok  ' : 'FAIL'} ${n}${m ? ' :: ' + m : ''}`);
  const failed = results.filter(r => r[0] !== 'ok').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
