# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- 📋 **v1.1** — Phases 5, 8, 9 (planned)

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

- [ ] Phase 5: Collaboration, Tasks & Events (TBD plans)
- [x] Phase 8: Planning Center API Export (3 plans) (completed 2026-03-05)
- [x] Phase 9: PC Song Import & Tag Management (3 plans) (completed 2026-03-12)

## Phase Details

### Phase 5: Collaboration, Tasks & Events

**Goal**: Recurring task checklists with church-specific categories, task assignment with relative due dates, and special event services (Christmas Eve, Easter, etc.) with calendar integration and duplication.
**Depends on**: Phase 4
**Requirements**: TASK-01, TASK-02, TASK-03, EVNT-01, EVNT-02, EVNT-03, EVNT-04
**Plans:** 0/TBD plans

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

- [ ] 08-01-PLAN.md — PC API client utility, Service type extension, Vite dev proxy
- [ ] 08-02-PLAN.md — Settings UI for PC credentials and service type selection
- [ ] 08-03-PLAN.md — Export flow in ServiceEditorView with button, feedback, and exported state

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
| 8. Planning Center API Export | 3/3 | Complete   | 2026-03-05 | - |
| 9. PC Song Import & Tag Management | 3/3 | Complete   | 2026-03-12 | - |

### Phase 9: PC Song Import & Tag Management

**Goal:** Replace CSV song import with Planning Center API import — fetch songs with tags, map arrangement titles (Orchestra→tag), support soft-delete (hide/unhide songs), map PC Categories 1-3 to Types 1-3, import Last Scheduled dates, and preserve existing song catalog on first import
**Requirements**: soft-delete, hidden-exclusion, re-import-safe, upsert-store, pc-api-fetch, tag-import, category-to-type-mapping, last-scheduled-mapping, orchestra-tag, replace-csv-import, import-preview, view-restore-hidden, no-pc-credentials-guard
**Depends on:** Phase 8
**Plans:** 3/3 plans complete

Plans:

- [ ] 09-01-PLAN.md — Song type + store: pcSongId/hidden fields, soft-delete, restoreSong, upsertSongs
- [ ] 09-02-PLAN.md — PC import utility: fetchAllPcSongs, mapPcSongToUpsert, importFromPc (TDD)
- [ ] 09-03-PLAN.md — UI: PcImportModal, hidden songs panel, restore flow, SongsView wiring

### Phase 10: Worship song export naming, template import improvements, auto-add teams on import, orchestra filter for song suggestions

**Goal:** Four focused improvements to Planning Center export and song suggestions: (1) prefix all PC-exported song/hymn item titles with "Worship Song - "; (2) when exporting to an existing PC plan, delete matched "Worship Song"/"Scripture Reading" placeholders and recreate the real items at their original sequence while removing any unmatched placeholders; (3) show PC Teams for the selected service type as checkboxes in the export dialog with case-insensitive auto-match against WorshipPlanner service teams, and add the checked teams to the plan on export (non-fatal); (4) replace the Orchestra hard-filter in song suggestions with a +200 scoring bonus so non-orchestra songs still appear but orchestra-tagged songs rank higher, dim non-orchestra songs with opacity-50 in the SongSlotPicker, and filter the AI-suggested songLibrary to orchestra-tagged songs only when the service has Orchestra as a team.
**Requirements**: FEAT-1, FEAT-2, FEAT-3, FEAT-4a, FEAT-4b, FEAT-4c, FEAT-4-ai
**Depends on:** Phase 9
**Plans:** 3 plans

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

**Plans:** 1/10 plans executed

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Roster types contract + quarter-Sunday generator (foundation)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 13-02-PLAN.md — Deterministic weighted-fair-share scheduler (TDD)
- [ ] 13-03-PLAN.md — Volunteer CSV parse / blackout-range / name-match util (TDD)
- [ ] 13-04-PLAN.md — Planning Center people fetch (name/email; phone app-only)
- [ ] 13-05-PLAN.md — Roster store: people + editable roles, soft-delete, upsert

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 13-06-PLAN.md — Quarters store: lifecycle, CSV apply, propose+persist, share
- [ ] 13-07-PLAN.md — Roster UI: view, add/edit, roles config, PC import modal

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 13-08-PLAN.md — Quarter setup + CSV import UI + /schedule route

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 13-09-PLAN.md — Editable dates×roles grid + gap-filling panel

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 13-10-PLAN.md — Printable roster + public read-only share link

## Backlog

### Phase 999.1: Extract shared song-browse component (Songs page + service-plan picker) (BACKLOG)

**Goal:** Extract the song search + tag-filtering + results-list functionality into ONE shared component reused on both the Songs page and the service-plan song picker, so there is a single set of code and behavior instead of two parallel implementations. Not exactly 1:1 — the Songs page keeps extra affordances the picker doesn't need (song import, inline edit / slide-over editing, bulk tag actions); those compose around the shared search/tags/list core.
**Motivation:** Phase 12 repeatedly required parallel fixes in `SongSlotPicker.vue` and `SongsView.vue`/`SongFilters.vue` for the same behavior (tag union, hidden-song exclusion, popover positioning/alignment). A shared component would collapse that duplication.
**Requirements:** TBD
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
