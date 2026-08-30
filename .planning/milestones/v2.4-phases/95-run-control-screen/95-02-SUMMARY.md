---
phase: 95-run-control-screen
plan: 02
subsystem: service-editor
tags: [run-control, navigation, rbac, ui]
requires: []
provides: [run-entry-button]
affects: [src/views/ServiceEditorView.vue]
tech-stack:
  added: []
  patterns: [computed-gate-divergence, spa-navigation-only]
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
decisions:
  - "Run button gates on canRunService = isLocked && !!authStore.orgId — deliberately NOT isEditor/canEditService, so a viewer of a locked service can Run (R275)."
  - "onRun does ordinary SPA navigation only (router.push), no state mutation; org travels in ?org= sourced from authStore.orgId."
  - "Button placed after the service-status-pill span in the header flex row, NOT in the isEditor-gated lock banner, so viewers are never locked out."
metrics:
  duration: ~10m
  completed: 2026-08-28
status: complete
requirements: [R261, R275]
---

# Phase 95 Plan 02: Run Entry Button on a Locked Service Summary

Added a primary-CTA Run button to the locked read-only ServiceEditorView header, reachable by any authenticated org member (editor OR viewer) via a new membership/org-gated computed and a navigation-only click handler.

## What Was Built

**`src/views/ServiceEditorView.vue`** (single-file change, +41 lines):

1. **`canRunService` computed** (next to `isLocked`/`canEditService`, after :2094):
   `computed(() => isLocked.value && !!authStore.orgId)`. A deliberate divergence from `canEditService` — Run is presentation-only and available to any authenticated member of the active org, editor or viewer, per R275. It is NOT gated on `authStore.isEditor`. A set `orgId` is the operative membership signal; the enforced auth boundary is the `/run` route's `requiresAuth` guard (95-03), so the computed intentionally does not re-implement auth.

2. **`onRun()` handler**: `router.push('/run/' + localService.value.id + '?org=' + authStore.orgId)`, guarded on `localService.value` being present. Ordinary SPA navigation only — no state mutation, no store touch. Uses the existing `useRouter()` (:1704) and `authStore` (:1705).

3. **Run button** rendered as a sibling immediately AFTER the `service-status-pill` span, inside the same header flex container (opened :40):
   - `type="button"`, `data-testid="run-service-btn"`, `aria-label="Run this service live"`
   - `v-if="canRunService"`, `@click="onRun"`
   - classes exactly `bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2`
   - inline heroicons-style play glyph (SVG, `viewBox="0 0 20 20"`, `fill="currentColor"`, `class="h-4 w-4"`, `aria-hidden="true"`, solid right-pointing triangle) followed by the text `Run`.

Because `v-if="canRunService"` hides the button, it is ABSENT (not merely disabled) on a draft (`status === 'draft'`) and for an org-less user — satisfying R261's "absent or disabled on a draft". The `isEditor`-gated lock banner (:308-331) and its `reopen-service-btn` were left untouched.

## Verification / Gate Results

- **`npm run type-check`** (vue-tsc --build, typechecks test files too): PASSED, clean, no output.
- **`npx vitest run`** (bare, no `--dir src`): 164 files passed, **1 file failed — `src/storage.rules.test.ts` only** (25 tests, all Storage-emulator-dependent timeouts). This is exactly the documented CLAUDE.md baseline; not a regression. 4564 tests passed. The existing ServiceEditorView suites stayed green.
- **grep gate**: `run-service-btn`, `canRunService`, and `/run/` all present in the file.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The `/run/:serviceId` route the button navigates to is registered in 95-03 (wave 2); the button only navigates via a plain string URL, so this plan type-checks independently of the route's existence — this is by design per the plan, not a stub.

## Commits

- `afdb5201`: feat(95-02): add Run button to locked ServiceEditorView header (R261/R275)

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue (modified, contains canRunService, onRun, run-service-btn, /run/)
- FOUND: commit afdb5201
