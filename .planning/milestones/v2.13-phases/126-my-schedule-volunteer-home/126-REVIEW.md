---
phase: 126-my-schedule-volunteer-home
reviewed: 2026-09-06T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - firestore.rules
  - firestore.indexes.json
  - src/stores/mySchedule.ts
  - src/utils/rehearseAccess.ts
  - src/utils/myScheduleGrouping.ts
  - src/router/index.ts
  - src/views/MyScheduleView.vue
  - src/components/ScheduleServiceCard.vue
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 126: Code Review Report

**Reviewed:** 2026-09-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7 (+ `src/rules.test.ts`, `src/utils/roleChipIcon.ts`, `src/views/VolunteerServicePlaceholderView.vue`, `src/views/VolunteerLinkCompleteView.vue` read for context only, per `required_reading`)
**Status:** issues_found

## Summary

This phase adds the `rehearseAccess` collection-group `list` capability (both a same-org nested
`list` arm and the top-level `{path=**}` collection-group arm) plus the My Schedule store/view/card
that consumes it. The core isolation invariant holds: I could not construct a query or rule
condition that lets a signed-in volunteer read another org's data, another volunteer's row they
aren't co-assigned to, an unverified-email session, or a Draft-status service, via either the `get`
or `list` paths. The existing `get` arm's live `parentIsPlanned()` re-check is unchanged and not
weakened. The new `list` arm is byte-for-byte identical in its four conjuncts to `get` (email
non-null, `email_verified==true`, status check, own-email `in` assignedEmailsLower), and
`firestore.indexes.json`'s new COLLECTION_GROUP composite index field order
(`status ASC, assignedEmailsLower CONTAINS, serviceDate ASC`) matches the app's query exactly, with
no extra/broader fields.

The one substantive design risk is that the list arm's frozen-`status` check has **no live
cross-document re-check** (a documented, unavoidable Firestore limitation for collection-group list
rules) and instead depends entirely on `reopenService()`'s client-side `deleteDoc` of the
projection succeeding — and that delete's failure is currently swallowed silently with no
reconciliation path. This doesn't defeat the isolation boundary (a volunteer still can't read the
*live* draft content via `get`), but it can leave a stale, frozen assignment visible in the
aggregate My Schedule list after a reopen if the delete happens to fail. See WR-01 below.

Everything else — grouping/countdown boundary math, readiness three-state logic, PII-shape of
`rolesByEmailLower`, empty/loading/error states, mobile reflow — checks out on direct trace-through.
Several smaller robustness/quality gaps are noted below.

## Warnings

### WR-01: The `rehearseAccess` list arm's only defense against a stale post-reopen doc is a client-side delete with no retry or reconciliation

**File:** `firestore.rules:445-459` (design rationale), enforced by `firestore.rules:460-476` (the list arm) and `src/stores/services.ts:660-672` (`reopenService`, not in this phase's file set but is the mechanism the rule's own comment relies on)
**Issue:** The collection-group `list` arm cannot do a live `get()` on the sibling `services/{serviceId}` doc (Firestore throws on dynamic path construction inside a `{path=**}` match — documented in the rule's own comment), so it trusts the projection's own frozen `status` field instead, and that guarantee is explicitly staked on `reopenService()` always deleting the `rehearseAccess` doc on every `planned/exported -> draft` transition. Reading `reopenService()`:

```ts
await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
  status: 'draft',
  updatedAt: serverTimestamp(),
})
try {
  await deleteDoc(doc(db, 'organizations', orgId.value, 'rehearseAccess', id))
} catch (err) {
  console.error(`reopenService: rehearseAccess revoke failed for service ${id} — continuing`, err)
}
```

the status flip is committed first, and if the follow-up delete throws (offline tab, transient
Firestore error, permission edge case), the failure is only `console.error`'d — the reopen
completes from the editor's point of view, no retry is scheduled, and no server-side reconciliation
exists. The stale `rehearseAccess` doc (still `status:'planned'`) then continues to satisfy the
collection-group list arm and will keep appearing in every previously-assigned volunteer's My
Schedule aggregate view, even though the parent service is back in Draft and may be actively being
re-edited. The direct `get` path (opening the Rehearse view itself) remains safe because
`parentIsPlanned()` still live-checks the real service doc — so this is a data-hygiene/staleness
leak in the list surface, not a full content-access bypass — but it is exactly the scenario the
rule's own comment calls "the primary defense," with no compensating control if that defense fails.
**Fix:** Add a durable reconciliation independent of client success — e.g., a Cloud Function
(scheduled sweep or triggered off the `services/{id}` `planned -> draft` transition) that deletes
any `rehearseAccess` doc whose parent status is not `planned`/`exported`, so a failed client-side
`deleteDoc` self-heals instead of persisting indefinitely. At minimum, surface the failure (retry
once, or flag the service for manual re-sync) rather than only logging to the console.

### WR-02: The nested `rehearseAccess` list arm's `isOrgMember(orgId)` success path is untested, and this exact call shape is documented elsewhere in this file as capable of throwing during list evaluation

**File:** `firestore.rules:318-325`
**Issue:** Phase 126 adds `allow list: if isOrgMember(orgId) || (...)` to the nested,
single-org-scoped `rehearseAccess` match, mirroring `get`. `isOrgMember()` calls `isSuperAdmin()`,
which reads the bare custom claim `request.auth.token.superAdmin`. Fifteen lines below, the
top-level collection-group arm's own comment states this exact pattern was empirically found to
throw ("Property superAdmin is undefined on object") when evaluated during a `list`/collection-group
context for a token that has no `superAdmin` claim at all — which is precisely why that top-level
arm deliberately omits `isOrgMember(...)`. `src/rules.test.ts` has no test that exercises a plain
`getDocs(collection(db,'organizations','orgA','rehearseAccess'))` as an ordinary org member (only
as a volunteer, which is denied for unrelated reasons — no email match). If the same throw behavior
applies to this nested (non-collection-group) `list`, any future feature that lists this
subcollection as an org member (e.g., an admin "who's assigned" screen) would be silently denied
end-to-end with no test catching the regression today.
**Fix:** Add a positive-path test: seed an ordinary member (no `superAdmin` claim) and assert
`getDocs(collection(db, 'organizations', orgA, 'rehearseAccess'))` succeeds. If it turns out to
throw, apply the same fix as the top-level arm (an explicit `isSignedIn() && exists(member doc) &&
isOrgActive(orgId)` check that never touches `isSuperAdmin()`).

### WR-03: A volunteer whose only assignments are past services sees an effectively empty page

**File:** `src/views/MyScheduleView.vue:79-98, 101-195`
**Issue:** The empty state only triggers when `mySchedule.docs.length === 0` (line 81). A volunteer
with one or more *past* assignments but zero upcoming ones falls into the "Populated" branch
(line 101), where `thisWeek`/`laterThisMonth` sections are both empty (not rendered), `summaryLine`
computes to `''` (line 271: `totalUpcoming === 0` short-circuits), and `Past services` renders
collapsed by default (`showPast` starts `false`, line 215). The net result is a page showing only
the top bar and a bare "Welcome"/greeting line with no visible content until the user notices and
clicks the collapsed toggle — functionally indistinguishable from a broken page for that user
segment.
**Fix:** When `totalUpcoming.value === 0 && groups.past.length > 0`, either default `showPast` to
`true`, or render a short explicit line (e.g., "No upcoming services — see your past services
below") above the toggle.

### WR-04: User-chip dropdown menu has no outside-click or Escape dismissal

**File:** `src/views/MyScheduleView.vue:12-58`
**Issue:** `menuOpen` is only ever set to `false` by the two menu actions themselves
(`goToDifferentEmail`, `handleSignOut`) — there is no document-level click listener or `@keydown.esc`
handler, so clicking anywhere else on the page (or pressing Escape) leaves the `role="menu"` open,
which is both a UX papercut and an accessibility gap (menus are conventionally dismissible via
Escape and outside click).
**Fix:** Add an outside-click handler (e.g. `onClickOutside` from VueUse, or a manual
`document.addEventListener('click', ...)` in `onMounted`/cleaned up in `onUnmounted`) and an
`@keydown.esc="menuOpen = false"` on the menu container.

## Info

### IN-01: `loadMySchedule` swallows the underlying error with no logging

**File:** `src/stores/mySchedule.ts:49-51`
**Issue:** The `catch` block sets a generic user-facing `error.value` but never logs `err` (no
`console.error`), unlike the equivalent pattern in `services.ts` (`markAsPlanned`/`reopenService`),
which always pairs a swallowed error with a `console.error`. This makes a production failure of
this query (e.g., a missing/misconfigured composite index, which throws a distinctive Firestore
error) invisible in the browser console.
**Fix:** `console.error('loadMySchedule failed', err)` alongside setting `error.value`.

### IN-02: A song slot referencing a deleted/missing catalog song is dropped from the projection with no signal

**File:** `src/utils/rehearseAccess.ts:110-128`
**Issue:** `songsById.get(slot.songId)` returning `undefined` causes that song to be filtered out of
`rehearseSongs` entirely (the `.filter((s): s is RehearseSong => s !== null)` on line 128). A
service locked with a slot pointing at a since-deleted song will silently show fewer songs (and a
correspondingly wrong readiness/song count) to the volunteer than what a leader actually built,
with nothing in the projection to indicate a song was dropped.
**Fix:** Not blocking for this phase, but worth a follow-up: either keep a stub entry
(`title: '(song removed)'`) or emit a count discrepancy signal so a leader can notice.

### IN-03: `readinessColorClass`'s "partial" and "waiting" colors are nearly indistinguishable

**File:** `src/components/ScheduleServiceCard.vue:138-142`
**Issue:** `partial` maps to `text-amber-400` and `waiting` maps to `text-amber-300` — a
one-shade-of-amber difference that most users won't perceive, undermining the three-state visual
distinction the readiness feature is meant to convey (icon shape differs too, so it's not a total
loss, but the color coding itself doesn't pull its weight here).
**Fix:** Give `waiting` a visually distinct treatment (e.g., `text-gray-400`/neutral, since
"nothing uploaded yet" arguably reads as neutral rather than warning-amber) so the two states are
distinguishable by color alone, not just icon shape.

### IN-04: Redundant type intersection in `MyScheduleDoc`

**File:** `src/stores/mySchedule.ts:10`
**Issue:** `type MyScheduleDoc = RehearseAccessDoc & { orgId: string }` intersects with a field
(`orgId: string`) that `RehearseAccessDoc` already declares (`src/utils/rehearseAccess.ts:32`). The
intersection is harmless (same type, so it doesn't accidentally widen/narrow anything) but is
misleading at a glance — a reader might assume `RehearseAccessDoc` has no `orgId` field, when the
real intent (per the comment above it) is "override the field's *value* from the stored doc's
own path," which TypeScript's structural typing can't actually express or enforce here.
**Fix:** Either add a one-line comment clarifying that the intersection is deliberately a no-op at
the type level (the real override happens at the `{ ...data, orgId: ... }` spread call site, not
in the type), or omit the redundant field from the type and rely on the base interface.

---

_Reviewed: 2026-09-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
