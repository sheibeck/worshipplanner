---
status: investigating
trigger: "v2.10 regression: RosterView data gone on nav-away-and-back; GettingStarted reappears every other time; schedule/quarters missing after church switch. No console errors. Root-cause as ONE systemic bug, minimal holistic fix, do NOT deploy."
created: 2026-09-05
updated: 2026-09-05
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Per-view onUnmounted teardown of a SHARED org-scoped singleton store races the incoming view's synchronous immediate-watch re-subscribe and LOSES: onUnmounted is a deferred post-render effect, watch(orgId,{immediate:true}) subscribe runs synchronously in the incoming view's setup, so the outgoing view's unsubscribeAll always runs AFTER the re-subscribe and wipes the just-attached listener. orgId is unchanged so the watch never re-fires -> store empty until reload."
  confirming_evidence:
    - "Empirical probe (src/__probe__/nav-race.probe.test.ts) through a REAL vue-router RouterView. Event log: subscribe(token=2) [incoming setup] -> A.onUnmounted -> unsubscribeAll [outgoing, deferred]. Final: subscribed=false, data=[] on BOTH nav directions. Ordering is independent of patch order — it is the sync-subscribe vs post-render-teardown asymmetry."
    - "Store teardown map: rosterStore teardown-owners = RosterView + QuarterView -> mutual wipe on Volunteers<->Schedule. teamsStore teardown-owners = RosterView + ServicesView (ServicesView teardown ADDED by R353) -> mutual wipe on Volunteers<->Services. song/service teardown-owner SongsView/ServicesView -> one-way wipe landing on Dashboard (flips a GettingStarted step -> panel reappears)."
    - "STATE.md documents the INTENDED design: 'songStore is left subscribed (shared org-scoped store managed by resetOrgScopedStores)'. Per-view onUnmounted teardown of shared stores is the anomaly; songStore already (correctly) omits it."
  falsification_test: "If removing the onUnmounted teardowns left a store subscribed to the WRONG org after a church switch, or leaked >1 listener per store, the fix would be wrong. Neither holds: subscribe() unsub-then-resubscribes (<=1 listener), and resetOrgScopedStores() on church-switch/logout tears everything down authoritatively."
  fix_rationale: "Remove shared org-scoped singleton unsubscribeAll() from the per-view onUnmounted hooks (Roster/Quarter/Services/Songs/GettingStarted). Keep the immediate-watch subscribe (self-heals on mount + church switch) and the org-switch-watch teardown (correct on orgId change). Teardown of org-scoped stores becomes solely resetOrgScopedStores()'s job, matching songStore's documented pattern."
  blind_spots: "Symptom #3 exact click-path not fully pinned to a single navigation, but its store (quarters/roster) is in the same teardown-race family and the fix makes every view's mount the authoritative re-subscribe. Output/Run views (Audience/Confidence/RunControl) intentionally keep unmount teardown (standalone windows) — NOT touched."

test: DONE — empirical probe confirms the race. Now apply fix + formal regression test.
expecting: After fix, incoming view's subscribe survives the outgoing view's unmount; probe assertion passes.
next_action: apply the 5-file fix; update GettingStarted.test.ts unmount assertion; convert probe into a permanent regression test; run npx vitest run + npm run type-check.

## Symptoms

expected: Navigating away from RosterView and back shows the same data; GettingStarted stays dismissed/complete; church switch reloads schedule/quarters without refresh.
actual: (1) RosterView Volunteers/Roles/Teams data gone until full browser refresh (data IS in Firestore); (2) GettingStarted panel reappears "every other time"; (3) schedule/quarters missing after in-app church switch until refresh. No console errors.
errors: none
reproduction: enter data on RosterView -> navigate to another menu item -> return; dismiss GettingStarted then navigate; switch church via sidebar.
started: v2.10 deploy (Phase 119 lifecycle refactors R353/R356). Last good tag v2.9.

## Eliminated

## Evidence

- timestamp: 2026-09-05
  checked: App.vue
  found: RouterView v-else — no keep-alive, no Transition, no Suspense. Views mount/unmount on every navigation.
  implication: No async-mount-before-unmount from Suspense/Transition wrapping RouterView.

- timestamp: 2026-09-05
  checked: DashboardView.vue script
  found: Has watch(orgId, immediate) that subscribes song/service/roster stores, but NO onUnmounted at all.
  implication: Dashboard never wipes a shared store on leave; symptom #1 teardown must come from RosterView/ServicesView.

- timestamp: 2026-09-05
  checked: ServicesView.initStore + onUnmounted
  found: initStore subscribes teams only if (isEditor and !teamsStore.orgId) (skip-guard), but onUnmounted + org-switch watcher call teamsStore.unsubscribeAll() UNCONDITIONALLY. serviceStore.unsubscribeAll() in onUnmounted is PRE-v2.10.
  implication: ServicesView tears down a teamsStore subscription it did not create.

- timestamp: 2026-09-05
  checked: package.json
  found: vue 3.5.29, vue-router 5.0.3, pinia 3.0.4, test-utils 2.4.6, vitest 4.0.18. All routes lazy import.
  implication: async route components; expect unmount-first patch — MUST verify.

## Resolution

root_cause: "Per-view onUnmounted hooks call unsubscribeAll() on SHARED org-scoped singleton Pinia stores. onUnmounted runs as a deferred post-render effect while the incoming route view's watch(orgId,{immediate:true}) subscribe runs synchronously during setup, so on any navigation between two views that touch the same shared store the OUTGOING view's teardown executes AFTER the INCOMING view's re-subscribe and wipes the just-attached Firestore listener. orgId is unchanged so the immediate watch never re-fires -> the store stays empty until a full reload. Proven empirically via a real vue-router RouterView probe. v2.10 R353 (added teamsStore teardown to ServicesView) and R356 (promoted member-count to a shared singleton with onUnmounted teardown) widened the set of shared stores hit by this pre-existing anomaly, pushing it onto the daily-edited pages."
fix: "Remove shared org-scoped singleton unsubscribeAll() from the per-view onUnmounted hooks in RosterView, QuarterView, ServicesView, SongsView, GettingStarted. Keep immediate-watch subscribe (self-heals) + org-switch-watch teardown. Shared-store teardown is owned solely by resetOrgScopedStores() (church switch / logout), matching songStore's documented pattern."
verification: "npm run type-check clean (vue-tsc --build, exit 0). npx vitest run: 190 files passed / 1 failed (src/storage.rules.test.ts only = documented Storage-emulator baseline, ECONNREFUSED 127.0.0.1:8080), 5128 tests passed. New regression test (navSharedStoreTeardownRace.regression.test.ts) passes: negative control reproduces the wipe, fixed pattern survives navigation. GettingStarted.test.ts updated. Committed c336c306. NOT deployed — awaiting human review/UAT/deploy."
files_changed:
  - src/views/RosterView.vue
  - src/views/QuarterView.vue
  - src/views/ServicesView.vue
  - src/views/SongsView.vue
  - src/components/GettingStarted.vue
