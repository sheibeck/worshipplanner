# 0064. The refactor to status-branching dropped the generic catch, leaving

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 2 files: `src/components/CongregationalEditor.vue`, `src/components/ScriptureInput.vue`. Documented at the time in `102-REVIEW`.

WR-02 (102-REVIEW): the refactor to status-branching dropped the generic catch, leaving `stripVerseMarkers(result.text)` and the subsequent state writes with no safety net — an exception there previously set fetchError;...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/CongregationalEditor.vue:295-300`:**

```
    // WR-02 (102-REVIEW): the refactor to status-branching dropped the
    // generic catch, leaving `stripVerseMarkers(result.text)` and the
    // subsequent state writes with no safety net — an exception there
    // previously set fetchError; it would otherwise now become an unhandled
    // rejection. The dispatcher itself never throws, but this restores the
    // documented "anything in here degrades gracefully" contract.
```

**`src/components/ScriptureInput.vue:452-457`:**

```
    // WR-02 (102-REVIEW): defensive safety net restored. The dispatcher
    // itself never throws (its own errors map to `{status:'error'}` above),
    // but this still protects against an exception anywhere else in the try
    // block (e.g. `useAuthStore()` inside the dispatcher, or future
    // post-fetch processing) degrading gracefully instead of becoming an
    // unhandled rejection.
```

**`src/components/ScriptureInput.vue:549-550`:**

```
    // WR-02 (102-REVIEW): defensive safety net restored — see fetchPreview
    // above for the full rationale.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/CongregationalEditor.vue:295-300`
- `src/components/ScriptureInput.vue:452-457`
- `src/components/ScriptureInput.vue:549-550`
