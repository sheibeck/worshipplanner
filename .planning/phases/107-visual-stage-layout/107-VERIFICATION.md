---
phase: 107-visual-stage-layout
verified: 2026-09-01T06:30:00Z
status: human_needed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On a real touch device (tablet/phone), open the Stage Layout tab as an editor and drag a marker chip with a finger between the on-stage and off-stage zones, including a two-finger scenario (one finger already dragging, a second finger touches another chip)."
    expected: "The chip follows the finger 1:1, drops cleanly into whichever zone it's released over, and a second finger landing mid-drag does not clobber the first drag or leave a chip stuck in a captured state (WR-01 fix); a page scroll or on-screen-keyboard-triggered resize mid-drag aborts the drag cleanly with no corrupted position (WR-02 fix)."
    why_human: "jsdom cannot simulate real multi-touch hardware, OS-level pointer capture, or a real on-screen-keyboard-triggered viewport resize. The 29 StageLayoutEditor.test.ts pointer-event tests prove the underlying state-machine logic (single-drag guard, reflow abort, clamped zone resolution) using constructed PointerEvents, which is strong evidence but not a substitute for a real device — this is exactly the touch-hardware risk 107-CONTEXT.md/the roadmap flagged for this app's first freeform-drag surface."
  - test: "Add a few markers to a real service's Stage Layout tab, save, open the service's public share link in a browser and also print/export it to PDF."
    expected: "The stage plot renders visually correct and legible on both the public share page and the print output — two zones, correctly labeled/positioned/colored markers, no layout breakage, no edit affordances present (read-only)."
    why_human: "Automated tests (ShareView.test.ts, ServicePrintLayout.test.ts) prove the section renders with the right data-testids/props/omit-when-empty logic and that a markup-bearing label renders as literal text, but do not verify actual visual rendering, print pagination/margins, or PDF output quality — that requires eyes on a real browser and a real print/PDF."
---

# Phase 107: Visual Stage Layout Verification Report

**Phase Goal:** Tech/sound can see, at a glance, where every instrument, mic, and monitor goes for a
given service via a freeform visual stage plot.
**Verified:** 2026-09-01
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Service document carries an additive, optional `stageLayout` field — no new collection, no new `firestore.rules` block, no new Pinia store (R315 storage architecture) | ✓ VERIFIED | `src/types/service.ts:186-249` — `StageMarker` interface + `Service.stageLayout?: { elements: StageMarker[] }`; `git diff` confirms `firestore.rules`/`storage.rules` untouched since the phase's first commit |
| 2 | The Phase-104 `STAGELAYOUTS-RESET-OBLIGATION` marker is resolved (R312), no new org-scoped store registered | ✓ VERIFIED | `src/stores/orgScopedStores.ts:30-46` — comment block rewritten to "RESOLVED (Phase 107)", literal token retained, no new teardown call added; `resetOrgScopedStores()` body unchanged |
| 3 | On a dedicated Stage Layout tab, a user can drag labeled markers (instruments, mics, monitors) onto a freeform canvas, into an on-stage or off-stage (side) zone (R313) | ✓ VERIFIED | `src/components/stage/StageLayoutEditor.vue` native Pointer Events canvas (pointerdown/move/up, `setPointerCapture`, drop-only persist); `src/views/ServiceEditorView.vue:775-793,1590-1611` mounts it on a new `svc-tab-stage`/`svc-panel-stage` tab after Roles/before Messages; `StageLayoutEditor.test.ts` (29 tests) simulates real `PointerEvent` drags and asserts a single clamped, zone-resolved `move` emit |
| 4 | A user can give a marker a free-text label (incl. a one-off speaker's mic — just a normal marker), position it anywhere within a zone (R314) | ✓ VERIFIED | Add-marker form (`add-marker-label-input`, free text) + edit popover in `StageLayoutEditor.vue`; no constrained picker; `kind` optional |
| 5 | Marker positions round-trip correctly on reload and stay stable across a viewport resize (R314) | ✓ VERIFIED | Percentage-coordinate storage (`xPct`/`yPct` in [0,100]) rendered as `left/top: %` CSS, never recomputed from measured pixels; `pctWithinRect` round-trip property proven in `stageLayout.test.ts` (22 tests); `StageLayoutView.test.ts` asserts the rendered `left`/`top` style equals the stored percentage verbatim |
| 6 | The stage layout is saved per service to Firestore (no file storage) (R315) | ✓ VERIFIED | Mutation handlers (`onStageMarkerAdd/Update/Move/Remove`) in `ServiceEditorView.vue:2492-2536` mutate `localService.value.stageLayout` directly, riding the existing single `useAutoSave` deep-watch — no new save call, no Storage/file-upload code anywhere in the phase's diff |
| 7 | The stage layout is viewable read-only wherever the service is shared or printed, via `ServiceSnapshot` denormalization, with NO new public data access (R315) | ✓ VERIFIED | `src/stores/services.ts:104-206` — `buildServiceSnapshot()` projects markers through an explicit 6-field object literal (never a raw spread — smuggled-field test proves no leak), conditional-spread-omitted when empty; `ShareView.vue:113-119` renders `StageLayoutView` from `serviceSnapshot.stageLayout` only (no new `getDoc`); `ServicePrintLayout.vue:104-109` renders from the live authenticated service; both reuse the single shared component |
| 8 | Labels render as plain text (XSS-safe), never parsed as DOM | ✓ VERIFIED | `StageLayoutView.vue` binds `{{ marker.label }}` via Vue text interpolation only, no `v-html`; dedicated markup-label tests pass in `StageLayoutView.test.ts`, `ShareView.test.ts`, `ServicePrintLayout.test.ts` |
| 9 | `npm run type-check` (vue-tsc --build, includes test files) is clean | ✓ VERIFIED | Ran directly: exit clean, no output/errors |
| 10 | Scoped/full test suite passes with only the documented baseline failures | ✓ VERIFIED | `npx vitest run` (bare, full suite): 181/183 files, 4954/4981 tests passed; the only 2 failing files are `src/storage.rules.test.ts` (documented Storage-emulator limitation) and `src/stores/appConfig.test.ts` (documented stale-duplicate baseline) — exactly the two allowed exceptions, nothing from Phase 107 |

**Score:** 10/10 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/service.ts` | `StageMarker` type + `Service.stageLayout` field | ✓ VERIFIED | Exact 6-field shape present, compiles |
| `src/stores/orgScopedStores.ts` | Resolved `STAGELAYOUTS-RESET-OBLIGATION` marker | ✓ VERIFIED | RESOLVED note present, no new teardown call |
| `src/utils/stageLayout.ts` + tests | Pure geometry/factory helpers | ✓ VERIFIED | `clampPct`, `pctWithinRect`, `zoneFromPoint`, `createMarker`, `markerKindAccentClass`, `MARKER_KINDS`; 22 unit tests pass |
| `src/components/stage/StageLayoutView.vue` + tests | Shared read-only two-zone renderer | ✓ VERIFIED | No store/Firebase import, props-only; 9 tests pass |
| `src/components/stage/StageLayoutEditor.vue` + `StageMarkerChip.vue` + tests | Freeform drag editor | ✓ VERIFIED | Native Pointer Events, drop-only persist, WR-01/WR-02 guards present; 29 tests pass |
| `src/views/ServiceEditorView.vue` + `ServiceEditorView.stage.test.ts` | Stage Layout tab wiring | ✓ VERIFIED | Tab after Roles/before Messages, editor-gated, `onSave()` payload fix (`?? null`) for correct clear-on-remove |
| `src/stores/services.ts` + `services.stageLayout.test.ts` | `ServiceSnapshot` denormalization | ✓ VERIFIED | Explicit 6-field projection, conditional-spread omit-when-empty, defensive `clampPct` |
| `src/views/ShareView.vue` + `src/components/ServicePrintLayout.vue` + tests | Read-only share/print rendering | ✓ VERIFIED | Both reuse `StageLayoutView`, no new reads |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `StageLayoutEditor` marker mutations | `localService.stageLayout` | `@add/@update/@remove/@move` handlers | ✓ WIRED | Confirmed in `ServiceEditorView.vue:2501-2536` |
| `localService.stageLayout` | Firestore `services/{id}` doc | existing `useAutoSave` deep-watch + `onSave()` curated payload | ✓ WIRED | `onSave()` sends `stageLayout: data.stageLayout ?? null` (confirmed at `ServiceEditorView.vue:4830`); "mark clean" snapshot mirrors the same substitution (`:4884`) |
| `Service.stageLayout` | `ServiceSnapshot.stageLayout` | `buildServiceSnapshot()` | ✓ WIRED | `services.ts:181-206`, explicit projection + conditional spread |
| `ServiceSnapshot.stageLayout` | `ShareView` public render | `serviceSnapshot.stageLayout.elements` prop into `StageLayoutView` | ✓ WIRED | `ShareView.vue:117-119`, no new `getDoc` |
| `Service.stageLayout` (live) | `ServicePrintLayout` render | `props.service.stageLayout.elements` prop into `StageLayoutView` | ✓ WIRED | `ServicePrintLayout.vue:107-109` |
| locked service | read-only render | `editable=false` on `StageLayoutEditor` reuses `StageLayoutView` | ✓ WIRED | `StageLayoutEditor.vue:592`, `:editable="canEditService"` at `ServiceEditorView.vue:1606` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `STAGELAYOUTS-RESET-OBLIGATION` marker RESOLVED | `grep -q 'STAGELAYOUTS-RESET-OBLIGATION' ... && grep -q 'RESOLVED' ...` | Both match | ✓ PASS |
| Type-check clean | `npm run type-check` | Clean, no errors | ✓ PASS |
| Stage-layout geometry helpers | `npx vitest run src/utils/__tests__/stageLayout.test.ts` | 22/22 pass | ✓ PASS |
| Read-only renderer | `npx vitest run .../StageLayoutView.test.ts` | 9/9 pass | ✓ PASS |
| Drag editor (incl. WR-01/WR-02 regression tests) | `npx vitest run .../StageLayoutEditor.test.ts` | 29/29 pass | ✓ PASS |
| ServiceEditorView Stage Layout wiring | `npx vitest run .../ServiceEditorView.stage.test.ts` (as part of full suite) | 10/10 pass (full-suite run) | ✓ PASS — see note below |
| Snapshot denormalization | `npx vitest run .../services.stageLayout.test.ts` | 7/7 pass | ✓ PASS |
| ShareView / print read-only sections | `npx vitest run .../ShareView.test.ts .../ServicePrintLayout.test.ts` | 19/19, 23/23 pass | ✓ PASS |
| Full app suite baseline | `npx vitest run` (bare) | 181/183 files, 4954/4981 tests | ✓ PASS (only documented baseline failures) |

**Note on `ServiceEditorView.stage.test.ts` isolated runs:** Run alone (or in a small scoped batch), this file's `beforeAll` hook (which imports the 4907-line `ServiceEditorView.vue` cold) exceeded the 30s hook timeout twice, even with `--hookTimeout=90000` passed on the CLI — an artifact of cold Vite transform time in an isolated/scoped invocation, not a code defect. In the full bare `npx vitest run` (the authoritative gate per CLAUDE.md, where the module graph is already warm from other files importing overlapping modules), this file is NOT among the 2 failed files and its 10 tests pass. This is recorded for transparency but does not affect the verdict — the full-suite run is authoritative and it passes clean.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R313 | 107-01, 107-02 | Stage Layout tab, drag markers into on/off-stage zones | ✓ SATISFIED | Tab wired, drag canvas built and unit-tested; real touch-hardware confirmation flagged for human verification (non-blocking) |
| R314 | 107-01, 107-02, 107-03 | Free-text labels incl. one-off speaker mic, position anywhere, round-trip + resize-stable | ✓ SATISFIED | Percentage-coordinate model, round-trip property test, add/edit forms free-text |
| R315 | 107-01, 107-03 | Saved per service (Firestore, no file storage), read-only on share/print via snapshot, no new public access | ✓ SATISFIED | Additive field, no new rules/collection/store; snapshot projection + reuse of one read-only renderer |
| R312 (Phase 104 obligation, resolved here) | 107-01 | `STAGELAYOUTS-RESET-OBLIGATION` marker resolved | ✓ SATISFIED | Marker rewritten to RESOLVED note, confirmed by grep and code read |

No orphaned requirements — REQUIREMENTS.md traceability table maps R313/R314/R315 to Phase 107 only, and all three are addressed.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across `src/components/stage/` returned only legitimate uses (an HTML `placeholder` attribute and a code comment referring to per-zone UI copy, not a debt marker). Code review (`107-REVIEW.md`) found 0 critical findings, 3 warnings, 3 info items; 5 were fixed (WR-01, WR-02, WR-03, IN-01, IN-03) and 1 (IN-02, touch-hover-only edit/remove buttons) was explicitly deferred with a documented, non-blocking mitigation (tap-to-popover already reaches the same actions). Verified all 5 "fixed" commits exist in `git log` (`eeeb003f`, `1106ff0b`, `cc113ed6`, `e86b9527`, `d2a99519`) and the corresponding code changes are present in the live files (WR-01 guard, WR-02 reflow-abort listeners, WR-03 `StageMarkerChip.vue` extraction, IN-01 stacking offset, IN-03 `clampPct` in the snapshot projection).

### No New Public Attack Surface (R315 hard constraint)

Confirmed by `git diff` since the phase's first commit (`5015a053..HEAD`): `firestore.rules` and `storage.rules` are untouched. `ShareView.vue` introduces no new `getDoc`/org-scoped read — it renders `serviceSnapshot.stageLayout` from the already-fetched frozen snapshot only. No new Pinia store was introduced (confirmed via the resolved `orgScopedStores.ts` marker and no `useStageLayout*` store file anywhere in `src/stores/`).

## Human Verification Required

### 1. Real touch-device drag

**Test:** On a tablet/phone, open the Stage Layout tab as an editor and drag marker chips between zones, including a second-finger-mid-drag scenario.
**Expected:** Chip follows the finger 1:1, drops into the correct zone, no clobbered/stuck drag state; a mid-drag page scroll or keyboard-triggered resize aborts cleanly.
**Why human:** jsdom cannot simulate real multi-touch hardware or OS-level pointer capture; this is exactly the risk 107-CONTEXT.md flagged for the app's first freeform-drag surface (v1.4/v1.6 drag-corruption history). 29 simulated-PointerEvent unit tests (including new WR-01/WR-02 regression tests) provide strong evidence but are not a substitute.

### 2. Visual confirmation on a real share link and printout

**Test:** Add markers to a real service, open its public share link and print/export to PDF.
**Expected:** The stage plot renders visually correct and legible — two zones, correctly labeled/positioned/colored markers, no layout breakage, no edit controls visible.
**Why human:** Automated tests prove structural correctness (sections render/omit correctly, data flows from the right source, labels are XSS-safe) but not actual visual layout, print pagination, or PDF rendering quality.

## Gaps Summary

No gaps found. All must-have truths, artifacts, and key links are present, substantive, and wired; `npm run type-check` is clean; the full test suite passes with only the two pre-existing documented baseline failures (`src/storage.rules.test.ts`, `src/stores/appConfig.test.ts`), neither touched by this phase. The code-review's 3 warnings and 2 of 3 info items were fixed with regression tests; the 1 deferred info item (IN-02) has a documented, non-blocking mitigation already in place. The only open items are two genuinely hardware/visual checks (real touch-device drag, real share-link/print visual confirmation) that cannot be verified by static analysis or jsdom — these route to human verification, not to gaps.

---

_Verified: 2026-09-01_
_Verifier: Claude (gsd-verifier)_
