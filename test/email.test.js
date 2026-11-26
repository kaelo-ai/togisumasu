// Account email flows and the Resend mailer: node test/email.test.js
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-email-'));
process.env.APP_BASE_URL = 'http://app.example.test';
delete process.env.RESEND_API_KEY;
const email = require('../email.js');
const { mailbox, lastMail, tokenFrom } = require('./helpers.js');
const sent = mailbox();
const { server, db } = require('../server.js');

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
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json, setCookie: sc, cookie };
  };
}
const results = [];
async function t(name, fn) { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }

server.listen(0, async () => {
  base = `http://127.0.0.1:${server.address().port}`;
  const anon = client(), a = client(), other = client();

  await t('register queues a verification email and does not set a session', async () => {
    const r = await a('POST', '/api/auth/register', { email: 'ada@example.com', name: 'Ada', password: 'ada-pass-123' });
    assert.equal(r.status, 201);
    assert.equal(r.json.needsVerification, true);
    assert.equal((await a('GET', '/api/auth/me')).status, 401);
    const msg = lastMail(sent, 'verify', 'ada@example.com');
    assert.ok(msg);
    assert.match(msg.subject, /Verify your email/);
    assert.match(msg.actionUrl, /^http:\/\/app\.example\.test\/verify\?token=/);
    assert.match(msg.text, /Ada/);
    assert.ok(tokenFrom(msg));
  });

  await t('login before verification is 403', async () => {
    const r = await anon('POST', '/api/auth/login', { email: 'ada@example.com', password: 'ada-pass-123' });
    assert.equal(r.status, 403);
    assert.equal(r.json.needsVerification, true);
  });

  await t('bad and expired verification tokens are rejected', async () => {
    assert.equal((await anon('POST', '/api/auth/verify', { token: 'not-a-real-token' })).status, 400);
    const raw = 'expired-token-value-aaaaaaaaaaaa';
    const hash = require('node:crypto').createHash('sha256').update(raw).digest('hex');
    db.prepare('INSERT INTO email_tokens (user_id, type, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)').run(
      db.prepare('SELECT id FROM users WHERE email = ?').get('ada@example.com').id,
      'verify', hash, Date.now() - 1000, Date.now() - 2000
    );
    assert.equal((await anon('POST', '/api/auth/verify', { token: raw })).status, 400);
  });

  await t('a valid token verifies the account, signs in, and sends a welcome email', async () => {
    const before = sent.length;
    const r = await a('POST', '/api/auth/verify', { token: tokenFrom(lastMail(sent, 'verify', 'ada@example.com')) });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.email, 'ada@example.com');
    assert.equal(r.json.user.emailVerified, true);
    assert.match(r.setCookie, /HttpOnly/);
    assert.equal((await a('GET', '/api/auth/me')).json.user.email, 'ada@example.com');
    const welcome = lastMail(sent, 'welcome', 'ada@example.com');
    assert.ok(welcome);
    assert.ok(sent.length > before);
    assert.match(welcome.actionUrl, /^http:\/\/app\.example\.test\/$/);
  });

  await t('verification tokens are single-use', async () => {
    const msg = sent.find(m => m.kind === 'verify' && m.to === 'ada@example.com');
    assert.equal((await anon('POST', '/api/auth/verify', { token: tokenFrom(msg) })).status, 400);
  });

  await t('resend verification does not reveal whether an account exists', async () => {
    const r1 = await anon('POST', '/api/auth/resend-verification', { email: 'ghost@example.com' });
    const r2 = await anon('POST', '/api/auth/resend-verification', { email: 'ada@example.com' });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.json.message, r2.json.message);
    // Ada is already verified, so no new verify email is sent.
    const verifyCount = sent.filter(m => m.kind === 'verify' && m.to === 'ada@example.com').length;
    assert.equal(verifyCount, 1);
  });

  await t('forgot-password is identical for unknown and known emails', async () => {
    const r1 = await anon('POST', '/api/auth/forgot-password', { email: 'nobody@example.com' });
    const r2 = await anon('POST', '/api/auth/forgot-password', { email: 'ada@example.com' });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r1.json.message, r2.json.message);
    assert.ok(lastMail(sent, 'reset', 'ada@example.com'));
    assert.equal(sent.some(m => m.kind === 'reset' && m.to === 'nobody@example.com'), false);
  });

  await t('issuing a new reset token invalidates the previous one', async () => {
    const first = lastMail(sent, 'reset', 'ada@example.com');
    const firstToken = tokenFrom(first);
    assert.equal((await anon('POST', '/api/auth/forgot-password', { email: 'ada@example.com' })).status, 200);
    const second = lastMail(sent, 'reset', 'ada@example.com');
    assert.notEqual(tokenFrom(second), firstToken);
    assert.equal((await anon('POST', '/api/auth/reset-password', { token: firstToken, password: 'brand-new-pass' })).status, 400);
  });

  await t('short reset passwords are rejected without consuming the token', async () => {
    const token = tokenFrom(lastMail(sent, 'reset', 'ada@example.com'));
    assert.equal((await anon('POST', '/api/auth/reset-password', { token, password: 'short' })).status, 400);
    const r = await a('POST', '/api/auth/reset-password', { token, password: 'ada-new-pass-123' });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.email, 'ada@example.com');
    assert.match(r.setCookie, /sid=/);
  });

  await t('reset tokens are single-use and the old password stops working', async () => {
    const token = tokenFrom(lastMail(sent, 'reset', 'ada@example.com'));
    assert.equal((await anon('POST', '/api/auth/reset-password', { token, password: 'another-pass-123' })).status, 400);
    assert.equal((await anon('POST', '/api/auth/login', { email: 'ada@example.com', password: 'ada-pass-123' })).status, 401);
    const r = await other('POST', '/api/auth/login', { email: 'ada@example.com', password: 'ada-new-pass-123' });
    assert.equal(r.status, 200);
  });

  await t('a successful reset signs out other sessions', async () => {
    // `a` used the session created by the reset itself; `other` logged in afterwards.
    // Start a second session, then reset again and check the older session is gone.
    const second = client();
    assert.equal((await second('POST', '/api/auth/login', { email: 'ada@example.com', password: 'ada-new-pass-123' })).status, 200);
    assert.equal((await second('GET', '/api/auth/me')).status, 200);
    assert.equal((await anon('POST', '/api/auth/forgot-password', { email: 'ada@example.com' })).status, 200);
    const token = tokenFrom(lastMail(sent, 'reset', 'ada@example.com'));
    assert.equal((await anon('POST', '/api/auth/reset-password', { token, password: 'ada-third-pass' })).status, 200);
    assert.equal((await second('GET', '/api/auth/me')).status, 401);
  });

  await t('resend verification issues a fresh link for an unverified account', async () => {
    const r = await anon('POST', '/api/auth/register', { email: 'bea@example.com', name: 'Bea', password: 'bea-pass-123' });
    assert.equal(r.status, 201);
    const first = tokenFrom(lastMail(sent, 'verify', 'bea@example.com'));
    assert.equal((await anon('POST', '/api/auth/resend-verification', { email: 'bea@example.com' })).status, 200);
    const second = tokenFrom(lastMail(sent, 'verify', 'bea@example.com'));
    assert.notEqual(second, first);
    assert.equal((await anon('POST', '/api/auth/verify', { token: first })).status, 400);
    assert.equal((await anon('POST', '/api/auth/verify', { token: second })).status, 200);
  });

  await t('admin password reset still returns a temporary password once', async () => {
    const adminClient = client();
    // Promote Ada and reset Bea's password (Bea is now verified).
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('ada@example.com');
    const login = await adminClient('POST', '/api/auth/login', { email: 'ada@example.com', password: 'ada-third-pass' });
    assert.equal(login.status, 200);
    const beaId = db.prepare('SELECT id FROM users WHERE email = ?').get('bea@example.com').id;
    const r = await adminClient('POST', `/api/admin/users/${beaId}/reset-password`);
    assert.equal(r.status, 200);
    assert.ok(r.json.password.length >= 8);
    const bea = client();
    assert.equal((await bea('POST', '/api/auth/login', { email: 'bea@example.com', password: 'bea-pass-123' })).status, 401);
    assert.equal((await bea('POST', '/api/auth/login', { email: 'bea@example.com', password: r.json.password })).status, 200);
  });

  await t('dev mode logs instead of sending when no API key is set', async () => {
    email.setSender(null);
    delete process.env.RESEND_API_KEY;
    const logs = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const r = await email.sendVerification({
        to: 'dev@example.com', name: 'Dev', url: 'http://app.example.test/verify?token=abc',
        idempotencyKey: 'verify-email/dev/test',
      });
      assert.equal(r.dev, true);
      assert.ok(logs.some(line => line.includes('dev@example.com') && line.includes('http://app.example.test/verify?token=abc')));
    } finally {
      console.log = orig;
      mailbox(); // restore the stub for safety
    }
  });

  await t('mailer retries 429 and 5xx with the same idempotency key, but not other 4xx', async () => {
    email.setSender(null);
    email.setRetryDelays([0, 0, 0]);
    process.env.RESEND_API_KEY = 're_test_key';
    const calls = [];
    email.setFetch(async (url, opts) => {
      calls.push({ url, key: opts.headers['Idempotency-Key'], body: JSON.parse(opts.body) });
      if (calls.length < 3) {
        return new Response(JSON.stringify({ message: 'try again' }), { status: calls.length === 1 ? 429 : 503, headers: { 'retry-after': '0' } });
      }
      return new Response(JSON.stringify({ id: 'email_ok' }), { status: 200 });
    });
    const ok = await email.sendVerification({
      to: 'retry@example.com', name: 'Retry', url: 'http://app.example.test/verify?token=zzz',
      idempotencyKey: 'verify-email/9/abc',
    });
    assert.equal(ok.id, 'email_ok');
    assert.equal(calls.length, 3);
    assert.ok(calls.every(c => c.key === 'verify-email/9/abc'));
    assert.ok(calls.every(c => c.url === 'https://api.resend.com/emails'));
    assert.equal(calls[0].body.to[0], 'retry@example.com');

    let badCalls = 0;
    email.setFetch(async () => {
      badCalls++;
      return new Response(JSON.stringify({ message: 'bad request' }), { status: 400 });
    });
    await assert.rejects(
      () => email.sendWelcome({ to: 'retry@example.com', name: 'Retry', url: 'http://app.example.test/', idempotencyKey: 'welcome-email/9' }),
      err => err.status === 400
    );
    assert.equal(badCalls, 1);

    email.setFetch(null);
    email.setRetryDelays(null);
    delete process.env.RESEND_API_KEY;
    mailbox();
  });

  for (const r of results) console.log(r[0].padEnd(4), r[1], r[2] ? '— ' + r[2] : '');
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  server.close(); process.exit(failed ? 1 : 0);
});
