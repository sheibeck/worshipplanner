# 0115. PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useRunControl.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `WR-01, WR-02`):

**`src/composables/useRunControl.ts:280-286`:**

```
    // PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act. The
    // transport (arrows/Space) and blackout (B) keys are INERT — there is nothing
    // on the screens to navigate or black out before go-live, and an inert
    // pre-live keyboard complements WR-01's no-action-pre-live posture (a stray
    // keypress can no longer silently change what go-live will show). WR-02: Enter
    // fires the SAME go-live action as run-go-live-btn, wiring the "Press Enter to
    // go live" hint the pre-flight panel advertises.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:280-286`
