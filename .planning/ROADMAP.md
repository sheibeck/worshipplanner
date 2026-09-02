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
- ✅ **v2.6 — Per-Org Bible API Toggle & Manual Fallback** — Phases 101-103 (shipped & deployed to production 2026-08-31; a super-admin toggles the paid ESV/NLT Bible API on/off per church from the Owner Console — default OFF (each prod org enabled by hand, incl. Berean) — enforced by a single `scriptureApi.ts` client dispatcher + a server `checkOrgBibleEnablement` gate on the esv/nlt proxy branches; when OFF, scripture/congregational editors show an "Open in BibleGateway" look-up link (owner removed the paste box + off-state message before ship — plain scripture is reference-only, congregational composed in the existing reading textarea) and Settings hides the Bible Translation card — R295-R301; tag v2.6; audit PASSED 7/7 reqs + 5/5 seams; two code-review rounds caught a PC-export gate bypass + two fallback data-loss bugs; human/visual UAT deferred)
- ✅ **v2.7 — Rehearsal, Stage Plans & Presentation Polish** — Phases 104-107 (shipped & deployed to production 2026-09-01; inline black slide + audience-only "Go to black", system-wide dismissible notification store, per-item loop (relocated to the Slide editor, MISC/Announcement-only), user-menu church switcher, and a freeform visual **stage-layout** canvas redesigned to the owner's imported design — band-role instruments + person "Name - Role" + notes + "+ Vocal", stage-only landscape share `?view=stage` + dedicated landscape B&W "Print for tech", plus a live-diagnosed WYSIWYG fix (Tailwind v4 `translate`-vs-`transform` double-shift) and button-area polish (Run primary in the cluster, Present→"Review Slides", Save rightmost on Service Order + dropped from Slides, save-status into the header) — R302–R315; rehearsal attachments/Rehearse mode deferred to backlog 999.13; tag `v2.7`; audit PASSED 14/14 reqs + 6/6 seams; human/visual UAT owner-verified PASSED 2026-09-01 — see [milestones/v2.7-ROADMAP.md](milestones/v2.7-ROADMAP.md))

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

Full v2.6 details: [milestones/v2.6-ROADMAP.md](milestones/v2.6-ROADMAP.md) · requirements [milestones/v2.6-REQUIREMENTS.md](milestones/v2.6-REQUIREMENTS.md) · audit [v2.6-MILESTONE-AUDIT.md](v2.6-MILESTONE-AUDIT.md)

### 🚧 v2.7 Rehearsal, Stage Plans & Presentation Polish (Phases 104-107, in planning)

**Milestone Goal:** Give teams richer rehearsal and live-presentation tooling — an inline black slide,
audience-only blackout, system-wide dismissible messages, per-item slide looping, a user-menu church
switcher, and a freeform visual stage-layout canvas per service — plus targeted Run-the-Service and
multi-church usability fixes.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R302–R315 (14 mapped, 100% coverage)

**Deferred out of v2.7 (owner decision 2026-08-31):** song rehearsal attachments (PDF/MP3/YouTube on a
Song) and Rehearse mode on the shared service link — the storage/public-media cluster (highest
security/cost surface researched this milestone). Carried to backlog 999.13; full research preserved in
`seeds/SEED-003-rehearsal-attachments-and-storage-costs.md`.

**Flagged at roadmap time:**

- Phase 107 (Visual Stage Layout) is this app's first freeform-drag surface — v1.4/v1.6 both shipped
  drag-and-drop corruption bugs and there is no existing pattern to port. Needs a dedicated UI-spec/
  research pass at plan time (drag math, zone boundaries, marker interaction), not a straight port.

- Phase 106 (Per-Item Loop Playback) must explicitly decide and test whether "Go to black" pauses an
  active loop — call this out at plan time rather than leaving it an accident of implementation order.

- [ ] **Phase 104: Notification & Multi-Church Foundations** - Generalize the toast store into a system-wide dismissible-message system and let multi-org members switch active church from the user menu
- [ ] **Phase 105: Presentation Blackout & Inline Black Slide** - Insert a black interlude slide in the lyric editor and scope "Go to black" to the Audience output only
- [ ] **Phase 106: Per-Item Loop Playback** - A per-item loop checkbox with a configurable interval auto-advances and loops a service item's slides during Run
- [ ] **Phase 107: Visual Stage Layout** - A freeform drag-and-drop stage plot per service, with on-stage/off-stage zones and free-text-labeled markers

### Phase 104: Notification & Multi-Church Foundations

**Goal**: Every warning/error/info message in the app can be dismissed and stops reappearing once its
underlying condition resolves, and a multi-org member can switch their active church from the top-bar
user menu without signing out.
**Depends on**: Nothing (first phase of v2.7)
**Requirements**: R309, R310, R311, R312
**Success Criteria** (what must be TRUE):

  1. Every warning/error/info message surfaced anywhere in the app has a working manual-dismiss control, through one shared notification system (R309).
  2. The Run screen's "monitors not configured" warning disappears automatically once monitors are configured, with no manual dismiss required for it to clear (R310).
  3. A user belonging to multiple churches can open the top-bar user menu, see each church with their role in it, and switch active church without signing out — distinct from the super-admin "enter any church" path (R311).
  4. After switching churches, every org-scoped store/view reflects only the newly selected church's data and the user's role there — no stale data from the previous church survives the switch (R312).

**Plans**: 2/2 plans executed

Plans:

- [x] 104-01-PLAN.md — Generalize the toast store into the system-wide dismissible-message system (severities, manual dismiss on every message, keyed sticky lifetime), relocate the host to App.vue root, and migrate the stuck Run/Monitor warnings onto it (R309, R310) [wave 1]
- [x] 104-02-PLAN.md — Sidebar user-menu church switcher for multi-org members (role badges, reuse selectOrg + resetOrgScopedStores, distinct from super-admin enter-any-church, dogfood the notification store) (R311, R312) [wave 2]

**UI hint**: yes

### Phase 105: Presentation Blackout & Inline Black Slide

**Goal**: A presenter can insert a genuine black interlude slide into a song's slide sequence, and
"Go to black" during Run no longer blinds the band's confidence monitor.
**Depends on**: Phase 104 (touches the same Run-flow banner/messaging surfaces the new notification store generalizes)
**Requirements**: R302, R303, R304, R305
**Success Criteria** (what must be TRUE):

  1. From the Song Lyrics editor, a user can insert a black (blackout) slide between existing lyric slides without creating a new blank service section (R302).
  2. The black slide renders as a full black screen — no lyrics, background image, or organizational labels — on the Audience output, Confidence monitor, in-app preview, and print/export, and participates in normal next/prev slide navigation (R303).
  3. Adding, moving, duplicating, or deleting a black slide leaves song section numbering, the split-section-as-one-unit behavior, and the slide↔service-order mirroring intact (R304).
  4. Pressing "Go to black" during Run blacks out only the Audience output; the Confidence monitor keeps showing the current/upcoming slide the entire time (R305).

**Plans**: 3/3 plans executed

Plans:

- [x] 105-01-PLAN.md — Blackout data model (LyricSection.kind + BlackoutSlide) + assembler resolution + section-numbering integrity (R302, R303, R304) [wave 1]
- [x] 105-02-PLAN.md — SlideCanvas solid-black render + lyric-editor "Insert black slide" affordance + Slides-tab card preview (R302, R303, R304) [wave 2]
- [x] 105-03-PLAN.md — "Go to black" scoped to the Audience output only (Confidence suppression, no wire-protocol change) (R305) [wave 1]

**UI hint**: yes

### Phase 106: Per-Item Loop Playback

**Goal**: An operator can mark any service item to auto-advance and loop its own slides during Run,
with predictable, leak-free start/stop behavior.
**Depends on**: Phase 105 (loop verification exercises an item containing the new black slide; shares Run-flow/`useRunControl.ts` code paths Phase 105 already touches)
**Requirements**: R306, R307, R308
**Success Criteria** (what must be TRUE):

  1. A user can check a per-item "loop" box in the service editor and the item's slides auto-advance and loop back to the item's first slide once the last is reached during Run (R306).
  2. The loop interval defaults to 10 seconds and is changeable via a preset dropdown or a custom value, and the chosen interval persists with the item (R307).
  3. Navigating to a different item, leaving the Run screen, or manually clicking a slide stops/resets the loop timer cleanly, with no leaked timer continuing to fire and no control↔output desync (R308).
  4. The plan explicitly decides and implements whether "Go to black" pauses an active loop, and that behavior is verified in a real output window, not just the control screen (R308).

**Plans**: 2/2 plans executed

Plans:

- [x] 106-01-PLAN.md — Per-item loop config model (additive `MediaAttachableSlot.loop`) + Service Order authoring UI (Loop checkbox + interval preset/custom, persisted, clamped) (R306, R307) [wave 1]
- [x] 106-02-PLAN.md — Run-time loop timer (single `useLoopTimer` through `postIndex`) + wrap-to-first + Go-to-black PAUSE/resume + clean teardown, with output-window tests and a real-hardware checkpoint (R306, R308) [wave 2]

**UI hint**: yes

### Phase 107: Visual Stage Layout

**Goal**: Tech/sound can see, at a glance, where every instrument, mic, and monitor goes for a given
service via a freeform visual stage plot.
**Depends on**: Phase 104 (resolves the `STAGELAYOUTS-RESET-OBLIGATION` marker Phase 104 left in `resetOrgScopedStores()`). Per 107-CONTEXT.md the layout is an additive optional field on the SERVICE document — NO new `stageLayouts` collection/store/rules — so R312 is satisfied by the already-reset services store and the marker is turned into a resolved note.
**Requirements**: R313, R314, R315
**Success Criteria** (what must be TRUE):

  1. On a service's dedicated Stage Layout tab, a user can drag labeled markers (instruments, mics, monitors) onto a freeform canvas, placing them into an on-stage or an off-stage (side) zone (R313).
  2. A user can give a marker a free-text label, including one for a one-off speaker's microphone, and position it anywhere within a zone (R314).
  3. Marker positions round-trip correctly on reload and stay stable across a viewport resize (R314).
  4. The stage layout is saved per service to Firestore (no file storage) and is viewable read-only wherever that service is shared or printed (R315).

**Plans**: 2/3 plans executed

Plans:

- [x] 107-01-PLAN.md — Data model (additive `Service.stageLayout` + `StageMarker`), pure drag/geometry helpers, shared read-only `StageLayoutView`, and resolve the Phase-104 `STAGELAYOUTS-RESET-OBLIGATION` marker [wave 1]
- [x] 107-02-PLAN.md — `StageLayoutEditor` freeform Pointer-Events drag canvas (two zones, add/label/kind/move/delete, aria-labels, touch) + the editor's Stage Layout tab, draft/lock-gated, riding the existing autosave [wave 2]
- [x] 107-03-PLAN.md — Denormalize `stageLayout` into the frozen `ServiceSnapshot` and render it read-only on the public ShareView + print (reusing `StageLayoutView`, no new public rules) [wave 2]

**UI hint**: yes
**Research flag**: this app's first freeform-drag surface (v1.4 phantom duplicates, v1.6 drag-into-section
bugs are the prior history) — flag for a dedicated UI-spec/research pass at plan time rather than a
straight port of an existing pattern.

### 🚧 v2.8 Production Hardening: Comments-as-Specs, Architecture & Security Review (Phases 108-113, in planning)

**Milestone Goal:** Prepare the app for real-world use (it can impact real people if it has issues) by
extracting load-bearing comments into GSD's durable stores, then running architectural and security
reviews and remediating the Critical/High findings.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R316–R323 (8 mapped, 100% coverage)

**Key context:** Reviews produce reports AND fix Critical/High in-milestone; Medium/Low findings are
triaged to backlog, not fixed here. No research pass (internal hardening; security best-practice is
applied during the review itself). Build/commit only — any production deploy of remediation (esp.
rules/functions) is a separate, explicitly owner-confirmed step per standing deploy policy. Numbering
continues from v2.7, which ended at Phase 107 — v2.8 starts at Phase 108, not reset.

**Phase count rationale:** the milestone framing requires review and remediation to be SEPARATE phases
per review track (architectural, security) — the fixes aren't knowable until each review report exists —
which alone accounts for 4 of the 6 phases. The comments-as-specs sweep splits into the two extraction
phases the milestone calls for: R316's audit + R317's rationale relocation share one delivery boundary
(both act on the same decision-rationale bucket of the audit's classification, landing in ADRs under
`docs/adr/`), and R318+R319 share a second (the behavioral/architectural bucket, landing in
`.planning/codebase/` map docs, plus writing the resulting convention down) — rather than a third,
standalone audit-only phase, since R316 alone is thin/task-like and naturally sequences as the first step
inside Phase 108's own plan.

- [x] **Phase 108: Comment Audit & Decision-Rationale Extraction** - Inventory and classify every load-bearing comment, then relocate decision-rationale (R-/WR-/CR-/Pitfall) comments into ADRs with the source comment shrunk to a pointer (completed 2026-09-01)
- [x] **Phase 109: Behavioral/Architectural Extraction & Comment Convention** - Relocate "how this works" comments into `.planning/codebase/` map docs and document the go-forward comment convention (completed 2026-09-02)
- [x] **Phase 110: Architectural Review** - Severity-ranked report on module boundaries, store/Firestore-listener lifecycle, multi-tenant isolation architecture, data flow, and coupling (completed 2026-09-02)
- [x] **Phase 111: Architectural Remediation** - Fix or explicitly defer every Critical/High architectural finding; triage Medium/Low to backlog (completed 2026-09-02)
- [x] **Phase 112: Security Review** - Severity-ranked report on Firestore/Storage rules, auth/claims + route guards, tenant isolation, Cloud Functions authorization, share-token/PII exposure, and cost/abuse controls (completed 2026-09-02)
- [ ] **Phase 113: Security Remediation** - Fix or explicitly defer every Critical/High security finding; triage Medium/Low to backlog

### Phase 108: Comment Audit & Decision-Rationale Extraction

**Goal**: The codebase's load-bearing comments are inventoried and classified, and every decision-rationale
("why we did it this way") comment is relocated into an ADR under `docs/adr/`, with the source comment
reduced to a short pointer.
**Depends on**: Nothing (first phase of v2.8; v2.7 ended at Phase 107)
**Requirements**: R316, R317
**Success Criteria** (what must be TRUE):

  1. A written triage inventory exists enumerating every load-bearing comment found across the codebase, each classified as decision-rationale, behavioral/architectural, or genuinely-local, with file/line references (R316).
  2. Every comment classified decision-rationale (the `R-`/`WR-`/`CR-`/`Pitfall`-tagged "why" notes) has a corresponding ADR under `docs/adr/` capturing that rationale, and the original source comment is reduced to a short pointer (e.g. the ADR id) instead of carrying the rationale itself (R317).
  3. The behavioral/architectural subset of the Phase 108 inventory is handed off complete and unambiguous for Phase 109 — nothing dropped, nothing double-classified (R316).
  4. `npm run type-check` and the full test suite pass unchanged after the comment-only edits — no behavior change results from relocating comments (R317).

**Plans**: 2/2 plans executed
**Wave 1**

- [x] 108-01-PLAN.md — Comment audit & triage inventory: grep-first enumeration + three-bucket classification of every load-bearing comment across src/**, functions/src/**, render-service/src/**, and the rules files, with a Phase 109 handoff section (R316)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 108-02-PLAN.md — Decision-rationale ADR extraction: author MADR-lite ADRs under docs/adr/ (grouped by decision), shrink source comments to pointers, and prove type-check + full test suite unchanged (R317)

### Phase 109: Behavioral/Architectural Extraction & Comment Convention

**Goal**: Every behavioral/architectural "how this works" comment is relocated into `.planning/codebase/`
map docs, source comments shrink to what the code alone cannot convey, and a written convention keeps
future comments short.
**Depends on**: Phase 108 (consumes its behavioral/architectural inventory subset)
**Requirements**: R318, R319
**Success Criteria** (what must be TRUE):

  1. Every comment classified behavioral/architectural in Phase 108's inventory has its "how it works" content relocated into the relevant `.planning/codebase/` map doc (an updated existing doc or a new one), with the source comment reduced to what the code alone cannot convey (R318).
  2. A written comment-convention document exists stating that comments stay short and ADRs/`.planning/codebase/` docs bear the load of rationale and behavior, discoverable for future work (R319).
  3. A spot-check across the affected files shows no paragraph-length inline "how it works" narration remaining where a map doc now covers it (R318).
  4. `npm run type-check` and the full test suite pass unchanged — comment-only changes (R318).

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 109-01-PLAN.md — Comment convention (R319): "## Comment Convention" section in `.planning/codebase/CONVENTIONS.md` + one-line CLAUDE.md pointer [wave 1]
- [x] 109-02-PLAN.md — R318 backend sweep: relocate + shrink `functions/src/**` + `firestore.rules` + `storage.rules` Bucket B comments into the map docs [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 109-03-PLAN.md — R318 utils sweep: relocate + shrink `src/utils/**` Bucket B comments into the map docs [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 109-04-PLAN.md — R318 components/composables sweep: relocate + shrink `src/components/**` + `src/composables/**` Bucket B comments [wave 3]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 109-05-PLAN.md — R318 stores/types/views sweep + phase-wide 309 reconciliation: relocate + shrink `src/stores/**`, `src/types/**`, `src/config/**`, `src/firebase/index.ts`, `src/main.ts`, `src/views/**` [wave 4]

**Cross-cutting constraints:**

- The comment-only edits change no behavior: type-check passes and the app test suite shows no NEW failures versus the pre-edit baseline (R318).

### Phase 110: Architectural Review

**Goal**: A severity-ranked architectural review report exists, covering module boundaries, store/
Firestore-listener lifecycle (incl. org-scoped teardown/re-subscription), multi-tenant (org) isolation
architecture, data flow, and coupling.
**Depends on**: Phase 109 (reviews the codebase after its load-bearing comments/docs have been relocated, so findings reference the current source of truth)
**Requirements**: R320
**Success Criteria** (what must be TRUE):

  1. A written report enumerates findings across module boundaries, store/Firestore-listener lifecycle (incl. org-scoped teardown/re-subscription), multi-tenant (org) isolation architecture, data flow, and coupling (R320).
  2. Every finding carries an explicit severity (Critical/High/Medium/Low) and a concrete file/module location or example (R320).
  3. Critical/High findings are clearly distinguished from Medium/Low, giving Phase 111 an unambiguous remediation scope and the rest a clean path to backlog (R320).

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 110-01-PLAN.md — Review pass: store/Firestore-listener lifecycle (incl. org-scoped teardown/re-subscription) + multi-tenant isolation architecture → 110-FINDINGS-lifecycle-isolation.md
- [x] 110-02-PLAN.md — Review pass: module boundaries + coupling + data flow → 110-FINDINGS-boundaries-coupling-dataflow.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 110-03-PLAN.md — Consolidate & severity-rank all findings → 110-ARCHITECTURE-REVIEW.md (Critical/High → Phase 111; Medium/Low → backlog)

**Cross-cutting constraints:**

- No files under src/, functions/, firestore.rules, or storage.rules are modified by this plan

### Phase 111: Architectural Remediation

**Goal**: Every Critical/High architectural finding from Phase 110 is fixed, or explicitly deferred to
backlog with recorded rationale.
**Depends on**: Phase 110
**Requirements**: R321
**Success Criteria** (what must be TRUE):

  1. Every Critical/High finding from the Phase 110 report has either a shipped code fix (built, tested, committed) or an explicit backlog entry recording why it was deferred (R321).
  2. Medium/Low findings from Phase 110 are triaged into the backlog — not silently dropped, not fixed in-milestone (R321).
  3. `npm run type-check` and the full test/regression suite pass after remediation, with no new regressions introduced by the fixes (R321).
  4. No production deploy occurs as part of this phase — remediation ships built, tested, and committed only, per the milestone's build/commit-only constraint (R321).

**Plans**: 2/2 plans executed

Plans:
**Wave 1**

- [x] 111-01-PLAN.md — ARCH-001 code fix: store-layer generation/epoch guard on the `memberUnsub` `onSnapshot` assignment in `src/stores/auth.ts` `loadOrgContext` + UI in-flight guard on `AppShell.vue`'s exit button + regression test; no-regression gate (type-check + app-suite baseline + render-service) (R321) [wave 1]
- [x] 111-02-PLAN.md — Medium/Low triage: ONE consolidated `## Backlog` entry in `ROADMAP.md` for ARCH-002..023 referencing `110-ARCHITECTURE-REVIEW.md` (no stubs, none fixed) (R321) [wave 1]

**Cross-cutting constraints:**

- Build/commit only — NO production deploy (ARCH-001 is client-only; no rules/functions/storage changed).
- `npm run type-check` clean + bare `npx vitest run` at documented baseline (only `src/storage.rules.test.ts` failing) + `render-service` 39/39; no new regressions.

### Phase 112: Security Review

**Goal**: A severity-ranked security review report exists, covering Firestore & Storage security rules,
auth/custom-claims and route guards, multi-tenant data isolation, Cloud Functions authorization,
share-token/public-page exposure and PII handling, and cost/abuse controls.
**Depends on**: Phase 111 (sequenced after the architecture review/remediation pass; touches overlapping auth/lifecycle surfaces the architecture work may have just changed)
**Requirements**: R322
**Success Criteria** (what must be TRUE):

  1. A written report enumerates findings across Firestore & Storage security rules, auth/custom-claims and route guards, multi-tenant data isolation, Cloud Functions authorization, share-token/public-page exposure and PII handling, and cost/abuse controls (R322).
  2. Every finding carries an explicit severity and a concrete location (rule path, function name, route, or code reference) (R322).
  3. Critical/High findings are clearly distinguished from Medium/Low, giving Phase 113 an unambiguous remediation scope (R322).

**Plans**: 4/4 plans executed
**Wave 1**

- [x] 112-01-PLAN.md — Firestore & Storage rules + multi-tenant isolation review (runs the live rules suite) → 112-FINDINGS-rules-isolation.md
- [x] 112-02-PLAN.md — auth/custom-claims + route guards + Cloud Functions authorization review (incl. ARCH-005, ARCH-018) → 112-FINDINGS-auth-functions.md
- [x] 112-03-PLAN.md — share-token/public-page exposure + PII + cost/abuse controls review → 112-FINDINGS-sharetoken-pii-abuse.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 112-04-PLAN.md — consolidate all findings into the ranked 112-SECURITY-REVIEW.md (C/High → Phase 113, M/Low → backlog)

**Cross-cutting constraints:**

- No files under src/, functions/, firestore.rules, or storage.rules were modified; no deploy occurred.

### Phase 113: Security Remediation

**Goal**: Every Critical/High security finding from Phase 112 is fixed, or explicitly deferred to backlog
with recorded rationale.
**Depends on**: Phase 112
**Requirements**: R323
**Success Criteria** (what must be TRUE):

  1. Every Critical/High finding from the Phase 112 report has either a shipped fix (built, tested, committed) or an explicit backlog entry recording why it was deferred (R323).
  2. Medium/Low findings are triaged into the backlog (R323).
  3. Any Firestore/Storage rules or Cloud Functions authorization change carries a real ALLOW-case emulator test proving the fix — not only a deny-case pass — per this project's standing rules-testing discipline (R323).
  4. `npm run type-check` and the full test/regression suite pass, and no production deploy occurs — remediation ships built/tested/committed/UNDEPLOYED, with the exact deploy command handed to the owner per standing deploy policy (R323).

**Plans**: 3/3 plans executed

- [x] 113-01-PLAN.md — SEC-S-01 (get/list split on shareTokens/quarterShares/serviceShares) + SEC-ISO-01 (remove legacy client org self-provisioning) in firestore.rules + src/rules.test.ts (DENY + ALLOW cases)
- [x] 113-02-PLAN.md — SEC-ISO-02 (revokeRefreshTokens on member-removal clear branch) in functions/src/orgMembershipClaims.ts + unit test; Storage ALLOW-case test authored
- [x] 113-03-PLAN.md — consolidated 999.x backlog entry for the 11 Medium/Low security findings (ROADMAP-only triage)

**Cross-cutting constraints:**

- No firebase deploy or gcloud command is run by this plan

## Backlog

### Phase 999.5: v2.8 Security Review — Medium/Low findings (11) (BACKLOG)

**Goal:** [Captured for future planning] Consolidates all 11 Medium/Low security findings
(5 Medium, 6 Low) deferred from Phase 113 remediation, per 113-CONTEXT.md's locked triage decision
("ONE consolidated backlog entry", not 11 near-empty stubs).
**Requirements:** TBD
**Plans:** 0 plans

Source: `.planning/phases/112-security-review/112-SECURITY-REVIEW.md`'s `## Medium/Low (→ backlog)`
section carries the full per-finding detail — location, behavior, impact, and suggested remediation
direction for each. This entry does not duplicate that detail; it is the durable backlog pointer to
it, so nothing found by the Phase 112 review is silently dropped.

- **5 Medium:** **SEC-A-01** — `/api/planningcenter` proxy route has zero authentication (unauthenticated
  open-relay/DoS risk on a shared concurrency pool; **highest-priority Medium, worth early attention**).
  **ARCH-018** — super-admin's unconditional `isOrgEditor` disjunct grants universal editor-tier write on
  every org's `members/{uid}` (folds in `SEC-ISO-04`). **SEC-R-03** — `services/{docId}` draft-edit branch
  has no field-diff restriction, permitting `createdBy`/provenance-field forgery. **SEC-S-02** —
  memorable-URL share ids (`{slug}__service-{date}`, `{slug}__q{Q}-{Y}`) are deterministic and guessable.
  **SEC-C-01** — ESV/NLT Bible-API proxy branches are not covered by the per-uid rate limiter that guards
  `anthropic`.

- **6 Low:** **SEC-ISO-05** — org role `'admin'` is functionally identical to `'editor'` everywhere
  checked today (self-escalation possible but currently grants nothing extra). **SEC-ISO-06 (residual)**
  — `orgSlugs`/`orgNames` use the same unsplit `allow read: if true` as `SEC-S-01`'s three collections and
  are therefore also fully listable. **SEC-S-03** — share links never expire or rotate (deliberate product
  design, recorded for completeness). **SEC-S-04** — free-text `notes`/slot-body fields render verbatim on
  the public share page with no PII filter. **SEC-C-05** — `queueServiceMessage` has no per-uid/per-org
  enqueue-rate limit of its own. **SEC-C-06** — `parsePptx` has no per-uid/per-org daily import quota.

Promote with `/gsd-review-backlog` when ready.

### Phase 999.4: v2.8 Architectural Review — Medium/Low findings (ARCH-002..023) (BACKLOG)

**Goal:** [Captured for future planning] Consolidates all 22 Medium/Low architectural findings
(ARCH-002 through ARCH-023) deferred from Phase 111 remediation, per 111-CONTEXT.md's locked triage
decision ("ONE consolidated backlog entry", not 22 near-empty stubs).
**Requirements:** TBD
**Plans:** 0 plans

Source: `.planning/phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md`'s `## Medium/Low (→
backlog)` section (lines 114-714) carries the full per-finding detail — location, problem, impact, and
recommendation for each. This entry does not duplicate that detail; it is the durable backlog pointer to
it, so nothing found by the Phase 110 review is silently dropped.

- **13 Medium** (ARCH-002 through ARCH-014): org-switch teardown drift (ARCH-002), static-prop
  subscriptions that don't re-subscribe on org change (ARCH-003), a single-driver listener pool flagged
  fragile for a future second caller (ARCH-004), `ServiceEditorView.vue`'s continued monolith growth
  (ARCH-006), a component bypassing the store-as-source-of-truth write pattern (ARCH-007), two
  view-owned `onSnapshot` calls with no owning store (ARCH-008), a duplicated/drifted Firestore query
  between a composable and its store (ARCH-009), `functions/src/index.ts`'s god-module shape (ARCH-010),
  a per-item update loop with no per-item error isolation (ARCH-011), unreachable dead code from a
  deep-clone Timestamp strip (ARCH-012), an autosave/reorder-save coordination gap (ARCH-013), and an
  unbatched sequential PCO song-import write path (ARCH-014).

- **9 Low** (ARCH-015 through ARCH-023): mostly confirmed-correct/no-new-finding verification notes plus
  one utility-layer dependency-direction nit (ARCH-020).

- **Phase 112 security handoffs (already carried forward there, listed here only for traceability):**
  **ARCH-005** — org-provisioning Cloud Functions are built/tested but UNDEPLOYED, so isolation cannot be
  verified against live production state until deployed; and **ARCH-018** — super-admin's `isOrgEditor`
  grant is universal by rule design, so the no-membership-doc guarantee on super-admin org entry (R226)
  holds only as a client-code contract, not a Firestore-rules invariant (already reviewed/accepted at
  Phase 78, T-78-03). Both are Phase 112's scoping decision, not this backlog entry's.

Promote with `/gsd-review-backlog` when ready.

### Phase 999.3: Monitor Setup — route one signal to multiple monitors; no signal mandatory (BACKLOG)

**Goal:** [Captured for future planning] In Monitor Setup (Run the Service, v2.4), let a user send the
**same signal to multiple monitors** and never force assigning every signal.
**Requirements:** TBD
**Plans:** 0 plans

Reported by owner 2026-09-02. Current behavior (defect): signal→monitor assignment is treated as
1:1/exclusive — with 2 monitors, assigning **Audience** to Monitor A and then to Monitor B
*un-assigns* it from Monitor A. Desired behavior:

- [ ] One signal (Audience / Confidence / Livestream / etc.) can be routed to **multiple monitors**
  simultaneously (e.g. Audience mirrored to both Monitor A and Monitor B).

- [ ] Assigning a signal to a monitor must **not** steal it from another monitor.
- [ ] **No signal is mandatory** — if the user only wants Audience, they should not be required to
  assign Confidence, Livestream, or any other output.

- [ ] Verify the audience/confidence output windows + `useRunControl` channel routing handle a
  one-signal→many-monitors fan-out (BroadcastChannel/window management) without desync.

Area: `src/views/MonitorSetupView.vue` + monitor config/channel utilities (Phase 91 config+channel
utilities, Phase 92 Monitor Configuration screen). Promote with `/gsd-review-backlog` when ready.

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
