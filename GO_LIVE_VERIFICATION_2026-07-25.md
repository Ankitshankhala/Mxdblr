# MXDBLR — Go-Live Verification (2026-07-25)

Ran the pending gates from `GO_LIVE_HANDOFF_2026-07-21.md` against the current
working tree: dependency install, Prisma generate, type-check, production builds,
the full smoke suite on a real Postgres, and a faithful simulation of the API
Docker runtime image.

**Verdict: the tree would NOT have gone live.** Four blockers were found — all four
crash or corrupt a *fresh* production deploy, and none are visible from the dev
machine, because the dev database was maintained with `prisma db push` rather than
migrations. All four are now fixed and re-verified.

---

## Gate results

| Gate | Result |
|------|--------|
| `npm install` — api | ✅ clean, 668 pkgs |
| `npm install` — web | ✅ clean, lockfile already in sync (`up to date`) |
| `@sentry/nextjs ^10` vs Next 16.2.6 | ✅ resolves to 10.67.0, no ERESOLVE — the v8→v10 note in the handoff is correct |
| `prisma generate` | ✅ client v7.8.0 |
| `tsc --noEmit` — api | ✅ exit 0 |
| `npm run build` — api | ✅ `dist/index.js` emitted |
| `tsc --noEmit` — web | ✅ exit 0 |
| `next build` — web | ✅ exit 0, 30 routes, standalone output |
| `prisma migrate deploy` on empty DB | ❌ → ✅ **after fix** |
| Migration history vs `schema.prisma` | ❌ → ✅ **after fix** — now `No difference detected` |
| Jest smoke suites | ❌ 4 fail → ✅ **after fix** — **7 suites / 88 tests pass** |
| API Docker image boots | ❌ → ✅ **after fix** |

---

## Blocker 1 — duplicate migration aborts `migrate deploy`

`20260704140000_add_banner_mobile_image` and `20260704160000_add_banner_mobile_image`
contained the identical statement:

```sql
ALTER TABLE "Banner" ADD COLUMN "mobileImage" TEXT NOT NULL DEFAULT '';
```

On a fresh database the second one fails:

```
ERROR: column "mobileImage" of relation "Banner" already exists
```

`api/Dockerfile` runs `prisma migrate deploy && node dist/index.js` as its `CMD`,
so the API container would have exited non-zero on first boot and crash-looped
under `restart: unless-stopped`.

## Blocker 2 — migration history does not reproduce `schema.prisma`

The bigger version of the same problem. Applying every migration to an empty
database produced a schema materially different from `schema.prisma`:

```
[+] Added enums     DealerStatus, BusinessType, StockStatus,
                    NotificationChannel, InquiryStatus, BannerType
[+] Added tables    Brand, Announcement
[+] Added columns   Dealer.lastRevokedAt, Product.isBestSeller, Product.isNewArrival
[*] Changed         Product.images  String  → String[]
                    Product.stockStatus / Dealer.status / Dealer.businessType /
                    InquiryLog.status / NotificationLog.channel / Banner.bannerType
                    all TEXT in migrations, enum in schema
[+] Added indexes   OtpCode(mobile), OtpCode(expiresAt),
                    Product(brand), Product(stockStatus), Product(categoryId),
                    Brand(name) unique, Brand(slug) unique
```

Concretely, on a fresh production DB: `GET /api/brands` and `GET /api/announcements`
hit tables that do not exist, and **every dealer auth request 500s** because
`middleware/auth.ts` selects `Dealer.lastRevokedAt`:

```
Invalid `prisma.dealer.findUnique()` invocation in src/routes/auth.ts:119
The column `Dealer.lastRevokedAt` does not exist in the current database.
```

That is what the 4 failing `auth.smoke` tests were reporting.

**Fix** — squashed to a single verified baseline,
`api/src/prisma/migrations/20260725000000_baseline/migration.sql`, generated from
`schema.prisma` itself, with the seed data from the old history appended verbatim
(`SystemSettings` row; the four system roles and their 30 `RolePermission` rows —
these are `INSERT … ON CONFLICT DO NOTHING`, so they stay idempotent). The previous
12 migrations are preserved, unused, in `api/src/prisma/_migrations_archive/`.

Verified on a clean database: `migrate deploy` succeeds → `migrate diff` reports
**No difference detected** → all 88 smoke tests pass.

> ⚠️ If you have an existing database already at the old migration head (your dev
> box), do **not** run `migrate deploy` against it — mark the baseline as already
> applied instead:
> `npx prisma migrate resolve --applied 20260725000000_baseline`

## Blocker 3 — API container cannot run migrations (missing `prisma.config.ts`)

`schema.prisma` declares the datasource with **no `url`**:

```prisma
datasource db {
  provider = "postgresql"
}
```

The connection string comes from `prisma.config.ts`, which the runner stage never
copied. Simulated with a byte-faithful reconstruction of the runner image:

```
$ ./node_modules/.bin/prisma migrate deploy --schema=src/prisma/schema.prisma
Error: The datasource.url property is required in your Prisma config file
       when using prisma migrate deploy.
```

**Fix** — `COPY prisma.config.ts ./` added to the runner stage. Its imports
(`@prisma/adapter-pg`, `pg`, `dotenv`) are all production dependencies, and Prisma 7
loads the `.ts` config without `typescript` present — both confirmed in the simulation.

## Blocker 4 — API container crashes on boot (Prisma client never generated)

The `deps` stage runs `npm ci --only=production`, and Prisma 7's `@prisma/client`
has **no postinstall generate step**, so `node_modules/.prisma/client` is never
created. The runner copies that un-generated `node_modules`:

```
$ node dist/index.js
Error: Cannot find module '.prisma/client/default'
Require stack:
 - /app/node_modules/@prisma/client/default.js
 - /app/dist/lib/prisma.js
 - /app/dist/index.js
```

**Fix** — `COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma`.

After fixes 3 + 4, the reconstructed runner image runs its `CMD` end to end:

```
All migrations have been successfully applied.
[mxdblr-api] Server running on port 4000 (production)
```

---

## Also hardened (`docker-compose.yml`, `web/Dockerfile`)

- **Postgres was published on `0.0.0.0:5432`** — on a public VPS that exposes the
  database to the internet. Now `127.0.0.1:5432:5432`. Same for API `4000` and web
  `3000`; nginx already proxies to `127.0.0.1`, so nothing else changes.
- `POSTGRES_PASSWORD:-changeme` and a blank `JWT_SECRET` no longer silently default.
  Now `${VAR:?message}` — compose refuses to start instead of booting on a
  password that is public in this repo.
- `SENTRY_DSN` is now actually passed to both services (the handoff told you to set
  it, but nothing forwarded it into the containers).
- MSG91 / Cloudinary / WhatsApp env vars now forwarded to `api` — previously the
  container could only ever run in OTP-mock + local-upload fallback mode.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_STAT_DEALERS`, `NEXT_PUBLIC_STAT_SKUS`
  wired as **build args** in `web/Dockerfile` — as runtime env they would have had
  no effect on the compiled browser bundle.
- Dropped the obsolete `version: '3.8'` key.

---

## Not fixed — needs a decision

1. **`npm audit --audit-level=high` fails on both apps.** CI (`.github/workflows/ci.yml`)
   gates on this, so the pipeline will go red on first push. Highs: `axios`
   (both apps), `form-data`, `brace-expansion`, `js-yaml`. `npm audit fix` claims a
   non-breaking fix for the axios one; I did not run it, since it rewrites both
   lockfiles and that should be your call before a launch.
2. **CI has never run** — there is still no git remote, so none of the above was
   ever caught. The `api-tests` job runs `migrate deploy` + `npm test` against a
   real Postgres and would have caught blockers 1 and 2 on day one. Worth adding
   the remote before anything else.
3. **Homepage stats + testimonials** — unchanged from the handoff. Both self-suppress
   while unset, so this is a content decision, not a blocker.
4. `/catalog` and `/product/[sku]` build as `ƒ` (dynamic), not ISR. Expected —
   they read `searchParams` — but the handoff's "ISR, revalidate 60s" wording
   overstates it. The homepage is genuinely ISR (`revalidate 30s`).

---

## Remaining manual steps

```bash
# 1. Deps are verified in sync; regenerate the client locally
cd api && npm install && npm run db:generate && cd ..
cd web && npm install && cd ..

# 2. Existing dev DB only — adopt the new baseline without re-running it
cd api && npx prisma migrate resolve --applied 20260725000000_baseline && cd ..

# 3. Commit (untracked Events + Features features are still uncommitted)
git add -A
git commit -m "fix: squash migrations to verified baseline; repair API Docker image; harden compose"

# 4. Add the remote so CI finally runs
git remote add origin git@github.com:<you>/mxdblr.git
git push -u origin main

# 5. Deploy — .env at repo root must set POSTGRES_PASSWORD and JWT_SECRET
#    (compose now fails fast if either is missing)
docker compose up --build -d
docker compose logs -f api    # expect: migrations applied → server running on 4000
```

### Verification evidence

- `prisma migrate diff --from-config-datasource --to-schema src/prisma/schema.prisma`
  → `No difference detected`
- `jest --runInBand` → `Test Suites: 7 passed, 7 total · Tests: 88 passed, 88 total`
  (auth 9, cart 11, rbac 17, admin 14, dealers 13, events 14, feature-media 10)
- API runner image simulation → migrations applied, server boots on port 4000
- `next build` → exit 0, 30 routes, `.next/standalone` emitted
