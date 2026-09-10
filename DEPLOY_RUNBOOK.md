# MXDBLR — Deploy Runbook (Hostinger VPS, shared with herotvmounting.com)

**Target:** `200.141.10.61` · `srv1872938.hstgr.cloud` · Ubuntu
**Domains:** `mxdblr.com`, `www.mxdblr.com`, `api.mxdblr.com` — DNS already live ✅
**Also on this box:** herotvmounting.com, in production. Do not disturb it.

Work through the phases in order. **Every phase ends with a check.** If a check
does not produce the stated output, stop and report it rather than continuing —
on this server a wrong move affects a second client.

Deeper explanation for any step lives in `DEPLOYMENT_GUIDE.md`; this file is the
short ordered path.

---

## Phase 0 — Recon (changes nothing)

Everything downstream depends on these answers.

```bash
echo "--- ports ---"
sudo ss -tlnp | grep -E ':(3000|4000)\b' || echo "3000/4000 FREE"
echo "--- installed ---"
(node -v; npm -v; pm2 -v; psql --version; nginx -v) 2>&1
echo "--- nginx upstreams already declared ---"
grep -rh "^upstream" /etc/nginx/sites-enabled/ 2>/dev/null || echo "none"
echo "--- existing databases ---"
sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datistemplate=false" 2>/dev/null || echo "postgres not installed"
echo "--- resources ---"
free -h | head -2; df -h / | tail -1; nproc
```

**How to read it:**

| Result | Action |
|---|---|
| `3000/4000 FREE` | Good, continue |
| Either port in use | **Stop.** Ports must change in `ecosystem.config.js`, `mxdblr-bootstrap.conf` and `.env` |
| `node -v` < v20 or missing | Install Node 20 (Phase 1) |
| `pm2` missing | Install (Phase 1) |
| `psql` present | Do **not** install Postgres again — reuse the cluster |
| upstream named `mxdblr_api`/`mxdblr_web` | **Stop.** Rename ours before proceeding |

---

## Phase 1 — Dedicated user and prerequisites

As **root**. The separate user is what keeps PM2 isolated from the other site —
PM2 runs one daemon per user, so this app can never stop the other one's processes.

```bash
adduser --disabled-password --gecos "" mxdblr
usermod -aG sudo mxdblr
mkdir -p /home/mxdblr/app
chown -R mxdblr:mxdblr /home/mxdblr
chmod 750 /home/mxdblr
```

Install only what Phase 0 reported missing:

```bash
# Node 20 (skip if already v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# PM2 (skip if present)
sudo npm install -g pm2

# Postgres — ONLY if psql was missing. Never add a second cluster.
sudo apt install -y postgresql postgresql-client
```

**Check:**

```bash
id mxdblr && node -v && pm2 -v && psql --version
```

---

## Phase 2 — Database

As **root**. Replace `STRONG_DB_PASSWORD` with a generated value
(`openssl rand -base64 24`) and keep it — Phase 3 needs it.

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE mxdblr;
CREATE USER mxdblr_user WITH ENCRYPTED PASSWORD 'STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE mxdblr TO mxdblr_user;
REVOKE CONNECT ON DATABASE mxdblr FROM PUBLIC;
GRANT  CONNECT ON DATABASE mxdblr TO mxdblr_user;
SQL

sudo -u postgres psql -d mxdblr <<'SQL'
GRANT ALL ON SCHEMA public TO mxdblr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mxdblr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mxdblr_user;
SQL
```

**Check** — the first must succeed, the second must be **denied**:

```bash
psql "postgresql://mxdblr_user:STRONG_DB_PASSWORD@localhost:5432/mxdblr" -c 'SELECT 1' && echo "own DB OK"
psql "postgresql://mxdblr_user:STRONG_DB_PASSWORD@localhost:5432/postgres" -c '\l' 2>&1 | head -1
# expect: FATAL: permission denied for database "postgres"
```

If the second one *succeeds*, this role can read the other client's data. Stop and
revoke before continuing.

---

## Phase 3 — Code and configuration

As **mxdblr** (`sudo -iu mxdblr`).

```bash
cd /home/mxdblr
git clone https://github.com/Ankitshankhala/Mxdblr.git app
cd app && git log --oneline -1     # note this hash: it is your rollback point
```

Create `api/.env` — values from your prepared `api.env.production`:

```bash
nano /home/mxdblr/app/api/.env
chmod 600 /home/mxdblr/app/api/.env
```

Required (the API refuses to boot without them):

```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://mxdblr_user:STRONG_DB_PASSWORD@localhost:5432/mxdblr
JWT_SECRET=<the generated 64-char value>
JWT_EXPIRES_IN=365d
SETTINGS_ENCRYPTION_KEY=<the generated 64-char value>
WHATSAPP_BUSINESS_NUMBER=919029363910
```

Deliberately omitted — each prints a warning at boot, none blocks it:
`MSG91_*` (WhatsApp OTP pending Meta), `CLOUDINARY_*` (local disk), `SENTRY_DSN`
(PM2 logs). **`ENABLE_OTP_BYPASS` must not appear at all.**

Then `web/.env.local`:

```bash
nano /home/mxdblr/app/web/.env.local
chmod 600 /home/mxdblr/app/web/.env.local
```

```
NEXT_PUBLIC_API_URL=https://api.mxdblr.com/api
INTERNAL_API_URL=http://localhost:4000
NEXT_PUBLIC_WHATSAPP_NUMBER=919029363910
JWT_SECRET=<byte-identical to the API's JWT_SECRET>
```

Build and migrate:

```bash
cd /home/mxdblr/app/api
npm ci && npx prisma generate --schema=src/prisma/schema.prisma
npx prisma migrate deploy --schema=src/prisma/schema.prisma
npm run build

cd /home/mxdblr/app/web
npm ci && npm run build
```

**Check:**

```bash
ls /home/mxdblr/app/api/dist/index.js && cat /home/mxdblr/app/web/.next/BUILD_ID
```

Both must exist. (`next.config.ts` also emits `.next/standalone/` for container
builds — this PM2 deploy runs `next start` against the normal `.next` output and
does not use it.)

---

## Phase 4 — Start under PM2

As **mxdblr**. Confirm the API starts in the foreground first — it prints exactly
what is wrong if the environment is incomplete, which PM2 would hide.

```bash
cd /home/mxdblr/app/api
node dist/index.js
# expect: three [WARN] lines, then "Server running on port 4000 (production)"
# Ctrl-C once you see it
```

If it prints `[FATAL] Refusing to start`, fix what it names and repeat. Then:

```bash
cd /home/mxdblr/app/api && pm2 start ecosystem.config.js --env production
cd /home/mxdblr/app/web && pm2 start "npm run start" --name mxdblr-web
pm2 save
pm2 startup     # run the printed sudo command exactly — it is user-specific
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

**Check:**

```bash
pm2 list                                    # mxdblr-api, mxdblr-web both online
curl -s http://127.0.0.1:4000/health        # {"status":"ok",...}
curl -s -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:3000
```

---

## Phase 5 — nginx

As **mxdblr** (sudo). HTTP only for now — the TLS config references certificates
that do not exist yet.

```bash
sudo cp /home/mxdblr/app/nginx/mxdblr-bootstrap.conf /etc/nginx/sites-available/mxdblr.conf
sudo ln -s /etc/nginx/sites-available/mxdblr.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**If `nginx -t` fails, do NOT reload.** A broken config blocks reloads for the
other site too. Report the error.

**Check** — the third line is the one that proves no collateral damage:

```bash
curl -s -o /dev/null -w "web    %{http_code}\n" -H "Host: mxdblr.com" http://127.0.0.1
curl -s -H "Host: api.mxdblr.com" http://127.0.0.1/health
curl -sk -o /dev/null -w "herotv %{http_code}\n" -H "Host: herotvmounting.com" https://127.0.0.1
```

---

## Phase 6 — Certificates

Always pass `-d`. A bare `certbot --nginx` rewrites every vhost on the box.

```bash
sudo certbot --nginx -d mxdblr.com -d www.mxdblr.com
sudo certbot --nginx -d api.mxdblr.com
sudo nginx -t && sudo systemctl reload nginx
```

**Check, from your own machine:**

```bash
curl -sI https://mxdblr.com | head -1
echo | openssl s_client -connect mxdblr.com:443 -servername mxdblr.com 2>/dev/null | openssl x509 -noout -subject
# expect: subject=CN=mxdblr.com
```

---

## Phase 7 — Go-live verification

```bash
curl -sI https://mxdblr.com | head -1                 # 200
curl -s  https://api.mxdblr.com/health                # {"status":"ok",...}
curl -sI https://herotvmounting.com | head -1         # 200 — still fine
pm2 logs mxdblr-api --err --lines 50 --nostream       # no unexpected errors
df -h / | tail -1                                     # disk headroom
```

Then in a browser: catalog loads, product images render, admin login works, and
**Admin → Dealers → Issue Login Code** mints a code — that is the only way dealers
can sign in until WhatsApp OTP is approved.

---

## Rollback

```bash
cd /home/mxdblr/app
git checkout <previous-good-hash>
cd api && npm ci && npm run build && pm2 restart mxdblr-api
cd ../web && npm ci && npm run build && pm2 restart mxdblr-web
```

A code rollback does **not** undo a migration. Additive migrations are safe to roll
back past; a destructive one needs a compensating migration written first.

---

## Never run these on this box

They act on everything, including the other client's site:

```
pm2 restart all      pm2 stop all      pm2 delete all      pm2 kill
sudo systemctl restart nginx        (use reload, after nginx -t)
sudo certbot --nginx                (without -d)
sudo rm /etc/nginx/sites-enabled/default
```
