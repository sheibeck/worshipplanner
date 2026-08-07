---
phase: 41-sharing-correctness
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - firestore.rules
  - src/rules.test.ts
  - src/stores/__tests__/services.test.ts
  - src/stores/services.ts
  - src/utils/__tests__/shareTokens.test.ts
  - src/utils/shareTokens.ts
findings:
  critical: 1
  warning: 6
  info: 1
  total: 8
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The core of this phase — `orgId` immutability on both `shareTokens` and `serviceShareLinks`, the
null-`resource` read guard, `pickAdoptableToken`'s org-filter-before-sort ordering, the
equality-only adoption query, `buildServiceSnapshot`'s PII scrub, and `maybeRefreshShareLink`'s
structural inability to write back to `services/{docId}` — is implemented correctly and is backed
by tests that genuinely exercise the behavior (the "assert absence, not just presence" discipline
called out in the plan is followed in practice, e.g. the T-41-01/T-41-02 tests iterate every
`updateDoc`/`setDoc` call rather than just counting them).

The null-`resource` read clause on `serviceShareLinks` (focus area 3) was reviewed specifically for
whether it leaks anything beyond existence: it does not — a denied read carries no data, and the
`resource == null` branch only ever fires on a genuinely nonexistent document. The stated low-severity
acceptance (existence oracle only) is sound as implemented.

One finding is a genuine BLOCKER: the phase's new adoption logic (`pickAdoptableToken` /
`ensureShareLink`) reads and *trusts* the `orgId` and `createdAt` fields of arbitrary pre-existing
`shareTokens` documents to decide which token becomes "the" official, permanently-recorded share link
for a service — but `shareTokens`' `create` rule was left at `isSignedIn()`, with no org-membership
check at all, unlike every sibling collection this phase touches (`serviceShareLinks`, `quarterShares`,
`serviceShares` all require `isOrgEditor`). That gap predates this phase, but this phase is what turns
it into an exploitable trust-boundary violation: before this phase nothing ever *read back and acted
on* another party's `shareTokens` document, so the loose create rule was inert. Now it is not. See
CR-01.

The remaining findings are warnings: two vacuous test assertions in the tiebreak-coverage of
`pickAdoptableToken`, a permanent-for-session soft-fail with no user-facing signal, a cache that is
never invalidated on org switch or service delete, a pre-existing (but now more easily triggered)
orphaning of the memorable-URL doc on a post-share date edit, and a rules-test coverage gap.

## Critical Issues

### CR-01: `shareTokens`' create rule has no org-membership check, and the new adoption logic trusts its data — enabling a non-editor (or non-member, given a known serviceId) to hijack a service's first share

**File:** `firestore.rules:220` (rule), `src/stores/services.ts:558-598` (trust boundary), `src/utils/shareTokens.ts:108-119` (`pickAdoptableToken`)

**Issue:**

`firestore.rules:220`:
```
allow create: if isSignedIn();
```

This is the only CRUD rule anywhere in this phase's authorization surface — `serviceShareLinks`
create/update/delete, `quarterShares` create/update, `serviceShares` create/update — that does **not**
require `isOrgEditor(request.resource.data.orgId)`. It requires only that the caller be signed in to
*any* account; `orgId`, `serviceId`, and `serviceSnapshot` are entirely caller-controlled.

Before this phase, that looseness was inert: `createShareToken` always minted a brand-new random
token and never read anyone else's `shareTokens` document. This phase adds `ensureShareLink`'s
adopt-or-create path (`src/stores/services.ts:550-565`), which — the *first* time a service is
shared (no `serviceShareLinks/{serviceId}` doc yet) — queries `shareTokens` for
`where('serviceId','==', service.id)` and calls `pickAdoptableToken(candidates, orgIdValue)`, which
adopts whichever candidate's **attacker-suppliable** `orgId` field string-equals the real org id
(picking the newest `createdAt` if several match). The winning candidate's document id is then
persisted permanently as the service's official token via `runTransaction` at
`services.ts:576-589`, and payload content is subsequently overwritten with legitimate data — but
only *after* the malicious document has already been selected and its id locked in.

Concretely: any signed-in user of the app who knows a target `(orgId, serviceId)` pair — trivially
true for any **viewer**-role member of that org (`isOrgMember` grants read on
`organizations/{orgId}/services`, so a viewer can enumerate real `serviceId`s the same way an
editor can; `orgId` itself is public via `orgSlugs/{slug}` reads, `allow read: if true`) — can, with
a bare `setDoc`, create:

```js
setDoc(doc(db, 'shareTokens', 'attacker-chosen-token'), {
  serviceId: '<real, not-yet-shared serviceId>',
  orgId: '<real orgId>',
  serviceSnapshot: { /* attacker-controlled */ },
  createdAt: serverTimestamp(),
})
```

This passes `create` today (`isSignedIn()` only). Two consequences:

1. **Unsanctioned publication.** Until an editor first presses "Share" for that service, the
   attacker's `serviceSnapshot` is publicly readable (`shareTokens` read is `if true`) at a URL an
   editor never approved — for a service that may never be intended to be shared at all. This
   directly undermines the editor-gating this phase otherwise builds carefully (viewers cannot
   create/update/delete `serviceShareLinks`; only editors can).
2. **Token hijack.** When an editor genuinely does share the service for the first time, adoption
   picks the attacker's document (it is the only/newest candidate whose `orgId` matches), so the
   permanently-recorded official token is the attacker-chosen string, not a server-random one. The
   payload content self-heals on the very next `writeSharePayload` call, but the token identity does
   not.

This is exactly the class of bug the `T-41-04`/`T-41-05`/CR-01 cross-org-overwrite fixes elsewhere in
this same rules file were written to close — a client-controlled document that a later authorization
decision trusts without an org-membership check — just on the `create` verb instead of `update`.

**Fix:** align `shareTokens`' create rule with every sibling collection in this phase:

```
match /shareTokens/{token} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```

Verified this does not break the legitimate paths: every `setDoc` against `shareTokens` in
`writeSharePayload` runs only from `ensureShareLink`/`maybeRefreshShareLink`, both reachable only
through UI actions gated to editors, and the write always carries the real `orgId`, so
`isOrgEditor(request.resource.data.orgId)` is satisfied. The self-heal overwrite path (adopted
doc already exists) is unaffected since it is governed by the (already-correct) `update` rule, not
`create`.

## Warnings

### WR-01: `pickAdoptableToken`'s createdAt-tie tests are vacuous — they would pass even with no tiebreak at all

**File:** `src/utils/__tests__/shareTokens.test.ts:93-119`

**Issue:** Tests 5 and 7 both construct `candidates` in the array order `[tok-b, tok-a]` (or
`[tok-b(null), tok-a(null)]`) and assert the result is `'tok-b'`. `Array.prototype.sort` is a
**stable** sort per the ECMAScript spec — elements that compare equal keep their original relative
order. Since both candidates share an identical `createdAt`, `shareTokenCreatedAtMillis(b) -
shareTokenCreatedAtMillis(a)` is always `0` in these two cases, so if the comparator's tiebreak line
(`return b.id.localeCompare(a.id)`) were deleted entirely — i.e. `pickAdoptableToken` had **no**
tiebreak logic at all and just returned `0` for every equal-createdAt pair — the input order
`[tok-b, tok-a]` would be preserved unchanged by the stable sort, and `sorted[0].id` would still be
`'tok-b'`. Both tests would still pass. The in-file comment ("Array order ... is the opposite of
alphabetical order, so a no-op comparator ... cannot pass this case") is incorrect: alphabetical
order of the *ids* is `tok-a < tok-b`, but the *array* is already ordered `[tok-b, tok-a]`, which is
exactly the output a no-op/absent tiebreak would produce.

**Fix:** flip the input order so the array's natural (stable, pre-sort) order disagrees with the
expected output, forcing the tiebreak to actually run:

```js
it('5. breaks a byte-identical createdAt tie via lexicographically greatest id', () => {
  const createdAt = { seconds: 500, nanoseconds: 0 }
  const candidates: ShareTokenCandidate[] = [
    { id: 'tok-a', orgId: 'org-1', createdAt }, // array order now MATCHES alphabetical order
    { id: 'tok-b', orgId: 'org-1', createdAt },
  ]
  expect(pickAdoptableToken(candidates, 'org-1')).toBe('tok-b') // only the real tiebreak reaches this
})
```

Apply the same fix to test 7 (two `null` `createdAt` values).

### WR-02: A single write failure permanently disables share-refresh for a service for the rest of the session, with no user-facing signal

**File:** `src/stores/services.ts:674-684`

**Issue:** `maybeRefreshShareLink`'s catch block sets `shareLinkCache.set(id, false)` on *any*
error — a transient network blip, a brief rules-propagation delay, or a genuine permission problem
are all treated identically. Once cached `false`, every future call short-circuits before attempting
another write (`services.ts:645-646`), for the remainder of the Pinia store's lifetime (effectively
the session). The only signal is `console.error`, which no end user will ever see. A real,
already-public, already-shared service can silently drift out of sync with what viewers see at its
public URL, with the editor having no indication anything is wrong.

**Fix:** distinguish transient failures from permanent ones (e.g. retry with backoff, or only cache
`false` on a permission-denied-style error), and/or surface a visible (even if dismissible) warning
in the editor UI when a refresh has failed, rather than relying solely on a console log.

### WR-03: `shareLinkCache` is never invalidated on org switch or service deletion

**File:** `src/stores/services.ts:460`, `342-345`, `199-207`

**Issue:** `shareLinkCache` is a plain `Map` scoped to the store instance's closure, populated by
`ensureShareLink`/`maybeRefreshShareLink` keyed by `serviceId`. `unsubscribeAll()` (called on org
switch) resets `services`, `isLoading`, `ownWriteEchoIds`, and `pendingWriteIds` — every other piece
of subscription-scoped state — but not `shareLinkCache`. `deleteService()` does not remove that
service's entry either. In practice this is low-risk (Firestore's 20-character random document ids
make a same-session, cross-org `serviceId` collision astronomically unlikely), but it is a real gap
relative to the store's otherwise careful full-reset discipline on org switch, and an unbounded (if
practically small) accumulation of dead entries for services that no longer exist.

**Fix:** clear `shareLinkCache` in `unsubscribeAll()`, and delete the entry for `id` in
`deleteService()`.

### WR-04: A post-share date edit orphans the old memorable-URL (`serviceShares`) document, and auto-refresh now triggers this more readily

**File:** `src/stores/services.ts:511`, `639-673`

**Issue:** `writeSharePayload` keys the memorable-URL document as
`` `${slug}__service-${service.date}` ``, computed from the **current** `service.date` at write time.
If a shared service's date is edited after its first share, the next write (whether an explicit
re-share or, as of this phase, *any* auto-triggered refresh via `maybeRefreshShareLink` on
`updateService`/`setRoleOverride`/`clearRoleOverride`) creates a **new** document at the new
date-keyed id and leaves the **old** one frozen with stale content at its old public URL — with no
revocation path. This pattern predates this phase (`quarters.ts::finalizeAndShare` shares it), but
before this phase it could only be produced by an explicit second "Share" button press after a date
change; now any ordinary edit after a date change reaches the same outcome silently, since refresh
is hooked into the normal edit path.

**Fix:** key the memorable-URL document by a stable identifier (e.g. `service.id` or the
`serviceShareLinks` doc's token) instead of the mutable `service.date`, or explicitly delete/mark
the previous date-keyed document when a date change is detected during refresh.

### WR-05: `shareTokens`' `create` rule has zero test coverage in `src/rules.test.ts`

**File:** `src/rules.test.ts:590-707`

**Issue:** The `describe` block at line 590 is titled `'shareTokens — public read, signed-in create,
editor-scoped in-place update, editor-scoped delete'`, but contains no test that exercises `create`
at all — only `read`, `delete`, and the R077 `update` cases. This is precisely the gap that let CR-01
ship undetected: every sibling collection this phase touches (`serviceShareLinks`, `quarterShares`,
`serviceShares`) has explicit create-authorization tests (member-of-different-org denied,
no-membership denied, unauthenticated denied); `shareTokens` has none.

**Fix:** add the missing create cases, mirroring the `serviceShareLinks` create block
(`rules.test.ts:750-800`) — at minimum: signed-in editor of the target org succeeds, signed-in user
with no membership in the target org is denied, member of a different org is denied, unauthenticated
is denied. These tests should fail against the current rule (until CR-01 is fixed) and pass after.

### WR-06: No rules test asserts a viewer (non-editor) of the *owning* org is denied read on an existing `serviceShareLinks` doc

**File:** `src/rules.test.ts:709-748`

**Issue:** The `serviceShareLinks` read block tests an org editor (ALLOW), an unauthenticated caller
(DENY), and an editor of a *different* org (DENY) — but not a viewer-role member of the *same* org
reading an *existing* doc. `isOrgEditor` does gate viewers out, and the create/delete blocks for this
same collection do test the viewer case explicitly (`T-41-08` at lines 777 and, implicitly, delete),
so this read case is the one gap in an otherwise-thorough set, on the specific rule this phase
singles out as security-sensitive (the null-`resource` clause).

**Fix:** add `'DENY — a viewer-role member of the owning org cannot read an existing
serviceShareLinks doc'`, seeding a viewer membership and asserting `assertFails(getDoc(...))`.

## Info

### IN-01: `serviceShareLinks` create/update do not verify the `serviceId` field matches the document's own path key

**File:** `firestore.rules:256-259`

**Issue:** `allow create: if isOrgEditor(request.resource.data.orgId);` and the corresponding
`update` rule never check that `request.resource.data.serviceId` equals the wildcard `{serviceId}`
segment of the document path. An org editor could in principle write a `serviceShareLinks/{X}` doc
whose `serviceId` field says `Y`. Nothing in the current app reads this field for a lookup (the store
always addresses these docs directly by `service.id` as the path, never queries by the field), so
this is not currently exploitable, and it matches the general convention elsewhere in this rules file
(e.g. `shareTokens.serviceId` is similarly unverified against anything). Worth a comment or a
`request.resource.data.serviceId == serviceId` guard if this field is ever relied upon for a query in
the future.

---

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
