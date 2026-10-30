// Admin API tests: node test/admin.test.js  (uses a throwaway data directory)
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-admin-test-'));
process.env.ADMIN_EMAIL = 'root@example.com';
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
  const anon = client(), root = client(), bob = client();
  let rootId, bobId, questionId, tempPassword;

  await t('bootstrap admin registers with admin role', async () => {
    const r = await root('POST', '/api/auth/register', { email: 'root@example.com', name: 'Root', password: 'root-pass-123' });
    assert.equal(r.status, 201); assert.equal(r.json.user.role, 'admin');
    rootId = r.json.user.id;
  });
  await t('normal account registers as student', async () => {
    const r = await bob('POST', '/api/auth/register', { email: 'bob@example.com', name: 'Bob', password: 'bob-pass-123' });
    assert.equal(r.status, 201); assert.equal(r.json.user.role, 'student');
    bobId = r.json.user.id;
  });
  await t('anonymous admin endpoint is 401', async () => assert.equal((await anon('GET', '/api/admin/users')).status, 401));
  await t('student admin endpoint is 403', async () => assert.equal((await bob('GET', '/api/admin/users')).status, 403));
  await t('admin page is served', async () => {
    const r = await fetch(base + '/admin');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Manage Togisumasu/);
  });
  await t('admin lists users', async () => {
    const r = await root('GET', '/api/admin/users');
    assert.equal(r.status, 200);
    assert.equal(r.json.total, 2);
    assert.ok(r.json.items.some(u => u.email === 'bob@example.com'));
  });
  await t('admin lists topics', async () => {
    const r = await root('GET', '/api/admin/skills');
    assert.equal(r.status, 200); assert.ok(r.json.items.length >= 40);
  });
  await t('admin adds a manual question', async () => {
    const question = {
      type: 'num', prompt: 'ManualUnique: evaluate $$2+2$$.', hint: 'Add.', steps: ['$2+2=4$'],
      val: 4, ans: '4', ansTex: '4', exact: true,
    };
    const r = await root('POST', '/api/admin/questions', { skillId: 'exp-int', question });
    assert.equal(r.status, 201);
    assert.equal(r.json.question.source, 'manual');
    questionId = r.json.question.id;
  });
  await t('manual question is searchable while active', async () => {
    const r = await root('GET', '/api/questions/search?q=ManualUnique');
    assert.equal(r.status, 200); assert.ok(r.json.items.some(x => x.id === questionId));
  });
  await t('admin edits a manual question', async () => {
    const question = {
      type: 'num', prompt: 'ManualUnique: evaluate $$2+3$$.', hint: 'Add.', steps: ['$2+3=5$'],
      val: 5, ans: '5', ansTex: '5', exact: true,
    };
    const r = await root('PATCH', `/api/admin/questions/${questionId}`, { skillId: 'exp-int', question });
    assert.equal(r.status, 200); assert.equal(r.json.question.val, 5);
  });
  await t('answer tester uses the real checker', async () => {
    const question = { type: 'num', prompt: 'Test', steps: ['$2+3=5$'], val: 5, ans: '5', ansTex: '5', exact: true };
    assert.equal((await root('POST', '/api/admin/questions/test', { question, answer: '5' })).json.ok, true);
    assert.equal((await root('POST', '/api/admin/questions/test', { question, answer: '6' })).json.ok, false);
  });
  await t('invalid manual questions are rejected', async () => {
    const badMc = { type: 'mc', prompt: 'Bad MC', steps: ['x'], options: [{ tex: 'a', ok: false }, { tex: 'b', ok: false }] };
    assert.equal((await root('POST', '/api/admin/questions', { skillId: 'exp-int', question: badMc })).status, 400);
    const badExpr = { type: 'expr', prompt: 'Bad expr', steps: ['x'], ans: 'x^2-1', ansTex: 'x^2-1', reject: 'factored' };
    assert.equal((await root('POST', '/api/admin/questions', { skillId: 'exp-int', question: badExpr })).status, 400);
    const noSteps = { type: 'num', prompt: 'No steps', steps: [], val: 1, ans: '1', ansTex: '1' };
    assert.equal((await root('POST', '/api/admin/questions', { skillId: 'exp-int', question: noSteps })).status, 400);
  });
  await t('hiding removes a question from public search', async () => {
    assert.equal((await root('PATCH', `/api/admin/questions/${questionId}`, { status: 'hidden' })).status, 200);
    const r = await root('GET', '/api/questions/search?q=ManualUnique');
    assert.ok(!r.json.items.some(x => x.id === questionId));
  });
  await t('restoring puts it back', async () => {
    assert.equal((await root('POST', `/api/admin/questions/${questionId}/restore`)).status, 200);
    const r = await root('GET', '/api/questions/search?q=ManualUnique');
    assert.ok(r.json.items.some(x => x.id === questionId));
  });
  await t('deleting is a soft delete and listable', async () => {
    assert.equal((await root('DELETE', `/api/admin/questions/${questionId}`)).status, 200);
    const r = await root('GET', '/api/admin/questions?status=deleted');
    assert.ok(r.json.items.some(x => x.id === questionId));
  });
  await t('restore a deleted question', async () => {
    assert.equal((await root('POST', `/api/admin/questions/${questionId}/restore`)).status, 200);
    const r = await root('GET', `/api/admin/questions/${questionId}`);
    assert.equal(r.json.question.status, 'active');
  });
  await t('admin disables a user and revokes sessions', async () => {
    assert.equal((await root('PATCH', `/api/admin/users/${bobId}`, { status: 'disabled' })).status, 200);
    assert.equal((await bob('GET', '/api/auth/me')).status, 401);
    assert.equal((await anon('POST', '/api/auth/login', { email: 'bob@example.com', password: 'bob-pass-123' })).status, 403);
  });
  await t('admin resets a password without leaking it in audit', async () => {
    const r = await root('POST', `/api/admin/users/${bobId}/reset-password`);
    assert.equal(r.status, 200); assert.ok(r.json.password.length >= 8);
    tempPassword = r.json.password;
    const audit = await root('GET', '/api/admin/audit?limit=200');
    assert.ok(audit.json.items.some(x => x.action === 'user.reset_password'));
    assert.ok(!JSON.stringify(audit.json.items).includes(tempPassword));
  });
  await t('enable and sign in with the temporary password', async () => {
    assert.equal((await root('PATCH', `/api/admin/users/${bobId}`, { status: 'active' })).status, 200);
    assert.equal((await bob('POST', '/api/auth/login', { email: 'bob@example.com', password: tempPassword })).status, 200);
    assert.equal((await bob('GET', '/api/auth/me')).json.user.role, 'student');
  });
  await t('promote and demote another user', async () => {
    assert.equal((await root('PATCH', `/api/admin/users/${bobId}`, { role: 'admin' })).status, 200);
    assert.equal((await bob('GET', '/api/admin/users')).status, 200);
    assert.equal((await root('PATCH', `/api/admin/users/${bobId}`, { role: 'student' })).status, 200);
    assert.equal((await bob('GET', '/api/admin/users')).status, 403);
  });
  await t('admin resets one whole unit of a user\'s progress', async () => {
    const progress = {
      t: 100,
      skills: {
        'exp-int': { a: 4, c: 3, s: 1, lv: 2, due: 999, last: 1 },
        'poly-mult': { a: 2, c: 2, s: 0, lv: 1, due: 999, last: 1 },
        'linear-eq': { a: 3, c: 3, s: 0, lv: 1, due: 999, last: 1 },
        'deg-rad': { a: 5, c: 5, s: 0, lv: 2, due: 999, last: 1 }
      },
      log: { '2026-10-30': 5 },
      qz: { recent: ['exp-int', 'linear-eq', 'deg-rad'], last: 123, hist: [{ t: 1, score: 3, n: 5 }] },
      seen: { 'exp-int': ['a'], 'linear-eq': ['b'], 'deg-rad': ['c'] }
    };
    assert.equal((await bob('PUT', '/api/progress', { data: progress })).status, 200);
    const r = await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'unit', value: 'A' });
    assert.equal(r.status, 200); assert.equal(r.json.removed, 2); assert.ok(r.json.resetAt > 0);
    assert.equal((await bob('GET', '/api/auth/me')).status, 401);
    const saved = JSON.parse(db.prepare('SELECT data FROM progress WHERE user_id = ?').get(bobId).data);
    assert.deepEqual(Object.keys(saved.skills).sort(), ['deg-rad', 'linear-eq']);
    assert.deepEqual(Object.keys(saved.seen).sort(), ['deg-rad', 'linear-eq']);
    assert.deepEqual(saved.qz.recent, ['linear-eq', 'deg-rad']);
    assert.deepEqual(saved.log, { '2026-10-30': 5 });
    assert.ok(saved.resetAt > 0);
  });
  await t('admin resets one topic', async () => {
    const r = await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'skill', value: 'linear-eq' });
    assert.equal(r.status, 200); assert.equal(r.json.removed, 1);
    const saved = JSON.parse(db.prepare('SELECT data FROM progress WHERE user_id = ?').get(bobId).data);
    assert.deepEqual(Object.keys(saved.skills), ['deg-rad']);
    assert.deepEqual(Object.keys(saved.seen), ['deg-rad']);
    assert.deepEqual(saved.qz.recent, ['deg-rad']);
  });
  await t('admin resets all progress', async () => {
    const r = await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'all' });
    assert.equal(r.status, 200); assert.equal(r.json.removed, 1);
    const saved = JSON.parse(db.prepare('SELECT data FROM progress WHERE user_id = ?').get(bobId).data);
    assert.deepEqual(saved.skills, {}); assert.deepEqual(saved.seen, {}); assert.deepEqual(saved.log, {});
    assert.deepEqual(saved.qz.recent, []); assert.ok(saved.resetAt > 0);
  });
  await t('invalid progress reset targets are rejected', async () => {
    assert.equal((await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'planet' })).status, 400);
    assert.equal((await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'unit', value: 'Z' })).status, 400);
    assert.equal((await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'skill', value: 'nope' })).status, 400);
  });
  await t('bob can sign in again after a progress reset', async () => {
    // The earlier resets revoked Bob's session; sign in again so later tests have a valid cookie.
    assert.equal((await bob('POST', '/api/auth/login', { email: 'bob@example.com', password: tempPassword })).status, 200);
  });

  await t('self-protection blocks disabling or demoting yourself', async () => {
    assert.equal((await root('PATCH', `/api/admin/users/${rootId}`, { status: 'disabled' })).status, 400);
    assert.equal((await root('PATCH', `/api/admin/users/${rootId}`, { role: 'student' })).status, 400);
    assert.equal((await root('DELETE', `/api/admin/users/${rootId}`)).status, 400);
  });
  await t('delete and restore a user', async () => {
    assert.equal((await root('DELETE', `/api/admin/users/${bobId}`)).status, 200);
    assert.equal((await bob('GET', '/api/auth/me')).status, 401);
    const list = await root('GET', '/api/admin/users?status=deleted');
    assert.ok(list.json.items.some(u => u.id === bobId));
    assert.equal((await root('POST', `/api/admin/users/${bobId}/restore`)).status, 200);
    assert.equal((await anon('POST', '/api/auth/login', { email: 'bob@example.com', password: tempPassword })).status, 200);
  });
  await t('audit records admin changes', async () => {
    const r = await root('GET', '/api/admin/audit?limit=200');
    assert.equal(r.status, 200);
    const actions = r.json.items.map(x => x.action);
    for (const a of ['question.add', 'question.update', 'question.restore', 'question.delete', 'user.status', 'user.delete', 'user.reset_progress']) assert.ok(actions.includes(a), a);
  });

  for (const r of results) console.log(r[0].padEnd(4), r[1], r[2] ? '— ' + r[2] : '');
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  server.close(); process.exit(failed ? 1 : 0);
});
