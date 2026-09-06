---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
fixed_at: 2026-09-06T08:20:00Z
review_path: .planning/phases/127-volunteer-service-view-rehearse-order-of-service-stage-layout/127-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 127: Code Review Fix Report

**Fixed at:** 2026-09-06
**Source review:** .planning/phases/127-volunteer-service-view-rehearse-order-of-service-stage-layout/127-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (per explicit fix instructions): WR-01, WR-02, WR-04, IN-01
- Fixed: 4
- Skipped: 0
- Not fixed by design (accepted residual / no-op, see below): WR-03, IN-02

## Fixed Issues

### WR-01: Desktop PDF-preview error fallback can navigate the volunteer off the SPA instead of downloading

**Files modified:** `src/components/rehearse/RehearseFileReader.vue`, `src/components/rehearse/__tests__/RehearseFileReader.test.ts`
**Commit:** c6e7a0c7
**Applied fix:** Replaced the plain `<a :href="attachment.downloadUrl" download>` error-state anchor with a `<button>` wired to the same `downloadAttachment()` fetch→blob→objectURL→synthetic-click helper the mobile Download button already uses, instead of a second bespoke implementation. Updated the existing "@error shows the errored fallback" test to assert a `<button>` (not an `<a href>`), and added a new test proving the click path fetches the URL and triggers a synthetic anchor click rather than navigating.

### WR-02: `serviceId` is captured non-reactively from the route — navigating between two rehearse links reuses the component and shows stale data

**Files modified:** `src/composables/useVolunteerServiceDoc.ts`, `src/views/VolunteerServiceView.vue`, `src/composables/__tests__/useVolunteerServiceDoc.test.ts`, `src/views/__tests__/VolunteerServiceView.test.ts`
**Commit:** c56c704b
**Applied fix:** `useVolunteerServiceDoc` now accepts `MaybeRefOrGetter<string>` and internally `watch()`s `toValue(serviceId)` with `{ immediate: true }` to re-run `load()` whenever the id changes, replacing the old call-once `void load()`. `VolunteerServiceView.vue` now passes a `computed(() => route.params.serviceId as string)` instead of a plain string captured once at `setup()` time. Also added a `watch(serviceId, ...)` in the view itself to reset per-service UI selection state (selected song, attachment, active track, mobile screen, active tab) on a serviceId change, so nothing from the previous service can visually linger while the new doc loads. Extended both test files: the composable test mounts a `ref` and asserts the doc/state update to the new service's data after the ref changes; the view test made `useRoute()`'s `params` reactive, asserts the view passes a reactive (non-string) source to the composable that tracks route changes, and asserts the selection-state reset behavior.

### WR-04: `roleAssignments.personNames` falls back to the raw internal `personId` when a scheduled person has since been deleted from the roster

**Files modified:** `src/utils/serviceProjection.ts`, `src/utils/rehearseAccess.ts`, `src/stores/services.ts`, `src/utils/rehearseAccess.test.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** a027dae3
**Applied fix:** Added a shared `REMOVED_PERSON_NAME` constant (`'(removed)'`) and `resolvePersonName(nameById, personId)` helper to `serviceProjection.ts` — the same shared-allowlist home already used for `mapSlotAllowlist`/`mapStageMarkerAllowlist` per this phase's own precedent — so the two PII boundaries can't drift independently. Both `buildRehearseAccess` (volunteer rehearse projection) and `buildServiceSnapshot` (public share-link projection) now call `resolvePersonName()` instead of the raw `nameById.get(id) ?? id` fallback. Added a test to each call site's suite proving a scheduled-but-since-deleted `personId` renders as `'(removed)'` and never leaks the raw id into `roleAssignments`.

### IN-01: `RehearseSongDetail.vue`'s `ccliNumber` prop is dead — it can never be populated

**Files modified:** `src/components/rehearse/RehearseSongDetail.vue`, `src/components/rehearse/__tests__/RehearseSongDetail.test.ts`
**Commit:** 323282d4
**Applied fix:** Removed the `ccliNumber` prop and the `ccliClause` it fed into `metaLine`. Confirmed (via grep) `VolunteerServiceView.vue` never bound `ccli-number` at either of its two `<RehearseSongDetail>` mount sites, so no caller-side change was needed. Updated the existing "full meta line" test to drop the `ccliNumber` prop and assert the meta line no longer contains "CCLI".

## Not Fixed (accepted / no-op by design)

### WR-03: `rehearseAccess/{serviceId}`'s whole-document grant exposes every assigned volunteer's raw email to every other assigned volunteer

**File:** `src/utils/rehearseAccess.ts:61-68`, enforced by `firestore.rules`
**Reason:** Explicitly excluded from this fix pass per instructions. This is a pre-existing shape (introduced Phase 125/126 for the My Schedule query), already traced and accepted by `126-REVIEW.md` at the time. A structural fix requires either a per-volunteer field restriction or splitting the aggregation into a separate, Cloud-Function-only document — the Firestore/Storage rules engine returns whole documents, and the collectionGroup list rule requires `assignedEmailsLower` in the doc, so this can't be narrowed with a client-side or field-allowlist change alone. Routed to the security backlog as an accepted residual; the list rule was left unweakened.

### IN-02: `buildServiceSnapshot`'s public payload silently grows a `bpm` field with no current renderer

**File:** `src/stores/services.ts:140-146`
**Reason:** The finding's own fix guidance states "No action required unless the 'identical shape' guarantee is meant literally... otherwise this is a fine, forward-compatible no-op." Not a security or correctness issue (unread field, no PII). Removing `resolveBpm` from the `buildServiceSnapshot` public path to force strict shape parity would itself be a behavior change requiring its own review (interacts with the `lockSnapshots/current` re-lock diff and existing bpm-ordering tests), so it does not meet the "trivially safe" bar for this pass. No code change made.

## Verification

- `npm run type-check` (vue-tsc --build, includes test files): clean, no errors.
- `npm run build`: succeeded (dist output produced, only the pre-existing "chunk >500kB" advisory warning, unrelated to this change).
- `npx vitest run` (full app suite): 209/210 files passed, 5401/5436 tests passed. The single failing file, `src/storage.rules.test.ts` (35 tests), is the documented pre-existing baseline failure (Storage-emulator `firestore.exists()` limitation — see CLAUDE.md) and is unchanged by this fix pass.
- `npm run test:rules`: not run — no `firestore.rules`/`storage.rules` changes were made in this pass.
- Targeted suites re-run individually during development, all green: `RehearseFileReader.test.ts` (10), `useVolunteerServiceDoc.test.ts` (9), `VolunteerServiceView.test.ts` (18), `rehearseAccess.test.ts` (19), `services.test.ts` (132), `services.sharePii.test.ts` (5), `services.stageLayout.test.ts` (9), `RehearseSongDetail.test.ts` (10).

---

_Fixed: 2026-09-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
