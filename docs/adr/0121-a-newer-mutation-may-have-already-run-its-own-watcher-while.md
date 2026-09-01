# 0121. A newer mutation may have already run its own watcher while this save

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/composables/useAutoSave.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-01: a newer mutation may have already run its own watcher while this save was in flight, advancing status to 'pending' and arming its own follow-up timer.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/composables/useAutoSave.ts:86-94`:**

```
        // CR-01: a newer mutation may have already run its own watcher while
        // this save was in flight, advancing status to 'pending' and arming
        // its own follow-up timer. Don't stomp that back to 'saved' — doing
        // so lies about an edit that hasn't actually been persisted, and
        // (worse, for callers whose "is there anything left to save" check
        // is keyed off something other than this status) can make the
        // follow-up timer believe there's nothing left to do.
        //
        // The `as AutoSaveStatus` widen is required, not decorative: TS's
```

**`src/composables/useAutoSave.ts:159-161`:**

```
      // CR-01, mirrored from scheduleSave's success handler above (including
      // the `as AutoSaveStatus` widen — see that comment for why it's
      // required).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useAutoSave.ts:86-94`
- `src/composables/useAutoSave.ts:159-161`
