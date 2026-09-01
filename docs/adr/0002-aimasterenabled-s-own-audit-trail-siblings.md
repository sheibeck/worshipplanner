# 0002. AiMasterEnabled's own audit-trail siblings

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `firestore.rules`. Documented at the time in `82-REVIEW`.

WR-01 (82-REVIEW): aiMasterEnabled's own audit-trail siblings (aiEnabledAt/aiEnabledBy/aiDisabledAt/aiDisabledBy, written by setOrgAiEnabledHandler) must ride along in this same allow-list -- otherwise an ordinary editor...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`firestore.rules:133-140`:**

```
        // WR-01 (82-REVIEW): aiMasterEnabled's own audit-trail siblings
        // (aiEnabledAt/aiEnabledBy/aiDisabledAt/aiDisabledBy, written by
        // setOrgAiEnabledHandler) must ride along in this same allow-list --
        // otherwise an ordinary editor can forge them directly, the exact
        // T-76-06 audit-forgery class already closed for `active`'s siblings.
        // bibleApiEnabled's own audit siblings (bibleApiEnabledAt/By,
        // bibleApiDisabledAt/By, written by setOrgBibleEnabledHandler) ride
        // along here too, for the same reason (Phase 101, R295).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:133-140`
