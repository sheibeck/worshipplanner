# 0166. The promise — a positional deck.slides[i] <-> rendered-page-i+1

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/importedRenderReconciler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

the promise — a positional `deck.slides[i]` <-> rendered-page-`i+1` pairing — because `mapAstToSlides` (pptxParser.ts) skips slides and emits one entry per image on a multi-image slide, so an index-based carry-forward wo...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/utils/importedRenderReconciler.ts:166-176`:**

```
 * the promise — a positional `deck.slides[i]` <-> rendered-page-`i+1` pairing
 * — because `mapAstToSlides` (pptxParser.ts) skips slides and emits one entry
 * per image on a multi-image slide, so an index-based carry-forward would
 * attach a user's note to the WRONG slide, which is worse than dropping it.
 * Neither `slideActionMenuItems` nor `EditSlideDrawer.vue` currently warns a
 * user that edits made while a deck's render is pending/failed will not
 * survive the transition to `ready` — see CR-01 for the follow-up options
 * (a render-stable identity scheme, or a UI warning) if this trade-off ever
 * needs revisiting. The returned array's length always equals
 * `resolution.entryCount`.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/importedRenderReconciler.ts:166-176`
