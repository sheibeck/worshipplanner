<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 overflow-hidden" data-testid="slideshow-preview">
    <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-100">Slideshow Preview</h3>
      <button
        type="button"
        data-testid="present-slideshow-cta"
        :disabled="!canPresent"
        :title="canPresent ? undefined : 'Add songs or scripture to build a slideshow to present.'"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        @click="emit('present')"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
        Present Slideshow
      </button>
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

            <!-- Video slide (D-17/D-18) — video is slide-only, never a bed;
                 identified via the eyebrow label without autoplaying it in
                 the preview list. -->
            <template v-else-if="cardKind(assembled.slide) === 'video'">
              <p class="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Video</p>
              <div data-testid="preview-slide-video">
                <VideoPlayer :src="(assembled.slide as VideoSlide).videoSrc" />
              </div>
            </template>

            <!-- Text slide (prayer/message/hymn placeholder) -->
            <template v-else>
              <p v-if="(assembled.slide as TextSlide).title" class="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                {{ (assembled.slide as TextSlide).title }}
              </p>
              <p class="text-sm text-gray-200 whitespace-pre-line">{{ (assembled.slide as TextSlide).body }}</p>
            </template>

            <!-- Attached audio bed/per-slide media (Phase 22/24, R013/R014,
                 D-04) — rendered below the slide's own content, only when the
                 assembled slide carries a URL. Video has no equivalent
                 attached-media path (D-18): a video slide's own source is
                 rendered above, in its own card branch. -->
            <div v-if="assembled.slide.audioUrl" data-testid="preview-slide-audio" class="mt-2">
              <AudioPlayer :src="assembled.slide.audioUrl" />
            </div>
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
  VideoSlide,
} from '@/types/slide'
import AudioPlayer from './AudioPlayer.vue'
import VideoPlayer from './VideoPlayer.vue'

const props = defineProps<{
  sections: AssembledSection[]
}>()

const emit = defineEmits<{
  present: []
}>()

/** Sections with at least one slide — avoids rendering empty headers. */
const nonEmptySections = computed(() => props.sections.filter((group) => group.slides.length > 0))

const hasAnySlides = computed(() => nonEmptySections.value.length > 0)

// Exactly equivalent to assembledSlideshow.length > 0 — useSlideshowAssembly
// groups every assembled slide into either a named SERVICE_SECTIONS group or
// the trailing Ungrouped group, so nonEmptySections' total slide count always
// matches assembledSlideshow.length.
const canPresent = computed(() => hasAnySlides.value)

/**
 * Card content kind, narrowed independently of the raw `contentKind` field —
 * LyricSlide and CopyrightSlide both carry `contentKind: 'lyric'` (D001) and
 * are distinguished by shape (`sectionId` only present on LyricSlide).
 */
type CardKind = 'lyric' | 'copyright' | 'scripture' | 'text' | 'image' | 'video'

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
