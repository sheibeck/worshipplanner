# 0210. The pre-migration bottom-row button was :disabled="!localService ||

## Status

Accepted

## Context

This rationale is applied consistently at 2 call site(s) across 2 files: `src/views/serviceEditorActionBar.ts`, `src/views/ServiceEditorView.vue`. Documented at the time in `48-REVIEW`.

WR-01 (48-REVIEW): the pre-migration bottom-row button was `:disabled="!localService || isSharing"` — the `!localService` half is moot here (the whole action bar only mounts once localService is truthy), but `isSharing`...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/serviceEditorActionBar.ts:219-223`:**

```
    // WR-01 (48-REVIEW): the pre-migration bottom-row button was
    // `:disabled="!localService || isSharing"` — the `!localService` half is
    // moot here (the whole action bar only mounts once localService is
    // truthy), but `isSharing` must be preserved so a double-click can't fire
    // concurrent createShareToken writes while a share is in flight.
```

**`src/views/ServiceEditorView.vue:4466-4470`:**

```
  // WR-01 (48-REVIEW): re-entrancy guard — the action-bar button's own
  // `disabled: ctx.isSharing` is the primary defense, but this backstop
  // ensures a second concurrent invocation (e.g. a rapid double-click before
  // the disabled state re-renders) can never fire a second createShareToken
  // write while one is already in flight.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/serviceEditorActionBar.ts:219-223`
- `src/views/ServiceEditorView.vue:4466-4470`
