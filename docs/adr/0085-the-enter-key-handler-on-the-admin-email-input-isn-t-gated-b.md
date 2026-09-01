# 0085. The Enter-key handler on the admin-email input isn't gated by

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `src/components/admin/OrganizationsTab.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-03: the Enter-key handler on the admin-email input isn't gated by :disabled the way the submit button is, so a fast double-Enter could double-submit while a prior onboard call is still in flight.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/admin/OrganizationsTab.vue:489-493`:**

```
  // WR-03: the Enter-key handler on the admin-email input isn't gated by
  // :disabled the way the submit button is, so a fast double-Enter could
  // double-submit while a prior onboard call is still in flight. Guard here
  // (shared by both the click and keydown.enter triggers) to match the
  // button's :disabled="isOnboarding".
```

**`src/components/admin/OrganizationsTab.vue:545-546`:**

```
  // WR-03: same double-Enter guard as onOnboard -- the row's Enter-key
  // handler isn't gated by :disabled the way the Assign button is.
```

**`src/components/admin/OrganizationsTab.vue:593-593`:**

```
  // WR-03: same double-submit guard shape as isOnboarding/isAssigning above.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/OrganizationsTab.vue:489-493`
- `src/components/admin/OrganizationsTab.vue:545-546`
- `src/components/admin/OrganizationsTab.vue:593-593`
