---
phase: 97-run-service-redesign
plan: 01
subsystem: run-service
tags: [composable, refactor, extraction, run-control, behaviour-preserving]
requires:
  - RunControlView.vue (Phase 92-96 control-core)
  - useServiceAssembly composable
  - runChannel / serviceSlots / monitorConfig utils
provides:
  - src/composables/useRunControl.ts (control-core seam)
  - RailRow exported row type
affects:
  - src/views/RunControlView.vue (script reduced to a single destructure)
tech-stack:
  added: []
  patterns:
    - "composable extraction mirroring useOutputWindow (options object with channelFactory, useServiceAssembly() called first, own onMounted/onUnmounted lifecycle, returns a plain object of refs+functions)"
key-files:
  created:
    - src/composables/useRunControl.ts
  modified:
    - src/views/RunControlView.vue
decisions:
  - "Extracted the ENTIRE Phase 92-96 control-core verbatim-in-behaviour into useRunControl.ts; RunControlView.vue is now template + one useRunControl({ channelFactory }) destructure. Zero behaviour change (R276 foundation seam)."
  - "Returned goBySlide/goByItem/postIndex in addition to the template-bound identifiers so 97-08/97-09 can wire the transport bar without re-plumbing; extra returns are harmless and forward-enabling."
  - "Output URLs (audienceUrl/confidenceUrl) left UNCHANGED (no &role=) — output self-fullscreen role comes from a composable option in 97-03, not a URL param."
metrics:
  duration: ~20m
  completed: 2026-08-29
status: complete
---

# Phase 97 Plan 01: useRunControl Extraction Summary

Behaviour-preserving extraction of RunControlView.vue's entire Phase 92-96 control-core into a new `src/composables/useRunControl.ts`, leaving the view as its unchanged template plus a single composable destructure — the low-regression seam every subsequent Phase 97 plan builds on.

## What the composable exposes

`useRunControl(options: UseRunControlOptions = {})` where `UseRunControlOptions = { channelFactory?: BroadcastChannelFactory }`. It calls `useServiceAssembly()` FIRST (so its subscribe onMounted registers before the channel-opening onMounted), owns the full machinery, registers its own `onMounted`/`onUnmounted`, and returns:

- **Service/nav model:** `serviceHeading`, `index`, `current`, `next`, `currentSlotIndex`
- **Rail:** `railRows` (typed `ComputedRef<RailRow[]>`), `firstIndexBySlot`, `countLabel`, `jumpToSlot`, `railRef`, `captureActiveRow`
- **Transport (forward-enabling extras):** `goBySlide`, `goByItem`, `postIndex`
- **Open state machine:** `outputStatus`, `readyAudienceLabel`, `readyConfidenceLabel`, `blockedRole`, `audienceClosed`, `confidenceClosed`, `monitorChanged`, `reassignRole`, `reopenOutput`, `reopenReassignedOutputs`, `openOutputs`
- **Exit confirm:** `confirmOpen`, `openExitConfirm`, `cancelExit`, `confirmExit`, `cancelBtnRef`

It also `export interface RailRow { index; section; title; count; hasSlides; isActive }` for downstream child components.

Internally preserved verbatim-in-behaviour: the single-writer channel (`index`/`seq`/`handle`/`postIndex`/`resendCurrent`, the on-mount slide-0 post, `watch(assembledSlideshow)` late-arrival post, `handle.onHello(resendCurrent)`), the honest open state machine (`OutputStatus`/`openOutputs`/`openPlaced`/`openUnplaced`/`bothOpened`/`openWindow`), the WR-01 stale guard (`goLiveRequestId`/`isUnmounted`), the Phase 96-01 recovery (`startClosedPoll`/`readClosed`/`onScreensChange`/`stopRecoveryWatchers`/`reopenOutput`/`reopenReassignedOutputs`/`liveScreenDetails`/`ScreenDetailsLike`/`resolveScreen`/`screenLabel`), the teardown ordering (`stopRecoveryWatchers` BEFORE `closeOutputs` in `confirmExit`; `isUnmounted`/`stopRecoveryWatchers`/`handle.close`/`removeEventListener` in `onUnmounted`), the document `handleKeydown`, and the `railRows` derivation.

## How RunControlView consumes it

The `<script setup>` was reduced from ~618 lines to: the `SlideCanvas` import (template concern), the `BroadcastChannelFactory` type import for the prop, the `useRunControl` import, `defineProps<{ channelFactory? }>()`, and a single destructure `const { ... } = useRunControl({ channelFactory: props.channelFactory })`. Every now-migrated import was deleted. The `<template>` and the top file comment are byte-for-byte unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `135497e3` feat(97-01): extract RunControlView control-core into useRunControl composable
- `5468b198` refactor(97-01): reduce RunControlView script to consume useRunControl

(Concurrent plans 97-02/97-03 interleaved in the linear log on different files; no index.lock contention occurred.)

## Gate Results

- `npm run type-check` (vue-tsc --build): **clean** (after both tasks).
- `npx vitest run src/views/__tests__/RunControlView.test.ts src/views/__tests__/RunControlView.output.test.ts`: **2 files / 37 tests passed**, both test files **UNMODIFIED** (`git diff --stat` empty for both).
- `npx vitest run` (full app suite, bare — no `--dir src`): **166 files / 4611 tests passed; only `src/storage.rules.test.ts` failing** (25 timeouts — the documented Storage-emulator environment limitation, not a regression). Baseline matches CLAUDE.md exactly.

## Self-Check: PASSED

- `src/composables/useRunControl.ts` — FOUND
- `src/views/RunControlView.vue` — FOUND (modified)
- Commit `135497e3` — FOUND
- Commit `5468b198` — FOUND
