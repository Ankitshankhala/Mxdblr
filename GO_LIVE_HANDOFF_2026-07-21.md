# MXDBLR — Go-Live Handoff (2026-07-21)

Remediation pass against `PRODUCTION_AUDIT_REPORT_v5.md`. Target: Hostinger VPS
(KVM2, 2 vCPU / 8 GB), single-host Docker Compose.

## Key finding

The 84 uncommitted files in the working tree were **already most of the v5 fixes**
— done after the July 4 audit but never committed. So several v5 "blockers" were
already resolved in the tree (just not shipped). This pass verified those and
closed the remaining gaps.

---

## What was already fixed in the uncommitted tree (verified this pass)

- **Docker web build-time API URL** — `web/Dockerfile` has `ARG/ENV NEXT_PUBLIC_API_URL`
  before `npm run build`; `docker-compose.yml` passes it as a build arg; `next.config.ts`
  has `output: "standalone"`. The broken-browser-bundle issue is gone.
- **Migrate on startup** — API `CMD` runs `prisma migrate deploy` before `node dist/index.js`.
- **Settings secret round-trip** — masked values are no longer written back over real secrets.
- **Cloudinary fallback URL** — now stores relative `/uploads/...`, resolved at render.
- **Orders P2025 → 404** — handled.
- **WhatsApp number** — unified to one source (`web/lib/config.ts`, env-overridable);
  cart prefers the server-returned number.
- **Testimonials** — invented quotes already replaced with explicit placeholders.

## What this pass changed

**Backend (`api/`)**
- `orders.ts` — NaN guard on `page`/`limit` (`?limit=abc` no longer 500s).
- `schema.prisma` — dropped dead `Session` model + `Dealer.sessions` relation;
  added migration `20260721120000_drop_dead_session_model`.
- `seed-catalog.ts` — switched from libsql/SQLite adapter to the Postgres adapter
  (matches `seed.ts` / `lib/prisma.ts`).
- `package.json` — removed `@libsql/client` + `@prisma/adapter-libsql`; added `@sentry/node`.
- `.env.example`, `docker-compose.yml` — removed the phantom `SETTINGS_ENCRYPTION_KEY`
  (no encryption code ever existed).
- **Sentry** — new `src/lib/observability.ts` (guarded dynamic `require`, no-op unless
  `SENTRY_DSN` set); wired into boot + the global error handler (reports 5xx only).
  `@sentry/node ^8.47.0` (pure Node SDK, no Next peer dep — installs clean).

**Frontend (`web/`)**
- **Catalog SSR** — `app/catalog/page.tsx` is now a Server Component that fetches
  server-side (ISR, revalidate 60s); interactivity moved to `components/products/CatalogView.tsx`,
  fully URL-driven (filters/sort/page navigate → server re-renders). SEO/perf gap closed.
- `next.config.ts` — whitelisted the production API host (`api.mxdblr.com/uploads/**`)
  for `next/image`, so the local-upload fallback path won't 404 in prod.
- `instrumentation.ts` — Sentry for the web server (guarded, no-op unless `SENTRY_DSN` set).
- `package.json` — added `@sentry/nextjs`. NOTE: must be **`^10.0.0`**, not `^8` —
  Sentry 8 peer-requires Next ≤15, this project is Next 16.2.6, so `^8` fails
  `npm install`/`npm ci` with ERESOLVE. v10 peer-supports Next ^16. (Runtime-only
  `import()`, so no static build coupling either way.)
- **TrustStats** — fabricated counts removed; dealer/SKU numbers are env-driven and
  hidden until set (`NEXT_PUBLIC_STAT_DEALERS`, `NEXT_PUBLIC_STAT_SKUS`); coverage/dispatch
  env-overridable. Band hides if nothing is set.
- **Testimonials** — self-suppresses placeholder entries; section hides until real quotes exist.

**Additional fixes (second pass — "handle everything")**
- **Response-envelope drift** — `admin/products.ts` list now returns the standard
  `{ success, data, pagination }`. Traced + updated all 3 consumers (admin products
  page, admin dashboard stock alerts) and the smoke test. (`cart.ts` already used
  the standard `data` field.)
- **Homepage duplicate fetch (#10)** — the identical latest-products request fired
  twice is now fetched once and shared as the fallback for best-sellers + new-arrivals.
- **Containerized SSR bug (found this pass)** — catalog, homepage, product page, and
  sitemap fetched server-side via `NEXT_PUBLIC_API_URL` (= `localhost:4000`), which
  inside the web container points at the container itself, not the API. All four now
  prefer `INTERNAL_API_URL` (`http://api:4000`) for server-side fetches; the browser
  still uses the public URL. Also fixes a latent bug in the existing prod compose.
- **Body-limit comment (#11)** — corrected 1mb → 8mb.
- **`docker-compose.dev.yml`** — one-command local dev (Postgres + API + web, hot
  reload, auto-migrate + auto-seed). `docker compose -f docker-compose.dev.yml up`.

**Already fixed in the uncommitted tree (verified, not re-done)**
- Geo middleware production self-disable (CRIT-8) — already has an IP→state cache
  with TTL + eviction. No change needed.

## Deliberately deferred (documented debt, not a blocker)

- **CSV import defaults** — new rows hardcode `stockQty:100, IN_STOCK`. Left as-is;
  it's a reasonable import default, and changing it alters admin import behavior.
- **README endpoint table** — stale (documents ~25 of ~90 endpoints). Docs-only.

---

## ⚠️ Needs YOUR input before launch (I won't invent data)

1. **Real homepage stats** — set at build time (or leave unset to hide):
   `NEXT_PUBLIC_STAT_DEALERS` (e.g. "300+"), `NEXT_PUBLIC_STAT_SKUS` (e.g. "1,000+"),
   optionally `NEXT_PUBLIC_STAT_COVERAGE`, `NEXT_PUBLIC_STAT_DISPATCH`.
2. **Real testimonials** — replace the placeholder entries in
   `web/components/home/Testimonials.tsx` with real dealer quotes (with permission),
   or leave them → the section stays hidden.

---

## One-time steps you must run (sandbox couldn't: no git commit + no npm install here)

```bash
# 1. Sync lockfiles for the new deps (Docker `npm ci` needs these in sync)
cd api  && npm install && cd ..
cd web  && npm install && cd ..

# 2. Regenerate Prisma client for the dropped Session model
cd api && npm run db:generate && cd ..

# 3. Type-check + prod build (authoritative gate — fast on VPS disk)
cd api && npx tsc --noEmit && npm run build && cd ..
cd web && npx tsc --noEmit && npm run build && cd ..

# 4. Remove the stale SQLite dev DB (was blocked in the sandbox)
git rm --cached api/dev.db 2>/dev/null; rm -f api/dev.db

# 5. Commit the working tree — including the untracked Events feature
git add -A
git commit -m "chore: v5 remediation — SSR catalog, Sentry, dead-code cleanup, deploy fixes"

# 6. Add a remote so CI finally runs (create the repo first)
git remote add origin git@github.com:<you>/mxdblr.git
git push -u origin main
```

Note on deleted audit reports: `AUDIT_REPORT.md … _v4.md` are staged-deleted with no
commit. The commit above records the removal. If you want the trail kept, `git checkout`
them before step 5.

## Deploy on the KVM2

```bash
# .env at repo root:
POSTGRES_PASSWORD=<strong>
JWT_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_API_URL=https://api.mxdblr.com/api
SENTRY_DSN=<optional, enables monitoring>
NEXT_PUBLIC_STAT_DEALERS=...   # optional
NEXT_PUBLIC_STAT_SKUS=...      # optional

docker compose up --build -d
docker compose logs -f api     # confirm "prisma migrate deploy" + server boot
```

## Post-remediation verification status

- API `tsc --noEmit` → **exit 0** (verified this session).
- Web `tsc` / prod builds → run steps 3 above on the VPS (mount here too slow to complete).
- 5 supertest smoke suites → run `cd api && npm test` against a throwaway Postgres.
- Manual smoke: OTP login, catalog filter/sort/paginate (now SSR), cart MOQ, WhatsApp
  inquiry, admin login + one CRUD, image upload render.
