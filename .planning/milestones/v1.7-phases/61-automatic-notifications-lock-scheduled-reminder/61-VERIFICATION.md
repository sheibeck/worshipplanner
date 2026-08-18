---
phase: 61-automatic-notifications-lock-scheduled-reminder
verified: 2026-08-14T17:02:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "Deploy sendScheduledReminders and confirm a real reminder email arrives N days before, org-local"
    addressed_in: "PENDING-VERIFICATION.md 61-02 (OWNER, PRE-DEPLOY) + v1.7 deploy-gated grant"
    evidence: "firebase deploy --only functions:sendScheduledReminders — owner pre-deploy; no automated test can drive Cloud Scheduler or send a real email"
  - truth: "Real user-scheduled message sends once its time arrives (R141 dispatch end-to-end)"
    addressed_in: "PENDING-VERIFICATION.md 61-03 (OWNER, PRE-DEPLOY)"
    evidence: "Ships inside the same undeployed sendScheduledReminders cron; real-send UAT deferred to /gsd-verify-work 61"
  - truth: "Real lock email reaches assigned volunteers + amber banner visual + SC2 by eyeball"
    addressed_in: "PENDING-VERIFICATION.md 61-04 (DEFERRED, /gsd-verify-work 61)"
    evidence: "Client calls the UNDEPLOYED queueServiceMessage behind the 59-01/59-03 deploy gates; verification_deferred_human"
---

# Phase 61: Automatic Notifications — Lock & Scheduled Reminder Verification Report

**Phase Goal:** Volunteers are notified automatically when a service first locks and reminded automatically N days before, with no planner action either time. Deploy-gated (cron built/tested/UNDEPLOYED).
**Verified:** 2026-08-14T17:02:00Z
**Status:** passed (deploy-gated — cron built/tested/UNDEPLOYED under the v1.7 grant)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | SC1 (R144): First lock can auto-email everyone assigned (roles, songs, link), governed by the per-service/Settings default | ✓ VERIFIED | `'lock-notification'` in `MessageType` union (index.ts:1212) + `MESSAGE_TYPES` array (index.ts:1218); the enum gate at :1372 reads `MESSAGE_TYPES.includes(type)`. Client `onMarkAsPlanned` (ServiceEditorView.vue:2939-2975) auto-enqueues one `type:'lock-notification'` via `httpsCallable(functions,'queueServiceMessage')` on the draft→locked transition, `includeEveryone` + `attachServiceLink:true`. Test `first lock behind the gates … enqueues one lock-notification` (ServiceEditorView.test.ts:6029). |
| 2 | SC2: Lock email never sends while draft or while Messaging switch off; reminder skips draft/off | ✓ VERIFIED | Client hook fires ONLY on the draft→locked transition and only when `wasFirstLock`, behind `isMessagingEnabled()` + effective `lockNotifyEnabled ?? lockNotifyDefault` + `reachable.length >= 1` (ServiceEditorView.vue:2939-2953). Reminder cron scans `where('status','in',['planned','exported'])` — draft structurally excluded (index.ts:889-892) — and skips `settings.messaging.enabled !== true` (:933) and reminder-off (:942). Tests: draft-never-returned (index.test.ts:1629), kill-switch-off skip, client off/default-off/zero-reachable no-enqueue (ServiceEditorView.test.ts:6092,6101). |
| 3 | SC3 (R145): Shared link auto-sends N days before, org-local timezone, default 7, configurable | ✓ VERIFIED | `sendScheduledRemindersHandler` due check `minusDays(svc.date, effectiveN) === todayInTimeZone(org.settings.timezone ?? 'UTC', now)` (index.ts:957-959); `effectiveN = svc ?? org ?? 7` (:945-946); helpers use `Intl.DateTimeFormat('en-CA', {timeZone})` — no new package (index.ts:1508,1523). onSchedule wrapper `every day 04:00 UTC` (index.ts:1025-1027). Tests: Chicago-vs-Kiritimati boundary (index.test.ts:1739,1767), effectiveN service-over-org + fallback-to-7. |
| 4 | SC4: Reminder skipped while draft AND a retried run never double-sends | ✓ VERIFIED | (a) Cron skips when `svc.messaging.reminderSentAt` set BEFORE any work (index.ts:918) and sets `reminderSentAt` via Admin dot-path merge AFTER enqueue (:997-1000); tests `SECOND run … enqueues ZERO` (index.test.ts:1798) + already-set-zero (:1784). (b) Dispatch sweep transactionally claims `scheduled→dispatched` only if still `'scheduled'` (index.ts:1144-1151) then CREATES a fresh `queued` doc via `createQueuedMessage` (:1160-1179) — re-fires the onDocumentCreated `sendQueuedMessage`; test `SECOND run over an already-'dispatched' doc … creates NO additional doc` (index.test.ts:2090). BOTH confirmed. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Additional Phase Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| First-lock detection: read `lockSnapshots/current` before writing; re-lock → no auto-send; `slideGroupsFingerprint` null | ✓ VERIFIED | `getDoc(snapRef)` before `setDoc`, `wasFirstLock = !prior.exists()` (ServiceEditorView.vue:2924-2925); enqueue gated on `wasFirstLock` (:2939); `slideGroupsFingerprint: null` (:2932); test re-lock no-enqueue (test:6101). |
| Non-blocking: auto-enqueue in own try/catch after lock, never re-raised into `lifecycleError`; banner states + aria-live | ✓ VERIFIED | Outer try/catch never re-raises (ServiceEditorView.vue:2916-2988); nested try/catch drives `lockNotify:'error'` (:2961-2979); banner `sent`/`none-reachable`/`error`/null with `aria-live="polite"` (ServiceEditorView.vue:351-374); test `enqueue rejects … transition stays succeeded, lifecycleError null` (test:6110). |
| No new secret / no new Firestore index | ✓ VERIFIED | Cron wrapper has NO `secrets:` array (index.ts:1025); `RESEND_API_KEY` binds solely to `sendQueuedMessage` (index.ts:1789). `firestore.indexes.json` unchanged since Phase 60 (git log). Single-field collectionGroup scans only. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | lock-notification type, tz helpers, reminder cron, dispatch sweep | ✓ VERIFIED | All present: `MessageType`/`MESSAGE_TYPES` (:1212/1218), `todayInTimeZone`/`minusDays` (:1508/1523), `sendScheduledRemindersHandler`+wrapper (:879/1025), `dispatchDueScheduledMessagesHandler` (:1100). |
| `functions/src/index.test.ts` | SC3/SC4/tz-boundary/idempotency tests | ✓ VERIFIED | 8 files / 248 tests green, incl. all named SC tests. |
| `src/views/ServiceEditorView.vue` | first-lock hook + banner | ✓ VERIFIED | Hook (:2907-2988) + banner (:351-374); working tree clean (committed a9268851/2d35c68d). |
| `src/views/__tests__/ServiceEditorView.test.ts` | 61-04 first-lock specs | ✓ VERIFIED | 309 tests pass incl. 13 new 61-04 specs. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| ServiceEditorView `onMarkAsPlanned` | `queueServiceMessage` Function | `httpsCallable(functions,'queueServiceMessage')` with `type:'lock-notification'` | ✓ WIRED (index.ts:1212 accepts the type) |
| `sendScheduledRemindersHandler` | `sendQueuedMessage` trigger | `createQueuedMessage` → `messages/{id}.set` (onDocumentCreated) | ✓ WIRED |
| `dispatchDueScheduledMessagesHandler` | `sendQueuedMessage` trigger | fresh `queued` doc via `createQueuedMessage` after transactional claim | ✓ WIRED |
| `sendScheduledReminders` wrapper | both sweeps | each in its own try/catch, one onSchedule invocation | ✓ WIRED (index.ts:1025-1045) |

### Behavioral Spot-Checks / Gate Evidence

| Gate | Command | Result | Status |
|------|---------|--------|--------|
| Functions suite | `cd functions && npx vitest run` | Test Files 8 passed; Tests 248 passed | ✓ PASS |
| Functions build | `cd functions && npm run build` (tsc) | exit 0, clean | ✓ PASS |
| Type-check | `npm run type-check` (vue-tsc --build) | exit 0, clean | ✓ PASS |
| Client test file | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | 309 passed (13 new 61-04 specs) | ✓ PASS |
| Root app suite baseline | (per SUMMARY, not re-run — ~300s) | 2 known-failing files only (`storage.rules.test.ts`, `RosterView.test.ts`) — no regression | ? SKIP (baseline documented; phase-touched client file re-run clean) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| R144 | Auto lock email on first lock (roles/songs/link, per-service/Settings default) | ✓ SATISFIED | SC1/SC2 verified above; client hook + lock-notification type + gates. |
| R145 | Auto reminder N days before, org-local timezone, default 7, skip draft, never double-send | ✓ SATISFIED | SC3/SC4 verified above; cron + tz helpers + reminderSentAt idempotency. |

### Anti-Patterns Found

None. `slideGroupsFingerprint: null` is a documented Phase-62 deferral (not a stub); `requestedByUid:'system'` is a deliberate sentinel. No unreferenced TBD/FIXME/XXX in the phase-touched files.

### Deferred Items (owner-deploy / verification_deferred_human — NOT gaps)

| # | Item | Tracked In | Classification |
|---|------|-----------|----------------|
| 1 | `firebase deploy --only functions:sendScheduledReminders` | PENDING-VERIFICATION.md 61-02 | owner pre-deploy (v1.7 grant) |
| 2 | Real reminder email N days before, org-local (R145 live) | PENDING-VERIFICATION.md 61-02 | verification_deferred_human |
| 3 | Real user-scheduled dispatch end-to-end (R141) | PENDING-VERIFICATION.md 61-03 | verification_deferred_human |
| 4 | Real lock email + amber banner visual + SC2 eyeball (R144 live) | PENDING-VERIFICATION.md 61-04 | verification_deferred_human |

Per the v1.7 deploy-gated grant, these are explicitly deferred and do NOT fail the phase — the cron ships built/tested/UNDEPLOYED with the exact deploy command recorded.

### Gaps Summary

No genuine (non-deferred, non-owner-deploy) gaps. Every SC1–SC4 and R144/R145 claim is present in the live code, consistent with the plans, and exercised by passing automated tests. The only outstanding items are the deploy step and live-send/visual UAT, which are intentionally deferred and already tracked in PENDING-VERIFICATION.md.

---

_Verified: 2026-08-14T17:02:00Z_
_Verifier: Claude (gsd-verifier)_
