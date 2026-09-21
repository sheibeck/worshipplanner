---
phase: 140-vamps-library-crud-storage
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - storage.rules
  - src/components/VampSlideOver.vue
  - src/components/VampTable.vue
  - src/components/__tests__/VampSlideOver.test.ts
  - src/components/__tests__/VampTable.test.ts
  - src/composables/useVampFileUpload.ts
  - src/composables/__tests__/useVampFileUpload.test.ts
  - src/constants/keys.ts
  - src/rules.test.ts
  - src/storage.rules.test.ts
  - src/stores/orgScopedStores.ts
  - src/stores/vamps.ts
  - src/stores/__tests__/orgScopedStores.test.ts
  - src/stores/__tests__/vamps.test.ts
  - src/types/vamp.ts
  - src/utils/vampFiles.ts
  - src/utils/__tests__/vampFiles.test.ts
  - src/views/SongsView.vue
  - src/views/__tests__/SongsView.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 140: Code Review Report (Re-review, iteration 2)

**Reviewed:** 2026-09-13
**Depth:** standard
**Files Reviewed:** 18
**Status:** clean

## Summary

This is a re-review verifying the fixes applied for CR-01, WR-01, and WR-02 from the prior review
(`140-REVIEW.iter2.md`), then a fresh standard-depth pass over all 18 in-scope files for anything new.

**CR-01 (upload feedback silently swallowed) — verified fixed** (`625b8674`). `VampSlideOver.vue` now
destructures `uploads`/`announcement`/`dismiss`/`reset` from `useVampFileUpload()` (`VampSlideOver.vue:317`)
and renders an `aria-live` announcement plus per-row progress/error UI with a dismiss control
(`VampSlideOver.vue:214-242`), mirroring `SongFilesTab.vue`. The drop-zone is also disabled while an upload
for the vamp is in flight (`VampSlideOver.vue:138`, `:430-434`, `:449`), closing the double-upload race
called out in the original finding. `VampSlideOver.test.ts` uses real `ref()`-backed mocks (not plain
objects) so the assertions would actually fail without the fix — confirmed by tracing the mock wiring
(`VampSlideOver.test.ts:30-43`) and the three new tests (`:155-185`).

**WR-01 (VampTable given the pre-filtered list) — verified fixed** (`7659595f`). `SongsView.vue:241` now
passes `vampStore.vamps` (unfiltered) as the `vamps` prop; `VampTable.vue` still reads rows from
`vampStore.filteredVamps` (`VampTable.vue:67`), restoring the two-branch empty-vs-no-match design and the
library-total sub-head counts. `VampTable.test.ts`'s `mountTable()` helper now takes an independent
`filteredVamps` argument (`VampTable.test.ts:40-43`) and a new test exercises exactly the diverging case
(non-empty `vamps`, empty `filteredVamps`) that the old always-equal helper could never produce
(`:134-140`), which also closes the prior IN-01 finding.

**WR-02 (orphaned Storage objects on MP3 replace/remove) — verified fixed** (`19c9fbc6`). `useVampStore` now
exposes `setAttachment(id, attachment | null)` (`vamps.ts:73-84`), which reads the previous
`attachment.storagePath` before writing, then best-effort deletes it after the write completes if it
differs from the new path — logged, never blocking, mirroring `deleteVamp`'s existing convention.
`removeAttachment` is `setAttachment(id, null)` (`vamps.ts:86-88`). Both `VampSlideOver.vue`'s
`removeAttachment()` (`:461-465`) and `useVampFileUpload.ts`'s upload-complete handler (`:182`) route
through it. Four new store tests cover replace, remove, no-previous-attachment, and a swallowed
`deleteObject` failure (`vamps.test.ts:273-343`), and the upload-composable tests were retargeted to spy on
`setAttachment` rather than `updateVamp`.

No regressions were introduced by any of the three fixes — each change is narrowly scoped, and the
accompanying tests exercise the exact failure mode the finding described (traced against the actual
production code, not merely read for plausibility). A fresh pass over all 18 files (including the ones
untouched by the fix commits — `storage.rules`, `vamps.ts`'s CRUD/subscribe paths, `useVampFileUpload.ts`'s
validation/duration-capture logic, `vampFiles.ts`, `vamp.ts`, `keys.ts`, `orgScopedStores.ts`, and the
church-switch wiring in `SongsView.vue`) surfaced no new Critical or Warning issues. The `vamp-files/`
Storage rule block correctly mirrors the shipped `song-files/` block (claim-only membership check,
editor-gated create/delete, `audio/mpeg`-only + <50MB, immutable `update: if false`, and the mandatory
catch-all exclusion with its own regression test), and church-switch teardown/re-subscribe for the Vamps
tab is wired and tested at both the global (`orgScopedStores.ts`) and local (`SongsView.vue`'s
`watch(() => authStore.orgId, ...)`) levels.

Only the previously-deferred Info item remains, left in scope per the fix report (`140-REVIEW-FIX.md`:
"IN-02 ... left as-is — outside `critical_warning` scope").

## Info

### IN-01: `authStore.orgId ?? ''` in `attach()` can construct a malformed Storage path if `orgId` is falsy

**File:** `src/components/VampSlideOver.vue:442`
**Issue:** `attach()` guards on a missing `vampId` (`if (!id) return`) but not on a missing `orgId` — it
falls back to `''`, which `vampFileStoragePath()` would turn into `orgs//vamp-files/...` (a malformed,
double-slash path) rather than failing loudly. In the normal flow `authStore.orgId` is always set while the
Songs page is mounted, so this is unlikely to trigger in practice, but the silent `?? ''` fallback masks the
failure mode instead of surfacing it. (Carried over, unchanged, from the prior review's IN-02 — intentionally
left out of the critical/warning fix scope.)
**Fix:** Mirror the `vampId` guard:
```ts
function attach(file: File) {
  const id = effectiveId.value
  if (!id || !authStore.orgId) return
  addFile(file, {
    vampId: id,
    orgId: authStore.orgId,
    createdBy: authStore.user?.uid ?? '',
  })
}
```

---

_Reviewed: 2026-09-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
