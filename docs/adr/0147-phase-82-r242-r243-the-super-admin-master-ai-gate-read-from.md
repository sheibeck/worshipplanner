# 0147. Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. Documented at the time in `82-RESEARCH.md`.

Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the org doc's top-level `aiMasterEnabled` field (distinct from `settings.aiEnabled` above).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/stores/auth.ts:121-129`:**

```
  // Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the org
  // doc's top-level `aiMasterEnabled` field (distinct from
  // `settings.aiEnabled` above). Absent/false => OFF (default) — DELIBERATELY
  // the inverse of vwModeEnabled's `?? true` default, since AI must be off by
  // default for every org (R242). Mirror-written from applyOrgSnapshot, NOT
  // live-synced via onSnapshot — same latency posture as vwModeEnabled/
  // settings (Pitfall 2, 82-RESEARCH.md). Consumed as the first AND-gate leg
  // in `src/utils/claudeApi.ts`'s isAiEnabled() and as SettingsView.vue's AI
  // Features card v-if.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:121-129`
