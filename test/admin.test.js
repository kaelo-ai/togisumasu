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
    const text = await r.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: r.status, json, text, setCookie: sc };
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
  await t('catalog is available to signed-in learners', async () => {
    const r = await bob('GET', '/api/catalog');
    assert.equal(r.status, 200);
    assert.ok(r.json.units.some(u => u.id === 'A'));
    assert.ok(r.json.topics.some(t => t.id === 'exp-int'));
    assert.equal((await anon('GET', '/api/catalog')).status, 401);
  });
  await t('admin creates a unit and a custom topic', async () => {
    assert.equal((await root('POST', '/api/admin/units', { id: 'Z', name: 'Statistics' })).status, 201);
    assert.equal((await root('PATCH', '/api/admin/units/Z', { name: 'Statistics & data' })).status, 200);
    const r = await root('POST', '/api/admin/topics', {
      id: 'stats-intro', unitId: 'Z', name: 'Introduction to statistics', pre: [],
      notes: 'Descriptive statistics and probability.', status: 'active',
    });
    assert.equal(r.status, 201);
    assert.equal((await root('POST', '/api/admin/topics', {
      id: 'stats-advanced', unitId: 'Z', name: 'Advanced statistics', pre: ['stats-intro'],
      notes: 'Builds on the introduction.', status: 'active',
    })).status, 201);
    const cat = await bob('GET', '/api/catalog');
    assert.ok(cat.json.units.some(u => u.id === 'Z'));
    assert.ok(cat.json.topics.some(t => t.id === 'stats-intro' && t.unit === 'Z'));
    assert.ok(cat.json.topics.some(t => t.id === 'stats-advanced' && t.pre.includes('stats-intro')));
    const skills = await root('GET', '/api/admin/skills');
    assert.ok(skills.json.items.some(t => t.id === 'stats-intro'));
  });
  await t('custom topic can hold manual questions and serve them', async () => {
    const question = { type: 'num', prompt: 'StatsUnique: evaluate $$1+1$$.', steps: ['$1+1=2$'], val: 2, ans: '2', ansTex: '2', exact: true };
    assert.equal((await root('POST', '/api/admin/questions', { skillId: 'stats-intro', question })).status, 201);
    const r = await bob('GET', '/api/questions/next?skill=stats-intro');
    assert.equal(r.status, 200); assert.equal(r.json.question.skillId, 'stats-intro');
  });
  await t('hiding a topic removes it from learners and practice', async () => {
    assert.equal((await root('PATCH', '/api/admin/topics/stats-intro', { status: 'hidden' })).status, 200);
    const cat = await bob('GET', '/api/catalog');
    assert.ok(!cat.json.topics.some(t => t.id === 'stats-intro'));
    assert.ok(!cat.json.topics.some(t => t.id === 'stats-advanced'), 'dependent topic should hide with its prerequisite');
    assert.equal((await bob('GET', '/api/questions/next?skill=stats-intro')).status, 404);
    assert.equal((await root('PATCH', '/api/admin/topics/stats-intro', { status: 'active' })).status, 200);
    const shown = await bob('GET', '/api/catalog');
    assert.ok(shown.json.topics.some(t => t.id === 'stats-advanced'));
    assert.equal((await bob('GET', '/api/questions/next?skill=stats-intro')).status, 200);
  });
  await t('topic prerequisites are validated against cycles', async () => {
    assert.equal((await root('PATCH', '/api/admin/topics/stats-intro', { pre: ['stats-intro'] })).status, 400);
    assert.equal((await root('PATCH', '/api/admin/topics/stats-intro', { pre: ['exp-int'] })).status, 200);
    assert.equal((await root('PATCH', '/api/admin/topics/exp-int', { pre: ['stats-intro'] })).status, 400);
  });
  await t('built-in units and topics cannot be deleted', async () => {
    assert.equal((await root('DELETE', '/api/admin/topics/exp-int')).status, 403);
    assert.equal((await root('DELETE', '/api/admin/units/A')).status, 403);
  });
  await t('custom topics with questions cannot be deleted, but empty ones can', async () => {
    assert.equal((await root('DELETE', '/api/admin/topics/stats-intro')).status, 409);
    assert.equal((await root('DELETE', '/api/admin/units/Z')).status, 409);
    assert.equal((await root('POST', '/api/admin/units', { id: 'Y', name: 'Temporary' })).status, 201);
    assert.equal((await root('POST', '/api/admin/topics', { id: 'stats-temp', unitId: 'Y', name: 'Temporary topic', pre: [], notes: '', status: 'active' })).status, 201);
    assert.equal((await root('POST', '/api/admin/topics', { id: 'stats-child', unitId: 'Y', name: 'Dependent topic', pre: ['stats-temp'], notes: '', status: 'active' })).status, 201);
    assert.equal((await root('DELETE', '/api/admin/topics/stats-temp')).status, 409);
    assert.equal((await root('DELETE', '/api/admin/topics/stats-child')).status, 200);
    assert.equal((await root('DELETE', '/api/admin/topics/stats-temp')).status, 200);
    assert.equal((await root('DELETE', '/api/admin/units/Y')).status, 200);
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
  await t('duplicate detection finds the same prompt in a topic', async () => {
    const r = await root('POST', '/api/admin/questions/duplicate', { skillId: 'exp-int', prompt: 'ManualUnique: evaluate $$2+3$$.' });
    assert.equal(r.status, 200); assert.equal(r.json.duplicate, true); assert.equal(r.json.question.id, questionId);
    const same = await root('POST', '/api/admin/questions/duplicate', { skillId: 'exp-int', prompt: 'ManualUnique: evaluate $$2+3$$.', excludeId: questionId });
    assert.equal(same.json.duplicate, false);
  });
  await t('admin exports questions as JSON', async () => {
    const r = await root('GET', '/api/admin/questions/export?source=manual');
    assert.equal(r.status, 200);
    const item = r.json.items.find(x => x.id === questionId);
    assert.ok(item); assert.equal(item.skillId, 'exp-int'); assert.equal(item.question.type, 'num');
  });
  await t('admin exports questions as CSV', async () => {
    const r = await root('GET', '/api/admin/questions/export?source=manual&format=csv');
    assert.equal(r.status, 200);
    assert.match(r.text, /^id,skillId,status,source,type,prompt/);
    assert.match(r.text, /ManualUnique/);
  });
  await t('admin imports JSON and skips duplicates', async () => {
    const item = {
      skillId: 'exp-int',
      question: { type: 'num', prompt: 'ImportedUnique: evaluate $$9-2$$.', steps: ['$9-2=7$'], val: 7, ans: '7', ansTex: '7', exact: true },
    };
    const first = await root('POST', '/api/admin/questions/import', { format: 'json', text: JSON.stringify([item]) });
    assert.equal(first.status, 200); assert.equal(first.json.added, 1); assert.equal(first.json.skipped, 0);
    const second = await root('POST', '/api/admin/questions/import', { format: 'json', text: JSON.stringify([item]) });
    assert.equal(second.status, 200); assert.equal(second.json.added, 0); assert.equal(second.json.skipped, 1);
  });
  await t('admin imports CSV', async () => {
    const escape = v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const header = 'skillId,type,prompt,hint,steps,ans,ansTex,val,vals,undef,exact,var,sample,tol,options,fields,reject';
    const row = ['exp-int', 'num', 'CSVUnique: evaluate $$3+4$$.', '', JSON.stringify(['$3+4=7$']), '7', '7', '7', '', '', 'true', '', '', '', '', '', ''];
    const r = await root('POST', '/api/admin/questions/import', { format: 'csv', text: [header, row.map(escape).join(',')].join('\n') });
    assert.equal(r.status, 200); assert.equal(r.json.added, 1); assert.equal(r.json.errorCount, 0);
  });
  await t('invalid imports are reported without aborting the batch', async () => {
    const items = [
      { skillId: 'exp-int', question: { type: 'num', prompt: 'BadImport', steps: [] } },
    ];
    const r = await root('POST', '/api/admin/questions/import', { format: 'json', text: JSON.stringify(items) });
    assert.equal(r.status, 200); assert.equal(r.json.added, 0); assert.equal(r.json.errorCount, 1);
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
    assert.equal((await root('POST', `/api/admin/users/${bobId}/reset-progress`, { scope: 'unit', value: 'QQ' })).status, 400);
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
    for (const a of ['unit.create', 'unit.update', 'unit.delete', 'topic.create', 'topic.update', 'topic.delete', 'question.add', 'question.update', 'question.restore', 'question.delete', 'question.import', 'user.status', 'user.delete', 'user.reset_progress']) assert.ok(actions.includes(a), a);
  });

  for (const r of results) console.log(r[0].padEnd(4), r[1], r[2] ? '— ' + r[2] : '');
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  server.close(); process.exit(failed ? 1 : 0);
});
