# 0060. ── Keyboard — bound on the viewer root only, never window/document

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/PresentationViewer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

── Keyboard — bound on the viewer root only, never window/document ────────── WR-06: the viewer is teleported to `document.body` and covers the viewport visually, but the rest of the app remains in the DOM behind it (hid...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-06`):

**`src/components/PresentationViewer.vue:310-321`:**

```

// ── Keyboard — bound on the viewer root only, never window/document ──────────

/**
 * WR-06: the viewer is teleported to `document.body` and covers the
 * viewport visually, but the rest of the app remains in the DOM behind it
 * (hidden only visually, not removed) — without a focus trap, Tab could walk
 * keyboard focus straight past the viewer's own buttons into that
 * still-present app content. Queries only the viewer's own currently-enabled
 * focusable elements (prev/next are excluded via `:not([disabled])` when at
 * either end of the show).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/PresentationViewer.vue:310-321`
