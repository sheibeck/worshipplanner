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
- ✅ **v2.8 — Production Hardening (Comments-as-Specs, Architecture & Security Review)** — Phases 108-113 (shipped & deployed to production 2026-09-02; 244 ADRs (docs/adr/) + 309 behavioral comments relocated to .planning/codebase/ + a written comment convention; architectural review + remediation (ARCH-001 loadOrgContext re-entrancy/listener-leak race); security review + remediation — fixed a proven LIVE cross-tenant data leak (SEC-S-01: shareTokens/quarterShares/serviceShares were publicly listable) + legacy client-side org self-provisioning (SEC-ISO-01) + member-removal refresh-token revocation (SEC-ISO-02); Medium/Low triaged to backlog 999.4/999.5; the code-review chain caught 3 blockers pre-ship; audit PASSED 8/8 reqs + 6/6 integration WIRED — see [milestones/v2.8-ROADMAP.md](milestones/v2.8-ROADMAP.md))
- ✅ **v2.9 — Live Presentation Field Fixes** — Phases 114-116 (shipped & deployed to production 2026-09-04; field fixes from the first real church-projector run — multi-monitor assignment rework (any-role-to-any-monitor, v2 fingerprint, nicknames — R324-R328/R338), live-output readability (measure-and-fit auto-fit engine: per-slide shrink-to-fit within an inset safe-area, lyric lines never wrap mid-line, symmetric margins; Run-screen readability — bigger filmstrip thumbs + next-item end cap + left-most auto-scroll + macOS scrollbar — R329-R332), and lyric-editor/song UX (new-tab edit link, clickable title→SongSelect, Cancel→Close, inline credits editing, hidden History — R333-R337); client-side only; audit PASSED 15/15 reqs + integration WIRED; owner-verified live on audience+confidence; tag v2.9 — see [milestones/v2.9-ROADMAP.md](milestones/v2.9-ROADMAP.md))
- ✅ **v2.10 — Security & Architecture Hardening** — Phases 117-120 (shipped & deployed to production 2026-09-05; remediated all 22 Medium/Low findings deferred from v2.8's security (backlog 999.5) + architectural (backlog 999.4) reviews — SEC-A-01 unauthenticated `/api/planningcenter` proxy closed, rules/share-PII hardening, store-ownership + god-module decomposition; audit PASSED 22/22 + integration WIRED; a same-day post-deploy subscription-teardown-race hotfix was owner-verified live — R339-R360; see [milestones/v2.10-ROADMAP.md](milestones/v2.10-ROADMAP.md))
- ✅ **v2.11 — Song File Attachments** — Phases 121-124 (shipped & deployed to production 2026-09-05; step 1 of the file-storage backlog 999.13/SEED-003 — editors attach/manage PDF+MP3 files (≤50MB) + external YouTube/Drive/Dropbox links on a **Song** via a new **Files** tab: multi-file upload w/ progress, Documents/Audio grouping, in-app PDF preview + MP3 player, download, remove; a permanent org-scoped Storage prefix outside `media/` proven exempt from every retention sweep + an editor-only rules gate (isOrgEditor + PDF/MP3/50MB); R361-R373; audit PASSED 13/13 + 6/6 integration seams WIRED; owner-verified local UAT; `storage.rules`+hosting deployed; see [milestones/v2.11-ROADMAP.md](milestones/v2.11-ROADMAP.md))
- ✅ **v2.12 — Rehearse Mode** — Phases 125-127 (shipped & deployed to production 2026-09-06; passwordless magic-link volunteer access with scoped read-only isolation, "My Schedule" volunteer home listing every Planned service a volunteer is assigned to, and a standalone read-only Volunteer Service View — Rehearse (song list/detail, PDF reader, audio player with speed + whole-track loop) plus read-only Order of Service and Stage Layout tabs, reached only from a My Schedule card — R374-R393; step 2/final of the file-storage backlog 999.13/SEED-003)
- ✅ **v2.13 — Volunteer Self-Service & Multi-Church Access** — Phases 128-130 (shipped & deployed to production 2026-09-07; public self-service magic-link request page + a shared server-side mint/send core, admin email/copy resend from the Volunteers page reusing that core, and a multi-church volunteer switcher on My Schedule via an `orgName` added to the rehearseAccess projection — R394-R405; see [milestones/v2.13-ROADMAP.md](milestones/v2.13-ROADMAP.md))

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

<details>
<summary>✅ v2.8 Production Hardening: Comments-as-Specs, Architecture & Security Review (Phases 108-113) — SHIPPED 2026-09-02</summary>

- [x] Phase 108: Comment Audit & Decision-Rationale Extraction
- [x] Phase 109: Behavioral/Architectural Extraction & Comment Convention
- [x] Phase 110: Architectural Review
- [x] Phase 111: Architectural Remediation
- [x] Phase 112: Security Review
- [x] Phase 113: Security Remediation

Full details: [milestones/v2.8-ROADMAP.md](milestones/v2.8-ROADMAP.md) · requirements [milestones/v2.8-REQUIREMENTS.md](milestones/v2.8-REQUIREMENTS.md) · audit [milestones/v2.8-MILESTONE-AUDIT.md](milestones/v2.8-MILESTONE-AUDIT.md) · phase artifacts in `milestones/v2.8-phases/`

> **Deployed to production 2026-09-02** (hosting + firestore:rules + functions:syncOrgMembershipClaim). Audit PASSED (8/8 requirements, 6/6 phases, 6/6 integration seams WIRED). Comments-as-specs: 696 load-bearing comments inventoried → 244 MADR-lite ADRs (docs/adr/) for decision-rationale + 309 behavioral comments relocated into .planning/codebase/ maps, source comments shrunk to pointers, comment convention written (R316–R319). Architectural review (R320) → the sole High (ARCH-001 loadOrgContext epoch/listener-leak race) fixed (R321); 22 Medium/Low → backlog 999.4. Security review (R322) found a **proven, live, production cross-tenant data leak** — SEC-S-01: shareTokens/quarterShares/serviceShares were publicly *listable* (unauthenticated enumeration of every church's shared plans + volunteer names) — fixed (get/list split + org-gated list + org-scoped client queries) along with SEC-ISO-01 (legacy client org self-provisioning) and SEC-ISO-02 (revokeRefreshTokens on member removal); 11 Medium/Low → backlog 999.5 (R323). The adversarial code-review chain caught 3 blockers before ship (an incomplete epoch guard in 111; and in 113 the rules fix's two regressions — broken share-token cleanup and broken share-link creation). Owner-authorized coordinated prod deploy.
</details>

<details>
<summary>✅ v2.10 Security & Architecture Hardening (Phases 117-120) — SHIPPED & DEPLOYED 2026-09-05</summary>

- [x] Phase 117: Security — Proxy Authentication, Rate Limits & Quotas
- [x] Phase 118: Security — Firestore Rules & Public Share Hardening
- [x] Phase 119: Architecture — Correctness, Batching & Store-Ownership Fixes
- [x] Phase 120: Architecture — God-Module Decomposition

Full details: [milestones/v2.10-ROADMAP.md](milestones/v2.10-ROADMAP.md) · requirements [milestones/v2.10-REQUIREMENTS.md](milestones/v2.10-REQUIREMENTS.md) · audit [milestones/v2.10-MILESTONE-AUDIT.md](milestones/v2.10-MILESTONE-AUDIT.md) · phase artifacts in `milestones/v2.10-phases/`

> **Deployed to production 2026-09-05** (coordinated firestore:rules + functions + hosting). Remediated all 22 actionable Medium/Low findings deferred from v2.8's security (backlog 999.5) + architectural (backlog 999.4) reviews — SEC-A-01 unauthenticated `/api/planningcenter` proxy closed (fail-closed 401), esv/nlt rate-limited, queue/pptx quotas (117); firestore.rules draft-provenance + orgSlugs/orgNames enumeration fixes + public-share PII allowlist incl. a stray anonymous stage-note leak caught in review (118); 9 correctness/store-ownership fixes (119); god-module decomposition — useAiSongSuggestions + cleanupSweeps, re-export trap guarded (120). R342/R347/R348/SEC-S-03 documented as accepted residuals. Audit PASSED (22/22 reqs, 4/4 phases, integration WIRED). **Post-deploy hotfix (same day, owner-verified live):** a subscription-teardown race — per-view onUnmounted tearing down shared org-scoped singleton stores, wiping data on navigation/church-switch — root-caused + fixed (commits c336c306/b38bc933; teardown of org-scoped stores belongs solely to resetOrgScopedStores()).
</details>

### ✅ v2.11 Song File Attachments — SHIPPED & DEPLOYED 2026-09-05 (Phases 121-124) — R361-R373, audit PASSED 13/13. Full detail archived: [milestones/v2.11-ROADMAP.md](milestones/v2.11-ROADMAP.md)

### ✅ v2.12 Rehearse Mode (Phases 125-127) — SHIPPED & DEPLOYED 2026-09-06

**Milestone Goal:** Give worship volunteers a low-friction, passwordless way to rehearse the services
they're serving — view/print sheet music & chords and play/practice reference recordings — without
tracking a new username/password and without exposing media publicly. Step 2 (the final step) of the
file-storage backlog (999.13 / SEED-003); step 1 (song attachments) shipped as v2.11.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R374–R393 (20 mapped, 100% coverage)

**Key context:** Access = passwordless magic link (Firebase `signInWithEmailLink`) tied to a volunteer's
roster email, delivered through the existing v1.7 volunteer-messaging emails — not public, not full
accounts. Landing = "My Schedule" (volunteer home) listing every service a volunteer is assigned to,
showing only Planned (locked, non-Draft) services. Rehearse is a STANDALONE screen reached only from a My
Schedule card — not a tab in the planner's service editor. Media = the v2.11 song attachments, reused —
nothing is re-uploaded. Playback speed + whole-track loop are included; server-side transposition and
loop-a-section are not. Cost guardrails (per-org storage quota + egress alerting) are deferred to the
backlog. No project-research pass (SEED-003 + v2.7 research + v2.11 validation already cover the domain).
Design reference: the owner's Claude Design mocks `Rehearsal.dc.html` + `Volunteer Home.dc.html` (Nocturne
palette → app dark gray-950).

**Flagged at roadmap time:**

- Phase 125 (R377) is security-critical — magic-link volunteer access must be read-only and scoped at the
  data layer, not just the UI. Needs a threat model + Firestore/Storage ALLOW/DENY rules tests at plan
  time. SEED-003 suggests scoped rules, a `buildServiceSnapshot()`-style denormalized rehearse snapshot
  carrying attachment refs/tokenized URLs, or server-issued signed URLs — the exact mechanism is left to
  phase-research/planning, but the phase must own the isolation guarantee.

- Phases 126 and 127 map to the owner's design mocks and are UI-bearing — run `/gsd-ui-phase` at plan time
  for each (`Volunteer Home.dc.html` for 126, `Rehearsal.dc.html` for 127).

- [x] **Phase 125: Passwordless Magic-Link Access & Scoped Read Isolation** - A volunteer signs in via a roster-email-tied Firebase email-link with no password, and that session is provably read-only and scoped to their own org's Planned, assigned services ✅ built + auto-verified 13/13 (human UAT batched → v2.12-DEFERRED-UAT.md)
- [x] **Phase 126: My Schedule — Volunteer Home** - A signed-in volunteer lands on a read-and-go page listing every Planned service they're assigned to, soonest first, with role/readiness/countdown info and a way into Rehearse ✅ built + auto-verified 5/5 SC, 6/6 reqs (review: 4 warnings fixed; human UAT + venue/call-time go/no-go batched → v2.12-DEFERRED-UAT.md)
- [x] **Phase 127: Volunteer Service View — Rehearse, Order of Service & Stage Layout** - From a My Schedule card, a volunteer reaches a standalone read-only service view — Rehearse (song list, detail, PDF reader, audio player with speed/loop, external links) plus read-only Order of Service and Stage Layout tabs — reliably on mobile ✅ built + auto-verified 10/10 (review: 4 warnings fixed; real-device UAT + cross-browser PDF-nav batched → v2.12-DEFERRED-UAT.md)

### Phase 125: Passwordless Magic-Link Access & Scoped Read Isolation

**Goal**: A volunteer can sign in without a password via a Firebase email-link tied to their roster email,
delivered through the existing volunteer-messaging emails, and once signed in, their access is provably
read-only and scoped to their own org's Planned, assigned services — never the planner/editor surfaces,
another org's data, or Draft services.
**Depends on**: Nothing (first phase of v2.12)
**Requirements**: R374, R375, R376, R377
**Security-critical**: yes — R377 requires a threat model and Firestore/Storage ALLOW/DENY rules tests
proving the isolation guarantee, not just a UI hide.
**Success Criteria** (what must be TRUE):

  1. A volunteer clicks the sign-in link embedded in an existing v1.7 volunteer-messaging email
     (reminder/share) and is signed in via Firebase email-link auth (`signInWithEmailLink`) with no
     password ever set or requested (R374, R375).

  2. A signed-in volunteer's session survives a browser refresh and they can explicitly sign out from the
     volunteer surface (R376).

  3. Playback position and downloads performed while signed in are attributed to that volunteer's own
     identity, not anonymous (R376).

  4. A signed-in volunteer's session cannot read another organization's data, any Draft (unlocked)
     service, or a service they are not assigned to — proven by rules/isolation tests, not just a UI hide
     (R377).

  5. A signed-in volunteer cannot reach any planner/editor surface (Service Order, Slides, Roles, Stage
     Layout editors) — those routes/reads are denied at the data layer for a volunteer-scoped session
     (R377).

**Plans**: 4/4 plans executed

Plans:

- [x] 125-01-PLAN.md — R377 scoped-read isolation: rehearseAccess rule + Firestore-emulator ALLOW/DENY proof (security core, Wave 1)
- [x] 125-02-PLAN.md — Rehearse-access projection builder + lock-time write / reopen-delete lifecycle (Wave 2)
- [x] 125-03-PLAN.md — Server-side magic-link generation embedded in the existing reminder/share email (R375, Wave 1)
- [x] 125-04-PLAN.md — Volunteer passwordless sign-in, session, sign-out + isVolunteerRoute router exemption (R374/R376, Wave 1)

### Phase 126: My Schedule — Volunteer Home

**Goal**: After signing in, a volunteer lands on "My Schedule," a read-and-go page listing every service
they are actually assigned to, so they can see what's coming and jump straight into rehearsal.
**Depends on**: Phase 125 (needs the magic-link session and scoped-read contract to query the volunteer's
own assignments)
**Requirements**: R378, R379, R380, R381, R382, R383
**Success Criteria** (what must be TRUE):

  1. After sign-in, a volunteer lands on My Schedule listing every service they are assigned to, matched
     by roster email → role assignment — available to anyone assigned to a service, not gated by role
     (R378).

  2. Only Planned (locked, non-Draft) services appear — a service still being drafted by a planner never
     shows to volunteers, reusing the app's existing not-Draft/lock gate (R379).

  3. Services are ordered soonest-first and grouped This week / Later this month, with a "Next up" badge
     on the soonest upcoming service; past services the volunteer served are shown separately and remain
     openable (R380).

  4. Each service card shows the date, name, time · venue, the volunteer's own role chips, song/chart/
     track counts, a readiness indicator (all ready / N songs missing media / waiting on charts), and a
     countdown + call time (R381).

  5. An upcoming card's "Rehearse →" opens that service's standalone Rehearse screen; a past card offers a
     read/open action instead; a "check a different email" affordance and a no-match empty state are
     present; and My Schedule itself is not editable (R382, R383).

**Plans**: 4/4 plans executed

Plans:

- [x] 126-01-PLAN.md — Data & security foundation: constrained rehearseAccess `list` rule arm + COLLECTION_GROUP index + first constrained-list rules test + rolesByEmailLower projection (KEY RISK, Wave 1)
- [x] 126-02-PLAN.md — Pure derivation helpers: grouping/countdown/readiness + role-name→glyph mapping (Wave 1)
- [x] 126-03-PLAN.md — My Schedule collectionGroup store + build-safe Phase-127 placeholder route/view (Wave 2)
- [x] 126-04-PLAN.md — My Schedule view + service card + /my-schedule route/landing + component tests (Wave 3)

**UI hint**: yes

### Phase 127: Volunteer Service View — Rehearse, Order of Service & Stage Layout

**Goal**: From a My Schedule service card, a volunteer reaches a standalone, read-only service view — not
the planner's `ServiceEditorView` — carrying three tabs: Rehearse (default, browsing songs and rehearsing
using the song's existing v2.11 attachments), Order of Service (read-only running order), and Stage Layout
(read-only stage diagram) — because tech-team volunteers need those two as much as the rehearsal media —
all working reliably on both desktop and mobile.
**Depends on**: Phase 126 (this view is reached only from a My Schedule service card, never independently
or from the planner's service editor)
**Requirements**: R384, R385, R386, R387, R388, R389, R390, R391, R392, R393
**Success Criteria** (what must be TRUE):

  1. Opening a service from My Schedule opens a standalone, read-only view — never the planner's
     `ServiceEditorView` or any editing UI — carrying Rehearse (default), Order of Service, and Stage
     Layout tabs, composed from the existing read-only renderers (ShareView snapshot + the v2.7 read-only
     order/stage renders) rather than a hidden/forked mode of the editor (R384).

  2. The Rehearse tab lists the service's songs (key, PDF count, MP3 count, now-playing indicator), and
     selecting one shows its detail — Sheet music & chords (PDF) with per-file Print + Download,
     Recordings (MP3), an optional per-song note, and any external media links (opening in a new tab) —
     all sourced from the existing v2.11 song attachments with nothing uploaded on this screen (R385,
     R386, R390).

  3. A PDF reader displays the selected chart with page navigation (Page X of Y, prev/next) and a Print
     action; an audio player provides play/pause, a seekable progress bar, elapsed/total time, whole-track
     playback speed (1x / 0.9x / 0.75x / 1.25x), and a whole-track Loop toggle (R387, R388, R389).

  4. The Order of Service tab shows the service's running order read-only, and the Stage Layout tab shows
     the v2.7 stage diagram (instruments/mics + person Name-Role) read-only — both usable by tech-team
     volunteers, not just the Rehearse tab (R392, R393).

  5. On a phone, PDFs open/download reliably (link-first with an inline `<iframe>` viewer as a desktop
     enhancement) and audio plays via native `<audio>` — across both My Schedule and this view (R391).

**Plans**: 6/6 plans executed

Plans:

- [x] 127-01-PLAN.md — Extend the rehearseAccess projection (orderOfService/roleAssignments/stageLayout/bpm) via a shared PII-safe allowlist; lock-time write; no rules change (R385/R386/R392/R393)
- [x] 127-02-PLAN.md — Rehearse song list + song detail (key/counts/now-playing; PDFs Print+Download, recordings Play+Download, external links) (R385/R386/R390)
- [x] 127-03-PLAN.md — PDF reader (native iframe desktop / link-first mobile) + single persistent native audio player (speed/loop/seek) (R387/R388/R389/R391)
- [x] 127-04-PLAN.md — Read-only Order of Service (re-themed ShareView anatomy) + Stage Layout (embedded StageLayoutView) tabs (R392/R393)
- [x] 127-05-PLAN.md — useVolunteerServiceDoc composable: orgId-from-store resolution + live get-arm re-fetch + 4-state machine (R384)
- [x] 127-06-PLAN.md — VolunteerServiceView tri-tab shell (desktop 3-column + mobile drill-down) + route swap + build gate (R384/R391)

**UI hint**: yes

<details>
<summary>✅ v2.13 Volunteer Self-Service & Multi-Church Access (Phases 128-130) — SHIPPED & DEPLOYED 2026-09-07</summary>

- [x] Phase 128: Self-Service Magic-Link Request (public, security-critical) + shared mint/send core
- [x] Phase 129: Admin Resend — Email & Copy
- [x] Phase 130: Multi-Church Volunteer Switcher

Full details: [milestones/v2.13-ROADMAP.md](milestones/v2.13-ROADMAP.md) · requirements [milestones/v2.13-REQUIREMENTS.md](milestones/v2.13-REQUIREMENTS.md) · audit [milestones/v2.13-MILESTONE-AUDIT.md](milestones/v2.13-MILESTONE-AUDIT.md)

> Deployed to production 2026-09-07 (self-service magic-link request page + shared mint/send core, admin
> resend, multi-church volunteer switcher); archived 2026-09-07. Numbering continues from v2.12 (ended
> Phase 127); v2.13 was Phases 128-130.

</details>

### 🚧 v2.14 Services UX Alignment, Dashboard & Live-Stream Output (Phases 131-137, in planning)

**Milestone Goal:** Bring the Services page and share views up to the app's UX/mobile standard, make the
dashboard genuinely useful, add worship-team responsibility confirmation and editor presence, and
introduce a third "Video" live-stream output with banner/full-screen slides.

**Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) — R406–R427 (22 mapped, 100% coverage)

**Key context:** A research-first pass (`.planning/research/SUMMARY.md`) ran ahead of requirements. Four
largely independent feature areas share one hard cross-feature ordering constraint: the two-state
("I've got it") volunteer-confirmation model (Phase 133) must land before the dashboard's
unconfirmed-volunteers widget (Phase 135), and editor presence (Phase 134) must land before the
dashboard's presence roll-up (also Phase 135) — so Phase 135 depends on both. Video output is
deliberately split into a low-risk Fullscreen slice (Phase 136, a structural copy of v2.9's role
generalization) before the one genuinely new render — the transparent-default / solid-key-color-fallback
Banner (Phase 137). **Blackbird is irrelevant to this milestone** (owner decision 2026-09-07) —
compositing happens in the video room's software (OBS/vMix-style Browser Source consuming a real alpha
source); there is no external hardware compositing dependency and no feasibility-spike phase. Presence
gets its own phase because its Firestore rules design (org-scoped `get`/`list`-split) needs a dedicated
review pass to avoid a smaller structural replay of the proven, live, Critical v2.8 SEC-S-01 cross-tenant
leak. Trivial wins (auto share-link, Stage Layout auto-populate) ship first to de-risk the milestone early
— both are single-call-site/pure-function additions reusing already-idempotent code.

**Flagged at roadmap time:**

- Phase 135 (Dashboard) needs the exact readiness rollup rule ("what counts as ready") pinned down at
  `/gsd-discuss-phase 135` — reuse the existing v2.12 My Schedule readiness computation as the base rather
  than inventing a second, parallel definition.
- Phase 137 (Video Banner) needs a product decision at `/gsd-discuss-phase 137` (or spec time): what does
  the Video output show for an item with no `videoOutput` flag set — transparent/key-color fill showing
  nothing, vs. black.
- Phase 132's "Planning Center" verbiage removal (R409) must start with a grep inventory/classify pass
  before any edit — this app has a real, functioning PC export integration, and a blind find-and-replace
  risks garbling substantive integration copy along with the one incidental banner string in scope.
- Numbering continues from v2.13, which ended at Phase 130 — v2.14 starts at Phase 131, not reset. (The
  999.x entries below are backlog, not this milestone; 999.2 and 999.3 are untouched by this numbering.)

- [ ] **Phase 131: Trivial Wins — Auto Share-Link & Stage Layout Auto-Populate** - A service's share link exists automatically at the Planned/lock transition and its Stage Layout seeds itself once from the roster on first empty-canvas visit
- [ ] **Phase 132: Services Page UX Alignment & Verbiage Cleanup** - The `/services` page matches the app's standard header/mobile conventions, share-plan rows alternate-shade for scanability, and incidental "Planning Center" copy is removed
- [ ] **Phase 133: Volunteer Responsibility Confirmation** - A volunteer confirms ("I've got it") a per-assignment responsibility; a planner sees live status on the roster and can nudge only the unconfirmed
- [ ] **Phase 134: Editor Presence** - Concurrent viewers/editors of a service see who else is currently present, backed by an org-scoped Firestore heartbeat with a dedicated cross-tenant rules review
- [ ] **Phase 135: Dashboard Overhaul** - The dashboard becomes an actionable "needs your attention" feed — upcoming services, readiness, unconfirmed volunteers, editor-presence roll-up, empty state
- [ ] **Phase 136: Video Output — Fullscreen Slice** - A third "Video" monitor role opens a dedicated output route that renders fullscreen exactly like the existing Audience output
- [ ] **Phase 137: Video Output — Banner Render** - A slide item can be sent to the Video output as a title-safe bottom lower-third banner, transparent by default with a configurable solid key-color fallback

### Phase 131: Trivial Wins — Auto Share-Link & Stage Layout Auto-Populate

**Goal**: A service's share link always exists automatically — minted at creation and self-healed for any
tokenless service (seeded or legacy) — and a new service's Stage Layout starts pre-populated with its
assigned roles/instruments instead of an empty canvas — with zero risk of clobbering manual work.
**Depends on**: Nothing (first phase of v2.14)
**Requirements**: R420, R421
**Success Criteria** (what must be TRUE):

  1. When a service transitions to Planned/locked, its share link exists automatically — the user never
     has to click "Share Link" for it to be generated (R421).
  2. Any tokenless service (seeded data, or a service created before the 2026-08-17 mint) self-heals a
     share link automatically — no manual "Share Link" click — via an idempotent `ensureShareLink()` safety
     net at the Planned/lock transition (not `maybeRefreshShareLink()`); the creation-time mint is KEPT and
     draft-sharing behavior is unchanged (owner decision 2026-09-07) (R421).
  3. Locking, unlocking, and relocking the same service never creates a duplicate share token (R421).
  4. Visiting a service's Stage Layout tab for the first time, with zero elements on the canvas,
     auto-seeds markers for that service's assigned roles/instruments (R420).
  5. Revisiting Stage Layout after manual edits — or after a roster change — never regenerates, wipes, or
     duplicates existing markers; the one-time seed never re-runs against a non-empty canvas (R420).

**Plans**: 2 plans
- [ ] 131-01-PLAN.md — Stage Layout auto-populate: pure autoPopulateMarkers() + one-time empty-canvas seed trigger (R420)
- [ ] 131-02-PLAN.md — Auto share-link safety net: keep the createService mint, self-heal tokenless services via ensureShareLink in markAsPlanned, and fix the emulator seed to mint a token (R421)

### Phase 132: Services Page UX Alignment & Verbiage Cleanup

**Goal**: The `/services` page and shared service-link pages match the app's standard UX/mobile
conventions, and "Planning Center" language appears only where it genuinely describes the PC
integration/export.
**Depends on**: Nothing (independent UI/copy polish; touches none of the milestone's new data models)
**Requirements**: R406, R407, R408, R409
**Success Criteria** (what must be TRUE):

  1. The `/services` page uses the same standard page-header component used elsewhere in the app (R406).
  2. On a phone-width viewport, the Services page's tabs and buttons are usable and readable, matching the
     app's mobile button/header conventions (R407).
  3. Rows on a shared service-link page alternate a light-gray background, making the plan easier to scan
     (R408).
  4. Every "Planning Center" UI-copy occurrence has been inventoried and classified before any edit; only
     substantive PC integration/export copy retains the phrase, and incidental references — e.g. the
     Planned/locked banner's "Planning Center already has this plan." sentence — are removed (R409).

**Plans**: TBD
**UI hint**: yes

### Phase 133: Volunteer Responsibility Confirmation

**Goal**: A worship-team volunteer can confirm they know they're responsible for an assignment, and a
planner can see and act on live confirmation status without it going stale across reassignment or
relock.
**Depends on**: Nothing (no dependency on presence or Video output)
**Requirements**: R410, R411, R412, R413
**Success Criteria** (what must be TRUE):

  1. A volunteer can tap a per-assignment "I've got it" action in their volunteer-facing surface (My
     Schedule / volunteer service view), moving that assignment from Unconfirmed to Confirmed — a
     two-state model, no Decline/replacement (R410).
  2. A planner sees each assignment's live confirmation status (Confirmed / Unconfirmed) on the service
     roster via `onSnapshot`, not a one-time fetch (R411).
  3. Reassigning a slot, or an unlock→relock edit cycle, invalidates a prior confirmation back to "needs
     reconfirmation" rather than showing a stale checkmark — keyed on stable assignment identity, not
     person identity (R412).
  4. A planner can send a reminder message targeting only people with unconfirmed assignments, reusing
     the existing v1.7 volunteer-messaging send infrastructure as a recipient-targeting change, not a new
     send path (R413).

**Plans**: TBD
**UI hint**: yes

### Phase 134: Editor Presence

**Goal**: Anyone viewing or editing a service can see who else is currently present on the same service,
cheaply and safely — with no cross-tenant leak and no stale "still viewing" state left behind by an
ungraceful disconnect.
**Depends on**: Nothing (fully self-contained; security-critical rules design earns its own review pass)
**Requirements**: R422, R423
**Security-critical**: yes — R423 requires a cross-org Firestore rules test proving the `get`/`list`-split,
org-scoped read idiom, mirroring the discipline that closed v2.8's SEC-S-01 cross-tenant leak.
**Success Criteria** (what must be TRUE):

  1. Two users viewing/editing the same service each see an indicator naming the other current viewer(s),
     backed by a Firestore heartbeat (`serverTimestamp()` + `onSnapshot`, coarse ~25-30s interval, paused
     while the tab is hidden) (R422).
  2. Navigating away — including an in-app route change that reuses the mounted editor instance, not just
     a tab close — removes that user from the presence indicator within the client-side soft-TTL
     staleness window (~60s) (R422).
  3. A forced-disconnect test (no graceful teardown) proves stale presence still clears via the staleness
     filter, not just the happy-path unmount (R422).
  4. A cross-org rules test proves a member of Org A cannot read Org B's presence records — both the `get`
     and `list` arms are org-membership-scoped, with no unscoped `allow read: if isSignedIn()` (R423).
  5. Abandoned presence records are removed by a scheduled cleanup backstop (Firestore TTL and/or a
     `cleanupStalePresence` cron sibling of the existing retention crons), not left to accumulate forever
     (R423).

**Plans**: TBD
**UI hint**: yes

### Phase 135: Dashboard Overhaul

**Goal**: The dashboard becomes an actionable "needs your attention" feed instead of showing an undefined
metric, giving a planner one place to see what's coming up and what needs action.
**Depends on**: Phase 133 (confirmation data for the unconfirmed-volunteers widget) AND Phase 134
(presence data for the editor-presence roll-up)
**Requirements**: R414, R415, R416, R417, R418, R419
**Success Criteria** (what must be TRUE):

  1. The undefined "Volunteer coverage" stat no longer appears anywhere on the dashboard (R414).
  2. The dashboard lists upcoming services (R415).
  3. Each listed service shows a readiness signal (songs/media attached, roles filled, slides built, Draft
     vs Planned/locked) computed via the same rollup already used in v2.12's My Schedule, not a second,
     parallel definition (R416).
  4. The dashboard shows which volunteers have not yet confirmed for upcoming services, reading the Phase
     133 confirmation model (R417).
  5. The dashboard shows an editor-presence roll-up (who is currently editing which service), reusing the
     Phase 134 per-service presence data verbatim (R418).
  6. When there is nothing needing attention, the dashboard shows a clear empty/first-run state instead of
     a blank or broken layout (R419).

**Plans**: TBD
**UI hint**: yes

### Phase 136: Video Output — Fullscreen Slice

**Goal**: A projectionist can route a service's slides to a third "Video" output — for a live-stream
video room — fullscreen, independently of the Banner work.
**Depends on**: Nothing (a close structural copy of v2.9's existing N-assignment output-role
generalization)
**Requirements**: R424, R426
**Success Criteria** (what must be TRUE):

  1. Monitor setup offers "Video" as a third assignable output role alongside Audience/Confidence
     (`MonitorRole` widened) (R424).
  2. A monitor assigned the Video role opens a dedicated `VideoOutputView` at its own static route (R424).
  3. The Video role assignment coexists with existing Audience/Confidence assignments without disrupting
     them — the N-assignment model already generalized in v2.9 (R424).
  4. In Fullscreen mode, the Video output renders identically to the existing Audience full-slide output —
     no visual regression, no new rendering code (R426).

**Plans**: TBD
**UI hint**: yes

### Phase 137: Video Output — Banner Render

**Goal**: A slide can be sent to the Video output as a compositable lower-third banner, so a live-stream
software compositor (OBS/vMix-style Browser Source) can show live stage video behind the slide text.
**Depends on**: Phase 136 (extends the Video output route/role it establishes)
**Requirements**: R425, R427
**Success Criteria** (what must be TRUE):

  1. An editor can flag a slide item to go to the Video output as either Banner or Full-screen; Banner is
     selectable/valid only when the item's target output is Video (R425).
  2. The per-item Banner/Full-screen choice persists via the existing `useAutoSave` deep-watch — no new
     save call, mirroring the `loop` field precedent (R425).
  3. A Banner-flagged slide's content renders fit to a bottom lower-third region with a title-safe inset
     and readable default text sizing (R427).
  4. The region outside the banner content renders with a transparent background by default, so a
     software compositor can show live video behind it (R427).
  5. An editor can configure a solid key-color fallback (default saturated magenta, `<input
     type="color">`) that replaces the transparent background for a tool that needs chroma-key instead of
     alpha (R427).

**Plans**: TBD
**UI hint**: yes


### Phase 999.5: v2.8 Security Review — Medium/Low findings (11) (PROMOTED to v2.10)

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

> **Promoted 2026-09-04:** every finding above maps to a v2.10 requirement (R339-R348). See milestone v2.10 Phases 117-118.

### Phase 999.4: v2.8 Architectural Review — Medium/Low findings (ARCH-002..023) (PROMOTED to v2.10)

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

> **Promoted 2026-09-04:** every finding above maps to a v2.10 requirement (R349-R360). See milestone v2.10 Phases 119-120.

### Phase 999.3: Monitor Setup — route one signal to multiple monitors; no signal mandatory (✅ COMPLETE)

**Goal:** In Monitor Setup (Run the Service, v2.4), let a user send the
**same signal to multiple monitors** and never force assigning every signal.
**Requirements:** TBD
**Plans:** completed (owner-confirmed done 2026-09-04)

Reported by owner 2026-09-02. Current behavior (defect): signal→monitor assignment is treated as
1:1/exclusive — with 2 monitors, assigning **Audience** to Monitor A and then to Monitor B
*un-assigns* it from Monitor A. Desired behavior:

- [x] One signal (Audience / Confidence / Livestream / etc.) can be routed to **multiple monitors**
  simultaneously (e.g. Audience mirrored to both Monitor A and Monitor B).

- [x] Assigning a signal to a monitor must **not** steal it from another monitor.
- [x] **No signal is mandatory** — if the user only wants Audience, they should not be required to
  assign Confidence, Livestream, or any other output.

- [x] Verify the audience/confidence output windows + `useRunControl` channel routing handle a
  one-signal→many-monitors fan-out (BroadcastChannel/window management) without desync.

Area: `src/views/MonitorSetupView.vue` + monitor config/channel utilities (Phase 91 config+channel
utilities, Phase 92 Monitor Configuration screen). **Completed — owner-confirmed done 2026-09-04.**

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
