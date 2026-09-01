# 0244. "Suggest All Songs" is a live AI entry point (calls

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/serviceEditorActionBar.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: "Suggest All Songs" is a live AI entry point (calls getSongSuggestions for every SONG slot) and must be hidden — not disabled — when the org has turned AI off, per the UI-SPEC's Hide-Don't-Disable Contract.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/serviceEditorActionBar.ts:256-259`:**

```
  // WR-01: "Suggest All Songs" is a live AI entry point (calls
  // getSongSuggestions for every SONG slot) and must be hidden — not
  // disabled — when the org has turned AI off, per the UI-SPEC's
  // Hide-Don't-Disable Contract.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/serviceEditorActionBar.ts:256-259`
