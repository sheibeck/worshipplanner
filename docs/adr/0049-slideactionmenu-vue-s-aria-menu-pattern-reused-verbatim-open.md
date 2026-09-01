# 0049. SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/AppSidebar.vue`. Documented at the time in `104-REVIEW`.

SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the panel moves focus to its first menuitem.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/AppSidebar.vue:240-249`:**

```

// SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the
// panel moves focus to its first menuitem.
//
// 104-REVIEW WR-03: the active-church row renders as a non-focusable
// `<div role="menuitem">` (no tabindex) — calling .focus() on it is a
// browser no-op. Since authStore.memberships lists the active org first more
// often than not, a plain `[role="menuitem"]` match frequently lands on that
// row and silently focuses nothing. Scope to the first FOCUSABLE menuitem
// (the `<button role="menuitem">` rows) instead.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/AppSidebar.vue:240-249`
