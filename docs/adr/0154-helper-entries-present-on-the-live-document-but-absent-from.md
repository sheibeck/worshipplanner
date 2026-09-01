# 0154. Helper: entries present on the LIVE document but absent from both the

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/stores/slideGroups.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-02 helper: entries present on the LIVE document but absent from both the caller's own snapshot (`base`) and its computed payload (`next`) were added by a concurrent write that landed after `base` was read — append the...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-02`):

**`src/stores/slideGroups.ts:261-275`:**

```
  /**
   * The apply half of reconciliation — writes only `slides`/`sourceSignature`/
   * `updatedAt`, never a bed field. The decision of WHETHER to apply a
   * reconciled slide list lives in 24-03's pure functions and 24-05's
   * composable, never here.
   *
   * CR-02: every call site (add-slide, import, video-append, drag-reorder in
   * `SlideGrid.vue`, and the reconciliation watcher in
   * `useSlideshowAssembly.ts`) reads a LOCAL snapshot of the group's current
   * `entries`/`slides` BEFORE computing its own next `slides` array, with no
   * shared in-process lock across those independent call sites. A plain
   * `updateDoc` here is therefore a last-write-wins race — a fast
   * double-click on "+ Add slide", or an append racing a drag-reorder, would
   * silently discard whichever write lands first.
   *
```

**`src/stores/slideGroups.ts:355-373`:**

```

  /**
   * CR-02 helper: entries present on the LIVE document but absent from both
   * the caller's own snapshot (`base`) and its computed payload (`next`) were
   * added by a concurrent write that landed after `base` was read — append
   * them rather than let `next`'s write silently erase them. Reassigns
   * `order` to trail whatever `next` already contains so the recovered
   * entries sort after it; ids are never regenerated (invariant 2,
   * `slideGroup.ts`).
   *
   * CR-02 fix: this function must ALSO recognize a concurrent *deletion*, not
   * just a concurrent addition. `next` is always derived from `base`
   * (`base.map(...)` / `base.filter(...)`), so a caller whose own write has
   * nothing to do with a given entry still carries that entry in `next`
   * (present in both `base` and `next`) even after a different writer has
   * since deleted it (absent from `live`). Left unchecked, this caller's
   * commit would resurrect the deleted entry. An entry present in `base` AND
   * still present in `next` (this caller did not itself intend to remove it)
   * but MISSING from `live` (a concurrent writer's delete already landed) is
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/slideGroups.ts:261-275`
- `src/stores/slideGroups.ts:355-373`
