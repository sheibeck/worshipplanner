# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-05
**Phases:** 6 | **Plans:** 18 | **Commits:** 218

### What Was Built
- Complete song library with CSV import, VW type categorization, team tags, search & filter
- Weekly service planning with 9-slot template, progression enforcement, smart suggestion algorithm
- Print layout, Planning Center text export, and shareable read-only links
- AI-powered song suggestions and natural language scripture discovery using Claude
- Team management with email invite flow and editor/viewer RBAC
- 14 quick-task UX improvements (autosave, hymn slots, infinite scroll, settings, rotation tables)

### What Worked
- Phase-based execution with clear dependency ordering kept work focused
- Denormalized Firestore patterns (song snapshots in slots, shareTokens) eliminated N+1 reads
- Static Tailwind class lookups (not dynamic string interpolation) prevented v4 purge issues — pattern reused in every component with dynamic classes
- Teleport-to-body pattern for dropdowns/slide-overs solved AppShell overflow stacking consistently
- AI features designed as additive (never blocking) — graceful null-return on error means the app works without API key
- Quick tasks provided effective polish between major phases without disrupting phase structure

### What Was Inefficient
- Phase 3 ROADMAP shows 4/5 plans but disk shows 5/5 — roadmap wasn't updated when plan 05 completed
- Phase 5 scope was originally too broad (auth + tasks + events) — auth was extracted to Phase 7, but Phase 5 remains unstarted with just tasks/events
- Some plan checkboxes in ROADMAP.md were never checked despite plans being complete (cosmetic inconsistency)
- STATE.md progress tracking fell behind — showed 50% when actual was 100%

### Patterns Established
- Dark mode canonical palette: gray-950 body, gray-900 cards/sidebar, gray-800 inputs
- Pinia stores subscribe via onSnapshot (not VueFire composables)
- Static class lookup objects for Tailwind v4 purge safety
- Teleport to body for z-index escape from AppShell overflow
- signInWithPopup preferred over signInWithRedirect
- AI functions return null on error, never throw
- orgId/userRole centralized in auth store — no ad-hoc getDoc calls

### Key Lessons
1. Denormalize early for Firestore — read-time joins are expensive and complex
2. VW type as soft priority signal (+100 bonus) works better than hard filter — lets planners see all songs with smart ordering
3. Autosave with debounce + one-step undo is worth the complexity over explicit save buttons
4. Team filtering with AND logic (song must support ALL active teams) is the correct semantic

### Cost Observations
- Model mix: primarily opus for planning/execution, haiku for AI suggestions in-app
- Sessions: ~20+ across 2 days
- Notable: Entire v1.0 MVP built in 2 calendar days with 218 commits

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 218 | 6 | Initial build — established all patterns |

### Cumulative Quality

| Milestone | LOC | Quick Tasks | Known Gaps |
|-----------|-----|-------------|------------|
| v1.0 | 12,747 | 14 | Phase 5 (Tasks & Events) deferred |

### Top Lessons (Verified Across Milestones)

1. Static Tailwind class lookups prevent v4 purge — confirmed across 5+ components
2. Firestore denormalization pays off at read time — confirmed across songs, services, shareTokens
