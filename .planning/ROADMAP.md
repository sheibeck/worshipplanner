# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- ✅ **v1.1** — Phases 8-17 (Planning Center, song catalog, volunteer scheduling)
- ✅ **v1.2 — Worship Service Slide Management** — Phases 18-23 (shipped 2026-07-28; owner acceptance, checkpoints waived)
- ✅ **v1.3 — Slides Tab Rework** — Phases 24-28 (shipped 2026-07-28; verified by owner)
- 🔄 **v1.4 — Service and Slides** — Phases 29-37 (in progress; ordering fixes, slide-mirror hard lock, draft lock, save reliability, backgrounds, LLM scripture split, presentation correctness, UI rework, PPTX rendering)

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

### 🔄 v1.4 Service and Slides (In Progress)

**Milestone Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you
can see, slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Requirements:** `.planning/REQUIREMENTS.md` (R036–R069, 34 total)

- [x] **Phase 29: Order Structure — Stable Reordering & Post-Service** - Fix the drag-and-drop root cause and add the fifth Post-Service section (completed 2026-07-28)
- [x] **Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed** - Delete the reconcile/confirm flow; slide groups always mirror the service order (completed 2026-07-29)
- [ ] **Phase 31: Service Lifecycle — Draft Lock & Reopen** - Draft-only editing with a genuine three-layer lock and an explicit Reopen path
- [ ] **Phase 32: Save Reliability — Autosave Fix & Persistent Status** - Fix the song-change autosave bug and give every surface a persistent save indicator
- [ ] **Phase 33: Backgrounds & Slide Editing** - Backgrounds at group/slide/song level and a split 3-dot Edit Slide menu
- [ ] **Phase 34: Smarter Content — LLM Scripture Split** - LLM-assisted congregational reading splits, index-only, never regenerating scripture text
- [ ] **Phase 35: Presentation Correctness & Lyric Editor** - No organizational labels when presenting, CCLI on first+last slide, inline paste-lyrics warnings
- [ ] **Phase 36: UI Rework — Service Order & Contextual Action Bars** - Rebuild the Service Order tab and apply one contextual action bar across every tab
- [ ] **Phase 37: PowerPoint Server-Side Rendering** - Render imported PowerPoint decks server-side to true-fidelity images

## Phase Details

### Phase 29: Order Structure — Stable Reordering & Post-Service

**Goal:** Service items and slides reorder reliably and land exactly where dropped, and a fifth Post-Service section exists for content that runs as people exit.
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: R042, R043, R044, R049, R050
**Success Criteria** (what must be TRUE):

  1. Dragging a service item to a new position lands it exactly there immediately, with no page refresh needed to see the correct order
  2. The five service sections (Pre-Service, Worship, Message, Sending, Post-Service) always render in that fixed order, are never themselves draggable, and stay visible even when empty
  3. Dragging a slide within the Slides tab persists its new position without reverting
  4. Adding a new slide appends it to the true end of its group, not before the last slide

**Plans**: 5/5 plans executed
Plans:

- [x] 29-01-PLAN.md — Failing repro FIRST: header-inclusive fixtures, DOM-derived drag helper, identity-based assertions (wave 1)
- [x] 29-02-PLAN.md — Pure section-ordering helpers in slotTypes.ts + defaultSectionForPosition audit (wave 1)
- [x] 29-03-PLAN.md — ServiceEditorView: per-section containers, stable slot.id key, correct onEnd, save-failure revert (wave 2)
- [x] 29-04-PLAN.md — SlideGrid: draggable-scoped indices, one append contract, visible reorder failure (wave 2)
- [x] 29-05-PLAN.md — Add the fifth Post-Service section, audit four consumers, human-verify a real drag (wave 3)

**UI hint**: yes
**Research flag**: standard pattern — root cause and fix already fully derived with line-level citations (SUMMARY.md/ARCHITECTURE.md §1); no dedicated research pass needed.
**Notes**: The existing D-16 DOM-revert fix (`ServiceEditorView.vue:1430`, `SlideGrid.vue:669`) already works and must NOT be re-applied or "re-fixed" — the two open defects are (a) `evt.oldIndex`/`evt.newIndex` used where `oldDraggableIndex`/`newDraggableIndex` are required (section-header DOM nodes are still counted despite the `draggable: '.slot-item'` selector), and (b) the `v-for` key (`slot.kind + '-' + slot.position`) being unstable across every reorder since `reindexSlots()` rewrites `position` on every mutation — re-key on `slot.id`. Land the index-source/per-section fix against the existing four sections first, THEN add `'post-service'` as the fifth section — proving the mechanism before widening it. The same root-cause fix explains both `ServiceEditorView.vue`'s reorder bug and `SlideGrid.vue`'s "new slide lands second-to-last" bug (R049/R050) — one fix, two files. Audit print/share/plan-rail/Planning-Center-export for hard-coded four-section assumptions when Post-Service is added (Pitfall 9).

### Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed

**Goal:** Slide-group order and membership are hard-locked to the service order, with the reconcile/confirm review flow deleted entirely.
**Depends on**: Phase 29
**Requirements**: R045, R046, R047, R048, R054
**Success Criteria** (what must be TRUE):

  1. Reordering a service item automatically reorders its slide group in the Slides tab — no second manual step
  2. Swapping a song on a service item silently rewrites that group's slides to the new song, with no confirmation prompt
  3. Changing a scripture passage updates its scripture slide automatically, defaulting to one slide carrying the passage
  4. No reconcile/confirm modal or banner ever appears in the Slides tab — every change rebuilds unconditionally
  5. Song groups in the Slides tab are read-only — a planner cannot create, edit, delete, or reorder a song's slides there

**Plans**: 4/4 plans executed
Plans:

- [x] 30-01-PLAN.md — Strip the confirm surface: prop chain, banner, modal, decline store action (wave 1)
- [x] 30-02-PLAN.md — Unconditional idempotent rebuild; survival generalized to all kinds; scripture reference-only (wave 2)
- [x] 30-03-PLAN.md — Song groups read-only in drawer and grid, after repointing the SONG test fixture (wave 3)
- [x] 30-04-PLAN.md — Permutation property test for the order lock, membership lock, removal gate, human-verify (wave 4)

**UI hint**: no
**Research flag**: needs research — graph-trace the full reconciliation consumer inventory (`SlideGroup.dismissedSignature`, `ReconcileResult`, `reconcileSongGroup`, `ReconcileConfirmModal`, and every static AND dynamic import of them) before deleting anything; spans 9 files plus tests.
**Notes**: `dismissedSignature` is a persisted Firestore field on existing `SlideGroup` documents — record explicitly whether it's left-and-ignored (consistent with D-19, since it was never seen in production) or backfilled; don't let the decision happen by omission. Keep the concurrent-write transaction merge in `replaceGroupSlides` — that generic conflict guard is unrelated to the confirm UX and is still needed once writes become unconditional. Delete the reconciliation test suite entirely (not `describe.skip`); confirm the post-removal failing-file-set doesn't grow past the documented 10-file baseline.

### Phase 31: Service Lifecycle — Draft Lock & Reopen

**Goal:** A service is editable only in Draft; Service Order, Slides and Roles all lock at planned/exported, with an explicit "Reopen for editing" path back.
**Depends on**: Phase 29
**Requirements**: R036, R037, R038
**Success Criteria** (what must be TRUE):

  1. A service can only be edited (Service Order, Slides, and Roles) while its status is Draft; a direct write attempt against a non-draft service — bypassing the UI — is rejected
  2. An editor can explicitly "Reopen for editing" a Planned or Exported service, returning it to Draft
  3. Reopening a service that was already exported to Planning Center shows a warning that Planning Center still holds the previously exported version; reopening a never-exported service does not show that warning
  4. Creating a new service defaults its date to the nearest Sunday that doesn't already have a service plan

**Plans**: TBD
**UI hint**: yes
**Research flag**: needs research — Firestore rules field-level diff logic for the reopen-transition special case (the rule must read `resource.data.status`, not `request.resource.data.status`, and must carve out an explicit allowance for the one status-reverting write).
**Notes**: `firestore.rules` has ZERO status-based write guard today (role-only) — this is the only genuinely adversary-proof layer, so build it first, then the Pinia store guard (defense-in-depth), then centralize the ~15-repetition UI-only `isExportedLocked` pattern into one `isEditable` computed. Any Cloud Function that writes to `services`/`slideGroups` needs its own explicit status check — the Admin SDK bypasses Firestore rules entirely. Extend `firestore.rules.test.ts`, don't just add UI tests. Sequence the rules change carefully against Phase 29's drag-drop-immediate-save path — a reorder mid-flight during a status transition needs the same rule to hold.

### Phase 32: Save Reliability — Autosave Fix & Persistent Status

**Goal:** Every mutation on the Service Order reliably fires autosave, and the whole app has one persistent inline save-status indicator.
**Depends on**: Phase 29
**Requirements**: R039, R040, R041
**Success Criteria** (what must be TRUE):

  1. Changing a song on a service item reliably triggers a save, including immediately after a prior save's own echo lands
  2. Every surface with autosave shows a persistent inline "Saving… / Saved HH:MM" status anchored to the content being edited, visible without scrolling
  3. A save failure raises a toast; a save success does not

**Plans**: TBD
**UI hint**: yes
**Research flag**: standard pattern — fix shape is well-evidenced; only needs repro-test-first discipline.
**Notes**: Write the failing repro test FIRST. The root cause (a save's own Firestore echo carrying a server `updatedAt` the client never tracked, resetting the `autosaveInitialized` guard and swallowing the next discrete mutation) is MEDIUM confidence and has never been reproduced against the live app — do not rewrite blind. Build one `useSaveStatus` Pinia aggregator sitting ABOVE the existing, already-tested `useAutoSave` composable (not replacing it); migrate `ServiceEditorView.vue` off its hand-duplicated ~150-line inline autosave onto `useAutoSave` once the root cause is confirmed. `AutoSaveStatus` needs a fifth `'error'` state — today's type has no failure state at all.

### Phase 33: Backgrounds & Slide Editing

**Goal:** Background images can be set at group, slide, and song level, and slide editing moves to an explicit 3-dot menu with type-appropriate options.
**Depends on**: Phase 30
**Requirements**: R055, R056, R057, R058, R051, R052, R063
**Success Criteria** (what must be TRUE):

  1. A background image can be set for an entire slide group, for one individual slide (overriding the group's), or for a song from the Song Lyrics editor — **most specific wins**: a slide's own background beats its group's, which beats the song's, mirroring the existing slide-beats-bed audio precedence
  2. Per-slide audio no longer offers a "whole group" scope option; group-wide audio is set only at the group level
  3. A slide only enters edit mode via an explicit 3-dot menu action, never by clicking the slide itself
  4. The 3-dot menu opens separate "Edit details" and "Edit lyrics" drawers instead of one multi-tab drawer
  5. The editing options offered for a slide vary by the service-item type it belongs to — a scripture item offers options a song item does not

**Plans**: TBD
**UI hint**: yes
**Research flag**: standard pattern — directly extends an existing precedent (audio's slide-beats-bed cascade); no new libraries.
**Notes**: Add `backgroundImageUrl?: string` at three levels — `GroupSlideEntry` (per-slide), `SlideGroup` (group), `SongLyrics` (song, greenfield, no migration) — resolved wherever `assembleSlideshow` already resolves `audioUrl` per slide. The "Edit lyrics" drawer applies only to hand-authored text slides (PRAYER/MESSAGE/blank), never SONG-group lyric entries, which stay read-only here and route to "Edit in song" (R054, Phase 30). Confirm against the Claude Design wireframes at plan time which drawer a given slide's 3-dot menu opens.

### Phase 34: Smarter Content — LLM Scripture Split

**Goal:** A scripture item can be split into a leader/congregation congregational reading, with scripture correctness structurally guaranteed.
**Depends on**: Nothing new (independent within v1.4)
**Requirements**: R064
**Success Criteria** (what must be TRUE):

  1. A scripture item can be split into a leader/congregation congregational reading
  2. Displayed scripture text is always byte-identical to the already-fetched ESV source — the model returns only indices/speaker labels, never regenerated words
  3. Splits fall only on clause/verse boundaries, never mid-sentence
  4. If the split call fails, the scripture slide still renders and remains usable — the feature never blocks editing

**Plans**: TBD
**UI hint**: no
**Research flag**: needs research — re-verify the current `@anthropic-ai/sdk` version and `output_config.format` call shape at implementation time (consult the `claude-api` skill again, details may have drifted); validate Haiku split determinism empirically against real passages.
**Notes**: Upgrading `@anthropic-ai/sdk` from the current `^0.78.0` pin is a hard prerequisite — it predates the structured-outputs support this feature depends on; schedule the upgrade as the first task in this phase. Never let the model regenerate or re-type scripture text — constrain output to structural indices/spans only, validated against a strict schema at the existing single Cloud Function proxy choke point, and treat any offset that fails to byte-match the source as a hard validation failure with fallback, never a silent near-match. Haiku-tier, consistent with the app's existing cost-efficient-model precedent; AI remains additive and never blocking.

### Phase 35: Presentation Correctness & Lyric Editor

**Goal:** Presented slideshows never leak organizational labels and always carry copyright where required, and lyric paste gets a copyright warning and an inline treatment.
**Depends on**: Phase 30
**Requirements**: R059, R060, R061, R065, R066
**Success Criteria** (what must be TRUE):

  1. Organizational labels never appear when presenting or previewing a slideshow
  2. Copyright/CCLI information is visible on both the first and last slide of every song group
  3. Starting the presentation begins at the highlighted group and slide, or that group's first slide when none is highlighted
  4. Pasting lyrics warns when copyright information is missing rather than accepting silently
  5. Pasting lyrics happens inline in the editor, not in a modal

**Plans**: TBD
**UI hint**: yes
**Research flag**: standard pattern for R059/R061 (presentation-layer read of already-assembled data); see Notes for R060's documentation-language caveat.
**Design source**: Claude Design project "Worship Planner Slideshow Design" (`e8e6c287-3e88-402f-88e1-7ad6d5101fa2`), read via DesignSync (`/design-login` if unauthorized) — R066's inline paste-lyrics treatment is specified in the wireframes referenced from `Slides Tab.dc.html`/`support.js`.
**Notes**: R060 exceeds the documented legal minimum (the real-world convention is at least once per song, typically the last slide) — first-AND-last is a deliberate safety margin for mid-deck starts and songs cut short. Do NOT justify it as "CCLI requires this" in any UI copy or code comment; CCLI's own primary license text was never successfully retrieved this research pass (the site returned marketing copy) and should be pulled before treating this as legally final language.

### Phase 36: UI Rework — Service Order & Contextual Action Bars

**Goal:** The Service Order tab is rebuilt against the Claude Design wireframes, and one contextual action-bar pattern is applied across every tabbed screen.
**Depends on**: Phase 31, Phase 33
**Requirements**: R067, R068, R069, R053
**Success Criteria** (what must be TRUE):

  1. The Service Order tab matches the Claude Design "Turn 3 — Service Order tab" wireframes
  2. Every tabbed screen (Service Order, Slides, Roles) shows only the actions relevant to that tab through one shared contextual action-bar pattern — "Suggest All Songs"/"Copy to PC" no longer appear on the Slides or Roles tabs
  3. The Present button appears in the position specified by design "1a Plan rail · slide grid · Edit Slide drawer — two states"
  4. "Add slide" and "Add music to this group" live in the contextual action bar, and a group's own drag-and-drop zone doubles as the import affordance — the separate "Import into this Group" button is gone
  5. The Roles tab is last in the tab order

**Plans**: TBD
**UI hint**: yes
**Research flag**: standard/UI-heavy — no deep technical uncertainty, but real sequencing risk: this phase must land LAST among UI work, after Phase 31's Service Order layout and Phase 33's Slides layout both finalize, or the action bar needs rework.
**Design source**: Claude Design project "Worship Planner Slideshow Design" (`e8e6c287-3e88-402f-88e1-7ad6d5101fa2`), read via DesignSync (`/design-login` if unauthorized) — the Service Order rebuild is "Turn 3 — Service Order tab"; the Present button placement is "1a Plan rail · slide grid · Edit Slide drawer — two states."
**Notes**: This phase is explicitly sequenced last among the milestone's UI work — R068 depends on R067 and the Slides tab layout (Phase 33) both being final, and R053's "move Add slide/Add music into the contextual action bar" only makes sense once that action bar exists, which is why R053 is grouped here rather than with the rest of Slides interaction (Phase 29/33). This is a deliberate departure from a literal reading of the "Slides Interaction" requirement category — R053's own text names R068 as its target.

### Phase 37: PowerPoint Server-Side Rendering

**Goal:** Imported PowerPoint decks render server-side to true-fidelity images, retaining parsed text as a searchable layer.
**Depends on**: Nothing (independent — deliberately scheduled last per user decision, so an overrun or cut cannot disturb the other 33 requirements)
**Requirements**: R062
**Success Criteria** (what must be TRUE):

  1. An imported PowerPoint deck displays as a true visual rendering of each slide — backgrounds, fonts, layout, effects — not text alone
  2. Extracted text remains available as a searchable/label layer alongside the rendered image
  3. Only metric-compatible open fonts (Carlito/Caladea/Liberation) are used server-side; no Microsoft fonts are bundled
  4. Orphan cleanup for failed renders defaults to dry-run/report-only

**Plans**: TBD
**UI hint**: no
**Research flag**: needs research — highest-uncertainty item in the milestone; needs a real multi-font, multi-slide test deck and cost/latency validation, not a 2-slide fixture.
**Notes**: Standalone Cloud Run service (custom Dockerfile, LibreOffice + Poppler) — Firebase Functions buildpacks cannot install these; a new Cloud Function bridges via service-to-service IAM auth, invoked asynchronously with a completeness check (only flip the deck to "ready" once every expected image is confirmed uploaded). Rendered images land under the existing `orgs/{orgId}/pptx-imports/{importId}/rendered/` prefix — sibling to `images/`, structurally exempt from `cleanupExpiredMedia`'s regex guard with zero changes to that function. Any new deletion path this introduces must default to dry-run — the inverse default already caused a real incident in this codebase (`cleanupExpiredMedia`'s doc-comment-vs-code-default mismatch, fixed 2026-07-28). **User decision:** kept in v1.4 but scheduled deliberately last so an overrun or cut disturbs nothing else.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4, 6-7 | v1.0 | 18/18 | Complete (archived) | 2026-03-05 |
| 8-17, 16.1 | v1.1 | all | Complete (archived) | 2026-07-24 |
| 18-23 | v1.2 | all | Complete (archived) | 2026-07-28 |
| 24-28 | v1.3 | 33/33 | Complete (archived) | 2026-07-28 |
| 29. Order Structure — Stable Reordering & Post-Service | v1.4 | 5/5 | Complete    | 2026-07-28 |
| 30. Slides Mirror the Plan — Hard Lock & Reconciliation Removed | v1.4 | 4/4 | Complete    | 2026-07-29 |
| 31. Service Lifecycle — Draft Lock & Reopen | v1.4 | 0/TBD | Not started | - |
| 32. Save Reliability — Autosave Fix & Persistent Status | v1.4 | 0/TBD | Not started | - |
| 33. Backgrounds & Slide Editing | v1.4 | 0/TBD | Not started | - |
| 34. Smarter Content — LLM Scripture Split | v1.4 | 0/TBD | Not started | - |
| 35. Presentation Correctness & Lyric Editor | v1.4 | 0/TBD | Not started | - |
| 36. UI Rework — Service Order & Contextual Action Bars | v1.4 | 0/TBD | Not started | - |
| 37. PowerPoint Server-Side Rendering | v1.4 | 0/TBD | Not started | - |

## Backlog

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
