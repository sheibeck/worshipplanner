---
phase: 139-rehearsal-report-times
verified: 2026-09-09T23:00:00Z
status: human_needed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In Settings, set default rehearsal time(s) + a report time, save, reload — confirm defaults persist. Create a new service and confirm rehearsal rows + report time pre-fill from those defaults. In the editor, add/edit/remove rehearsals and set the report time, confirm autosave (visible Saved/no-error state)."
    expected: "Defaults persist across reload; a new service's Times subsection shows one row per org-default rehearsal time (date blank) plus the report time; editor add/edit/remove + report-time changes autosave without error."
    why_human: "Visual/interactive UX confirmation of Settings save/revert flow and editor autosave feedback — SettingsView's onSaveRehearsalDefaults save/revert branch has no dedicated automated test (139-REVIEW.md IN-01, plan-scoped-as-deferred); deferred human-check in 139-02-PLAN.md Task 1 and 139-VALIDATION.md Manual-Only (R429)."
  - test: "After adding times to a service AND re-locking it (mark as planned, so RehearseAccessDoc refreshes), confirm My Schedule, the volunteer service view, and the public share/plan page each show the report time + dated rehearsals alongside the date, correctly formatted and in chronological order."
    expected: "All three projection-fed surfaces show the same report time + rehearsal times, formatted 12-hour wall-clock, chronologically ordered, with undated/untimed rows hidden."
    why_human: "Cross-surface visual/layout rendering judgment — deferred human-check in 139-02-PLAN.md Task 2 and 139-VALIDATION.md Manual-Only (R433)."
  - test: "Confirm the services-list card (ServiceCard) and both dashboard service surfaces (Next service / Following services) show the report time + dated rehearsals next to the date, chronologically, with undated rows hidden."
    expected: "Both live-Service-fed surfaces render the same formatted, sorted, dated-only times next to the existing date display."
    why_human: "Visual/layout judgment on live-Service read paths — deferred human-check in 139-02-PLAN.md Task 3 and 139-VALIDATION.md Manual-Only (R433)."
---

# Phase 139: Rehearsal & Report Times Verification Report

**Phase Goal:** Every service carries real rehearsal and report times, pre-filled from org-level defaults, and those times are visible everywhere a service's date already appears.
**Verified:** 2026-09-09
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Org-level default rehearsal time(s) + report time set in Settings and persist (R429) | ✓ VERIFIED | `OrgSettings.rehearsalTimeDefaults`/`reportTimeDefault` + `DEFAULT_ORG_SETTINGS` seeds (`src/types/organization.ts:107,109,188-189`); `applyOrgSnapshot`'s existing shallow `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }` spread covers both flat fields, confirmed no deep-merge branch needed (`src/stores/auth.ts:398-410`); `SettingsView.vue` "Rehearsal & Report Defaults" section (lines 543-614) with add/remove rehearsal-time rows + report-time input, `onSaveRehearsalDefaults` (lines 1351-1383) writing via `authStore.updateOrgSettings({'settings.rehearsalTimeDefaults':..., 'settings.reportTimeDefault':...})` with revert-on-error and timed Saved! feedback, mirroring the existing Messaging section pattern. Persistence-after-reload UX is a harvested human-check item (see below). |
| 2 | New service pre-fills by COPYING org defaults; later org-default edits never mutate an existing service — copy-not-live-bind (R429, R432) | ✓ VERIFIED | `createService` (`src/stores/services.ts:474-494`) synthesizes `rehearsals`/`reportTime` from `authStore.settings.*` once, writing to both the `addDoc` payload and the parallel `created: Service` object (line 507-518) used for `ensureShareLink`. Proven by `src/stores/__tests__/services.rehearsalDefaults.test.ts` (4 tests, all passing): copy-into-new-doc, copy-not-live-bind (mutating org defaults after creation leaves the captured payload byte-identical via a `JSON.parse(JSON.stringify(...))` snapshot comparison), fresh-copy inverse (a service created after a defaults change picks up the new defaults), and empty-defaults → `[]`/`''` not `undefined`. |
| 3 | Multiple dated rehearsals + one report time editable in the service editor, always chronologically ordered (R430, R431) | ✓ VERIFIED | `ServiceEditorView.vue` "Times" subsection (lines 260-332): add/edit/remove rehearsal rows (native date+time inputs) + one report-time input, ordered via `sortRehearsals` (`editableRehearsals`, line 2807), gated by `canEditService` (verified below under CR-02), writing through the existing `onSave` → `updateService(id, { rehearsals, reportTime, ... })` debounced-autosave path (lines 4831-4844) — no new save mechanism. `sortRehearsals` chronological ordering (date-then-time, undated-last, non-mutating) proven by 3 dedicated tests in `rehearsalTimes.test.ts`. |
| 4 | Times shown alongside the date on dashboard, My Schedule, volunteer service view, and public share/plan view — threaded through BOTH `buildServiceSnapshot` and `buildRehearseAccess` (R433) | ✓ VERIFIED | Both projection builders declare and carry `rehearsals?`/`reportTime?` (`services.ts:97-98`, `rehearseAccess.ts:70-71`), filtering via the shared `isDisplayableRehearsal`, sorting via `sortRehearsals`, and omitting empties via conditional-spread — identical treatment in both, proven by the 7-test dual-builder suite `services.rehearsalProjection.test.ts` (value-surfaces-in-both, undated-filtered, dated-but-timeless-filtered, chronological-order, empty-omitted, all-undated-omitted, all-timeless-omitted). Display wiring confirmed at all 6 surfaces: `MyScheduleView.vue` passes `:report-time`/`:rehearsals` at all 3 `<ScheduleServiceCard>` call sites (lines 65-66, 91-92, 134-135); `ScheduleServiceCard.vue` renders via `formatWallClockTime` (2 component tests passing); `ShareView.vue` (lines 211-219) and `VolunteerServiceView.vue` (lines 241-249) read the projection fields as-is; `ServiceCard.vue` (lines 165-172) and `DashboardView.vue` (lines 418-427) read the live `Service` with a client-side `isDisplayableRehearsal`+`sortRehearsals` filter, matching the projection's own filter treatment. |
| 5 | CR-01 fixed: shared `isDisplayableRehearsal` (date AND time) used at all read-only/projection sites; `formatWallClockTime('')` returns `''` not "Invalid Date" | ✓ VERIFIED | Commit `6e281581` on HEAD. `isDisplayableRehearsal` (`rehearsalTimes.ts:55-57`) requires both `date !== ''` and `time !== ''`, imported and used at exactly the 5 cited call sites (`services.ts:201`, `rehearseAccess.ts:274`, `ServiceCard.vue:169`, `DashboardView.vue:419`, `ServiceEditorView.vue:2815` for `readOnlyRehearsals` — the editor's `editableRehearsals` intentionally still shows every row for in-progress editing). `formatWallClockTime` (`rehearsalTimes.ts:41-46`) now guards `if (!hhmm) return ''` and `NaN`-checks h/m before constructing the Date. Regression-proven by 4 new `isDisplayableRehearsal` unit tests + an empty-input guard test in `rehearsalTimes.test.ts`, and 2 dated-but-timeless projection tests in `services.rehearsalProjection.test.ts` — all passing. |
| 6 | CR-02 fixed: Times editor subsection read-only for non-editors/locked services | ✓ VERIFIED | Commit `5537daea` on HEAD. `ServiceEditorView.vue:260-332` now splits `v-if="!canEditService"` (pure gate) from `v-show="readOnlyRehearsals.length > 0 || !!localService.reportTime"` (content-presence, applied only within the read-only branch) — the previous bug (folding both conditions into one `v-if`/`v-else`, which rendered the editable branch whenever there was "nothing to show" regardless of edit permission) is gone. All three interactive inputs carry `:disabled="!canEditService"` as defense in depth. Proven by 5 new tests in `ServiceEditorView.timesSection.test.ts`: editable UI renders for an editor on a draft service; does NOT render for a non-editor with no times set; does NOT render for an editor viewing a locked (`planned`) service with no times set; inputs carry `:disabled`; `onAddRehearsal` no-ops when `canEditService` is false. |

**Score:** 6/6 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/rehearsalTimes.ts` | `Rehearsal`, `sortRehearsals`, `formatWallClockTime`, `isDisplayableRehearsal` | ✓ VERIFIED | All 4 exports present, store-free, unit-tested (12 tests) |
| `src/utils/__tests__/rehearsalTimes.test.ts` | Behavior coverage incl. timezone stability + CR-01 guard | ✓ VERIFIED | 12/12 tests pass, incl. TZ-override stability test (UTC/+14/-12) |
| `src/types/service.ts` | `Service.rehearsals?`/`reportTime?` | ✓ VERIFIED | Additive, JSDoc-documented, no migration |
| `src/types/organization.ts` | `OrgSettings.rehearsalTimeDefaults`/`reportTimeDefault` + `DEFAULT_ORG_SETTINGS` | ✓ VERIFIED | Flat fields, seeded `[]`/`''` |
| `src/stores/services.ts` | `createService` copy pre-fill; `ServiceSnapshot`/`buildServiceSnapshot` carry fields | ✓ VERIFIED | Wired and tested |
| `src/utils/rehearseAccess.ts` | `RehearseAccessDoc`/`buildRehearseAccess` carry fields | ✓ VERIFIED | Wired and tested, identical treatment to services.ts |
| `src/stores/__tests__/services.rehearsalDefaults.test.ts` | Copy, copy-not-bind, fresh-copy tests | ✓ VERIFIED | 4/4 tests pass |
| `src/stores/__tests__/services.rehearsalProjection.test.ts` | Dual-builder projection tests | ✓ VERIFIED | 7/7 tests pass (extended post-CR-01 with 2 dated-but-timeless cases) |
| `src/views/ServiceEditorView.vue` | "Times" subsection, canEditService-gated | ✓ VERIFIED | Wired to autosave; CR-02 fix confirmed; 5 dedicated tests pass |
| `src/views/SettingsView.vue` | "Rehearsal & Report Defaults" section | ✓ VERIFIED | Present, wired to `updateOrgSettings`; save/revert logic itself untested (IN-01, harvested as human-check) |
| `src/components/ServiceCard.vue` | Report/rehearsal time display | ✓ VERIFIED | `isDisplayableRehearsal`+`sortRehearsals` filter, `formatWallClockTime` render |
| `src/components/ScheduleServiceCard.vue` | Report/rehearsal time props + display | ✓ VERIFIED | 2 component tests pass; TODO from lines 40-41 closed |
| `src/views/MyScheduleView.vue` | All 3 call sites pass new props | ✓ VERIFIED | Grep-confirmed 3/3 call sites wired |
| `src/views/ShareView.vue` | Projection-fed time display | ✓ VERIFIED | Reads `serviceSnapshot.rehearsals`/`.reportTime` as-is |
| `src/views/DashboardView.vue` | Live-Service time display (2 surfaces) | ✓ VERIFIED | `isDisplayableRehearsal`+`sortRehearsals` filter applied |
| `src/views/VolunteerServiceView.vue` | Projection-fed time display | ✓ VERIFIED | Reads `doc.rehearsals`/`.reportTime` as-is |
| `src/components/__tests__/ScheduleServiceCard.test.ts` | Behavior tests | ✓ VERIFIED | 2/2 tests pass |
| `src/views/__tests__/ServiceEditorView.timesSection.test.ts` | CR-02 regression coverage | ✓ VERIFIED | 5/5 tests pass (new file, closes WR-01) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `createService` | `authStore.settings.rehearsalTimeDefaults`/`reportTimeDefault` | One-time read at creation, copied into both `addDoc` payload and `created` object | ✓ WIRED | `services.ts:474-494, 507-518`; copy-not-live-bind test-proven |
| `buildServiceSnapshot` (services.ts) | `buildRehearseAccess` (rehearseAccess.ts) | Both import `isDisplayableRehearsal`/`sortRehearsals` from `rehearsalTimes.ts`, conditional-spread `rehearsals`/`reportTime` | ✓ WIRED | Identical treatment confirmed line-by-line; dual-builder test suite passes |
| `MyScheduleView.vue` | `ScheduleServiceCard.vue` (×3 call sites) | `:report-time="doc.reportTime"` `:rehearsals="doc.rehearsals"` | ✓ WIRED | grep confirms exactly 3/3 call sites updated |
| `ServiceEditorView.vue` "Times" subsection | `updateService(id, { rehearsals, reportTime })` | Existing 800ms debounced-autosave (`useAutoSave`/`isDirty` watcher) → `onSave` | ✓ WIRED | No new save mechanism; `onSave`'s payload explicitly includes `rehearsals: data.rehearsals ?? []`, `reportTime: data.reportTime ?? ''` (send-not-omit, so clearing overwrites remote value) |
| `SettingsView.vue` "Rehearsal & Report Defaults" | `authStore.updateOrgSettings` | Dot-path keys `'settings.rehearsalTimeDefaults'`/`'settings.reportTimeDefault'` | ✓ WIRED | Mirrors existing Messaging-section save handler shape |
| Every display + editor site | `formatWallClockTime`/`sortRehearsals`/`isDisplayableRehearsal` | Import from `src/utils/rehearsalTimes.ts` | ✓ WIRED | Grep-confirmed: no 6th hand-rolled date/time copy; the pre-CR-01 5-way duplication of the filter predicate was consolidated into the one shared `isDisplayableRehearsal` export |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R429 | 139-01, 139-02 | Org-level defaults, persisted, pre-fill new services | ✓ SATISFIED | Types + Settings UI + createService copy, all wired and tested |
| R430 | 139-01, 139-02 | Multiple dated rehearsals, add/edit/remove, chronological | ✓ SATISFIED | Editor Times subsection + sortRehearsals, tested |
| R431 | 139-01, 139-02 | Single day-of report time, editable | ✓ SATISFIED | Editor report-time input, tested |
| R432 | 139-01 | Copy-not-live-bind pre-fill | ✓ SATISFIED | `services.rehearsalDefaults.test.ts`, 4/4 passing |
| R433 | 139-01, 139-02 | Display everywhere date shows, both projections | ✓ SATISFIED | 6 display surfaces + 2 projection builders, all wired and tested |

No orphaned requirements — REQUIREMENTS.md maps exactly R429-R433 to Phase 139, all marked Complete, all accounted for across the two plans' `requirements:` frontmatter.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the 19 files reviewed. No stub returns, no hardcoded empty props at call sites, no console.log-only implementations.

### Automated Verification Run (by this verifier, not SUMMARY claims)

- `npm run type-check` (vue-tsc --build): **clean**.
- Phase-specific test files run directly: `rehearsalTimes.test.ts` (12), `services.rehearsalDefaults.test.ts` (4), `services.rehearsalProjection.test.ts` (7), `ScheduleServiceCard.test.ts` (2), `ServiceEditorView.timesSection.test.ts` (5) — **30/30 passing**.
- Full `npx vitest run`: **230/231 files pass, 5738/5772 tests pass**; the only failing file is `src/storage.rules.test.ts` (34 tests, documented Storage-emulator baseline per CLAUDE.md) — **exact match to the documented baseline, no regression**.
- Both code-review fix commits (`6e281581` CR-01, `5537daea` CR-02) confirmed present on `git log` HEAD (36 commits ahead of `worshipplanner/master`, working tree clean).

### Human Verification Required

These are harvested from the `<human-check>` blocks the planner deliberately deferred to end-of-phase batched UAT (139-02-PLAN.md Tasks 1-3) and match 139-VALIDATION.md's Manual-Only table. Automated coverage exists for every underlying mechanism (save call, copy logic, projection filtering, prop wiring) — these three items are the remaining visual/interactive confirmations that presence-and-wiring checks cannot see.

### 1. Settings defaults persistence + new-service pre-fill + editor autosave UX

**Test:** In Settings, set default rehearsal time(s) + a report time, save, reload — confirm defaults persist. Create a new service and confirm rehearsal rows + report time pre-fill. In the editor, add/edit/remove rehearsals and set the report time, confirm autosave.
**Expected:** Defaults persist across reload; new service's Times subsection pre-fills one row per org-default time (date blank) + the report time; editor CRUD operations autosave without error.
**Why human:** `SettingsView.vue`'s `onSaveRehearsalDefaults` save/revert/filter logic has no dedicated automated test (139-REVIEW.md IN-01, plan-scoped-as-deferred — no `tdd="true"` on this task); the actual reload-persists and pre-fill-visible behaviors are UI/UX confirmations.

### 2. My Schedule / volunteer view / public share display

**Test:** After adding times to a service AND re-locking it (mark as planned, so `RehearseAccessDoc` refreshes), confirm My Schedule, the volunteer service view, and the public share/plan page each show the report time + dated rehearsals alongside the date, chronologically.
**Expected:** All three surfaces show the same, correctly-formatted, chronologically-ordered times.
**Why human:** Cross-surface visual/layout rendering judgment; also depends on the accepted existing latency contract that `RehearseAccessDoc` only refreshes at `markAsPlanned`.

### 3. Services-list card + dashboard display

**Test:** Confirm the services-list card and both dashboard service surfaces (Next service / Following services) show the report time + dated rehearsals next to the date, chronologically, with undated rows hidden.
**Expected:** Both live-Service-fed surfaces render correctly.
**Why human:** Visual/layout judgment on the live-Service read path.

### Gaps Summary

No gaps. All four ROADMAP.md success criteria are verified true in the codebase with strong, passing automated test evidence (30 new/extended tests across 5 files, all green). Both code-review findings (CR-01: dated-but-timeless "Invalid Date" leak to the public Share page; CR-02: Times subsection not actually gated on `canEditService`) are fixed on HEAD (`6e281581`, `5537daea`) with dedicated regression tests. Type-check is clean and the full suite matches the documented baseline exactly (only `storage.rules.test.ts`, a known Storage-emulator limitation, fails). The only open items are the three UX/visual confirmations the plan itself deliberately deferred to end-of-phase human UAT — none of them represent missing or unwired functionality.

Minor, non-blocking note: ROADMAP.md's phase-139 checklist still shows `139-02-PLAN.md` unchecked (`[ ]`) and "Plans: 1/2 plans executed," which is stale relative to the completed SUMMARY and the verified code — a bookkeeping update, not a functional gap.

---

_Verified: 2026-09-09_
_Verifier: Claude (gsd-verifier)_
