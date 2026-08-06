---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
plan: 02
subsystem: public-share-infrastructure
tags: [firestore-rules, security, routing, public-share]
requires:
  - "Phase 16 quarterShares rules/route precedent (analog)"
provides:
  - "serviceShares Firestore collection (public read; org-editor-scoped write; orgId immutable on update)"
  - "service-memorable-share route /:slug/service-:date"
  - "'service-share' reserved slug"
affects:
  - "17-03 (store write to serviceShares)"
  - "17-05 (public ShareView read of serviceShares)"
tech-stack:
  added: []
  patterns:
    - "Deterministic-doc-id public share doc guarded by editor-scoped write + orgId-immutability (mirrors quarterShares)"
    - "Dynamic memorable route appended after static routes (Vue Router static > dynamic ranking)"
key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts
    - src/router/index.ts
    - src/utils/slug.ts
decisions:
  - "serviceShares mirrors quarterShares 1:1 rather than introducing a distinct rule shape"
  - "'service-share' reserved proactively even though the opaque /share/:token route is reused"
metrics:
  duration: "~10min"
  completed: 2026-07-22
status: complete
---

# Phase 17 Plan 02: serviceShares public-share infrastructure Summary

Stood up the security boundary and routing for a per-service public share link: a new `serviceShares` Firestore collection (public read; org-editor-scoped create/update/delete; `orgId` immutable on update) proven by 12 new emulator tests, the memorable `/:slug/service-:date` public route, and the `'service-share'` reserved slug — with the ruleset deployed live to `worship-planner-bc515`.

## What Was Built

- **`firestore.rules`** — Added a `match /serviceShares/{shareId}` block adjacent to `quarterShares`, before the catch-all. Copied the quarterShares shape verbatim: `allow read: if true`; `allow create: if isOrgEditor(request.resource.data.orgId)`; `allow update: if isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId`; `allow delete: if isOrgEditor(resource.data.orgId)`. Comment documents the guessable-deterministic-doc-id risk (id derived from slug + date, so writes must be editor-scoped and update must forbid changing `orgId`). Implements CR-04/CR-05.
- **`src/router/index.ts`** — Appended a public route named `service-memorable-share`, path `/:slug/service-:date(\d{4}-\d{2}-\d{2})`, component `ShareView.vue`, no `requiresAuth` meta, placed after all static routes alongside `quarter-memorable-share`.
- **`src/utils/slug.ts`** — Added `'service-share'` to `RESERVED_SLUGS`.
- **`src/rules.test.ts`** — Added a `describe('serviceShares — public read, org-editor-scoped create/update', …)` block with 12 cases mirroring the quarterShares suite, reusing the existing `seedDoc` helper.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | serviceShares rules block + memorable route + reserved slug | `93c4ab3` |
| 2 | serviceShares rules-emulator test suite | `c048210` |
| 3 | Deploy Firestore rules to production (human checkpoint) | n/a (live deploy, no code change) |

## Verification

- `npx vue-tsc --build` — clean, no errors.
- `npm run test:rules` — 57/57 passed against the local Firestore emulator, including all 12 new `serviceShares` cases (public read succeeds; owning-org editor create/update/delete succeed; non-member create/update fail; cross-org create/update/delete fail; orgId-change-on-update fails; unauthenticated write/delete fail).
- **Live deploy (Task 3 checkpoint):** Human ran `firebase deploy --only firestore:rules` against `worship-planner-bc515` — CLI reported "rules file firestore.rules compiled successfully", "released rules firestore.rules to cloud.firestore", "Deploy complete!". Approved 2026-07-22.

## Threat Mitigations Applied

| Threat ID | Mitigation | Proven by |
|-----------|-----------|-----------|
| T-17-02-01 (Tampering, guessable doc id) | Editor-scoped create/update + `orgId` immutability on update | rules.test.ts cross-org create/update + orgId-change-fail cases; live deploy |
| T-17-02-02 (EoP, cross-org overwrite) | Editor-scoped write rule | rules.test.ts non-member + cross-org write-fail cases |
| T-17-02-04 (Spoofing, slug squatting) | `'service-share'` in RESERVED_SLUGS | slug.ts change |

T-17-02-03 (public read of names-only share doc) is accepted by design (mirrors quarterShares); names-only enforcement lands in 17-03.

## Deviations from Plan

None — plan executed exactly as written. All Task 1/2 acceptance criteria met; Task 3 completed via the planned human deploy checkpoint.

## Known Stubs

None. The store write to `serviceShares` (17-03) and the public read in `ShareView.vue` (17-05) are downstream plans, not stubs of this plan.

## Self-Check: PASSED

- `firestore.rules` serviceShares block — present (grep match at line 122).
- `src/router/index.ts` service-memorable-share route — present (line 99).
- `src/utils/slug.ts` 'service-share' — present (line 33).
- `src/rules.test.ts` serviceShares describe block — present, 57/57 tests pass.
- Commits `93c4ab3` and `c048210` — present in git log.
