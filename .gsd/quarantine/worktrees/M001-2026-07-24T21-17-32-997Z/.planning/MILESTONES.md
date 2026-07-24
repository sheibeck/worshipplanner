# Milestones

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

