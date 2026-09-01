# 0083. Exact, case-sensitive comparison (trim only, no lowercasing

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/DeleteOrgConfirmDialog.vue`. Documented at the time in `77-RESEARCH.md`.

Exact, case-sensitive comparison (trim only, no lowercasing -- 77-RESEARCH.md Assumption A1/Pitfall 3: "grace church" must NOT satisfy "Grace Church").

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-02`):

**`src/components/admin/DeleteOrgConfirmDialog.vue:138-147`:**

```

// Exact, case-sensitive comparison (trim only, no lowercasing --
// 77-RESEARCH.md Assumption A1/Pitfall 3: "grace church" must NOT satisfy
// "Grace Church"). Structurally disabled, not just visually -- there is no
// code path that can click through this button with a non-matching value.
// Trim BOTH sides so a stored org name with stray leading/trailing whitespace
// (not reachable via the onboarding UI today, but possible via a future/foreign
// write path) can still be confirmed — mirrors the server-side both-sides trim
// in orgDeletion.ts (77 WR-02), which would otherwise accept a value this
// button could never enable.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/DeleteOrgConfirmDialog.vue:138-147`
