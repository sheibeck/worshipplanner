---
slug: 260819-one-way-serve-with
title: Make "Must serve with" pairings one-way (directional), not reciprocal
date: 2026-08-19
status: complete
---

## What changed

"Must serve with" pairings are now **one-way (directional)**. A person's
`pairedWith` list is the set of people **they** must serve with; the scheduler
pulls those partners in when that person is scheduled. Adding or removing a
partner in the availability drawer now edits **only that person's** record — the
link is no longer mirrored onto the partner.

- `src/stores/quarters.ts` — `setPersonAvailability` no longer performs the
  symmetric added/removed diff or writes any reciprocal `pairedWith` onto
  partners. It writes only the scoped `personQuarterData.${personId}` entry.
- `src/components/AvailabilityDrawer.vue` — the "Must serve with" hint changed
  from "bidirectional — both get scheduled together" to
  "one-way — when this person serves, these people are pulled in too".
- `src/components/AvailabilityRosterTable.vue` — pairing marker `↔` → `→`.
- `src/types/roster.ts` — `pairedWith` comment updated (directional, not mirrored).
- `src/stores/__tests__/quarters.test.ts` — the 4 reciprocal-write tests rewritten
  to assert the partner entry is NOT touched. Own-entry / no-bare-map tests unchanged.

The scheduler needed **no** logic change: `propagatePairing` already follows each
person's own `pairedWith`, so one-way behavior falls out once the reciprocal write
is removed.

## Not changed (deliberately, per owner)

- CSV import (`applyCsvToQuarter` + its "applies pairings bidirectionally" test)
  is a **dead feature** and was left entirely untouched. If CSV scheduling import
  is ever revived, its reciprocal merge loop should be removed to match this model.

## Verification

- `npx vitest run` (targeted): quarters (42) + scheduler (30) + drawer (9) +
  roster (6) = 87 pass.
- `npm run type-check` (vue-tsc --build): clean.
- Full app suite: green at the documented 2-file baseline (storage.rules.test.ts,
  RosterView.test.ts — pre-existing, unrelated).

## Status: shipped + deployed + data split (2026-08-19)

Deployed to production hosting on 2026-08-19. Owner completed both live-data splits
in the UI (removed Nolan from Tim, removed Lilly from Gabriel). Loop fully closed.

## Owner follow-up — production data (LIVE, do this AFTER deploy) — DONE

The code touches **zero** production records. The existing two-way pairs in the
live DB (Tim↔Nolan, Gabriel↔Lilly) are each stored on both people. Once this fix
is deployed, split them with these **scoped, single-record** UI edits — each now
edits only the panel you open, never the partner:

1. Open **Tim's** availability panel → remove the **Nolan** chip → Save.
   (Keeps Tim in Nolan's list; Nolan still needs Tim.)
2. Open **Gabriel's** availability panel → remove the **Lilly** chip → Save.
   (Keeps Gabriel in Lilly's list; Lilly still needs Gabriel.)

⚠ Do NOT do these removals before the fix is deployed — the old reciprocal code
would also strip the kept side (removing Nolan from Tim would also remove Tim from
Nolan), destroying the link you want to keep.
