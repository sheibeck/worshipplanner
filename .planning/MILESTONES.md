# Milestones

## v1.2 Worship Service Slide Management (In progress — since 2026-07-24)

**Migrated from gsdpi** (milestone M001, slices S01-S06) into gsd-core on 2026-07-24. The
`.gsd/` store is now legacy/read-only; work continues with regular `/gsd-*` commands.

**Phases:** 18-23 (6). **Requirements:** `milestones/v1.2-REQUIREMENTS.md` (R001-R020 active).

**Delivered so far:**
- ✅ Phase 18 — Song Lyric Slides and Editor (CCLI paste parser, `songLyrics` store, lyric editor, performance-order builder, version history, `useAutoSave`)
- ✅ Phase 19 — Scripture and Congregational Reading Slides (ESV auto-pull + auto-split, `scriptureSlides` store, `ScriptureSlideEditor`, `CongregationalEditor`)

**Remaining:**
- ▶️ Phase 20 — Service Sections and Slide Auto-Assembly (research done; **next: plan**)
- Phase 21 — PowerPoint Import for Announcements and Sermon
- Phase 22 — Media Attachments and Storage Lifecycle (research done)
- Phase 23 — Presentation Preview Mode

**Decisions:** D001-D006 (unified slide model, single canonical song version, PPTX universal import, server-side parsing, four service sections, CCLI paste). See STATE.md.

---

## v1.0 MVP (Shipped: 2026-03-05)

**Phases completed:** 6 phases (1, 2, 3, 4, 6, 7), 18 plans
**Commits:** 218
**Lines of code:** 12,747 (TypeScript + Vue)
**Timeline:** 2 days (2026-03-03 → 2026-03-04)
**Git range:** cbd8583..66b2202

**Delivered:** A complete worship service planning app with song library, smart Vertical Worship suggestions, AI-powered song/scripture discovery, print/share/export, and team collaboration with RBAC.

**Key accomplishments:**
1. Vue 3 + Firebase foundation with Google/email auth, Firestore security rules, and dark mode app shell
2. Song library with CSV import (Planning Center format), VW type categorization, team tags, search & filter
3. Weekly service planning with 9-slot template, 1-2-2-3/1-2-3-3 progression enforcement, smart song suggestions, scripture input with ESV preview
4. Print layout, Planning Center text export, and shareable read-only links via denormalized Firestore tokens
5. AI-powered song suggestions and natural language scripture discovery using Claude, with graceful degradation
6. Team management with email invite flow and editor/viewer RBAC enforced across Firestore rules, router guards, and UI

**Quick tasks shipped:** 14 polish/UX improvements including autosave, infinite scroll, hymn slots, settings screen, communion checkbox, and rotation visibility fixes

### Known Gaps

Phase 5 (Collaboration, Tasks & Events) deferred to v1.1:
- TASK-01: Recurring tasks with church-specific categories
- TASK-02: Assign tasks to team members with relative due dates
- TASK-03: Check off completed tasks per service week
- EVNT-01: Create special event services
- EVNT-02: Special events on calendar with advance lead time
- EVNT-03: View past special event plans as reference
- EVNT-04: Duplicate past special event to new date

Note: AUTH-03 and AUTH-04 (team invites and shared access) were completed in Phase 7, not Phase 5.

---

