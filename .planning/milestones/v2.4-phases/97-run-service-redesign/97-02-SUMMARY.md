---
phase: 97-run-service-redesign
plan: 02
subsystem: service-listing
tags: [run, service-card, navigation, r284, r275]
requires: []
provides:
  - ServiceCard Run affordance (run-service-card-btn) on locked rows
affects:
  - src/components/ServiceCard.vue
tech_stack:
  added: []
  patterns:
    - "Viewer-inclusive gating mirrored verbatim from ServiceEditorView (isLocked && !!authStore.orgId, NOT isEditor)"
    - "@click.stop on a footer action button sitting outside the card-body router-link"
    - "encodeURIComponent on both interpolated id and orgId for SPA nav to /run/:id?org="
key_files:
  created: []
  modified:
    - src/components/ServiceCard.vue
    - src/components/__tests__/ServiceCard.test.ts
decisions:
  - "Gate the Run button on canRun (isLocked && orgId), viewer-inclusive per R275 — any authenticated org member can Run a locked service; deliberately NOT gated on isEditor."
  - "Use v-if (absent) rather than :disabled so drafts and org-less users see no Run affordance at all, matching ServiceEditorView."
metrics:
  duration: ~12m
  completed: 2026-08-29
status: complete
---

# Phase 97 Plan 02: Run button on the service listing card Summary

Added a viewer-inclusive Run affordance to each LOCKED row of the service listing (R284): `ServiceCard.vue`'s action footer now renders a `run-service-card-btn` FIRST (before Share/Print) that navigates to `/run/:id?org=`, gated exactly like `ServiceEditorView`'s run-service-btn.

## What was built

### Task 1 — Run button + gating + navigation (`src/components/ServiceCard.vue`)
- Added two computeds mirroring `ServiceEditorView` verbatim:
  - `isLocked = computed(() => props.service.status !== 'draft')`
  - `canRun = computed(() => isLocked.value && !!authStore.orgId)` — VIEWER-INCLUSIVE (R275); gated on a set `orgId`, never on `isEditor`.
- Added `onRun()` doing `router.push('/run/' + encodeURIComponent(props.service.id) + '?org=' + encodeURIComponent(authStore.orgId ?? ''))`.
- Rendered the button as the FIRST child of the action-footer flex row with `v-if="canRun"`, `data-testid="run-service-card-btn"`, `aria-label="Run this service live"`, the play-triangle SVG copied from `ServiceEditorView`, indigo primary treatment (`bg-indigo-600 hover:bg-indigo-500 text-white`), and `@click.stop="onRun"` so a Run click does not also fire the card-body router-link to the editor.
- Nothing else changed — date/slot/status/share/print rendering is untouched.
- Commit: **f831daa8**

### Task 2 — Test coverage (`src/components/__tests__/ServiceCard.test.ts`)
- Upgraded the harness: hoisted `pushSpy` wired into the vue-router mock; a mutable hoisted `authState` holder exposed via a getter on the auth-store mock so a case can null `orgId`.
- Added `mockServicePlanned` and `mockServiceExported` locked fixtures.
- New `describe('ServiceCard — Run affordance (R284)')` block with 5 cases: Run present on a planned row, present on an exported row, absent on a draft, absent when `orgId` is null, and click asserts a single `router.push('/run/svc-planned?org=org-1')`.
- Every pre-existing ServiceCard case kept intact.
- Commit: **db39141c**

## Deviations from Plan

None — plan executed exactly as written.

## Gate Results

- **`npm run type-check`** (vue-tsc --build): CLEAN. During execution the shared whole-project type-check transiently reported errors ONLY in the concurrent Phase 97 plans' uncommitted WIP (`src/views/RunControlView.vue`, `src/views/AudienceOutputView.vue`) — never in this plan's files (verified by filtering the error list). After plans 97-01/97-03 committed, a re-run is fully clean with zero `error TS`.
- **`npx vitest run`** (bare, per CLAUDE.md — no `--dir src`): **Test Files 1 failed | 166 passed (167); Tests 25 failed | 4611 passed (4636)**. The single failing file is `src/storage.rules.test.ts` — the documented Storage-emulator baseline (no emulator running), NOT a regression.
- **`npx vitest run src/components/__tests__/ServiceCard.test.ts`**: 13/13 green (8 pre-existing + 5 new).

## Self-Check: PASSED
- FOUND: src/components/ServiceCard.vue
- FOUND: src/components/__tests__/ServiceCard.test.ts
- FOUND commit: f831daa8 (feat)
- FOUND commit: db39141c (test)
