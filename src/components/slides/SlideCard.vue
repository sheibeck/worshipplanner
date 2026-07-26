<template>
  <button
    type="button"
    class="w-full rounded-lg border bg-gray-900 p-3 text-left transition-colors"
    :class="selected ? 'border-indigo-500' : 'border-gray-800 hover:bg-gray-800/60'"
    :data-testid="`slide-card-${assembledSlide.slide.id}`"
    :data-selected="selected ? 'true' : 'false'"
    @click="emit('select', assembledSlide.slide.id)"
  >
    <div class="relative h-[140px] overflow-hidden rounded-md bg-gray-950/40" data-testid="slide-card-preview">
      <span
        class="absolute left-2 top-1.5 text-[10px] uppercase tracking-wide text-indigo-300"
        data-testid="slide-card-content-label"
      >{{ contentLabel }}</span>
      <span
        class="absolute right-1.5 top-1.5 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-md border border-indigo-800 bg-indigo-950/50 px-1 text-[11px] font-medium text-indigo-300"
        data-testid="slide-card-number"
      >{{ number }}</span>

      <img
        v-if="isImage"
        :src="imageSrc"
        :alt="imageAlt"
        class="h-full w-full object-contain"
        data-testid="slide-card-image"
      />
      <p
        v-else
        class="line-clamp-6 whitespace-pre-line px-2 pt-6 text-[13px] leading-normal text-gray-200"
        data-testid="slide-card-body"
      >{{ bodyText }}</p>
    </div>

    <div class="mt-2 flex items-center gap-1.5" data-testid="slide-card-footer">
      <span
        class="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium"
        :class="kindBadgeClass"
        data-testid="slide-card-kind-badge"
      >{{ assembledSlide.slotKind }}</span>
      <span class="truncate text-[11px] text-gray-400" data-testid="slide-card-label">{{ footerLabel }}</span>
      <span
        v-if="hasAudio"
        class="ml-auto inline-flex items-center rounded bg-indigo-950/50 px-1.5 py-0.5 text-[11px] text-indigo-300"
        aria-label="Slide has audio attached"
        data-testid="slide-card-audio-chip"
      >&#9834;</span>
    </div>
  </button>
</template>

<script setup lang="ts">
/**
 * Presentational, prop-driven slide card (Phase 25 Task 1). Renders one
 * assembled slide inside `SlideGrid.vue` — text body plus metadata only;
 * real formatted-slide rendering remains deferred (D-10). Holds no selection
 * state of its own: clicking emits `select` with the slide's id, and the
 * PARENT (`SlideGrid`/`SlidesTab`) owns which card is currently selected —
 * this is the whole of the D-12 seam Phase 26's Edit Slide drawer will open
 * against.
 *
 * Reads no store and calls no composable.
 */
import { computed } from 'vue'
import type { AssembledSlide, ImageSlide } from '@/types/slide'
import { KIND_BADGE_CLASSES, slideContentLabel, slideBodyText, slideFooterLabel } from './slideDisplay'

const props = defineProps<{
  /** The assembled slide this card renders. */
  assembledSlide: AssembledSlide
  /** One-based slide number within the selected group (not the whole service). */
  number: number
  /** True only for the currently-selected card — the sole visual difference (accent border). */
  selected: boolean
}>()

const emit = defineEmits<{
  select: [slideId: string]
}>()

const isImage = computed(() => props.assembledSlide.slide.contentKind === 'image')
const imageSrc = computed(() => (props.assembledSlide.slide as ImageSlide).imageUrl)
const imageAlt = computed(() => (props.assembledSlide.slide as ImageSlide).altText ?? '')

const contentLabel = computed(() => slideContentLabel(props.assembledSlide.slide))
const bodyText = computed(() => slideBodyText(props.assembledSlide.slide))
const footerLabel = computed(() => slideFooterLabel(props.assembledSlide.slide))
const kindBadgeClass = computed(() => KIND_BADGE_CLASSES[props.assembledSlide.slotKind])
const hasAudio = computed(() => Boolean(props.assembledSlide.slide.audioUrl))
</script>
