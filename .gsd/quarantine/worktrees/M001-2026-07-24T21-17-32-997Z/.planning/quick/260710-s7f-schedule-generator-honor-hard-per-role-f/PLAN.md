---
quick_id: 260710-s7f
slug: schedule-generator-honor-hard-per-role-f
date: 2026-07-11
---

# Quick Task: Honor hard per-role frequency caps; fill-ins are manual-only

## Problem

The quarterly scheduler (`src/utils/scheduler.ts`) over-serves people rather than
leaving blank slots when a role can't be legitimately filled:

- **Nolan** is set to serve ~once/month but the generator scheduled him twice a month.
- **Gabriel** plays guitar ~once/month but, being the only guitarist, was put on *every*
  week.

Root cause: the main assignment loop (`for (const { roleId, count } of rolesForDate)`)
scores candidates by fair-share *deficit* and always picks `scored[0]` — it never
checks whether the chosen person is still under their per-role cadence budget. The
`propagatePairing` path already has a `withinCadence` hard-cap gate (the R-12 fix); the
main loop was missing the equivalent gate. Separately, the `fillin` tier was used as a
*last-resort auto-fill*, but the user wants fill-ins scheduled only by hand.

## Desired behavior (from user)

1. **Hard caps win.** A person's 1-in-N per-role cadence is a hard ceiling
   (`roleBudget = ceil(serviceDates.length / n)`). Once hit, they are not auto-scheduled
   again for that role this quarter.
2. **Blank spots are OK.** When no candidate is under their cap, leave the slot unfilled
   (`unfilled`) instead of over-serving someone.
3. **Fill-ins are manual-only.** `fillin`-tier people are never auto-scheduled. The
   last-resort `eligible('fillin')` fallback is removed. (`out`-tier unchanged: excluded.)

## Changes

- `src/utils/scheduler.ts` — main assignment loop:
  - Add the per-role hard-cap gate `getServedByRole(p.id, roleId) < roleBudget(p.id, roleId)`
    to candidate eligibility (mirrors `propagatePairing`'s existing `withinCadence` gate).
  - Remove the `eligible('fillin')` last-resort fallback; only `regular`-tier people are
    auto-scheduled. Simplify deficit scoring (no longer needs the fillin branch).
- `src/utils/__tests__/scheduler.test.ts`:
  - Rewrite the `fillin last resort` test → fill-in is manual-only, slot left unfilled.
  - Update the `fillin: regular chosen over fillin` comment to match manual-only semantics.
  - Add: **hard cap** regression (only guitarist, monthly, capped → later weeks blank).
  - Add: **fill-in manual-only** regression (sole candidate is fillin → unfilled, no assign).

## Verification

- `npm run test:unit -- scheduler` green (existing R-12/WR-02 + group tests still pass).
- `npm run type-check` clean.
