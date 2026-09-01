# 0239. ReminderDaysBefore MUST persist as a number — v-model.number already

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/SettingsView.vue`. Documented at the time in `58-RESEARCH.md`.

reminderDaysBefore MUST persist as a number — `v-model.number` already coerces the local ref, but the write itself re-wraps in Number(...) so a revert-on-error restores a real numeric prior value, never a stringified one...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/SettingsView.vue:1266-1270`:**

```

// reminderDaysBefore MUST persist as a number — `v-model.number` already coerces
// the local ref, but the write itself re-wraps in Number(...) so a revert-on-error
// restores a real numeric prior value, never a stringified one (58-RESEARCH.md
// Pitfall 5).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/SettingsView.vue:1266-1270`
