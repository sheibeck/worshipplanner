# 0106. ConfirmDiscard() is instantiated below (unsavedGuard, Task 3), but

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/slides/EditSlideDrawer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-04: `confirmDiscard()` is instantiated below (`unsavedGuard`, Task 3), but this is the point where its ONLY still-real usage site is missing — every other consumer (AvailabilityDrawer.vue, RosterView.vue, SongSlideOve...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/components/slides/EditSlideDrawer.vue:638-647`:**

```

// WR-04: `confirmDiscard()` is instantiated below (`unsavedGuard`, Task 3),
// but this is the point where its ONLY still-real usage site is missing —
// every other consumer (AvailabilityDrawer.vue, RosterView.vue,
// SongSlideOver.vue) gates its own close handler on it. 33-09 deleted this
// drawer's in-body "Edit in song"/"Edit in scripture" links (and the guard
// check that used to gate them) without re-wiring the guard anywhere else,
// leaving `capture()` calls that fed a check nothing read. Restoring it here
// closes the gap for the × button and Escape; the menu-dispatched
// navigation path (`SlidesTab.vue`'s `onMenuAction`) is closed separately via
```

**`src/components/slides/EditSlideDrawer.vue:1518-1524`:**

```

// WR-04: exposes the unsaved-edit guard so `SlidesTab.vue`'s `onMenuAction`
// can gate the menu-dispatched "Edit in song"/"Edit in scripture"
// navigations on THIS drawer's own dirty state before routing away from it —
// the one navigation path this component itself no longer owns (33-09
// relocated it), so it cannot gate it internally the way `onClose`/
// `onKeydown` above do.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/EditSlideDrawer.vue:638-647`
- `src/components/slides/EditSlideDrawer.vue:1518-1524`
