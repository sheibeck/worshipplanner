# 0137. ActiveSlideshowAssemblyInstances still includes THIS instance at this

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/composables/useSlideshowAssembly.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: `activeSlideshowAssemblyInstances` still includes THIS instance at this point (it decrements below), so > 1 here means at least one other instance is still live — the single-call-site assumption `unsubscribeAll()`...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/composables/useSlideshowAssembly.ts:189-190`:**

```

  // WR-02: see the module-level counter's doc comment above.
```

**`src/composables/useSlideshowAssembly.ts:858-863`:**

```

    // WR-02: `activeSlideshowAssemblyInstances` still includes THIS instance at this
    // point (it decrements below), so > 1 here means at least one other instance is
    // still live — the single-call-site assumption `unsubscribeAll()`'s teardown-of-
    // EVERY-listener behavior relies on is violated. Warn loudly rather than let this
    // instance's unmount silently kill another instance's still-open render listeners.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useSlideshowAssembly.ts:189-190`
- `src/composables/useSlideshowAssembly.ts:858-863`
