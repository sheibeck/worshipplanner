# 0215. A genuinely failed dynamic import here would otherwise surface as an

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/SettingsView.vue`. Documented at the time in `46-REVIEW.md`.

WR-03 (46-REVIEW.md): a genuinely failed dynamic import here would otherwise surface as an unhandled promise rejection on every affected family switch.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/views/SettingsView.vue:1183-1188`:**

```
  // WR-03 (46-REVIEW.md): a genuinely failed dynamic import here would
  // otherwise surface as an unhandled promise rejection on every affected
  // family switch. Not user-visible either way — the preview box's native
  // CSS-stack fallback already covers a failed/missing asset — but every
  // other async handler in this file is careful to swallow non-fatal
  // failures rather than leave one loose.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/SettingsView.vue:1183-1188`
