# Phase 13: Volunteer Role Scheduling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 13-volunteer-scheduling-import-servers-from-planning-center-col
**Areas discussed:** Dates & role slots, Proposal algorithm, Roster & CSV import, Output & PC relationship, Blackout date formats, Quarter lifecycle & re-imports, Fairness & tie-breaking, Person lifecycle

---

## Dates & role slots

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate Sundays | Pick a quarter; app generates every Sunday | ✓ |
| From WP services | Use existing WorshipPlanner service plans | |
| From Planning Center | Fetch plan dates from PC | |

| Option | Description | Selected |
|--------|-------------|----------|
| Default template, per-date override | One default role-count set per Sunday, editable per date | ✓ |
| Fixed counts everywhere | One non-editable set for all dates | |
| Blank — leader adds per date | No default | |

| Option | Description | Selected |
|--------|-------------|----------|
| Editable roles | Known defaults, add/rename/remove, grouped | ✓ |
| Fixed roles | Hard-coded role list | |

**User's choice:** Auto-generate Sundays; default template overridable per date; editable roles.
**Notes:** —

---

## Proposal algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Target frequency (1-in-N) | Concrete cadence per person | ✓ |
| Relative priority number | Abstract more/less-often number | |
| Max serves per quarter | A cap only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Blackouts & pairings hard, frequency soft | Hard availability/pairings, soft target | ✓ |
| Everything soft | Best-effort optimize | |
| Everything hard | Strict, leaves gaps | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same dates, own roles | Paired people same dates, each own role | ✓ |
| Directional (follow anchor) | Kid only on parent's dates | |
| Same date AND same role | Both same date and role | |

| Option | Description | Selected |
|--------|-------------|----------|
| Leave empty + flag | Blank + flagged, never violate blackout | ✓ |
| Leave empty + suggest | Also surface closest candidates | |
| Auto-fill over target | Always staff, may overwork | |

**User's choice:** 1-in-N target for everyone; blackouts/pairings hard, frequency soft; pairing = same dates/own roles; unfilled = leave empty + flag.
**Notes:** User directed that worship leaders also use 1-in-N (not forced weekly), and **"worship leader" be removed as a role** — the leaders assign themselves manually. Frequency granularity should support cadences like "once a month" / "twice a month." Roadmap entry corrected accordingly.

---

## Roster & CSV import

| Option | Description | Selected |
|--------|-------------|----------|
| PC = people+roles, CSV = quarterly constraints | Split responsibilities | ✓ |
| CSV does everything | Single CSV path | |
| PC does everything | Incl. availability from PC | |

| Option | Description | Selected |
|--------|-------------|----------|
| Email primary, name fallback, preview unmatched | Robust matching | (superseded) |
| Email only, create if missing | Strict email key | |
| Name only | Match by name | |

| Option | Description | Selected |
|--------|-------------|----------|
| One row per person, multi-value cells | Compact CSV | ✓ |
| One row per person per date | Long format | |
| You propose a format | Defer to planner | |

| Option | Description | Selected |
|--------|-------------|----------|
| Names + suggested roles (editable) | Map PC teams to roles | |
| Names only | Roles assigned in-app | (effective choice) |
| Everything PC has | Incl. blockouts | |

**User's choice:** PC seeds people, CSV carries quarterly constraints; **match by name** (planner won't have emails), one-row-per-person multi-value CSV; PC import brings **name/email/phone** but not blockouts, roles assigned in-app.
**Notes:** User clarified their planner builds the CSV by name from email replies; PC holds name/email/phone/last blockouts but they don't need the blockouts. Name-match resolved via an import preview (Phase 9 pattern).

---

## Output & PC relationship

| Option | Description | Selected |
|--------|-------------|----------|
| WorshipPlanner only (view/print/share) | No PC push | ✓ |
| Also push to PC | Assign PC positions + notifications | |
| WP + export file for PC | Manual hand-entry | |

| Option | Description | Selected |
|--------|-------------|----------|
| Grid: dates × roles | Whole quarter grid | ✓ |
| Per-date cards | Card per Sunday | |
| You decide | Defer layout | |

| Option | Description | Selected |
|--------|-------------|----------|
| External — app just imports CSV | No emailing in app | ✓ |
| App helps draft the ask | Export/draft email | |
| In-app self-service form | Volunteer submits directly | |

**User's choice:** WP-only output; dates×roles grid; external availability collection (CSV import).
**Notes:** User added a key requirement — the grid must also show, per date, **who has blacked out that date** and help find available-but-unassigned candidates, so gaps are easy to spot and fill by contacting people manually.

---

## Blackout date formats

| Option | Description | Selected |
|--------|-------------|----------|
| Single dates + ranges | Individual dates and `..` ranges | ✓ |
| Single dates only | Individual dates only | |
| Dates, ranges + shorthands | Also "all of August" etc. | |

**User's choice:** Single dates + ranges.
**Notes:** —

---

## Quarter lifecycle & re-imports

| Option | Description | Selected |
|--------|-------------|----------|
| Roster + frequency persist, blackouts reset each quarter | Standing roster, per-quarter blackouts | ✓ |
| Everything per-quarter | Clean slate each time | |
| Everything standing until changed | Blackouts linger | |

| Option | Description | Selected |
|--------|-------------|----------|
| Replace per person in the CSV | Per-person upsert/overwrite | ✓ |
| Full replace | New CSV = whole quarter | |
| Merge/append | Add on top, can't remove | |

**User's choice:** Roster/roles/frequency persist, blackouts reset per quarter; same-quarter re-import replaces per person (absent people untouched).
**Notes:** —

---

## Fairness & tie-breaking

| Option | Description | Selected |
|--------|-------------|----------|
| Furthest below their target | Most "owed" relative to frequency | ✓ |
| Least-recently-served | Longest since last serve | |
| You decide | Defer scoring | |

| Option | Description | Selected |
|--------|-------------|----------|
| Let frequency handle it | No special back-to-back rule | ✓ |
| Soft-avoid back-to-back | Mild consecutive-week penalty | |
| Hard no back-to-back | Never consecutive | |

**User's choice:** Furthest-below-target tie-break; no special back-to-back rule.
**Notes:** —

---

## Person lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete (mark inactive) | Drops from proposals, history kept | ✓ |
| Hard delete | Remove entirely | |
| You decide | Defer | |

**User's choice:** Soft-delete / mark inactive (Phase 9 hide/restore pattern).
**Notes:** —

---

## Claude's Discretion

- Firestore data model for people/roles/templates/quarters/blackouts/pairings/calendar (separate people collection, org-level, existing store patterns).
- Constraint-solver implementation (deterministic scored greedy expected; AI not required).
- Default role-count template values and default frequency for newly-imported people.
- CSV header spelling + downloadable template; frequency label ↔ 1-in-N encoding.
- Detailed grid UI layout (may go to /gsd:ui-phase 13).

## Deferred Ideas

- Push assignments to Planning Center (positions + accept/decline notifications).
- In-app self-service availability form (public link, no CSV).
- App-drafted quarterly ask email / contact-list export.
- Blackout shorthands ("all of August", "every 2nd Sunday").
- Multiple services per Sunday.
- Per-role frequency targets.
