# Phase 30: Slides Mirror the Plan — Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 10 source + 8 test files (per 30-RESEARCH.md §1 verified inventory)
**Analogs found:** 6 strong in-repo precedents / 2 explicit "no precedent" findings

This phase is dominated by in-file precedent (the exact functions being edited already exist and
are fully quoted in 30-RESEARCH.md's Architecture Patterns / Code Examples sections). This document
adds the analogs 30-RESEARCH.md did not already nail down: the deletion-sequencing precedent (Phase
27), the read-only-affordance precedent (`songEditLink.ts`), the test-fixture-default mechanism
(`EditSlideDrawer.test.ts`), and confirms the absence of any property-test precedent.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/utils/slideGroupMaterializer.ts` (`reconcileSongGroup`→`rebuildSongGroup`, `reconcileUnstableIdGroup`→`rebuildUnstableIdGroup`) | utility (pure transform) | transform (derive+merge) | itself, pre-phase (`reconcileSongGroup:238-390`) | exact — edit in place, do not rewrite from scratch |
| `src/composables/useSlideshowAssembly.ts` (apply-loop simplification) | hook/composable | event-driven (watch → write) | itself, pre-phase (`reconciliationOutcomes`/`applyReconciliationOutcomes`) | exact |
| `src/stores/slideGroups.ts` (delete `dismissReconciliation`) | store | CRUD | itself; `replaceGroupSlides` (KEEP, unrelated) | exact |
| `src/types/slideGroup.ts` (remove `dismissedSignature`) | model | — | itself | exact |
| `src/components/slides/slideDisplay.ts` (delete `PendingReconciliation`, `reconciliationConfirmCopy`) | utility | transform | itself; `deleteSlideConfirmBody` (KEEP, sibling confirm-copy fn, unaffected) | exact |
| `src/components/slides/SlideGrid.vue` (delete reconcile UI; add R054 gating) | component | request-response (drag/drop, CRUD) | itself, pre-phase; read-only gating → `songEditLink.ts` consumer in `EditSlideDrawer.vue` | exact (deletion) / role-match (gating) |
| `src/components/slides/SlidesTab.vue` (drop prop passthrough) | component | request-response | itself | exact |
| `src/views/ServiceEditorView.vue` (drop wiring) | component/view | request-response | itself | exact |
| `src/components/slides/ReconcileConfirmModal.vue` | component | — | **DELETE** — see Phase 27 deletion precedent below | n/a (deletion) |
| `src/utils/slideshowAssembler.ts` (SCRIPTURE content-resolution) | utility | transform | itself (`resolveSlideContent`, scripture case) | exact |
| `src/components/slides/EditSlideDrawer.vue` (R054 gating + read-only affordance) | component | request-response | `songEditLink.ts` + its `SongSlideOver.vue`/`SongsView.vue` consumers | role-match |
| `src/utils/__tests__/slideGroupMaterializer.test.ts` (new property test) | test | transform | **no precedent** — see below | none |
| `src/components/slides/__tests__/EditSlideDrawer.test.ts` (`mountDrawer()` default change) | test | request-response | itself (`mountDrawer` factory, line 192) | exact |
| 8 test files total per R048 | test | — | themselves, pre-phase | exact |

## Pattern Assignments

### 1. Idempotent rebuild — positional-consumption precedent (`reconcileSongGroup`)

**Source:** `src/utils/slideGroupMaterializer.ts:238-390` (function `reconcileSongGroup`, to be renamed
`rebuildSongGroup`)

This is the load-bearing precedent for the *entire* generalized rebuild (SONG, SCRIPTURE, IMPORTED).
Preserve its shape exactly when writing the SCRIPTURE/IMPORTED equivalent and when stripping the
song-swap confirm branch.

**The 26-09 Map-keying defect it must not regress** (comment at lines 278-288):
Stored lyric entries were once indexed into a `Map<sectionId, GroupSlideEntry>` — one entry per key.
Because the panel's Duplicate action can create a *second* stored entry for the same `sectionId`, a
plain map silently dropped the duplicate the next time the song's sections changed (no confirm gate
on this path, so the loss was silent). **Fix kept today:** index into `Map<sectionId, GroupSlideEntry[]>`
(line 304-312) — an array per key, never collapsed.

**The 28-03 compounding bug it must not regress** (comment at lines 289-303, code at 338-356):
Before the fix, every *occurrence* of a repeated section id in `freshOrder` re-emitted the WHOLE
stored array for that key — so a twice-referenced chorus with 2 stored entries produced 4, then 8,
then 16 entries across repeated reconciliation passes (this happened on the *additive*, non-confirm
path — exactly the path every write becomes in Phase 30). **Fix kept today:** consume stored entries
*positionally* — occurrence `i` of a section consumes `stored[i]`; per-key surplus (`stored.length >
occurrenceCount`) is emitted once, immediately after that section's LAST occurrence, never re-emitted
on subsequent occurrences. Concrete mechanism (copy this shape verbatim for the generalized version):

```typescript
// slideGroupMaterializer.ts:332-356
const occurrenceTotals = new Map<string, number>()
for (const sectionId of freshOrder) {
  occurrenceTotals.set(sectionId, (occurrenceTotals.get(sectionId) ?? 0) + 1)
}
const occurrencesSeen = new Map<string, number>()

for (const sectionId of freshOrder) {
  const stored = storedBySectionId.get(sectionId)
  const occurrenceIndex = occurrencesSeen.get(sectionId) ?? 0
  occurrencesSeen.set(sectionId, occurrenceIndex + 1)

  if (stored && occurrenceIndex < stored.length) {
    merged.push({ ...stored[occurrenceIndex]!, order: order++ })
  } else {
    merged.push({ id: crypto.randomUUID(), order: order++, sourceRef: { kind: 'lyric', songId, sectionId } })
  }

  const totalOccurrences = occurrenceTotals.get(sectionId)!
  const isLastOccurrence = occurrenceIndex + 1 === totalOccurrences
  if (isLastOccurrence && stored && stored.length > totalOccurrences) {
    for (let surplusIndex = totalOccurrences; surplusIndex < stored.length; surplusIndex++) {
      merged.push({ ...stored[surplusIndex]!, order: order++ })
    }
  }
}
```

**Idempotence proof shape:** running this twice with the same fresh order and the just-written
`group.slides` reproduces `occurrenceIndex < stored.length` for every occurrence (counts now match
exactly), so no new entries are minted and no surplus branch fires — byte-identical output. Any new
SCRIPTURE/IMPORTED rebuild function must have the same "re-run with own output as input → no-op"
property, asserted directly (this is what CONTEXT.md's idempotence requirement demands be *tested*,
not just designed-in).

**Non-derivable-entry carry-through** (lines 366+, `isNonDerivableEntry` at lines 176-181):
```typescript
function isNonDerivableEntry(entry: GroupSlideEntry): boolean {
  const ref = entry.sourceRef
  if (ref.kind === 'video') return true
  if (ref.kind === 'text' && (ref.title !== undefined || ref.body !== undefined)) return true
  return false
}
```
This predicate is the exact reuse point for generalizing to SCRIPTURE/IMPORTED (30-RESEARCH.md
Pattern 1's `survivingEntries()` helper). **Keep this function verbatim** — it is not being deleted,
only `hasCustomization` (lines 193-198, the confirm-gate consumer) and `computeLoss` (414-427, confirm
UI's loss-summary consumer) go away. Do not touch `isNonDerivableEntry` itself.

### 2. SONG's current non-derivable-entry preservation, to generalize

**Source:** `src/utils/slideGroupMaterializer.ts:366-390` (region following the positional merge)

Today, after the positional lyric/copyright merge and the "retained-but-unresolvable" pass (lines
358-364), any stored entry whose `sourceRef.kind` is neither `lyric` nor `copyright` (i.e. `video` or
authored `text`) is carried through by value, in stored relative order, appended before the trailing
copyright entry. This is currently SONG-only because only `reconcileSongGroup` has this final pass;
`reconcileUnstableIdGroup` (the SCRIPTURE/IMPORTED reconciler) instead gates the entire replace behind
`hasCustomization` — protecting non-derivable entries by *stalling*, not by *splicing*.

**Generalization target (30-RESEARCH.md Pattern 1, already designed there):** extract a shared
`survivingEntries(group) => group.slides.filter(isNonDerivableEntry)` helper; call it from both the
SONG rebuild (splice before the trailing copyright, matching where SONG already puts its own last
entry) and the new unconditional SCRIPTURE/IMPORTED rebuild (append after the fresh derived entries).
This is the phase's single highest-risk change — write the Wave-0 test first (drop a video into a
SCRIPTURE/IMPORTED group, change the passage/re-import, assert the video survives) since this
scenario is *currently impossible to trigger* (the confirm gate always intercepts it) and therefore
has zero existing test coverage to regress-check against.

### 3. Subsystem-deletion precedent — Phase 27's commit sequencing

**Source:** git log, Phase 27 (`ImportedSlideEditor`, `SlotMediaAttachment`, `SlideshowPreview` removed)

Verified commit sequence for each of the three deletions in Phase 27 (`git log --oneline`):
```
36f4161 chore(27-04): delete the orphaned SlotMediaAttachment component (D-02, D-19)
dcdf203 feat(27-04): unmount the group-bed media control from the Service Order tab
2defeab docs(27-04): complete strip slot media attachment plan

4e6217c chore(27-03): delete the orphaned ImportedSlideEditor component (D-02, D-19)
b69e374 feat(27-03): strip deck editor and import surfaces from Service Order tab
1f26906 test(27-03): assert deck-editing and deck-import surfaces are absent
2739062 docs(27-03): complete strip deck editing and deck import plan

4f63099 docs(27-05): complete strip slideshow preview and relocate present plan
64b5aaa feat(27-05): move Present CTA to Slides tab, strip SlideshowPreview (D-05)
2739062 test(27-05): probe the Service Order panel by its own seam, not SlideshowPreview
```
**The sequencing pattern to replicate for Phase 30 (same shape, larger scale):**
1. `test`: add/update assertions that the surface being removed is *absent* (not skipped) —
   written or updated in the same wave as the strip, testing the seam that survives.
2. `feat`: strip the usage/wiring from every consuming component first (props, imports,
   template blocks, computed values) — this is what makes the component provably orphaned.
3. `chore`: delete the now-orphaned file itself, citing the design decisions that justify it
   (Phase 27 cited `D-02, D-19`; Phase 30 should cite its own CONTEXT.md decision language, e.g.
   "greenfield, never deployed" for the `dismissedSignature` leave-in-place decision).
4. `docs`: mark the plan complete.

**Verification method Phase 27 relied on (matches CONTEXT.md's "prove removal by grep" requirement
for Phase 30):** each `chore` deletion commit is preceded by a `feat` that removes every reference,
so the deletion itself compiles clean — i.e., the reviewer traced every load-bearing import/prop/
template reference to zero before deleting the file, not after. Apply the same order for Phase 30's
10-file surface: strip `useSlideshowAssembly.ts`'s `PendingReconciliation`/`pendingReconciliationsMap`
wiring and every downstream prop passthrough (`SlideGrid.vue`, `SlidesTab.vue`,
`ServiceEditorView.vue`) FIRST, then delete `ReconcileConfirmModal.vue` and its test, then run the
full symbol grep from 30-RESEARCH.md's Pitfall 1 (the widened list: `pendingReconciliations`,
`PendingReconciliation`, `hasCustomization`, `isNonDerivableEntry` [excluded — kept], `computeLoss`,
in addition to the narrower original list) as the final gate.

### 4. Read-only affordance precedent — `songEditLink.ts`

**Source:** `src/utils/songEditLink.ts` (full file, 96 lines)

This is a pure, framework-free module (no Vue/router imports by design, per its own header comment)
that builds/parses/clears a query-param convention for cross-navigating from a read-only view into
the real editor (`SongSlideOver.vue` via `SongsView.vue`'s `?edit=<songId>&tab=<lyrics|details>`
convention). Consumers today: `EditSlideDrawer.vue`, `SongSlideOver.vue`, `SongsView.vue`.

```typescript
// songEditLink.ts:47-55 — the piece EditSlideDrawer.vue already calls to build the "Edit in song" link
export function buildSongEditLink(songId: string, tab: SongEditTab): SongEditRouteLocation {
  return {
    name: 'songs',
    query: {
      [SONG_QUERY_KEY]: songId,
      [TAB_QUERY_KEY]: tab,
    },
  }
}
```

**What to copy for R054's read-only affordance:** the *pattern*, not new code in this module — this
module already exists and already works (per 30-RESEARCH.md's R054 mutation-entry-point table,
`EditSlideDrawer.vue`'s "Edit in song" link at lines 114/131 is explicitly KEEP UNCHANGED). The new
work is composing this existing "redirect elsewhere" affordance with a *visible disabled-state
affordance* on the controls being removed — i.e., don't just delete the label/notes/audio/duplicate/
delete controls outright with `v-if`; the CONTEXT.md decision calls for a visible indicator ("reads as
deliberate rather than broken") alongside the existing link. No other component in this codebase
combines "controls removed" + "visible read-only banner" + "link elsewhere" as a single triad today —
this triad itself has **no exact analog**; `songEditLink.ts` only supplies the third leg. The other
two legs (hidden controls, visible banner) are ordinary `v-if`/Tailwind work with no special pattern
to copy — treat as new UI within this component, following UI-SPEC once written (per CONTEXT.md's
"Claude's Discretion").

### 5. Test-fixture default risk — `EditSlideDrawer.test.ts`'s `mountDrawer()`

**Source:** `src/components/slides/__tests__/EditSlideDrawer.test.ts:192-209`

```typescript
function mountDrawer(props: Partial<InstanceType<typeof EditSlideDrawer>['$props']> = {}) {
  const entry = 'entry' in props ? props.entry : makeEntry({ id: 'entry-1' })
  return mount(EditSlideDrawer, {
    props: {
      open: true,
      entry: entry ?? null,
      group: makeGroup({ slides: entry ? [entry] : [] }),
      planItem: makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songTitle: 'This Is Our God' } as never),
      assembledSlide: makeAssembled(),
      position: 3,
      total: 6,
      orgId: 'org-1',
      serviceId: 'service-1',
      isEditor: true,
      ...props,
    },
  })
}
```

**Least-churn fix (confirmed structurally sound):** the factory already spreads `...props` last, so
any individual call site that needs `kind: 'SONG'` can pass `{ planItem: makeSlot({ kind: 'SONG', ... }) }`
as an override with zero change to the factory's call signature. The single-line fix is changing the
hardcoded default's `kind: 'SONG'` to a non-SONG kind (e.g. `'MESSAGE'` or `'PRAYER'`, matching
30-RESEARCH.md's Pitfall 3 recommendation) in this one function body — this repoints all 93 call
sites' *default* behavior in one edit, and the 1 call site (of 93) that already overrides `planItem`
is unaffected because its own override still wins via the trailing spread. Then add ONE new
`describe('R054 — song groups are read-only', …)` block whose `mountDrawer({ planItem: makeSlot({ kind:
'SONG', ... }) })` calls explicitly opt back into SONG to assert controls are ABSENT. This is a
1-line production-fixture edit + 1 new describe block, not a 92-call-site rewrite — confirm this
still holds by grepping the file for other hardcoded `kind: 'SONG'` literals outside `mountDrawer()`
before treating the fix as complete (a handful of call sites may construct `planItem` inline rather
than via the factory's default; check for those too).

### 6. Property-test precedent

**No precedent exists in this codebase.** Grep for `permutation|shuffle|fast-check|property.test`
across `src/` returns no property/permutation-style test file and no installed property-testing
library (`fast-check` is not in `package.json`). Every existing test in `slideGroupMaterializer.test.ts`
and elsewhere is example-based (`describe`/`it` with hand-picked fixtures, per TESTING.md's documented
conventions — no snapshot testing, no generative testing anywhere in this repo).

**This phase establishes the pattern**, not extends one. Per 30-RESEARCH.md's "Don't Hand-Roll"
section, the recommended shape is a manual N=50 shuffle loop (Fisher-Yates or similar) over a fixed
slot array inside one `it()`, asserting "group sequence equals slot sequence" on each shuffle — no new
dependency, consistent with this codebase's existing "Iterating Over Test Cases" convention
(TESTING.md, `testCases.forEach(...)` pattern) generalized to a generated rather than hand-written
case list. Do not introduce `fast-check` or any other property-testing library for this single,
narrow-domain invariant.

### 7. Phase 29 carry-over (order/membership lock is mostly free)

**Source:** `src/utils/slotTypes.ts` (`groupBySection`, `flattenBySection`, `orderSlotsBySection`) and
`ServiceSlot.id` (Phase 24 D-01, stable per-slot identity)

No new locking mechanism should be added — `service.slots`' own section-major array order (Phase 29)
is already the single source of truth for R045's ordering half; `SlidePlanRail.vue` already renders
`props.slots` in raw array order with no re-sort (confirmed by grep, `SlidePlanRail.vue:82-89, 111`).
The property test in item 6 above is *proof*, not a new mechanism — do not add a `SlideGroup.order`
field. Membership-half cascade delete already has exactly one call site
(`ServiceEditorView.vue:2016-2026`, `slideGroupsStore.deleteGroup(orgId, slotId)`) — verify it still
passes unmodified; do not add a second cascade path.

## Shared Patterns

### Error handling / logging
**Source:** CONVENTIONS.md — `console.error('[moduleName] functionName failed:', err)`, module name in
brackets. `slideGroupMaterializer.ts` is a pure-function module with no try/catch (per convention,
"pure functions don't need try/catch") — the rebuild functions being written/edited should remain
pure and throw nothing; callers (`useSlideshowAssembly.ts`) own any error boundary.

### Vue component read-only gating
**Source:** existing `v-if="isEditor"` gates throughout `SlideGrid.vue`/`EditSlideDrawer.vue`
(enumerated exhaustively in 30-RESEARCH.md Code Examples §2). Apply the identical `v-if` idiom with an
added `&& !isSongGroup` (or an equivalent `canMutateGroup` computed) — do not introduce a new gating
mechanism (e.g. a directive or wrapper component) for this phase; every other read-only lock in this
codebase is a plain template `v-if`.

### Test structure
**Source:** TESTING.md — nested `describe`/`it`, `.test.ts` in parallel `__tests__/`, no snapshot
testing. All 8 test files in this phase's inventory follow this shape already; new `describe` blocks
(R054 read-only, the property test, the survival test) should nest under the existing top-level
`describe` for their file rather than create new top-level files.

## No Analog Found

| File / Change | Role | Data Flow | Reason |
|---|---|---|---|
| Property/permutation test for R045 (`slideGroupMaterializer.test.ts`) | test | transform | No property-testing style exists anywhere in this codebase; this phase establishes it (manual shuffle loop, no new dependency — see item 6 above). |
| Combined "hidden controls + visible read-only banner + edit-elsewhere link" UI triad in `EditSlideDrawer.vue` | component | request-response | `songEditLink.ts` supplies only the link leg; no existing component in this codebase pairs a visible read-only banner with redirect-elsewhere affordance. Follow UI-SPEC once written (CONTEXT.md's explicit discretion). |

## Metadata

**Analog search scope:** `src/utils/`, `src/composables/`, `src/stores/`, `src/components/slides/`,
`src/views/`, plus `git log` for Phase 27 commit sequencing.
**Files scanned:** `slideGroupMaterializer.ts` (full + targeted reads), `songEditLink.ts` (full),
`EditSlideDrawer.test.ts` (mountDrawer + surrounding describe), Phase 27 commit history (13 commits).
**Pattern extraction date:** 2026-07-28
