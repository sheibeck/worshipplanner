---
phase: 03-service-planning
plan: 05
subsystem: verification
tags: [human-verification, uat]

# Dependency graph
requires:
  - phase: 03-03
    provides: ServiceEditorView, SongSlotPicker, ScriptureInput
  - phase: 03-04
    provides: ServicesView, ServiceCard, NewServiceDialog, RotationTable
---

# Plan 03-05 Summary: Human Verification

## What was verified

Complete service planning workflow tested end-to-end by user with feedback-driven fixes applied during the verification session.

## Issues found and resolved

1. **ESV link format** — Changed from `/search/Book+Chapter:Verse-Verse` to `esv.org/Book+Chapter` (simpler, user preference)
2. **SongSlotPicker overflow** — Dropdown rendered off-screen when trigger near viewport bottom; added flip-above logic with height capping
3. **ServiceCard order of service** — Changed from songs-only to full slot listing (songs, scriptures, prayer, message)
4. **Clickable ESV links** — Scripture readings and sermon passage now link to ESV.org directly from service listing
5. **Service card sections** — Split into opening worship / message / sending song with divider lines
6. **Communion badge** — Added amber badge for first-Sunday-of-month services (listing + editor)
7. **Progression removal** — Removed progression selection from UI; defaults internally for VW type guidance
8. **Special service naming** — Added name field for special services, shown on listing card
9. **Name save bug** — Fixed missing `name` field in `updateService` call

## Key files modified

- `src/utils/scripture.ts` — esvLink simplified to (book, chapter) signature
- `src/components/SongSlotPicker.vue` — Flip-above dropdown positioning
- `src/components/ServiceCard.vue` — Full order of service with sections, ESV links, communion badge, service name
- `src/views/ServiceEditorView.vue` — Communion badge, service name input, name in save
- `src/components/NewServiceDialog.vue` — Removed progression, added name for special services
- `src/types/service.ts` — Added `name` field to Service
- `src/stores/services.ts` — Updated CreateServiceInput, default progression

## Self-Check: PASSED

User approved the complete service planning workflow after all fixes applied.
