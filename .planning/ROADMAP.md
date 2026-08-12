# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- ✅ **v1.1** — Phases 8-17 (Planning Center, song catalog, volunteer scheduling)
- ✅ **v1.2 — Worship Service Slide Management** — Phases 18-23 (shipped 2026-07-28; owner acceptance, checkpoints waived)
- ✅ **v1.3 — Slides Tab Rework** — Phases 24-28 (shipped 2026-07-28; verified by owner)
- ✅ **v1.4 — Service and Slides** — Phases 29-38 (shipped 2026-08-05; owner acceptance, verification unrun)
- ✅ **v1.5 — Settings, Sharing, and Fidelity** — Phases 39-50 (shipped 2026-08-10; settings infra + feature toggles, custom auth claims, sharing correctness, PPTX rendered-image display, service item types, default template, ESV/NLT Bible version, slide typography, congregational reading, multi-image + mobile polish, bulk-delete/provenance/render-fidelity)
- ✅ **v1.6 — Editing Reliability & Song Slides** — Phases 51-57 (shipped 2026-08-12; drag-and-drop editing reliability, service-template relocation, song-slide splitting, service-item notes + MISC labels + per-item Scripture version, preview/export polish, template-editor UX parity)

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
