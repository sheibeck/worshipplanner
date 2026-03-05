# Roadmap: WorshipPlanner

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4, 6-7 (shipped 2026-03-05)
- 📋 **v1.1** — Phases 5, 8 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4, 6-7) — SHIPPED 2026-03-05</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-04
- [x] Phase 2: Song Library (3/3 plans) — completed 2026-03-04
- [x] Phase 3: Service Planning (5/5 plans) — completed 2026-03-04
- [x] Phase 4: Output (2/2 plans) — completed 2026-03-04
- [x] Phase 6: AI Assisted Service Suggesting (4/4 plans) — completed 2026-03-04
- [x] Phase 7: Invite & RBAC (2/2 plans) — completed 2026-03-04

Full details: milestones/v1.0-ROADMAP.md

</details>

### 📋 v1.1 (Planned)

- [ ] Phase 5: Collaboration, Tasks & Events (TBD plans)
- [ ] Phase 8: Planning Center API Export (3 plans)

## Phase Details

### Phase 5: Collaboration, Tasks & Events
**Goal**: Recurring task checklists with church-specific categories, task assignment with relative due dates, and special event services (Christmas Eve, Easter, etc.) with calendar integration and duplication.
**Depends on**: Phase 4
**Requirements**: TASK-01, TASK-02, TASK-03, EVNT-01, EVNT-02, EVNT-03, EVNT-04
**Plans:** 0/TBD plans

### Phase 8: Planning Center API Export
**Goal:** Export published (locked) service plans to Planning Center via the Services API — creating a plan with sermon scripture as title, adding songs/hymns as Song items and scriptures as Item entries
**Depends on**: Phase 4
**Requirements**: PC-SC1, PC-SC2, PC-SC3, PC-SC4, PC-SC5, PC-SC6
**Success Criteria** (what must be TRUE):
  1. When a service plan is published/locked, an "Export to Planning Center" button replaces the "Copy for PC" button
  2. Clicking export creates a new Plan in Planning Center for the service date with the sermon scripture reference as the plan title, appending special info in parens (e.g., "Revelation 12 (Choir)")
  3. Each song/hymn slot is added as a Song item in the Planning Center plan
  4. Each scripture slot is added as an Item with the scripture text in the item description
  5. User sees success/failure feedback after export completes
  6. Planning Center API credentials (App ID + Secret) are configured in app settings
**Plans:** 2/3 plans executed

Plans:
- [ ] 08-01-PLAN.md — PC API client utility, Service type extension, Vite dev proxy
- [ ] 08-02-PLAN.md — Settings UI for PC credentials and service type selection
- [ ] 08-03-PLAN.md — Export flow in ServiceEditorView with button, feedback, and exported state

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-04 |
| 2. Song Library | v1.0 | 3/3 | Complete | 2026-03-04 |
| 3. Service Planning | v1.0 | 5/5 | Complete | 2026-03-04 |
| 4. Output | v1.0 | 2/2 | Complete | 2026-03-04 |
| 6. AI Assisted Service Suggesting | v1.0 | 4/4 | Complete | 2026-03-04 |
| 7. Invite & RBAC | v1.0 | 2/2 | Complete | 2026-03-04 |
| 5. Collaboration, Tasks & Events | v1.1 | 0/TBD | Not started | - |
| 8. Planning Center API Export | 2/3 | In Progress|  | - |
