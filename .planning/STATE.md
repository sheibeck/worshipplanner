---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 7 context gathered
last_updated: "2026-03-04T21:11:55.434Z"
last_activity: 2026-03-04 — Plan 01-01 complete — Vue 3 + Firebase foundation, auth store, router guard, Firestore rules
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 16
  completed_plans: 16
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while rotating through the full song stable and respecting team configurations
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 1 of 2 in current phase (01-01 complete, 01-02 next)
Status: In progress
Last activity: 2026-03-04 — Plan 01-01 complete — Vue 3 + Firebase foundation, auth store, router guard, Firestore rules

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation P01 | 47 | 3 tasks | 30 files |
| Phase 01 P02 | 5 | 1 tasks | 6 files |
| Phase 01-foundation P02 | 60 | 2 tasks | 7 files |
| Phase 02-song-library P01 | 4 | 2 tasks | 10 files |
| Phase 02-song-library P02 | 5 | 2 tasks | 6 files |
| Phase 02-song-library P03 | 6 | 2 tasks | 5 files |
| Phase 03-service-planning P02 | 4 | 2 tasks | 7 files |
| Phase 03-service-planning P01 | 5 | 2 tasks | 9 files |
| Phase 03-service-planning P04 | 3 | 2 tasks | 5 files |
| Phase 03-service-planning P03 | 5 | 3 tasks | 4 files |
| Phase 04-output P01 | 5 | 2 tasks | 6 files |
| Phase 04-output P02 | 6 | 2 tasks | 7 files |
| Quick-3 QoL | 3 | 2 tasks | 4 files |
| Phase 06 P01 | 9 | 1 tasks | 6 files |
| Phase 06-ai-assisted P03 | 4 | 1 tasks | 3 files |
| Phase 06-ai-assisted P02 | 7 | 2 tasks | 2 files |
| Phase 06 P04 | 0 | 1 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Vue 3 + Firebase stack confirmed; non-negotiable constraints
- [Init]: Complement Planning Center via CSV import, not API sync
- [Init]: `signInWithPopup` preferred over `signInWithRedirect` (broken in Chrome M115+, Firefox 109+, Safari 16.1+)
- [Init]: Denormalize song snapshots into service slot documents; avoid N+1 reads
- [Init]: Use `onSnapshot` directly in Pinia stores; do not use VueFire composables in stores
- [Phase 01-01]: Firebase v12 used for compatibility with @firebase/rules-unit-testing v5
- [Phase 01-01]: loginWithEmail auto-creates account on both auth/user-not-found and auth/invalid-credential (Firebase 9+ behavior)
- [Phase 01-01]: vitest.rules.config.ts created separately for emulator tests to avoid exclusion conflict with vite.config.ts
- [Phase 01-02]: AppShell wrapper pattern: DashboardView wraps in AppShell directly in its own template — simpler than App.vue layout switching
- [Phase 01-02]: Inline SVG icons for all UI (Google G, heroicons-style nav, checkmarks) — no icon library dependency
- [Phase 01-02]: GettingStarted step completion hardcoded for Phase 1 — dynamic tracking deferred until features exist
- [Phase 01-02]: Dark mode is the application visual theme — gray-950 body, gray-900 cards/sidebar, gray-800 inputs; established as canonical palette for all future phases
- [Phase 01-02]: AppShell wrapper pattern: DashboardView wraps in AppShell directly in its own template — simpler than App.vue layout switching
- [Phase 02-song-library]: filteredSongs computed lives in Pinia store (not view) so Plan 02 slide-over and Plan 03 CSV import share filter state without prop drilling
- [Phase 02-song-library]: filterVwType uses 'uncategorized' string sentinel rather than null for no-vwType filter to distinguish from no-filter (null)
- [Phase 02-song-library]: SongBadge uses static class lookup object to prevent Tailwind v4 purge of dynamic VW type badge color classes
- [Phase 02-song-library]: SongSlideOver uses Teleport to body to escape AppShell overflow-y-auto stacking context for correct z-index layering
- [Phase 02-song-library]: Song-level teamTags denormalized as union of explicit song tags + arrangement teamTags on Save
- [Phase 02-song-library]: DashboardView subscribes to songs with orgId guard to enable GettingStarted step 2 reactivity without double-subscription
- [Phase 02-song-library]: PapaParse used with header:true mode — row objects keyed by column header strings for robust Planning Center CSV mapping
- [Phase 02-song-library]: Duplicate detection: CCLI match primary (when both have CCLI), case-insensitive title match fallback for no-CCLI songs
- [Phase 03-service-planning]: serviceStore reads current slots from in-memory services.value before slot updates to avoid extra Firestore reads
- [Phase 03-service-planning]: DashboardView uses per-store orgId guard to avoid double-subscription when ServiceEditorView also subscribes
- [Phase 03-service-planning]: Placeholder ServicesView.vue and ServiceEditorView.vue created to unblock router registration and build while Plan 03/04 pending
- [Phase 03-service-planning]: Sending Song (position 8) defaults to VW Type 3 for both progressions
- [Phase 03-service-planning]: Team filtering uses AND logic — song must support ALL active service teams or have empty teamTags
- [Phase 03-service-planning]: rankSongsForSlot accepts nowMs injectable parameter for deterministic time-dependent testing
- [Phase 03-service-planning]: ServiceCard uses static class lookup (progressionClasses/statusClasses) to prevent Tailwind v4 purge of dynamic badge color classes
- [Phase 03-service-planning]: ServicesView uses local activeTab ref for Services/Rotation tab toggle — no router-based tabs needed
- [Phase 03-service-planning]: RotationTable consecutive repeat detection uses sortedDates index comparison — checks if sortedDates[i-1] also has the song
- [Phase 03-service-planning]: ServiceEditorView uses JSON.stringify for isDirty detection on nested slot arrays
- [Phase 03-service-planning]: SongSlotPicker Teleport to body with getBoundingClientRect() fixed positioning for AppShell overflow escape
- [Phase 03-service-planning]: ScriptureInput showOverlapWarning=false on sermon passage input, true on reading slots
- [Phase 04-output]: formatScriptureRef exported from planningCenterExport.ts and imported into ServicePrintLayout.vue (script setup cannot contain ES module exports)
- [Phase 04-output]: Print CSS pattern: AppShell wrapped in print:hidden div, ServicePrintLayout rendered as sibling with hidden print:block
- [Phase 04-output]: shareTokens embed pattern: write full denormalized serviceSnapshot to public shareTokens/{token} collection at creation time — zero reads of protected org collections by unauthenticated viewers
- [Phase 04-output]: ShareView is standalone: uses getDoc directly (not store subscription), no AppShell, no auth stores — completely independent of app shell
- [Quick-2]: slotLabel() replaces SLOT_LABELS — kind-based labels work for variable-length slot arrays
- [Quick-2]: createSlot() factory defaults Song vwType to 2; reindexSlots() normalizes positions after every mutation
- [Quick-2]: Sortable onEnd updates reactive array then lets Vue reconcile (no manual DOM sync needed)
- [Quick-2]: onSave uses global songId set comparison for lastUsedAt tracking after reorder (position-independent)
- [Quick-2]: planningCenterExport sequential Song 1/2/3 numbering (position-agnostic)
- [Quick-3]: CCLI column replaces BPM in SongTable — low-value BPM swapped for one-click SongSelect link
- [Quick-3]: displayedPastServices slices to 5 but toggle button retains full count
- [Quick-3]: Status badge is a button element for semantic correctness and keyboard accessibility
- [Phase quick-6]: 8-week window computed in ServicesView as rotationServices prop — keeps RotationTable a pure display component
- [Quick-7]: sundayOrdinal() uses Math.ceil(day/7) — robust for any month length without hardcoding date ranges
- [Quick-7]: Team badge row uses v-if guard so ServiceCard layout is unaffected for services with no teams
- [Quick-7]: Song/Scripture labels use em dash (—) matching existing 'Scripture — Empty' pattern
- [Quick-7]: ServiceEditorView 'Service Type' heading renamed to 'Teams' per user preference
- [Quick-8]: typeBonus of +100 applied after base score in rankSongsForSlot — VW type is now a priority signal, not a gate
- [Quick-8]: Team filtering (AND logic) now operates on full song list so non-matching VW type songs are still subject to team constraints
- [Phase 06-01]: Use claude-haiku-3-5-20241022 model for AI suggestions (cost-efficient, max_tokens: 512)
- [Phase 06-01]: AI functions return null on any error (never throw) — UI callers check for null to show fallback
- [Phase 06-01]: Hallucination filtering: validateSongSuggestions checks against real song IDs, validateScriptureSuggestions checks against BIBLE_BOOKS
- [Phase 06-03]: showAiSuggest prop (not showOverlapWarning) controls AI visibility — orthogonal concerns, separate props
- [Phase 06-03]: recentScriptures uses ScriptureRef[] type matching actual claudeApi.ts signature
- [Phase 06-02]: SongSlotPicker stays as display component — parent handles API calls, caching; child only renders via props
- [Phase 06-02]: Map reactivity: replace Map ref (new Map(existing)) rather than mutate to trigger Vue 3 reactive tracking
- [Phase 06-02]: suggestAllSongs accumulates batchAcceptedIds across slots to prevent duplicate song picks in same bulk operation
- [Phase 06]: Proxy Anthropic API through Vite dev server (/api/anthropic) to avoid CORS without a backend
- [Phase 06]: Model corrected to claude-haiku-4-5-20251001 — previous IDs returned 404 from Anthropic API
- [Phase 06]: Scripture preview expands inline before selection — user sees passage text before committing
- [Phase 06]: Suggest All Songs removes filled-slot guard so planners can re-run to refresh picks
- [Phase 06]: CCLI included in song library AI prompt for VW type inference on untyped songs
- [Quick-13]: bg-sky-300 replaces bg-indigo-400 for rotation dots — better contrast on bg-indigo-900/50 dark backgrounds
- [Quick-13]: ScriptureRotationTable uses bg-sky-900/40 cell bg (distinct from song rotation bg-indigo-900/50)
- [Quick-13]: Scripture passage key format: 'Book Chapter:verseStart-verseEnd' / 'Book Chapter:verseStart' / 'Book Chapter'
- [Quick-13]: Scripture Rotation reuses rotationServices 8-week window from ServicesView — no separate window computation
- [Quick-14]: autosaveInitialized flag suppresses first-load watch trigger to prevent spurious save on mount
- [Quick-14]: previousService snapshot taken before each autosave (not after) so undo can restore the pre-save state
- [Quick-14]: Ctrl+Z skips INPUT/TEXTAREA targets so browser text-level undo is unaffected

### Roadmap Evolution

- Phase 6 added: AI assisted service suggesting and scripture searching
- Phase 7 added: Invite users, manage members with admin/viewer roles, and enforce role-based access control

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 6 | Limit rotation to 8-week window and rename tab to Song Rotation | 2026-03-04 | 238ac1e | [6-limit-rotation-to-8-week-window-and-rena](./quick/6-limit-rotation-to-8-week-window-and-rena/) |
| 7 | Service card team badges, song/scripture label prefixes, Sunday team defaults | 2026-03-04 | f1154f9 | [7-service-card-team-badges-song-slot-label](./quick/7-service-card-team-badges-song-slot-label/) |
| 8 | Song picker shows all songs with VW type priority (soft +100 bonus, no hard filter) | 2026-03-04 | 54106ae | [8-song-picker-shows-all-songs-with-type-pr](./quick/8-song-picker-shows-all-songs-with-type-pr/) |
| 9 | Allow scripture preview with book and chapter only (canPreview, conditional passageQuery) | 2026-03-04 | 2ba8775 | [9-allow-scripture-preview-with-book-and-ch](./quick/9-allow-scripture-preview-with-book-and-ch/) |
| 10 | Song — Empty, --- Prayer ---, optional verses for sermon passage | 2026-03-04 | 8272736 | [10-song-empty-label-and-prayer-slot-display](./quick/10-song-empty-label-and-prayer-slot-display/) |
| 12 | Communion checkbox + 1st-Sunday auto-default, PRAYER/MESSAGE links, compact song row, remove VW type buttons | 2026-03-04 | d04ec94 | [12-service-editor-ux-improvements-communion](./quick/12-service-editor-ux-improvements-communion/) |
| 13 | Song rotation dot bg-sky-300 visibility fix + Scripture Rotation tab with passage grid | 2026-03-04 | 464c8b2 | [13-fix-song-rotation-dot-visibility-on-dark](./quick/13-fix-song-rotation-dot-visibility-on-dark/) |
| 14 | Autosave to service editor with 1.5s debounce, one-step undo, and status indicator | 2026-03-04 | 6a5f861 | [14-add-autosave-to-service-editor-with-one-](./quick/14-add-autosave-to-service-editor-with-one-/) |

### Blockers/Concerns

- [Phase 3]: Suggestion algorithm scoring weights (recency decay, staleness threshold) are first-principles estimates; validate with team's actual song library before treating as final
- [Phase 3]: Vertical Worship slot type enforcement rules (exact 1-2-2-3 vs. 1-2-3-3 constraints) should be confirmed with team before implementation
- [Phase 2]: Real Planning Center CSV column schema should be validated against an actual export before finalizing the import column mapping

## Session Continuity

Last session: 2026-03-04T21:11:55.428Z
Stopped at: Phase 7 context gathered
Resume file: .planning/phases/07-invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control/07-CONTEXT.md
