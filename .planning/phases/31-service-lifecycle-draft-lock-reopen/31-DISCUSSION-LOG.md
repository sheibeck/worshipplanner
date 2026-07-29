# Phase 31: Service Lifecycle — Draft Lock & Reopen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 31-Service Lifecycle — Draft Lock & Reopen
**Areas discussed:** Status control redesign, What "locked" looks like, Reopen friction + PC warning, Nearest Sunday semantics

---

## Area selection

All four offered areas were selected. Firestore rules mechanics and the store-guard layer were
explicitly withheld from the menu as Claude/research work rather than owner decisions.

---

## Status control redesign

| Option | Description | Selected |
|--------|-------------|----------|
| Display + named actions | Badge becomes a non-clickable pill; explicit "Mark as Planned" / "Reopen for editing" buttons per legal transition; `exported` reachable only via a real PC export | ✓ |
| Keep a cycle, but restricted | Badge stays clickable, toggles draft ↔ planned only; Exported badge opens the reopen confirm | |
| Dropdown status picker | Badge opens a menu of legal target states with consequences spelled out | |

**User's choice:** Display + named actions
**Notes:** Scouting had surfaced that `toggleStatus` (`ServiceEditorView.vue:1796`) is a blind
three-way cycle, which is how a service can currently be marked "Exported" without ever being
exported, and how reopening happens today with no warning at all.

---

## Status control — how the Planning Center warning decides

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on `pcExportedAt`/`pcPlanId` | Warn only when real export evidence exists; a hand-set "Exported" reopens quietly; legacy data self-corrects with no migration | ✓ |
| Gate on `status === 'exported'` | Simpler, but lies about hand-set statuses and teaches users to ignore the warning | |
| Gate on evidence, and repair the status | Same as chosen, plus correcting bad statuses on load — rejected as an unrequested write | |

**User's choice:** Gate on `pcExportedAt`/`pcPlanId`
**Notes:** Raised because the old cycle means live data may hold services at `exported` that were
never exported, which would make R037's warning false for those rows.

---

## What "locked" looks like

| Option | Description | Selected |
|--------|-------------|----------|
| Banner + controls removed | One banner near the status pill with the Reopen action; mutation controls not rendered | ✓ |
| Banner + controls disabled | Same banner, controls greyed out so the user sees what returns on reopen | |
| Per-tab banners | Each tab carries its own notice, adjacent to what was touched, but repeats the message | |

**User's choice:** Banner + controls removed
**Notes:** Consistent with Phase 30's R054 read-only precedent — state the reason once, visibly,
rather than rendering dead affordances.

---

## What "locked" looks like — non-editing carve-outs

| Option | Description | Selected |
|--------|-------------|----------|
| Export / Copy to Planning Center | Mandatory — the export flow only runs at `planned`, so locking it makes `exported` unreachable | ✓ |
| Present / preview the slideshow | Read-only projection; arguably the point of locking | ✓ |
| Print and Share link | Both render a snapshot; neither mutates the service | ✓ |
| Notes and sermon topic stay editable | Treat free-text as metadata outside the lock — deviates from R036 | |

**User's choice:** Export/Copy to PC, Present, Print and Share. Notes/sermon topic NOT carved out.
**Notes:** The export carve-out is load-bearing: the export writes `pcExportedAt`, `pcPlanId` and
flips `status`, so all three enforcement layers must permit that one write.

---

## Reopen friction

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm only when exported | One click from Planned; confirm dialog with the PC warning from Exported | ✓ |
| Always confirm | Consistent, but a dialog with nothing to warn about trains click-through | |
| Never confirm — inline warning only | Fastest, but the user learns the consequence after the fact | |

**User's choice:** Confirm only when exported

---

## Reopen — Planning Center linkage

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both `pcExportedAt` and `pcPlanId` | Re-export can update the SAME plan via the dialog's existing "existing plan" mode; keeps the warning truthful on a second reopen | ✓ |
| Clear both | Reopened service reads as never-exported; silently orphans the plan already in PC | |
| Keep `pcPlanId`, clear `pcExportedAt` | Keeps the link but breaks the evidence gate chosen above | |

**User's choice:** Keep both

---

## Nearest Sunday semantics — direction

| Option | Description | Selected |
|--------|-------------|----------|
| Forward only | Start at the next upcoming Sunday, walk forward to the first without a plan | ✓ |
| Nearest in either direction | Search outward from today so recent gaps can be backfilled | |

**User's choice:** Forward only

---

## Nearest Sunday semantics — search bound

| Option | Description | Selected |
|--------|-------------|----------|
| One year, then next Sunday | Scan ~52 Sundays, then fall back to today's behaviour so the field is never blank | ✓ |
| One quarter, then next Sunday | ~13 Sundays, matching `generateSundaysInQuarter`, but a church planning further ahead hits the fallback | |
| Unbounded | Always correct, but loops indefinitely if saturated | |

**User's choice:** One year, then next Sunday

---

## Claude's Discretion

- Structure of the three enforcement layers, including how Firestore rules enforce the lock on
  `slideGroups` (whose documents carry no service status). Flagged as a research question.
- The store-guard layer's shape — per-action guard vs. a single wrapper.
- Exact banner copy and placement.
- Whether a viewer (non-editor) sees the lock banner at all.

## Deferred Ideas

- Notes / sermon topic remaining editable while locked — offered and declined; recorded so it is not
  silently re-litigated.
- Repairing legacy hand-set `exported` statuses on load — rejected as an unrequested write; the
  evidence gate makes it unnecessary.
