# Worship Planner

## What This Is

A Vue 3 + Firebase web application for small church worship teams to plan services, manage songs, schedule volunteers, and coordinate worship flow. The app currently supports song catalog management with CCLI integration, service planning with ordered slots (songs, scripture, prayer, message, hymns), volunteer scheduling via quarter grids, Planning Center import/export, and ESV API scripture lookup. It is deployed and actively used.

## Core Value

A single, approachable platform where non-technical church volunteers can plan and run a complete worship service — from song selection through slide projection — without dedicated tech staff or complex software like ProPresenter.

## Project Shape

- **Complexity:** complex
- **Why:** Multiple content types (lyrics, scripture, imported PPTX, media), service-order-driven auto-assembly, Cloud Function for server-side parsing, and a presentation preview mode — all targeting a non-technical audience that demands polished UX
- **Web stack:** Vue 3 + Vite + Tailwind CSS v4, Firebase (Firestore + Storage + Cloud Functions + Auth)

## Current State

The app has a working song catalog with CCLI numbers, arrangements, and VW type categorization. Services can be created with ordered slots (SONG, SCRIPTURE, PRAYER, MESSAGE, HYMN) using a progression-based template. Volunteer scheduling works via quarter grids with role management. Planning Center import/export and ESV API scripture lookup are integrated. The app uses Pinia stores, Vue Router, and hand-rolled Tailwind components (modals, slide-over drawers, sortable tables, collapsible sections). No slide/lyrics functionality exists yet.

## Architecture / Key Patterns

- **Frontend:** Vue 3 Composition API + Pinia stores + Vue Router, Tailwind CSS v4 (dark-first, no component library)
- **Backend:** Firebase (Firestore for data, Cloud Functions for server-side logic, Auth for identity)
- **UI patterns:** Hand-rolled components — slide-over drawers, modals with Teleport + Transition, SortableJS drag-and-drop, collapsible sections, inline editing
- **Data model:** Services have ordered slots with `position` field and `reindexSlots()` for reordering; Songs have arrangements, CCLI numbers, VW types
- **API integrations:** ESV API (proxied through Cloud Function), Planning Center API
- **Testing:** Vitest for unit tests, Firebase emulator for rules tests

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: Worship Service Slide Management — Full slide system for building, editing, assembling, and previewing service slideshows with lyrics, scripture, imported presentations, and media