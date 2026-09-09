---
phase: 133-volunteer-responsibility-confirmation
fixed_at: 2026-09-07T18:38:11Z
review_path: .planning/phases/133-volunteer-responsibility-confirmation/133-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 133: Code Review Fix Report

**Fixed at:** 2026-09-07T18:38:11Z
**Source review:** .planning/phases/133-volunteer-responsibility-confirmation/133-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02 — critical_warning scope; IN-01/IN-02 skipped per instructed scope, not attempted)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: `confirmations` create/update/delete grants any org member (not just editors) unrestricted write access

**Files modified:** `firestore.rules`, `src/rules.test.ts`
**Commit:** `6436e595`
**Applied fix:** Changed both `isOrgMember(orgId)` disjuncts in the
`confirmations/{confirmationId}` `create, update` and `delete` rules to
`isOrgEditor(orgId)`, matching every other client-writable subcollection in
`firestore.rules` (`lockSnapshots`, `rehearseAccess`, `services/{docId}`
itself). Confirmed via `src/stores/services.ts::reconcileConfirmations` that
the only caller of this write path (`markAsPlanned`'s relock reconciliation)
is already an editor-only UI action, so tightening the gate does not break
the intended flow.

Flipped rules test (10) to seed `role: 'editor'` (was `role: 'member'`,
which had encoded the vulnerability by asserting the arbitrary write
succeeded) and added two new DENY cases: (10b) a plain member cannot
write/update a confirmation, (10c) a plain member cannot delete another
volunteer's confirmation. All three now pass against the corrected rule.

### WR-01: Redundant `get()` on the same `rehearseAccess` doc inside one rule evaluation

**File modified:** `firestore.rules`
**Commit:** `d1b4bc61`
**Applied fix:** Added `isAssignedVolunteerForRole(roleId)`, which binds
`rehearseAccessDoc()`'s `get()` ONCE via a `let` statement and reuses it for
both the `assignedEmailsLower` and `roleIdsByEmailLower` checks the
`create, update` rule needs. The `create, update` rule now calls this new
function instead of separately calling `isAssignedVolunteer()` (1 get) and
then `rehearseAccessDoc()` again (a 2nd get) — dropping the per-request
read budget for a volunteer confirmation write from `exists() + 2×get()` to
`exists() + 1×get()`. `isAssignedVolunteer()` itself is untouched and still
used by the `get, list` rule and the `delete` rule, which don't need the
`roleIdsByEmailLower` check. Behavior is identical (verified via the full
R410 rules suite — no allow/deny outcome changed).

### WR-02: `roleName` on the confirmation doc is client-supplied and never read back / validated

**Files modified:** `firestore.rules`, `src/rules.test.ts`
**Commit:** `d47bb83a`
**Applied fix:** Confirmed by tracing every consumer
(`ServiceEditorView.vue`'s live `confirmations` listener,
`functions/src/index.ts`'s `sendQueuedMessageHandler`,
`src/stores/services.ts`'s `reconcileConfirmations`) that `roleName` is
genuinely never read back off the confirmation doc today — it is
write-only. Rather than dropping the field (which would have required
touching every existing write payload across the app and test suite),
chose the review's other offered option: validate it server-side.
`isAssignedVolunteerForRole` now takes a `roleName` parameter and checks
the full `{roleId, roleName}` pair against `rehearseAccess`'s own
`roleAssignmentsByEmailLower` projection — the same source
`roleIdsByEmailLower` is derived from — so a forged `roleName` on an
otherwise-valid write is now denied.

Seeded `roleAssignmentsByEmailLower` on the rules test's `rehearseAccess`
fixtures (mirroring `roleIdsByEmailLower`'s existing entries) so the
volunteer ALLOW paths kept passing under the stricter check, and added
(4b), a new DENY case proving a forged `roleName` on dana's real `roleId`
is rejected.

## Skipped Issues

None in scope — IN-01 and IN-02 were excluded by the requested
`critical_warning` fix scope and were not attempted this pass.

## Verification

- `npm run test:rules` (via `firebase emulators:exec`, own emulator):
  285/286 tests passed after the final (WR-02) fix — the single failure is
  `src/storage.rules.test.ts`'s known Storage-emulator-`firestore.exists()`
  baseline failure (documented in `CLAUDE.md`), unrelated to this change.
  Re-ran after each of the three fixes; the confirmation-scoped R410 suite
  (12 base cases + 3 new: 10b, 10c, 4b) passed 100% every time.
- `npm run type-check` (`vue-tsc --build`): clean, zero errors.
- All three fixes applied and verified inside an isolated git worktree
  (`gsd-reviewfix/133-*` branch) per the fixer's isolation protocol; the
  worktree's commits were fast-forwarded onto the phase's working branch
  before this report was written.

---

_Fixed: 2026-09-07T18:38:11Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
