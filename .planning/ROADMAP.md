# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- ✅ **v1.1** — Phases 8-17 (Planning Center, song catalog, volunteer scheduling)
- ✅ **v1.2 — Worship Service Slide Management** — Phases 18-23 (shipped 2026-07-28; owner acceptance, checkpoints waived)
- ✅ **v1.3 — Slides Tab Rework** — Phases 24-28 (shipped 2026-07-28; verified by owner)
- ✅ **v1.4 — Service and Slides** — Phases 29-38 (shipped 2026-08-05; owner acceptance, verification unrun)
- ✅ **v1.5 — Settings, Sharing, and Fidelity** — Phases 39-50 (shipped 2026-08-10; settings infra + feature toggles, custom auth claims, sharing correctness, PPTX rendered-image display, service item types, default template, ESV/NLT Bible version, slide typography, congregational reading, multi-image + mobile polish, bulk-delete/provenance/render-fidelity)
- 🔄 **v1.6 — Editing Reliability & Song Slides** — Phases 51-55 (in progress; Service Order editing-reliability bug fixes, default service template relocation, song-slide editing, service-item notes, preview/export polish)

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

### 🔄 v1.6 Editing Reliability & Song Slides (In Progress)

**Milestone Goal:** Fix the drag-and-drop corruption that plagues both the default template and real
service plans, move the service template to where it is actually used, and make song-slide editing
intuitive for a non-technical user — plus item-editing and preview polish.

**Requirements:** `.planning/REQUIREMENTS.md` (R110–R126, 17 total, 17/17 mapped)

**Derived from** `.planning/REQUIREMENTS.md` directly — there is no `research/SUMMARY.md` this milestone
(research was skipped: it is mostly bug-fixes and UI on patterns already in the codebase, and the
drag-and-drop root cause is best isolated by reading the actual reorder handlers during phase planning —
see STATE.md § "v1.4 RESEARCH FINDINGS"). Five phases under this project's `coarse` granularity setting.

The one hard, owner-instructed sequencing constraint (2026-08-11) drives the shape: the Service Order
editing-reliability bug fixes (**R110–R112**) are **Phase 51, first** — the most disruptive defect,
blocking trust in every other editing surface. The Default-Service-Template phase follows the reliability
fix because the template editor is itself a drag-and-drop surface (`ServiceTemplateEditor.vue` ports
`ServiceEditorView.vue`'s per-section SortableJS reorder), and R110 explicitly covers the
default-template editor too. Song Lyric Editing (R117–R121) is the largest new-build. The two smallest,
independent polish items groups are kept as coherent phases rather than split into thin ones: service-item
enhancements (R122–R123) as one phase, and the three unrelated preview/export/font polish items
(R124–R126) combined into one phase, per `coarse`.

- [ ] **Phase 51: Service Order Editing Reliability** - Kill the cross-section drag phantom-duplicate, the "No Section" save error, and the empty-body ordering defect — in both the template editor and the live service plan
- [ ] **Phase 52: Default Service Template** - Move the default template to the Services page behind a cog, rename it "Suggested Template", start every new service from it, and give template Miscellaneous items a body input
- [ ] **Phase 53: Song Lyric Editing** - Split song sections into slides by hand, duplicate a split as one unit, add Pre-Chorus, number sections by position, and rename the first-save button to "Save"
- [ ] **Phase 54: Service Item Enhancements** - A responsive notes field beside every item's selector, and Miscellaneous items that start with no slides
- [ ] **Phase 55: Preview & Export Polish** - Stop auto-appending the Bible version in preview, add a Planning Center export spinner, and add Roboto to the self-hosted slide fonts

## Phase Details

### Phase 51: Service Order Editing Reliability

**Goal:** Editing a service order — in both the default-template editor and a live service plan — never corrupts item state, and every item keeps its true order everywhere it appears.
**Depends on**: Nothing — first phase of this milestone (owner-instructed: sequenced first because it blocks trust in every other editing surface)
**Requirements**: R110, R111, R112
**Success Criteria** (what must be TRUE):

  1. Dragging a service item into a section places exactly one item in that section and leaves no phantom duplicate — proven in **both** the default-template editor **and** the live service plan; the second, undeletable "No Section" copy is gone (R110)
  2. Moving an item that is in a section back to "No Section" via the section dropdown saves successfully, with no save error (R111)
  3. The Services listing page and the public share link show every service item in the same order as the service edit screen, including items with an empty body (e.g. two blank Miscellaneous items) — the empty-bodied item no longer sorts to the bottom until text is typed (R112)
  4. All three symptoms stay fixed without a page refresh — the fix corrects the client/persisted-state desync at its source, rather than being masked by a reload

**Plans**: 4/4 plans executed

Plans:

- [x] 51-01-PLAN.md — R110 live-plan editor: RED cross-section drag repro + nonce-rebuild fix in `ServiceEditorView.vue`
- [x] 51-02-PLAN.md — R110 default-template editor: RED cross-section drag repro + nonce-rebuild fix in `ServiceTemplateEditor.vue`
- [x] 51-03-PLAN.md — R111 save-safety: RED store test + `stripUndefined` in the `updateService` funnel
- [x] 51-04-PLAN.md — R112 read-surface order: RED listing/share tests + route `ServiceCard` & `buildServiceSnapshot` through `orderSlotsBySection` (new `ServiceCard.test.ts`)

**UI hint**: yes
**Research flag**: skip (milestone research skipped) — but the root cause must be isolated by reading the live reorder handlers first, per STATE.md § "v1.4 RESEARCH FINDINGS" and CLAUDE.md's graph caveat. Write a failing reproduction test BEFORE changing code, exactly as the v1.4 drag-and-drop fix did.
**Notes**: v1.4 Phase 29 already rebuilt `ServiceEditorView.vue`'s reorder from a flat list into per-section SortableJS instances keyed on the stable `slot.id`, fixing the earlier `oldIndex`/`newIndex`, DOM-revert, and `v-for`-key bugs. R110–R112 are NEW symptoms that survive on top of that rebuild: a cross-section drag spawns a phantom "No Section" duplicate (R110); moving back to "No Section" via the dropdown throws a save error (R111); and an empty-bodied item serializes out of order on the listing/share surfaces (R112). All three clear on refresh → a client-state / persisted-state desync, not lost data. The same reorder machinery is copy-pasted in `SlideGrid.vue` — check both. R112 is an ordering/serialization defect on the read surfaces (Services listing + public share snapshot), likely an `orderBy`/sort that skips or mis-ranks empty-body items; keep the Phase 41 share-snapshot refresh path (v1.5) intact.

### Phase 52: Default Service Template

**Goal:** The default service template lives where it is used — on the Services page behind a cog — is the universal starting point for every new service, and can pre-fill recurring Miscellaneous content.
**Depends on**: Phase 51 — the template editor is itself a drag-and-drop surface (`ServiceTemplateEditor.vue` reuses `ServiceEditorView.vue`'s per-section SortableJS reorder), and R110 covers it explicitly, so it must inherit the reliability fix before it becomes the universal starting point. Builds on v1.5 Phase 44's template infrastructure and Phase 43's item-type palette.
**Requirements**: R113, R114, R115, R116
**Success Criteria** (what must be TRUE):

  1. A user opens the default-service-template editor from a cog/settings control on the **Services page**; it is no longer presented on the main Settings page (R113)
  2. The template's seed-order button reads **"Suggested Template"**, is shown whether or not Vertical Worship mode is on, and its label and availability carry no dependence on the 1-2-3 progression (R114)
  3. Creating a new service always starts it from the org's Suggested Template — there is no blank-template starting path — and with Vertical Worship mode on, the template's song slots still receive their required VW types at creation time (R115)
  4. A Miscellaneous item added **inside the template** exposes its body input box, so an org can pre-fill recurring content (canned music, standing announcement slides) into the default (R116)

**Plans**: 3/3 plans executed

Plans:

- [x] 52-01-PLAN.md — R115 + R116(util/type/store): `buildSuggestedTemplateEntries()` helper, `ServiceTemplateEntry.body?`, `createSlot` 4th body param, `buildSlotsFromTemplate` body threading, `createService` empty→suggested fallback (kept pure); reverse services `@489` empty→0 test (Wave 1)
- [x] 52-02-PLAN.md — R114 + R116(UI): rename seed button to "Suggested Template" (drop 1-2-3/VW copy, keep `template-reset` testid, `applyReset` via shared helper) + `template-item-body` textarea for MISC/ANNOUNCEMENTS rows (Wave 2, depends on 52-01)
- [x] 52-03-PLAN.md — R113: relocate editor to an editor-gated cog on ServicesView (new `ServicesView.test.ts`), remove the Services card + dead imports from SettingsView (Wave 1)

**UI hint**: yes
**Research flag**: skip (milestone research skipped) — reuses v1.5 Phase 44's `ServiceTemplateEditor.vue`, `OrgSettings.defaultServiceTemplate`, and `buildSlotsFromTemplate()`; the one behavioural change is R115's "always start from the template."
**Notes**: R115 **supersedes** v1.5 Phase 44's Success Criterion #2 ("no template → EMPTY service") — the Suggested Template becomes the universal starting point, decoupled from Vertical Worship (owner decision, PROJECT.md Key Decisions, "Blank service template eliminated"). Relocate the editor's mount from `SettingsView.vue`'s Services card to a cog on the Services page; rename the existing "Reset to 1-2-3 default"/"Default to 1,2,3" seed to "Suggested Template". R116 relies on the `MISC` slot's optional `body` field added in Phase 43; the template editor must expose the same body input the live editor uses for Miscellaneous items.

### Phase 53: Song Lyric Editing

**Goal:** Song-slide editing is intuitive for a non-technical user — split a section into slides by hand, duplicate a split as one unit, add Pre-Choruses, get position-based numbering, and a clearer first-save button.
**Depends on**: Phase 51 — R117/R118 build on the slide reorder/duplicate machinery whose reliability Phase 51 restores; sequenced after the foundational fix so the split/duplicate work is not built on the corrupting surface.
**Requirements**: R117, R118, R119, R120, R121
**Success Criteria** (what must be TRUE):

  1. A user can split any song lyric section (verse, chorus, pre-chorus, etc.) into multiple slides, manually choosing which lines land on each slide — e.g. an 8-line chorus divided into two 4-line slides (R117)
  2. Duplicating a section that has been split into multiple slides copies the whole multi-slide unit together, not a single slide (R118)
  3. Pre-Chorus is available as an addable song lyric item type alongside Verse and Chorus (R119)
  4. Song lyric sections are numbered by their position among sections of the same kind — the first verse is "Verse 1", a verse added after two existing verses is "Verse 3", and both slides of a split "Verse 1" stay "Verse 1"; no section is left unnumbered (R120)
  5. On a brand-new song being given lyrics for the first time, the paste-lyrics commit button reads **"Save"** rather than "Replace Lyrics" (R121)

**Plans**: 4/4 plans executed

Plans:

- [x] 53-01-PLAN.md — Pure model core (Wave 1): `slideBreaks?: number[]` on `LyricSection` + `sliceSectionIntoSlides` (R117) + `deriveSectionKind`/per-kind `displayLabel` numbering in `buildSectionRows` (R120) + `'Pre-Chorus'` in `ADD_SECTION_KINDS` (R119), RED-first in `songSectionOrder.test.ts`
- [x] 53-02-PLAN.md — Assembler wiring (Wave 2, depends 01): slice both lyric-emission sites in `slideshowAssembler.ts` (`${entry.id}:${i}`, unsplit byte-identical), dual-path lockstep + R118 duplicate proof + BWC (R117, R118)
- [x] 53-03-PLAN.md — Editor UI (Wave 2, depends 01): render `displayLabel` numbering (R120) + Pre-Chorus palette (R119) + manual click-between-lines split affordance writing `slideBreaks` (R117) in `SongLyricEditor.vue`
- [x] 53-04-PLAN.md — Paste button (Wave 1): first-paste commit button reads "Save" via `currentSectionCount === 0` in `LyricPasteRegion.vue` (R121)

**UI hint**: yes
**Research flag**: skip (milestone research skipped) — the design work is the manual split-slide assignment interface; R117/R118 are the core design decisions to settle during planning.
**Notes**: This is the milestone's largest new-build. The song lyric editor is `SongLyricEditor.vue`, reworked in v1.3 Phase 28 around `songSectionOrder.ts`'s pool+order model (one list that IS the slide order). Owner decision (PROJECT.md Key Decisions, "A split song section is one logical unit"): a split section's slides duplicate together and keep one position-based number, so the split never leaks into numbering (R120) or duplication (R118). R121's button is on `LyricPasteRegion.vue` (v1.4 Phase 35); the helper text already notes it replaces lyrics. AI auto-splitting is explicitly out of scope — R117 is manual only.

### Phase 54: Service Item Enhancements

**Goal:** Every service item can carry leader/parts notes in a consistent, responsive layout, and Miscellaneous items start clean with no slides.
**Depends on**: Phase 51 — R122 re-lays-out every item row in the same `ServiceEditorView.vue` surface Phase 51 stabilizes; sequenced after it to avoid reworking the item row twice.
**Requirements**: R122, R123
**Success Criteria** (what must be TRUE):

  1. Every service item exposes a plain-text notes field beside its selector (song selector, scripture selector, etc.) for recording who leads the item or who sings which parts, with a consistent layout across item types (R122)
  2. The selector and notes sit side-by-side on desktop and stack on small screens — a responsive layout that reuses the project's existing mobile-stacking recipe (R122)
  3. A newly added Miscellaneous item defaults to no slides, and slides can still be added to it when the user chooses (R123)

**Plans**: 2/2 plans executed

Plans:

- [x] 54-01-PLAN.md — R123: RED-first MISC-derives-nothing + BWC/hand-add-survival tests, then split `case 'MISC': return []` in `deriveGroupEntries` (Wave 1)
- [x] 54-02-PLAN.md — R122: `notes?` on `MediaAttachableSlot` + one shared `slot-notes-input` in a `flex flex-col sm:flex-row` wrapper at `ServiceEditorView.vue:891`, autosave/stripUndefined round-trip (Wave 1)

**UI hint**: yes
**Research flag**: skip (milestone research skipped).
**Notes**: R122 is a plain-text input for leader/parts notes — rich-text/formatting is explicitly out of scope. The responsive side-by-side/stacked layout can follow `QuarterView.vue`'s existing button/field stacking recipe, the same pattern v1.5 Phase 48 reused for the service edit screen. R123's Miscellaneous item is the `MISC` slot kind from v1.5 Phase 43; "default to no slides" means its materialized slide group starts empty, with slide-add still available.

### Phase 55: Preview & Export Polish

**Goal:** Three small, independent refinements — cleaner scripture slides in preview, visible export progress, and one more curated slide font.
**Depends on**: Nothing — independent polish, sequenced last; none of these three items touches the editing-reliability, template, or song-editing surfaces.
**Requirements**: R124, R125, R126
**Success Criteria** (what must be TRUE):

  1. The slideshow preview no longer auto-appends the Bible version (ESV/NLT) to scripture slides; the version can still be added to a slide manually if desired (R124)
  2. The Planning Center export shows a spinner / in-progress indicator while the export is running, so the user can see it is working (R125)
  3. Roboto is available as a curated, self-hosted slide font in the typography picker, and Inter (shipped in v1.5) remains available (R126)

**Plans**: 1/3 plans executed

Plans:

- [x] 55-01-PLAN.md — R124: re-point suffix tests to ABSENCE, then remove the auto-appended version at both render sites (`slideDisplay.ts::slideBodyText`, `PresentationViewer.vue::scriptureAttributionSuffix`) + dead imports; provenance helpers kept green (Wave 1)
- [ ] 55-02-PLAN.md — R125: RED spinner test, then add the `animate-spin` glyph (`data-testid="export-spinner"`) to the Confirm Export button, reusing the existing `isExporting` flag/guards (Wave 1)
- [ ] 55-03-PLAN.md — R126: legitimacy checkpoint + `npm install @fontsource/roboto@^5.3.0`, add the Roboto `SLIDE_FONTS` entry + loader line, update registry tests five→six (Wave 1)

**Research flag**: skip (milestone research skipped).
**Notes**: R124 partially reverses v1.5 Phase 45's auto-attribution — R091 appended the "(ESV)"/"(NLT)" suffix at both render sites (`PresentationViewer.vue`, `slideDisplay.ts::slideBodyText()`). R124 removes the *automatic* append in preview while leaving manual addition possible; reconcile carefully with the R091/R092 attribution and per-slide `translationSource` provenance machinery so this does not regress required attribution elsewhere. R125's export flow lives in `ServiceEditorView.vue`. R126 adds Roboto to the `SLIDE_FONTS` @fontsource registry from v1.5 Phase 46 (curated self-hosted woff2 only — not the runtime Google Fonts API), with a recorded license, and confirms Inter stays in the set.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4, 6-7 | v1.0 | 18/18 | Complete (archived) | 2026-03-05 |
| 8-17, 16.1 | v1.1 | all | Complete (archived) | 2026-07-24 |
| 18-23 | v1.2 | all | Complete (archived) | 2026-07-28 |
| 24-28 | v1.3 | 33/33 | Complete (archived) | 2026-07-28 |
| 29-38 | v1.4 | 61/61 | Complete (archived) | 2026-08-05 |
| 39-50 | v1.5 | all | Complete (archived) | 2026-08-10 |
| 51. Service Order Editing Reliability | v1.6 | 4/4 | In Progress|  |
| 52. Default Service Template | v1.6 | 3/3 | In Progress|  |
| 53. Song Lyric Editing | v1.6 | 4/4 | In Progress|  |
| 54. Service Item Enhancements | v1.6 | 2/2 | In Progress|  |
| 55. Preview & Export Polish | v1.6 | 1/3 | In Progress|  |

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
