// Shared test helpers for account registration after email verification was added.
'use strict';
const email = require('../email.js');

function mailbox() {
  const sent = [];
  email.setSender(async (msg) => {
    sent.push(msg);
    return { id: 'test-' + sent.length };
  });
  return sent;
}

function lastMail(sent, kind, to) {
  const want = to && String(to).toLowerCase();
  for (let i = sent.length - 1; i >= 0; i--) {
    const m = sent[i];
    if (kind && m.kind !== kind) continue;
    if (want && String(m.to).toLowerCase() !== want) continue;
    return m;
  }
  return null;
}

function tokenFrom(msg) {
  if (!msg) return null;
  const url = msg.actionUrl || (msg.variables && (msg.variables.ACTION_URL || msg.variables.APP_URL)) || '';
  try { return new URL(url).searchParams.get('token'); } catch { return null; }
}

async function registerVerified(client, body, sent) {
  const r = await client('POST', '/api/auth/register', body);
  if (r.status !== 201) return r;
  const msg = lastMail(sent, 'verify', body.email);
  if (!msg) {
    const err = new Error('expected a verification email');
    err.register = r;
    throw err;
  }
  const v = await client('POST', '/api/auth/verify', { token: tokenFrom(msg) });
  v.register = r;
  return v;
}

module.exports = { mailbox, lastMail, tokenFrom, registerVerified };
