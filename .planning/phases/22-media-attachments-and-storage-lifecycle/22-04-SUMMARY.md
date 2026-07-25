---
phase: 22-media-attachments-and-storage-lifecycle
plan: 04
subsystem: ui
tags: [vue-component, service-editor, media-upload, firebase-storage, html5-media]

# Dependency graph
requires:
  - phase: 22-01
    provides: "MediaAttachableSlot (slot.audioUrl?/videoUrl?), useMediaUpload composable (progress/error/isUploading, MEDIA_MAX_BYTES)"
  - phase: 22-02
    provides: "AudioPlayer.vue / VideoPlayer.vue (no-loop, autoplay-blocked fallback, play()/pause() defineExpose)"
provides:
  - "SlotMediaAttachment.vue — per-slot audio+video attach/progress/preview/remove UI"
  - "ServiceEditorView per-slot media wiring, editor-only, riding the existing localService autosave"
affects: [phase-23-presentation-preview-mode, media-players, media-editor-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SlotMediaAttachment is a pure v-model-style control (props audioUrl?/videoUrl?/orgId, emits update:audioUrl/update:videoUrl) — it never persists anything itself; the parent assigns the emitted value onto the bound slot, which rides that view's EXISTING autosave path (mirrors onSectionChange's mutate-in-place pattern)"
    - "Upload failure is fully decoupled from the emitted update: — a rejected uploadMedia() sets the composable's reactive error (rendered inline) and emits NOTHING, so a bad upload can never null out or overwrite the slot's existing media/other fields"

key-files:
  created:
    - src/components/SlotMediaAttachment.vue
    - src/components/__tests__/SlotMediaAttachment.test.ts
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Placed SlotMediaAttachment as the last child inside each slot's 'Slot content' column (below all per-kind blocks), not beside the section-select/remove icons in the row's trailing flex slot — keeps it visually secondary/collapsed per the plan's explicit request, while still being universal across every slot kind (SONG/SCRIPTURE/PRAYER/MESSAGE/HYMN/IMPORTED)"
  - "Gated on both authStore.isEditor AND !isExportedLocked (matching the section-select/remove-slot/per-kind editable-field siblings), not isEditor alone — an exported/locked service already freezes every other per-slot control, and media attach/remove would be an inconsistent escape hatch if left open"
  - "onSlotAudioUrlChange/onSlotVideoUrlChange mutate localService.slots[index] directly (exactly like onSectionChange), so attach/remove commits through the SAME existing deep-watch autosave — no new save call, no new store action, per the plan's non-goal"

patterns-established:
  - "Any future slot-scoped v-model-style editor control should follow SlotMediaAttachment's shape: typed props for the persisted field(s) + orgId, update:<field> emits, zero internal persistence — the parent's existing autosave watcher is always the single source of truth for what gets saved"

requirements-completed: [R013, R014]

coverage:
  - id: D1
    description: "SlotMediaAttachment uploads audio via useMediaUpload and emits update:audioUrl with the resolved URL on success"
    requirement: "R013"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlotMediaAttachment.test.ts#selecting an audio file (upload resolves) emits update:audioUrl with the resolved URL"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rejected upload renders media-upload-error and emits NO update:audioUrl/update:videoUrl — a failed upload can never overwrite slot state"
    requirement: "R013, R014"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlotMediaAttachment.test.ts#a rejected upload renders media-upload-error and emits NO update event"
        status: pass
    human_judgment: false
  - id: D3
    description: "With audioUrl set, an AudioPlayer preview + remove-audio render; clicking remove emits update:audioUrl cleared (undefined)"
    requirement: "R013"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlotMediaAttachment.test.ts#with audioUrl prop set, renders an AudioPlayer preview and remove-audio; clicking remove emits update:audioUrl cleared"
        status: pass
    human_judgment: false
  - id: D4
    description: "With videoUrl set, a VideoPlayer preview renders"
    requirement: "R014"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlotMediaAttachment.test.ts#with videoUrl prop set, renders a VideoPlayer preview"
        status: pass
    human_judgment: false
  - id: D5
    description: "An upload-progress indicator is shown while isUploading is true and disappears on completion"
    requirement: "R013, R014"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlotMediaAttachment.test.ts#shows an upload progress indicator while isUploading is true"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every editor slot row (SONG/SCRIPTURE/PRAYER/MESSAGE/HYMN/IMPORTED) renders SlotMediaAttachment bound to that slot's audioUrl/videoUrl and authStore.orgId; attach/remove mutates localService.slots[index] and persists via the existing deep-watch autosave (no new save path); the control is hidden for non-editors and when the service is exported-locked"
    requirement: "R013, R014"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (14/14 pass — shallowMount stubs SlotMediaAttachment; no dedicated per-slot-media assertion added, wiring verified by type-check + manual code review of the v-if/bindings)"
        status: pass
    human_judgment: false
  - id: D7
    description: "End-to-end: attach MP3 + video to a slot, see progress + playable preview in the editor and SlideshowPreview, playback stops at end with no loop, autoplay-block degrades gracefully (muted video / play affordance), an oversized/invalid upload leaves the slot's other metadata unchanged and saved, and Remove clears + autosaves"
    verification: []
    human_judgment: true
    rationale: "This is a live-browser, real-Firebase-Storage, human-observable playback and autoplay-policy verification (video/audio actually playing, browser autoplay gating behavior, real upload progress against Storage) that cannot be proven by jsdom unit tests. Per the plan's explicit blocking checkpoint (Task 3, gate=blocking) and this execution's instructions, the executor must NOT self-approve. PENDING at time of this SUMMARY — see the CHECKPOINT REACHED section returned alongside this SUMMARY for exact review steps."

# Metrics
duration: ~35min
completed: 2026-07-25
status: pending-human-verification
---

# Phase 22 Plan 04: Per-Slot Media Attach/Preview/Remove UI Summary

**SlotMediaAttachment.vue — a per-slot audio+video attach/progress/preview/remove control wired into every ServiceEditorView slot row, persisting through the EXISTING localService autosave with zero new save path — end-to-end playback/autoplay-block/upload-failure verification is PENDING human review.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-25T13:05:00-04:00 (approx.)
- **Completed:** 2026-07-25T13:40:00-04:00 (approx.)
- **Tasks:** 2 of 3 (Task 3 is a blocking human-verify checkpoint, PENDING)
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments
- Built `SlotMediaAttachment.vue`: two labelled file inputs (`accept="audio/*"` / `accept="video/*"`), calls `useMediaUpload().uploadMedia(file, orgId)` on selection, shows a live progress indicator while `isUploading`, previews attached media via `AudioPlayer`/`VideoPlayer`, and renders "Remove audio"/"Remove video" buttons that emit the field cleared.
- On upload rejection, the composable's reactive `error` renders inline (`media-upload-error`) and the component emits **no** `update:` event — a failed upload structurally cannot overwrite the slot's existing media or any other field (T-22-04-02).
- Wired `SlotMediaAttachment` into every `.slot-item` row in `ServiceEditorView.vue` (all six slot kinds), gated behind `authStore.isEditor && !isExportedLocked` (matching the section-select/remove-slot siblings), bound to `slot.audioUrl`/`slot.videoUrl` and `authStore.orgId`.
- `onSlotAudioUrlChange`/`onSlotVideoUrlChange` mutate `localService.slots[index]` directly, mirroring `onSectionChange` exactly — attach/remove rides the SAME existing `localService` deep-watch autosave; no new save call or store action was added.
- 5 new component tests for `SlotMediaAttachment` (upload success, upload rejection/no-emit, remove-audio, video preview, progress indicator lifecycle) — all pass; `npm run type-check` stays at 0 errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build SlotMediaAttachment.vue** - `e8a04e1` (feat)
2. **Task 2: Wire SlotMediaAttachment into each ServiceEditorView slot row** - `8e3afb2` (feat)
3. **Task 3: Human-verify end-to-end attach, preview, autoplay-block fallback, and upload-failure resilience** - PENDING (blocking checkpoint, see below)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

_No TDD tasks in this plan — single feat commit per task._

## Files Created/Modified
- `src/components/SlotMediaAttachment.vue` - new: props `audioUrl?`/`videoUrl?`/`orgId`; emits `update:audioUrl`/`update:videoUrl`; uses `useMediaUpload`, `AudioPlayer`, `VideoPlayer`
- `src/components/__tests__/SlotMediaAttachment.test.ts` - new: 5 tests mocking `@/composables/useMediaUpload`
- `src/views/ServiceEditorView.vue` - imports `SlotMediaAttachment`; renders it at the end of each slot's content column; adds `onSlotAudioUrlChange`/`onSlotVideoUrlChange` mutating the bound slot in place
- `src/views/__tests__/ServiceEditorView.test.ts` - added a missing `@/stores/importedSlides` reactive-stub mock (Rule 3 auto-fix, see Deviations) so the file's 14 tests actually run and pass

## Decisions Made
- `SlotMediaAttachment` is placed as the last child inside each slot's content column (below all per-kind blocks: SONG/SCRIPTURE/PRAYER/MESSAGE/HYMN/IMPORTED), not beside the section-select/remove-slot icons — keeps it visually secondary/compact per the plan's explicit instruction, while remaining universal across every slot kind with a single insertion point.
- Gated on `authStore.isEditor && !isExportedLocked`, matching the section-select and per-kind editable-field siblings — an exported/locked service already freezes every other per-slot control, so media attach/remove is treated the same way rather than left open as an inconsistent escape hatch.
- `onSlotAudioUrlChange`/`onSlotVideoUrlChange` mutate `localService.slots[index]` directly (exactly mirroring `onSectionChange`), so attach/remove commits through the SAME existing `localService` deep-watch autosave — no new save path, per the plan's explicit non-goal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `@/stores/importedSlides` mock to ServiceEditorView.test.ts**
- **Found during:** Task 2 verification (`npx vitest run src/views/__tests__/ServiceEditorView.test.ts`)
- **Issue:** `useSlideshowAssembly` (added in Phase 21-01) unconditionally calls `useImportedSlides()` on every `ServiceEditorView` mount, but `ServiceEditorView.test.ts` never mocked `@/stores/importedSlides` — every test in the file crashed with `getActivePinia() was called but there was no active Pinia`. Confirmed via a controlled A/B test (temporarily reverted my Task 2 edit to the last commit and re-ran the same test file) that this failure is 100% pre-existing since 21-01, unrelated to this plan's changes.
- **Fix:** Added a reactive-stub mock for `@/stores/importedSlides` (`decks: []`, `isLoading: false`, `subscribeDecks`/`unsubscribeDecks` spies), mirroring the existing `@/stores/scriptureSlides` mock immediately above it in the same file.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** All 14 real tests in `src/views/__tests__/ServiceEditorView.test.ts` now pass (previously 0/14 ran — all crashed at mount).
- **Committed in:** `8e3afb2` (Task 2 commit)
- **Note:** Two stale copies of this same test file inside `.gsd/quarantine/worktrees/**` (leftover snapshots from prior GSD sessions, not source code) still fail with the same pre-existing error — left untouched as out of scope (not part of `files_modified`, not real source).

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** The fix was required to run this plan's own required verification command; it touches only test-mock setup, not application behavior. No scope creep.

## Issues Encountered
None beyond the deviation above. Only the two changed test files were run (`npx vitest run <file>`), per the environment constraint against the full suite or touching the emulator. `npm run type-check` stayed at 0 errors after every task.

## User Setup Required

None - no new packages, no external service configuration. Reuses `useMediaUpload` (22-01) and `AudioPlayer`/`VideoPlayer` (22-02) exactly as built.

## Next Phase Readiness

- Code, unit tests, and type-check for `SlotMediaAttachment` and its `ServiceEditorView` wiring are complete and committed (`e8a04e1`, `8e3afb2`). All 5 new component tests and all 14 `ServiceEditorView` tests pass.
- **BLOCKED on human-verify (Task 3, gate=blocking):** attach an MP3 and a video to a slot in the running editor, confirm progress + playable preview in both the editor and `SlideshowPreview`, confirm playback stops at end with no loop, confirm autoplay-block degrades gracefully (muted video / play affordance), confirm an oversized/invalid upload shows an error while the slot's other metadata is unchanged and saved, and confirm Remove clears + autosaves. The executor did NOT self-approve, per explicit instruction. See the CHECKPOINT REACHED section returned alongside this SUMMARY for exact steps.
- Once approved, Phase 22's full media-attachment feature set (foundation, players, cleanup, editor UI) is complete and this plan can be marked fully done.

---
*Phase: 22-media-attachments-and-storage-lifecycle*
*Completed: 2026-07-25*

## Self-Check: PASSED

All created/modified files found on disk; both task commit hashes (e8a04e1, 8e3afb2) found in git log; 5/5 SlotMediaAttachment tests pass; 14/14 real ServiceEditorView tests pass; `npm run type-check` 0 errors.
