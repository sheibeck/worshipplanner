---
phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed
plan: 04
subsystem: slides-engine
tags: [vue, vitest, slides, testing, scripture]

# Dependency graph
requires:
  - phase: "30-01"
    provides: "reconcile*/confirm vocabulary removed; ReconcileConfirmModal deleted"
  - phase: "30-02"
    provides: "unconditional idempotent rebuild per group kind; scripture derivation narrowed to a single reference-only entry"
  - phase: "30-03"
    provides: "song groups read-only in the Slides tab drawer and grid"
provides:
  - "A permutation-driven order-lock proof for R045: 50 shuffled arrangements of a mixed slot array, asserting both the assembled block order AND that reindexSlots(orderSlotsBySection(...)) keeps position === array index — the link the assembler's position sort depends on"
  - "A membership-lock proof for R045: the existing four-point cascade-delete describe re-verified unedited, plus one new assertion that a removed slot's id disappears from the view and no repeat delete is issued for it"
  - "The phase's widened removal-gate result: zero live occurrences of any reconciliation symbol across src/, isNonDerivableEntry confirmed still present"
  - "R054's SlideDropTarget copy now matches what a song group's drop handler actually accepts (audio-only), via an audioOnly prop"
  - "R047 rebuilt around the SCRIPTURE slot's OWN book/chapter/verse fields as the slide's source (scriptureRefFromSlot/formatScriptureReference in scripture.ts) — no scripture-reading document, ESV fetch, or linking step in the loop; the Service Order tab's scripture editor panel and button are removed"
affects: [31, 33, 34, 35]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual Fisher-Yates permutation loop (fixed count, Math.random, per-iteration failure message naming the arrangement) as this codebase's first property-style test pattern — no fast-check dependency added, per 30-CONTEXT.md's explicit instruction not to add one for a single narrow-domain invariant."
    - "Slot-as-source-of-truth for SCRIPTURE, mirroring SONG's songId/SCRIPTURE's book+chapter+verse* fields directly on ServiceSlot as the slide's derivation source, rather than a linked side document — the same shape SONG already used, now applied consistently to the other assignable slot kind."

key-files:
  created: []
  modified:
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/SlideDropTarget.vue
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideDropTarget.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/types/slideGroup.ts
    - src/utils/__tests__/scripture.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/utils/planningCenterExport.ts
    - src/utils/scripture.ts
    - src/utils/slideGroupMaterializer.ts
    - src/utils/slideshowAssembler.ts
    - src/views/ServiceEditorView.vue
  deleted: []

key-decisions:
  - "The scripture reading document is no longer in the slide-derivation loop at all. Task 1/2's automated work (and an initial human-verify fix, 3da5fe4) both assumed the existing reading-document model was correct and just needed its id linked to the slot; the owner rejected that model outright during human-verify and required the SCRIPTURE slot's own book/chapter/verse fields to be the source, exactly as songId is a SONG slot's source. 5c531b1 supersedes 3da5fe4 rather than building on it — the reading-created emit, linkScriptureReading, and the Service Order tab's scripture editor panel/button that 3da5fe4 wired up are all removed again by 5c531b1, net zero on those files."
  - "planningCenterExport.formatScriptureRef now delegates to the new canonical formatScriptureReference so the exported text and the projected slide cannot drift; its only behavior change is a single-verse reference now renders \"Romans 8:28\" instead of collapsing to \"Romans 8\"."
  - "SourceRef's scripture member carries no required payload; scriptureReadingId/innerSlideId stay as optional, ignored-on-read legacy fields so pre-existing stored entries still load and Phase 34 (R064) can widen the derivation for congregational splits rather than rewrite it."

patterns-established:
  - "Permutation-property test pattern (fixed-count shuffle loop, per-iteration failure message) for any future invariant of the shape \"holds for every arrangement, not just examples.\""
  - "Slot-as-source-of-truth: an assignable ServiceSlot's own fields are the canonical source a group's rebuild reads from; do not introduce a side document + link step for a new assignable kind."

requirements-completed: [R045]

coverage:
  - id: D1
    description: "For any permutation of a mixed slot array, the assembled slide sequence's per-slot block order equals the slots array order, proven over 50 generated shuffles rather than hand-picked examples (R045 order half)"
    requirement: R045
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — R045 order lock (permutation property) — for 50 shuffled permutations..."
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — R045 order lock (permutation property) — for the same 50 permutations, reindexSlots(orderSlotsBySection(...)) leaves every slot position equal to its own array index"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — R045 order lock (permutation property) — the owner-reported scenario: moving a scripture slot between two songs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A group exists for exactly the slots that exist: the single existing remove-element cascade-delete path deletes a slot's group, verified unedited, plus a new assertion that the deletion is locked (no repeat delete, id gone from the view) rather than merely cascaded once (R045 membership half)"
    requirement: R045
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - slot delete cascades to its group (Phase 24-06 Task 2, R029) — all 10 pre-existing tests, run unedited"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - slot delete cascades to its group — R045 membership lock: after a confirmed remove-element delete..."
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero occurrences remain anywhere under src/ of any reconciliation symbol from the widened list (including the plural prop name and bare type name the original narrower search missed); isNonDerivableEntry is confirmed still present"
    requirement: R045
    verification:
      - kind: other
        ref: "grep -rnE over the widened 16-symbol list against src/ — three raw hits, all pre-existing negative-assertion string literals proving a symbol's ABSENCE from a runtime shape (useSlideshowAssembly.test.ts:773,833; ServiceEditorView.test.ts:1393), not live declarations or references"
        status: pass
      - kind: other
        ref: "grep -rn isNonDerivableEntry src/utils/slideGroupMaterializer.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The owner drives the running app and confirms the exact R046-reported symptom is gone, plus R054's read-only lock and R047's reference-only scripture slide, across all five human-verify steps"
    verification: []
    human_judgment: true
    rationale: "Real-app, real-service verification of user-facing behavior — cannot be proven by unit tests alone. This ran as an actual conversational human-verify pass: two of five steps failed on the first attempt (R054 drop-tile copy, R047 scripture slide never appearing), both were root-caused and fixed, and the owner re-verified each fix live before giving final approval (\"This is approved\")."

# Metrics
duration: ~8h 30min wall-clock (includes a human-verify pause between commits ea18bd5 and ba09d67 while the owner drove the running app)
completed: 2026-07-29
status: complete
---

# Phase 30 Plan 04: Permutation-Proven Order/Membership Lock, Removal Gate, and a Corrected Scripture Model Summary

**Proved R045's order and membership lock with a 50-permutation property test (this codebase's first), ran the phase's widened reconciliation-symbol removal gate clean, and closed the phase through a human-verify pass that failed twice — a song-group drop tile still advertising an action its handler silently rejected (R054), and a scripture item producing NO slide at all because nothing in `src/` ever wrote `scriptureReadingId` onto its slot (R047) — the second failure's real fix rebuilding scripture derivation around the SCRIPTURE slot's own book/chapter/verse fields instead of a linked reading document.**

## Performance

- **Duration:** ~8h 30min wall-clock (includes the owner's live human-verify session between `ea18bd5` and `ba09d67`/`5c531b1`, not continuous agent work)
- **Tasks:** 3 (2 automated + 1 checkpoint that failed twice and was fixed twice before approval)
- **Files modified:** 14 (across Task 1, Task 2, and the three post-checkpoint fix commits)

## Accomplishments

- **R045 order lock (Task 1):** a new `describe('assembleSlideshow — R045 order lock (permutation property)', …)` in `slideshowAssembler.test.ts` builds one fixed six-slot array (mixing materialized-group and fallback-derivation slots, spanning worship/message/sending/post-service so the fifth section isn't special-cased) and, over 50 Fisher-Yates-shuffled permutations, asserts (a) the assembled output's slide-to-slot mapping collapses to exactly the normalized slots array's own id order — which also proves contiguity, since a non-contiguous group would surface as a repeated non-consecutive id — and (b) `reindexSlots(orderSlotsBySection(...))` keeps every slot's `position` equal to its own array index, the link the assembler's position-based sort depends on. A third plain test anchors the owner's originally reported scenario (moving a scripture slot between two songs). Manually confirmed (then reverted) that skipping `reindexSlots` in the composition makes the permutation test fail with the offending arrangement named in the assertion message.
- **R045 membership lock + removal gate (Task 2):** the four-point cascade-delete `describe` in `ServiceEditorView.test.ts` was run and confirmed passing with ZERO edits, then one new test was added proving the delete is locked, not just cascaded once — the removed slot's id disappears from the rendered view (`[data-slot-id]`) and no further `deleteGroup` call fires for it on subsequent ticks. The phase's widened 16-symbol removal gate (`reconcileGroup`, `reconcileScriptureGroup`, `reconcileImportedGroup`, `songSwap`, etc., not just the narrower list an earlier research pass used) returns zero live hits across `src/`; `isNonDerivableEntry` confirmed still present. Also added an R047 reactive-path proof: a stored scripture entry resolves its content LIVE from the owning slot at assembly time, so an in-place passage edit changes the assembled reference with no group write.
- **R054 human-verify failure #1, fixed (`ba09d67`):** `SlideGrid.onFilesDropped` already refused deck/image/video drops on a SONG group and accepted only audio, but `SlideDropTarget.vue`'s copy still read "Drop PPTX, images, video, or audio / PPTX, image, and video appends a slide" — advertising an action the locked group silently rejected. Fixed with an `audioOnly` prop (default `false`, so every non-song group renders byte-identical copy) bound from `SlideGrid.vue`'s existing `isSongGroup` computed on both tile instances (populated grid and empty state); the empty-state subtext now points at Song Lyrics.
- **R047 human-verify failure #2, fixed in two passes:** adding a scripture item produced NO slide at all. Root cause was not the materializer — `deriveGroupEntries`'s SCRIPTURE branch correctly derived zero entries for a slot pointing at nothing, and the slot ALWAYS pointed at nothing: `scriptureReadingId` was read in four places in `src/` and assigned in none (`ScriptureSlideEditor.vue` minted the reading document and kept its id in a local ref, never surfacing it). The first fix (`3da5fe4`) linked that id onto the slot. The owner then rejected the whole reading-document model and required the SCRIPTURE slot's own book/chapter/verse fields to be the slide's source, exactly as `songId` is a SONG slot's. The second, final fix (`5c531b1`) rebuilt scripture derivation around the slot: `scripture.ts` gains `scriptureRefFromSlot` and `formatScriptureReference` (the one canonical reference formatter, which `planningCenterExport.formatScriptureRef` now delegates to); `SourceRef`'s scripture member carries no required payload (`scriptureReadingId`/`innerSlideId` become optional, ignored-on-read legacy fields); `deriveGroupEntries`, `sourceSignature`, `resolveEntryContent`, the fallback path, and `sourceIdForRef` all read the slot directly. A passage change now costs no group write — it resolves live at assembly time, with the existing carry machinery keeping the entry's id/label/notes/audio intact across the change. The "Edit Scripture Slides" button, reading-mode toggle, and expandable editor panel are removed from the Service Order tab (both editor components stay on disk, unmounted, for Phase 34/R064); `handleNavigateToScriptureEditor` now scrolls the plan item's row into view instead of expanding a panel.
- **Human-verify approved:** the owner re-verified each fix live in the running app. Final result — all five steps confirmed: song swap rewrites slides with no prompt (R046), song-group drop tile now offers only what it accepts and the read-only affordances hold (R054), a scripture reference produces exactly one reference-only slide and updates with no prompt on a passage change (R047), a drag reorder on Service Order is mirrored immediately on the Slides tab with no second step (R045 order), and deleting a plan item removes its slide group (R045 membership).

## Task Commits

1. **Task 1: Prove the order lock over generated permutations, not examples** - `9e6181e` (test)
2. **Task 2: Prove the membership lock and run the phase removal gate (+ R047 reactive-path proof)** - `ea18bd5` (test)
3. **Task 3: Human verification — failed twice, fixed twice, approved:**
   - `ba09d67` (fix) — R054: `SlideDropTarget.vue` `audioOnly` prop so the drop tile's copy matches what a song group's handler accepts
   - `3da5fe4` (fix) — R047 first attempt: link a newly created scripture reading's id onto its slot — **superseded**, not the final shape
   - `5c531b1` (fix) — R047 final fix: derive the scripture slide directly from the SCRIPTURE slot's own book/chapter/verse fields; removes the reading-document link `3da5fe4` added along with the Service Order tab's scripture editor panel/button

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified

- `src/utils/__tests__/slideshowAssembler.test.ts` - R045 permutation-property describe (order lock + position-index invariant + owner-scenario anchor); R047 reactive-path test for a stored scripture entry resolving live from the slot; the fixture helpers and every pre-existing scripture-shaped test rewritten by `5c531b1` onto the slot-derived model (`scriptureSlot()`'s default now carries `book/chapter/verseStart/verseEnd` formatting to "John 3:16-18")
- `src/views/__tests__/ServiceEditorView.test.ts` - one new R045 membership-lock assertion in the existing cascade-delete describe (run unedited otherwise); `3da5fe4`'s four link-scripture-reading tests added then removed again by `5c531b1`'s revert of that approach, replaced with tests asserting the scripture editor panel/button no longer exist on this tab plus tab-switch behavior for the row-scroll navigate event
- `src/components/slides/SlideDropTarget.vue` - `audioOnly` prop swaps in audio-only copy and a Song Lyrics redirect message for a locked song group; non-song groups unaffected
- `src/components/slides/SlideGrid.vue` - binds `:audio-only="isSongGroup"` on both `SlideDropTarget` instances (populated grid and empty state)
- `src/components/slides/__tests__/SlideDropTarget.test.ts` - two new tests: the `audioOnly` copy contract, and that an audio drop still emits (tile stays functional, not inert)
- `src/utils/scripture.ts` - `scriptureRefFromSlot` (slot fields → `ScriptureRef`, `null` when unfilled — the derivation this drives to zero slides) and `formatScriptureReference` (the one canonical reference formatter)
- `src/utils/planningCenterExport.ts` - `formatScriptureRef` delegates to `formatScriptureReference`; single-verse references now render "Romans 8:28" rather than collapsing to "Romans 8"
- `src/utils/slideGroupMaterializer.ts` - `deriveGroupEntries`, `sourceSignature`, and `resolveEntryContent`'s SCRIPTURE branches read the slot's own reference instead of a joined reading document
- `src/utils/slideshowAssembler.ts` - the stored-group and no-group-fallback SCRIPTURE resolution paths both read the slot's reference; `sourceIdForRef` returns `null` for a slot-derived scripture reference
- `src/types/slideGroup.ts` - `SourceRef`'s scripture member's `scriptureReadingId`/`innerSlideId` become optional, ignored-on-read legacy fields (no required payload)
- `src/views/ServiceEditorView.vue` - the "Edit Scripture Slides" button, reading-mode toggle, and expandable `ScriptureSlideEditor`/`CongregationalEditor` panel removed; `handleNavigateToScriptureEditor` scrolls the plan item's row (`data-scripture-slot-index`) into view instead
- `src/utils/__tests__/scripture.test.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`, `src/composables/__tests__/useSlideshowAssembly.test.ts` - rewritten to the slot-derived scripture model (new `formatScriptureReference`/`scriptureRefFromSlot` unit coverage; existing scripture-shaped fixtures/assertions updated)

**Files with a net-zero diff across this plan** (touched by `3da5fe4`, fully reverted by `5c531b1`, not re-listed above): `src/components/CongregationalEditor.vue`, `src/components/ScriptureSlideEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`, `src/components/__tests__/ScriptureSlideEditor.test.ts`.

## Decisions Made

- The scripture reading document is no longer in the slide-derivation loop at all — the SCRIPTURE slot's own book/chapter/verse fields are the slide's source, exactly as `songId` is a SONG slot's. This was the owner's explicit correction during human-verify, superseding `3da5fe4`'s initial fix (which had linked the reading document's id onto the slot rather than removing the document from the loop).
- `planningCenterExport.formatScriptureRef` now delegates to the new canonical `formatScriptureReference` so the exported text and the projected slide cannot drift out of sync with each other.
- `SourceRef`'s scripture member carries no required payload; `scriptureReadingId`/`innerSlideId` stay as optional, ignored-on-read legacy fields so pre-`5c531b1` stored entries still load without a migration, and Phase 34 (R064) can widen the derivation for congregational splits rather than rewrite it.

## Deviations from Plan

### Auto-fixed Issues (Rule 1/3 — human-verify checkpoint failures, fixed and re-verified)

**1. [Rule 1 - Bug] R054: song-group drop tile advertised an action its handler silently rejected**
- **Found during:** Task 3, human-verify step 2 (owner running the real app)
- **Issue:** `SlideDropTarget.vue`'s copy read "Drop PPTX, images, video, or audio / PPTX, image, and video appends a slide" on a SONG group even though `SlideGrid.onFilesDropped` already refused deck/image/video there and accepted only audio — the group looked editable and silently rejected what it advertised.
- **Fix:** `audioOnly` prop on `SlideDropTarget.vue` (default `false`, byte-identical copy for every non-song group), bound to `SlideGrid.vue`'s existing `isSongGroup` computed on both tile instances; empty-state subtext redirected to Song Lyrics. Two new tests.
- **Files modified:** `src/components/slides/SlideDropTarget.vue`, `src/components/slides/SlideGrid.vue`, `src/components/slides/__tests__/SlideDropTarget.test.ts`
- **Commit:** `ba09d67`
- **Verification:** Owner re-ran step 2 live after the fix — passed.

**2. [Rule 4 - Architectural, owner-directed] R047: scripture item produced no slide at all**
- **Found during:** Task 3, human-verify step 3 (owner running the real app)
- **Issue:** `deriveGroupEntries`'s SCRIPTURE branch correctly derived zero entries for a slot pointing at nothing, and the slot always pointed at nothing — `scriptureReadingId` was read in four places in `src/` and assigned in none. `ScriptureSlideEditor.vue` minted the reading document and kept its id in a local ref, never writing it to the slot.
- **First fix (superseded):** `3da5fe4` wired a `reading-created` emit and `linkScriptureReading` to write the id onto the slot immediately (bypassing the debounced autosave watcher's re-arm brittleness). This worked and was re-verified, but the owner then rejected the underlying model.
- **Owner's correction (architectural — Rule 4, decided live during the checkpoint, not assumed):** the reading document should not be in the loop at all; the SCRIPTURE slot's own reference fields should be the slide's source, exactly as a SONG slot's `songId` is.
- **Second, final fix:** `5c531b1` rebuilt scripture derivation around the slot (`scriptureRefFromSlot`/`formatScriptureReference` in `scripture.ts`; `deriveGroupEntries`/`sourceSignature`/`resolveEntryContent`/the fallback path/`sourceIdForRef` all read the slot; `SourceRef`'s scripture payload becomes fully optional legacy). Removed the Service Order tab's scripture editor button/panel and `3da5fe4`'s now-unnecessary emit/link plumbing (net zero on `CongregationalEditor.vue`/`ScriptureSlideEditor.vue` and their tests across the two commits).
- **Files modified:** see Files Created/Modified above
- **Commit:** `3da5fe4` (superseded), `5c531b1` (final)
- **Verification:** Owner re-ran step 3 live after `5c531b1` — passed.

---

**Total deviations:** 2 auto-fixed via the human-verify checkpoint (1 Rule 1 bug, 1 owner-directed architectural correction). Both were caught by the checkpoint doing exactly what it exists to do — the owner driving the real app surfaced two defects unit tests could not have (a copy/handler mismatch, and a wiring gap where nothing in `src/` ever assigned a field four call sites read). Neither is scope creep: both are direct fixes to R054/R047 behavior this plan's own checkpoint was verifying.

## Human-Verify Result (honest record)

**First pass: 3 of 5 steps passed, 2 failed.**

| Step | Requirement | First-pass result |
|---|---|---|
| 1 — song swap rewrites slides, no prompt | R046 | PASSED |
| 2 — song group read-only affordances, drop tile copy | R054 | **FAILED** — drop tile advertised deck/image/video append on a locked group |
| 3 — scripture reference produces one slide, updates with no prompt | R047 | **FAILED** — no slide appeared at all |
| 4 — reorder mirrors immediately, no second step | R045 (order) | PASSED |
| 5 — delete removes the slide group | R045 (membership) | PASSED |

Both failures were root-caused and fixed (`ba09d67` for step 2; `3da5fe4` then `5c531b1` for step 3 — the latter superseding the former after the owner rejected its underlying model). The owner re-verified each fix live in the running app and re-confirmed steps 2 and 3 individually, then gave final approval across all five steps: *"This is approved."*

This was not a clean first-pass verification — it is recorded here in full so the phase's history is accurate, per the coordinator's explicit instruction not to present it as one.

## Known Stubs

None — no stub patterns introduced. Both editor components removed from the Service Order tab (`CongregationalEditor.vue`, `ScriptureSlideEditor.vue`) remain on disk, unmounted, explicitly for Phase 34 (R064) to reuse — documented in `5c531b1`'s commit message and in `REQUIREMENTS.md`'s R047 entry, not left as silent dead code.

## Threat Flags

None beyond what the plan's `<threat_model>` anticipated. `5c531b1`'s removal of the Service Order tab's scripture editor panel/button is a UI surface reduction, not a new attack surface; `formatScriptureRef`'s delegation to `formatScriptureReference` changes display formatting only (a single-verse reference now renders "Romans 8:28" instead of collapsing to "Romans 8"), not a trust-boundary change.

## Issues Encountered

- **Local environment resource contention during full-suite verification runs:** two `npm run dev` instances, a Firebase emulator, and the gsd-pi MCP server were already running on this machine; an initial unconstrained `npx vitest run` (plus an earlier orphaned background invocation of the same command) exhausted available memory and crashed with V8 OOM/fork-exhaustion errors. Resolved by killing the orphaned vitest worker processes (left the user's legitimate dev/emulator/MCP processes untouched) and re-running with `--maxWorkers=2`, `--exclude "**/.gsd/quarantine/**"`. Not a code issue — no production or test code was affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 30 is fully closed: R045 (order + membership, proven by permutation property test), R046, R047 (now slot-derived, not reading-document-derived), R048 (removal gate, widened symbol list, zero live hits), and R054 (song groups read-only, drop-tile copy now matches the handler) are all delivered and human-verified.
- **Phase 34 (R064, congregational reading splits) has a corrected starting point:** the scripture slide's source of truth is now the SCRIPTURE slot's own reference fields, not a reading document. `CongregationalEditor.vue`/`ScriptureSlideEditor.vue` remain on disk, unmounted, as a possible starting point, but any ESV-text-fetch design for Phase 34 must integrate with the slot-derived model this plan established, not the reading-document model it replaced.
- `formatScriptureReference`/`scriptureRefFromSlot` in `src/utils/scripture.ts` are the new canonical scripture-reference primitives — reuse them rather than re-deriving reference formatting elsewhere.
- No blockers for Phase 31.

---
*Phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `src/utils/__tests__/slideshowAssembler.test.ts`
- FOUND: `src/views/__tests__/ServiceEditorView.test.ts`
- FOUND: `src/components/slides/SlideDropTarget.vue`
- FOUND: `src/components/slides/SlideGrid.vue`
- FOUND: `src/components/slides/__tests__/SlideDropTarget.test.ts`
- FOUND: `src/composables/__tests__/useSlideshowAssembly.test.ts`
- FOUND: `src/types/slideGroup.ts`
- FOUND: `src/utils/__tests__/scripture.test.ts`
- FOUND: `src/utils/__tests__/slideGroupMaterializer.test.ts`
- FOUND: `src/utils/planningCenterExport.ts`
- FOUND: `src/utils/scripture.ts`
- FOUND: `src/utils/slideGroupMaterializer.ts`
- FOUND: `src/utils/slideshowAssembler.ts`
- FOUND: `src/views/ServiceEditorView.vue`
- FOUND: commit `9e6181e` (test, Task 1)
- FOUND: commit `ea18bd5` (test, Task 2)
- FOUND: commit `ba09d67` (fix, R054 human-verify failure #1)
- FOUND: commit `3da5fe4` (fix, R047 human-verify failure #2, superseded)
- FOUND: commit `5c531b1` (fix, R047 human-verify failure #2, final)
