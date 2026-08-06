---
phase: 38-congregational-readings-become-real-slides
reviewed: 2026-08-05T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/types/slideGroup.ts
  - src/types/slide.ts
  - src/utils/scripture.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/slideshowAssembler.ts
  - src/components/PresentationViewer.vue
  - src/components/slides/slideDisplay.ts
  - src/components/slides/EditSlideDrawer.vue
  - src/utils/__tests__/scripture.test.ts
  - src/utils/__tests__/slideGroupMaterializer.test.ts
  - src/utils/__tests__/slideshowAssembler.test.ts
  - src/utils/__tests__/congregationalReadingPipeline.test.ts
  - src/utils/__tests__/congregationalDetachment.test.ts
  - src/components/__tests__/PresentationViewer.test.ts
  - src/components/slides/__tests__/slideDisplay.test.ts
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-08-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 38 adds a real two-state ("Reference" / "Congregational") detachment machine to
`rebuildScriptureGroup`, keyed on comparing the group's stored `sourceSignature` against a freshly
computed one. The pure-function layer (`deriveGroupEntries`, `sourceSignature`,
`carryStoredDerivedEntries`, `rebuildScriptureGroup` itself) is careful and well-tested — the
CONVERT / DELETE / EDIT / REORDER / RE-SPLIT / DESTROY-ON-REFERENCE-CHANGE / MIGRATION cases in
`congregationalDetachment.test.ts` and `slideGroupMaterializer.test.ts` all check out against the
actual implementation.

The one BLOCKER below is a gap at the boundary between the pure rebuild function and the write
path that persists its decision (`useSlideshowAssembly.ts` → `slideGroups.ts`'s
`replaceGroupSlides`). `sourceSignature` is now a **decision input**, not merely a stored
change-detector, but the write path still treats `undefined` as "no opinion, leave the stored
value alone" (via `stripUndefined`). The one branch of `rebuildScriptureGroup` that empties a
group's section entries (the reference cleared to `null`) is exactly the one case where the fresh
signature is `undefined` — so the group's stored `sourceSignature` survives the clear untouched. A
subsequent reference+sections re-entry that happens to reproduce the same signature string is then
misread as "already materialized," and the rebuild short-circuits over the group's now-empty
`slides` forever. This is a data-loss / stranding bug matching the phase's own stated risk area 1
("can a sequence of state transitions strand a group in a state that loses user content").

No other BLOCKER- or WARNING-grade defect was found in the reviewed files. The signature encoding
(risk area 2), the Phase-34 slot-driven migration path (risk area 3), the `SourceRef`/
`ServiceSlot.congregationalSections` two-field drift (risk area 4), and the
"reference change clears stored sections" rule (risk area 5) all hold up against direct code
tracing and are exercised correctly by the existing test suite — including under the exact
CLEARED-REFERENCE-with-a-surviving-video-entry case in both
`congregationalDetachment.test.ts` and `slideGroupMaterializer.test.ts`.

## Critical Issues

### CR-01: Clearing a congregational scripture reference leaves a stale `sourceSignature` on the group, which can later strand the group at zero slides after a re-conversion to the same reading

**File:** `src/utils/slideGroupMaterializer.ts:804-834` (`rebuildScriptureGroup`), in concert with
`src/utils/scripture.ts:181-182` (`sourceSignature`'s SCRIPTURE case) and
`src/stores/slideGroups.ts:304-332` (`replaceGroupSlides`) / `src/utils/stripUndefined.ts:12-28`

**Issue:**

`rebuildScriptureGroup`'s DETACHED short-circuit (lines 815-818) treats a group as "already
materialized from this exact reading" purely by string equality:

```ts
if (sections.length > 0) {
  if (group.sourceSignature !== undefined && group.sourceSignature === sourceSignature(slot, inputs)) {
    return { changed: false, slides: group.slides }   // <- returned UNCONDITIONALLY, even if slides is []
  }
  return rebuildUnstableIdGroup(group, slot, inputs)
}
```

The CLEARED REFERENCE branch a few lines down (lines 822-831) is the one path that empties a
Congregational group's section entries — reached when the slot's book/chapter are nulled out
(`onScriptureChange(index, null)` on the primary "Scripture Reading" input,
`src/views/ServiceEditorView.vue:981`, wired through `scriptureSlotAfterReferenceChange(slot,
null)`):

```ts
const hasReference = scriptureRefFromSlot(slot) !== null
if (!hasReference) {
  const hasSectionEntries = group.slides.some(...)
  if (hasSectionEntries) {
    const slides = renumbered(survivingEntries(group, slot))   // -> [] for a pure section group
    return { changed: !slidesEqual(slides, group.slides), slides }
  }
}
```

This branch returns `changed: true` with `slides: []`, but the `RebuildResult` shape carries only
`{ changed, slides }` — no `sourceSignature`. The caller (`useSlideshowAssembly.ts:456-471`)
separately recomputes what to write:

```ts
freshSignature: sourceSignature(slot, inputs),
```

For a slot with no reference, `sourceSignature`'s SCRIPTURE case returns `undefined`
(`scripture.ts:181-182`, `if (!scriptureRef) return undefined`). That `undefined` flows into
`replaceGroupSlides(orgId, slotId, [], undefined, group.slides)`
(`useSlideshowAssembly.ts:496-503`), which runs the payload through `stripUndefined` before the
Firestore write (`slideGroups.ts:314-315` / `327-329`):

```ts
tx.update(ref, { ...stripUndefined({ slides: merged, sourceSignature }), updatedAt: serverTimestamp() })
```

`stripUndefined` (`stripUndefined.ts:12-28`) drops any key whose value is `undefined` rather than
writing it — so the `sourceSignature` key is **omitted from the update entirely**, and Firestore
keeps whatever `sourceSignature` was already stored (the OLD congregational signature from before
the clear). `slides` is correctly emptied; `sourceSignature` is not.

**Concrete failure path** (traced against the real production functions, mirroring exactly what
`congregationalDetachment.test.ts`'s own `tick()` helper documents as the production write
contract):

1. A scripture slot is converted to Congregational with N sections (e.g. `THREE_SECTIONS`,
   `congregationalDetachment.test.ts:80-84`). The group detaches: `slides` = 3 section entries,
   `sourceSignature` = `SIG_A` (the reference + encoded sections).
2. The user clears the "Scripture Reading" reference entirely (`onScriptureChange(index, null)` →
   `scriptureSlotAfterReferenceChange(slot, null)`), which also clears
   `congregationalSections` on the slot. `rebuildScriptureGroup` hits the CLEARED REFERENCE branch:
   `slides` → `[]`, but `sourceSignature` stays `SIG_A` on the stored document (per the trace
   above — this exact scenario is tested at the pure-function level in
   `slideGroupMaterializer.test.ts:1841-1850` and `congregationalDetachment.test.ts:348-376`, but
   **only for `result.slides`/`result.changed`** — neither test (nor any other in the reviewed
   suite) asserts what the *composable* subsequently persists for `sourceSignature`, i.e. neither
   exercises the `undefined`-signature / `stripUndefined` interaction that actually reaches
   Firestore).
3. The user re-enters the reference **and re-adds sections whose content reproduces the exact same
   signature** — e.g. re-running the same deterministic ESV-fetch-and-split against the same
   passage, or simply retyping/pasting the same three sections (a highly plausible "undo my
   accidental clear" recovery). The slot is now content-identical to step 1.
4. `rebuildScriptureGroup` recomputes `sourceSignature(slot, inputs)`, which again equals `SIG_A`.
   The DETACHED check now compares `group.sourceSignature` (`SIG_A`, never actually cleared in
   step 2) against the freshly computed `SIG_A` — they match, so the function returns
   `{ changed: false, slides: group.slides }`, and `group.slides` is still `[]` from step 2.
5. The group is now permanently stuck at zero slides for this scripture item: every future rebuild
   tick recomputes the same matching signature and short-circuits over the empty array. The user
   sees no scripture slides at all for a reading they just configured, with no error and no
   affordance that explains it (short of deleting the group document directly in Firestore).

This is exactly the class of defect the phase's own doc comments warn against avoiding
(`slideGroup.ts:54-64`: "the ONE durable marker distinguishing... detached... from... not yet") —
the marker's write path has a hole that lets it go stale specifically on the one transition
(clear-to-null) that removes content without changing the signature.

Note the codebase already has an established pattern for "this value must actually be cleared, not
merely omitted" — `setGroupBedMedia`/`setGroupBackgroundMedia` in `src/stores/slideGroups.ts` use
an explicit boolean flag (`clearAudio`/`clearBackground`) paired with `deleteField()`
(`slideGroups.ts:183`, `238`) precisely because `stripUndefined` cannot distinguish "no opinion"
from "clear this." `sourceSignature`'s write path was not given the same treatment when Phase 38
turned it into a decision input.

**Fix:** Make the CLEARED REFERENCE branch's signature-clearing intent explicit rather than
relying on `undefined` to fall through `stripUndefined`. Two viable directions:

1. Widen `RebuildResult` to carry the intended stored `sourceSignature` (not just `slides`), so
   `rebuildScriptureGroup` can signal "clear it" distinctly from "leave it," and have
   `replaceGroupSlides` accept a tri-state (`string | null | undefined`) where `null` maps to
   `deleteField()`:

```ts
// slideGroupMaterializer.ts
export interface RebuildResult {
  changed: boolean
  slides: GroupSlideEntry[]
  /** undefined = no opinion (leave stored value); null = explicitly clear; string = set. */
  sourceSignature?: string | null
}
// ...in the CLEARED REFERENCE branch:
return { changed: !slidesEqual(slides, group.slides), slides, sourceSignature: null }
```

```ts
// slideGroups.ts replaceGroupSlides
async function replaceGroupSlides(
  orgId: string,
  slotId: string,
  slides: GroupSlideEntry[],
  sourceSignature?: string | null,
  baseSlides?: GroupSlideEntry[],
): Promise<void> {
  const signatureUpdate =
    sourceSignature === null ? deleteField() : sourceSignature === undefined ? undefined : sourceSignature
  // ...tx.update(ref, { ...stripUndefined({ slides: merged }), ...(signatureUpdate !== undefined ? { sourceSignature: signatureUpdate } : {}), updatedAt: serverTimestamp() })
}
```

2. Alternatively, keep `RebuildResult` as-is but have `useSlideshowAssembly.ts`'s outcome loop
   special-case "slides went from non-empty to empty for a SCRIPTURE slot with no reference" and
   force a `deleteField()` write for `sourceSignature` in that one case.

Either way, add a regression test at the composable/tick level (extending
`congregationalDetachment.test.ts`'s own `tick()` helper, which already documents this exact
contract in its doc comment) that runs CONVERT → CLEAR REFERENCE → RE-CONVERT WITH IDENTICAL
CONTENT and asserts the group ends up with 3 slides, not 0 — the missing case in the current suite.

---

_Reviewed: 2026-08-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
