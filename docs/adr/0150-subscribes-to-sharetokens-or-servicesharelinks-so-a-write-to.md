# 0150. Subscribes to shareTokens or serviceShareLinks, so a write to either

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/services.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

subscribes to `shareTokens` or `serviceShareLinks`, so a write to either has no path back into the editor's remote-merge watcher or autosave — PROVIDED this function itself never writes to `services/{docId}`, which it do...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-06`):

**`src/stores/services.ts:1023-1032`:**

```
   * subscribes to `shareTokens` or `serviceShareLinks`, so a write to either
   * has no path back into the editor's remote-merge watcher or autosave —
   * PROVIDED this function itself never writes to `services/{docId}`, which
   * it does not: it calls `writeSharePayload` only, never `updateDoc`/`setDoc`
   * against a services path.
   *
   * Never rejects — the whole body is one try/catch (WR-06 soft-fail,
   * mirroring `writeSharePayload`'s memorable-URL catch above). A share
   * problem must never fail the user's save.
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:1023-1032`
