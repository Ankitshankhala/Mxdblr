# MXDBLR — Hostinger VPS KVM 2 Deployment Guide

**Server:** Hostinger KVM 2 · Ubuntu 22.04 · 2 vCPU · 8 GB RAM · 100 GB NVMe  
**Stack:** Next.js 15 + Express API + PostgreSQL 15 + PM2 + Nginx + Certbot  
**Prepared by:** Charu Solutions DevOps  

---

## ⚠️ THIS VPS IS SHARED — READ FIRST

`200.141.10.61` (`srv1872938.hstgr.cloud`) already serves **herotvmounting.com** in
production: nginx 1.24.0 on Ubuntu, with a live Let's Encrypt certificate for
`herotvmounting.com` and `www.herotvmounting.com`.

Running two sites on one VPS is normal and safe — nginx virtual hosts exist for it.
It only goes wrong when the two deployments share something they shouldn't. This
section makes each layer separate **by construction**, so isolation does not depend
on anyone remembering to be careful.

### The isolation model

| Layer | How MXDBLR is separated |
|---|---|
| **Linux user** | Own user `mxdblr`. This is the important one — see below. |
| **PM2** | Runs as `mxdblr`, so it is a *different daemon* from the other site's. |
| **nginx** | Own file `sites-available/mxdblr.conf`, routed by `server_name`. The other vhost is never edited. |
| **nginx upstreams** | Named `mxdblr_api` / `mxdblr_web`. Upstream names are **global** across all loaded files — duplicates take both sites down. |
| **Postgres** | Own role `mxdblr` owning only database `mxdblr`. Not a superuser. |
| **Files** | Everything under `/home/mxdblr/app/`, mode 750. |
| **Ports** | 3000 / 4000 bound to `127.0.0.1` only — never exposed publicly. |

### Why the dedicated Linux user matters most

**PM2 runs one daemon per user.** With MXDBLR under its own account, `pm2 delete all`
run as `mxdblr` cannot see, stop or touch the other site's processes — they belong to
a different daemon with a different process list. The single most likely way to cause
an outage stops being possible rather than merely discouraged.

It also means file permissions isolate the two apps: a compromised MXDBLR process
cannot read the other site's `.env`, and vice versa.

```bash
# As root, once:
sudo adduser --disabled-password --gecos "" mxdblr
sudo mkdir -p /home/mxdblr/app && sudo chown -R mxdblr:mxdblr /home/mxdblr
sudo chmod 750 /home/mxdblr

# Everything else in this guide runs as that user:
sudo -iu mxdblr
```

Give PM2 its own boot entry for this user — the command `pm2 startup` prints is
user-specific, so both sites survive a reboot independently:

```bash
# as mxdblr
pm2 startup            # run the printed sudo command exactly
pm2 save
```

### The two things that are still genuinely shared

Per-user isolation does not cover these, so they need care:

**1. nginx.** One process serves both sites. A broken config file takes down
everything, so validate before every reload — `nginx -t` checks the *whole* config:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Use `reload` (graceful), never `restart` (drops live connections for every site).
And always pass `-d` to certbot — a bare `sudo certbot --nginx` will rewrite the
other client's vhost:

```bash
sudo certbot --nginx -d mxdblr.com -d www.mxdblr.com
sudo certbot --nginx -d api.mxdblr.com
```

**2. CPU, RAM and disk.** 2 vCPU / 8 GB / 100 GB is comfortable for both, but MXDBLR
must stay a good neighbour: the API is capped at 1 cluster worker with a 512 MB
`max_memory_restart`, and PM2 log rotation (§9.1) keeps logs from filling the disk
Postgres shares. Watch with `pm2 monit` and `df -h /` after launch.

> If either site later outgrows this, the clean fix is a second VPS — not tuning.

---

## Pre-Deployment Checklist

Before touching the server:

- [ ] GoDaddy **Forwarding removed** for `mxdblr.com` — it silently overrides A records
- [ ] TTL lowered to 600s first, old TTL allowed to expire, *then* records changed
- [ ] `mxdblr.com` DNS A record → `200.141.10.61` (currently GoDaddy parking)
- [ ] `www.mxdblr.com` — existing CNAME → `mxdblr.com` is fine, it follows the apex
- [ ] `api.mxdblr.com` DNS A record → `200.141.10.61` (**does not exist yet**)
- [ ] DNS propagated — verify at [whatsmydns.net](https://whatsmydns.net)
- [ ] Ports 3000 and 4000 confirmed FREE on the VPS (`sudo ss -tlnp | grep -E ':(3000|4000)'`)
- [ ] Existing nginx upstream names checked for collisions
      (`grep -rh "^upstream" /etc/nginx/sites-enabled/`)
- [ ] Postgres present, and its major version noted (the app targets 15/16)
- [ ] Project builds locally without errors (`npm run build` passes in both `api/` and `web/`)
- [ ] All environment variable values documented and ready
- [ ] SSH access to the VPS confirmed

> DNS records are managed at **GoDaddy** (`ns47/ns48.domaincontrol.com`), not Hostinger.
> Certbot cannot issue certificates until the records resolve to this VPS.

---

## 1. Initial VPS Setup

### 1.1 — SSH in as root

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 — Update system packages

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip ufw fail2ban
```

### 1.3 — Create the dedicated `mxdblr` user

Skip if you already created it in the shared-VPS section above. This user owns the
app, its files, and — critically — its own PM2 daemon.

```bash
adduser --disabled-password --gecos "" mxdblr
usermod -aG sudo mxdblr          # needed for nginx/certbot steps only
mkdir -p /home/mxdblr/app
chown -R mxdblr:mxdblr /home/mxdblr
chmod 750 /home/mxdblr           # the other site's user cannot read into it
```

> Do **not** reuse whatever user runs herotvmounting.com. Sharing the account
> merges the two PM2 daemons and undoes the isolation this whole section buys.

### 1.4 — Copy SSH public key to the mxdblr user

Run on your **local machine**:

```bash
ssh-copy-id mxdblr@YOUR_VPS_IP
```

Or manually on the server:

```bash
mkdir -p /home/mxdblr/.ssh
chmod 700 /home/mxdblr/.ssh
nano /home/mxdblr/.ssh/authorized_keys   # paste your local ~/.ssh/id_rsa.pub
chmod 600 /home/mxdblr/.ssh/authorized_keys
chown -R mxdblr:mxdblr /home/mxdblr/.ssh
```

### 1.5 — Harden SSH

```bash
nano /etc/ssh/sshd_config
```

Set these values (add if missing, change if present):

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
X11Forwarding no
MaxAuthTries 3
```

```bash
systemctl restart sshd
```

> **Important:** Open a new terminal and verify `ssh mxdblr@YOUR_VPS_IP` works before closing your root session.

### 1.6 — Set timezone

```bash
sudo timedatectl set-timezone Asia/Kolkata
```

---

## 2. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # v20.x.x
npm --version
```

---

## 3. Install PostgreSQL 15

### 3.1 — Install

```bash
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15

sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.2 — Create database and user

```bash
sudo -u postgres psql
```

Inside the PostgreSQL shell:

> **Install Postgres only if it isn't already there.** This box may already run it
> for the other site. Check first with `psql --version` — a second cluster on the
> same host is a configuration mess you don't want. One Postgres, two databases.

```sql
CREATE DATABASE mxdblr;
CREATE USER mxdblr_user WITH ENCRYPTED PASSWORD 'STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE mxdblr TO mxdblr_user;
\c mxdblr
GRANT ALL ON SCHEMA public TO mxdblr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mxdblr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mxdblr_user;
\q
```

**Then close the cross-database hole.** Postgres grants `CONNECT` on every database
to `PUBLIC` by default, so as created above `mxdblr_user` can connect to the other
client's database and read anything not separately restricted. Revoke it:

```sql
-- Lock the MXDBLR database to its own role
REVOKE CONNECT ON DATABASE mxdblr FROM PUBLIC;
GRANT  CONNECT ON DATABASE mxdblr TO mxdblr_user;

-- And keep this role out of every other database on the cluster.
-- Run once per existing database (list them with \l):
-- REVOKE CONNECT ON DATABASE <other_db> FROM PUBLIC;
\q
```

Verify the isolation actually holds — this should be **denied**:

```bash
psql "postgresql://mxdblr_user:STRONG_DB_PASSWORD@localhost:5432/postgres" -c '\l'
# expected: FATAL: permission denied for database "postgres"
```

### 3.3 — Test connection

```bash
psql -U mxdblr_user -d mxdblr -h localhost -W
# Enter password — should connect. Then:
\q
```

---

## 4. Install PM2 and Nginx

```bash
sudo npm install -g pm2

sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 5. Upload Project Files

### 5.1 — Create web root

```bash
sudo chown -R mxdblr:mxdblr /home/mxdblr/app
sudo chmod 750 /home/mxdblr
```

### 5.2 — Clone from GitHub (on the VPS)

The project now lives at **https://github.com/Ankitshankhala/Mxdblr**, so pull the
code on the server rather than pushing a copy of your laptop at it. Deploys then
correspond to a commit you can name, diff and roll back to.

```bash
cd /var/www
git clone https://github.com/Ankitshankhala/Mxdblr.git mxdblr
cd mxdblr && git log --oneline -1
```

Private repo → generate a deploy key on the VPS and add it to the repo under
Settings → Deploy keys (read-only):

```bash
ssh-keygen -t ed25519 -C "mxdblr-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
git clone git@github.com:Ankitshankhala/Mxdblr.git mxdblr
```

`.env` / `.env.local` are gitignored, so they are never cloned — you create them
directly on the server in Step 6, and they survive every later `git pull`.

> Do NOT rsync or SFTP the project across. It silently ships whatever is on your
> laptop — uncommitted edits, stale files, local `.env` — so the server stops
> matching any commit and nothing is reproducible or reviewable.

### 5.3 — Expected directory structure

```
/home/mxdblr/app/
├── api/
│   ├── src/
│   │   ├── prisma/schema.prisma
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                  ← created in Step 6
└── web/
    ├── app/
    ├── components/
    ├── public/
    ├── package.json
    ├── next.config.ts
    └── .env.local            ← created in Step 6
```

---

## 6. Configure Environment Variables

### 6.1 — Generate a secure JWT secret

```bash
openssl rand -base64 32
# Copy the output — use it as JWT_SECRET below
```

### 6.2 — API environment file

```bash
nano /home/mxdblr/app/api/.env
```

```env
NODE_ENV=production
PORT=4000

# PostgreSQL — local instance
DATABASE_URL="postgresql://mxdblr_user:STRONG_DB_PASSWORD@localhost:5432/mxdblr?schema=public"

# JWT — use the openssl output
JWT_SECRET=PASTE_OPENSSL_OUTPUT_HERE
JWT_EXPIRES_IN=7d

# MSG91 (OTP)
MSG91_AUTH_KEY=your_msg91_key
MSG91_SENDER_ID=MXDBLR

# Cloudinary (image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# WhatsApp
WHATSAPP_BUSINESS_NUMBER=919XXXXXXXXXX
```

```bash
chmod 600 /home/mxdblr/app/api/.env
```

### 6.3 — Frontend environment file

```bash
nano /home/mxdblr/app/web/.env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.mxdblr.com
```

```bash
chmod 600 /home/mxdblr/app/web/.env.local
```

---

## 7. Build and Start the API

```bash
cd /home/mxdblr/app/api

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate --schema=src/prisma/schema.prisma

# Run database migrations
npx prisma migrate deploy --schema=src/prisma/schema.prisma

# Compile TypeScript
npm run build

# Start with PM2
pm2 start dist/index.js \
  --name mxdblr-api \
  --env production \
  --max-memory-restart 512M \
  --restart-delay 3000

# Verify
pm2 status
curl http://localhost:4000/health
# Expected: {"status":"ok"}
```

---

## 8. Build and Start the Frontend

```bash
cd /home/mxdblr/app/web

# Install dependencies
npm install

# Build Next.js production bundle
npm run build

# Start with PM2
pm2 start npm --name mxdblr-web -- start

# Verify
pm2 status
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

---

## 9. Persist PM2 Across Reboots

```bash
# Save current process list
pm2 save

# Generate startup command
pm2 startup
# PM2 prints a command — copy it exactly and run it, e.g.:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u mxdblr --hp /home/mxdblr

# Save again
pm2 save
```

Test (optional but recommended):

```bash
sudo reboot
# Wait 60 seconds, SSH back in
pm2 list
# Both processes should show: online
```

### 9.1 — Log rotation (REQUIRED, not optional)

This deploy runs with **no hosted error tracker**. PM2 logs are the entire error
record, which makes them load-bearing — and unrotated they grow until the disk is
full and Postgres starts failing writes.

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14          # ~2 weeks of history
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

Verify it took, and check disk headroom:

```bash
pm2 conf pm2-logrotate
du -sh ~/.pm2/logs && df -h / | tail -1
```

### 9.2 — Reading errors (your monitoring, in full)

Every 5xx is written to stderr with its full stack by the API's global error
handler, so these commands are how you find problems:

```bash
pm2 logs mxdblr-api --lines 100 --nostream        # recent activity
pm2 logs mxdblr-api --err --lines 200 --nostream  # errors only
grep -c "\[ERROR\] 5" ~/.pm2/logs/mxdblr-api-error.log
```

Nothing alerts you automatically. **Check these after every deploy**, and make a
habit of it in the first weeks. Two warnings printed at every boot are expected
and describe deliberate choices — OTP delivery disabled, images on local disk.

When you want alerting later, set `SENTRY_DSN` to any Sentry-protocol endpoint
(hosted Sentry or self-hosted GlitchTip) and restart. No code change.

---

## 10. Nginx Configuration

> **SHARED BOX.** Do NOT run `sudo rm /etc/nginx/sites-enabled/default` here.
> On a server with one site that is harmless boilerplate; on this one, removing or
> reassigning the default server changes which vhost catches unmatched hostnames
> and can break herotvmounting.com. Leave every existing file alone. MXDBLR only
> ever ADDS a file.

### Why mxdblr.com currently shows the other site

DNS answers "which machine"; nginx answers "which site", by matching the browser's
`Host` header against `server_name`. With no MXDBLR vhost installed, nothing matches
`mxdblr.com`, so nginx falls back to the default server — which is
herotvmounting.com. That is also why you see its certificate. Installing the vhost
below fixes both symptoms at once.

### 10.1 — Install the bootstrap config (HTTP only)

The full `nginx/mxdblr.conf` in this repo references `/etc/letsencrypt/live/...`
certificates that do not exist yet. Installing it before Certbot runs makes
`nginx -t` fail, and you cannot reload — which on this box also blocks the other
site from reloading. Start HTTP-only instead:

```bash
cd /home/mxdblr/app
sudo cp nginx/mxdblr-bootstrap.conf /etc/nginx/sites-available/mxdblr.conf
sudo ln -s /etc/nginx/sites-available/mxdblr.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

If `nginx -t` reports a duplicate upstream, the other site already uses that name —
rename ours in the file and retry. **Never reload on a failed test.**

### 10.2 — Verify routing before adding TLS

Both apps must already be running under PM2 for these to return content:

```bash
curl -s -o /dev/null -w "web %{http_code}\n" -H "Host: mxdblr.com" http://127.0.0.1
curl -s -H "Host: api.mxdblr.com" http://127.0.0.1/health
# expect: {"status":"ok","service":"mxdblr-api",...}
```

And confirm the other site still works — this is the check that catches collateral
damage early:

```bash
curl -sk -o /dev/null -w "herotv %{http_code}\n" -H "Host: herotvmounting.com" https://127.0.0.1
```

### 10.3 — Issue certificates

Certbot edits `mxdblr.conf` in place, adding the TLS server blocks and the
HTTP→HTTPS redirect. Always pass `-d`; a bare `certbot --nginx` rewrites every vhost
on the box, including the other client's.

```bash
sudo certbot --nginx -d mxdblr.com -d www.mxdblr.com
sudo certbot --nginx -d api.mxdblr.com
sudo nginx -t && sudo systemctl reload nginx
```

Verify from your own machine, not the server:

```bash
curl -sI https://mxdblr.com | head -1
echo | openssl s_client -connect mxdblr.com:443 -servername mxdblr.com 2>/dev/null | openssl x509 -noout -subject -dates
```

The subject must read `CN=mxdblr.com`. If it still says `herotvmounting.com`, the
vhost is not matching — check the `server_name` spelling and that the symlink in
`sites-enabled/` exists.

`nginx/mxdblr.conf` in the repo documents the end state Certbot produces. You do not
install it by hand; it is there for reference and review.


## 11. Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow 22/tcp     # SSH — always first
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS

sudo ufw --force enable
sudo ufw status verbose
```

> Ports 3000 (Next.js) and 4000 (Express) are intentionally **not** opened publicly — Nginx handles all traffic internally.

---

## 12. SSL with Certbot (Let's Encrypt)

### 12.1 — Install Certbot

```bash
sudo apt install -y snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

### 12.2 — Obtain certificates

```bash
sudo certbot --nginx \
  -d mxdblr.com \
  -d www.mxdblr.com \
  -d api.mxdblr.com \
  --non-interactive \
  --agree-tos \
  --email ankiit.team@charusolutions.com
```

Certbot automatically:
- Verifies domain ownership via HTTP challenge
- Obtains certificates from Let's Encrypt
- Updates your Nginx configs with HTTPS blocks and HTTP→HTTPS redirects

### 12.3 — Verify auto-renewal

```bash
sudo certbot renew --dry-run
# Expected: "All simulated renewals succeeded"

sudo systemctl status snap.certbot.renew.timer
# Should be active
```

---

## 13. Verify Deployment

Run all checks in order. Every check must pass before going live.

```bash
# 1. Both processes running
pm2 list

# 2. API health (direct)
curl http://localhost:4000/health
# Expected: {"status":"ok"}

# 3. Frontend (direct)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# 4. Frontend over HTTPS
curl -s -o /dev/null -w "%{http_code}" https://mxdblr.com
# Expected: 200

# 5. API over HTTPS
curl -s https://api.mxdblr.com/health
# Expected: {"status":"ok"}

# 6. HTTP redirects to HTTPS
curl -s -o /dev/null -w "%{http_code}" http://mxdblr.com
# Expected: 301

# 7. Database tables exist
psql -U mxdblr_user -d mxdblr -h localhost -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# 8. Firewall — only 22, 80, 443 open
sudo ufw status

# 9. SSL certificate info
sudo certbot certificates
```

---

## 14. Deploy Updates (After Code Changes)

Run entirely on the VPS. Deploy only commits that are green in CI.

```bash
# 1. Pull the reviewed commit
cd /home/mxdblr/app
git pull --ff-only origin main
git log --oneline -1                 # note this hash — it is your rollback point

# 2. API — install, build, migrate, restart
cd api
npm ci                               # ci, not install: honours package-lock exactly
npm run build
npx prisma migrate deploy --schema=src/prisma/schema.prisma
pm2 restart mxdblr-api

# 3. Confirm the API actually came back up before touching the frontend.
#    With NODE_ENV=production it REFUSES to boot on missing/weak config and
#    prints exactly what is wrong — a restart that silently died shows here.
pm2 logs mxdblr-api --lines 30 --nostream
curl -fsS http://localhost:4000/health && echo " API OK"

# 4. Frontend — only once the API is healthy
cd ../web
npm ci
npm run build
pm2 restart mxdblr-web
curl -fsS -o /dev/null -w "web %{http_code}\n" http://localhost:3000
```

**Rollback** — the reason step 1 records the hash:

```bash
cd /home/mxdblr/app
git checkout <previous-good-hash>
cd api && npm ci && npm run build && pm2 restart mxdblr-api
cd ../web && npm ci && npm run build && pm2 restart mxdblr-web
```

Note that a migration is **not** undone by a code rollback. Reverting a deploy
that added a column is safe (old code ignores it); reverting one that dropped or
renamed something is not, and needs a compensating migration written first.

---

## 15. Troubleshooting

### Application not starting

```bash
pm2 logs mxdblr-api --lines 100
pm2 logs mxdblr-web --lines 100
pm2 show mxdblr-api
```

### 502 Bad Gateway

```bash
sudo tail -f /var/log/nginx/error.log
curl http://localhost:3000    # is Next.js up?
curl http://localhost:4000    # is Express up?
pm2 restart mxdblr-web
pm2 restart mxdblr-api
```

### PostgreSQL connection refused

```bash
sudo systemctl status postgresql
sudo ss -tlnp | grep 5432
psql -U mxdblr_user -d mxdblr -h localhost -W
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Prisma migration errors

```bash
cd /home/mxdblr/app/api
npx prisma migrate status --schema=src/prisma/schema.prisma
npx prisma generate --schema=src/prisma/schema.prisma
pm2 restart mxdblr-api
```

### SSL certificate issues

```bash
sudo certbot certificates         # check expiry
sudo certbot renew --force-renewal
sudo nginx -T | grep ssl_certificate
```

### Environment variable not loading

```bash
cd /home/mxdblr/app/api
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL ? 'DB URL OK' : 'MISSING')"
```

### Server memory check

```bash
free -h
pm2 monit
df -h
```

---

## Quick Reference

```bash
# Process management
pm2 list                    # view all processes
pm2 restart mxdblr-api      # restart API
pm2 restart mxdblr-web      # restart frontend
pm2 logs                    # tail all logs
pm2 monit                   # live monitoring dashboard
pm2 save                    # persist current process list

# Nginx
sudo nginx -t                          # test config syntax
sudo systemctl reload nginx            # apply config changes
sudo tail -f /var/log/nginx/error.log  # live error log

# Database
sudo -u postgres psql                  # Postgres superuser shell
psql -U mxdblr_user -d mxdblr -h localhost -W

# SSL
sudo certbot renew --dry-run           # test renewal
sudo certbot certificates              # check expiry dates

# Firewall
sudo ufw status verbose
```

---

## Architecture Summary

```
Internet
   │
   ▼
Nginx (80/443) ── SSL termination, gzip, security headers
   │
   ├── mxdblr.com ──────────► Next.js (localhost:3000) [PM2: mxdblr-web]
   │
   └── api.mxdblr.com ──────► Express API (localhost:4000) [PM2: mxdblr-api]
                                        │
                                        ▼
                               PostgreSQL 15 (localhost:5432)
                               Database: mxdblr
                               User: mxdblr_user
```

---

*Prepared by Charu Solutions DevOps*  
*Server: Hostinger VPS KVM 2 · Ubuntu 22.04*  
*Date: 2026-06-02*
