# Togisumasu (self-hosted)

**Togisumasu** (研ぎ澄ます) means **“to sharpen the mind.”** It is mastery-based practice for mathematics and statistics, starting with algebra and trigonometry and built to grow into college-level and postgraduate subjects. Each person who signs in sees only their own progress. The short domain is **sumasu.xyz**.

- **Zero npm dependencies.** Uses Node 22's built-in `http`, `crypto` and `sqlite`.
- **One data file.** Everything, including the question bank, lives in `/data/togisumasu.sqlite` inside the container.
- **Questions come from SQLite.** The server generates, stores and serves them; an FTS5 index makes similar questions easy to find.
- **Light (black and white) and dark themes.** Use the moon/sun button in the header.
- **Optional AI tutor.** An "Explain my mistake" button uses an LLM you configure on the server (DeepSeek, OpenAI, Anthropic, Gemini, OpenRouter, Ollama or any OpenAI-compatible API).

**To deploy it online, see [DEPLOY.md](DEPLOY.md).** It covers a rented server with HTTPS, home hosting through Cloudflare Tunnel, updates and backups.

## Quick start

```bash
cp .env.example .env          # optional: add AI settings
docker compose up -d --build
# open http://localhost:3000 and create your account
```

Without Docker (Node 22.5 or newer):

```bash
npm start          # http://localhost:3000, data in ./data
npm test           # 85 tests: auth, isolation, question bank, admin, rate limits, AI tutor
npm run ai:check   # test your LLM settings
npm run questions:seed -- 20   # optional: pre-generate 20 questions per topic
npm run admin -- promote you@example.com   # make an existing account an admin
```

## Settings (`.env`)

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port to listen on. |
| `DATA_DIR` | `./data` (`/data` in Docker) | Where `togisumasu.sqlite` lives. |
| `QUESTION_SEED_PER_SKILL` | `8` | Questions pre-generated per topic on first start. More are added on demand. |
| `ALLOW_REGISTRATION` | `true` | Set to `false` once your account(s) exist. |
| `ADMIN_EMAIL` | (empty) | Comma-separated email(s) that become admin on registration or startup. Leave empty and use `node admin.js promote` instead. |
| `SESSION_DAYS` | `30` | How long a sign-in lasts. |
| `COOKIE_SECURE` | `auto` | `auto` marks the cookie Secure on HTTPS requests; `true` forces it. |
| `TRUST_PROXY` | `false` | `true` only behind a reverse proxy. The production compose files set it for you. |
| `LLM_PROVIDER` | (empty, so off) | `openai`, `deepseek`, `anthropic`, `gemini`, `openrouter`, `ollama` or `custom`. |
| `LLM_API_KEY` | | Your provider key. It stays on the server. |
| `LLM_MODEL` | provider default | The provider's model id. Required except for `deepseek` and `anthropic`. |
| `LLM_BASE_URL` | provider default | Required for `custom`. Use it to point at a proxy or a local model. |
| `LLM_DAILY_LIMIT` | `30` | AI explanations per learner per day. |
| `LLM_MAX_TOKENS` | `700` | Maximum reply length. |
| `LLM_TIMEOUT_MS` | `30000` | How long to wait for the provider. |

## Third-party services

- **Sign-in:** none. Accounts, passwords and sessions are handled entirely by this server and stored in its SQLite file. No Google, Auth0, Firebase or similar is involved.
- **AI tutor:** only if you turn it on. The server sends the question, the correct answer, the worked solution and the learner's answer to your chosen provider. It never sends names, emails or other account details.
- **In the browser:** the page loads MathJax (maths rendering) from cdnjs.cloudflare.com and fonts from Google Fonts. These requests come from the visitor's browser, not your server. They can be self-hosted later if you want zero outside requests.

## How auth works

- Passwords are hashed with **scrypt** (random salt per user) and compared in constant time.
- Sessions use a random 256-bit token in an `HttpOnly; SameSite=Lax` cookie. Only its SHA-256 hash is stored.
- Every progress and AI query is keyed by the signed-in user's id, so one account can't touch another's data.
- Question reads require a session but are shared; only health, config, registration and login are public.
- Users can change their own name and password from **Settings** in the header. Changing a password keeps the current session and signs out other devices.
- Admins have a role and a `/admin` page. They can list/disable/restore/delete users, reset passwords, reset progress, curate questions and review an audit log. Disabled or deleted accounts cannot sign in and their sessions are revoked.
- Unknown emails and wrong passwords get the same error and take the same time.
- Login, registration and the AI tutor are rate-limited.
- API writes must be JSON, which, with SameSite cookies, blocks cross-site form posts.
- A Content Security Policy allows only the MathJax CDN and Google Fonts.

The browser keeps a per-user cache of your progress and a small cache of recently fetched questions. If the server is unreachable you can keep practising from the cached questions, and progress syncs when the connection returns.

## Question bank

The authoritative question bank lives in the server's SQLite database. Question templates are shared in `public/core.js`, and the browser fetches every practice question and worked example from the API (with a small local cache and generator fallback when offline). On startup the server fills the `questions` table (`QUESTION_SEED_PER_SKILL`, default 8 per topic), and when a learner exhausts the unseen ones it generates and stores more. Each question is stored with its prompt, hint, worked steps, answer data and a fingerprint used to avoid repeats.

`prompt_text` is indexed with **FTS5**, so operators can look up similar questions without any extra service:

```bash
node questions.js seed 20     # fill 20 questions per topic
node questions.js            # show the bank size and FTS5 status
```

The same data is available to signed-in users through `/api/questions/:id/similar` and `/api/questions/search`.

## Admin

The first admin can be bootstrapped with `ADMIN_EMAIL` in `.env`, or by making an existing account an admin:

```bash
npm run admin -- promote you@example.com
# inside Docker:
docker exec togisumasu node admin.js promote you@example.com
```

Then open **`/admin`**. The page has three areas:

- **Users** — search, disable/enable, soft-delete/restore, promote/demote admins, issue a one-time temporary password, and reset progress for everything, one whole unit, or one topic. A reset signs that user out so their next sign-in starts clean. You cannot disable, demote or delete your own account, and the last active admin is protected.
- **Questions** — filter by topic/status/source, edit or hide/delete generated questions, and add manual questions. Manual questions are stored with `source='manual'` and are never overwritten by seeding. The editor has a live MathJax preview, duplicate-prompt detection, the real answer checker, and bulk JSON/CSV import-export.
- **Audit log** — every admin change is recorded with the acting admin, action, target and details. Passwords are never written to the log.

Question edits are versionless: changing a prompt gives it a new fingerprint, so learners may see the edited version as a new question. Hiding a question removes it from practice and search without deleting its history.

## API

| Method | Path | Auth | Body / result |
|---|---|---|---|
| GET | `/api/health` | – | `{ok:true}` |
| GET | `/api/auth/config` | – | `{registration, ai}` |
| POST | `/api/auth/register` | – | `{email, name, password}` returns 201 and sets the cookie |
| POST | `/api/auth/login` | – | `{email, password}` |
| POST | `/api/auth/logout` | cookie | Clears the session |
| GET | `/api/auth/me` | cookie | `{user}` |
| GET | `/api/progress` | cookie | `{data, updatedAt}` |
| PUT | `/api/progress` | cookie | `{data}`, where `data.skills` must be an object |
| PATCH | `/api/account` | cookie | `{name?, currentPassword?, newPassword?}` updates the signed-in account |
| GET | `/api/questions/next?skill=ID&exclude=FPS` | cookie | `{question}`, or generates and stores one if every match is excluded |
| GET | `/api/questions/search?q=TEXT&limit=10` | cookie | `{items}` from the FTS5 index |
| GET | `/api/questions/:id` | cookie | `{question}` for an active question |
| GET | `/api/questions/:id/similar?limit=5` | cookie | `{items}` of lexically similar questions, same topic first |
| POST | `/api/ai/explain` | cookie | `{topic, prompt, answer, given, steps}` returns `{text, remaining}` |
| GET | `/api/admin/users?q=&status=&limit=&offset=` | admin | `{items, total, limit, offset}` |
| PATCH | `/api/admin/users/:id` | admin | `{role?, status?}` for role or active/disabled changes |
| POST | `/api/admin/users/:id/reset-password` | admin | Returns `{password}` once and revokes that user's sessions |
| POST | `/api/admin/users/:id/reset-progress` | admin | `{scope:'all'\|'unit'\|'skill', value}` resets progress and revokes sessions |
| DELETE | `/api/admin/users/:id` | admin | Soft-deletes the account and revokes sessions |
| POST | `/api/admin/users/:id/restore` | admin | Restores a disabled or deleted account |
| GET | `/api/admin/questions?skill=&status=&source=&q=` | admin | Question list with filters |
| POST | `/api/admin/questions` | admin | `{skillId, question}` creates a manual question |
| PATCH | `/api/admin/questions/:id` | admin | `{question?, skillId?, status?}` edits or hides a question |
| DELETE | `/api/admin/questions/:id` | admin | Soft-deletes a question |
| POST | `/api/admin/questions/test` | admin | `{question, answer}` runs the real answer checker |
| POST | `/api/admin/questions/duplicate` | admin | `{skillId, prompt, excludeId?}` checks for a duplicate prompt |
| GET | `/api/admin/questions/export?format=json\|csv` | admin | Downloads the filtered question set |
| POST | `/api/admin/questions/import` | admin | `{format:'json'\|'csv', text}` bulk-imports questions |
| GET | `/api/admin/audit?limit=100` | admin | Recent admin changes |

## Files

```
server.js                  API, auth, admin routes, static files
questions.js               SQLite question bank, FTS5 similarity, validation and seeding
admin.js                   operator CLI: promote/demote/disable/delete accounts
ai.js                      LLM providers and the tutor prompt (`node ai.js check` tests it)
public/core.js             maths parser, answer checking, skill definitions and generators
public/index.html          the app UI and learning engine
public/admin.html          the /admin UI for users, questions and audit history
test/                      API, admin and AI tests
Dockerfile                 image (node:22-alpine, runs as non-root, health check)
docker-compose.yml         local
docker-compose.prod.yml    server with a domain: app + Caddy (automatic HTTPS)
docker-compose.tunnel.yml  home machine: app + Cloudflare Tunnel
Caddyfile, .env.example, backup.sh
DEPLOY.md                  step-by-step deployment guide
```
