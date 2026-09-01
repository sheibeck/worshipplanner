# 0066. Routed through the scriptureApi.ts dispatcher — the single

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/ScriptureSlideEditor.vue`. Documented at the time in `102-REVIEW`.

WR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher — the single client-side choke point (R297) — instead of calling fetchPassageText directly.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/ScriptureSlideEditor.vue:137-143`:**

```
    // WR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher — the
    // single client-side choke point (R297) — instead of calling
    // fetchPassageText directly. This component is currently unmounted
    // anywhere in the app, but leaving a direct esvApi call here would
    // silently reintroduce an ungated ESV proxy call the moment it's wired
    // into a view. Still ESV-only (pre-existing gap, out of this phase's
    // scope — no NLT dispatch existed here before either).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/ScriptureSlideEditor.vue:137-143`
