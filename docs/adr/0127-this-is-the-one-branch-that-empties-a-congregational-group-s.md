# 0127. This is the one branch that empties a Congregational group's section

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 2 files: `src/composables/useSlideshowAssembly.ts`, `src/utils/slideGroupMaterializer.ts`. Documented at the time in `38-REVIEW`.

38-REVIEW CR-01: this is the one branch that empties a Congregational group's section entries via a reference clear, where the freshly computed `sourceSignature(slot, inputs)` is `undefined` because there is no reference...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/composables/useSlideshowAssembly.ts:725-737`:**

```
    /**
     * Precomputed here (synchronously, inside the tracked computed) rather
     * than re-derived in the async apply step.
     *
     * 38-REVIEW CR-01: `undefined` means "no opinion, leave the stored
     * signature alone"; `null` means "explicitly clear it." `result.sourceSignature`
     * (set only by `rebuildScriptureGroup`'s CLEARED REFERENCE branch) takes
     * precedence over the ordinary recomputed `sourceSignature(slot, inputs)`
     * when present, because that branch's freshly-computed signature is
     * `undefined` for the wrong reason (no reference to sign, not "no
     * opinion") and would otherwise leave a stale value stored via
     * `stripUndefined`.
     */
```

**`src/utils/slideGroupMaterializer.ts:769-781`:**

```

/**
 * Two-field result shape shared by every `rebuild*Group` function, dispatched via {@link rebuildGroup}. Phase 30 deleted the old six-field confirm-shaped result along with the confirm gate itself — every rebuild now decides and writes unconditionally.
 *
 * 38-REVIEW CR-01: `sourceSignature` is an OPTIONAL third field, read only by
 * the composable's write step (`useSlideshowAssembly.ts`) when present.
 * `undefined` (the field simply absent, the default for every branch except
 * the one below) means "no opinion — the composable's own freshly-recomputed
 * signature governs, exactly as before this field existed." An explicit
 * `null` means "clear the stored signature," which the composable and
 * `replaceGroupSlides` must turn into a real Firestore `deleteField()`, not
 * an omitted key — `stripUndefined` treats an omitted key and `undefined` as
 * "no change," which cannot express "remove this," the same distinction
```

**`src/utils/slideGroupMaterializer.ts:912-920`:**

```
      // 38-REVIEW CR-01: this is the one branch that empties a Congregational
      // group's section entries via a reference clear, where the freshly
      // computed `sourceSignature(slot, inputs)` is `undefined` because there
      // is no reference left to sign — NOT because there is "no opinion."
      // Without an explicit `sourceSignature: null` here, the write path's
      // `stripUndefined` would leave the group's stale congregational
      // signature stored, and a later re-entry of the identical reading would
      // hit the DETACHED short-circuit above against a permanently-empty
      // `slides` array. See `RebuildResult`'s doc comment.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useSlideshowAssembly.ts:725-737`
- `src/utils/slideGroupMaterializer.ts:769-781`
- `src/utils/slideGroupMaterializer.ts:912-920`
