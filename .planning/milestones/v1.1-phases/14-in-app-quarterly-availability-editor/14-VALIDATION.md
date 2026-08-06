---
phase: 14
slug: in-app-quarterly-availability-editor
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `14-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (configured in `vite.config.ts`, `environment: 'jsdom'`) |
| **Config file** | `vite.config.ts` (unit) · `vitest.rules.config.ts` (Firestore rules) |
| **Quick run command** | `npx vitest run <changed-test-file>` |
| **Full suite command** | `npm run test:unit` |
| **Estimated runtime** | ~single-digit seconds (quick) · full suite < ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-test-file>`
- **After every plan wave:** Run `npm run test:unit` + `npm run type-check`
- **Before `/gsd:verify-work`:** Full suite green + `npm run test:rules`
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| D-04/D-05 (fill-in last resort) | Fill-in-tier candidate only chosen when zero regular-tier candidates available for a role/date | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "fillin"` | ✅ file, ❌ case (W0) |
| D-04/D-05 ('out' exclusion) | 'out'-tier person never appears in `calendar`, `unfilled`, or as a pairing-propagation target | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "out tier"` | ✅ file, ❌ case (W0) |
| D-06 (bidirectional add+remove pairing) | `setPersonAvailability` reciprocally adds AND removes partner `pairedWith` entries | unit | `npx vitest run src/stores/__tests__/quarters.test.ts -t "setPersonAvailability"` | ✅ file, ❌ case (W0) |
| D-08/D-09/D-10 (selective PC import) | `fetchPeopleForTeamPositions` filters assignments to selected `team_position` ids and dedupes people serving multiple positions | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts -t "fetchPeopleForTeamPositions"` | ✅ file, ❌ case (W0) |
| D-01/D-02/D-03 (drawer read/write round-trip) | Opening drawer pre-populates controls from existing `personQuarterData`; saving writes back via `setPersonAvailability` | component | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts` | ❌ W0 (new component + test) |
| D-03 (Sundays-only calendar) | Only `quarter.serviceDates` dates render clickable; toggling writes exactly the clicked date into `blackoutDates` | component | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts -t "calendar"` | ❌ W0 |
| Pitfall 3 (manual candidate list respects 'out') | `QuarterGrid.vue`'s `availableUnassigned` excludes `'out'`-tier people | unit | `npx vitest run src/components/__tests__/QuarterGrid.test.ts -t "out tier"` | ❌ W0 (confirm existing test file) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — task IDs assigned by planner.*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/scheduler.test.ts` — extend with fill-in last-resort + out-exclusion cases (D-04/D-05)
- [ ] `src/stores/__tests__/quarters.test.ts` — extend with `setPersonAvailability` add+remove bidirectional pairing cases (D-06)
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — extend with `fetchPeopleForTeamPositions` pagination + filter + dedupe cases (D-08/D-09/D-10)
- [ ] `src/components/__tests__/AvailabilityDrawer.test.ts` — new file: D-01/D-02/D-03 round-trip + Sundays-only calendar correctness
- [ ] Confirm whether `QuarterGrid.test.ts` exists; if not, note as pre-existing Phase 13 gap — only the new `'out'`-tier filter assertion is required here
- Framework install: none — Vitest already fully configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PC selective import against a live Planning Center org | D-10 | Requires authenticated PC Services credentials; endpoint confirmed via docs, not a live call | With a connected PC org, open PC import → select worship team → include an individually-scheduled position (exclude choir/orchestra) → verify only current assignees import |
| Drawer control expressiveness against real notes | Claude's Discretion | Subjective UX validation against messy real data | Reproduce each pattern in `docs/Sample Frequency Notes.csv` (Anne 1st Sundays, Krystyn 2nd week, "gone June 12-19") using the calendar controls |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08 (plan-checker verified Per-Task Verification Map fully covered; `wave_0_complete` flips true during execution)
