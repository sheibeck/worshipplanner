---
phase: 76-church-deactivation-reactivation
fixed_at: 2026-08-23T01:15:00Z
review_path: .planning/phases/76-church-deactivation-reactivation/76-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 4
skipped: 0
accepted: 2
status: all_fixed
---

# Phase 76: Code Review Fix Report — Church Deactivation & Reactivation

**Fixed at:** 2026-08-23T01:15:00Z
**Source review:** .planning/phases/76-church-deactivation-reactivation/76-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical, 3 Warning, 2 Info)
- Fixed: 4 (CR-01, WR-01, WR-02, WR-03)
- Accepted (no fix, per review brief): 2 (IN-01, IN-02)
- Skipped: 0

## Fixed Issues

### CR-01: A member who joins a deactivated org after the claim fan-out gets full, indefinite Storage access

**Files modified:** `functions/src/orgMembershipClaims.ts`, `functions/src/orgMembershipClaims.test.ts`,
`functions/src/orgProvisioning.ts`, `functions/src/orgProvisioning.test.ts`, `src/storage.rules.test.ts`
**Commits:** `4e803186` (primary trigger self-heal), `85f2a88a` (assignOrgAdmin belt-and-suspenders),
`ae7e1e20` (rules-layer regression test)

**Applied fix (primary):** `orgMembershipClaims.ts`'s `syncOrgMembershipClaimHandler` now computes a
`deactivatedOrgs` claim on every membership write (create/update/delete), not just via `setOrgActive`'s
one-time fan-out. New `computeDeactivatedOrgsClaimForUid(orgIds)` reads each surviving org's
`organizations/{orgId}.active` field live and builds `{ [orgId]: true }` only for orgs explicitly
`active === false` (missing doc/field defaults to active, matching `isOrgActive()`/`setOrgActiveHandler`'s
own `?? true` posture). This claim is folded into the SAME `mergeAndSetCustomClaims`/
`mergeSetAndClearCustomClaims` write that already carries `orgId`/`role`/`orgs`, in all three decision
branches (`set`, `clear`, `skip`-but-changed), using a new `deactivatedOrgsMapsEqual` helper (mirroring
`orgsMapsEqual`) to avoid redundant writes when nothing changed. Because this fires on EVERY
`organizations/{orgId}/members/{uid}` write, it closes the gap for both vulnerable paths identified by the
review: pending-invite acceptance and `assignOrgAdminHandler`-created memberships now self-heal their
`deactivatedOrgs` entry on the very write that creates them — no dependency on `setOrgActive` running
again.

**Applied fix (belt-and-suspenders):** `assignOrgAdminHandler` now reads `organizations/{orgId}.active`
right after the existing not-found check and throws `failed-precondition` ("Reactivate the church before
assigning admins.") before resolving the target or writing anything, if the org is explicitly deactivated.
`firestore.rules`' invite-acceptance create rule was deliberately left unchanged, per the review brief's
guidance that the trigger self-heal is sufficient and a rules-side gate risked the existing invite-acceptance
flow without dedicated client-side handling.

**New tests:** `functions/src/orgMembershipClaims.test.ts` gained a `computeDeactivatedOrgsClaimForUid`
describe block, a `deactivatedOrgsMapsEqual` describe block, and CR-01/WR-03-labeled cases inside
`syncOrgMembershipClaimHandler`'s describe (new member of an already-deactivated org via both primary and
non-primary writes; an org with no `active` field never gets an entry; idempotency when nothing changed).
`functions/src/orgProvisioning.test.ts` gained two `assignOrgAdminHandler` cases (refuses a deactivated org
without resolving the target or writing; an org with no `active` field at all proceeds normally).
`src/storage.rules.test.ts` gained a rules-layer regression test pinning the token shape the self-healed
trigger now produces for a brand-new member of a deactivated org (`orgId`/`role`/`orgs` AND
`deactivatedOrgs` set together) as DENIED — the Cloud Functions trigger itself cannot be exercised by the
rules-only emulator suite, so this is a contract pin, not the authoritative proof (that lives in the
functions unit tests).

### WR-01: `claimFailures` is never surfaced to the operator, defeating its own documented purpose

**Files modified:** `src/components/admin/OrganizationsTab.vue`, `src/components/admin/__tests__/OrganizationsTab.test.ts`
**Commit:** `4f0b91a4`

**Applied fix:** `onToggleActive` now captures the `setOrgActive` result and, when `claimFailures > 0`,
renders `"{Deactivated|Reactivated}, but N member claim update(s) failed — click again to retry."` in
amber (distinct from the plain green success message) with a longer 8s auto-dismiss (vs. 2s for a clean
success) so the operator has time to notice and act on the warning. Added `toggleFeedbackIsWarning` state
to drive the styling distinction.

### WR-02: `claimFailures` conflates a failed claim patch with a failed `revokeRefreshTokens` call

**Files modified:** `functions/src/orgProvisioning.ts`, `functions/src/orgProvisioning.test.ts`,
`src/components/admin/OrganizationsTab.vue`
**Commit:** `85f2a88a` (server), `4f0b91a4` (client type widening)

**Applied fix:** `setOrgActiveHandler`'s per-member fan-out now tracks the claim-patch and revoke steps as
independent outcomes (`claimFailed`/`revokeFailed`) rather than one shared try/catch, and never attempts
the revoke after a failed claim patch (matching the original sequential-await behavior). The response now
returns both `claimFailures` (Storage-side deny never took effect — needs a retry) and a new
`revokeFailures` (cosmetic, self-heals within the token's remaining lifetime) instead of one conflated
count.

### WR-03: Reactivate's fan-out never reaches a member who left mid-deactivation and later rejoins

**Commit:** `4e803186` (same commit as CR-01's primary fix — no separate change needed)

**Resolution:** The CR-01 self-heal fix is exactly the fix WR-03 asked for: `deactivatedOrgs` is
recomputed from the org's CURRENT `active` state on every membership write, not carried forward from a
stale fan-out. A member re-added mid-deactivation, or an org reactivated after a member rejoins, gets a
freshly-computed value on that write. Confirmed by a dedicated unit test
(`"WR-03: a member re-added to an org that has since been REACTIVATED gets NO deactivatedOrgs entry, even
though a stale claim from before still carried one"`).

## Accepted (No Fix)

### IN-01: Pre-existing latent `orgs != null` guard quirk (out of scope, noted per plan)

**File:** `storage.rules:52-57`
**Reason:** Explicitly out of scope per the review brief. No fix applied.

### IN-02: `loadOrgContext`'s member-doc listener has no error callback

**File:** `src/stores/auth.ts:471-496`
**Reason:** R213's stated scope is the sign-in/org-load path, not real-time mid-session revocation
(bounded to `revokeRefreshTokens`'s ≤1h window regardless). Not a regression against a stated requirement;
left as a residual UX gap per the review brief's instruction not to fix.

## Gate Results

- **`npm run type-check`** (`vue-tsc --build`, includes test files): **clean**, no errors.
- **`cd functions && npx vitest run`**: **520/520 passed** (14 test files), including all new/updated
  CR-01/WR-01/WR-02/WR-03 tests.
- **Rules-emulator suite** (`npx vitest run --config vitest.rules.config.ts`, run against the
  already-running emulator per CLAUDE.md): **194/195 passed.** The one failure
  (`src/storage.rules.test.ts > storage.rules — claim-only membership (Deploy 2, R075 guard) > proves
  membership on the claim ALONE, with no Firestore fallback re-introduced`) is a **pre-existing,
  environment-caused failure unrelated to this fix session** — verified reproducible on the base commit
  (`3890da99`, before any of this session's changes) with `storage.rules` untouched. Root cause: this
  Windows checkout has CRLF line endings in `storage.rules`, and the test's own comment-stripping regex
  (`line.replace(/\/\/.*$/, '')`) never matches a comment-only line ending in `\r` (JavaScript's `.` in a
  non-`s`-flagged regex excludes line-terminator characters including `\r`, and `$` without `/m` requires
  the absolute end of the line string), so no comments are actually stripped and the assertion trips on
  the word "firestore.exists()" appearing inside a doc comment, not in rule code. Not a CR-01/WR-01/WR-02
  regression; not touched by this session (this fixer's scope is REVIEW.md findings only). The new
  CR-01-labeled test added to this same file passed cleanly.
- **`npx vitest run`** (app suite, root): **4045/4068 passed** (133/135 files). The 2 failing files
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, 23 individual test cases between
  them) are EXACTLY CLAUDE.md's documented known-failing baseline for this command
  (`storage.rules.test.ts` needs the dedicated `vitest.rules.config.ts` wiring — it times out at the
  default 5s per-test timeout under the root config even with the emulator up; `RosterView.test.ts` has a
  pre-existing stale UI assertion). Confirmed no new regressions: this is the same 2-file/23-test shape
  the baseline already documents, unrelated to any file this session touched.

## Notes

- No files under `functions/package*.json` were touched.
- No secrets were written or read beyond the pre-existing `.env.local` setup required by this worktree
  (per CLAUDE.md's worktree bootstrap instructions).
- Every commit preserves claim-merge safety: `superAdmin`, `orgs`, and legacy `orgId`/`role` are never
  wiped by any of the `deactivatedOrgs`-carrying writes (proven by the existing and new
  `orgMembershipClaims.test.ts` superAdmin-preservation cases, unchanged in intent, updated only to assert
  the additional `deactivatedOrgs` key).

---

_Fixed: 2026-08-23T01:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
