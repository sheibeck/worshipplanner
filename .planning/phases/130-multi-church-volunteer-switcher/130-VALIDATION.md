---
phase: 130
slug: multi-church-volunteer-switcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-06
---

# Phase 130 — Validation Strategy

> Seeded by plan-phase from 130-RESEARCH.md's Validation Architecture. Planner fills the Per-Task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` + `npm run type-check` |
| **Estimated runtime** | ~60–120s |

All 5 touched test files already exist (rehearseAccess.test.ts, services.test.ts, mySchedule.test.ts,
MyScheduleView.test.ts, AppSidebar.test.ts) — extend, no Wave-0 gaps.

---

## Sampling Rate
- After every task commit: `npm run type-check` + touched test file(s)
- Before verify: full app suite (baseline: only `storage.rules.test.ts`) + type-check clean

---

## Per-Requirement Verification Map

| Req | Test type | Automated command | Notes |
|-----|-----------|-------------------|-------|
| R404 | unit | `npx vitest run src/utils/rehearseAccess.test.ts src/stores/__tests__/services.test.ts` | orgName in projection via `writeRehearseAccessDoc`, both write paths forward it; conditional-spread (absent, not undefined, when empty) |
| R403 | unit | `npx vitest run src/stores/__tests__/mySchedule.test.ts src/views/__tests__/MyScheduleView.test.ts` | distinct-church derivation; client-side filter scopes the list; NEVER calls selectOrg |
| R405 | unit | `npx vitest run src/views/__tests__/MyScheduleView.test.ts` | switcher hidden for 0/1 distinct church; unchanged single-church experience |
| R404 (label) | unit | `npx vitest run src/components/__tests__/AppSidebar.test.ts` | volunteer church name in the org-name slot (selected/only church; "Multiple churches" when all-selected); admin `authStore.orgName` path undisturbed |
| degrade | unit | `npx vitest run` | missing `orgName` on an older projection doc → fallback label ("Unnamed church"/"Your church"), never blank/crash |

---

## Security note
- `orgName` is non-sensitive (church name is already public via `orgSlugs`). No field-level rule change
  needed (`rehearseAccess` write is gated only by `isOrgEditor`). The switcher is a client-side filter over
  already-authorized docs — no new data exposure, no new endpoint.

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Real multi-church volunteer sees + uses the switcher; single-church sees none | R403/R405 | Needs a real account on 2 churches' rosters | Sign in as a volunteer on ≥2 churches (locked services); confirm the filter + sidebar label; sign in as a single-church volunteer and confirm no switcher |
| Existing (pre-orgName) projection docs | R404 | Older docs lack orgName until re-projected | Confirm graceful fallback; decide on a one-time backfill |

---

## Validation Sign-Off
- [ ] R403–R405 have automated verify
- [ ] orgName in projection asserted (both write paths) + graceful fallback tested
- [ ] switcher never calls selectOrg (asserted)
- [ ] `nyquist_compliant: true` set

**Approval:** pending
