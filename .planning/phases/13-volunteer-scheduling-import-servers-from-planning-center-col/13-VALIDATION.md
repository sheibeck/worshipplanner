---
phase: 13
slug: volunteer-scheduling-import-servers-from-planning-center-col
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `src/utils/*.test.ts`) |
| **Config file** | {confirm vitest config path during planning} |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-13-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner: populate one row per task. The scheduler is pure logic — cover hard-constraint
enforcement (blackout never violated), pairing propagation (D-09 same-dates/own-roles),
frequency balancing / furthest-below-target tie-break (D-11), and unfillable→flag (D-10) as unit tests.*

---

## Wave 0 Requirements

- [ ] `src/utils/scheduler.test.ts` — solver hard/soft constraint + tie-break stubs
- [ ] `src/utils/quarterDates.test.ts` — Sunday generation + blackout-range expansion
- [ ] `src/utils/volunteerCsv.test.ts` — CSV parse (`;`-split, ranges, name-match)
- [ ] roster / quarters store test stubs
- [ ] extend `src/utils/planningCenterApi.test.ts` — paginated people fetch

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editable dates×roles grid interactions (reassign/swap/clear/add) | D-22/D-23 | UI interaction | Load a generated quarter, click cells to reassign, confirm unfilled flag + blacked-out list |
| Read-only share link + printable roster | D-24 | Rendered output | Publish quarter, open share link unauthenticated, print-preview roster |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
