# MXDBLR — Hostinger VPS KVM 2 Deployment Guide

**Server:** Hostinger KVM 2 · Ubuntu 22.04 · 2 vCPU · 8 GB RAM · 100 GB NVMe  
**Stack:** Next.js 15 + Express API + PostgreSQL 15 + PM2 + Nginx + Certbot  
**Prepared by:** Charu Solutions DevOps  

---

## ⚠️ THIS VPS IS SHARED — READ FIRST

`200.141.10.61` (`srv1872938.hstgr.cloud`) already serves **herotvmounting.com** in
production: nginx 1.24.0 on Ubuntu, with a live Let's Encrypt certificate for
`herotvmounting.com` and `www.herotvmounting.com`.

MXDBLR is being deployed **alongside** a different client's live site. Every command
below is scoped to MXDBLR on purpose. The isolation model:

| Layer | Isolation |
|---|---|
| nginx | Own file `sites-available/mxdblr.conf`, routed by `server_name`. Never edit the herotvmounting file. |
| nginx upstreams | Named `mxdblr_api` / `mxdblr_web`. Upstream names are **global** — a duplicate takes both sites down. |
| PM2 | Apps named `mxdblr-api` / `mxdblr-web`. Capped at 1 API worker so MXDBLR cannot starve the other site. |
| Postgres | Own role `mxdblr` and database `mxdblr`. Not a superuser. |
| Files | Everything under `/var/www/mxdblr/`. |

### Commands that are BANNED on this box

These act on everything PM2 or nginx manages and will hit herotvmounting.com:

```
pm2 restart all      pm2 stop all      pm2 delete all      pm2 kill
sudo systemctl restart nginx          (use `reload`, after `nginx -t`)
sudo certbot --nginx                  (without -d, it rewrites other vhosts)
```

Use the named forms instead — `pm2 restart mxdblr-api`, `certbot --nginx -d mxdblr.com`.

### Before every nginx reload, without exception

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` validates the **whole** config. If it fails, do not reload — a broken
reload takes down the other client's site too. `reload` is graceful; `restart` drops
live connections for every site on the box.

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

### 1.3 — Create non-root deploy user

```bash
adduser deploy
usermod -aG sudo deploy
```

### 1.4 — Copy SSH public key to deploy user

Run on your **local machine**:

```bash
ssh-copy-id deploy@YOUR_VPS_IP
```

Or manually on the server:

```bash
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys   # paste your local ~/.ssh/id_rsa.pub
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
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

> **Important:** Open a new terminal and verify `ssh deploy@YOUR_VPS_IP` works before closing your root session.

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
sudo mkdir -p /var/www/mxdblr
sudo chown -R deploy:deploy /var/www/mxdblr
sudo chmod -R 755 /var/www/mxdblr
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
/var/www/mxdblr/
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
nano /var/www/mxdblr/api/.env
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
chmod 600 /var/www/mxdblr/api/.env
```

### 6.3 — Frontend environment file

```bash
nano /var/www/mxdblr/web/.env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.mxdblr.com
```

```bash
chmod 600 /var/www/mxdblr/web/.env.local
```

---

## 7. Build and Start the API

```bash
cd /var/www/mxdblr/api

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
cd /var/www/mxdblr/web

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
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy

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

### 10.1 — Remove default site

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 10.2 — Frontend site config

```bash
sudo nano /etc/nginx/sites-available/mxdblr.com
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mxdblr.com www.mxdblr.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

### 10.3 — API subdomain config

```bash
sudo nano /etc/nginx/sites-available/api.mxdblr.com
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.mxdblr.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        client_max_body_size 10M;
    }
}
```

### 10.4 — Enable sites and reload

```bash
sudo ln -s /etc/nginx/sites-available/mxdblr.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.mxdblr.com /etc/nginx/sites-enabled/

# Create certbot webroot
sudo mkdir -p /var/www/certbot

# Test config — must show "syntax is ok"
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### 10.5 — Recommended global Nginx settings

Edit `/etc/nginx/nginx.conf` and ensure the `http {}` block contains:

```nginx
server_tokens off;
client_max_body_size 10M;

gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

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
cd /var/www/mxdblr
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
cd /var/www/mxdblr
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
cd /var/www/mxdblr/api
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
cd /var/www/mxdblr/api
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
