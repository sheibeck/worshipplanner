---
phase: 134-editor-presence
verified: 2026-09-07T21:10:00Z
status: human_needed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the same service in two browser profiles (two different org members). Confirm each header names the other viewer within ~30s (the coarse heartbeat interval)."
    expected: "Both viewers' displayName appear in the other's ServiceEditorView header presence indicator, as a comma-joined name list next to a green dot."
    why_human: "Live two-browser cross-tab visual behavior cannot be proven by static analysis or unit tests with mocked Firestore; this is the plan's own <human-check> verification step (134-02-PLAN.md Task 3), deferred per the milestone's UAT-deferred autonomous mode."
  - test: "Close/navigate one browser's tab away from the service. Confirm the departed viewer disappears from the other's header within ~60s (the client staleness TTL) even without a graceful close."
    expected: "The departed viewer's name drops out of the presence indicator within the soft-TTL window."
    why_human: "Same as above — requires two real browser sessions and wall-clock observation; the forced-disconnect mechanism itself is proven by an automated fake-clock test (src/composables/__tests__/useServicePresence.test.ts), but the live cross-tab rendering is not."
---

# Phase 134: Editor Presence Verification Report

**Phase Goal:** Concurrent viewers/editors of a service see who else is currently present, backed by an org-scoped Firestore heartbeat — no stale state, no cross-tenant leak, self-cleaning.
**Verified:** 2026-09-07
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Presence read is org-scoped: a cross-org member's get AND list are DENIED (SEC-S-01 guard) | ✓ VERIFIED | `firestore.rules:357` `allow get, list: if isOrgMember(orgId);` (no `if true`/unscoped `isSignedIn()`). Independently ran `src/rules.test.ts`'s presence describe block live against the running emulator (`npx vitest run --config vitest.rules.config.ts -t "services/{id}/presence"`) — all 12 cases pass, including cases (8) cross-org get DENY, (9) cross-org list DENY, (10) cross-org write DENY. |
| 2 | A member may create/update/delete ONLY their own presence doc | ✓ VERIFIED | `firestore.rules:359-364`: `presenceId == request.auth.uid && request.resource.data.uid == request.auth.uid` on create/update; `presenceId == request.auth.uid` on delete. Cases (5) other-user write DENY, (6) forged-uid DENY, (12) other-user delete DENY all pass (verified live). |
| 3 | Presence doc fields are allowlisted to exactly uid/displayName/lastSeen | ✓ VERIFIED | `firestore.rules:362` `request.resource.data.keys().hasOnly(['uid','displayName','lastSeen'])`. Case (7) extra-field DENY passes (verified live). `src/utils/presence.ts` `PresenceDoc` interface mirrors exactly these 3 fields. |
| 4 | A signed-in non-member is DENIED read and write of any presence doc | ✓ VERIFIED | Case (11) non-member read+write DENY passes (verified live). |
| 5 | The user's own presence doc is written immediately on mount and refreshed on a coarse ~30s heartbeat | ✓ VERIFIED | `src/composables/useServicePresence.ts:108-110` (`writeHeartbeat()` called once in `start()`, then `setInterval(writeHeartbeat, PRESENCE_HEARTBEAT_MS)` with `PRESENCE_HEARTBEAT_MS=30000`). Test `writes the own presence doc immediately on start, before any timer advance` passes (ran `npx vitest run src/composables/__tests__/useServicePresence.test.ts` — 7/7 pass). |
| 6 | The heartbeat is PAUSED while the tab is hidden — no writes accrue while backgrounded | ✓ VERIFIED | `writeHeartbeat()` guards `if (document.hidden) return`; resumes on `visibilitychange`. Test `PAUSED-WHEN-HIDDEN` passes. |
| 7 | A presence doc older than ~60s is hidden client-side even with NO new snapshot (forced-disconnect staleness) | ✓ VERIFIED | `presentViewers` computed filters via `isPresenceStale(row.lastSeenMs, nowMs.value, PRESENCE_STALE_TTL_MS)` against a clock-driven `nowMs` tick (independent of onSnapshot events). Test `FORCED DISCONNECT` passes — a viewer drops out purely from `vi.advanceTimersByTime` with no new snapshot pushed. |
| 8 | Teardown deletes the user's OWN presence doc on serviceId change AND on unmount (reused-editor-instance gotcha) | ✓ VERIFIED | `watch(() => [orgId, serviceId, currentUser?.uid], () => { stop(); start() }, { immediate: true })` plus `onUnmounted(() => stop())`. Test `TEARDOWN` passes (old-doc delete on serviceId change + delete+unsubscribe on unmount). Additionally, `stop()` uses an `activePresence` triple captured at `start()` time (WR-01 fix) so it always deletes the doc it actually wrote, not a stale re-read of reactive refs. Test `WR-01 — activates once orgId resolves after mount` passes, closing the race the code review flagged. |
| 9 | Other present viewers of the same service are named in the ServiceEditorView header indicator | ✓ VERIFIED | `src/views/ServiceEditorView.vue:4312-4317` mounts `useServicePresence(orgId, serviceId, user)` and computes `otherPresentViewers` (excludes self by uid); template (`L100-107`) renders `{{ otherPresentViewers.map(v => v.displayName).join(', ') }}` via text interpolation only (no v-html), guarded by `v-if="otherPresentViewers.length > 0"`. Data flows from a live `onSnapshot` subscription (not a hardcoded/static value) — Level 4 data-flow confirmed. |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/presence.ts` | PresenceDoc type, isPresenceStale, PRESENCE_HEARTBEAT_MS/PRESENCE_STALE_TTL_MS | ✓ VERIFIED | Pure module, type-only Firestore import, exactly as specified (30000/60000ms). |
| `firestore.rules` presence match block | org-scoped get/list-split read, own-doc-only field-allowlisted write/delete | ✓ VERIFIED | `L356-365`, nested inside `match /services/{docId}` (orgId + serviceId path-derived). |
| `src/rules.test.ts` presence describe block | 12 ALLOW/DENY cases | ✓ VERIFIED (wired) | `L3331` describe block; all 12 cases pass live against the running emulator. |
| `src/composables/useServicePresence.ts` | heartbeat + onSnapshot + client staleness + dual teardown | ✓ VERIFIED | Read in full; matches all plan behaviors including the WR-01/WR-02 code-review fixes. |
| `src/composables/__tests__/useServicePresence.test.ts` | fake-clock forced-disconnect + paused-when-hidden + teardown tests | ✓ VERIFIED | 7/7 tests pass (5 original + WR-01 + WR-02 fix tests). |
| `src/views/ServiceEditorView.vue` header indicator | renders other viewers by displayName | ✓ VERIFIED (wired) | Mounted, computed, rendered via text interpolation; guarded and collapsing when alone. |
| `functions/src/cleanupSweeps.ts` | cleanupStalePresenceHandler + onSchedule wrapper | ✓ VERIFIED | `L703-810`; dry-run fail-closed, collectionGroup('presence') scoped, deleteCap-bounded (dry-run never capped), partial-failure tolerant (try/catch per doc), scheduled `every day 04:00 UTC`. |
| `functions/src/appConfig.ts` | cleanup.presenceEnabled + retention.presenceStaleMinutes | ✓ VERIFIED | `presenceEnabled: boolean` (default false), `presenceStaleMinutes: number` (default 60), both coerced via `coerceEnableFlag`/`coerceConfigNumber`. Client-side `src/config/appConfigDefaults.ts` mirror kept in lockstep (drift-guard test passes). |
| `functions/src/index.ts` re-exports | cleanupStalePresence/-Handler at both sites | ✓ VERIFIED (wired) | `grep` confirms import at L48, dispatch use in `previewCleanupDryRun` at L1179, export at L2834 (`export { cleanupExpiredMedia, cleanupOrphanRenders, cleanupOrphanBackgrounds, cleanupPptxSources, cleanupStalePresence };`). |
| `functions/src/index.test.ts` | cleanupStalePresenceHandler unit tests + re-export guard | ✓ VERIFIED | Ran `cd functions && npx vitest run src/index.test.ts -t "cleanupStalePresence"` — 6/6 pass (5 handler cases + re-export-guard test). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useServicePresence` | Firestore presence subcollection | `setDoc`/`onSnapshot`/`deleteDoc` on `organizations/{orgId}/services/{serviceId}/presence/{uid}` | ✓ WIRED | Path matches the rules match block exactly; verified by reading both files side by side. |
| `ServiceEditorView.vue` | `useServicePresence` | direct composable call with reactive getters | ✓ WIRED | `useServicePresence(() => authStore.orgId, () => serviceId.value, () => authStore.user)`; `otherPresentViewers` computed consumes the return value and is rendered in the template. |
| `isOrgMember(orgId)` | presence get/list/write/delete arms | rule-body reference | ✓ WIRED | Gates all four arms; orgId resolved from the enclosing path segment, never a client field. |
| `functions/src/index.ts` | `cleanupSweeps.ts` handler+schedule | import + re-export + `previewCleanupDryRun` dispatch | ✓ WIRED | Confirmed at all 3 grep hit sites (import, preview dispatch, export). A dedicated test (`index.test.ts`'s re-export guard describe) enforces this stays wired going forward. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| ServiceEditorView header indicator | `otherPresentViewers` | `useServicePresence`'s `presentViewers` computed, fed by a live `onSnapshot` on the org-scoped presence collection | Yes — live Firestore subscription, not static/hardcoded | ✓ FLOWING |
| `cleanupStalePresenceHandler` | `snapshot.docs` | `db.collectionGroup('presence').get()` (real Admin SDK query) | Yes — real collection-group scan | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Presence rules ALLOW/DENY (12 cases, live emulator) | `npx vitest run --config vitest.rules.config.ts -t "services/{id}/presence"` | 12 passed | ✓ PASS |
| Composable heartbeat/staleness/teardown/WR-01/WR-02 | `npx vitest run src/composables/__tests__/useServicePresence.test.ts` | 7 passed | ✓ PASS |
| Cleanup cron handler + re-export guard | `cd functions && npx vitest run src/index.test.ts -t "cleanupStalePresence"` | 6 passed | ✓ PASS |
| Functions full suite (regression check) | `cd functions && npm test` | 19 files / 714 passed | ✓ PASS |
| Previously-modified ServiceEditorView test files (regression check for the always-on presence mount) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/ServiceEditorView.confirmations.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts src/views/__tests__/hymnRetirement.regression.test.ts` | 4 files / 382 passed | ✓ PASS |
| Full app suite (repo root, regression check) | `npx vitest run` | 216/217 files passed, 5581/5616 tests passed, 35 skipped; sole failure `src/storage.rules.test.ts` | ✓ PASS (baseline unchanged) |
| Repo-wide type-check (src + tests) | `npm run type-check` (`vue-tsc --build`) | clean, no errors | ✓ PASS |
| Functions type-check | `cd functions && npx tsc --noEmit` | clean, no errors | ✓ PASS |

The full app-suite run's single failure is `src/storage.rules.test.ts` — the pre-existing, documented CLAUDE.md baseline defect (Storage-emulator `firestore.exists()` cross-service limitation, unrelated to this phase). This confirms Phase 134 introduces zero regressions to the app suite.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R422 | 134-02 | Heartbeat + onSnapshot + client soft-TTL staleness + `watch(serviceId,…)` teardown | ✓ SATISFIED | Truths 5-9 above; `src/composables/useServicePresence.ts` in full. |
| R423 | 134-01, 134-03 | Org-scoped get/list-split presence subcollection rules + cross-org rules test + cleanup backstop (cron and/or TTL) + forced-disconnect test | ✓ SATISFIED | Truths 1-4, 7 above; `firestore.rules`, `src/rules.test.ts`, `functions/src/cleanupSweeps.ts`. |

No orphaned requirements found for Phase 134 in REQUIREMENTS.md beyond R422/R423, both of which are marked `[x]` Complete and mapped to Phase 134 in the requirements table.

### Anti-Patterns Found

None. Scanned all phase-modified files (`src/utils/presence.ts`, `src/composables/useServicePresence.ts`, `firestore.rules` presence block, `functions/src/cleanupSweeps.ts` presence section) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/stub markers — none found. `IN-01` from the code review (hasOnly without hasAll) is an accepted low-severity residual explicitly deferred by the review/fix cycle (out of scope this pass, non-exploitable per the review's own analysis — a doc missing `lastSeen` simply reads as permanently stale and invisible).

### Human Verification Required

### 1. Two-browser "who's here" appears live

**Test:** Open the same service in two browser profiles (two different org members). Wait up to ~30s.
**Expected:** Each header names the other viewer in the presence indicator.
**Why human:** Live cross-tab visual/timing behavior; this is the plan's own deferred `<human-check>` step, expected under this milestone's UAT-deferred autonomous mode.

### 2. Departed viewer disappears within the soft-TTL

**Test:** Close/navigate one browser away from the service (ungraceful — e.g. close the tab, not a clean route change).
**Expected:** The departed viewer drops out of the other browser's indicator within ~60s.
**Why human:** Requires two real browser sessions and wall-clock observation of a cross-tab effect; the underlying staleness mechanism is already proven by an automated fake-clock test, but live rendering timing is not.

### Gaps Summary

No gaps. All 9 derived observable truths (roadmap goal + R422/R423 requirements) are backed by passing automated evidence read directly from the codebase and independently re-run in this verification pass (not merely trusted from SUMMARY.md): the org-scoped/own-doc-only/field-allowlisted Firestore rules (12/12 live rules tests), the heartbeat/staleness/teardown composable including both post-review WR-01/WR-02 fixes (7/7 unit tests), the header indicator wiring (live onSnapshot data, no v-html), and the dry-run-by-default cleanup cron correctly re-exported for deploy (6/6 handler+guard tests, 714/714 full functions suite). A full app-suite run (216/217 files, baseline unchanged) confirms no regressions. The only remaining items are the two live two-browser visual checks, which this milestone explicitly defers to a batched end-of-milestone UAT pass — expected, not a defect.

---

_Verified: 2026-09-07_
_Verifier: Claude (gsd-verifier)_
