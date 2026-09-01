# 0100. Deliberately NO scrim, structurally ported from EditSlideDrawer.vue

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/settings/ServiceTemplateEditor.vue`. Documented at the time in `26-RESEARCH.md`.

Deliberately NO scrim, structurally ported from EditSlideDrawer.vue (26-RESEARCH.md Pitfall 7 / R033-era decision) — the settings page

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/settings/ServiceTemplateEditor.vue:3-4`:**

```
    <!-- Deliberately NO scrim, structurally ported from EditSlideDrawer.vue
         (26-RESEARCH.md Pitfall 7 / R033-era decision) — the settings page
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/settings/ServiceTemplateEditor.vue:3-4`
