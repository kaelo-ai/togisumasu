// Transactional email via Resend's HTTP API. No SDK, so the project stays zero-dependency.
// If RESEND_API_KEY is unset, messages are logged to the console instead of sent (dev mode).
'use strict';

const API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Togisumasu <onboarding@resend.dev>';
const DEFAULT_DELAYS_MS = [1000, 2000, 4000];
const REQUEST_TIMEOUT_MS = 15000;

let customSender = null;
let customFetch = null;
let retryDelays = DEFAULT_DELAYS_MS;

function setSender(fn) { customSender = fn; }
function setFetch(fn) { customFetch = fn; }
function setRetryDelays(ms) { retryDelays = Array.isArray(ms) && ms.length ? ms : DEFAULT_DELAYS_MS; }

function config() {
  return {
    apiKey: String(process.env.RESEND_API_KEY || '').trim(),
    from: String(process.env.EMAIL_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM,
    templates: {
      verify: String(process.env.RESEND_TEMPLATE_VERIFY || '').trim(),
      reset: String(process.env.RESEND_TEMPLATE_RESET || '').trim(),
      welcome: String(process.env.RESEND_TEMPLATE_WELCOME || '').trim(),
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function layout({ title, preheader, heading, bodyHtml, buttonLabel, buttonUrl, footerHtml }) {
  const font = "Georgia, 'Times New Roman', Times, serif";
  const sans = 'Arial, Helvetica, sans-serif';
  const btn = buttonLabel && buttonUrl ? `
          <tr>
            <td align="center" style="padding-top:8px;padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1a1a1a" style="background-color:#1a1a1a;">
                    <a href="${buttonUrl}" style="display:inline-block;font-family:${sans};font-size:16px;line-height:20px;color:#ffffff;text-decoration:none;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;">${buttonLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ea;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f1ea;">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f1ea;">
    <tr>
      <td align="center" bgcolor="#f4f1ea" style="background-color:#f4f1ea;padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;">
          <tr>
            <td style="padding-top:28px;padding-bottom:8px;padding-left:32px;padding-right:32px;font-family:${sans};font-size:13px;line-height:18px;color:#6b6558;letter-spacing:0.08em;">TOGISUMASU</td>
          </tr>
          <tr>
            <td style="padding-top:0;padding-bottom:16px;padding-left:32px;padding-right:32px;font-family:${font};font-size:24px;line-height:32px;color:#1a1a1a;">${heading}</td>
          </tr>
          <tr>
            <td style="padding-top:0;padding-bottom:8px;padding-left:32px;padding-right:32px;font-family:${sans};font-size:16px;line-height:24px;color:#222222;">${bodyHtml}</td>
          </tr>
          ${btn}
          <tr>
            <td style="padding-top:0;padding-bottom:32px;padding-left:32px;padding-right:32px;font-family:${sans};font-size:13px;line-height:20px;color:#6b6558;">${footerHtml}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function render(kind, vars, { placeholders = false } = {}) {
  const v = (key, fallback = '') => {
    if (placeholders) return `{{{${key}}}}`;
    const val = vars[key];
    return val == null || val === '' ? fallback : escapeHtml(String(val));
  };
  const raw = (key) => (placeholders ? `{{{${key}}}}` : String(vars[key] || ''));

  if (kind === 'verify') {
    const subject = 'Verify your email for Togisumasu';
    const text = [
      `Hi ${placeholders ? '{{{NAME}}}' : (vars.NAME || 'there')},`,
      '',
      'Thanks for creating a Togisumasu account. Confirm your email address by opening this link:',
      raw('ACTION_URL'),
      '',
      `This link expires in ${placeholders ? '{{{EXPIRES_IN}}}' : (vars.EXPIRES_IN || '24 hours')}.`,
      '',
      'If you did not create an account, you can ignore this email.',
    ].join('\n');
    const html = layout({
      title: subject,
      preheader: `This link expires in ${placeholders ? '{{{EXPIRES_IN}}}' : escapeHtml(vars.EXPIRES_IN || '24 hours')}.`,
      heading: 'Verify your email',
      bodyHtml: `<p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#222222;">Hi ${v('NAME', 'there')},</p><p style="margin-top:12px;margin-bottom:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#222222;">Thanks for creating a Togisumasu account. Confirm your email address so you can sign in and save your progress.</p>`,
      buttonLabel: 'Verify email',
      buttonUrl: raw('ACTION_URL'),
      footerHtml: `This link expires in ${v('EXPIRES_IN', '24 hours')}. If you did not create an account, you can ignore this email.<br>If the button does not work, paste this link into your browser:<br>${raw('ACTION_URL')}`,
    });
    return { subject, text, html };
  }

  if (kind === 'reset') {
    const subject = 'Reset your password for Togisumasu';
    const text = [
      `Hi ${placeholders ? '{{{NAME}}}' : (vars.NAME || 'there')},`,
      '',
      'We received a request to reset the password for your Togisumasu account. Open this link to choose a new password:',
      raw('ACTION_URL'),
      '',
      `This link expires in ${placeholders ? '{{{EXPIRES_IN}}}' : (vars.EXPIRES_IN || '1 hour')} and can be used only once.`,
      '',
      'If you did not ask to reset your password, you can ignore this email. Your password will stay the same.',
    ].join('\n');
    const html = layout({
      title: subject,
      preheader: `This link expires in ${placeholders ? '{{{EXPIRES_IN}}}' : escapeHtml(vars.EXPIRES_IN || '1 hour')}.`,
      heading: 'Reset your password',
      bodyHtml: `<p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#222222;">Hi ${v('NAME', 'there')},</p><p style="margin-top:12px;margin-bottom:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#222222;">We received a request to reset the password for your Togisumasu account.</p>`,
      buttonLabel: 'Reset password',
      buttonUrl: raw('ACTION_URL'),
      footerHtml: `This link expires in ${v('EXPIRES_IN', '1 hour')} and can be used only once. If you did not ask to reset your password, you can ignore this email.<br>If the button does not work, paste this link into your browser:<br>${raw('ACTION_URL')}`,
    });
    return { subject, text, html };
  }

  if (kind === 'welcome') {
    const subject = 'Welcome to Togisumasu';
    const text = [
      `Hi ${placeholders ? '{{{NAME}}}' : (vars.NAME || 'there')},`,
      '',
      'Your email is confirmed and your Togisumasu account is ready. You can sign in and start practising whenever you like:',
      raw('APP_URL'),
      '',
      'Togisumasu means “to sharpen the mind.”',
    ].join('\n');
    const html = layout({
      title: subject,
      preheader: 'Your account is ready.',
      heading: 'Welcome to Togisumasu',
      bodyHtml: `<p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#222222;">Hi ${v('NAME', 'there')},</p><p style="margin-top:12px;margin-bottom:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#222222;">Your email is confirmed and your account is ready. You can sign in and start practising whenever you like.</p>`,
      buttonLabel: 'Open Togisumasu',
      buttonUrl: raw('APP_URL'),
      footerHtml: 'Togisumasu means “to sharpen the mind.”',
    });
    return { subject, text, html };
  }

  throw new Error('Unknown email kind: ' + kind);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryAfterMs(res, fallback) {
  const raw = res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
  if (!raw) return fallback;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, 30000);
  const when = Date.parse(raw);
  if (Number.isFinite(when)) return Math.min(Math.max(0, when - Date.now()), 30000);
  return fallback;
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

async function sendWithRetry(body, idempotencyKey, apiKey) {
  const doFetch = customFetch || fetch;
  const delays = retryDelays;
  const attempts = delays.length + 1;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await doFetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      if (res.ok) return { id: json && json.id, raw: json };
      const err = new Error((json && (json.message || json.error)) || ('Resend HTTP ' + res.status));
      err.status = res.status;
      err.body = json || text;
      if (!isRetryableStatus(res.status) || i === attempts - 1) throw err;
      lastErr = err;
      const wait = retryAfterMs(res, delays[i] + Math.floor(Math.random() * 250));
      await sleep(wait);
    } catch (err) {
      if (err && err.status && !isRetryableStatus(err.status)) throw err;
      lastErr = err;
      if (i === attempts - 1) throw err;
      await sleep(delays[i]);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function sendEmail(payload) {
  const kind = payload.kind;
  const to = String(payload.to || '').trim();
  const vars = payload.variables || {};
  const rendered = render(kind, vars);
  const message = {
    kind,
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    variables: vars,
    idempotencyKey: payload.idempotencyKey,
    actionUrl: vars.ACTION_URL || vars.APP_URL || '',
  };
  if (customSender) return customSender(message);

  const cfg = config();
  if (!cfg.apiKey) {
    console.log('[email:dev] ' + kind + ' to ' + to + '\nSubject: ' + rendered.subject + '\n' + rendered.text + '\n');
    return { id: 'dev-log', dev: true };
  }

  const templateId = cfg.templates[kind];
  const body = {
    from: cfg.from,
    to: [to],
    subject: rendered.subject,
  };
  if (templateId) {
    body.template = { id: templateId, variables: vars };
  } else {
    body.html = rendered.html;
    body.text = rendered.text;
  }

  return sendWithRetry(body, payload.idempotencyKey, cfg.apiKey);
}

function sendVerification({ to, name, url, expiresIn, idempotencyKey }) {
  return sendEmail({
    kind: 'verify',
    to,
    idempotencyKey,
    variables: { NAME: name || 'there', ACTION_URL: url, EXPIRES_IN: expiresIn || '24 hours' },
  });
}

function sendPasswordReset({ to, name, url, expiresIn, idempotencyKey }) {
  return sendEmail({
    kind: 'reset',
    to,
    idempotencyKey,
    variables: { NAME: name || 'there', ACTION_URL: url, EXPIRES_IN: expiresIn || '1 hour' },
  });
}

function sendWelcome({ to, name, url, idempotencyKey }) {
  return sendEmail({
    kind: 'welcome',
    to,
    idempotencyKey,
    variables: { NAME: name || 'there', APP_URL: url },
  });
}

module.exports = {
  DEFAULT_FROM,
  config,
  render,
  setSender,
  setFetch,
  setRetryDelays,
  sendEmail,
  sendVerification,
  sendPasswordReset,
  sendWelcome,
  sendWithRetry,
};
