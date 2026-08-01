# BACKLOG TICKET — Hero Banner Mobile Source Image

| Field | Value |
|---|---|
| **Title** | Add optional per-banner mobile source image to hero carousel |
| **Status** | **BACKLOG — BLOCKED ON PIPELINE HEALTH** |
| **Project** | MXDBLR — `proj-20260528-001` |
| **SOW Ref** | CS-SOW-2026-003 |
| **Created** | 2026-07-04 |
| **Requested by** | Design / team proposal |
| **Approved by** | CEO Agent (sequenced POST-LAUNCH / AFTER-CI-GREEN — not in the current sprint) |
| **Effort** | ~0.5 day dev once unblocked (per CEO) |

---

## Summary

The homepage hero (`HeroBanner.tsx`) is a **multi-slide carousel** and is **already responsive** — it uses a `useIsMobile()` hook at a 768px breakpoint, stacks content on mobile, switches the gradient direction (top-to-bottom on mobile vs left-to-right on desktop), and resizes assets for small screens. The single gap is that the background `image` field renders on **both** desktop and mobile, cropped via `object-fit: cover`, so a landscape desktop hero can crop badly on a tall phone viewport.

This ticket adds **one** optional field, `mobileImage`, so admins can supply a phone-optimised source image per banner. When `mobileImage` is empty, the carousel falls back to the existing desktop `image` with no behavioural change.

---

## Blocked-by (must clear first, in order)

**No new-feature merge until CI is green.** This ticket does not start until the MXDBLR pipeline is healthy. The following blockers (per Production Audit v5, 2026-07-04) must clear first, in order:

1. **Git remote + push** — repo has no remote; work cannot be pushed or reviewed.
2. **CI green (Gate 3)** — CI has **never run**. Continuous per-merge QA is impossible until the pipeline executes and passes. This is the hard gate for this ticket.
3. **Sentry** — error monitoring wired into both frontend and backend (currently absent).
4. **Catalog SSR** — catalog is client-side rendered; SSR fix outstanding.
5. **Deploy-path fixes** — broken Docker web build and deploy-path issues resolved.
6. **Content / config fixes** — settings-save secret corruption, placebo settings screen, fake testimonials, and the 3 conflicting WhatsApp numbers resolved.

> Until item 2 (CI green) is true, this ticket stays in BACKLOG. It must not be pulled into an active sprint before then.

---

## Scope

### In scope
- New optional Prisma field `mobileImage String @default("")` on the existing `Banner` model.
- Graceful fallback: empty `mobileImage` → render desktop `image` (no regression).
- Admin upload field for the mobile image, with size-hint text.
- Device-based swap in the carousel: mobile viewport (<768px) uses `mobileImage` (or falls back to `image`); tablet/desktop (>=768px) uses `image`.

### Explicitly OUT of scope
- **No tablet/third asset.** Tablet uses the DESKTOP image; the existing 768px breakpoint already governs this.
- **No redesign** of the carousel, its layout, gradients, animation, or controls.
- **`displayOrder` and `active`/inactive fields — already exist.** Do NOT add or duplicate them. `displayOrder` field + `PUT /reorder/bulk` route + `active` field are all already implemented in schema, admin route, and admin UI.

---

## Build order (Gate 2: Schema → Contract → Consumer)

### 1. db-schema-agent — Schema + migration
- Add `mobileImage String @default("")` to the `Banner` model in `outputs/mxdblr/api/src/prisma/schema.prisma`.
- Place it alongside the existing `image` field for readability. Keep the existing fields untouched: `id, bannerType, title, subtitle, ctaText, ctaLink, image, bgColor, accentColor, logoImage, productImage1..3, overlayOpacity, textAlignment, active, displayOrder, createdAt, updatedAt`.
- **Migration caveat:** this project's local DB has previously **drifted from migration history**, and hand-authored migrations have been required. Do NOT rely on `prisma db push`. Author the migration explicitly and **verify the `prisma migrate` path runs clean in CI** (not just locally). Because the column is `@default("")`, the migration is additive and non-destructive to existing banner rows.
- PM explicit sign-off required before Step 2 begins.

### 2. backend-api-agent — Contract first, then implementation
- Thread `mobileImage` through the admin handlers in `outputs/mxdblr/api/src/routes/admin/banners.ts`:
  - **POST /** — destructure `mobileImage` from `req.body` and add `mobileImage: mobileImage || ''` to the `data` block (mirror the existing `image: image || ''` pattern).
  - **PUT /:id** — add `...(mobileImage !== undefined && { mobileImage })` to the update `data` block (mirror the existing `image` update guard exactly).
- Public route `outputs/mxdblr/api/src/routes/banners.ts` uses `findMany` (returns all model fields), so `mobileImage` flows through automatically — **verify** it appears in the response payload; no query change should be needed.
- Keep the single response envelope `{ success, data }` unchanged. Do NOT introduce a new envelope shape.
- Publish the updated request/response shape to the project record before frontend consumes it.

### 3. frontend-agent — Consume the contract
File: `outputs/mxdblr/web/components/home/HeroBanner.tsx`
- Add `mobileImage: string;` to the `Banner` interface.
- Add `mobileImage: ""` to **each** entry in `FALLBACK_BANNERS` (currently f1, f2, f3) so the fallback array satisfies the updated interface.
- In the background-image render block (the `{b.image && (...)}` `<img>` around lines 425–438), select the source as:
  ```
  isMobile ? (b.mobileImage || b.image) : b.image
  ```
  and run the chosen value through `normalizeImg()` (same as the current desktop path). Keep the existing `alt=""` / `aria-hidden` / `onError` handling **identical** to today — no change to empty/alt handling.
- Do NOT touch the gradient logic, product-image panel, brand-logo panel, tablet path, or any control. Only the background source selection changes.

File: `outputs/mxdblr/web/app/admin/banners/page.tsx`
- Add a **Mobile Image** upload field next to the existing desktop image field, wired to the `mobileImage` property (mirror the existing image upload control).
- Add hint text with recommended sizes: **Desktop 1920×700, Mobile 1080×1350.**
- Do NOT add/duplicate `displayOrder` or `active` controls — they already exist.

### 4. qa-agent — Per-PR review (Gate 3)
Review every PR in this chain before merge. Acceptance criteria below.

---

## Acceptance criteria

- [ ] `mobileImage` is optional (`String @default("")`); creating/updating a banner without it succeeds.
- [ ] Empty `mobileImage` falls back to the desktop `image` — **no visual regression** on any existing banner.
- [ ] On a viewport `< 768px`, the `mobileImage` renders (when set); on `>= 768px` (tablet + desktop), the desktop `image` renders.
- [ ] `normalizeImg()` still rewrites `localhost`/`/uploads/` hosts for the selected image on mobile, and passes remote/Cloudinary URLs through untouched.
- [ ] Admin can upload, save, reload, and see the mobile image **persist** (round-trips through POST/PUT and back via GET).
- [ ] No change to `displayOrder` or `active`/inactive behaviour anywhere (schema, routes, admin UI, carousel).
- [ ] Public `GET /api/banners` and admin `GET /api/admin/banners` both include `mobileImage` in the `{ success, data }` payload.
- [ ] Web app: `tsc --noEmit` exits 0 **and** `next build` exits 0.
- [ ] API: `tsc --noEmit` exits 0 **and** the api build exits 0.
- [ ] Migration applies cleanly via the `prisma migrate` path **in CI** (not `db push`); existing banner rows unaffected.
- [ ] Smoke path (auth, catalog, core flow) unaffected by this change.

---

> **This ticket is NOT in the active sprint and must not be started until CI is green.**
