# MXDBLR — Production Readiness Audit Report
**Prepared by:** Charu Solutions (Senior Audit — CTO / Security / QA / DevOps / UX)  
**Date:** June 6, 2026  
**App:** MXDBLR B2B Wholesale Mobile Accessories Portal  
**Stack:** Next.js 15 (frontend) · Express 5 + Prisma 7 (API) · PostgreSQL  
**Audit scope:** Full codebase static analysis (no live deployment available)

---

## EXECUTIVE SUMMARY

MXDBLR is a B2B dealer portal for wholesale mobile accessories — OTP login, product catalog, inquiry cart, WhatsApp-based ordering, and an admin control panel. The codebase is structurally sound and well-organized, with solid foundations in auth separation, Zod validation, rate limiting, and a clean design system.

**However, it is NOT production ready.** There are 4 Critical-severity security issues, multiple broken/missing features, zero CI/CD infrastructure, and no server-side rendering — which kills both SEO and performance on a platform whose key USP is product discoverability.

**Overall Production Readiness Score: 41 / 100**  
**Verdict: ❌ CRITICAL ISSUES BLOCKING LAUNCH**

---

## 1. FUNCTIONAL TESTING

### 1.1 Broken / Non-Functional Features

---

**BUG-001 — Wishlist is completely unimplemented**
- **Severity:** High
- **Reproduce:** Click the heart icon (Save) on any product page, or tap Wishlist in mobile bottom nav
- **Expected:** Add to wishlist / view saved items
- **Actual:** "Save" button renders but has no onClick handler. Wishlist page shows "Coming Soon" placeholder. Mobile nav link still routes to `/wishlist`.
- **Root cause:** Feature was scaffolded but never built
- **Fix:** Either implement wishlist (localStorage-based is fine for MVP) or remove the nav item and "Save" button from product page entirely until built

---

**BUG-002 — `/api/products/brands` endpoint does not exist**
- **Severity:** High
- **Reproduce:** Load the homepage. The brands strip section calls `fetch(\`\${API}/products/brands\`)` in `useEffect`.
- **Expected:** Returns distinct brand names for the "Brands We Carry" section
- **Actual:** 404, silently falls back to `['MXD']`. The entire brands strip shows only "MXD" regardless of catalog contents.
- **Root cause:** No route registered for `GET /api/products/brands` in the products router
- **Fix:** Add `router.get('/brands', ...)` to `api/src/routes/products.ts` doing `prisma.product.findMany({ select: { brand: true }, distinct: ['brand'] })`

---

**BUG-003 — Admin Dashboard "Stock Alerts" panel uses hardcoded fake data**
- **Severity:** High
- **Reproduce:** Open `/admin` dashboard
- **Expected:** Real-time low/out-of-stock products from the database
- **Actual:** Hardcoded static array `const lowStockProducts = [...]` with 4 fictional products (Samsung A54 TPU Case, Baseus Type-C 2m Cable, etc.). The "Update" button on each row does nothing.
- **Root cause:** Dashboard was built with mock data and never wired to the API
- **Fix:** Replace with a `useEffect` fetching `/api/admin/products?stockStatus=LOW_STOCK&limit=10` and `OUT_OF_STOCK`, merge results, wire "Update" button to stock update modal

---

**BUG-004 — Admin stock count is inaccurate (only checks first 100 products)**
- **Severity:** Medium
- **Reproduce:** Load admin dashboard with >100 products in catalog
- **Expected:** Accurate low/out-of-stock count
- **Actual:** Dashboard fetches `/api/admin/products?limit=100` and counts stock statuses client-side. Any catalog with >100 products will report wrong numbers.
- **Root cause:** Client-side aggregation against a page of results instead of a DB aggregate
- **Fix:** Add `/api/admin/products/stock-summary` endpoint that returns `prisma.product.groupBy({ by: ['stockStatus'], _count: true })`

---

**BUG-005 — Catalog layout CSS class does not exist (broken responsive layout)**
- **Severity:** High
- **Reproduce:** Open `/cart` on a medium-width screen (tablet, ~900px)
- **Expected:** Single-column responsive layout
- **Actual:** The cart page uses `className="flex-col lg:grid"` and the product page uses `className="flex-col md:grid"`. These Tailwind utility classes are not in the pre-built Tailwind base stylesheet and the project has no Tailwind compiler configured — only `@import "tailwindcss"` in globals.css with the v4 approach. These class names are never applied.
- **Root cause:** Tailwind class names used for responsive overrides but the grid/flex layout is done via inline `style` prop — the two approaches conflict. The responsive breakpoints never fire.
- **Fix:** Convert responsive layout to use CSS Grid with media queries in globals.css, or use inline style breakpoints via the `useIsMobile` hook already present in the codebase

---

**BUG-006 — Catalog pagination breaks silently above 7 pages**
- **Severity:** Medium
- **Reproduce:** Reach a filtered set with >168 products (7 pages × 24)
- **Expected:** All pages accessible
- **Actual:** `Array.from({ length: Math.min(totalPages, 7) }, ...)` always shows only 7 buttons. Pages 8+ are invisible and inaccessible. No ellipsis.
- **Root cause:** `Math.min(totalPages, 7)` is a hard cap
- **Fix:** Implement windowed pagination (prev, 1, ..., currentPage-1, currentPage, currentPage+1, ..., last, next)

---

**BUG-007 — Account pages are unimplemented routes**
- **Severity:** Medium
- **Reproduce:** Navigate to `/account` or `/account/profile`
- **Expected:** Dealer profile view/edit
- **Actual:** Pages exist as files but content unknown (not reviewed in detail). The Navbar likely links to `/account` post-login.
- **Root cause:** Scaffolded pages not yet built
- **Fix:** Implement profile view using `GET /api/dealers/me` and edit via `PUT /api/dealers/me`

---

**BUG-008 — OTP dev bypass (000000) could leak into staging/production**
- **Severity:** Critical (see Security section)

---

**BUG-009 — Cart state lost on unauthenticated WhatsApp inquiry click**
- **Severity:** Medium
- **Reproduce:** Add items to cart without logging in, click "Send WhatsApp Inquiry"
- **Expected:** Either redirect preserves cart, or a warning is shown
- **Actual:** `window.location.href = '/auth'` — hard redirect clears React state. If cart is server-side, items persist. But if user added items to a guest local state, they're gone. More importantly, there is no guest cart — cart is server-only — so unauthenticated users cannot actually add to cart at all (they get redirected to auth on product page), making this path partially dead.
- **Fix:** Verify cart add-to-cart redirects are consistent; add a message "Please sign in to continue with your inquiry" before redirect

---

**BUG-010 — Notify Me form has no mobile number validation feedback**
- **Severity:** Low
- **Reproduce:** Submit notify-me form with invalid number on an out-of-stock product
- **Expected:** Error message
- **Actual:** `handleNotifyMe` catches errors and does nothing (empty catch block). User sees no feedback.
- **Fix:** Add error state, show inline message on failure

---

**BUG-011 — `removeFromCart` optimistic update diverges from server state**
- **Severity:** Low
- **Reproduce:** Remove item from cart, quickly check cart count in Navbar
- **Expected:** Real-time accurate count
- **Actual:** `removeFromCart` in `useCart` does optimistic local filter but the `count` derived from `items.reduce(...)` updates immediately. However if the API call fails, the count is wrong and there's no re-sync. `updateQuantity` similarly updates local state but does not `refetch`.
- **Fix:** Either add `.finally(() => fetchCart())` to ensure re-sync, or handle error recovery explicitly

---

### 1.2 Missing Workflows

- No order confirmation email or WhatsApp auto-reply after inquiry logged
- No dealer approval flow — all registrations go straight to `ACTIVE` status
- No admin notification when new inquiry is submitted
- No pagination state in URL (back button loses page position in catalog)
- No "forgot account" / "contact support" link for blocked dealers

---

## 2. USER EXPERIENCE (UX) REVIEW

### Onboarding
- OTP flow is clean and well-executed — 6-box auto-advance, countdown timer, shake animation on error
- 3-step registration is logically structured
- **Issue:** No explanation of what the dealer portal is before asking for mobile number. New dealers landing on `/auth` see "Members Only" with no context about approval, service area, or what they're signing up for.
- **Issue:** After registration, dealers land on `/catalog` with `status: 'ACTIVE'` immediately — but the README says service area is Karnataka/TN/AP. There's no onboarding moment explaining the inquiry-only model to new dealers.

### Navigation
- Desktop navbar is functional; mobile bottom nav present
- **Issue:** MobileBottomNav includes "Wishlist" which routes to a dead page
- **Issue:** No breadcrumb on homepage; catalog breadcrumbs work correctly
- **Issue:** `window.history.back()` on product page is fragile — breaks if user opened the tab directly

### Empty States
- Cart empty state: ✅ (ShoppingBag icon + copy + CTA)
- Wishlist: placeholder only
- Product not found: ✅ handled
- Catalog with no results: needs verification (ProductGrid may render empty without a message)

### Loading States
- Catalog: skeleton via `ProductGrid loading prop` ✅
- Cart: skeleton ✅
- Product page: skeleton ✅
- Admin dashboard: partial — stats rows have no skeleton, only inquiry table
- **Issue:** All admin pages use bare `fetch()` with no loading states, no error boundaries

### Error States
- API errors on product page: sets `notFound` state ✅
- Cart API errors: shows `error` string (not displayed in UI, only tracked in state)
- Admin pages: most use empty catch blocks with no user feedback

### Information Architecture
- The inquiry-only model (no pricing) is a deliberate UX decision and is clearly communicated on the cart page. Good.
- The MOQ (minimum order quantity) is prominently surfaced — good for B2B

---

## 3. UI QUALITY REVIEW

### Strengths
- Consistent design token system (navy, orange, warm-white palette)
- `.card`, `.btn-orange`, `.btn-ghost`, `.btn-whatsapp` utility classes applied consistently
- Skeleton loading animations with CSS `@keyframes`
- Framer Motion transitions on auth/register steps

### Issues

| Issue | Location | Severity |
|-------|----------|----------|
| Responsive layout relies on non-existent Tailwind classes | cart/page.tsx, product/[sku]/page.tsx | High |
| No `<footer>` on any public page | All pages | Medium |
| No 404.tsx / not-found.tsx page in Next.js app router | web/app/ | Medium |
| Default Next.js boilerplate SVGs in `/public` (file.svg, vercel.svg, globe.svg, window.svg, next.svg) | public/ | Low |
| Only `res.cloudinary.com` in Next.js image domains — `<img>` tags used everywhere, bypassing optimization | All components | Medium |
| No dark mode support | Entire app | Low |
| No print stylesheet | — | Low |
| `useIsMobile` hook duplicated in admin/layout.tsx and admin/page.tsx | web/app/admin/ | Low |
| Inter and JetBrains Mono fonts declared in CSS `--font-sans/mono` but not loaded via `next/font` | globals.css | Medium |

### Font Loading
The CSS declares `font-family: 'Inter', system-ui, sans-serif` but Inter is never loaded. The browser falls back to system-ui. Add `next/font/google` for Inter.

---

## 4. PERFORMANCE AUDIT

### Critical Performance Issues

**All frontend pages are `'use client'`**
Every single page — homepage, catalog, product, cart, auth, register — is a client-side rendered page. This means:
- Zero server-side HTML delivered to crawlers
- Slow TTFB (browser waits for JS bundle, then makes API call)
- No streaming or SSR

**Recommended fix:** Convert static-data pages (product detail, catalog) to React Server Components with `async/await`. Only interactive components (cart button, OTP form) need `'use client'`.

**No image optimization**
`eslint-disable-next-line @next/next/no-img-element` used in multiple components. Cloudinary images are loaded at full resolution. No `width`/`height` specified → causes layout shift.

**Three separate API calls on homepage load**
- `productsApi.list()` — new arrivals
- `fetch(\`\${API}/categories\`)` — categories  
- `fetch(\`\${API}/products/brands\`)` — brands (currently 404)

All fired sequentially in one `useEffect`. These should be parallel (`Promise.all`) or moved to RSC.

**Admin dashboard fetches 100 products for client-side aggregation**
100 products loaded just to count stock statuses. Should be a single aggregation query on the server.

**No caching at any layer**
No `Cache-Control` headers on API responses, no `stale-while-revalidate`, no Next.js fetch cache configuration. Every page load hits the database.

**Framer Motion bundle size**
Framer Motion is imported on auth, register, cart, and product pages. It adds ~30KB gzipped. Consider using CSS transitions for simple use cases (accordion, OTP shake).

### Performance Score Estimate: 4/10
_(Cannot run Lighthouse against a running server, but based on code analysis: CSR-only + no image opt + no caching = poor Core Web Vitals)_

---

## 5. SECURITY AUDIT

### 🔴 CRITICAL

---

**SEC-001 — Trivially weak JWT secret committed to repository**
- **Risk:** CRITICAL
- **Location:** `api/.env` line 2, `web/.env.local` line 5
- **Detail:** `JWT_SECRET="mxd-dev-secret-2026"` — a guessable, dictionary-wordable secret is set as the signing key for all JWTs (dealer and admin tokens). An attacker who knows this secret can forge valid tokens for any `dealerId` or even forge an admin token with `type: 'admin'`.
- **Additional:** The secret is committed in plain text in `.env` (excluded by .gitignore on the API side) but `web/.env.local` is NOT in the web `.gitignore` — it is potentially committed to version control.
- **Fix:** Generate a 256-bit cryptographically random secret: `openssl rand -hex 32`. Store exclusively in a secrets manager or deployment environment variable. Rotate immediately on any deployment. Never share API and frontend JWT secrets.

---

**SEC-002 — OTP dev bypass (`000000`) leaks into production if NODE_ENV is misconfigured**
- **Risk:** Critical
- **Location:** `api/src/routes/auth.ts` line 79
- **Detail:** `const isDevBypass = process.env.NODE_ENV === 'development' && otp === '000000';`
- If the production server is started without explicitly setting `NODE_ENV=production` (e.g., just running `node dist/index.js` without the env var), `NODE_ENV` is undefined, the bypass is `false` — this is actually safe. BUT: `api/.env` has `NODE_ENV=development`. If that `.env` is deployed (common mistake), OTP `000000` bypasses all authentication for any mobile number, granting complete account takeover.
- **Fix:** Remove the bypass entirely. Use a test mobile number seeded in the database for staging. Enforce `NODE_ENV=production` at the process manager level. Do not ship `.env` files to production servers.

---

**SEC-003 — OTP stored as plaintext in the database**
- **Risk:** High
- **Location:** `api/src/routes/auth.ts` line 58 — `prisma.otpCode.create({ data: { mobile, code: otp, ... } })`
- **Detail:** OTPs are stored verbatim. A database breach exposes all valid OTPs, enabling account takeover for any phone number with a current OTP. 
- **Fix:** Store a bcrypt or HMAC-SHA256 hash of the OTP. Compare hash on verify, never the plaintext. Since OTPs are 6 digits (1 million values), bcrypt with cost 10 is sufficient.

---

**SEC-004 — Admin credentials (MSG91, Cloudinary API secret) stored in database and returned in API response**
- **Risk:** High
- **Location:** `api/src/prisma/schema.prisma` (SystemSettings model), `api/src/routes/admin/settings.ts`
- **Detail:** The SystemSettings model stores `msg91ApiKey`, `cloudinaryApiSecret`, `cloudinaryApiKey` in the database. The settings endpoint returns these values in plaintext to any authenticated admin. A compromised admin token exposes third-party API credentials. The API secret is used for Cloudinary signature generation — exposure allows attackers to delete or replace all product images.
- **Fix:** Store third-party credentials in environment variables, not the database. The DB settings model should contain only non-sensitive configuration (whatsappNumber, cloudinaryCloud name). API keys go in `.env` / secrets manager.

---

### 🟠 HIGH

**SEC-005 — X-Forwarded-For header is trusted without validation (IP spoofing)**
- **Risk:** High
- **Location:** `api/src/middleware/geo.ts` — `extractClientIp()`
- **Detail:** `req.headers['x-forwarded-for']` is taken at face value. An attacker can set `X-Forwarded-For: 203.0.113.1` (a Karnataka IP) in their request to bypass geo restrictions from any location. This completely defeats the geo-restriction feature.
- **Fix:** Configure `app.set('trust proxy', 1)` to trust only the first proxy hop (your load balancer), or whitelist only known proxy IPs. Use `req.ip` which Express sets correctly when `trust proxy` is configured.

---

**SEC-006 — No token revocation / session blacklist**
- **Risk:** High
- **Detail:** JWTs have no server-side invalidation. If a dealer token is stolen, or an admin password is changed, all existing tokens remain valid for their full lifetime (7 days dealer, 12 hours admin). There is no logout mechanism that actually invalidates the token server-side. The `Session` table exists in the schema but is never written to or checked.
- **Fix:** Implement the `Session` table properly — write token hash on login, check on each request, delete on logout. Or use short-lived access tokens (15 min) + refresh token rotation.

---

**SEC-007 — Admin panel relies purely on client-side auth**
- **Risk:** High**
- **Location:** `web/app/admin/layout.tsx` — `ProtectedShell` component
- **Detail:** Admin route protection is JavaScript in the browser. `localStorage.getItem('adminToken')` is checked and JWT decoded client-side. Any user who disables JavaScript or manipulates localStorage can bypass this check. There is no Next.js middleware (`middleware.ts`) verifying the admin JWT server-side before serving admin page HTML.
- **Fix:** Add `web/middleware.ts` using Next.js Edge Middleware. Verify the admin JWT (using `jose` for edge-compatible crypto) and redirect unauthenticated requests to `/admin/login` before any page is served.

---

**SEC-008 — Rate limiting is per-IP and easily bypassed with proxy rotation**
- **Risk:** Medium
- **Detail:** `express-rate-limit` stores state in memory (default in-memory store). This means: (a) Rate limit resets on server restart, (b) In a multi-process/multi-instance deployment, each instance has independent counters — an attacker can send 120 req/min to each instance. 
- **Fix:** Use `rate-limit-redis` store for shared state across instances. For OTP specifically, also rate-limit by mobile number, not just IP.

---

**SEC-009 — `dev.db` SQLite file present in the repository folder**
- **Risk:** High
- **Location:** `api/dev.db`
- **Detail:** The SQLite development database is present in the project folder. While `.gitignore` excludes it, it exists on disk. This file contains OTP codes, dealer registrations, and session data from development. On any server where the repo is cloned, this file will be read by Prisma if `DATABASE_URL` isn't set to PostgreSQL. Additionally, it should not be stored in the same directory as deployed code.
- **Fix:** Delete `dev.db` from the project folder. Ensure CI/CD never deploys with a SQLite URL.

---

**SEC-010 — No CSRF protection**
- **Risk:** Medium
- **Detail:** The API uses `Authorization: Bearer` header which is CSRF-safe by default (browsers don't auto-send auth headers on cross-origin requests). However, any cookie-based auth additions in the future would be vulnerable. The admin logout sets `document.cookie = "adminToken=..."` but auth reads from localStorage — this is inconsistent and could create confusion.
- **Fix:** Maintain the current header-based auth model. Remove the cookie manipulation in the admin logout handler (it's a no-op since auth reads from localStorage).

---

**SEC-011 — Admin login endpoint has no rate limiting**
- **Risk:** High
- **Location:** `api/src/routes/auth.ts` — `POST /api/auth/admin/login`
- **Detail:** The global `apiRateLimit` (120 req/min) applies but `adminRateLimit` (300 req/15min) is defined but never applied to admin login. 120 attempts per minute is insufficient to stop a credential stuffing attack.
- **Fix:** Apply `adminRateLimit` to the admin login route. Additionally add an account lockout after N failed attempts.

---

**SEC-012 — `Content-Security-Policy` not configured**
- **Risk:** Medium
- **Detail:** Helmet.js is applied but with default config. No `Content-Security-Policy` header is set on the API. The Next.js frontend also has no CSP configured in `next.config.ts`. This allows execution of any inline script injected via XSS.
- **Fix:** Add CSP headers in `next.config.ts` using `headers()` configuration.

---

## 6. BACKEND & API REVIEW

### API Inconsistencies

**Admin products endpoint returns duplicate data structure:**
```json
{ "products": [...], "data": [...], "count": n, "total": n }
```
Both `products` and `data` contain the same array. The frontend uses `d.products` in admin/page.tsx but `res.data.data` elsewhere. Pick one key and be consistent.

**Search queries are case-sensitive on PostgreSQL:**
`{ name: { contains: String(search) } }` without `mode: 'insensitive'` will not match "boat" when user searches "Boat". This was fixed correctly in `admin/dealers.ts` with `contains: search` (no mode) — but inconsistently applied. Should use `mode: 'insensitive'` on all text search queries.

**Unhandled promise rejections in admin routes:**
Most admin routes lack try/catch blocks. An unexpected Prisma error (e.g., record not found on `update`, unique constraint violation) will propagate to the global error handler — which works, but no meaningful error message is returned to the client. Example: `DELETE /api/admin/products/:id` — if `id` doesn't exist, Prisma throws `RecordNotFound`, which becomes a generic 500 instead of a 404.

**No input sanitization on image URLs:**
`Product.images` is an array of strings with no URL validation. An admin could store `javascript:alert(1)` as an image URL, which renders in `<img src={...}>` tags without sanitization.

**Fix:** Add `z.string().url()` validation on image arrays in product create/update schemas.

**`/api/admin/orders` is aliased to the same router as `/api/admin/inquiries`:**
```typescript
app.use('/api/admin/inquiries', adminOrdersRouter);
app.use('/api/admin/orders', adminOrdersRouter);  // alias
```
This is intentional per the code comment, but creates confusion. Document or consolidate.

### Missing Error Handling
- Admin products DELETE with non-existent ID → Prisma throws, unhandled
- Admin PUT product with non-existent ID → same
- `prisma.inquiryLog.update()` with bad ID → unhandled

---

## 7. DEVOPS & INFRASTRUCTURE REVIEW

### CI/CD: ❌ None
- No `.github/workflows/` directory
- No `Dockerfile` or `docker-compose.yml`
- No `Procfile` or PM2 ecosystem config
- No deployment scripts

### Build Process: ❌ Incomplete
- API: `npm run build` compiles TypeScript to `dist/`, but `dist/` is not present — API has never been production-built
- Frontend: `.next/` build artifacts exist (dev build only) — no production build confirmed
- No `npm ci` enforced; uses `npm install` which can introduce non-deterministic installs

### Environment Configuration: ❌ Critical gaps
- `api/.env` has `NODE_ENV=development` — **must be changed before deploy**
- `web/.env.local` has `NEXT_PUBLIC_API_URL=http://192.168.1.6:4000/api` — **LAN IP hardcoded, will fail in production**
- `web/.env.local` has `JWT_SECRET=mxd-dev-secret-2026` — **exposed in frontend env**
- `WHATSAPP_BUSINESS_NUMBER=919000000000` — **placeholder number**
- MSG91, Cloudinary credentials: empty — **integrations are mocked**

### Monitoring: ❌ None
- No APM (Sentry, Datadog, New Relic)
- No structured logging (only `console.log`/`process.stderr.write`)
- No uptime monitoring
- No alerting

### Database: ⚠️ Partial
- Prisma migrations exist and are versioned ✅
- `dev.db` SQLite file present in project folder ❌
- No connection pooling configured (Prisma default)
- No database backup strategy documented
- `prisma.config.ts` exists but schema path in `package.json` scripts vs config may conflict

### Scalability: ⚠️ Limited
- Express single process — no clustering
- Rate limiter in-memory — resets on restart
- No Redis, no queue, no async job processing
- No CDN configuration for static assets
- OTP delivery is synchronous (blocks request while awaiting MSG91)

### DevOps Score: 2/10

---

## 8. ACCESSIBILITY AUDIT

### WCAG 2.1 AA Violations

| ID | Issue | Impact | Location |
|----|-------|--------|----------|
| A-001 | OTP input boxes have no accessible labels | Critical | auth/page.tsx |
| A-002 | SVG icons in admin nav lack `aria-hidden="true"` or `title` | Serious | admin/layout.tsx |
| A-003 | `<button>` elements with only icon children have no `aria-label` | Serious | Multiple pages |
| A-004 | Muted text (#6B6B7D on #F8F6F2) fails WCAG AA contrast (3.8:1 vs 4.5 required) | Serious | Entire app |
| A-005 | No `:focus-visible` styles defined — keyboard users see no focus ring | Serious | globals.css |
| A-006 | Mobile filter overlay has no focus trap — keyboard focus escapes drawer | Serious | catalog/page.tsx |
| A-007 | No `<main>` landmark element on any page | Moderate | All pages |
| A-008 | No skip-to-content link | Moderate | All pages |
| A-009 | Marquee animation cannot be paused — violates WCAG 2.2.2 | Moderate | page.tsx (homepage) |
| A-010 | `autoFocus` on mobile number input may confuse screen readers | Minor | auth/page.tsx |
| A-011 | Admin table has no `scope` on `<th>` elements | Minor | admin/page.tsx |
| A-012 | Cart item quantity stepper has no `aria-label` describing what it controls | Minor | QtyStepper.tsx |

### Accessibility Score: 3/10

---

## 9. SEO AUDIT

### Critical SEO Issues

**All pages are `'use client'` — zero indexable content**
Google's crawler executes JavaScript but treats it as a secondary signal. Client-rendered pages with dynamic API data are poorly indexed. Product pages at `/product/[sku]` — which contain the most valuable long-tail SEO content — deliver an empty shell to crawlers.

**No page metadata**
No `export const metadata = { title, description }` in any `page.tsx` file. All pages share the default Next.js `<title>Create Next App</title>`.

**Missing SEO infrastructure**

| Item | Status |
|------|--------|
| `robots.txt` | ❌ Missing |
| `sitemap.xml` | ❌ Missing |
| OpenGraph tags | ❌ Missing |
| Twitter Card tags | ❌ Missing |
| Canonical URLs | ❌ Missing |
| Structured data (Product schema) | ❌ Missing |
| Alt text on product images | ⚠️ Only `product.name` — not descriptive |
| Semantic HTML headings hierarchy | ⚠️ Partial — multiple `<h1>` per page in some views |

**URL structure is acceptable:**
- `/catalog` — ✅
- `/product/[sku]` — ✅ SKU-based URLs are indexable
- `/catalog?category=headphones` — ⚠️ Query params are indexable but less optimal than `/catalog/headphones`

### SEO Score: 1/10

---

## 10. PRODUCTION READINESS SCORECARD

| Category | Score / 10 | Status |
|----------|-----------|--------|
| Functionality | 5 | ⚠️ Partial — broken features, missing endpoints |
| UX | 6 | ⚠️ Good foundation, dead flows |
| UI Quality | 6 | ⚠️ Design is solid, layout responsiveness broken |
| Performance | 4 | ❌ CSR-only, no caching, no image opt |
| Security | 2 | ❌ Critical vulnerabilities present |
| Accessibility | 3 | ❌ Multiple WCAG AA violations |
| Scalability | 3 | ❌ Single-process, no clustering |
| DevOps / CI-CD | 2 | ❌ No pipeline, no monitoring |
| Reliability | 4 | ⚠️ No error boundaries, partial error handling |
| SEO | 1 | ❌ Zero indexable content |

**Overall Score: 36 / 100**

### Launch Recommendation
> ❌ **CRITICAL ISSUES BLOCKING LAUNCH**

Do not deploy to production without resolving SEC-001, SEC-002, SEC-003, SEC-004, BUG-001, BUG-002, BUG-003, BUG-007, and the DevOps infrastructure gap.

---

## 11. PRIORITIZED BUG REPORT

| Priority | ID | Issue | Severity | Impact | Recommended Fix |
|----------|-----|-------|----------|--------|----------------|
| P0 | SEC-001 | Weak JWT secret committed to repo | Critical | Full account/admin takeover | Generate strong secret, use env var only |
| P0 | SEC-002 | OTP bypass active if NODE_ENV not set | Critical | Auth bypass for any account | Remove bypass, enforce NODE_ENV=production |
| P0 | SEC-003 | OTP stored plaintext in DB | Critical | Account takeover on DB breach | Hash OTPs with HMAC or bcrypt |
| P0 | SEC-004 | 3rd-party API keys stored in DB, returned via API | Critical | Credential exposure | Move to env vars, never return secrets |
| P1 | BUG-002 | `/api/products/brands` 404 | High | Brands section shows only "MXD" | Add route to products router |
| P1 | BUG-003 | Admin dashboard hardcoded fake data | High | Admin sees wrong stock reality | Wire to real API |
| P1 | BUG-005 | Responsive CSS classes non-functional | High | Layout broken on tablets | Fix responsive approach |
| P1 | SEC-005 | IP spoofing bypasses geo restrictions | High | Geo restriction defeated | Configure trust proxy correctly |
| P1 | SEC-006 | No token revocation | High | Stolen tokens remain valid 7 days | Implement Session table check |
| P1 | SEC-007 | Admin panel client-side auth only | High | Admin routes unprotected server-side | Add Next.js middleware |
| P1 | SEC-011 | Admin login no brute-force protection | High | Credential stuffing | Apply adminRateLimit + lockout |
| P1 | DEVOPS | No production environment config | High | LAN IP in env, NODE_ENV=development | Fix all env vars before deploy |
| P2 | BUG-001 | Wishlist unimplemented | High | User confusion, dead nav link | Remove from nav or implement |
| P2 | BUG-004 | Stock count only checks 100 products | Medium | Wrong dashboard metrics | Server-side aggregate query |
| P2 | BUG-006 | Pagination breaks >7 pages | Medium | Products unreachable | Implement windowed pagination |
| P2 | BUG-007 | Account pages empty | Medium | Dealers cannot view/edit profile | Implement profile pages |
| P2 | PERF-001 | All pages CSR-only | High | Poor TTFB, SEO zero | Convert to RSC where possible |
| P2 | PERF-002 | No image optimization | Medium | Layout shift, slow load | Use next/image component |
| P2 | SEC-008 | Rate limiter in-memory only | Medium | Bypassed in multi-instance | Redis store |
| P3 | BUG-010 | Notify Me error silenced | Low | No user feedback on failure | Add error state |
| P3 | A-001 | OTP inputs inaccessible | Serious | Screen reader unusable | Add aria-label |
| P3 | A-004 | Low color contrast on muted text | Serious | WCAG AA fail | Darken to #555 or better |
| P3 | A-005 | No focus-visible styles | Serious | Keyboard users cannot navigate | Add `:focus-visible` CSS |
| P3 | SEO-001 | No page metadata | High | Default "Create Next App" title | Add metadata exports |
| P3 | SEO-002 | No sitemap/robots | High | Poor crawlability | Generate via next-sitemap |

---

## 12. MISSING FEATURES

### Business-Critical Gaps
- **Dealer approval workflow** — Dealers auto-activate on registration. There is no admin review step. A rogue or fraudulent dealer can immediately access the catalog and submit inquiries. Add `status: 'PENDING'` as default, require admin approval to `ACTIVE`.
- **Email/WhatsApp notification to admin on new inquiry** — Admin currently discovers inquiries by manually checking the dashboard. A new inquiry should trigger a WhatsApp message to the business owner's number.
- **Dealer profile edit** — Dealers cannot update their own contact details, location, or GST number post-registration.
- **Order/inquiry tracking for dealers** — Dealers can submit inquiries but have no visibility into status. The `GET /api/dealers/me/inquiries` endpoint exists but no frontend page consumes it (beyond the account pages which are empty).

### Scalability Blockers
- **No async OTP delivery** — OTP send is synchronous, blocking the HTTP response. Use a job queue (BullMQ) for MSG91 calls.
- **No product image upload flow in the UI** — Admin can enter image URLs manually but the Cloudinary upload utility in `api/src/lib/cloudinary.ts` is never called from any route. There is no image upload endpoint.
- **No bulk stock update** — Admin must update products one at a time

### Enterprise/B2B Gaps
- **No GST invoice generation** — Critical for B2B in India
- **No dealer tier / pricing tier** — All dealers see the same products with no pricing; there's no mechanism to offer different pricing to different dealer tiers
- **No analytics** — No product view tracking, no most-inquired products, no dealer activity heatmap
- **No export** — No CSV export for inquiries, dealer list, or products from admin

### Monetization Blockers
- **Pricing field exists in schema** (`Product.price`, `Product.pricingActive`) but never surfaces in UI. The infrastructure for tiered pricing is present but unused.

---

## 13. FINAL CTO REPORT

### Executive Summary

MXDBLR is a well-conceived B2B wholesale portal with a clean product vision and thoughtful UX patterns. The codebase shows engineering maturity in several areas — proper Zod validation, role-separated JWT auth, geo-restriction middleware, and a consistent design system. However, the application has never gone through a security review, lacks production infrastructure entirely, and has multiple features that are scaffolded but non-functional. Launching in current state would expose the business and its dealers to serious security risks.

---

### Top 10 Critical Issues

1. **Weak JWT secret (`mxd-dev-secret-2026`) — forgeable tokens for any account or admin**
2. **OTP dev bypass active with misconfigured NODE_ENV — full auth bypass**
3. **OTPs stored plaintext — account takeover on any DB breach**
4. **3rd-party API secrets stored in DB and returned via API**
5. **No Next.js server-side middleware protecting admin routes**
6. **IP spoofing defeats geo restrictions entirely**
7. **No production environment configuration — LAN IP in env, dev mode in .env**
8. **All pages client-side rendered — zero SEO, poor performance**
9. **Admin login has no brute-force protection**
10. **No CI/CD, no monitoring, no rollback strategy — zero operational safety net**

---

### Top 10 Improvements (Post-Security Fix)

1. **Convert product/catalog pages to React Server Components** — dramatic SEO and performance improvement
2. **Add Next.js middleware for admin JWT verification** — real server-side protection
3. **Add sitemap.xml + metadata exports** — critical for organic dealer acquisition
4. **Implement dealer approval workflow** — business protection against fraudulent registrations
5. **Wire Cloudinary image upload to admin product form** — the utility exists, the UI doesn't
6. **Add Redis for rate limiter + session store** — production-grade auth
7. **Implement real-time admin notifications** (WebSocket or polling) for new inquiries
8. **Set up PM2 + Nginx + SSL** — basic production infrastructure
9. **Add Sentry for error monitoring** — blind operations without it
10. **Implement windowed pagination + URL state for catalog** — large catalog usability

---

### Estimated Engineering Effort

| Area | Effort |
|------|--------|
| Critical security fixes (SEC-001 through SEC-004) | 1 day |
| Admin middleware + server-side auth | 0.5 days |
| Fix broken/missing features (BUG-001 to BUG-007) | 3 days |
| RSC conversion for catalog + product pages | 2 days |
| Image optimization (next/image migration) | 1 day |
| DevOps setup (PM2, Nginx, SSL, CI/CD) | 2 days |
| SEO (metadata, sitemap, robots) | 1 day |
| Accessibility fixes | 1.5 days |
| Monitoring setup (Sentry + uptime) | 0.5 days |
| Dealer approval workflow | 1 day |
| **Total** | **~13.5 person-days** |

---

### Launch Risk Assessment

| Risk | Likelihood | Impact | Rating |
|------|-----------|--------|--------|
| JWT secret forged → admin takeover | HIGH | CRITICAL | 🔴 |
| OTP bypass → account takeover | MEDIUM | CRITICAL | 🔴 |
| Geo restriction bypassed | HIGH | HIGH | 🔴 |
| DB breach exposes plaintext OTPs | MEDIUM | HIGH | 🟠 |
| Hardcoded LAN IP → frontend 100% broken | HIGH | CRITICAL | 🔴 |
| No monitoring → silent outages | HIGH | HIGH | 🟠 |
| CSR-only → zero Google indexing | CERTAIN | HIGH | 🟠 |

---

### Go / No-Go Recommendation

## ❌ NO-GO

**Do not launch until the following are resolved:**
1. All SEC-00x critical/high issues patched
2. Production environment variables set correctly (new JWT secret, production API URL, NODE_ENV=production)
3. Next.js middleware added for admin route protection
4. `dev.db` deleted, `.env` files NOT deployed to server
5. MSG91 account configured with real auth key
6. At minimum, PM2 + basic process supervision in place

**Estimated time to minimum viable secure launch: 5–7 engineering days**

Once those are done, the application is structurally capable of serving real B2B dealers. The UX, SEO, and performance improvements can ship iteratively post-launch.

---

*Report generated by Charu Solutions — Audit Team*  
*Contact: ankitshankhala2112@gmail.com*
