---
phase: 80-security-data-integrity-hardening
reviewed: 2026-08-24T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - firestore.rules
  - src/rules.test.ts
  - src/stores/services.ts
  - src/stores/__tests__/services.test.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/__tests__/slideGroupMaterializer.test.ts
  - src/components/slides/EditSlideDrawer.vue
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 80: Code Review Report

**Reviewed:** 2026-08-24T00:00:00Z
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the five R232-R236 changes (firestore.rules gates, `deleteService` share
revocation, `rebuildSongGroup`'s cleared-song branch, and `EditSlideDrawer`'s
pending-render guard) plus their four test files, cross-referencing call sites in
`TeamView.vue`, `ServiceEditorView.vue`, `NewServiceDialog.vue`, and the rest of
`src/stores/services.ts` (`writeSharePayload`/`ensureShareLink`) to verify the claims
made in each change's own code comments rather than taking them at face value.

**R232 (inviteLookup create gate)** is correct and complete for its stated threat:
`isOrgEditor(request.resource.data.orgId)` closes the self-invite forgery vector, the
mismatched-orgId case is genuinely denied, and `allow read`/`allow delete` are
untouched — the invite→first-login flow is intact. An editor of org A can still invite
*any* email into org A at *any* role (including `admin`), but that is the intended
shape of an invite feature and `role` carries no privilege differential elsewhere in
this codebase (`isOrgEditor` treats `'editor'` and `'admin'` identically), so this is
not flagged as a gap.

**R233 (createdBy immutability)** is correct: `preservesCreatedBy()` is reachable only
from `allow update` (where `resource` is guaranteed non-null), catches both
reassignment and field-deletion via `diff().affectedKeys()`, and does not collide with
`allow create`'s own `createdBy == request.auth.uid` requirement. Grepped the entire
`src/` tree for any real (non-test) full-overwrite `setDoc` against the organizations
root doc — there are none; every legitimate write path already uses `updateDoc`
partial updates, so this guard introduces zero regression risk against real app code
(only the test suite's synthetic full-overwrite `setDoc` calls needed adjusting, which
they were).

**R234 (deleteService revocation)** correctly revokes every `shareTokens` doc via
query, existence-guards the direct-keyed `serviceShareLinks/{id}` delete, and deletes
the service doc last. However, tracing `writeSharePayload` (the function that *creates*
the `serviceShares/{slug}__service-{date}` doc being revoked) surfaced a genuine data-
integrity bug: that document is keyed **only** by `slug` + `date`, with no `serviceId`
field, and the app enforces no uniqueness on service dates (`NewServiceDialog.vue`'s
date field is freely editable past `nextFreeSunday`'s mere *suggestion*). Two services
on the same date in the same org share one `serviceShares` doc. Deleting either one now
unconditionally deletes that shared doc — silently breaking the OTHER, non-deleted
service's live public memorable share URL (`/:slug/service-:date`, a real registered
route in `router/index.ts`). See CR-01 below.

**R235 (slideGroupMaterializer cleared-song fix)** is correct and well isolated: groups
are keyed per-`slot.id`, so clearing one slot's group cannot affect a reprised song's
other slot, the idempotency guard (`slides.length === 0`) matches every other
`rebuild*` function's contract, and the new tests explicitly exercise the two-slots-
same-song scenario the fix claims to handle.

**R236 (pending-render edit guard)** is correct: `isPendingRender` composes into both
`canMutate` and `canMutateBackground`, every mutation handler re-checks its gate
(defense in depth), the notice precedence is unambiguous in the template, and the
"ready" (no `renderState`) path is provably unaffected by the new tests.

## Critical Issues

### CR-01: `deleteService` can delete another, undeleted service's live public share link when two services share a date

**File:** `src/stores/services.ts:436-447`
**Issue:** Step 3 of `deleteService` deletes `serviceShares/{slug}__service-{date}`
keyed purely by the deleted service's own `date` field:
```ts
if (service) {
  const orgSnap = await getDoc(doc(db, 'organizations', orgId.value))
  const slug = orgSnap.exists() ? (orgSnap.data().slug as string | undefined) : undefined
  if (slug) {
    const shareRef = doc(db, 'serviceShares', `${slug}__service-${service.date}`)
    const shareSnap = await getDoc(shareRef)
    if (shareSnap.exists()) await deleteDoc(shareRef)
  }
}
```
`writeSharePayload` (same file, ~line 674) writes to this exact same
`{slug}__service-{date}` key for **every** service on that date — the document has no
`serviceId` field to disambiguate ownership:
```ts
await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), {
  orgId: orgIdValue,
  orgSlug: slug,
  serviceSnapshot,
  token,
  updatedAt: serverTimestamp(),
})
```
Nothing in the app prevents two services in the same org from sharing a date — the
date field in `NewServiceDialog.vue` is a plain editable input; `nextFreeSunday` only
supplies a *default*, and every service auto-generates a share link at creation
(`createService` → `ensureShareLink`, unconditionally). If a church schedules a
morning and evening service (or any two services) on the same date and later deletes
one of them, this code silently deletes the **surviving** service's public,
congregant-facing `/:slug/service-:date` page — a real registered route
(`router/index.ts:116`) — with `firestore.rules`' `allow delete: if
isOrgEditor(resource.data.orgId)` (line 612) permitting the delete since both services
belong to the same org. The `firestore.rules` change and this deletion logic are new
in this phase; the collision precondition (shared `serviceShares` doc) is pre-existing,
but the *destructive delete of it* is new, unguarded behavior introduced by R234. No
test in `src/stores/__tests__/services.test.ts` exercises the same-date-two-services
case.
**Fix:** Either (a) store `serviceId` on the `serviceShares` doc in `writeSharePayload`
and check it before deleting in `deleteService` (skip the delete, or overwrite instead
of delete, when the stored `serviceId` doesn't match the service being deleted), or
(b) enforce date uniqueness per org at service creation so the collision precondition
cannot occur. Minimal fix:
```ts
// writeSharePayload: add serviceId to the doc
await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), {
  serviceId: service.id, // NEW
  orgId: orgIdValue,
  orgSlug: slug,
  serviceSnapshot,
  token,
  updatedAt: serverTimestamp(),
})

// deleteService: only delete if it still belongs to THIS service
if (shareSnap.exists() && shareSnap.data().serviceId === id) {
  await deleteDoc(shareRef)
}
```

## Warnings

### WR-01: `deleteService` has no error handling — a mid-sequence failure silently leaves the service undeleted with partially-revoked share artifacts

**File:** `src/stores/services.ts:414-451`, `src/views/ServiceEditorView.vue:4408-4418`
**Issue:** `deleteService` performs up to 6 sequential Firestore operations (N
`shareTokens` deletes, 1 `serviceShareLinks` delete, 1 `serviceShares` delete, 1
service-doc delete) with no try/catch and no rollback. If any intermediate write
throws (permission-denied on a stale/cross-org `shareTokens` doc, a transient network
error, etc.), the function throws and the remaining steps — including the actual
service-doc delete — never run. The caller, `ServiceEditorView.vue`'s `onDelete()`,
has no `catch` around the `await serviceStore.deleteService(...)` call:
```ts
async function onDelete() {
  if (!localService.value) return
  isDeleting.value = true
  try {
    await serviceStore.deleteService(serviceId.value)
    router.push('/services')
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}
```
The `finally` resets `isDeleting` and closes the confirm modal regardless of outcome,
so on a mid-sequence failure the user sees the delete dialog simply close with no
error message, the service is NOT deleted (silent, looks like success), yet it has
already had some of its share artifacts irreversibly revoked. This is a new failure
mode introduced by turning a single-`deleteDoc` operation into a multi-step sequence.
**Fix:** Wrap the body of `onDelete()` in a catch that surfaces an error to the user
(mirroring the pattern already used elsewhere in this file, e.g. `onCancelInvite` in
`TeamView.vue`), and/or make `deleteService` itself resilient — catch-and-log each
revocation step individually (matching the existing soft-fail pattern already used by
`writeSharePayload`'s memorable-URL write) so a failure to revoke one artifact does not
block deletion of the others or of the service doc itself.

### WR-02: `deleteService` leaves `services/{id}`'s subcollections (`messages`, `lockSnapshots`) orphaned

**File:** `src/stores/services.ts:414-451` (compare `firestore.rules:316-345`)
**Issue:** `firestore.rules` defines client-writable subcollections under each service
document — `services/{docId}/messages/{messageId}` (volunteer messaging content) and
`services/{docId}/lockSnapshots/{snapshotId}` (line 318, 339). Firestore's client SDK
`deleteDoc()` does not cascade to subcollections; deleting only
`organizations/{orgId}/services/{id}` (the final step of `deleteService`) leaves these
subcollections in place, permanently unreachable through the app's UI (no code path
queries a deleted service's id) yet still present in Firestore and still readable by
any org editor via the generic `/{collection}/{docId}` wildcard rule
(`firestore.rules:476-482`). R234's own stated goal is "a deleted service must not
leave a live... artifact behind" — this class of artifact (potentially containing
recipient names/roles/phone numbers via `messages`) was not addressed.
**Fix:** Add cleanup for these subcollections in `deleteService` (batch-query and
delete `messages`/`lockSnapshots` docs before the final service-doc delete), or — if
retention is intentional for audit purposes — document that explicitly rather than
leaving it implicit.

### WR-03: `EditSlideDrawer`'s "mutually exclusive" invariant between `isSongGroup` and `isPendingRender` is comment-only, not type- or code-enforced

**File:** `src/components/slides/EditSlideDrawer.vue:59-68`
**Issue:** The notice-precedence comment asserts "`isSongGroup` and `isPendingRender`
cannot co-occur (mutually exclusive slot kinds)" as the justification for why
pending-render safely outranks song-group in the notice display. This is true only
because `renderState` is, by current convention, set exclusively by
`importedEntryContent` (`src/utils/importedRenderReconciler.ts`) for `IMPORTED`-kind
slots. `SlideBase.renderState` (`src/types/slide.ts:62`) is typed on the shared base
interface with no structural link to `slotKind`, so nothing in the type system
prevents a future code path from setting `renderState` on a song-derived slide. Should
that invariant ever be violated, the drawer would silently show the pending-render
notice instead of the (also-correct, but different) song-readonly notice — low
functional impact since `canMutate` still composes both conditions with AND either
way, but the comment overstates a structural guarantee that doesn't exist.
**Fix:** Either narrow `renderState` to a discriminated union scoped to imported
slides only, or soften the comment to note this is a convention maintained by
`importedRenderReconciler.ts`, not a compiler-enforced invariant.

## Info

### IN-01: R233 negative test coverage doesn't exercise field-removal, only reassignment

**File:** `src/rules.test.ts:166-176` (`DENIES an editor changing createdBy via updateDoc`)
**Issue:** The new DENY test only proves `updateDoc(..., { createdBy: 'someoneElse' })`
is rejected. `preservesCreatedBy()`'s `diff().affectedKeys()` check also denies
removing the field entirely (e.g. `updateDoc(..., { createdBy: deleteField() })`), but
no test exercises that path, so a future refactor of the helper could silently regress
it without the suite catching it.
**Fix:** Add a companion test asserting `assertFails` on an `updateDoc` that removes
`createdBy` via `deleteField()`.

### IN-02: `inviteLookup` create rule does not validate the `role` field's value

**File:** `firestore.rules:495`
**Issue:** `allow create: if isSignedIn() && isOrgEditor(request.resource.data.orgId);`
gates on org-editor status but places no constraint on `request.resource.data.role`.
Today this is harmless (`isOrgEditor` treats `'editor'` and `'admin'` identically
throughout the ruleset, so there is no privilege tier for an editor to escalate into),
but if a distinct, more-privileged role is ever introduced, this rule would need a
matching update to stay closed.
**Fix:** No action required now; flagging so a future role-tier addition doesn't miss
this call site.

---

_Reviewed: 2026-08-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
