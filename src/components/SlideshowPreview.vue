<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden" data-testid="slideshow-preview">
    <div class="px-4 py-3 border-b border-gray-800">
      <h3 class="text-sm font-semibold text-gray-100">Slideshow Preview</h3>
    </div>

    <div class="max-h-[32rem] overflow-y-auto p-3 space-y-4">
      <template v-if="hasAnySlides">
        <div v-for="group in nonEmptySections" :key="group.section ?? 'ungrouped'" class="space-y-2">
          <!-- Section divider -->
          <div
            data-testid="preview-section-divider"
            class="flex items-center gap-2 sticky top-0 bg-gray-900/95 py-1"
          >
            <span class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              {{ dividerLabel(group) }}
            </span>
            <span class="flex-1 border-t border-gray-800"></span>
            <span class="text-[10px] text-gray-600">{{ group.slides.length }}</span>
          </div>

          <!-- Slide cards -->
          <div
            v-for="assembled in group.slides"
            :key="assembled.slide.id"
            data-testid="preview-slide"
            class="rounded-md bg-gray-800/50 border border-gray-700/50 px-3 py-2"
          >
            <!-- Lyric slide (one section of a song) -->
            <template v-if="cardKind(assembled.slide) === 'lyric'">
              <p class="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                {{ (assembled.slide as LyricSlide).sectionLabel }}
              </p>
              <p class="text-sm text-gray-200 whitespace-pre-line line-clamp-3">
                {{ (assembled.slide as LyricSlide).lines.join('\n') }}
              </p>
            </template>

            <!-- Copyright slide (song title/credits) -->
            <template v-else-if="cardKind(assembled.slide) === 'copyright'">
              <p class="text-sm font-medium text-gray-100">{{ (assembled.slide as CopyrightSlide).title }}</p>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ (assembled.slide as CopyrightSlide).authors.join(', ') }}
              </p>
            </template>

            <!-- Scripture slide -->
            <template v-else-if="cardKind(assembled.slide) === 'scripture'">
              <p class="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                {{ (assembled.slide as ScriptureSlide).reference }}
              </p>
              <p class="text-sm text-gray-200 line-clamp-2">
                {{ truncate((assembled.slide as ScriptureSlide).text) }}
              </p>
            </template>

            <!-- Image slide (imported PPTX/image deck) -->
            <template v-else-if="cardKind(assembled.slide) === 'image'">
              <img
                :src="(assembled.slide as ImageSlide).imageUrl"
                :alt="(assembled.slide as ImageSlide).altText ?? ''"
                class="w-full rounded object-contain max-h-48"
              />
            </template>

            <!-- Text slide (prayer/message/hymn placeholder) -->
            <template v-else>
              <p v-if="(assembled.slide as TextSlide).title" class="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                {{ (assembled.slide as TextSlide).title }}
              </p>
              <p class="text-sm text-gray-200 whitespace-pre-line">{{ (assembled.slide as TextSlide).body }}</p>
            </template>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <p
        v-else
        data-testid="preview-empty-state"
        class="text-sm text-gray-500 italic text-center py-6"
      >
        No slides yet — add songs or scripture to see the assembled slideshow.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  AssembledSection,
  Slide,
  LyricSlide,
  CopyrightSlide,
  ScriptureSlide,
  TextSlide,
  ImageSlide,
} from '@/types/slide'

const props = defineProps<{
  sections: AssembledSection[]
}>()

/** Sections with at least one slide — avoids rendering empty headers. */
const nonEmptySections = computed(() => props.sections.filter((group) => group.slides.length > 0))

const hasAnySlides = computed(() => nonEmptySections.value.length > 0)

/**
 * Card content kind, narrowed independently of the raw `contentKind` field —
 * LyricSlide and CopyrightSlide both carry `contentKind: 'lyric'` (D001) and
 * are distinguished by shape (`sectionId` only present on LyricSlide).
 */
type CardKind = 'lyric' | 'copyright' | 'scripture' | 'text' | 'image'

function cardKind(slide: Slide): CardKind {
  if (slide.contentKind === 'lyric') {
    return 'sectionId' in slide ? 'lyric' : 'copyright'
  }
  return slide.contentKind as CardKind
}

/** Undefined section is always rendered as "Ungrouped", regardless of the caller-supplied label. */
function dividerLabel(group: AssembledSection): string {
  return group.section === undefined ? 'Ungrouped' : group.label
}

function truncate(text: string, max = 140): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}
</script>
