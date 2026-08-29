<template>
  <!-- R276 owner fix #2/#4 — the program ("On screen", dominant, LEFT) + next-up
       (subordinate, RIGHT, at a SMALLER scale) preview split. Display-only: both
       panes are <SlideCanvas :interactive="false">; navigation is the transport
       /rail's job, so there is NO push-to-live control here (no run-take /
       run-push-live testid — that preserves the single-selection contract the
       control suite asserts). The live frame is GREEN (owner fix #4 — the design
       used red). Preserves run-current-preview / run-next-preview + the
       "End of service" empty copy the dual-preview test asserts. Key/BPM omitted
       (no data). -->
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
    <!-- CURRENT (dominant, LEFT) — the program / "On screen" preview. -->
    <div class="lg:col-span-2">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-400">On screen</span>
        <span
          v-if="live"
          data-testid="run-current-live-tag"
          class="inline-flex items-center gap-1.5 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-gray-100"
        >
          <span class="h-2 w-2 rounded-full bg-green-500" aria-hidden="true"></span>
          LIVE
        </span>
      </div>
      <div
        data-testid="run-current-preview"
        class="relative aspect-video overflow-hidden rounded-lg bg-black ring-2"
        :class="live ? 'ring-green-500' : 'ring-gray-700'"
      >
        <SlideCanvas v-if="current" :slide="current" :interactive="false" />
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
        >
          Loading slideshow…
        </div>
      </div>
    </div>

    <!-- NEXT (subordinate, RIGHT) — at a SMALLER scale (owner fix #2). SlideCanvas
         has no font-size prop, so the whole canvas is wrapped in a transform:
         scale() container (transform-origin: top center) that shrinks the
         upcoming slide to fit the pane. "End of service" when next is null. -->
    <div class="lg:col-span-1">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400">Next up</span>
        <span v-if="next" class="text-xs text-gray-500">Take →</span>
      </div>
      <div
        data-testid="run-next-preview"
        class="relative aspect-video overflow-hidden rounded-lg bg-gray-900 ring-1 ring-gray-800"
      >
        <div
          v-if="next"
          class="absolute inset-0"
          :style="{ transform: `scale(${nextScale})`, transformOrigin: 'top center' }"
        >
          <SlideCanvas :slide="next" :interactive="false" />
        </div>
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
        >
          End of service
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * R276 owner fix #2/#4 — the program + next-up preview pair, extracted as a PURE
 * display child (97-05). Both panes render the REAL SlideCanvas with
 * :interactive="false"; the previews own NO navigation (the transport/rail
 * posts index changes), so there is deliberately no emit and no run-take /
 * run-push-live control here — that keeps the single-selection contract intact.
 * The live frame is GREEN when `live` is true (owner fix #4), and the next-up
 * SlideCanvas is scaled down via a transform:scale container because SlideCanvas
 * exposes no font-size prop.
 */
import SlideCanvas from '@/components/slides/SlideCanvas.vue'
import type { AssembledSlide } from '@/types/slide'

withDefaults(
  defineProps<{
    /** The slide currently on the screens (dominant program preview). */
    current: AssembledSlide | null
    /** The upcoming slide (subordinate, scaled-smaller preview). */
    next: AssembledSlide | null
    /** True once go-live/rehearse has begun — turns the program frame GREEN. */
    live: boolean
    /** Scale factor for the next-up canvas so it renders smaller (owner fix #2). */
    nextScale?: number
  }>(),
  { nextScale: 0.8 },
)
</script>
