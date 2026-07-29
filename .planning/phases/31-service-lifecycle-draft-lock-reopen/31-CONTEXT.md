# Phase 31: Service Lifecycle — Draft Lock & Reopen - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A service is editable only while its status is `draft`. At `planned` or `exported`, the Service Order,
Slides and Roles tabs are all read-only, enforced in three layers (Firestore rules, store guard, UI).
An explicit "Reopen for editing" action returns a locked service to `draft`, warning about Planning
Center only when the service genuinely was exported. Creating a service defaults its date to the
nearest Sunday that does not already have a plan.

**Requirements:** R036, R037, R038.

**In scope:** `firestore.rules` (services + slideGroups), `src/stores/services.ts`,
`src/stores/slideGroups.ts`, `src/views/ServiceEditorView.vue`, `src/components/slides/*` (lock layer
only), `src/components/NewServiceDialog.vue`, `src/views/ServicesView.vue`, and their tests.

**Out of scope:** the autosave fix and save-status indicator (Phase 32), backgrounds and the split
Edit Slide drawer (Phase 33), the Service Order UI rework and contextual action bars (Phase 36). This
phase adds a lock layer over the existing controls; it does not restyle them.

</domain>

<decisions>
## Implementation Decisions

### The status control (replaces the blind cycle)

- **D-01: The status badge stops being a control.** It becomes a non-clickable status pill.
  `toggleStatus` (`ServiceEditorView.vue:1796`) is DELETED. It is currently a blind three-way cycle
  — draft → planned → exported → draft — which is the source of two defects this phase must close:
  it lets a user mark a service "Exported" without ever exporting it, and it makes reopening an
  exported service an unlabelled click with no warning.

- **D-02: Explicit, named actions replace the cycle**, one per legal transition:

  | Status | Action shown |
  |---|---|
  | `draft` | **Mark as Planned** |
  | `planned` | **Reopen for editing** · **Export to Planning Center** (existing) |
  | `exported` | **Reopen for editing** |

- **D-03: `exported` is reachable ONLY through a real Planning Center export.** No hand-setting. The
  export flow is the only writer of that status, alongside `pcExportedAt` / `pcPlanId`.

- **D-04: The Planning Center warning gates on EVIDENCE, not on the status string.** Show it only when
  the service carries `pcExportedAt` / `pcPlanId`. Live data may contain services sitting at
  `exported` that were set by hand through the old cycle and were never exported; warning that
  "Planning Center holds the previously exported version" would be a lie for those, and a warning
  users learn is sometimes false is a warning they learn to click through. This also satisfies R037's
  third criterion ("reopening a never-exported service does not show that warning") without a data
  migration — the legacy rows self-correct the first time they are reopened.
  **Deliberately NOT chosen:** repairing the status on load. That would write to services the user
  never asked to change.

### What "locked" looks like

- **D-05: One banner, controls REMOVED not disabled.** A single persistent banner sits near the status
  pill: the service is locked, plus the Reopen action. Mutation controls are not rendered at all.
  This follows Phase 30's read-only precedent (the `Read-only — edit in Song Lyrics` badge on song
  groups): state the reason once, visibly, then do not render dead affordances. A screen of greyed-out
  buttons on every locked service was considered and rejected.

- **D-06: All three tabs lock.**
  - *Service Order* — rows render as plain text; no drag handles, no Add item, no song/scripture pickers.
  - *Slides* — no Add slide, no Import, no drag, no drawer edits, no group media.
  - *Roles* — assignments render as names; no checkboxes.

- **D-07: Notes and sermon topic lock too.** A carve-out for free-text metadata was offered and
  declined — R036 says the tabs are read-only and that is taken literally.

  > **Correction (2026-07-29, from 31-PATTERNS.md):** the `notes` half of this decision is currently
  > vacuous — `Service.notes` has **no editable UI anywhere**. It appears only in the Planning Center
  > export payload (`src/stores/services.ts:216`) and in the print/share snapshots. There is nothing to
  > lock. `sermonTopic` and `sermonPassage` DO have editable controls and are genuinely covered by this
  > decision. The recorded intent stands — if a notes editor is ever added, it locks — but the planner
  > must not budget work for gating a control that does not exist.

- **D-08: Non-editing actions stay live while locked** — Export/Copy to Planning Center, Present /
  preview, Print, and Share link.

- **★ D-09: The lock MUST permit the export write.** `Export to Planning Center` requires
  `status === 'planned'` (`ServiceEditorView.vue:150`), and the export itself writes `pcExportedAt`,
  `pcPlanId` and flips `status` to `exported`. A naive "no writes unless draft" rule at any of the
  three layers makes `exported` unreachable and breaks the primary workflow. This is the single most
  likely way to get this phase wrong.

### Reopen

- **D-10: Friction only where there are consequences.** Reopening a `planned` service is one click —
  nothing external depends on it. Reopening a service with real export evidence opens a confirm dialog
  carrying the Planning Center warning. "Always confirm" was rejected: a dialog with nothing to warn
  about trains people to click through the one that matters.

- **D-11: Reopening KEEPS both `pcExportedAt` and `pcPlanId`.** The export dialog already has an
  "existing plan" mode (`exportMode: 'new' | 'existing'`), so preserving the link lets a re-export
  update the same Planning Center plan instead of creating a duplicate. Clearing them would silently
  orphan the plan already sitting in Planning Center and lose the audit trail. It would also break
  D-04's evidence gate on a second reopen.

### New-service date (R038)

- **D-12: Forward-only.** Start at the next upcoming Sunday and walk forward until one has no plan.
  Nearest-in-either-direction was rejected: a new-service dialog defaulting to a date in the past is
  surprising, and a past Sunday with no plan usually means no service was held.

- **D-13: Bounded at ~52 Sundays, then fall back to today's `nextSunday()`.** The field is never blank,
  and the degenerate case degrades to exactly the behaviour that exists now.

- **D-14: The dialog needs the service list it does not currently have.** `NewServiceDialog.vue`
  computes `nextSunday()` with no knowledge of existing services and receives no service data.
  Deciding where the taken-dates set comes from (prop from `ServicesView.vue`, which already
  subscribes, vs. the store directly) is a planning decision — but the wiring is new work, not a
  one-line change.

### Deleting a locked service (added 2026-07-29 after research)

- **D-15: Delete stays available at any status, but warns when there is export evidence.** Both the UI
  checker and the research agent independently raised this as an unresolved gap — D-08 listed the
  non-editing carve-outs and simply omitted Delete, while the proposed Firestore rule allowed it. The
  owner's call: keep Delete available, and when the service carries `pcExportedAt`/`pcPlanId`, extend
  the EXISTING delete confirm body (`ServiceEditorView.vue:216`) with one evidence-gated sentence —
  *"This service was exported to Planning Center. Deleting it here does not remove that plan."*

  Rationale for warning rather than locking: Delete is the only irreversible action in this view, and
  for an exported service it silently orphans a live Planning Center plan and destroys the audit trail
  D-11 exists to preserve. D-10's "friction only where there are consequences" argues the OPPOSITE way
  here than it does for Reopen — reopening is reversible, deleting is not. Reuses the same
  `hasPcExportEvidence` computed as D-04; no new dialog, no new rules change.
  **UI and rules must move together on this** — the rule must permit delete at any status.

### Shipping the rules change (added 2026-07-29 after research)

- **★ D-16: The plan carries an explicit emulator test gate and a manual deploy hand-off.** Research
  established that `firestore.rules` does NOT ship with the app bundle, this repo has NO CI
  (`.github/workflows` does not exist), and `src/rules.test.ts` is excluded from the default vitest run
  (`vite.config.ts:85-86`). A broken lock would therefore ship green twice over.

  Therefore: (a) a mandatory `npm run test:rules` gate, emulator-backed, is its own plan task — a rules
  change with no emulator test is untested code; (b) the final task STOPS and instructs the owner to
  run `firebase deploy --only firestore:rules`. **I do not deploy.** This mirrors how Phase 37 is
  scoped ("build but do not deploy") and respects the standing rule that outward-facing actions are
  confirmed, not assumed. Adding CI was offered and declined as wider than R036–R038.

### Claude's Discretion

- **How the three enforcement layers are structured**, and specifically how Firestore rules enforce the
  lock on the `slideGroups` collection, whose documents do not carry the service status. A rules-level
  `get()` on the parent service is a cross-document read with cost and latency implications. Flagged
  for research (see below).
- The store-guard layer's shape (per-action guard vs. a single wrapper).
- Exact banner copy and placement, within D-05.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements and prior decisions
- `.planning/REQUIREMENTS.md` — R036, R037, R038 (§ "Service Lifecycle")
- `.planning/ROADMAP.md` § "Phase 31" — success criteria and the research flag
- `.planning/STATE.md` § "★ v1.4 AUTONOMOUS RUN" and "★ v1.4 RESEARCH FINDINGS" — includes the
  zero-enforcement draft-lock finding this phase exists to close
- `.planning/phases/30-slides-mirror-the-plan-hard-lock-reconciliation-removed/30-VERIFICATION.md`
  § I-01 — **directly load-bearing for this phase**, see Integration Points below

### Enforcement surface
- `firestore.rules` §51-54 — the services rule that today has no status guard at all
- `src/storage.rules.test.ts` / `src/rules.test.ts` — the emulator-backed rules test harness; note
  `npm run test:rules` needs `.env.local` and the emulator (see `CLAUDE.md`)

### Project conventions
- `CLAUDE.md` — `.env.local` requirement for emulator/tests/build; note `.gsd/` no longer exists and
  the knowledge graph needs a rebuild before its queries can be trusted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`isExportedLocked`** (`ServiceEditorView.vue:1288`) — `status === 'exported'` only. This is the
  seam to widen to `status !== 'draft'`, and to rename accordingly. It already gates parts of the
  Service Order tab, so the pattern exists; the gap is that it never fires at `planned` and never
  reaches Slides or Roles.
- **`canMutate`** (`EditSlideDrawer.vue:432`) and **`canReorder`** (`SlideGrid.vue:596`) — Phase 30's
  R054 lock seams. The lifecycle lock should compose with these rather than introduce a parallel
  mechanism.
- **`exportMode: 'new' | 'existing'`** and the export dialog's existing-plan lookup — already supports
  re-targeting an existing Planning Center plan, which is what D-11 preserves.
- **`generateSundaysInQuarter`** (`src/utils/quarterDates.ts:11`) and `fmtDate` — existing,
  well-tested Sunday arithmetic. `NewServiceDialog.vue`'s private `nextSunday()` (~lines 135-146)
  duplicates part of it.

### Established Patterns

- **Pinia stores wrap Firestore `onSnapshot`; components never write directly.** The store is
  therefore the natural home for the middle enforcement layer.
- **Read-only affordances are stated, not implied** (Phase 30, R054) — D-05 continues this.
- **Rules tests run against the emulator** and are excluded from the default vitest run
  (`vite.config.ts` excludes `src/rules.test.ts`). A new status-guard rule needs emulator-backed tests,
  which do not run in the normal suite — plan for that explicitly rather than assuming green CI covers it.

### Integration Points

- **★ `30-VERIFICATION.md` I-01 — read before touching the Slides tab.** Six of the seven Slides-tab
  mutation entry points are guarded by template `v-if` ALONE; only `onLoopToggle` has a handler-level
  guard. They are unreachable today (no `defineExpose`, every binding sits inside a gated block), so
  this is not currently a defect. But Phase 31 layers a SECOND lock over those same controls, and a
  lifecycle lock that only hides templates inherits that fragility. **Gate the handlers, not just the
  templates.**
- `ServiceEditorView.vue:150-157` — the export button's `status !== 'planned'` guard, which D-09 says
  the lock must not break.
- `src/stores/services.ts:74` — `status: 'draft'` on create; `:215` — status carried through the
  Planning Center export payload.
- `ServicesView.vue:349-353` — `onCreateService`; the view already subscribes to the service list, so
  it is the obvious source for D-14's taken-dates set.

### Research Questions (roadmap flagged this phase as needing research)

1. **Firestore rules field-level diff for the reopen transition.** The rule must read
   `resource.data.status` (the stored value), NOT `request.resource.data.status` (the incoming value),
   or a locked service could be edited by any write that also sets `status: 'draft'`. It must then
   carve out an explicit allowance for the one legitimate status-reverting write, and for the export
   write (D-09).
2. **How to enforce the lock on `slideGroups`,** whose documents do not carry the service status.
   Options include a rules-level `get()` on the parent service (cross-document read: billed, and adds
   latency to every slide write), denormalising the status onto the group document (needs a fan-out
   write on every transition), or accepting store+UI enforcement only for that collection with the
   trade-off recorded. Research should cost these out rather than assume.

</code_context>

<specifics>
## Specific Ideas

- Owner (original v1.4 scope dump): *"When a service plan is no longer in Draft mode (it is either
  planned or exported) do not allow editing of slides at all"* — extended during discussion to Service
  Order and Roles as well, which is what R036 already states.
- The status pill layout the owner selected:

  ```
  [ Draft ]        [ Mark as Planned ]
  [ Planned ]      [ Reopen for editing ]  [ Export to PC ]
  [ Exported ]     [ Reopen for editing ]
  ```

- The forward-only Sunday search the owner selected:

  ```
  today = Wed 2026-07-29
  Sun 2026-08-02  — has a plan   ✗
  Sun 2026-08-09  — has a plan   ✗
  Sun 2026-08-16  — free        ← default
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Notes / sermon topic remaining editable after locking** — offered as a carve-out and declined.
  Recorded so the option is not silently re-litigated; revisit only if locking notes proves annoying
  in practice.
- **Repairing legacy hand-set `exported` statuses on load** — rejected under D-04 as an unrequested
  write. The evidence gate makes the repair unnecessary.
- **Whether a viewer (non-editor) sees the lock banner at all** — viewers already cannot edit, so the
  banner would explain a restriction that is not the reason they cannot edit. Left to Claude's
  discretion during planning; noted here so it is a considered choice rather than an oversight.

</deferred>

---

*Phase: 31-Service Lifecycle — Draft Lock & Reopen*
*Context gathered: 2026-07-29*
