---
phase: 134-editor-presence
fixed_at: 2026-09-07T20:45:01Z
review_path: .planning/phases/134-editor-presence/134-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 134: Code Review Fix Report

**Fixed at:** 2026-09-07T20:45:01Z
**Source review:** .planning/phases/134-editor-presence/134-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — fix_scope: critical_warning; IN-01 explicitly excluded this pass)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `useServicePresence` never re-activates if `orgId`/`currentUser` resolve after mount

**Files modified:** `src/composables/useServicePresence.ts`
**Commit:** `1218f377`
**Applied fix:** Replaced the `serviceId`-only `watch` with one that watches
`[orgId, serviceId, currentUser?.uid]` together (mirroring the pre-existing
`subscribeConfirmations` watch in `ServiceEditorView.vue`), so a late-resolving
`authStore.orgId` (or a changing signed-in user) re-triggers `start()` even
when `serviceId` itself never changes. Replaced the previous
`activeServiceId`-only teardown tracking with an `activePresence: { org, svc,
uid } | null` triple captured at `start()` time, so `stop()` always deletes
the doc it actually wrote — even if `orgId`/`currentUser` have since moved on
to new values by the time teardown runs — rather than re-reading
`toValue(orgId)`/`toValue(currentUser)` at teardown time (which could target
the wrong org/uid). `stop()` now runs unconditionally before every `start()`
call (including the immediate first run, where it's a no-op since nothing is
live yet), which prevents any tuple transition from leaving a duplicate
heartbeat interval or `onSnapshot` listener running, or writing to a doc
after its own teardown. Verified against the existing TEARDOWN test (which
exercises the exact old-doc-delete / listener-unsubscribe sequence on a
`serviceId` change) — passes unchanged — plus a new test proving the
originally-reported race (mount with `orgId: null`, then set `orgId`,
confirms `setDoc`/`onSnapshot` fire only after `orgId` resolves and no
spurious `deleteDoc` fires for the never-started guard-rejected attempt).

### WR-02: Fire-and-forget `setDoc`/`deleteDoc` calls have no `.catch()`, unlike the rest of the codebase

**Files modified:** `src/composables/useServicePresence.ts`, `src/composables/__tests__/useServicePresence.test.ts`
**Commit:** `a812650b`
**Applied fix:** Added `.catch(() => {})` to the heartbeat's `setDoc` call
(`writeHeartbeat`) and to the presence-doc `deleteDoc` call inside the
rewritten `stop()` (see WR-01 above), matching the established
`useRunControl.ts` / `useOutputWindow.ts` / `stores/auth.ts` convention cited
in the review. Extended the composable's mocks (`mockSetDoc`,
`mockDeleteDoc`) to resolve by default (matching real Firestore SDK promise
behavior — the prior bare `vi.fn()` returned `undefined`, which would have
made `.catch()` throw at the call site) and added a test that rejects both
calls once and confirms the mount/prop-update completes without an unhandled
rejection.

## Verification

- `npx vitest run src/composables/__tests__/useServicePresence.test.ts` — 7/7 passed (5 pre-existing + 2 new: WR-01 late-orgId activation, WR-02 swallowed rejections).
- `npm run type-check` (`vue-tsc --build`) — clean, no errors.
- Full suite `npx vitest run` — 216/217 files passed, 5581/5616 tests passed (35 skipped); the sole failing file is `src/storage.rules.test.ts` (Storage-emulator `ECONNREFUSED 127.0.0.1:9199` — the documented CLAUDE.md baseline, unrelated to this change, not chased).

## Skipped Issues

None — both in-scope findings (WR-01, WR-02) were fixed. IN-01 was excluded from this pass per `fix_scope: critical_warning` (Info-tier findings out of scope) and explicit instruction to skip it this pass.

---

_Fixed: 2026-09-07T20:45:01Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
