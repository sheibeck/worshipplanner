---
phase: 71-cleanup-deletion-toggle-safety
plan: 02
subsystem: ui
tags: [vue, teleport, focus-trap, httpsCallable, owner-console, dry-run-preview]

# Dependency graph
requires:
  - phase: 71-cleanup-deletion-toggle-safety
    plan: 01
    provides: "previewCleanupDryRun super-admin-gated onCall (invoked by string name, no build-time import dependency)"
  - phase: 70-runtime-config-owner-console
    provides: "CleanupConfigCard.vue shell + Pinia appConfig store's saveField(path, value) write path"
provides:
  - "CleanupEnableConfirmDialog.vue -- new focus-trap Teleport modal (first hand-rolled focus trap in this codebase)"
  - "CleanupConfigCard.vue's Enable -> preview -> confirm / Disable-immediate flow, replacing Phase 70's read-only toggles"
affects: [owner-console-cleanup-config-card, future-cleanup-ui-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled focus trap (Tab/Shift+Tab cycling limited to the dialog's own buttons, Escape-as-Cancel, focus-on-open lands on Cancel never Confirm)"
    - "Hard block via a structurally separate disabled <button> with NO click handler wired at all (not a conditionally-disabled attribute on the same element) -- the R190 fail-safe"
    - "httpsCallable(functions, 'previewCleanupDryRun') invoked by string name so the client has no build-time dependency on functions/src/index.ts"

key-files:
  created:
    - src/components/admin/CleanupEnableConfirmDialog.vue
    - src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts
  modified:
    - src/components/admin/CleanupConfigCard.vue
    - src/components/admin/__tests__/CleanupConfigCard.test.ts

key-decisions:
  - "referencesComplete===false is checked directly (not `typeLabel === background cleanup && referencesComplete===false`) -- the prop is only ever populated for the backgrounds type per 71-UI-SPEC's Component Inventory, so checking the value alone correctly scopes the hard block without a second string comparison"
  - "Dialog test harness reuses NewServiceDialog.test.ts's `stubs: { Teleport: { template: '<div><slot /></div>' } }` convention -- teleported content renders inline so @vue/test-utils find/findAll/findComponent can see it"
  - "Card rows carry `data-testid=\"cleanup-row-{type}\"` (new to this file) so the extended test can scope button queries per-row without ambiguity against the dialog's own same-labeled 'Enable' Confirm button"

requirements-completed: [R189, R190]

coverage:
  - id: D1
    description: "Enable click -> previewCleanupDryRun callable -> confirm dialog echoes wouldDeleteCount/wouldDeleteBytes -> Confirm writes cleanup.{x}Enabled=true via store.saveField; Cancel writes nothing"
    requirement: "R189"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#Enable -> preview -> dialog echoes count -> Confirm -> saveField(cleanup.mediaEnabled, true); dialog closes"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#Cancel closes the dialog and writes nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Disable writes cleanup.{x}Enabled=false immediately with NO preview call"
    requirement: "R189"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#Disable writes false immediately with NO preview call"
        status: pass
    human_judgment: false
  - id: D3
    description: "A zero-count preview still opens the dialog and allows confirming, with the zero-state copy and an indigo (not destructive-red) Confirm"
    requirement: "R189"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#zero-count preview still opens the dialog and allows Confirm (arms the cron)"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts#uses the zero-state copy and an indigo (not red) Confirm when wouldDeleteCount is 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Preview-error and write-error states surface inline/in-dialog; no flag is flipped on either error path"
    requirement: "R189"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#surfaces a preview error inline and flips no flag"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#surfaces a write error inline in the dialog, keeps it open, and flips no flag"
        status: pass
    human_judgment: false
  - id: D5
    description: "Background Confirm is hard-blocked (disabled, no click handler wired at all) when referencesComplete===false, with no UI override path"
    requirement: "R190"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts#hard-blocks Confirm when referencesComplete is false: disabled, no click handler fires"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupConfigCard.test.ts#passes referencesComplete through to the dialog only for the backgrounds type"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dialog focus trap: focus lands on Cancel (never Confirm) on open; Escape emits cancel (not confirm); Confirm color is destructive-red when wouldDeleteCount>0"
    requirement: "R190"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts#moves focus to Cancel when the dialog opens"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts#emits cancel (not confirm) on Escape"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts#uses the destructive-red Confirm when wouldDeleteCount > 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Real dry-run preview against production Storage/Firestore, production Enable + first real cron deletion, and a visual pass of the dialog/danger affordance/hard-block"
    verification: []
    human_judgment: true
    rationale: "Requires deployed functions + real data + a real super-admin session and human visual judgment -- explicitly out of scope per 71-VALIDATION.md's Manual-Only Verifications table; deferred to /gsd-verify-work 71"

# Metrics
duration: 35min
completed: 2026-08-20
status: complete
---

# Phase 71 Plan 02: Cleanup Deletion-Toggle Safety (client) Summary

**New `CleanupEnableConfirmDialog.vue` focus-trap modal wired into `CleanupConfigCard.vue`'s Enable button via `previewCleanupDryRun`, replacing Phase 70's read-only toggles with a confirm-to-flip flow that hard-blocks background cleanup when reference detection is incomplete.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-20T18:00:00 (approx)
- **Completed:** 2026-08-20T18:35:00 (approx)
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- New `CleanupEnableConfirmDialog.vue`: a Teleport/backdrop/Transition modal (structural shell copied from `NewServiceDialog.vue`) with the first hand-rolled focus trap in this codebase -- focus lands on Cancel on open, Tab/Shift+Tab cycles only the dialog's own buttons, Escape emits `cancel`.
- R190 hard block implemented structurally: when `referencesComplete === false`, the template renders a completely separate, permanently `disabled` `<button>` with **no `@click` binding at all** in place of the live Confirm button -- not a conditional `:disabled` on a clickable element. A negative test proves clicking it never emits `confirm`.
- Confirm button color branches on `wouldDeleteCount`: destructive red (`bg-red-600`) when `> 0`, ordinary indigo (`bg-indigo-600`) when `=== 0` -- the zero-count case still opens the dialog and allows confirming (arms the cron without alarming the owner over a no-op).
- `CleanupConfigCard.vue`'s four read-only checkbox rows were replaced with an Enable/Disable flow: Enable calls `httpsCallable(functions, 'previewCleanupDryRun')({type})`, opens the dialog with the echoed `{wouldDeleteCount, wouldDeleteBytes, referencesComplete}`; Confirm calls the Phase 70 store's `saveField('cleanup.{x}Enabled', true)`; Cancel writes nothing; Disable calls `saveField(..., false)` immediately with no preview call at all. The status checkbox stays `disabled` with no `@change` handler -- the only write triggers are the explicit buttons.
- Only one dialog instance is mounted at the card level (`activeDialog` ref), matching 71-UI-SPEC's Resolved Design Decision 5.
- Extended `CleanupConfigCard.test.ts` (13 tests, up from 6) and new `CleanupEnableConfirmDialog.test.ts` (9 tests) -- both green, plus `npm run type-check` (vue-tsc --build, the wide form per CLAUDE.md) clean and the full `npx vitest run` app suite held at its 2-known-failing-file baseline (`storage.rules.test.ts`, `RosterView.test.ts`) with zero new regressions (3887 passed, 13 skipped, 1 known-failing).

## Task Commits

Each task followed the RED -> GREEN TDD cycle with separate commits:

1. **Task 1: Create CleanupEnableConfirmDialog.vue + its test**
   - `2528c164` (test) -- failing test written first, verified RED against a temporarily-removed component
   - `7f1b0a35` (feat) -- implementation + a test byte-math fix, verified GREEN (9/9 passing)
2. **Task 2: Wire the Enable->preview->confirm / Disable flow into CleanupConfigCard.vue + extend its test**
   - `9189b1c8` (test) -- extended test written first, verified RED against the Phase 70 component (8 new failures, 5 pre-existing tests still passing)
   - `a72ddde0` (feat) -- implementation + a mock-type-widening fix caught by `vue-tsc --build`, verified GREEN (13/13 passing)

_No separate plan-metadata commit was requested for the task commits above; this SUMMARY/STATE/ROADMAP update follows the standard docs commit protocol._

## Files Created/Modified
- `src/components/admin/CleanupEnableConfirmDialog.vue` (new) -- focus-trap confirm modal; props `open/typeLabel/wouldDeleteCount/wouldDeleteBytes/referencesComplete?/confirming/confirmError`; emits `confirm`/`cancel`
- `src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts` (new) -- 9 tests: count>0/count===0 copy+color, R190 hard-block negative test, focus-on-open, Escape-as-cancel, confirm/cancel emit wiring
- `src/components/admin/CleanupConfigCard.vue` (modified) -- Enable/Disable per-row flow, `CLEANUP_ROWS` descriptor table, `cleanupStates` reactive map, `activeDialog`/`confirming`/`confirmError` refs, `onEnableClick`/`onDialogConfirm`/`onDialogCancel`/`onDisableClick`; five retention/cap `ConfigNumberField`s and their `fieldStates`/`stateFor`/`onSaveNumber` machinery unchanged
- `src/components/admin/__tests__/CleanupConfigCard.test.ts` (modified) -- added `firebase/functions`/`@/firebase` mocks, 7 new Enable/Disable/preview/error test cases; updated the shared-note copy assertion to match the new UI-SPEC text; the two Phase 70 checkbox/retention-field test groups are unchanged and still pass

## Decisions Made
- `referencesComplete === false` is checked directly in the dialog rather than also gating on `typeLabel === 'background cleanup'` -- the prop is only ever populated for the backgrounds type per the UI-SPEC's Component Inventory table, so the value check alone is sufficient and avoids a second, redundant string comparison.
- Reused `NewServiceDialog.test.ts`'s `Teleport` stub convention (`{ template: '<div><slot /></div>' }`) in both new/extended test files so teleported dialog content is queryable by `@vue/test-utils` without `attachTo: document.body` gymnastics for every assertion.
- Added `data-testid="cleanup-row-{type}"` to each card row (new to this file, not in the UI-SPEC's literal markup but additive/non-visual) so the card test can scope its button queries per-row -- necessary because the dialog's own live Confirm button is also labeled "Enable" (per the UI-SPEC's Copywriting Contract), which would otherwise collide with the row's "Enable" button in a flat `findAll('button')` query once both render in the same mounted tree.

## Deviations from Plan

None beyond the two in-flow fixes surfaced during the plan's own mandated RED->GREEN verification (both are within the TDD cycle's normal "run, see it fail for the right reason, fix, rerun" loop, not scope changes):

1. **[Rule 1 - Bug] Test's expected MB math corrected to match the (bytes/1024/1024).toFixed(1) formula** -- the first GREEN run for the dialog test asserted `812.3 MB` for a `812_300_000`-byte fixture, but `812300000 / 1024 / 1024 = 774.7`, not `812.3` (that number is only correct for a decimal-MB, i.e. `/1_000_000`, interpretation). Fixed the test's own expected string to `774.7 MB` to match the plan-mandated binary-MB formula (identical to `pptxUpload.ts`'s `fileMb`). Committed in `7f1b0a35`.
2. **[Rule 3 - Blocking] Widened `mockPreviewFn`'s inferred return type to include the optional `referencesComplete` field** -- `vue-tsc --build` (the CLAUDE.md-mandated wide type-check form) rejected a test case that passed `referencesComplete: false` in the mocked resolved value, because the `vi.fn()`'s return type had been inferred from its first (referencesComplete-less) usage as `{ wouldDeleteCount: number; wouldDeleteBytes: number }`. Added an explicit return-type annotation to the hoisted mock factory. Committed in `a72ddde0`.

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3), both confined to test-file correctness, no production code impact.
**Impact on plan:** None on scope -- both are exactly the kind of self-correction the plan's own RED/GREEN verification loop and `npm run type-check` gate exist to catch before commit.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required
None for this plan -- purely client-side, no new environment variables or external service configuration. Per the plan's deploy-discipline grant, no deploys were performed. `previewCleanupDryRun` (built in 71-01) remains undeployed; deploying it and this client change together is the owner's milestone-end hand-over, unchanged from 71-01's readiness note.

## Next Phase Readiness
- The Owner Console's cleanup UI is feature-complete for R189/R190: build + tested, zero new npm dependencies, `npm run type-check` clean, app baseline held.
- Deferred to `/gsd-verify-work 71` per 71-VALIDATION.md's Manual-Only Verifications table: (1) the real dry-run count against production Storage/Firestore, (2) the full Enable -> confirm -> next-cron-actually-deletes cycle in production (the owner's own button, post-deploy), (3) a visual pass of the confirm dialog + danger affordance + the `referencesComplete` hard-block in a real super-admin session.
- No blockers. This is the final plan of Phase 71 and closes out the v1.9 Owner Admin Console milestone's cleanup-safety scope (R188-R190).

---
*Phase: 71-cleanup-deletion-toggle-safety*
*Completed: 2026-08-20*

## Self-Check: PASSED
- FOUND: src/components/admin/CleanupEnableConfirmDialog.vue
- FOUND: src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts
- FOUND: src/components/admin/CleanupConfigCard.vue
- FOUND: src/components/admin/__tests__/CleanupConfigCard.test.ts
- FOUND: commit 2528c164
- FOUND: commit 7f1b0a35
- FOUND: commit 9189b1c8
- FOUND: commit a72ddde0
