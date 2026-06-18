# MXDBLR — Hostinger VPS KVM 2 Deployment Guide

**Server:** Hostinger KVM 2 · Ubuntu 22.04 · 2 vCPU · 8 GB RAM · 100 GB NVMe  
**Stack:** Next.js 15 + Express API + PostgreSQL 15 + PM2 + Nginx + Certbot  
**Prepared by:** Charu Solutions DevOps  

---

## Pre-Deployment Checklist

Before touching the server:

- [ ] `mxdblr.com` DNS A record → your VPS IP
- [ ] `www.mxdblr.com` DNS A record → your VPS IP
- [ ] `api.mxdblr.com` DNS A record → your VPS IP
- [ ] DNS propagated — verify at [whatsmydns.net](https://whatsmydns.net)
- [ ] Project builds locally without errors (`npm run build` passes in both `api/` and `web/`)
- [ ] All environment variable values documented and ready
- [ ] SSH private key available on your local machine

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

### 5.2 — Upload via rsync (from your local machine)

```bash
rsync -avz --exclude node_modules --exclude .git --exclude .env --exclude .env.local \
  ./mxdblr/ deploy@YOUR_VPS_IP:/var/www/mxdblr/
```

Or use **FileZilla** via SFTP:
- Host: `sftp://YOUR_VPS_IP`
- Username: `deploy`
- Auth: Private key
- Upload to: `/var/www/mxdblr/`

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

```bash
# Upload new files via rsync from local machine
rsync -avz --exclude node_modules --exclude .git --exclude .env \
  ./mxdblr/api/ deploy@YOUR_VPS_IP:/var/www/mxdblr/api/
rsync -avz --exclude node_modules --exclude .git --exclude .env.local \
  ./mxdblr/web/ deploy@YOUR_VPS_IP:/var/www/mxdblr/web/

# On the server — rebuild and restart API
cd /var/www/mxdblr/api
npm install
npm run build
npx prisma migrate deploy --schema=src/prisma/schema.prisma
pm2 restart mxdblr-api

# Rebuild and restart frontend
cd /var/www/mxdblr/web
npm install
npm run build
pm2 restart mxdblr-web
```

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
