---
phase: 143-dated-rehearsals-times-tab
audited: 2026-10-27
baseline: 143-UI-SPEC.md (approved)
mode: code-only (no screenshots)
overall: 18/24
fixes_applied: 3
---

# Phase 143 — UI Review

Code-only 6-pillar audit by gsd-ui-auditor against `143-UI-SPEC.md` (the auditor returned the report
inline; recorded here by the orchestrator). Layout claims marked "code-inferred" still need the batched
milestone-end visual pass (`.planning/v2.16-DEFERRED-VERIFICATION.md`).

## Pillar Scores (as audited, before fixes)

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract copy present verbatim; malformed-value revert copy (WR-01) not in the contract; "Report time" heading + label duplicated; Remove had no row-specific accessible name |
| 2. Visuals | 3/4 | Add form is the focal point; Remove likely stretched full-width on mobile (code-inferred); locked-service dot pointed at hidden rows |
| 3. Color | 4/4 | Indigo confined to contract roles; amber limited to legacy signals; no hardcoded hex |
| 4. Typography | 3/4 | 10px marker badge (inherited recipe) below the contract's 12px floor |
| 5. Spacing | 3/4 | Tab dot `ml-1.5` (6px) off the 4px scale; contract inconsistent (ml-1 vs ml-1.5) |
| 6. Experience Design | 2/4 | `role="status"` rendered with `v-if` (rarely announced); ambiguous Remove buttons; small tap targets; unexplained locked-state dot |

**Overall: 18/24** — no blockers.

## Fixes Applied (orchestrator, 2026-10-27, owner pre-approved recommendations)

1. **Live region** — one persistent `<p role="status" aria-live="polite" class="sr-only">` at the panel
   root carries the revert text; the per-row visual line is now `aria-hidden`. Tests: live region exists
   before any message, carries and clears the text.
2. **Remove buttons** — row-specific `aria-label` ("Remove rehearsal Nov 6, 7:00 PM" / "Remove rehearsal
   without a date") and `self-start px-1 py-2` so it no longer stretches on mobile and has a taller target.
3. **Locked-service dot referent** — editors on a read-only (locked) service with legacy rows see "Some
   rehearsals are missing a date or time. Reopen the service to fix them." (new `isEditor` prop; hidden for
   viewers and when all rows are complete). Tests for both cases.
4. Nit: the duplicate visible "Report time" label is now `sr-only` (the heading remains).

Verification: `ServiceTimesPanel.test.ts` (29) + `ServiceEditorView.timesSection.test.ts` (30) green;
`npm run type-check` clean. ARCHITECTURE.md panel note updated.

## Not changed (recorded)

- 10px marker badge and `ml-1.5` dot offset — inherited recipes; legibility is in the batched UAT (143-3).
- Default-time chips ~24px tall — below 44px; acceptable for an optional shortcut (the time input remains).
- Malformed-value copy is not in the Copywriting Contract — accepted as a WR-01 addition.

## Still needs human verification (batched)

360px tab reachability; <640px stacking incl. Remove placement; amber legibility at 10px; screen-reader
announcement of the revert message and "Times (needs attention)"; native date/time clear behavior.
