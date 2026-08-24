---
phase: 82-per-org-ai-enablement
plan: 02
subsystem: ui
tags: [vue, pinia, auth-store, ai-gating, owner-console, settings]

# Dependency graph
requires:
  - phase: 82-per-org-ai-enablement (Plan 01)
    provides: "organizations/{orgId}.aiMasterEnabled field shape + setOrgAiEnabled callable contract + OrgSummary.aiMasterEnabled on listOrganizations (consumed here, ships UNDEPLOYED)"
provides:
  - "authStore.aiMasterEnabled ref: read in applyOrgSnapshot (absent/false=OFF), cleared on every org-context reset (resetOrgContext, logout, onAuthStateChanged null branch)"
  - "claudeApi.ts isAiEnabled() two-gate AND: authStore.aiMasterEnabled && authStore.settings.aiEnabled, master gate checked first"
  - "SettingsView.vue AI Features card v-if-gated on authStore.aiMasterEnabled (R243)"
  - "OrganizationsTab.vue per-row AI on/off toggle calling setOrgAiEnabled, mirroring onToggleActive's shape"
affects: [ai-proxy, owner-console, settings-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-gate AND at a single choke-point function (isAiEnabled), master gate checked first as defense-in-depth"
    - "Per-org boolean gate cleared at every org-context reset point (resetOrgContext, logout, onAuthStateChanged null branch), mirroring vwModeEnabled/settings' three-reset-point shape exactly"
    - "Owner Console per-row toggle as a pure httpsCallable consumer, mirroring onToggleActive's guard/call/refresh/error shape verbatim"

key-files:
  created: []
  modified:
    - src/types/organization.ts
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts
    - src/utils/claudeApi.ts
    - src/utils/__tests__/claudeApi.test.ts
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts

key-decisions:
  - "Field/ref named aiMasterEnabled (never a bare aiEnabled) to avoid colliding with the pre-existing settings.aiEnabled -- per 82-RESEARCH.md Pitfall 1, matches Plan 01's field name exactly"
  - "aiMasterEnabled defaults false (absent = OFF) everywhere it is read, deliberately the INVERSE of vwModeEnabled's `?? true` default, since R242 requires AI off by default for every org"
  - "aiMasterEnabled is reset to false at all THREE org-context-clearing points in auth.ts (resetOrgContext, logout, onAuthStateChanged null branch), not just resetOrgContext -- extends beyond the plan's literal instruction (which named only resetOrgContext) to close the same stale-leak class vwModeEnabled/settings already guard against at all three points (Rule 2 -- missing critical functionality, consistency with an existing multi-point invariant)"
  - "Existing src/utils/__tests__/claudeApi.test.ts (not the plan's literal src/utils/claudeApi.test.ts path) was extended in place, since that file already existed with the isAiEnabled mock this task needed to extend -- the plan's cited path was the source-file-adjacent convention name, not the project's actual __tests__/ subfolder convention"
  - "OrganizationsTab.vue's per-row AI button omits an aria-label/data-testid beyond its own visible text (Enable AI/Disable AI), mirroring the pre-existing Deactivate/Reactivate button's own plain-text-only precedent in this file"

patterns-established: []

requirements-completed: [R242, R243]

coverage:
  - id: D1
    description: "authStore.aiMasterEnabled ref reads the org doc's master-gate field (absent/false=OFF), and resets to false at every org-context reset point (resetOrgContext, logout, onAuthStateChanged null branch)"
    requirement: "R242"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts -- 'aiMasterEnabled (Phase 82, R242/R243)' describe block (5/5 pass); full file 98/98"
        status: pass
    human_judgment: false
  - id: D2
    description: "isAiEnabled() in claudeApi.ts is a two-gate AND (authStore.aiMasterEnabled && authStore.settings.aiEnabled), master gate checked first -- an AI export resolves null without calling the proxy when either gate is off"
    requirement: "R242, R243"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts -- 'isAiEnabled() two-gate AND (Phase 82, R242/R243)' describe block (5/5 pass); full file 87/87"
        status: pass
    human_judgment: false
  - id: D3
    description: "SettingsView.vue's AI Features card is not rendered in the DOM at all when authStore.aiMasterEnabled is false, and renders normally when true"
    requirement: "R243"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts -- 'SettingsView AI Features card visibility (Phase 82, R242/R243)' describe block (2/2 pass); full file 42/42"
        status: pass
    human_judgment: false
  - id: D4
    description: "OrganizationsTab.vue has a per-row AI on/off control reflecting each org's aiMasterEnabled state, round-trips through the setOrgAiEnabled callable with the negated value, refreshes the list on success, guards against concurrent toggles, and surfaces a friendly per-row error (including a permission-denied mapping) on rejection without crashing the tab"
    requirement: "R242"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts -- 'OrganizationsTab -- AI on/off toggle (R242, Phase 82)' describe block (7/7 pass); full file 49/49"
        status: pass
    human_judgment: false
  - id: D5
    description: "App suite stays at the documented 2-file known-failing baseline (storage.rules.test.ts, RosterView.test.ts) with no new failures; npm run type-check (vue-tsc --build, which typechecks test files too) is clean"
    verification:
      - kind: unit
        ref: "npx vitest run (full suite): 142/144 files passed, 4250/4276 tests passed -- the 2 failing files are exactly the documented baseline, no new failures; npm run type-check: clean"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-24
status: complete
---

# Phase 82 Plan 02: Client-Side Per-Org AI Enablement Summary

**authStore.aiMasterEnabled ref (default OFF) two-gates claudeApi.ts's isAiEnabled(), hides SettingsView's AI Features card, and drives a new Owner Console per-row AI toggle against the (Plan-01, still-undeployed) setOrgAiEnabled callable.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-24T13:41:00Z
- **Completed:** 2026-08-24T18:01:27Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `Organization.aiMasterEnabled?: boolean` added, distinct from the nested `settings.aiEnabled` leaf (Pitfall 1 from 82-RESEARCH.md)
- `authStore.aiMasterEnabled` ref reads the org doc's master gate in `applyOrgSnapshot` (absent/false = OFF, deliberately the inverse of `vwModeEnabled`'s `?? true`) and is cleared at all three org-context-clearing points (`resetOrgContext`, `logout`, `onAuthStateChanged` null branch)
- `claudeApi.ts`'s `isAiEnabled()` choke point is now a two-gate AND (`authStore.aiMasterEnabled && authStore.settings.aiEnabled`), master gate checked first — every one of the three AI-calling exports (`getSongSuggestions`, `getScriptureSuggestions`, `splitCongregationalReading`) inherits the block automatically
- `SettingsView.vue`'s "AI Features" card is now `v-if="authStore.aiMasterEnabled"` — not rendered at all when a super-admin has disabled AI for the org
- `OrganizationsTab.vue` gained a per-row "Enable AI"/"Disable AI" button mirroring `onToggleActive`'s shape exactly (guard against concurrent toggles, negate the current state, call the callable, refresh the list, friendly per-row error on rejection)

## Task Commits

1. **Task 1: Master-gate field, auth store ref/read/reset, two-gate isAiEnabled()** - `24993824` (feat)
2. **Task 2: Hide the Settings AI Features card when the master gate is off** - `a0b56e67` (feat)
3. **Task 3: Owner Console per-row AI on/off toggle in the Organizations tab** - `bdd1e04d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/types/organization.ts` - `Organization.aiMasterEnabled?: boolean` (absent/false = OFF)
- `src/stores/auth.ts` - `aiMasterEnabled` ref, read in `applyOrgSnapshot`, reset in `resetOrgContext`/`logout`/`onAuthStateChanged` null branch, exposed from the store
- `src/stores/__tests__/auth.test.ts` - `aiMasterEnabled (Phase 82, R242/R243)` describe block: default-off, explicit true/false, logout reset, no-org reset
- `src/utils/claudeApi.ts` - `isAiEnabled()` two-gate AND, master gate checked first
- `src/utils/__tests__/claudeApi.test.ts` - `isAiEnabled() two-gate AND (Phase 82, R242/R243)` describe block covering both blocking cases across all three exports plus the both-on allow case; extended the existing `useAuthStore` mock with a getter-mocked `aiMasterEnabled`
- `src/views/SettingsView.vue` - AI Features card wrapped in `v-if="authStore.aiMasterEnabled"`
- `src/views/__tests__/SettingsView.test.ts` - `SettingsView AI Features card visibility (Phase 82, R242/R243)` describe block; extended the shared auth-store mock with `mockAiMasterEnabled` and reset it in every existing `beforeEach`
- `src/components/admin/OrganizationsTab.vue` - `OrgSummary.aiMasterEnabled?`, `SetOrgAiEnabledRequest`/`Response` types, `togglingAiOrgId`/`aiToggleError` state, `onToggleAi()`, per-row button + inline error
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - `OrganizationsTab -- AI on/off toggle (R242, Phase 82)` describe block: state reflection, enable/disable call shape, list refresh, double-submit guard, error surfacing (generic + permission-denied)

## Decisions Made
- `aiMasterEnabled` reset was extended beyond the plan's literal instruction (which named only `resetOrgContext`) to all three org-context-clearing points in `auth.ts` — `logout()` and the `onAuthStateChanged` null-user branch also had inline `vwModeEnabled`/`settings` resets that would otherwise leave a stale `aiMasterEnabled` value across a full sign-out/sign-in cycle. This mirrors the exact multi-point reset shape those two existing refs already require (Rule 2 — missing critical functionality, consistency with an established invariant rather than new scope).
- The plan's cited test path `src/utils/claudeApi.test.ts` does not match this codebase's actual convention (`src/utils/__tests__/claudeApi.test.ts`, which already existed with the `isAiEnabled`-adjacent mock). Extended the real, pre-existing file in place rather than creating a duplicate at the plan's literal path.
- Added an `afterEach` mock-reset to the new `claudeApi.test.ts` describe block after discovering it would otherwise leak a real `mockCreate` invocation into the adjacent WR-03 block's "never calls the SDK" assertions (test-isolation fix, not a production-code deviation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Reset `aiMasterEnabled` at all three org-context-clearing points in auth.ts, not just `resetOrgContext`**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` named only `resetOrgContext` (line 338) for the reset. Reading the surrounding code showed `vwModeEnabled`/`settings` are ALSO reset inline in `logout()` (line ~790) and the `onAuthStateChanged` null-user branch (line ~582) — three separate reset sites the file's own comments call out as a maintained invariant ("ALL THREE places that reset org context inline"). Leaving `aiMasterEnabled` out of the other two would leak a stale true value across a sign-out and back in, or across the null-user auth transition.
- **Fix:** Added `aiMasterEnabled.value = false` to `logout()` and the `onAuthStateChanged` null branch, alongside the existing `vwModeEnabled`/`settings` resets.
- **Files modified:** `src/stores/auth.ts`
- **Verification:** `src/stores/__tests__/auth.test.ts`'s new `resets to false on logout` and `resets to false when the user belongs to no organization` tests pass.
- **Committed in:** `24993824` (Task 1 commit)

**2. [Rule 1 - Bug] Test-isolation leak between the new claudeApi.test.ts describe block and the adjacent WR-03 block**
- **Found during:** Task 1 (writing the new `isAiEnabled() two-gate AND` describe block)
- **Issue:** The new block's final "allows AI when both gates are on" test genuinely calls `mockCreate` once; the pre-existing WR-03 block immediately after it has no `beforeEach` (by original design, since nothing before it was expected to invoke the mock) and asserts `mockCreate`/`mockParse` were never called — the recorded call leaked across the block boundary and failed all three WR-03 tests when the file ran as a whole (isolated `-t` runs passed, masking it initially).
- **Fix:** Added an `afterEach` to the new describe block resetting `mockCreate`/`mockParse`.
- **Files modified:** `src/utils/__tests__/claudeApi.test.ts`
- **Verification:** Full file run: 87/87 pass (previously 84/87 when run as a whole, 87/87 when filtered — now consistent either way).
- **Committed in:** `24993824` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug/test-isolation)
**Impact on plan:** Both auto-fixes necessary for correctness (Task 1's field consistency) and reliable green tests (test-isolation fix). No scope creep — no architectural change, no new file, no new dependency.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required. The `setOrgAiEnabled` callable this plan's Owner Console button calls ships UNDEPLOYED with Plan 01 (see that plan's SUMMARY/PENDING-VERIFICATION.md for the deploy hand-over); until deployed, clicking the Owner Console toggle surfaces the shared friendly-error string rather than succeeding — expected and by design for this client-only plan.

## Next Phase Readiness
- Client-side gating (R242 Owner Console control, R243 Settings panel hide) is fully implemented and tested; combined with Plan 01's server-side fail-closed proxy gate and Firestore rules guard, per-org AI enablement is feature-complete pending only the Plan 01 deploy hand-over (`firebase deploy --only firestore:rules` and `firebase deploy --only functions:setOrgAiEnabled,functions:api`).
- No blockers for subsequent phases. `authStore.aiMasterEnabled` is now available as a general-purpose per-org AI-enablement signal for any future AI surface that needs the same gate.

---
*Phase: 82-per-org-ai-enablement*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 9 modified source/test files confirmed present on disk; all 3 task commit hashes (`24993824`, `a0b56e67`, `bdd1e04d`) confirmed in `git log --oneline --all`.
