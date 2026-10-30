// AI tutor tests against a fake OpenAI-compatible provider: node test/ai.test.js
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const ai = require('../ai.js');

const seen = [];
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    seen.push({ url: req.url, headers: req.headers, body: JSON.parse(b) });
    res.writeHead(200, { 'content-type': 'application/json' });
    if (req.url === '/v1/messages') res.end(JSON.stringify({ content: [{ type: 'text', text: 'anthropic reply' }] }));
    else res.end(JSON.stringify({ choices: [{ message: { content: 'You flipped the sign.\n\n1. Move $3$ across: $x=5-3$' } }] }));
  });
});
const results = [];
async function t(name, fn) { try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }

fake.listen(0, async () => {
  const fakeUrl = `http://127.0.0.1:${fake.address().port}`;

  await t('config: off when no provider', async () => assert.equal(ai.loadConfig({}).enabled, false));
  await t('config: deepseek needs a key', async () => assert.match(ai.loadConfig({ LLM_PROVIDER: 'deepseek' }).reason, /LLM_API_KEY/));
  await t('config: deepseek has a default model', async () => {
    const c = ai.loadConfig({ LLM_PROVIDER: 'deepseek', LLM_API_KEY: 'sk-x' });
    assert.equal(c.enabled, true); assert.equal(c.model, 'deepseek-flash'); assert.equal(c.baseUrl, 'https://api.deepseek.com');
  });
  await t('config: openai needs a model', async () => assert.match(ai.loadConfig({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-x' }).reason, /LLM_MODEL/));
  await t('config: unknown provider rejected', async () => assert.match(ai.loadConfig({ LLM_PROVIDER: 'nope' }).reason, /Unknown/));
  await t('anthropic request format', async () => {
    const c = ai.loadConfig({ LLM_PROVIDER: 'anthropic', LLM_API_KEY: 'ak-1', LLM_BASE_URL: fakeUrl });
    assert.equal(await ai.complete(c, 'sys', 'hi'), 'anthropic reply');
    const r = seen.at(-1); assert.equal(r.headers['x-api-key'], 'ak-1'); assert.equal(r.body.system, 'sys');
  });

  // Full server with an OpenAI-compatible provider
  Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-ai-')), LLM_PROVIDER: 'custom', LLM_BASE_URL: fakeUrl, LLM_API_KEY: 'sk-secret-123', LLM_MODEL: 'fake-model', LLM_DAILY_LIMIT: '2' });
  const { server } = require('../server.js');
  server.listen(0, async () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie = '';
    const call = async (m, u, body) => { const r = await fetch(base + u, { method: m, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, json: await r.json().catch(() => null), raw: r }; };
    const Q = { topic: 'Linear equations', prompt: 'Solve $x+3=5$', answer: 'x=2', given: '<code>8</code>', steps: ['Subtract 3'] };

    await t('config reports ai:true', async () => assert.equal((await call('GET', '/api/auth/config')).json.ai, true));
    await t('explain needs sign-in', async () => assert.equal((await call('POST', '/api/ai/explain', Q)).status, 401));
    await call('POST', '/api/auth/register', { email: 'k@example.com', name: 'K', password: 'password123' });
    await t('explain returns text and remaining', async () => {
      const r = await call('POST', '/api/ai/explain', Q);
      assert.equal(r.status, 200); assert.match(r.json.text, /flipped the sign/); assert.equal(r.json.remaining, 1);
    });
    await t('provider got key, model and the student answer', async () => {
      const r = seen.at(-1); assert.equal(r.url, '/chat/completions'); assert.equal(r.headers.authorization, 'Bearer sk-secret-123');
      assert.equal(r.body.model, 'fake-model'); assert.match(r.body.messages[1].content, /Student's answer: 8/);
    });
    await t('key never reaches the browser', async () => {
      const r = await call('GET', '/api/auth/config'); assert.ok(!JSON.stringify(r.json).includes('sk-secret'));
      const html = await (await fetch(base + '/')).text(); assert.ok(!html.includes('sk-secret'));
    });
    await t('bad request rejected', async () => assert.equal((await call('POST', '/api/ai/explain', { prompt: '' })).status, 400));
    await call('POST', '/api/ai/explain', Q);
    await t('daily limit enforced', async () => assert.equal((await call('POST', '/api/ai/explain', Q)).status, 429));

    for (const r of results) console.log(r[0].padEnd(4), r[1], r[2] ? '— ' + r[2] : '');
    const failed = results.filter(r => r[0] === 'FAIL').length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    server.close(); fake.close(); process.exit(failed ? 1 : 0);
  });
});
