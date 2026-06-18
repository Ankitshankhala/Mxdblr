# MXDBLR — Execution Plan to Launch
**Issued:** 2026-06-12 by CEO Agent · **Approved under CEO authority** (project value ₹1,82,900 incl. GST — below ₹5L threshold)
**Inputs:** PRODUCTION_AUDIT_REPORT_v4.md (70/100) · projects.json `proj-20260528-001` · SOW CS-SOW-2026-003 v2.0
**Target launch:** 2026-08-07 · **Ship threshold:** audit ≥ 72/100 + full DoD checklist

---

## Phase 0 — STOP-SHIP: Version control (Fri Jun 12 → Mon Jun 15)

**Rule in effect: no new feature work merges until Phase 0 is complete.** (Gate 3 is unenforceable without a repo; audit NEW-1.)

| # | Task | Owner | Deadline |
|---|---|---|---|
| 0.1 | Create private GitHub repo (monorepo: `api/`, `web/`, `nginx/`, `.github/`), root `.gitignore` covering `.env*`, `node_modules`, `dist`, `.next`, `api/uploads` | pm-agent | Mon Jun 15 |
| 0.2 | Initial commit of current state; tag `pre-launch-baseline` | pm-agent | Mon Jun 15 |
| 0.3 | Branch protection on `main`: PR required, CI required (`security-check`, `api-tests`, builds) | devops-agent | Mon Jun 15 |
| 0.4 | Verify first push runs CI green end-to-end (34 smoke tests in Actions against Postgres service) | devops-agent | Mon Jun 15 |
| 0.5 | Update `projects.json` `githubRepo` field | pm-agent | Mon Jun 15 |

**Exit criteria:** repo URL in projects.json, CI green badge, main protected.

---

## Phase 1 — Sprint 1: Clear the 72 threshold (Mon Jun 15 → Fri Jun 19)

Two engineering items from the audit verdict table — both fully in our control (~1.5 dev days):

| # | Task | Owner | Est. | Score impact |
|---|---|---|---|---|
| 1.1 | Sentry on api + web, DSN env-gated (no-op when unset); wire into global error handler + Next.js instrumentation | devops-agent | 0.5 d | DevOps 62→70 |
| 1.2 | Catalog page CSR → Server Component using `searchParams` (preserve filters/pagination/sort; sort state into URL) | frontend-agent | 1 d | Perf 66→72, SEO 56→64 |
| 1.3 | Small fixes (<50 lines each, one PR each): NEW-3 (reject uploads when Cloudinary unset OR whitelist API origin in dev), NEW-4 (remove libsql deps), BUG-019 (drop dead `Session` model + migration) | dev-agent | 0.5 d | hygiene |
| 1.4 | Per-PR review on every merge above (Gate 3 — now enforceable) | qa-agent | continuous | — |
| 1.5 | **Audit v5 re-score after merges — target ≥ 72** | qa-agent | Fri Jun 19 | gate |

**Exit criteria:** v5 ≥ 72/100 with every claim source-verified.

---

## Phase 2 — Client dependencies (csm-agent, starts TODAY, runs parallel)

| Dependency | Needed for | Needed by | Escalation if missing |
|---|---|---|---|
| MSG91 auth key + sender ID + OTP template | Real-SIM OTP test (DoD) | **Fri Jun 26** | Flag launch risk to Ankit |
| Cloudinary account credentials | Image pipeline E2E (DoD) | **Fri Jun 26** | Flag launch risk to Ankit |
| Domain DNS control (mxdblr.com) | Staging + production | Fri Jul 3 | — |
| WhatsApp Business number | Inquiry deep links | Fri Jul 3 | — |
| Product data CSV/Excel | Catalog seeding (SOW Week 3) | **Fri Jul 3** | Timeline slip warning to client in writing |
| VPS SSH access (Hostinger KVM 2) | Deploy (SOW Week 7) | Fri Jul 31 | — |

csm-agent sends the consolidated request today; follows up every 3 business days; logs contact in clients.json.

---

## Phase 3 — Staging + DoD burn-down (Mon Jun 22 → Fri Jul 10)

| # | Task | Owner | Deadline |
|---|---|---|---|
| 3.1 | Staging environment live (VPS or temp host): `NODE_ENV=production`, 256-bit secrets (`openssl rand -hex 32`), prod-style nginx | devops-agent | Fri Jun 26 |
| 3.2 | Sentry receiving real events from both apps on staging | devops-agent | Fri Jun 26 |
| 3.3 | Real-SIM OTP test + Cloudinary E2E + geo-block verification from a blocked state (VPN) — all pending credentials | qa-agent | within 3 days of credentials |
| 3.4 | Dealer-facing toast/notification system (extend admin Toast pattern); failed mutations always surface (frontend enforcement clause) | frontend-agent | Fri Jul 3 |
| 3.5 | Product data import via csv-import + catalog content review with client | pm-agent + client | Fri Jul 10 |
| 3.6 | **Midpoint client review on staging** (csm-agent walkthrough) | csm-agent | Fri Jul 10 |

**Midpoint money event (finance-agent):** on review sign-off, invoice midpoint ₹38,750 **plus** ₹28,500 advance balance = **₹67,250**. Must match projects.json. Formal GST invoice CS-2026-0001 (flagged GV-2026-005) regularized no later than this date.

---

## Phase 4 — Pre-launch hardening (Mon Jul 13 → Thu Aug 6)

Priority order; stop where time runs out — none are ship-blockers:

1. BUG-015 — admin orders date filter server-side (dev-agent)
2. BUG-020 — remove secret fields from SystemSettings schema entirely (db-schema-agent, small migration)
3. BUG-014 — batch product endpoint for wishlist (backend-api-agent)
4. BACK-2 — response envelope alignment `{ success, data, pagination? }` (backend-api-agent, coordinate with frontend)
5. A11y: skip link + `<main>` landmarks on public pages, ARIA on status badges (frontend-agent)
6. JSON-LD Product/Organization structured data (frontend-agent)

**Launch week (Aug 3–7):**
- Pre-Launch Checklist co-signed by devops-agent + qa-agent (CLAUDE.md checklist, incl. rollback procedure written down)
- Final audit v6 ≥ 72 with all DoD items checked
- Production deploy (per DEPLOYMENT_GUIDE.md) · DNS cutover · smoke tests against production
- finance-agent: final invoice ₹38,750 on delivery sign-off
- csm-agent: Day-7 (Aug 14) and Day-30 (Sep 7) follow-ups scheduled; testimonial request after Day-30 if NPS ≥ 9

---

## Risk Register

| Risk | P | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Work loss before repo exists | live now | critical | Phase 0 within 1 business day; feature freeze until done | pm-agent |
| MSG91/Cloudinary credential delay | medium | high — blocks DoD + ~2.8 score pts | Jun 26 escalation checkpoint; staging proceeds with mocks; go-live is the only hard blocker | csm-agent |
| Catalog SSR refactor regression | low-med | medium | QA per-merge review + smoke suite in CI; feature branch | qa-agent |
| Advance balance ₹28,500 slips again | medium | medium | Bundled into midpoint invoice; pm-agent pauses Phase 4 if midpoint unpaid by Jul 17 | finance-agent |
| Single dev machine until staging | high until Phase 3 | medium | Daily push to GitHub once repo exists | all dev agents |

---

## Decision Log (CEO Agent)

- **Approved:** this plan, under CEO authority (deal value below ₹5L; no client commitments changed; launch date unchanged at Aug 7).
- **Feature freeze** until version control exists — Gate 3 cannot function without it; continuing development was the violation, not the pause.
- **Sequencing rationale:** Sentry + catalog SSR chosen over waiting on client credentials because they are in our control and independently clear the 72 threshold (per audit v4 verdict: any two of three gaps suffice).
- **For Ankit (FYI, no decision needed):** one gate violation on record for this project (Kickoff Ritual step 2 skipped — GitHub repo). First offense, remediation in Phase 0. Credential dependency on client is the only path to a launch slip; checkpoint is Jun 26.

*Next review: Monday weekly summary (Jun 15) — Phase 0 exit criteria + Sprint 1 kickoff confirmation.*
