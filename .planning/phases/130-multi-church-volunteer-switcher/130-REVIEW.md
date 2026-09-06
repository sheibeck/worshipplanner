---
phase: 130-multi-church-volunteer-switcher
reviewed: 2026-09-06T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/utils/rehearseAccess.ts
  - src/stores/services.ts
  - src/stores/mySchedule.ts
  - src/views/MyScheduleView.vue
  - src/components/AppSidebar.vue
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
fixed_at: 2026-09-06T19:32:00Z
fix_status: fixed_critical_and_warnings
fix_commits:
  CR-01: b89762f1
  WR-01: bd8485a9
  WR-02: e75eacb6
---

# Phase 130: Code Review Report

**Reviewed:** 2026-09-06
**Depth:** standard
**Files Reviewed:** 5 (+ associated test files: `src/utils/rehearseAccess.test.ts`, `src/stores/__tests__/mySchedule.test.ts`, `src/stores/__tests__/services.test.ts`, `src/views/__tests__/MyScheduleView.test.ts`, `src/components/__tests__/AppSidebar.test.ts`)
**Status:** issues_found

## Summary

The projection change (`orgName` on `RehearseAccessDoc`/`buildRehearseAccess`) is done correctly: conditional-spread keeps the key genuinely absent (never a literal `undefined`) for the empty/undefined case, the signature change has exactly one production call site (`writeRehearseAccessDoc` in `services.ts`) plus the test file, and both are updated consistently — no broken callers. `resyncRehearseAccessForSong`'s org-name `getDoc` is correctly scoped with its own `.catch(() => null)` so a denied/failed org read degrades to "no orgName" without rejecting the `Promise.all` or blocking the write, exactly as designed. The My Schedule filter and the sidebar label are both provably pure client-side derivations — `mySchedule.ts` has no `@/stores/auth` import and never calls `selectOrg` (verified both by reading the source and by the dedicated regression test that scans the file's own text), and the `<select>` in `MyScheduleView.vue` is gated on `churches.length > 1` so 0/1-church volunteers see zero DOM footprint (R405). The admin `authStore.orgName` sidebar branch is untouched — the volunteer label is a genuine new `v-else-if` sibling, not a restructure.

However, the church-name **aggregation** in `mySchedule.ts`'s `churches` computed has a real correctness bug (see CR-01 below): it locks onto whichever doc for an org is encountered *first* in `serviceDate asc` order, and never reconsiders that choice even when a later doc for the same org carries a real `orgName`. Since the one-time backfill of `orgName` onto pre-existing `rehearseAccess` docs is explicitly deferred (per `130-CONTEXT.md`), this is not a contrived edge case — it is the literal scenario the deferral creates, and it makes the graceful-fallback label "sticky" in the wrong direction: instead of self-healing as newly-locked/re-synced services add the real name, an org with even one pre-Phase-130 (or once-failed-getDoc) doc at an earlier date is permanently mislabeled for that volunteer.

## Critical Issues

### CR-01: Church label picks the earliest doc's `orgName`, ignoring a later doc's real name for the same org

**Outcome: FIXED** — commit `b89762f1`. Applied the review's suggested fix nearly verbatim (prefer a defined `orgName` over an undefined one for the same `orgId`, regardless of doc order). Proved the bug first with a regression test asserting on the *unfixed* code (confirmed red: `expected orgName: 'Grace Church', received: undefined`), then confirmed green after the fix. Added two tests in `mySchedule.test.ts` — one per doc order (undefined-then-defined, defined-then-undefined) — so the fix isn't order-dependent. `mySchedule.test.ts` (14 tests) and the full `npm run type-check` gate pass.

**File:** `src/stores/mySchedule.ts:39-45`
**Issue:**
```ts
const churches = computed(() => {
  const byOrgId = new Map<string, string | undefined>()
  for (const d of docs.value) {
    if (!byOrgId.has(d.orgId)) byOrgId.set(d.orgId, d.orgName)
  }
  return [...byOrgId.entries()].map(([orgId, orgName]) => ({ orgId, orgName }))
})
```
`docs.value` is ordered by `orderBy('serviceDate', 'asc')` (`loadMySchedule`, line 79). The `if (!byOrgId.has(d.orgId))` guard means the **first-seen (earliest-dated) doc's `orgName` wins forever** for that `orgId` — a second, later doc for the same org with a real `orgName` is never consulted, because `byOrgId.has()` is already `true`.

Concrete failure scenario: a volunteer is assigned to two services at "Grace Church" — an older one locked before Phase 130 shipped (or one whose `markAsPlanned` ran while `authStore.orgName` happened to be `null`/racing, e.g. immediately after a fresh org switch) and a newer one locked after Phase 130, which correctly carries `orgName: 'Grace Church'`. Because the older, nameless doc has the earlier `serviceDate`, it is encountered first, `byOrgId.set('org-1', undefined)` wins, and the church filter/sidebar permanently show `'Unnamed church'` / `'Your church'` for Grace Church — even though the correct name is sitting right there in `docs.value` on the second entry. This will not self-heal as new, correctly-labeled projections accumulate; it only clears once the one stale doc is revoked (its parent service reopened or deleted). This is exactly the production scenario `130-CONTEXT.md`'s deferred-backfill note anticipates, and it is untested (`mySchedule.test.ts`'s "doc whose orgName is absent" test only exercises a single doc, never two docs for the same `orgId` with one undefined/one defined).

**Fix:** prefer a defined name over one already recorded as `undefined`, rather than "first write wins":
```ts
const churches = computed(() => {
  const byOrgId = new Map<string, string | undefined>()
  for (const d of docs.value) {
    if (!byOrgId.has(d.orgId) || (!byOrgId.get(d.orgId) && d.orgName)) {
      byOrgId.set(d.orgId, d.orgName)
    }
  }
  return [...byOrgId.entries()].map(([orgId, orgName]) => ({ orgId, orgName }))
})
```

## Warnings

### WR-01: Sidebar cold-render guard fires an unnecessary `loadMySchedule()` for a super-admin with no active church

**Outcome: FIXED** — commit `bd8485a9`. Applied the review's suggested fix verbatim (`|| authStore.superAdminOutsideOwnChurch` added to the guard). `AppSidebar.test.ts`'s `@/stores/auth` mock had `superAdminOutsideOwnChurch` as a static `null` field, which can't vary per-test — converted it to a getter over a mutable module-level flag, then added 4 regression tests: fires for a genuine volunteer, skips for a churchless super-admin (confirmed red against the unfixed guard via a temporary `git stash`, then green with the fix restored), skips when `orgName` is set, and skips when docs are already cached. `AppSidebar.test.ts` (24 tests) and the full `npm run type-check` gate pass.

**File:** `src/components/AppSidebar.vue:259-264`
**Issue:**
```ts
onMounted(() => {
  if (authStore.orgName) return
  if (mySchedule.isLoading) return
  if (mySchedule.docs.length > 0) return
  mySchedule.loadMySchedule()
})
```
The template's admin block renders on `authStore.orgName || authStore.superAdminOutsideOwnChurch` (line 17), so a super-admin sitting at the Owner Console with no active church (`orgId === null`, `viewingAsSuperAdmin === null` ⇒ `superAdminOutsideOwnChurch` true, per `auth.ts:223-225`) correctly sees "Super Admin · not in a church" and the `v-else-if` volunteer branch never renders. But this `onMounted` guard only checks `authStore.orgName`, not `superAdminOutsideOwnChurch` — so for that same super-admin session it still fires `mySchedule.loadMySchedule()`, issuing a `collectionGroup('rehearseAccess')` query keyed to the super-admin's own email on every visit to any page that mounts the sidebar. It's harmless to the UI (the result is never rendered for this session) but it's an avoidable, unscoped Firestore read on a hot path (every navigation while unauthenticated-as-volunteer), and it silently populates `mySchedule.docs`/`churches` state for a session that has no business populating volunteer state at all.

**Fix:**
```ts
onMounted(() => {
  if (authStore.orgName || authStore.superAdminOutsideOwnChurch) return
  if (mySchedule.isLoading) return
  if (mySchedule.docs.length > 0) return
  mySchedule.loadMySchedule()
})
```

### WR-02: Redundant no-op fallback obscures intent in the resync's orgName read

**Outcome: FIXED** — commit `e75eacb6`. Trivial cleanup, applied the review's suggested fix verbatim (dropped the trailing `?? undefined`). No behavior change; existing `services.test.ts` coverage of `resyncRehearseAccessForSong`'s orgName (both the present and degraded/absent cases) continues to pass unmodified (117 tests).

**File:** `src/stores/services.ts:696`
**Issue:**
```ts
const orgName = (orgSnap?.data()?.name as string | undefined) ?? undefined
```
`?? undefined` after an expression that is already `string | undefined` is a no-op — if the left side evaluates to `undefined`, `?? undefined` produces `undefined` regardless. This doesn't cause any behavioral difference from a plain `const orgName = orgSnap?.data()?.name as string | undefined`, but it reads as if it's doing real normalization (e.g. coercing `null` → `undefined`), when `orgSnap?.data()?.name` can never be `null` here (only `undefined` via the optional chain, or a string). Low-severity but worth cleaning up since it's the kind of dead defensive code that tends to get copy-pasted forward.
**Fix:** drop the trailing `?? undefined`:
```ts
const orgName = orgSnap?.data()?.name as string | undefined
```

## Info

### IN-01: `130-UI-SPEC.md`'s Copywriting Contract disagrees with the shipped sidebar label wording

**Outcome: FIXED (doc-only)** — updated `130-UI-SPEC.md`'s Copywriting Contract row and Label-resolution step 2 to `Multiple churches`, matching the shipped code and its test/validation coverage. No code change; not committed as a separate `fix(130):` commit since it's documentation carried alongside this review update.

**File:** `src/components/AppSidebar.vue:252` (vs. `.planning/phases/130-multi-church-volunteer-switcher/130-UI-SPEC.md:88`)
**Issue:** `130-UI-SPEC.md`'s Copywriting Contract table states the sidebar label for "multi-church, all churches selected" should read `All churches` (matching the filter's own default option). The shipped `volunteerChurchLabel` computed instead returns the literal `'Multiple churches'` for that state, with an inline comment acknowledging the discrepancy and resolving it in favor of `130-VALIDATION.md`'s test row (which does expect `'Multiple churches'`) and the corresponding `AppSidebar.test.ts` assertion. The code and its own tests are internally consistent, but `130-UI-SPEC.md` is now stale/wrong documentation that a future reader (or another AI agent) could reasonably follow instead, reintroducing the mismatch.
**Fix:** Update `130-UI-SPEC.md`'s Copywriting Contract row to `Multiple churches` so the three artifacts (spec, validation, code) agree.

### IN-02: `130-CONTEXT.md`'s "selected church carries into the volunteer service view" decision appears unimplemented

**Outcome: SKIPPED (deferred, per fix-scope instruction)** — this requires a scoping decision (confirm intentional descope vs. file a follow-up phase/task) rather than a code fix, and the instructing task explicitly said to skip risky/ambiguous INFO items. No code or doc change made; left for a human/product decision.

**File:** `.planning/phases/130-multi-church-volunteer-switcher/130-CONTEXT.md:35-36` (no corresponding change found in `src/composables/useVolunteerServiceDoc.ts` / `src/views/VolunteerServiceView.vue` across the Phase 130 commits)
**Issue:** `130-CONTEXT.md` records a decision: "when a volunteer opens a service from a filtered My Schedule, the church context (name) is consistent." Neither `130-01-PLAN.md` nor `130-02-PLAN.md` scopes this, and `git log` for the phase's `feat(130-*)` commits touches only `rehearseAccess.ts`, `services.ts`, `mySchedule.ts`, `MyScheduleView.vue`, and `AppSidebar.vue` — not the volunteer service view. This may be an intentional scope trim between context-gathering and planning, but as written it reads like a dropped requirement rather than a documented cut.
**Fix:** Either confirm this was consciously descoped (and strike it from `130-CONTEXT.md`/note it in a follow-up backlog item), or file it as a small follow-up phase/task before considering R404 fully closed.

---

_Reviewed: 2026-09-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
