<template>
  <!-- R282 — the in-item "Slides in this item" click-to-jump filmstrip. PURE
       presentation: the parent (97-08) filters assembledSlideshow by the active
       slotIndex and passes the item's `slides` alongside a PARALLEL `indices`
       array giving each slide's GLOBAL array position in assembledSlideshow.
       This component renders each slide as a scaled non-interactive SlideCanvas
       thumb (current = live/green frame, others = accent frame) and emits
       @jump(indices[i]) — the ARRAY index, NEVER the local loop index — so the
       parent can map @jump straight to postIndex without an off-by-item error. -->
  <div data-testid="run-filmstrip" class="flex flex-col gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Slides in this item</span>
    <div class="relative">
      <div class="filmstrip-scroll flex items-center gap-3 scroll-smooth pb-2">
        <button
          v-for="thumb in thumbs"
          :key="thumb.index"
          :ref="(el) => setActiveThumb(el, thumb.index)"
          type="button"
          data-testid="run-filmstrip-slide"
          :data-index="thumb.index"
          :aria-current="thumb.index === currentIndex ? 'true' : undefined"
          class="relative aspect-video w-48 flex-none overflow-hidden rounded-md bg-black ring-2 focus:outline-none focus:ring-indigo-400"
          :class="thumb.index === currentIndex ? 'ring-green-500' : 'ring-gray-700 hover:ring-indigo-500'"
          @click="emit('jump', thumb.index)"
        >
          <!-- See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/run/RunFilmstrip.vue) -->
          <div class="absolute left-0 top-0" :style="thumbStageStyle">
            <SlideCanvas :slide="thumb.slide" :interactive="false" />
          </div>
        </button>
        <!-- R331: always-rendered end cap naming the next service item (or end
             of service), replacing the old static "Next item →" span. -->
        <div
          data-testid="run-filmstrip-endcap"
          class="flex aspect-video w-48 flex-none flex-col items-center justify-center rounded-md border border-dashed border-gray-700 px-2 text-center text-xs text-gray-400"
        >
          <template v-if="props.nextItemLabel">
            <span>End of item</span>
            <span class="mt-1 font-semibold text-gray-200">Next: {{ props.nextItemLabel }}</span>
          </template>
          <template v-else>
            <span>End of service</span>
          </template>
        </div>
      </div>
      <!-- R332: edge fade signalling more content off-screen; decorative only,
           pointer-events-none so it never intercepts thumb clicks. -->
      <div class="filmstrip-edge-fade pointer-events-none absolute inset-y-0 right-0 w-10" aria-hidden="true"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/run/RunFilmstrip.vue)
import { computed, onMounted, watch } from 'vue'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'
import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from '@/composables/useSlideAutoFit'
import type { AssembledSlide } from '@/types/slide'

const props = defineProps<{
  /** The active item's slides, in order. slides[i] pairs with indices[i]. */
  slides: AssembledSlide[]
  /** Each slide's GLOBAL array index in assembledSlideshow. Parallel to slides. */
  indices: number[]
  /** The array index currently on the screens (or null pre-live) — frames the thumb. */
  currentIndex: number | null
  /** R331: the next service item's title (from useRunControl's rail model), for
   *  the end-of-item cap. Null at end of service or pre-live. */
  nextItemLabel?: string | null
}>()

const emit = defineEmits<{
  jump: [index: number]
}>()

/**
 * Zip slides with their parallel array indices once, so the template reads a
 * single `{ slide, index }` (index is the GLOBAL array position). Guards against
 * the noUncheckedIndexedAccess `number | undefined` on the parallel-array read;
 * the contract is that `indices` is the same length as `slides`.
 */
const thumbs = computed(() =>
  props.slides.map((slide, i) => ({ slide, index: props.indices[i] ?? -1 })),
)

/**
 * Scale-to-fit each thumb: render SlideCanvas at a fixed 1280×720 reference
 * stage (where its projector-sized fonts are proportionally correct), then
 * scale the whole stage down to the thumb box (a fixed `w-48` = 192px, aspect
 * 16:9), so font AND layout shrink together into a faithful mini-slide. Static
 * factor because the thumb width is fixed; mirrors RunPreviewPair's approach.
 * THUMB_WIDTH MUST stay in sync with the template's `w-48` class (R330) — both
 * are the same physical thumb width. REFERENCE_WIDTH/HEIGHT are imported from
 * useSlideAutoFit so this thumbnail's reference stage can never desync from
 * the real output views (IN-02).
 */
const THUMB_WIDTH = 192
const thumbStageStyle = {
  width: `${REFERENCE_WIDTH}px`,
  height: `${REFERENCE_HEIGHT}px`,
  transform: `scale(${THUMB_WIDTH / REFERENCE_WIDTH})`,
  transformOrigin: 'top left',
}

/**
 * Owner UAT: on every slide change, scroll the strip so the CURRENT thumb is
 * the LEFT-MOST thumbnail (`inline: 'start'`), not merely nudged into view.
 * This keeps the upcoming slides — and, as you reach the last slides, the
 * end-of-item / next-item end cap that sits after them — visible to the right,
 * instead of leaving the current thumb pinned at the right edge with the end
 * cap off-screen. `block: 'nearest'` avoids nudging the page vertically;
 * guarded for jsdom (no real scrollIntoView).
 */
let activeThumbEl: HTMLElement | null = null
function setActiveThumb(el: unknown, thumbIndex: number) {
  if (thumbIndex === props.currentIndex && el instanceof HTMLElement) activeThumbEl = el
}
function scrollActiveIntoView() {
  activeThumbEl?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' })
}
watch(() => props.currentIndex, scrollActiveIntoView, { flush: 'post' })
onMounted(scrollActiveIntoView)
</script>

<style scoped>
/* Owner UAT + R332: a thin, dark, rounded scrollbar instead of the OS default
   white bar under the thumbnail strip, FORCED always-visible (overflow-x:
   scroll, not auto) so macOS's overlay auto-hide never hides it. Firefox uses
   scrollbar-width/color; WebKit/Blink use the ::-webkit-scrollbar pseudo-elements. */
.filmstrip-scroll {
  overflow-x: scroll;
  scrollbar-width: thin;
  scrollbar-color: rgb(75 85 99) transparent; /* gray-600 thumb on a transparent track */
}
.filmstrip-scroll::-webkit-scrollbar {
  height: 8px;
  -webkit-appearance: none; /* opt out of the macOS overlay auto-hide bar */
}
.filmstrip-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.filmstrip-scroll::-webkit-scrollbar-thumb {
  background-color: rgb(75 85 99); /* gray-600 */
  border-radius: 9999px;
}
.filmstrip-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgb(107 114 128); /* gray-500 on hover */
}

/* R332: subtle right-edge fade cueing more content off-screen. Matches the
   parent's dark page background so it reads as a fade, not a hard line. */
.filmstrip-edge-fade {
  background: linear-gradient(to right, transparent, rgb(17 24 39 / 0.85));
}
</style>
