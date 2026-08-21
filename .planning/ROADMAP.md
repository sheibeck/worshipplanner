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
- ✅ **v1.9 — Owner Admin Console** — Phases 68-71 (code-complete 2026-08-20; super-admin console lifting the v1.8 cost/cleanup levers + no-reply sender into Firestore-backed runtime config, with a dry-run blast-radius preview gating every cleanup-toggle flip — deploy + human UAT + milestone lifecycle parked with owner, archives as-is once those run)
- 🚧 **v2.0 — Multi-Church Onboarding & Owner Console Tabs** — Phases 72-74 (active, started 2026-08-21; stacks on v1.9's code-complete console — tabbed Configuration/Organizations shell, org onboarding (org + settings + seeded template + first admin), and the multi-org Storage auth-claim widening (backlog 999.5) as a hard prerequisite for assigning a second-org admin)

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

## v1.9 Owner Admin Console (Phases 68-71) — CODE-COMPLETE (lifecycle pending; next milestone stacks on top)

**Milestone Goal:** A private, owner-only admin console — separate from per-church settings — where the
owner (and anyone granted super-admin access) controls the v1.8 cost/cleanup levers and the app's no-reply
sender at runtime, instead of via buried `functions/.env` vars + redeploy. Phase numbering continues from
v1.8 (65–67); this milestone is Phases 68–71. Research (`.planning/research/SUMMARY.md`) converged on a
strict, linear dependency chain across all four research tracks (Stack, Features, Architecture, Pitfalls):
claim/gate → config doc/rules → UI + sender → deletion safety.

**Hard constraint (owner, emphasized 2026-08-20):** song-linked backgrounds must **never** be cleaned up —
only transient slideshow backgrounds tied to a service. This guarantee must survive the config swap
(closed by Phase 71 / R190).

**Status note (2026-08-21):** all four phases are code-complete + auto-verified. Deploy, human UAT
(`/gsd-verify-work 68..71`), and the milestone lifecycle (audit → complete → cleanup) remain parked with
the owner (see PROJECT.md and STATE.md). v2.0 stacks directly on top of this code-complete console — its
phase numbering continues at 72, and v1.9 archives as-is once its own deploy/UAT/lifecycle steps run.

- [x] **Phase 68: Super-Admin Access Gate & Claim-Merge Fix** — ✅ code-complete + automatically verified 2026-08-20 (5/5 SC; human UAT deferred to `/gsd-verify-work 68`, UNDEPLOYED owner hand-over). A super-admin custom-claim gate, grantable via `superAdmins/{uid}`, enforced by both the client route and claim-only Firestore rules, with the shared merge-and-set helper closing the claim-replace hazard
- [x] **Phase 69: Firestore Runtime Config** — ✅ code-complete + auto-verified 2026-08-20 (8/8 code SC; human UAT R181/R183 deferred to `/gsd-verify-work 69`, UNDEPLOYED owner hand-over). The v1.8 cost/cleanup/messaging knobs move into an admin-only `appConfig/global` doc Cloud Functions read at runtime, with safe deep-merged defaults and per-knob fail-open/closed behavior
- [x] **Phase 70: Admin Console UI & No-Reply Sender** — ✅ code-complete + auto-verified 2026-08-20 (8/8 SC; UI review 21/24; human visual/live UAT deferred to `/gsd-verify-work 70`; client-only). A super-admin console showing/editing every managed setting with validation and provenance, plus the app's no-reply sender configuration
- [x] **Phase 71: Cleanup Deletion-Toggle Safety** — ✅ code-complete + auto-verified 2026-08-20 (10/10 code SC; UI review 21/24; human live/visual UAT deferred to `/gsd-verify-work 71`; `previewCleanupDryRun` UNDEPLOYED owner hand-over). A dry-run blast-radius preview and explicit confirm step gate every `*_CLEANUP_ENABLED` flip, with the song-linked-background fail-safes proven intact

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R174–R192 (19 mapped, 100% coverage)

### Phase 68: Super-Admin Access Gate & Claim-Merge Fix

**Goal**: A super-admin custom-claim gate exists end-to-end — grantable, claim-merge-safe, and enforced by both the client route and Firestore rules — establishing the security foundation every other v1.9 capability depends on.
**Depends on**: Nothing (first v1.9 phase)
**Requirements**: R174, R175, R176, R177, R178, R179
**Success Criteria** (what must be TRUE):

  1. A user granted access via `superAdmins/{uid}` carries `superAdmin: true` on their ID token, and an ordinary org-membership claim sync (join/leave/role change) never strips that claim — nor does a super-admin grant/revoke ever strip the user's existing `{orgId, role}` claim — because both writers route through one shared merge-and-set helper (R174, R175).
  2. The owner can bootstrap the very first super-admin by running a dry-run-by-default, `--apply`-gated, owner-run Node script with no pre-existing super-admin required (R176).
  3. Only a signed-in super-admin can reach the admin console route and its nav entry (distinctly named, not `/admins`, which the per-org TeamView already owns); a non-super-admin is denied/redirected client-side (R177).
  4. Firestore rules allow read/write of `appConfig/*` and `superAdmins/*` only to a super-admin, via a claim-only `isSuperAdmin()` check (no cross-document `get()`/`exists()`), proven by genuine emulator ALLOW and DENY tests (R178).
  5. A super-admin can grant and revoke another user's super-admin access from the console, and a revoked user loses access on their next token refresh (R179).

**Plans**: 5/5 plans executed

- [x] 68-01-PLAN.md — Shared claims-merge helper + orgMembershipClaims merge-safety fix (R175)
- [x] 68-02-PLAN.md — superAdmin claim function (sync trigger + onCall) + owner bootstrap script (R174, R175, R176, R179)
- [x] 68-03-PLAN.md — Claim-only isSuperAdmin() Firestore rules + genuine ALLOW/DENY emulator tests (R178)
- [x] 68-04-PLAN.md — Client gate (auth store, router guard, nav) + Owner Console roster (R177, R179)
- [x] 68-05-PLAN.md — Owner hand-over deploy + first-super-admin bootstrap runbook (R174, R176, R178, R179)

### Phase 69: Firestore Runtime Config

**Goal**: Every v1.8 cost/cleanup/messaging knob lives in one admin-only Firestore doc that Cloud Functions read at runtime with safe, per-knob fail-open/closed defaults, so a config change takes effect without a redeploy.
**Depends on**: Phase 68 (needs the `superAdmin` claim + `isSuperAdmin()` rules helper to gate `appConfig/global`)
**Requirements**: R180, R181, R182, R183, R184, R185
**Success Criteria** (what must be TRUE):

  1. All v1.8 levers — the four `*_CLEANUP_ENABLED` flags, retention windows, delete blast-radius cap, AI-proxy knobs (rate limits, model allow-list, `max_tokens` ceiling), and messaging/fan-out knobs (incl. `SCHEDULED_MESSAGING_CRON_ENABLED`, recipient cap, per-org daily quota) — live in `appConfig/global`, readable/writable only by a super-admin (R180).
  2. Changing a managed value in `appConfig/global` changes Cloud Functions runtime behavior with no redeploy (R181).
  3. Deleting or emptying `appConfig/global` reproduces today's exact behavior byte-for-byte via deep-merged code defaults identical to the current env fallbacks (R182).
  4. Hot paths (`api` proxy, `sendQueuedMessage`) read config from a short-TTL cache; the daily cleanup crons and `sendScheduledReminders` always read fresh, so an emergency disable takes effect on the very next scheduled run (R183).
  5. A missing/malformed config value fails safe per-knob — cleanup flags and the AI model allow-list default closed, AI rate limits default open but capped — never one blanket all-permissive or all-restrictive policy (R184).
  6. `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES`/render-service caps remain env/deploy-time only; if shown anywhere in the console they are read-only, labeled "requires redeploy" (R185).

**Plans**: 3/3 plans executed

- [x] 69-01-PLAN.md — appConfig.ts reader: AppConfig type + DEFAULT_APP_CONFIG + deep-merge + per-knob coercion + getAppConfig(db,{fresh?}) TTL cache, with appConfig.test.ts (R180, R182, R183, R184)
- [x] 69-02-PLAN.md — Swap the 17 managed index.ts read-sites to getAppConfig() (crons fresh, hot paths cached; R190 fail-safes untouched; MESSAGE_FROM_ADDRESS replaced) + convert index.test.ts setup (R181, R183, R184, R185)
- [x] 69-03-PLAN.md — Owner hand-over deploy note (functions/DEPLOY-RUNTIME-CONFIG.md) with the exact scoped firebase deploy command; built + tested + UNDEPLOYED (R181)

### Phase 70: Admin Console UI & No-Reply Sender

**Goal**: The super-admin console shows and edits every managed setting with validation and provenance, and lets the owner configure the app's no-reply sender — the human-usable surface on top of Phase 69's runtime config.
**Depends on**: Phase 68 (gated route), Phase 69 (rules + config doc + functions reading it)
**Requirements**: R186, R187, R191, R192
**Success Criteria** (what must be TRUE):

  1. The console displays the current effective value of every managed setting, grouped by area (cleanup, AI proxy, messaging, sender), each with a last-changed-by / last-changed-at stamp (R186).
  2. A super-admin can edit each toggle/number/text setting inline with min/max/required validation, enforced both client-side and by rules/functions, and saving persists the change to `appConfig/global` (R187).
  3. A super-admin can set the no-reply From display name + address from the console; it is format-validated and used by the Resend send path (R191).
  4. The sender config never accepts or exposes provider secrets (`RESEND_API_KEY` stays server-side), and an address on an un-verifiable host (e.g. `*.web.app`) surfaces a "must be a Resend-verified domain" warning (R192).

**Plans**: 2/2 plans executed
**UI hint**: yes

Plans:

- [x] 70-01-PLAN.md — Foundation: `appConfigDefaults.ts` mirror + `mergeAppConfig`/`isExplicitlySet`, the `appConfig/global` onSnapshot store (`setDoc merge:true` saveField), and reusable `ConfigNumberField`/`ConfigTextField` components (R186, R187)
- [x] 70-02-PLAN.md — Owner Console config panels: Cleanup(read-only)/AI Proxy/Messaging/Sender cards wired to the store with validation, provenance, and the sender warning, plus the fresh `OwnerConsoleView.test.ts` (R186, R187, R191, R192)

### Phase 71: Cleanup Deletion-Toggle Safety

**Goal**: No `*_CLEANUP_ENABLED` flag can be flipped on blind — every enable is preceded by a real dry-run blast-radius count and an explicit confirm, and the song-linked-background protection is proven intact after the config swap — completing the safety the v1.8 flags always needed before going live in production.
**Depends on**: Phase 69 (config-driven cleanup handlers to preview against), Phase 70 (console shell to host the confirm modal)
**Requirements**: R188, R189, R190
**Success Criteria** (what must be TRUE):

  1. Before any `*_CLEANUP_ENABLED` flag can be turned on, the console shows an on-demand dry-run blast-radius count — what that cron would delete right now — fetched from a callable that forces dry-run regardless of the stored flag (R188).
  2. Enabling a deletion-capable cleanup requires an explicit confirm step that echoes the dry-run count; flipping the flag never itself triggers a deletion — only the next scheduled cron run acts (R189).
  3. `cleanupOrphanBackgrounds`'s `referencesComplete` / floor-guard fail-safes remain intact after the config swap, with its existing unit tests passing unchanged — no cleanup can ever delete a song-linked background, only transient slideshow backgrounds tied to a service (R190).

**Plans**: 2/2 plans executed

- [x] 71-01-PLAN.md — Functions: {forceDryRun} handler seam + super-admin-gated previewCleanupDryRun callable + tests (R188, R190)
- [x] 71-02-PLAN.md — Client: CleanupEnableConfirmDialog + CleanupConfigCard Enable→preview→confirm flow + hard-block (R189, R190)

**UI hint**: yes

**Deploy**: Per the v1.9 standing autonomy grant (STATE.md), every deployable artifact this milestone —
the `superAdmin` custom claim + claims-merge fix, `firestore.rules` changes (`appConfig/*`,
`superAdmins/*`), and any live cleanup-toggle control — ships built + tested + UNDEPLOYED with the exact
deploy command handed to the owner. The owner runs the first-super-admin bootstrap script.

## v2.0 Multi-Church Onboarding & Owner Console Tabs (Phases 72-74) — ACTIVE

**Milestone Goal:** Turn the owner console into a tabbed shell and add platform-level multi-tenancy
management — onboard new churches and assign their first admin from one place — while closing the
multi-org Storage auth-claim gap that onboarding a second-org admin would otherwise trip. Phase numbering
continues from v1.9 (68–71); this milestone is Phases 72–74. Stacks on v1.9's code-complete console
(deploy + UAT + milestone-complete for v1.9 remain parked with the owner). A church admin reuses the
existing editor role — no new role or claim type. Milestone-level research was skipped: all the patterns
needed (super-admin-gated `onCall`, the shared claim-merge helper, the `orgNames` create-only registry,
dry-run/`--apply` backfill scripts) already exist in-repo from v1.5–v1.9.

**Hard sequencing constraint (owner, 2026-08-21):** assigning an admin into a second org (R206) silently
breaks that user's Storage access unless the org-membership claim is first widened to carry all
orgs+roles (R207–R211, backlog 999.5). Phase 73 (the widening) is sequenced ahead of Phase 74 (onboarding

+ admin assignment) for exactly this reason — the two are not otherwise coupled.

- [x] **Phase 72: Owner Console Tabs** — ✅ code-complete + auto-verified 2026-08-21 (6/6 SC; human visual/deep-link UAT deferred to `/gsd-verify-work 72`; client-only, nothing to deploy). Restructured `OwnerConsoleView` into a Configuration tab (super-admins roster + four platform-config cards + deploy-time note, byte-preserved) and an Organizations placeholder tab, with the open tab reflected in the route query (`?tab=`)
- [ ] **Phase 73: Multi-Org Storage Auth Claim** - Widen the org-membership claim to carry all of a user's orgs+roles, update `storage.rules`' `isOrgMemberByClaim` to match, and ship a dry-run/`--apply` backfill — closes backlog 999.5
- [ ] **Phase 74: Organizations — List, Onboard & Admin Assignment** - List every church, onboard a new one (org record + default settings + seeded template + first admin), and assign additional admins to any org — all through super-admin-gated server callables

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R193–R211 (19 mapped, 100% coverage)

**Deploy policy (carried from the standing grant):** every auth-claim / `firestore.rules` / `storage.rules`
/ new org-provisioning-callable change in this milestone ships built + tested + UNDEPLOYED, with the exact
`firebase deploy --only …` command and any owner-run backfill script handed over. `RESEND_API_KEY` and all
other secrets stay server-side. Human verification is deferred to the end of the milestone (routed to
`PENDING-VERIFICATION.md`), per the standing autonomy grant.

### Phase 72: Owner Console Tabs

**Goal**: The Owner Console presents its content as a tabbed shell — Configuration and Organizations —
with the existing config surface preserved byte-for-byte, so Phase 74 has a stable tab to build the
organization-management UI into and no existing super-admin workflow regresses.
**Depends on**: Nothing (first v2.0 phase; independent, low-risk layout refactor)
**Requirements**: R193, R194, R195
**Success Criteria** (what must be TRUE):

  1. A super-admin visiting the Owner Console sees two tabs — Configuration and Organizations — with
     Configuration selected by default, both still gated behind the existing super-admin access check
     (R193).

  2. The Configuration tab is a behavior-identical relocation of the pre-v2.0 console body — the
     super-admins roster (grant/revoke via `setSuperAdminClaim`), all four platform-config cards, and the
     deploy-time note — nothing about how they work changes, only where they live (R194).

  3. The open tab is reflected in the route/query, so reloading the page or opening a shared link to the
     Organizations tab lands directly on that tab instead of resetting to Configuration (R195).

  4. Every pre-existing Configuration-tab behavior (grant/revoke flow, the four config cards' validation
     and provenance stamps) is proven unchanged by the carried-forward `OwnerConsoleView` test coverage,
     not silently dropped in the restructure.

**Plans**: 1/1 plans executed

- [x] 72-01-PLAN.md — Restructure OwnerConsoleView into a query-driven tab shell (Configuration = verbatim console body relocation; Organizations = placeholder), plus carried-forward + tab-coverage tests

**UI hint**: yes

### Phase 73: Multi-Org Storage Auth Claim

**Goal**: A user who belongs to more than one organization keeps full Storage access to every org they
belong to, not just their primary — closing backlog 999.5 before any admin is assigned into a second org.
**Depends on**: Nothing (independent of Phase 72; sequenced ahead of Phase 74, which the widened claim is
a hard prerequisite for)
**Requirements**: R207, R208, R209, R210, R211
**Success Criteria** (what must be TRUE):

  1. The org-membership custom claim carries every organization a user belongs to and their per-org role
     — not just a single primary org — in a shape both `firestore.rules` and `storage.rules` can read
     (R207).

  2. The claim-writer recomputes this full multi-org set on any `members/*` write and continues to
     preserve the separate `superAdmin` claim through the existing shared merge helper (R175) — widening
     the claim never wipes super-admin status, and vice versa (R208).

  3. `storage.rules`' `isOrgMemberByClaim` checks the requested `orgId` against the full multi-org claim
     set, proven by genuine multi-org ALLOW and cross-org DENY emulator tests — a user in two orgs keeps
     Storage read/write on both (R209).

  4. An idempotent, dry-run-by-default, owner-run backfill script (mirroring `backfillOrgClaims.ts`)
     recomputes the widened claim for every existing user, with no manual per-user step (R210).

  5. During rollout, a session still carrying the old single-org claim shape keeps working — both the old
     and new claim shapes are tolerated by the rules until the backfill runs, so there is no Storage-access
     gap while users migrate (R211).

**Plans**: 2/3 plans executed

Plans:

- [x] 73-01-PLAN.md — Widen the claim writer: additive `orgs` map recomputed from surviving member docs on every write, merge-preserving superAdmin (R207, R208) — Wave 1
- [x] 73-02-PLAN.md — Widen `storage.rules` `isOrgMemberByClaim` with the `orgs`-map arm + legacy arm; multi-org ALLOW / cross-org DENY / legacy ALLOW emulator tests (R209, R211) — Wave 1
- [ ] 73-03-PLAN.md — Idempotent dry-run/`--apply` backfill (group-by-uid, shared builder, mergeAndSetCustomClaims) + deploy runbook order (R210, R208) — Wave 2

**Deploy**: The widened claim-writer, the `storage.rules` change, and the backfill script ship built +
tested + UNDEPLOYED — the exact `firebase deploy --only firestore:rules,storage` (or scoped equivalent)
command and the backfill's dry-run/`--apply` invocation are handed to the owner, consistent with every
prior auth-claim/rules change this project has shipped.

### Phase 74: Organizations — List, Onboard & Admin Assignment

**Goal**: A super-admin can see every church on the platform, onboard a brand-new one end-to-end (org
record, default settings, a seeded service template, and its first admin), and assign additional admins
to any existing org — entirely through super-admin-gated server callables that reuse the existing editor
role and the Phase 73 multi-org claim.
**Depends on**: Phase 72 (Organizations tab to host this UI), Phase 73 (the widened multi-org claim must
be in place before assigning a second-org admin)
**Requirements**: R196, R197, R198, R199, R200, R201, R202, R203, R204, R205, R206
**Success Criteria** (what must be TRUE):

  1. The Organizations tab lists every organization on the platform with at least its name and one
     distinguishing detail (id, created date, and/or member count) (R196).

  2. A super-admin can onboard a new church by entering a name and an admin email: this creates the
     `organizations/{orgId}` record with deep-merged default `OrgSettings`, seeds the org's default service
     template so a service can be created immediately, and assigns the entered email as the org's first
     member at editor tier — all in one flow (R197, R198, R199).

  3. Onboarding and admin assignment run entirely through super-admin-gated server callables that
     independently re-verify the caller's `superAdmin` claim; the client never writes `organizations/*`,
     `orgNames/*`, or another org's `members/*` directly (R200, R204).

  4. A duplicate church name is caught by the existing `orgNames` create-only registry and reported
     clearly; any failed onboarding step (name taken, unknown/invalid admin email, write error) never
     strands a half-created org — retrying after fixing the input succeeds without manual cleanup (R201,
     R202).

  5. A super-admin can assign an admin to an existing org by email at any time: an email with no matching
     account surfaces a clear result instead of a silent failure or a dangling membership doc, and
     assigning a user who already belongs to another org is strictly additive — their existing
     memberships and roles are preserved, never overwritten (R203, R205, R206).

**Plans**: TBD
**UI hint**: yes

**Deploy**: The two new org-provisioning callables (onboarding + admin assignment) ship built + tested +
UNDEPLOYED, with the exact `firebase deploy --only functions:…` command handed to the owner, per the
milestone deploy policy above.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4, 6-7 | v1.0 | 18/18 | Complete (archived) | 2026-03-05 |
| 8-17, 16.1 | v1.1 | all | Complete (archived) | 2026-07-24 |
| 18-23 | v1.2 | all | Complete (archived) | 2026-07-28 |
| 24-28 | v1.3 | 33/33 | Complete (archived) | 2026-07-28 |
| 29-38 | v1.4 | 61/61 | Complete (archived) | 2026-08-05 |
| 39-50 | v1.5 | all | Complete (archived) | 2026-08-10 |
| 51-57 | v1.6 | 19/19 | Complete (archived) | 2026-08-12 |
| 58-64 | v1.7 | 25/25 | Complete (archived) | 2026-08-18 |
| 65 | v1.8 | 2/2 | Complete    | 2026-08-20 |
| 66 | v1.8 | 2/2 | Complete    | 2026-08-20 |
| 67 | v1.8 | 2/2 | Complete    | 2026-08-20 |
| 68 | v1.9 | 5/5 | Code-complete (UAT deferred) | 2026-08-20 |
| 69 | v1.9 | 3/3 | Code-complete (UAT deferred) | 2026-08-20 |
| 70 | v1.9 | 2/2 | Code-complete (UAT deferred) | 2026-08-20 |
| 71 | v1.9 | 2/2 | Code-complete (UAT deferred) | 2026-08-20 |
| 72 | v2.0 | 1/1 | Code-complete (UAT deferred) | 2026-08-21 |
| 73 | v2.0 | 2/3 | In Progress|  |
| 74 | v2.0 | 0/TBD | Not started | - |

## Backlog

### ✅ Phase 999.3: Deploy firestore.rules to production — DEPLOYED 2026-08-05

> **Deploy half DONE.** A full `firebase deploy` to `worship-planner-bc515` released
> `firestore.rules` and `storage.rules` to production on 2026-08-05, alongside hosting, the
> Firestore indexes and all five Cloud Functions. Confirmed independently: a follow-up
> `firebase deploy --only firestore:rules,storage` reported *"latest version of firestore.rules
> already up to date, skipping upload"*, which is Firebase comparing the local file against the
> live ruleset and finding them identical. **Phase 31's draft lock now runs on all three layers.**
>
> **The verification half is still OPEN** — see "Verification after deploy" below. Nobody has yet
> opened devtools against the PRODUCTION app and attempted a direct write to a locked service. The
> rules are live; that they *behave* as intended in production is still inferred from the emulator
> suite, not observed. This is the one item worth actually doing by hand.

**Goal:** ~~run `firebase deploy --only firestore:rules`~~ (done), then re-run the devtools bypass
check that Phase 31 deliberately skipped.
**Why this is not optional:** Phase 31 (R036) added a three-layer draft lock. Two layers — the UI gate
and the store guard — ship with the app bundle. **The third does not.** `firestore.rules` deploys
separately, this repo has no CI, and `src/rules.test.ts` is excluded from the default vitest run
(`vite.config.ts:85-86`). So the rules layer is verified in the emulator and is currently NOT live.
Until this deploys, anyone with a browser console can write to a locked service — the exact bypass
Phase 31 exists to close.
**Deferred by:** owner, 2026-07-30 — *"We have the emulator so firebase rules should be able to be just
local for now until we're all done working. We can deploy to production at a later date."*
**Verification after deploy:** set a service to Planned in the PRODUCTION app, open devtools, attempt a
direct Firestore write. Expect permission denied. (Locally this same check is already meaningful with
`VITE_USE_EMULATORS=true` — `src/firebase/index.ts:23-28` points the dev app at the emulator, where the
rules ARE active. This backlog item is specifically about production.)
**Requirements:** R036
**Plans:** 0 plans

Plans:

- [x] Deploy `firestore.rules` to production — done 2026-08-05 as part of a full `firebase deploy`
- [ ] Devtools bypass check against PRODUCTION (set a service to Planned, attempt a direct write,
      expect permission denied) — **still outstanding**

### Phase 999.2: Clearing a song should clear its slides, even when the song is reprised (BACKLOG)

**Goal:** Clearing the song from a plan item empties that item's slide group. Today it does not, in one
reachable case: if the *same* song is still assigned to another plan item in the same service, the
cleared item keeps projecting the old song's full slide set.
**Motivation:** W-03 in `.planning/phases/30-.../30-VERIFICATION.md`, proven by executing
`assembleSlideshow` — a cleared SONG slot whose stored group still holds the old song's copyright and
lyric entries emits 2 slides when a second slot references that song. `rebuildSongGroup` returns
`{changed: false}` on `!songId` (`src/utils/slideGroupMaterializer.ts:478`), and `confirmSlotDelete`'s
clear path deliberately does not cascade (`ServiceEditorView.vue:1894-1902`). Normally the stale slides
are masked because the old song's lyrics stop being loaded; a reprise defeats that mask.
**Pre-existing:** yes — byte-identical at `0ecc84f`, so NOT a Phase 30 regression. It nonetheless
contradicts R045's "membership always mirrors" wording, which is why it is recorded rather than dropped.
**Requirements:** relates to R045
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.1: Extract shared song-browse component (Songs page + service-plan picker) (BACKLOG)

**Goal:** Extract the song search + tag-filtering + results-list functionality into ONE shared component reused on both the Songs page and the service-plan song picker, so there is a single set of code and behavior instead of two parallel implementations. Not exactly 1:1 — the Songs page keeps extra affordances the picker doesn't need (song import, inline edit / slide-over editing, bulk tag actions); those compose around the shared search/tags/list core.
**Motivation:** Phase 12 repeatedly required parallel fixes in `SongSlotPicker.vue` and `SongsView.vue`/`SongFilters.vue` for the same behavior (tag union, hidden-song exclusion, popover positioning/alignment). A shared component would collapse that duplication.
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: Export non-song/non-scripture slots in ALL Planning Center export modes (BACKLOG)

**Goal:** Make the "Add to existing plan" and "Create new plan with template" export modes append Prayer, Message, Announcements and Miscellaneous slots as their own Planning Center items — the same way the blank "Create new plan" mode already does via the exhaustive `addSlotAsItem`.
**Motivation:** Phase 43 code review WR-01 (`ServiceEditorView.vue:3206-3319`) and WR-02 (`:3366-3414`). Both modes bucket only `songSlots`/`scriptureSlots`; non-song/non-scripture slots are never appended, so a planner's Prayer/Message/Announcements/Miscellaneous items silently do not reach Planning Center in those two modes. The in-code comment at `:3200-3205` documents this for PRAYER/MESSAGE.
**Pre-existing:** yes — PRAYER/MESSAGE were never exported in these two modes before Phase 43; the phase only added ANNOUNCEMENTS/MISC to the same excluded `NonAssignableSlot` family. `addSlotAsItem` itself exports every kind correctly (proven this phase), and the blank-new-plan path already exercises it for all slots. So this is a limitation of the two template/existing-plan bucketing paths, NOT a Phase 43 regression. Fixing it changes pre-existing Prayer/Message export behavior, which is why it is an owner-gated backlog item rather than an in-phase auto-fix.
**Requirements:** relates to R085 (phase-43 goal "every type exports to Planning Center as itself")
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Harden messaging From address to a Resend-verified domain (BACKLOG)

Currently `MESSAGE_FROM_ADDRESS` defaults to `onboarding@resend.dev` (Resend's zero-setup test sender) so the
send path can be tested end-to-end without domain setup — but in test mode it only delivers to the Resend
account owner's own email, so real volunteers won't receive mail. Harden: verify a real domain in Resend
(add DKIM/SPF/DMARC DNS records), then set `MESSAGE_FROM_ADDRESS` to `no-reply@<that-domain>` (change the
`defineString` default or override at deploy). Emails already send as `"<Org Name>" <address>` and set
Reply-To to the sending editor, so only the address changes. A `*.web.app` address can never be verified
(Google-managed, no DNS access). Introduced alongside R159 (2026-08-17). **Note (v1.9):** the v1.9 admin
console's no-reply sender field (R191/R192) configures this same address from the UI, but domain
verification itself stays an out-of-band owner action — see R192.

### Phase 999.5: Multi-org-aware auth claim for Storage membership (BACKLOG)

> **Promoted to v2.0 Phase 73** (2026-08-21) — see ROADMAP § Phase 73: Multi-Org Storage Auth Claim
> above, requirements R207–R211. This entry is kept for its original motivation/history; the live work
> item is Phase 73, not this backlog row.

**Goal:** Widen the org-membership custom auth claim to carry ALL of a user's orgs (and roles), and update `storage.rules`' `isOrgMemberByClaim` to check the requested `orgId` against that set — so a user who belongs to more than one organization retains Storage access to every org, not just their primary.
**Motivation:** Phase 40 Deploy 2 (2026-08-12) removed the cross-service `firestore.exists()` fallback, making the claim the sole authority for Storage membership. By design (D-01/D-04) the claim carries only the PRIMARY org (`users/{uid}.orgIds[0]`). This is safe today because every user is single-org (verified + cleaned up at the 2026-08-12 migration), but the moment a real user joins a second real org their non-primary org's Storage access would silently fail. This must be built BEFORE any such user is onboarded.
**Blocking condition:** onboarding a user into a second organization.
**Requirements:** relates to R074 (Phase 40 custom-claim membership); superseded by R207–R211
**Plans:** 0 plans

Plans:

- [x] Promoted to v2.0 Phase 73 (2026-08-21) — no longer tracked as a bare backlog item
