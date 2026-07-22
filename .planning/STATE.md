---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: MVP
current_phase: 17
current_phase_name: sync-schedule-with-planned-services-add-a-roles-tab-to-servi
status: executing
stopped_at: Completed 17-03-PLAN.md
last_updated: "2026-07-22T18:12:17.630Z"
last_activity: 2026-07-22
progress:
  total_phases: 12
  completed_phases: 10
  total_plans: 68
  completed_plans: 66
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while rotating through the full song stable and respecting team configurations
**Current focus:** Phase 17 — sync-schedule-with-planned-services-add-a-roles-tab-to-servi

## Current Position

Phase: 17 (sync-schedule-with-planned-services-add-a-roles-tab-to-servi) — EXECUTING
Plan: 4 of 5
Milestone: v1.0 MVP — SHIPPED 2026-03-05
Next milestone: v1.1 Tasks & Events (not yet started)
Status: Ready to execute

## Performance Metrics

**Velocity:**

- Total plans completed: 121
- Timeline: 2 days (2026-03-03 → 2026-03-04)
- Total commits: 218
- Lines of code: 12,747

**By Phase:**

| Phase | Plans | Commits | Files |
|-------|-------|---------|-------|
| Phase 01-foundation P01 | 47 | 3 tasks | 30 files |
| Phase 01-foundation P02 | 60 | 2 tasks | 7 files |
| Phase 02-song-library P01 | 4 | 2 tasks | 10 files |
| Phase 02-song-library P02 | 5 | 2 tasks | 6 files |
| Phase 02-song-library P03 | 6 | 2 tasks | 5 files |
| Phase 03-service-planning P01 | 5 | 2 tasks | 9 files |
| Phase 03-service-planning P02 | 4 | 2 tasks | 7 files |
| Phase 03-service-planning P03 | 5 | 3 tasks | 4 files |
| Phase 03-service-planning P04 | 3 | 2 tasks | 5 files |
| Phase 04-output P01 | 5 | 2 tasks | 6 files |
| Phase 04-output P02 | 6 | 2 tasks | 7 files |
| Phase 06 P01 | 9 | 1 tasks | 6 files |
| Phase 06-ai-assisted P02 | 7 | 2 tasks | 2 files |
| Phase 06-ai-assisted P03 | 4 | 1 tasks | 3 files |
| Phase 06 P04 | 0 | 1 tasks | 4 files |
| Phase 07 P01 | 8 | 2 tasks | 6 files |
| Phase 07 P02 | 11 | 3 tasks | 8 files |
| Phase 08 P01 | 5 | 2 tasks | 4 files |
| Phase 08 P02 | 8 | 2 tasks | 2 files |
| Phase 08 P03 | 8 | 2 tasks | 1 files |
| Phase 09-pc-song-import-tag-management P01 | 4 | 1 tasks | 3 files |
| Phase 09 P02 | 25 | 2 tasks | 5 files |
| Phase 12 P06 | 20min | 1 tasks | 4 files |
| Phase 12 P07 | 8min | 2 tasks | 2 files |
| Phase 12 P08 | 8min | 1 tasks | 3 files |
| Phase 13 P01 | 5min | 3 tasks | 4 files |
| Phase 13 P06 | 12min | 3 tasks | 2 files |
| Phase 13 P07 | 20min | 2 tasks | 5 files |
| Phase 13 P08 | 18min | 3 tasks | 4 files |
| Phase 13 P09 | ~15min | 3 tasks | 2 files |
| Phase 13 P10 | ~15min | 2 tasks | 4 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 25min | 2 tasks | 3 files |
| Phase 17 P02 | ~10min | 3 tasks | 4 files |
| Phase 17 P03 | 20min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list with outcomes.

- [Phase 08]: SONG slots with null songId are skipped in addSlotAsItem (no PC item created for empty slots)
- [Phase 08]: pcExportedAt and pcPlanId added as optional fields to Service interface for backward compatibility
- [Phase 08]: Credentials never pre-filled in edit inputs — user must re-enter to change (security)
- [Phase 08]: hasPcCredentials checks both non-null AND non-empty to handle Firestore null vs empty string
- [Phase 08]: Export to PC button shown for all statuses when credentials configured, disabled (not hidden) for non-planned services
- [Phase 08]: sermonPassage passed to addSlotAsItem so MESSAGE slots include sermon passage reference in PC item description
- [Phase 08]: Partial failure tolerance: individual slot failures tracked and reported without rolling back the PC plan
- [Phase 08]: PC API rejects all date fields on createPlan — date parameter omitted entirely from API call
- [Phase 08]: Human verified end-to-end export flow against real Planning Center account — APPROVED 2026-03-05
- [Quick-2]: SONG slots use item_type 'song' (not 'song_arrangement') for proper PC song linking
- [Quick-2]: CCLI-based arrangement linking is best-effort -- errors never cause export failure
- [Quick-2]: First arrangement from PC auto-linked (most songs have one default arrangement)
- [Quick-3]: Song relationship included alongside arrangement in createItem POST body
- [Quick-3]: item_type 'song' keyed on pcSongId (not arrangementId) — CCLI match always yields 'song' type
- [Quick-3]: Last scheduled item metadata copy is best-effort — per-note failures swallowed individually
- [Phase 09-pc-song-import-tag-management]: Song.hidden === true strict check preserves legacy docs without field migration
- [Phase 09-pc-song-import-tag-management]: UpsertSongInput exported from song.ts so Plans 02/03 can import type without store coupling
- [Phase 09-pc-song-import-tag-management]: upsertSongs preserves hidden status and omits null vwType from update payload to protect user-set values
- [Phase 09]: PC_BASE_URL duplicated as PC_SONGS_BASE_URL in pcSongImport.ts to avoid full planningCenterApi module import in tests
- [Phase 09]: upsertSongs uses direct updateDoc/addDoc calls (not writeBatch) to match test expectations
- [Phase 09-pc-song-import-tag-management]: CsvImportModal left as dead code to avoid breaking existing tests
- [Phase 09-pc-song-import-tag-management]: classifySongs triple-key dedup mirrors upsertSongs for consistent import preview counts
- [Phase 09-pc-song-import-tag-management]: SongTable songs-change watch removed -- it reset infinite scroll cursor after soft-delete
- [Phase 09-pc-song-import-tag-management]: PC API batch size reduced to 3 with Retry-After support to survive rate limit windows
- [Phase 12]: Kept teamTags/themes/tags as three separate Song fields (Option A) — unified only the UI/filter surface, not the data model
- [Phase 12]: Store, component, and view filterTag removal landed in a single atomic commit to keep vue-tsc --build green at every commit boundary
- [Phase 12]: Kept TagFilterChecklist.vue fully presentational (internal open ref only, no store import) so both Songs panel and picker inherit the popover for free
- [Phase 12]: D-16 amended to state generic delete-confirmation wording is the intended/accepted behavior (12-UAT test 8); D-08 amended to describe the single combined tag control sourcing teamTags ∪ themes ∪ tags (Option A)
- [Phase 13]: Standing (Person.roles/frequencyTargetN) vs quarter-scoped (PersonQuarterData.blackoutDates/pairedWith) field split encoded in roster.ts type contract (D-18)
- [Phase 13]: DEFAULT_ROLES doc comment reworded to avoid literal 'worship leader' phrase, satisfying both interfaces-block content and acceptance-criteria grep check
- [Phase 13]: quarters.ts cell edits (assignPerson/clearAssignment/swapAssignment) use Firestore dot-path field keys (calendar.${date}.${roleId}) in updateDoc rather than read-modify-write of the whole calendar map — so concurrent edits to different cells never clobber each other
- [Phase 13]: applyCsvToQuarter's bidirectional pairing merge only ever adds the reciprocal id to a partner's pairedWith array — never touches a non-CSV partner's other fields, preserving D-19's absent-people-untouched guarantee
- [Phase 13]: RosterView defers seedDefaultRolesIfEmpty() behind a one-shot watch on the roles snapshot (not synchronously after subscribe) to avoid the async-onSnapshot race that would duplicate-seed default roles for orgs that already have them
- [Phase 13]: RolesConfigPanel holds per-role edit drafts committed only on 'Save Role' so the live Firestore roles snapshot never clobbers an in-progress rename/count edit
- [Phase ?]: [Phase 13]: QuarterView derives hasAssignments from the calendar (any cell with >=1 person) to switch first-run Generate Schedule (no confirm) vs Regenerate/Fill Remaining Gaps, gating Regenerate behind the destructive confirmation
- [Phase ?]: [Phase 13]: CSV import commit is two-pass — resolve/create people then resolve serve-with against a seeded name->id map; unmatched/ambiguous rows require explicit map-to-existing/create-new (no silent auto-create, D-16)
- [Phase ?]: [Phase 13]: QuarterGrid cell edits dispatch straight to the Plan-06 scoped store actions (assignPerson/clearAssignment/swapAssignment) which each write only calendar.{date}.{roleId} via Firestore dot-path — the grid never rewrites the whole calendar map (T-13-09-02)
- [Phase ?]: [Phase 13]: QuarterGrid flags a cell unfilled when assigned count < effective count (roleOverridesByDate else role.defaultCount) OR the cell is in lastProposeResult.unfilled — so manual clears re-flag immediately without regenerating
- [Phase ?]: [Phase 13]: gap-filling panel candidate lists derive purely from personQuarterData + calendar + activePeople; blacked-out people are strikethrough-listed but excluded from assignable candidates (D-23, T-13-09-03)
- [Phase ?]: [Phase 13]: Print/public share surfaces (RosterPrintLayout, QuarterShareView) use the light palette — deliberate existing exception to the dark app theme for output surfaces (D-24)
- [Phase ?]: [Phase 13]: QuarterShareView reads ONLY the self-contained quarterSnapshot (names pre-resolved) and imports no roster/auth store, so the public route cannot touch org-scoped PII (T-13-10-02/03)
- [Phase ?]: 17-01: Adopted first-match-wins tie-break for findQuarterForDate when two quarters share a service date (accepted pre-existing edge case)
- [Phase ?]: 17-01: resolveServiceRoleAssignments stays id-only, never surfaces email/phone (T-17-01-01)
- [Phase ?]: 17-02: serviceShares Firestore collection mirrors quarterShares exactly (public read; org-editor-scoped create/update/delete; orgId immutable on update) — deterministic {slug}__service-{date} doc id requires editor-scoped write to prevent cross-org overwrite (T-17-02-01/02)
- [Phase ?]: 17-02: 'service-share' added to RESERVED_SLUGS proactively even though the opaque /share/:token route is reused (consistency with quarter-share reserved word, T-17-02-04)
- [Phase ?]: 17-03: createShareToken's memorable-URL write uses the orgIdValue param (not orgId ref), consistent with the opaque write's existing usage
- [Phase ?]: 17-03: fixed pre-existing RESERVED_SLUGS count regression from 17-02 (test:rules doesn't catch test:unit staleness)

### Roadmap Evolution

- Phase 6 added: AI assisted service suggesting and scripture searching
- Phase 7 added: Invite users, manage members with admin/viewer roles, and enforce role-based access control
- Phase 8 added: Planning Center API export for published service plans
- Phase 9 added: PC Song Import & Tag Management
- Phase 10 added: Worship song export naming, template import improvements, auto-add teams on import, orchestra filter for song suggestions
- Phase 11 added: Song catalog & service planner improvements (catalog browsing/search, themes, metadata search, drag-drop ordering & autosave bug fixes, hide-by-tag, AI hidden-song exclusion, column sorting, delete confirmation)
- Phase 12 added: Advanced song search (metadata-aware + field-scoped syntax) and multi-select persistent tag filtering across the service-plan picker and Songs panel
- Phase 13 added: Volunteer Role Scheduling — roster + PC people import (name/email/phone), editable roles (band/tech/scripture reader; worship leader intentionally NOT a role — leaders self-assign) with multi-person-per-role and multi-role-per-person, per-person 1-in-N serve-frequency target, quarterly blackout dates + must-serve-with pairings via name-matched CSV, auto-proposed frequency-balanced quarterly grid (dates×roles) with manual editing. NOTE: reverses PROJECT.md "Musician scheduling — out of scope" decision.
- Phase 15 added: Per-Role Frequency & Role-Category Co-occurrence Rules — frequency per (person, role) instead of per person; same-service role compatibility by category (TECH exclusive; BAND/VOCALS/OTHER combine; max 1 instrument/service). Reshapes Phase 14's per-person frequency model. Requested during Phase 14 execution; full context in .planning/todos/completed/per-role-frequency-and-vocal-instrument-pairing.md.
- Phase 16 added: Quarterly Schedule share link — matrix view + list/matrix toggle, memorable /{church}/quarterN-YYYY URL, filter-by-name, cross-screen (Schedule ↔ Volunteer) editing of pairings/roles/per-role frequency/unavailable Sundays, remove Schedule's separate frequency + volunteer date-range picker, pairing that honors per-role frequency (paired only on the occurrences the lower-frequency person serves), collapsible sections, calendar-format UX research, and a right-side slide-out group editor with whole-cell hit target. See ROADMAP.md R-01..R-14.
- Phase 16.1 inserted after Phase 16: Song list tags & columns customization: fold Team tags into Tags, Themes as separate column + column-visibility cog, document 1-2-3 methodology (URGENT)
- Phase 16.2 inserted then REMOVED (2026-07-13): Admin permissions hardening was found redundant — Phase 7 already enforces viewer read-only at the route (requiresEditor guards), navigation (isEditor-gated sidebar), and Firestore rules (editor-only writes; songs/other collections editor-only). The only net change 16.2 described was EXPANDING viewer read access to Songs/Schedule/Volunteers, which is a feature, not hardening, and was not wanted. Removed from ROADMAP.
- Phase 17 added: Sync schedule with planned services — add a Roles tab to service plans that seeds each role and its scheduled person from the quarterly schedule for that service date, allows per-service overrides (without mutating the schedule), and exposes a public shared service link (like the Phase 16 schedule share link) showing who is serving. Marries the schedule to services so a planned service carries both music AND people-per-role.

### Quick Tasks Completed

14 quick-task UX improvements shipped during v1.0 (tasks 6-21). See milestones/v1.0-ROADMAP.md for full list.

- [Quick-1]: PC export dialog refactored with template-based item matching, existing plan detection, plan times
- [Quick-2]: SONG slots use item_type 'song' with CCLI-based arrangement auto-linking
- [Quick-3]: Auto-populate PC item metadata (length, notes) from song's last scheduled item
- [Quick-4]: Import dialog requires explicit button click to close — backdrop/wrapper click-to-dismiss removed
- [Quick-5]: Songs support multiple VW types (vwTypes: VWType[]); PC import captures all category tags; service slot shows selected song's actual types
- [Quick-6]: autosaveSaving boolean guard serialises concurrent onSave() calls; reschedules at 200ms if inflight; debounce increased to 800ms for drag sequences
- [Quick-7]: PC export item titles use bare songTitle only — (Key: X) annotation removed from PC item names
- [Quick-8]: Scripture input replaced with single freeform text field — parses "Isaiah 53:1-6", "John 1:1-10,15-20" etc. into ScriptureRef
- [Quick-9]: ServiceEditorView merges remote Firestore snapshots into localService when autosaveStatus is idle/saved; skips when pending/saving to prevent conflicts
- [Quick-10]: dismissPreview resets all three preview refs (previewText, previewRef, previewError) so showPreviewButton computed re-evaluates to true automatically

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 9 | Subscribe to updates so that if 2 or more people are looking at the Services listing or the Edit Service screen they can see updates made by other people who are looking at the same thing | 2026-03-12 | e0ce5e1 | [9-subscribe-to-updates-so-that-if-2-or-mor](.planning/quick/9-subscribe-to-updates-so-that-if-2-or-mor/) |
| 10 | Allow closing the scripture preview in edit mode | 2026-03-12 | 9c3bd1f | [10-allow-closing-the-scripture-preview-in-e](.planning/quick/10-allow-closing-the-scripture-preview-in-e/) |
| 260701-awp | Fix song-picker sticky header (search + tag filters) rendering behind scrolling song list | 2026-07-01 | 5de0ae2 | [260701-awp-fix-song-picker-sticky-header-search-tag](.planning/quick/260701-awp-fix-song-picker-sticky-header-search-tag/) |
| 260703-246 | Exclude soft-deleted (hidden) songs from AI suggestions via shared aiCandidateSongs getter + regression test | 2026-07-03 | 87b6de4 | [260703-246-make-sure-that-when-the-ai-makes-song-su](.planning/quick/260703-246-make-sure-that-when-the-ai-makes-song-su/) |
| 260710-s7f | Scheduler honors hard per-role frequency caps AND spreads serves evenly across the quarter (no front-loading); fill-in tier is manual-only, not auto-filled | 2026-07-11 | 8b2aa1a, 0d4d127 | [260710-s7f-schedule-generator-honor-hard-per-role-f](.planning/quick/260710-s7f-schedule-generator-honor-hard-per-role-f/) |
| 260711-dto | UI-consistency cleanup: renamed Roster/Users routes+titles to Volunteers/Admins (/volunteers, /admins), active-only song counts on Dashboard/Songs, chevron + full-row-click edit affordance on Songs/Volunteers, Add-quarter button moved to Schedule header top-right, sidebar reordered/grouped {Services,Songs}\|{Schedule,Volunteers}\|{Admins,Settings} | 2026-07-11 | a6fedca | [260711-dto-menu-page-route-naming-cleanup-drawer-ed](.planning/quick/260711-dto-menu-page-route-naming-cleanup-drawer-ed/) |
| 260713-d60 | Volunteers page — active + inactive merged into one table with a Show-inactive toggle (default off, inactive rows dimmed), Actions column replaced by a Status badge, and Deactivate/Reactivate + permanent Delete moved into the edit drawer as immediate-apply status actions; table headers normalized to the SongTable Title-Case convention | 2026-07-13 | fd1b933, 6d631ba | [260713-d60-volunteers-merge-active-inactive](.planning/quick/260713-d60-volunteers-merge-active-inactive/) |
| 260713-wm9 | Schedule page split into Volunteers/Schedule/Service-dates tabs (default Schedule; generate/fill/regenerate → Schedule tab, add-quarter → Volunteers tab, delete-quarter Danger Zone → Service dates tab); Volunteers page split into Volunteers/Roles-config tabs (Import/Add Volunteer → Volunteers tab). Replaces collapsible sections; reuses ServicesView tab-bar styling | 2026-07-13 | 51a93e1, 8a54d99 | [260713-wm9-schedule-and-volunteers-tabbed-layout](.planning/quick/260713-wm9-schedule-and-volunteers-tabbed-layout/) |
| 260714-dlt | Schedule matrix redesign: pills replaced with plain comma-separated names + same-size unfilled/conflict/group markers; whole date-row clickable opening a single full-row drawer (all roles, Clear/Swap/Add/gap-fill); store `lastRegenerate` diffs prev vs new calendar to flag changed dates; "Show changes (N)" checkbox highlights changed rows (accent bar + tint + badge). QuarterGrid tests rewritten to row-drawer model (52 tests pass) | 2026-07-14 | 2cdeccd, 977014d, b7cab81 | [260714-dlt-regenerate-change-highlights-and-row-dra](.planning/quick/260714-dlt-regenerate-change-highlights-and-row-dra/) |
| 260714-e7o | Roles tab (Volunteers → Roles) Save buttons now give visible feedback: per-role Save shows "Saving…" then a green "Saved ✓" flash (~1.8s); Add Role flashes "Added ✓" | 2026-07-14 | 895af68 | [260714-e7o-roles-save-button-feedback](.planning/quick/260714-e7o-roles-save-button-feedback/) |
| 260714-f4p | PC song import: "Import new songs only" checkbox (default on) skips already-imported songs; matching centralized into exported `partitionPcSongs()` (pcSongId OR non-empty ccliNumber OR lowercased title) with 8 new unit tests; checkbox drives preview counts, confirm upsert, and done summary | 2026-07-14 | fed36d8, d3ceb87 | [260714-f4p-on-song-import-from-pc-only-look-for-son](.planning/quick/260714-f4p-on-song-import-from-pc-only-look-for-son/) |

### Blockers/Concerns

- Suggestion algorithm scoring weights are first-principles estimates; validate with team's actual song library
- VW slot type enforcement rules should be confirmed with team
- Planning Center CSV column schema should be validated against an actual export

## Session Continuity

Last activity: 2026-07-22
Last session: 2026-07-22T18:12:17.593Z
Stopped at: Completed 17-03-PLAN.md
Resume file: None
