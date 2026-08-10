---
phase: 50-slide-management-bulk-delete-provenance
verified: 2026-08-10T21:57:11Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "After a real `firebase deploy`, load the production app in a browser that previously had the app cached, without a manual cache-clear."
    expected: "The browser re-fetches `index.html` (network tab shows a fresh request, not `(disk cache)`/`(memory cache)`) and the page reflects the newly deployed bundle immediately."
    why_human: "R109 is deploy-gated by the standing v1.5 NO-DEPLOYS grant — no `firebase deploy` was run during this phase. The in-repo proof (firebase.json header + guarded test) is complete and green, but actual post-deploy browser cache behavior can only be observed after a real deploy, which is the owner's step."
  - test: "Import a real multi-image PPTX deck (a deck where at least one source slide contains more than one image, so parsed-slide count ≠ rendered-page count) into a group, hand-add one of its slides into another (non-imported) group, and watch it render in the presentation viewer once the render pipeline finishes."
    expected: "The hand-added slide shows the correct rendered page image (not a perpetual 'Rendering' placeholder) — proving `renderedPage` round-trips correctly through a live PPTX upload/parse/render cycle, not just the unit-test fixtures."
    why_human: "R108's resolution logic is proven by unit tests (importedRenderReconciler.test.ts, slideshowAssembler.test.ts, PptxImportModal.test.ts, SlideGrid.test.ts, pptxParser.test.ts) that construct the multi-image scenario synthetically. A live PPTX round-trip through the actual render service (Cloud Function → render-service → Firebase Storage → client) has not been executed in this verification and is the kind of end-to-end integration behavior automated checks cannot fully substitute for."
---

# Phase 50: Slide Management — Bulk Delete, Manual/Auto Provenance & Render Fidelity Verification Report

**Phase Goal:** A user can bulk-remove imported PPTX slides from a group; regeneration never destroys manually-added slides; hand-added imported slides always render (even for multi-image decks); and deploys are visible without a manual cache-clear.
**Verified:** 2026-08-10T21:57:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R106: A per-group "Remove imported slides" action removes exactly the group's `imported`-kind entries in one operation and leaves every auto-generated and other manually-added entry untouched | ✓ VERIFIED | `src/components/slides/SlideGrid.vue:712-732` `onRemoveImportedSlides` filters `entry.sourceRef.kind !== 'imported'`, renumbers survivors, calls `replaceGroupSlides(orgId, slotId, renumbered, group.sourceSignature, group.slides)`. Gated by `showRemoveImportedControl = canMutateGroup && hasImportedEntries` (lines 531-534) and re-checked in the handler. Button at lines 199-205 with `data-testid="slide-grid-remove-imported-btn"`. 6 new tests (`SlideGrid.test.ts` describe block "remove imported slides action (group-level button, R106)") cover happy path, cancel, no-imported-entries, locked, non-editor, SONG-group. Full suite run: 132/132 SlideGrid tests pass. |
| 2 | R107: Rebuilding a group's auto-generated slides on a service change — including scripture↔congregational toggle — preserves every manually-added entry in place; only derived entries re-derive | ✓ VERIFIED | `git log` confirms `src/utils/slideGroupMaterializer.ts` was NOT touched by this phase (last commit `0b52210`, phase 45) — the existing `isSlotDerivableRef`/`survivingEntries`/`carryStoredDerivedEntries`/`orderedByStoredPosition` machinery already satisfied R107. New suite `src/utils/__tests__/manualAddPreservation.test.ts` (9 tests) proves it across SONG (song-swap + within-song edit), IMPORTED (own-deck re-import with a foreign-deck entry present), SCRIPTURE (all 5 rebuild branches incl. Reference↔Congregational), and PRAYER (no-op) paths, asserting both survival AND that derived entries actually re-derived. Full run: 9/9 pass, no regression in sibling suites (`slideGroupMaterializer.test.ts` 126/126, `congregationalDetachment.test.ts` 16/16). |
| 3 | R108: A manually-added imported slide resolves to its correct rendered page for a multi-image deck, via a render-stable page identity on the entry, superseding the interim 1:1 positional fallback | ✓ VERIFIED (logic); see human_verification for live round-trip | Data recorded end-to-end: `functions/src/pptxParser.ts` `mapAstToSlides` stamps 1-based `sourcePage` on every `MappedSlide` (shared across multi-image entries on one source slide, advances across skipped slides) — `functions/src/pptxParser.test.ts` 17/17 pass. `src/types/slide.ts` `ImageSlide`/`TextSlide.sourcePage?`, `src/types/slideGroup.ts` `SourceRef` imported variant gains `renderedPage?: number` (explicitly excluded from `derivedIdentityKey`). `PptxImportModal.vue` threads it; `SlideGrid.vue::onImportConfirmed` records `renderedPage` on add. Consumption: `src/utils/importedRenderReconciler.ts:262-269` resolution order is synthetic identity → supplied `renderedPage` → 1:1 positional fallback → pending, exactly matching the PLAN's specified order; `src/utils/slideshowAssembler.ts:263` threads `ref.renderedPage` through. `importedRenderReconciler.test.ts` (38 tests) and `slideshowAssembler.test.ts` (99 tests) pass, including the specific multi-image-resolves-via-renderedPage and mismatched-count-stays-pending-without-renderedPage cases. |
| 4 | R109: After a production deploy, a normal page load shows the new bundle with no manual cache-clear — `index.html` is served no-cache/revalidate | ✓ VERIFIED (in-repo); see human_verification for post-deploy confirmation | `firebase.json` `hosting.headers` contains `{ source: "/index.html", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }` (lines 28-38); no header narrows `assets/**`. `src/__tests__/firebaseHostingHeaders.test.ts` reads `firebase.json` from disk (not a bundled import) and asserts both invariants — 2/2 pass. Confirmed by grep: no `serviceWorker.register`, `vite-plugin-pwa`, or `workbox` usage anywhere in `src/`, `vite.config.ts`, or `package.json`, so the hosting header is the sole cache authority for the shell. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firebase.json` | `hosting.headers` no-cache entry for `/index.html`, assets untouched | ✓ VERIFIED | Present, correct, valid JSON |
| `src/__tests__/firebaseHostingHeaders.test.ts` | Guards the header | ✓ VERIFIED | 2/2 tests pass |
| `src/utils/__tests__/manualAddPreservation.test.ts` | R107 preservation suite | ✓ VERIFIED | 9/9 tests pass, exercises every rebuild branch |
| `src/utils/slideGroupMaterializer.ts` | Unmodified (R107 needed no fix) | ✓ VERIFIED | `git log` confirms no phase-50 commit touched this file |
| `functions/src/pptxParser.ts` (`MappedSlide.sourcePage`) | Records 1-based source page | ✓ VERIFIED | Present; 17/17 parser tests pass |
| `src/types/slide.ts` (`ImageSlide`/`TextSlide.sourcePage`) | Optional mirror field | ✓ VERIFIED | Present, optional |
| `src/types/slideGroup.ts` (`SourceRef.renderedPage`) | Optional provenance field, excluded from identity key | ✓ VERIFIED | Present, doc comment confirms exclusion |
| `src/components/PptxImportModal.vue` | Threads `sourcePage` into deck slides | ✓ VERIFIED | Per SUMMARY + passing `PptxImportModal.test.ts` (13/13) |
| `src/components/slides/SlideGrid.vue` (`onImportConfirmed` + R106 control) | Records `renderedPage`; hosts remove-imported control | ✓ VERIFIED | Both present, wired, tested |
| `src/utils/importedRenderReconciler.ts` (`importedEntryContent`) | Prefers `renderedPage` in ready mode | ✓ VERIFIED | Resolution order matches plan spec exactly |
| `src/utils/slideshowAssembler.ts` (`resolveEntryContent`) | Threads `ref.renderedPage` | ✓ VERIFIED | Line 263 confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SlideGrid.vue::onRemoveImportedSlides` | `slideGroups` store `replaceGroupSlides` | filter + renumber + CAS write with `baseSlides` | ✓ WIRED | Confirmed at line 722-728; test asserts exact call args |
| `mapAstToSlides` source-slide loop index | `SourceRef.renderedPage` at add-time | `MappedSlide.sourcePage` → parse payload → deck slide → `SlideGrid.onImportConfirmed` | ✓ WIRED | Traced through all 4 files; optional-field propagation confirmed at each hop |
| `slideshowAssembler.resolveEntryContent` (imported case) | `importedEntryContent` | `ref.renderedPage` passed as last positional arg | ✓ WIRED | Line 263: `importedEntryContent(deck, resolution, ref.innerSlideId, urls, ref.renderedPage)` |
| `isSlotDerivableRef` / `survivingEntries` | manual entry preservation on rebuild | existing classification routes non-derivable entries to survivors | ✓ WIRED | Verified via 9-case test suite; no code change was required |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| R109 header test | `npx vitest run src/__tests__/firebaseHostingHeaders.test.ts` | 2/2 pass | ✓ PASS |
| R106 SlideGrid suite | `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` | 132/132 pass | ✓ PASS |
| R107 preservation suite | `npx vitest run src/utils/__tests__/manualAddPreservation.test.ts` (via full-dir run) | 9/9 pass | ✓ PASS |
| R107 no regression | sibling suites `slideGroupMaterializer.test.ts`, `congregationalDetachment.test.ts` | 126/126, 16/16 pass | ✓ PASS |
| R108 parser | `cd functions && npx vitest run src/pptxParser.test.ts` | 17/17 pass | ✓ PASS |
| R108 modal | `npx vitest run src/components/__tests__/PptxImportModal.test.ts` | 13/13 pass | ✓ PASS |
| R108 reconciler + assembler | (in full-dir run) `importedRenderReconciler.test.ts`, `slideshowAssembler.test.ts` | 38/38, 99/99 pass | ✓ PASS |
| Type-check gate | `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) | clean, no errors | ✓ PASS |
| Full app suite baseline | `npx vitest run --dir src --exclude '**/rules.test.ts'` | 2988/3001 passing (documented run cited in task); confirmed spot-run shows only the 2 documented baseline files failing, no new failures | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R106 | 50-04 | Per-group "Remove imported slides" bulk action | ✓ SATISFIED | Code + tests verified above; REQUIREMENTS.md checked `[x]` |
| R107 | 50-02 | Regeneration preserves manual adds | ✓ SATISFIED | Code (unchanged) + new proof suite verified above; REQUIREMENTS.md checked `[x]` |
| R108 | 50-03 (record) + 50-05 (consume) | Render-stable page identity for hand-added imported slides | ✓ SATISFIED (logic); live round-trip is human_verification | Data + resolution code verified above; REQUIREMENTS.md checked `[x]` |
| R109 | 50-01 | Deploy cache — no-cache index.html | ✓ SATISFIED (in-repo); post-deploy behavior is human_verification | Config + guard test verified above; REQUIREMENTS.md checked `[x]` |

All 4 requirement IDs declared across the phase's plans (R106, R107, R108, R109) are accounted for in `.planning/REQUIREMENTS.md`'s checklist (`- [x] **R10x**: ...`), which per the verification task's instructions is the authoritative traceability surface. The traceability MATRIX table has no rows for R105–R109 — confirmed by grep (`^|.*R10[5-9]` finds nothing) — but this is a pre-existing structural gap noted in the task brief and in 50-05-SUMMARY.md, not introduced by this phase. Observation only, not a phase failure.

### Anti-Patterns Found

None. Scanned all files touched by this phase's plans (`firebase.json`, `src/__tests__/firebaseHostingHeaders.test.ts`, `src/utils/__tests__/manualAddPreservation.test.ts`, `functions/src/pptxParser.ts`, `src/types/slide.ts`, `src/types/slideGroup.ts`, `src/components/PptxImportModal.vue`, `src/components/slides/SlideGrid.vue`, `src/utils/importedRenderReconciler.ts`, `src/utils/slideshowAssembler.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero matches.

### Human Verification Required

### 1. R109 post-deploy cache behavior

**Test:** After a real `firebase deploy`, load the production app in a browser that previously had the app cached, without doing a manual cache-clear.
**Expected:** The browser re-fetches `index.html` (a fresh network request, not served from disk/memory cache) and immediately reflects the newly deployed bundle.
**Why human:** Deploy-gated per the standing v1.5 NO-DEPLOYS grant — no `firebase deploy` was run in this phase or during verification. The in-repo proof (correct header + guarding test) is complete; only the owner's own deploy can confirm the real browser behavior.

### 2. R108 live multi-image PPTX round-trip

**Test:** Import a real multi-image PPTX deck (at least one source slide with more than one image) into a group, hand-add one of its slides into a different (non-imported) group, and observe it once the render pipeline (Cloud Function → render-service → Storage) finishes.
**Expected:** The hand-added slide displays the correct rendered page image, not a perpetual "Rendering" placeholder.
**Why human:** The resolution logic and every code path are proven by unit tests using synthetic fixtures (mismatched parsed/rendered counts, `renderedPage` supplied vs. omitted). A live upload/parse/render round trip through the actual render service has not been exercised in this verification and exercises integration surface unit tests cannot fully substitute for.

### Gaps Summary

No gaps. All four observable truths (R106–R109) are backed by real, wired, tested code — not stubs or placeholders. The two items above are routed to human verification per the standing autonomy grant (deploy-gated and live-integration concerns), not treated as blocking gaps.

---

*Verified: 2026-08-10T21:57:11Z*
*Verifier: Claude (gsd-verifier)*
