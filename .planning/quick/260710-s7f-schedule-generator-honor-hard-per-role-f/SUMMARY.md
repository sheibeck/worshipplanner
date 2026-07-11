---
quick_id: 260710-s7f
slug: schedule-generator-honor-hard-per-role-f
date: 2026-07-11
status: complete
commit: 8b2aa1a
---

# Summary: Honor hard per-role frequency caps; fill-ins are manual-only

## What changed

`src/utils/scheduler.ts` — `proposeQuarterSchedule` main assignment loop:

1. **Hard cap added to the main loop.** Candidate eligibility now requires
   `getServedByRole(p.id, roleId) < roleBudget(p.id, roleId)` — the same
   whole-quarter cadence ceiling (`ceil(serviceDates.length / n)`) that
   `propagatePairing`'s `withinCadence` gate already enforced (R-12). The loop
   previously scored by fair-share *deficit* and always picked the top candidate
   with no cap check, so the only guitarist got booked every week and monthly
   people served twice a month.

2. **Fill-ins are manual-only.** Removed the `eligible('fillin')` last-resort
   auto-fill. Only `regular`-tier people are auto-scheduled; `fillin`-tier is
   scheduled by hand; `out`-tier stays excluded. Deficit scoring simplified
   (the fillin branch is gone).

3. **Blank slots are expected.** When no candidate is under their cap, the slot
   is pushed to `unfilled` rather than over-serving someone.

## Tests

`src/utils/__tests__/scheduler.test.ts`:
- Rewrote `fillin last resort` → `fillin manual-only`: sole candidate is fillin
  ⇒ slot unfilled, no assignment.
- Updated sibling `fillin` test comment to manual-only semantics.
- Added `hard cap` regression (Gabriel: sole monthly guitarist over 8 weeks
  capped at 2, other 6 weeks blank).

## Verification

- `npx vitest run src/utils/__tests__/scheduler.test.ts` — 30/30 pass (incl.
  untouched R-12, WR-02, and group co-occurrence suites).
- `npm run type-check` — clean.
- Full suite `npx vitest run` — 33 files, 692 tests pass.

Commit: `8b2aa1a`
