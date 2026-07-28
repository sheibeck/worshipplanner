---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Service and Slides
current_phase: 29
current_phase_name: Order Structure — Stable Reordering & Post-Service
status: planning
stopped_at: Completed 29-03-PLAN.md
last_updated: "2026-07-28T23:02:39.041Z"
last_activity: 2026-07-28
last_activity_desc: ROADMAP.md created for v1.4 (Phases 29-37); REQUIREMENTS.md traceability filled, 34/34 requirements mapped, 0 unmapped
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-28)

**Core value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while rotating through the full song stable and respecting team configurations
**Current focus:** v1.4 Service and Slides — ROADMAP.md created (Phases 29-37), ready to plan Phase 29

> **Historical note (2026-07-25 v1.2 → v1.3 handoff) — OBSOLETE.** A note here formerly explained why
> v1.2 was deliberately left un-archived to preserve `/gsd-verify-work` resume paths. Both v1.2 and
> v1.3 were archived on 2026-07-28 and their phase directories now live under
> `milestones/v1.2-phases/` and `milestones/v1.3-phases/`. Retained only so the reasoning isn't
> rediscovered from scratch.

## Current Position

Phase: 29 of 37 (Order Structure — Stable Reordering & Post-Service)
Plan: — (not yet planned)
Status: Roadmap created — ready to plan Phase 29
Last activity: 2026-07-28 — ROADMAP.md created for v1.4 (Phases 29-37); REQUIREMENTS.md traceability filled, 34/34 requirements mapped, 0 unmapped

## ★ v1.4 AUTONOMOUS RUN — standing decisions (2026-07-28)

- **Phase 37 (PPTX rendering): BUILD BUT DO NOT DEPLOY.** Write the Cloud Run service, Dockerfile,
  bridging Cloud Function and tests, then STOP and hand the owner the exact `gcloud run deploy`
  command. Deploying provisions billable infrastructure — it is the owner's call, not the run's.

- **Backlog 999.1 is excluded from autonomous runs.** Phase discovery returns it (it sorts after 37),
  but it must be promoted deliberately via `/gsd-review-backlog`. Scope autonomous with `--to 37`.

## ★ v1.4 RESEARCH FINDINGS — read before planning any v1.4 phase

Full detail in `.planning/research/`. Recorded here because phase planners read STATE.md.

### The drag-and-drop root cause is FOUND (HIGH confidence — verified against sortablejs v1.15.7 source)

Three compounding bugs in `ServiceEditorView.vue`'s Sortable `onEnd` handler. This is **not** a
fundamental SortableJS/Vue incompatibility, and it is **not** the DOM-revert trap already fixed under
`D-16` (`ServiceEditorView.vue:1430`, `SlideGrid.vue:669`) — that earlier fix was real but addressed a
different failure:

| # | Bug | Effect |
|---|-----|--------|
| A | Uses `evt.oldIndex` / `evt.newIndex` | These count section-header nodes. Despite `draggable: '.slot-item'`, only `oldDraggableIndex` / `newDraggableIndex` honor that selector — so every cross-section drag splices at the wrong index. |
| B | DOM-revert undoes ONE adjacent step, not a full revert | Multi-position drags leave DOM and state diverged. |
| C | `v-for` key is `slot.kind + '-' + slot.position` | `reindexSlots()` rewrites `position` on every reorder → every key changes every reorder → Vue's keyed diff is defeated. Should be `slot.id` (stable, already anchors slide groups). |

Explains every reported symptom including "correct again after refresh." **The same pattern is
copy-pasted in `SlideGrid.vue`** — the "new slide lands second-to-last" bug is the same family, not a
separate defect. Open trade-off for phase planning: per-section Sortable instances (recommended, more
robust) vs one flat list read via `*DraggableIndex` (cheaper, less robust).

### Draft-lock enforcement today is effectively ZERO (HIGH confidence)

`firestore.rules` has **no** status check on services (role only); the router doesn't gate role on
`/services/:id`; the sole existing gate `isExportedLocked` is scattered, cosmetic, and doesn't even
cover `planned`. A UI-only lock would be bypassable — the lock needs a rules-level requirement.

### Autosave hypothesis (MEDIUM confidence — NOT reproduced live)

Each save's own Firestore echo carries a server `updatedAt` the client never tracked (`onSave()`
destructures it out of the write payload), tripping the remote-merge watcher, which unconditionally
resets the `autosaveInitialized` guard — swallowing whatever discrete mutation lands next. Continuous
typing self-heals on the next keystroke; a one-shot action like picking a song does not.
`ServiceEditorView.vue` also hand-duplicates the already-tested `useAutoSave` composable.
**Write a failing repro test FIRST** — do not rewrite blind.

### Other confirmed findings

- **Reconciliation deletion** touches 9 files + tests (`slideGroupMaterializer.ts`,
  `useSlideshowAssembly.ts`, `slideGroup.ts`, `slideGroups.ts`, `ReconcileConfirmModal.vue`,
  `SlideGrid.vue`, `SlidesTab.vue`, `slideDisplay.ts`, `ServiceEditorView.vue`). **Keep** the
  concurrent-write transaction merge in `replaceGroupSlides` even after the confirm gate goes.

- **Post-Service** is a one-place additive type change in `src/types/service.ts` (no migration), but
  print / share / plan-rail / PC-export need auditing for hard-coded four-section assumptions.

- **PPTX rendered images** belong under the existing `orgs/{orgId}/pptx-imports/{importId}/` prefix —
  structurally exempt from `cleanupExpiredMedia`'s regex guard with zero changes to that function.

- **CCLI copyright placement:** the real-world convention is "at least once per song, typically the
  last slide." The v1.4 requirement (first AND last) **exceeds** the legal minimum — a deliberate
  safety margin for mid-deck starts and songs cut short. Do NOT justify it as "CCLI requires this."
  Pull the actual license text before finalizing that acceptance criterion.

- **Draft-lock/reopen has no competitor precedent** — Planning Center Services gates on roles only.
  This is an original design call, not a convention being copied.

### v1.4 ROADMAP.md phase breakdown (created 2026-07-28)

9 phases (29-37), derived from `research/SUMMARY.md`'s 9-phase default with hard sequencing applied.
Departures from the research default, recorded explicitly per the roadmapper's instructions:

- Merged SUMMARY's "stable key/ordering model" and "Post-Service" phases into one **Phase 29** — R043
  ("the five sections...") textually presupposes Post-Service already exists, and Post-Service alone
  is too thin a phase under this project's `coarse` granularity setting.

- Moved **Phase 37 (PPTX rendering)** to the true end of the sequence (was mid-sequence in SUMMARY) —
  per the user's explicit milestone decision to schedule it last so an overrun/cut disturbs nothing else.

- Split SUMMARY's final "presentation correctness + CCLI + action bars" phase into two: **Phase 35**
  (presentation correctness + lyric editor, standard-pattern) and **Phase 36** (Service Order rebuild +
  contextual action bars, sequenced last among UI work) — kept separate so each has a coherent goal.

- **R053** (drop-zone-as-import + moving Add-slide/Add-music into the action bar) was moved from the
  Slides-interaction cluster into **Phase 36** because its own requirement text names R068 (the action
  bar) as its target — building it before Phase 36 would mean building it twice.

- **R054** (song groups read-only in Slides tab) was grouped into **Phase 30** (hard-lock/reconciliation
  removal) rather than with the rest of Slides interaction — ARCHITECTURE.md §3 treats it as the same
  "structural shape can no longer diverge" change that makes reconciliation deletable.

Full phase table, success criteria, and per-phase research/notes: `.planning/ROADMAP.md`. Traceability:
`.planning/REQUIREMENTS.md` (34/34 mapped, 0 unmapped).

### v1.3 code-complete record

| Phase | Plans | Code review | Notes |
|-------|-------|-------------|-------|
| 24 Slide Group Model and Migration | 6/6 | 1 critical + 2 warning, all fixed | See `24-REVIEW.md` / `24-REVIEW-FIX.md` |
| 25 Slides Tab Shell — Plan Rail and Slide Grid | 7/7 | 2 critical + 2 warning, all fixed | See `25-REVIEW.md` / `25-REVIEW-FIX.md`. Also carries the mid-phase D-18/D-19 model deletion. |
| 26 Edit Slide Drawer | 9/9 | 3 critical + 1 warning, all fixed | See `26-REVIEW.md` / `26-REVIEW-FIX.md`. **Closed Phase 24+25's deferred reconciliation-confirm debt.** |
| 27 Service Order Tab — Rename and Strip Slide Editing | 5/5 | **0 critical**, 1 warning fixed | See `27-REVIEW.md` / `27-REVIEW-FIX.md`. Clean removal — reviewer traced all load-bearing paths end to end. |
| 28 Song Lyrics Editor Rework | 6/6 | **0 critical**, 2 warnings fixed | See `28-REVIEW.md` / `28-REVIEW-FIX.md`. **Final phase of v1.3.** |

**Phase 28 shipped (design option 2a, chosen by the user — the milestone's one mandated design choice):**
`src/utils/songSectionOrder.ts` (pure pool+order model and helpers), one scroll surface with one
numbered, collapsible, drag-reorderable section list that IS the slide order, `Duplicate` / `Remove` /
`＋ Add section`, and an R035 acceptance suite (`SongLyricsTab.r035.test.ts`) that asserts *no nested
scrollbar* and *exactly one list* as counts over the mounted subtree rather than by eye.
Option **2b** (the "Switch to Sections to reorder" mode toggle, including its `Lyric sheet` segment) is
**deferred, not built**.

**Two latent defects found and fixed during Phase 28:**

- **Compounding reconciliation bug (28-03).** `reconcileSongGroup` pushed the WHOLE `storedBySectionId`
  array on every occurrence of a section id. Once D-02 made repeats first-class, a twice-referenced
  chorus with two stored entries compounded 2 → 4 → 8 → 16 — on the **additive** path, which has no
  confirm gate. Fixed by consuming stored entries positionally (occurrence `i` takes entry `i`, surplus
  emitted after the last occurrence), which keeps Phase 26-09's duplicate-survival case byte-equivalent.
  Idempotence asserted for N=M, N<M and N>M, and independently hand-traced by the reviewer.

- **Two competing order fields (28-02).** Order lived in BOTH `Song.performanceOrder` and
  `SongLyrics.performanceOrder`, behind a 3-tier precedence chain duplicated in `slideshowAssembler.ts`
  and `slideGroupMaterializer.ts` — and `PerformanceOrderBuilder` **read one but wrote the other**, so
  its displayed order never reflected what it saved. Collapsed to one canonical source;
  `Song.performanceOrder`, its writer action, the precedence chain and `PerformanceOrderBuilder.vue`
  are all deleted (D-19).

**One unrequested removal caught and reverted:** plan 28-04 dropped the editor's read-only CCLI
copyright block. No decision authorized it and R035 says nothing about it, so 28-06 restored it inside
the single scroll region. The `CopyrightSlide` emission path was verified never affected.

**Phase 28 items for batch human-verify:** the reworked editor's feel with a real multi-repeat song;
that a CCLI paste of a song with repeated choruses folds into pool references rather than duplicates;
and that editing a repeated section visibly updates every occurrence.
| 28 Song Lyrics Editor Rework | 6/6 | Not run (no `/gsd-code-review` invoked this phase) | R035 proven by assertion in `28-06`'s acceptance block; restored the CCLI copyright display 28-04 dropped without a decision. Full unit suite failing-file-set unchanged from the 10-file baseline. |

**Phase 27 shipped:** first tab renamed **Music → Service Order** (label AND the `activeTab` union value,
now `'service-order' | 'roles' | 'slides'`); the deck editor, both PPTX-import menu entries, the per-slot
media control and the slideshow preview stripped off it; `ImportedSlideEditor`, `SlotMediaAttachment` and
`SlideshowPreview` deleted with their tests (D-02/D-19); and the `▶ Present` CTA moved to the Slides tab.

**Two ROADMAP premises proved false during Phase 27** — it claimed the phase "runs after 25-26 so the
functionality has a new home before it leaves the old one." That was wrong twice, and both were caught
before anything broke:

- **Scripture editing (D-01):** Phase 26's "Edit in scripture" link navigates *back* to this tab.
  Resolved by keeping `ScriptureSlideEditor` on Service Order — choosing the passage and reading mode is
  service-order content, not slide editing.

- **Presenting (D-05, user decision):** `SlideshowPreview` carried the ONLY trigger for Phase 23's
  `PresentationViewer`, and the Slides tab had no present affordance. Resolved by moving `▶ Present` to
  the Slides tab — the one new affordance Phase 27 was authorized to build.

**Phase 27 kept deliberately** (verified intact by review): Phase 24 D-01's lazy `ServiceSlot.id`
backfill (production data), the section-assignment `<select>` (D-04), the group delete cascade + warning,
the `expandScriptureEditor` / `handleNavigateToScriptureEditor` relay, the group-bed audio write path,
and autosave. `PptxImportModal.vue` survived (`SlideGrid` imports it) as did `PresentationViewer`.

**Known pre-existing dead code, deliberately NOT touched:** `isSlotPopulated` in `ServiceEditorView.vue`
has been unreachable since Phase 12-05. Out of scope for a removal phase that had already closed —
flagged in `27-REVIEW.md` as IN-01 for a future cleanup.

**Phase 26 shipped:** `EditSlideDrawer.vue` (scrimless floating panel that follows the grid selection),
`ReconcileConfirmModal.vue`, per-kind slide text keyed on `sourceRef.kind`, "Edit in song" via a new
`songEditLink.ts` query convention (`/songs` had no per-song route), "Edit in scripture" via new
`SlideGrid → SlidesTab → ServiceEditorView` relay plus an expand-only entry point, slide audio with
scope + loop, `Duplicate`, and delete behind a warning naming what is lost.

**Phase 26 closed the reconciliation debt** Phases 24 and 25 both deferred: `SlideGroup.dismissedSignature`

+ `dismissReconciliation` give a per-divergence durable dismissal, and `ReconcileResult.songSwap` carries

the old/new song ids so the song-identity-swap confirm (Phase 24's CR-01 blocker) can name both songs.
The Phase 25 limitation where a diverged group was stuck showing a passive banner is resolved.

**Latent defect found and fixed during Phase 26 (26-09 Task 1):** `reconcileSongGroup` indexed stored
lyric entries into a `Map` keyed by `sectionId`, so a *duplicated* lyric entry would have been silently
dropped on the next additive reconciliation — with no confirm gate, because the additive path has none.
Fixed (`storedBySectionId` is now an array) before `Duplicate` shipped.

**Phase 26 items for batch human-verify:** drawer floats with no reflow underneath (R033); the grid stays
clickable with the drawer open (no scrim, D-03); whether the reconciliation warning is concrete enough
WITHOUT a diff (D-06 — the user traded the diff away, so this is the accepted-trade-off check); and both
"Edit in song" / "Edit in scripture" links landing correctly.

**Known Phase 26 stub:** `audioDurationText` is permanently unset — the shared `AudioPlayer.vue` uses
`preload="none"` and exposes no duration signal. Documented rather than worked around.

**Phase 25 shipped:** the third **Slides** tab in `ServiceEditorView`; `src/components/slides/`
(`SlidesTab`, `SlidePlanRail`, `SlideGrid`, `SlideCard`, `SlideDropTarget`, `SlideGroupMusicControl`,
`slideDisplay.ts`, `dropRouting.ts`); a real `VideoSlide` type (D-17); deletion of the bed-video model
and all slide-area legacy paths (D-18/D-19); `ensureGroupMaterialized`; within-group drag-reorder; and
a four-kind drop target (PPTX/image/video append slides · audio sets the group bed).

**Two Phase 25 items to confirm at batch human-verify:**

- Real OS drag-and-drop of a file onto the grid — jsdom cannot produce a genuine `DataTransfer` with
  real `File` payloads, so this is manual-only. `docs/example.pptx` and `docs/example.mp3` are in the
  tree as fixtures. See `25-07-SUMMARY.md` `<human-check>`.

- **Behavioral decision (25-REVIEW-FIX WR-01):** a video slide now **suppresses the group's bed audio**
  for its own duration, with the bed resuming on the next slide that has none — applying Phase 24
  D-04's "slide beats group" precedence to video. Confirm this is the wanted behavior.

**Known Phase 25 limitation (deliberate, documented in `25-05-SUMMARY.md`):** if a user hand-adds
slides to a plan item and THEN assigns a scripture passage or deck to it, the group's signature
diverges and the hand-added entry counts as customization, so reconciliation routes to the
confirm-required path — whose dialog is Phase 26. Until Phase 26 ships, such a group shows the passive
banner and no source slides. This is correct under Phase 24 D-02 ("never silently drop a user's added
slide"), not a bug. Also: no keyboard reordering (SortableJS doesn't provide it) — flagged, not
silently omitted.

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

## ⏸ RESUME HERE (2026-07-28 — v1.4 roadmap created, ready to plan Phase 29)

**v1.2 and v1.3 are both archived; v1.4's ROADMAP.md and REQUIREMENTS.md traceability are now filled**
(Phases 29-37, 34/34 requirements mapped, 0 unmapped). Working tree clean; `npm run type-check` 0,
`npm run build` green, `npx vitest run src/` 3581 passing with the failing FILE SET at the documented
10-file pre-existing baseline (8 `.gsd/quarantine/worktrees/**` duplicates, `storage.rules.test.ts`,
`RosterView.test.ts`).

**Deferred Verification is empty project-wide.** No phase is mid-flight.

### What changed in this cleanup (2026-07-28)

| Change | Why |
|---|---|
| v1.2 archived | Owner accepted its outstanding checkpoints rather than running them |
| v1.3 phases 24-28 marked complete, then archived | Owner verified; owner-attributed VERIFICATION files written so `phase.complete` could run |
| `workflow.verifier` **false → true** | Root cause of both milestones looking permanently unfinished. Before this, `/gsd-autonomous` would have re-executed all of v1.3. |
| Requirements split | R028-R035 extracted from the misnamed `v1.2-REQUIREMENTS.md` into `v1.3-REQUIREMENTS.md` |
| Phase 5 (Tasks & Events) **dropped** | Never started; owner: *"we don't need those"*. TASK-01..03 / EVNT-01..04 marked dropped. |
| Backlog 999.1 **kept** | Shared song-browse extraction — duplication verified still present in `SongSlotPicker.vue` vs `SongFilters.vue` |
| AUTH-03/04 traceability fixed | Pointed at Phase 5 (now gone); actually completed in Phase 7 |
| v1.4 ROADMAP.md created | Phases 29-37, derived from `.planning/research/SUMMARY.md`'s 9-phase sequence with hard sequencing constraints applied (ordering fix first, PPTX rendering deliberately last) |
| v1.4 REQUIREMENTS.md traceability filled | 34/34 requirements (R036-R069) mapped to exactly one phase each, 0 unmapped |

### Next step

**`/gsd-plan-phase 29`** (optionally preceded by `/gsd-discuss-phase 29`) — Phase 29 (Order Structure —
Stable Reordering & Post-Service) is first: it's foundational, everything else in v1.4 either depends on
it directly or transitively. Phase 37 (PowerPoint Server-Side Rendering) is deliberately last — highest
uncertainty, independently cuttable without disturbing anything else. See `.planning/ROADMAP.md` for the
full phase table, success criteria, dependency graph, and per-phase research/notes.

## Deferred Verification

### v1.2 (Phases 20-23) — CLOSED BY USER ACCEPTANCE, 2026-07-28

> **These were not verified by a passing gate — the user accepted them directly.**
>
> > "close v1.2. I've verified everything I need to anyway. We don't need to verify."
> > — user, 2026-07-28
>
> Recorded plainly so nobody later reads v1.2's archived state as evidence that the checkpoints below
> ran. They did not. The user judged the remaining items unnecessary and authorized archiving on that
> basis. If a v1.2-era bug surfaces, this is the reason it was not caught by a checkpoint.

| Phase | Prior state | Items the user waived |
|-------|-------------|------------------------|
| 20 | verification_deferred_human | section grouping · live reorder-follows-slides · scripture override marker |
| 21 | verification_deferred_human | announcements/image import · corrupted-file error path · source retention (import save was confirmed live 2026-07-25) |
| 22 | verification_deferred_human | cleanup dry-run review · media/autoplay e2e |
| 23 | verification_deferred_human | real fullscreen + Esc-sync · autoplay policy + held-key rapid advance · expired-media degradation · projector legibility · iPad Safari · two overflow judgment calls (23-05-SUMMARY.md) |

Phases **18 and 19** were likewise never verified and are archived with v1.2 on the same acceptance.

### v1.3 (Phases 24-28) — CLOSED, verified by owner 2026-07-28

> "Let's make sure all milestone 1.3 phases are marked as done. I verified"
> — user, 2026-07-28

**Nothing deferred remains.** Phase 28's checkpoint (one scrollbar / one list, drag-reorder persistence,
edit-propagates-to-a-repeat, duplicate/remove semantics, add-section chips, CCLI paste with a repeated
chorus, version-history restore, the Edit-in-song link, live-edit reaching an in-use service, and the
restored copyright block) was **verified by the owner** rather than deferred.

All five phases now carry a `*-VERIFICATION.md` with `status: passed`, each stating explicitly that the
status records owner verification and **not** an automated verifier run. `phase.complete` ran cleanly
for 24-28 with zero warnings; ROADMAP checkboxes are ticked.

**Deferred Verification is now EMPTY across the whole project.**

**Pre-audit hardening TODO (batch before milestone complete):**

- ~~**[SAFETY] Flip `cleanupExpiredMedia` default to dry-run/disabled**~~ — **DONE 2026-07-28** (`9f1b881`).
  Gate inverted: deletion now requires an explicit `MEDIA_CLEANUP_ENABLED="true"`; unset/empty/`"false"`/a
  typo all leave it a dry run, and `MEDIA_CLEANUP_DRY_RUN` is no longer read at all. Worth noting what was
  found: the doc comment above the gate **claimed the opposite of the code** ("Defaults to dry-run
  (MEDIA_CLEANUP_DRY_RUN unset or not 'true')") while `dryRun = process.env.MEDIA_CLEANUP_DRY_RUN === "true"`
  meant unset → LIVE delete on a daily 02:00 UTC schedule. The old test encoded the unsafe default too
  (unset → expects a real delete). Three fail-safe regression guards added; 26/26 functions tests pass.

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
| Phase 25 P06 | ~50min | 2 tasks | 5 files |
| Phase 25 P07 | ~2.5h | 3 tasks | 8 files |
| Phase 26 P01 | 6min | 3 tasks | 5 files |
| Phase 26 P02 | 35min | 3 tasks | 5 files |
| Phase 26 P03 | 25min | 2 tasks | 4 files |
| Phase 26 P04 | 20min | 3 tasks | 4 files |
| Phase 26 P05 | 55min | 3 tasks | 4 files |
| Phase 26 P06 | 35min | 3 tasks | 4 files |
| Phase 26 P07 | 55min | 3 tasks | 4 files |
| Phase 26 P08 | 50min | 3 tasks | 2 files |
| Phase 26 P09 | 55 | 3 tasks | 8 files |
| Phase 27 P01 | 5min | 1 tasks | 0 files |
| Phase 27 P02 | 25min | 2 tasks | 2 files |
| Phase 27 P03 | 15min | 3 tasks | 5 files |
| Phase 27 P04 | 20min | 2 tasks | 7 files |
| Phase 27 P05 | 55min | 3 tasks | 6 files |
| Phase 28 P02 | ~40min | 3 tasks | 16 files |
| Phase 28 P03 | 25min | 2 tasks | 2 files |
| Phase 28 P04 | 35min | 2 tasks | 4 files |
| Phase 28 P05 | ~40min | 2 tasks | 2 files |
| Phase 28 P06 | ~55min | 3 tasks | 3 files |
| Phase 29 P02 | 15min | 2 tasks | 2 files |
| Phase 29 P01 | 45min | 3 tasks | 2 files |
| Phase 29 P04 | 55min | 3 tasks | 2 files |
| Phase 29 P03 | 95min | 3 tasks | 2 files |

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
- [Phase ?]: [Phase 25-06]: SlideGroupMusicControl emits two distinct events (attach/remove) rather than a v-model-style update:audioUrl
- [Phase ?]: [Phase 25-06]: No on-demand materialization added to the group-music write path -- setGroupBedMedia's existing merging skeleton-create (Phase 24 WR-01) already covers a plan item with no group document yet
- [Phase ?]: [Phase 25-06]: Preview control is a chromeless AudioPlayer plus a custom icon-only button carrying the UI-SPEC's aria-label -- native audio controls cannot carry a custom accessible name
- [Phase ?]: [Phase 25-07]: PptxImportModal exposes two functions (importPptxFile/importImageFiles) via defineExpose, calling straight into the existing importPptx/importImages -- second caller, not a second implementation (D-15)
- [Phase ?]: [Phase 25-07]: dropRouting.ts splits classification (five buckets) from resolution (multi-kind precedence + skipped reporting) as two separate pure functions
- [Phase ?]: [Phase 25-07]: SlideGrid mounts its OWN PptxImportModal instance with its OWN confirmed handler, never ServiceEditorView's, which creates a brand-new IMPORTED plan item (D-16 forbids that here)
- [Phase ?]: [Phase 25-07]: Video drop batches all of a drop's videos into ONE replaceGroupSlides call after every upload resolves (not one write per video), appending its own slide never the bed (D-17)
- [Phase ?]: [Phase 25-07]: Audio drop reuses 25-06's setGroupBedMedia write path directly with no materialization call, appending nothing (D-14/D-18)
- [Phase ?]: [Phase 26-01]: ReconcileResult.songSwap populated ids-only in the pure materializer; title resolution deferred to 26-04 where the song catalog is already in scope
- [Phase ?]: [Phase 26-01]: SlideGroup.dismissedSignature is a second, distinct field from sourceSignature -- never collapsed into one comparison (D-07)
- [Phase ?]: [Phase 26-01]: dismissReconciliation has no transaction/CAS -- a lost race between two declines of the same divergence is harmless
- [Phase ?]: 26-02: songEditLink.ts owns the whole query-param link convention (builder/parser/clearer), imports nothing from Vue/router/store
- [Phase ?]: 26-02: opening-tab input applied inside SongSlideOver's existing open-watcher (only place a requested tab survives its unconditional reset)
- [Phase ?]: 26-02: Task 3 (SongsView arrival handling) deliberately has no new test file per its own plan instruction — verified via type-check/build + human-check, documented in SUMMARY
- [Phase ?]: 26-03: Verified toggleScriptureEditor is a strict toggle (A2 confirmed) — added expandScriptureEditor as a sibling rather than reusing/parametrizing it, keeping the existing button's close behaviour untouched.
- [Phase ?]: 26-03: The relay emits the plan item's raw array index (not plan position) since that's what expandedScriptureSlots and the assembled slideshow are both keyed on.
- [Phase ?]: reconciliationConfirmCopy takes both the pending update and the plan item's ServiceSlot; song title miss falls back to 'Unknown Song'
- [Phase ?]: 26-05: EditSlideDrawer.vue built as one cohesive SFC (shell + live-apply); fresh-base write captures entryId at schedule time, base array re-read at write time (T-26-05-01)
- [Phase ?]: 26-05: hand-rolled label/notes debounce/status instead of useAutoSave, so a rejected write reaches a distinct 'error' status rather than a false 'saved'
- [Phase ?]: 26-06: modal prop named planItem (not slot) to avoid confusion with Vue's <slot>; both write handlers close the dialog optimistically before awaiting the store call, matching every other write path in SlideGrid.vue; a missing freshSignature makes both writes a silent no-op, which also satisfies the self-close-cannot-be-triggered guard
- [Phase ?]: 26-07: Slide Text section keyed on GroupSlideEntry.sourceRef.kind (never Slide.contentKind) per D-15's six-row matrix; hand-written slide body writes through 26-05's fresh-base helper extended to a nested sourceRef.body field; both edit-in-song/edit-in-scripture routes guarded by useUnsavedGuard with cancel-before-navigate (not flush) so the confirmation is truthful
- [Phase ?]: 26-08: Slide Audio's scope pill renders in every audio state (not just 'nothing attached'), since whichever route was taken on attach always stamps entry.audioScope to match the state currently shown
- [Phase ?]: 26-08: audioState (what's shown) and scopeChoice (what's chosen next) kept as two independent computed values — Remove always acts on audioState, attach always acts on scopeChoice
- [Phase ?]: 26-09: reconcileSongGroup's per-section index widened from Map<sectionId, entry> to Map<sectionId, entry[]> so a duplicated song-section slide survives the next within-song reconciliation instead of being silently dropped (landed before Duplicate shipped)
- [Phase ?]: 26-09: Duplicate's selection-follows-copy is success-gated -- the drawer emits 'duplicate' (and SlidesTab.vue moves the selection) only after replaceGroupSlides resolves, so a rejected write never leaves the panel pointed at an entry that was never created
- [Phase ?]: 26-09: deleteSlideConfirmBody lives in the pure slideDisplay module (not inline in EditSlideDrawer.vue), keyed on the entry's OWN audio/notes only -- never the group's shared bed music
- [Phase ?]: D-05: Present Slideshow moves to the Slides tab (27-01 checkpoint resolved 2026-07-27)
- [Phase ?]: 27-02: Renamed ServiceEditorView's first tab (label + activeTab union) from Music to service-order (D-03, D009); four unrelated views with same-named activeTab refs left untouched
- [Phase ?]: 27-03: Removed the IMPORTED slot branch's whole editor-toggle-plus-viewer-note half (not just the button+panel) since the interfaces block's two-halves framing places the viewer-only note in the leaving (slide-editing) half
- [Phase ?]: 27-04: Removed the per-plan-item SlotMediaAttachment control, its view-level read/write helpers, and the orphaned component; reworded the slideGroupsStore setup comment and five prose references naming the deleted file, leaving the group-bed audio write path itself (setGroupBedMedia) untouched for the Slides tab's SlideGroupMusicControl/SlideGrid callers
- [Phase ?]: D-05 implemented verbatim: Present Slideshow relocated to the Slides tab (new CTA in SlidesTab.vue), reusing the existing presenting flag and PresentationViewer mount; SlideshowPreview removed from the Service Order tab and deleted (D-02/D-19).
- [Phase ?]: Phase 27 closed: full unit suite failing FILE SET verified unchanged at the 10-file baseline (8 quarantine debris + storage.rules.test.ts + RosterView.test.ts); type-check and build both green.
- [Phase ?]: [Phase 28-02]: Song.performanceOrder deleted outright (D-19); SongLyrics.performanceOrder is now the single source of a song's slide order, replacing the three-tier resolveSongOrder precedence chain duplicated across slideshowAssembler.ts and slideGroupMaterializer.ts
- [Phase ?]: [Phase 28-02]: Task 2/Task 3 boundary is intentionally not independently type-check-clean — Task 2 deletes the order field/action, Task 3 (same non-checkpointed plan) removes the two Vue consumers immediately after; documented rather than treated as a blocking deviation
- [Phase ?]: 28-03: Surplus stored entries for a repeated section are emitted at the LAST occurrence, not the first — keeps Phase 26-09's N=1/M=2 output byte-identical while bounding growth for N>1
- [Phase ?]: 28-04: Rebuilt SongLyricEditor as option 2a's single-scroll-region row list; dropped copyright display (not in 2a design); load-time repair persisted via a direct doAutoSave() call since useAutoSave suppresses its first watcher invocation.
- [Phase ?]: 28-05: which occurrence of a repeat is 'followed' vs. 'repeat' is re-derived by buildSectionRows every render, never stored as separate state
- [Phase ?]: 28-05: SortableJS drag config for the lyrics row list reproduces ServiceEditorView/SlideGrid verbatim (handle/.section-row/animation 150/ghostClass opacity-30) so drag means the same thing app-wide
- [Phase ?]: 28-05: the dashed Add-section row is a sibling of section-rows, not a child, so it stays outside both the row-count contract and Sortable's .section-row draggable scope
- [Phase ?]: Restored the CCLI copyright display 28-04 dropped without an authorizing decision — R035 only requires one scroll surface and one list, and the display's absence removed the only place to verify CCLI licensing data before it reaches the presented copyright slide.
- [Phase ?]: R035's acceptance block mounts SongSlideOver + SongLyricEditor together, unstubbed, since the nested-scrollbar defect only appears once panel and editor are mounted together — proven at the composed level, not just per-component.
- [Phase ?]: 29-02: orderSlotsBySection/groupBySection/flattenBySection are total, SERVICE_SECTIONS-driven, identity-preserving; defaultSectionForPosition audited as position-keyed, no change needed for post-service
- [Phase ?]: makeSectionedService() and Sortable capture accessors placed at module scope so Task 1/Task 2 land as separate, independently-verifiable commits (29-01)
- [Phase ?]: 29-04: R050's live mechanism was SlideGrid's own array-order/order-value divergence (closed by a shared appendToGroup sort-append-renumber contract), not slideGroupMaterializer.ts's trailing-copyright placement — that placement is correct, Phase-35-owned SONG-group behavior and was left untouched.
- [Phase ?]: 29-04: added destroySortable() to the reorder-failure catch block (Rule 2) so the :key-driven gridRenderNonce re-render doesn't leave a stale Sortable instance bound to a discarded DOM node, which would otherwise silently disable real drag-and-drop after any single reorder failure.
- [Phase ?]: onEnd never reassigns moved.section for a within-ungrouped-list reorder (put:false blocks any other case) — avoids silently normalizing a legacy/out-of-union section value
- [Phase ?]: onSectionChange now composes reindexSlots(orderSlotsBySection(...)) — a genuine behavior change from silent-set-only, required so a dropdown section change produces the same section-major array a drag does

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
- Phase 29-37 added (v1.4 Service and Slides, roadmap created 2026-07-28): 9 phases covering the ordering-model fix, Post-Service, the slide-mirror hard lock (reconciliation deletion), draft-only editing + reopen, save reliability, backgrounds + slide editing, LLM scripture split, presentation correctness + lyric editor, UI rework (Service Order rebuild + contextual action bars), and PowerPoint server-side rendering (deliberately last). Derived from `.planning/research/SUMMARY.md`'s 9-phase default with the hard sequencing constraints from ARCHITECTURE.md/PITFALLS.md applied. See ROADMAP.md Phase Details and REQUIREMENTS.md Traceability.

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
- 28-06: this phase's human-verify batch (queued in 28-06-SUMMARY.md) is outstanding, alongside Phases 20-23/25-27 — deferred to /gsd-audit-milestone per the documented v1.3 convention.

## Session Continuity

Last activity: 2026-07-28 — 29-04 fixed SlideGrid's reorder/append defects (R049, R050)
Last session: 2026-07-28T23:02:39.014Z
Stopped at: Completed 29-03-PLAN.md
Resume file: None
