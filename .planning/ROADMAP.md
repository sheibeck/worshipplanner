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
- ✅ **v2.4 — Run the Service (Live Presentation)** — Phases 90-98 (shipped & deployed to production 2026-08-30; a non-technical projectionist runs a locked service's slides live from Chrome/Edge — Run button → standalone Run/control screen, persistent monitor-setup, fullscreen chrome-free audience output, black-background confidence output, Window Management multi-monitor delivery with a pop-out fallback, live-ops hardening, the Phase 97 owner redesign (blackout/timers/filmstrip/rehearse/confidence-left-right), and a hardware-UAT round landing reliable per-display "Go fullscreen" buttons after browser zero-click fullscreen proved a dead end — R261-R284; Phase 98/R285-R287 built then withdrawn; client-only, owner-approved)
- ✅ **v2.5 — Invite Email & Non-Google Onboarding** — Phases 99-100 (shipped 2026-08-31; every TeamView invite sends a real email — Google/Gmail invitees get a "sign in with Google" notice, non-Google invitees get a Cloud-Function-provisioned Auth account + `generatePasswordResetLink()` set-password link — LoginView gains a discoverable password path + `auth/operation-not-allowed` handling, and the Owner Console gets an `appConfig`-backed onboarding-email on/off toggle; code review caught + fixed an editor-can-email-arbitrary-addresses hole (invite-existence gate), audit PASSED 7/7 + 4/4 integration seams; `functions:sendInviteOnboardingEmail` deployed to prod, hosting + Resend-domain verification are standing owner follow-ups — R288-R294)

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

<details>
<summary>✅ v2.4 Run the Service (Live Presentation) (Phases 90-98) — SHIPPED 2026-08-30</summary>

- [x] Phase 90: SlideCanvas Extraction
- [x] Phase 91: Config + Channel Utilities
- [x] Phase 92: Monitor Configuration Screen
- [x] Phase 93: Audience Output Window
- [x] Phase 94: Confidence Monitor Output Window
- [x] Phase 95: Run/Control Screen + Run Entry Point
- [x] Phase 96: Live-Ops Hardening
- [x] Phase 97: Run Service Redesign (owner UAT-driven redesign)
- [~] Phase 98: Fullscreen Setup Helper — BUILT THEN REMOVED 2026-08-30 (premise disproven; superseded by per-display "Go fullscreen" buttons)

Full details: [milestones/v2.4-ROADMAP.md](milestones/v2.4-ROADMAP.md) · requirements [milestones/v2.4-REQUIREMENTS.md](milestones/v2.4-REQUIREMENTS.md) · phase artifacts in `milestones/v2.4-phases/`

> Deployed to production (hosting) 2026-08-30 (`worship-planner-bc515.web.app`); client-side only — no Firestore/Storage rules or Cloud Functions changed. Closed on owner acceptance/approval (no formal `/gsd-audit-milestone` run, per the v1.4/v1.5 precedent). R261–R284 delivered; **R278 auto-fullscreen met via per-display "Go fullscreen" buttons** — browser zero-click multi-monitor fullscreen proved unachievable (Chrome 151 + Edge rejected `requestFullscreen` `not granted` despite a `chrome://policy`-OK machine-wide policy; the permission query false-positives). **Phase 98 / R285–R287 built then withdrawn.** Owner hardware-UAT items (phases 92–97) accepted 2026-08-29.
</details>

### 🚧 v2.5 Invite Email & Non-Google Onboarding (Phases 99-100, in progress)

**Milestone Goal:** Every invited user gets an invite email, non-Google users can set a password and sign in, and an owner can switch onboarding emails on/off.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R288–R294 (7 mapped, 100% coverage)

**Flagged for phase discussion** (leaning defaults below; confirm in `/gsd-discuss-phase 99`):

- Google-vs-non-Google detection heuristic — leaning: `gmail.com`/`googlemail.com` → notify-only "sign in with Google"; everything else → set-password link (which also offers Google sign-in as a fallback so no invitee is stranded).
- Onboarding-email toggle scope — leaning: global (`appConfig`), not per-org.

**Owner-run external prerequisites** (not phases, not code): confirm the Firebase Auth Email/Password provider is enabled for `worship-planner-bc515`; complete `functions/DEPLOY-EMAIL-DOMAIN.md`'s Resend DNS domain verification, or invite emails to non-owner addresses will silently not deliver (default `onboarding@resend.dev` only reaches the Resend account owner's inbox).

- [x] **Phase 99: Invite Email Function & Owner Toggle** - A Cloud Function sends the right onboarding email per invitee type (non-Google set-password link, Google/Gmail sign-in notice), gated by an Owner Console on/off switch (completed 2026-08-31)
- [x] **Phase 100: Invite & Login Onboarding Wiring** - TeamView's invite UI actually calls the function with corrected copy, LoginView gains a discoverable password path + operation-not-allowed handling, and existing sign-in/invite-acceptance keep working (completed 2026-08-31)

### Phase 99: Invite Email Function & Owner Toggle

**Goal**: A Cloud Function reliably sends the correct onboarding email for any invited address — provisioning a Firebase Auth account and a secure set-password link for non-Google invitees, and a sign-in-with-Google notice for Google/Gmail invitees — governed by an owner-controlled on/off switch in the Owner Console, and reusing the existing Resend send pattern (`functions/src/adminEmail.ts`).
**Depends on**: Nothing (first phase of v2.5)
**Requirements**: R289, R290, R291, R293
**Success Criteria** (what must be TRUE):

  1. Inviting a non-Google email address through the function creates a Firebase Auth account for that address (if none exists) and sends an email containing a valid `generatePasswordResetLink()` "set your password" link, which also offers Google sign-in as a fallback (R290, R291).
  2. Inviting a Google/Gmail address (`gmail.com`/`googlemail.com`) through the function sends a "you've been invited — sign in with Google" notification email, with no Auth account pre-created and no password step (R289).
  3. An owner can switch onboarding/invite emails on or off from the Owner Console's Configuration tab (backed by `appConfig`), and when off, the function sends no email for either invitee type (R293).

**Plans**: 2/2 plans executed

- [x] 99-01-PLAN.md — Owner toggle: `appConfig.onboarding.emailsEnabled` (server + client mirror) + Owner Console Configuration card (Wave 1) [R293]
- [x] 99-02-PLAN.md — `sendInviteOnboardingEmail` Cloud Function: gmail-notify vs non-Google set-password provisioning, org-editor gate, toggle honored, re-exported from index.ts (Wave 2, depends on 99-01) [R289, R290, R291, R293]

### Phase 100: Invite & Login Onboarding Wiring

**Goal**: The real invite-email flow is reachable end-to-end through the app — TeamView's invite UI actually sends invites through Phase 99's function with corrected success copy, the login screen gives any user a discoverable way to set/reset their password with a clear error when email/password sign-in is unavailable, and existing Google sign-in plus invite-acceptance keep working unchanged.
**Depends on**: Phase 99 (consumes its invite-email Cloud Function)
**Requirements**: R288, R292, R294
**Success Criteria** (what must be TRUE):

  1. Inviting a team member from TeamView's "Invite a team member" UI triggers Phase 99's Cloud Function, the invitee receives a real email matching their type, and the post-invite success copy accurately reflects that an email was sent (R288).
  2. On the login screen, a user has a clearly discoverable path to set or reset their password (not buried inside "Forgot password?" alone), and attempting email/password sign-in when the provider is disabled (`auth/operation-not-allowed`) shows a specific, actionable message instead of the generic "Sign-in failed." (R292).
  3. Existing Google sign-in and the invite-acceptance flow (`ensureUserDocument` granting membership on first authenticated sign-in) continue to work unchanged (R294).
  4. If the invite email fails to send, the invite/membership Firestore record is still written — email delivery is best-effort and never blocks or reverts the invite (R294).

**Plans**: 1/1 plans executed

- [x] 100-01-PLAN.md — TeamView invite→`sendInviteOnboardingEmail` wiring (best-effort, honest copy), LoginView `auth/operation-not-allowed` error + discoverability hint, and view tests (Wave 1) [R288, R292, R294]

**UI hint**: yes

### 🚧 v2.6 Per-Org Bible API Toggle & Manual Fallback (Phases 101-103, in progress)

**Milestone Goal:** Put Bible API access behind a per-organization on/off switch controlled from the Owner Console, and when it is off give that org a zero-cost manual path (BibleGateway deep-link + paste-the-passage-in) so scripture and congregational-reading features always work without passing pay-only, non-commercial API costs to users.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R295–R301 (7 mapped, 100% coverage)

**Key context:** Promoted from backlog 999.3. Mirrors the v2.2 per-org AI enablement pattern (`aiMasterEnabled`/`setOrgAiEnabled`) — a super-admin master field on `Organization`, written only by a super-admin-gated Cloud Function, mirrored into `authStore`, and gated in `firestore.rules`. Default OFF, no data migration — the manual fallback makes an OFF org fully functional, not broken. There is no existing single Bible-fetch choke point today (fetching is split across `src/utils/esvApi.ts` and `src/utils/nltApi.ts`, with ESV/NLT version dispatch duplicated inline in `src/components/ScriptureInput.vue` and `src/components/CongregationalEditor.vue`) — this milestone introduces one (`src/utils/scriptureApi.ts`). The BibleGateway link builder already exists in `src/utils/scripture.ts` (`scriptureWebLink`/`nltLink`).

- [x] **Phase 101: Per-Org Bible API Toggle — Owner Console Infrastructure** - A super-admin controls Bible API access per organization from the Owner Console, with every org defaulting to OFF (completed 2026-08-31)
- [ ] **Phase 102: Gated Scripture Fetch Dispatcher** - A single client/server choke point enforces the per-org gate, with zero regression when the API is enabled
- [ ] **Phase 103: Manual Fallback When Bible API Is Off** - An OFF org gets a working BibleGateway deep-link + paste-in path, and Settings hides the Bible Translation selector

### Phase 101: Per-Org Bible API Toggle — Owner Console Infrastructure

**Goal**: A super-admin can enable or disable Bible API access per organization from the Owner Console, mirroring the proven per-org AI enablement pattern, with every org defaulting to OFF and no client able to flip the field directly.
**Depends on**: Nothing (first phase of v2.6)
**Requirements**: R295, R301
**Success Criteria** (what must be TRUE):

  1. A super-admin can enable/disable Bible API access for a specific organization from the Owner Console's Organizations tab (`OrgConfigDrawer`), persisted via a new super-admin-gated Cloud Function (`setOrgBibleEnabled`) that writes a master field on the `Organization` document (R295).
  2. `firestore.rules` denies any direct client write to that master field — only the Cloud Function can set it (R295).
  3. A newly onboarded org and every existing org (including Berean) start with Bible API disabled, with no data migration performed (R295).
  4. The Owner Console's Organizations list shows each org's current Bible API on/off state at a glance, mirroring the existing AI-enablement row/drawer treatment (R301).

**Plans**: 2/2 plans executed

- [x] 101-01-PLAN.md — Backend: Organization.bibleApiEnabled field + super-admin-gated setOrgBibleEnabled Cloud Function + listOrganizations echo + firestore.rules deny (R295, R301)
- [x] 101-02-PLAN.md — Frontend: authStore bibleApiEnabled/isBibleApiEnabled mirror + OrgConfigDrawer checkbox + OrganizationsTab onToggleBible + per-row at-a-glance state (R295, R301)

**UI hint**: yes

### Phase 102: Gated Scripture Fetch Dispatcher

**Goal**: Every ESV/NLT scripture fetch — client and server — passes through one per-org gate, so a disabled org makes zero proxy requests while an enabled org's experience is unchanged.
**Depends on**: Phase 101 (needs the org master field + `authStore` mirror to gate against)
**Requirements**: R296, R297
**Success Criteria** (what must be TRUE):

  1. When Bible API is enabled for an org, ESV/NLT passage preview and the LLM-assisted congregational-reading auto-fetch continue to work exactly as they do today, with no observable regression (R296).
  2. A new single dispatcher (`src/utils/scriptureApi.ts`, the `isAiEnabled()` analog) is the only path `ScriptureInput.vue` and `CongregationalEditor.vue` use to fetch passage text — neither calls `esvApi.ts`/`nltApi.ts` directly anymore (R297).
  3. When Bible API is disabled for an org, the app makes no ESV/NLT proxy request for that org, and scripture-text-dependent UI degrades gracefully rather than erroring (R297).
  4. The server `api` proxy's `esv` and `nlt` branches independently enforce the same per-org gate (defense-in-depth), rejecting a fetch for a disabled org even if a client bypassed the dispatcher (R297).

**Plans**: 1/2 plans executed

- [x] 102-01-PLAN.md — Client `scriptureApi.ts` dispatcher (single gated choke point) + route ScriptureInput.vue/CongregationalEditor.vue through it; enabled=passthrough (R296), disabled=graceful no-op (R297)
- [ ] 102-02-PLAN.md — Server defense-in-depth: `checkOrgBibleEnablement` mirroring `checkOrgAiEnablement`, applied to the esv/nlt proxy branches (R297)

### Phase 103: Manual Fallback When Bible API Is Off

**Goal**: An organization with Bible API disabled has a fully functional, zero-cost path for scripture selection and congregational readings — a BibleGateway deep-link plus manual paste-in — so being OFF never breaks the workflow.
**Depends on**: Phase 102 (the fallback UI is conditioned on the gate reporting OFF)
**Requirements**: R298, R299, R300
**Success Criteria** (what must be TRUE):

  1. When disabled, scripture selection and congregational-reading UI offer an "Open in BibleGateway" deep-link for the entered reference in the desired version — any version, not just ESV/NLT — reusing the existing link builder in `src/utils/scripture.ts` (R298).
  2. When disabled, a user can manually paste passage text into a scripture slide or congregational reading, and that pasted text becomes the slide/reading content, for any version (R299).
  3. The LLM congregational split continues to operate on manually pasted text when Bible API is off, still subject to the independent AI gate (R299).
  4. When disabled for an org, the "Bible Translation" selector is hidden in that org's Settings (`SettingsView.vue`), mirroring how the "AI Features" card hides when the AI master gate is off (R300).

**Plans**: TBD
**UI hint**: yes

## Backlog

### Phase 999.2: Rename app to WorshipBuilder + make worshipbuilder.web.app the primary URL (BACKLOG)

**Goal:** [Captured for future planning] Rename the app from "Worship Planner" (name taken) to **WorshipBuilder**, and cut hosting over to a single deploy on `worshipbuilder.web.app`, then point other/custom domains at it.
**Requirements:** TBD
**Plans:** 0 plans

Context (already done, 2026-08-30): the Firebase Hosting site `worshipbuilder` is **already created** in the existing project `worship-planner-bc515` — `https://worshipbuilder.web.app` is secured (second site, same project → same Firestore/Auth/Functions/data, no migration). It serves nothing yet. No time pressure; the name is locked.

Owner's stated plan: a **single** deploy to `worshipbuilder.web.app` (make it the one hosting target — NOT dual-site), then point other/custom domains to it.

Work this will cover when promoted:

- [ ] `firebase.json`: set the hosting block's target to the `worshipbuilder` site (`"site": "worshipbuilder"`) as the single deploy target (currently one unnamed block → default site).
- [ ] ⚠ PREREQUISITE: add `worshipbuilder.web.app` **and** `worshipbuilder.firebaseapp.com` to Firebase Auth → Settings → Authorized domains BEFORE cutover, or `signInWithPopup` (Google/email sign-in) silently fails on the new domain. Manual console step — no CLI command.
- [ ] Grep for any hardcoded base URL (e.g. `worship-planner-bc515.web.app`) in share-link generation etc. before cutover; relative / `window.location.origin` links carry over automatically, hardcoded ones do not.
- [ ] Rename user-facing app title strings "Worship Planner" → "WorshipBuilder".
- [ ] Production deploy to `worshipbuilder.web.app` (per-deploy owner confirmation per deploy policy).
- [ ] Later: point other/custom domains to the new site.
- [ ] TBD (promote with /gsd-review-backlog when ready)

> **Promoted 2026-08-31:** Phase 999.3 (Per-org Bible API toggle with BibleGateway manual fallback) was
> promoted into the active milestone **v2.6** (requirements R295–R301). See the v2.6 phases below.
