---
phase: 111-architectural-remediation
reviewed: 2026-09-02T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/stores/auth.ts
  - src/components/AppShell.vue
  - src/stores/__tests__/auth.test.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 111: Code Review Report

**Reviewed:** 2026-09-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the ARCH-001 remediation: the `loadOrgContextEpoch` generation guard added to
`loadOrgContext` in `src/stores/auth.ts`, the `exiting` in-flight guard on AppShell.vue's
"Exit to owner console" button, and the new regression tests in `auth.test.ts`.

The AppShell.vue `exiting` guard is correct: it is set before the `await`, reset in a
`finally`, and the two new regression tests for the `memberUnsub` epoch guard (in
`auth.test.ts`) are real (non-tautological) — they assert `onSnapshot` call counts and
inspect per-call unsubscribe spies, not just end state.

However, the epoch guard itself is **incomplete**. It protects exactly one mutation site —
the final `memberUnsub = onSnapshot(...)` assignment at the tail of `loadOrgContext` — but
`loadOrgContext` has several other await-gated state-mutation points upstream of that check
(`memberships.value`, `orgId.value`, `applyOrgSnapshot`'s writes, and three separate
`resetOrgContext()` early-return branches) that remain completely unguarded. A superseded
call can still race past the "protected" final check by simply never reaching it — it exits
through one of the earlier `return` statements instead — and in doing so can either wipe or
overwrite a newer, still-live call's state, including tearing down the newer call's
`memberUnsub` listener via `resetOrgContext()`. This directly contradicts the guarantee the
fix's own header comment claims ("protects ALL callers ... a superseded/interleaved call ...
will always find a mismatch and returns WITHOUT ... touching memberUnsub").

## Critical Issues

### CR-01: Epoch guard only covers the final `onSnapshot` assignment — three `resetOrgContext()` branches and all earlier state writes in `loadOrgContext` are unguarded, so a superseded call can still corrupt a newer call's org context

**File:** `src/stores/auth.ts:453-539`
**Issue:**

`loadOrgContext` captures `myEpoch = ++loadOrgContextEpoch` at its very top (line 414), but
only checks `myEpoch !== loadOrgContextEpoch` once, immediately before the final
`memberUnsub = onSnapshot(...)` assignment (line 533). Every other state mutation in the
function happens **before** that check and is not epoch-guarded at all:

- `memberships.value = await Promise.all(...)` (line 453)
- `resetOrgContext()` in the `activeId === null` branch (line 479) — no epoch check first
- `orgId.value = activeId` (line 483)
- `resetOrgContext()` in the org-doc-read-rejected/deactivated catch branch (line 503) — no
  epoch check first
- `resetOrgContext()` in the `isActive === false` branch (line 517) — no epoch check first
- `applyOrgSnapshot(orgData)` (line 522), which writes `orgName`, `orgSlug`, `pcAppId`,
  `pcSecret`, `settings`, `vwModeEnabled`, `aiMasterEnabled`, `bibleApiEnabled`

Because these are unguarded, two concrete failure modes exist that the single tail-check
does not prevent:

1. **A superseded call still wipes a newer call's live context.** If call A (older,
   `myEpoch=1`) is suspended on an `await` (e.g. inside `refreshOrgClaim`'s retry loop,
   which can take up to `CLAIM_REFRESH_MAX_ATTEMPTS * CLAIM_REFRESH_DELAY_MS` ≈ 4.5s) while
   call B (newer, `myEpoch=2`) starts and runs to completion — setting `orgId.value`,
   `applyOrgSnapshot(...)`, and `memberUnsub` for a legitimate org — then when A resumes and
   its own `orgRef` read rejects, or its own `activeId` resolves to `null`, or its own org
   turns out `active === false`, A calls `resetOrgContext()` **unconditionally**. This
   unsubscribes and nulls B's live `memberUnsub` listener, clears `orgId`/`orgName`/
   `settings`/etc. back to defaults, and — in the deactivation branches — sets
   `deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE`. The user, who is looking at B's
   correctly-loaded church, is now shown "This church is deactivated" and has lost the live
   member-role listener, even though nothing is actually wrong with B's org.
2. **State can desync from the listener even when the guarded assignment behaves correctly.**
   If A's earlier writes (`orgId.value = 'org-A'`, `applyOrgSnapshot(orgA data)`) resolve
   *after* B has already finished (B set `orgId.value = 'org-B'` and
   `memberUnsub` = org‑B's listener), A will overwrite `orgId`/`orgName`/`settings` back to
   org‑A's values. A's own final epoch check (line 533) *does* correctly stop A from also
   reassigning `memberUnsub`, so the live listener stays subscribed to org‑B's member doc —
   but the UI now displays org‑A's name/settings while `userRole` updates keep arriving from
   org‑B's listener. `orgId`/`orgName`/`settings` and the live `memberUnsub` subscription can
   point at two different orgs simultaneously.

This is exactly the class of race ARCH-001 set out to close (`resetOrgContext()` touches the
same shared `memberUnsub` the onSnapshot assignment does), and the module-scope header
comment's claim — "immediately before it would touch memberUnsub ... re-checks ... [a]
superseded ... call will always find a mismatch and return WITHOUT ... touching memberUnsub"
— is not true for these three branches, since they touch `memberUnsub` (via
`resetOrgContext()`) with no re-check at all.

Neither of the two new ARCH-001 regression tests (`auth.test.ts:1965`, `:2002`) exercises
this: both fixtures resolve to the *same* `activeId` for both concurrent calls, so neither
ever reaches the `activeId === null` or deactivation branches under a race.

**Fix:** Guard every mutation point that follows an `await`, not just the last one — e.g.
factor a small helper and call it before each mutation/branch:

```ts
async function loadOrgContext(uid: string, membershipJustCreated = false): Promise<void> {
  deactivatedOrgMessage.value = null
  const myEpoch = ++loadOrgContextEpoch
  const isStale = () => myEpoch !== loadOrgContextEpoch

  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  if (isStale()) return
  ...

  memberships.value = await Promise.all(ids.map(...))
  if (isStale()) return

  const activeId = ...
  if (activeId === null) {
    if (isStale()) return
    resetOrgContext()
    return
  }

  if (isStale()) return
  orgId.value = activeId

  await refreshOrgClaim(activeId, membershipJustCreated)
  if (isStale()) return

  try {
    orgSnap = await getDoc(orgRef)
  } catch {
    if (isStale()) return
    resetOrgContext()
    deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE
    return
  }
  if (isStale()) return
  if (orgSnap.exists()) {
    ...
    if (isActive === false && !isSuperAdmin.value) {
      if (isStale()) return
      resetOrgContext()
      deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE
      return
    }
    applyOrgSnapshot(orgData)
  }

  if (isStale()) return
  memberUnsub?.()
  memberUnsub = onSnapshot(...)
}
```

Add a test where two overlapping calls resolve to **different** `activeId`s (or one hits the
deactivation/no-org branch while the other completes normally) and assert the *older* call's
`resetOrgContext()`/state writes never clobber the newer call's `orgId`/`orgName`/`settings`/
`memberUnsub`.

## Warnings

### WR-01: `logout()` and the sign-out branch of `onAuthStateChanged` never increment `loadOrgContextEpoch`, so a slow in-flight `loadOrgContext` call can still create a new listener after sign-out

**File:** `src/stores/auth.ts:579-596`, `:780-805`
**Issue:** The epoch counter (`loadOrgContextEpoch`) is only ever incremented inside
`loadOrgContext` itself. `logout()` (lines 780-805) and the `firebaseUser === null` branch of
`onAuthStateChanged` (lines 579-596) both manually reset store state and call
`memberUnsub?.(); memberUnsub = null` directly — but neither bumps the epoch counter. If a
`loadOrgContext` call is still in flight when the user logs out (e.g. logout is triggered
within the ~4.5s `refreshOrgClaim` retry window of a just-completed invite acceptance) and no
new sign-in happens afterward, that stale call's own tail check
(`myEpoch !== loadOrgContextEpoch`) still passes — nothing else has incremented the counter —
so it proceeds to `memberUnsub = onSnapshot(...)`, attaching a brand-new listener for an
already-signed-out session. This listener is never torn down by `logout()` (which already
ran) and has no error callback, so its first (likely permission-denied, post sign-out) event
becomes an unhandled snapshot-listener error — the same failure class Bug 2a
(`quick 260830-l9c`, referenced in the `logout()` comment at line 798) was written to
prevent, reintroduced here for the pre-sign-out-in-flight case.

The header comment's claim that the epoch guard "protects ALL callers ... logout's
re-entry" is true only for the re-login-after-logout case (a fresh `loadOrgContext` call from
the next sign-in does bump the epoch and correctly supersedes the stale one); a plain logout
with no subsequent sign-in is not covered.

**Fix:** Increment `loadOrgContextEpoch` in `logout()` and in the sign-out branch of
`onAuthStateChanged` as well, so any in-flight `loadOrgContext` call is unconditionally
invalidated on sign-out:

```ts
} else {
  ...
  loadOrgContextEpoch++ // invalidate any in-flight loadOrgContext call
  memberUnsub?.()
  memberUnsub = null
}
```

### WR-02: `enterOrgAsSuperAdmin()` mutates the same shared state (`resetOrgContext()`, `orgId`, `applyOrgSnapshot`) without ever touching `loadOrgContextEpoch`

**File:** `src/stores/auth.ts:623-644`
**Issue:** `enterOrgAsSuperAdmin` calls `resetOrgContext()` (line 625) and then writes
`orgId.value`, `viewingAsSuperAdmin.value`, and `applyOrgSnapshot(...)` directly — the exact
same shared refs `loadOrgContext` guards with the epoch counter — but it neither checks nor
increments `loadOrgContextEpoch`. A `loadOrgContext` call already in flight when
`enterOrgAsSuperAdmin` runs (e.g. the initial post-login load, still awaiting
`refreshOrgClaim`) is not invalidated by entering super-admin view: when it resumes, its
epoch check still passes (the counter is unchanged) and it will overwrite the just-entered
super-admin view's `orgId`/`orgName`/`settings`, or reattach a `memberUnsub` listener for the
super-admin's own org over top of the (deliberately listener-less, per R226) super-admin
view. The store-layer comment describes this guard as store-layer "defense-in-depth" for
"ALL callers," but `enterOrgAsSuperAdmin` is not integrated with it at all.
**Fix:** Either route `enterOrgAsSuperAdmin` through the same `myEpoch`/`loadOrgContextEpoch`
mechanism (increment on entry, bail if superseded), or explicitly document that
`enterOrgAsSuperAdmin` relies solely on the UI-level `enteringOrgId` guard and is not
epoch-protected against a concurrent `loadOrgContext` call — the current comment implies
broader coverage than exists.

## Info

### IN-01: Unnecessary optional chaining on `router` in AppShell.vue

**File:** `src/components/AppShell.vue:88`
**Issue:** `router?.push('/owner-console')` — `router` comes from `useRouter()` at line 72,
which is never `null`/`undefined` inside a component's `setup()`. The `?.` implies a
nullability that doesn't exist and can mask a real bug (a `router` that failed to initialize)
by silently no-oping instead of throwing.
**Fix:** `router.push('/owner-console')`.

### IN-02: `onExitSuperAdminView` gives no user-facing feedback if the exit fails

**File:** `src/components/AppShell.vue:81-92`
**Issue:** If `authStore.exitSuperAdminView()` rejects (e.g. the unguarded
`getDoc(userRef)` inside the `loadOrgContext` call it makes throws), the `finally` correctly
re-enables the button, but the error itself is neither caught nor surfaced to the user — it
becomes an unhandled promise rejection at the `@click` boundary (Vue does not await
non-awaited template handlers). The user sees the button re-enable with no explanation and no
indication the exit didn't happen.
**Fix:** Wrap the `await authStore.exitSuperAdminView()` call in a `try/catch` (or a
`.catch()`) that surfaces a toast/inline error, rather than relying on an implicit unhandled
rejection.

---

_Reviewed: 2026-09-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
