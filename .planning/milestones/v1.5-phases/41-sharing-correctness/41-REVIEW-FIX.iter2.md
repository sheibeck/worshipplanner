---
phase: 41-sharing-correctness
fixed_at: 2026-08-07T08:22:58Z
review_path: .planning/phases/41-sharing-correctness/41-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 41: Code Review Fix Report

**Fixed at:** 2026-08-07T08:22:58Z
**Source review:** .planning/phases/41-sharing-correctness/41-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 7 — CR-01, WR-01 through WR-06
- Fixed: 6 (CR-01, WR-01, WR-02, WR-03, WR-05, WR-06)
- Skipped: 1 (WR-04)

IN-01 (info) is out of scope for this fix pass (`fix_scope: critical_warning`) and was not touched.

## Fixed Issues

### CR-01: `shareTokens`' create rule had no org-membership check

**Files modified:** `firestore.rules`, `src/rules.test.ts`
**Commit:** `b2a2e5c`
**Applied fix:** Changed `shareTokens`' `allow create` from bare `isSignedIn()` to
`isOrgEditor(request.resource.data.orgId)`, matching the idiom already used by
`serviceShareLinks`/`quarterShares`/`serviceShares`. Verified against `src/stores/services.ts` first
that every legitimate create path (`writeSharePayload`, reached only via `ensureShareLink`/
`maybeRefreshShareLink` from editor-gated UI actions) always writes the caller's real `orgId`, so the
tightened rule does not break any sanctioned flow. Added four new rules-suite create-authorization
cases in the same commit (ALLOW for a genuine org editor; DENY for a different-org editor, a
no-membership user, and an unauthenticated caller) — proven against the real Firestore emulator, all
passing against the fixed rule. This also resolves **WR-05** (see below) since the missing create
coverage it flagged is exactly what these four new tests supply.

A follow-up commit (`80f9a96`) updates `.planning/PENDING-VERIFICATION.md`'s Phase 41 deploy handoff
to record that this `shareTokens` create-rule tightening must ship in the same pending
`firestore.rules` deploy as the rest of the phase — per the hard constraint that any rules change
materially affecting the owner's deploy must be reflected in that handoff note.

### WR-01: `pickAdoptableToken`'s createdAt-tie tests were vacuous

**Files modified:** `src/utils/__tests__/shareTokens.test.ts`
**Commit:** `0a26bf0`
**Applied fix:** Flipped the candidate array order in tests 5 and 7 from `[tok-b, tok-a]` to
`[tok-a, tok-b]`, so the array's natural (pre-sort) order now *matches* alphabetical order — the same
order a stable sort with no tiebreak would already produce. Only the real tiebreak
(`b.id.localeCompare(a.id)`) now reorders the result to `'tok-b'`; a no-op comparator would leave
`'tok-a'` first and fail the assertion. **Verified per the finding-specific guidance**: temporarily
replaced the tiebreak in `src/utils/shareTokens.ts` with a no-op (`return 0`), re-ran the two tests,
confirmed both failed with `expected 'tok-a' to be 'tok-b'`, then restored the original comparator and
confirmed `git diff` on that file was empty and all 20 tests passed again.

### WR-02: A single write failure permanently disabled share-refresh for a service for the session

**Files modified:** `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `566e4d8`
**Applied fix:** `maybeRefreshShareLink`'s catch block now inspects the caught error's `.code`
(mirroring the existing `permission-denied` pattern already used in `src/utils/slug.ts`). Only a
genuine `permission-denied` still caches `false` permanently for the session (the original, deliberate
rationale — avoid flooding the console with retries before the owner deploys the rules). Any other
error (including a plain, code-less `Error`, standing in for a transient network blip) leaves the
cache untouched, so the next edit gets a fresh retry instead of being silently skipped forever. Added
two new tests: one proving a transient (code-less) failure does NOT poison the cache (a second edit
still reaches `setDoc`), and one proving a `permission-denied` failure DOES still short-circuit a
second attempt (neither `getDoc` nor `setDoc` called again) — preserving the original console-flood
guard.

Did not implement the finding's other suggested half (a visible UI warning banner) — the codebase's
established convention for this exact class of soft-fail (see `writeSharePayload`'s memorable-URL
catch, same file) is console-only, and the finding's fix was phrased as "and/or", so the
cache-distinction half alone addresses the concrete regression risk (permanent silent drift) the
finding raises.

### WR-03: `shareLinkCache` was never invalidated on org switch or service deletion

**Files modified:** `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `e6891cd`
**Applied fix:** `unsubscribeAll()` now calls `shareLinkCache.clear()` alongside its other
subscription-scoped resets; `deleteService()` now calls `shareLinkCache.delete(id)` after the
Firestore delete succeeds. Since `shareLinkCache` is private closure state, added two behavioral
tests (not direct Map inspection): one that populates the cache with a token, calls
`unsubscribeAll()`, re-subscribes to a different org, and proves a same-id refresh re-reads via
`getDoc` and writes the NEW token rather than reusing the stale one; and the equivalent for
`deleteService()`.

### WR-05: `shareTokens`' `create` rule had zero test coverage

**Files modified:** `src/rules.test.ts` (same commit as CR-01)
**Commit:** `b2a2e5c`
**Applied fix:** Resolved as a side effect of CR-01's fix, per the finding-specific guidance — the
four new create-authorization tests added for CR-01 are exactly the missing coverage WR-05 flagged.
The describe block's title was also updated from "signed-in create" to "editor-scoped create" so the
title now agrees with both the rule and the tests underneath it.

### WR-06: No rules test asserted a viewer of the owning org is denied read on `serviceShareLinks`

**Files modified:** `src/rules.test.ts`
**Commit:** `808f181`
**Applied fix:** Added `'DENY (WR-06) — a viewer-role member of the owning org cannot read an existing
serviceShareLinks doc'`, seeding a viewer membership and asserting `assertFails(getDoc(...))`, mirroring
the existing create/delete viewer-denial tests for the same collection. Committed separately from
CR-01/WR-05 since it touches a different rule block and is an independent finding.

## Skipped Issues

### WR-04: Post-share date edit orphans the old memorable-URL (`serviceShares`) document

**File:** `src/stores/services.ts:511, 639-673`
**Reason:** Both fixes the review proposes are materially larger than an atomic review-fix change,
and neither is safe to apply mechanically:

1. **"Key the memorable-URL document by a stable identifier instead of the mutable `service.date`"**
   would break the existing public URL scheme outright. `ShareView.vue:161-162` reconstructs the
   Firestore document id directly from the route's `:slug`/`:date` params
   (`` `${slug}__service-${date}` ``) — the date IS part of the public URL by design, not an
   implementation detail. Changing the key would 404 every already-shared memorable link the moment
   it shipped, with no migration path for links already handed to a congregation.
2. **"Explicitly delete/mark the previous date-keyed document when a date change is detected during
   refresh"** requires persisting the previously-written date somewhere durable enough to survive a
   page reload (the in-memory `shareLinkCache` only lasts one session) — which means adding a new
   field to the `serviceShareLinks/{serviceId}` doc, threading it through both `ensureShareLink`'s
   and `maybeRefreshShareLink`'s read paths (the latter currently has a cache fast-path specifically
   to avoid re-reading that doc on every edit), and defining safe behavior for every already-shared
   service that predates the new field (must not attempt a delete against an unknown "previous" date).
   This is a real, multi-file schema and data-flow change, not a targeted patch.

Per the finding's own framing (it predates this phase and is explicitly called a pre-existing,
non-regression risk pattern that this phase makes "more easily triggered," not one it introduces),
and per this agent's mandate to skip rather than force a fix it does not believe is safe to apply
mechanically: recommend a dedicated follow-up phase/plan that (a) decides the schema addition
deliberately and (b) covers the pre-Phase-40.1-style migration path for services already shared before
the fix lands. No source files were touched for this finding.

---

_Fixed: 2026-08-07T08:22:58Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
