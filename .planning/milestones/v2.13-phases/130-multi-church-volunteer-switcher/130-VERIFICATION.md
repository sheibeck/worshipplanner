---
phase: 130-multi-church-volunteer-switcher
verified: 2026-09-06T23:40:00Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Sign in as a real volunteer with rehearseAccess docs on 2+ distinct churches (rostered/planned services at both). Confirm the church <select> appears on My Schedule with both church names, selecting a church scopes the rendered cards, and the AppSidebar label matches the selection ('Multiple churches' when unselected, the church name when selected). Then sign in as a single-church volunteer and confirm no filter renders."
    expected: "Multi-church volunteer sees the filter + correctly-scoped list + matching sidebar label; single-church volunteer sees zero DOM footprint for the filter and the sidebar shows their one church's name."
    why_human: "Requires a real Firebase Auth session backed by rehearseAccess documents spanning 2+ orgIds — component-level mocks (already green) cannot exercise the real collectionGroup query, real auth session, or real cross-route navigation this depends on."
  - test: "Open a service from a filtered (church-scoped) My Schedule and confirm the AppSidebar church label in VolunteerServiceView still reflects the selected church, not a stale/different one (130-UI-SPEC.md's own 🧪 backstop item for ROADMAP Success Criterion 3 — 'selected-church context carries into the volunteer service view')."
    expected: "The sidebar label is unchanged/consistent when navigating from My Schedule into a service's VolunteerServiceView — no stale church name."
    why_human: "The phase's own UI-SPEC explicitly flags this as a 🧪 backstop item verified only functionally (shared Pinia singleton + shared AppShell/AppSidebar layout chrome, confirmed by code inspection below) rather than by a dedicated automated test that mounts VolunteerServiceView with a pre-selected church. Per the honest-verifier convention, a backstop truth abstains from VERIFIED status absent explicit test evidence."
  - test: "Confirm graceful fallback for an existing (pre-Phase-130) rehearseAccess doc that lacks orgName — either via a real doc that predates this projection change, or by manually stripping orgName from a test doc in the emulator — and decide whether a one-time backfill/re-projection is warranted."
    expected: "The church still appears in the filter/sidebar with 'Unnamed church'/'Your church' fallback text, never blank, never a raw orgId, never a crash — matches the code-level behavior already unit-tested."
    why_human: "This is a data-migration/backfill policy decision (130-CONTEXT.md's deferred one-time-backfill note), not something a fresh test fixture can decide — needs the owner's call on whether to backfill existing planned services' rehearseAccess docs or let them re-project naturally on next lock/resync."
---

# Phase 130: Multi-Church Volunteer Switcher Verification Report

**Phase Goal:** A volunteer serving at more than one church can switch/filter My Schedule (and the volunteer
service view context) by church, with each church labeled by name — while a volunteer serving at only one
church sees an unchanged, switcher-free experience.
**Verified:** 2026-09-06T23:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A volunteer serving at >1 church sees a church switcher/filter on My Schedule scoping displayed services to the selected church (R403) | ✓ VERIFIED | `src/views/MyScheduleView.vue` L42-53: `<select data-testid="church-filter" v-if="mySchedule.churches.length > 1">`; `groups` computed reads `mySchedule.filteredDocs` (L167); `mySchedule.filteredDocs` in `src/stores/mySchedule.ts` L47-50 filters `docs` by `orgId`. Test: `MyScheduleView.test.ts` "selecting a church scopes the rendered cards to that church and never calls authStore.selectOrg (R403)" — asserts card count drops from 2 to 1 after selecting `org-2`. |
| 2 | The switcher is distinct from the admin membership switcher and never calls `selectOrg` — volunteers have zero org memberships (R403) | ✓ VERIFIED | `src/stores/mySchedule.ts` has no `@/stores/auth` import and no `selectOrg(` call (grep confirmed, only comments mention the string). `src/views/MyScheduleView.vue`'s `onChurchChange` only assigns `mySchedule.selectedChurch` (L182-188). Unit test `mySchedule.test.ts` includes a source-scan regression test; `MyScheduleView.test.ts`'s selection test asserts `expect(mockSelectOrg).not.toHaveBeenCalled()`. |
| 3 | Each church labeled by name, sourced from `orgName` on the `rehearseAccess` projection via `buildRehearseAccess`/both write paths, and the selected-church context carries into the volunteer service view (R404) | ⚠️ Functionally present, one sub-clause backstop | `RehearseAccessDoc.orgName?: string` (`src/utils/rehearseAccess.ts` L58-62), conditional-spread emission at L233 (`...(orgName ? { orgName } : {})`) — key absent, never `undefined`, when empty. `writeRehearseAccessDoc` (`services.ts` L302-316) takes `orgName` and forwards to `buildRehearseAccess`. Both callers forward it: `markAsPlanned` from `authStore.orgName ?? undefined` (L639-643); `resyncRehearseAccessForSong` from a batched, best-effort `getDoc(doc(db,'organizations',org)).catch(() => null)` inside the existing `Promise.all` (L689-696), never blocking the write. Labeling is verified (filter options + sidebar label, see truth 4). The "carries into the volunteer service view" sub-clause is satisfied functionally — `VolunteerServiceView.vue` renders inside `AppShell`, which renders `AppSidebar` (confirmed by grep), and `AppSidebar`'s `volunteerChurchLabel` reads the same `mySchedule` Pinia singleton `MyScheduleView.vue` writes to — but this is the phase's own explicitly-flagged 🧪 backstop item (130-UI-SPEC.md, "partial (church context in VolunteerServiceView)"), with no dedicated automated test mounting `VolunteerServiceView` with a pre-selected church. Routed to human verification per the backstop convention. |
| 4 | A volunteer serving at only one church sees no switcher — unchanged single-church experience (R405) | ✓ VERIFIED | `v-if="mySchedule.churches.length > 1"` on the `<select>` (zero DOM footprint, not `v-show`). Tests: "renders no filter for a single-church volunteer (R405)" and "renders no filter when there are zero docs (R405)" both pass. |

**Score:** 4/4 truths present-and-wired with automated evidence; 1 (truth 3's service-view sub-clause) additionally routed to human verification per its own documented backstop status — not a failure, a designed escalation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/rehearseAccess.ts` | `orgName?: string` on `RehearseAccessDoc` + `orgName` param on `buildRehearseAccess`, conditional-spread | ✓ VERIFIED | L58-62 (field), L117 (param), L233 (conditional-spread emission) |
| `src/stores/services.ts` | `orgName` param on `writeRehearseAccessDoc`; both callers forward it | ✓ VERIFIED | L302-316 (choke point), L639-643 (`markAsPlanned`), L689-702 (`resyncRehearseAccessForSong`) |
| `src/stores/mySchedule.ts` | `selectedChurch`, `churches`, `filteredDocs` | ✓ VERIFIED | L33 (ref), L39-45 (`churches` computed, Map dedupe), L47-50 (`filteredDocs`), L55-58 (`resetStaleSelection`), all exposed in return object L101-109 |
| `src/views/MyScheduleView.vue` | Gated `<select>` church filter driving `filteredDocs` | ✓ VERIFIED | L42-53 (select, `v-if="mySchedule.churches.length > 1"`), L167 (`groups` reads `filteredDocs`) |
| `src/components/AppSidebar.vue` | `volunteerChurchLabel` computed + `v-else-if` branch | ✓ VERIFIED | L36-38 (template branch), L240-253 (computed) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `buildRehearseAccess` orgName | `writeRehearseAccessDoc` → `setDoc` payload | function param forwarding | ✓ WIRED | Both `markAsPlanned` and `resyncRehearseAccessForSong` pass orgName through the single choke point (`services.ts` L311) |
| `RehearseAccessDoc.orgName` | `MyScheduleDoc` → `churches` derivation | `{...data, orgId}` spread in `loadMySchedule` | ✓ WIRED | `mySchedule.ts` L82-85 spread carries `orgName` automatically (no explicit re-mapping needed, confirmed by code and by passing tests using `orgName` in doc fixtures) |
| `mySchedule.selectedChurch` | `<select>` value AND sidebar label | shared Pinia singleton | ✓ WIRED | `MyScheduleView.vue` binds `:value="mySchedule.selectedChurch ?? ''"`; `AppSidebar.vue`'s `volunteerChurchLabel` reads `mySchedule.selectedChurch` — same store instance (Pinia singleton), confirmed by both files calling `useMyScheduleStore()` |
| `mySchedule.filteredDocs` | `groupMySchedule` → rendered sections | computed → function call | ✓ WIRED | `MyScheduleView.vue` L167: `computed(() => groupMySchedule(mySchedule.filteredDocs))` |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted phase test files | `npx vitest run src/utils/rehearseAccess.test.ts src/stores/__tests__/services.test.ts src/stores/__tests__/mySchedule.test.ts src/views/__tests__/MyScheduleView.test.ts src/components/__tests__/AppSidebar.test.ts` | 5 files, 184 tests, all passed | ✓ PASS |
| Type-check | `npm run type-check` (vue-tsc --build) | Clean, no errors | ✓ PASS |
| Full app suite (regression check) | `npx vitest run` | 212/213 files passed, 5489/5524 tests passed (35 skipped); only failure is the documented baseline `src/storage.rules.test.ts` (Storage-emulator `firestore.exists()` limitation, unrelated to this phase, per CLAUDE.md) | ✓ PASS (no new regressions) |
| Debt-marker scan | grep TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER across the 5 phase-modified source files | none found | ✓ PASS |
| Commit existence | `git show --stat` on all 5 task commits (dea22523, d86da749, e0a7d398, 0bfc2201, db7254d8) | all present in git log | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R403 | 130-01, 130-02 | Church switcher/filter distinct from admin switcher, never calls selectOrg | ✓ SATISFIED | Truths 1, 2 |
| R404 | 130-01, 130-02 | Churches labeled by name via `orgName` field; selected-church context carries into volunteer service view | ✓ SATISFIED (labeling) / ? NEEDS HUMAN (service-view carry-through, backstop) | Truth 3 |
| R405 | 130-01, 130-02 | Single-church volunteer sees no switcher | ✓ SATISFIED | Truth 4 |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps R403-R405 exclusively to Phase 130, and both plans declare all three in `requirements:` frontmatter.

### Anti-Patterns Found

None. No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER markers, no empty stub returns, no hardcoded-empty props found in the 5 phase-modified files (`rehearseAccess.ts`, `services.ts`, `mySchedule.ts`, `MyScheduleView.vue`, `AppSidebar.vue`).

### Human Verification Required

### 1. Real multi-church volunteer end-to-end

**Test:** Sign in as a real volunteer with rehearseAccess docs on 2+ distinct churches. Confirm the church filter appears, correctly labeled, and correctly scopes the list; confirm the sidebar label agrees. Then sign in as a single-church volunteer and confirm no filter.
**Expected:** Multi-church volunteer sees filter + scoped list + matching sidebar label; single-church volunteer sees zero DOM footprint for the filter.
**Why human:** Requires a real Firebase Auth session backed by real `rehearseAccess` documents across 2+ orgIds — beyond what component-level mocks can exercise (real collectionGroup query, real cross-org roster/planning state).

### 2. Selected-church context inside VolunteerServiceView

**Test:** From a filtered My Schedule, open a service and confirm the sidebar church label in `VolunteerServiceView` still reflects the correct/selected church.
**Expected:** No stale or mismatched church name after navigating into the service view.
**Why human:** The phase's own `130-UI-SPEC.md` marks this a 🧪 backstop item, resolved functionally (shared Pinia singleton + shared `AppShell`/`AppSidebar` layout, confirmed present in code) but without a dedicated automated test exercising the cross-route scenario directly.

### 3. Pre-orgName document fallback + backfill decision

**Test:** Confirm a rehearseAccess doc predating Phase 130 (lacking orgName) shows the graceful fallback text, and decide whether to backfill existing planned services.
**Expected:** "Unnamed church"/"Your church" fallback renders, never blank/crash; owner decides on backfill.
**Why human:** Data-migration/backfill policy call, not something a fresh test fixture can decide (130-CONTEXT.md's deferred backfill note).

### Gaps Summary

No code-level gaps found. All artifacts exist, are substantive (not stubs), are wired end-to-end, and are backed by 184 passing targeted unit/component tests plus a clean full-suite regression run (212/213, matching the documented baseline) and a clean `vue-tsc --build`. The `human_needed` status is driven entirely by (a) the phase's own explicitly-declared 🧪 backstop item for the service-view context sub-clause of R404/SC3, and (b) two additional human-only items already anticipated in 130-VALIDATION.md's Manual-Only Verifications table (real multi-church account, pre-orgName backfill decision). None of these are failures — the code review confirms the underlying mechanism (shared Pinia singleton, shared layout chrome, conditional-spread, best-effort getDoc) is present, correct, and exercised by unit tests wherever a unit test can reach it.

---

*Verified: 2026-09-06T23:40:00Z*
*Verifier: Claude (gsd-verifier)*
