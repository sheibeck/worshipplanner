# 0213. ── Save action (Share URL slug, R-02/D-18)

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `src/views/SettingsView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

── Save action (Share URL slug, R-02/D-18) ──────────────────────────────────── Uniqueness always goes through claimSlug's create-only orgSlugs claim — never a raw updateDoc of organizations/{orgId}.slug alone.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `R-02`):

**`src/views/SettingsView.vue:37-38`:**

```

        <!-- Share URL slug field (R-02, D-18) -->
```

**`src/views/SettingsView.vue:621-623`:**

```

// ── Share URL slug state (R-02, D-18) ──────────────────────────────────────────
```

**`src/views/SettingsView.vue:900-904`:**

```

// ── Save action (Share URL slug, R-02/D-18) ────────────────────────────────────
// Uniqueness always goes through claimSlug's create-only orgSlugs claim — never a raw
// updateDoc of organizations/{orgId}.slug alone.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/SettingsView.vue:37-38`
- `src/views/SettingsView.vue:621-623`
- `src/views/SettingsView.vue:900-904`
