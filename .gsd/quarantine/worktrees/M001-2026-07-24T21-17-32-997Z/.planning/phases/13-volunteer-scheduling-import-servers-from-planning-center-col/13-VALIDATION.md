---
phase: 13
slug: volunteer-scheduling-import-servers-from-planning-center-col
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (existing — `environment: 'jsdom'`; see `src/utils/__tests__/*.test.ts`, `src/stores/__tests__/*.test.ts`) |
| **Config file** | `vite.config.ts` (unit tests), `vitest.rules.config.ts` (Firestore rules tests) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` (a.k.a. `npm run test:unit`) |
| **Type gate (UI plans)** | `npx vue-tsc --build` (no Vitest coverage for `.vue` presentation layers; type-clean + human-verify checkpoint) |
| **Estimated runtime** | ~15 seconds (unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>` (logic tasks) or `npx vue-tsc --build` (UI tasks)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npx vue-tsc --build` clean
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | D-05 | — | N/A (type contract) | type | `npx vue-tsc --build --force` (roster.ts clean → TYPESOK) | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | D-01 | — | Sunday generation is deterministic (no off-by-one across DST) | unit | `npx vitest run src/utils/__tests__/quarterDates.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | D-06 | — | N/A (scope doc flip) | grep | `grep` PROJECT.md scope flip → SCOPEOK | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | D-07, D-09, D-10, D-11 | T-13-02 | RED: scheduler constraint suite fails before impl | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` (expect RED_CONFIRMED) | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | D-04, D-07, D-08, D-09, D-10, D-11, D-12 | T-13-02 | Blackout never violated; pairing propagated; furthest-below-target tie-break; unfillable→flag | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | D-15, D-17 | T-13-08-02 | CSV cells parsed as data; `;`-split + range expansion; malformed cells warn not crash | unit | `npx vitest run src/utils/__tests__/volunteerCsv.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 2 | D-16 | T-13-08-01 | Normalize-both-sides name match surfaces every non-exact row | unit | `npx vitest run src/utils/__tests__/volunteerCsv.test.ts -t "match"` | ❌ W0 | ⬜ pending |
| 13-04-01 | 04 | 2 | D-13, D-14 | T-13-07-02 | Paginated people fetch; phone never mapped from PC | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-02 | 04 | 2 | D-13 | T-13-07-03 | Batched email fetch → preview list; credentials reused, not logged | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts -t "people\|email"` | ❌ W0 | ⬜ pending |
| 13-05-01 | 05 | 2 | D-13, D-14, D-19, D-20 | T-13-07-04 | Re-import upsert; deactivate is soft-delete (no hard delete) | unit | `npx vitest run src/stores/__tests__/roster.test.ts -t "active\|upsert\|import"` | ❌ W0 | ⬜ pending |
| 13-05-02 | 05 | 2 | D-03, D-18 | — | Editable role list; default template seeding | unit | `npx vitest run src/stores/__tests__/roster.test.ts -t "role"` | ❌ W0 | ⬜ pending |
| 13-06-01 | 06 | 3 | D-01, D-02 | T-13-06-04 | Quarter lifecycle scoped to org; other dates' overrides untouched | unit | `npx vitest run src/stores/__tests__/quarters.test.ts -t "create\|date\|override"` | ❌ W0 | ⬜ pending |
| 13-06-02 | 06 | 3 | D-19, D-22 | T-13-06-03 | Per-person replace keeps absent people untouched; standing vs quarter-scoped split; scoped cell edits | unit | `npx vitest run src/stores/__tests__/quarters.test.ts -t "replace\|propose\|fillGaps\|assign\|swap\|clear"` | ❌ W0 | ⬜ pending |
| 13-06-03 | 06 | 3 | D-21, D-24 | T-13-06-01, T-13-06-02 | 144-bit crypto token; snapshot carries names only (no email/phone); no PC push | unit | `npx vitest run src/stores/__tests__/quarters.test.ts -t "share\|finalize\|token"` | ❌ W0 | ⬜ pending |
| 13-07-01 | 07 | 3 | D-03, D-13, D-14, D-20 | T-13-07-01 | /roster editor-gated route + editor-gated sidebar item; phone app-only | type | `npx vue-tsc --build` (RosterView/RolesConfigPanel/AppSidebar/router → TSOK) | ✅ | ⬜ pending |
| 13-07-02 | 07 | 3 | D-13, D-14 | T-13-07-02 | PC import preview never fabricates phone | type | `npx vue-tsc --build` (RosterImportModal → TSOK) | ✅ | ⬜ pending |
| 13-07-CP | 07 | 3 | D-03, D-13, D-14, D-20 | T-13-07-01 | Roster reachable via sidebar; deactivate confirm; badges/copy correct | manual | human-verify checkpoint (blocking) | n/a | ⬜ pending |
| 13-08-01 | 08 | 4 | D-01, D-02 | T-13-08-03 | /schedule editor-gated route + editor-gated sidebar item; regenerate destructive confirm | type | `npx vue-tsc --build` (QuarterView/AppSidebar/router → TSOK) | ✅ | ⬜ pending |
| 13-08-02 | 08 | 4 | D-15, D-16, D-17 | T-13-08-01, T-13-08-02 | Unmatched rows require explicit map/create (no silent auto-create); blackout expanded with warnings | type | `npx vue-tsc --build` (VolunteerCsvImportModal/QuarterView → TSOK) | ✅ | ⬜ pending |
| 13-08-CP | 08 | 4 | D-01, D-02, D-15, D-16, D-17 | T-13-08-01 | Schedule reachable via sidebar; CSV preview reconciliation; generate/regenerate/fill-gaps | manual | human-verify checkpoint (blocking) | n/a | ⬜ pending |
| 13-09-01 | 09 | 5 | D-04, D-22, D-23 | — | Multi-person-per-role grid; scoped cell edits; unfilled flagged | type | `npx vue-tsc --build` (QuarterGrid/QuarterView → TSOK) | ✅ | ⬜ pending |
| 13-09-02 | 09 | 5 | D-10, D-23 | — | Gap panel shows blacked-out + available-unassigned | type | `npx vue-tsc --build` (QuarterGrid → TSOK) | ✅ | ⬜ pending |
| 13-09-CP | 09 | 5 | D-04, D-10, D-22, D-23 | — | Grid reassign/swap/clear/add; unfilled + pairing-conflict flags | manual | human-verify checkpoint (blocking) | n/a | ⬜ pending |
| 13-10-01 | 10 | 6 | D-24 | — | Print roster light theme, break-inside-avoid | type | `npx vue-tsc --build` (RosterPrintLayout/QuarterView → TSOK) | ✅ | ⬜ pending |
| 13-10-02 | 10 | 6 | D-24, D-25 | T-13-06-01 | Public share view (no auth) from token; no email send | type | `npx vue-tsc --build` (QuarterShareView/QuarterView/router → TSOK) | ✅ | ⬜ pending |
| 13-10-CP | 10 | 6 | D-24 | — | Public link unauthenticated; printable roster | manual | human-verify checkpoint (blocking) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The scheduler (Plan 02) is pure logic — hard-constraint enforcement (blackout never violated), pairing
propagation (D-09 same-dates/own-roles), frequency balancing / furthest-below-target tie-break (D-11),
and unfillable→flag (D-10) are covered as unit tests. The `.vue` presentation plans (07-10) have no unit
coverage by design; they gate on `npx vue-tsc --build` (type-clean) plus a blocking human-verify
checkpoint, per RESEARCH Validation Architecture.*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/scheduler.test.ts` — solver hard/soft constraint + tie-break suite (Plan 02 Task 1 RED)
- [ ] `src/utils/__tests__/quarterDates.test.ts` — Sunday generation + blackout-range expansion (Plan 01 Task 2)
- [ ] `src/utils/__tests__/volunteerCsv.test.ts` — CSV parse (`;`-split, ranges, name-match) (Plan 03)
- [ ] `src/stores/__tests__/roster.test.ts` — people CRUD/upsert/soft-delete + role list (Plan 05)
- [ ] `src/stores/__tests__/quarters.test.ts` — lifecycle, per-person replace, propose, cell edit, share token (Plan 06)
- [ ] extend `src/utils/__tests__/planningCenterApi.test.ts` — paginated people fetch + batched email (Plan 04)

*These test files are created RED-first inside their owning plans (TDD tasks), not by a separate Wave 0
plan — hence `wave_0_complete: false` at planning time. Each logic plan writes its failing test before
implementation; the `❌ W0` markers above clear as those plans execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Roster/Schedule reachable from sidebar nav | D-13/D-01 | Rendered nav + routing | Sign in as editor; confirm "Roster" and "Schedule" items appear in the sidebar and route to /roster and /schedule |
| Editable dates×roles grid interactions (reassign/swap/clear/add) | D-22/D-23 | UI interaction | Load a generated quarter, click cells to reassign, confirm unfilled flag + blacked-out list |
| CSV name-reconciliation preview | D-16 | UI interaction | Upload a CSV with an unfamiliar name; confirm map-to-existing / create-new controls appear before commit |
| Read-only share link + printable roster | D-24 | Rendered output | Publish quarter, open share link unauthenticated, print-preview roster |

*The `.vue` presentation layers are covered by type-checking + these blocking human-verify checkpoints
(Plans 07-10).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all runs use `npx vitest run`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready — validation map populated from Plans 01-10; logic covered by Vitest, presentation gated by `vue-tsc` + blocking human-verify checkpoints.
