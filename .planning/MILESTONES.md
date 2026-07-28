# Milestones

## v1.4 Service and Slides (In progress — since 2026-07-28)

**Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you can see,
slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Phases:** 29+ (roadmap pending). **Requirements:** `.planning/REQUIREMENTS.md` (pending).

Scope covers service lifecycle locking, autosave reliability + app-wide save visibility, a fifth
Post-Service section, the long-standing drag-and-drop reordering corruption, hard-locking slide groups
to the service order (deleting the reconcile/confirm flow), slide interaction fixes, backgrounds at
group/slide/song level, presentation correctness (labels, CCLI copyright), true-fidelity PPTX rendering,
LLM-assisted congregational reading splits, lyric-editor copyright warnings, and a contextual
action-bar audit across every tabbed screen.

First milestone with `workflow.verifier: true` — every phase produces a real `VERIFICATION.md`.

---

## v1.3 Slides Tab Rework (Shipped: 2026-07-28)

**Phases:** 24-28 (5), 33 plans. **Requirements:** `milestones/v1.3-REQUIREMENTS.md` (R028-R035).

**Delivered:** A persisted slide-group model and a dedicated **Slides** tab where all slide editing
lives — plan rail mirroring the service order, Edit Slide drawer, and a song lyrics editor rebuilt as
one list that IS the slide order. The first tab was renamed **Service Order** and stripped of slide
editing.

**Verification:** closed on direct owner verification, not an automated gate — `workflow.verifier` was
`false` for the whole milestone. Each phase carries an owner-attributed `*-VERIFICATION.md` stating so
explicitly.

**Notable defects caught during the milestone:** a compounding reconciliation bug (2→4→8→16 slide
duplication on the additive path, which has no confirm gate) and two competing `performanceOrder`
fields where the builder read one but wrote the other.

---

## v1.2 Worship Service Slide Management (Shipped: 2026-07-28)

**Migrated from gsdpi** (milestone M001, slices S01-S06) into gsd-core on 2026-07-24. The
`.gsd/` store is legacy/read-only.

**Phases:** 18-23 (6). **Requirements:** `milestones/v1.2-REQUIREMENTS.md` (R001-R020).

**Delivered:** Song lyric slides + CCLI paste parser and editor; scripture and congregational reading
slides with ESV auto-pull; four formalized service sections with slide auto-assembly; PowerPoint import
for announcements and sermon; media attachments with a storage lifecycle; presentation preview mode.

**Verification:** closed by explicit owner acceptance with checkpoints waived — *"close v1.2. I've
verified everything I need to anyway."* Phases 18-23 were never verified by a passing gate. Recorded
plainly so this milestone's archived state is not later read as evidence the checkpoints ran.

**Decisions:** D001-D006 (unified slide model, single canonical song version, PPTX universal import,
server-side parsing, four service sections, CCLI paste). See STATE.md.

---

## v1.1 (Shipped: 2026-07-24)

**Phases:** 8-17 plus 16.1 (11 total). Archived to `milestones/v1.1-phases/`.

**Delivered:** Planning Center API export for published plans; PC song import and tag management; song
export naming templates; song catalog and service planner improvements; advanced song search with
multi-select persistent tag filtering; volunteer role scheduling with PC roster import; in-app quarterly
availability editor; per-role serve frequency and role-category rules; quarterly schedule share links;
song list tag/column customization; schedule sync with planned services plus a Roles tab on the service
editor.

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

