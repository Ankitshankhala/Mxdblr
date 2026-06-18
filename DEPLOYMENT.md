# MXDBLR — Production Deployment Checklist

Work through every section top-to-bottom before traffic touches the server.

---

## 1. Pre-Deploy Environment Variable Checklist

Set all variables in your hosting dashboard (Railway / EC2 `/etc/environment`) before starting any service. Real values are never committed to Git.

### API service (required — app FAILs on startup if missing)

| Variable | How to generate | Status |
|---|---|---|
| `DATABASE_URL` | Railway dashboard → Postgres service → Connect | [ ] |
| `JWT_SECRET` | `openssl rand -hex 64` | [ ] |
| `NODE_ENV` | Set to `production` (unlocks combined logs, hides stack traces) | [ ] |
| `PORT` | `4000` | [ ] |
| `SETTINGS_ENCRYPTION_KEY` | `openssl rand -hex 32` | [ ] |
| `MSG91_AUTH_KEY` | MSG91 dashboard → API Keys | [ ] |
| `MSG91_TEMPLATE_ID` | MSG91 dashboard → SMS Templates | [ ] |
| `MSG91_SENDER_ID` | `MXDBLR` (must match approved DLT sender) | [ ] |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard | [ ] |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard | [ ] |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard | [ ] |
| `WHATSAPP_BUSINESS_NUMBER` | 91XXXXXXXXXX (country code + number, no +) | [ ] |

**Verify absent in production:**
- [ ] `ENABLE_OTP_BYPASS` must NOT be set — its presence bypasses OTP verification for all users

### Web service

| Variable | Value | Status |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.mxdblr.com/api` | [ ] |
| `INTERNAL_API_URL` | `http://localhost:4000` (or `http://api:4000` in Docker) | [ ] |
| `JWT_SECRET` | Same value as API `JWT_SECRET` — must be identical | [ ] |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Same as `WHATSAPP_BUSINESS_NUMBER` in API | [ ] |

---

## 2. Database Migrations

Run this once before starting the new API version. Never run `prisma migrate dev` in production.

```bash
# From the api/ directory on the production server
DATABASE_URL="postgresql://..." npx prisma migrate deploy --schema=src/prisma/schema.prisma
```

This applies all pending migrations including:
- `20260531131524_init` — initial schema
- `20260602000000_add_system_settings` — SystemSettings table
- Any migration adding `lastRevokedAt` to the Dealer model

Verify the migration completed without errors before starting the API process.

---

## 3. PM2 Startup (bare-metal / VM deployment)

```bash
# From the api/ directory — ensure the TypeScript build is current first
npm run build

# Start in cluster mode with production env
pm2 start ecosystem.config.js --env production

# Save the process list so PM2 restores it after reboot
pm2 save

# Register PM2 as a system service (run the command it prints)
pm2 startup
```

**Check logs immediately after start:**
```bash
pm2 logs mxdblr-api --lines 50
```

If you see `[FATAL] Missing required environment variable: JWT_SECRET` the variable is not visible to the PM2 process — export it in the shell or add it to `/etc/environment` and restart.

---

## 4. Nginx Setup

```bash
# Copy config
sudo cp nginx/mxdblr.conf /etc/nginx/sites-available/mxdblr.conf

# Enable site
sudo ln -s /etc/nginx/sites-available/mxdblr.conf /etc/nginx/sites-enabled/

# Test config syntax
sudo nginx -t

# Reload (zero-downtime)
sudo systemctl reload nginx
```

---

## 5. SSL Certificates (Let's Encrypt via Certbot)

```bash
# Install certbot if not present
sudo apt install certbot python3-certbot-nginx -y

# Issue certificates — certbot patches the nginx config automatically
sudo certbot --nginx -d mxdblr.com -d www.mxdblr.com
sudo certbot --nginx -d api.mxdblr.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certificates expire every 90 days. Certbot installs a systemd timer or cron job — confirm it is active:
```bash
systemctl status certbot.timer
```

---

## 6. Health Check Verification

Run all checks immediately after deploy. Do not call the deployment complete until all pass.

```bash
# API health — expect {"status":"ok","service":"mxdblr-api",...}
curl -sf https://api.mxdblr.com/health | jq .

# HTTPS redirect — expect 301 on HTTP
curl -I http://api.mxdblr.com/health

# Web portal — expect 200
curl -sf -o /dev/null -w "%{http_code}" https://mxdblr.com

# Confirm ENABLE_OTP_BYPASS is absent
# (on the production server, not locally)
printenv ENABLE_OTP_BYPASS   # must return nothing
```

---

## 7. Post-Launch Monitoring (first 30 minutes)

- [ ] Watch PM2 logs: `pm2 logs mxdblr-api`
- [ ] Confirm no `[FATAL]` or `[ERROR]` lines appear
- [ ] Test dealer OTP login end-to-end from a real mobile number
- [ ] Test admin login and confirm the dashboard loads
- [ ] Verify at least one product image loads (confirms Cloudinary is configured)
- [ ] Notify PM Agent → CSM Agent sends "you're live" message to client

---

## 8. Rollback Plan

| Scenario | Action |
|---|---|
| API crash loop | `pm2 stop mxdblr-api` → fix env var → `pm2 start` |
| Bad code deploy | `git checkout <previous-tag>` → `npm run build` → `pm2 restart mxdblr-api` |
| Bad DB migration | Restore from the Railway daily backup taken before deploy |
| Wrong JWT_SECRET | Update env var → `pm2 restart mxdblr-api` — all existing tokens will be invalidated and users must log in again |

---

## Security Notes

- `api/.env` and `web/.env.local` must be in `.gitignore` — confirm with `git ls-files | grep .env`
- The seed file (`api/src/prisma/seed.ts`) contains a hardcoded admin password — change it immediately after first login via the admin settings change-password endpoint
- `DATABASE_URL` for staging must point to a different database than production
- Nginx strips `X-Forwarded-For` spoofing because `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` replaces the incoming header
