# 0235. Snapshot exactly what is about to be sent, so the "mark clean" step

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-01: snapshot exactly what is about to be sent, so the "mark clean" step below (after the WR-01 slots sync-back, which is also compared against `normalizedSlots`, not the pre-normalization value) can tell a genuinely-c...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, WR-01`):

**`src/views/ServiceEditorView.vue:4806-4810`:**

```
    // CR-01: snapshot exactly what is about to be sent, so the "mark clean"
    // step below (after the WR-01 slots sync-back, which is also compared
    // against `normalizedSlots`, not the pre-normalization value) can tell a
    // genuinely-concurrent edit — made to localService while this write is
    // in flight — from that intentional sync-back.
```

**`src/views/ServiceEditorView.vue:4813-4829`:**

```

    // WR-01: sync the just-persisted, normalized slot order back into
    // localService so display and persisted state agree in ORDER, not only
    // content — otherwise a legacy/corrupted document's first non-reorder
    // save silently reorders what's persisted without updating what's
    // displayed (self-heals on the next remote snapshot, but is a real,
    // avoidable mismatch until then).
    //
    // Guarded by reference equality against `data.slots` (captured before
    // any `await` above, including the scheduledSongIds loop and the write
    // itself): if something else reassigned `localService.value.slots` to a
    // NEW array during those awaits — most plausibly a reorder drag racing
    // this save, the same failure class CR-01 closed — the reference no
    // longer matches, and we must NOT clobber that newer, more current
    // array with this stale, pre-await snapshot. Skip the sync-back in that
    // case; the existing remote-merge watcher already reconciles any
    // resulting order mismatch on the next Firestore snapshot.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:4806-4810`
- `src/views/ServiceEditorView.vue:4813-4829`
