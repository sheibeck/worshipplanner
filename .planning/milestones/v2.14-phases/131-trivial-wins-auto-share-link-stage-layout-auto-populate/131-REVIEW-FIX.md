---
phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate
fixed_at: 2026-09-07T14:18:12Z
review_path: .planning/phases/131-trivial-wins-auto-share-link-stage-layout-auto-populate/131-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 131: Code Review Fix Report

**Fixed at:** 2026-09-07T14:18:12Z
**Source review:** .planning/phases/131-trivial-wins-auto-share-link-stage-layout-auto-populate/131-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (WR-01 only; IN-01/IN-02 explicitly excluded from this pass by `fix_scope: critical_warning`)
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: Auto-populate's "already seeded" guard does not survive a page reload — deleting all seeded markers is not durable

**Files modified:** `src/types/service.ts`, `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.stage.test.ts`
**Commit:** `dcd4d947`
**Applied fix:**

Replaced the in-memory `stageAutoPopulateSeededServiceIds` `Set` (reset to empty on every
component mount, so it only holds "already seeded" within the same session) with a persisted
boolean field on the service document, `stageLayoutAutoSeeded?: boolean` (added to `Service` in
`src/types/service.ts`, additive/no-migration, matching the file's existing field-comment
convention).

`onAutoPopulateStageLayout()` in `ServiceEditorView.vue` now gates the seed on BOTH conditions
required by the review: (1) the existing load-bearing invariant — `existing.length > 0` — read
fresh from `localService.value.stageLayout` on every call, so a populated canvas is never
regenerated (unchanged), AND (2) the new persisted `localService.value.stageLayoutAutoSeeded`
flag, set `true` in the SAME mutation that writes the seeded markers (`localService.value.stageLayout
= { elements: seeded }`), so it rides the existing `useAutoSave` deep-watch — no new save call, no
new store, no await/gate on the write succeeding (fail-safe: the seed and the UI update happen
synchronously and locally; if the eventual autosave write later fails, `useAutoSave`'s existing
retry/error surface handles it exactly as it already does for every other field on this view, and
the user is never blocked). Because the flag is set locally in the same tick as the seed, the
in-memory `Set` became fully redundant and was removed.

The one-time seed's own two payload-shaping call sites in `onSave()` needed a matching update:
`stageLayoutAutoSeeded` is a top-level field (like `stageLayout`), not one carried inside the
wholesale-replaced `slots` array, so it had to be explicitly added to (a) the `payload` object sent
to `serviceStore.updateService()` and (b) the dirty-tracking snapshot-equality comparison
immediately below it — otherwise the local mutation would never actually reach Firestore. Unlike
`stageLayout` (which needs an explicit `?? null` substitution to correctly clear a previously-set
value), `stageLayoutAutoSeeded` never needs to be cleared back to `undefined`/`false` once set, so
a bare `data.stageLayoutAutoSeeded` (stripped by the existing `stripUndefined` when absent) is
sufficient.

**Tests added** (`src/views/__tests__/ServiceEditorView.stage.test.ts`):
- Extended the existing "seeds one marker... and persists it through autosave" test to also assert
  `stageLayoutAutoSeeded: true` is present in the autosave payload.
- Added a new test simulating the exact failure mode from WR-01: mount a **fresh** wrapper (not the
  same wrapper reused across tab visits, to genuinely exercise "component remount / page reload")
  with `{ stageLayout: undefined, stageLayoutAutoSeeded: true }` — the persisted post-delete state —
  and assert no re-seed occurs and no autosave call fires.
- Updated a stale comment in an existing test that referenced the now-removed in-memory `Set`.

**Verification:**
- `npx vitest run src/views/__tests__/ServiceEditorView.stage.test.ts src/utils/__tests__/stageLayout.test.ts` — 49/49 passing (2 new).
- `npm run type-check` (`vue-tsc --build`, the mandated gate per CLAUDE.md, not the narrower `-p tsconfig.app.json` form) — clean, no errors.

This finding is a straightforward structural/persistence fix (not a logic-branch judgment call), so
it is recorded as `fixed`, not `fixed: requires human verification`.

---

_Fixed: 2026-09-07T14:18:12Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
