<template>
  <!-- R276 owner fix #2/#4 — the program ("On screen", dominant, LEFT) + next-up
       (subordinate, RIGHT) preview split. Display-only: both panes are
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
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
    <!-- CURRENT (dominant, LEFT) — the program / "On screen" preview. -->
    <div class="lg:col-span-2">
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
      </div>
      <!-- Owner UAT 2×2: content stacked UNDER the On-screen pane (the filmstrip). -->
      <div class="mt-6"><slot name="under-current" /></div>
    </div>

    <!-- NEXT (subordinate, RIGHT) — the same scale-to-fit thumbnail as the program
         pane, sized to its own (smaller) box. "End of service" when next is null. -->
    <div class="lg:col-span-1">
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
/**
 * R276 owner fix #2/#4 — the program + next-up preview pair, extracted as a PURE
 * display child (97-05). Both panes render the REAL SlideCanvas with
 * :interactive="false"; the previews own NO navigation (the transport/rail
 * posts index changes), so there is deliberately no emit and no run-take /
 * run-push-live control here — that keeps the single-selection contract intact.
 * The live frame is GREEN when `live` is true (owner fix #4).
 *
 * OWNER UAT FIX (Next-up font too big) — SlideCanvas has no font-size prop; its
 * text is sized in fixed projector px (text-5xl/6xl) scaled only by
 * `--slide-font-scale`, so scaling a box-sized canvas by 0.8 (the old approach)
 * still left the font enormous in the small preview box. Instead each canvas is
 * rendered at a fixed REFERENCE_WIDTH × REFERENCE_HEIGHT (1280×720, 16:9) stage —
 * where the projector-sized fonts are proportionally correct — and the whole
 * stage is CSS `transform: scale(f)`-ed down to fit its pane, with
 * `f = paneWidth / REFERENCE_WIDTH`, `transform-origin: top left`, and the pane
 * `overflow-hidden`. Font and layout therefore shrink together and each preview
 * reads as a true mini-slide. A ResizeObserver per pane keeps `f` correct across
 * layout/resize; both panes and the stage are 16:9, so the scaled stage fills its
 * pane exactly (no letterboxing).
 */
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
