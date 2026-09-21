---
phase: 139
status: secured
threats_closed: 7
threats_open: 0
asvs_level: 1
audited: 2026-09-09
---

## SECURED

**Phase:** 139 — Rehearsal & Report Times
**Threats Closed:** 7/7
**ASVS Level:** 1

Verified against actual code (git diffs, grep, targeted test runs, `npm run type-check`) — not plan prose.
`git diff 94821ad7..HEAD -- firestore.rules` and `-- package.json package-lock.json` are BOTH empty (zero
rules change, zero new dependencies). 35/35 relevant tests pass; type-check clean.

### Threat Verification
| Threat ID | Category | Severity | Disposition | Evidence |
|-----------|----------|----------|-------------|----------|
| T-139-01 | Tampering | low | accept | `firestore.rules:202-231` services draft-status update branch unchanged; `isOrgEditor` gate intact; no rules diff. |
| T-139-02 | Info disclosure (public projections) | low | accept | Rehearsal/report times treated like the already-public `date`; `services.sharePii.test.ts` 5/5 pass — PII boundary undisturbed. Post-CR-01, projections filter via `isDisplayableRehearsal` (date AND time). |
| T-139-03 | Info disclosure (stale RehearseAccessDoc) | low | accept | Pre-existing `markAsPlanned`-only refresh latency, unchanged; shows stale-but-genuine data only, never forged. |
| T-139-04 | Elevation of privilege (editor UI gate) | low | mitigate | CR-02 fixed (commit `5537daea`): bare `v-if="!canEditService"` + `:disabled` on all 3 inputs; server `isOrgEditor`+draft gate was always the real defense. Test `ServiceEditorView.timesSection.test.ts` 5/5. |
| T-139-05 | Tampering (org-settings defaults) | low | accept | `firestore.rules:84-89` `lifecycleFields()` excludes the new defaults; they ride the ordinary editor-gated `settings.*` write path. |
| T-139-06 | Info disclosure (display surfaces) | low | accept | Post-CR-01, all 5 read-only render sites use the shared `isDisplayableRehearsal` predicate (grepped, confirmed) — no partial/malformed state reaches any surface incl. the public Share page. |
| T-139-SC | Tampering (supply chain) | low | accept | Zero dependency changes (empty package diff). |

### Unregistered Flags
None — no new external input, endpoint, or trust-boundary crossing across the 8 touched files.

**threats_open:** 0
