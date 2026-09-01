# 0122. Check for an inflight save BEFORE clearing the debounce timer, not

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useAutoSave.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-02: check for an inflight save BEFORE clearing the debounce timer, not after.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-02`):

**`src/composables/useAutoSave.ts:133-141`:**

```
    // CR-02: check for an inflight save BEFORE clearing the debounce timer,
    // not after. A newer mutation can have set status back to 'pending' and
    // armed its own follow-up timer while a PREVIOUS save is still in
    // flight; clearing the timer unconditionally here — as this used to —
    // destroys that follow-up timer, and then the `if (saving) return`
    // below no-ops without ever performing a save. The edit becomes
    // unreachable: no timer is armed, and this call already returned. By
    // returning here first, the already-armed timer survives to retry the
    // edit on its own schedule once the inflight save clears `saving`.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useAutoSave.ts:133-141`
