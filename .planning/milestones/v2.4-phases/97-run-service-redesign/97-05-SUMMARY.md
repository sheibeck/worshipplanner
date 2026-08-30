---
phase: 97-run-service-redesign
plan: 05
subsystem: run-service-control
tags: [vue, presentational, run-control, R276, R282]
requires:
  - "97-01: useRunControl extraction (parent will supply props/consume emits)"
provides:
  - "RunPreflightPanel.vue — State-A pre-flight column (Go live / Rehearse)"
  - "RunPreviewPair.vue — program + smaller next-up preview pair"
  - "RunFilmstrip.vue — in-item click-to-jump strip emitting array index"
affects:
  - "97-09 wires all three into RunControlView"
tech-stack:
  added: []
  patterns:
    - "Pure props-in/emits-out presentational children (no channel/store)"
    - "transform:scale container to shrink a SlideCanvas (no font-size prop)"
    - "Parallel slides[]/indices[] zip via computed to satisfy noUncheckedIndexedAccess"
key-files:
  created:
    - src/components/run/RunPreflightPanel.vue
    - src/components/run/RunPreviewPair.vue
    - src/components/run/RunFilmstrip.vue
    - src/components/run/__tests__/RunFilmstrip.test.ts
  modified: []
decisions:
  - "RunFilmstrip zips slides+indices into a computed { slide, index } (index fallback -1) to keep the template free of number|undefined parallel-array reads under noUncheckedIndexedAccess"
  - "Live frame is GREEN not red (owner fix #4) on both RunPreviewPair program frame and RunFilmstrip current thumb"
  - "run-go-live-btn relocated to RunPreflightPanel keeps the exact testid the output suite drives"
metrics:
  duration: ~25m
  completed: 2026-08-29
status: complete
---

# Phase 97 Plan 05: Run-body Presentational Components Summary

Three pure presentational Run-body components (R276 pre-flight + preview split, R282 in-item filmstrip) built as props-in/emits-out children, ready for 97-09 to wire into RunControlView.

## What was built

- **`RunPreflightPanel.vue`** (R276 State A) — centered "Ready when you are" column. Props `{ serviceName, slideCount, itemCount, renderedCount, allRendered, audienceLabel, confidenceLabel }`. Audience + Confidence display cards (each: monitor label, amber "Not open" badge, Change link), an honest readiness line (green "All N slides rendered" when `allRendered`, else amber "R of N slides rendered" — driven by renderState-derived props, NOT CCLI), the primary **Go live** button carrying `data-testid=run-go-live-btn` (emits `@go-live`), a secondary **Rehearse without screens** (emits `@rehearse`), plus `@change-audience`/`@change-confidence` and an Enter key hint. No channel/store/getScreenDetails.
- **`RunPreviewPair.vue`** (R276 owner fix #2/#4) — program (dominant, LEFT) + next-up (subordinate, RIGHT). Props `{ current, next, live, nextScale? }` (nextScale default 0.8). Program frame is GREEN ring + "LIVE" tag only when `live`; next-up SlideCanvas is wrapped in a `transform: scale(nextScale)` container (transform-origin top center) so it renders smaller. Real `<SlideCanvas :interactive="false">`; preserves `run-current-preview`/`run-next-preview` testids and the exact "End of service" empty-next copy. No emits, no `run-take`/`run-push-live` testid (single-selection contract preserved).
- **`RunFilmstrip.vue`** (R282) — "Slides in this item" horizontal strip. Props `{ slides: AssembledSlide[], indices: number[], currentIndex: number | null }`, emits `{ jump: [index] }`. Renders each slide as a scaled non-interactive SlideCanvas thumb (`run-filmstrip-slide`, `:data-index`); current (`indices[i] === currentIndex`) gets the green live frame, others an accent frame. `@click` emits `indices[i]` (the GLOBAL array index) — never the loop index. The which-slides + index derivation stays the parent's job (97-08).
- **`RunFilmstrip.test.ts`** — mounts with `slides=[a,b,c]`, `indices=[2,3,4]`, `currentIndex=3`; asserts three thumbs render, the `data-index=3` thumb carries `ring-green-500` (others do not), clicking thumb 0 emits `jump 2` and thumb 2 emits `jump 4`. Proves the array-index emit contract (T-97-05-01).

## Prop/emit contracts (for 97-09 wiring)

- `RunPreflightPanel` — props `{ serviceName, slideCount, itemCount, renderedCount, allRendered, audienceLabel, confidenceLabel }`; emits `go-live`, `rehearse`, `change-audience`, `change-confidence`.
- `RunPreviewPair` — props `{ current, next, live, nextScale? }`; no emits.
- `RunFilmstrip` — props `{ slides, indices, currentIndex }`; emits `jump(index)` (the global array index).

## Deviations from Plan

**1. [Rule 3 - Blocking] RunFilmstrip parallel-array index access under `noUncheckedIndexedAccess`**
- **Found during:** Task 3 type-check.
- **Issue:** `indices[i]` in the template is typed `number | undefined`, so `emit('jump', indices[i])` failed TS2345.
- **Fix:** Added a `thumbs` computed that zips `slides.map((slide, i) => ({ slide, index: indices[i] ?? -1 }))`; the template iterates `thumbs` and reads `thumb.index` (a plain `number`). Behavior unchanged — the contract guarantees `indices` is the same length as `slides`.
- **Files modified:** src/components/run/RunFilmstrip.vue
- **Commit:** bb61efb4

**2. [Rule 1 - Bug] Test fixture used invalid SlotKind / unsafe array access**
- **Found during:** Task 3 type-check.
- **Issue:** Fixture used `slotKind: 'misc'` (SlotKind is uppercase) and `thumbs[0].classes()` was `possibly undefined`.
- **Fix:** `'MISC'` + non-null assertions on the `findAll` results.
- **Files modified:** src/components/run/__tests__/RunFilmstrip.test.ts
- **Commit:** bb61efb4

## Verification / Gate Results

- `npm run type-check` (vue-tsc --build, typechecks tests too): **clean**.
- `npx vitest run` (bare, the correct scoped command): **169 passed, 1 failed — only `src/storage.rules.test.ts`** (25 Storage-emulator-timeout tests), the exact documented baseline (firebase-js-sdk#6803). New `RunFilmstrip.test.ts` passes; all other files green. Not chased.
- Grep gates: `run-preflight`/`run-go-live-btn`/`run-rehearse-btn`/`run-readiness` present; `run-current-preview`/`run-next-preview`/`End of service`/`scale` present and no `run-take`/`run-push-live` in RunPreviewPair; `run-filmstrip-slide` present in RunFilmstrip.

## Self-Check: PASSED
- FOUND: src/components/run/RunPreflightPanel.vue
- FOUND: src/components/run/RunPreviewPair.vue
- FOUND: src/components/run/RunFilmstrip.vue
- FOUND: src/components/run/__tests__/RunFilmstrip.test.ts
- FOUND commit 60e609f3 (RunPreflightPanel)
- FOUND commit 408c424e (RunPreviewPair)
- FOUND commit bb61efb4 (RunFilmstrip + test)
