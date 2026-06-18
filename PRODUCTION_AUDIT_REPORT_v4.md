# MXDBLR — Production Readiness Audit v4
**Audited:** 2026-06-12
**Auditor:** qa-agent (Charu Solutions)
**Scope:** Full re-verification of every v3 finding by direct source read in this session (Gate 5), plus new findings since v3 (2026-06-06). Code changes landed June 6–11 are reflected.
**Stack:** Next.js (App Router, standalone output) + React · Express 5 + TypeScript · Prisma v7 + PostgreSQL · Tailwind v4

> **Headline: 70/100 — below the 72/100 ship threshold.**
> The June 6–11 fix pass closed every code-level critical from v3, and a 34-test smoke suite now passes against a real Postgres and gates CI. What remains is concentrated in three buckets: **error monitoring (Sentry), production environment credentials, and the catalog CSR/SEO gap** — plus one process blocker (no version control) that no score can capture.

---

## Errata Log — v3 Corrections

Per audit discipline, claims in v3 that were wrong are documented here.

| v3 claim | Re-verified finding | Evidence |
|---|---|---|
| "Muted text `#6B6B7D` on `#F8F6F2` is 3.8:1 — fails WCAG AA" | Computed contrast is **~4.9:1 — passes** AA for normal text (also ≥5.2:1 on white cards) | WCAG relative-luminance formula on values in `web/app/globals.css:22` |
| "GET /api/admin/products and GET /api/products return duplicate `data` + `products` keys" | Not reproducible in current source: public route returns `data` only, admin route returns `products` only. (Key naming is inconsistent *across* the two domains — see BACK-2 — but no duplicates.) | `api/src/routes/products.ts:80-84`, `api/src/routes/admin/products.ts:254-262` |
| "Inquiry list hardcapped at 50, no pagination" (BUG-012) | Route now implements `page`/`limit` params with a `pagination` envelope. Could not determine whether v3 was correct on 2026-06-06 (no git history exists — see NEW-1); recorded as fixed-or-erratum. | `api/src/routes/dealers.ts:67-87` |

---

## v3 Bug Register — Verified Status

Every status below was verified by reading the named source file in this session.

### Critical (v3 ship-blockers)

| ID | v3 finding | Status | Evidence |
|---|---|---|---|
| BUG-001 | Weak JWT secret (19 chars) | **OPEN — env/ops** | `api/.env` (JWT_SECRET length 19; value not printed). Also mirrored in `web/.env.local`. CI now greps for hardcoded secrets in source (`.github/workflows/ci.yml:22-28`) — the weakness is confined to the local env file, but production deploy is blocked until regenerated at 256-bit. |
| BUG-002 | `MSG91_AUTH_KEY` empty — OTP SMS broken | **OPEN — client dependency** | `api/.env` (empty). Code path is sound: `sendOtp` falls back to a dev mock and the full OTP flow is now covered by passing integration tests using the explicit `ENABLE_OTP_BYPASS` + non-production path (`api/src/lib/msg91.ts:8-15`, `api/src/routes/auth.ts:82-107`). Real-SIM test remains a DoD item. |
| BUG-003 | Product images stored as base64 in DB; `<Image>` refuses to render | **FIXED — verified end-to-end** | Admin FE reads the file as a data URI *only as transport*, POSTs to `POST /api/admin/upload`, and stores the returned URL (`web/app/admin/products/page.tsx:369-398`). The endpoint validates MIME + 5 MB limit and uploads to Cloudinary (`api/src/routes/admin/upload.ts`). Graceful 503 with actionable message when credentials are absent. |
| BUG-004 | `NODE_ENV=development` in `api/.env` | **OPEN — env/ops** | `api/.env`. Expected on a dev machine; must be `production` at deploy. Geo dev-shortcut and CORS LAN allowances key off this. |
| BUG-005 | `NEXT_PUBLIC_API_URL` points to LAN IP | **IMPROVED** | Now `http://localhost:4000/api` (`web/.env.local`) — no longer a hardcoded LAN IP; production URL still required at deploy. CI builds with `https://api.mxdblr.com/api` (`ci.yml:137`). |
| BUG-006 | Cloudinary credentials empty | **OPEN — client dependency** | `api/.env` (all three empty). Upload route degrades to local-disk fallback (see NEW-3). |
| BUG-007 | Admin dashboard shows hardcoded fake low-stock data; dead "Update" button | **FIXED** | Dashboard fetches real counts from `groupBy` stock summary and real alert products from the API (`web/app/admin/page.tsx:52-156`, `api/src/routes/admin/products.ts:205-215`). |

### High

| ID | v3 finding | Status | Evidence |
|---|---|---|---|
| BUG-008 | `web/.env.local` not confirmed gitignored | **FIXED** | `web/.gitignore:34` has `.env*`; CI independently fails any commit containing real `.env` files (`ci.yml:38-44`). Caveat: only `web/` is a git repo at all (NEW-1). |
| BUG-009 | Geo lookup over plain HTTP (MitM-able) | **FIXED** | Lookup now uses `https://ipapi.co` with a 3 s abort timeout and fail-open (`api/src/middleware/geo.ts:41-57`). |
| BUG-010 | Registration state field is free text — geo bypass | **FIXED** | State is now a `<select>` dropdown (`web/app/register/page.tsx:307-309`); server still independently validates via `checkStateAllowed`, and the IP-based `geoCheckMiddleware` gates the auth/products/categories routes (`api/src/index.ts:95-97`). Verified by passing test: registration from "Maharashtra" → 403. |
| BUG-011 | `DELETE /api/admin/products/:id` 500s on unknown ID | **FIXED + regression-tested** | P2025 → 404 handled (`api/src/routes/admin/products.ts:357-369`). The same gap existed on `PUT /:id` and the stock handlers — **fixed during this audit** and locked with two new tests (see NEW-2). |
| BUG-012 | Inquiry list hardcapped, no pagination | **FIXED** | `page`/`limit` + `pagination` envelope (`api/src/routes/dealers.ts:67-87`). See errata. |
| BUG-013 | No error monitoring | **OPEN** | No `@sentry/*` in either `api/package.json` or `web/package.json` (verified). This is also a Definition-of-Done item in CS-SOW-2026-003. |

### Medium

| ID | v3 finding | Status | Evidence |
|---|---|---|---|
| BUG-014 | Wishlist N+1 product fetches | **OPEN** | No batch endpoint in `api/src/routes/products.ts` (grep verified). Acceptable for typical wishlist sizes; still recommended. |
| BUG-015 | Admin orders date filter is client-side only | **OPEN (acknowledged in code)** | `web/app/admin/orders/page.tsx:131` — comment states "Client-side date filter applied on top of server results". |
| BUG-016 | `clearCart` silent fail | **FIXED during this audit** | The catch block was a dead path (zero callers), but the hook now returns `{ success, message }` like every other mutation and preserves local state on failure (`web/hooks/useCart.ts:70-80`). |
| BUG-017 | Duplicate response keys | **Not reproducible** — see errata. Cross-domain key inconsistency remains (BACK-2). |
| BUG-018 | `adminRateLimit` dead export | **FIXED** | Zero occurrences in `api/src/middleware/rateLimit.ts` (grep count: 0) — removed. |
| BUG-019 | `Session` model is dead schema | **OPEN** | `api/src/prisma/schema.prisma:70` — model still present, still unqueried. |
| BUG-020 | SystemSettings stores API keys in DB | **PARTIALLY MITIGATED** | Schema fields remain, but values default to empty, reads are masked via `maskSecret`, and the file carries `// TODO: Move to env vars in next sprint — never store API secrets in DB` (`api/src/routes/admin/settings.ts:11-33`). Actual credentials currently live nowhere (empty in both DB defaults and env). Close out by removing the DB fields. |

---

## New Findings (v4)

**NEW-1 — CRITICAL (process): No version control.**
There is no git repository for the project. `web/.git` contains only the stock "Initial commit from Create Next App" with all real work uncommitted; `api/` has no repo at all; `githubRepo: null` in the project record. ~₹1.83L of work exists only as files on one machine, per-PR QA review (Gate 3) is physically impossible, and the CI pipeline in `.github/workflows/ci.yml` has never run. **Escalated to pm-agent — Kickoff Ritual step 2 is incomplete.** This is the single highest-risk item in the project and is not capturable in the score below.

**NEW-2 — HIGH (fixed during audit): `PUT /api/admin/products/:id` and stock handlers 500'd on unknown IDs.**
The P2025 fix from BUG-011 was applied to DELETE only. PUT and PATCH/PUT `:id/stock` propagated P2025 to the global handler as a 500. Fixed in `api/src/routes/admin/products.ts` (P2025 → 404) and locked with two regression tests. Per the backend enforcement clause — a 500 for a predictable case is a bug.

**NEW-3 — MEDIUM: Local upload fallback produces URLs `next/image` will refuse.**
When Cloudinary credentials are absent, `uploadImageFromBuffer` writes to local disk and returns `http://localhost:<port>/uploads/...` (`api/src/lib/cloudinary.ts:10-28`), but `web/next.config.ts` `remotePatterns` allows only `https://res.cloudinary.com` and `https://mxdindia.com`. Any product image uploaded in dev-fallback mode renders broken on the catalog. Dev-only inconvenience today; becomes a production bug if deployed without Cloudinary credentials. Fix: either block uploads without credentials, or whitelist the API origin in dev.

**NEW-4 — LOW: Leftover libSQL dependencies.**
`@libsql/client` and `@prisma/adapter-libsql` remain in `api/package.json` while the only adapter in use is `@prisma/adapter-pg` (`api/src/lib/prisma.ts`). Remove.

**BACK-2 — LOW: Response envelope inconsistency across domains.**
Public routes use `{ success, data }`; admin products uses `{ success, products, total, page, ... }`. The company standard is one envelope per project (`{ success, data, pagination? }`). Not a blocker; align when convenient.

**Positive findings since v3 (all verified):**
- **Smoke-test floor now exists: 34 integration tests, all passing**, covering OTP auth (send/verify/bypass/hash-at-rest), registration + geo gate (allowed state 201 / blocked state 403 / duplicate 409), cart MOQ + out-of-stock enforcement, WhatsApp inquiry with persisted `cartSnapshot`, dealer inquiry history, admin login + token-type isolation, and full admin product CRUD incl. 404 paths (`api/src/__tests__/`, run: `npm test`). Fixtures are self-cleaning — zero leftover rows verified post-run.
- **CI pipeline** (`.github/workflows/ci.yml`): secret scan (hardcoded JWT grep, OTP-bypass check, committed-.env check), typecheck + dependency audit for both apps, **smoke tests against a Postgres 16 service container with migrations applied**, and builds gated behind all of it.
- **Dockerfiles for both apps + docker-compose + nginx config + DEPLOYMENT_GUIDE.md** present.
- **`.env.example` files** exist for both apps.
- **`robots.ts` + `sitemap.ts`** added (`web/app/`).
- **`:focus-visible` styles** present in `globals.css` (6 rules) — v3's top accessibility failure closed.
- **Toast notification system** across all admin pages (`web/components/admin/Toast.tsx`).
- **Banner system** (June 11): public `GET /api/banners` returns active banners only; admin banner CRUD is auth-gated (`router.use(requireAdminAuth)`).
- **Both apps type-check clean** (`tsc --noEmit` verified this session).

---

## Scorecard

| Category | v3 | v4 | Weight | Weighted | Movement driver |
|---|---|---|---|---|---|
| Functional Testing | 62 | **80** | 20% | 16.0 | Both code criticals fixed; every core flow proven by 34 passing integration tests; OTP SMS still untestable without MSG91 key |
| UX Review | 68 | **74** | 10% | 7.4 | Admin toast system; state dropdown; sort-in-URL and dealer-side toasts still missing |
| UI Quality | 74 | **76** | 8% | 6.1 | Toast consistency in admin; otherwise unchanged |
| Performance | 66 | **66** | 10% | 6.6 | Unchanged — catalog still full CSR, wishlist N+1 remains |
| Security | 52 | **68** | 18% | 12.2 | HTTPS geo, state dropdown + IP-based enforcement, CI secret scanning, masked settings; weak JWT + dev NODE_ENV persist in env |
| Backend & API | 64 | **78** | 12% | 9.4 | P2025 handled on all mutating product routes (regression-tested), pagination added, upload endpoint, dead export removed; Session model + envelope inconsistency remain |
| DevOps & Infrastructure | 28 | **62** | 10% | 6.2 | CI with tests + Docker + compose + nginx + env examples + deploy guide; **no Sentry, no deployed staging, CI has never executed (no repo)** |
| Accessibility | 28 | **45** | 6% | 2.7 | focus-visible fixed; contrast erratum corrected in v3's favor reversal; no skip link, ARIA gaps, div click-handlers remain |
| SEO | 48 | **56** | 6% | 3.4 | robots + sitemap added; catalog CSR remains the dominant gap; no JSON-LD |

## **Overall: 70/100 — NOT YET AT THRESHOLD (72)**

### Verdict

**The score does not clear 72.** It moved 62 → 70 on the strength of the June fix pass and the new test floor, but the remaining two points are not polish — they map to exactly the items the SOW Definition of Done already requires:

| Gap | Owner | Effort | Est. score impact |
|---|---|---|---|
| 1. Sentry on frontend + backend (DoD item, devops gate) | devops-agent | ~half day | DevOps 62→70 ⇒ **+0.8 → 70.8** |
| 2. Catalog → Server Component with `searchParams` | frontend-agent | ~1 day | Perf 66→72, SEO 56→64 ⇒ **+1.1 → 71.9** |
| 3. Production credentials: MSG91 key, Cloudinary, 256-bit JWT, `NODE_ENV=production`, prod API URL | client + devops-agent | ~1 hour once received | Functional 80→85, Security 68→78 ⇒ **+2.8 → ~74.7** |

Any two of the three clear the threshold; all three land ≈ 74–75. Items 1–2 are ~1.5 engineering days and fully in our control. Item 3 is blocked on client dependencies already tracked in the project record.

**And independently of the score: nothing should ship — or even continue development — until NEW-1 (no version control) is resolved.** One disk failure erases the project. pm-agent must create the GitHub repo and commit the current state before any further work.

---

## Test Suite Reference

```
api/
├── jest.config.js              # ts-jest, runs src/__tests__/*.smoke.test.ts
├── tsconfig.test.json          # extends base; adds jest types; noEmit
└── src/__tests__/
    ├── setup-env.ts            # NODE_ENV=test, ENABLE_OTP_BYPASS=true
    ├── fixtures.ts             # self-cleaning fixtures (RUN_ID-stamped)
    ├── auth.smoke.test.ts      # 9 tests  — OTP, hash-at-rest, registration, geo gate
    ├── cart.smoke.test.ts      # 11 tests — auth isolation, MOQ, stock, inquiry snapshot
    └── admin.smoke.test.ts     # 14 tests — login, route gating, CRUD, 404 paths
```

Run locally: `cd api && npm test` (requires Postgres per `DATABASE_URL`).
In CI: `api-tests` job runs against a Postgres 16 service container with migrations applied; `build-api` will not run unless tests pass.

*Audit conducted with direct source reads of every cited file in this session. v4 supersedes v3.*
