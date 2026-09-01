# 0110. Optimal, and recorded as a decision rather than an oversight

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/SlideActionMenu.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

optimal, and recorded as a decision rather than an oversight. `@click.stop` on the trigger is the exact idiom `SlideCard.vue`'s drag grip already established: the click must never bubble to the card's own select handler,...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/slides/SlideActionMenu.vue:83-97`:**

```
 * optimal, and recorded as a decision rather than an oversight.
 *
 * `@click.stop` on the trigger is the exact idiom `SlideCard.vue`'s drag
 * grip already established: the click must never bubble to the card's own
 * select handler, so opening the menu never re-fires selection.
 *
 * WR-03: opening the panel moves focus onto its first `menuitem`. The
 * trigger `<button>` and the `role="menu"` panel `<div>` are DOM siblings,
 * not ancestor/descendant, and nothing previously moved focus into the
 * panel when `open` became `true` — so `onPanelKeydown`'s `Escape` handler
 * (bound to the panel's own `@keydown`) never received the event until the
 * user had separately tabbed focus into the panel. Focusing the first item
 * on open both fixes Escape and matches the WAI-ARIA menu-button pattern's
 * expectation that opening a menu moves focus onto it.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideActionMenu.vue:83-97`
