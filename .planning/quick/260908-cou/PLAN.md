---
quick_id: 260908-cou
slug: stage-chit-role-sync
status: in-progress
date: 2026-09-08
---

# Quick task: stage-layout chit ↔ role-assignment sync

## Description

Two stage-layout behaviors tied to Service-Order role assignments:

1. **Remove role → remove chit.** Unchecking a person from a (band) role in the
   Roles tab removes their matching stage-layout chit.
2. **Play + sing → fold + auto-check "Player also sings".** When a person is a
   band member (instrument role) AND also assigned a vocal role that day, they
   get ONE instrument chit with `withVocal` auto-checked ("Guitar + Vocal") — no
   separate Vocals chit.

## Owner decisions (2026-09-08)

- **Fold into one chit** — a play+sing person → one instrument chit, `withVocal`
  true, no separate Vocals chit.
- **Live + on seed** — reconcile both at auto-seed (`onAutoPopulateStageLayout`)
  AND live in the Roles-tab toggle (`onToggleOverridePerson`).

## Rules

- Only **Band-group** roles affect the stage (consistent with the band-only seed).
- A role is a **vocal** role when its name matches `/vocal|vox|choir|sing/i`
  (`isVocalRoleName`) — deliberately excludes "lead" so "Lead Guitar" is not
  misread as vocal.
- **Seed:** for each person, if they have ≥1 instrument (non-vocal band) role AND
  ≥1 vocal role → emit their instrument chit(s) with `withVocal`, drop their
  vocal chit(s). Pure vocalist → a Vocals chit. Instrument-only → plain chit.
- **Live remove:** uncheck instrument role → remove that person's chit for that
  role; uncheck vocal role → clear `withVocal` on that person's instrument chits.
- **Live add:** check into a vocal role → set `withVocal` on that person's
  existing instrument chits. (Live add of an instrument role creates NO new chit —
  seed owns chit creation/positioning; only removal + vocal-fold are live.)

## Touch points

- `src/utils/stageLayout.ts` — new pure `isVocalRoleName`, `foldPlayAndSing`;
  `autoPopulateMarkers` honors an optional per-assignment `withVocal`.
- `src/views/ServiceEditorView.vue` — `onAutoPopulateStageLayout` folds before
  seeding; `onToggleOverridePerson` reconciles the stage after a successful
  override write.
- Tests: `src/utils/__tests__/stageLayout.test.ts` (pure helpers),
  `src/views/__tests__/ServiceEditorView.stage.test.ts` (seed-fold + live sync).

## Non-goals

- No live auto-CREATION of a new chit when a band member is added (positioning is
  the seed's job; would need placement UX the owner didn't ask for).
- Removing a folded instrument chit does not resurrect a Vocals chit for a person
  who still sings (removal removes; it does not add).
