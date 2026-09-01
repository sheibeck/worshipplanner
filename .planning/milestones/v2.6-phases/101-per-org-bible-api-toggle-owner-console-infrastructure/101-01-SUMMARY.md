---
phase: 101-per-org-bible-api-toggle-owner-console-infrastructure
plan: 01
subsystem: api
tags: [firebase-functions, firestore-rules, super-admin, org-provisioning]

requires:
  - phase: 082-per-org-ai-master-gate
    provides: "aiMasterEnabled / setOrgAiEnabled / lifecycleFields() pattern this plan mirrors 1:1"
provides:
  - "Organization.bibleApiEnabled?: boolean field, default OFF"
  - "setOrgBibleEnabled super-admin-gated Cloud Function (only write path)"
  - "listOrganizations echoes bibleApiEnabled per org (default false)"
  - "firestore.rules denies every client write to bibleApiEnabled, including a super-admin's own client SDK"
affects: [102-bible-api-fetch-dispatcher, 103-manual-fallback, owner-console]

tech-stack:
  added: []
  patterns:
    - "Single super-admin master gate, no settings.* leaf (deliberately simpler than the AI toggle's dual-write R243 forced-off shape)"

key-files:
  created: []
  modified:
    - src/types/organization.ts
    - functions/src/orgProvisioning.ts
    - functions/src/index.ts
    - functions/src/orgProvisioning.test.ts
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "Mirrored setOrgActiveHandler's simpler shape (not setOrgAiEnabledHandler's dual-write), since there is no church-editable settings.* leaf for the Bible API this milestone."
  - "bibleApiEnabled rides the SAME lifecycleFields() allow-list as aiMasterEnabled/active rather than a new guard function — no new rules surface, same super-admin-client-SDK-denied posture."
  - "Input field name is `enabled` (not `bibleEnabled`), the agreed cross-plan contract Plan 02's client call must match."

patterns-established:
  - "Second per-org super-admin master gate proves the aiMasterEnabled pattern generalizes cleanly to a new domain (Bible API) without touching the shared guard machinery."

requirements-completed: [R295, R301]

coverage:
  - id: D1
    description: "Organization.bibleApiEnabled?: boolean exists; absent reads as OFF everywhere"
    requirement: "R295"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#listOrganizationsHandler > Phase 101 (R295/R301): a fresh org with no bibleApiEnabled field reads false"
        status: pass
    human_judgment: false
  - id: D2
    description: "setOrgBibleEnabled is super-admin-gated, is the only write path, and short-circuits on no-op calls"
    requirement: "R295"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#setOrgBibleEnabledHandler (9 tests: unauthenticated, permission-denied, invalid-argument x2, not-found, ENABLE, DISABLE, 2x SHORT-CIRCUIT)"
        status: pass
    human_judgment: false
  - id: D3
    description: "firestore.rules denies every direct client write to bibleApiEnabled, including a super-admin's own client SDK"
    requirement: "R295"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#DENIES an ordinary editor from setting bibleApiEnabled:true directly on their own org"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#CRITICAL -- DENIES a super-admin client SDK from writing bibleApiEnabled directly (must use setOrgBibleEnabled)"
        status: pass
    human_judgment: false
  - id: D4
    description: "listOrganizations returns bibleApiEnabled per org, false when absent, no migration of existing orgs"
    requirement: "R295, R301"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#listOrganizationsHandler > Phase 101 (R295): bibleApiEnabled reads true when the org doc carries it explicitly"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-08-31
status: complete
---

# Phase 101 Plan 01: Per-Org Bible API Toggle — Server + Rules Infrastructure Summary

**`Organization.bibleApiEnabled` master field + super-admin-gated `setOrgBibleEnabled` Cloud Function + `listOrganizations` echo + `firestore.rules` client-write deny, mirroring the v2.2 `aiMasterEnabled`/`setOrgAiEnabled` pattern 1:1 with a single-field (no settings leaf), default-OFF shape.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-31T17:18:37Z
- **Completed:** 2026-08-31T17:35:49Z
- **Tasks:** 2/2 completed
- **Files modified:** 6

## Accomplishments
- `Organization.bibleApiEnabled?: boolean` added to the type, default OFF (absent = disabled), documented alongside `aiMasterEnabled`.
- `setOrgBibleEnabled` Cloud Function: super-admin-gated (`assertSuperAdminCaller` before any Firestore read), validates `orgId`/`enabled`, merge-writes the master field + audit siblings (`bibleApiEnabledAt/By`, `bibleApiDisabledAt/By`), clears the opposite transition's stale audit pair, and short-circuits on a no-op call. No `settings.*` write — single master gate this milestone.
- `setOrgBibleEnabled` re-exported from `functions/src/index.ts` (import + export) so `firebase deploy` will discover it.
- `listOrganizationsHandler` now echoes `bibleApiEnabled` per org (`?? false`), so the Owner Console can read state once Plan 02 wires the UI.
- `firestore.rules`' `lifecycleFields()` allow-list extended with `bibleApiEnabled` + its 4 audit siblings, riding the same `preservesLifecycleFields()` deny as `active`/`aiMasterEnabled` — no client write path, including a super-admin's own client SDK, can set it directly.
- Rules test coverage: ordinary-editor deny + the CRITICAL super-admin-client-SDK deny twin, both passing against the running emulator.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Organization.bibleApiEnabled type + setOrgBibleEnabled Cloud Function + listOrganizations echo + index.ts re-export** - `bb80577f` (feat)
2. **Task 2: Deny all client writes to bibleApiEnabled in firestore.rules + rules tests** - `d47cc68a` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/types/organization.ts` - added `bibleApiEnabled?: boolean` to `Organization`, doc-commented as the super-admin master gate (R295)
- `functions/src/orgProvisioning.ts` - added `SetOrgBibleEnabledRequest`/`Response`, `setOrgBibleEnabledHandler`, `setOrgBibleEnabled`; extended `OrgSummary` and `listOrganizationsHandler` with `bibleApiEnabled`
- `functions/src/index.ts` - imported + re-exported `setOrgBibleEnabled`
- `functions/src/orgProvisioning.test.ts` - added `setBibleEnabledRequest` helper, `SET_BIBLE_ENABLED_DEFAULTS`, a 9-test `setOrgBibleEnabledHandler` describe block, and `bibleApiEnabled: false`/`true` on every `listOrganizationsHandler` assertion (existing + 2 new dedicated tests)
- `firestore.rules` - extended `lifecycleFields()` with `bibleApiEnabled` + audit siblings
- `src/rules.test.ts` - added the ordinary-editor deny + CRITICAL super-admin-client-SDK deny twins

## Decisions Made
- Modeled `setOrgBibleEnabledHandler` on `setOrgActiveHandler`'s simpler single-field shape rather than `setOrgAiEnabledHandler`'s dual-write (R243 forced-off) shape, per the plan's explicit instruction — there is no church-editable `settings.*` leaf for the Bible API this milestone.
- Callable input field is `enabled` (not `bibleEnabled`), matching the plan's stated cross-plan contract for Plan 02's client call.
- `bibleApiEnabled` rides the existing `lifecycleFields()` allow-list rather than a new guard function, keeping the rules surface unchanged in structure.

## Deviations from Plan

None affecting scope or correctness. One out-of-scope discovery was logged (not fixed) per the Scope Boundary rule:

- `src/stores/appConfig.test.ts` has one pre-existing failing test (dot-path vs. nested-object payload mismatch from commit `b365a1b9`, unrelated to this plan's files) surfaced by the full `npx vitest run` gate. Documented in `.planning/phases/101-per-org-bible-api-toggle-owner-console-infrastructure/deferred-items.md` rather than fixed, since neither `appConfig.ts` nor its test is among this plan's `files_modified`.

## Issues Encountered
- The Firestore emulator was already running when Task 2's verification ran, so `npm run test:rules` would have hit "port taken." Used the documented fallback (`npx vitest run --config vitest.rules.config.ts` against the running emulator) per CLAUDE.md — all 226 tests passed (200 in `rules.test.ts` including the 2 new bibleApiEnabled tests, 26 in `storage.rules.test.ts`).
- A stray pre-staged deletion (`.planning/phases/999.3-.../.gitkeep`, unrelated leftover from the v2.6 phase renumbering) was already in the git index before this plan started and got swept into Task 1's commit when staging by filename. Confirmed harmless (a stale placeholder for a since-renumbered phase directory) and not reintroduced by any subsequent work.

## User Setup Required
None - no external service configuration required. Per CLAUDE.md and this plan's deferred deploy hand-over note, `firebase deploy` was NOT run — build/test/commit only, batched for owner confirmation at milestone end.

## Next Phase Readiness
- Server-side + rules-layer half of the Bible API toggle is complete and fully tested: field, callable, echo, and deny.
- Plan 02 (Owner Console UI + authStore mirror) can now wire `OrgConfigDrawer.vue`/`OrganizationsTab.vue`'s Bible checkbox and `onToggleBible` against `setOrgBibleEnabled({ orgId, enabled })`, and `auth.ts`'s `bibleApiEnabled`/`isBibleApiEnabled` mirror against the `listOrganizations` echo — no server-side blockers.
- Verification gates all green for this plan's scope: `cd functions && npm run build` clean, `cd functions && npm test` 627/627 pass, `npm run type-check` clean, rules suite 226/226 pass (fallback command, emulator already running).
- Full `npx vitest run` app suite: 4739/4765 pass; the 26 failures are 2 files, neither touched by this plan (`src/storage.rules.test.ts` — documented Storage-emulator baseline; `src/stores/appConfig.test.ts` — pre-existing unrelated drift, logged in `deferred-items.md`).

---
*Phase: 101-per-org-bible-api-toggle-owner-console-infrastructure*
*Completed: 2026-08-31*

## Self-Check: PASSED

All 6 modified source files + this SUMMARY + deferred-items.md confirmed present on disk. Both task commits (`bb80577f`, `d47cc68a`) confirmed present in `git log`.
