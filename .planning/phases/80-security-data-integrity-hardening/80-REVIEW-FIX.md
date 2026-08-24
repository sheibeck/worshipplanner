---
phase: 80-security-data-integrity-hardening
fixed_at: 2026-08-24T13:05:00Z
review_path: .planning/phases/80-security-data-integrity-hardening/80-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 80: Code Review Fix Report

**Fixed at:** 2026-08-24T13:05:00Z
**Source review:** .planning/phases/80-security-data-integrity-hardening/80-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, IN-01 — per explicit `<apply>` instruction)
- Fixed: 3
- Skipped (out of scope, by instruction): 3 (WR-02, WR-03, IN-02 — deliberately excluded, not attempted)

## Fixed Issues

### CR-01: `deleteService` can delete another, undeleted service's live public share link when two services share a date

**Files modified:** `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `8e9a810c`
**Applied fix:** Added `serviceId: service.id` to the `serviceShares/{slug}__service-{date}`
document written by `writeSharePayload`. `deleteService`'s step 3 now reads the doc
before deleting and only proceeds when `shareSnap.data().serviceId === id` — a doc
belonging to a same-date sibling service (or a legacy doc written before this field
existed) is left alone. Updated the existing "deletes serviceShares when present" test
to seed a matching `serviceId`, and added a new regression test
(`CR-01: does NOT delete serviceShares/{slug}__service-{date} when it belongs to a
different (still-live) service sharing the same date`) that seeds two services on the
same date and proves deleting service-1 neither touches service-2's share doc nor
skips service-1's own service-doc delete.

### WR-01: `deleteService` has no error handling — a mid-sequence failure silently leaves the service undeleted with partially-revoked share artifacts

**Files modified:** `src/stores/services.ts`, `src/views/ServiceEditorView.vue`,
`src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `5cc9b420`
**Applied fix:** Wrapped each of `deleteService`'s three revocation steps
(`shareTokens` query-delete, `serviceShareLinks/{id}`, `serviceShares/{slug}__service-{date}`)
in its own try/catch — a failure in any one is logged and does not block the others or
the actual service-doc delete, which stays deliberately unguarded so a genuine failure
there still throws. On the caller side, `ServiceEditorView.vue`'s `onDelete()` now
catches that throw (mirroring `TeamView.vue`'s `onCancelInvite` pattern), surfaces a
`deleteError` message in the confirm dialog (new `data-testid="delete-service-error"`),
and — critically — no longer closes the confirm dialog on failure, so a failed delete
no longer looks like a silent success. Added a hoisted `mockDeleteService` to the
store mock (previously absent, so `deleteService` was untestable in this file) and a
new regression test asserting the error renders and the dialog stays open when
`deleteService` rejects.

### IN-01: R233 negative test coverage doesn't exercise field-removal, only reassignment

**Files modified:** `src/rules.test.ts`
**Commit:** `3f49d55b`
**Applied fix:** Added `DENIES an editor removing createdBy via updateDoc + deleteField()`,
asserting `assertFails` on an `updateDoc` that removes `createdBy` via `deleteField()`,
alongside the existing reassignment-only DENY test.

## Skipped Issues

None of the 3 in-scope findings (CR-01, WR-01, IN-01) were skipped — all three applied
cleanly and verified.

The following findings were explicitly marked **out of scope** by the fix instruction
and were not attempted (not "skipped due to failure" — deliberately excluded per
orchestrator direction):

- **WR-02** (orphaned `messages`/`lockSnapshots` subcollections on `deleteService`) —
  a pre-existing gap, out of scope for this R234 share-artifact-revocation fix pass;
  flagged for backlog capture by the orchestrator.
- **WR-03** (comment-only slot-kind invariant in `EditSlideDrawer.vue`) — left as-is
  per instruction.
- **IN-02** (unvalidated `role` field on `inviteLookup` create) — left as-is per
  instruction; the review itself notes no action is required today.

## Verification / Gates

- `npx vitest run src/stores/__tests__/services.test.ts` — **102/102 passed** (includes
  the new CR-01 shared-date regression test).
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — **328/328 passed**
  (includes the new WR-01 delete-error regression test).
- `npx vitest run --config vitest.rules.config.ts` (against the already-running
  emulator) — **src/rules.test.ts: 193/193 passed** (includes the new IN-01
  field-removal test). `src/storage.rules.test.ts` showed its single
  pre-existing documented failure (`proves membership on the claim ALONE...` —
  the known Storage-emulator `firestore.exists()` limitation described in
  CLAUDE.md), unrelated to this fix pass.
- `npm run type-check` (`vue-tsc --build`, full form) — **clean**, run after each of
  the three commits.
- Full app suite (`npx vitest run`, isolated worktree) — **139/141 files passed,
  4161/4188 tests passed**, landing exactly on the documented 2-file known-failing
  baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) —
  **nothing new failing**. (An initial run inside the isolated worktree surfaced 5
  additional `functions/src/*.test.ts` failures and a much wider spread of
  `storage.rules.test.ts` timeouts; both were diagnosed as isolated-worktree
  environment artifacts — a missing `functions/node_modules` junction, and
  `storage.rules.test.ts`'s tests exceeding jsdom's default 5s timeout under the
  root config when not run through the dedicated Storage-emulator-aware config —
  confirmed by reproducing the identical `storage.rules.test.ts` pattern against
  unmodified `master` in the main checkout. Not caused by this fix pass.)

---

_Fixed: 2026-08-24T13:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
