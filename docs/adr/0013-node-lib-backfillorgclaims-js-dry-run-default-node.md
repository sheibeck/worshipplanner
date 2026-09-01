# 0013. Node lib/backfillOrgClaims.js # dry run (default) node

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/backfillOrgClaims.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

node lib/backfillOrgClaims.js # dry run (default) node lib/backfillOrgClaims.js --apply # writes claims for real Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth application-default login`, exactly...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/backfillOrgClaims.ts:264-278`:**

```
//   node lib/backfillOrgClaims.js            # dry run (default)
//   node lib/backfillOrgClaims.js --apply    # writes claims for real
//
// Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`, exactly like any other Admin SDK script.
//
// WR-02: the whole body is wrapped in try/catch. The initial
// `getFirestore().collectionGroup('members').get()` inside backfillOrgMembershipClaims
// is NOT covered by that function's own per-uid try/catch (only the loop body is) --
// a rejection there (bad/expired credentials, wrong project, network failure) previously
// propagated out of this IIFE as a raw unhandled rejection instead of the script's own
// diagnostic output, with no process.exitCode set. The owner runs this by hand against
// production credentials, so a readable "aborted before processing any account" message
// plus a non-zero exit code mirrors the per-account failure reporting already present.
//
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/backfillOrgClaims.ts:264-278`
