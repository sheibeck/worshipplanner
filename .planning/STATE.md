---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Slides Tab Rework
current_phase: 25
current_phase_name: Slides Tab Shell — Plan Rail and Slide Grid
status: executing
stopped_at: Completed 25-05-PLAN.md
last_updated: "2026-07-26T23:02:03.486Z"
last_activity: 2026-07-26
progress:
  total_phases: 17
  completed_phases: 12
  total_plans: 81
  completed_plans: 79
  percent: 71
last_activity_desc: Opened v1.3 Slides Tab Rework (Phases 24-28) from the Claude Design import; v1.2 left code-complete with its verification ledger intact
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while rotating through the full song stable and respecting team configurations
**Current focus:** Phase 25 — Slides Tab Shell — Plan Rail and Slide Grid

> **v1.2 → v1.3 handoff (2026-07-25).** v1.2 is code-complete (Phases 18-23, all plans committed)
> but its human-verify batch is still outstanding. v1.2 was deliberately **not** archived: running
> `/gsd-complete-milestone` would fire `phases.clear`, moving `.planning/phases/18-*..23-*` into
> `milestones/v1.2-phases/` and breaking the `/gsd-verify-work 20..23` resume paths recorded below.
> Only the STATE frontmatter was switched to v1.3 so the roadmap parser scopes to Phases 24-28.
> The Deferred Verification table below still governs v1.2 and now covers v1.2 + v1.3 together.

## Current Position

Phase: 25 (Slides Tab Shell — Plan Rail and Slide Grid) — EXECUTING
Plan: 6 of 7
Milestone: v1.3 Slides Tab Rework (Phases 24-28) — IN PROGRESS
Status: Ready to execute

Phases 20, 21, 22 and 23 are all code-complete; only their deferred human-verify checkpoints remain
(see the Deferred Verification table below).

> **Phase-completion convention (confirmed by user 2026-07-26).** `workflow.verifier` is `false`, so
> no phase produces a `VERIFICATION.md` and `gsd-tools query phase.complete <N>` therefore refuses to
> run (`verification is incomplete`). ROADMAP checkboxes for Phases 20-28 stay `- [ ]` by design;
> phase completion is settled in one pass at `/gsd-audit-milestone`. Do NOT flip `workflow.verifier`
> to work around this, and do NOT treat the unchecked boxes as unfinished work — cross-check against
> the per-phase SUMMARY files and the code-complete record below.

### v1.3 code-complete record

| Phase | Plans | Code review | Notes |
|-------|-------|-------------|-------|
| 24 Slide Group Model and Migration | 6/6 | 1 critical + 2 warning, all fixed | See `24-REVIEW.md` / `24-REVIEW-FIX.md` |

## ★ v1.3 STANDING DECISIONS — apply to every remaining phase (25-28)

Captured from the user mid-run on 2026-07-26. Full text and rationale live in
`.planning/phases/25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium/25-CONTEXT.md` as
**D-18** and **D-19**. Recorded here because later phases read STATE.md, not Phase 25's context.

### No bed video — video is slide-only (D-18)

> "We won't ever have a bed video where a video plays over a whole group of slides. We can do that for
> audio, but a video slide will only ever be a slide and will never play over a group of slides."

`SlideGroup.bedVideoUrl`, `SlideBase.videoUrl`, `videoFromBed` and all bed-video rendering were
**deleted** in 25-02 (not deprecated). The group bed is **audio-only**. Group-bed AUDIO and per-slide
audio (with slide-beats-bed precedence and cross-group continuity) are kept, wanted features.

### No legacy compatibility anywhere in the slide area (D-19)

> "There is no need to keep legacy behavior for any work related to adding slides. That work has never
> been used or seen by anyone yet. So, we don't need to migrate anything or keep any old data."

> "for Phase 28 we can also skip any migration of data. We haven't used that in production either,
> so it's all greenfield." *(user, 2026-07-26 — extends D-19 explicitly to Phase 28)*

**Do NOT write migrations, deprecation shims, or read-time fallbacks for slide-area or song-lyrics
data.** Change the model directly and update the tests.

#### The boundary — check this before deleting anything

| Side | Scope | Rule |
|------|-------|------|
| **GREENFIELD** — delete freely | Everything from **Phase 18 onward**: slide groups, slide/group media, slideshow assembler, PPTX import, scripture slides, presentation/preview surfaces, **and the Phase 18 song-lyrics / performance-order structures Phase 28 reworks** | Never deployed, never seen by a user. No migration, no fallback, no deprecated field. |
| **PRODUCTION** — must preserve | `Service` / `ServiceSlot`, and the `Song` catalog records themselves | Shipped in **v1.0 (2026-03-05)**, human-verified against a real Planning Center account. Real data exists. |

Notably **Phase 24 D-01's lazy `ServiceSlot.id` backfill-on-read STAYS** — it guards real service
documents and is the one legacy path explicitly on the keep side.

For **Phase 28**: `Song` records and the catalog are production data; `Song.lyrics` and
`performanceOrder` as *structured by Phase 18* are greenfield and may be reshaped without migration.

Already actioned under D-19 (in 25-02 + its follow-up): the D-05 slot→group media migration, the
WR-02 `displaySlotAudioUrl`/`displaySlotVideoUrl` fallbacks, `MediaAttachableSlot.audioUrl`/`videoUrl`,
and `SlotMediaAttachment.vue`'s video-attach affordance are all deleted.

> **Migration note (2026-07-24):** This milestone was scoped and partially built in gsdpi
> (`.gsd/` milestone M001, slices S01-S06) and faithfully ported into gsd-core as v1.2.
> The gsdpi `.gsd/` store is now legacy/read-only — continue with regular `/gsd-*` commands.

## ⏸ RESUME HERE (2026-07-25 — Phase 23 code-complete, all v1.2 feature work done)

`/gsd-autonomous --from 23` completed Phase 23's automated work. **Nothing is mid-flight; working
tree is clean; production build is GREEN (`npm run type-check` = 0, `npm run build` = 0).**

**Done:** gsdpi→gsd-core migration (v1.2); Phases **20, 21, 22, 23 all code-complete** (every plan
committed and unit-tested); foundation hardened (lyrics Firestore rule + 94 type errors fixed +
import-save undefined fix). Phase 23 shipped `PresentationViewer.vue`, the `chromeless` media-player
mode with an `isMuted`/`unmute()` accessor, imperative media driving with three degraded states, and
the "Present Slideshow" CTA wired through `ServiceEditorView`.

**Next actions to finish the milestone (in order):**

1. **Pre-audit hardening batch** (see TODO below) — flip the `cleanupExpiredMedia` default to safe;
   clean `.gsd/quarantine/worktrees/**` test debris; fix the stale `RosterView.test.ts` assertion;
   get the full unit suite green.

2. **Batch human-verify** P20 + P21 + P22 + P23 — the deferred visual/e2e/projector checks. Doing
   all four in one sitting is worthwhile: P20's section grouping, P22's media autoplay and P23's
   projector legibility all want the same real-projector trip.

3. **Phases 18 and 19** are implemented but were never verified and are outside this run's `--from 23`
   scope — decide whether they need a verification pass before the audit.

4. **Milestone lifecycle:** `/gsd-audit-milestone` → `/gsd-complete-milestone v1.2` → `/gsd-cleanup`.

Orchestration note: `workflow.verifier` is `false` in `.planning/config.json`, so no phase produces a
`VERIFICATION.md` — goal-backward verification for the whole milestone happens at
`/gsd-audit-milestone`. Worktree isolation auto-degrades to sequential main-tree execution because
HEAD diverged from `origin/HEAD` (#683) — branch `milestone/M001`. `.env.local` present. A live user
session may hold the Firestore/Storage emulator (ports 8080/9199) — executors must NOT run
`test:rules` or restart the emulator.

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| 20 | verification_deferred_human | /gsd-verify-work 20 |
| 21 | verification_deferred_human | /gsd-verify-work 21 (import save confirmed live 2026-07-25; remaining: announcements/image, corrupted-file error, source-retention) |
| 22 | verification_deferred_human | /gsd-verify-work 22 (cleanup dry-run review + media/autoplay e2e) |
| 23 | verification_deferred_human | /gsd-verify-work 23 (real fullscreen + Esc-sync, real autoplay policy + held-key rapid advance, expired-media degradation, projector legibility, iPad Safari, and the two open overflow judgment calls — see 23-05-SUMMARY.md) |

**Pre-audit hardening TODO (batch before milestone complete):**

- **[SAFETY] Flip `cleanupExpiredMedia` default to dry-run/disabled** — 22-03 shipped it defaulting to LIVE delete (dry-run requires `MEDIA_CLEANUP_DRY_RUN=true`); a destructive scheduled deleter must default to safe (require an explicit opt-in like `MEDIA_CLEANUP_ENABLED=true` to delete). Update `functions/src/index.ts` + its test. Not deployed + no eligible data yet, so risk is currently nil — but fix before any deploy.
- ~~Fix `src/views/__tests__/ServiceEditorView.test.ts` — fails at mount since 21-01 added the `importedSlides` store subscription without a Pinia mock stub~~ — **FIXED in 22-04** (`8e3afb2`): added the missing `@/stores/importedSlides` reactive-stub mock; all 14 real tests now pass.
- Run the FULL unit suite green + clean stale `.gsd/quarantine/worktrees/**` debris. Measured on `milestone/M001` after Phase 23 + its code-review fixes (`npx vitest run src/`): **3018 pass / 44 fail**, and every one of the 44 is pre-existing —
  - `.gsd/quarantine/worktrees/**` stale duplicates (35 tests across 6 files) — delete the debris. Note the count is *unstable* run-to-run (32 → 44 total across two runs an hour apart, entirely from the two quarantined `rules.test.ts` copies flapping against the emulator); the real-source failure set never moved.
  - `src/storage.rules.test.ts` (8 tests) — needs the Storage emulator, which is deliberately not started during autonomous runs. Verify separately when no live session holds ports 8080/9199.
  - **NEW — `src/views/__tests__/RosterView.test.ts` (1 test, "wraps Roles config in CollapsibleSection")** — stale assertion expecting the string `"Roles config"`; commit `df1ca34` renamed that tab to `"Roles"` and the test was never updated. One-word fix; unrelated to Phases 18-23, so it was deliberately NOT patched mid-phase.
- Batch human-verify P20 (section grouping / live reorder / override marker) + P21 (PPTX e2e) + P22 (cleanup dry-run + media autoplay) + P23 (fullscreen / autoplay / projector — see 23-05-SUMMARY.md).

Phase 20 code is complete + unit-tested (all plans 20-01..20-04 committed). The blocking
human-verify checkpoint (section grouping, live reorder-follows-slides, scripture override
marker) was deferred by the user to a batch visual-verify at milestone end. Autonomous
continued to Phase 21 per explicit user choice (2026-07-24).

## Deferred UI Follow-up (post-milestone — user request 2026-07-25)

A dedicated UI polish phase is planned AFTER v1.2 feature work completes. Captured items:

- **SlideshowPreview should be its own TAB** in the service editor screen (currently pushed to
  the bottom of the service page — move it into a tab, like the Music/Roles tab bar).

- **Empty sections not visible:** the Pre-Service section doesn't render because it has no
  elements — decide whether to show empty section headers/placeholders so all four sections
  (Pre-Service/Worship/Message/Sending) are always visible.

- General editor UX polish pass (R018) once all content types (lyrics/scripture/PPTX/media/preview) exist.

**Additional UI-phase notes (user, 2026-07-25, from live testing):**

- **All slide editing lives in a "Slides" tab** on the service plan (not scattered / bottom-of-page).
- **Collapsible preview items** to cut scrolling: after importing a PowerPoint, show it in the Slides tab as a **parent node with the slide title**, minimizable; expanding reveals slide content.
- **Render formatted slides**, not just text — show the actual slide visuals/formatting in the preview (currently text-only).
- **Insert a slide deck / image / video at ANY point in the service** — NOT limited to Announcements/Sermon sections. Replace the section-scoped "Import PowerPoint (Sermon/Announcements)" actions with a generic **"Add Slide Deck"**, plus separate **"Add Image"**, **"Add Video"**, etc. Imported decks/media become first-class service **items** that can be dragged/reordered like any other slot. (This reworks the Phase 21 section-scoped import model + relates to how Phase 22 media surfaces — capture only, do not re-architect mid-milestone.)

### ★ Phase 24 core shape (user, 2026-07-25, end of Phase 23) — the organizing idea

This supersedes and unifies most of the captured items above. **Slide functionality keeps getting
tied to the service plan itself; it should be its own surface that MIRRORS the order of service
rather than duplicating it.**

**Tab structure** — three tabs in the service editor:

| Tab | Was | Contains |
|-----|-----|----------|
| **Service** | renamed from "Music" | the order of service (the existing slot list) |
| **Roles** | unchanged | Phase 17 role assignments |
| **Slides** | NEW | **ALL** slide editing, nothing scattered elsewhere |

**The Slides tab mirrors the order of service.** It shows the same service sections
(Pre-Service / Worship / Message / Sending) and, inside each, whatever the user put into the
slideshow — slides, music, videos, imported decks. Because it *mirrors* rather than *copies*,
reordering the service or moving a song on the **Service** tab must NOT require a second manual
reorder on the **Slides** tab. One reorder, both views follow. This is the whole point of the
restructure.

**In the Slides tab the user can:**

- attach music, video, or a slide deck at any point,
- import a PowerPoint,
- **attach music to an individual slide *inside* a deck** — not to a service slot, but to one
  specific slide within one specific deck.

> ⚠ **Architectural conflict to resolve at Phase 24 planning time.** That last bullet directly
> contradicts a Phase 22 decision now in the codebase: *"Media attaches at ServiceSlot level (not
> canonical song/scripture/deck), per D002"*, implemented as `SlotMediaAttachment` mutating
> `localService.slots[index]` and propagated by the assembler onto only the first emitted slide per
> slot. Per-slide-within-a-deck media needs an attachment point the current model does not have.
> Decide deliberately: extend the slide model with its own media field (slide loosely coupled to the
> service, which is what the user described), or keep slot-level media and add a deck-slide override
> layer. Do not let this get decided by accident during implementation.

The slide is **loosely coupled** to the service — that phrasing is the user's and is the design
constraint to hold onto.

Do NOT action during current milestone build — revisit as a follow-up UI phase (Phase 24 candidate).

## Milestone v1.2 Decisions (from gsdpi DECISIONS.md D001-D006)

- **D001** (architecture): Unified slide data model — single slide type with content-kind field (lyric, scripture, image, video, text) rather than distinct types per content. Simpler editor/reordering/mental model.
- **D002** (architecture): Single canonical song lyric version per song; services reference live, not as copies. Eliminates wrong-slides-at-rehearsal; user explicitly rejected per-service copies.
- **D003** (architecture): PowerPoint (.pptx) as the universal import format; Google Slides/Keynote users export to PowerPoint first. One pipeline, avoids OAuth/protobuf complexity.
- **D004** (architecture): Server-side PPTX parsing via Firebase Cloud Function. More reliable, no browser memory limits.
- **D005** (architecture): Four formalized service sections (Pre-Service, Worship, Message, Sending) as default. Clear template; deterministic auto-assembly.
- **D006** (architecture): Manual copy/paste from CCLI SongSelect with auto-parsing of section markers. CCLI provides no API access (hard constraint).

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
| Phase 17 P04 | ~40min | 2 tasks | 2 files |
| Phase 17 P05 | ~25min | 2 tasks | 3 files |
| Phase 20 P01 | 25min | 3 tasks | 4 files |
| Phase 20 P02 | 9min | 2 tasks | 2 files |
| Phase 20 P03 | 33min | 1 tasks | 2 files |
| Phase 20 P04 | 40min | 3 tasks | 5 files |
| Phase 21 P01 | 25min | 3 tasks | 10 files |
| Phase 21 P02 | 55min | 3 tasks | 6 files |
| Phase 21 P03 | 15min | 3 tasks | 7 files |
| Phase 21 P04 | 23min | 3 tasks | 3 files |
| Phase 21 P05 | 25min | 3 tasks | 3 files |
| Phase 21 P06 | 35min | 2 tasks | 3 files |
| Phase 22 P01 | 25min | 3 tasks | 8 files |
| Phase 22 P02 | 20min | 3 tasks | 6 files |
| Phase 22 P03 | 20min | 1 tasks | 2 files |
| Phase 22 P04 | ~35min | 2 tasks | 4 files |
| Phase 23 P01 | 8min | 2 tasks | 4 files |
| Phase 23 P02 | 15min | 2 tasks | 2 files |
| Phase 23 P03 | 20min | 2 tasks | 2 files |
| Phase 23 P04 | 25min | 3 tasks | 4 files |
| Phase 24 P01 | 78min | 3 tasks | 13 files |
| Phase 24 P02 | 17min | 3 tasks | 2 files |
| Phase 24 P03 | 8min | 3 tasks | 2 files |
| Phase 24 P04 | 23min | 3 tasks | 11 files |
| Phase 24 P05 | 14min | 3 tasks | 3 files |
| Phase 24 P06 | 26min | 3 tasks | 2 files |
| Phase 25 P01 | 35min | 3 tasks | 7 files |
| Phase 25 P03 | 2.5h | 3 tasks | 8 files |
| Phase 25 P02 | ~45min | 3 tasks | 16 files |
| Phase 25 P04 | ~2h | 3 tasks | 8 files |
| Phase 25 P05 | ~2h | 3 tasks | 11 files |

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
- [Phase ?]: 17-04: Roles tab is editor-only in-app — the tab button is hidden for viewers AND rosterStore/quartersStore are subscribed only when authStore.isEditor (not just UI hiding), so a viewer on the guard-less /services/:id route never reads editor-only roles/quarters/people (T-17-04-01); viewer visibility ships only via the 17-05 public share link, Phase 16.2 decision intact
- [Phase ?]: 17-04: Roles override picker reuses QuarterGrid.vue's person.roles.includes(roleId) eligibility (no hand-rolled eligibility, D-03); toggles write via 17-03's scoped setRoleOverride/clearRoleOverride so the Quarter/schedule is never mutated from the service editor
- [Phase ?]: [Phase 17] 17-05: ShareView dual-path public read (opaque token vs memorable serviceShares) reads only the snapshot doc, no roster/org/auth store import (T-17-05-01)
- [Phase ?]: [Phase 17] 17-05: Who's Serving section renders serviceSnapshot.roleAssignments, gracefully omitted for legacy shares with no roleAssignments (T-17-05-03)
- [Phase ?]: [Phase 20-01]: SERVICE_SECTIONS kept as single source-of-truth array so per-church configurable sections is a localized future change
- [Phase ?]: [Phase 20-01]: createSlot() omits the section key entirely (conditional spread) rather than section: undefined, preserving byte-identical legacy object shape
- [Phase ?]: [Phase 20-02]: Song order precedence chain implemented as performanceOrderById -> lyrics.performanceOrder -> lyrics.sections stored order (research fallback for missing Song.performanceOrder)
- [Phase ?]: [Phase 20-02]: AssembledSlide.slotIndex captured as the slot's true array index in service.slots (paired before sorting by position), decoupling provenance from position-value correctness for legacy/malformed data
- [Phase ?]: [Phase 20-02]: DistributiveOmit<T,K> type pattern introduced because plain Omit over the Slide discriminated union collapses to only common keys
- [Phase ?]: [Phase 20-03]: assembledSections places the legacy (undefined-section) group TRAILING after named SERVICE_SECTIONS groups; empty section groups are omitted entirely
- [Phase ?]: [Phase 20-03]: scriptureSlides store has no orgId field (unlike songs store) — composable owns a local subscribedOrgId guard ref to prevent double-subscription instead
- [Phase ?]: [Phase 20-03]: songLyricsById reactive Map only grows (never prunes) as songs are removed/re-added from the service — matches the T-20-03-DoS 'only fetch missing songIds' mitigation, harmless since the pure engine only reads entries for songIds in the current service
- [Phase ?]: [Phase 20-04]: Section headers render as sibling divs in the same flat SortableJS list; Sortable's draggable: '.slot-item' option scopes drag/index math to slot items only, keeping onEnd/reindexSlots (MEM008) untouched
- [Phase ?]: [Phase 20-04]: Per-slot section select mutates slot.section directly, routed through the existing deep-watch(localService) autosave path used by every other slot field — no new persistence path
- [Phase ?]: IMPORTED slot mirrors SCRIPTURE exactly (deck-by-id, forEach-emit, tolerate null/unresolved id)
- [Phase ?]: storage.rules uses generic orgs/{orgId} path (not PPTX-specific) so Phase 22 media attachments reuse the same rule
- [Phase ?]: Removed firebase.json emulators.singleProjectMode:false; pinned --project test-project on test:rules instead, fixing cross-service firestore.exists() checks in storage.rules under the emulator
- [Phase ?]: officeparser installed as functions/ runtime dependency post-human-approval (2019 pkg creation, 585K weekly downloads, MIT, real repo — [SUS] 'too-new' verdict overridden as a confirmed false positive)
- [Phase ?]: docs/example.pptx (real user-provided deck) used as the mixed.pptx integration fixture; text-only.pptx/image-only.pptx deferred pending additional human export
- [Phase ?]: PPTX mixed-content heuristic: 40-char flattened-text threshold decides text-dominant vs image-dominant slide, calibrated against the real mixed.pptx fixture.
- [Phase ?]: generateImportId() (crypto.randomUUID) scopes only the upload-session Storage path; the deck's real importId comes from importedSlides.createDeck()'s Firestore auto-id on confirm
- [Phase ?]: Vue Test Utils Teleport testing pattern established: DOMWrapper over document.body + enableAutoUnmount(afterEach), needed since PptxImportModal (like other codebase modals) teleports to <body>
- [Phase ?]: [Phase 21-06]: ImportedSlideEditor omits store subscribeDecks/unsubscribeDecks -- useSlideshowAssembly already owns a single org-scoped importedSlides subscription for the whole ServiceEditorView page; a per-editor unsubscribe would tear that down and break the live Slideshow Preview
- [Phase ?]: [Phase 21-06]: PC-export skips IMPORTED slots via an early continue in the no-template export loop (RESEARCH Pitfall 2); the existing-plan branch already excluded IMPORTED since it only iterates the SONG/HYMN and SCRIPTURE filtered buckets
- [Phase ?]: Media attaches at ServiceSlot level (not canonical song/scripture/deck), per D002
- [Phase ?]: Assembler propagates slot media onto only the first emitted slide per slot via a Set<slotIndex> tracker
- [Phase ?]: storage.rules media cap layered as an additive sibling match block (OR-across-matching-blocks semantics), not a rewrite
- [Phase ?]: VideoPlayer autoplay-fallback: muted-retry success and muted-retry failure both emit 'autoplay-blocked'; driving layer distinguishes by element muted state, not a second event
- [Phase ?]: Both AudioPlayer/VideoPlayer explicitly emit 'play' from inside play() on success (in addition to the native @play listener) so imperative callers get the signal even against jsdom media-element test doubles that don't dispatch native events
- [Phase ?]: [Phase 22-04]: SlotMediaAttachment mutates localService.slots[index] directly (mirrors onSectionChange) so attach/remove rides the EXISTING deep-watch autosave -- no new save path
- [Phase ?]: [Phase 22-04]: Fixed pre-existing ServiceEditorView.test.ts Pinia crash (missing importedSlides mock since 21-01) as a Rule 3 blocking auto-fix -- it blocked this plan's own required test verification
- [Phase ?]: 23-01: muted.value=false set as first statement of VideoPlayer play()'s hard-failure branch, making isMuted the true discriminator between muted-retry-success and hard-block autoplay-blocked emissions
- [Phase ?]: 23-01: unmute() never rethrows NotAllowedError -- restores muted=true and re-emits autoplay-blocked instead, matching play()'s existing convention
- [Phase ?]: 23-02: PresentationViewer congregational-scripture empty/undefined sections falls back to normal-mode text rendering (planner assumption adopted verbatim)
- [Phase ?]: 23-02: PresentationViewer loading state gated on isLoading && slides.length===0 so a background refetch mid-show never re-covers an already-rendered presentation
- [Phase ?]: 23-02: exitPresentation() guarded with a local hasExited boolean so Escape + a browser-driven fullscreenchange cannot double-emit exit
- [Phase ?]: PresentationViewer media layer: pauseCurrentMedia() moved to onBeforeUnmount (Vue nulls child refs before parent onUnmounted runs); bodyIsCaption caption-swap applies to Body-role slides only, not the Display-role copyright title
- [Phase ?]: [Phase 23-04]: SlideshowPreview canPresent computed aliases hasAnySlides (no new prop) - equivalence to assembledSlideshow.length > 0 verified against useSlideshowAssembly grouping
- [Phase ?]: [Phase 23-04]: ServiceEditorView widens existing useSlideshowAssembly destructure to add assembledSlideshow/isLoading instead of re-flattening assembledSections - no new ordering logic
- [Phase ?]: [Phase 24-01]: SourceRef gets a fifth 'copyright' kind member so song groups' leading/trailing copyright entries never abuse sectionId
- [Phase ?]: [Phase 24-01]: backfillSlotIds(service, reference?) two-argument form corrects RESEARCH.md's single-argument design -- reusing the reference's id at the same array index (kind-guarded) keeps the remote-merge JSON.stringify comparison stable across snapshots
- [Phase ?]: [Phase 24-02]: materializeGroupIfMissing writes id/slotId/serviceId/slides + timestamps in one setDoc, never addDoc (deterministic doc id = slot id, per-tab race is a harmless overwrite)
- [Phase ?]: [Phase 24-02]: setGroupBedMedia uses explicit clearAudio/clearVideo flags mapped to deleteField() rather than undefined-means-clear, since stripUndefined() would otherwise erase that intent before Firestore sees it
- [Phase ?]: [Phase 24-02]: RESEARCH.md Open Question 1 resolved -- audioScope:'group' writes directly to bedAudioUrl via setGroupBedMedia; stored audioScope is UI-round-trip-only, the assembler never interprets it
- [Phase ?]: [Phase 24-03]: sourceSignature computed for ALL slot kinds (incl. SONG) for storage parity, even though only scripture/imported reconciliation reads it
- [Phase ?]: [Phase 24-03]: retained-but-unresolvable song-lyric entries appended after the resolvable run in original relative order (not interleaved) -- avoids a generic LCS-style merge RESEARCH.md warns against
- [Phase ?]: [Phase 24-04]: Tasks 1+2 (group join + D-04 audio precedence) combined into one commit since both edit the same emitFromGroup loop body
- [Phase ?]: [Phase 24-04]: Fallback-path slide ids now derive from the slot's stable id rather than array index, so a pre-materialization render cannot churn Vue keys
- [Phase ?]: [Phase 24-05]: materializationCandidates/reconciliationOutcomes split into a synchronous computed (decision) + watch callback (async effect) -- an async watchEffect body only tracks reads before its first await
- [Phase ?]: [Phase 24-05]: SONG slot with no song assigned materializes NO group (buildInitialGroup resolves to zero slides) rather than an empty one, per D-02
- [Phase ?]: [Phase 24-05]: fixed a test-isolation leak (onUnmounted never fires for direct composable calls) by wrapping each test's useSlideshowAssembly() in its own effectScope, stopped in afterEach
- [Phase ?]: [Phase 24-06]: shallowMount auto-stubs <Teleport> unless stubs: { teleport: false } is set explicitly -- required to assert against a Teleported dialog under shallowMount
- [Phase ?]: [Phase 24-06]: confirmSlotDelete resolves the slot id BEFORE the splice, awaits slideGroupsStore.deleteGroup first, and leaves the slot in place on a failed delete (T-24-06-02)
- [Phase ?]: [Phase 25-01]: VideoSlide's own-source field named videoSrc (not videoUrl) to avoid colliding with SlideBase.videoUrl's group-bed carrier role in emitFromGroup's spread
- [Phase ?]: [Phase 25-01]: isNonDerivableEntry (video kind, or authored text kind) is the single predicate hasCustomization/computeLoss consult to gate reconciliation deletion of user-appended entries
- [Phase ?]: 25-03: SlidePlanRail receives raw (unsorted) slots and sorts internally, carrying original array index so counts stay aligned with AssembledSlide.slotIndex
- [Phase ?]: 25-03: PendingReconciliation shape duplicated locally in SlidesTab.vue rather than imported from useSlideshowAssembly, to satisfy the plan's no-composable-reference verification gate
- [Phase ?]: [Phase 25-02]: bedVideoUrl/videoFromBed/SlideBase.videoUrl deleted end-to-end (D-18) -- bed is audio-only; currentVideoUrl/currentVideoKey resolve purely from a video slide's own videoSrc with no group-continuity branch
- [Phase ?]: [Phase 25-02]: bodyIsCaption removed from PresentationViewer as dead code -- video can never coexist with a text-bearing slide once video is slide-only, so the caption-demotion path was provably inert
- [Phase ?]: [Phase 25-02]: SlotMediaAttachment.vue's video attach affordance removed beyond the plan's stated file scope -- leaving it wired to an unbound update:videoUrl after ServiceEditorView drops the listener would silently discard uploaded video files with no error
- [Phase ?]: Centralized PendingReconciliation and added slideBodyText/slideFooterLabel to shared slideDisplay.ts rather than duplicating per-component narrowing
- [Phase ?]: ensureGroupMaterialized returns the entries it wrote rather than expecting the caller to re-read groupsBySlotId, since the store write lags a Firestore snapshot round trip
- [Phase ?]: SlideGrid add-slide handler always calls ensureGroupMaterialized first (even when a stored group already exists) to avoid appending to a stale entries list
- [Phase ?]: SlideGrid imports useSlideGroups() directly for its two write actions while never importing useSlideshowAssembly itself

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
- 22-03: dry-run human-verify checkpoint (Task 2) pending before enabling live deletion in cleanupExpiredMedia
- 22-04: media/autoplay e2e human-verify checkpoint (Task 3) pending before this plan is fully signed off

## Session Continuity

Last activity: 2026-07-26
Last session: 2026-07-26T23:02:03.433Z
Stopped at: Completed 25-05-PLAN.md
Resume file: None
