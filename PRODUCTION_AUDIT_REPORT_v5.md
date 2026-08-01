# MXDBLR — Production-Readiness Audit v5

**Date:** 2026-07-04 · **Auditor:** CEO Agent (Charu Solutions) · **Method:** Gate 5 — every claim below was verified by direct source read in this session unless explicitly marked **[unverified]**.
**Scope:** full repository `outputs/mxdblr` (api + web + infra), git state, CI, configs.
**Supersedes:** `AUDIT_DELTA_2026-06-20.md`. Note: `EXECUTION_PLAN.md` said v5 should run *after* Sentry + catalog SSR land; neither has landed — this v5 was run on direct instruction from Ankit.

> ⚠️ **Process note:** all five previous audit reports (`AUDIT_REPORT.md`, `PRODUCTION_AUDIT_REPORT.md` … `_v4.md`) are **deleted in the uncommitted working tree** (`git status` shows ` D` for each). The audit trail is being erased without a commit recording why. Restore or commit the deletions with a message.

---

## 1. Overall Assessment

| | |
|---|---|
| **Production ready?** | **NO** |
| **Score** | **6.5 / 10** (≈70/100 on the v4 scale — unchanged since 2026-06-12) |
| **Confidence** | High on static analysis (both apps type-check clean, exit 0, this session). Medium on runtime (smoke tests exist but were not executed — they mutate the dev DB; CI has never run them). |

**Executive summary.** The codebase is well-crafted at the route level — real input validation (zod), a genuinely good RBAC layer, hashed OTPs, server-enforced MOQ/stock rules, and 5 integration test suites. But the project has been stuck at ~70/100 for three weeks because the same ship-blockers keep not being done: **no git remote (CI has executed zero times, ever), no error monitoring (Sentry absent from both apps), catalog still client-rendered**, and the working tree has 34 uncommitted entries including the entire Events feature. This audit also found **new defects**: the admin Settings page silently corrupts stored API keys on save; the Settings screen is a placebo (nothing reads those DB values); the homepage ships fabricated dealer counts and testimonials presented as real; the geo-restriction control will silently die at production traffic volumes; and three different WhatsApp numbers are configured in three places. Deploying today would produce a site that *looks* fine and fails in slow, hard-to-debug ways with zero observability.

---

## 2. Architecture Review

**Structure** — clean monorepo: `api/` (Express 5 + Prisma 7/PostgreSQL, TS strict) and `web/` (Next.js **16.2.6** + React 19, App Router), plus `nginx/`, `docker-compose.yml`, `.github/workflows/ci.yml`. README says "Next.js 15" — stale.

**Good:**
- `api/src/index.ts` is a single, readable composition root: fail-fast env check, helmet, CORS allow-list, global rate limit, every admin router mounted behind an explicit RBAC permission guard.
- Auth architecture is sound: type-tagged JWTs (`dealer`/`admin`), cross-type rejection, dealer token revocation via `lastRevokedAt` (wired: `admin/dealers.ts:121-129`), admin permissions re-read from DB per request (revocation is immediate) — `middleware/auth.ts`, `middleware/rbac.ts`.
- RBAC (`routes/admin/users.ts`, `routes/admin/rbac.ts`, `lib/rbac.ts`): rank-based anti-escalation, MANAGE_ADMINS tier gate, last-super-admin protection, transactional audit logging (`lib/audit.ts`).
- File-header docblocks across the codebase are accurate and current (verified against implementations).

**Debt:**
- Dead `Session` model (`schema.prisma:70-77`) — zero `prisma.session` usage anywhere (grep verified).
- `SETTINGS_ENCRYPTION_KEY` exists in `.env`, `.env.example:26`, `docker-compose.yml:43`, `DEPLOYMENT.md` — **no encryption code exists in source** (grep: zero hits outside configs/docs). Documented feature that was never built.
- libsql/SQLite residue: `@libsql/client` + `@prisma/adapter-libsql` in `api/package.json` (used only by `seed-catalog.ts`), stale `api/dev.db` on disk.
- Admin pages use heavy inline `style={{...}}` objects instead of Tailwind (which the stack mandates) — e.g. entire `web/app/admin/settings/page.tsx`. Maintainability cost.
- Envelope drift: standard is `{ success, data, pagination }`, but `admin/products.ts:268-276` returns `{ success, products, count, total, page, limit, pages }` and `cart.ts:40-49` returns `{ success, data, count }`. Violates the one-envelope rule.

Scalability is adequate for the business size (single VPS target) **except** the geo middleware (§9/§13).

---

## 3. Feature Audit (README + implemented surface vs. reality)

| Feature | Status | Working | Broken | Partial | Notes |
|---|---|---|---|---|---|
| OTP login (send/verify) | ✅ | ✔ | | | Hashed at rest, rate-limited, brute-force guarded (`auth.ts`, `rateLimit.ts`). Real SMS path **[unverified]** — no MSG91 key ever configured |
| Dealer registration (3-step) | ✅ | ✔ | | | Server-side state gate + OTP-verified requirement (`auth.ts:141-204`) |
| Admin login | ✅ | ✔ | | | bcrypt + rate limit + deactivation check |
| Product catalog + filters | ⚠ | ✔ | | ✔ | Functionally works; **fully client-rendered** (`catalog/page.tsx:1`) — SEO/perf gap, flagged in its own docblock since v4 |
| Product detail | ✅ | ✔ | | | ID-or-SKU lookup, breadcrumb, price stripped server-side |
| Cart + MOQ enforcement | ✅ | ✔ | | | Server-enforced MOQ + out-of-stock rejection (`cart.ts:70-82`) |
| WhatsApp inquiry | ⚠ | | | ✔ | Flow works, but **three different destination numbers configured** (§16 CRIT-7); API's returned number ignored by the cart page, which builds its own wa.me link |
| Notify-me / restock alerts | ⚠ | | | ✔ | Subscribe + trigger + logs + sub cleanup all implemented (`admin/notifications.ts:40-86`); real WhatsApp delivery **[unverified]** — mock mode only ever exercised |
| Geo restriction | ⚠ | | | ✔ | IP-based, server-side, fail-open — but will silently self-disable in production (§9 SEC-4) |
| Admin: products CRUD + CSV import | ✅ | ✔ | | | P2025→404 handled; CSV import hardcodes `stockQty:100, IN_STOCK` on new rows |
| Admin: dealers + moderation | ✅ | ✔ | | | Block/suspend revokes live sessions |
| Admin: inquiries/orders | ⚠ | ✔ | | ✔ | Works; `PUT /:id/status` 500s on unknown id (no P2025 catch — `admin/orders.ts:84-91`) |
| Admin: banners, brands, categories, announcements | ✅ | ✔ | | | Routers present + mounted behind permissions; internals spot-checked only |
| Admin: RBAC roles/staff/audit logs | ✅ | ✔ | | | High quality; tests exist (`rbac.smoke.test.ts`) |
| Admin: settings | ❌ | | ✔ | | **Double-broken**: (1) saving overwrites real secrets with masked `••••••xxxx` strings (§16 CRIT-4); (2) nothing ever reads these DB values — msg91/cloudinary read env only (grep verified). The screen is a placebo |
| Events & Activities | ⚠ | ✔ | | | Implemented + tested, but **entirely uncommitted** (untracked in git) |
| Wishlist | ⚠ | ✔ | | | localStorage-only by design (`useWishlist.ts`); not in README; not synced to server |
| Image/video upload | ⚠ | | | ✔ | Cloudinary path OK **[unverified live]**; local fallback stores absolute `http://localhost:4000/...` URLs → broken in prod (§16 CRIT-6) |
| Homepage (SSR + ISR) | ⚠ | ✔ | | ✔ | Proper Server Component with revalidate — but ships **fabricated stats/testimonials** (§16 CRIT-5) |

README's endpoint table is badly stale: it documents ~25 endpoints; the API actually exposes **~90** (banners, brands, announcements, events, RBAC, users, settings, upload, csv-import, broadcast all missing from docs).

---

## 4. Broken / Suspect Functionality

| # | File / Location | Problem | Severity | Root cause → Fix |
|---|---|---|---|---|
| 1 | `web/app/admin/settings/page.tsx:47-80` + `api/routes/admin/settings.ts:61-63` | GET returns masked secrets (`••••••xxxx`); page loads them into form state; Save PUTs them back → **stored secret replaced by mask garbage** | HIGH | Never round-trip masked values. Either send only changed fields, or have the API ignore values matching the mask pattern |
| 2 | `api/routes/admin/settings.ts` (whole file) | SystemSettings values (`msg91ApiKey`, `cloudinaryApiKey/Secret`, `whatsappNumber`) are **never read** by `lib/msg91.ts` / `lib/cloudinary.ts` / anything (grep: only settings.ts touches `prisma.systemSettings`) | HIGH | Admin believes they've configured integrations; nothing changes. Remove the secret fields from the UI+model (per the in-file TODO) and keep env-only |
| 3 | `api/src/lib/cloudinary.ts:41-42` | Local fallback returns absolute `http://localhost:${port}/uploads/...`, persisted into DB | HIGH | Store relative `/uploads/...` and resolve at render; carried open since v4 (NEW-3) |
| 4 | `web/components/products/ProductCard.tsx:~166` | Raw `src` passed to `next/image`; `next.config.ts` whitelists only localhost:4000/Cloudinary/mxdindia → any other stored host 404s | MEDIUM | Same root cause as #3; fix at upload layer |
| 5 | `api/routes/admin/orders.ts:84-91` | `PUT /:id/status` has no P2025 catch → Express 5 forwards to global handler → **500 for a predictable 404** (violates backend-api rule; `admin/products.ts` does it correctly) | MEDIUM | Wrap in try/catch, P2025 → 404 |
| 6 | `api/routes/admin/orders.ts:34` | `limitNum = Math.min(100, parseInt(limitStr))` → `?limit=abc` gives NaN → Prisma throws → 500 | LOW | Guard NaN like `dealers.ts:77` does |
| 7 | `schema.prisma:70-77` | `Session` model: dead — never queried | LOW | Drop model + migration (violates "no dead models" rule) |
| 8 | `api/package.json` + `api/dev.db` | libsql adapter deps + stale SQLite file for a PostgreSQL project | LOW | Remove deps (move seed-catalog to pg), delete dev.db |
| 9 | `.env.example:23-26`, `docker-compose.yml:43` | `SETTINGS_ENCRYPTION_KEY` documented/required but no encryption exists anywhere | LOW | Delete the variable or implement the feature |
| 10 | `web/app/page.tsx:~55-60` | `bestSellerFallbackRes` and `fallbackRes` are two **identical** fetches (`/products?limit=8&sort=newest`) fired in parallel | LOW | Fetch once, share |
| 11 | `admin/products.ts:133` comment | "Global limit is 1mb" — actual global limit is 8mb (`index.ts:101`) | INFO | Fix comment |

No TODO/stub/`throw new Error("not implemented")` routes were found — every mounted endpoint has a real implementation. The incompleteness in this project is at the **integration/config level**, not the route level.

---

## 5. Runtime Analysis

- **TypeScript:** `npx tsc --noEmit` → **exit 0 on both api and web** (run this session). No type errors, no missing imports.
- **Production builds:** `npm run build` executed this session on both apps — **both pass, exit 0**. API emits `dist/`; Next.js production build compiles all 23 routes (homepage static/ISR, `/product/[sku]` dynamic, proxy middleware active). The code *compiles and builds for production*; the blockers are configuration, integration, and operations — not compilation.
- **Runtime servers were not started** against a live DB in this session; the 5 supertest suites cover auth/cart/inquiry/admin/rbac/events flows against real Postgres, but were **not executed** here (they run against the dev database configured in `.env` and mutate it) — and have **never executed in CI** because CI has never run.
- **Express 5** (`^5.2.1`): async handler rejections correctly reach the global error handler — the classic Express-4 hang class is absent.
- **Environment fail-fast** is good: missing `DATABASE_URL`/`JWT_SECRET` exits at boot (`index.ts:17-23`).
- **Docker runtime gap:** `web/Dockerfile` bakes the client bundle at `RUN npm run build` **without** `NEXT_PUBLIC_API_URL` (no ARG). `docker-compose.yml:59` sets it only at *runtime* — Next.js inlines `NEXT_PUBLIC_*` at *build time*, so a compose-deployed web container's browser bundle falls back to `http://localhost:4000/api` (`web/lib/api.ts:10`) → **every API call from a real user's browser fails**. The Docker deploy path is broken as-written.
- **Migrations never run automatically:** `api/Dockerfile` copies `src/prisma` "for `prisma migrate deploy` at startup" but `CMD` is plain `node dist/index.js` — no migrate step exists in any deploy path.

---

## 6. API Review

~90 endpoints enumerated (grep over `src/routes`). Verdicts:

- **Exists & implemented:** all mounted routes have real handlers; no orphan README endpoints except cosmetic path differences.
- **Auth correctness:** every admin router double-guards (RBAC mount guard in `index.ts:141-153` + `requireAdminAuth` inside). Dealer routes all use `requireDealerAuth`. Verified no admin route reachable with dealer token (tested in `admin.smoke.test.ts:48` + middleware logic).
- **Validation:** zod on all public/dealer mutating routes; `admin/users.ts` uses manual-but-thorough checks; weakest is `admin/orders.ts` (see §4-5/6).
- **Error handling:** P2025→404 handled in products (all 5 mutation sites), **missing** in orders status update; global handler hides internals in production. ✔ mostly.
- **Never used by frontend:** `GET /api/brands` (Brand model list) — homepage uses `GET /api/products/brands` (distinct strings) instead; the Brand *model* is only consumed by admin brands page **[frontend usage spot-checked, not exhaustively traced]**.
- **Unfinished:** none stubbed; the settings endpoints are "finished but pointless" (§4-2).
- **Inconsistency:** response envelope drift in admin products + cart (§2).

---

## 7. Frontend Review

- **Routing/navigation:** App Router pages for all advertised routes + full admin suite (16 admin pages). `proxy.ts` (Next 16 middleware) gates `/admin/*` with real JWT verification (jose) and `/account|/cart|/wishlist` with cookie presence. Correct redirect loops avoided (login page handled separately).
- **Auth plumbing:** dual storage (localStorage + JS-readable cookie) so middleware can see it; 401 interceptor clears session and bounces (`web/lib/api.ts:43-52`, `lib/admin/auth.tsx:57-60`). Works, but see §9 XSS note.
- **Loading/error states:** present in the pages read (catalog skeleton via `loading` state, settings "Loading settings…", cart preserves state on failed mutation and surfaces toast — `useCart.ts` returns `{success, message}` everywhere; no silent catches on user actions in the files read). ✔
- **State management:** plain hooks; no server-state lib. Acceptable at this scale.
- **Broken UI behaviors found:**
  1. Admin Settings save corrupts secrets (§4-1) — the page *looks* like it works (success toast).
  2. Fabricated content presented as real: `TrustStats` ("500+ Registered Dealers", "1,200+ SKUs"), `Testimonials` (3 invented dealers with names/cities; the file's own comment admits "placeholder copy until real testimonials are supplied"), marquee fallback advertises "Free Delivery on Orders above ₹5,000" — an invented commercial policy. Direct violation of "Nothing fake looks real."
  3. Product images from non-whitelisted hosts 404 (§4-4).
- **Accessibility:** **[not deeply audited this session]** — heavy inline styles; icon-only buttons in settings have no aria-label (verified in `settings/page.tsx:120-137`). Flag for the frontend-agent floor check (focus-visible, contrast, alt text).
- **Console errors:** not checked live **[unverified]**.

---

## 8. Backend Review

- **Database access:** single Prisma pg-pool singleton, hot-reload safe (`lib/prisma.ts`). ✔
- **AuthN/AuthZ:** strongest part of the codebase (§2). ✔
- **Business logic:** MOQ/stock/geo/duplicate rules all enforced server-side; cart cannot be gamed client-side. ✔
- **Middleware:** helmet, CORS allow-list (note: localhost:3000-3002 remain allowed **in production** — `index.ts:72-79`), morgan, global + endpoint rate limits, trust proxy 1 (matches the nginx config's forwarded headers). ✔
- **Logging:** morgan to stdout + stderr error lines only. **No structured logging, no log shipping, no Sentry** — in production, failures will be invisible unless someone tails PM2/docker logs.
- **Missing implementations:** settings encryption (§4-9); automated migrations on deploy (§5); restock trigger sends WhatsApp **sequentially** in a request handler loop (`admin/notifications.ts:61-66`) — with hundreds of subscribers this request will hang for minutes (no queue; BullMQ is in the company stack but unused).

---

## 9. Security Audit

| # | Finding | Severity |
|---|---|---|
| SEC-1 | **Secrets hygiene (local):** `api/.env` on disk holds weak dev values — `JWT_SECRET="mxd-dev-secret-2026"`, DB password `Ankiit`, `ENABLE_OTP_BYPASS=true`; `web/.env.local` duplicates the JWT secret. **Not git-tracked** (verified `git ls-files` — only `.env.example` tracked; CI also enforces this). Risk is deploy-time: nothing prevents these values being copied to the VPS. Pre-launch checklist requires 256-bit secrets | HIGH (at deploy) |
| SEC-2 | **Seeded default credential:** `seed.ts:123-129` creates `admin / mxd@admin2026` (SUPER_ADMIN) — a hardcoded password in source. If seed ever runs in prod, it's a known credential | HIGH |
| SEC-3 | **Secrets-in-DB by design:** `SystemSettings` model stores MSG91/Cloudinary secrets in plaintext (encryption never implemented) — violates company rule "credentials live in env vars only". Currently moot (nothing reads them) but the write path exists and admin UI encourages it | MEDIUM |
| SEC-4 | **Geo control self-disables at scale:** `middleware/geo.ts` calls ipapi.co (free tier, ~1000 req/day) on **every** request to /api/auth, /api/products, /api/categories, with **no caching** of IP→state, and fails **open**. Production traffic exhausts the quota in hours → every request thereafter silently bypasses the restriction (and pays up to a 3 s external call latency before the timeout while quota lasts). The business control is decorative under load | HIGH |
| SEC-5 | **Token storage XSS exposure:** dealer + admin JWTs in localStorage and non-HttpOnly cookies. Any XSS = full session theft. No CSP header configured anywhere (helmet default CSP applies to API responses only; nginx adds none for the web app) | MEDIUM |
| SEC-6 | SQL injection: none — Prisma parameterizes everything; no raw queries found. XSS: React escaping + no `dangerouslySetInnerHTML` found in files read. CSRF: API is Bearer-token (not cookie-auth) → low risk | ✔ OK |
| SEC-7 | OTP: hashed at rest (bcrypt), 5-min expiry, verify rate-limited to 5 fails/15 min, prior codes invalidated on resend. **Good.** Bypass (`000000`) is double-gated on env flag + non-production | ✔ OK |
| SEC-8 | Upload: MIME allow-list + size caps both routes; base64 path validates data-URI shape. Note: MIME is client-declared (no magic-byte sniff) — low risk given admin-only + Cloudinary transcode | LOW |
| SEC-9 | Rate limiting: present globally + on auth endpoints; in-memory store (fine on one node, resets on restart) | ✔ OK |
| SEC-10 | `npm audit`: **[unverified this session]** — CI would run `npm audit --audit-level=high`, but CI has never executed | — |

---

## 10. Database Review

- **Schema:** 4 migrations (init → system_settings → rbac → events); the events migration exists **only in the working tree** (untracked) — a teammate cloning the repo today gets a schema that doesn't match `schema.prisma`.
- **Relations/constraints:** sensible uniques (`dealer.mobile`, `product.sku`, `[dealerId, productId]`, `[phoneNumber, productId]`, `[state, district]`, `[roleId, permission]`); cascade deletes on product attributes/tags; RolePermission cascade. ✔
- **Indexes:** good coverage (brand, stockStatus, categoryId, OTP mobile/expiry, audit createdAt/action, event published+date). Gaps (minor at this scale): `InquiryLog(dealerId)`, `InquiryLog(status)`, `CartItem(dealerId)` (the composite unique covers dealerId as prefix — fine), `NotificationLog(productId)`.
- **Dead weight:** `Session` model (unused), `SystemSettings` secret columns (unread), `Product.price/pricingActive` (deliberately dormant — stripped from all responses; fine as a planned feature).
- **Seeds:** `seed.ts` (roles + admin + base data), `seed-catalog.ts` (**still libsql/SQLite** — broken against the Postgres schema as configured **[behavior inferred from imports; not executed]**), `seed-announcements.ts`, `seed-events.ts`.
- **No automated migration step in any deploy path** (§5).

---

## 11. Code Quality

- Type-safety: strict TS both sides, zero `tsc` errors. Naming is consistent and descriptive. Docblocks are accurate.
- **Duplication:** `authHeader()`/API_BASE re-declared per admin page instead of using `adminFetch` (`settings/page.tsx:11-16` vs `lib/admin/auth.tsx`); dealer token stored under two keys (`dealerToken` + `mxd_token`) with both read everywhere — pick one.
- **Magic values:** the WhatsApp fallback numbers (3 different ones, §16 CRIT-7); `ADMIN_TIER_RANK = 10` is at least named and documented. ✔
- **Large functions:** csv-import (~75 lines, sequential awaits per row) and the events admin router are the longest; acceptable.
- **Unused/dead:** Session model, libsql deps, dev.db, `SETTINGS_ENCRYPTION_KEY`, `GET /api/brands` unused by storefront, `.gstack/browse-audit.jsonl` artifacts committed to the tree root and web/.
- **Inline-style admin pages** — biggest maintainability smell (§2).

---

## 12. Testing

- **Backend:** 5 supertest smoke suites, ~40 test cases (auth/OTP/geo, cart/MOQ/inquiry, admin CRUD/P2025, RBAC access control, events) + shared fixtures. Real integration tests against Postgres. **This meets the company's minimum test floor on paper.**
- **However:** they have **never run in CI** (no remote → zero CI executions), and were not run in this audit (they target the live dev DB in `.env` — running them here would mutate/destroy dev data; they need the CI-style disposable DB).
- **Frontend: zero tests.** No component, hook, or E2E coverage (no Playwright anywhere).
- **Untested critical paths:** WhatsApp/MSG91 real delivery (only the mock path is exercised), Cloudinary real uploads, settings save (would have caught CRIT-4), image rendering from stored URLs, the Docker deploy path, geo middleware under quota exhaustion.

---

## 13. Performance

| Issue | Impact |
|---|---|
| Geo lookup per-request, uncached, 3 s timeout, external free-tier API (`geo.ts:52-68`) | The single worst production perf issue — adds latency to every public API hit and dies at ~1000 req/day (§9 SEC-4) |
| Catalog CSR (`catalog/page.tsx`) | Slower first paint, no SEO for the money pages; the defined path-to-72 item since v4 |
| Restock trigger: sequential sends in-request (`admin/notifications.ts:61-66`) | Minutes-long request + timeout risk at a few hundred subscribers; needs a queue or `Promise.allSettled` batching |
| Homepage duplicate fetch (§4-10) | Minor waste |
| Homepage ISR (`revalidate: 30-300`) | ✔ Good |
| No Redis/cache layer anywhere | Acceptable now; note for growth |
| N+1s | None found in the routes read — queries use `include`/`groupBy` correctly |
| Bundle | **[unverified]** — sizes reported by the production build (§18) |

---

## 14. CI/CD

- **`ci.yml` is well-designed** (verified line-by-line): secret scan (hardcoded JWT patterns, committed .env check, OTP-bypass check), typecheck + `npm audit` on both apps, smoke tests against a Postgres 16 service with migrations applied, then gated builds incl. Next standalone output check.
- **It has executed ZERO times.** `git remote -v` is empty — three weeks after Phase 0 defined "create remote, CI green" as the exit criteria. Every CI protection is currently theoretical. **Gate 3 (QA on every merge) remains physically impossible.**
- Docker: multi-stage, non-root web runner, healthcheck on api. Two defects: web build ignores `NEXT_PUBLIC_API_URL` (§5 — broken compose deploy), and **no volume for `api/uploads`** in compose → local-fallback images are lost on every container rebuild.
- Nginx config: solid (TLS 1.2/1.3, HTTP→HTTPS, forwarded headers matching `trust proxy`, security headers on the web block). No rate limiting at nginx (API layer covers it).
- **No deployment has ever been rehearsed** end-to-end **[inferred: no remote, no staging exists per project record]**.

---

## 15. Production Checklist

| Item | Status |
|---|---|
| Authentication | ✅ Ready |
| Authorization (RBAC) | ✅ Ready |
| Error handling (API) | ⚠ Needs improvement (orders P2025; envelope drift) |
| Logging | ⚠ morgan/stderr only — no structure, no aggregation |
| Monitoring (Sentry) | ❌ Missing entirely (both apps) — explicit DoD item |
| Health checks | ✅ `/health` + Docker healthcheck |
| Backups | ❌ No pg backup strategy anywhere in repo/docs read |
| Environment variables | ⚠ `.env.example` excellent; real prod values don't exist yet; dead `SETTINGS_ENCRYPTION_KEY` |
| Security | ⚠ Strong app-layer; weak dev secrets on disk, seeded default admin password, geo control decorative at scale |
| Performance | ⚠ Geo middleware + catalog CSR |
| Testing | ⚠ Good API smoke floor, never run in CI; zero frontend/E2E |
| Documentation | ⚠ README stale (Next 15, ~25 of ~90 endpoints); DEPLOYMENT.md/DEPLOYMENT_GUIDE.md exist **[contents not fully audited]** |
| Deployment | ❌ No remote, no staging, Docker web-build broken, no migration step, uploads volume missing |
| CI/CD | ❌ Defined but has never executed |

---

## 16. Critical Bugs (prioritized)

| P | File | Problem | Impact | Fix |
|---|---|---|---|---|
| **CRIT-1** | (repo) | No git remote; CI executed 0 times; 34 uncommitted entries incl. whole Events feature + its migration; 5 prior audit reports deleted uncommitted | One disk failure loses unreviewed security-relevant work; no QA gate can exist | Create private remote, commit in reviewable chunks, push, branch-protect. **Owner: pm-agent. This is the same #1 as the last two audits.** |
| **CRIT-2** | both `package.json` | No Sentry/monitoring | Production failures invisible; DoD item; blocks 72 | ~0.5 d, DSN env-gated |
| **CRIT-3** | `web/Dockerfile` + `docker-compose.yml:59` | `NEXT_PUBLIC_API_URL` not passed at build → browser bundle calls `localhost:4000` | Total storefront failure on Docker deploy | Add `ARG/ENV NEXT_PUBLIC_API_URL` to build stage + compose `build.args` |
| **CRIT-4** | `web/app/admin/settings/page.tsx:64-80` | Masked secrets round-tripped on save → stored values corrupted to `••••••xxxx` | Silent data corruption behind a success toast | Don't send unchanged masked fields / server ignores mask pattern |
| **CRIT-5** | `TrustStats.tsx:26-31`, `Testimonials.tsx:7-27`, `page.tsx` marquee fallback | Fabricated dealer counts, testimonials with invented named people, invented "free delivery" policy — presented as real on a client's storefront | Reputational/consumer-protection risk; violates "nothing fake looks real" | Replace with client-supplied facts or clearly generic copy before launch |
| **CRIT-6** | `api/src/lib/cloudinary.ts:41-42` (+ ProductCard) | Absolute localhost upload URLs persisted to DB | All locally-uploaded product images broken in production | Store relative paths (root fix owed since v4) |
| **CRIT-7** | `api/.env:10` (919000000000) vs `web/lib/config.ts:5` (919029363910) vs `web/.env.local` (919769444053) | Three different WhatsApp business numbers; cart page ignores the API-returned number and uses its own | Dealer inquiries can go to a wrong/placeholder number — core business flow | Single env-sourced number; cart uses the API response |
| **CRIT-8** | `middleware/geo.ts` | Uncached free-tier IP lookup per request, fail-open | Geo restriction silently off + added latency at production traffic | Cache IP→state (TTL), paid tier or CDN geo header, alert on quota |
| HIGH-9 | `seed.ts:128` | Hardcoded default SUPER_ADMIN password | Known credential if seeded in prod | Require env var for seed password |
| HIGH-10 | `admin/orders.ts:84` | P2025 → 500 | Admin UI shows generic failure on stale row | try/catch → 404 |
| MED-11 | `docker-compose.yml` | No uploads volume | Image loss on rebuild | Mount volume (or mandate Cloudinary in prod) |
| MED-12 | `api/Dockerfile` | No migrate-deploy step despite comment | Schema drift on deploy | Entrypoint: `prisma migrate deploy && node dist/index.js` |

---

## 17. Missing / Hidden / Half-built Features

- **Settings encryption** — documented in 4 places, implemented nowhere.
- **DB-driven integration config** — UI exists, backend stores it, nothing consumes it (placebo).
- **Pricing** (`price`, `pricingActive`) — dormant by design (inquiry-only platform); correctly stripped from every response incl. admin. Fine, but undocumented as "future".
- **Session model** — designed, never used (JWT-stateless won).
- **Wishlist server sync** — page + hook exist, localStorage-only, absent from README.
- **`GET /api/brands`** (Brand model) — implemented; storefront uses the product-distinct variant instead; only admin consumes the model.
- **Events feature** — fully built + tested, **not committed**.
- **Broadcast messaging** (`POST /api/admin/notify/broadcast`) — implemented, absent from README/docs.

---

## 18. Final Verdict

**Production ready? NO. Can it be deployed today? No** — and not primarily because of code quality. The application layer is ~80% of the way there; the *operational* layer (remote, CI, monitoring, staging, real credentials, real content, deploy path) is ~20%.

**What would fail in production if deployed today:**
1. Docker deploy: storefront's browser bundle calls localhost → dead site (CRIT-3).
2. All locally-uploaded images 404 (CRIT-6) — with no Cloudinary creds configured, *every* image goes through the broken fallback.
3. Inquiries route to a placeholder WhatsApp number (CRIT-7) — the revenue flow.
4. Geo restriction silently disabled within hours; every public request pays an external-API latency tax until then (CRIT-8).
5. Any failure above is invisible — no Sentry, no log aggregation (CRIT-2).
6. First admin login: `admin / mxd@admin2026` from seed source (HIGH-9).
7. Fabricated testimonials/stats live on a real business's site (CRIT-5).

**Top 20 issues blocking deployment:** CRIT-1…CRIT-8, HIGH-9…MED-12 (§16), plus: catalog CSR (v4 threshold item), no staging environment, no DB backup plan, no migration step in deploy, README/API docs stale, envelope inconsistency, no frontend/E2E tests, CI's npm-audit never executed, uncommitted prior-audit deletions, dead schema/config cleanup (Session/libsql/encryption key).

**Effort to production-ready** (1 senior dev + reviewer):
- Phase A — unblock (0.5–1 d): remote + push + first CI run green + commit events feature.
- Phase B — ship-blockers (4–6 d): Sentry both apps; Docker build-arg fix + migrate-on-deploy + uploads volume; upload relative-URL root fix; WhatsApp number unification; settings round-trip fix (or remove placebo screen); geo caching; seed password; orders P2025; real homepage content (client dependency).
- Phase C — threshold + hardening (3–5 d): catalog SSR; staging deploy rehearsal on the VPS; prod credentials (client dependency: MSG91, Cloudinary, WhatsApp number); backup cron; smoke tests green in CI on every PR.
- **Total: ~2 working weeks** of focused effort, assuming client credentials arrive. Nothing here is research-grade; it is all execution.

**Score: 6.5/10 — unchanged in three weeks.** The delta between this project and "shipped" has not been engineering skill at any point since v4. It is that Phase 0 (remote + CI) keeps not happening while feature work continues. Same sentence as June 20, still true on July 4: **stop building features; push the repo, get CI green, do Sentry + catalog SSR, fix the deploy path.**

---

*Gate 5 attestation: §1–§17 claims cite the file/line read this session. Items marked [unverified] were not directly executed/read and must be re-verified before acting on them. Verified this session by execution: `tsc --noEmit` exit 0 (api, web) and `npm run build` exit 0 (api, web).*
