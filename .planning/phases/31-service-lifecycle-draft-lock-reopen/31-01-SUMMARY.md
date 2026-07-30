# Plan 31-01 Summary — Rules foundation: catch-all bypass + the /services draft lock

**Completed:** 2026-07-30
**Requirements:** R036 (rules layer)

## What shipped

| Task | Change |
|---|---|
| 1 | `firestore.rules` catch-all at `:71-73` split into `allow read` / `allow write`, with `&& collection != 'services'` on the write clause |
| 2 | `/services` block replaced: `create`/`update`/`delete` split out, `update` gated on the STORED status with two carve-outs |
| 3 | 16 emulator-backed tests in `src/rules.test.ts` |

## The bypass this closes

`firestore.rules:71-73`'s `match /{collection}/{docId}` also matches
`/organizations/{orgId}/services/{docId}`, and Firestore rules are OR-evaluated — a broader
rule that grants access beats a narrower one that denies. Research proved by execution that
a `/services` block reading literally `allow write: if false` **still permitted an editor's
write**, rescued by that wildcard 20 lines away.

So before this plan, the entire three-layer lock design was decorative: the UI gate and the
store guard would both have been bypassable from a browser console. The regression test
`catch-all wildcard no longer backstops /services` pins it.

## Two expressions that look wrong and are not

1. **`keys().hasAll(['pcExportedAt'])` — NOT `hasAll(['pcExportedAt','pcPlanId'])`.**
   `affectedKeys()` reports only keys whose VALUE changed. A re-export to the same Planning
   Center plan rewrites an identical `pcPlanId`, which never appears in the diff — so
   requiring it denies the legitimate re-export that D-11 preserves `pcPlanId` to enable.
   Covered by `re-export to the SAME pcPlanId is allowed (D-11)`.
2. **`allow delete` carries no status condition** (D-15). Deliberate: delete stays available
   at any status and the UI warns instead.

## The Roles tab is covered for free

The Roles tab writes `roleAssignmentOverrides.{roleId}` through a scoped dot-path update.
That surfaces in `affectedKeys()` as the TOP-LEVEL key `roleAssignmentOverrides`, which
appears in neither carve-out's `hasOnly` list — so it is denied on a locked service with no
Roles-specific rule. Asserted in both directions (denied on planned, allowed on draft).

## Verification

`npx vitest run --config vitest.rules.config.ts` — **`src/rules.test.ts`: 83 passed, 0
failed.** All 16 new draft-lock tests green, covering ordinary editing at each status, the
legacy no-status document, reopen including the smuggling rejection, both export cases,
create/delete, the Roles dot-path pair, viewers, and the wildcard regression.

The 2 failures in the run are both in `src/storage.rules.test.ts` — the documented
pre-existing baseline, unrelated to this plan.

`npx vue-tsc --noEmit -p tsconfig.app.json` clean. `npx eslint src/rules.test.ts` reports
one error, `'expect' is defined but never used` at `:1` — pre-existing, present at HEAD
before this change.

**★ `npm run test:rules` could not be used as-written:** it runs `firebase emulators:exec`,
which failed with `Port 8080 is not open... Could not start Firestore Emulator, port taken`
because the owner has an emulator already running. The tests were therefore run directly
against that emulator with `npx vitest run --config vitest.rules.config.ts`. This is
equivalent coverage — same rules file, same emulator, same assertions — and is
non-destructive to the owner's data: the harness scopes to projectId `test-project` while
the app's project is `worship-planner-bc515`, so both the rules install and the per-test
`clearFirestore()` touch only `test-project`.

## Deviations from the plan

- **Committed as one commit rather than three.** The plan asked for atomic per-task commits.
  A prior executor completed Task 1 in the working tree and then stalled for ~11 hours
  without committing; that work was preserved and Tasks 2-3 were completed on top of it, so
  splitting retroactively would have been artificial. All three tasks are in one commit.
- Task 1's rule comment was written by that prior executor and is kept as-is — it is
  accurate and unusually clear about why the exclusion is load-bearing.

## Not in this plan

The `/slideGroups` rule and its catch-all exclusion. Wave 2 owns both, in one commit — the
exclusion cannot land without the block that replaces it, or every slide-group write is
denied including load-time materialization on DRAFT services.

## Note for the phase gate

The rules are verified in the **emulator only**. `src/firebase.ts` has no emulator wiring,
so `npm run dev` talks to live Firebase, and the owner deferred deployment
(`firebase deploy --only firestore:rules`) to a later date. Until that runs, the rules layer
is not active in the running app. Recorded as ROADMAP backlog Phase 999.3, required before
v1.4 ships.
