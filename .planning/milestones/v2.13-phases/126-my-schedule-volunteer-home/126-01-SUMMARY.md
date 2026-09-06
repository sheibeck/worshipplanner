---
phase: 126-my-schedule-volunteer-home
plan: 01
subsystem: auth
tags: [firestore, security-rules, collection-group-query, projection, rehearse-access]

# Dependency graph
requires:
  - phase: 125-02
    provides: "rehearseAccess Firestore collection contract + buildRehearseAccess() pure projection builder"
provides:
  - "Explicit rehearseAccess allow get/list split on the nested organizations/{orgId}/rehearseAccess/{serviceId} match (get arm unchanged, R377)"
  - "A NEW collection-group match (match /{orgPrefix=**}/rehearseAccess/{serviceId}) granting the constrained cross-org list capability My Schedule requires"
  - "rehearseAccess COLLECTION_GROUP composite index (status ASC + assignedEmailsLower CONTAINS + serviceDate ASC)"
  - "The first constrained collectionGroup('rehearseAccess') list emulator tests (R378), including the R379 draft-exclusion case"
  - "rolesByEmailLower on RehearseAccessDoc (R381) — per-email role names, PII-safe"
affects: ["126-02", "126-03", "126-04", "Phase 127 (Rehearse UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collection-group list rules require a SEPARATE match using the {path=**} recursive wildcard — a nested (or top-level fixed-depth) match's get/list guarantee does NOT extend to a collectionGroup() query, even with an identical condition"
    - "A {path=**} collection-group list rule cannot dynamically derive the candidate document's own id or ancestor path segments for a cross-document get()/exists() call — only resource.data fields covered by the query's own equality/array-contains filter are reliably resolvable; a fully-static (zero-interpolation) exists() call works fine in the same match, proving cross-document reads are supported in principle, just not with a dynamically-constructed path"
    - "Where a live cross-document re-check is unachievable for a collection-group list, fall back to a query-filtered check on the projection's own frozen field, backed by a reliable primary write-side invariant (here: markAsPlanned is the sole writer and always writes status:'planned'; reopenService deletes the projection on every reopen)"

key-files:
  created: []
  modified:
    - firestore.rules
    - firestore.indexes.json
    - src/rules.test.ts
    - src/utils/rehearseAccess.ts
    - src/utils/rehearseAccess.test.ts

key-decisions:
  - "The collection-group list arm for rehearseAccess is deliberately volunteer-only (no isOrgMember(...) disjunct) — an org member/editor already has full org-scoped access via the nested get/list arms and has no legitimate reason to run a cross-org collectionGroup query. Including isOrgMember would call isSuperAdmin() -> request.auth.token.superAdmin during this match's evaluation and throw 'Property superAdmin is undefined on object', denying the whole list (empirically confirmed)."
  - "The collection-group list arm checks resource.data.get('status','draft') == 'planned' (query-filtered via where('status','==','planned')) instead of a live parentIsPlanned() cross-document re-check. This is a narrower guarantee than the nested get arm keeps (unchanged, still live). It is provable ONLY because every call site is now REQUIRED to add where('status','==','planned') to its collectionGroup query, in addition to the existing where('assignedEmailsLower','array-contains', ownEmail) requirement — Plan 03's mySchedule store MUST add both filters or the query will be denied outright (matches the existing assignedEmailsLower requirement's key_link pattern)."
  - "rolesByEmailLower is built by iterating resolveServiceRoleAssignments()'s output directly (not the flattened assignedPersonIds set) so each role name is attributed to the correct person; deduped per email via .includes(), matching functions/src/serviceRoles.ts's roleNamesByPerson precedent exactly."

patterns-established:
  - "Any future collection-group query against a nested subcollection needs its OWN {path=**}-based match block — do not assume an existing nested get/list arm covers it, even with an identical security condition."
  - "When a collection-group list rule needs to gate on a cross-document live status and the id/ancestor derivation proves unachievable, gate on the projection's own frozen field via a REQUIRED query filter, and document the reduced guarantee's reliance on the write-side invariant that keeps that field trustworthy."

requirements-completed: [R378, R379, R381]

coverage:
  - id: D1
    description: "A constrained collectionGroup('rehearseAccess') list, filtered by where('status','==','planned') + where('assignedEmailsLower','array-contains', ownLowercasedVerifiedEmail), ALLOWS exactly the volunteer's assigned Planned services across two different orgs (cross-org aggregation proven); the same query for an unassigned email returns an empty snapshot via assertSucceeds, not a permission error"
    requirement: "R378"
    verification:
      - kind: integration
        ref: "src/rules.test.ts — describe('My Schedule — constrained collectionGroup list (R378)') cases (1) and (2), npx vitest run --config vitest.rules.config.ts -t R378"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every unsafe list shape is DENIED: an unfiltered collectionGroup list (enumeration guard), a constrained list filtered on a DIFFERENT email than the signed-in token email, the constrained own-email query with email_verified:false, and a constrained list filtered on status=='draft'"
    requirement: "R378"
    verification:
      - kind: integration
        ref: "src/rules.test.ts — R378 describe block cases (3),(4),(5),(6), npx vitest run --config vitest.rules.config.ts -t R378"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Draft service's stale rehearseAccess projection is excluded from the constrained list's results via the status=='planned' query filter (the collection-group list arm's substitute for a live cross-document re-check, documented as a deviation below)"
    requirement: "R379"
    verification:
      - kind: integration
        ref: "src/rules.test.ts — R378 block case (1)'s ids.not.toContain('svcDraft') assertion + case (6)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildRehearseAccess emits rolesByEmailLower: a PII-safe Record mapping each assigned lowercased email to its deduped role-name array (empty-email persons skipped)"
    requirement: "R381"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts — 5 new cases (multi-role dedupe, override/schedule no-duplicate, empty-email skip, lowercase-key, PII-safety), npx vitest run src/utils/rehearseAccess.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The rehearseAccess COLLECTION_GROUP composite index (status ASC + assignedEmailsLower CONTAINS + serviceDate ASC) exists in firestore.indexes.json and must be deployed to production before My Schedule's query works outside the emulator"
    requirement: "R378"
    verification: []
    human_judgment: true
    rationale: "Production index deploy (firebase deploy --only firestore:indexes) is an owner action outside this execution environment's reach — the emulator auto-builds the index from firestore.indexes.json and all R378 tests pass against it, but only the owner can confirm the production index reaches Enabled status in the Firebase Console."

duration: 40min
completed: 2026-09-06
status: complete
---

# Phase 126 Plan 01: rehearseAccess collection-group list foundation + rolesByEmailLower Summary

**Proved a constrained `collectionGroup('rehearseAccess')` list works via a NEW `{path=**}`-based rule (not the nested get/list arms), discovered and worked around a Firestore rules-engine limitation on cross-document reads in collection-group rules, and added `rolesByEmailLower` to the Phase 125 projection.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-06T02:22Z
- **Completed:** 2026-09-06T03:04Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments
- Split `rehearseAccess`'s single `allow read` into explicit `allow get`/`allow list` arms on the existing nested `organizations/{orgId}/rehearseAccess/{serviceId}` match (unchanged condition, all 10 R377 get-by-id/positive-control cases stay green).
- Discovered that this nested split does **not** grant collection-group `list` capability — a `collectionGroup('rehearseAccess')` query is evaluated against the **entire database**, and Firestore requires a rule declared with the `{path=**}` recursive wildcard for the request to be evaluated at all. Without it, the request fell through to the file's `match /{document=**} { allow read, write: if false; }` catch-all and was denied outright, even though the nested rule would have granted a same-org-scoped list.
- Added the required `{path=**}`-based collection-group match, and in the process discovered a second, deeper limitation: this kind of rule **cannot** dynamically derive either the candidate document's own id or its ancestor path segments to construct a cross-document `get()`/`exists()` reference — every attempt (`resource.data.orgId`, `.get('orgId','')`, the wildcard capture indexed directly, a `let` binding, `resource.id`, `$(serviceId)` interpolation) threw one of three distinct errors ("Property X is undefined on object" / "Null value error" / "Variable is not bound in path template"). A fully-static, zero-interpolation `exists()` call in the same match block succeeded, proving cross-document reads are supported here in principle — just not with a dynamically-constructed path. Documented in detail as a deviation below (Rule 4-class finding).
- Given that constraint, the collection-group list arm checks the projection's own frozen `status` field instead of a live cross-document re-check, provable via a `where('status','==','planned')` query filter every call site is now required to add (alongside the existing `assignedEmailsLower` array-contains requirement).
- Added the first constrained-list rules-emulator tests (`describe('My Schedule — constrained collectionGroup list (R378)')`): ALLOW cross-org aggregation with Draft exclusion, ALLOW/empty for an unassigned email, and DENY for unfiltered / other-email-filtered / unverified / draft-status-filtered lists.
- Extended `buildRehearseAccess()` with `rolesByEmailLower: Record<string, string[]>` via TDD (RED commit `871872c9`, GREEN commit `caef13db`), mirroring `functions/src/serviceRoles.ts`'s `roleNamesByPerson` map-building.
- Full verification: `npx vitest run --config vitest.rules.config.ts` (232 tests, all pass; `storage.rules.test.ts` skipped, no Storage emulator running — expected per CLAUDE.md), full `npx vitest run` app suite (5273 passed, 35 skipped, exactly the one documented `storage.rules.test.ts` baseline failure — no regressions), `npm run type-check` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the COLLECTION_GROUP index and the constrained rehearseAccess `list` rule arm** - `31a9e074` (feat)
2. **Task 2: Prove the constrained collectionGroup list — R378/R379 rules-emulator tests (KEY RISK)** - `f3550176` (feat) — includes the discovery and rule-design fix described above (Task 1's initial nested-arm approach was insufficient; this commit adds the working `{path=**}` collection-group match)
3. **Task 3: Extend buildRehearseAccess with rolesByEmailLower** - `871872c9` (test, RED) then `caef13db` (feat, GREEN)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `firestore.rules` - Split `rehearseAccess`'s nested `allow read` into `get`/`list`; added a new `match /{orgPrefix=**}/rehearseAccess/{serviceId}` block granting the constrained collection-group list capability, gated by `email_verified`, `resource.data.status == 'planned'`, and the lowercased-email membership check.
- `firestore.indexes.json` - Added the `rehearseAccess` COLLECTION_GROUP composite index: `status` ASCENDING (equality) + `assignedEmailsLower` CONTAINS + `serviceDate` ASCENDING.
- `src/rules.test.ts` - New `describe('My Schedule — constrained collectionGroup list (R378)')` block, 6 cases; imports `collectionGroup`/`orderBy`.
- `src/utils/rehearseAccess.ts` - `RehearseAccessDoc` gains `rolesByEmailLower`; `buildRehearseAccess` populates it from `resolveServiceRoleAssignments`'s output.
- `src/utils/rehearseAccess.test.ts` - 5 new cases for `rolesByEmailLower`; fixed the pre-existing schema-key assertion to include the new field.

## Decisions Made
- The collection-group list arm is deliberately volunteer-only (no `isOrgMember(...)` disjunct) — see key-decisions in frontmatter for the `isSuperAdmin()` evaluation-order reason.
- The list arm's draft-exclusion mechanism is a `where('status','==','planned')` query filter against the projection's own frozen field, not a live cross-document re-check — see Deviations below for the full reasoning and the residual-risk framing.
- `rolesByEmailLower` iterates `resolveServiceRoleAssignments()`'s output directly per assignment (not the flattened `assignedPersonIds` set), so multi-role dedup happens per-email via `.includes()`, exactly mirroring `functions/src/serviceRoles.ts`'s `roleNamesByPerson`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale schema-key assertion broken by the new `rolesByEmailLower` field**
- **Found during:** Task 3 (GREEN implementation)
- **Issue:** `rehearseAccess.test.ts`'s "returns only the schema fields" test asserted the exact key list without `rolesByEmailLower`.
- **Fix:** Added `'rolesByEmailLower'` to the expected key array.
- **Files modified:** `src/utils/rehearseAccess.test.ts`
- **Verification:** `npx vitest run src/utils/rehearseAccess.test.ts` — 11/11 pass.
- **Committed in:** `caef13db` (Task 3 GREEN commit)

### Architectural Finding (Rule 4-class — auto-resolved with documented residual risk, autonomous plan, no checkpoint pause per plan's `autonomous: true`)

**2. Firestore's list-rule evaluator cannot dynamically derive an ancestor id for a cross-document check inside a `{path=**}` collection-group match**
- **Found during:** Task 2, implementing the constrained-list rule
- **Issue:** The plan's KEY RISK section called for the collection-group list arm to carry the IDENTICAL condition as the nested get/list arms, including the live `parentIsPlanned()` cross-document re-check (R379). Empirically, every attempt to derive `orgId` (needed to construct the sibling `services/{serviceId}` doc path) from either `resource.data` (any non-query-filtered field, with or without `.get(field, default)`), the `{orgPrefix=**}` wildcard capture (direct indexing or a `let` binding), or the document's own id (`resource.id`, `$(serviceId)` path-template interpolation) threw one of: `"Property X is undefined on object"`, `"Null value error"`, or `"Variable is not bound in path template"`. A fully-static (zero-interpolation) `exists()` call in the identical match block succeeded, proving cross-document reads work here in principle — only *dynamic* path construction from this document's own identity is unsupported.
- **Resolution:** The nested get arm (single-doc reads, unchanged) keeps its full live re-check. The NEW collection-group list arm instead checks the projection's own frozen `status` field via a REQUIRED `where('status','==','planned')` query filter. This is provable (the field is now query-filter-covered) but narrower than a live check: it relies on the write-side invariant that `markAsPlanned` is the sole writer of `rehearseAccess` (always writing `status:'planned'`) and `reopenService` deletes the projection on every `planned`/`exported`→`draft` transition (125-02-SUMMARY.md) as the PRIMARY defense against a stale doc surviving a reopen. The nested arm's live re-check was already documented as "belt-and-suspenders" for a delete that somehow didn't happen — the list arm now relies on the primary defense alone for the cross-org aggregate view.
- **Files modified:** `firestore.rules` (documented at length inline), `src/rules.test.ts` (draft fixture's own `status` field set to `'draft'`; queries add `where('status','==','planned')`), `firestore.indexes.json` (index extended with the `status` equality field).
- **Verification:** All 6 R378 cases pass, including the Draft-exclusion assertion (case 1) and an explicit DENY-for-status-filtered-draft case (case 6). Full rules suite (232 tests) and full app suite (5273 tests) green.
- **Downstream requirement for Plan 03:** the `mySchedule.ts` store's collection-group query MUST add `where('status','==','planned')` in addition to the existing `where('assignedEmailsLower','array-contains', ownEmail)` — omitting either filter causes Firestore to deny the entire list request outright (not silently filter results). This is now the second REQUIRED query-filter contract on this collection (see `firestore.rules`'s inline comment on the new match block).
- **Committed in:** `31a9e074` (initial nested-arm attempt, later found insufficient), `f3550176` (the working `{path=**}` collection-group match with the status-filter substitute)

---

**Total deviations:** 1 auto-fixed test-assertion bug (Rule 1) + 1 architectural finding auto-resolved within the autonomous plan's scope (Rule 4-class, documented with residual-risk framing rather than a blocking checkpoint, since a safe, provable, and tested substitute mechanism was found).
**Impact on plan:** The plan's stated MUST-HAVE ("the live parentIsPlanned() re-check evaluated per candidate document") is delivered with a materially different mechanism than specified (query-filtered frozen status, not a live cross-document check) for the list path specifically. The get path (single-doc reads) is completely unaffected. R379's INTENT (exclude Draft services from what a volunteer can see) is fully met for the list path under the actual system's write-side guarantees; the residual gap (a stale `status:'planned'` doc surviving a failed reopen-delete) is a pre-existing, already-documented "belt-and-suspenders" edge case, not a new one introduced by this plan.

## Issues Encountered
The bulk of this plan's effort (Task 2) went into diagnosing the Firestore rules-engine behavior above through iterative empirical testing against the live emulator — no other issues.

## User Setup Required
**External service configuration required before production use.** The new `rehearseAccess` COLLECTION_GROUP composite index (`status` ASC + `assignedEmailsLower` CONTAINS + `serviceDate` ASC) must be deployed:
```
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```
Run from the repo root against the `worship-planner-bc515` project; verify the index reaches **Enabled** in Firebase Console → Firestore → Indexes before relying on My Schedule in production. The emulator auto-builds this index locally, so all tests in this plan pass without the deploy — but the query will fail with `FAILED_PRECONDITION` in production until it's deployed.

## Next Phase Readiness
- The data-and-security foundation for My Schedule is complete: a verified volunteer can run `collectionGroup('rehearseAccess')` filtered by `where('status','==','planned')` + `where('assignedEmailsLower','array-contains', ownEmail)` + `orderBy('serviceDate','asc')` and receive exactly their assigned Planned services across every org.
- Plan 03 (the `mySchedule.ts` store) MUST include BOTH required query filters (`status`, `assignedEmailsLower`) — this is the single most important carry-forward fact from this plan; omitting either filter causes Firestore to deny the whole request, not silently return fewer results.
- `rolesByEmailLower` is available on every `RehearseAccessDoc` for Plan 04's role chips, with no additional volunteer-side read.
- The composite index must be deployed before production use (see User Setup above) — flagged in this plan's `user_setup` frontmatter and here.
- No blockers for Plan 02 (pure derivation helpers) or Plan 03 (store/routes), both of which can proceed independently of the deploy step.

---
*Phase: 126-my-schedule-volunteer-home*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: firestore.rules
- FOUND: firestore.indexes.json
- FOUND: src/rules.test.ts
- FOUND: src/utils/rehearseAccess.ts
- FOUND: src/utils/rehearseAccess.test.ts
- FOUND: .planning/phases/126-my-schedule-volunteer-home/126-01-SUMMARY.md
- FOUND commit: 31a9e074
- FOUND commit: f3550176
- FOUND commit: 871872c9
- FOUND commit: caef13db
- FOUND commit: 3f3d8ce2
