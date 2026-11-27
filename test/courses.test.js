// Courses page tests: node test/courses.test.js  (uses a throwaway data directory)
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-courses-'));
const { mailbox, registerVerified } = require('./helpers.js');
const sent = mailbox();
const { server, db } = require('../server.js');
const catalog = require('../catalog.js');
const Library = require('../public/course-catalog.js');

const results = [];
async function t(name, fn) { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const req = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };

  await t('courses need a session', async () => assert.equal((await req('GET', '/api/courses?toc=1')).status, 401));
  await registerVerified(req, { email: 'shelf@example.com', name: 'Shelf', password: 'shelf-pass-123' }, sent);

  await t('plain /api/courses stays a flat list', async () => {
    const r = await req('GET', '/api/courses');
    assert.equal(r.status, 200);
    assert.ok(r.json.courses.length >= 2);
    assert.equal(r.json.courses[0].units, undefined);
  });

  await t('toc=1 lists units and topics for every active course', async () => {
    const r = await req('GET', '/api/courses?toc=1');
    assert.equal(r.status, 200);
    const caps = r.json.courses.find(c => c.id === 'gr12-caps');
    assert.ok(caps, 'CAPS course present');
    assert.equal(caps.units[0].id, 'c0', 'Unit 0 foundations comes first');
    const count = caps.units.reduce((n, u) => n + u.topics.length, 0);
    assert.equal(count, caps.topicCount);
    assert.ok(caps.units.every(u => u.topics.length > 0), 'no empty chapters');
    const topic = caps.units[0].topics[0];
    assert.deepEqual(Object.keys(topic).sort(), ['core', 'id', 'name'], 'topics only, no knowledge points');
  });

  await t('toc matches what the learner sees in each course', async () => {
    for (const c of catalog.tocs(db)) {
      const view = catalog.learner(db, c.id);
      assert.equal(c.topicCount, view.topics.length, c.id);
      assert.deepEqual(c.units.map(u => u.id), view.units.map(u => u.id), c.id);
    }
  });

  await t('every live book on the shelf is a real course, and every real course has a book', async () => {
    const live = Library.allBooks().filter(b => b.live).map(b => b.id).sort();
    const real = catalog.courses(db).map(c => c.id).sort();
    assert.deepEqual(live, real);
  });

  await t('library catalogue is de-duplicated and shelf-sized', async () => {
    const books = Library.allBooks();
    assert.equal(new Set(books.map(b => b.id)).size, books.length, 'unique ids');
    assert.equal(new Set(books.map(b => b.title.toLowerCase())).size, books.length, 'unique titles');
    for (const s of Library.SHELVES) assert.ok(s.books.length >= 1 && s.books.length <= 12, `${s.id} has ${s.books.length} books`);
    for (const b of books) {
      assert.ok(Library.SUBJECTS[b.subject], `${b.id} subject`);
      for (const src of b.sources) assert.ok(Library.SOURCES[src], `${b.id} source ${src}`);
      if (!b.live) {
        assert.ok(b.toc.length >= 5 && b.toc.length <= 12, `${b.id} toc length`);
        if (b.shelf !== 'school') assert.ok(b.sources.length >= 2, `${b.id} draws on at least two universities`);
      }
    }
  });

  server.close();
  for (const r of results) console.log(r[0] === 'ok' ? '  ok  ' : '  FAIL', r[1], r[2] || '');
  const failed = results.filter(r => r[0] !== 'ok').length;
  console.log(failed ? `\n${failed} failed` : `\nall ${results.length} course tests passed`);
  process.exit(failed ? 1 : 0);
});
