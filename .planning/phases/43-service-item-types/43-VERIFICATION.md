---
phase: 43-service-item-types
verified: 2026-08-07T21:00:00Z
status: human_needed
score: 12/12 must-haves verified (code-level)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Owner confirms the projected (congregation-facing) slide for an ANNOUNCEMENTS/MISC slot should show the kind label (\"Announcements\"/\"Miscellaneous\"), not the planner's typed body text."
    expected: "Owner accepts the recorded decision, or requests body-on-projection (which also requires solving sourceSignature() staleness)."
    why_human: "Content-presentation product decision; no automated test can approve it on the owner's behalf. Recorded in PENDING-VERIFICATION.md § Phase 43 / Plan 43-01."
  - test: "Owner runs a real Planning Center export (live credentials) of a service containing an ANNOUNCEMENTS slot, a MISC slot, and a MESSAGE slot via the blank \"create new plan\" mode, and checks the resulting PC plan."
    expected: "Three items appear with their own titles (Announcements, Miscellaneous, Message); none is mislabeled Message."
    why_human: "The unit suite mocks fetch and proves the outbound request shape, not that Planning Center actually creates three distinctly-titled items. Recorded in PENDING-VERIFICATION.md § Plan 43-02."
  - test: "Owner adds an Announcements item and a Miscellaneous item to a real service in a browser, types into each, confirms save/reload, confirms Message is now a plain text box with no URL control, and pastes a long paragraph into a body textarea to confirm it wraps and grows downward rather than scrolling the row sideways."
    expected: "All of the above hold visually/interactively."
    why_human: "jsdom does not lay out or scroll; visual/interactive fidelity (backstop UI-B2) cannot be asserted by a mounted-component test. Recorded in PENDING-VERIFICATION.md § Plan 43-03."
  - test: "Owner confirms the body-on-share-link trust-model decision (T-43-03), and opens a saved service containing a Hymn item to confirm it still renders, prints (Print Preview), and presents (start a presentation, advance to the Hymn slide) exactly as before."
    expected: "Owner accepts body being visible to anyone holding a share URL (same model as notes); Hymn item looks correct across all three surfaces by eye."
    why_human: "A share-token trust-model question is a product decision; visual/print fidelity across three surfaces cannot be asserted in jsdom. Recorded in PENDING-VERIFICATION.md § Plan 43-04."
---

# Phase 43: Service Item Types Verification Report

**Phase Goal:** A planner has the right set of service item types — Announcements and Miscellaneous
added, Message reduced to plain text, Hymn retired from the add-item palette — and every type exports
to Planning Center as itself.

**Verified:** 2026-08-07T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A planner can add an Announcements item and type free text into it | VERIFIED | `palette-add-announcements` chip (both palette rows, `ServiceEditorView.vue:813,1180`) calls `addSlot('ANNOUNCEMENTS', …)`; shared `slot-body-input` textarea binds `NonAssignableSlot.body` (lines 1065-1083). `createSlot('ANNOUNCEMENTS')` and `slotLabel` confirmed in `slotTypes.ts`. |
| 2 | A planner can add a Miscellaneous item and type free text into it | VERIFIED | Same mechanism via `palette-add-misc` / `section-add-misc-{key}`, `createSlot('MISC')`. |
| 3 | The Message item is a plain free-text box with no URL link field | VERIFIED | Read `ServiceEditorView.vue:1014-1083` directly: the PRAYER branch (1014-1059) still has its two link `<input>`s and open-link anchor; the MESSAGE/ANNOUNCEMENTS/MISC branch (1061-1083) has one `<textarea>` and zero URL controls. `grep -c "v-html"` = 0 on this file. `NonAssignableSlot.linkUrl`/`linkLabel` remain in `service.ts` (type survives; only the Message editing UI was removed). |
| 4 | Hymn no longer appears in the add-item palette; every existing Hymn item still renders, prints, and presents exactly as before | VERIFIED | `grep -c "palette-add-hymn"` / `"section-add-hymn"` = 0 in `ServiceEditorView.vue`. `SlotKind`, `HymnSlot`, `createSlot('HYMN')`, `slotLabel`, and the HYMN slot-content render branch are untouched. `src/views/__tests__/hymnRetirement.regression.test.ts` (17 tests) proves render/print/share/present/export survive, including E-13 (adjacency) and E-15 (encoding round-trip). |
| 5 | Exporting a service to Planning Center shows Announcements, Miscellaneous, and Message as themselves, never silently relabeled "Message" | VERIFIED (with a disclosed, pre-existing, filed limitation — see Gaps/Notes) | `addSlotAsItem` (`planningCenterApi.ts`) confirmed by direct read: explicit `if` branch for every one of the 8 `SlotKind` members (SONG, HYMN, SCRIPTURE, PRAYER, ANNOUNCEMENTS→`Announcements`, MISC→`Miscellaneous`, MESSAGE, IMPORTED), zero implicit else, and a `never`-typed exhaustiveness backstop that throws naming the unhandled kind. Proven to fire both at compile time (43-04 Task 3 Part A, probe reverted) and at runtime for an out-of-union kind (Part B). This closes R085's specific "silent fallthrough to Message" trap completely. |

**Score:** 5/5 roadmap success criteria verified at the code level.

### Additional Plan-Level Truths (sample cross-check, not exhaustive)

| Must-have | Status | Evidence |
|---|---|---|
| `SlotKind` widened to 8 members, `HYMN` untouched | VERIFIED | `src/types/service.ts:7` reads exactly `'SONG' \| 'SCRIPTURE' \| 'PRAYER' \| 'MESSAGE' \| 'ANNOUNCEMENTS' \| 'MISC' \| 'HYMN' \| 'IMPORTED'` |
| `NonAssignableSlot.body?: string` shared field, `linkUrl`/`linkLabel` survive | VERIFIED | `src/types/service.ts:73-88` |
| Every kind-dispatch site (slotLabel, createSlot, KIND_BADGE_CLASSES, slotDisplayTitle, ServiceCard.slotLabel, 4x slideGroupMaterializer switches, 2x slideshowAssembler sites) closed with explicit case, zero new `default:` arms | VERIFIED | Confirmed by 43-01-SUMMARY's captured worklist + independent `npm run type-check` run (0 errors) this session |
| `addSlotAsItem` exhaustiveness backstop binds on `slot.kind`, throws naming the unhandled kind | VERIFIED | Read directly in `planningCenterApi.ts` (see excerpt above) |
| `ServicePrintLayout.vue` / `ShareView.vue` render explicit ANNOUNCEMENTS/MISC branches and `body` for all three text kinds | VERIFIED | `grep -n "ANNOUNCEMENTS\|MISC"` on both files shows the branches at the expected positions |
| `elementLabel()` gains ANNOUNCEMENTS/MISC cases | VERIFIED | `ServiceEditorView.vue:2707-2708` |
| No `v-html` introduced anywhere `body` is rendered | VERIFIED | `grep -c "v-html"` = 0 on `ServiceEditorView.vue`, `ServicePrintLayout.vue`, `ShareView.vue` |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified files | VERIFIED | Scanned all 11 primary modified/created source files; zero matches |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/types/service.ts` | Widened `SlotKind`, `NonAssignableSlot.body` | VERIFIED | Confirmed by direct read |
| `src/utils/slotTypes.ts` | `slotLabel`/`createSlot` ANNOUNCEMENTS/MISC cases | VERIFIED | `grep` confirms both cases in both functions |
| `src/utils/planningCenterApi.ts` | Exhaustive `addSlotAsItem`, backstop | VERIFIED | Confirmed by direct read |
| `src/views/ServiceEditorView.vue` | Palette chips, shared body editor, Hymn removed | VERIFIED | Confirmed by direct read (see excerpts above) |
| `src/components/ServicePrintLayout.vue`, `src/views/ShareView.vue` | ANNOUNCEMENTS/MISC branches, `body` display | VERIFIED | Confirmed by direct read |
| `src/views/__tests__/hymnRetirement.regression.test.ts` | New cross-surface HYMN regression suite | VERIFIED | File exists, 17 named tests covering RENDER/PRINT/SHARE/PRESENT/EXPORT + E-13 + E-15 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Palette chip click | `addSlot(kind, …)` → `createSlot` → slot array | `@click` handler | WIRED | Confirmed at lines 813-814, 1180-1181 |
| Shared `<textarea>` | `NonAssignableSlot.body` | `:value`/`@input` | WIRED | Line 1073-1074 |
| `slot.kind` dispatch | `addSlotAsItem` branch | explicit `if` chain | WIRED | Confirmed by direct read; backstop proven to fire (43-04 Task 3, evidence captured in summary) |
| `ServiceSlot[].body` | `ServicePrintLayout.vue` / `ShareView.vue` | `v-else-if` branch + text interpolation | WIRED | Confirmed at the grepped line numbers |
| `body` → PC item description | `bodyDescription()` → `createItem` → `html_details` | verbatim pass-through | WIRED | Confirmed by direct read (whitespace-aware presence check, untrimmed value passed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Type-check is clean with the widened union and every new dispatch site | `npm run type-check` (independently re-run this session) | exit 0, no errors | PASS |
| App suite failing-file set matches documented baseline, no new failures | `npx vitest run --dir src --exclude '**/rules.test.ts'` (independently re-run this session) | 2769 passed, 1 failed, exactly 2 failing files: `src/storage.rules.test.ts` (Storage emulator not running — documented, unrelated), `src/views/__tests__/RosterView.test.ts` (documented stale assertion) | PASS |
| No debt markers in phase-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all modified files | zero matches | PASS |
| `hymnRetirement.regression.test.ts` exists with named tests per surface | `grep -n "describe(\|it("` | 17 tests across RENDER/PRINT/SHARE/PRESENT/EXPORT, E-13, E-15 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R081 | 43-01, 43-03 | Announcements item + free text | SATISFIED | Palette chip + shared body editor + type/factory/label, confirmed by direct read |
| R082 | 43-01, 43-03 | Miscellaneous item + free text | SATISFIED | Same mechanism |
| R083 | 43-03 | Message is plain free text, no URL field | SATISFIED (code) — **REQUIREMENTS.md checkbox is stale** | Code confirms the URL controls are removed from the MESSAGE branch and the PRAYER branch (out of scope) is unaffected. `REQUIREMENTS.md` line 121 still shows `[ ]` for R083 while the traceability table (line 288) says "Pending," even though R081/R082/R084/R085 (all completed in the same phase) are checked. This is a documentation-sync gap, not a code gap — flagged for the owner/planner to update `REQUIREMENTS.md`, not a phase blocker. |
| R084 | 43-01, 43-03, 43-04 | Hymn not offered; existing Hymn renders/prints/presents unchanged | SATISFIED | Palette absence + `hymnRetirement.regression.test.ts` cross-surface proof |
| R085 | 43-02, 43-04 | New types export as themselves, never silently "Message" | SATISFIED for the specific trap this requirement names (the `addSlotAsItem` if-chain fallthrough) — see Gaps/Notes for a related, pre-existing, filed limitation | Exhaustive dispatch + backstop proven to fire |

No orphaned requirements: R081-R085 all appear in at least one plan's `requirements` field and all are covered above.

### Anti-Patterns Found

None. Scanned all phase-touched source files (types, utils, components, views) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, empty stub returns, and hardcoded-empty-props patterns. No matches. `v-html` count is 0 on every file that renders `body`.

### Gaps / Disclosed Limitations (not blocking)

**WR-01 / WR-02 (from `43-REVIEW.md`, filed as `ROADMAP.md` Phase 999.4 backlog):** The "add to existing plan" and "create new plan with template" Planning Center export modes in `ServiceEditorView.vue` (`onConfirmExport`) bucket slots by `songSlots`/`scriptureSlots` only — PRAYER, MESSAGE, ANNOUNCEMENTS, MISC and IMPORTED slots are never appended in those two modes, so `addSlotAsItem` (which is itself correct for every kind) is simply never called for them there. This is **pre-existing for PRAYER/MESSAGE** (documented in-code before this phase) and this phase's two new kinds (ANNOUNCEMENTS/MISC) inherit the same gap rather than introducing a new one. It is a silent *omission*, not the silent *mislabeling* R085 specifically targets and closes — `addSlotAsItem` never mislabels anything, in any mode. Independently confirmed: `ROADMAP.md` Phase 999.4 exists with the correct file/line references and an explicit "Pre-existing: yes … NOT a Phase 43 regression" note.

Because (a) `addSlotAsItem` is proven exhaustive and correct for every kind, (b) the blank "create new plan" export mode already exercises that correct dispatch for every kind, and (c) the gap in the other two modes pre-dates this phase and is openly disclosed and filed rather than hidden, this is recorded here as a known limitation rather than a phase-blocking gap. The phase's own success criterion 5 (roadmap wording: "`addSlotAsItem`'s unguarded if-chain gets an explicit branch for each, proven by test") scopes specifically to the mechanism this phase was chartered to fix, and that mechanism is fully fixed.

### Human Verification Required

Four items are recorded as unresolved owner checkpoints in `.planning/PENDING-VERIFICATION.md § Phase 43`, deferred there per this project's standing convention (human-verify checkpoints are never self-approved). Per that convention, this phase cannot be marked `passed` while they remain open:

1. **Projected-slide content decision (43-01).** Confirm the congregation-facing projected slide for ANNOUNCEMENTS/MISC should show the kind label, not the planner's `body` text.
2. **Live Planning Center round-trip (43-02).** A real export against live credentials, confirming three distinctly-titled items appear, none labelled "Message."
3. **Hands-on editor feel (43-03).** Add/type into real Announcements and Miscellaneous items; confirm Message is a plain text box; confirm long pasted text wraps and grows downward (backstop UI-B2, unassertable in jsdom).
4. **Share-disclosure decision + HYMN visual fidelity (43-04).** Confirm `body` should be visible to anyone holding a share URL; confirm a saved Hymn item still looks correct across editor/print/presentation by eye (backstop UI-B1, unassertable in jsdom).

### Gaps Summary

No code-level gaps block phase completion. All 5 roadmap success criteria and the sampled plan-level must-haves are verified directly against the codebase (not merely SUMMARY.md claims) — type widening, every kind-dispatch site, the exhaustive `addSlotAsItem` backstop (proven to fire, not just present), the shared body editor with the Message URL control removed, the Hymn palette retirement with a dedicated cross-surface regression suite, and the print/share surfaces. `npm run type-check` and the full app suite were independently re-run this session and match the documented baseline exactly.

Status is `human_needed` solely because four owner-decision checkpoints remain open in `PENDING-VERIFICATION.md`, per this project's standing rule that such checkpoints are never self-approved by an agent. One disclosed, pre-existing, already-filed limitation (WR-01/WR-02, backlog 999.4) is noted for context but does not block this phase. One documentation-sync note (R083's stale checkbox in `REQUIREMENTS.md`) is flagged for cleanup but is not a code gap.

---

_Verified: 2026-08-07T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
