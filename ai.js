// AI tutor: one server-side LLM connection that the server operator configures.
// Learners never see or supply a key; the browser only ever talks to this server.
//
// Supported providers (set LLM_PROVIDER):
//   openai      https://api.openai.com/v1                       (OpenAI chat completions)
//   deepseek    https://api.deepseek.com                        (OpenAI-compatible)
//   anthropic   https://api.anthropic.com                       (Anthropic Messages API)
//   gemini      https://generativelanguage.googleapis.com/v1beta/openai   (OpenAI-compatible)
//   openrouter  https://openrouter.ai/api/v1                    (OpenAI-compatible, many models)
//   ollama      http://ollama:11434/v1                          (local models, no key needed)
//   custom      any OpenAI-compatible endpoint; set LLM_BASE_URL
//
// Check your settings with:  node ai.js check   (or: docker exec togisumasu node ai.js check)
'use strict';

const PROVIDERS = {
  openai: { kind: 'openai', base: 'https://api.openai.com/v1', model: null, needsKey: true },
  deepseek: { kind: 'openai', base: 'https://api.deepseek.com', model: 'deepseek-flash', needsKey: true },
  anthropic: { kind: 'anthropic', base: 'https://api.anthropic.com', model: 'claude-haiku-4-5-20251001', needsKey: true },
  gemini: { kind: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: null, needsKey: true },
  openrouter: { kind: 'openai', base: 'https://openrouter.ai/api/v1', model: null, needsKey: true },
  ollama: { kind: 'openai', base: 'http://ollama:11434/v1', model: null, needsKey: false },
  custom: { kind: 'openai', base: null, model: null, needsKey: false },
};

function loadConfig(env = process.env) {
  const name = String(env.LLM_PROVIDER || '').trim().toLowerCase();
  if (!name) return { enabled: false, reason: 'LLM_PROVIDER is not set (AI tutor is off).' };
  const p = PROVIDERS[name];
  if (!p) return { enabled: false, reason: `Unknown LLM_PROVIDER "${name}". Use one of: ${Object.keys(PROVIDERS).join(', ')}.` };
  const cfg = {
    provider: name,
    kind: p.kind,
    baseUrl: String(env.LLM_BASE_URL || p.base || '').replace(/\/+$/, ''),
    apiKey: String(env.LLM_API_KEY || ''),
    model: String(env.LLM_MODEL || p.model || ''),
    maxTokens: Number(env.LLM_MAX_TOKENS || 700),
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 30000),
    dailyLimit: Number(env.LLM_DAILY_LIMIT || 30),
  };
  if (!cfg.baseUrl) return { enabled: false, reason: `LLM_PROVIDER=${name} needs LLM_BASE_URL.` };
  if (p.needsKey && !cfg.apiKey) return { enabled: false, reason: `LLM_PROVIDER=${name} needs LLM_API_KEY.` };
  if (!cfg.model) return { enabled: false, reason: `LLM_PROVIDER=${name} needs LLM_MODEL (the provider's model id).` };
  return { enabled: true, ...cfg };
}

// Send a system prompt and one user message; resolve to the reply text.
async function complete(cfg, system, userText) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    let url, headers, body;
    if (cfg.kind === 'anthropic') {
      url = cfg.baseUrl + '/v1/messages';
      headers = { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' };
      body = { model: cfg.model, max_tokens: cfg.maxTokens, system, messages: [{ role: 'user', content: userText }] };
    } else {
      url = cfg.baseUrl + '/chat/completions';
      headers = { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: 'Bearer ' + cfg.apiKey } : {}) };
      body = {
        model: cfg.model, max_tokens: cfg.maxTokens, temperature: 0.3,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userText }]
      };
    }
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (!r.ok) {
      const msg = (json && (json.error?.message || json.error || json.message)) || text.slice(0, 200);
      throw Object.assign(new Error(`${cfg.provider} returned ${r.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`), { upstream: r.status });
    }
    const out = cfg.kind === 'anthropic'
      ? (json?.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
      : json?.choices?.[0]?.message?.content;
    if (!out || !String(out).trim()) throw new Error(`${cfg.provider} returned an empty reply`);
    return String(out).trim();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${cfg.provider} did not answer within ${cfg.timeoutMs / 1000}s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- the tutor prompt ---------------- */
const TUTOR_SYSTEM = `You are a patient maths tutor helping a student review mathematics and statistics.
You are given a practice question, the correct answer, a short worked solution, and (sometimes) the student's wrong answer.
- If the student gave an answer, first name the most likely specific mistake that produces their answer (sign error, wrong exponent rule, forgot to flip an inequality, etc.). Be concrete; don't guess wildly.
- Then explain the correct method in 3 to 6 short numbered steps, in plain language, building on what they did right.
- End with one short tip for spotting this mistake next time.
- Write maths in LaTeX between single dollar signs, like $x^2-4$. No display maths, no markdown headings, no tables.
- Keep it under 220 words. Be warm but direct. Do not invent a different question.`;

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const stripHtml = s => clip(s, 4000).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function tutorMessage({ topic, prompt, answer, given, steps }) {
  const st = Array.isArray(steps) ? steps.slice(0, 12).map((s, i) => `${i + 1}. ${stripHtml(s)}`).join('\n') : '';
  return [
    topic ? `Topic: ${clip(stripHtml(topic), 120)}` : '',
    `Question: ${clip(stripHtml(prompt), 1500)}`,
    `Correct answer: ${clip(stripHtml(answer), 400)}`,
    st ? `Worked solution:\n${clip(st, 2500)}` : '',
    given ? `Student's answer: ${clip(stripHtml(given), 300)}` : `The student did not answer and asked to see how it works. Explain it a different way from the worked solution.`,
  ].filter(Boolean).join('\n\n');
}

module.exports = { loadConfig, complete, tutorMessage, TUTOR_SYSTEM, PROVIDERS };

/* ---------------- `node ai.js check` ---------------- */
if (require.main === module) {
  const cfg = loadConfig();
  if (!cfg.enabled) { console.log('AI tutor is OFF: ' + cfg.reason); process.exit(1); }
  console.log(`Provider: ${cfg.provider}\nEndpoint: ${cfg.baseUrl}\nModel:    ${cfg.model}\nKey:      ${cfg.apiKey ? cfg.apiKey.slice(0, 4) + '…' + cfg.apiKey.slice(-4) : '(none)'}\nSending a test question…`);
  complete(cfg, 'Reply with exactly: OK', 'Say OK.')
    .then(t => { console.log('Reply:    ' + t.slice(0, 80) + '\nAI tutor is working.'); })
    .catch(e => { console.error('FAILED:   ' + e.message); process.exit(1); });
}
