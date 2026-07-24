# ⚠️ This directory is FROZEN — migrated to gsd-core

**Date:** 2026-07-24

The gsdpi milestone **M001: Worship Service Slide Management** and its slices (S01–S06)
were faithfully migrated into the regular **gsd-core** planning structure under `.planning/`.

**Do not continue work here.** This `.gsd/` tree is retained read-only for historical
reference and provenance only.

## Where the work lives now

| gsdpi (here, `.gsd/`) | gsd-core (`.planning/`) |
|---|---|
| Milestone M001 | Milestone **v1.2** (`.planning/MILESTONES.md`, `.planning/ROADMAP.md`) |
| Requirements R001–R027 | `.planning/milestones/v1.2-REQUIREMENTS.md` |
| Decisions D001–D006 | `.planning/STATE.md` (v1.2 Decisions section) |
| Slice S01 (complete) | Phase 18 — `.planning/phases/18-song-lyric-slides-and-editor/` |
| Slice S02 (complete) | Phase 19 — `.planning/phases/19-scripture-and-congregational-reading-slides/` |
| Slice S03 (active)   | Phase 20 — `.planning/phases/20-service-sections-and-slide-auto-assembly/` |
| Slice S04            | Phase 21 — `.planning/phases/21-powerpoint-import-announcements-and-sermon/` |
| Slice S05            | Phase 22 — `.planning/phases/22-media-attachments-and-storage-lifecycle/` |
| Slice S06            | Phase 23 — `.planning/phases/23-presentation-preview-mode/` |

## How to continue

Use the regular gsd commands in Claude Code (they read `.planning/`, not `.gsd/`):

- `/gsd-progress` — situational awareness + next step
- `/gsd-plan-phase 20` — plan the active phase (Service Sections & Slide Auto-Assembly)
- `/gsd-execute-phase 20` — execute after planning
