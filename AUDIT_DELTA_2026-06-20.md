# MXDBLR — Audit Delta & Agent Context Brief

**Date:** 2026-06-20 · **Author:** CEO Agent · **Method:** direct source reads this session (Gate 5)
**Supersedes context in:** `PRODUCTION_AUDIT_REPORT_v4.md` (2026-06-12, 70/100) — that report's *findings* still stand; this brief records what changed in the 8 days since.
**Status of this document:** This is a **delta + context handoff**, NOT the full audit v5 re-score. Per `EXECUTION_PLAN.md`, audit v5 happens *after* the Sentry + catalog-SSR merges land. Neither has landed, so a full re-score is premature.

> **Headline for every agent:** The codebase grew significantly since v4 — a full RBAC system, audit logging, and a new marketing homepage were built, and the work is genuinely good. **But it was built during a declared feature freeze, none of it is pushed anywhere, and the two items that actually clear the 72 threshold (Sentry + catalog SSR) were not done.** Net: the project did not move toward ship-readiness; it added value *and* risk at the same time. Stop adding features. Land Phase 0 + Sprint 1.

---

## 1. What changed since v4 (verified on disk today)

**Git is now a real repo** (it was the #1 critical, NEW-1, in v4):
- 6 commits on `main`, tag `pre-launch-baseline` at the root commit, HEAD = `dcab4b4` (2026-06-19 00:57).
- `.gitignore` present; secret hygiene holds — no `.env`, `dev.db`, `node_modules`, or `uploads/` tracked.
- **Work-loss risk reduced — but NOT closed (see §2.1).**

**New features built since v4 (large surface):**
- **RBAC system** — `api/src/lib/rbac.ts`, `api/src/middleware/rbac.ts`, `api/src/routes/admin/rbac.ts`, `api/src/routes/admin/users.ts`, `api/src/lib/audit.ts`, migration `20260619120000_add_rbac`, and admin pages `roles/`, `staff/`, `audit-logs/`. **Quality is high** (see §3).
- **Marketing homepage** — new `Testimonials`, `TrustStats`, `HowItWorks`, `WhyChooseMXD`, `CoverageSection`, `HomeFAQ`, `DealerCTABanner`, `Footer`, `FloatingWhatsApp`, plus `ProductGallery`, `web/lib/config.ts`, `web/lib/admin/`.
- **Committed fixes:** LAN-IP dev origin for phone hydration, auth/register first-paint, announcement marquee, mobile navbar, inquiry modal height.

---

## 2. Blocking findings (process) — these gate everything else

### 2.1 — CRITICAL: 47 uncommitted files; the newest, riskiest work is unsaved
`git status --short` = **47 entries**. Untracked includes the *entire* RBAC backend, the `add_rbac` DB migration, and ~12 new frontend components/pages. The single most complex, highest-security-surface work in the project (authorization, audit logging) exists only as working-tree files on one machine. **This is the exact risk Phase 0 existed to kill, re-opened.** The plan's mitigation ("daily push once repo exists") is being violated.

### 2.2 — CRITICAL: No git remote; CI has still never run
`git remote -v` is empty. `.github/workflows/ci.yml` is committed and structurally sound (secret scan + typecheck + 34 smoke tests against Postgres 16 + gated builds) but **has executed zero times** — there is nowhere to push. Therefore **Gate 3 (per-PR QA review on every merge) is still physically impossible**, and the new RBAC security code has merged to `main` with no review and no CI.

### 2.3 — Feature-freeze + sequencing violation
`EXECUTION_PLAN.md` Phase 0: *"no new feature work merges until Phase 0 is complete."* Phase 0 exit criteria (remote, CI green, branch protection, `githubRepo` set) are **all unmet**. Yet a full RBAC system + marketing homepage were built instead of Sprint 1's two threshold items. **Sprint 1 (due Fri Jun 19) is missed** — Sentry and catalog SSR are both still undone. This is a gate violation to log against the dev pipeline, not absorb.

---

## 3. Credit where due (verified) — the new code is good, that's not the problem

- **RBAC is security-conscious and correct on read** (`api/src/routes/admin/rbac.ts`): privilege-escalation prevention (`withinCallerPermissions` — you cannot grant a permission you don't hold), rank-based authority (cannot create/edit/delete a role at or above your own rank → SUPER_ADMIN uneditable), system-role protection, anti-lockout, input validated against a fixed permission catalog, all mutations wrapped in transactions with `writeAuditLog`.
- **`api/src/index.ts` now puts every admin router behind a permission guard** (`requirePermission` / `requireAnyPermission`) — a real authorization layer on top of authentication. Good posture.
- A **`rbac.smoke.test.ts`** was added (untracked) — tests came with the feature.

The issue is process, not craft. This work should have been a reviewed PR after Phase 0 — not an uncommitted pile during a freeze.

---

## 4. Path to 72 — STILL OPEN (both engineering items untouched)

| Gap | Owner | State today (verified) | Effort |
|---|---|---|---|
| **Sentry on api + web** (DoD item) | devops-agent | **Not present.** `@sentry/*` absent from both `api/package.json` and `web/package.json`; "Sentry" appears only inside audit `.md` files. | ~0.5 d |
| **Catalog CSR → Server Component** | frontend-agent | **Still CSR.** `web/app/catalog/page.tsx:1` = `'use client'`, data via `useState`/`useEffect`. | ~1 d |
| **Production credentials** (MSG91, Cloudinary, 256-bit JWT, `NODE_ENV=production`, prod API URL) | client + devops | Carried forward from v4 (env-level; not re-read this session). Client dependency, checkpoint Jun 26. | ~1 h on receipt |

Per v4's verdict, any two of these clear 72. **Zero have moved.**

---

## 5. Carried-forward bugs (from v4 — re-verify per Gate 5 before acting)

- **NEW-3 product-thumbnail phone breakage PERSISTS.** `web/components/products/ProductCard.tsx:159-161` passes raw `src` to `next/image`. `web/next.config.ts` `remotePatterns` whitelists only `localhost:4000/uploads` (+ Cloudinary/mxdindia) — **not** the LAN IP. `HeroBanner` got a `normalizeImg()` fix; the product grid did **not**. Any image stored absolute as `http://localhost:4000/uploads/...` 404s on a phone and is a latent **production** bug if deployed on local-disk fallback. **Root fix still owed: store relative `/uploads/...` URLs in the upload pipeline** (`api/src/lib/cloudinary.ts` / `api/src/routes/admin/upload.ts`), then drop the per-component patches.
- Open per v4, not re-verified individually today: dead `Session` model, leftover libsql deps, BACK-2 envelope inconsistency, wishlist N+1, admin-orders client-side date filter.

---

## 6. Per-agent action items (in priority order)

**pm-agent — OWNS THE UNBLOCK (do first):**
1. Create the private GitHub remote (monorepo). `gh` CLI is not installed on this machine — install it or create the repo via web + `git remote add`.
2. **Commit the 47-file working tree in reviewable chunks** (RBAC as one set, marketing homepage as another, fixes separately) — do not bury a security feature in one mega-commit.
3. Push `main`; set branch protection (PR + CI required); set `projects.json.githubRepo`.
4. Log the feature-freeze violation in `company-metrics.json` against the dev pipeline (first substantive sequencing breach for this project; Kickoff step-2 was the prior one).

**devops-agent:**
1. Confirm first CI run goes green end-to-end once the remote exists (34 smoke tests in Actions).
2. Sentry on both apps, DSN env-gated (no-op when unset). This is the cheapest point toward 72 and a DoD item.

**frontend-agent:**
1. Catalog `page.tsx` CSR → Server Component using `searchParams` (preserve filters/pagination/sort; push sort into the URL).
2. After §5 root fix lands, remove the `HeroBanner` `normalizeImg` patch.

**backend-api-agent / dev-agent:**
1. **Root-fix the upload URL** (store relative paths) — closes NEW-3 for the whole grid at the source.
2. Hygiene (small PRs each): remove libsql deps, drop dead `Session` model (+ migration).

**qa-agent:**
1. **Review the RBAC + users routes as a priority PR** the moment they are committed — this is unreviewed security code on `main`.
2. Run audit **v5 re-score only after** Sentry + catalog SSR land. Until then the score has not moved off ~70.

---

## 7. Bottom line

- **Ship-readiness: unchanged at ~70/100.** The two items that defined the path to 72 are both still open. No full re-score yet — that's v5, post-merge.
- **Process health: regressed.** 47 uncommitted files, no remote, CI never run, feature freeze breached, Sprint 1 missed.
- **Code health: improved** where it grew — RBAC authorization is a real security gain.
- **The one sentence:** *Stop building features. Push what exists, get CI green, then do Sentry + catalog SSR.* Everything else is downstream of that.

*All §1–§4 claims verified by direct source read on 2026-06-20. §5 items marked "carried forward" were not individually re-read and must be re-verified before action (Gate 5).*
