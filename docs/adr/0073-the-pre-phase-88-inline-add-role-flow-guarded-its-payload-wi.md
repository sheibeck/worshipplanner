# 0073. The pre-Phase-88 inline "Add Role" flow guarded its payload with

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/RoleSlideOver.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01 (Phase 88 review): the pre-Phase-88 inline "Add Role" flow guarded its payload with `defaultCount: newRoleCount.value || 1`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/RoleSlideOver.vue:223-231`:**

```

// WR-01 (Phase 88 review): the pre-Phase-88 inline "Add Role" flow guarded its
// payload with `defaultCount: newRoleCount.value || 1`. Save here is a plain
// button (not a native form submit), so the input's `min="1"` never runs HTML5
// constraint validation — clearing the field leaves `form.value.defaultCount`
// as an empty string (v-model.number's looseToNumber falls back to the raw
// string when parseFloat is NaN), which would otherwise write straight to
// Firestore and corrupt scheduler auto-fill math. Coerce to a valid positive
// number, floored to 1 when empty/NaN/less than 1.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/RoleSlideOver.vue:223-231`
