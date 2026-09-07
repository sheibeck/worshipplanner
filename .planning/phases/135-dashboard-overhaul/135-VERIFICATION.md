---
phase: 135-dashboard-overhaul
verified: 2026-09-07T22:51:03Z
status: human_needed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Load the dashboard at / with upcoming services, then with zero upcoming services."
    expected: "No 'Volunteer coverage' panel anywhere; the feed (hero + list) renders full width; the 'You're all caught up' card appears ONLY when there are zero upcoming services; Song library always renders below."
    why_human: "Full-width visual layout and conditional rendering at real viewport sizes cannot be confirmed by static analysis alone."
  - test: "View each feed service's readiness signal (hero pill + list-row dot/label); find or construct a service with zero SONG slots."
    expected: "Each service shows one worst-of readiness signal with a visible TEXT label (not a bare colored dot); a zero-song-slot service never shows 'media-missing'; keyboard-tabbing the hero and list rows shows a visible focus ring."
    why_human: "Color rendering, label legibility, and keyboard focus-ring visibility require a rendered page, not grep."
  - test: "With upcoming Planned services that have volunteer assignments, view the Unconfirmed volunteers card; confirm a volunteer from another session/tab."
    expected: "Unconfirmed people appear with the same gray ('Unconfirmed')/amber ('Needs reconfirmation') chip vocabulary as the roster tab; confirming a volunteer removes them from the list live (no reload); with everyone confirmed the card stays visible showing 'Everyone's confirmed for the next N services.'; clicking a row opens that service."
    why_human: "Live Firestore listener update timing and visual chip-color parity require a running app + a second confirming actor."
  - test: "Open a service as an editor in a second browser/tab while viewing the dashboard in a first."
    expected: "The 'Currently editing' card appears with a live pulsing green dot and '{name} is editing {service}' text; closing that editor's session removes the row within ~60s (presence TTL); when nobody is editing, the card is entirely absent and the Unconfirmed volunteers card expands to fill the row (lg:col-span-2)."
    why_human: "Real-time presence propagation, staleness timing, and responsive col-span reflow require two live sessions and a rendered page."
  - test: "View the dashboard at a mobile width (~375px)."
    expected: "Attention-cards row stacks to one column; truncated names/service text render sensibly; no horizontal overflow."
    why_human: "Responsive layout at specific breakpoints requires visual inspection."
---

# Phase 135: Dashboard Overhaul Verification Report

**Phase Goal:** The dashboard becomes an actionable "needs your attention" feed — upcoming services,
readiness, unconfirmed volunteers, editor-presence roll-up, empty state — replacing the undefined
"Volunteer coverage" metric.
**Verified:** 2026-09-07T22:51:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Volunteer coverage" section (Active volunteers count + under-staffed roles) no longer appears anywhere; dead `understaffedRoles`/`MIN_VOLUNTEERS_PER_ROLE`/`isServiceReady` code removed (R414) | ✓ VERIFIED | `grep -n "Volunteer coverage\|understaffedRoles\|MIN_VOLUNTEERS_PER_ROLE\|isServiceReady" src/views/DashboardView.vue` returns zero matches |
| 2 | Dashboard leads with a full-width upcoming-services feed, soonest first (R415) | ✓ VERIFIED | `DashboardView.vue:16` wraps the page in `space-y-6` (single column, replacing the old `grid-cols-2`); `upcomingServices` sorted `a.date.localeCompare(b.date)` (line 235); feed `<section>` has no width constraint |
| 3 | Each feed service shows one combined worst-of readiness signal (songs-needed → media-missing → draft → ready) via `dashboardReadinessOf`, which REUSES `readinessOf` from `myScheduleGrouping` — no second media-readiness definition (R416) | ✓ VERIFIED | `src/utils/dashboardReadiness.ts:8` imports `readinessOf`; `dashboardReadinessOf` never re-derives media rules (calls `readinessOf(songs)` at line 64); `src/utils/__tests__/dashboardReadiness.test.ts` — 10/10 tests pass, run independently |
| 4 | A service with zero SONG slots (total === 0) never reads as "media-missing" — `total > 0` guard (R416 zero-slots edge) | ✓ VERIFIED | `dashboardReadiness.ts:59,63` gate both `songs-needed` and `media-missing` on `total > 0`; dedicated zero-slots test cases pass in the 10/10 unit-test run |
| 5 | Readiness communicated by color AND an always-visible text label, never color alone | ✓ VERIFIED | `DashboardView.vue:58,88` render `{{ readinessDisplay(...).label }}` text alongside `pillClass`/`dotClass`/`textClass` color bindings on both the hero pill and list rows |
| 6 | When `upcomingServices.length === 0` the feed is replaced by a "You're all caught up" card; Song library still renders (R419) | ✓ VERIFIED | `DashboardView.vue:19-28` conditional `v-if="upcomingServices.length === 0"` renders the empty-state card in place of the `v-else` feed `<section>`; Song library `<section v-if="authStore.isEditor">` (line 179) sits outside/after the empty-state/feed conditional, unconditional on schedule state |
| 7 | Unconfirmed volunteers card reads Phase 133 confirmations subcollection + `roleAssignmentsByEmailLower`, bounded to ≤6 Planned upcoming services, no-doc/`needsReconfirmation` = unconfirmed (R417) | ✓ VERIFIED | `unconfirmedAssignments.ts` (7/7 unit tests) implements exactly this diff, reusing `confirmationKey`/`ConfirmationStatus` verbatim; `useUnconfirmedVolunteers.ts` opens dual listeners on `rehearseAccess/{serviceId}` doc + `confirmations` subcollection per service; `DashboardView.vue:246-248` bounds `attentionServices` to `status === 'planned'`, sliced to 6 |
| 8 | Fan-out listeners are torn down on orgId/window change and unmount; no unbounded reads | ✓ VERIFIED | `useUnconfirmedVolunteers.ts:126-163` and `usePresenceRollup.ts:84-119` both implement `reconcile()` (window-diff teardown) + `watch(...,{immediate:true})` on `[orgId, serviceIds.join(',')]` + `onUnmounted(teardownAll)`; behaviorally proven (not just present) by `useUnconfirmedVolunteers.test.ts` and `usePresenceRollup.test.ts` (window-shrink-tears-down-only-dropped-listeners, org-switch-tears-down-all, unmount-tears-down-all cases all pass) |
| 9 | CR-01 fix: a transient listener error does not permanently disable the Unconfirmed volunteers card for the rest of the session | ✓ VERIFIED | `useUnconfirmedVolunteers.ts` uses a per-service `hasError` flag reset to `false` on every successful snapshot (lines 85,108), with `error` derived via `computed` (line 205) rather than a sticky shared ref; `useUnconfirmedVolunteers.test.ts`'s "CR-01 — a listener error followed by a successful snapshot on the SAME listener clears the error state" and "error on one service does not get stuck after that service falls out of the window" tests both pass (confirmed by independent test run) |
| 10 | WR-02 fix: a pre-Phase-133 service (never relocked) is not falsely reported as "everyone confirmed" | ✓ VERIFIED | `useUnconfirmedVolunteers.ts:219-227` `hasStaleAssignmentData` computed flags a service whose rehearseAccess snapshot arrived but `roleAssignmentsByEmailLower === undefined`; `DashboardView.vue:121-123` branches this before the positive "Everyone's confirmed" copy, rendering "Some service(s) predate confirmation tracking — relock to check confirmations." instead |
| 11 | Editor-presence roll-up is READ-ONLY (no setDoc/deleteDoc/serverTimestamp/heartbeat/write-on-visibilitychange), excludes stale editors via `isPresenceStale`, bounded to ≤6 services, hides entirely when empty with the Unconfirmed card expanding to `lg:col-span-2` (R418) | ✓ VERIFIED | `grep -E "setDoc|deleteDoc|serverTimestamp" src/composables/usePresenceRollup.ts src/utils/presenceRollup.ts` → zero matches; `presenceRollup.ts` imports and reuses `isPresenceStale` verbatim (6/6 unit tests pass); `DashboardView.vue:159,99` implement `v-if="activeEditors.length > 0"` (hide-when-empty) and `:class="{ 'lg:col-span-2': activeEditors.length === 0 }"` (expansion) |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/dashboardReadiness.ts` | Pure `serviceReadinessSongs` + `dashboardReadinessOf`, imports `readinessOf` | ✓ VERIFIED | Exists, substantive (75 lines, real logic), imports `readinessOf` from `myScheduleGrouping`, wired into `DashboardView.vue` |
| `src/utils/__tests__/dashboardReadiness.test.ts` | Worst-of order + zero-slots guard tests | ✓ VERIFIED | 10 tests, all pass (run independently) |
| `src/utils/unconfirmedAssignments.ts` | Pure diff util | ✓ VERIFIED | Exists, substantive, reuses `confirmationKey`/`ConfirmationStatus`, wired into `useUnconfirmedVolunteers.ts` |
| `src/utils/__tests__/unconfirmedAssignments.test.ts` | Diff behavior tests | ✓ VERIFIED | 7 tests, all pass |
| `src/composables/useUnconfirmedVolunteers.ts` | Bounded ≤6-service dual-listener fan-out | ✓ VERIFIED | Exists, substantive (231 lines), read-only (no setDoc/deleteDoc grep hits), wired into `DashboardView.vue`, lifecycle-tested |
| `src/composables/__tests__/useUnconfirmedVolunteers.test.ts` | Listener lifecycle + CR-01/WR-02 regression tests | ✓ VERIFIED | 8 tests, all pass (added in review-fix commit `7a441da4`) |
| `src/utils/presenceRollup.ts` | Pure staleness filter, reuses `isPresenceStale` | ✓ VERIFIED | Exists, substantive, wired into `usePresenceRollup.ts` |
| `src/utils/__tests__/presenceRollup.test.ts` | Staleness exclusion tests | ✓ VERIFIED | 6 tests, all pass |
| `src/composables/usePresenceRollup.ts` | Read-only ≤6-service presence fan-out with nowMs tick | ✓ VERIFIED | Exists, substantive (142 lines), read-only, wired into `DashboardView.vue`, lifecycle-tested |
| `src/composables/__tests__/usePresenceRollup.test.ts` | Read-only fan-out lifecycle tests | ✓ VERIFIED | 7 tests, all pass (added in review-fix commit `7a441da4`) |
| `src/views/DashboardView.vue` | Volunteer coverage removed; feed + attention cards + empty state | ✓ VERIFIED | All required sections present and wired (see Truths 1-11) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `dashboardReadinessOf` | `readinessOf(songs)` | direct call, `dashboardReadiness.ts:64` | ✓ WIRED | Single source of media-readiness truth; no duplicate definition found in the phase's files |
| `DashboardView.vue` | `dashboardReadinessOf`/`serviceReadinessSongs` | `readinessDisplay()` computed helper, `DashboardView.vue:350-352` | ✓ WIRED | Called for both hero and list rows |
| `useUnconfirmedVolunteers` | `unconfirmedAssignments` | direct call per snapshot recompute, `useUnconfirmedVolunteers.ts:176` | ✓ WIRED | Pure diff invoked inside the `rows` computed |
| `DashboardView.vue` | `useUnconfirmedVolunteers` | `DashboardView.vue:255-258` | ✓ WIRED | `attentionServices` (Planned, ≤6) passed as the bounded window getter |
| `usePresenceRollup` | `activePresenceRows` | direct call, `usePresenceRollup.ts:137` | ✓ WIRED | Pure filter invoked inside the `activeEditors` computed |
| `DashboardView.vue` | `usePresenceRollup` | `DashboardView.vue:273-276` | ✓ WIRED | `presenceWindow` (draft-inclusive, ≤6) passed as the bounded window getter |
| `activeEditors.length === 0` | Unconfirmed card `lg:col-span-2` | conditional class binding, `DashboardView.vue:99` | ✓ WIRED | Confirmed by direct code read; hide/expand interplay logically correct |

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Phase-added unit + composable-lifecycle tests | `npx vitest run src/utils/__tests__/dashboardReadiness.test.ts src/utils/__tests__/unconfirmedAssignments.test.ts src/utils/__tests__/presenceRollup.test.ts src/composables/__tests__/useUnconfirmedVolunteers.test.ts src/composables/__tests__/usePresenceRollup.test.ts` | 5 files, 38 tests, all passed (independently run, not trusted from SUMMARY) | ✓ PASS |
| Full app suite regression check | `npx vitest run` (background, full run) | 221/222 files passed, 5619/5654 tests passed, 35 skipped; only failing file is `src/storage.rules.test.ts` (documented pre-existing Storage-emulator-dependent baseline, unrelated to this phase) | ✓ PASS (no new failures) |
| Type-check | `npm run type-check` (`vue-tsc --build`) | Clean, zero output/errors | ✓ PASS |
| Anti-pattern scan | grep for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/"not yet implemented" across all 6 phase files | Zero matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R414 | 135-01 | Remove undefined "Volunteer coverage" metric | ✓ SATISFIED | Truth #1 |
| R415 | 135-01 | Upcoming-services "needs your attention" feed | ✓ SATISFIED | Truth #2 |
| R416 | 135-01 | Per-service readiness signal, reusing v2.12 `readinessOf` | ✓ SATISFIED | Truths #3-5 (Note: REQUIREMENTS.md's illustrative text mentions "roles filled, slides built" — 135-CONTEXT.md's explicit discuss-phase decision scoped the combined signal to media readiness + song-assignment fill + Draft/Planned lock state; "roles filled" is effectively covered by the songs-needed fill count, and no separate "slides built" concept exists in this codebase's data model. This is a documented, traceable scoping decision, not an unaddressed gap.) |
| R417 | 135-02 | Unconfirmed-volunteers widget (depends on R410) | ✓ SATISFIED | Truths #7-10 |
| R418 | 135-03 | Editor-presence roll-up, reusing R422/Phase 134 presence | ✓ SATISFIED | Truth #11 |
| R419 | 135-01 | Clear empty / first-run state | ✓ SATISFIED | Truth #6 |

No orphaned requirements found — REQUIREMENTS.md maps exactly R414-R419 to Phase 135 and all six appear in the three plans' `requirements` frontmatter.

### Anti-Patterns Found

None. Clean grep across all 6 phase-touched files for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER, empty-return stubs, and hardcoded-empty-data patterns.

### Code Review Findings (135-REVIEW.md / 135-REVIEW-FIX.md)

The phase's own code-review cycle found 1 Critical (CR-01, sticky error) and 2 Warnings (WR-01, zero
composable-lifecycle test coverage; WR-02, false-positive "everyone confirmed" for pre-133 services). All
three were fixed and independently re-verified in this pass:
- CR-01 fix (commit `156d0145`) — confirmed via code read (per-service `hasError`, no sticky shared ref) and
  passing regression tests.
- WR-01 fix (commit `7a441da4`) — confirmed via existence + passing run of the two new test files (15
  combined tests).
- WR-02 fix (commit `dd31f172`) — confirmed via code read (`hasStaleAssignmentData` branch) and passing
  regression tests.
IN-01 (info-level, redundant type-narrowing check) was explicitly out of `fix_scope: critical_warning` and
left unresolved — cosmetic only, no functional impact.

### Human Verification Required

Per this milestone's autonomous/UAT-deferred execution mode, the following visual/live-interaction checks
were harvested from the three plans' `<human-check>` blocks and are deferred to milestone-end UAT rather than
blocking this phase's code-level verification. All underlying code/logic they depend on has already been
verified above (Truths #1-11).

### 1. Full-width feed + empty-state visual check

**Test:** Load the dashboard at `/` with upcoming services, then with zero upcoming services.
**Expected:** No "Volunteer coverage" panel anywhere; the feed renders full width; the "You're all caught up"
card appears only when there are zero upcoming services; Song library always renders.
**Why human:** Visual layout and conditional rendering at real viewport sizes.

### 2. Readiness signal visual check

**Test:** View each feed service's readiness signal; find/construct a zero-SONG-slot service.
**Expected:** Visible text label (not a bare dot) per service; zero-slot service never shows "media-missing";
keyboard-tabbing shows a visible focus ring.
**Why human:** Color rendering and keyboard-focus-ring visibility require a rendered page.

### 3. Unconfirmed volunteers live-update check

**Test:** With Planned services carrying assignments, view the card; confirm a volunteer in another
session/tab.
**Expected:** Chip vocabulary matches the roster tab; confirming removes a row live; "Everyone's confirmed…"
positive sub-state shows when all confirmed; row click opens the service.
**Why human:** Live Firestore listener timing + visual chip-color parity.

### 4. Editor-presence live-update check

**Test:** Open a service as an editor in a second tab/browser while viewing the dashboard.
**Expected:** "Currently editing" card appears with a live pulsing dot and correct text; row disappears within
~60s of that editor closing; card is absent (Unconfirmed card spans full row) when nobody is editing.
**Why human:** Real-time presence propagation, TTL timing, and responsive col-span reflow.

### 5. Mobile layout check

**Test:** View the dashboard at ~375px width.
**Expected:** Attention-cards row stacks to one column; text truncates sensibly; no horizontal overflow.
**Why human:** Responsive layout requires visual inspection.

### Gaps Summary

No code-level gaps found. All 11 must-have truths across the three plans (R414-R419) are verified against
the actual codebase: the "Volunteer coverage" section and its dead code are fully removed; the feed is
full-width and soonest-first; the readiness rollup reuses `readinessOf` verbatim with a verified zero-slots
guard; the empty state is correctly gated; the Unconfirmed volunteers and Currently editing cards are wired
to real bounded, read-only, lifecycle-managed Firestore listeners with independently-passing regression tests
for the exact bug (CR-01) and gap (WR-02) the phase's own review cycle found and fixed. The full app test
suite shows no new failures (baseline unchanged: `src/storage.rules.test.ts` only), and `npm run type-check`
is clean. The only outstanding items are genuinely visual/live-interaction checks that cannot be confirmed by
static analysis or unit tests and are deferred to milestone-end UAT per this milestone's autonomous mode.

---

*Verified: 2026-09-07T22:51:03Z*
*Verifier: Claude (gsd-verifier)*
