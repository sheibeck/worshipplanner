---
sketch: 001
name: availability-editor
question: "How does the leader move between the roster overview and per-person availability editing, and does the Sundays-only calendar read clearly?"
winner: null
tags: [layout, scheduling, availability, forms, phase-14]
---

# Sketch 001: Quarter Availability Editor

## Design Question
Replaces the Phase 13 CSV import. The leader transcribes quarterly email replies directly
into the app. What layout makes per-person availability entry fast and error-proof — and does
a **Sundays-only calendar** (you can only click real service dates) read clearly?

## How to View
open .planning/sketches/001-availability-editor/index.html

## Variants
- **A: Right drawer** — roster stays full-width and scannable; clicking a row slides the editor in from the right. Best when you mostly review and touch a few people.
- **B: Master-detail split** — compact name list on the left, editor always open on the right. Fastest for powering down the whole roster in one sitting.
- **C: Inline expand** — clicking a row opens the editor in place (accordion), full-width beneath it. Keeps you anchored in the list with the most room for the calendar.

All three share the same core controls:
- **Frequency** segmented control (Every week / Twice a month / Monthly / As-needed fill-in / Out this quarter) with a live "≈ X of 13 Sundays" readout + advanced raw 1-in-N.
- **Sundays-only blackout calendar** — tap Sundays to toggle, "Nth Sunday" chips auto-select, date-range blocks the Sundays inside it.
- **Must-serve-with** typeahead → bidirectional pairing chips.
- **Quarter note** free text.

## What to Look For
- Which navigation model fits real use — reviewing a few people (A) vs. bulk entry down the list (B) vs. staying in-context (C)?
- Does the Sundays-only calendar make blackout entry obviously easier than the CSV columns it replaces?
- Do the "Nth Sunday" chips + range picker feel like enough to express the real patterns (1st Sundays, ranges, specific dates) seen in the sample notes?
- Is the frequency segmented control the right abstraction over the messy real-world spellings ("any", "as needed", "1 week off/month", "0")?

## Sample data
Real volunteers from `docs/Sample Frequency Notes.csv`: Anne (monthly, 1st Sundays), Krystyn
(only 2nd week available), David DeBoer (fill-in only), John Segard (out this quarter), Tim
Paasche (~3-of-4), Julia Woodard (must-serve-with Dean/Lisa). Quarter = Q3 2026 (13 Sundays).
