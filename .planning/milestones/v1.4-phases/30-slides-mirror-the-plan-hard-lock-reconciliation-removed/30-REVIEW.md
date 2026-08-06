---
phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed
reviewed: 2026-07-29T10:40:00Z
depth: deep
diff_range: 0ecc84f..f013ba8
files_reviewed: 14
files_reviewed_list:
  - src/utils/slideGroupMaterializer.ts
  - src/utils/slideshowAssembler.ts
  - src/utils/scripture.ts
  - src/utils/planningCenterExport.ts
  - src/composables/useSlideshowAssembly.ts
  - src/stores/slideGroups.ts
  - src/types/slideGroup.ts
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/SlideDropTarget.vue
  - src/components/slides/EditSlideDrawer.vue
  - src/components/slides/slideDisplay.ts
  - src/views/ServiceEditorView.vue
  - src/components/slides/ReconcileConfirmModal.vue (deleted — removal verified)
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
severity_breakdown:
  blocker: 2
  high: 2
  medium: 5
  low: 5
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-07-29
**Depth:** deep (cross-file, with executed probes)
**Diff base:** `0ecc84f` → `f013ba8` (14 source files, 26 files total)
**Status:** issues_found

## Summary

The R046 removal is genuinely complete — a widened grep over `reconcileSongGroup`,
`reconcileUnstableIdGroup`, `ReconcileResult`, `ReconcileConfirmModal`, `dismissedSignature`,
`dismissReconciliation`, `needsConfirm`, `pendingReconciliations`, `PendingReconciliation`,
`reconciliationConfirmCopy`, `computeLoss` and `hasCustomization` returns zero live declarations or
references across `src/`; the only hits are the three declared negative-assertion string literals and
prose in doc comments. `ReconcileConfirmModal.vue` and its suite are gone. The R054 lock on the grid
(add / import / drag handle / drop routing) and on the drawer (label, notes, body, audio scope,
attach, remove, duplicate, delete) is real, and group-level audio still works through
`SlideGroupMusicControl` and the audio drop path. All 596 tests across the phase's suites pass.

The idempotence work, however, bought *stability* at the cost of *preservation*. The new
`carryStoredDerivedEntries` / `survivingEntries` pair is order- and multiplicity-preserving in the
narrow sense the phase asserted (running it twice is byte-identical), but it is not
**content**-preserving: it emits only what the current derivation produces, in the derivation's own
order, and it recognises only `video` and authored-`text` entries as user work. Everything else a
user can legitimately put into a SCRIPTURE or IMPORTED group — an imported deck, dropped images, a
drag-reorder — is now destroyed by the very first unconditional rebuild, with no dialog, because the
confirm gate that used to stall those paths is gone and nothing replaced it for those cases. That is
precisely the D-02 regression 30-CONTEXT.md called "the phase's most dangerous defect," partially
closed.

Three defects below were **proven by executing the shipped code** (probe run against
`rebuildGroup`, then removed; working tree verified clean).

---

## BLOCKER

### BL-01: User-imported slides on a SCRIPTURE or IMPORTED group are silently destroyed by the first rebuild

**Files:**
- `src/utils/slideGroupMaterializer.ts:180-185` (`isNonDerivableEntry`)
- `src/utils/slideGroupMaterializer.ts:194-196` (`survivingEntries`)
- `src/utils/slideGroupMaterializer.ts:265-314` (`carryStoredDerivedEntries`)
- `src/utils/slideGroupMaterializer.ts:528-539` (`rebuildUnstableIdGroup`, line 537)
- `src/components/slides/SlideGrid.vue:23-29, 397-418, 502-538` (the reachable write paths)

**Issue:** `SlideGrid.vue` renders `＋ Add slide` and `⇪ Import into this group` for every non-song
group (`v-if="isEditor && !isSongGroup"`, lines 17-29), and `onFilesDropped` routes a dropped PPTX or
images through `importDeckFile` / `importImageFilesDropped` for those groups too. Confirming that
import appends entries with `sourceRef: { kind: 'imported', importId, innerSlideId }`
(`onImportConfirmed`, line 407-411).

`rebuildUnstableIdGroup` then computes `renumbered([...carried, ...survivingEntries(group)])`. Those
appended entries are in neither list:

- `carryStoredDerivedEntries` only ever emits entries whose `derivedIdentityKey` appears in `fresh`.
  For a SCRIPTURE slot `fresh` is a single `{ kind: 'scripture' }` entry, so key `imported:deckB:b1`
  is never reached and the stored entry is never pushed. For an IMPORTED slot `fresh` contains only
  the *slot's own* `importId`, so a second deck the user imported into the group is equally invisible.
  This is deliberate for the "obsolete innerSlideId" case (the function's own doc comment, lines
  258-263, and the test at `slideGroupMaterializer.test.ts:1043`) but it does not distinguish
  "the source stopped producing this" from "the source never produced this — a user added it."
- `survivingEntries` filters on `isNonDerivableEntry`, which returns `true` only for `video` and for
  `text` carrying a `title`/`body`. An `imported` ref returns `false`.

The store's concurrent-write guard does not rescue them either: in
`mergeConcurrentlyAddedEntries` (`src/stores/slideGroups.ts:309-330`) the appended entries are
present in `base` (the rebuild's `outcome.group.slides`), so `concurrentlyAdded` is empty and
`withoutConcurrentlyDeleted` keeps only what `next` carries.

**Concrete failure scenario:** a SCRIPTURE plan item with a materialized group. The user clicks
"Import into this group" and imports a 2-slide PPTX (or drags two PNGs onto the grid). The write
lands, the two cards appear. The resulting `onSnapshot` re-runs `rebuildOutcomes`
(`src/composables/useSlideshowAssembly.ts:358-385`), which returns `changed: true` with the imported
entries removed, and `applyRebuildOutcomes` (line 395-416) writes that back unconditionally. Within
one round trip the user's two slides are gone from Firestore. Identical result for a second deck
imported into an IMPORTED group, and for images dropped on either.

**Proven:** executing `rebuildGroup(group, scriptureSlot, inputs())` against a group whose slides are
`[scripture e1, imported deckB/b1 e2, imported deckB/b2 e3]` returns `slides = ['e1']` — `e2`/`e3`
dropped.

**Fix:** treat every stored entry whose `sourceRef` could not have been produced by *this slot's*
current derivation as user work, not just video/authored-text. Concretely, widen the survival
predicate to key off the slot rather than the ref kind alone:

```ts
// slideGroupMaterializer.ts
function isSlotDerivableRef(slot: ServiceSlot, ref: SourceRef): boolean {
  switch (slot.kind) {
    case 'SONG':      return (ref.kind === 'lyric' || ref.kind === 'copyright') && ref.songId === slot.songId
    case 'SCRIPTURE': return ref.kind === 'scripture'
    case 'IMPORTED':  return ref.kind === 'imported' && ref.importId === slot.importId
    default:          return ref.kind === 'text' && ref.title === undefined && ref.body === undefined
  }
}

function survivingEntries(group: SlideGroup, slot: ServiceSlot): GroupSlideEntry[] {
  return group.slides.filter((e) => !isSlotDerivableRef(slot, e.sourceRef))
}
```

and pass `slot` through from `rebuildUnstableIdGroup` / `rebuildSongGroup`. Note the IMPORTED case
must still drop an entry whose `importId` matches the slot but whose `innerSlideId` no longer exists
(the intended re-import behaviour), so keep that check inside `carryStoredDerivedEntries` and let
`survivingEntries` handle only foreign-source refs. Add a regression test:
*"an imported deck appended into a SCRIPTURE group survives a passage change."*

---

### BL-02: A SCRIPTURE/IMPORTED group's stored slide ORDER is discarded on every rebuild — a drag-reorder is reverted within one round trip

**Files:**
- `src/utils/slideGroupMaterializer.ts:536-537` (`renumbered([...carried, ...survivingEntries(group)])`)
- `src/composables/useSlideshowAssembly.ts:358-385, 395-416` (unconditional apply loop)
- `src/components/slides/SlideGrid.vue:596` (`canReorder`), `622-678` (`onEnd` write)

**Issue:** `carried` is built by walking `fresh` (`carryStoredDerivedEntries`, line 287), so its order
is always the *derivation's* order — deck order for IMPORTED, the single derived entry for SCRIPTURE.
Surviving non-derivable entries are then concatenated **after** it. Any order the user established is
overwritten. Pre-Phase-30 this could not happen: `reconcileUnstableIdGroup` short-circuited on
`freshSignature === group.sourceSignature` (see `git show 0ecc84f:src/utils/slideGroupMaterializer.ts`),
and a reorder does not change the source signature, so the reconciler was a no-op. Phase 30
deliberately removed that gate (`rebuildUnstableIdGroup` doc comment, lines 522-526) without
replacing the order-preservation it was incidentally providing.

`canReorder` (SlideGrid.vue:596) is `isEditor && group !== null && !isSongGroup` — so drag-reorder is
still offered on SCRIPTURE and IMPORTED groups.

**Concrete failure scenario:** an IMPORTED plan item whose deck has slides `i1, i2, i3`. The user drags
`i3` to the front. `onEnd` writes `[e3, e2, e1]` and it commits successfully. The resulting snapshot
re-runs `rebuildOutcomes`; `rebuildImportedGroup` returns `changed: true` with `[e1, e2, e3]`, and
`applyRebuildOutcomes` writes it. The card snaps back. No `reorderError` is shown (the write did not
fail), so the user sees an unexplained revert. The same mechanism relocates a surviving hand-added
video or text slide from wherever the user placed it to the end of the group on the next rebuild —
so BL-02 also degrades the half of D-02 that BL-01 does not outright destroy.

**Proven:** `rebuildGroup(group, importedSlot, inputs(deck))` with stored slides `[e3, e2, e1]`
returns `changed: true`, `['e1','e2','e3']`.

**Fix:** either (a) make the rebuild order-preserving — seed the output from the stored order and only
insert/remove against it, rather than rebuilding the array from `fresh`:

```ts
function rebuildUnstableIdGroup(group, slot, inputs): RebuildResult {
  const fresh = deriveGroupEntries(slot, inputs)
  if (fresh.length === 0) return { changed: false, slides: group.slides }
  const carried = carryStoredDerivedEntries(fresh, group)          // identity + content
  const storedOrder = new Map(group.slides.map((e, i) => [e.id, i]))
  const ordered = [...carried, ...survivingEntries(group, slot)]
    .sort((a, b) => (storedOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER)
                  - (storedOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  const slides = renumbered(ordered)
  return { changed: !slidesEqual(slides, group.slides), slides }
}
```

(newly-derived entries with no stored position fall to the end, which is the desired append
behaviour); or (b) remove `canReorder` for SCRIPTURE/IMPORTED groups so the app stops offering an
action it silently undoes. (a) is preferable — R050's append contract and the drop paths both assume
a user-controlled order. Assert it: *"a reordered imported group rebuilds to `changed: false`."*

---

## HIGH

### HI-01: A pre-R047 scripture group never collapses to one slide — it stabilises at N identical reference slides

**File:** `src/utils/slideGroupMaterializer.ts:215-227` (`derivedIdentityKey`), `298-310`
(surplus emission)

**Issue:** `derivedIdentityKey` returns the constant `'scripture'` for every scripture ref, so a group
written before `5c531b1` (one entry per split passage fragment, each carrying its own
`innerSlideId`) has N stored entries under one key. `fresh` has one occurrence, so occurrence 0
consumes stored[0] and the `isLastOccurrence` surplus loop (lines 306-310) re-emits stored[1..N-1],
each rewritten to the fresh `{ kind: 'scripture' }` ref. The result is N entries that all resolve
through `resolveEntryContent`'s scripture branch to the *same* reference string — and it is stable, so
it never converges to one.

**Concrete failure scenario:** any group document written before `5c531b1` for a passage that
`scriptureSplitter` had split into 3 fragments now projects "John 3:16-18" three times in a row. R047
("exactly ONE reference-only slide") is not delivered for stored data; the phase's own
`deriveGroupEntries` test only covers a *fresh* derivation.

**Proven:** `rebuildGroup` over a 3-entry legacy scripture group returns 3 entries, not 1.

**Fix:** the surplus branch is meaningful only for kinds with real fresh-side multiplicity. Suppress
it for scripture, whose derivation is defined as exactly one entry:

```ts
// carryStoredDerivedEntries, replacing lines 304-310
const totalOccurrences = occurrenceTotals.get(key)!
const isLastOccurrence = occurrenceIndex + 1 === totalOccurrences
const carriesSurplus = key !== 'scripture'   // R047: one derived entry, period
if (carriesSurplus && isLastOccurrence && stored && stored.length > totalOccurrences) { … }
```

D-19 says stored slide data is greenfield, which lowers the blast radius — but the phase explicitly
claims "every entry written before this change stays readable," and it does read: as N duplicates.

---

### HI-02: `formatScriptureReference` projects "John 3:16-16" where the rail shows "John 3:16"

**Files:** `src/utils/scripture.ts:155-159`; `src/components/slides/slideDisplay.ts:49-56`

**Issue:** `formatScriptureReference` branches on `verseStart && verseEnd` and emits
`${chapter}:${verseStart}-${verseEnd}` whenever both are present — including when they are equal.
`slotDisplayTitle` collapses that case (`slot.verseEnd !== slot.verseStart ? '-'+verseEnd : ''`,
line 52). The equal-verse state is reachable: `parseScriptureInput` on `"John 3:16-16"` produces
`{verseStart: 16, verseEnd: 16}` (lines 128-135, `Math.min`/`Math.max` over `[16,16]`), and
`ScriptureInput.onSelectAiScripture` writes whatever the AI returns, including `verseStart === verseEnd`.
The behaviour is enshrined as expected in `planningCenterExport.test.ts:299`
(`expect(formatScriptureRef(ref)).toBe('John 3:16-16')`), so it was decided, not overlooked — but it
is wrong output.

**Concrete failure scenario:** user types "John 3:16-16" (or picks a single-verse AI suggestion). The
Slides rail row, the grid header and the drawer context line all read "John 3:16". The projected
slide, and the Planning Center plan title via `buildPlanTitle` → `formatScriptureRef`, read
"John 3:16-16".

**Fix:**

```ts
export function formatScriptureReference(ref: ScriptureRef): string {
  if (ref.verseStart && ref.verseEnd && ref.verseEnd !== ref.verseStart) {
    return `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
  }
  if (ref.verseStart) return `${ref.book} ${ref.chapter}:${ref.verseStart}`
  return `${ref.book} ${ref.chapter}`
}
```

and then delete `slotDisplayTitle`'s private formatter (lines 50-54) in favour of
`scriptureRefFromSlot(slot)` + `formatScriptureReference`, which is the whole point of declaring a
canonical formatter. Update `planningCenterExport.test.ts:299`.

---

## MEDIUM

### ME-01: Two scripture formatters were left un-delegated — the "cannot drift" claim is false for the SCRIPTURE slot itself

**Files:** `src/utils/planningCenterExport.ts:80`; `src/utils/planningCenterApi.ts:959-963`

**Issue:** `30-04-SUMMARY.md` records that `formatScriptureRef` now delegates "so the exported text and
the projected slide cannot drift." Only the *sermon passage* path was changed. The SCRIPTURE **slot**
is formatted twice more, inline, by the old rule:

```ts
// planningCenterExport.ts:80 — the "Copy for PC" text block
const verseRange = slot.verseStart && slot.verseEnd ? `:${slot.verseStart}-${slot.verseEnd}` : ''
lines.push(`${label} -- ${slot.book} ${slot.chapter}${verseRange}`)

// planningCenterApi.ts:960-963 — the actual PC item title AND the ESV fetch query
const verseRange = slot.verseStart && slot.verseEnd ? `:${slot.verseStart}-${slot.verseEnd}` : ''
const refText = `${slot.book ?? ''} ${slot.chapter ?? ''}${verseRange}`.trim()
```

**Concrete failure scenario:** a scripture reading of "Romans 8:28" (`verseStart: 28`, `verseEnd: null`
— `parseScriptureInput` sets `verseEnd` only for ranges, lines 128-135). The projected slide reads
"Romans 8:28". The exported PC item is titled `Scripture - Romans 8`, and `fetchPassageText("Romans 8")`
pulls the whole chapter into the item description. Drift in exactly the direction the phase claimed to
have closed.

**Fix:** route both through `scriptureRefFromSlot(slot)` + `formatScriptureReference(...)`:

```ts
const ref = scriptureRefFromSlot(slot)
const refText = ref ? formatScriptureReference(ref) : ''
```

---

### ME-02: R047's new source of truth is not round-trippable in its own editor

**Files:** `src/views/ServiceEditorView.vue:2163-2171` (`slotToScriptureRef`), `691`, `701-713`;
`src/components/slides/slideDisplay.ts:49-56`

**Issue:** R047 made the SCRIPTURE slot's own `book/chapter/verseStart/verseEnd` the slide's canonical
source, and `scriptureRefFromSlot` requires only `book + chapter` (a whole-chapter reading is
explicitly a valid source — `slideGroupMaterializer.test.ts:211`). But the only editor for those
fields binds its `modelValue` to `slotToScriptureRef`, which returns `null` unless **all four** fields
are set:

```ts
function slotToScriptureRef(slot: ScriptureSlot): ScriptureRef | null {
  if (!slot.book || !slot.chapter || !slot.verseStart || !slot.verseEnd) return null
  …
}
```

**Concrete failure scenario:** the user types "Psalm 103" (or "Romans 8:28"). `onScriptureChange` stores
`{book:'Psalms', chapter:103, verseStart:null, verseEnd:null}`. A slide is derived and projects
"Psalms 103" — correct. On reload, `ScriptureInput` initialises `localText` from
`formatRef(props.modelValue)` where `modelValue` is `null`, so the Service Order row's input renders
**empty**, and the viewer/exported-lock read-only lines render "Scripture — Empty". Meanwhile
`slotDisplayTitle` (which needs `verseStart != null`) labels the Slides rail row "Scripture Reading"
rather than the reference. The user sees an empty reference field and a populated slide.
`handleNavigateToScriptureEditor` now scrolls to exactly this row, so "Edit in scripture" lands on a
blank input.

**Fix:** replace the view's private `slotToScriptureRef` with `scriptureRefFromSlot` from
`src/utils/scripture.ts` (the phase's declared canonical primitive) and replace the two inline
template formatters at lines 702-712 with `formatScriptureReference`. Same substitution in
`slotDisplayTitle`.

---

### ME-03: R054 — the audio-loop checkbox is the one mutation control the lock sweep missed

**File:** `src/components/slides/EditSlideDrawer.vue:286-299` (template), `589-599` (`onLoopToggle`)

**Issue:** `0ecc84f..f013ba8` converted every `v-if="isEditor"` mutation gate in this drawer to
`v-if="canMutate"` — label, body textarea, audio scope pills, audio Remove, audio attach, notes,
footer actions. The audio-loop row was skipped; it is gated only on `v-if="audioState"`, and the
checkbox's `:disabled` binding is `loopDisabled = audioState === 'group'`. `onLoopToggle` has no
`canMutate`, and no `isEditor`, guard — it goes straight to `replaceGroupSlides`.

**Concrete failure scenario:** a SONG group entry that carries its own `audioUrl` (attachable before
this phase, and still present in any existing document). `audioState` is `'slide'`, the row renders,
the checkbox is enabled, and toggling it writes the song group's `slides` array from the Slides tab —
the exact CRUD R054 says a song group must block. Secondarily, the same control renders enabled for a
**viewer** on any group, and the write is fired as `void slideGroupsStore.replaceGroupSlides(...)`
(line 598) with no `.catch`, so the rules rejection surfaces as an unhandled rejection.

**Fix:**

```html
<div v-if="audioState" class="mt-2 flex items-start gap-1.5" data-testid="audio-loop-row">
  <input … :disabled="loopDisabled || !canMutate" @change="onLoopToggle" />
```

```ts
function onLoopToggle(event: Event): void {
  if (!canMutate.value) return
  if (audioState.value !== 'slide' || !props.group || !props.entry) return
  …
}
```

---

### ME-04: R045 membership — a group can be re-materialized between its cascade delete and the slot splice

**Files:** `src/views/ServiceEditorView.vue:1906-1926`; `src/composables/useSlideshowAssembly.ts:234-290`

**Issue:** `confirmSlotDelete` awaits `deleteGroup` **before** `performRemoveSlot` (lines 1917-1919), by
design ("a failed delete must not leave the slot removed locally while its group lingers"). But
Firestore applies the delete to its local cache and raises an `onSnapshot` immediately, whereas
`deleteDoc` resolves only on server ack. So the group leaves `groupsBySlotId` while the slot is still
in `localService.value.slots`. `materializationCandidates` (lines 234-263) is a computed watched with
`immediate: true`; it sees a slot with no group, calls `buildInitialGroup`, and — for any slot whose
source derives ≥1 entry (line 258) — queues a candidate. `materializeCandidates` then re-creates the
document via `materializeGroupIfMissing` (whose `getDoc` correctly reports "absent"), after which
`performRemoveSlot` removes the slot with no second cascade.

**Concrete failure scenario:** delete a SONG plan item whose lyrics are loaded. Between the local
snapshot and the awaited server ack, the materialize watcher recreates
`organizations/{org}/slideGroups/{slotId}`. The slot is then removed. An orphan group document
survives indefinitely — "a group exists for exactly the service items that exist" (R045 membership) is
violated. `ServiceEditorView.test.ts`'s membership-lock assertion checks the *view*, not Firestore, so
it cannot catch this.

**Fix:** suppress materialization for a slot whose delete is in flight — the composable already owns
`materializingSlotIds`; expose a companion `deletingSlotIds` set (or filter
`materializationCandidates` on it) and have `confirmSlotDelete` mark the slot before awaiting
`deleteGroup`. Alternatively splice the slot first and roll it back on delete failure, keeping the
window closed.

---

### ME-05: `ServiceScriptureIntegration.test.ts` is 13 passing tests over a UI that no longer exists

**File:** `src/components/__tests__/ServiceScriptureIntegration.test.ts:35-291`

**Issue:** the suite defines its own `ScriptureSlideEditorStub`, `CongregationalEditorStub` and
`TestWrapper` (lines 35-140) and asserts against them — it never mounts `ServiceEditorView`. Its 13
cases assert the "Edit Scripture Slides" button, the reading-mode toggle, panel expand/collapse, and
`readingMode` writes, all of which `5c531b1` deleted from the real view. It passes green and reads as
coverage for behaviour that has been removed, which is exactly the failure mode 30-CONTEXT.md
rejected `describe.skip` to avoid ("A skipped suite passes vacuously and reads as coverage").

**Fix:** delete the suite alongside the UI it described, or rewrite it to mount `ServiceEditorView`
and assert the current contract (`edit-scripture-slides-btn` / `scripture-editor-panel` absent;
`navigate-to-scripture-editor` scrolls `[data-scripture-slot-index]`) — the latter partly exists in
`ServiceEditorView.test.ts:1457-1560`, so deletion is the cheaper honest option.

---

## LOW

### LO-01: `AssemblyInputs.scriptureReadingsById` has no reader; the scriptureSlides subscription is a listener with zero consumers

**Files:** `src/utils/slideshowAssembler.ts:41`; `src/composables/useSlideshowAssembly.ts:18, 137, 145-151, 207, 241, 324, 365`

After `5c531b1`, neither `assembleSlideshow` nor `slideGroupMaterializer` reads
`inputs.scriptureReadingsById` — grep confirms the field's only occurrence outside the composable is
its own type declaration. The composable still calls `scriptureStore.subscribeReadings(id)` (line 137)
and rebuilds the map in four separate places, so the app holds a permanent Firestore listener on
`organizations/{org}/scriptureReadings` that feeds nothing. Remove the field from `AssemblyInputs`,
the four construction sites, and the `useScriptureSlides` import/subscription — or, if Phase 34 will
need it, gate the subscription behind an explicit opt-in rather than leaving it always-on.

### LO-02: `AssembledSlide.sourceId` has no consumer; `sourceIdForRef`'s legacy scripture read keeps a dead field alive

**Files:** `src/utils/slideshowAssembler.ts:85-103, 267, 294`; `src/types/slide.ts:125`

`sourceIdForRef`'s scripture branch was written to return `ref.scriptureReadingId ?? null` "purely so
an old entry's `sourceId` does not change shape underneath a consumer" — but grep finds no consumer of
`AssembledSlide.sourceId` anywhere in `src/` outside the assembler that sets it. The compatibility
concern is unfounded, and the branch is the last thing reading a field the phase declared
ignored-on-read. Return `null` unconditionally, or delete `sourceId` from `AssembledSlide`.

### LO-03: `rebuildSongGroup` silently drops any copyright entry that is neither first nor last

**File:** `src/utils/slideGroupMaterializer.ts:431-434, 489-494, 496-500`

`storedCopyrightEntries` keeps only `[0]` as leading and `[length-1]` as trailing. `otherEntries`
(line 489-491) explicitly excludes `copyright`, and `storedLyricEntries` never contains it. So a
group holding three or more copyright entries — reachable through the drawer's Duplicate before R054
locked song groups, and present in any existing document — loses the middle ones on the next rebuild,
with no confirm. Now unreachable for *new* data; worth an explicit retain-or-document decision rather
than silent loss.

### LO-04: Stale load-bearing invariant comment in `slideGroupMaterializer.ts`

**File:** `src/utils/slideGroupMaterializer.ts:10-14`

"`deriveGroupEntries` is the ONLY place a `GroupSlideEntry.id` is ever minted (via
`crypto.randomUUID()`)" is false and has been for several phases: `rebuildSongGroup` mints ids at
lines 442, 463 and 499, and `SlideGrid.vue` (336, 409, 443) and `EditSlideDrawer.vue` (1022) each mint
their own. Since this comment is the stated justification for the `PresentationViewer` media-keying
contract, leaving it wrong invites a future reader to trust an invariant the code does not hold.
Restate it as "an entry id is minted once and never *re*generated for an existing entry."

### LO-05: `sourceSignature` is now permanently stale for scripture groups while its doc comment claims otherwise

**Files:** `src/types/slideGroup.ts:42-50`; `src/utils/slideGroupMaterializer.ts:122-128`;
`src/composables/useSlideshowAssembly.ts:374-382`

`rebuildUnstableIdGroup` deliberately ignores the signature, and a scripture passage edit produces no
structural change — `rebuildScriptureGroup` returns `changed: false`, so `applyRebuildOutcomes` never
runs and `freshSignature` is never written. The stored value therefore keeps naming the *previous*
passage indefinitely, while `SlideGroup.sourceSignature`'s comment says it is "the source content this
group was last rebuilt against." Either stop writing it entirely (the honest reading of "consulted by
nothing") or correct the comment to "written opportunistically on structural change only; may lag the
current source."

---

## Verified clean

- **R046 removal completeness.** Zero live declarations or references across `src/` for the full
  widened symbol list, including `hasCustomization` and `computeLoss`. The three known
  negative-assertion string literals (`useSlideshowAssembly.test.ts:776,839`,
  `ServiceEditorView.test.ts:1393`) are the only raw hits, as declared.
  `ReconcileConfirmModal.vue` + its suite are deleted; `PendingReconciliation` and
  `reconciliationConfirmCopy` are gone from `slideDisplay.ts`; the `pendingReconciliations` prop is
  removed from both `SlidesTab.vue` and `ServiceEditorView.vue`. No dynamic import or template/string
  survivor.
- **R054 lock coverage** (except ME-03): add-slide, import button, drag handle (`canReorder`
  excludes SONG), Sortable instance lifecycle, drop routing (`onFilesDropped`'s song branch accepts
  audio only and shows its own refusal notice), and the drawer's label/body/notes/audio-scope/
  attach/remove/duplicate/delete are all gated. The grid's own `PptxImportModal` instance is
  unreachable on a song group (`showImportModal` has no song-reachable setter). `SlideDropTarget`'s
  `audioOnly` copy now matches the handler. Group-level audio still works via
  `SlideGroupMusicControl` and the audio drop path.
- **`carryStoredDerivedEntries` idempotence in the narrow sense asserted.** Second-pass byte
  identity holds for SONG, SCRIPTURE and IMPORTED (confirmed by execution). The 28-03
  positional-consumption and 26-09 Map-keying defect classes are genuinely not reintroduced:
  stored entries are indexed as arrays, consumed positionally, and surplus is emitted once after the
  last occurrence.
- **Legacy scripture entries load and render.** `SourceRef`'s scripture member is fully optional, and
  `resolveEntryContent`'s scripture branch ignores `scriptureReadingId`/`innerSlideId` — a
  pre-`5c531b1` entry resolves against the slot with no migration. (Multiplicity is HI-01, not a load
  failure.)
- **`resolveEntryContent`'s `slot.kind !== 'SCRIPTURE'` guard cannot swallow a real mismatch.** A
  slot's `kind` is fixed at creation (`createSlot`); there is no in-place kind-change path in
  `ServiceEditorView.vue`, so a scripture entry can only ever sit on a SCRIPTURE slot.
- **`sourceIdForRef` returning null for scripture breaks no consumer** — there are none (LO-02).
- **`replaceGroupSlides`'s concurrent-write transaction merge was correctly kept** and is unchanged.
- **Lint:** no new errors in any file this phase touched. The 19 errors in `ServiceEditorView.vue` and
  `slideshowAssembler.ts` are the declared pre-existing baseline (verified: `isSlotPopulated` was
  already unused at `0ecc84f`).
- **Tests:** 596/596 green across `slideGroupMaterializer`, `slideshowAssembler`, `scripture`,
  `planningCenterExport`, `useSlideshowAssembly` and all `components/slides/__tests__`. None of the
  defects above is covered by an existing test — BL-01, BL-02 and HI-01 all pass through the suite
  untouched.

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Working tree verified unchanged after review (probe test file created, executed, removed)._
