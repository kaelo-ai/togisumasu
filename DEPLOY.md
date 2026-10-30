# Deploying Togisumasu

There are three ways to run the app. All of them use the same image and the same `.env` file.

| Option | Use it when | Compose file |
|---|---|---|
| **A. Your own machine** | You're trying it out or only you use it at home | `docker-compose.yml` |
| **B. A rented server (VPS) with a domain** | You want it online with HTTPS. This is the recommended option. | `docker-compose.prod.yml` (app + Caddy) |
| **C. A machine at home, put online with Cloudflare Tunnel** | You want it online but don't want to rent a server or open router ports | `docker-compose.tunnel.yml` (app + cloudflared) |

---

## Before you start (all options)

1. Install Docker with the Compose plugin. On Ubuntu:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # then log out and back in
   docker compose version          # should print v2.24 or newer
   ```
2. Get the code onto the machine, either by unzipping the project or with `git clone`.
3. Create your settings file:
   ```bash
   cd togisumasu
   cp .env.example .env
   nano .env
   ```
   `.env` holds your secrets (the AI key). It is excluded from the Docker image and from git.

---

## A. Run it on your own machine

```bash
docker compose up -d --build
```

Open http://localhost:3000 and create your account. Other devices on your Wi-Fi can use `http://<your-computer's-IP>:3000`.

---

## B. Rented server with a domain (recommended)

### 1. Get a server

Any small Linux server with 1 vCPU and 1 GB RAM is plenty. Ubuntu 24.04 is the assumed OS.

- **Closest to South African users:** AWS EC2 in Cape Town (`af-south-1`) or Azure in South Africa North (Johannesburg). These have the lowest latency but usually cost more.
- **Cheapest:** Hetzner or DigitalOcean (Europe). They have around 150–200 ms of extra latency from South Africa, which you won't notice in this app.

When you create the server, add your SSH key. Then open ports **22, 80 and 443** in the provider's firewall.

### 2. Point a domain at it

At your domain registrar or DNS provider, add an **A record**:

```
sumasu.xyz   A   <your server's public IP>
```

Check that it has taken effect with `ping sumasu.xyz`. Changes can take a few minutes, sometimes an hour.

### 3. Copy the app to the server

From your computer:

```bash
scp togisumasu.zip you@<server-ip>:~
ssh you@<server-ip>
sudo apt-get install -y unzip && unzip togisumasu.zip && sudo mv togisumasu /opt/ && cd /opt/togisumasu
```

### 4. Configure

```bash
cp .env.example .env
nano .env
```

Set at least:

```
DOMAIN=sumasu.xyz
ALLOW_REGISTRATION=true
```

Optionally set `ADMIN_EMAIL=you@example.com` so that account becomes an admin when it registers. To turn on the AI tutor, also fill in the `LLM_` lines (see [AI tutor](#ai-tutor-optional) below).

### 5. Start it

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

Caddy fetches an HTTPS certificate from Let's Encrypt the first time someone visits. Open **https://sumasu.xyz** and create your account.

If you did not set `ADMIN_EMAIL`, promote your account now:

```bash
docker exec togisumasu node admin.js promote you@example.com
```

Open **https://sumasu.xyz/admin** to manage users, questions and the audit log.

### 6. Lock it down

1. Close sign-ups once your account (and anyone you invite) exists. In `.env` set `ALLOW_REGISTRATION=false`, then:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
2. Turn on the server firewall:
   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable
   ```
3. Install security updates automatically:
   ```bash
   sudo apt-get install -y unattended-upgrades
   ```

---

## C. Home machine with Cloudflare Tunnel

Many South African fibre and LTE connections sit behind carrier-grade NAT (CGNAT), so opening a port on your router doesn't work. A tunnel avoids the problem. Your machine makes an outgoing connection to Cloudflare, and Cloudflare serves your domain with HTTPS. You need a free Cloudflare account and a domain whose DNS is managed by Cloudflare.

1. In the Cloudflare dashboard, go to **Zero Trust → Networks → Tunnels → Create a tunnel**. Choose **Cloudflared**, give it a name and copy the **token** it shows. (Dashboard labels change from time to time; look for "Tunnels".)
2. In the tunnel's **Public Hostname** tab, add:
   - Hostname: `sumasu.xyz`
   - Service: `http://app:3000`
3. On your home machine:
   ```bash
   cp .env.example .env
   nano .env   # add the line TUNNEL_TOKEN=<the token>; DOMAIN is not used here
   docker compose -f docker-compose.tunnel.yml up -d --build
   ```
4. Open https://sumasu.xyz.

The machine has to stay on and awake for the site to stay up.

---

## Admin account

Admins can sign in at `/admin` to manage users, curate questions and review changes. Bootstrap the first admin in either way:

```bash
# 1. Promote an account that already exists:
docker exec togisumasu node admin.js promote you@example.com

# 2. Or put this in .env before that account registers:
ADMIN_EMAIL=you@example.com
```

Other useful CLI commands:

```bash
docker exec togisumasu node admin.js list
docker exec togisumasu node admin.js demote old-admin@example.com
docker exec togisumasu node admin.js disable someone@example.com
docker exec togisumasu node admin.js restore someone@example.com
```

The web UI can do the same things. It cannot disable, demote or delete the signed-in admin, and it will not remove the last active admin. Disabling or deleting an account revokes its sessions immediately. A password reset returns a temporary password once; the log never includes it. You can also reset a learner's progress for everything, one whole unit, or one topic; that signs them out so their next sign-in starts clean.

Question edits are versionless. Hiding or deleting a question removes it from practice, search and similar-question results but keeps its row for the audit trail and restore. Manual questions are marked `source='manual'` and survive regeneration and seeding. The editor includes a live preview, duplicate-prompt detection, and bulk JSON/CSV import-export.

---

## AI tutor (optional)

When a learner gets a question wrong, an **Explain my mistake** button asks an LLM what probably went wrong with their specific answer. After "Show solution", the button reads **Explain it another way** instead.

- **You** supply one key on the server. Learners never see it and can't supply their own.
- The browser only talks to your server. The server calls the provider.
- Each learner gets `LLM_DAILY_LIMIT` explanations a day (default 30), so your bill stays bounded.
- If `LLM_PROVIDER` is empty, the button doesn't appear.

Set these in `.env`:

| Provider | `LLM_PROVIDER` | `LLM_API_KEY` | `LLM_MODEL` |
|---|---|---|---|
| DeepSeek | `deepseek` | from platform.deepseek.com | optional (default `deepseek-flash`) |
| OpenAI | `openai` | from platform.openai.com | required, e.g. a current mini model from their models page |
| Anthropic (Claude) | `anthropic` | from console.anthropic.com | optional (default `claude-haiku-4-5-20251001`) |
| Google Gemini | `gemini` | from Google AI Studio | required (Gemini model id) |
| OpenRouter (many models, one key) | `openrouter` | from openrouter.ai | required, e.g. `deepseek/deepseek-chat` |
| Ollama (local, free) | `ollama` | not needed | required, e.g. `llama3.1`. Set `LLM_BASE_URL=http://host.docker.internal:11434/v1` if Ollama runs on the host. |
| Any OpenAI-compatible API | `custom` | if it needs one | required; also set `LLM_BASE_URL` |

Model names change often, so copy the exact id from your provider's model list.

After changing `.env`, restart the app and test the connection:

```bash
docker compose -f docker-compose.prod.yml up -d
docker exec togisumasu node ai.js check
```

`check` prints the provider, the model and a masked key, then sends one test message. The startup log also shows whether the AI tutor is on.

---

## Updating to a new version

```bash
cd /opt/togisumasu
./backup.sh                                    # always back up first
# replace the files with the new version (unzip over the folder, or: git pull)
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f                          # remove the old image
```

Your data is in the `togisumasu_data` Docker volume, so rebuilding the app never touches it.

---

## Backups

`./backup.sh` takes a consistent copy of the database from the running container and saves it to `./backups/`, keeping the last 14. To run it every night at 02:15, open `crontab -e` and add:

```
15 2 * * * cd /opt/togisumasu && ./backup.sh >> backups/backup.log 2>&1
```

Copies on the same server don't protect against losing the server, so now and then copy `backups/` somewhere else:

```bash
scp you@<server-ip>:/opt/togisumasu/backups/*.sqlite .
```

**To restore** a backup:

```bash
docker compose -f docker-compose.prod.yml stop app
docker run --rm -v togisumasu_data:/data -v "$PWD/backups":/b alpine \
  sh -c "cp /b/togisumasu-YYYY-MM-DD-HHMM.sqlite /data/togisumasu.sqlite && rm -f /data/togisumasu.sqlite-wal /data/togisumasu.sqlite-shm && chown 1000:1000 /data/togisumasu.sqlite"
docker compose -f docker-compose.prod.yml start app
```

The volume is `togisumasu_data`. Run `docker volume ls` to see it.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| The site doesn't load | Run `docker compose -f docker-compose.prod.yml ps` (both containers should be "Up") and look at `logs caddy`. |
| Certificate errors from Caddy | The DNS A record must point at this server, and ports 80 and 443 must be open in both the provider's firewall and `ufw`. |
| You sign in but are immediately signed out | You're on plain `http://` while `COOKIE_SECURE=true`. Use the https address. |
| "Registration is closed" | `ALLOW_REGISTRATION=false` in `.env`. That's intended once you're set up. |
| The AI button is missing | Run `docker exec togisumasu node ai.js check`; it says what's missing. |
| AI errors show in the logs | Look for lines starting with `[ai]`. They show the provider's own error, e.g. an invalid key, no credit or a wrong model id. |
| Health status | `docker inspect --format '{{.State.Health.Status}}' togisumasu` should say `healthy`. |
