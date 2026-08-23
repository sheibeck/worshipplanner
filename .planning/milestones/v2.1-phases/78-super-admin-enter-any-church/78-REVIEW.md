---
phase: 78-super-admin-enter-any-church
reviewed: 2026-08-23T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - firestore.rules
  - storage.rules
  - src/rules.test.ts
  - src/storage.rules.test.ts
  - src/stores/auth.ts
  - src/stores/__tests__/auth.test.ts
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
  - src/components/AppShell.vue
  - src/components/__tests__/AppShell.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: fixed
fixed_at: 2026-08-23T05:56:00Z
fix_report: 78-REVIEW-FIX.md
---

# Phase 78: Code Review Report — Super-Admin Enter-Any-Church

**Reviewed:** 2026-08-23
**Depth:** deep (rules composition reviewed with maximum rigor per request; cross-file client/rules boundary traced)
**Files Reviewed:** 10 (both plans, commits `fbcd8765`, `8f7660aa`, `79fed148`, `23eb5e07`, `6a28362b`)
**Status:** issues_found (0 Critical, 3 Warning, 2 Info)

## Summary

This phase's security-critical deliverable — the rules composition change — is correct and holds up under
adversarial reading. I traced every claim in the task's checklist against the actual `firestore.rules`/
`storage.rules` text, not just the plan's prose:

- `organizations/{orgId}`'s `allow update` is exactly `if isOrgEditor(orgId) && preservesLifecycleFields();`
  with **zero** `isSuperAdmin()` reference (confirmed by grep — the only 4 real `isSuperAdmin()` call sites
  in the file are inside `isOrgMember`, `isOrgEditor`, `appConfig`, and `superAdmins`). A super-admin's
  client SDK genuinely cannot write `active`/`deactivatedAt`/`deactivatedBy`/`reactivatedAt`/`reactivatedBy`
  directly — proven by the file's own `CRITICAL` test and independently re-derivable from the rule text.
- `allow delete: if false;` (Phase 77) is byte-for-byte untouched; the pre-existing super-admin-client-delete
  DENY test is unmodified and still exercises it.
- `isOrgMember`/`isOrgEditor`'s super-admin arm is placed as the outermost OR, short-circuiting the billed
  `exists()` read, and reaches only content rules (songs, services, slideGroups, invites, etc.) — never the
  lifecycle-field guard or the delete rule, which don't reference either function.
- `storage.rules`' `isOrgMemberByClaim` mirrors the same outermost-OR shape with no dead/contradictory logic
  left behind (the old inner `superAdmin` disjunct beside the deactivation clause was actually removed, not
  just made unreachable-and-left).
- `enterOrgAsSuperAdmin` (read directly, not inferred from the plan) genuinely calls no `setDoc`/`writeBatch`
  and starts no `members/{uid}` `onSnapshot` — the R226 "no member doc" contract holds at the client level,
  and the accepted T-78-03 rules-layer residual (an ordinary `isOrgEditor` `allow write` on `members/{uid}`
  legally includes `create`) is genuinely documented in both plans' threat models, not silently dropped.
- All three org-context reset sites (`resetOrgContext`, `logout`, the `onAuthStateChanged` null branch)
  correctly clear `viewingAsSuperAdmin`, confirmed against the actual diff (`git show 79fed148`), not just
  the plan's claim.
- `hasNoOrg`'s `&& viewingAsSuperAdmin.value === null` fix is correct and test-covered; the `owner-console`
  route's `requiresSuperAdmin` meta exempts it from the org-selection gate entirely, so `exitSuperAdminView`'s
  `/owner-console` navigation cannot strand the super-admin either.

Tracing the client code one level past what the plan describes surfaced a real gap the plan's own router-
strand analysis (Pitfall 1 / T-78-05) didn't fully cover, plus two robustness gaps in the new UI action that
break this codebase's own established conventions. None of these are security-boundary issues — the rules
layer is sound — but they are genuine, reproducible defects.

## Warnings

### WR-01: `enterOrgAsSuperAdmin` never clears `deactivatedOrgMessage`, reopening the exact router-strand class of bug T-78-05 was written to close

**File:** `src/stores/auth.ts:306-318` (`resetOrgContext`), `584-599` (`enterOrgAsSuperAdmin`)
**Issue:** Before this phase, `resetOrgContext()` had exactly one call path into it: from `loadOrgContext()`,
which unconditionally clears `deactivatedOrgMessage.value = null` at its very first line (line 415) before
ever reaching a branch that calls `resetOrgContext()`. That ordering is what has kept `hasDeactivatedOrg`
(`deactivatedOrgMessage.value !== null`) in sync with every context reset — confirmed by diffing
`resetOrgContext`'s pre-Phase-78 body (`git show 79fed148^:src/stores/auth.ts`), which also never touched
`deactivatedOrgMessage` and relied entirely on that caller-side clear.

`enterOrgAsSuperAdmin` and `exitSuperAdminView` are the **first** callers of `resetOrgContext()` that bypass
`loadOrgContext` entirely, and neither one nor `resetOrgContext()` itself clears `deactivatedOrgMessage`.
Concretely: if a super-admin's session has, at any earlier point, hit a deactivated-org path (e.g. they are
also a genuine member of some org that is `active: false`, or they signed in while their own org was
deactivated), `deactivatedOrgMessage` is left non-null for the rest of the session. `hasDeactivatedOrg`
therefore stays `true`, so `requiresOrgSelection` (`needsOrgSelection || hasNoOrg || hasDeactivatedOrg`)
stays `true` even after a successful `enterOrgAsSuperAdmin('church-x')` — `hasNoOrg`'s new
`viewingAsSuperAdmin.value === null` guard does nothing for this sibling flag. The very next navigation
(`OrganizationsTab.vue`'s `router?.push({ name: 'services' })`, whose route has no `requiresSuperAdmin`
meta) hits the router's org-selection gate and bounces the super-admin straight to `/select-church` —
exactly the T-78-05 router-strand failure mode the plan explicitly fixed for `hasNoOrg`, just via the
sibling `hasDeactivatedOrg` flag it didn't account for. No test in the new `auth.test.ts` R224/R226/R227
block seeds a non-null `deactivatedOrgMessage` before calling `enterOrgAsSuperAdmin`, so this gap has zero
test coverage in either direction.
**Fix:**
```ts
function resetOrgContext(): void {
  memberUnsub?.()
  memberUnsub = null
  orgId.value = null
  orgName.value = null
  orgSlug.value = null
  userRole.value = null
  pcAppId.value = null
  pcSecret.value = null
  vwModeEnabled.value = true
  settings.value = { ...DEFAULT_ORG_SETTINGS }
  viewingAsSuperAdmin.value = null
  deactivatedOrgMessage.value = null // keep hasDeactivatedOrg in sync with every reset, not just loadOrgContext's
}
```
Add a regression test: seed `deactivatedOrgMessage` non-null (e.g. via a failed `loadOrgContext` on the
super-admin's own org), then call `enterOrgAsSuperAdmin('church-x')` and assert `requiresOrgSelection` is
`false`.

### WR-02: "Enter church" has no in-flight/double-submit guard, unlike every other row action in the same file

**File:** `src/components/admin/OrganizationsTab.vue:172-180`, `628-633`
**Issue:** `onOnboard`/`onConfirmAssign`/`onToggleActive`/`onConfirmDelete` all gate their button with a
dedicated in-flight ref (`isOnboarding`, `isAssigning`, `togglingOrgId`, `isDeleting`) — the WR-03 convention
this codebase established in Phase 74 specifically to guard against double-submit on async row actions. The
new `onEnterChurch` has no equivalent: the button carries no `:disabled` binding and there is no
`isEntering`/`enteringOrgId` state. A rapid double-click on the same row (or two different rows in quick
succession) fires two overlapping `enterOrgAsSuperAdmin` calls; since each one calls `resetOrgContext()`
then awaits a Firestore read before writing `orgId`/`viewingAsSuperAdmin`/`userRole`, the two calls can
interleave and the router receives two `push` calls, with the final org context determined by whichever
`getDoc` resolves last rather than whichever click was last.
**Fix:**
```ts
const enteringOrgId = ref<string | null>(null)

async function onEnterChurch(org: OrgSummary): Promise<void> {
  if (enteringOrgId.value !== null) return
  enteringOrgId.value = org.orgId
  try {
    await authStore.enterOrgAsSuperAdmin(org.orgId)
    router?.push({ name: 'services' })
  } finally {
    enteringOrgId.value = null
  }
}
```
and bind `:disabled="enteringOrgId !== null"` on the button.

### WR-03: `onEnterChurch` navigates unconditionally, even when `enterOrgAsSuperAdmin` silently no-ops

**File:** `src/components/admin/OrganizationsTab.vue:628-633`
**Issue:** `enterOrgAsSuperAdmin` returns early with no error surfaced to the caller in three cases: the
local `isSuperAdmin.value`/`user.value` convenience guard fails, the target org doc's `getDoc` throws
(caught internally and only `console.error`'d), or the org doc doesn't exist (e.g. a stale row from a list
that hasn't refreshed after a deletion). `onEnterChurch` has no way to observe any of these outcomes — it
`await`s the call and then unconditionally does `router?.push({ name: 'services' })`. On a silent failure,
`orgId`/`viewingAsSuperAdmin` are still `null`, so the router's org-selection guard actually redirects the
super-admin to `/select-church` with **zero indication of what happened** — unlike this same file's other
actions, which surface `toggleError`/`deleteDialogError` inline on failure.
**Fix:** Have `enterOrgAsSuperAdmin` return a `boolean` (or throw on the "doc missing" case) so the caller
can branch:
```ts
async function onEnterChurch(org: OrgSummary): Promise<void> {
  const entered = await authStore.enterOrgAsSuperAdmin(org.orgId)
  if (!entered) {
    enterError.value[org.orgId] = "Couldn't enter this church. Refresh and try again."
    return
  }
  router?.push({ name: 'services' })
}
```

## Info

### IN-01: `exitSuperAdminView` redundantly re-clears `viewingAsSuperAdmin`

**File:** `src/stores/auth.ts:603-607`
**Issue:** `resetOrgContext()` (called on line 605) already sets `viewingAsSuperAdmin.value = null` at line
317. The explicit `viewingAsSuperAdmin.value = null` on line 606 is dead-weight — harmless, but redundant.
**Fix:** Drop the redundant line, or leave a comment noting it's intentional defensive duplication if that's
preferred; as written it reads as an oversight from the extraction.

### IN-02: T-78-03 residual is documented only in PLAN/SUMMARY threat models, not in `firestore.rules` itself

**File:** `firestore.rules:186-227` (`members/{uid}` block)
**Issue:** This file otherwise carries unusually dense inline security rationale (see the `organizations/
{orgId}` `allow update`/`allow delete` comments a few lines above). The one place a comparably significant
accepted residual exists — `allow write: if isOrgEditor(orgId);` on `members/{uid}` now legally permits a
super-admin's client SDK to `create` its own membership doc for any org, making R226's "no member doc"
guarantee a client-code contract rather than a rules invariant — has no inline comment here, only in the
phase's PLAN/SUMMARY files. Not a functional gap (the residual is genuinely tracked), just an inconsistency
with this file's own documentation density that could let a future rules editor miss the caveat.
**Fix:** Add a short comment above `match /members/{uid}` cross-referencing T-78-03, mirroring the density
of the `organizations/{orgId}` comments above it.

---

_Reviewed: 2026-08-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
