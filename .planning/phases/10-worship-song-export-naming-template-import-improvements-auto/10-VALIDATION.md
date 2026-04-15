---
phase: 10
slug: worship-song-export-naming-template-import-improvements-auto
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vite.config.ts` (test block, jsdom environment) |
| **Quick run command** | `npx vitest run src/utils/__tests__/suggestions.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/utils/__tests__/[relevant-test-file].test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | FEAT-1 | — | N/A | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ extend | ⬜ pending |
| 10-01-02 | 01 | 1 | FEAT-1 | — | N/A | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ extend | ⬜ pending |
| 10-02-01 | 02 | 1 | FEAT-2 | — | N/A | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ extend | ⬜ pending |
| 10-03-01 | 03 | 2 | FEAT-3 | — | N/A | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | ✅ extend | ⬜ pending |
| 10-04-01 | 04 | 1 | FEAT-4a | — | N/A | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ extend | ⬜ pending |
| 10-04-02 | 04 | 1 | FEAT-4b | — | N/A | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ extend | ⬜ pending |
| 10-04-03 | 04 | 1 | FEAT-4c | — | N/A | unit | `npx vitest run src/utils/__tests__/suggestions.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

New test cases to add within existing files:
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — `addSlotAsItem` SONG title uses "Worship Song - " prefix
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — `addSlotAsItem` HYMN title uses "Worship Song - " prefix
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — `deleteItem` sends DELETE to correct URL
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — `fetchServiceTypeTeams` maps response to id+name array
- [ ] `src/utils/__tests__/suggestions.test.ts` — orchestra bonus scoring (+200) for orchestra-tagged songs
- [ ] `src/utils/__tests__/suggestions.test.ts` — non-orchestra songs still returned when Orchestra is serviceTeam
- [ ] `src/utils/__tests__/suggestions.test.ts` — update existing team-filter tests for Orchestra-only serviceTeams

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PC Teams checkbox shows + auto-selects matching teams in export dialog | FEAT-3 (UI) | Requires live PC credentials + real service type | Open export dialog with a PC-connected account; verify Teams section appears with correct teams auto-checked |
| Add teams to plan via needed_positions | FEAT-3 (API) | Requires live PC account for endpoint validation | Export to a new or existing plan; check PC plan shows the expected teams added |
| Delete+recreate replaces placeholders in correct order | FEAT-2 (integration) | Requires live PC plan with placeholders | Export to existing plan with "Worship Song" placeholder items; verify they are replaced not duplicated |
| Orchestra visual dimming in SongSlotPicker | FEAT-4 (UI) | Vue component rendering requires browser | Create service with Orchestra team; open song picker; verify non-orchestra songs are dimmed (opacity-50) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
