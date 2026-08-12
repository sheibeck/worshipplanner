---
quick_id: 260710-s7f
slug: schedule-generator-honor-hard-per-role-f
date: 2026-07-11
status: complete
commit: 0d4d127
commits: [8b2aa1a, 0d4d127]
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

## Follow-up: even spread across the quarter (commit `0d4d127`)

The initial commit's whole-quarter *count* budget stopped over-serving but still
**front-loaded**: when someone is the only viable candidate, the greedy loop booked
them every week until the budget ran out, then left the rest blank (Gabriel every
Sunday in June, nothing after). Paired partners had the same issue (Nolan pulled onto
the anchor's first N dates → 2x/month for the first half, then nothing).

Fix: replaced the flat count budget with an **even-spread cadence gate** — a person is
eligible for a role on a date only while their per-role served count is below the
running target `(dateIndex+1)/n` (behind their ideal 1-in-N pace). Because the target
advances with the calendar, a monthly (n=4) person lands on weeks 1, 5, 9, 13… across
the whole quarter. Applied to BOTH the main loop and `propagatePairing`. Fill-in tier
is now also excluded from pairing pull-in (manual-only); the `n<=0` guard moved into
the shared `withinCadence` helper.

Tests strengthened to actually catch front-loading: Gabriel asserts served indices
`[0, 4]` (not just count); the R-12 even-spread test asserts Nolan's gap equals his
cadence (4) and reaches the final quarter of the calendar (both old tests passed even
when front-loaded). All 30 scheduler + 692 full-suite tests green; type-check clean.
