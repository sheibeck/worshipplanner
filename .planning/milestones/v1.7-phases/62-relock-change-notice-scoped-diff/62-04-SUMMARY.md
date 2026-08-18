---
phase: 62-relock-change-notice-scoped-diff
plan: 04
subsystem: client/messaging
tags: [client, vue, messaging, relock, change-notice, lock-hook, fingerprint, SC4]
requires:
  - "diffServiceSnapshots + fingerprintSlideGroups + ChangeEntry/SlideFingerprint from @/utils/serviceLockDiff (62-02)"
  - "ReLockNotifyPrompt.vue emitting sent/cancel (62-03)"
  - "Phase 61 R144 lock hook writing lockSnapshots/current + first-lock auto-send (61-04)"
provides:
  - "onMarkAsPlanned re-lock branch: real slideGroupsFingerprint on every lock, prior-vs-current diff, ReLockNotifyPrompt mount, deferred lockSnapshots/current overwrite (SC4)"
  - "reLockEntries open-state + onReLockResolved resolver wiring sent/cancel to the deferred writeSnapshot"
affects:
  - "Closes Phase 62 (re-lock change notice) end to end — the modal + pure diff are now driven by the shipped lock hook. FINAL plan of milestone v1.7"
tech-stack:
  added: []
  patterns:
    - "Deferred side-effect closure: writeSnapshot captured at re-lock time, run only by the modal's sent/cancel resolver (never eagerly) so the diff basis survives a failed send"
    - "Read-before-write existence check (getDoc before setDoc) distinguishes first lock from re-lock"
    - "Non-blocking follow-up in its own try/catch, never re-raised into lifecycleError (mirrors Phase 61 + bumpScheduledSongsLastUsed)"
    - "Fingerprint reads the already-loaded slideGroupsStore.groups — no new Firestore read, not pushed into buildServiceSnapshot"
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
key-decisions:
  - "The lockSnapshots/current overwrite is DEFERRED into a writeSnapshot closure only on the re-lock-with-prompt path; first-lock and empty-diff/messaging-off paths still write immediately"
  - "Both `sent` and `cancel` run the SAME resolver (onReLockResolved) → both overwrite; a failed send emits neither so the prior snapshot stays as the safe pre-edit diff basis (SC4)"
  - "Phase 61 first-lock tests asserting slideGroupsFingerprint:null were UPDATED to the real map (a stub realized, not a behavior regression); the Phase 61 re-lock assertions were updated to the deferred/gated form"
  - ":entries binding uses the v-if-narrowed reLockEntries (vue-tsc --build narrows through v-if && exactly like the existing MessageComposer :service binding) — no cast/computed needed; type-check clean"
requirements-completed: [R146, R148]
coverage:
  - deliverable: "Real slideGroupsFingerprint written on every lock in place of the Phase 61 null stub (R146)"
    verification:
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#first lock behind the gates: writes lockSnapshots/current (read-before-write) then enqueues one lock-notification"
        status: pass
    human_judgment: false
  - deliverable: "Re-lock with a non-empty diff + messaging on opens ReLockNotifyPrompt and does NOT overwrite lockSnapshots/current until the modal resolves (R146 / SC1 / SC4)"
    verification:
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#non-empty diff + messaging ON: opens the prompt and does NOT overwrite lockSnapshots/current yet (SC4)"
        status: pass
    human_judgment: false
  - deliverable: "sent AND cancel both run the deferred writeSnapshot (overwrite with the new snapshot + real fingerprint) and close the prompt (R148 / SC4)"
    verification:
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#emitting `sent`: runs the deferred writeSnapshot (new snapshot + real fingerprint) and closes the prompt (SC4)"
        status: pass
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#emitting `cancel` (Lock quietly / dismiss): runs the SAME deferred writeSnapshot and closes the prompt (SC4)"
        status: pass
    human_judgment: false
  - deliverable: "A send failure (modal emits neither) leaves lockSnapshots/current NOT overwritten — the SC4 safe-retry basis proven in this file (plan-check note 1)"
    verification:
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#SC4 safe basis: a SEND FAILURE (modal stays open, emits NEITHER) leaves lockSnapshots/current NOT overwritten"
        status: pass
    human_judgment: false
  - deliverable: "Empty diff OR messaging off overwrites silently with no prompt; a first lock never opens the prompt (SC1)"
    verification:
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#empty diff: overwrites lockSnapshots/current silently, no prompt, no callable"
        status: pass
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#messaging OFF: overwrites silently with NO prompt even when the diff is non-empty"
        status: pass
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#a first lock never opens the re-lock prompt (immediate write, Task 1 path)"
        status: pass
    human_judgment: false
  - deliverable: "The re-lock block never re-raises into lifecycleError — a deferred-write failure leaves the lock succeeded"
    verification:
      - kind: test
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the re-lock block never re-raises into lifecycleError: a deferred-write failure leaves the lock succeeded"
        status: pass
    human_judgment: false
  - deliverable: "Live re-lock: scoped diff prompt renders, real email sends to the chosen teams, Lock quietly resets the diff basis with no email (deployed send path)"
    verification: []
    human_judgment: true
    rationale: "Requires the deployed queueServiceMessage callable + a real re-lock; deferred to the owner at /gsd-verify-work 62 per the v1.7 no-deploy grant (verification_deferred_human). Recorded in .planning/PENDING-VERIFICATION.md."
duration: 34 min
completed: 2026-08-15
status: complete
---

# Phase 62 Plan 04: Re-lock change-notice lock-hook integration Summary

Wired the Phase 62 pure diff (62-02) and the `ReLockNotifyPrompt` modal (62-03) into the shipped Phase 61 lock hook inside `onMarkAsPlanned`. Every lock now computes a REAL `slideGroupsFingerprint` (the Phase 61 `slideGroupsFingerprint: null` stub is realized). On a re-lock (a prior `lockSnapshots/current` exists) the hook reads the prior snapshot + fingerprint BEFORE writing, runs `diffServiceSnapshots`, and — for a non-empty diff with messaging on — opens the change-notice prompt while DEFERRING the `lockSnapshots/current` overwrite to a `writeSnapshot` closure that the modal's `sent` OR `cancel` resolution runs. An empty diff or messaging off overwrites silently with no prompt. This is the only place the SC4 overwrite timing is enforced.

## Accomplishments

- **Real fingerprint on every lock (R146):** `onMarkAsPlanned` now computes `fingerprintSlideGroups(slideGroupsStore.groups, svc.id)` over the already-held slide-group store (no new Firestore read; not pushed into `buildServiceSnapshot`, so the share-link path is untouched) and writes the `{ [slotId]: hash }` map into `lockSnapshots/current` in place of the Phase 61 `null` stub.
- **First-lock path unchanged except the fingerprint:** still writes immediately, then runs the Phase 61 gated auto-send (kill-switch + effective lock-notify default + ≥1 reachable), with the same `none-reachable` / `error` / `sent` banner outcomes.
- **Re-lock branch + deferred overwrite (R146 / R148 / SC4):** read-before-write existence check (`prior.exists()`) branches into a re-lock arm that diffs `prior.data().snapshot` + `prior.data().slideGroupsFingerprint` against the current snapshot + fingerprint. Non-empty diff + `isMessagingEnabled()` → stash `pendingSnapshotWrite = writeSnapshot` and set `reLockEntries.value = entries` (open the prompt) WITHOUT calling `setDoc`. Empty diff OR messaging off → `await writeSnapshot()` silently, no prompt.
- **sent/cancel both overwrite (SC4):** `ReLockNotifyPrompt` is mounted next to `MessageComposer` with `@sent` and `@cancel` both wired to `onReLockResolved`, which `await`s the deferred `writeSnapshot` then clears `pendingSnapshotWrite` and `reLockEntries`. A failed send (the modal's `onSend` catch emits neither event) never runs the closure, leaving the prior snapshot as the safe pre-edit diff basis for a retry.
- **Non-blocking posture preserved:** the whole block stays in its existing own try/catch that is never re-raised into `lifecycleError`; `onReLockResolved` has its own try/catch so a deferred-write failure closes the prompt without a red lock-failure line.
- **Phase 61 tests updated (stub realized, NOT a regression):** the first-lock test that asserted `slideGroupsFingerprint: null` now seeds an in-service slide group and asserts the real keyed map; the two Phase 61 re-lock assertions were updated to the deferred/gated (empty-diff silent-overwrite) form.

## Task Commits

| Task | Gate | Commit | Description |
| ---- | ---- | ------ | ----------- |
| 1 | RED | 0e6c7b95 | assert real slideGroupsFingerprint map on first lock (fails vs null stub) |
| 1 | GREEN | 913e320f | write real slideGroupsFingerprint on every lock |
| 2 | RED | 69c0c991 | failing re-lock prompt + deferred-overwrite + send-failure-no-overwrite tests |
| 2 | GREEN | 7e2f84e6 | re-lock branch, deferred overwrite, ReLockNotifyPrompt mount + resolver |

## Verification / Gate Output

- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` → **317 passed (1 file)** (was 309; +8 new re-lock specs). Duration 79.40s.
- `npm run type-check` (`vue-tsc --build`, typechecks the test file too, per CLAUDE.md — NOT `-p tsconfig.app.json`) → **clean, no errors**. The `:entries="reLockEntries"` binding narrows through `v-if="localService && reLockEntries"` exactly like the existing `MessageComposer :service` binding — no cast/computed was needed (plan-check note 2 resolved).
- `npx vitest run` (full app suite, ~474s) → **2 failed | 114 passed (116 files); 13 failed | 3571 passed (3584 tests)** — the 13 failing tests are exactly the documented known-failing baseline: `src/views/__tests__/RosterView.test.ts` (1 stale "Roles config" assertion) + `src/storage.rules.test.ts` (12 tests needing the Storage emulator / cross-service `firestore.exists()` limitation). `ServiceEditorView.test.ts` is among the 114 passed; no other file regressed.

**Explicit SC4 overwrite-timing confirmations (all pass):**
- open = NO overwrite: "non-empty diff + messaging ON: opens the prompt and does NOT overwrite lockSnapshots/current yet" — `mockSetDoc` not called while the prompt is open.
- sent = overwrite: "emitting `sent`: runs the deferred writeSnapshot (new snapshot + real fingerprint) and closes the prompt" — `setDoc` called once, payload snapshot is exactly the diffed `currSnapshot`.
- cancel = overwrite: "emitting `cancel` (Lock quietly / dismiss): runs the SAME deferred writeSnapshot and closes the prompt".
- send-failure = NO overwrite: "SC4 safe basis: a SEND FAILURE (modal stays open, emits NEITHER) leaves lockSnapshots/current NOT overwritten" — proven in THIS file, not only inferred from the modal test (plan-check note 1).
- empty-diff = silent overwrite: "empty diff: overwrites lockSnapshots/current silently, no prompt, no callable".

**Updated Phase 61 first-lock fingerprint assertions pass:** "first lock behind the gates…" now seeds a group and asserts the written `slideGroupsFingerprint` is a real object keyed by the in-service group's `slot-0`.

## TDD Gate Compliance

Both tasks followed a strict RED → GREEN cycle with separate `test(...)` and `feat(...)` commits: Task 1 (0e6c7b95 RED → 913e320f GREEN), Task 2 (69c0c991 RED → 7e2f84e6 GREEN). The Task 2 RED run showed 8 failing specs (prompt not mounted, `reLockEntries` undefined) before implementation. No plan-level `type: tdd` gate applies (plan `type: execute`).

## Deviations from Plan

**1. [Rule 3 - Blocking] Widened the test `mockGetDoc` `data()` type**
- **Found during:** Task 2 type-check gate
- **Issue:** The hoisted `mockGetDoc` was typed `data?: () => { orgIds: string[] }`, so the re-lock tests' `data: () => ({ snapshot, slideGroupsFingerprint })` failed `vue-tsc --build`.
- **Fix:** Widened the mock's `data` return type to `Record<string, unknown>` (the pre-existing `{ orgIds }` default remains assignable). Also added `name`/`status` to two Phase 61 inline snapshot fixtures so they satisfy the `buildServiceSnapshot` mock's return type.
- **Files modified:** src/views/__tests__/ServiceEditorView.test.ts
- **Verification:** type-check clean; scoped suite 317 pass; app suite at baseline.
- **Commit:** 7e2f84e6

**2. Phase 61 test assertions updated (planned, documented for the regression watch)**
- The Phase 61 first-lock `slideGroupsFingerprint: null` assertion and the two re-lock assertions were UPDATED to the real-map / deferred-gated form. This is the deferred Phase 61 stub being realized (62-RESEARCH § Pitfall 3), NOT a behavior regression — called out per the plan.

## Manual Verification (DEFERRED — do not mark passed)

The visual/interaction + real-email UAT for the re-lock flow (scoped diff prompt renders, real send to affected-vs-everyone, "Lock quietly" resets the diff basis with no email, send-failure leaves the basis intact) requires the UNDEPLOYED `queueServiceMessage` and is routed to `.planning/PENDING-VERIFICATION.md` as `verification_deferred_human` under `/gsd-verify-work 62`. Per the v1.7 grant: NO deploy, NO `.env.local`. **This is the FINAL plan of milestone v1.7; the phase is code-complete — the milestone lifecycle (audit/complete) is the owner's.**

## Self-Check: PASSED

- `src/views/ServiceEditorView.vue` — modified, present.
- `src/views/__tests__/ServiceEditorView.test.ts` — modified, present.
- Commits 0e6c7b95, 913e320f, 69c0c991, 7e2f84e6 — all present in `git log`.
- No `62-04-SUMMARY.md` stubs; no unresolved TODO/placeholder in the changed source.
