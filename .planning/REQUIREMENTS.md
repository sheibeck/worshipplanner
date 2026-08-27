# Requirements: WorshipPlanner — v2.3 Scheduling Accuracy & Song/Team Refinements

**Defined:** 2026-08-25
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

REQ-IDs continue the project's sequential `R###` numbering from the last shipped milestone (v2.2 ended at R246).

## v2.3 Requirements

### Scheduling Data Integrity — Last-Used Dates

- [x] **R247**: A song's "last used" / "last scheduled" date reflects the most recent service the song was actually added to — including services that are locked and/or exported — rather than lagging behind reality (the reported bug: "His Mercy Is More" showed Aug 11 despite a locked & exported Sep 6 service). — **Phase 84**
- [x] **R248**: A one-time backfill script recomputes every song's last-used date from all services the song has ever been added to, correcting records created before the R247 fix landed. — **Phase 84**

### Song Editing

- [x] **R249**: A planner can update/edit the Key of a song directly on the song record. — **Phase 87**

### Volunteer Scheduling — Team Conflicts

- [x] **R250**: Vocals is folded into the Band team — a vocals assignment is a Band role rather than a separate team — so the roster/scheduler treats singing as part of Band. — **Phase 85**
- [x] **R251**: A volunteer cannot be scheduled on two different teams on the same service date (e.g. running Tech and also playing in the Band); the scheduler prevents the cross-team double-booking. — **Phase 85**
- [x] **R252**: Vocals is the single special-case exception to R251 — Vocals may be filled by multiple people, and a person assigned to Vocals may simultaneously hold one Band instrument role on the same date (sing and play at once). — **Phase 85**

### Scripture Rotation Accuracy

- [x] **R253**: The Scripture rotation tab lists only scripture items that were added to the service plan, and never includes the sermon/teaching passage. — **Phase 87**

### Recurring Team Scheduling

- [x] **R254**: A planner can assign a team a recurring schedule pattern — every Nth week, or the Nth Sunday of the month — configured from a `>` slideout on the Volunteer → Teams tab, matching the slideout pattern the Song table already uses. — **Phase 86** (storage model + matching helper laid in 86-01; the `>` slideout UI ships in 86-02)
- [x] **R255**: When a service's date matches a team's configured recurring pattern, that team is automatically pre-selected on the service. — **Phase 86**

### Scheduler UI Copy Accuracy

- [x] **R256**: The schedulable-roles "default count" description accurately reflects the scheduler's real behavior (it targets that count) and no longer describes it as a "soft planning target." — **Phase 87**

### Editing-UX Polish (added 2026-08-26 from v2.3 UAT)

- [x] **R257**: The Volunteer → Roles and Teams tabs present read-only rows that open a right-side slideout on click for editing (mirroring the Songs table + SongSlideOver pattern), with add/edit/delete performed in the slideout and a header "+ Add" for create mode — replacing the current always-inline-editable rows. — **Phase 88**
- [x] **R258**: A song's Key is chosen from a searchable type-ahead dropdown of available musical keys (rather than the free-text input from R249). — **Phase 88**

### Multi-Role Scheduling (added 2026-08-27 from v2.3 UAT)

- [ ] **R259**: Generalize the Phase-85 vocals "sing & play" exemption into a per-role **multi-role** flag settable on any role in any group (vocals ships with it ON by default; helper text explains it). A person may hold multiple multi-role roles on the same date **crossing Band/Tech/Other**; non-multi-role roles keep the normal one-role-per-date exclusivity (and the one-instrument-per-Band cap still applies to non-multi-role band roles). — **Phase 89**
- [ ] **R260**: The quarterly scheduler **weights a person's multi-role assignments to fall on the same date** — anchored on the person's rarest multi-role, with higher-cadence roles riding along on those dates and filling their extra occurrences elsewhere — as a strong preference that still yields to coverage and per-role cadence caps (a role fills solo rather than being left empty when it can't bundle). — **Phase 89**

## Future Requirements

Deferred; not in the v2.3 roadmap.

### Recurring Scheduling (extended)

- **R-FUT**: Schedule a team on arbitrary specific individual dates (not just a repeating pattern). Deferred by owner decision 2026-08-25 — v2.3 covers consistent repeating patterns only (every Nth week / Nth Sunday of the month).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Arbitrary per-date team scheduling (pick individual calendar dates) | Owner scoped v2.3 to consistent repeating patterns only (every Nth week / Nth Sunday of the month) |
| Changing the scheduler's hard-target-the-count behavior | R256 is a copy fix only — the owner confirmed the current targeting behavior is fine; only the description is wrong |
| Auto-assigning specific volunteers via recurring patterns | R254/R255 auto-select the *team* on matching dates; staffing individuals remains a manual per-service step |
| Migrating historical volunteer assignments when Vocals folds into Band | Scope is the model + scheduler rules going forward; any data migration is decided during phase planning, not a committed requirement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R247 | Phase 84 | Complete |
| R248 | Phase 84 | Complete |
| R249 | Phase 87 | Complete |
| R250 | Phase 85 | Complete |
| R251 | Phase 85 | Complete |
| R252 | Phase 85 | Complete |
| R253 | Phase 87 | Complete |
| R254 | Phase 86 | Complete |
| R255 | Phase 86 | Complete |
| R256 | Phase 87 | Complete |
| R257 | Phase 88 | Complete |
| R258 | Phase 88 | Complete |
| R259 | Phase 89 | Pending |
| R260 | Phase 89 | Pending |

**Coverage:**

- v2.3 requirements: 14 total
- Mapped to phases: 14 (Phases 84–89)
- Unmapped: 0 ✓

**Phase rollup:**

- Phase 84 — Last-Used Date Correctness & Backfill: R247, R248
- Phase 85 — Team Conflicts (Vocals into Band & One-Team-Per-Date): R250, R251, R252
- Phase 86 — Recurring Team Scheduling: R254, R255
- Phase 87 — Song & Rotation Refinements: R249, R253, R256
- Phase 88 — Editing-UX Polish (Roles/Teams slideout + song Key typeahead): R257, R258
- Phase 89 — Multi-Role Scheduling (generalized combinable flag + same-date bundling): R259, R260

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-27 — added R259/R260 (multi-role flag + same-date bundling) from v2.3 UAT, mapped to new Phase 89; R257/R258 → Phase 88.*
