# Pending Human Verification — v1.4

**Why this file exists.** The owner left for the weekend on 2026-07-30 with a standing instruction to
work autonomously and skip human-verify checkpoints, doing verification together on their return. Every
checkpoint skipped under that grant is recorded here rather than silently marked passed.

**How to use it:** work top to bottom. Each item names what to do, what to expect, and what a failure
would mean. Items are grouped by phase and ordered by the risk of the thing they check.

**Status key:** ☐ not yet verified · ☑ verified by owner · ✗ failed, see notes

---

## Before starting: two setup facts

1. **Emulator.** Local verification is only meaningful with `VITE_USE_EMULATORS=true` in `.env.local`
   and the emulator running. `src/firebase/index.ts:23-28` wires auth 9099, firestore 8080, storage
   9199, functions 5001. Without the flag the dev app talks to LIVE Firebase, where the Phase 31 rules
   are deliberately **not deployed** — so any rules-layer check would give a false pass.
2. **Rules are not in production.** `firebase deploy --only firestore:rules` is deferred (ROADMAP
   backlog Phase 999.3) and must run before v1.4 ships. Until then production has the UI gate and the
   store guard only.

---

## Phase 31 — Service Lifecycle: Draft Lock & Reopen

### Lock behaviour

- ☐ **31.1** Open a Draft service. Everything is editable — Service Order, Slides, Roles.
- ☐ **31.2** Click **Mark as Planned**. Expect: one lock banner; Service Order rows become plain text
  with no drag handles, no Add item, no pickers; Slides offers no Add slide / Import / drag / drawer
  edits; Roles shows names with no checkboxes.
- ☐ **31.3** Switch across all three tabs. Expect exactly ONE banner, not re-announced per tab.
- ☐ **31.4** Confirm **Export to PC**, **Present**, **Print** and **Share** all still work while locked.
- ☐ **31.5** Check every empty state — an empty service section, the slide grid, the plan rail, Roles.
  **None should tell you to do something a locked service won't let you do.**

### Reopen

- ☐ **31.6** **Reopen for editing** on a Planned service: one click, no dialog, editing restored.
- ☐ **31.7** ★ **Drag-and-drop works again immediately, no page reload.** If the tab is undraggable
  after reopen, the Sortable teardown regressed — the fix broke the thing it was protecting.
- ☐ **31.8** Export a service to Planning Center, then Reopen. Expect a confirm dialog with the PC
  warning. Cancel → status unchanged. Confirm → back to Draft.
- ☐ **31.9** Re-export that reopened service. Expect it can still target the SAME Planning Center plan.
  This is the case that fails under the intuitive rules shape.

### Enforcement beyond the UI

- ☐ **31.10** ★ **The three-layer test.** With `VITE_USE_EMULATORS=true` and a service set to Planned,
  open devtools and attempt a direct Firestore write to it, bypassing the UI. Expect **permission
  denied**. If it succeeds, first check the flag — an app on live Firebase proves nothing here. If the
  flag is on and the write still succeeds, R036's rules layer has a real defect.
- ☐ **31.11** Delete a service that was exported. Expect the confirm dialog carries the extra Planning
  Center sentence, and deletion works.

### New-service date

- ☐ **31.12** With plans already on the next two Sundays, open New Service. Expect the date to default
  to the third Sunday. Note whether the default team selection looks right for that date — changing the
  default date changes the ordinal-of-month, which drives team defaults.

---

## Later phases

Appended as each phase completes.

---

## Notes and failures

_(Record anything that failed here, with what you saw versus what was expected.)_
