# Phase 147 — UI Review

**Audited:** 2026-11-07
**Baseline:** 147-UI-SPEC.md (approved 2026-11-06) and 147-CONTEXT.md (locked copy)
**Screenshots:** not captured (no dev server on ports 3000, 5173 or 8080; code-only audit)
**Scope:** only what this phase changed. Older problems nearby are listed under Out of Scope.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Label, options and help text match the contract verbatim, but the help text does not say a default time is also required |
| 2. Visuals | 3/4 | The disabled select looks identical to an enabled one for non-editors (native `disabled`, no dimming) |
| 3. Color | 4/4 | No new colour; indigo appears only as the focus ring, as the contract requires |
| 4. Typography | 4/4 | Only `text-xs` label and `text-sm` control, both already declared in the contract |
| 5. Spacing | 4/4 | `mt-4` block rhythm holds; the only exception (`py-1.5` on the add form) predates this phase |
| 6. Experience Design | 3/4 | Pre-filled date with blank Time leaves Add disabled with no cue; pre-fill is silent by design |

**Overall: 21/24**

**Blockers: 0.** No pillar scores 1 and no defect in this phase breaks a task flow. Every finding below is a WARNING.

---

## Top 3 Priority Fixes

1. **Disabled Settings controls look editable to viewers** — a viewer sees a normal-looking dropdown and time inputs that do nothing, so the day they are trying to read looks changeable. Fix: add `disabled:opacity-50 disabled:cursor-not-allowed` to the new select (`SettingsView.vue:553-558`) and to the time inputs at `:572-578` and the report-time input at `:602-608`. This changes a class string that UI-SPEC pins, so the owner should amend UI-SPEC section 1 first, or accept the existing style as the card-wide convention.

2. **Add form can show a date with Time blank and Add disabled, with no cue** — after this phase, a planner on a Wednesday-default church sees a filled Date, an empty Time and a greyed Add button, and nothing says why. Fix: when `newTime` is `''`, apply the existing `inputMissing` class (`border-amber-700 focus:ring-amber-500`, already defined at `ServiceTimesPanel.vue:42`) to the new Time input at line 325. The contract does not cover this state visually, so the owner should confirm the amendment. The same gap exists today for a blank default time, so this is partly pre-existing.

3. **Help text omits the time requirement** — the copy says a new service "start[s] with one rehearsal on the default day at the first default time", but a day with no default time creates nothing (AC-RHD-23). The sentence does not state that. Fix: the text is locked verbatim in CONTEXT and the spec test (AC-RHD-08) pins it, so this is an owner decision. Either accept it, or amend CONTEXT, the spec and the test together in one change, e.g. "...at the first default time; a day with no default time adds none."

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified against the contract:

- Label `Default rehearsal day` (`SettingsView.vue:552`) matches.
- Options in order: None, Sunday through Saturday (`:560-561`, `REHEARSAL_WEEKDAY_NAMES` at line 749). Matches.
- Help text at `:547-549` matches the CONTEXT sentence exactly, including the straight apostrophe in "doesn't".
- No new CTA, error or empty-state copy was added. Save failure reuses `rehearsalDefaultsSaveError` (`:623`). Matches.
- No note or badge says the pre-filled date came from a default (`ServiceTimesPanel.vue:300-317`). Matches the "No note" decision.

Finding (WARNING): the help text at `SettingsView.vue:548` does not state that a default time is required. A church that sets a day and leaves Default rehearsal time(s) empty will read "New services start with one rehearsal on the default day" and expect a rehearsal that is never created. See Top Fix 3. The copy is owner-locked, so the score reflects the gap, not a copy error.

### Pillar 2: Visuals (3/4)

Verified:

- The select has a `<label for="rehearsal-default-day">` (`:552`) with a matching `id` (`:554`). The label is programmatically associated, which the neighbouring time and report labels are not.
- The new block sits in normal flow between the help paragraph and the time block, with the Save button still the card's only primary action. Matches the contract's focal-point statement.

Finding (WARNING): the select uses `:disabled="!authStore.isEditor"` (`:556`) with the same class string as the time inputs, which has no disabled variant. For a non-editor the select is inert but renders with the same `bg-gray-800 border-gray-700 text-gray-100` as an active control. The contract (UI-SPEC section 1, "Disabled") says "same as the card's time inputs", so this is consistent with the card, but the phase adds a new control that carries the same ambiguity. Recommendation as in Top Fix 1.

### Pillar 3: Color (4/4)

- Classes on the new select (`:558`) are the card's existing input string. No hex or RGB values were added.
- Indigo appears on the new control only as `focus:ring-indigo-500`, matching the contract's accent rule for inputs.
- The add form Date input keeps `${inputBase} ${inputOk}` (`ServiceTimesPanel.vue:315`), unchanged.

No findings.

### Pillar 4: Typography (4/4)

- New label: `text-xs` (12px, weight 400). New control text: `text-sm` (14px). Both are in the declared set of 2 sizes and 2 weights.
- No `font-` utility was added.

No findings.

### Pillar 5: Spacing (4/4)

- Help paragraph `mb-3` (12px), then the select block with no margin, then the time block `mt-4 space-y-2` (16px). The time block's wrapper change (`SettingsView.vue:565`) is the one spacing edit, and it matches the rhythm used by the report-time block at `:600`.
- Select padding `px-3 py-2` matches the contract for Settings controls.
- The add form's `py-1.5` (`ServiceTimesPanel.vue:40`) is the declared exception. It predates this phase, and this phase did not change it, so it is not scored here.

No findings within this phase's changes.

### Pillar 6: Experience Design (3/4)

Verified as covered:

- Non-editor: select disabled, Save button removed by `v-if` (`:611-620`). Matches AC-RHD-05.
- Save failure: `rehearsalDefaultWeekdayInput` is restored from `previousWeekday` in the catch (`SettingsView.vue:1409`), alongside the other rollbacks. Uses `normalizeWeekday`, so Sunday (0) is not lost to a truthiness check.
- Church switch: the watcher at `:823` reseeds the select from the store, so the select does not show the previous church's day (AC-RHD-67).
- Undo and the editor are unaffected by this surface.
- The UAT record (147-UAT.md tests 2 and 3) shows the select fits at about 375px for editor and viewer, and that None survives a reload. Treated as evidence; no overflow was found in code, since the select has no width utility and is sized to "Wednesday".

Findings:

- **WARNING, Add form, blank Time with a filled Date.** `ServiceTimesPanel.vue:300-335`. When a default day is set but no default time, the Date fills and the Time stays blank (AC-RHD-43, by contract). The Time input always uses `inputOk`, so it does not signal that it is needed, and the Add button is greyed with no text saying why. A planner who has just seen a date pre-filled may read the greyed button as a bug. Recommendation as in Top Fix 2.
- **Info, silent pre-fill.** `ServiceTimesPanel.vue:79-84`. The pre-filled date is visually identical to a typed one. The contract records "No note" as an owner decision, so this is accepted. Recorded here so the decision is visible: a planner can save a rehearsal on the computed date without knowing it was computed, though Add still needs an explicit press (AC-RHD-47).
- **Info, no time on Settings default.** A default day without a default time gives no auto-add (AC-RHD-23) and a form that is one field short. Covered by Finding 1 of Pillar 1.

---

## Out of Scope (noted, not scored)

- `ServiceTimesPanel.vue:40` `py-1.5` on the add form inputs. A declared exception in UI-SPEC section "Spacing"; predates this phase.
- The existing Settings time inputs and report-time input have no disabled styling. Same issue as Pillar 2, but it predates this phase. The phase adds one more instance.
- `ServiceEditorView.vue:61` header date input carries `max="9999-12-31"`. The input is `opacity-0 w-0 h-0`, so the attribute only limits the native picker. Correct, nothing to score.
- The Planning Center export's hard-coded Wednesday is excluded by the spec.

---

## Registry Safety

Not applicable. `components.json` is absent and UI-SPEC lists no third-party registry.

---

## Files Audited

- `.planning/phases/147-default-rehearsal-day-and-time/147-UI-SPEC.md`
- `.planning/phases/147-default-rehearsal-day-and-time/147-CONTEXT.md`
- `.planning/phases/147-default-rehearsal-day-and-time/147-04-PLAN.md`
- `.planning/phases/147-default-rehearsal-day-and-time/147-05-PLAN.md`
- `.planning/phases/147-default-rehearsal-day-and-time/147-04-SUMMARY.md`
- `.planning/phases/147-default-rehearsal-day-and-time/147-05-SUMMARY.md`
- `.planning/phases/147-default-rehearsal-day-and-time/147-UAT.md`
- `docs/specs/default-rehearsal.md`
- `src/views/SettingsView.vue` (lines 543-624, 630-650, 749-750, 816-828, 1380-1412)
- `src/components/ServiceTimesPanel.vue` (full file)
- `src/views/ServiceEditorView.vue` (lines 55-68 and 1740-1762)
- `.planning/ui-reviews/.gitignore` (gate confirmed present)
