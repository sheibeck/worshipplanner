<template>
  <!-- R276 owner fix #2/#4 — the program ("On screen", LEFT) + next-up (RIGHT)
       preview split (R330, Phase 115: an even split, no longer a dominant
       2/3-share program pane — see the grid classes below). Display-only:
       both panes are
       <SlideCanvas :interactive="false">; navigation is the transport/rail's job,
       so there is NO push-to-live control here (no run-take / run-push-live testid
       — that preserves the single-selection contract the control suite asserts).
       The live frame is GREEN (owner fix #4 — the design used red). Preserves
       run-current-preview / run-next-preview + the "End of service" empty copy the
       dual-preview test asserts. Key/BPM omitted (no data).

       OWNER UAT FIX (Next-up font too big) — SlideCanvas renders PROJECTOR-sized
       fonts (fixed text-5xl/6xl px, sized for a fullscreen stage). The old
       `transform: scale(0.8)` shrank a box-sized canvas, so 0.8 of a 48px font was
       still huge in a small preview box. This is now a TRUE scale-to-fit thumbnail:
       each SlideCanvas is rendered at a fixed 1280×720 reference "stage", then the
       whole stage is `transform: scale(containerWidth / 1280)`-ed down to fit the
       pane (transform-origin: top left; pane is overflow-hidden). Font AND layout
       shrink proportionally, so each preview reads as a faithful mini version of
       the real slide. A ResizeObserver keeps the scale correct as the pane resizes.
       Both panes are aspect-video (16:9) and the stage is 16:9, so the scaled stage
       exactly fills its pane with no letterboxing. -->
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 items-start">
    <!-- CURRENT (LEFT) — the program / "On screen" preview. R330: reduced from
         the old dominant lg:col-span-2-of-3 (2/3) share to an even split with
         Next-up so it no longer crowds out the filmstrip beneath it. -->
    <div data-testid="run-current-pane">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-400">On screen</span>
        <!-- Owner UAT: in rehearse mode the tag/ring is YELLOW "Rehearsing" (green
             LIVE is reserved for a real go-live), matching the header status tile. -->
        <span
          v-if="live"
          data-testid="run-current-live-tag"
          class="inline-flex items-center gap-1.5 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold"
          :class="rehearsing ? 'text-amber-200' : 'text-gray-100'"
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="rehearsing ? 'bg-amber-400' : 'bg-green-500'"
            aria-hidden="true"
          ></span>
          {{ rehearsing ? 'Rehearsing' : 'LIVE' }}
        </span>
      </div>
      <div
        ref="currentBox"
        data-testid="run-current-preview"
        class="relative aspect-video overflow-hidden rounded-lg bg-black ring-2"
        :class="live ? (rehearsing ? 'ring-amber-400' : 'ring-green-500') : 'ring-gray-700'"
      >
        <div
          v-if="current"
          class="absolute left-0 top-0"
          :style="stageStyle(currentScale)"
        >
          <SlideCanvas :slide="current" :interactive="false" />
        </div>
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
        >
          Loading slideshow…
        </div>
        <!-- Owner UAT: when the operator has "gone to black", mirror it here so the
             On-screen preview OBVIOUSLY shows BLACK (not a broken/empty preview) — the
             projectionist can see at a glance that the audience is blacked out. Sits
             OVER the slide preview; cleared when blackout is off. -->
        <div
          v-if="blackout"
          data-testid="run-current-blackout"
          class="absolute inset-0 flex items-center justify-center bg-black"
        >
          <span
            class="rounded border border-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/70"
          >
            Black
          </span>
        </div>
      </div>
      <!-- Owner UAT 2×2: content stacked UNDER the On-screen pane (the filmstrip). -->
      <div class="mt-6"><slot name="under-current" /></div>
    </div>

    <!-- NEXT (RIGHT) — the same scale-to-fit thumbnail as the program pane,
         now sized to a matching (even-split) box. "End of service" when next
         is null. -->
    <div data-testid="run-next-pane">
      <div class="mb-2 flex items-center">
        <span class="text-xs font-semibold text-gray-400">Next up</span>
      </div>
      <div
        ref="nextBox"
        data-testid="run-next-preview"
        class="relative aspect-video overflow-hidden rounded-lg bg-gray-900 ring-1 ring-gray-800"
      >
        <div
          v-if="next"
          class="absolute left-0 top-0"
          :style="stageStyle(nextScale)"
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
      <!-- Owner UAT 2×2: content stacked UNDER the Next-up pane (the Displays panel). -->
      <div class="mt-6"><slot name="under-next" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/run/RunPreviewPair.vue)
import { ref, onMounted, onBeforeUnmount } from 'vue'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'
import type { AssembledSlide } from '@/types/slide'

defineProps<{
  /** The slide currently on the screens (dominant program preview). */
  current: AssembledSlide | null
  /** The upcoming slide (subordinate preview). */
  next: AssembledSlide | null
  /** True once go-live/rehearse has begun — turns the program frame GREEN (or
   *  amber when `rehearsing`). */
  live: boolean
  /** True while rehearsing (no outputs) — the program tag/ring reads amber
   *  "Rehearsing" instead of green "LIVE" (owner UAT). */
  rehearsing?: boolean
  /** True when the operator has blacked out the outputs — the On-screen (program)
   *  preview shows a BLACK overlay so the projectionist sees the audience is black. */
  blackout?: boolean
}>()

/**
 * The fixed reference "stage" the SlideCanvas is laid out at before it is scaled
 * down to the pane. 1280×720 is a plain 16:9 box at which SlideCanvas's
 * projector-sized fonts render in their intended proportion; the exact pixel
 * value is immaterial to the result — only the ratio paneWidth/REFERENCE_WIDTH
 * matters — but a real 720p-class stage keeps sub-pixel rounding negligible.
 */
const REFERENCE_WIDTH = 1280
const REFERENCE_HEIGHT = 720

/** The inline style for a scale-to-fit stage: fixed reference size, scaled down
 *  from its top-left corner so it fills the (16:9) pane from the same origin. */
function stageStyle(scale: number) {
  return {
    width: `${REFERENCE_WIDTH}px`,
    height: `${REFERENCE_HEIGHT}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }
}

/**
 * Tracks a pane element's width and exposes the scale factor that fits the
 * 1280-wide stage into it. Measured once on mount (before first paint, so there
 * is no flash of full-size content) and re-measured by a ResizeObserver whenever
 * the pane changes size (window resize, the lg: breakpoint reflowing the split).
 * Falls back to scale 1 where layout is unavailable (SSR / jsdom clientWidth 0),
 * which still renders a valid `transform: scale(...)`.
 */
function useScaleToFit() {
  const boxRef = ref<HTMLElement | null>(null)
  const scale = ref(1)
  let observer: ResizeObserver | null = null

  function measure() {
    const el = boxRef.value
    if (!el) return
    const width = el.clientWidth
    if (width > 0) scale.value = width / REFERENCE_WIDTH
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && boxRef.value) {
      observer = new ResizeObserver(() => measure())
      observer.observe(boxRef.value)
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { boxRef, scale }
}

const { boxRef: currentBox, scale: currentScale } = useScaleToFit()
const { boxRef: nextBox, scale: nextScale } = useScaleToFit()
</script>
