---
phase: 143-dated-rehearsals-times-tab
verified: 2026-10-27T13:00:00Z
status: human_needed
score: 5/5 roadmap success criteria verified; 25/25 plan truths verified (1 backstop truth routed to human)
behavior_unverified: 0
overrides_applied: 0
re_verification: false
gaps: []
deferred: []
flagged_prohibitions:
  - statement: "6 judgment-tier prohibitions (2 per plan) - non-authoritative LLM-judge verdict: all honored; see Prohibitions section"
    flag: "unverified-prohibition - human review recommended"
human_verification:
  - test: "R441 (Chrome and Safari): in a service's Times tab, clear a dated rehearsal's date, then its time (and try backspacing a single date segment)"
    expected: "The input snaps back to the stored value, an amber role=status message shows for about 4 s, the row is never emptied or removed. Note whether a single-segment backspace reverts mid-typing (accepted per ADR-0245, RESEARCH A1)."
    why_human: "Native date/time input change-event behavior differs by browser; jsdom cannot reproduce segment editing."
  - test: "R444 (360 px phone width): scroll the tab strip, tap Times"
    expected: "The 6th (Times) tab is reachable by horizontal scroll, the panel shows, and the active tab scrolls into view."
    why_human: "Backstop truth. The strip carries overflow-x-auto scrollbar-hide, but nothing in code or tests proves reachability or scroll-into-view; it is a layout behavior."
  - test: "R443: open a real v2.15 service that holds an undated row (editor, Draft)"
    expected: "Amber dot on the Times tab; 'Needs a date' marker and amber input border legible on gray-950; setting the date clears marker and dot; nothing is written on open."
    why_human: "Visual legibility and real production-shaped data."
  - test: "R444: below 640 px, view the Times tab as an editor"
    expected: "Rehearsal rows and the add form stack vertically with full-width inputs; inline from 640 px up."
    why_human: "Responsive layout is visual."
  - test: "R443: screen reader on a service with legacy rows"
    expected: "Tab announces 'Times (needs attention)'."
    why_human: "Assistive-technology output."
  - test: "R444/R445 end-to-end smoke: as a planner add a dated rehearsal and report time, then view the dashboard, Services card, My Schedule, volunteer page and public share page"
    expected: "Dated rehearsals + report time render as before (R433); a legacy undated row appears on none of them."
    why_human: "Cross-surface visual check on real data (automated coverage is regression tests with mocked stores)."
---

# Phase 143: Dated Rehearsals & Times Tab Verification Report

**Phase Goal:** A planner manages a service's rehearsals and report time in a dedicated Times tab, where every rehearsal has a date. Nothing a v2.15 service already stored is lost, and no undated rehearsal is shown to volunteers or the public.
**Verified:** 2026-10-27
**Status:** human_needed (every automatable check passes; only the owner's batched UAT items and flagged judgment-tier prohibitions remain)
**Re-verification:** No - initial verification (post-review-fix code d1910d89 / 716aea7a verified, not the SUMMARYs)

## Gates run by the verifier

| Gate | Result |
| ---- | ------ |
| Bare `npx vitest run` | 242 passed / 1 failed files; 6055 tests passed, 43 skipped. The single failing file is `src/storage.rules.test.ts` (emulator ECONNREFUSED / `testEnv` undefined) - the documented baseline. No other failure. |
| `npm run type-check` (`vue-tsc --build`) | exit 0, clean (includes test files). |
| R445 source gate `git diff --stat 3539cb2a..HEAD -- DashboardView.vue ServiceCard.vue ScheduleServiceCard.vue ShareView.vue VolunteerServiceView.vue MyScheduleView.vue rehearseAccess.ts` | Empty. |
| `rehearsalProjection.test.ts` + `rehearseAccess.ts` diff vs 3539cb2a | Empty (unmodified). |
| Debt markers (TBD/FIXME/XXX) in phase-touched source files | None. |
| Leftover refs to removed header (`service-times-section`) in source | Only the three negative assertions in the rewritten test. |

## Goal Achievement

### Roadmap Success Criteria (contract)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Controls only in a Times tab after Messages; nothing time-related above the tab strip; tab behaves like siblings; editable for editors in Draft, read-only otherwise; same autosave (R444) | VERIFIED | Header block (L240-331 at base) deleted from `ServiceEditorView.vue`. `#svc-tab-times` added inside the `role="tablist"` div after Messages with identical classes/aria; `tabs.push('times')` unconditional in `visibleTabOrder` (editor: SO,Slides,Roles,Stage,Messages,Times; viewer: SO,Slides,Times); `timesTabButtonRef` + `case 'times'`; `#svc-panel-times` uses `v-show`, `role=tabpanel`, `aria-labelledby`. `:can-edit="canEditService"`; panel read-only branch is a bare `v-if="!canEdit"`. `onSave`/useAutoSave untouched (diff shows no hunk). Tests: timesSection (header removed, controls inside panel, tab wiring, gating), stage + main view tab-order tests updated; all green. Strip has `overflow-x-auto scrollbar-hide`. |
| 2 | A planner cannot produce an undated rehearsal; add yields dated row; existing date cannot be cleared (R441) | VERIFIED | Add form (`ServiceTimesPanel.vue`) creates a row only on submit; `canAdd` requires `YMD_RE` and `HM_RE`; resets date + time override after add. `onFieldChange` forces `el.value = current` and shows message on clear/malformed, emits nothing. Parent `onAddRehearsal` re-validates payload with regexes, no zero-arg/empty-date push remains (`grep "date: ''"` = 0 in view); `onRehearsalDateChange/TimeChange` ignore clearing a non-empty value and malformed values; all five handlers keep `if (!canEditService.value) return`. Tests (all pass): panel R441 add/reject-clear (assert native input value), WR-01 malformed cases, view handler invariants. |
| 3 | New service gets no date-less placeholder rehearsals; org default time(s) supply time on add; report time still copied; changing org default never alters an existing service (R442) | VERIFIED | `createService` now `const rehearsals = []` and `reportTime = authStore.settings.reportTimeDefault` in the addDoc payload (services.ts L474-490); `rehearsalTimeDefaults.map` gone. Panel `newTime` = override ?? `defaultTimes[0]`, chips only for >1 distinct defaults; view passes `authStore.settings.rehearsalTimeDefaults ?? []`. Settings helper rewritten with `data-testid="rehearsal-defaults-helper"`; data shape unchanged. Tests: `services.rehearsalDefaults.test.ts` (rehearsals [] + reportTime copy, copy-not-live-bind, fresh-copy inverse, empty defaults), panel R442 (pre-fill, chips, late defaults), Settings helper + dedupe test. |
| 4 | v2.15 undated rows lose no data: flagged in editor, hidden from all read-only/public surfaces and both projections; no guessed dates (R443) | VERIFIED | No migration code anywhere; services.ts diff touches only the createService block (below buildServiceSnapshot); `rehearseAccess.ts` and `buildServiceSnapshot` unchanged; `isDisplayableRehearsal` and `sortRehearsals` bodies unchanged. Panel lists legacy rows first with "Needs a date"/"Needs a time" and amber inputs; read-only branch filters via `isDisplayableRehearsal`. Editor-only amber dot + sr-only text driven by `hasNonDisplayableRehearsal`. Tests: panel R443 (ordering, markers, border classes, read-only hides legacy), view R443 dot cases (editor, planned, viewer-absent, disappears once dated), "no write on load" (900 ms wait, `mockUpdateService` not called). |
| 5 | Dated rehearsals + report time display exactly as before on dashboard, Services card, My Schedule, volunteer view, share page (R445) | VERIFIED | Source gate empty. Five R445 regression test sets exist (new `DashboardView.rehearsalTimes.test.ts`, plus ServiceCard, ShareView, VolunteerServiceView, MyScheduleView additions) and pass in the full run; projection suite unmodified and green. |

### Plan-level truths (additional to roadmap SCs)

| Plan | Truth (abridged) | Status | Evidence |
| ---- | ---------------- | ------ | -------- |
| 01 | createService writes `rehearsals: []`, still copies reportTime | VERIFIED | services.ts L474-490 + 4 passing tests |
| 01 | Undated row filtered from projections/read surfaces until dated | VERIFIED | Unchanged `isDisplayableRehearsal`; projection suite green |
| 01 | Org default change never alters existing service (copy-not-live-bind retained) | VERIFIED | Test R442 copy-not-live-bind passes |
| 01 | Settings helper copy updated; data shape unchanged | VERIFIED | SettingsView.vue L546-549; type unchanged (doc-comment only) |
| 01 | R445 surfaces pinned by tests; no surface source change | VERIFIED | Gate empty; tests pass |
| 01 | ADR-0245 exists and is indexed | VERIFIED | File has all 5 headings; README row after ADR-0244 (L265) |
| 02 | One row per add; form resets; double submit blocked | VERIFIED | `onSubmitAdd` guards canAdd, resets; panel test asserts emitted('add') length 1 |
| 02 | Time pre-fill follows live default; override not clobbered; re-prefill after add | VERIFIED | `newTimeOverride` nullable pattern; panel R442 late-defaults test passes |
| 02 | Needs-a-date / needs-a-time markers; legacy-first ordering; stable | VERIFIED | `rows` computed; panel R443 tests |
| 02 | Empty states (editable and read-only) | VERIFIED | `rehearsals-empty`, `times-readonly-empty` present and tested |
| 02 | Chips: none for 1 default, one per default for 2+; sorted rows | VERIFIED | `chipTimes` (deduped after WR-02) gate `>1`; tests |
| 02 | Clear reverts, role=status for 4 s, no emit (behavior-dependent) | VERIFIED | Behavioral panel tests (fake timers, assert native value) pass in full run |
| 02 | Responsive classes; no cap/inner scroll | VERIFIED (visual deferred) | `flex-col sm:flex-row` present; no max-height/overflow on list; visual check in human items |
| 02 | Read-only: report time + displayable rehearsals only | VERIFIED | Template L145-175 + tests |
| 02 | `formatRehearsalDateShort` exported with guard; other helpers unchanged | VERIFIED | rehearsalTimes.ts diff: additions + doc comment + YMD_RE/HM_RE only |
| 03 | Edits ride existing autosave; no new concurrency semantics | VERIFIED | `onSave`/isDirty/useAutoSave unchanged; autosave test passes (`updateService('service-1', {rehearsals...})`) |
| 03 | Empty/undefined rehearsals: empty state, no dot, no markers | VERIFIED | `?? []` props; dot test absent for undefined/[] |
| 03 | No migration/no write on load | VERIFIED | Behavioral test with 900 ms real wait passes |
| 03 | v-show preserves add form; tab switch mid-debounce neither cancels nor duplicates | VERIFIED | Both tests exist and pass (behavior-dependent, test-backed) |
| 03 | Visible to everyone; edit controls only when canEditService; dot editors-only | VERIFIED | Unconditional tab, `authStore.isEditor && hasNonDisplayableRehearsal` |
| 03 | 360 px reach of 6th tab / active tab scrolls into view (`verification: backstop`) | UNCERTAIN (WARNING, human) | Non-inferable from code; `overflow-x-auto scrollbar-hide` present but reachability/scroll-into-view not proven. Routed to human_verification item 2. |
| 03 | Tab order + roving-tabindex keyboard includes Times, both roles | VERIFIED | `visibleTabOrder`; updated ServiceEditorView.test.ts and stage tests pass |
| 03 | Nothing time-related above the tab strip | VERIFIED | Header block removed; test passes |
| 03 | onAddRehearsal/Date/Time guards + R036 re-checks | VERIFIED | View L2759-2795; direct-handler R036 tests for viewer and locked editor pass |
| 03 | `buildActionBarItems('times', ctx)` returns [] | VERIFIED | serviceEditorActionBar.ts L230-231; TIMES EMPTY cartesian test passes |
| 03 | defaultTimes forwarded from org settings, nothing written | VERIFIED | View L1756; props-forwarding test |
| 03 | Editor dot on draft and locked services | VERIFIED | Dot test on planned service |

**Score:** 5/5 roadmap SC verified; 24/25 plan truths VERIFIED, 1 backstop truth routed to human. No PRESENT_BEHAVIOR_UNVERIFIED truths (every state-transition / cancellation invariant has a passing behavioral test).

### Post-SUMMARY review fixes (verified against current code)

- WR-01 (d1910d89): `YMD_RE`/`HM_RE` exported from `rehearsalTimes.ts`, imported by panel and view; panel `canAdd` and `onFieldChange` reject malformed values with a message; `max="9999-12-31"` on both date inputs. Present in code, tests in the passing suite.
- WR-02 (716aea7a): Settings save de-dupes via `Set` (SettingsView.vue L1352); panel `chipTimes` de-dupes. Present.
- WR-03 skipped with rationale (focus fallback); acceptable, info-level behavior, no goal impact.

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/components/ServiceTimesPanel.vue` | VERIFIED | 324 lines, substantive, imported and rendered by ServiceEditorView with all five events bound; no store imports, no v-html |
| `src/utils/rehearsalTimes.ts` (`formatRehearsalDateShort`) | VERIFIED | Exported, used by panel |
| `src/stores/services.ts` createService | VERIFIED | `rehearsals: []`, reportTime copy |
| `src/views/ServiceEditorView.vue` Times wiring | VERIFIED | Tab, panel wrapper, dot, handlers |
| `src/views/serviceEditorActionBar.ts` | VERIFIED | `'times'` union + empty branch |
| `src/views/SettingsView.vue` helper | VERIFIED | Copy + testid |
| ADR-0245 + README row | VERIFIED | Present |
| `.planning/codebase/ARCHITECTURE.md` panel entry | VERIFIED | `### src/components/ServiceTimesPanel.vue` at L1631 |
| `DashboardView.rehearsalTimes.test.ts` + 4 surface test additions | VERIFIED | R445 present in each; pass |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| ServiceEditorView -> ServiceTimesPanel | import + `<ServiceTimesPanel>` with 5 handlers | WIRED | one usage, events mapped to onAdd/Remove/DateChange/TimeChange/ReportTimeChange |
| Panel emit add -> parent -> localService -> autosave -> updateService | WIRED | autosave test proves persisted payload |
| ServiceEditorView -> buildActionBarItems(activeTab) | WIRED | union widened; 'times' returns [] |
| Settings/organization -> panel defaultTimes | WIRED | `authStore.settings.rehearsalTimeDefaults ?? []` |

### Data-Flow (Level 4)

Panel props flow from `localService` (live Firestore-backed doc copy) and org settings; add/edit mutate `localService`, persisted by unchanged autosave. Read-only surfaces consume the unchanged projections. FLOWING.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| R441 always-dated rows, no clear | 143-02, 143-03 | SATISFIED | SC 2 evidence |
| R442 defaults pre-fill, no undated rows at creation, report time copied | 143-01, 143-02, 143-03 | SATISFIED | SC 3 evidence |
| R443 legacy rows lossless, flagged, hidden publicly | 143-02, 143-03 | SATISFIED | SC 4 evidence |
| R444 Times tab | 143-02, 143-03 | SATISFIED (layout items pending UAT) | SC 1 evidence |
| R445 display unchanged | 143-01 | SATISFIED | SC 5 evidence |

All five IDs appear in plan frontmatter (01: R442/R443/R445; 02: R441-R444; 03: R441-R444) and REQUIREMENTS.md lists R441-R445 mapped to Phase 143. No orphaned requirements.

### Prohibitions (judgment tier - non-authoritative verdict, flagged `unverified-prohibition - human review recommended`)

| Plan | Prohibition | LLM-judge verdict |
| ---- | ----------- | ----------------- |
| 01 | Must not alter existing service when an org default changes | Honored - createService is the only reader; no live-bind; copy-not-live-bind test passes |
| 01 | Must not change sortRehearsals/isDisplayableRehearsal/formatWallClockTime/buildServiceSnapshot/buildRehearseAccess or any read surface | Honored - diffs empty/unchanged bodies; R445 gate empty |
| 02 | Must not delete/blank/silently alter a stored rehearsal except via Remove | Honored - reject-clear reverts DOM and emits nothing; parent no-ops; tests assert native value |
| 02 | Must not show undated/untimed rehearsal on any read-only/volunteer/public surface or projection | Honored - read-only panel filters; projections unchanged |
| 03 | Must not write a guessed/derived date: no migration, no auto-dating, service date never default | Honored - no migration code; add date never defaulted (`newDate` starts ''); no-write-on-load test |
| 03 | Must not relax canEditService self-gate / render edit controls for viewer or locked | Honored - all 5 handlers keep gate; bare `v-if="!canEdit"`; R036 tests |

### Anti-Patterns

None found in phase-touched source (no TBD/FIXME/XXX, no stubs, no v-html, no store access in the panel). WR-03 (Remove always calls `focusAddDate`, harmless when the add form is unmounted) is a known, accepted low-severity note.

### Behavioral Spot-Checks

Behavior-dependent truths were backed by named tests that ran and passed in the verifier's full-suite run (6055 passed): panel reject-clear/4 s message, no-write-on-load, autosave persistence, tab-switch mid-debounce, v-show persistence, R036 direct-handler gates, copy-not-live-bind.

### Probe Execution

Step 7c: SKIPPED (no probes declared in plans).

### Deferred Items

None. (R445's "production share payloads already written" re-projection is out of scope per the plan's A-R445 assumption: the filter is unchanged.)

### Human Verification Required

See frontmatter `human_verification` (6 items) - the owner's batched milestone-end UAT, PENDING (not accepted), plus the 360 px backstop truth and the flagged judgment-tier prohibitions. These are not gaps.

### Gaps Summary

No gaps. Goal achieved in code: the Times tab owns all rehearsal/report-time controls, no code path creates or clears-to-undated a rehearsal, createService no longer seeds rows, legacy rows are untouched and flagged, and every read-only surface and both projections are byte-unchanged and regression-pinned. Remaining items are visual/browser UAT batched to milestone end.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_
