# Roadmap: WorshipPlanner

## Overview

Five phases deliver a complete worship planning app: authentication and project foundation first (blocking all other work), then the song stable (prerequisite for planning), then the core planning loop with smart suggestions (the primary differentiator), then printable and shareable output (replacing the current email-the-spreadsheet workflow), and finally collaboration, tasks, and special events (depth features that assume a validated planning loop). Every phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Auth, Firebase setup, Firestore data model, and security rules (completed 2026-03-04)
- [x] **Phase 2: Song Library** - Full song stable management with CSV import and Vertical Worship categorization (completed 2026-03-04)
- [ ] **Phase 3: Service Planning** - Weekly service builder, smart song suggestions, scripture, and calendar
- [ ] **Phase 4: Output** - Print, share, and export service plans
- [ ] **Phase 5: Collaboration, Tasks & Events** - Team invites, recurring tasks, and special event services

## Phase Details

### Phase 1: Foundation
**Goal**: Planners can securely sign in and the app's data model, security rules, and infrastructure are correct from day one
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can sign in with a Google account and is redirected to the app dashboard
  2. User can sign in with email and password as a fallback
  3. A signed-in user stays signed in across page refreshes without bouncing to the login screen
  4. An unauthenticated user cannot access any protected route; they are redirected to login
  5. Firestore data is inaccessible to unauthenticated callers (security rules block it)
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md — Scaffold Vue 3 project, Firebase infra, auth store, router guards, and Firestore security rules
- [x] 01-02-PLAN.md — Build login page, app shell with sidebar, dashboard with getting started checklist

### Phase 2: Song Library
**Goal**: Planners have a complete, searchable song stable with Vertical Worship categories and arrangement data, seeded from a Planning Center CSV export
**Depends on**: Phase 1
**Requirements**: SONG-01, SONG-02, SONG-03, SONG-04, SONG-05, SONG-06
**Success Criteria** (what must be TRUE):
  1. User can import a Planning Center CSV export and see songs appear in the library with correct title, CCLI number, BPM, key, and arrangement data — with a validation preview before any data is committed
  2. User can add, edit, and delete songs manually
  3. User can categorize a song as Vertical Worship type 1, 2, or 3
  4. User can tag songs with team compatibility (choir, orchestra, standard band)
  5. User can search and filter the song list by title, key, tempo, category, and team tag and see only matching results
**Plans:** 3/3 plans complete
Plans:
- [ ] 02-01-PLAN.md — Song types, Pinia store with Firestore subscription + filtering, song table UI with search/filter/badges
- [ ] 02-02-PLAN.md — Slide-over panel for song create/edit/delete, arrangement accordion, batch VW type assign, GettingStarted update
- [ ] 02-03-PLAN.md — CSV import pipeline with PapaParse, preview table, duplicate detection, batched Firestore write

### Phase 3: Service Planning
**Goal**: Planners can build a complete weekly service order — selecting a 4-song progression, getting smart song suggestions filtered by category and team, adding scripture, and viewing all planned weeks on a calendar
**Depends on**: Phase 2
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08, PLAN-09, SCRI-01, SCRI-02, SCRI-03, SCRI-04, CAL-01, CAL-02, CAL-03
**Success Criteria** (what must be TRUE):
  1. User can create a service plan for a specific date following the standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song)
  2. User selects a 1-2-2-3 or 1-2-3-3 progression and song slots enforce the correct Vertical Worship category for each slot
  3. App suggests ranked songs for each slot filtered by the slot's required category and the service's team configuration, with songs used in the last 2 weeks deprioritized
  4. User can override any suggestion and manually pick any eligible song
  5. User can add scripture passages and record the pastor's sermon passage to prevent duplication in readings
  6. User can view all planned and recent services week-by-week and see a seasonal overview that reveals song rotation patterns
**Plans:** 4/5 plans executed
Plans:
- [ ] 03-01-PLAN.md — Service types, slot type utilities, scripture utilities, suggestion algorithm, and rotation table (pure TypeScript)
- [ ] 03-02-PLAN.md — Service Pinia store with Firestore subscription and CRUD, route registration, GettingStarted step 3
- [ ] 03-03-PLAN.md — Service editor view with 9-slot template, song slot picker dropdown, scripture input
- [ ] 03-04-PLAN.md — Services list view with week cards, new service dialog, seasonal rotation table
- [ ] 03-05-PLAN.md — Human verification of complete service planning workflow

### Phase 4: Output
**Goal**: Planners can produce formatted orders of service for rehearsal and Sunday, share a mobile-friendly plan link, and export structured data for Planning Center entry
**Depends on**: Phase 3
**Requirements**: OUT-01, OUT-02, OUT-03
**Success Criteria** (what must be TRUE):
  1. User can print a formatted order of service that renders correctly on paper (no cut-off text, correct page breaks)
  2. A team member opening a shareable link on a phone can read the full service plan without logging in
  3. User can export a service plan in a structured format that lists all fields needed for manual Planning Center entry
**Plans:** 1/2 plans executed
Plans:
- [ ] 04-01-PLAN.md — Print layout component, Planning Center text export formatter, Print and Copy for PC buttons in service editor
- [ ] 04-02-PLAN.md — Shareable link with Firestore token, public ShareView page, Share button in service editor

### Phase 5: Collaboration, Tasks & Events
**Goal**: Multiple planners can collaborate on the same song stable and service plans, team tasks are tracked per service week, and special events are planned distinctly from weekly services
**Depends on**: Phase 4
**Requirements**: AUTH-03, AUTH-04, TASK-01, TASK-02, TASK-03, EVNT-01, EVNT-02, EVNT-03, EVNT-04
**Success Criteria** (what must be TRUE):
  1. An admin can invite a team member by email; the invited user clicks the link, signs in, and gains access to the shared song stable and service plans
  2. User can create recurring task checklists with worship-specific categories (Administrative, Communication, Rehearsal, Technical, etc.) and assign tasks to team members with due dates relative to service date
  3. User can check off tasks per service week and see which tasks are outstanding
  4. User can create a special event (Christmas Eve, Easter, etc.) that appears on the calendar with appropriate advance lead time, can be viewed as a past reference, and can be duplicated to a new date
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-04 |
| 2. Song Library | 3/3 | Complete   | 2026-03-04 |
| 3. Service Planning | 4/5 | In Progress|  |
| 4. Output | 1/2 | In Progress|  |
| 5. Collaboration, Tasks & Events | 0/TBD | Not started | - |
