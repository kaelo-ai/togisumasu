// API tests: node test/api.test.js  (uses a throwaway data directory)
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-test-'));
const { server, db } = require('../server.js');

let base;
function client() {
  let cookie = '';
  return async (method, url, body, extra = {}) => {
    const r = await fetch(base + url, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = /Max-Age=0/.test(sc) ? '' : sc.split(';')[0];
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json, setCookie: sc };
  };
}
const results = [];
async function t(name, fn) { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }

server.listen(0, async () => {
  base = `http://127.0.0.1:${server.address().port}`;
  const anon = client(), a = client(), b = client();
  const progA = { t: 1, skills: { 'lin-eq': { streak: 3, mastered: true } } };
  const progB = { t: 2, skills: { 'radians': { streak: 1 } } };

  await t('health', async () => assert.equal((await anon('GET', '/api/health')).status, 200));
  await t('config says registration open', async () => assert.equal((await anon('GET', '/api/auth/config')).json.registration, true));
  await t('unauthenticated /me is 401', async () => assert.equal((await anon('GET', '/api/auth/me')).status, 401));
  await t('unauthenticated progress is 401', async () => assert.equal((await anon('GET', '/api/progress')).status, 401));
  await t('short password rejected', async () => assert.equal((await anon('POST', '/api/auth/register', { email: 'x@y.co', name: 'X', password: 'short' })).status, 400));
  await t('bad email rejected', async () => assert.equal((await anon('POST', '/api/auth/register', { email: 'nope', name: 'X', password: 'longenough1' })).status, 400));
  await t('register A sets HttpOnly cookie', async () => {
    const r = await a('POST', '/api/auth/register', { email: 'alice@example.com', name: 'Alice', password: 'alice-pass-123' });
    assert.equal(r.status, 201); assert.match(r.setCookie, /HttpOnly/); assert.match(r.setCookie, /SameSite=Lax/);
  });
  await t('duplicate email (any case) is 409', async () => assert.equal((await anon('POST', '/api/auth/register', { email: 'ALICE@example.com', name: 'A2', password: 'whatever123' })).status, 409));
  await t('register B', async () => assert.equal((await b('POST', '/api/auth/register', { email: 'bob@example.com', name: 'Bob', password: 'bob-pass-123' })).status, 201));
  await t('/me returns own user', async () => assert.equal((await a('GET', '/api/auth/me')).json.user.email, 'alice@example.com'));
  await t('new account has empty progress', async () => assert.equal((await a('GET', '/api/progress')).json.data, null));
  await t('question bank is seeded in SQLite', async () => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
    const skill = db.prepare('SELECT COUNT(*) AS n FROM questions WHERE skill_id = ?').get('exp-int').n;
    assert.ok(n >= 100, `expected the bank to be seeded, got ${n}`); assert.ok(skill >= 8);
  });
  await t('questions require sign-in', async () => assert.equal((await anon('GET', '/api/questions/next?skill=exp-int')).status, 401));
  let q1;
  await t('next question comes from the bank', async () => {
    const r = await a('GET', '/api/questions/next?skill=exp-int');
    assert.equal(r.status, 200);
    q1 = r.json.question;
    assert.ok(q1.id > 0); assert.equal(q1.skillId, 'exp-int'); assert.ok(q1.prompt); assert.ok(q1.fingerprint); assert.ok(Array.isArray(q1.steps));
  });
  await t('a question can be fetched by id', async () => {
    const r = await a('GET', `/api/questions/${q1.id}`);
    assert.equal(r.status, 200); assert.equal(r.json.question.id, q1.id); assert.equal(r.json.question.prompt, q1.prompt);
  });
  await t('question by id requires sign-in', async () => assert.equal((await anon('GET', `/api/questions/${q1.id}`)).status, 401));
  await t('unknown topic is 404', async () => assert.equal((await a('GET', '/api/questions/next?skill=nope')).status, 404));
  await t('excluded fingerprint returns a different question', async () => {
    const r = await a('GET', '/api/questions/next?skill=exp-int&exclude=' + encodeURIComponent(q1.fingerprint));
    assert.equal(r.status, 200); assert.notEqual(r.json.question.fingerprint, q1.fingerprint);
  });
  await t('similar questions are findable', async () => {
    const r = await a('GET', `/api/questions/${q1.id}/similar`);
    assert.equal(r.status, 200); assert.ok(r.json.items.length >= 1);
    assert.ok(r.json.items.every(x => x.id !== q1.id));
  });
  await t('question search responds', async () => {
    const r = await a('GET', '/api/questions/search?q=exponent');
    assert.equal(r.status, 200); assert.ok(Array.isArray(r.json.items));
  });
  await t('A saves progress', async () => assert.equal((await a('PUT', '/api/progress', { data: progA })).status, 200));
  await t('B saves progress', async () => assert.equal((await b('PUT', '/api/progress', { data: progB })).status, 200));
  await t('A sees only A', async () => assert.deepEqual((await a('GET', '/api/progress')).json.data, progA));
  await t('B sees only B', async () => assert.deepEqual((await b('GET', '/api/progress')).json.data, progB));
  await t('invalid progress shape rejected', async () => assert.equal((await a('PUT', '/api/progress', { data: { nope: 1 } })).status, 400));
  await t('non-JSON body rejected', async () => assert.ok((await a('PUT', '/api/progress', 'data=1', { 'Content-Type': 'text/plain' })).status >= 400));
  await t('forged cookie is 401', async () => assert.equal((await anon('GET', '/api/progress', undefined, { Cookie: 'sid=forged' })).status, 401));
  await t('wrong password is 401', async () => assert.equal((await anon('POST', '/api/auth/login', { email: 'alice@example.com', password: 'wrong-password' })).status, 401));
  await t('unknown email is 401 (same message)', async () => {
    const r1 = await anon('POST', '/api/auth/login', { email: 'ghost@example.com', password: 'whatever123' });
    const r2 = await anon('POST', '/api/auth/login', { email: 'alice@example.com', password: 'wrong-password' });
    assert.equal(r1.status, 401); assert.equal(r1.json.error, r2.json.error);
  });
  await t('A logs out, then is 401', async () => {
    assert.equal((await a('POST', '/api/auth/logout', {})).status, 200);
    assert.equal((await a('GET', '/api/progress')).status, 401);
  });
  await t('A logs back in and still has progress', async () => {
    assert.equal((await a('POST', '/api/auth/login', { email: 'alice@example.com', password: 'alice-pass-123' })).status, 200);
    assert.deepEqual((await a('GET', '/api/progress')).json.data, progA);
  });
  await t('path traversal blocked', async () => assert.notEqual((await fetch(base + '/..%2fserver.js')).status, 200));
  await t('SPA fallback serves index', async () => assert.equal((await fetch(base + '/some/route')).status, 200));
  await t('login rate limited after many tries', async () => {
    let last; for (let i = 0; i < 12; i++) last = await anon('POST', '/api/auth/login', { email: 'bob@example.com', password: 'bad-guess-' + i });
    assert.equal(last.status, 429);
  });

  for (const r of results) console.log(r[0].padEnd(4), r[1], r[2] ? '— ' + r[2] : '');
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  server.close(); process.exit(failed ? 1 : 0);
});
