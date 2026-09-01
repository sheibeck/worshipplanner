# 0203. IMPORTED slots reference PPTX/image decks with no analogous PC item

## Status

Accepted

## Context

This rationale is applied at 4 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

IMPORTED slots reference PPTX/image decks with no analogous PC item type; skip export entirely rather than falling through addSlotAsItem's default MESSAGE-item branch and mislabeling it (RESEARCH Pitfall 2) — no (slot as...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/ServiceEditorView.vue:1422-1422`:**

```
          <!-- Non-editor: no roster/quarters data was ever subscribed to (Pitfall 4) — read-only note only -->
```

**`src/views/ServiceEditorView.vue:1668-1668`:**

```
             row now does that job directly (Anti-Patterns / Pitfall 4). -->
```

**`src/views/ServiceEditorView.vue:4120-4126`:**

```

    // Collect our songs (SONG + HYMN) and scriptures from service slots.
    // IMPORTED slots (Phase 21) have no analogous PC item type and are
    // intentionally excluded from both buckets below — the 'existing plan'
    // branch below only ever touches songSlots/scriptureSlots (same as
    // PRAYER/MESSAGE), so IMPORTED is already skipped there without further
    // (slot as any) narrowing (RESEARCH Pitfall 2).
```

**`src/views/ServiceEditorView.vue:4370-4374`:**

```
          // IMPORTED slots reference PPTX/image decks with no analogous PC item
          // type; skip export entirely rather than falling through
          // addSlotAsItem's default MESSAGE-item branch and mislabeling it
          // (RESEARCH Pitfall 2) — no (slot as any) narrowing needed here since
          // we skip before ever reaching the label-building catch block below.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:1422-1422`
- `src/views/ServiceEditorView.vue:1668-1668`
- `src/views/ServiceEditorView.vue:4120-4126`
- `src/views/ServiceEditorView.vue:4370-4374`
