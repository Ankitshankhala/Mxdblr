# MXDBLR — Full QA Audit Report
**Prepared by:** QA Agent — Charu Solutions  
**Date:** 2026-06-02  
**Auditor Model:** claude-sonnet-4-6  
**Project:** MXDBLR — B2B Wholesale Mobile Accessories Platform  
**Client:** Bharat Ram Mali  

---

## 1. Executive Summary

### Overall Product Score: 62 / 100
### Launch Readiness Score: 38 / 100

The platform has a solid architectural foundation and the core dealer flow (OTP auth → catalog → cart → WhatsApp inquiry) is functionally complete. However, a cluster of critical and high-severity issues prevent production deployment: the database is configured for SQLite (not PostgreSQL as specified), the admin panel has hardcoded production credentials visible in browser, the Admin UI guard is client-side only (bypassable), the Settings page "Save" button is entirely fake, and there are no automated tests of any kind. The product is demo-able in development but is not production-safe.

### Top 3 Strengths
1. **Complete dealer flow end-to-end**: OTP send/verify → registration (3-step) → catalog browsing → cart → WhatsApp inquiry is fully implemented with good UX polish (animations, loading states, error handling).
2. **Solid API security architecture**: JWT type-separation (dealer vs admin tokens), Zod input validation on all mutation endpoints, Helmet security headers, rate limiting on OTP, and CORS whitelist are all present and correctly implemented.
3. **Feature breadth**: Banner management, CSV product import with column mapping, geo restrictions, restock notifications, dealer moderation with audit logs, and admin product CRUD are all implemented — well beyond a typical MVP.

### Top 3 Weaknesses
1. **Database mismatch (P0)**: The `api/src/prisma/schema.prisma` specifies `provider = "sqlite"` and uses `@prisma/adapter-libsql`. The README, system info panel, and project brief all state PostgreSQL. The production stack (Railway + `@prisma/adapter-pg` dependency) will not work with this schema. This is a fundamental infrastructure mistake.
2. **Admin credentials exposed in browser (P0)**: `web/app/admin/login/page.tsx` lines 186–194 hard-code `admin` / `mxd@admin2026` in a visible "Dev Credentials" box that will render in production. This is a critical security breach.
3. **Admin panel auth bypass via client-side guard (P1)**: `AdminGuard.tsx` only checks `localStorage.getItem("adminToken")`. There is no server-side middleware protecting admin pages. Any user who manually sets `adminToken` in localStorage gains admin UI access without a valid JWT.

---

## 2. Feature Audit Table

| Feature | Status | Severity | Notes |
|---|---|---|---|
| OTP Auth (send/verify) | Pass | — | Rate limiting present, 5-min expiry, invalidation on re-send. Missing: rate limit on `/verify-otp` endpoint |
| Dealer Registration (3-step) | Pass | — | Zod validation, OTP pre-check enforced, duplicate mobile check |
| Admin Login | Partial | P0 | Login works; credentials hard-coded in UI HTML (visible in production) |
| Product Catalog (list/filter/search) | Pass | — | Pagination, category filter, brand filter, stock status filter all working |
| Product Detail Page | Pass | — | Images, attributes, compatibility tags, MOQ, cart add, notify-me for OOS |
| Cart (add/update/remove/clear) | Pass | — | MOQ enforcement at API level, auth required |
| WhatsApp Inquiry | Pass | — | Message builder present, inquiry log written to DB, cart opened in WhatsApp |
| Admin Products (CRUD) | Pass | — | Create, read, update, delete, stock patch. CSV import with column mapping |
| Admin Categories (CRUD) | Pass | — | Full CRUD, bulk operations, sub-category support |
| Admin Dealers (list/moderate) | Pass | — | Moderation actions with audit logs |
| Admin Inquiries | Partial | P2 | List and status update work. Dashboard "Recent Inquiries" table uses hardcoded mock data (not live API) |
| Geo Restriction | Partial | P2 | Logic implemented but `geoCheckMiddleware` is a no-op (just calls `next()`). Enforcement only via `/geo/check` endpoint — not middleware-enforced on any dealer routes |
| Restock Notifications | Pass | — | Subscribe (anon + authed), admin trigger, WhatsApp send, subscription cleanup on send |
| Hero Banners | Pass | — | DB-driven, fallback banners in component, full admin CRUD with reorder |
| Admin Dashboard | Partial | P2 | Stats for dealers and today's inquiries always display 0 (not fetched from API); stock stats fetched but limited to 100 products |
| Admin Settings | Fail | P1 | "Save Settings" button simulates a save with `setTimeout` — no API call made. Settings are not persisted |
| Admin Password Change | Fail | P1 | "Change Password" button simulates change with `setTimeout` — no API endpoint, no actual DB update |
| Wishlist / Save | Fail | P3 | "Save" button visible on product page (Heart icon) but has no implementation |
| Sort (catalog) | Fail | P2 | Sort dropdown exists in UI but selected value is never passed to the API query |

---

## 3. Bug Report Table

| Bug ID | Location | Impact | Severity | Reproduction Steps |
|---|---|---|---|---|
| BUG-001 | `api/src/prisma/schema.prisma:6-7` | Complete production failure | P0 | Schema uses `provider = "sqlite"` and libsql adapter. Deploy to Railway with PostgreSQL URL → Prisma client fails to connect |
| BUG-002 | `web/app/admin/login/page.tsx:186-194` | Admin account compromised | P0 | Open `/admin/login` in production browser → credentials `admin` / `mxd@admin2026` are visible in plain HTML |
| BUG-003 | `web/app/admin/login/page.tsx:19` | API URL hardcoded | P1 | Admin login page uses `http://localhost:4000` directly instead of `process.env.NEXT_PUBLIC_API_URL`. Fails in any non-localhost environment |
| BUG-004 | `web/components/admin/AdminGuard.tsx:15-19` | Admin panel accessible without valid JWT | P1 | Open DevTools → `localStorage.setItem("adminToken", "anything")` → navigate to `/admin` → granted full admin access without authentication |
| BUG-005 | `web/app/admin/settings/page.tsx:27-30` | Settings not persisted | P1 | Admin → Settings → change WhatsApp number → click Save → toast shows "Settings saved" but nothing is stored |
| BUG-006 | `web/app/admin/settings/page.tsx:33-41` | Password change not functional | P1 | Admin → Settings → Change Password → enter values → click "Change Password" → toast shows success but DB not updated |
| BUG-007 | `web/app/admin/page.tsx:8-21` | Dashboard shows fake data | P2 | Admin dashboard "Recent Inquiries" table always shows the same 5 hardcoded rows regardless of actual DB inquiries |
| BUG-008 | `web/app/admin/page.tsx:24-26` | Dealer/inquiry counts always 0 | P2 | Admin dashboard StatCards for "Total Dealers" and "Inquiries Today" always show 0 — no API call made to fetch them |
| BUG-009 | `web/app/catalog/page.tsx:30,122-138` | Sort is non-functional | P2 | Catalog → change sort dropdown → products remain in same order. `sort` state is never passed to `productsApi.list()` |
| BUG-010 | `web/app/admin/products/page.tsx:15-16, 315` | `any` type on Product model | P2 | `category: any` and `attributes: any[]` on admin Product type causes runtime errors if API shape changes; also fires TS errors |
| BUG-011 | `api/src/routes/auth.ts:70` (verify-otp) | No rate limit on OTP verify | P2 | OTP verify endpoint has no rate limiter — brute force 6-digit OTP is possible (1,000,000 combinations, 5-min window) |
| BUG-012 | `api/src/middleware/geo.ts:6-8` | Geo restriction middleware is a no-op | P2 | `geoCheckMiddleware` only calls `next()` unconditionally. It is not used as middleware on any routes anyway |
| BUG-013 | `api/src/routes/admin/products.ts:172-173` | `any` type in catch block | P2 | `catch (e: any)` in CSV import — suppresses type safety on error reporting |
| BUG-014 | `web/app/admin/login/page.tsx:31` | `err: any` type | P3 | `catch (err: any)` in admin login bypasses type checking |
| BUG-015 | `api/src/lib/prisma.ts:10` | `any` type on Prisma client | P2 | `new PrismaClient({ adapter } as any)` bypasses type safety for Prisma constructor |
| BUG-016 | `web/app/product/[sku]/page.tsx:310` | "Save" button has no handler | P3 | Product page → click heart/Save button → nothing happens, no wishlist feature |
| BUG-017 | `api/src/routes/auth.ts:126-131` | OTP verification window too loose | P2 | `/register` checks for OTP used within last 10 minutes using `expiresAt > now - 10min`. OTP `expiresAt` is set to `now + 5min`, so valid window is actually 15 minutes total after a used OTP |
| BUG-018 | `web/app/admin/page.tsx:100-101` | Dashboard layout breaks on mobile | P3 | Two-column grid `1fr 340px` with no responsive fallback — breaks on screens < 768px |
| BUG-019 | `api/src/routes/admin/products.ts:307-317` | PATCH `/stock` missing input validation | P2 | `stockStatus` and `stockQty` are cast directly from `req.body` with no Zod validation — invalid enum values will throw a 500 |
| BUG-020 | `web/hooks/useAuth.ts:21-25` | Auth check does not verify token expiry | P2 | `useAuth` only checks if `mxd_token` exists in localStorage — expired tokens are treated as valid until the next API call returns 401 |
| BUG-021 | `api/src/index.ts:52` | Request body limit 50mb | P2 | `express.json({ limit: '50mb' })` is excessively large — enables large payload DoS attacks |
| BUG-022 | `web/app/admin/settings/page.tsx:218-226` | System info shows wrong stack | P3 | Settings page lists "Next.js 16", "PostgreSQL + Supabase", "Tailwind CSS v4" — actual stack is Next.js 15 (package.json says 16.2.6 but react is v19), SQLite in dev, no Supabase |

---

## 4. API Audit

### Public Endpoints

| Method | Path | Exists | Auth Enforced | Zod Validated | Error Handling | Notes |
|---|---|---|---|---|---|---|
| GET | /health | Yes | No (correct) | N/A | Yes | OK |
| POST | /api/auth/send-otp | Yes | No (correct) | Yes | Yes | OTP rate limit applied correctly |
| POST | /api/auth/verify-otp | Yes | No (correct) | Yes | Yes | **Missing rate limiter** — brute force risk |
| POST | /api/auth/register | Yes | No (correct — OTP check is internal) | Yes | Yes | OTP pre-check present but window is 15 min (see BUG-017) |
| POST | /api/auth/admin/login | Yes | No (correct) | No | Yes | `username` and `password` destructured from `req.body` with no Zod schema — no max length check |
| GET | /api/products | Yes | No (correct) | Yes | Partial | No try/catch around Prisma query (unhandled rejection risk) |
| GET | /api/products/brands | Yes | No | No | Yes | OK — read-only, no risk |
| GET | /api/products/:id | Yes | No (correct) | N/A | Partial | No try/catch — Prisma errors will bubble to global handler |
| GET | /api/categories | Yes | No | N/A | Partial | No try/catch |
| GET | /api/categories/:slug | Yes | No | N/A | Partial | No try/catch |
| POST | /api/notify-me | Yes | Optional (anon allowed) | Yes | Partial | No try/catch around Prisma upsert |
| GET | /api/geo/check | Yes | No | N/A | Yes | Uses ip-api.com (third party) — no fallback if quota exceeded |
| GET | /api/banners | Yes | No | N/A | Yes | OK |

### Dealer Endpoints (JWT Required)

| Method | Path | Exists | Auth Enforced | Zod Validated | Notes |
|---|---|---|---|---|---|
| GET | /api/cart | Yes | Yes (requireDealerAuth) | N/A | No try/catch |
| POST | /api/cart | Yes | Yes | Yes | MOQ check present |
| DELETE | /api/cart/:productId | Yes | Yes | N/A | Ownership check present |
| DELETE | /api/cart | Yes | Yes | N/A | OK |
| GET | /api/dealers/me | Yes | Yes | N/A | No try/catch |
| PUT | /api/dealers/me | Yes | Yes | Yes | OK |
| GET | /api/dealers/me/inquiries | Yes | Yes | N/A | Hardcoded limit of 50 — no pagination |
| POST | /api/inquiry | Yes | Yes | Yes | OK — WhatsApp message not actually sent to dealer, only URL returned |

### Admin Endpoints (Admin JWT Required)

| Method | Path | Exists | Auth Enforced | Zod Validated | Notes |
|---|---|---|---|---|---|
| GET | /api/admin/products | Yes | Yes | No | Query params manually parsed without Zod |
| POST | /api/admin/products | Yes | Yes | Yes | OK |
| PUT | /api/admin/products/:id | Yes | Yes | Yes (partial) | OK |
| DELETE | /api/admin/products/:id | Yes | Yes | No | No existence check before delete — 500 if ID invalid |
| PATCH | /api/admin/products/:id/stock | Yes | Yes | No | Enum not validated — BUG-019 |
| POST | /api/admin/products/csv-import | Yes | Yes | No | No size limit on CSV string; `e: any` in catch |
| GET/POST/DELETE | /api/admin/geo | Yes | Yes | Yes (POST only) | DELETE has no validation on `:id` |
| GET/PUT | /api/admin/dealers | Yes | Yes | Yes (PUT/moderate) | OK |
| GET | /api/admin/inquiries | Yes | Yes | No | Manual param parsing |
| PUT | /api/admin/inquiries/:id/status | Yes | Yes | Partial | Manual enum check, no Zod |
| GET | /api/admin/notify/subscriptions | Yes | Yes | N/A | No pagination — will return all rows |
| POST | /api/admin/notify/trigger/:productId | Yes | Yes | N/A | No concurrency control — calling twice sends duplicate notifications |
| GET/POST/DELETE | /api/admin/categories | Yes | Yes | Partial | POST/PUT use raw `req.body` extraction without Zod |
| GET/POST/PUT/DELETE | /api/admin/banners | Yes | Yes | No | Banner endpoints use raw `req.body` with no Zod validation |

---

## 5. Security Findings

| Vulnerability | File / Location | Risk Level | Recommendation |
|---|---|---|---|
| Hardcoded admin credentials in frontend HTML | `web/app/admin/login/page.tsx:186-194` | Critical | Remove the "Dev Credentials" div entirely before any deployment |
| Client-side only admin auth guard | `web/components/admin/AdminGuard.tsx:15-19` | High | Add Next.js middleware (`middleware.ts`) to validate `adminToken` JWT server-side before serving admin pages |
| No rate limit on OTP verify | `api/src/routes/auth.ts:70` | High | Apply `otpRateLimit` middleware to `/verify-otp` — same as `/send-otp` |
| JWT secret falls back to 'fallback-dev-secret' | `api/src/middleware/auth.ts:4` | High | Add startup assertion: `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set')` |
| OTP mock logs to console in dev — same code path in prod if key missing | `api/src/lib/msg91.ts:9-14` | Medium | The guard is `if (!MSG91_AUTH_KEY)` which also fires in prod if key is unset. Add a production check: if `NODE_ENV === 'production' && !MSG91_AUTH_KEY` → throw at startup |
| Admin login URL hardcoded to localhost | `web/app/admin/login/page.tsx:19` | High | Use `process.env.NEXT_PUBLIC_API_URL` |
| X-Forwarded-For IP spoofing for geo-bypass | `api/src/middleware/geo.ts:40-44` | Medium | Trust proxy header only when behind known proxy. Set `app.set('trust proxy', 1)` and rely on Express's `req.ip` instead of reading raw `x-forwarded-for` |
| Request body limit 50MB | `api/src/index.ts:52` | Medium | Reduce to `1mb` for JSON API; use multipart only on upload endpoints |
| No CSRF protection on state-mutating endpoints | API-wide | Medium | Since auth is JWT Bearer (not cookies), CSRF is lower risk for API. However, admin login page uses fetch with hardcoded URL — if cookies were ever introduced, CSRF would be an instant critical |
| Settings page shows fake API key values | `web/app/admin/settings/page.tsx:12-18` | Medium | Placeholder values `msg91-api-key-xxxxxx`, `cloudinary-api-key-xxxx` are shown in the UI — even as placeholders this trains admins to ignore security hygiene |
| Admin product delete has no existence check | `api/src/routes/admin/products.ts:302-304` | Low | Wrap in try/catch and return 404 for Prisma P2025 (record not found) |
| No Content Security Policy | `api/src/index.ts` (Helmet config) | Medium | Helmet is used but CSP headers are not explicitly configured — using defaults only |
| Database file committed to repo | `api/dev.db` present in file listing | High | SQLite dev.db should be in `.gitignore`. Contains real OTP codes and session data |
| No input sanitization on text fields for XSS | API-wide | Low | Zod validates shape but does not sanitize HTML. Since all data is served as JSON to React (which escapes by default), risk is low but `dangerouslySetInnerHTML` is not used anywhere, which is correct |

---

## 6. UX/UI Review

### Comparison against HTML design references (EXTRA/*.html)

The HTML references define a polished B2B portal with a navy/orange design system. The implemented Next.js pages broadly match this visual language. Specific findings per page:

**Homepage (`/`)**
- Implemented: Yes
- Design match: 8/10 — Marquee, hero slider, category grid, new arrivals, brand strip all present
- Mobile: 7/10 — Category scroll works; product grid collapses to 2-column (hardcoded via CSS classes). Marquee animation works via CSS keyframes
- Accessibility: 5/10 — Category image `alt` text is `cat.name` (good); Hero banner prev/next buttons have `aria-label` (good); OTP inputs have no `aria-label` per digit
- Missing states: Loading skeletons present for categories and products; error states for API failures are silent (no user-visible error message if categories fail to load)

**Catalog (`/catalog`)**
- Implemented: Yes
- Design match: 7/10 — Filter sidebar, product grid, pagination present
- Mobile: 6/10 — Mobile filter sheet implemented; sort dropdown hidden on mobile correctly; pagination breaks visually when >7 pages (only shows first 7 pages, no ellipsis)
- Missing: Sort is broken (BUG-009). No "no results" illustration (just text)
- Accessibility: 5/10 — Filter sidebar labels are not associated with inputs via `htmlFor`/`id`

**Product Detail (`/product/[sku]`)**
- Implemented: Yes
- Design match: 9/10 — Image gallery, attribute grid, MOQ badge, cart/notify flow all match
- Mobile: 7/10 — Two-column layout (`1fr 1fr`) uses className `flex-col md:grid` but Tailwind grid classes are not configured — layout may not collapse on mobile correctly (relies on Tailwind responsive prefix which requires the class to be in Tailwind config)
- Accessibility: 6/10 — Thumbnail buttons lack `aria-label`; accordion buttons are accessible (correct role)

**Auth (`/auth`)**
- Implemented: Yes
- Design match: 9/10
- Mobile: 9/10 — Full-height centered layout works on mobile
- OTP input: Accessible via keyboard (tab + backspace navigation implemented)
- Missing: No "wrong number? go back" after OTP sent (only "Change number" back button which is present — OK)

**Register (`/register`)**
- Implemented: Yes — 3-step form with progress indicator
- Design match: 8/10
- Missing: GST number field is on step 3 (review) which is unusual UX; state is a free-text input with no dropdown — dealers can enter misspellings that break geo logic

**Cart (`/cart`)**
- Implemented: Yes
- Design match: 8/10
- Mobile: 6/10 — Two-column summary layout uses `className="flex-col lg:grid"` — same Tailwind dependency issue as product page
- Missing: No "clear cart" button in UI (API exists). Submitting the inquiry does not clear the cart automatically

**Admin Panel**
- Implemented: Yes (products, categories, dealers, orders, notifications, geo, banners, settings)
- Design match: N/A (admin design is original)
- Mobile: 2/10 — Admin panel has no mobile layout. Sidebar is always visible; will break on mobile completely
- Missing: Admin dashboard metrics are hardcoded/non-functional (BUG-007, BUG-008)

**UX Scores Summary:**

| Page | Implementation | Design Match | Mobile | Accessibility |
|---|---|---|---|---|
| Homepage | 9/10 | 8/10 | 7/10 | 5/10 |
| Catalog | 7/10 | 7/10 | 6/10 | 5/10 |
| Product Detail | 9/10 | 9/10 | 7/10 | 6/10 |
| Auth | 9/10 | 9/10 | 9/10 | 7/10 |
| Register | 8/10 | 8/10 | 8/10 | 7/10 |
| Cart | 8/10 | 8/10 | 6/10 | 6/10 |
| Admin | 6/10 | N/A | 2/10 | 4/10 |

---

## 7. Database / Schema Review

**File:** `api/src/prisma/schema.prisma`

### Critical Issue
The schema specifies `provider = "sqlite"` and the Prisma client is instantiated using `@prisma/adapter-libsql` (a LibSQL/Turso adapter). The README and the project brief specify PostgreSQL. The `@prisma/adapter-pg` package is in `package.json` dependencies but is never used. This is the single biggest infrastructure defect.

### Schema Quality (assuming PostgreSQL target)

**Strengths:**
- Enums are well-defined: `DealerStatus`, `BusinessType`, `StockStatus`, `NotificationChannel`, `InquiryStatus`, `BannerType`
- Cascading deletes on `ProductAttribute` and `CompatibilityTag` via `onDelete: Cascade`
- Composite unique constraint on `CartItem (dealerId, productId)` — correct
- Composite unique constraint on `NotificationSubscription (phoneNumber, productId)` — correct
- Composite unique constraint on `GeoRestriction (state, district)` — correct
- `ModerationLog` model with admin + dealer foreign keys provides audit trail

**Issues:**

| Issue | Location | Severity |
|---|---|---|
| `Product.images` is `String` (comma-separated) not `String[]` | `schema.prisma:128` | P2 — PostgreSQL supports native arrays; using comma-separated strings requires manual serialization/deserialization in every route (and this is done inconsistently) |
| No index on `Product.brand` | `schema.prisma:113-135` | P2 — Brand filter is a common query; without an index every brand filter does a full table scan |
| No index on `Product.stockStatus` | `schema.prisma:113-135` | P2 — Stock status filter is used in catalog and admin; needs an index |
| No index on `Product.name` | `schema.prisma:113-135` | P2 — Text search on name is done with `contains` which cannot use a B-tree index anyway; consider full-text search for production |
| `Session` model is defined but never used | `schema.prisma:69-76` | P3 — JWT is stateless; Session table is populated nowhere in the codebase |
| No index on `OtpCode.mobile` | `schema.prisma:78-85` | P2 — Every OTP lookup queries by mobile; index required at scale |
| No index on `OtpCode.expiresAt` | `schema.prisma:78-85` | P3 — OTP cleanup queries filter by expiry |
| `Product.price` and `Product.pricingActive` exist in DB but sanitized out in every API response | `schema.prisma:124-125` | P3 — These fields exist in the schema but the `sanitizeProduct` function removes them from public responses. Good intent, but the schema should use `@omit` or the pricing fields should be on a separate `PriceList` model |
| `InquiryLog.cartSnapshot` is `String` (JSON stored as text) | `schema.prisma:171` | P2 — In PostgreSQL this should be `Json` type for better querying and indexing |
| `Dealer.status` defaults to `ACTIVE` | `schema.prisma:57` | P2 — Business risk: all new dealers are immediately active. Consider `PENDING_REVIEW` default to allow admin to approve |
| `updatedAt` on Category has `@default(now())` in addition to `@updatedAt` | `schema.prisma:99` | P3 — Redundant; `@updatedAt` handles this automatically |

### Scalability
- With SQLite the platform will not scale past ~5 concurrent writers. This is a development database, not production.
- Category N+1 on admin endpoint (`withStats` loop calling two `prisma.product.count()` per category) will degrade with many categories — fix with a single aggregation query.

---

## 8. Code Quality Issues

### TypeScript `any` Usage

| Location | Usage | Impact |
|---|---|---|
| `api/src/lib/prisma.ts:10` | `new PrismaClient({ adapter } as any)` | Bypasses Prisma constructor type check |
| `api/src/routes/admin/products.ts:173` | `catch (e: any)` | Suppresses error type |
| `web/app/admin/products/page.tsx:15-16` | `category: any`, `attributes: any[]` | Runtime errors possible if API changes shape |
| `web/app/admin/products/page.tsx:131,132,133` | `(p.attributes as any[]).map((a: any)` | Unsafe coercion |
| `web/app/admin/login/page.tsx:31` | `catch (err: any)` | Suppresses type |
| `web/app/admin/page.tsx:37` | `prods.filter((p: any)` | Unsafe array access |

### Missing Error Handling (no try/catch around Prisma queries)

- `api/src/routes/products.ts:62-85` — `Promise.all([findMany, count])` has no try/catch
- `api/src/routes/products.ts:92-104` — `findFirst` has no try/catch
- `api/src/routes/categories.ts:8-55` — entire route has no try/catch
- `api/src/routes/cart.ts` — all four handlers lack try/catch; unhandled Prisma rejections will crash the request
- `api/src/routes/dealers.ts` — all handlers lack try/catch
- `api/src/routes/notifications.ts:21-59` — notify-me has no try/catch

### Console.log in Production Paths

- `api/src/lib/msg91.ts:12` — `console.info` for OTP in dev. Guarded by `NODE_ENV === 'development'` check — acceptable. However if `MSG91_AUTH_KEY` is not set in production (misconfiguration), this fires in production.
- `api/src/lib/msg91.ts:43` — same pattern for WhatsApp dev mock

### Dead Code / Unused

- `api/src/prisma/schema.prisma:69-76` — `Session` model defined, never written to in any route
- `web/app/admin/settings/page.tsx` — `handleSaveSettings` and `handleChangePassword` are stubs with `setTimeout` — no real implementation
- Sort state in `web/app/catalog/page.tsx:29` — `sort` state is set but never read in API params

### Inconsistent Response Shapes

- `GET /api/products` returns both `data` and `products` keys pointing to the same array (line 80-81 in products.ts) — consumers get confused. Same duplication with `pagination`, `total`, `page`, `pages` all returned.
- `GET /api/admin/products` similarly returns both `products` and `data` keys.
- `GET /api/banners` returns `{ success, data }` without the `success: false` field on the 500 error (returns `{ error: '...' }` without `success`).

### Environment Variable Validation

There is no startup validation of required environment variables. The API will silently start with:
- `JWT_SECRET` = 'fallback-dev-secret' (token forgeable in dev if secret leaks)
- `DATABASE_URL` = 'file:./dev.db' (wrong database in production)
- No MSG91 key (OTP mocked silently)
- No Cloudinary credentials (image uploads silently fail, returning `null`)

Recommendation: Add a startup check like:
```typescript
const required = ['DATABASE_URL', 'JWT_SECRET'];
required.forEach(k => { if (!process.env[k]) throw new Error(`Missing env: ${k}`); });
```

---

## 9. Missing Features and Gaps

The following are described in the README or visible in the HTML designs but are not implemented or are non-functional:

1. **Dealer approval flow**: New dealers are set to `ACTIVE` by default. The design references and business model imply admin approval of new dealers. The `PENDING` status does not exist in the enum (only `ACTIVE`, `SUSPENDED`, `BLOCKED`, `REJECTED`).

2. **OTP rate limit on verify**: README describes security separation but `/verify-otp` has no rate limiter, making OTP brute-force trivial.

3. **Wishlist / Saved Products**: Heart/Save button on product page exists visually but has zero implementation.

4. **Catalog sort**: Sort dropdown is rendered but the selected value is never sent to the API.

5. **Admin Settings persistence**: The settings page UI exists but the Save button does nothing — no `/api/admin/settings` endpoint and no settings model in DB.

6. **Admin Password Change**: Change Password UI exists but no API endpoint `/api/admin/change-password` exists.

7. **Admin Dashboard live data**: Dealer count, inquiry count today, and the recent inquiries table all show hardcoded or always-zero values.

8. **Pagination for dealer inquiries**: `GET /api/dealers/me/inquiries` is hardcoded to `take: 50` with no pagination parameters.

9. **Notification pagination**: `GET /api/admin/notify/subscriptions` returns all subscriptions with no limit or pagination — will degrade at scale.

10. **Geo restriction enforcement as middleware**: `geoCheckMiddleware` is a no-op. Geo restrictions are advisory only (the frontend can call `/geo/check` and respect the result, but nothing enforces it on the backend).

11. **Image upload to Cloudinary from admin UI**: The admin product form uses `FileReader` to convert images to Base64 data URLs — these are stored as data URIs in the images field. Cloudinary upload functionality exists in `api/src/lib/cloudinary.ts` but is never called from any route. No `/api/admin/upload` endpoint exists.

12. **Search on mobile catalog**: The Navbar `onSearch` prop is passed to the catalog page but the mobile layout of the search bar is not tested.

13. **`/api/inquiry` route is NOT mounted**: Looking at `api/src/index.ts`, the `notificationsRouter` is mounted at `/api`. The inquiry endpoint is `router.post('/inquiry', ...)` inside `notifications.ts`. So it is reachable at `/api/inquiry`. This is correct but confusing — a dealer endpoint is in the notifications router file.

14. **Admin product attributes do not map to `AttributeType` records**: The admin product add/edit form uses free-text `key`/`value` pairs for attributes but the API `createProductSchema` expects `attributeTypeId` references. The admin form passes `attributes: [{key, value}]` but the API schema expects `attributes: [{attributeTypeId, value}]`. This means product creation via the admin UI will likely fail or produce empty attributes.

---

## 10. Performance Concerns

| Concern | Location | Impact |
|---|---|---|
| N+1 query in admin categories | `api/src/routes/admin/categories.ts:36-48` | For N categories, executes 2N+1 queries (one per category for activeCount + outOfStockCount). With 20 categories = 41 queries per page load |
| Products loaded into memory for stock filter on admin dashboard | `web/app/admin/page.tsx:29-39` | Fetches up to 100 products into frontend memory just to count low/out-of-stock — should be a server aggregation query |
| No database indexes on frequently filtered columns | `schema.prisma` | `Product.brand`, `Product.stockStatus`, `OtpCode.mobile`, `CartItem.dealerId` lack indexes |
| SQLite concurrent write limitation | `api/src/lib/prisma.ts` | SQLite with libsql has no WAL by default — any concurrent writes will queue or error |
| Hero banner fetches on every page mount | `web/components/home/HeroBanner.tsx:247-252` | Banner data re-fetched on every homepage render with no caching |
| Products API returns duplicate response fields | `api/src/routes/products.ts:78-85` | Response contains both `data` and `products`, `pagination` and separate `total`/`page`/`pages` — doubles payload size |
| `json({ limit: '50mb' })` | `api/src/index.ts:52` | Allows very large request bodies that could exhaust server memory |
| No `isActive` filter on products public endpoint | `api/src/routes/products.ts:48-61` | Inactive products (`isActive` field does not exist in this schema; `stockStatus` is used instead) are included in public responses unless filtered. The schema has no `isActive` — `stockStatus` is the only visibility control |

---

## 11. Business Logic Validation

### Inquiry-Only Model (No Pricing)
**Verdict: Correctly enforced.**
- `Product.price` and `Product.pricingActive` exist in schema but `sanitizeProduct()` explicitly strips them from all public API responses (`api/src/routes/products.ts:136-158`).
- Admin product API also strips them (`sanitizeAdminProduct` in admin/products.ts:99-105).
- Cart page correctly states "No pricing shown" and "Pricing is not shown on this portal."
- Risk: price fields exist in DB schema — if `sanitizeProduct` is ever accidentally skipped, pricing would leak.

### Dealer Registration Flow
**Verdict: Mostly complete with one gap.**
- OTP verification required before registration — correctly enforced via recent-OTP lookup.
- Mobile uniqueness check present.
- Gap: All new dealers are immediately `ACTIVE`. No admin approval step. The `moderationSchema` allows `ACTIVATE` as an action, implying the intent was to have a pending state, but there is no `PENDING` status in the enum.

### Admin Moderation
**Verdict: Implemented but not triggered automatically.**
- Admin can SUSPEND, BLOCK, REJECT, ACTIVATE dealers.
- Audit trail in `ModerationLog`.
- BLOCKED and REJECTED dealers are denied JWT generation on login.
- SUSPENDED dealers are NOT denied login (only BLOCKED and REJECTED are checked in `verify-otp:98`). This is a logic gap — SUSPENDED dealers can still authenticate.

### Geo Restriction Logic
**Verdict: Advisory only, not enforced.**
- `checkStateAllowed` queries DB correctly and falls back to hardcoded list of 4 states.
- `geoCheckMiddleware` is a no-op — no route uses it as middleware.
- `DEFAULT_ALLOWED_STATES` hardcodes Karnataka, Tamil Nadu, Andhra Pradesh, Telangana — Telangana is in the default-allow list but the README and homepage say "Karnataka, Tamil Nadu & Andhra Pradesh" only. Inconsistency.
- For production: backend must enforce geo restrictions, not just provide a check endpoint.

### Restock Notification Trigger
**Verdict: Implemented and complete.**
- Subscribe endpoint (anonymous + authenticated) exists and works.
- Admin trigger sends WhatsApp messages and cleans up successful subscriptions.
- Risk: No automatic trigger when stock status changes — admin must manually POST to `/api/admin/notify/trigger/:productId`. There is no hook in the stock update endpoint.

---

## 12. Recommendations Roadmap

### Immediate / Critical — Must fix before any client demo

1. **Fix Prisma schema for PostgreSQL**: Change `provider = "sqlite"` to `provider = "postgresql"`, remove `@prisma/adapter-libsql`, switch `prisma.ts` to use `@prisma/adapter-pg` with the `pg` package already in dependencies, run `prisma migrate dev`.

2. **Remove hardcoded credentials from admin login page**: Delete lines 175–194 of `web/app/admin/login/page.tsx` (the entire "Dev Credentials" box).

3. **Fix admin login URL to use env var**: Replace `http://localhost:4000/api/auth/admin/login` with `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/admin/login`.

4. **Add rate limit to OTP verify**: Apply `otpRateLimit` middleware to the `router.post('/verify-otp', ...)` handler in `api/src/routes/auth.ts`.

5. **Add JWT_SECRET startup assertion**: In `api/src/index.ts`, add before `app.listen`:
   ```typescript
   if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production');
   ```

6. **Fix SUSPENDED dealer login**: In `auth.ts:98`, change the condition to include SUSPENDED:
   ```typescript
   if (['BLOCKED', 'REJECTED', 'SUSPENDED'].includes(dealer.status)) {
   ```

### Short-Term — Fix before production launch

7. **Implement server-side admin route protection**: Create `web/middleware.ts` that reads the `adminToken` cookie or Authorization header and validates the JWT before serving any `/admin/*` route (excluding `/admin/login`).

8. **Implement Settings API**: Create `/api/admin/settings` GET and PUT endpoints with a `SystemSettings` model in the schema, or at minimum store WhatsApp number and other mutable config in DB. Remove the fake `setTimeout` implementation.

9. **Implement Password Change API**: Create `PUT /api/admin/change-password` endpoint in auth routes that takes current password, verifies against bcrypt hash, and updates.

10. **Fix admin dashboard live data**: Replace hardcoded `recentInquiries` array with an actual API call to `/api/admin/inquiries?limit=5`. Add API calls for total dealer count and today's inquiry count.

11. **Add product indexes to Prisma schema**:
    ```
    @@index([brand])
    @@index([stockStatus])
    ```
    On `Product` model; add `@@index([mobile])` on `OtpCode`.

12. **Change `Product.images` to `String[]`** in the PostgreSQL schema, removing the comma-serialization workaround across 4+ files.

13. **Fix category N+1**: Replace the per-category `prisma.product.count()` loop in `admin/categories.ts` with a `groupBy` aggregation.

14. **Reduce JSON body limit**: Change `express.json({ limit: '50mb' })` to `express.json({ limit: '1mb' })`.

15. **Implement Cloudinary upload endpoint**: Add `POST /api/admin/upload` that accepts a file (multipart) and calls `uploadImageFromBuffer`. Admin product form should POST files here and store returned URLs.

16. **Fix admin product attributes mismatch**: The admin form sends `{key, value}` but the API expects `{attributeTypeId, value}`. Either change the API to accept free-text attribute names (creating `AttributeType` records on the fly), or update the admin form to select from existing `AttributeType` records.

### Medium-Term — v1.1 Improvements

17. **Add `PENDING_REVIEW` dealer status**: Add to enum and set as default for new registrations. Add admin approve workflow.

18. **Fix catalog sort**: Pass `sort` state as an `orderBy` parameter to the products API. Add `orderBy` support to `GET /api/products`.

19. **Auto-trigger restock notifications**: After `PATCH /api/admin/products/:id/stock` updates status to `IN_STOCK`, automatically call the notification trigger logic.

20. **Implement wishlist**: Create `WishlistItem` model, add `GET/POST/DELETE /api/dealers/me/wishlist` endpoints, connect the Heart button on product page.

21. **Geo restriction middleware**: Create a Geo middleware that runs on dealer auth routes (or at least on `/api/cart` and `/api/inquiry`) and rejects requests from non-allowed states.

22. **Add try/catch to all Prisma queries**: All route handlers in `products.ts`, `categories.ts`, `cart.ts`, `dealers.ts`, `notifications.ts` are missing error handling. Unhandled Prisma errors will produce unhelpful 500 responses.

23. **Admin notifications pagination**: Add `page`/`limit` params to `GET /api/admin/notify/subscriptions`.

### Long-Term — Architecture

24. **Replace SQLite dev database**: Remove `api/dev.db` from version control, add to `.gitignore`. Document how to provision a local PostgreSQL instance.

25. **Add automated tests**: Zero tests exist. Start with integration tests for auth flow (send-otp → verify → register → login) and critical cart operations using Jest + Supertest. Add at minimum 5 Playwright E2E tests for happy paths.

26. **Add environment variable validation library**: Use `zod` or `envalid` to validate all required env vars at startup with clear error messages.

27. **Implement proper image storage flow**: Products should store Cloudinary public_ids, not full URLs or Base64. Use the `getOptimizedUrl` function already in `cloudinary.ts` to serve properly sized images.

28. **Add product `slug` field**: Public product pages currently use SKU as the URL parameter. Add a `slug` field for SEO-friendly URLs.

---

## 13. Final Verdict

### What Is Working Well
- The dealer authentication flow (OTP → registration → JWT) is solid and correctly implemented
- The catalog, product detail, and cart pages are feature-complete and visually polished
- WhatsApp inquiry end-to-end (build message → log inquiry → open WhatsApp) works
- API security fundamentals (Helmet, CORS whitelist, JWT type separation, Zod validation on most endpoints) are in place
- Admin CRUD for products, categories, dealers, and banners is functional
- CSV import with flexible column mapping is a genuinely strong admin feature
- The design system (tokens, components, animations) is consistent and professional

### What Is Broken
- **Database configuration is wrong for production** — SQLite schema, needs PostgreSQL
- **Admin panel exposes login credentials in the browser** — critical security failure
- **Admin guard is bypassable** — localStorage manipulation grants full admin access
- **Settings and password change are fake** — no API backing
- **Admin dashboard shows hardcoded mock data** — not connected to live DB
- **Catalog sort is non-functional**
- **SUSPENDED dealers can still log in**
- **No automated tests** — zero confidence in regressions
- **Admin product form can't create products with attributes** (attributeTypeId mismatch)

### Biggest Risk
The admin credentials (`admin` / `mxd@admin2026`) being displayed in the browser's HTML in the login page is the single most dangerous defect. If this application were deployed without removing that block, any visitor to `/admin/login` would have full admin access — ability to delete all products, block all dealers, and see all customer data.

### Production Ready?
**No.**

### Conditional Path to Production
The following 6 fixes are the minimum gate:
1. Switch Prisma to PostgreSQL provider and migrate
2. Remove hardcoded credentials from admin login page
3. Fix admin login to use `NEXT_PUBLIC_API_URL`
4. Add rate limit to OTP verify
5. Add JWT_SECRET startup assertion
6. Implement server-side admin route protection (middleware.ts)

After those 6 are done, the platform is safe to demo to the client on staging. Full production requires the complete short-term list.

### Confidence Score
Current state: **38%** production-ready.  
After critical fixes (items 1–6 above): **65%** production-ready.  
After full short-term list: **82%** production-ready.

---

*Report generated by QA Agent — Charu Solutions*  
*Model: claude-sonnet-4-6*  
*Date: 2026-06-02*
