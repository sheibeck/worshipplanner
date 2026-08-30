---
phase: 95
plan: 03
subsystem: run-control
tags: [vue, run-mode, broadcast-channel, presentation, router]
requires:
  - "useServiceAssembly() (95-01): { serviceId, orgIdRef, localService, assembledSlideshow }"
  - "openRunChannel + RunChannelHandle (Phase 91 src/utils/runChannel.ts)"
  - "sortedSlotsWithIndex + firstAssembledIndexBySlot (Phase 91 src/utils/serviceSlots.ts)"
  - "SlideCanvas (Phase 90 src/components/slides/SlideCanvas.vue)"
provides:
  - "RunControlView.vue — standalone operator control surface + single-writer run channel"
  - "Route /run/:serviceId (name run-control, requiresAuth only)"
affects:
  - "95-04 (window orchestration): confirmExit + top-bar status cluster seams left in place"
  - "95-05 (behavioral tests): RunControlView test seams (channelFactory prop, data-testids)"
tech-stack:
  added: []
  patterns:
    - "Single-writer BroadcastChannel: view-owned monotonic seq incremented ONLY in postIndex/resendCurrent"
    - "channelFactory prop seam mirroring AudienceOutputView for deterministic tests"
    - "Direct [i]/[i+1] index access (NO Array.prototype.at — absent from TS lib target)"
key-files:
  created:
    - src/views/RunControlView.vue
  modified:
    - src/router/index.ts
decisions:
  - "Rail item title derived per-kind (songTitle/hymnName/miscLabel) falling back to slotLabel(); section label from SERVICE_SECTION_LABELS"
  - "slideCountBySlot computed locally for the rail's per-item count (firstAssembledIndexBySlot gives only the first index)"
metrics:
  tasks: 2
  files: 2
  duration: ~25m
  completed: 2026-08-28
status: complete
---

# Phase 95 Plan 03: RunControlView core + /run/:serviceId route Summary

The standalone Run/Control operator surface — a full-viewport dark shell (not AppShell) that self-bootstraps via `useServiceAssembly()` and is the SINGLE WRITER of the `wp-run-{serviceId}` channel, driving a locked service with a you-are-here rail, a dominant-LIVE + subordinate-Next preview, keyboard navigation, and an Escape-guarded exit — plus its `requiresAuth`-only `/run/:serviceId` route.

## What was built

### RunControlView.vue (Task 1, commit 9b6bb489)
- **Shell (R261):** root `fixed inset-0 flex flex-col bg-gray-950 text-gray-100`; three bands — top bar (`h-14`, service name + always-visible Exit ghost X button), main region (`flex-1 min-h-0 flex` = rail + preview stage), bottom keyboard legend strip (`h-9`). A labelled `ml-auto` gap and a `confirmExit` seam comment are left for 95-04's output-status cluster / `closeOutputs()`.
- **Single-writer channel (R266):** `index = ref<number|null>`, a module-scope `let seq = 0`, and `handle: RunChannelHandle | null`. `postIndex(target)` is the ONE writer — sets `index`, `seq += 1`, `handle.postState({ index, blackout:false, seq })`. Called by every navigation; `onMounted` opens the channel via `openRunChannel(serviceId.value, props.channelFactory)`, registers `onHello(resendCurrent)` (which also advances `seq`), and posts slide 0 once slides exist; a `watch(assembledSlideshow)` covers late-arriving assembly (guarded against a double slide-0 post); `onUnmounted` closes the channel + removes the keydown listener. No `unsubscribeAll` (shared in-app route).
- **Rail (R262/R263):** off `sortedSlotsWithIndex(localService)` enriched into `railRows` (section label, title, count, `hasSlides`, `isActive === item.index === current.slotIndex`). Three states: default has-slides `<button>` (whole-row click → `jumpToSlot` → `firstAssembledIndexBySlot.get(index)`), active row (`bg-indigo-600/15` + `border-l-2 border-indigo-500` + `font-semibold` + indigo dot, captured via a function ref and auto-scrolled `block:'nearest'` on every `index` change), and a non-interactive `<div>` (`aria-disabled`, "No slides", no-op). Empty state "Nothing to present yet" when `firstIndexBySlot.size === 0`.
- **Dual preview (R264):** `grid grid-cols-1 lg:grid-cols-3 gap-8` — current `lg:col-span-2` with `ring-2 ring-indigo-500` + a LIVE pill (`red-500` dot + literal word LIVE); next `lg:col-span-1` "Next up" with `ring-1 ring-gray-800`, "End of service" when null. Both `<SlideCanvas :interactive="false" />` in `aspect-video`. `current`/`next` via direct `[index]`/`[index+1] ?? null` — NO `.at()`. No push-to-live control anywhere (R266).
- **Keyboard (R265):** document keydown added/removed on mount/unmount mirroring PresentationViewer. Right/Space `goBySlide(1)`, Left `goBySlide(-1)`, Down `goByItem(1)`, Up `goByItem(-1)` (walk the rail skipping empty slots), Escape OPENS the confirm. Inert while `confirmOpen` or an INPUT/TEXTAREA/SELECT is focused; `B` bound to nothing.
- **Exit-confirm:** inline Teleport dialog (`z-50` scrim, gray-900 card), Cancel focused on open via `watch(confirmOpen)`, red `bg-red-600` confirm that closes the channel and `router.push({ name: 'service-editor', params: { id } })`. A stray/double Escape can never tear down (handleKeydown early-returns while open).

### Route (Task 2, commit cff18593)
- `/run/:serviceId`, name `run-control`, lazy `../views/RunControlView.vue`, `meta: { requiresAuth: true }` only (no `requiresEditor` — R275 any member). Placed adjacent to `/present/audience` + `/present/confidence`, before `/owner-console` and the public dynamic slug routes. `router.beforeEach` untouched.

## Deviations from Plan

None — plan executed as written. One trivial type-fix during implementation: `goByItem`'s rail walk captures `const row = rows[pos]` and guards `if (!row) return` to satisfy `noUncheckedIndexedAccess` (was flagged TS2532 on `rows[pos].index`); behavior identical to the specified loop.

## Gate results

- `npm run type-check` (vue-tsc --build): **clean**, no errors (route's lazy import resolves; no `Array.prototype.at`).
- `npx vitest run`: **165 files, only `src/storage.rules.test.ts` failing** (25 tests) — the documented Storage-emulator baseline (CLAUDE.md). 164 files / 4564 tests pass. No regression introduced by this plan. (Behavioral coverage for RunControlView lands in 95-05.)

## Self-Check: PASSED
- FOUND: src/views/RunControlView.vue
- FOUND: /run/:serviceId route in src/router/index.ts
- FOUND commit 9b6bb489 (Task 1)
- FOUND commit cff18593 (Task 2)
