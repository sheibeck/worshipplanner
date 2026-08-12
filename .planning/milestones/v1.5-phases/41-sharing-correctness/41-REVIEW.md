---
phase: 41-sharing-correctness
reviewed: 2026-08-07T04:35:00Z
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
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-08-07
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This is iteration 2, re-reviewing after a fixer pass (`b2a2e5c`, `808f181`, `0a26bf0`, `566e4d8`,
`e6891cd`, `80f9a96`) that claimed to resolve CR-01 and WR-01/02/03/05/06 from the prior review, and
to deliberately skip WR-04. Each claimed fix was independently re-derived from the current source and
verified against the actual code and tests, not taken on the fixer's report alone.

**CR-01 (was Critical) — confirmed genuinely closed, and confirmed it does not break any legitimate
flow.** `firestore.rules:231` now reads `allow create: if isOrgEditor(request.resource.data.orgId);`
for `shareTokens`, matching the idiom already used by `serviceShareLinks`/`quarterShares`/
`serviceShares`. Traced every legitimate create path: `writeSharePayload`'s `setDoc(doc(db,
'shareTokens', token), ...)` (`src/stores/services.ts:496`) is reachable only through
`ensureShareLink`/`maybeRefreshShareLink`, both of which are called only from editor-gated UI actions
(`createShareToken`, `updateService`, `setRoleOverride`, `clearRoleOverride`), and the write always
carries the caller's real `orgId` (`orgIdValue`/`orgId.value`, never attacker input) — so the tightened
rule cannot break a sanctioned share. Confirmed the adoption logic in `pickAdoptableToken` (org-filter
before sort) means an attacker who is only editor of their *own* org can never plant a document that
gets adopted for a *different* org's service, because the filter requires `candidate.orgId === orgId`
of the actual target org, and the create rule now requires the creator to actually be an editor of
whatever `orgId` they write. Four new rules-suite create-authorization tests
(`src/rules.test.ts:606-667`) exercise ALLOW (genuine editor), and DENY for a different-org editor,
a no-membership user, a same-org viewer, and unauthenticated — all against the live rule, not a stub.
This also resolves WR-05, whose gap (zero create coverage) is exactly what these four tests fill; the
`describe` block title was correctly updated to "editor-scoped create" to match.

**WR-01 — confirmed genuinely non-vacuous now.** Tests 5 and 7 in
`src/utils/__tests__/shareTokens.test.ts` now supply `[tok-a, tok-b]` (alphabetical order, which is
also what a no-op/absent tiebreak's stable sort would preserve unchanged) and assert the result is
`'tok-b'`. Reasoning it through independently: with the real tiebreak
(`b.id.localeCompare(a.id)`) removed and replaced by `return 0`, a stable sort leaves `[tok-a, tok-b]`
untouched, so `sorted[0].id` would be `'tok-a'` — the assertion `toBe('tok-b')` would fail. The fixer's
report additionally claims they mechanically verified this by temporarily zeroing the comparator,
confirming both tests failed, and restoring it with an empty `git diff`; the current diff and test
content are consistent with that having been done correctly.

**WR-02 — confirmed the classification logic and confirmed it cannot misclassify in a way that
regresses.** `maybeRefreshShareLink`'s catch (`src/stores/services.ts:685-710`) now reads
`(err as { code?: string } | undefined)?.code` and only treats `code === 'permission-denied'` as
permanent, mirroring the identical pattern already established in `src/utils/slug.ts:58`. Any other
error (including a plain code-less `Error`, the transient-network stand-in) leaves the cache untouched
so the next edit retries. Two new tests (`services.test.ts:1421`, `:1454`) exercise both branches by
inspecting whether a *second* `updateService` call reaches `setDoc`/`getDoc` — a behavioral assertion,
not a call-count-only one. Ran the full `services.test.ts` suite (81 tests) and it passes.

**WR-03 — confirmed the cache is cleared on both `unsubscribeAll()` and `deleteService()`
(`services.ts:211`, `:355`), and confirmed by tracing that this is the complete set of state-resetting
entry points** — `unsubscribeAll()` is the only path that changes `orgId.value` (org switch always
tears down the old subscription first, per `subscribe()`'s `if (unsubscribeFn) unsubscribeFn()` call
before re-assigning `orgId.value`), so there is no route to a live `orgId` change that bypasses the
clear. Two new behavioral tests prove a same-id refresh after each event re-reads via `getDoc` instead
of reusing the stale cached token.

**WR-06 — confirmed added** (`src/rules.test.ts:825-831`): a viewer-role member of the owning org is
asserted to get `assertFails(getDoc(...))` on an existing `serviceShareLinks` doc, filling the one gap
in that collection's otherwise-thorough role-matrix coverage.

**WR-04 (skipped) — the skip rationale is sound and is carried forward as a known limitation, not
re-raised as new.** The two remedies the original review proposed are, as the fix report argues,
materially larger than an atomic fix: keying `serviceShares` docs by anything other than
`${slug}__service-${date}` would 404 every already-published memorable link (`ShareView.vue`
reconstructs that exact id from the route params), and tracking-and-deleting the previous date-keyed
doc requires a new persisted field plus migration handling for every service shared before the field
existed. Both are genuine schema/migration decisions, not a rules or store one-liner. Verified this
finding is still present and unchanged in the current code — `writeSharePayload`
(`services.ts:522`) still keys on the live `service.date`, and `maybeRefreshShareLink` still triggers
that write on ordinary edits — so it remains open at its original Warning severity, tracked as a
follow-up rather than fixed here.

No new bugs were introduced by the fix commits: all six diffs are scoped tightly to their claimed
finding (confirmed via `git show --stat` on each commit), `npm run type-check` (`vue-tsc --build`,
per this project's typechecking convention) is clean, and the full `services.test.ts` (81 tests) and
`shareTokens.test.ts` (20 tests) suites pass.

The only items still open are the two carried forward from the prior review at unchanged severity:
WR-04 (deliberately skipped, rationale accepted) and IN-01 (out of scope for the fix pass). No new
findings were surfaced by this re-review.

## Warnings

### WR-04 (carried forward, unchanged severity): a post-share date edit still orphans the old memorable-URL (`serviceShares`) document

**File:** `src/stores/services.ts:511-528` (key construction), `:650-711` (auto-refresh trigger)
**Issue:** `writeSharePayload` still keys the memorable-URL document as
`` `${slug}__service-${service.date}` ``, computed from the *current* `service.date` at write time. If
a shared service's date is edited after its first share, the next write — whether an explicit re-share
or any auto-triggered refresh via `maybeRefreshShareLink` on `updateService`/`setRoleOverride`/
`clearRoleOverride` — creates a *new* document at the new date-keyed id and leaves the *old* one frozen
with stale content at its old public URL, with no revocation path. This is unchanged from the prior
review; the fixer deliberately skipped it (see Summary above) with a rationale this review agrees is
sound for an atomic fix pass. Recorded here so it is not lost, not because it is a new defect.
**Fix:** deferred — needs a dedicated plan that either keys the doc by a stable identifier with a
migration path for already-shared services, or persists the previously-written date so a refresh can
explicitly clean it up. Do not attempt either mechanically inside a review-fix pass.

## Info

### IN-01 (carried forward, unaddressed): `serviceShareLinks` create/update do not verify the `serviceId` field matches the document's own path key

**File:** `firestore.rules:267-270`
**Issue:** Unchanged from the prior review. `allow create: if isOrgEditor(request.resource.data.orgId);`
and the corresponding `update` rule never check that `request.resource.data.serviceId` equals the
wildcard `{serviceId}` segment of the document path. Not currently exploitable (nothing in the app
queries by this field; the store always addresses these docs directly by `service.id` as the path), and
matches the general convention elsewhere in this rules file (`shareTokens.serviceId` is similarly
unverified). This was explicitly out of scope for the fix pass (`fix_scope: critical_warning`
excludes Info items) and remains open.
**Fix:** add `&& request.resource.data.serviceId == serviceId` to both the `create` and `update`
clauses if this field is ever relied upon for a query in the future; not urgent today.

---

_Reviewed: 2026-08-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
