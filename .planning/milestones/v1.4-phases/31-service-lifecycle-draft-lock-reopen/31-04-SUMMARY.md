---
phase: 31
plan: 04
subsystem: service-lifecycle
tags: [R036, D-05, D-06, D-07, D-08, R054, I-01]
requires: [31-01, 31-02, 31-03]
provides:
  - "view: the five-class gate migration applied; isExportedLocked retired"
  - "view: canReorder finally carries a lock term (drag-reorder on an exported service is closed)"
  - "slides: serviceLocked prop threaded SlidesTab -> rail/grid/drawer, distinct from isEditor"
  - "slides: EditSlideDrawer's drawer-service-locked-notice via a dynamic :data-testid"
  - "handler-level guards on every Service Order, Roles and Slides mutation entry point"
affects: [31-05, 31-06]
tech-stack:
  patterns:
    - "withDefaults(defineProps<...>(), { serviceLocked: false }) for additive lock props"
    - "compose the lifecycle lock INTO an existing canMutate/canReorder computed so its watcher-driven Sortable teardown comes free"
key-files:
  modified:
    - src/views/ServiceEditorView.vue
    - src/components/slides/SlidesTab.vue
    - src/components/slides/SlideGrid.vue
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/SlidePlanRail.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/components/slides/__tests__/SlidePlanRail.test.ts
    - .planning/PENDING-VERIFICATION.md
decisions:
  - "Task 1 and Task 2 shipped in ONE commit: retiring isExportedLocked without migrating its call sites does not compile"
  - "SlideGrid grew TWO composed gates, not one — canMutateGroup excludes song groups, canWriteGroupMedia does not"
  - "Class D collapse into the viewer branch was declined; the spec marked it optional and the collapse is not this phase's"
metrics:
  duration: ~2h
  completed: 2026-07-30
  tasks: 6
  commits: 4
  tests_added: 52
status: complete
---

# Phase 31 Plan 04: The three tabs go read-only — the five-class gate migration Summary

All three tabs now render read-only at `planned` and at `exported`, the lifecycle lock composes into
Phase 30's existing `canMutate`/`canReorder` seams rather than running beside them, and every hidden
control's handler refuses the write as well.

## Commits

| Commit | Tasks | What |
|---|---|---|
| `8c9200f` | 1, 2, 4 | The five-class migration across Service Order and Roles; `isExportedLocked` retired |
| `6abc141` | 3, 5 | `serviceLocked` threaded through the Slides tab; Sortable teardown; locked empty-state copy |
| `23cb085` | 6 | 52 tests, two of them red-checked against the defects they catch |
| _(this)_ | — | SUMMARY, STATE, ROADMAP, PENDING-VERIFICATION |

## ★ Per-site class register (the plan's explicit ask)

**Every site matched the class the UI-SPEC assigned it.** Nothing was guessed, and no site was
reclassified. Line numbers below are the pre-migration ones from the spec; matching was done on
condition text, since waves 1-3 had shifted every number.

### Class A — compound `v-if`, the only true 1:1 → `canEditService` (10 sites)

| Spec line | Site | Verified as |
|---|---|---|
| `:502` | sermon-passage `ScriptureInput` | `authStore.isEditor && !isExportedLocked` ✓ |
| `:617` | clear-song `×` | ✓ |
| `:666` | `SongSlotPicker` | ✓ |
| `:690` | scripture-slot `ScriptureInput` | ✓ |
| `:729` | Prayer link inputs | ✓ |
| `:776` | Message link inputs | ✓ |
| `:822` | Hymn inputs | ✓ |
| `:867` | section `<select>` | ✓ |
| `:880` | remove-slot `×` | ✓ |
| `:897` | Add Element + menu | ✓ |

### Class B — no lock term today; the term is ADDED (8 sites)

| Spec line | Site | Was | Now |
|---|---|---|---|
| `:443` | Teams checkbox block | `v-if="authStore.isEditor"` | `canEditService` |
| `:487` | Sermon Topic input | `v-if="authStore.isEditor"` | `canEditService` |
| `:579` | drag handle | `v-if="authStore.isEditor"` | `canEditService` |
| `:631` | AI draft row | `isEditor && aiDraftSongs.has(index)` | `canEditService && aiDraftSongs.has(index)` |
| `:957` | Reset to schedule | `v-if="assignment.overriddenPersonIds !== null"` — a DATA condition, editor-only by ancestry | `canEditService && assignment.overriddenPersonIds !== null` |
| `:970` | Roles override picker | **no `v-if` at all** — confirmed on read | `v-if="canEditService"` |
| §3 | autosave line, Undo, Suggest All, Save | `v-if="authStore.isEditor"` (×4) | `canEditService` |

`:970` was the spec's most surprising claim and it held exactly: `<div class="mt-2 flex flex-wrap
gap-3">`, ungated. Its `No eligible people have this role` caption went with it, since that caption
exists solely to explain an empty picker.

### Class C — `:disabled` bindings DELETED, not rewritten (3 pure + 1 already-compound)

| Spec line | Site | Action taken |
|---|---|---|
| `:453` | team checkbox | binding deleted; `disabled:opacity-50` dropped from its class list |
| `:463` | Special name input | binding deleted; `disabled:opacity-50` dropped |
| `:492` | Sermon Topic input | binding deleted; `disabled:opacity-50` dropped |
| `:134` | Suggest All Songs | **already handled in wave 3** — verified as `:disabled="!hasSermonContext \|\| aiSuggestingAll"`, and its stale `cycle badge` `:title` already gone. Nothing to do. |

All three pure sites sat inside a block that Class A/B now removes outright, so the binding had
nothing left to express — and rewriting it to `canEditService` would have disabled the control
exactly when editing IS allowed.

### Class D — inverse read-only branches, kept pointing at the LOCKED state (2 sites)

| Spec line | Renders | Was | Now |
|---|---|---|---|
| `:510` | read-only sermon passage | `v-else-if="authStore.isEditor && isExportedLocked"` | `authStore.isEditor && isLocked` |
| `:703` | read-only scripture reference | same shape | `authStore.isEditor && isLocked` |

**The optional collapse into the identical `v-else` viewer branch was declined.** The spec marks it
optional; performing it would delete two shipped branches to save four lines and would make the diff
harder to audit against the very table that exists to prevent a mistake here. A test pins each: a
locked editor still sees `Romans 8:1-11`.

### Class E — untouched fallbacks, each verified to render sensibly for a locked editor

`:468` viewer team list · `:496` viewer sermon topic · `:517` viewer passage · `:680` `Song — Empty` ·
`:707` viewer scripture · `:759`/`:806` viewer link anchors · `:846` viewer hymn · `:934` Roles viewer
note. **Changed: nothing.** Tests assert the locked editor lands on the team list, the sermon topic
text, and — for a viewer — the Roles panel's own `visible via the shared service link` note, which the
spec's "Roles tab is editor-only entirely" claim would have invited deleting.

## The live defects this wave closed

**`canReorder` had no lock term, so drag-reorder worked on an exported service.** It is now
`canEditService.value && localService.value !== null`. Red-checked: reverting that one term fails both
Sortable tests.

**`isExportedLocked` is deleted.** It fired only at `exported` and never at `planned`, which is half of
R036. Red-checked at the seam instead: narrowing `isLocked` back to `=== 'exported'` fails **18 tests**
— which is what the `planned`/`exported` symmetry in the new suite is for. A suite that only exercised
`exported` would have passed against the defect.

## ★ Sortable teardown — solved by composition, not by a new mechanism

Both Sortable watchers already keyed on their `canReorder` computed and already destroyed on close.
Composing the lifecycle lock **into** those computeds — rather than adding a parallel gate beside them
— therefore bought the destroy AND the rebuild for free, in both files:

- `ServiceEditorView.vue`: five per-section instances, `canReorder` → `canEditService && localService !== null`
- `SlideGrid.vue`: one instance, `canReorder` → `canMutateGroup && group !== null`

Had the gate been added as a separate `v-if` on the handles, the instances would have stayed attached
and a reopened service would have been permanently undraggable until a page reload. Two tests pin each
direction; a third asserts the re-created instance is wired to the real `.drag-handle`, not a stub.

## Handler-level guards (30-VERIFICATION I-01)

Gated **17** entry points, every one with a direct-call test asserting the no-op:

- *Service Order* — `toggleTeam`, `addSlot`, `removeSlot`, `confirmSlotDelete`, `onSelectSong`,
  `onClearSong`, `onSectionChange`, `onScriptureChange`, `onSermonPassageChange`, `acceptAiSong`,
  `rejectAiSong`, `suggestAllSongs`, `fetchAiForSlot`, `onSlotSortEnd`, `onUndo`
- *Roles* — `onToggleOverridePerson`, `onResetRoleOverride` (these write
  `roleAssignmentOverrides.{roleId}` through the store **directly**, bypassing `localService`/autosave,
  so a template-only gate would have left the write path fully open)
- *Slides* — `onAddSlide`, `openImportModal`, `onImportConfirmed`, `importDeckFile`,
  `importImageFilesDropped`, `appendVideoEntries`, `attachDroppedAudio`, `onFilesDropped`,
  `onGridDragEnter`, `onAttachGroupMusic`, `onRemoveGroupMusic`, the Sortable `onEnd`; and in the
  drawer `writeField`, `onAudioFileSelected`, `onRemoveAudio`, `onDuplicate`, `onDeleteTrigger`,
  `onConfirmDelete` (`onLoopToggle` already had one from Phase 30)

A companion test proves each guard is the *lock* and not a blanket no-op: the same handlers still act
on a draft service.

## Decisions taken inside Claude's discretion

**Tasks 1 and 2 shipped as one commit.** Retiring `isExportedLocked` while any call site remains does
not compile, and migrating the call sites is Task 2. Splitting them would have meant either a broken
intermediate commit or a commit that adds a computed already added in wave 3.

**`SlideGrid` grew TWO composed gates, not one.** `canMutateGroup` (`isEditor && !serviceLocked &&
!isSongGroup`) governs create/import/reorder; `canWriteGroupMedia` (`isEditor && !serviceLocked`)
governs the drop tile and the group-bed music control and deliberately **omits** `isSongGroup`. That
is what preserves 30-03's shipped behaviour — *"lock the slide grid for song groups without blocking
group media"* — while still closing group media on a locked service. Collapsing them into one gate
would silently have taken group media away from song groups on draft services. Two tests pin the
distinction in both directions.

**`onSave` was left unguarded.** It is the autosave path, it is awaited by `onMarkAsPlanned` while the
service is still draft, and the store guard already refuses it. Guarding it bought nothing the store
does not already provide and risked interfering with the transition sequencing 31-03 established.

## Deviations from the plan

### Rule 2 — `onGridDragEnter` gated, which the plan did not name

Not in the spec's control list. The grid's whole-area dragover highlight is drawn by
`onGridDragEnter`, independent of the drop tile's own `v-if`. With the tile removed but the highlight
left live, dragging a file over a locked group would have painted a large indigo drop-target border
advertising a drop that then silently did nothing — a dead affordance of exactly the class D-05 exists
to eliminate. One line, same gate.

### Rule 2 — `onUndo` and the header autosave/Undo/Save controls

§3 of the UI-SPEC lists these as removed while locked, but they are not in the plan's five-class table
(they carry `v-if="authStore.isEditor"`, i.e. class B). Migrated with the rest and `onUndo` gated:
Undo restores a pre-lock snapshot and then arms a 500ms autosave that the store guard would reject —
a silent failure the user would read as "it didn't save".

### The song-group empty-state heading changed on draft services

`SlideGrid`'s zero-slide heading is now `canMutateGroup ? 'No slides in this group yet' : 'No slides in
this group.'`, verbatim from the UI-SPEC. Because `canMutateGroup` excludes song groups, an **unlocked**
song group's heading changed from *"…yet"* to *"…group."* too. The spec's code block specifies exactly
this; recorded here because it is a (small) visible change on draft services that the phase boundary
did not obviously predict.

### Autonomy

No checkpoint was reached. Five verification items that automated tests cannot honestly cover
(31.18–31.22) were appended to `.planning/PENDING-VERIFICATION.md` under the existing Phase 31
heading — real pointer dragging after a reopen, the sticky banner at scroll depth, the drawer opening
read-only, the absent music box, and the tone of the four locked empty states. **None is recorded as
passed.**

## Verification

**Component suites** — `npx vitest run` over the five touched files:

| Suite | Before | After |
|---|---|---|
| `ServiceEditorView.test.ts` | 99 | **127** (+28) |
| `SlideGrid.test.ts` | 63 | **73** (+10) |
| `EditSlideDrawer.test.ts` | 110 | **118** (+8) |
| `SlidesTab.test.ts` | 25 | **28** (+3) |
| `SlidePlanRail.test.ts` | 10 | **13** (+3) |

All green, 0 failed.

**★ Red-before-green, confirmed by execution:**

| Change | Result |
|---|---|
| `isLocked` narrowed back to `=== 'exported'` | **18 tests fail** — every `planned` variant |
| `canReorder` reverted to `isEditor && localService !== null` | **both Sortable tests fail** |

Both reverted; `diff` against the pre-check backup confirmed the file byte-identical afterwards.

**Full suite** — `npx vitest run --maxWorkers=2`: **1853 passed** (1801 before, +52), 2 failing files,
both the documented baseline (`src/storage.rules.test.ts` needs the Storage emulator;
`RosterView.test.ts` stale assertion). **Zero new failures.**

**Types** — `npx vue-tsc --noEmit -p tsconfig.app.json` clean.

**Lint** (scoped to touched files only, never project-wide):
`SlidesTab.vue`, `SlideGrid.vue`, `EditSlideDrawer.vue`, `SlidePlanRail.vue` and the three slides test
files are **clean**. `ServiceEditorView.vue` reports 14 errors and
`ServiceEditorView.test.ts` 19, `SlideGrid.test.ts` 3 — each byte-identical to the pre-existing
baseline. The view's baseline was proved by linting a `git show HEAD:` copy of the file (same 14); the
test files' by confirming the highest reported line number (2140 and 927) falls **above** the new
blocks (which start at 2714 and 1361).

**Rules** — `firestore.rules` was not touched this wave, so `src/rules.test.ts` was not re-run. Its 96
green tests from 31-02 still describe the current file.

## Spacing conformance

**No new off-grid value was authored.** This wave adds no new element with its own spacing — every
change is a `v-if` condition, a `:disabled` deletion, or a text swap inside markup that already
existed. The three `disabled:opacity-50` classes removed alongside the class-C bindings are the only
class-list edits, and they are deletions. The Phase 29 flag is not repeated.

## Not in this wave

R038's Sunday default (31-05) and the phase verification pass (31-06). The `firestore.rules` deploy
stays deferred to ROADMAP backlog Phase 999.3.

## Self-Check: PASSED

All four commits resolve in `git log`, and every file this summary claims to have modified exists on
disk with the claimed changes.
