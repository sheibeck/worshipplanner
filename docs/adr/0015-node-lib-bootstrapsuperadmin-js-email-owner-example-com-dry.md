# 0015. Node lib/bootstrapSuperAdmin.js --email owner@example.com # dry run

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/bootstrapSuperAdmin.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

node lib/bootstrapSuperAdmin.js --email owner@example.com # dry run (default) node lib/bootstrapSuperAdmin.js --email owner@example.com --apply # writes for real Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/bootstrapSuperAdmin.ts:103-116`:**

```
//   node lib/bootstrapSuperAdmin.js --email owner@example.com             # dry run (default)
//   node lib/bootstrapSuperAdmin.js --email owner@example.com --apply     # writes for real
//
// Credentials resolve from GOOGLE_APPLICATION_CREDENTIALS or
// `gcloud auth application-default login`, exactly like backfillOrgClaims.ts.
//
// The whole body is wrapped in try/catch, mirroring runBackfillCli's WR-02 --
// a rejection (bad/expired credentials, wrong project, unknown email, network
// failure) prints a readable diagnostic and sets a non-zero exit code instead
// of propagating as a raw unhandled rejection.
//
// Extracted into a named, exported function (mirrors runBackfillCli's own
// separation from its require.main guard) so this top-level error path is
// itself unit-testable without requiring require.main === module.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/bootstrapSuperAdmin.ts:103-116`
