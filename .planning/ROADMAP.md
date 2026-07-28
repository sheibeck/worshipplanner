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

### 📋 v1.1 (Planned)

- [x] Phase 8: Planning Center API Export (3 plans) (completed 2026-03-05)
- [x] Phase 9: PC Song Import & Tag Management (3 plans) (completed 2026-03-12)

### 🔄 v1.4 Service and Slides (In Progress)

**Milestone Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you
can see, slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Requirements:** `.planning/REQUIREMENTS.md` (R036–R069, 34 total)

- [ ] **Phase 29: Order Structure — Stable Reordering & Post-Service** - Fix the drag-and-drop root cause and add the fifth Post-Service section
- [ ] **Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed** - Delete the reconcile/confirm flow; slide groups always mirror the service order
- [ ] **Phase 31: Service Lifecycle — Draft Lock & Reopen** - Draft-only editing with a genuine three-layer lock and an explicit Reopen path
- [ ] **Phase 32: Save Reliability — Autosave Fix & Persistent Status** - Fix the song-change autosave bug and give every surface a persistent save indicator
- [ ] **Phase 33: Backgrounds & Slide Editing** - Backgrounds at group/slide/song level and a split 3-dot Edit Slide menu
- [ ] **Phase 34: Smarter Content — LLM Scripture Split** - LLM-assisted congregational reading splits, index-only, never regenerating scripture text
- [ ] **Phase 35: Presentation Correctness & Lyric Editor** - No organizational labels when presenting, CCLI on first+last slide, inline paste-lyrics warnings
- [ ] **Phase 36: UI Rework — Service Order & Contextual Action Bars** - Rebuild the Service Order tab and apply one contextual action bar across every tab
- [ ] **Phase 37: PowerPoint Server-Side Rendering** - Render imported PowerPoint decks server-side to true-fidelity images

## Phase Details

### Phase 8: Planning Center API Export

**Goal:** Export published (locked) service plans to Planning Center via the Services API — creating a plan with sermon scripture as title, adding songs/hymns as Song items and scriptures as Item entries
**Depends on**: Phase 4
**Requirements**: PC-SC1, PC-SC2, PC-SC3, PC-SC4, PC-SC5, PC-SC6
**Success Criteria** (what must be TRUE):

  1. When a service plan is published/locked, an "Export to Planning Center" button replaces the "Copy for PC" button
  2. Clicking export creates a new Plan in Planning Center for the service date with the sermon scripture reference as the plan title, appending special info in parens (e.g., "Revelation 12 (Choir)")
  3. Each song/hymn slot is added as a Song item in the Planning Center plan
  4. Each scripture slot is added as an Item with the scripture text in the item description
  5. User sees success/failure feedback after export completes
  6. Planning Center API credentials (App ID + Secret) are configured in app settings

**Plans:** 3/3 plans complete

Plans:

- [x] 08-01-PLAN.md — PC API client utility, Service type extension, Vite dev proxy
- [x] 08-02-PLAN.md — Settings UI for PC credentials and service type selection
- [x] 08-03-PLAN.md — Export flow in ServiceEditorView with button, feedback, and exported state

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-04 |
| 2. Song Library | v1.0 | 3/3 | Complete | 2026-03-04 |
| 3. Service Planning | v1.0 | 5/5 | Complete | 2026-03-04 |
| 4. Output | v1.0 | 2/2 | Complete | 2026-03-04 |
| 6. AI Assisted Service Suggesting | v1.0 | 4/4 | Complete | 2026-03-04 |
| 7. Invite & RBAC | v1.0 | 2/2 | Complete | 2026-03-04 |
| 5. Collaboration, Tasks & Events | v1.1 | 0/TBD | Not started | - |
| 8. Planning Center API Export | 3/3 | 3/3 | Complete    | 2026-07-13 |
| 9. PC Song Import & Tag Management | 3/3 | 3/3 | Complete    | 2026-07-13 |
| 29. Order Structure — Stable Reordering & Post-Service | v1.4 | 0/TBD | Not started | - |
| 30. Slides Mirror the Plan — Hard Lock & Reconciliation Removed | v1.4 | 0/TBD | Not started | - |
| 31. Service Lifecycle — Draft Lock & Reopen | v1.4 | 0/TBD | Not started | - |
| 32. Save Reliability — Autosave Fix & Persistent Status | v1.4 | 0/TBD | Not started | - |
| 33. Backgrounds & Slide Editing | v1.4 | 0/TBD | Not started | - |
| 34. Smarter Content — LLM Scripture Split | v1.4 | 0/TBD | Not started | - |
| 35. Presentation Correctness & Lyric Editor | v1.4 | 0/TBD | Not started | - |
| 36. UI Rework — Service Order & Contextual Action Bars | v1.4 | 0/TBD | Not started | - |
| 37. PowerPoint Server-Side Rendering | v1.4 | 0/TBD | Not started | - |

### Phase 9: PC Song Import & Tag Management

**Goal:** Replace CSV song import with Planning Center API import — fetch songs with tags, map arrangement titles (Orchestra→tag), support soft-delete (hide/unhide songs), map PC Categories 1-3 to Types 1-3, import Last Scheduled dates, and preserve existing song catalog on first import
**Requirements**: soft-delete, hidden-exclusion, re-import-safe, upsert-store, pc-api-fetch, tag-import, category-to-type-mapping, last-scheduled-mapping, orchestra-tag, replace-csv-import, import-preview, view-restore-hidden, no-pc-credentials-guard
**Depends on:** Phase 8
**Plans:** 3/3 plans complete

Plans:

- [x] 09-01-PLAN.md — Song type + store: pcSongId/hidden fields, soft-delete, restoreSong, upsertSongs
- [x] 09-02-PLAN.md — PC import utility: fetchAllPcSongs, mapPcSongToUpsert, importFromPc (TDD)
- [x] 09-03-PLAN.md — UI: PcImportModal, hidden songs panel, restore flow, SongsView wiring

### Phase 10: Worship song export naming, template import improvements, auto-add teams on import, orchestra filter for song suggestions

**Goal:** Four focused improvements to Planning Center export and song suggestions: (1) prefix all PC-exported song/hymn item titles with "Worship Song - "; (2) when exporting to an existing PC plan, delete matched "Worship Song"/"Scripture Reading" placeholders and recreate the real items at their original sequence while removing any unmatched placeholders; (3) show PC Teams for the selected service type as checkboxes in the export dialog with case-insensitive auto-match against WorshipPlanner service teams, and add the checked teams to the plan on export (non-fatal); (4) replace the Orchestra hard-filter in song suggestions with a +200 scoring bonus so non-orchestra songs still appear but orchestra-tagged songs rank higher, dim non-orchestra songs with opacity-50 in the SongSlotPicker, and filter the AI-suggested songLibrary to orchestra-tagged songs only when the service has Orchestra as a team.
**Requirements**: FEAT-1, FEAT-2, FEAT-3, FEAT-4a, FEAT-4b, FEAT-4c, FEAT-4-ai
**Depends on:** Phase 9
**Plans:** 3/3 plans complete

Plans:

- [x] 10-01-PLAN.md — planningCenterApi.ts: "Worship Song - " title prefix + deleteItem + fetchServiceTypeTeams + addTeamToPlan (with Vitest coverage)
- [x] 10-02-PLAN.md — suggestions.ts orchestra soft-bonus (+200) + SongSlotPicker.vue opacity-50 dimming and orchestra-first search sort
- [x] 10-03-PLAN.md — ServiceEditorView.vue: PC Teams fetch + checkbox UI + team-add on export + delete+recreate existing-plan rewrite + orchestra AI library filter

### Phase 11: Song catalog & service planner improvements

**Goal:** Make the song catalog fully browsable/searchable and make service-plan editing reliable — remove app-enforced constraints in favor of user control, surface song metadata everywhere, add tagging, and fix the drag-drop ordering/autosave data-integrity bugs.
**Requirements**: D-01..D-18 (see 11-CONTEXT.md — no formal REQ-IDs; the 18 decisions are the requirement set)
**Depends on:** Phase 10
**Plans:** 4/4 plans complete

Scope (from user request):

1. Service-plan song selector — fix pagination so the full catalog is browsable while scrolling (currently stops after a handful); remove the 1/2/3 song-type filter so any song can be picked in any slot (users apply the 1-2-3 paradigm themselves).
2. Themes — show song themes in the song list and the service-plan song browser; capture themes on Planning Center import.
3. Searchable metadata — display all song metadata in search results (key, theme, last played, tag, category, etc.) and allow searching on any field via the search bar.
4. BUG: drag-and-drop reordering unreliable — items snap back to original order in the UI (refresh shows correct order); reordering can corrupt Planning Center export order; autosave/save-timing bug where quick post-drag interactions don't persist and the save button highlights but autosave never fires.
5. AI song suggestions must exclude hidden (deleted) songs.
6. Allow sorting the song list by any column.
7. Tagging — let users tag songs in Worship Planner (e.g. "Christmas") and filter to hide songs by tag in both the song list and the service-planning search.
8. Require a confirmation before deleting an item from a service plan (avoid accidental scripture deletion when closing the preview).

Plans:

- [x] 11-01-PLAN.md — Data model + tag persistence + search + PC theme merge + TeamTagPill variants (Wave 1, foundation)
- [x] 11-02-PLAN.md — Editor reliability & safety: SortableJS snap-back, immediate reorder-save, stuck-dirty autosave, delete-confirm, AI hidden-filter (Wave 1)
- [x] 11-03-PLAN.md — Song catalog UX: all-column sort, themes/tags pills, tag editing (form/inline/bulk), hide/show tag filter (Wave 2)
- [x] 11-04-PLAN.md — Service planner picker: type-agnostic list, load-more batching, broad AI, tags pills + filter (Wave 2)

### Phase 12: Advanced song search and multi-select persistent tag filtering (picker + Songs panel)

**Goal:** Give users a robust, metadata-aware song search and a persistent multi-select tag filter across both the service-plan song picker and the Songs panel — so any song is findable by name or any known metadata, and tag filtering is fast and remembered.
**Requirements**: D-01..D-16 (see 12-CONTEXT.md — no formal REQ-IDs; the 16 decisions are the requirement set)
**Depends on:** Phase 11

Scope (from user request):

1. Robust search in ONE search box (both the service-plan picker `SongSlotPicker.vue` and the Songs panel `SongsView`/`SongTable`/`SongFilters`):
   - Bare natural terms match across metadata — "Type 1"/"Type 2" → song category (VW type); "Adoration" → themes; "Key A" → arrangement key; plus name/existing full-field search.
   - Explicit field-scoped/enforced filters for precision, combinable — e.g. `tag: Orchestra`, `key: E`, `type: 1`.
   - Builds on Phase 11's `songMatchesQuery` full-field search foundation.
2. Tag filter UI redesign — replace the two "Show only tag" / "Hide tag" dropdowns with a SINGLE list of all tags, each with a checkbox:
   - Default: show only checked tags. A top-level "Hide" checkbox inverts semantics so checked tags are hidden instead. A "Clear" option resets selections.
3. Persistence — remember the tag show/hide filter settings between song selections/searches (ideally across sessions) so users don't re-check boxes; "Clear" resets on demand, but default is to remember state. Applies to both picker and Songs-panel filters.
4. Delete-confirmation on the "Remove element" X — clicking the X that removes an element from a service plan must prompt a confirmation before actually deleting the element. NOTE for planner: Phase 11 D-14 already added a confirmation modal for deleting *populated* slots (song/scripture assigned) with silent delete for empty slots. Verify whether the "Remove element" X the user means is a distinct action (e.g. removing an entire element/row such as a Prayer/Message, or removing any element regardless of populated state) that D-14 did not cover — do not assume redundancy; close the actual gap.

Direct enhancement of the Phase 11 search + tag-filter work.

**Plans:** 8/8 plans complete

Plans:

- [x] 12-01-PLAN.md — Search engine (TDD): multi-term AND + field-scoped prefixes (type:/key:/tag:/theme:/team:) + natural phrase recognition in songSearch.ts
- [x] 12-02-PLAN.md — songs store: tag-filter checklist state (checked Set + Hide toggle) + clearTagFilter + per-user/org localStorage persistence
- [x] 12-03-PLAN.md — Shared TagFilterChecklist.vue component + Songs-panel wiring (SongFilters.vue swaps 2 selects, SongsView binds store)
- [x] 12-04-PLAN.md — Service-plan picker: consume shared search engine + shared TagFilterChecklist bound to store tag state
- [x] 12-05-PLAN.md — Delete-confirmation: widen removeSlot gate to all removals (incl. empty slots) + generic confirmation copy, reusing D-14 modal

Gap-closure plans (from 12-UAT, 2026-07-02 — Option A tag-UI unification, no data-model merge):

- [x] 12-06-PLAN.md — Songs panel: widen store filter to teamTags∪themes∪tags union, remove redundant teamTags 'All tags' select + filterTag, update store tests (closes UAT test 3, panel side)
- [x] 12-07-PLAN.md — Shared control: convert TagFilterChecklist to fixed-height dropdown/popover (header stops growing) + widen picker to the three-field union (closes UAT test 3, popover + picker)
- [x] 12-08-PLAN.md — Docs only: correct D-16/12-05-SUMMARY/ROADMAP to describe generic delete-confirmation wording as intended (closes UAT test 8, doc_update_only)

### Phase 13: Volunteer Role Scheduling

**Goal:** Let worship leaders staff every worship role across a quarter's service dates from a managed volunteer roster and an auto-proposed, manually-editable roster calendar. Roles span three groups: worship band (guitar, drums, vocals, bass), worship tech (sound, livestream, projection), and scripture reader. A role can hold multiple people on a given Sunday (e.g. several vocalists), and one person can serve multiple roles on the same Sunday (e.g. plays an instrument and also sings). (Worship leaders are NOT scheduled by this tool — the leaders assign themselves manually, so "worship leader" is not a role here.) Volunteers are seeded by importing servers from Planning Center (Services), then refined each quarter with a CSV import carrying per-person blackout dates (dates they cannot serve), required co-scheduling pairings (e.g. kids who must serve on the same dates as their serving parent), and the role(s) each person serves. The app generates a proposed quarterly calendar that assigns people to roles on each service date while honoring unavailability and pairing constraints and balancing load per each person's serve-frequency weight ("how often do you want to serve"), which the leader can then adjust by hand before finalizing.
**Depends on:** Phase 12
**Requirements**: TBD (derive during /gsd-discuss-phase 13 — candidate areas below)

Scope (from user request):

1. Role model — configurable schedulable roles (defaults: band = guitar/drums/vocals/bass; tech = sound/livestream/projection; scripture reader), each in a group; leader can add/rename/remove. A role can hold multiple people on one Sunday (e.g. several vocalists); one person can hold multiple roles on the same Sunday (e.g. instrument + vocals). "Worship leader" is intentionally NOT a role — leaders self-assign.
2. Volunteer roster — add/manage people who serve; each person has one or more roles they can fill and a serve-frequency **target** (1-in-N cadence — e.g. weekly, twice a month, once a month) that drives how the balancer spreads them out. Seed via import from Planning Center Services (people + team/role membership).
3. Quarterly availability collection — capture each volunteer's blackout dates (dates they cannot serve) for the quarter. The real-world trigger is a quarterly email asking when people can NOT serve; the app ingests those results.
4. CSV import — bulk import people with optional blackout dates, required co-scheduling pairings (person → must-serve-with person, same dates / own roles), and the role(s) each serves.
5. Auto-proposed calendar — generate a quarterly assignment of people to roles across service dates. Blackout dates and pairings are HARD constraints; the 1-in-N frequency target is SOFT (balanced toward, bent to fill). When a slot has no eligible person, leave it empty and flag it rather than violate a blackout.
6. Manual adjustment — edit the proposed calendar (reassign / swap / clear / add a second person to a role) before finalizing.

Notes for planner:

- This reverses the earlier "Musician scheduling — handled in Planning Center" out-of-scope decision in PROJECT.md; update PROJECT.md scope during planning.
- PC import here is people/teams (Services API), distinct from the Phase 8/9 song + plan export — reuse the existing Planning Center API client and credentials from Phase 8 where possible.

**Plans:** 10/10 plans complete

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Roster types contract + quarter-Sunday generator (foundation)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md — Deterministic weighted-fair-share scheduler (TDD)
- [x] 13-03-PLAN.md — Volunteer CSV parse / blackout-range / name-match util (TDD)
- [x] 13-04-PLAN.md — Planning Center people fetch (name/email; phone app-only)
- [x] 13-05-PLAN.md — Roster store: people + editable roles, soft-delete, upsert

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-06-PLAN.md — Quarters store: lifecycle, CSV apply, propose+persist, share
- [x] 13-07-PLAN.md — Roster UI: view, add/edit, roles config, PC import modal

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 13-08-PLAN.md — Quarter setup + CSV import UI + /schedule route

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 13-09-PLAN.md — Editable dates×roles grid + gap-filling panel

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 13-10-PLAN.md — Printable roster + public read-only share link

### Phase 14: In-App Quarterly Availability Editor

**Goal:** Replace the Phase 13 CSV import round-trip with an in-app quarterly availability editor so the worship leader transcribes each volunteer's quarterly email reply directly into constrained controls — no data ever arrives as free-text or CSV. From the roster, the leader picks a person and edits, for the active quarter: a **Sundays-only blackout calendar** (only real service dates are clickable, with "Nth Sunday" chips and a date-range block that selects the Sundays inside it), a **frequency** control (Every week / Twice a month / Monthly / As-needed fill-in / Out this quarter, with an advanced raw 1-in-N override and a live "≈ X of N Sundays" readout), a **must-serve-with** typeahead that creates bidirectional pairing chips, and a free-text **quarter note** (for the leader — never auto-scheduled). Edits write directly into the existing `PersonQuarterData` (blackoutDates, pairedWith) via the store, exactly as `applyCsvToQuarter` does today — the CSV import path remains as a secondary bulk option but is no longer the primary way availability enters the app.
**Depends on:** Phase 13

Scope (from user request):

1. In-app availability editor replacing the CSV import as the primary input path. The app controls the input shape so everything is guaranteed compatible — no cleaning messy free-text (see `docs/Sample Frequency Notes.csv` for the real, messy quarterly notes this structures: "Any", "As needed", "1 week off per month", "1st Sundays", date lists, ranges like "gone June 12-19", conditional pairings like "schedule only with Dean or Lisa").
2. **UI: Variant A — Right drawer** (from sketch `001-availability-editor`): the roster stays full-width and scannable; clicking a person's row slides the editor in from the right. Shared core controls: Sundays-only blackout calendar, frequency segmented control (+ advanced raw 1-in-N), must-serve-with bidirectional pairing picker, quarter note.
3. Frequency abstraction over the messy real-world spellings — segmented presets mapping to the existing `frequencyTargetN` 1-in-N model, plus the sketch's fill-in vs. out-this-quarter tiers (gray area: how to represent "As-needed fill-in" and "Out this quarter" against a numeric `frequencyTargetN` — resolve in discuss).
4. Sundays-only blackout entry — tap Sundays to toggle; "Nth Sunday" chips auto-select every Nth Sunday of the quarter; a range picker blocks the Sundays inside a date span. Writes expanded `YYYY-MM-DD` blackoutDates (same shape `expandBlackoutCell` produces).
5. Must-serve-with pairing — typeahead over active roster → bidirectional `pairedWith` chips, reusing the same bidirectional-sync logic `applyCsvToQuarter` already implements.
6. **Selective Planning Center import** — the current PC import pulls in everyone from the church, but the worship volunteer list is much smaller and music-only. Replace the bulk "import all servers" behavior with a selective import scoped **by PC worship team AND by role/position**: bring in only people **currently serving on a worship team** who serve in a **specific individually-scheduled role**. Explicitly EXCLUDE group positions — **choir and orchestra people are not imported** (those aren't roles WorshipPlanner fills by individual). Mechanism (resolve exact UI in discuss/research): surface the worship team's PC positions and let the leader include only the individually-filled ones (choir/orchestra excluded), mapping each PC position → a WorshipPlanner Role. Requires PC Services API research on team membership + team positions.

Note: An editor-only "Clear all volunteers" danger action (type-to-confirm, `deleteAllPeople`) already exists (commit 0b55d76) and is OUT of this phase's scope — deletion is done. Minor known gap (not required here): `deleteAllPeople` does not clear orphaned `personQuarterData` on quarter docs; low-risk since re-import + re-entry follows.

Notes for planner:

- Builds directly on Phase 13's data model (`src/types/roster.ts` — `PersonQuarterData`, `Person.frequencyTargetN`), store (`src/stores/quarters.ts` — `applyCsvToQuarter` mutation pattern, bidirectional pairing sync), and quarter-Sundays generator (`src/utils/quarterDates.ts`). Editor writes go through the store, not CSV.
- Sketch: `.planning/sketches/001-availability-editor/index.html` (Variant A chosen) + `README.md`. CSV sample: `docs/Sample Frequency Notes.csv`.
- The CSV import path (`VolunteerCsvImportModal.vue`, `volunteerCsv.ts`) is NOT removed — it stays as a secondary bulk-entry option; this phase makes the in-app editor the primary path.

**Requirements**: D-01..D-11 (see 14-CONTEXT.md — no formal REQ-IDs; REQUIREMENTS.md absent, so the 11 locked decisions are the requirement/traceability set)
**Plans:** 6/6 complete + 1 gap-closure plan (15-07)

Plans:

**Wave 1**

- [x] 14-01-PLAN.md — Data model (FrequencyTier on PersonQuarterData) + scheduler two-pass fill (regular→fillin, out-excluded) (TDD)
- [x] 14-02-PLAN.md — Selective PC import fetch: fetchPeopleForTeamPositions (team-scoped assignments, filter+dedupe) (TDD)

**Wave 2**

- [x] 14-03-PLAN.md — quarters store setPersonAvailability: single-person write + symmetric add/remove bidirectional pairing (TDD)
- [x] 14-04-PLAN.md — RosterImportModal selective flow: service-type→team→positions+Role mapping, replaces whole-directory fetch

**Wave 3**

- [x] 14-05-PLAN.md — AvailabilityDrawer.vue (Variant A) all controls + QuarterGrid 'out'-tier exclusion (+ tests)

**Wave 4**

- [x] 14-06-PLAN.md — AvailabilityRosterTable.vue + QuarterView mount (openPersonId) + end-to-end human-verify

## Backlog

### Phase 999.1: Extract shared song-browse component (Songs page + service-plan picker) (BACKLOG)

**Goal:** Extract the song search + tag-filtering + results-list functionality into ONE shared component reused on both the Songs page and the service-plan song picker, so there is a single set of code and behavior instead of two parallel implementations. Not exactly 1:1 — the Songs page keeps extra affordances the picker doesn't need (song import, inline edit / slide-over editing, bulk tag actions); those compose around the shared search/tags/list core.
**Motivation:** Phase 12 repeatedly required parallel fixes in `SongSlotPicker.vue` and `SongsView.vue`/`SongFilters.vue` for the same behavior (tag union, hidden-song exclusion, popover positioning/alignment). A shared component would collapse that duplication.
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules

**Goal:** Move serve frequency from one cadence per person to an independent cadence per (person, role) — someone can play Guitar weekly but sing Vocals monthly — and enforce same-service role compatibility by category. Role categories are TECH, BAND (instruments), VOCALS, and OTHER: TECH is exclusive (if you're on tech that service you do tech only), while BAND/VOCALS/OTHER combine freely, capped at one BAND instrument per person per service (so "1 instrument + vocals" is the canonical allowed combo). Replaces the scheduler's blanket one-slot-per-person/service check with a category exclusivity + cardinality check. Includes: adding a role `category` field with classification/migration of existing roles; migrating per-person `frequencyTargetN` to a per-role structure; reconciling Phase 14's per-person quarter `frequencyTier` (regular/fill-in/out) with per-role cadence; and updating the Edit Volunteer form's single frequency control to per-role. Full context and open questions captured in `.planning/todos/completed/per-role-frequency-and-vocal-instrument-pairing.md`.
**Requirements**: D-01..D-12 (see 15-CONTEXT.md — no formal REQ-IDs; the 12 locked decisions are the requirement/traceability set)
**Depends on:** Phase 14
**Plans:** 7/7 plans complete

Plans:

**Wave 1**

- [x] 15-01-PLAN.md — Schema foundation: RoleGroup +'vocals', Person.roleFrequencies?/PersonQuarterData.roleTiers?, DEFAULT_ROLES reseed + all RoleGroup-exhaustiveness fixes (D-04/D-05/D-08/D-09)

**Wave 2** *(blocked on Wave 1)*

- [x] 15-02-PLAN.md — Scheduler group co-occurrence + per-role cadence/tier (TDD): shared helper in eligible() AND propagatePairing(), roleGroupOf param (D-05/D-07/D-10/D-11/D-12)
- [x] 15-03-PLAN.md — Roster store patch-on-read migrations (D-03/D-09) + roleFrequencies persistence + CSV graceful degrade (TDD) (D-02/D-03/D-04/D-07/D-09)

**Wave 3** *(blocked on Wave 2)*

- [x] 15-04-PLAN.md — Quarters store: buildRoleGroupOf wired into generateProposal + per-role roleTiers scoped write (TDD) (D-05/D-12)
- [x] 15-05-PLAN.md — RosterView Edit Volunteer form: per-role cadence controls + frequency-sort reconciliation (D-01/D-02)

**Wave 4** *(blocked on Wave 3 — 15-06 consumes the setPersonAvailability roleTiers param added by 15-04)*

- [x] 15-06-PLAN.md — AvailabilityDrawer per-role tier controls + QuarterGrid live group-conflict warning (D-05/D-06/D-11)

**Gap closure (Wave 1)** *(from 15-VERIFICATION.md — D-05 not reconciled across all read/write surfaces)*

- [x] 15-07-PLAN.md — Reconcile roleTiers across QuarterGrid quick-assign, AvailabilityRosterTable status/filter, and quarters.ts reciprocal-pairing write (D-05)

### Phase 16: Quarterly Schedule share link — matrix view, name filter, cross-screen volunteer editing & UX overhaul

**Goal:** Make the quarterly schedule genuinely usable for both organizers and volunteers by (a) giving the public share link a matrix view and a memorable URL, (b) letting volunteers find their own dates, (c) unifying volunteer management so the same frequency/availability/pairing data is edited from either the Schedule or the Volunteer screen, (d) fixing pairing to respect per-role frequency, and (e) reworking the schedule editing UX. Builds directly on Phase 15's per-role frequency & co-occurrence model.

**Requirements** (to be formalized in discuss/spec — captured verbatim from request):

- R-01 **Share-link matrix view** — Render the shared schedule as a matrix (roles across the top, dates down the left column). Provide a toggle to switch between the existing list view and the matrix view.
- R-02 **Memorable share URL** — Support a friendly URL like `/{church-name}/quarter1-2026` instead of an opaque link.
- R-03 **Filter by name** — Let a viewer filter the schedule by a person's name; filtering hides any date where that person isn't serving a role (so a volunteer sees only the dates they're on).
- R-04 **Cross-screen pairing & role editing** — Allow editing pairings and roles from either the Schedule screen or the Volunteer screen.
- R-05 **Unify serve frequency** — Remove the Schedule's separate serve-frequency control; instead surface and allow editing of the same per-role frequency defined at the volunteer level (Phase 15), editable from both Schedule and Volunteer screens.
- R-06 **Quarter = blackout dates** — Frame per-quarter volunteer editing as setting blackout dates for that quarter.
- R-07 **Unavailable Sundays travel with volunteer** — A volunteer's unavailable Sundays should be stored on the volunteer and be editable from either the Volunteer or Schedule screen.
- R-08 **Remove date-range control** — Remove the date-range picker on the volunteer edit screen; with only ~13 Sundays per quarter, clicking individual Sundays to remove them is sufficient.
- R-09 **Schedule-page UX research** — Do UI research to make the schedule page more intuitive; evaluate whether a calendar-style format fits.
- R-10 **Clearer add-quarter flow** — Make adding a new quarter vs. selecting an already-defined quarter more intuitive.
- R-11 **Collapsible sections** — Make dense sections on the Schedule and Volunteer pages collapsible.
- R-12 **Pairing honors frequency** — "Serve with other person" must not force the linked person to always be scheduled together. It must honor each person's own frequency: e.g. Nolan (once/month, must-be-with Tim) + Tim (twice/month) → Nolan still serves once/month but is paired with Tim on the occurrence he does serve.
- R-13 **Group-edit hit target** — Make the whole scheduled-group cell clickable (not just the area near the pills).
- R-14 **Slide-out editor** — Open the group editor as a right-side slide-out panel instead of expanding underneath the cell.

**Depends on:** Phase 15
**Plans:** 11/11 plans complete

Plans:

**Wave 1**

- [x] 16-01-PLAN.md — Frequency data-model relocation (roleFrequency) + quarters store seeding (D-04/05/06)
- [x] 16-02-PLAN.md — Slug util + orgSlugs/quarterShares Firestore rules + [BLOCKING] rules deploy (R-02)
- [x] 16-03-PLAN.md — CollapsibleSection component + R-09 Schedule-page UX research note

**Wave 2**

- [x] 16-04-PLAN.md — R-12 scheduler pairing fix honoring per-role cadence (TDD)
- [x] 16-05-PLAN.md — AvailabilityDrawer: remove date-range, unify frequency, roles editing (R-05/06/08, D-09)
- [x] 16-06-PLAN.md — Roles-only Volunteer form + badge repoint + roster collapsible (D-07, R-11)
- [x] 16-07-PLAN.md — QuarterGrid whole-cell + right-side slide-out editor (R-13/R-14)
- [x] 16-08-PLAN.md — QuarterView redesign: quarter switcher + Add-quarter modal + collapsible sections (R-09/10/11)
- [x] 16-09-PLAN.md — Settings slug field + finalizeAndShare quarterShares write (R-02)
- [x] 16-10-PLAN.md — Share page matrix + name filter + memorable route (R-01/02/03)

**Wave 3**

- [x] 16-11-PLAN.md — Cleanup: remove deprecated frequency fields (D-04)

### Phase 16.1: Song list tags & columns customization (INSERTED)

**Goal:** Simplify and make customizable the Songs screen's tag/theme/column display, and make the app's song-planning conventions self-explanatory. (1) Remove the dedicated "Team" tags concept and fold team tags into general Tags — no separate team-tag category. (2) Show Themes as its own column separate from Tags, and add a settings-cog control that lets each user choose which columns to show/hide so they can tailor the song list to what they care about. (3) The app uses the Vertical Worship 1-2-3 song types but never explains them; add an in-app helper describing how the 1-2-3 methodology is used to plan a service (so churches unfamiliar with it understand the categories), and decide whether to keep them as-is / make them optional when generalizing to churches that don't follow that approach.

**Requirements** (to be formalized in discuss/spec — captured verbatim from request):

- R-01 **Fold Team tags into Tags** — Remove "Team" tags as a distinct category on the Songs screen; team tags become ordinary Tags. Evaluate whether a separate team-tag concept is needed at all.
- R-02 **Themes as a separate column** — Split Themes out of the Tags column into its own column in the song list.
- R-03 **Column-visibility settings cog** — Add a settings cog on the song list that lets the user show/hide individual columns to customize the view.
- R-04 **Explain the 1-2-3 song methodology** — The system uses 1/2/3 song types but doesn't describe what they are or why they're useful. Add an in-app helper describing how to use them to plan a service; consider making them optional/removable for churches (future multi-tenant) that don't follow the VW 1-2-3 approach.

**Depends on:** Phase 16 (builds on the song-catalog tag/theme/column work of Phases 11–12 and the shared song-browse direction of backlog Phase 999.1)
**Marker:** (INSERTED) — urgent work discovered mid-milestone
**Requirements**: D-01..D-18 (see 16.1-CONTEXT.md — no formal REQ-IDs; the 18 locked decisions are the requirement/traceability set)
**Plans:** 8/8 plans complete

Plans:

**Wave 1**

- [x] 16.1-01-PLAN.md — Store + PC-import teamTags→tags fold + theme-removal tracking (D-01/D-05/D-14)
- [x] 16.1-02-PLAN.md — vwModeEnabled church-level flag (auth store) + Settings toggle (D-15/D-16)

**Wave 2**

- [x] 16.1-03-PLAN.md — Suggestions nudge-only + songSearch team: alias (TDD) (D-02/D-03/D-04/D-06)
- [x] 16.1-04-PLAN.md — Column-visibility store: per-user/org persist + hydrate (D-08/D-09/D-10)

**Wave 3**

- [x] 16.1-05-PLAN.md — SongTable: Themes column + cog + inline theme edit + VW-gated Category + VwExplainer (D-07..D-13/D-16/D-17/D-18)
- [x] 16.1-06-PLAN.md — SongsView/SongFilters union + SongSlideOver team-tag fold + VW gating (D-01/D-12/D-16)
- [x] 16.1-07-PLAN.md — SongSlotPicker + ServiceEditorView: fold pills, gate badges, orchestra AI over tags (D-02/D-04/D-11/D-16)

**Wave 4**

- [x] 16.1-08-PLAN.md — Remove Song.teamTags + vue-tsc blast-radius cleanup + full-suite gate (D-01)

### Phase 17: Sync schedule with planned services: add a Roles tab to service plans that seeds each role and its scheduled person from the schedule for that service date, allows per-service overrides, and exposes a public shared service link showing who is serving

**Goal:** Marry the quarterly volunteer schedule to planned services: add a Roles tab to the service editor that seeds each role and its scheduled person from the quarterly schedule for the service date, allows per-service overrides without mutating the schedule (sparse `Service.roleAssignmentOverrides`, resolved live), and exposes a public shared service link (mirroring the Phase 16 quarter share) that shows who is serving — so a planned service carries both music AND people-per-role.
**Requirements**: CR-01 (Roles tab lists each role), CR-02 (seed scheduled people for the date), CR-03 (per-service override without schedule mutation), CR-04 (public share link shows who is serving), CR-05 (editor-only writes / editor-only in-app read; public link is the only viewer surface) — derived from the phase goal (no formal REQUIREMENTS.md).
**Depends on:** Phase 16
**Plans:** 5/5 plans complete

Plans:

**Wave 1**

- [x] 17-01-PLAN.md — Data model (`Service.roleAssignmentOverrides`) + pure `resolveServiceRoleAssignments` resolver (TDD)
- [x] 17-02-PLAN.md — `serviceShares` Firestore rules + rules test + memorable `/:slug/service-:date` route + reserved slug + rules deploy

**Wave 2**

- [x] 17-03-PLAN.md — Services store: scoped-dot-path `setRoleOverride`/`clearRoleOverride` + `createShareToken` names-only `roleAssignments` snapshot + `serviceShares` soft-fail write

**Wave 3**

- [x] 17-04-PLAN.md — ServiceEditorView Music/Roles tab bar + Roles tab (seeded list, per-role override/clear, empty state, editor-only)
- [x] 17-05-PLAN.md — ShareView dual-path public read + names-only "Who's Serving" section

### Phase 29: Order Structure — Stable Reordering & Post-Service

**Goal:** Service items and slides reorder reliably and land exactly where dropped, and a fifth Post-Service section exists for content that runs as people exit.
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: R042, R043, R044, R049, R050
**Success Criteria** (what must be TRUE):
  1. Dragging a service item to a new position lands it exactly there immediately, with no page refresh needed to see the correct order
  2. The five service sections (Pre-Service, Worship, Message, Sending, Post-Service) always render in that fixed order, are never themselves draggable, and stay visible even when empty
  3. Dragging a slide within the Slides tab persists its new position without reverting
  4. Adding a new slide appends it to the true end of its group, not before the last slide
**Plans**: TBD
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
**Plans**: TBD
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
