# 0202. Fix: do NOT restore a closure-captured pre-drag snapshot here

## Status

Accepted

## Context

This rationale is applied at 4 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-01 fix: do NOT restore a closure-captured pre-drag snapshot here.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/views/ServiceEditorView.vue:1414-1415`:**

```

        <!-- Roles tab: seeded from the quarterly schedule for this service's date, editor-only data (CR-01/02/03/05) -->
```

**`src/views/ServiceEditorView.vue:2602-2610`:**

```
    // CR-01 fix: do NOT restore a closure-captured pre-drag snapshot here.
    // SortableJS calls `onEnd` fire-and-forget (never awaited), so a second,
    // faster drag can start — and its write can succeed and persist — before
    // THIS drag's write settles. A stale pre-drag snapshot would then discard
    // that already-persisted second edit from local state, and because the
    // revert makes `localService` differ from `originalService` again, the
    // general 800ms debounce watcher would treat it as a new unsaved change
    // and silently re-write the stale array back over the successful edit.
    //
```

**`src/views/ServiceEditorView.vue:2614-2620`:**

```
    // (today's simple case, unchanged). If a later drag/save already
    // succeeded, `originalService` already reflects it (every successful
    // write sets `originalService.value = clone(localService.value)`), so
    // this revert becomes a no-op against that newer state instead of
    // clobbering it — and because local now matches original exactly, the
    // debounce watcher's `isDirty` check is false, so it never re-arms and
    // never re-persists the reverted array (T-29-09 / CR-01).
```

**`src/views/ServiceEditorView.vue:4833-4844`:**

```

    // Mark current local state as clean (don't overwrite localService — user
    // may still be typing) — but ONLY if it still matches exactly what was
    // just persisted above. CR-01: a distinct mutation made to localService
    // while the write was in flight (e.g. a different field edited between
    // the snapshot above and this line resolving) must NOT be marked clean
    // against a payload that never included it — doing so silently and
    // permanently drops that edit, because the next debounce timer's own
    // `isDirty` re-check would then see nothing to save. Leaving
    // originalService untouched in that case keeps isDirty accurately true,
    // so the still-armed follow-up timer performs a real save carrying the
    // concurrent edit instead of a false-positive no-op.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:1414-1415`
- `src/views/ServiceEditorView.vue:2602-2610`
- `src/views/ServiceEditorView.vue:2614-2620`
- `src/views/ServiceEditorView.vue:4833-4844`
