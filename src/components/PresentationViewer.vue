<template>
  <Teleport to="body">
    <div
      ref="viewerRoot"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
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
            class="text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]"
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
            class="text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]"
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
            class="text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]"
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

        <!-- Video slide's own source (D-17/D-18) — chromeless, imperatively
             driven, reusing the same videoRef/play/pause/error/autoplay-blocked
             wiring the pre-D-18 bed video used. A video slide has no separate
             per-kind template branch above: video is slide-only (never a bed),
             so this is the video slide's entire visual content — nothing else
             on a video slide competes with it for the screen. -->
        <div
          v-if="currentVideoUrl && !mediaFailed"
          data-testid="presentation-video"
          class="w-full flex justify-center mt-8"
        >
          <VideoPlayer
            ref="videoRef"
            chromeless
            :src="currentVideoUrl"
            :key="currentVideoKey"
            @error="onMediaError"
            @autoplay-blocked="onVideoAutoplayBlocked"
            @play="videoBlocked = false"
          />
        </div>

        <!-- Attached audio — zero-size wrapper, occupies no layout space. -->
        <div
          v-if="currentAudioUrl && !mediaFailed"
          data-testid="presentation-audio"
          class="absolute h-0 w-0 overflow-hidden"
        >
          <AudioPlayer
            ref="audioRef"
            chromeless
            :src="currentAudioUrl"
            :loop="currentSlide?.slide.audioLoop"
            :key="currentAudioKey"
            @error="onMediaError"
            @autoplay-blocked="onAudioAutoplayBlocked"
            @play="audioBlocked = false"
          />
        </div>

        <!-- Media-unavailable notice — deliberately NOT bound to chrome
             auto-hide; it reports slide state, not navigation affordance. -->
        <p
          v-if="mediaFailed"
          data-testid="presentation-media-unavailable"
          class="absolute bottom-20 left-6 text-xs text-gray-500 leading-[1.4]"
        >
          Media unavailable
        </p>

        <!-- Autoplay-blocked affordances -->
        <button
          v-if="audioBlocked"
          type="button"
          data-testid="presentation-audio-affordance"
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-8 py-4 text-4xl font-semibold text-white"
          @click="audioRef?.play()"
        >
          Tap to play audio
        </button>

        <button
          v-if="videoBlocked"
          type="button"
          data-testid="presentation-video-affordance"
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-8 py-4 text-4xl font-semibold text-white"
          @click="videoRef?.play()"
        >
          Tap to play video
        </button>

        <button
          v-if="videoMutedPlaying"
          type="button"
          data-testid="presentation-muted-chip"
          class="absolute bottom-20 right-6 rounded-full bg-amber-900/40 px-4 py-2 text-sm font-medium text-amber-300"
          @click="onUnmuteClick"
        >
          Playing muted — tap to unmute
        </button>
      </div>

      <!-- Exit button — always present (never hidden by v-if), only fades opacity. -->
      <button
        type="button"
        data-testid="presentation-exit"
        aria-label="Exit presentation (Esc)"
        class="absolute top-6 right-6 p-2.5 min-h-11 min-w-11 text-gray-300 hover:text-white transition-opacity duration-300"
        :class="exitVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
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
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue'
import type {
  AssembledSlide,
  Slide,
  LyricSlide,
  CopyrightSlide,
  ScriptureSlide,
  TextSlide,
  ImageSlide,
  VideoSlide,
} from '@/types/slide'
import { SERVICE_SECTION_LABELS } from '@/types/service'
import AudioPlayer from './AudioPlayer.vue'
import VideoPlayer from './VideoPlayer.vue'

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

const audioRef = ref<InstanceType<typeof AudioPlayer> | null>(null)
const videoRef = ref<InstanceType<typeof VideoPlayer> | null>(null)

// Per-slide degraded-state flags. All reset on every slide change
// (resetMediaState, called from goToIndex) so one slide's degraded state
// never leaks onto the next.
const mediaFailed = ref(false)
const audioBlocked = ref(false)
const videoBlocked = ref(false)
const videoMutedPlaying = ref(false)

// ── Computed ─────────────────────────────────────────────────────────────────

const hasSlides = computed(() => props.slides.length > 0)
const isLoadingState = computed(() => !!props.isLoading && props.slides.length === 0)
const isEmptyState = computed(() => !isLoadingState.value && props.slides.length === 0)

/**
 * WR-04: the exit button must stay reachable even if the idle-hide timer has
 * already fired while there is still nothing else on screen to interact
 * with (assembly taking >3s, or the rare empty/race state) — on a
 * touch-only device there would otherwise be no way to trigger Escape.
 * `chromeVisible`'s own value (and its 3s timer) are untouched; this only
 * overrides what's DISPLAYED while loading/empty.
 */
const exitVisible = computed(() => chromeVisible.value || isLoadingState.value || isEmptyState.value)

const currentSlide = computed<AssembledSlide | null>(() => props.slides[currentIndex.value] ?? null)
const atFirst = computed(() => currentIndex.value <= 0)
const atLast = computed(() => currentIndex.value >= props.slides.length - 1)

const currentAudioUrl = computed<string | null>(() => currentSlide.value?.slide.audioUrl ?? null)
/**
 * A video slide's own source (D-17/D-18) — video has no bed layer, so this
 * resolves ONLY from the current slide's own `videoSrc` when it IS a video
 * slide. There is nothing else for a video slide to render (see the
 * template), so this is never truthy at the same time as any body-rendering
 * slide kind.
 */
const currentVideoUrl = computed<string | null>(() => {
  const slide = currentSlide.value?.slide
  return slide?.contentKind === 'video' ? (slide as VideoSlide).videoSrc : null
})

/**
 * Keys the VideoPlayer instance on the SLIDE (WR-02) so switching between two
 * video slides always remounts the player — even two adjacent video slides
 * sharing an identical `videoSrc` must not reuse the child instance, or a
 * slide that went through the muted-retry path would silently stay muted on
 * the next one with zero on-screen indication.
 *
 * Unlike `currentAudioKey`, this needs no group-continuity branch: video has
 * no bed (D-18), so a video slide is always its own single-slide unit — there
 * is no "plays across the group" case for video to preserve a continuous
 * instance for. Every video slide gets a fresh per-slide key.
 */
const currentVideoKey = computed(() => `${currentSlide.value?.slide.id ?? ''}:${currentVideoUrl.value ?? ''}`)

/**
 * Keys the AudioPlayer instance on the SLIDE, not just the media URL (WR-02).
 * Two adjacent slides can carry the identical audio URL (e.g. the same
 * background/intro clip attached to two slots in a row); keying on URL alone
 * reuses the child instance across such a transition, letting its internal
 * `muted`/`showPlayAffordance` state leak from the outgoing slide into the
 * incoming one. Including the slide id forces a fresh instance on every
 * slide change regardless of URL reuse.
 *
 * Phase 24 (R030/D-04) splits this in two: PER-SLIDE audio still forces a
 * fresh child on every slide change (the WR-02 guarantee above, unchanged).
 * But a GROUP BED (`audioFromBed` true, with a `groupId`) is deliberately
 * kept as ONE continuous instance across every slide of that group — that
 * continuity is what R030 means by a bed that "plays across the group":
 * advancing from one bed-carrying slide to the next bed-carrying slide of the
 * SAME group must not remount the player. A slide with no `groupId`
 * (pre-migration data) always falls through to the per-slide key,
 * byte-identical to the pre-Phase-24 formula.
 */
const currentAudioKey = computed(() => {
  const current = currentSlide.value
  if (current?.audioFromBed && current.groupId) {
    return `group:${current.groupId}:${currentAudioUrl.value ?? ''}`
  }
  return `${current?.slide.id ?? ''}:${currentAudioUrl.value ?? ''}`
})

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
type CardKind = 'lyric' | 'copyright' | 'scripture' | 'text' | 'image' | 'video'

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
// Clamping must route through the same pause/reset/play lifecycle as
// goToIndex() (WR-03) — otherwise the OLD slide's degraded-state flags
// (mediaFailed/audioBlocked/videoBlocked/videoMutedPlaying) leak onto the
// clamped-to slide (e.g. a stale `mediaFailed` suppresses perfectly-fine
// media on the new slide), and nothing ever calls .play() on whatever media
// element Vue mounts for the new slide.
watch(
  () => props.slides.length,
  async (len) => {
    const clamped = Math.min(Math.max(currentIndex.value, 0), Math.max(0, len - 1))
    if (clamped !== currentIndex.value) {
      pauseCurrentMedia()
      resetMediaState()
      currentIndex.value = clamped
      await nextTick()
      playCurrentMedia()
    }
  },
)

// ── Media driving — imperative play/pause only; the players expose no attribute that triggers unattended playback ──

/** No-op on a slide with no mounted media (optional-chained). */
function pauseCurrentMedia() {
  audioRef.value?.pause()
  videoRef.value?.pause()
}

/**
 * Both play() calls are async and their rejections are already handled
 * inside the players (autoplay-blocked handling lives there) — do not await
 * them here and do not attach a catch that would swallow anything other
 * than the NotAllowedError the players already handle internally.
 */
function playCurrentMedia() {
  void videoRef.value?.play()
  void audioRef.value?.play()
}

/** Every per-slide media state resets on each slide change so one slide's
 * degraded state never leaks onto the next. */
function resetMediaState() {
  mediaFailed.value = false
  audioBlocked.value = false
  videoBlocked.value = false
  videoMutedPlaying.value = false
}

/**
 * Pausing the outgoing slide's media BEFORE the index write is the whole
 * point (T-23-08) — never move this after the assignment, and never rely on
 * unmount to stop playback.
 */
async function goToIndex(next: number) {
  if (next === currentIndex.value) return
  if (next < 0 || next > props.slides.length - 1) return
  pauseCurrentMedia()
  resetMediaState()
  currentIndex.value = next
  await nextTick()
  playCurrentMedia()
}

// ── Navigation — stop at both ends, never wrap ────────────────────────────────

function goNext() {
  if (atLast.value) return
  void goToIndex(currentIndex.value + 1)
}

function goPrev() {
  if (atFirst.value) return
  void goToIndex(currentIndex.value - 1)
}

// ── Media event handlers ──────────────────────────────────────────────────────

/** A media file removed by the Phase 22 two-week retention cleanup is an
 * expected state, not a failure — no console output, no re-fetch, no
 * navigation change. */
function onMediaError() {
  mediaFailed.value = true
}

function onAudioAutoplayBlocked() {
  audioBlocked.value = true
}

/**
 * VideoPlayer emits the same 'autoplay-blocked' event for both the muted-retry
 * success and the hard-block cases (per the locked STATE.md decision) — the
 * two are told apart here by reading the exposed `isMuted` accessor rather
 * than a second event.
 */
function onVideoAutoplayBlocked() {
  const stillMuted = videoRef.value?.isMuted === true
  if (stillMuted) {
    videoMutedPlaying.value = true
    videoBlocked.value = false
  } else {
    videoBlocked.value = true
    videoMutedPlaying.value = false
  }
}

function onUnmuteClick() {
  void videoRef.value?.unmute()
  videoMutedPlaying.value = false
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

/**
 * WR-06: the viewer is teleported to `document.body` and covers the
 * viewport visually, but the rest of the app remains in the DOM behind it
 * (hidden only visually, not removed) — without a focus trap, Tab could walk
 * keyboard focus straight past the viewer's own buttons into that
 * still-present app content. Queries only the viewer's own currently-enabled
 * focusable elements (prev/next are excluded via `:not([disabled])` when at
 * either end of the show).
 */
function getFocusableElements(): HTMLElement[] {
  const root = viewerRoot.value
  if (!root) return []
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function trapFocus(e: KeyboardEvent) {
  const focusable = getFocusableElements()
  if (focusable.length === 0) return
  const first = focusable[0] as HTMLElement
  const last = focusable[focusable.length - 1] as HTMLElement
  const active = document.activeElement as HTMLElement | null
  const activeIsTracked = active !== null && focusable.includes(active)

  if (e.shiftKey) {
    if (!activeIsTracked || active === first) {
      e.preventDefault()
      last.focus()
    }
  } else {
    if (!activeIsTracked || active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

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
    case 'Tab':
      trapFocus(e)
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
  pauseCurrentMedia()
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // Exiting fullscreen can itself reject in some contexts — never block exit on it.
    })
  }
  hasExited = true
  emit('exit')
}

onMounted(async () => {
  viewerRoot.value?.focus()
  registerActivity()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  enterPresentation()
  await nextTick()
  playCurrentMedia()
})

// pauseCurrentMedia() must run in onBeforeUnmount, not onUnmounted: Vue nulls
// out child template refs via a post-flush callback queued BEFORE this
// component's own onUnmounted runs, so by the time onUnmounted fires,
// videoRef/audioRef are already null and pause() would silently no-op.
// onBeforeUnmount runs synchronously, top-down, before any of that teardown.
onBeforeUnmount(() => {
  pauseCurrentMedia()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (chromeTimer) clearTimeout(chromeTimer)
})
</script>
