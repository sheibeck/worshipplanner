---
slug: 260819-one-way-serve-with
title: Make "Must serve with" pairings one-way (directional), not reciprocal
date: 2026-08-19
mode: quick
---

## Problem

The "Must serve with" pairing entered in the availability drawer is stored and
displayed as a **two-way** link. When the owner added Tim+Nolan and Gabriel+Lilly,
each pairing was mirrored onto both people. The owner wants it **one-way**: "Nolan
needs to serve with Tim, but Tim doesn't always need to serve with Nolan."

The panel you edit lists the people **that person** must serve with (i.e. who gets
pulled in when that person is scheduled).

## Root cause

`setPersonAvailability` (src/stores/quarters.ts) performs a symmetric added/removed
diff and writes the reciprocal `pairedWith` onto every partner. The scheduler's
pull-in mechanism (`propagatePairing`) is **already directional** — it follows each
person's own `pairedWith` — so once the reciprocal write stops, one-way behavior
falls out for free. The remaining two-way cues are purely visual: the drawer's
"bidirectional — both get scheduled together" label and the roster table's `↔`.

## Decisions (owner)

- One-way semantics: a person's `pairedWith` = who THEY must serve with.
- Existing real data (owner will action in UI, code can't touch prod Firestore):
  - Tim/Nolan → keep Tim in Nolan's list; remove Nolan from Tim's (open Tim → remove Nolan → Save).
  - Gabriel/Lilly → keep Gabriel in Lilly's list; remove Lilly from Gabriel's (open Gabriel → remove Lilly → Save).
- CSV import path (`applyCsvToQuarter`) is a **dead feature** per owner — left entirely untouched (code + its bidirectional test), out of scope.

## Tasks

1. **quarters.ts** — `setPersonAvailability`: drop the reciprocal add/remove loops;
   write only the scoped own-entry `personQuarterData.${personId}`. Update doc comment.
2. **AvailabilityDrawer.vue** — relabel the "Must serve with" hint from
   "bidirectional — both get scheduled together" to one-way wording.
3. **AvailabilityRosterTable.vue** — `pairSummary` marker `↔` → `→`.
4. **types/roster.ts** — update the `pairedWith` field comment (bidirectional → directional).
5. **quarters.test.ts** — rewrite the 4 reciprocal-write tests to assert the partner
   entry is NOT touched (one-way). Own-entry / no-bare-map tests stay unchanged.
6. Gate: `npm run type-check` + `npx vitest run` (quarters + scheduler + drawer + roster suites).

## Out of scope

- CSV import reciprocity (dead feature).
- Scheduler logic (already directional; verify via existing tests only).
- Any production data migration (owner does the 2 UI removals above).
