# 0067. Test-only seam (matches PptxImportModal.vue's existing defineExpose

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/ScriptureSlideEditor.vue`. Documented at the time in `32-REVIEW`.

Test-only seam (matches PptxImportModal.vue's existing defineExpose precedent and CongregationalEditor.vue's identical comment) — needed for the E4 `partial` backstop test.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/components/ScriptureSlideEditor.vue:256-268`:**

```

// Test-only seam (matches PptxImportModal.vue's existing defineExpose
// precedent and CongregationalEditor.vue's identical comment) — needed for
// the E4 `partial` backstop test.
//
// ★ WR-04 (32-REVIEW), CALL-SITE CONTRACT — same as CongregationalEditor.vue:
// `currentReadingId`/`surfaceId`/`referenceText`/`rawText`/`localSlides` are
// all captured/seeded ONCE at mount and are NOT reactive to `props.readingId`
// changing afterward. The caller MUST always mount this component with a
// `:key` tied to `readingId` — swapping the prop in place on a persistent
// instance is not supported and would silently misattribute saves to the
// wrong reading. See CongregationalEditor.vue's identical comment for why a
// partial (surfaceId-only) prop-watcher was considered and rejected.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/ScriptureSlideEditor.vue:256-268`
