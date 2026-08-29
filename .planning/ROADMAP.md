# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- ✅ **v1.1** — Phases 8-17 (Planning Center, song catalog, volunteer scheduling)
- ✅ **v1.2 — Worship Service Slide Management** — Phases 18-23 (shipped 2026-07-28; owner acceptance, checkpoints waived)
- ✅ **v1.3 — Slides Tab Rework** — Phases 24-28 (shipped 2026-07-28; verified by owner)
- ✅ **v1.4 — Service and Slides** — Phases 29-38 (shipped 2026-08-05; owner acceptance, verification unrun)
- ✅ **v1.5 — Settings, Sharing, and Fidelity** — Phases 39-50 (shipped 2026-08-10; settings infra + feature toggles, custom auth claims, sharing correctness, PPTX rendered-image display, service item types, default template, ESV/NLT Bible version, slide typography, congregational reading, multi-image + mobile polish, bulk-delete/provenance/render-fidelity)
- ✅ **v1.6 — Editing Reliability & Song Slides** — Phases 51-57 (shipped 2026-08-12; drag-and-drop editing reliability, service-template relocation, song-slide splitting, service-item notes + MISC labels + per-item Scripture version, preview/export polish, template-editor UX parity)
- ✅ **v1.7 — Volunteer Messaging** — Phases 58-64 (shipped 2026-08-18; deployed to production 2026-08-17 — messages composer, delivery history + bounce webhook, lock & scheduled-reminder auto-notifications, re-lock scoped change diff, dedicated Messages tab, composer refinements + R157–R160 hotfixes — all behind a Settings kill-switch)
- ✅ **v1.8 — Cost & Billing Hardening** — Phases 65-67 (shipped 2026-08-20; safe config deployed to production — capped the metered Claude `api` proxy, gave every unbounded Storage path a dry-run retention sweep, gated off the daily all-org reminder scan, and capped email/instance fan-out — R161–R168, R170–R173; storage-deletion activation + firestore.rules deny owner-gated)
- ✅ **v1.9 — Owner Admin Console** — Phases 68-71 (shipped 2026-08-23; super-admin console lifting the v1.8 cost/cleanup levers + no-reply sender into Firestore-backed runtime config, with a dry-run blast-radius preview gating every cleanup-toggle flip — deployed to production 2026-08-23 as the first of three stacked milestones; owner acceptance, human UAT deferred)
- ✅ **v2.0 — Multi-Church Onboarding & Owner Console Tabs** — Phases 72-74 (shipped 2026-08-23; tabbed Configuration/Organizations shell, org onboarding (org + settings + seeded template + first admin), and the multi-org Storage auth-claim widening (backlog 999.5) — deployed to production 2026-08-23; owner acceptance, human UAT deferred)
- ✅ **v2.1 — Organization Lifecycle & Super-Admin Access** — Phases 75-78 (shipped 2026-08-23; church deactivate/reactivate, deactivation-gated deletion with full cascade cleanup, pending-invite visibility, and a super-admin "enter any church" rules arm — deployed to production 2026-08-23; audit PASSED 16/16; owner acceptance, human UAT deferred)
- ✅ **v2.2 — Configurability, Hardening & Cleanup** — Phases 79-83 (shipped 2026-08-25; per-org configurable teams replacing hard-coded Berean rules + dropped ordinal-Sunday auto-select (R228-R231, R241), security & data-integrity hardening — inviteLookup create gate, createdBy immutability, deleteService share revocation, song-clear slide cleanup, pending-render edit guard (R232-R236), polish/ops close-out — PC export coverage, Resend verified-domain runbook, Owner Console a11y, shared song-browse component (R237-R240), per-org AI enablement OFF-by-default (R242-R243), and Roles/Teams tab UX/copy (R244-R246); hosting deployed 2026-08-25, backend rules/functions owner-gated; audit PASSED 19/19. **The per-team song-tag filter (R230) was delivered then removed 2026-08-25 by owner decision.**)
- ✅ **v2.3 — Scheduling Accuracy & Song/Team Refinements** — Phases 84-89 (shipped & deployed to production 2026-08-27; last-used date correctness + backfill (R247-R248), team conflict rules — Vocals folds into Band, one-team-per-date with the sing-and-play exception (R250-R252), pattern-based recurring team scheduling (R254-R255), song & rotation refinements — editable Key, sermon-free rotation, corrected copy (R249, R253, R256), Roles/Teams read-only-row slideouts + song Key type-ahead (R257-R258), and multi-role scheduling — generalized combinable flag + same-date bundling (R259-R260); audit PASSED 14/14, owner-approved UAT)
- 🚧 **v2.4 — Run the Service (Live Presentation)** — Phases 90-96 (roadmap created 2026-08-28; a non-technical projectionist runs a locked service's slides live from Chrome/Edge — Run button → standalone Run/control screen, a persistent standalone monitor-config screen, fullscreen chrome-free audience output, black-background confidence output, browser multi-monitor delivery via the Window Management API with a pop-out fallback — R261-R275, client-side only)

<details>
<summary>✅ v1.2 Worship Service Slide Management (Phases 18-23) — ARCHIVED 2026-07-28</summary>

- [x] Phase 18: Song Lyric Slides and Editor
- [x] Phase 19: Scripture and Congregational Reading Slides
- [x] Phase 20: Service Sections and Slide Auto-Assembly
- [x] Phase 21: PowerPoint Import for Announcements and Sermon
- [x] Phase 22: Media Attachments and Storage Lifecycle
- [x] Phase 23: Presentation Preview Mode

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · phase artifacts moved to `milestones/v1.2-phases/`

> Closed on owner acceptance 2026-07-28, not a passing verification gate — the outstanding
> human-verify checkpoints for P18-23 were waived. See `v1.2-ROADMAP.md` and STATE.md.
> Much of this work was subsequently reworked by v1.3 (Phases 24-28).

</details>

<details>
<summary>✅ v1.3 Slides Tab Rework (Phases 24-28) — ARCHIVED 2026-07-28</summary>

- [x] Phase 24: Slide Group Model and Migration
- [x] Phase 25: Slides Tab Shell — Plan Rail and Slide Grid
- [x] Phase 26: Edit Slide Drawer
- [x] Phase 27: Service Order Tab — Rename and Strip Slide Editing
- [x] Phase 28: Song Lyrics Editor Rework

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) · requirements:
[milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md) · phase artifacts in `milestones/v1.3-phases/`

> Rebuilt slide management around a persisted slide-group model: a dedicated Slides tab, a plan rail
> that mirrors the service order, an Edit Slide drawer, and a lyrics editor that is one list = the
> slide order. First tab renamed Service Order. 33 plans, ~200 commits.
> Cross-phase integration check PASS; verified by owner 2026-07-28.

</details>

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4, 6-7) — SHIPPED 2026-03-05</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-04
- [x] Phase 2: Song Library (3/3 plans) — completed 2026-03-04
- [x] Phase 3: Service Planning (5/5 plans) — completed 2026-03-04
- [x] Phase 4: Output (2/2 plans) — completed 2026-03-04
- [x] Phase 6: AI Assisted Service Suggesting (4/4 plans) — completed 2026-03-04
- [x] Phase 7: Invite & RBAC (2/2 plans) — completed 2026-03-04

Full details: milestones/v1.0-ROADMAP.md

</details>

<details>
<summary>✅ v1.1 (Phases 8-17, 16.1) — SHIPPED 2026-07-24, archived 2026-07-28</summary>

- [x] Phase 8: Planning Center API Export (3/3 plans) — completed 2026-07-13
- [x] Phase 9: PC Song Import & Tag Management (3/3 plans) — completed 2026-07-13
- [x] Phase 10: Worship song export naming & template import improvements (3/3 plans)
- [x] Phase 11: Song catalog & service planner improvements (4/4 plans)
- [x] Phase 12: Advanced song search & multi-select persistent tag filtering (8/8 plans)
- [x] Phase 13: Volunteer Role Scheduling (10/10 plans)
- [x] Phase 14: In-App Quarterly Availability Editor
- [x] Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules
- [x] Phase 16: Quarterly Schedule share link — matrix view, name filter, UX overhaul
- [x] Phase 16.1: Song list tags & columns customization (INSERTED)
- [x] Phase 17: Sync schedule with planned services — Roles tab + public shared service link

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · phase artifacts in `milestones/v1.1-phases/`

> Phase 5 (Collaboration, Tasks & Events) was scoped to this milestone but **never started** and was
> formally dropped 2026-07-28 (TASK-01..03 / EVNT-01..04) — owner: *"we don't need those."*
> AUTH-03/AUTH-04 were delivered in Phase 7, not Phase 5.

</details>

<details>
<summary>✅ v1.4 Service and Slides (Phases 29-38) — SHIPPED 2026-08-05</summary>

**Milestone Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you
can see, slides that always mirror the plan — and finish them against the Claude Design wireframes.

- [x] **Phase 29: Order Structure — Stable Reordering & Post-Service** - Fix the drag-and-drop root cause and add the fifth Post-Service section (completed 2026-07-28)
- [x] **Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed** - Delete the reconcile/confirm flow; slide groups always mirror the service order (completed 2026-07-29)
- [x] **Phase 31: Service Lifecycle — Draft Lock & Reopen** - Draft-only editing with a genuine three-layer lock and an explicit Reopen path (completed 2026-07-30)
- [x] **Phase 32: Save Reliability — Autosave Fix & Persistent Status** - Fix the song-change autosave bug and give every surface a persistent save indicator (completed 2026-08-03)
- [x] **Phase 33: Backgrounds & Slide Editing** - Backgrounds at group/slide/song level and a split 3-dot Edit Slide menu (completed 2026-08-03)
- [x] **Phase 34: Smarter Content — LLM Scripture Split** - LLM-assisted congregational reading splits, index-only, never regenerating scripture text (completed 2026-08-03; 12/12 truths, 5 human-verify items open)
- [x] **Phase 35: Presentation Correctness & Lyric Editor** - No organizational labels when presenting, CCLI on first+last slide, inline paste-lyrics warnings (completed 2026-08-03)
- [x] **Phase 36: UI Rework — Service Order & Contextual Action Bars** - Rebuild the Service Order tab and apply one contextual action bar across every tab (completed 2026-08-05)
- [x] **Phase 37: PowerPoint Server-Side Rendering** - Render imported PowerPoint decks server-side to true-fidelity images (completed 2026-08-05)
- [x] **Phase 38: Congregational Readings Become Real Slides** - Each Leader/Congregation section becomes its own slide, individually editable and deletable (completed 2026-08-05)

**Requirements:** [milestones/v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md) (R036–R072)

Full details: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) · phase artifacts moved to `milestones/v1.4-phases/`

> **Closed on owner acceptance 2026-08-05, not on a passing verification gate.** Phases 29-31 were
> genuinely verified. Phases 32-38 are `status_source: owner-attributed` — the owner accepted their
> outstanding human verification without running it ("Any issues I find from here on out will go in
> the next set of changes I'm going to post"). `/gsd-audit-milestone` was never run. The unrun
> checks are preserved in `.planning/PENDING-VERIFICATION.md` under a CLOSED UNRUN header rather
> than deleted, so anything that surfaces later can be traced to the check that would have caught it.
>
> **Phase 37 shipped BUILT BUT UNDEPLOYED by the owner's own instruction** — R062 is `[~]` partial,
> the Cloud Run render service was never deployed, and no UI consumes its output. See
> `milestones/v1.4-phases/37-*/37-VERIFICATION.md` and `render-service/DEPLOY.md`.

</details>

<details>
<summary>✅ v1.5 Settings, Sharing, and Fidelity (Phases 39-50) — SHIPPED 2026-08-10</summary>

Full phase details archived to `milestones/v1.5-ROADMAP.md`; requirements to `milestones/v1.5-REQUIREMENTS.md`. Deployed to production 2026-08-10 (hosting + functions). All phases verified (Phase 50 genuinely verified incl. live R109/R108; Phases 39, 43-49 owner-attributed at milestone close on production use).

- [x] Phase 39: Org Settings Infrastructure & Feature Toggles
- [x] Phase 40: Custom Auth Claim for Org Membership
- [x] Phase 40.1: Close the Self-Service Membership Hole
- [x] Phase 41: Sharing Correctness
- [x] Phase 42: PowerPoint Rendered-Image Display
- [x] Phase 43: Service Item Types
- [x] Phase 44: Default Service Template
- [x] Phase 45: ESV/NLT Bible Version Selection
- [x] Phase 46: Global Slide Typography
- [x] Phase 47: Congregational Reading Divider UX
- [x] Phase 48: Multi-Image Ordering & Mobile Polish
- [x] Phase 49: Congregational Reading — Dedicated Reference Slide
- [x] Phase 50: Slide Management — Bulk Delete, Provenance & Render Fidelity

</details>

<details>
<summary>✅ v1.6 Editing Reliability & Song Slides (Phases 51-57) — SHIPPED 2026-08-12</summary>

**Milestone Goal:** Fix the drag-and-drop corruption in the default template and real service plans,
move the service template to where it is used, make song-slide editing intuitive, and polish
item-editing, preview, and export. R127–R129 (owner scope addition 2026-08-12) added per-item MISC
labels + a Scripture version override and brought the template editor to UX parity.

- [x] Phase 51: Service Order Editing Reliability (4/4 plans)
- [x] Phase 52: Default Service Template (3/3 plans)
- [x] Phase 53: Song Lyric Editing (4/4 plans)
- [x] Phase 54: Service Item Enhancements (2/2 plans)
- [x] Phase 55: Preview & Export Polish (3/3 plans)
- [x] Phase 56: Service-Item Overrides (2/2 plans) — owner scope addition
- [x] Phase 57: Template-Editor UX Parity (1/1 plan) — owner scope addition

**Requirements:** [milestones/v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md) (R110–R129)

Full details: [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) · phase artifacts in `milestones/v1.6-phases/`

> Closed on owner acceptance 2026-08-12, deployed to production (hosting) the same day; the
> firestore.rules delete-fix and the 2026-08-12 owner UI follow-up batch were confirmed working in
> production. Phases 51–57 are owner-attributed (v1.4/v1.5 precedent); the deferred human checks are
> preserved in `PENDING-VERIFICATION.md` rather than individually re-run.

</details>

<details>
<summary>✅ v1.7 Volunteer Messaging (Phases 58-64) — SHIPPED 2026-08-18, deployed 2026-08-17</summary>

**Milestone Goal:** Let planners email the volunteers scheduled on a service — a composer, automatic
lock and scheduled-reminder notifications, and a re-lock scoped change diff — all governed by a global
Settings kill-switch, built on one shared server-side recipient resolver and a single
queue-then-trigger send primitive; then refine the messaging UX from owner UAT.

- [x] Phase 58: Messaging Infrastructure, Settings & Recipient Resolution (5/5 plans) — kill switch, org timezone, per-service messaging defaults, one shared recipient resolver, deny-by-default `firestore.rules`
- [x] Phase 59: Messages Composer & Send Path (4/4 plans) — ✉ composer + `queueServiceMessage`→`sendQueuedMessage`, provider key confined to one Function
- [x] Phase 60: Delivery History & Bounce Webhook (3/3 plans) — per-service sent history + HMAC-verified hard-bounce webhook
- [x] Phase 61: Automatic Notifications — Lock & Scheduled Reminder (4/4 plans) — auto-email on first lock; N-days-before reminder cron in org-local time
- [x] Phase 62: Re-lock Change Notice — Scoped Diff (4/4 plans) — checkable team-tagged change diff on re-lock, or Lock quietly
- [x] Phase 63: Messages Tab & Always-Visible History (1/1 plan) — dedicated Messages tab; history visible when locked (fixed Phase 60 `canEditService` defect)
- [x] Phase 64: Composer Refinements (4/4 plans) — roster-matching labels, working add-individual, live preview, `{{name}}` token, send spinner, distinct per-type seeds

**Post-UAT hotfixes (direct-to-master):** R157 (hide ✉ when messaging off), R158 (add-someone single person), R159 (From/Reply-To rework — app-owned address + org-name display), R160 (unique org names via `orgNames` registry).

**Requirements:** [milestones/v1.7-REQUIREMENTS.md](milestones/v1.7-REQUIREMENTS.md) (R130–R160) · Full details: [milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) · phase artifacts in `milestones/v1.7-phases/`

> Internally tracked as two milestones (v1.7 Phases 58–62, v1.8 Phases 63–64) that stacked without
> archiving between them; shipped together in one production deploy (2026-08-17) and combined into this
> single v1.7 milestone at close (owner decision 2026-08-18). Closed on owner acceptance — the
> `/gsd-verify-work 58..64` human-UAT items were accepted as deferred and preserved in
> `PENDING-VERIFICATION.md`, per the v1.4/v1.5/v1.6 precedent. `messageWebhook` bounce tracking is live
> with the real Resend secret; email delivery remains test-mode (`onboarding@resend.dev`) until the
> verified-domain harden (backlog 999.6).

</details>

<details>
<summary>✅ v1.8 Cost & Billing Hardening (Phases 65-67) — SHIPPED 2026-08-20 · full detail: milestones/v1.8-ROADMAP.md</summary>

## v1.8 Cost & Billing Hardening (Phases 65-67) — SHIPPED 2026-08-20

**Milestone Goal:** Cap and observe every runaway cost surface in the live production app (Blaze plan,
deployed 2026-08-17) so billing stays predictable as usage grows — the metered Claude `api` proxy,
unbounded Storage growth, the daily all-org reminder scan, and uncapped email/instance fan-out. Grounded
in the 2026-08-19 code investigation (five confirmed exposures). Phase numbering continues from v1.7
(58–64); this milestone is Phases 65–67.

**Deploy policy (v1.8 autonomy grant, 2026-08-19):** low-risk config deploys **autonomously** (instance
caps, proxy rate-limiting, cron disable, query changes); anything that DELETES existing data (the first
activation of media/background/pptx pruning) or changes rules/auth ships built + tested + **UNDEPLOYED**
with the exact deploy command handed to the owner.

- [x] **Phase 65: AI Proxy Cost Controls** - Rate-limit, server-side model/`max_tokens` enforcement, usage logging, and an instance cap on the metered Claude `api` proxy (the largest variable bill — sequenced first) (completed 2026-08-20)
- [x] **Phase 66: Storage Retention** - Verify/enable the dry-run media & orphan-render sweeps and build retention for the never-pruned backgrounds & PPTX-import paths (mechanisms tested; first live deletion is the owner's gated deploy) (completed 2026-08-20)
- [x] **Phase 67: Fan-out, Cron & Instance Guardrails** - Disable the unused daily cross-org reminder scan, cap the Resend send loop, and set function + Cloud Run instance ceilings (completed 2026-08-20)

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R161–R168, R170–R173 (12 mapped; R169 deferred)

### Phase 65: AI Proxy Cost Controls

**Goal**: The metered Claude `/api/anthropic` proxy caps and observes every signed-in user's token spend, so no single user can drive unbounded AI cost in a loop and per-user/per-org spend is visible inside the app instead of only on the external Anthropic console.
**Depends on**: Nothing (first v1.8 phase; independent — sequenced first as the largest variable bill)
**Requirements**: R161, R162, R163, R164
**Success Criteria** (what must be TRUE):

  1. A signed-in user who exceeds the configured per-user/per-org request-window ceiling is rejected with a clear error instead of being able to loop the proxy for unbounded token spend (R161).
  2. A proxied request naming a costlier model or a larger `max_tokens` than server policy is rejected or clamped before it reaches Anthropic — the client can no longer dictate the model or token budget forwarded byte-unchanged (R162).
  3. Every proxied Claude request records a usage entry (caller uid + org, model, input/output token counts, timestamp) to a queryable ledger, so per-user/per-org token spend is observable inside the app (R163).
  4. The `api` proxy function runs under an explicit `maxInstances` ceiling, so a traffic spike or abuse cannot fan it out without bound (R164).

**Plans**: 2/2 plans executed

- [x] 65-01-proxy-cost-controls-PLAN.md — rate limiter (R161), model allow-list + max_tokens clamp (R162), usage ledger (R163), maxInstances cap (R164) — all on the anthropic branch of `functions/src/index.ts`; autonomous `firebase deploy --only functions:api`
- [x] 65-02-ledger-access-hardening-PLAN.md — client 429/400 graceful-surface regression guard + owner-gated firestore.rules deny for aiUsage/aiRateLimits (built + tested, UNDEPLOYED)

**Deploy**: All four controls are bounded/reversible config → deploy autonomously per the v1.8 grant. The 65-02 firestore.rules deny is owner-gated (UNDEPLOYED; owner runs `firebase deploy --only firestore:rules`) and no success criterion depends on it.

### Phase 66: Storage Retention

**Goal**: Every Storage path that grows forever gains a bounded, implemented retention story — the two dry-run sweeps are proven deletion-capable and the never-pruned backgrounds & PPTX-import paths gain a pruning path — with every first live deletion of real objects handed to the owner as a gated deploy.
**Depends on**: Nothing (independent of Phase 65)
**Requirements**: R165, R166, R167, R168
**Success Criteria** (what must be TRUE):

  1. `cleanupExpiredMedia` is proven by test to actually delete objects under `orgs/{orgId}/media/` past the retention window (not dry-run-logged); enabling it in production (`MEDIA_CLEANUP_ENABLED=true`) is handed to the owner as the gated first-deletion deploy (R165).
  2. `cleanupOrphanRenders` is proven by test to actually delete stale `pending`/`failed` `rendered/` objects; the production enable (`PPTX_RENDER_CLEANUP_ENABLED=true`) is handed to the owner as gated (R166).
  3. Background images under `orgs/{orgId}/backgrounds/…` have an implemented, tested pruning path so unreferenced/aged backgrounds stop accumulating forever — built and UNDEPLOYED, the first live deletion being the owner's deploy (R167).
  4. PPTX import sources (source `.pptx` + extracted `images/`) under `orgs/{orgId}/pptx-imports/{importId}/…` have an implemented, tested retention path so they stop accumulating after an import is consumed/rendered — built and UNDEPLOYED, first live deletion owner-gated (R168).

**Plans**: 2/2 plans executed

- [x] 66-01-prove-harden-existing-sweeps-PLAN.md — prove (by test, mocked Storage) that `cleanupExpiredMedia` (R165) and `cleanupOrphanRenders` (R166) actually delete when enabled; harden both with a per-run delete cap + deleted-bytes observability; keep default dry-run; hand over the owner enable/redeploy commands (wave 1)
- [x] 66-02-new-retention-sweeps-PLAN.md — build `cleanupOrphanBackgrounds` (R167, orphan+age with three-tier reference detection and an incomplete-references fail-safe) and `cleanupPptxSources` (R168, prune consumed/failed source.pptx + images/, keep rendered/); both dry-run + path-guarded + tested; UNDEPLOYED (wave 2, depends on 66-01 — shares `functions/src/index.ts`)

**Deploy**: Retention mechanisms build + test autonomously; the first activation that deletes existing objects is owner-gated per the v1.8 grant — ship the exact enable/deploy command, do not run it. New dry-run functions `cleanupOrphanBackgrounds` + `cleanupPptxSources` join the orchestrator's consolidated `firebase deploy --only functions:…` at milestone end; every `*_CLEANUP_ENABLED=true` flag is handed to the owner (functions/.env + per-function redeploy).

### Phase 67: Fan-out, Cron & Instance Guardrails

**Goal**: Every unbounded fan-out and always-running scan is capped or eliminated — the unused daily reminder scan stops running, and email sends, HTTP functions, and the render service all carry explicit ceilings — so no spike or abuse can scale cost without bound.
**Depends on**: Nothing (independent; naturally sequenced last, matching the milestone-goal priority order)
**Requirements**: R170, R171, R172, R173
**Success Criteria** (what must be TRUE):

  1. The daily `sendScheduledReminders` cross-org scan no longer runs while reminders are unused — the cron is disabled or gated so it performs no cross-org read — eliminating the daily read cost, with any must-survive scheduled-message dispatch preserved or independently gated, not silently broken (R170).
  2. The Resend send path enforces a volume cap (a per-message maximum recipient count and/or a per-org send quota), so a single send or the crons that enqueue through it cannot fan out without bound (R171).
  3. Project-wide function instance ceilings are in force (a `setGlobalOptions({ maxInstances })` and/or explicit per-function caps) covering at least the `api` proxy and `messageWebhook`, so no HTTP function scales out unbounded under load or abuse (R172).
  4. The Cloud Run PPTX render service has an explicit `--max-instances` and appropriate `--concurrency` ceiling, so rendering cannot scale out without bound (R173).

**Plans**: 2/2 plans executed

- [x] 67-01-functions-guardrails-PLAN.md — R170 gate the daily sendScheduledReminders cron OFF (no cross-org scan), R171 Resend volume caps (per-message recipient cap + per-org daily quota), R172 project-wide setGlobalOptions maxInstances ceiling — all in functions/src/index.ts + tests (wave 1)
- [x] 67-02-render-service-instance-cap-PLAN.md — R173 explicit Cloud Run --max-instances=3 (+ appropriate --concurrency=1) captured in render-service/DEPLOY.md (wave 1)

**Deploy**: All caps + the cron disable are bounded/reversible config → deploy autonomously per the v1.8 grant. The executor builds + tests + commits only; every deploy is STAGED for the orchestrator's consolidated milestone-end deploy (`firebase deploy --only functions:sendScheduledReminders,functions:sendQueuedMessage` for R170/R171, broad `firebase deploy --only functions` for R172, `gcloud run deploy` for R173 or owner handover).

</details>

<details>
<summary>✅ v1.9 Owner Admin Console (Phases 68-71) — SHIPPED 2026-08-23</summary>

- [x] Phase 68: Super-Admin Access Gate & Claim-Merge Fix
- [x] Phase 69: Firestore Runtime Config
- [x] Phase 70: Admin Console UI & No-Reply Sender
- [x] Phase 71: Cleanup Deletion-Toggle Safety

Full details: [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md) · requirements [milestones/v1.9-REQUIREMENTS.md](milestones/v1.9-REQUIREMENTS.md) · phase artifacts in `milestones/v1.9-phases/`

> Deployed to production 2026-08-23 (first of three stacked milestones — its super-admin claim + claim-merge fix underpin v2.0/v2.1). Closed on owner acceptance; human UAT `/gsd-verify-work 68–71` deferred (PENDING-VERIFICATION.md).

</details>

<details>
<summary>✅ v2.0 Multi-Church Onboarding & Owner Console Tabs (Phases 72-74) — SHIPPED 2026-08-23</summary>

- [x] Phase 72: Owner Console Tabs
- [x] Phase 73: Multi-Org Storage Auth Claim (SECURED; backlog 999.5)
- [x] Phase 74: Organizations — List, Onboard & Admin Assignment (SECURED)

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) · requirements [milestones/v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) · phase artifacts in `milestones/v2.0-phases/`

> Deployed to production 2026-08-23 (second of three stacked milestones; multi-org claim backfill applied, 3 accounts). Closed on owner acceptance; human UAT `/gsd-verify-work 72–74` deferred (PENDING-VERIFICATION.md).

</details>

<details>
<summary>✅ v2.1 Organization Lifecycle & Super-Admin Access (Phases 75-78) — SHIPPED 2026-08-23</summary>

- [x] Phase 75: Pending-Invite Visibility
- [x] Phase 76: Church Deactivation & Reactivation (SECURED 11/11)
- [x] Phase 77: Church Deletion — Cascade Cleanup (SECURED 11/11)
- [x] Phase 78: Super-Admin Enter-Any-Church (SECURED 7/7)

Full details: [milestones/v2.1-ROADMAP.md](milestones/v2.1-ROADMAP.md) · requirements [milestones/v2.1-REQUIREMENTS.md](milestones/v2.1-REQUIREMENTS.md) · audit [milestones/v2.1-MILESTONE-AUDIT.md](milestones/v2.1-MILESTONE-AUDIT.md) · phase artifacts in `milestones/v2.1-phases/`

> Deployed to production 2026-08-23 (third of three stacked milestones). Audit PASSED (16/16 reqs, 5/5 seams, 3/3 SECURED). Closed on owner acceptance; human UAT `/gsd-verify-work 75–78` deferred (PENDING-VERIFICATION.md).

</details>

<details>
<summary>✅ v2.2 Configurability, Hardening & Cleanup (Phases 79-83) — SHIPPED 2026-08-25</summary>

- [x] Phase 79: Dedup & Configurable Teams
- [x] Phase 80: Security & Data-Integrity Hardening
- [x] Phase 81: Polish & Ops Close-Out
- [x] Phase 82: Per-Org AI Enablement
- [x] Phase 83: Roles/Teams Tab UX & Copy

Full details: [milestones/v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) · requirements [milestones/v2.2-REQUIREMENTS.md](milestones/v2.2-REQUIREMENTS.md) · audit [milestones/v2.2-MILESTONE-AUDIT.md](milestones/v2.2-MILESTONE-AUDIT.md) · phase artifacts in `milestones/v2.2-phases/`

> Hosting deployed to production 2026-08-25 (client changes live); Phase 80 rules (inviteLookup gate + createdBy immutability) and Phase 82 rules+functions (per-org AI enablement) ship UNDEPLOYED as owner-gated hand-overs. Audit PASSED (19/19 reqs, 9/9 seams). **R230 (per-team song-tag AI filter) was delivered in Phase 79 and then removed 2026-08-25 by owner decision** — it only fed AI suggestions and confused users; see milestones/v2.2-REQUIREMENTS.md. Closed on owner acceptance; human UAT `/gsd-verify-work 79–83` deferred (PENDING-VERIFICATION.md).

</details>

<details>
<summary>✅ v2.3 Scheduling Accuracy & Song/Team Refinements (Phases 84-89) — SHIPPED 2026-08-27</summary>

- [x] Phase 84: Last-Used Date Correctness & Backfill
- [x] Phase 85: Team Conflicts — Vocals into Band & One-Team-Per-Date
- [x] Phase 86: Recurring Team Scheduling
- [x] Phase 87: Song & Rotation Refinements
- [x] Phase 88: Editing-UX Polish (Roles/Teams slideout + song Key typeahead)
- [x] Phase 89: Multi-Role Scheduling (generalized combinable flag + same-date bundling)

Full details: [milestones/v2.3-ROADMAP.md](milestones/v2.3-ROADMAP.md) · requirements [milestones/v2.3-REQUIREMENTS.md](milestones/v2.3-REQUIREMENTS.md) · audit [milestones/v2.3-MILESTONE-AUDIT.md](milestones/v2.3-MILESTONE-AUDIT.md) · phase artifacts in `milestones/v2.3-phases/`

> Deployed to production 2026-08-27 (hosting + all Cloud Functions; the Phase 85 vocals→Band messaging fix is live). R248 last-used backfill applied to the Berean prod org (62 songs corrected). No firestore/storage rules changes in v2.3. Owner-approved UAT 2026-08-27; audit PASSED (14/14 reqs, all seams WIRED). Phases 88–89 were added mid-milestone from UAT.

</details>

### 🚧 v2.4 Run the Service (Live Presentation) (Phases 90-96) — roadmap created 2026-08-28

**Milestone Goal:** Give a non-technical projectionist a clean, standalone way to *run* a locked
service's slide deck live during a church service — driving a fullscreen audience projector and a band
confidence monitor from one Chrome/Edge browser. Requirements: [REQUIREMENTS.md](REQUIREMENTS.md)
(R261–R275, 15 total, 15/15 mapped). Numbering continues from v2.3, which ended at Phase 89 — v2.4 starts
at Phase 90, not reset.

**Basis:** This milestone follows `research/SUMMARY.md`'s "Implications for Roadmap" dependency-aware
7-phase build order directly (SlideCanvas extraction → shared utilities → monitor config → the two output
windows → Run/control → hardening), per explicit roadmapping instruction, rather than compressing to this
project's usual `coarse`-granularity default of 2-4 phases — the dependency chain (a shared rendering
component must exist before three consumer windows; sync/persistence primitives must be proven before the
windows that use them; both output windows must exist before the control screen that orchestrates them)
argued against further collapsing. Phases 90 and 91 are enabling refactor/infrastructure work with no
directly-mapped requirement of their own — kept as their own phases rather than folded into a neighbor
because each isolates a distinct, independently-verifiable risk (see ROADMAP rationale in STATE.md).

**Scope note (confirmed via research):** this milestone is **client-side only** — zero new Firestore
schema, zero Cloud Functions, no new npm dependency. No `firestore.rules`/`storage.rules` change is
expected; Phase 96 re-confirms this rather than assuming it.

- [ ] **Phase 90: SlideCanvas Extraction** - Extract `PresentationViewer.vue`'s slide-rendering logic into a reusable `SlideCanvas.vue` with zero behavior change
- [ ] **Phase 91: Config + Channel Utilities** - Pure BroadcastChannel protocol, per-device monitor config, and slot↔slide lookup, unit-tested in isolation
- [ ] **Phase 92: Monitor Configuration Screen** - Standalone monitor-setup screen detects displays and assigns Audience/Confidence roles, persisted per device
- [ ] **Phase 93: Audience Output Window** - Fullscreen, chrome-free audience output with background, wake lock, and fullscreen-loss recovery
- [ ] **Phase 94: Confidence Monitor Output Window** - Current+next slide output with background suppressed to black, no chrome
- [ ] **Phase 95: Run/Control Screen + Run Entry Point** - Run button, order-of-service rail, click-to-jump, keyboard nav, single-selection live model
- [ ] **Phase 96: Live-Ops Hardening** - Closed-window recovery, monitor-replug detection, and sync robustness over a realistic service

## Phase Details

### Phase 90: SlideCanvas Extraction

**Goal**: Extract `PresentationViewer.vue`'s slide-rendering logic into a reusable `SlideCanvas.vue` component with zero behavior change, establishing the single rendering source of truth every downstream Run/Audience/Confidence window will compose instead of forking it.
**Depends on**: Nothing (first phase of v2.4)
**Requirements**: (none — enabling refactor; no v2.4 requirement maps here by design, see milestone Basis note)
**Success Criteria** (what must be TRUE):

  1. `SlideCanvas.vue` exists as a standalone component (`slide`/`suppressBackground`/`interactive` props) that renders every slide content type the app supports — lyrics, scripture, image, video, and copyright.
  2. `PresentationViewer.vue` composes `SlideCanvas` internally at its one existing call site with no observable behavior change — its existing test suite and `data-testid` markers pass unmodified.
  3. The app's documented type-check and test-suite baseline is unchanged after the refactor (no new failures introduced).

**Plans**: 1/1 plans executed

- [x] 90-01-PLAN.md — Extract SlideCanvas.vue (slide/suppressBackground/interactive) from PresentationViewer; compose it at the one call site with zero behavior change; add focused SlideCanvas tests

**UI hint**: yes

### Phase 91: Config + Channel Utilities

**Goal**: Pure, framework-agnostic utility modules exist for control→output sync, per-device monitor-role persistence, and service-slot↔slide lookup, so the riskiest sync/persistence logic is built and unit-tested before any window depends on it.
**Depends on**: Nothing (independently buildable; sequenced ahead of Phases 92-96, which consume it)
**Requirements**: (none — enabling infrastructure; no v2.4 requirement maps here by design, see milestone Basis note)
**Success Criteria** (what must be TRUE):

  1. A typed BroadcastChannel protocol module lets any window send/receive a `{index, blackout, seq}`-shaped state update, covered by unit tests with no Vue/Firebase dependency.
  2. A monitor-config module computes a stable per-screen fingerprint (label + resolution + position) and persists/retrieves an Audience/Confidence role mapping from `localStorage`, keyed per device.
  3. A service-slots module resolves `slotIndex` ↔ first-assembled-slide-index consistently with the existing `slideshowAssembler.ts`, unit-tested in isolation.

**Plans**: 1/1 plans executed

- [x] 91-01-PLAN.md — runChannel.ts (typed BroadcastChannel protocol) + monitorConfig.ts (device-scoped fingerprint/localStorage mapping) + serviceSlots.ts (slotIndex↔first-slide lookup), each framework-free unit-tested

### Phase 92: Monitor Configuration Screen

**Goal**: A projectionist can open a standalone, persistent monitor-setup screen to detect connected displays and assign Audience/Confidence roles, with a first-class fallback when screen-management permission isn't available.
**Depends on**: Phase 91
**Requirements**: R267, R268, R269
**Success Criteria** (what must be TRUE):

  1. A projectionist can navigate to a standalone monitor-setup screen, independent of any specific service, and see the currently connected monitors listed. (R267)
  2. A projectionist can assign Audience and Confidence roles to the detected monitors, and that assignment persists on that device across browser sessions. (R267, R268)
  3. Returning later to Run a service, the saved mapping is reused silently without re-prompting — the app only re-prompts when the physical monitor layout has actually changed. (R268)
  4. When screen-management permission is denied or the API is unavailable, the projectionist is guided through a working manual path (open the output window, drag it to the target monitor, go fullscreen) rather than hitting a dead end. (R269)

**Plans**: 2/2 plans executed

- [x] 92-01-PLAN.md — Build + wire the Monitor Setup screen (route, gated nav entry, MonitorSetupView + MonitorCard + MonitorFallbackPanel; state machine, synchronous detection, device-scoped persistence with save round-trip check)
- [x] 92-02-PLAN.md — Behavioral tests: three permission paths, persistence round-trip / matched reuse / changed-layout reprompt, save-warning, synchronous-call contract, and the orgId-gated nav entry

**UI hint**: yes

### Phase 93: Audience Output Window

**Goal**: The audience sees a fullscreen slide with its background image and zero operator chrome on the monitor assigned as Audience, and the display stays awake and recovers gracefully for the whole service.
**Depends on**: Phase 90, Phase 91, Phase 92
**Requirements**: R270, R271
**Success Criteria** (what must be TRUE):

  1. Opening the audience output on the assigned monitor shows the current slide fullscreen with its background image, and no arrows, slide counts, organizational labels, or visible cursor are present. (R270)
  2. The audience display does not go to sleep for the duration of a realistic service length. (R271)
  3. If the audience output loses fullscreen, it offers a one-click way to re-enter fullscreen without tearing down the running session or the confidence output. (R271)

**Plans**: 2/2 plans executed

- [x] 93-01-PLAN.md — Register the /present/audience/:serviceId route and build the chromeless, receive-only, self-bootstrapping AudienceOutputView (channel-driven slide, wake lock, no-teardown fullscreen recovery)
- [x] 93-02-PLAN.md — Author AudienceOutputView.test.ts (channel/hello/never-writes-state, chrome-absence + cursor toggle, wake-lock acquire/re-acquire/absence, fullscreen-loss recovery)

**UI hint**: yes

### Phase 94: Confidence Monitor Output Window

**Goal**: The band/team sees the current and next slide on the Confidence monitor with backgrounds always suppressed to black and no operator chrome.
**Depends on**: Phase 90, Phase 91, Phase 93
**Requirements**: R272
**Success Criteria** (what must be TRUE):

  1. Opening the confidence output on the assigned monitor shows both the current slide and the next upcoming slide, clearly distinguished from each other. (R272)
  2. Every slide on the confidence output renders against a plain black background — the actual background image is never shown. (R272)
  3. No operator chrome (arrows, slide counts, organizational labels) is visible on the confidence output.

**Plans**: 3/3 plans executed

- [x] 94-01-PLAN.md — Extract shared useOutputWindow composable + refactor AudienceOutputView (keep 18 Phase 93 tests green)
- [x] 94-02-PLAN.md — ConfidenceOutputView (current+next two-pane, both backgrounds suppressed to black) + /present/confidence route
- [x] 94-03-PLAN.md — ConfidenceOutputView tests + direct useOutputWindow unit test

**UI hint**: yes

### Phase 95: Run/Control Screen + Run Entry Point

**Goal**: A projectionist can start and drive a locked service's live presentation from one calm control screen that stays in charge of both output windows, with no separate "push to live" step.
**Depends on**: Phase 92, Phase 93, Phase 94
**Requirements**: R261, R262, R263, R264, R265, R266, R275
**Success Criteria** (what must be TRUE):

  1. A "Run" button appears on a locked service and opens a dedicated, standalone Run/control screen (not the service editor); the button is absent or disabled on a draft service. (R261)
  2. Any authenticated org member — editor or viewer — can click Run on a locked service, and running never grants any ability to edit the plan. (R275)
  3. The control screen shows the order of service as a list with the item containing the current slide clearly highlighted, alongside a large current-slide preview and a smaller next-slide preview. (R262, R264)
  4. Clicking an order-of-service item jumps the live output to that item's first slide; the projectionist can also navigate with standard keys — Right/Space = next, Left = previous, Down/Up = next/previous item, Escape = exit with a confirmation. (R263, R265)
  5. The current/selected slide on the control screen is always what's live on the outputs — there is no separate "push to live" step. (R266)

**Plans**: 6/6 plans executed

- [x] 95-01-PLAN.md — Extract useServiceAssembly + refactor useOutputWindow (shared service-load slice) [wave 1]
- [x] 95-02-PLAN.md — Run entry button on a locked service (any member, editor or viewer) [wave 1]
- [x] 95-03-PLAN.md — RunControlView core: shell + single-writer channel + rail + dual preview + keyboard + exit-confirm + route [wave 2]
- [x] 95-04-PLAN.md — RunControlView output orchestration: open/place output windows + amber fallback + status cluster [wave 3]
- [x] 95-05-PLAN.md — RunControlView core behavioral tests (channel/seq, rail, keyboard, escape-confirm) [wave 4]
- [x] 95-06-PLAN.md — Output-orchestration tests + Run-button (R275 viewer) tests [wave 4]

**UI hint**: yes

### Phase 96: Live-Ops Hardening

**Goal**: The live session survives real-world operating conditions — closed windows, monitor replugs, and a realistic service duration — without losing the projectionist's place or requiring a restart.
**Depends on**: Phase 95
**Requirements**: R273, R274
**Success Criteria** (what must be TRUE):

  1. The audience and confidence outputs stay in sync with the operator's navigation on the control screen with no perceptible lag. (R273)
  2. If an output window is closed mid-service, the control screen detects it and offers one-click reopen without losing the current slide position. (R274)
  3. If a monitor is unplugged mid-service, the control screen detects the change and offers one-click reassignment/recovery without losing the current slide position. (R274)
  4. This milestone remains confirmed client-side only — no new Firestore document or `firestore.rules` change was needed to satisfy R273/R274; if one had turned out to be needed, it would carry rules test coverage verified via `npm run test:rules`.

**Plans**: 2 plans

- [ ] 96-01-PLAN.md — Harden RunControlView: closed-window poll + per-role reopen + monitor-unplug screenschange listener + reassign banner + single-teardown cleanup [wave 1]
- [ ] 96-02-PLAN.md — Live-ops hardening tests: closed detection + reopen + position preserved + monitor-unplug/precedence + no-leak teardown + rapid-nav sync [wave 2]

**UI hint**: yes
