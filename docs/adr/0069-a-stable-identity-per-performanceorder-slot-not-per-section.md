# 0069. A stable identity per performanceOrder SLOT (not per section id, not

## Status

Accepted

## Context

This rationale is applied at 5 call site(s) within `src/components/SongLyricEditor.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: a stable identity per `performanceOrder` SLOT (not per section id, not per position) — kept in lockstep with `editableState.performanceOrder` by every mutation below (drag reorder, duplicate, remove, add-section)....

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/SongLyricEditor.vue:480-489`:**

```

// WR-01: a stable identity per `performanceOrder` SLOT (not per section id,
// not per position) — kept in lockstep with `editableState.performanceOrder`
// by every mutation below (drag reorder, duplicate, remove, add-section).
// `buildSectionRows` exposes it as `SectionRow.stableKey`, which
// `expandedRowKeys` is keyed by instead of the positionally-derived
// `rowKey`, so a reorder can never silently reattach expand/collapse state
// to a different physical row. Component-local only — never persisted, so a
// document reload naturally starts expand state fresh (see the
// `currentLyrics` watcher below for the one case that must NOT reseed: our
```

**`src/components/SongLyricEditor.vue:599-606`:**

```

    // WR-01: only reseed slot ids when the order actually changed from what
    // is already held. This watcher re-fires after our OWN autosave writes
    // round-trip back through the Firestore subscription with an unchanged
    // order — reseeding unconditionally would silently collapse every
    // expanded row on every save. A genuinely different order (first load,
    // a different document, or a load-time repair) still reseeds, which is
    // correct: those rows are not the ones the user had open.
```

**`src/components/SongLyricEditor.vue:706-712`:**

```

// Duplicate/Remove/Add-section all mutate through 28-01's pure helpers —
// no ordering or pool logic is re-implemented here. Each mirrors its
// performanceOrder splice onto `orderSlotIds` at the same index, so
// `SectionRow.stableKey` (and therefore expand/collapse state) tracks the
// physical row rather than its position (WR-01).
```

**`src/components/SongLyricEditor.vue:829-831`:**

```
          // Mirror the same move on the stable-id array (WR-01) — `moveRow`
          // is a generic index-based splice, agnostic to what the array
          // holds, so it applies unchanged here.
```

**`src/components/SongLyricEditor.vue:846-848`:**

```
  // WR-01: keyed by the row's stable, order-slot-derived identity, not the
  // positionally-derived `rowKey`, so a reorder/duplicate/remove can never
  // silently reattach expand state to a different physical row.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/SongLyricEditor.vue:480-489`
- `src/components/SongLyricEditor.vue:599-606`
- `src/components/SongLyricEditor.vue:706-712`
- `src/components/SongLyricEditor.vue:829-831`
- `src/components/SongLyricEditor.vue:846-848`
