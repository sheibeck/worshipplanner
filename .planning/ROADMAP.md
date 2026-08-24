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
- 📋 **v2.2 — Configurability, Hardening & Cleanup** — Phases 79-81 (planned; per-org configurable teams + generalized song-tag filter + drop the ordinal-Sunday auto-select, replacing hard-coded Berean-specific rules (R228-R231, R241 dedup prerequisite); security & data-integrity hardening — inviteLookup create gate, createdBy immutability, deleteService share-token revocation, song-clear slide cleanup, pending-render edit guard (R232-R236); and polish/ops close-out — full Planning Center export coverage, Resend verified-sending-domain runbook, Owner Console a11y retrofit, shared song-browse component (R237-R240))

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

## v2.2 Configurability, Hardening & Cleanup (Phases 79-81)

**Milestone Goal:** Make the app fit churches other than Berean, and close accumulated security,
data-integrity, and polish debt from the v1.x–v2.1 backlog (999.x carry-forwards). Phase numbering
continues from v2.1 (75–78, ended at Phase 78); this milestone is Phases 79–81.

**Deploy policy:** per the standing v1.5+ deploy discipline, Phase 80's two `firestore.rules` changes
(R232 `inviteLookup` create gate, R233 `createdBy` immutability) ship built + tested + **UNDEPLOYED**
with the exact `firebase deploy --only firestore:rules` command handed to the owner. R238 (Phase 81,
Resend verified sending domain) is an owner-run DNS/dashboard runbook — not something the app can deploy
or self-verify. Every other change in this milestone is client-only.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R228–R241 (14 mapped)

- [x] **Phase 79: Dedup & Configurable Teams** - Collapse the duplicated team-list/Orchestra-filter constants to one source, then let a church admin define their own team list with an optional per-team song-tag filter, and drop the hard-coded ordinal-Sunday auto-team-select rule (completed 2026-08-24)
- [ ] **Phase 80: Security & Data-Integrity Hardening** - Gate `inviteLookup` creation to the target org's editor, lock `createdBy` after creation, revoke a deleted service's share links, clear a reprised song's orphaned slides, and warn before losing edits to a pending-render slide
- [ ] **Phase 81: Polish & Ops Close-Out** - Cover every slot type in every Planning Center export mode, move messaging to a Resend-verified sending domain, retrofit Owner Console accessibility, and unify song browsing into one shared component

### Phase 79: Dedup & Configurable Teams

**Goal**: A church admin configures their own team/ministry list — driving every service-planning surface that shows teams — with every hard-coded, Berean-specific team rule replaced by per-org configuration.
**Depends on**: Nothing (first phase of v2.2)
**Requirements**: R241, R228, R229, R230, R231
**Success Criteria** (what must be TRUE):

  1. A church admin can add, rename, and remove teams/ministries on the Settings page, seeded with sensible defaults, instead of the hard-coded `['Choir','Orchestra','Communion','Special']` list — and the team-list duplicated across `ServiceEditorView.vue`/`NewServiceDialog.vue` now reads from one shared source (R228, R241).
  2. The team checkboxes on both the new-service dialog and the service editor are driven by the org's configured team list, so two different churches see two different lists (R229).
  3. A church admin can attach a song-tag filter to a team via a form field, so selecting that team on a service constrains AI song suggestions to songs carrying that tag — generalizing the old hard-coded "Orchestra team → Orchestra-tagged songs" rule to any team (R230).
  4. Creating a new service no longer auto-selects teams by the Sunday's ordinal position (1st Sunday → Orchestra+Communion, 3rd Sunday → Choir) — a planner picks every service's teams manually (R231).

**Plans**: 3/3 plans executed

- [x] 79-01-PLAN.md — Teams store foundation: `Team` type + `DEFAULT_TEAMS`, `useTeamsStore()` (per-org subcollection CRUD + idempotent seed) mirroring `roster.ts`, registered in `resetOrgScopedStores()` (R228, R241 single source) [wave 1]
- [x] 79-02-PLAN.md — Teams editor: `TeamsConfigPanel.vue` (flat editable list, per-team song-tag select, aria-labels) mounted as a new "Teams" tab in `RosterView.vue`, subscribing+seeding teams/songs (R228, R230) [wave 2]
- [x] 79-03-PLAN.md — Consumer rewiring + de-dup: store-driven checkboxes in `NewServiceDialog.vue`/`ServiceEditorView.vue`, ordinal auto-select removed, one union-of-team-tags AI filter helper replacing the two Orchestra blocks (R229, R230, R231, R241) [wave 2]

**UI hint**: yes

### Phase 80: Security & Data-Integrity Hardening

**Goal**: Known security and data-integrity gaps around invite creation, org identity, service deletion, song clearing, and pending slide renders are closed.
**Depends on**: Nothing (independent of Phase 79)
**Requirements**: R232, R233, R234, R235, R236
**Success Criteria** (what must be TRUE):

  1. Only an editor of the target org can create an `inviteLookup` record for that org — a signed-in user can no longer forge an invite into a church they don't administer — while the legitimate invite → first-login acceptance flow still works (R232).
  2. An organization's `createdBy` field cannot be changed after creation by an org editor (R233).
  3. Deleting a service revokes every one of its public share artifacts (`shareTokens`, `serviceShares`, `serviceShareLinks`, found by query since a service can accumulate more than one across re-shares), so a deleted service's share URL no longer resolves (R234).
  4. Removing a song from a service clears that song's slides even when the song is reprised elsewhere in the same service — no orphaned slides remain (R235).
  5. When a deck slide's render is still pending, the edit UI warns or prevents the user from customizing that slide, so a per-entry change is never silently discarded when the render flips pending → ready (R236).

**Plans**: TBD
**UI hint**: yes
**Deploy note**: R232 and R233 are `firestore.rules` changes — ship built + tested + UNDEPLOYED with the exact `firebase deploy --only firestore:rules` command handed to the owner. R234, R235, and R236 are client-only, no deploy hand-over needed.

### Phase 81: Polish & Ops Close-Out

**Goal**: Remaining polish and operational debt is closed — Planning Center export is complete, volunteer messaging email is deliverable, the Owner Console meets baseline accessibility, and song browsing is unified across the app.
**Depends on**: Nothing (independent of Phases 79-80)
**Requirements**: R237, R238, R239, R240
**Success Criteria** (what must be TRUE):

  1. Every Planning Center export mode includes non-song/non-scripture service slots — no item is silently dropped from any export (R237).
  2. Real volunteers reliably receive messaging email sent from a Resend-verified sending domain (SPF/DKIM/DMARC), replacing the test-mode `onboarding@resend.dev` sender, with a documented owner DNS runbook since domain verification is owner-run and not app-verifiable (R238).
  3. The Owner Console's form inputs carry real labels/aria-labels, and its tab navigation (Configuration/Organizations, and the matching Service Editor tab strip) exposes proper ARIA tab semantics — without breaking the always-mounted `onSnapshot` panels (R239).
  4. The Songs page and the service-plan song picker are both powered by one shared song-browse component (R240).

**Plans**: TBD
**UI hint**: yes
**Deploy note**: R238 is an owner-run Resend-dashboard/DNS runbook, not an app deploy — the coding deliverable is the documented runbook plus the code path that reads the verified sender once the owner flips it. R237, R239, and R240 are client-only.
