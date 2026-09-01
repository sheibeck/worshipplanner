# 0152. (46-REVIEW.md) — eager-load the org's actual chosen slide face here

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. Documented at the time in `46-REVIEW.md, 46-UI-SPEC.md`.

CR-01 (46-REVIEW.md) — eager-load the org's actual chosen slide face here, the ONE point every render site's settings flow through.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, WR-03`):

**`src/stores/auth.ts:468-481`:**

```

    // CR-01 (46-REVIEW.md) — eager-load the org's actual chosen slide
    // face here, the ONE point every render site's settings flow
    // through. Without this, SlideGrid.vue and EditSlideDrawer.vue (the
    // grid and the Edit Slide drawer preview — soft-gate surfaces per
    // 46-UI-SPEC.md, font-display: swap) bind `--slide-font-family` to a
    // family whose @font-face rule was never registered, so the browser
    // silently falls through to its generic fallback instead of the
    // chosen font for any org whose choice differs from main.ts's eager
    // Inter default — until something ELSE (Settings, or the Presenter)
    // happens to load it first in that session. Fire-and-forget: a
    // rejected dynamic import degrades to the CSS stack's native
    // fallback, never a user-visible error (same posture as WR-03's
    // SettingsView.vue fix).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:468-481`
