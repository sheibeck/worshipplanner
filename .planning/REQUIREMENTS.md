# Requirements: WorshipPlanner — v2.3 Scheduling Accuracy & Song/Team Refinements

**Defined:** 2026-08-25
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song progression) while rotating through the full song stable and respecting team configurations.

REQ-IDs continue the project's sequential `R###` numbering from the last shipped milestone (v2.2 ended at R246).

## v2.3 Requirements

### Scheduling Data Integrity — Last-Used Dates

- [ ] **R247**: A song's "last used" / "last scheduled" date reflects the most recent service the song was actually added to — including services that are locked and/or exported — rather than lagging behind reality (the reported bug: "His Mercy Is More" showed Aug 11 despite a locked & exported Sep 6 service).
- [ ] **R248**: A one-time backfill script recomputes every song's last-used date from all services the song has ever been added to, correcting records created before the R247 fix landed.

### Song Editing

- [ ] **R249**: A planner can update/edit the Key of a song directly on the song record.

### Volunteer Scheduling — Team Conflicts

- [ ] **R250**: Vocals is folded into the Band team — a vocals assignment is a Band role rather than a separate team — so the roster/scheduler treats singing as part of Band.
- [ ] **R251**: A volunteer cannot be scheduled on two different teams on the same service date (e.g. running Tech and also playing in the Band); the scheduler prevents the cross-team double-booking.
- [ ] **R252**: Vocals is the single special-case exception to R251 — Vocals may be filled by multiple people, and a person assigned to Vocals may simultaneously hold one Band instrument role on the same date (sing and play at once).

### Scripture Rotation Accuracy

- [ ] **R253**: The Scripture rotation tab lists only scripture items that were added to the service plan, and never includes the sermon/teaching passage.

### Recurring Team Scheduling

- [ ] **R254**: A planner can assign a team a recurring schedule pattern — every Nth week, or the Nth Sunday of the month — configured from a `>` slideout on the Volunteer → Teams tab, matching the slideout pattern the Song table already uses.
- [ ] **R255**: When a service's date matches a team's configured recurring pattern, that team is automatically pre-selected on the service.

### Scheduler UI Copy Accuracy

- [ ] **R256**: The schedulable-roles "default count" description accurately reflects the scheduler's real behavior (it targets that count) and no longer describes it as a "soft planning target."

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

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R247 | TBD | Pending |
| R248 | TBD | Pending |
| R249 | TBD | Pending |
| R250 | TBD | Pending |
| R251 | TBD | Pending |
| R252 | TBD | Pending |
| R253 | TBD | Pending |
| R254 | TBD | Pending |
| R255 | TBD | Pending |
| R256 | TBD | Pending |

**Coverage:**
- v2.3 requirements: 10 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 10 ⚠️

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-25 after v2.3 milestone scoping*
