<template>
  <Teleport to="body">
    <div
      ref="viewerRoot"
      tabindex="-1"
      data-testid="presentation-viewer"
      class="fixed inset-0 z-50 bg-black outline-none flex items-center justify-center"
      @keydown="handleKeydown"
      @mousemove="registerActivity"
    >
      <!-- Loading state: assembly still in flight and nothing to show yet. -->
      <div
        v-if="isLoadingState"
        data-testid="presentation-loading"
        class="flex flex-col items-center gap-4"
      >
        <svg
          class="h-10 w-10 animate-spin text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <h2 class="text-4xl font-semibold text-gray-100">Loading slideshow&hellip;</h2>
      </div>

      <!-- Empty state: reachable only via a race/refresh since the entry CTA is disabled at 0 slides. -->
      <p
        v-else-if="isEmptyState"
        data-testid="presentation-empty-state"
        class="text-4xl font-semibold text-gray-400 text-center"
      >
        No slides yet &mdash; add songs or scripture to see the assembled slideshow.
      </p>

      <!-- Slide canvas -->
      <div
        v-else-if="currentSlide"
        data-testid="presentation-slide"
        class="w-full h-full flex flex-col items-center justify-center px-16 py-12 text-center"
      >
        <!-- lyric -->
        <template v-if="slideKind === 'lyric'">
          <p
            data-testid="presentation-label"
            class="text-2xl font-semibold leading-[1.3] text-indigo-400 uppercase tracking-wider mb-8"
          >
            {{ (currentSlide.slide as LyricSlide).sectionLabel }}
          </p>
          <p
            data-testid="presentation-body"
            class="text-5xl font-normal leading-[1.4] text-gray-100 whitespace-pre-line"
          >
            {{ (currentSlide.slide as LyricSlide).lines.join('\n') }}
          </p>
        </template>

        <!-- copyright -->
        <template v-else-if="slideKind === 'copyright'">
          <p
            data-testid="presentation-body"
            class="text-6xl font-semibold leading-[1.15] text-gray-100"
          >
            {{ (currentSlide.slide as CopyrightSlide).title }}
          </p>
          <p class="text-2xl font-semibold leading-[1.3] text-gray-300 mt-4">
            {{ (currentSlide.slide as CopyrightSlide).authors.join(', ') }}
          </p>
          <div
            data-testid="presentation-copyright-fine-print"
            class="text-xs text-gray-500 leading-[1.4] mt-8"
          >
            <p v-for="(line, idx) in (currentSlide.slide as CopyrightSlide).copyrightLines" :key="idx">{{ line }}</p>
            <p>CCLI Song #{{ (currentSlide.slide as CopyrightSlide).ccliSongNumber }}</p>
            <p>CCLI License #{{ (currentSlide.slide as CopyrightSlide).ccliLicenseNumber }}</p>
          </div>
        </template>

        <!-- scripture -->
        <template v-else-if="slideKind === 'scripture'">
          <p
            data-testid="presentation-label"
            class="text-2xl font-semibold leading-[1.3] text-indigo-400 uppercase tracking-wider mb-8"
          >
            {{ (currentSlide.slide as ScriptureSlide).reference }}
          </p>
          <template v-if="isCongregational">
            <div
              v-for="(section, idx) in (currentSlide.slide as ScriptureSlide).sections"
              :key="idx"
              :data-testid="`presentation-congregational-section-${idx}`"
              class="mb-8 text-left w-full"
            >
              <span
                :data-testid="`presentation-speaker-${idx}`"
                class="text-2xl font-semibold leading-[1.3] uppercase tracking-wider mr-4"
                :class="section.speaker === 'LEADER' ? 'text-indigo-300' : 'text-amber-300'"
              >
                {{ section.speaker === 'LEADER' ? 'Leader:' : 'Congregation:' }}
              </span>
              <span
                class="text-5xl leading-[1.4]"
                :class="section.speaker === 'LEADER' ? 'text-gray-100 font-semibold' : 'text-gray-300 font-normal pl-8'"
              >
                {{ section.text }}
              </span>
            </div>
          </template>
          <p
            v-else
            data-testid="presentation-body"
            class="text-5xl font-normal leading-[1.4] text-gray-100 whitespace-pre-line"
          >
            {{ (currentSlide.slide as ScriptureSlide).text }}
          </p>
        </template>

        <!-- text -->
        <template v-else-if="slideKind === 'text'">
          <p
            v-if="(currentSlide.slide as TextSlide).title"
            data-testid="presentation-label"
            class="text-2xl font-semibold leading-[1.3] text-indigo-400 uppercase tracking-wider mb-8"
          >
            {{ (currentSlide.slide as TextSlide).title }}
          </p>
          <p
            data-testid="presentation-body"
            class="text-5xl font-normal leading-[1.4] text-gray-100 whitespace-pre-line"
          >
            {{ (currentSlide.slide as TextSlide).body }}
          </p>
        </template>

        <!-- image -->
        <template v-else-if="slideKind === 'image'">
          <img
            data-testid="presentation-image"
            :src="(currentSlide.slide as ImageSlide).imageUrl"
            :alt="(currentSlide.slide as ImageSlide).altText ?? ''"
            class="max-h-[80vh] max-w-full object-contain"
          />
        </template>
      </div>

      <!-- Exit button — always present (never hidden by v-if), only fades opacity. -->
      <button
        type="button"
        data-testid="presentation-exit"
        aria-label="Exit presentation (Esc)"
        class="absolute top-6 right-6 p-2.5 min-h-11 min-w-11 text-gray-300 hover:text-white transition-opacity duration-300"
        :class="chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        @click="exitPresentation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Bottom chrome bar: progress pill + nav chevrons. Only present when there are slides. -->
      <div
        v-if="hasSlides"
        data-testid="presentation-chrome"
        class="absolute bottom-6 left-6 right-6 flex items-center justify-between transition-opacity duration-300"
        :class="chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      >
        <button
          type="button"
          data-testid="presentation-prev"
          aria-label="Previous slide (←)"
          :disabled="atFirst"
          class="p-2.5 min-h-11 min-w-11 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          @click="goPrev"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span
          data-testid="presentation-progress"
          class="rounded-full bg-gray-900/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-gray-300"
        >
          {{ progressLabel }}
        </span>

        <button
          type="button"
          data-testid="presentation-next"
          aria-label="Next slide (→)"
          :disabled="atLast"
          class="p-2.5 min-h-11 min-w-11 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          @click="goNext"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type {
  AssembledSlide,
  Slide,
  LyricSlide,
  CopyrightSlide,
  ScriptureSlide,
  TextSlide,
  ImageSlide,
} from '@/types/slide'
import { SERVICE_SECTION_LABELS } from '@/types/service'

const props = defineProps<{
  slides: AssembledSlide[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  exit: []
}>()

// ── Refs / state ─────────────────────────────────────────────────────────────

const viewerRoot = ref<HTMLElement | null>(null)
const currentIndex = ref(0)
const chromeVisible = ref(true)
const isTrueFullscreen = ref(false)
let chromeTimer: ReturnType<typeof setTimeout> | null = null
let hasExited = false

// ── Computed ─────────────────────────────────────────────────────────────────

const hasSlides = computed(() => props.slides.length > 0)
const isLoadingState = computed(() => !!props.isLoading && props.slides.length === 0)
const isEmptyState = computed(() => !isLoadingState.value && props.slides.length === 0)
const currentSlide = computed<AssembledSlide | null>(() => props.slides[currentIndex.value] ?? null)
const atFirst = computed(() => currentIndex.value <= 0)
const atLast = computed(() => currentIndex.value >= props.slides.length - 1)

const progressLabel = computed(() => {
  const n = currentIndex.value + 1
  const m = props.slides.length
  const section = currentSlide.value?.section
  if (section !== undefined) {
    return `${SERVICE_SECTION_LABELS[section]} · ${n} / ${m}`
  }
  return `${n} / ${m}`
})

/**
 * Card content kind, narrowed independently of the raw `contentKind` field —
 * LyricSlide and CopyrightSlide both carry `contentKind: 'lyric'` and are
 * distinguished by shape (`sectionId` only present on LyricSlide). Reused
 * verbatim from SlideshowPreview.vue's `cardKind()` helper.
 */
type CardKind = 'lyric' | 'copyright' | 'scripture' | 'text' | 'image'

function cardKind(slide: Slide): CardKind {
  if (slide.contentKind === 'lyric') {
    return 'sectionId' in slide ? 'lyric' : 'copyright'
  }
  return slide.contentKind as CardKind
}

const slideKind = computed<CardKind | null>(() => (currentSlide.value ? cardKind(currentSlide.value.slide) : null))

/**
 * A congregational scripture slide only renders the Leader/Congregation block
 * layout when it actually carries at least one section — a readingMode of
 * 'congregational' with an empty/undefined `sections` array falls back to the
 * normal (plain-text) rendering rather than a blank/broken slide.
 */
const isCongregational = computed(() => {
  const slide = currentSlide.value?.slide
  if (!slide || slide.contentKind !== 'scripture') return false
  const scripture = slide as ScriptureSlide
  return scripture.readingMode === 'congregational' && Array.isArray(scripture.sections) && scripture.sections.length > 0
})

// A live edit that shortens the show cannot leave currentIndex out of range.
watch(
  () => props.slides.length,
  (len) => {
    if (currentIndex.value > len - 1) currentIndex.value = Math.max(0, len - 1)
    if (currentIndex.value < 0) currentIndex.value = 0
  },
)

// ── Navigation — stop at both ends, never wrap ────────────────────────────────

function goNext() {
  if (atLast.value) return
  currentIndex.value += 1
}

function goPrev() {
  if (atFirst.value) return
  currentIndex.value -= 1
}

// ── Auto-hiding chrome ─────────────────────────────────────────────────────────

function registerActivity() {
  chromeVisible.value = true
  if (chromeTimer) clearTimeout(chromeTimer)
  chromeTimer = setTimeout(() => {
    chromeVisible.value = false
  }, 3000)
}

// ── Keyboard — bound on the viewer root only, never window/document ──────────

function handleKeydown(e: KeyboardEvent) {
  registerActivity()
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
      e.preventDefault()
      goNext()
      break
    case 'ArrowLeft':
    case 'Backspace':
      goPrev()
      break
    case 'Escape':
      exitPresentation()
      break
  }
}

// ── Fullscreen lifecycle ───────────────────────────────────────────────────────

async function enterPresentation() {
  try {
    await viewerRoot.value?.requestFullscreen()
    isTrueFullscreen.value = true
  } catch {
    // Rejection is an expected, common outcome (embedding context, missing
    // user gesture, iOS Safari restrictions) — fall back to the fixed-overlay
    // CSS layer silently. Never surfaced as an error, a toast, or a retry loop.
    isTrueFullscreen.value = false
  }
}

function handleFullscreenChange() {
  // The isTrueFullscreen guard is required: jsdom reports
  // document.fullscreenElement as undefined, so an unguarded check would
  // exit immediately in the rejection-fallback path.
  if (isTrueFullscreen.value && document.fullscreenElement === null) {
    exitPresentation()
  }
}

function exitPresentation() {
  if (hasExited) return
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // Exiting fullscreen can itself reject in some contexts — never block exit on it.
    })
  }
  hasExited = true
  emit('exit')
}

onMounted(() => {
  viewerRoot.value?.focus()
  registerActivity()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  enterPresentation()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (chromeTimer) clearTimeout(chromeTimer)
})
</script>
