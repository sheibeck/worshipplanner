---
phase: 77-church-deletion-cascade-cleanup
reviewed: 2026-08-23T03:30:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - functions/src/orgDeletion.ts
  - functions/src/orgDeletion.test.ts
  - functions/src/orgProvisioning.ts
  - functions/src/index.ts
  - firestore.rules
  - src/rules.test.ts
  - src/components/admin/DeleteOrgConfirmDialog.vue
  - src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: fixed
fixed_at: 2026-08-23T03:45:00Z
---

# Phase 77: Code Review Report

**Reviewed:** 2026-08-23T03:30:00Z
**Depth:** deep
**Files Reviewed:** 10 (8 source + 2 dedicated test files enumerated separately above)
**Status:** issues_found

## Summary

Reviewed both plans of Phase 77 (server cascade + rules DENY, client confirm dialog) with
maximum rigor given this is the milestone's only permanently-destructive, cross-tenant-cleanup
operation. The cascade design itself is sound and I could not find a data-orphaning or
cross-tenant-leak defect in the happy path: the READ phase (members, inviteLookup, the `orgNames`
guard, the 5 extra `orgId`-keyed collections) is fully awaited before any write; member unlinking
uses `arrayRemove` (never an overwrite, verified against `orgProvisioning.ts`'s established
`arrayUnion` idiom); the `orgNames` doc is only deleted when its own `orgId` field still points at
the target org (correctly guards against a stale reverse-pointer from a rename/collision);
`shareTokens`/`serviceShareLinks`/`orgSlugs`/`quarterShares`/`serviceShares` are queried by
`orgId` and cross-checked against `firestore.rules` to confirm the field name is correct; writes
are chunked to the 500-op batch cap; Storage is swept by `orgs/{orgId}/` prefix; `recursiveDelete`
runs last. All three destructive-path guards (`assertSuperAdminCaller` first, `active !== false`
refusal, strict `confirmName === orgName`) are present, ordered correctly, and independently
re-verified server-side (never trusting the client). The `firestore.rules` DENY is unconditional
with no super-admin client-SDK exemption, exactly as the research doc mandates, and both new
emulator tests plus the two pre-existing seed-order fixes pass (full 203/203 rules suite verified
live against the running emulator). All 22 `orgDeletion.test.ts` unit tests and all 51
component/dialog tests pass.

However, I found one build-breaking defect that must block shipping this phase, and two
robustness gaps worth fixing before this destructive path sees production traffic.

## Critical Issues

### CR-01: `functions/src/orgDeletion.test.ts` fails `npm run build` — the whole functions codebase cannot compile

**File:** `functions/src/orgDeletion.test.ts:484`
**Issue:** `functions/tsconfig.json` sets `noUnusedLocals: true` and `include: ["src"]` (test files
included), and `functions/package.json`'s `build` script is a bare `tsc`. In the "Storage cleanup"
test, `const fake = setup({ active: false });` is assigned but never read — the test only uses
`getFilesSpy`/`deleteFilesSpy`/`result` afterward. This trips `TS6133` and `tsc` exits non-zero:

```
$ cd functions && npm run build
src/orgDeletion.test.ts(484,11): error TS6133: 'fake' is declared but its value is never read.
```

`functions/package.json`'s `main` is `lib/index.js` — the Firebase CLI's TypeScript functions
deploy path runs this same `build` script to produce that output before deploying. A failing build
means **the entire functions codebase (every callable, every trigger, every scheduled job) cannot
be compiled or deployed**, not just `deleteOrganization` — this is the single most consequential
defect in the diff, and it is invisible to `npx vitest run` (which doesn't type-check) and to the
root `npm run type-check` (which only covers `src/`, not the separate `functions/` TS project) —
exactly the kind of gap CLAUDE.md's "use `npm run type-check`, not `-p tsconfig.app.json`" note
warns about, just one level up: there is no gate in this repo that runs `functions`' own `tsc`
build automatically.
**Fix:**
```diff
-    const fake = setup({ active: false });
+    setup({ active: false });
     const { getFilesSpy, deleteFilesSpy } = mockBucket([
```

## Warnings

### WR-01: No `timeoutSeconds`/`memory` override on `deleteOrganization` — a large org's cascade can exceed the default 60s callable timeout, and a mid-`recursiveDelete` abort is not cleanly resumable

**File:** `functions/src/orgDeletion.ts:211`
**Issue:** `export const deleteOrganization = onCall(deleteOrganizationHandler);` takes no options
object. Every other heavy handler in this codebase that does non-trivial work sets an explicit
budget — e.g. `functions/src/index.ts:780-783`'s `parsePptx` sets
`{ memory: "1GiB", timeoutSeconds: 120 }`. `deleteOrganizationHandler` is comparably or more
expensive for a long-lived org: it does 5 concurrent `where` queries plus a `members` read, N
sequentially-awaited batch commits, a full `bucket.getFiles({prefix})` + `bucket.deleteFiles(...)`
sweep over every object ever uploaded under `orgs/{orgId}/`, and finally a `recursiveDelete` over
every subcollection at every depth (services, songs, slides, quarters, assignments, `pptxRenders`,
etc.) — precisely the orgs most likely to be deleted (long-established, heavily used, now
deactivated) are the ones most likely to have accumulated enough data to approach or exceed the
Cloud Functions v2 default 60s callable timeout. R221's idempotency design correctly handles a
retry against a state where the WRITE-phase batches committed but `recursiveDelete` never started
(covered by `orgDeletion.test.ts`'s "idempotent retry" tests, and it is safe because the org doc
still exists in that state) — but it does **not** address a timeout that fires **during**
`recursiveDelete` itself. If that leaves the org doc deleted while some descendant subcollection
documents remain (Admin SDK's `recursiveDelete` streams a collection-group query and does not
document a strict "delete the reference doc absolutely last" ordering guarantee), a retry's very
first step — `orgRef.get()` → `not-found` → throw — permanently forecloses any further cleanup of
those orphaned descendants, since the handler has no code path to resume a cascade once the parent
doc is gone.
**Fix:** Add an explicit budget matching the operation's cost, e.g.
`onCall({ timeoutSeconds: 300, memory: "512MiB" }, deleteOrganizationHandler)`, and/or split the
`recursiveDelete` step so a timeout is measurably less likely to land mid-sweep for pathological
orgs.

### WR-02: `confirmName` comparison trims the typed input but never the stored `name` — an org name with leading/trailing whitespace can become permanently non-deletable through the UI

**File:** `src/components/admin/DeleteOrgConfirmDialog.vue:143`, `functions/src/orgDeletion.ts:125-128`
**Issue:** The dialog's gate is
`computed(() => props.confirming || typedName.value.trim() !== props.orgName)`, and the server's
gate is `if (confirmName !== orgName)` where `orgName = orgData?.name ?? ""` (also untrimmed). Both
sides trim only the *user's typed* value, never the *stored* `name`. `onboardOrganizationHandler`
(`functions/src/orgProvisioning.ts:254-292`) validates only `name.trim() === ""` and then stores
the raw, untrimmed `name` verbatim (`tx.set(orgRef, { name, ... })`) — it never normalizes the
value it persists. In the intended UI path this is masked because
`OrganizationsTab.vue`'s `onOnboard` already calls `churchName.value.trim()` before sending, so an
org created through this component's own onboarding form can never have surrounding whitespace.
But nothing enforces that at the data layer: a name with a stray leading/trailing space introduced
by any other write path (a future admin script, a direct Admin-SDK call, a different onboarding UI)
would produce an org whose `name` can **never** be typed to an exact match, because the dialog's
`.trim()` on user input makes it structurally impossible to reproduce trailing/leading whitespace
by typing — permanently disabling the only sanctioned deletion path for that org (a super-admin
would have to bypass the UI and call the callable directly with a hand-crafted untrimmed string).
**Fix:** Either trim `name` at write time in `onboardOrganizationHandler` (closing the root cause),
or compare `confirmName.trim() !== orgName.trim()` server-side (and mirror the same trim on
`orgName` client-side) so a legacy/foreign untrimmed name doesn't strand the org.

## Info

### IN-01: `bucket.getFiles({ prefix })` omits the explicit `autoPaginate: true` used elsewhere in this file for the same call shape

**File:** `functions/src/orgDeletion.ts:191`
**Issue:** `cleanupExpiredMediaHandler` (`functions/src/index.ts:1076-1079`) calls
`bucket.getFiles({ prefix: "orgs/", autoPaginate: true })` explicitly. `orgDeletion.ts`'s
`bucket.getFiles({ prefix })` relies on the client library's own default (which is `true` when no
callback is supplied), so behavior is equivalent, but the inconsistency reads as an oversight
rather than a deliberate choice for a handler this security/completeness-sensitive — a single org
with more Storage objects than one page's worth of results is exactly the scenario this cascade
must not miss.
**Fix:** Add `autoPaginate: true` explicitly to `bucket.getFiles({ prefix })` for consistency with
the sibling handler and to make the completeness guarantee self-documenting rather than implicit.

---

## Resolution (2026-08-23T03:45:00Z)

All in-scope findings addressed.

- **CR-01 — fixed.** Removed the unused `const fake = setup(...)` binding in the Storage-cleanup test
  (`orgDeletion.test.ts`) that tripped `noUnusedLocals`/`TS6133` and broke `cd functions && npm run
  build`. Verified `tsc` now exits 0; scanned the rest of `orgDeletion.test.ts` and every other
  functions/src file this phase touched (`orgDeletion.ts`, `orgProvisioning.ts`, `index.ts`) — no other
  unused locals/imports found. Commit `8dfe1e40`.
- **WR-01 — fixed.** `deleteOrganization`'s `onCall` wrapper now sets `{ timeoutSeconds: 540, memory:
  "512MiB" }` (540s is the v2 callable maximum). Added a code comment documenting the resumability
  boundary: the cross-ref batch deletes and Storage sweep are each idempotent and safely retryable while
  the org doc still exists, but a timeout mid-`recursiveDelete` after the org doc is already gone has no
  resume path — out of scope per the review brief, mitigated by the generous budget rather than solved
  structurally. Commit `ffee9474`.
- **WR-02 — fixed.** The server-side `confirmName` compare now trims both sides
  (`confirmName.trim() !== orgName.trim()`), case-sensitive as before, closing the path where an org
  written with stray whitespace in `name` (e.g. by a future admin script or direct Admin-SDK call) could
  never be typed back exactly through the UI's own trimming dialog. Added two unit tests: a padded
  stored name accepted after trimming, and case-sensitivity still enforced post-trim (24/24
  `orgDeletion.test.ts` tests pass). Commit `2676b2c7`.
- **IN-01 — accepted, no fix.** `bucket.getFiles({ prefix })` omitting explicit `autoPaginate: true` is
  behaviorally equivalent to the sibling handler (client library default is `true`); cosmetic
  consistency nit, not a defect. Left as-is per the review brief.

**Gate results:**
- `cd functions && npm run build` (`tsc`) — **exit 0** (was failing before CR-01; this is the gate that
  caught it).
- `cd functions && npx vitest run` — 544/544 passed (15 test files), incl. 24/24 in `orgDeletion.test.ts`
  (22 pre-existing + 2 new WR-02 whitespace tests).
- `npm run type-check` (root, `vue-tsc --build`) — clean.
- `npx vitest run --config vitest.rules.config.ts` against the running emulator — 202/203 passed. The 1
  failure (`storage.rules.test.ts` › "proves membership on the claim ALONE, with no Firestore fallback
  re-introduced") is **pre-existing and unrelated to this phase's fixes** — verified by reproducing the
  identical failure against the pre-fix commit (`c6e811a3`, before any CR-01/WR-01/WR-02 changes); the
  test's own comment-stripping helper leaks the prose word "firestore.exists(" from a code comment,
  independent of `storage.rules`' actual (correct) claim-only rule body. Matches CLAUDE.md's documented
  known-failing baseline for `src/storage.rules.test.ts`.
- `npx vitest run` (app suite) — at the documented 2-file known-failing baseline
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`); no new failures introduced.

---

_Reviewed: 2026-08-23T03:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fixed: 2026-08-23T03:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
