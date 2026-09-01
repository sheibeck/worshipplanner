# 0091. ── Draft state (Pitfall #3 — critical)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/settings/ServiceTemplateEditor.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

── Draft state (Pitfall #3 — critical) ───────────────────────────────────── Cloned fresh from the store every time the drawer opens.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/settings/ServiceTemplateEditor.vue:322-328`:**

```

// ── Draft state (Pitfall #3 — critical) ─────────────────────────────────────
// Cloned fresh from the store every time the drawer opens. Every mutation below
// (add/remove/reorder/section-change/reset) touches ONLY this local array —
// nothing reaches Firestore or the store until Save Template is clicked. This
// is what keeps a draft edit from mutating DEFAULT_ORG_SETTINGS's shared array
// instance in place for every org that has never configured a template.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/settings/ServiceTemplateEditor.vue:322-328`
