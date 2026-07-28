# Phase 14 Discussion Log

**Date:** 2026-07-07
**Mode:** discuss (interactive)

Human-reference record of the discussion. Not consumed by downstream agents — see `14-CONTEXT.md` for the canonical decisions.

## Origin

User request had three parts:
1. Analyze `docs/Sample Frequency Notes.csv` (real, messy quarterly availability notes) and build an in-app editor to replace the CSV import — the app controls input shape so nothing needs cleaning.
2. Use sketch `001-availability-editor` **Variant A — Right drawer**.
3. Make this Phase 14. Also fold in: stop importing the whole Planning Center directory; import selectively.

Phase 14 did not exist — added to `ROADMAP.md` before discussing (goal + scope: editor + selective import).

## Pre-locked by request (not re-asked)
- In-app editor replaces CSV as primary input (CSV stays as secondary bulk option).
- Variant A — Right drawer.
- Core controls: Sundays-only blackout calendar, frequency segmented control, must-serve-with pairing, quarter note.
- Selective PC import instead of bulk.
- Writes go through existing store (`applyCsvToQuarter`-style), not CSV.

## Gray areas discussed

| Area | Options presented | Selected |
|------|-------------------|----------|
| Frequency model (fill-in vs out) | (a) Fill-in=last resort, Out=excluded / (b) Out=excluded, fill-in=high N / (c) discuss scheduler | **(a) Fill-in = last resort, Out = excluded** |
| Selective import mechanism | By PC Team / By person checklist / Both | **By PC Team** — later refined to team + specific role/position |
| Editor location | Quarter/Schedule page / Roster page / New dedicated route | **Quarter/Schedule page** |
| Pairing scope | Bidirectional must-serve-with only / add directional / discuss | **Bidirectional must-serve-with only** (conditional rules → quarter note) |

## Follow-up refinements (user messages during discussion)

- **Clear volunteers:** User confirmed the "Clear all volunteers" danger action already exists (commit `0b55d76`, `deleteAllPeople`). Deletion is OUT of scope. I noted a minor known gap: `deleteAllPeople` leaves orphaned `personQuarterData` on quarter docs (deferred, low-risk).
- **Selective import sharpened:** import only people **currently serving on a worship team** in a **specific individually-scheduled role**; **exclude choir and orchestra** (group roles, not filled by individual). Mechanism: reuse `fetchTeamPositions` to surface positions, leader includes only individual roles, map PC position → WorshipPlanner Role.

## Deferred
- Structured conditional pairing rules (directional / conditional) — quarter note for now.
- Orphaned `personQuarterData` cleanup on `deleteAllPeople`.

## Guidance given
- To clear current volunteers: use the in-app **Roster → "Clear all volunteers"** (type-to-confirm) button in the authenticated browser session — not doable safely from CLI against live Firestore.
