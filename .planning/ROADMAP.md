# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- ✅ **v1.1** — Phases 8-17 (Planning Center, song catalog, volunteer scheduling)
- ✅ **v1.2 — Worship Service Slide Management** — Phases 18-23 (shipped 2026-07-28; owner acceptance, checkpoints waived)
- ✅ **v1.3 — Slides Tab Rework** — Phases 24-28 (shipped 2026-07-28; verified by owner)
- ✅ **v1.4 — Service and Slides** — Phases 29-38 (shipped 2026-08-05; owner acceptance, verification unrun)
- ✅ **v1.5 — Settings, Sharing, and Fidelity** — Phases 39-50 (shipped 2026-08-10; settings infra + feature toggles, custom auth claims, sharing correctness, PPTX rendered-image display, service item types, default template, ESV/NLT Bible version, slide typography, congregational reading, multi-image + mobile polish, bulk-delete/provenance/render-fidelity)
- ✅ **v1.6 — Editing Reliability & Song Slides** — Phases 51-57 (shipped 2026-08-12; drag-and-drop editing reliability, service-template relocation, song-slide splitting, service-item notes + MISC labels + per-item Scripture version, preview/export polish, template-editor UX parity)
- 🚧 **v1.7 — Volunteer Messaging & Notifications** — Phases 58-62 (roadmapped 2026-08-13; messages composer, delivery history + bounce webhook, lock & scheduled-reminder auto-notifications, re-lock scoped change diff — all behind a Settings kill-switch)

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

### 🚧 v1.7 Volunteer Messaging & Notifications (In Progress)

**Milestone Goal:** Let planners email the volunteers scheduled on a service — a composer, automatic
lock and scheduled-reminder notifications, and a re-lock scoped change diff — all governed by a global
Settings kill-switch, built on one shared server-side recipient resolver and a single
queue-then-trigger send primitive.

**Phases:** 58-62 (5). **Requirements:** `.planning/REQUIREMENTS.md` (R130-R148, 19 total, 19/19 mapped).

Derived from `research/SUMMARY.md`'s 7-phase backbone (provider infra+settings → shared resolver →
composer+send → delivery history+webhook → lock/re-lock triggers → scheduled reminder → re-lock diff),
compressed under this project's `coarse` granularity setting:

- **Merged research's Phase 1 (provider infra & settings) and Phase 2 (shared recipient resolver) into
  Phase 58.** Both are foundation-only, no-sending phases; the resolver alone is two requirements
  (R134/R135) and reads as a task rather than an observable outcome on its own. R132 (per-service
  messaging defaults) and R133 (org timezone) — pure settings/data-model work needing no send path —
  were folded in here rather than deferred, since both are testable the moment the Settings UI exists.

- **Kept the composer+send phase (59) and the delivery-history+webhook phase (60) separate**, despite
  both being deploy-gated — the bounce webhook is flagged by every research pass as a genuinely new
  unauthenticated trust boundary that earns its own explicit HMAC-verification success criterion,
  not a footnote inside a larger phase.

- **Merged research's Phase 5 (lock notification) and Phase 6 (scheduled reminder) into Phase 61.**
  Both are single-requirement "automatic trigger" additions that only consume the send primitive and
  resolver already built by that point; research explicitly notes they're independent of each other
  and can land in either order — exactly the shape `coarse` says to combine rather than ship as two
  thin phases.

- **Kept research's Phase 7 (re-lock scoped diff) as its own phase, last, unmerged** — unanimous across
  all four research files as the highest-complexity, most novel piece, depending on the lock-snapshot
  mechanism, send primitive, and recipient resolver all being solid first. This is the one hard
  sequencing constraint under `coarse` that overrides compression.

**Numbering continues from v1.6, which ended at Phase 57** — v1.7 starts at Phase 58, not reset.

**Deploy-gated phases** — per the owner's standing autonomy grant, every deployable Function or rules
change ships built, tested, and undeployed, with the exact command handed to the owner:

- **Phase 58** — `firestore.rules` additions for `messages`/`recipients`/`lockSnapshots`.
- **Phase 59** — `queueServiceMessage` + `sendQueuedMessage` Cloud Functions, plus the owner's Resend
  account creation and domain SPF/DKIM/DMARC DNS setup (a prerequisite for mail actually reaching an
  inbox, not merely for the code to run).

- **Phase 60** — `messageWebhook` Cloud Function, plus configuring the webhook URL in the Resend
  dashboard.

- **Phase 61** — `sendScheduledReminders` Cloud Function (daily cron).
- **Phase 62** — no new Function; reuses Phase 59's send primitive and Phase 58's `lockSnapshots` rules
  block.

**Mandatory discipline carried into every relevant phase below:** the Messaging kill-switch (R130) and
draft-skip must be re-checked in every send path, not assumed from an earlier phase; any phase touching
`firestore.rules` carries a positive (allow-case) emulator test, not only deny-cases (CLAUDE.md's
documented storage.rules incident); the bounce webhook verifies the provider's HMAC signature over the
raw body before any Firestore write.

- [ ] **Phase 58: Messaging Infrastructure, Settings & Recipient Resolution** - Kill switch, org timezone, per-service messaging defaults, and one shared recipient resolver
- [ ] **Phase 59: Messages Composer & Send Path** - ✉ Messages composer with teams-first recipients, tokens, and the queue-then-trigger send primitive
- [ ] **Phase 60: Delivery History & Bounce Webhook** - Per-service sent history with HMAC-verified hard-bounce surfacing
- [ ] **Phase 61: Automatic Notifications — Lock & Scheduled Reminder** - Auto-email on first lock; auto-send the share link N days before the service
- [ ] **Phase 62: Re-lock Change Notice — Scoped Diff** - Checkable, team-tagged change diff on re-lock, or Lock quietly

## Phase Details

### Phase 58: Messaging Infrastructure, Settings & Recipient Resolution

**Goal**: The org has messaging plumbing in place — a kill switch, a local timezone, per-service
messaging-default overrides, and one shared way to resolve who a service's send reaches — safely inert
until later phases add real sends.
**Depends on**: Nothing (first phase of v1.7)
**Requirements**: R130, R132, R133, R134, R135
**Success Criteria** (what must be TRUE):

  1. An org owner can see and toggle a global "Messaging" switch on the Settings screen; a fresh org
     starts with it OFF.

  2. An org can set its local timezone in Settings, giving later scheduled sends a time zone to fire in.
  3. A service in Draft shows per-service messaging-default overrides (lock notification, reminder
     enabled + days-before) that inherit from the org's Settings until explicitly changed; a locked
     service's overrides are read-only.

  4. Given any service, one shared resolver returns teams (Worship/Tech/Vocals/Hosts/Everyone) grouping
     the assigned roles, deduped by person, with an unreachable/open-roles count for roles that have no
     email — the only recipient-resolution logic any later phase writes.

  5. The new `messages`/`recipients`/`lockSnapshots` collections are denied by default in
     `firestore.rules`, proven by an emulator test suite that includes a genuine allow-case, not only
     deny-cases.
**Plans**: 5/5 plans executed

  - [x] 58-01-PLAN.md — Data model, settings merge & messaging kill-switch gate (R130/R132/R133)
  - [x] 58-02-PLAN.md — Pure recipient resolver: teams, dedup, unreachable count (R134/R135)
  - [x] 58-03-PLAN.md — firestore.rules messages/recipients/lockSnapshots + emulator ALLOW/deny tests
  - [x] 58-04-PLAN.md — Settings "Messaging" card: kill-switch, org defaults, timezone (R130/R132/R133)
  - [x] 58-05-PLAN.md — Per-service messaging defaults: store action + Service Order panel (R132)

**UI hint**: yes

Notes: Ships built/tested/undeployed — the `firestore.rules` additions need an owner
`firebase deploy --only firestore:rules` before they take effect in production; hand over the exact
command. No send path exists yet in this phase; R131 (backend send path) is delivered in Phase 59,
where the actual Cloud Function holding the provider key is built.

### Phase 59: Messages Composer & Send Path

**Goal**: A planner can compose and send a message to a service's volunteers, with the provider's API
key confined to a single server-side Function.
**Depends on**: Phase 58
**Requirements**: R131, R136, R137, R138, R139, R140, R141
**Success Criteria** (what must be TRUE):

  1. A ✉ Messages button on a service (hidden or disabled when the org's Messaging switch is off) opens
     a composer whose recipients are teams first, with individuals addable below.

  2. The composer supports three message types — One-off, Reminder, Share service link — with a
     subject and a body that accepts insertable tokens (service date, service link, their roles, song
     list).

  3. The composer shows a live "Reaches N people" count reflecting the current selection minus
     unreachable roles, and offers attach-service-order-link, send-me-a-copy, and schedule-for-later
     options.

  4. Sending delivers one personalized email per recipient — the "their roles" token renders that
     person's own roles, not a shared block — through `queueServiceMessage` (onCall) →
     `sendQueuedMessage` (onDocumentCreated), the only Function that ever holds the provider secret,
     with a transactional idempotency check that stops a retried trigger from sending twice.

  5. Provider account setup (Resend) and domain authentication (SPF/DKIM/DMARC DNS records) are owner
     steps; the send Functions ship built/tested/undeployed with the exact
     `firebase deploy --only functions:...` command handed to the owner.
**Plans**: 4 plans

  - [ ] 59-01-PLAN.md — Functions infra: resend@6.19.0 (legitimacy-gated) + ported serviceRoles resolver (R131/R139)
  - [ ] 59-02-PLAN.md — queueServiceMessage onCall: re-auth + kill-switch re-check + createQueuedMessage shaper (R131/R137/R141)
  - [ ] 59-03-PLAN.md — sendQueuedMessage trigger: idempotency txn, re-resolve, per-recipient token render, Resend-mock send (R131/R138/R139)
  - [ ] 59-04-PLAN.md — MessageComposer.vue + ✉ action-bar entry: teams-first recipients, tokens, Reaches-N, options (R136/R137/R138/R140/R141)

**UI hint**: yes

Notes: Deferred design decision — provider account + domain SPF/DKIM/DMARC DNS work depends on whether
the church domain DNS is self-managed; confirm at `/gsd-discuss-phase 59`. No send reaches a real inbox
until the owner completes domain auth, even after the Function is deployed.

### Phase 60: Delivery History & Bounce Webhook

**Goal**: A planner can see what was sent on a service and knows immediately when an address hard-
bounced.
**Depends on**: Phase 59
**Requirements**: R142, R143
**Success Criteria** (what must be TRUE):

  1. Each service has a "Sent on this service" history listing every message with its type
     (automatic/one-off/scheduled), recipient count, and send time.

  2. A hard bounce surfaces per message in that history with an affordance to fix the bad address.
  3. The bounce webhook verifies the provider's HMAC signature over the raw request body before
     touching Firestore; an unsigned or malformed request is rejected (401/400) with zero writes.

  4. A duplicate webhook delivery for the same bounce event is a safe no-op (idempotent status
     overwrite), never a duplicate count.
**Plans**: TBD
**UI hint**: yes

Notes: Deploy-gated — `messageWebhook` (onRequest) ships built/tested/undeployed; after the owner
deploys, configuring the provider's webhook URL in the Resend dashboard is a separate owner step.

### Phase 61: Automatic Notifications — Lock & Scheduled Reminder

**Goal**: Volunteers are notified automatically when a service locks and reminded automatically before
it happens, with no planner action either time.
**Depends on**: Phase 58, Phase 59
**Requirements**: R144, R145
**Success Criteria** (what must be TRUE):

  1. Locking a service for the first time can automatically email everyone assigned — their roles, the
     song list, and a link to the service order — governed by the per-service/Settings default from
     Phase 58.

  2. The lock email never sends while the service is a draft or while the org's Messaging switch is
     off.

  3. The shared service link auto-sends to everyone assigned N days before the service (default 7,
     configurable), firing at the org's local time of day (R133).

  4. The reminder is skipped while the service is still a draft, and a retried scheduled run never
     sends the same reminder twice for the same service.
**Plans**: TBD
**UI hint**: yes

Notes: Deploy-gated — `sendScheduledReminders` (onSchedule daily cron) ships built/tested/undeployed
with the exact deploy command; the `lockSnapshots/current` write on first lock is a client-side
Firestore write covered by Phase 58's rules and needs no separate deploy.

### Phase 62: Re-lock Change Notice — Scoped Diff

**Goal**: After editing a locked service and re-locking it, the planner can see exactly what changed
and choose who to tell.
**Depends on**: Phase 58, Phase 59, Phase 61
**Requirements**: R146, R147, R148
**Success Criteria** (what must be TRUE):

  1. Re-locking a service that was already locked once prompts the planner with a scoped change diff of
     typed, checkable entries (SONG / ORDER / ROLE / NOTES / SLIDES).

  2. Each entry is tagged with the teams it affects — a ROLE entry tags exactly that role's team; every
     other entry type defaults to all assigned teams — and the planner can send the notice to only the
     affected teams or to everyone on the service.

  3. "Lock quietly" is always available to re-lock without sending anything.
  4. Confirming either a notify-send or a quiet lock overwrites `lockSnapshots/current`, so the next
     re-lock diffs against this new state, not the original lock.
**Plans**: TBD
**UI hint**: yes

Notes: Sequenced last per unanimous research convergence — depends on the lock-snapshot mechanism
(Phase 61), the send primitive (Phase 59), and the recipient resolver (Phase 58) all being solid.
Deferred design decision — SLIDES-diff fingerprint granularity (coarse yes/no vs. per-slide-group
hash); confirm at `/gsd-discuss-phase 62`.

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
| 58-62 | v1.7 | 0/TBD | Not started | - |

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

### Phase 999.5: Multi-org-aware auth claim for Storage membership (BACKLOG)

**Goal:** Widen the org-membership custom auth claim to carry ALL of a user's orgs (and roles), and update `storage.rules`' `isOrgMemberByClaim` to check the requested `orgId` against that set — so a user who belongs to more than one organization retains Storage access to every org, not just their primary.
**Motivation:** Phase 40 Deploy 2 (2026-08-12) removed the cross-service `firestore.exists()` fallback, making the claim the sole authority for Storage membership. By design (D-01/D-04) the claim carries only the PRIMARY org (`users/{uid}.orgIds[0]`). This is safe today because every user is single-org (verified + cleaned up at the 2026-08-12 migration), but the moment a real user joins a second real org their non-primary org's Storage access would silently fail. This must be built BEFORE any such user is onboarded.
**Blocking condition:** onboarding a user into a second organization.
**Requirements:** relates to R074 (Phase 40 custom-claim membership)
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready — and BEFORE onboarding any multi-org user)
