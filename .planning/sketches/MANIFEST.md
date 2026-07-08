# Sketch Manifest

## Design Direction
In-app **Quarter Availability Editor** for volunteer scheduling (proposed Phase 14) that
replaces the Phase 13 CSV import round-trip. The leader transcribes quarterly email replies
directly into constrained controls — a Sundays-only blackout calendar, a frequency segmented
control, and a bidirectional pairing picker — so no data ever arrives as free-text or CSV.
Dark, Tailwind-styled to match the existing WorshipPlanner app (gray-900 surfaces; band=blue,
tech=purple, other=gray role groups; amber/green/red status accents).

## Reference Points
- The existing WorshipPlanner app UI (dark theme, role-group color coding from Phase 13).
- `docs/Sample Frequency Notes.csv` — the real, messy quarterly notes this UI structures.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | availability-editor | Table→editor navigation model + Sundays-only calendar clarity | TBD | layout, scheduling, availability, phase-14 |
