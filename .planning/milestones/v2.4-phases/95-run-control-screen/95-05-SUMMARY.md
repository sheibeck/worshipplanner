---
phase: 95-run-control-screen
plan: 05
subsystem: run-mode
tags: [testing, run-control, broadcast-channel, keyboard-nav, vitest]
requires:
  - "src/views/RunControlView.vue (95-03/95-04)"
  - "src/utils/runChannel.ts (openRunChannel single-writer + stale-drop)"
  - "src/utils/serviceSlots.ts (sortedSlotsWithIndex + firstAssembledIndexBySlot)"
  - "src/composables/useServiceAssembly.ts"
provides:
  - "Behavioral test suite proving RunControlView's R262-R266 control contract"
affects:
  - "src/views/__tests__/RunControlView.test.ts"
tech-stack:
  added: []
  patterns:
    - "Injected in-memory BroadcastChannelLike (createFakeChannel) driving the REAL openRunChannel — asserts POSTED messages (writer side), the inverse of AudienceOutputView.test.ts's never-posts assertion"
    - "Captured useSlideshowAssembly ref (H.assembledRef) so the real watch(assembledSlideshow) late-arrival path is drivable"
    - "Teleport-to-body dialog queried via document.body.querySelector for the exit-confirm assertions"
key-files:
  created:
    - src/views/__tests__/RunControlView.test.ts
  modified: []
decisions:
  - "Reused the AudienceOutputView.test.ts harness lineage verbatim (reactive vue-router mock, inert @/firebase, mocked stores + assembly, stubbed SlideCanvas, enableAutoUnmount) and adapted it to the WRITER: assert what the view POSTS and push hello INTO it"
  - "Stubbed window.open -> null and deleted getScreenDetails defensively even though the on-mount path never opens a window (openOutputs runs only from Go live)"
  - "Avoided Array.prototype.at entirely — used bracket indexing for last-element reads (project constraint)"
metrics:
  duration: ~18m
  completed: 2026-08-28
  tasks: 1
  files: 1
status: complete
---

# Phase 95 Plan 05: RunControlView CORE behavioral tests Summary

Authored `src/views/__tests__/RunControlView.test.ts` (12 tests, all passing) proving RunControlView's operator-facing control contract against the REAL view, driving the REAL `openRunChannel` through an injected in-memory `BroadcastChannelLike` so seq monotonicity and onHello resend are asserted against production stale-drop logic rather than a bypass.

## What was built

A single behavioral suite covering R262-R266 across five describe blocks:

- **Single-writer + monotonic seq (R266):** the view posts `state` slide 0 on mount, posts on every navigation with a STRICTLY INCREASING seq (asserted by collecting every posted state seq and checking `seqs[i] > seqs[i-1]`), resends the CURRENT index with a higher seq on an inbound `hello`, and goes live exactly once on a late-arriving assembly (`watch(assembledSlideshow)`) with NO double slide-0 post.
- **Rail (R262/R263):** the `data-active="true"` row is the one whose slot index === `current.slotIndex` (correlated by item title) and moves on navigation; clicking a has-slides row posts the index from `firstAssembledIndexBySlot(...).get(2)`; clicking `rail-item-empty` (slot 1, no assembled slides) posts nothing; a zero-slide service renders the `run-rail-empty` "Nothing to present yet" state.
- **Keyboard (R265):** ArrowRight and Space each post +1, ArrowLeft posts -1 (clamped at 0), ArrowDown/ArrowUp move to the next/previous order item's first assembled slide (skipping the empty slot 1 → landing on slot 2's index).
- **Escape opens confirm, never teardown (R265):** Escape OPENS `run-exit-dialog` (teleported to body) while the channel stays open and the component stays mounted (`fake.close` not called, `run-service-name` still present); a further ArrowRight posts NOTHING while the dialog is open (keys inert); clicking the red `run-exit-confirm` closes the channel once and calls `router.push({ name: 'service-editor', params: { id: 'service-1' } })`.
- **Dual preview + single-selection (R264/R266):** the current pane shows the slide at the index and the next pane shows index+1; at the last slide the next pane shows "End of service"; no push-to-live control exists (`run-push-live`/`run-take` absent) and a single navigation posts state immediately.

## Confirmations requested

- **Seq monotonicity:** proven in `posts state slide 0 on mount and a STRICTLY INCREASING seq on every navigation` — seqs collected across mount + 3 navigations and asserted strictly increasing; posted indices `[0, 1, 2, 1]`.
- **Escape is NOT teardown:** proven in `Escape OPENS the exit dialog WITHOUT closing the channel or unmounting` — after Escape, `fake.close` is NOT called, the component is still mounted, and a subsequent ArrowRight adds zero posts.

## Deviations from Plan

**Router-link stub added** — the fallback banner references `<router-link>` (never rendered in these control-behavior tests). Added a passthrough `RouterLink` stub via `global.stubs` to silence the resolve warning, exactly as the plan's `<read_first>` anticipated ("include RouterLink as a passthrough stub if RunControlView uses it"). No other deviations — the plan executed as written.

## Gate results

- `npx vitest run src/views/__tests__/RunControlView.test.ts` → **12 passed** (1 file).
- `npm run type-check` (vue-tsc --build) → **clean** (no output/errors).
- Bare `npx vitest run` → **166 of 167 files pass**; the only failing file is the documented baseline `src/storage.rules.test.ts` (25 failures, Storage-emulator cross-service `firestore.exists()` limitation per CLAUDE.md). No regression; the new file is green within the wider suite.

## Self-Check: PASSED

- FOUND: src/views/__tests__/RunControlView.test.ts
- FOUND: commit 7125411a
