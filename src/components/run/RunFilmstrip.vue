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
    <div class="flex items-center gap-3 overflow-x-auto pb-1">
      <button
        v-for="thumb in thumbs"
        :key="thumb.index"
        type="button"
        data-testid="run-filmstrip-slide"
        :data-index="thumb.index"
        :aria-current="thumb.index === currentIndex ? 'true' : undefined"
        class="relative aspect-video w-32 flex-none overflow-hidden rounded-md bg-black ring-2 focus:outline-none focus:ring-indigo-400"
        :class="thumb.index === currentIndex ? 'ring-green-500' : 'ring-gray-700 hover:ring-indigo-500'"
        @click="emit('jump', thumb.index)"
      >
        <!-- Owner UAT: render each thumb as a true mini-slide. SlideCanvas uses
             projector-sized fonts; laying it out at the tiny thumb width wrapped
             every word into a stacked mess. Instead render at the 1280×720
             reference stage (where the fonts are proportionally correct) and
             scale the WHOLE stage down to the thumb, so text + layout shrink
             together (same technique as RunPreviewPair). -->
        <div class="absolute left-0 top-0" :style="thumbStageStyle">
          <SlideCanvas :slide="thumb.slide" :interactive="false" />
        </div>
      </button>
      <span class="flex-none px-2 text-xs text-gray-500">Next item →</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * R282 — the in-item filmstrip, extracted as a PURE presentational child
 * (97-05). It does NOT compute which slides belong to the active item — the
 * parent (97-08) supplies the already-filtered `slides` and the PARALLEL
 * `indices` array (indices[i] is slides[i]'s array index in assembledSlideshow).
 * The click contract is the whole point: @jump emits indices[i], the GLOBAL
 * array index, so the parent maps it straight to postIndex; emitting the local
 * loop index `i` would jump to the wrong slide (T-97-05-01). Renders each thumb
 * as a scaled non-interactive SlideCanvas; the current slide (indices[i] ===
 * currentIndex) gets the green live frame.
 */
import { computed } from 'vue'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'
import type { AssembledSlide } from '@/types/slide'

const props = defineProps<{
  /** The active item's slides, in order. slides[i] pairs with indices[i]. */
  slides: AssembledSlide[]
  /** Each slide's GLOBAL array index in assembledSlideshow. Parallel to slides. */
  indices: number[]
  /** The array index currently on the screens (or null pre-live) — frames the thumb. */
  currentIndex: number | null
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
 * scale the whole stage down to the thumb box (a fixed `w-32` = 128px, aspect
 * 16:9), so font AND layout shrink together into a faithful mini-slide. Static
 * factor because the thumb width is fixed; mirrors RunPreviewPair's approach.
 */
const REFERENCE_WIDTH = 1280
const REFERENCE_HEIGHT = 720
const THUMB_WIDTH = 128
const thumbStageStyle = {
  width: `${REFERENCE_WIDTH}px`,
  height: `${REFERENCE_HEIGHT}px`,
  transform: `scale(${THUMB_WIDTH / REFERENCE_WIDTH})`,
  transformOrigin: 'top left',
}
</script>
