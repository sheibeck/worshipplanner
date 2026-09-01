# 0133. ReconcileLoop() reads filmstrip.value.slides.length as a PLAIN

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useRunControl.ts`. Documented at the time in `106-REVIEW`.

106-REVIEW WR-01: reconcileLoop() reads filmstrip.value.slides.length as a PLAIN function call from the triggers above — none of which fire when the CURRENT item's assembled slide count changes for a reason other than na...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/composables/useRunControl.ts:1196-1204`:**

```
  // 106-REVIEW WR-01: reconcileLoop() reads filmstrip.value.slides.length as a
  // PLAIN function call from the triggers above — none of which fire when the
  // CURRENT item's assembled slide count changes for a reason other than
  // navigation (e.g. a PPTX/IMPORTED item's deck finishing its async render
  // mid-Run, growing a looping item from <=1 slide, which correctly did not
  // arm, past 1). Without this watch a looping item that starts short stays
  // silently disarmed until the operator happens to navigate. Watching the
  // slide count directly (not just currentSlotIndex/live) closes that gap in
  // both directions — arms as soon as a looping item becomes multi-slide, and
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:1196-1204`
