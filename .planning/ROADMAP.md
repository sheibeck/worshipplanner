# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- ✅ **v1.1** — Phases 8-17 (Planning Center, song catalog, volunteer scheduling)
- ✅ **v1.2 — Worship Service Slide Management** — Phases 18-23 (shipped 2026-07-28; owner acceptance, checkpoints waived)
- ✅ **v1.3 — Slides Tab Rework** — Phases 24-28 (shipped 2026-07-28; verified by owner)
- ✅ **v1.4 — Service and Slides** — Phases 29-38 (shipped 2026-08-05; owner acceptance, verification unrun)
- 🔄 **v1.5 — Settings, Sharing, and Fidelity** — Phases 39-48 (in progress; settings infra + feature toggles, custom auth claims, sharing correctness, PPTX rendered-image display, service item types, default template, ESV/NLT Bible version, slide typography, congregational reading divider, multi-image ordering + mobile polish)

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

### 🔄 v1.5 Settings, Sharing, and Fidelity (In Progress)

**Milestone Goal:** Make the app configurable per church — settings that turn features on and off and
set the house style — while fixing the sharing and fidelity defects that make a service plan not match
what was actually planned.

**Requirements:** `.planning/REQUIREMENTS.md` (R073–R103, 31 total, 31/31 mapped)

**Derived from** `.planning/research/SUMMARY.md`'s 12-phase default (Phases 39-50), compressed to 10
phases under this project's `coarse` granularity setting. Two merges, both because the SUMMARY default
left an adjacent phase too thin (a single requirement, no user-observable surface of its own) to stand
alone:

- **Phase 39** merges SUMMARY's "Org Settings Infrastructure" (R073 alone) with "AI and Planning
  Center Settings Toggles" (R088, R089) — the toggles are the first feature to put an actual control on
  a Settings screen, so combining them gives the settings-infrastructure work real user-observable
  success criteria while still landing first, ahead of every later phase that depends on R073 (R086,
  R090, R093).

- **Phase 48** merges SUMMARY's "Multi-Image Import Ordering" (R098 alone) with "Mobile & Layout
  Polish" (R099-R103) — SUMMARY's own rationale already called both "independent, low-risk... slot in
  wherever convenient," so combining them avoids two adjacent thin phases without changing what either
  delivers.

Everything else keeps SUMMARY's phase boundaries and ordering rationale, renumbered to close the two
merge gaps. Full reasoning recorded in `.planning/STATE.md` § "v1.5 ROADMAP.md phase breakdown."

- [x] **Phase 39: Org Settings Infrastructure & Feature Toggles** - Typed org settings plus AI/Planning Center toggles gated at the `claudeApi.ts` choke point
- [x] **Phase 40: Custom Auth Claim for Org Membership** - A testable, dual-read Storage-rules membership check (built, tested, undeployed — two owner deploys with a 1-hour soak between them)
- [x] **Phase 40.1: Close the Self-Service Membership Hole** (INSERTED 2026-08-06) - Only an invite-holder or an org's creator can create a membership document
- [ ] **Phase 41: Sharing Correctness** - One permanent share link per service, auto-refreshed on every change
- [ ] **Phase 42: PowerPoint Rendered-Image Display** - Client-side display of the already-deployed server-rendered PPTX images (carryover R062)
- [ ] **Phase 43: Service Item Types** - Announcements, Miscellaneous, a plain-text Message, and Hymn retired from the add-item palette
- [ ] **Phase 44: Default Service Template** - A church-defined default item set for new blank services
- [ ] **Phase 45: ESV/NLT Bible Version Selection** - Scripture source choice with required attribution and no retroactive slide changes
- [ ] **Phase 46: Global Slide Typography** - One house font (family/weight/size) for every slide, flash-free
- [ ] **Phase 47: Congregational Reading Divider UX** - Hand-divided Leader/Congregation/All sections, AI split as one of three equal starting points
- [ ] **Phase 48: Multi-Image Ordering & Mobile Polish** - Deterministic multi-image import order; a usable Slides tab and service edit screen on a phone

## Phase Details

### Phase 39: Org Settings Infrastructure & Feature Toggles

**Goal:** A church's org-level settings persist safely on every existing org document, and a church can turn AI and Planning Center integrations off entirely.
**Depends on**: Nothing — first phase of this milestone
**Requirements**: R073, R088, R089
**Success Criteria** (what must be TRUE):

  1. A typed `OrgSettings` shape with a single defaults-merge point means an organization document created before any v1.5 setting existed loads without error and shows correct defaults on every screen, not just the Settings screen
  2. In Settings, a church can turn AI features off; with it off, every AI entry point (song suggestions, scripture discovery, congregational-reading AI split) disappears from the UI, and a direct call into `claudeApi.ts` with the toggle off issues no network request — proven by a test at the module entry point, not a `v-if`
  3. In Settings, a church can turn Planning Center integration off; its features hide without altering already-imported roster data or the status of services already exported
  4. Turning AI off never alters slide content an AI split already generated

**Plans**: 6/6 plans executed

Plans:

- [x] 39-01-PLAN.md — Wave 0: create the two missing test harnesses (`SettingsView.test.ts`, `SongsView.test.ts`)
- [x] 39-02-PLAN.md — `Organization`/`OrgSettings`/`DEFAULT_ORG_SETTINGS`, the single defaults-merge point in `loadOrgContext`, and the `vwModeEnabled` dual-read
- [x] 39-03-PLAN.md — Settings screen: AI Features section, Planning Center enable toggle, dot-path writes, credentials block wrapped
- [x] 39-04-PLAN.md — AI guard at `claudeApi.ts`'s module entry point (3 of 7 exports) plus the three AI entry-point hides
- [x] 39-05-PLAN.md — the five remaining Planning Center entry points gated
- [x] 39-06-PLAN.md — phase gate (`npm run type-check`, suite baseline, requirement traceability) and the five manual backstops

**UI hint**: yes
**Research flag**: skip — both halves are flagged standard-pattern in SUMMARY.md (direct generalization of the existing `vwModeEnabled` pattern; a table-stakes toggle pattern with the choke point already designed for it).
**Notes**: Merged from SUMMARY's separate Phase 39 (Org Settings Infrastructure) and Phase 45 (AI/PC Toggles) — see the departure note above. Build `src/types/organization.ts` (`Organization`, `OrgSettings`) and `DEFAULT_ORG_SETTINGS` first; every later phase that stores a setting (R086 in Phase 44, R090 in Phase 45, R093 in Phase 46) depends on this shape existing before it writes into it. The AI/PC guards must live at the module entry point (`claudeApi.ts`, the PC utility), never only in `.vue` files — hiding UI while leaving the code path callable is the exact anti-pattern research flags as Pitfall 5.

### Phase 40: Custom Auth Claim for Org Membership

**Goal:** Storage-rules membership checks are provably correct in both the Storage emulator and production, via a custom auth claim that never locks out or under-authorizes an existing member.
**Depends on**: Nothing — sequenced early deliberately, ahead of most other work, because its dual-read soak window is the longest-running thing in the milestone. It shares no code with the settings work that precedes it.
**Requirements**: R074, R075
**Success Criteria** (what must be TRUE):

  1. A Firestore-triggered Cloud Function (mirroring the existing `requestPptxRender` trigger pattern) computes and sets a `{orgId, role}` custom claim from `organizations/{orgId}/members/{uid}` writes — built and tested, never deployed by this phase
  2. `storage.rules` dual-reads the new claim OR the existing Firestore membership check, and ships with a passing ALLOW-case test that runs against the real Storage emulator proving an authenticated org member can read and write under their org's Storage path — the two allow-cases in `src/storage.rules.test.ts` that fail today under `firestore.exists()`'s emulator inertness now pass
  3. A signed-in member who has not yet received the claim (pre-rollout) still passes on the existing Firestore-membership branch, and a user who belongs to no organization is denied on both branches — proven by tests covering both arms of the dual-read OR, not just one
  4. The idempotent, resumable backfill script for existing users, and the exact two-deploy sequence — (a) deploy the dual-read rule and the claims function, hold for one full max-token-lifetime (1 hour) soak, then (b) deploy again removing the Firestore-membership fallback — are written and handed to the owner as the next action. Reaching this state IS the phase goal; neither deploy runs during this phase

**Plans**: 4/4 plans executed

Plans:

- [x] 40-01-PLAN.md — `storage.rules` dual-read (claim OR Firestore, claim first) and the non-vacuous rules test matrix; turns the two measured allow-case failures green [wave 1]
- [x] 40-02-PLAN.md — `syncOrgMembershipClaim` `onDocumentWritten` trigger plus the shared `decideMembershipClaim` module and its unit tests [wave 1]
- [x] 40-03-PLAN.md — forced `getIdTokenResult(true)` on org-context load with a bounded retry scoped to the just-created-membership path [wave 1]
- [x] 40-04-PLAN.md — idempotent dry-run-by-default backfill script and `functions/DEPLOY-ORG-CLAIMS.md`, the two-deploy handoff [wave 2]

**UI hint**: no
**Research flag**: needs research — dual-read rollout design, the 1000-byte claim-payload budget against live multi-org membership (`users/{uid}.orgIds` is already an array), and the race condition at invite-acceptance time.
**Notes**: Scoped to `storage.rules` only — `firestore.rules` uses same-service `exists()`/`get()`, unaffected by firebase-js-sdk#6803, and migrating it too would trade one staleness class for a worse, unnecessary one (role changes lagging a token refresh). This phase's success is measured entirely by emulator evidence and a written handoff, never by a live deploy — see the v1.5 standing autonomy grant in STATE.md. **This phase structurally cannot fully close inside an autonomous run** — the soak-and-fallback-removal step needs the owner's clock, not just their command.

### Phase 40.1: Close the Self-Service Membership Hole

**Goal:** Only a user holding a valid invite — or the creator of a brand-new organization — can create a membership document. Self-joining an arbitrary org, at an arbitrary role, is denied.
**Depends on**: Nothing — independent of the claim work, but sequenced here so all three rules-touching phases stay contiguous and can ship in one deploy session.
**Requirements**: R104
**Success Criteria** (what must be TRUE):

  1. A signed-in user who holds no invite to an organization **cannot** create `organizations/{orgId}/members/{their-uid}` — proven by a DENY-case test against the real Firestore emulator
  2. A user accepting a genuine outstanding invite **can** create their membership document — proven by an ALLOW-case test that actually runs, not a source assertion
  3. The creator of a brand-new organization **can** still create their own first membership document — the second legitimate flow the current loose rule exists to serve, and the one most likely to be broken by a careless tightening
  4. A user cannot choose their own `role` on create — a self-created membership carrying `role: 'editor'` is denied, or the role is forced server-side regardless of the submitted body
  5. `firestore.rules` is modified but **NOT deployed** — the change is handed to the owner to ship alongside Phase 40's deploy 2

**Plans**: 1/1 plans executed

Plans:

- [x] 40.1-01-PLAN.md — the four emulator tests run against the UNFIXED rule first (both DENY cases observed failing), then the two-branch `allow create` predicate (`getAfter()` for org creation, `get()`/`exists()` for invite acceptance), then the phase gate and the owner deploy handoff [wave 1]

**UI hint**: no
**Research flag**: needs research — trace both legitimate creation flows (org creation and invite acceptance) in real source before touching the rule. The current rule is loose *on purpose*; a fix that only considers the invite path will silently break org creation, and a fix that only considers org creation leaves the hole open.
**Notes**: INSERTED 2026-08-06 after Phase 40's code review filed WR-03. **This is a pre-existing vulnerability, not one v1.5 introduced** — `firestore.rules:36-41` reads `allow create: if isSignedIn() && request.auth.uid == uid`, which lets any signed-in user self-join any organization, and because the document body is client-controlled they can also set their own `role`. Phase 40 does not widen it, but it does slow its remediation: once Phase 40's deploy 2 removes the Firestore-membership fallback, the custom claim becomes the sole authority and revocation latency stretches from per-request to **up to one hour**. Numbered 40.1 rather than renumbering 41-48, and sequenced immediately after 40 so the owner can deploy `storage.rules` and `firestore.rules` together rather than in two separate sessions.

### Phase 41: Sharing Correctness

**Goal:** A service's share link is created once and never changes, and it always shows the current plan and current role overrides without anyone re-sharing.
**Depends on**: Phase 40 (avoids two concurrent rewrites of the same rules files)
**Requirements**: R076, R077, R078
**Success Criteria** (what must be TRUE):

  1. Sharing a service for the first time creates exactly one persistent share-link document (`serviceShareLinks/{serviceId}`, not a field on the service document — a bare `{shareToken}` write matches none of R036's draft-lock carve-outs and would be rejected on any planned/exported service) whose token never changes across repeat shares, edits, or role-override changes — proven by test
  2. A previously-shared service's public view reflects the current plan and current role overrides after any service edit, without anyone re-pressing Share — the auto-refresh writes only to the share-link document and never back to `services/{docId}`, so no trigger loop forms — proven by test
  3. `firestore.rules`' loosened update rule for `shareTokens`/`serviceShares` (today `allow update: if false`, which blocks any refresh) ships with a passing ALLOW-case test run against the real emulator proving the new update path — not merely a read of the rules file
  4. Running the backfill against a service that already has several `shareTokens` documents (from the old mint-fresh-every-time behavior) adopts the most recent existing token rather than minting a new one, so links already circulated to a congregation keep working — proven by test
  5. The snapshot's existing PII guard (names only, never the raw Person object) is proven intact after the rework; deploying the updated `firestore.rules` remains the owner's step, with the exact command handed off in this phase's notes

**Plans**: 4/4 plans executed

Plans:

- [x] 41-01-PLAN.md — Wave 1: loosen the `shareTokens` update rule, add the `serviceShareLinks` rules block with an absence-tolerant read, prove both against the emulator (20 tests), record the owner deploy handoff and the `deleteService` scope decision
- [x] 41-02-PLAN.md — Wave 1: `src/utils/shareTokens.ts` — dependency-free `mintShareToken` / `shareTokenCreatedAtMillis` / `pickAdoptableToken`, with the R078 adoption ordering (org filter, `createdAt` desc, doc-id tiebreak, null-safe) proven without a Firestore mock
- [x] 41-03-PLAN.md — Wave 2: Wave 0 mock extension (`where`/`getDocs`/`limit`/`runTransaction`), extract `buildServiceSnapshot`, implement `ensureShareLink` (adopt-or-create via transaction, then write payload in place), retain `createShareToken` as a delegating wrapper
- [x] 41-04-PLAN.md — Wave 3: `maybeRefreshShareLink` hooked into `updateService` / `setRoleOverride` / `clearRoleOverride` behind the session cache and WR-06 soft-fail; prove no write-back and the PII guard on the refresh path

**UI hint**: no
**Research flag**: needs research — the storage-location decision (a separate `serviceShareLinks` document, not the service doc) must be made explicit in the plan against R036's actual carve-out shapes, not assumed from PROJECT.md's original wording.
**Notes**: PROJECT.md's original decision — "persist the token on the service doc" — is superseded by REQUIREMENTS.md's R076 correction; do not plan against the old wording. One root cause explains both "the link changed" and "my role overrides aren't showing": `createShareToken()` minted a fresh token on every call and froze the snapshot at share time.

### Phase 42: PowerPoint Rendered-Image Display

**Goal:** An imported PowerPoint deck displays as its true rendered self — in the slide grid and while presenting — instead of parsed text alone, closing out the half of R062 that v1.4 shipped undeployed and unconsumed.
**Depends on**: Phase 40, Phase 41 (its brand-new Storage read path inherits claim-based correctness, and lands after the rules-file churn from both prior phases settles)
**Requirements**: R079, R080
**Success Criteria** (what must be TRUE):

  1. Opening a service with an imported PowerPoint deck shows the original rendered slide images — not the parsed-text fallback — in both the slide grid view and the presenter
  2. A deck whose render is still pending, or has failed, shows an explicit pending/failed state rather than a blank, broken, or misleadingly-stale slide
  3. New `IMPORTED`-branch logic in both `slideGroupMaterializer.ts` and `slideshowAssembler.ts` reconciles the render count against the parsed-slide count rather than assuming they agree — proven by a test covering the documented count-disagreement case
  4. `sourceSignature` for an IMPORTED group folds in render status, so the existing rebuild-on-mismatch mechanism fires exactly once when a render transitions pending → ready

**Plans**: TBD
**UI hint**: yes
**Research flag**: needs research — render-count-vs-parsed-count reconciliation across two files plus `sourceSignature`; this item has already slipped one full milestone (v1.4 Phase 37 shipped the backend only), so treat the stated success criteria as the explicit definition of done.
**Notes**: Not a URL swap. The rendered PNG IS the slide, drawn in the grid and the presenter; parsed text stays in the document for search and labels but is never drawn — per the owner's framing, "import the powerpoint so that the slides look like they natively looked in the powerpoint presentation." The Cloud Run render service itself is already deployed (v1.4 Phase 37, confirmed working against production 2026-08-06) — this phase is pure client-side consumption, with nothing new to deploy.

### Phase 43: Service Item Types

**Goal:** A planner has the right set of service item types — Announcements and Miscellaneous added, Message reduced to plain text, Hymn retired from the add-item palette — and every type exports to Planning Center as itself.
**Depends on**: Nothing — independent of the sharing and rules work
**Requirements**: R081, R082, R083, R084, R085
**Success Criteria** (what must be TRUE):

  1. A planner can add an Announcements item to a service and type free text into it
  2. A planner can add a Miscellaneous item to a service and type free text into it
  3. The Message item is a plain free-text box with no URL link field
  4. Hymn no longer appears in the add-item palette, while every existing Hymn item already in a saved service still renders, prints, and presents exactly as before — palette-only removal, no migration
  5. Exporting a service to Planning Center shows Announcements, Miscellaneous, and Message as themselves, never silently relabeled "Message" — `addSlotAsItem`'s unguarded if-chain gets an explicit branch for each, proven by test, since this is a silent-fallthrough trap the compiler's exhaustive-switch checking does not catch

**Plans**: TBD
**UI hint**: yes
**Research flag**: skip — compiler-guided, existing well-understood architecture (widening `SlotKind`, matching the pattern `IMPORTED` already set for exactly this trap).
**Notes**: Must land before or with Phase 44 — the template editor needs the final `SlotKind` set. Verify `npm run type-check` (the `vue-tsc --build` form, not `-p tsconfig.app.json` — see CLAUDE.md) is clean with the widened union, and document which existing switch-group each new kind joins.

### Phase 44: Default Service Template

**Goal:** A church defines the default set and order of items that make up a new blank service, and every new service is built from it.
**Depends on**: Phase 39 (org settings shape), Phase 43 (finalized item-type palette)
**Requirements**: R086, R087
**Success Criteria** (what must be TRUE):

  1. In Settings, a church can define the default set and order of items — using the full item-type palette Phase 43 finalized — that make up a new blank service, via a Services slide-out editor reusing existing slot primitives
  2. Creating a new blank service builds it from the church's template; `buildSlots()` becomes the fallback only when no template is set
  3. When Vertical Worship mode is on, the song slots in that template receive their required VW types from the chosen progression at creation time — VW typing is computed then, never frozen into the stored template, so toggling VW mode later never leaves stale types behind on an already-created service

**Plans**: TBD
**UI hint**: yes
**Research flag**: skip — reuses existing slot primitives verbatim; the one consumption site is `createService`.
**Notes**: The org template replaces `buildSlots()` as the source of a new blank service's structure; `buildSlots()` itself survives as the fallback default rather than the authority.

### Phase 45: ESV/NLT Bible Version Selection

**Goal:** A church chooses its scripture source — ESV or NLT — with correct attribution everywhere scripture appears, and changing the setting never retroactively alters scripture already on a slide.
**Depends on**: Phase 39
**Requirements**: R090, R091, R092
**Success Criteria** (what must be TRUE):

  1. In Settings, a church can choose ESV or NLT as the source for scripture passages
  2. Every scripture display and projected slide carries its translation's required attribution — the initials "(ESV)" or "(NLT)" — built once and shared by the existing scripture-slide path and the new congregational-reading path
  3. Changing the translation setting never retroactively alters scripture on slides that already exist, because each slide records a per-slide translation-source field set at creation
  4. The NLT proxy (`key` query-parameter auth, `DOMParser`-based HTML-stripping — NLT's response is HTML, not JSON, so the ESV branch's header-injection code cannot be reused verbatim) is built and tested against a real sample fetched with the owner's key; it ships undeployed, with the exact `firebase deploy --only functions` command for the new branch handed to the owner

**Plans**: TBD
**UI hint**: yes
**Research flag**: needs research — NLT's exact response shape is LOW-MEDIUM confidence from a single manual fetch; verify against the owner's real key during planning before writing the stripping logic.
**Notes**: Precedes Phase 47 (congregational reading) since the divider operates on already-fetched, already-attributed scripture text.

### Phase 46: Global Slide Typography

**Goal:** A church sets one house font — family, weight, and size — for every slide, and the presenter never renders a visible fallback font.
**Depends on**: Phase 39
**Requirements**: R093, R094
**Success Criteria** (what must be TRUE):

  1. In Settings, a church can set one font family, weight, and size that applies to every slide
  2. The slide grid, the Edit Slide drawer preview, and the presenter view all render in the chosen font; the printed Order of Service is explicitly unaffected (owner-confirmed scope boundary — `ServicePrintLayout.vue` is a text document, not a slide)
  3. The presenter never shows a fallback font mid-service — first paint is gated on `document.fonts.ready` plus pre-measurement, closing off the font-flash failure mode
  4. The curated self-hosted `@fontsource/*` font list (Inter as the Helvetica Neue stand-in, plus the other curated families) ships with a recorded license for every family actually added, not assumed by analogy to Inter

**Plans**: TBD
**UI hint**: yes
**Research flag**: needs light research — the owner's two original open scope questions (text outline/shadow; print-surface inclusion) are already resolved (both declined/excluded, see REQUIREMENTS.md Out of Scope), so implementation scope is settled; SUMMARY's remaining research ask is projection-legibility validation of the curated list and per-family license verification, not scope discovery.
**Notes**: Curated self-hosted woff2 — deliberately not the runtime Google Fonts API, since a projector without internet at service time cannot fetch a remote font. Loosely precedes Phase 47 so the divider's slide preview reflects real typography settings, though not a hard dependency.

### Phase 47: Congregational Reading Divider UX

**Goal:** A user can hand-divide a scripture passage into Leader, Congregation, and All sections, with the AI-proposed split, one-click alternating assignment, and starting blank offered as equally-available starting points.
**Depends on**: Phase 39 (the AI toggle gates the AI-seeded option), Phase 45 (the translation/attribution the divider's text is drawn from). Benefits from typography being final, but does not require it.
**Requirements**: R095, R096, R097
**Success Criteria** (what must be TRUE):

  1. A user can divide a scripture passage into Leader, Congregation, and All sections by hand, placing the dividers themselves between verses — a click-between-verses editor plus per-segment label chips, not drag handles or free-range text selection (both evaluated and rejected — see FEATURES.md before designing this)
  2. The AI-proposed split, one-click alternating assignment, and starting blank all seed the same editable `{ text, role }[]` structure, and the AI option disappears entirely when the AI toggle (Phase 39) is off
  3. The first slide of a congregational reading shows the scripture reference; every later slide shows only the speaker label
  4. A refrain that recurs in non-adjacent segments can share the same speaker label

**Plans**: TBD
**UI hint**: yes
**Research flag**: needs research — no church-software precedent exists (ProPresenter, EasyWorship, and Proclaim all lack a documented leader/congregation split editor); treat the subtitle/caption-editor interaction-pattern analysis in FEATURES.md as required reading before designing.
**Notes**: This is the milestone's priority UI-research item per the owner's framing. Do not parallelize with Phase 39's AI-toggle work — both gate through `claudeApi.ts` — and sequence this phase after Phase 39, not alongside it.

### Phase 48: Multi-Image Ordering & Mobile Polish

**Goal:** Multi-image imports land in predictable order, and the Slides tab and the service edit screen work on a phone.
**Depends on**: Nothing (independent; sequenced last deliberately — benefits from no other phase still touching drag-and-drop order logic concurrently)
**Requirements**: R098, R099, R100, R101, R102, R103
**Success Criteria** (what must be TRUE):

  1. Dropping several images at once produces slides in filename natural order (`slide2` before `slide10`), via `Intl.Collator({ numeric: true, sensitivity: 'base' })` applied to `classifyFiles`'s image bucket in `dropRouting.ts` — proven by test
  2. The Slides tab and the service edit screen are usable on a phone-width viewport — audited first (the Slides tab's mobile-blocking layout was never independently audited during research), then fixed rather than assumed; touch-based slide reordering reuses the exact desktop SortableJS configuration with touch-only options added, not a reconfiguration, to avoid reproducing the documented `ZTXcpNRcJTalEQp42fTx` index bug
  3. Buttons stack vertically on the service edit screen on a phone, matching `QuarterView.vue`'s existing responsive button-stacking recipe on the Schedule screen
  4. Print and Share appear in the top contextual action bar on the Services screens instead of at the page bottom; Undo is a link beside the last-saved text rather than a button among the primary actions; the Getting Started panel on the dashboard can be dismissed

**Plans**: TBD
**UI hint**: yes
**Research flag**: skip for R098 (native `Intl.Collator`, a solved problem); audit-first (not full research) for R099-R103 — read the Slides tab's actual mobile-blocking layout before scoping the plan, rather than assuming the scope SUMMARY.md could not independently verify.
**Notes**: Merged from SUMMARY's separate Phase 49 (Multi-Image Import Ordering) and Phase 50 (Mobile & Layout Polish) — see the departure note above. Both were independently flagged low-risk and schedulable "wherever convenient" in SUMMARY.md; nothing in either's scope conflicts with the other.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4, 6-7 | v1.0 | 18/18 | Complete (archived) | 2026-03-05 |
| 8-17, 16.1 | v1.1 | all | Complete (archived) | 2026-07-24 |
| 18-23 | v1.2 | all | Complete (archived) | 2026-07-28 |
| 24-28 | v1.3 | 33/33 | Complete (archived) | 2026-07-28 |
| 29-38 | v1.4 | 61/61 | Complete (archived) | 2026-08-05 |
| 39. Org Settings Infrastructure & Feature Toggles | v1.5 | 6/6 | In Progress|  |
| 40. Custom Auth Claim for Org Membership | v1.5 | 4/4 | In Progress|  |
| 41. Sharing Correctness | v1.5 | 4/4 | In Progress|  |
| 42. PowerPoint Rendered-Image Display | v1.5 | 0/? | Not started | - |
| 43. Service Item Types | v1.5 | 0/? | Not started | - |
| 44. Default Service Template | v1.5 | 0/? | Not started | - |
| 45. ESV/NLT Bible Version Selection | v1.5 | 0/? | Not started | - |
| 46. Global Slide Typography | v1.5 | 0/? | Not started | - |
| 47. Congregational Reading Divider UX | v1.5 | 0/? | Not started | - |
| 48. Multi-Image Ordering & Mobile Polish | v1.5 | 0/? | Not started | - |

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
