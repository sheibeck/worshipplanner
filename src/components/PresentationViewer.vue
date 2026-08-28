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
      :style="typographyStyle"
      @keydown="handleKeydown"
      @mousemove="registerActivity"
    >
      <!-- Loading state: assembly still in flight and nothing to show yet, OR
           (R094) slides are ready but the chosen face is not resident yet —
           see `showLoadingState`/`fontGateActive` below. -->
      <div
        v-if="showLoadingState"
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

      <!-- Slide canvas (Phase 90) — the per-slideKind rendering, media
           playback, and background layer now live in SlideCanvas.vue; this
           composes it at the one call site, keeping the same
           v-if/v-else-if chain so the R094 font gate still suppresses it
           until fontReady. -->
      <SlideCanvas
        v-else-if="currentSlide"
        ref="slideCanvasRef"
        :slide="currentSlide"
        interactive
      />

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
import type { AssembledSlide } from '@/types/slide'
import { SERVICE_SECTION_LABELS } from '@/types/service'
import { useAuthStore } from '@/stores/auth'
import { SLIDE_FONTS } from '@/config/slideFonts'
import { cssVarsFor, snapWeight, waitForSlideFont, loadFontCss, FONT_LOAD_TIMEOUT_MS } from '@/utils/slideTypography'
import SlideCanvas from './slides/SlideCanvas.vue'

const props = defineProps<{
  slides: AssembledSlide[]
  isLoading?: boolean
  /** R061 — the flat deck index to open on, computed by SlidesTab from
   *  whatever was selected when Present was clicked. Optional so every
   *  existing mount that omits it keeps opening on slide 0, unchanged. */
  initialIndex?: number
}>()

const emit = defineEmits<{
  exit: []
}>()

const authStore = useAuthStore()

/**
 * R093 (46-04) — the presenter's ONE CSS-variable wrapper (key_links: three
 * render sites read `authStore.settings.slideTypography` via `cssVarsFor`,
 * this is the presenter's). `font-family` is set explicitly so it inherits to
 * every projected element; weight/size are applied per-element by the scoped
 * rules in SlideCanvas.vue (moved there Phase 90), reading each element's
 * own base size — those elements inherit these `--slide-font-*` vars from
 * this component's viewer root.
 */
const typographyStyle = computed(() => ({
  ...cssVarsFor(authStore.settings.slideTypography),
  fontFamily: 'var(--slide-font-family)',
}))

const DEFAULT_FONT_FAMILY = 'Inter'
const DEFAULT_FONT_WEIGHT = 400

/**
 * R094 — resolves the org's chosen family/weight against the curated
 * `SLIDE_FONTS` registry, falling back to the eager-loaded default (Inter/400)
 * for an unknown family and snapping an unreachable weight to 400 (same
 * defensive posture as `cssVarsFor`, kept independent because the font-load
 * gate needs the raw family/weight pair for `document.fonts.load()`, not the
 * CSS-var string `cssVarsFor` builds).
 */
function resolvedFontChoice(): { family: string; weight: number } {
  const typography = authStore.settings.slideTypography
  const family =
    typography?.fontFamily !== undefined && SLIDE_FONTS[typography.fontFamily]
      ? typography.fontFamily
      : DEFAULT_FONT_FAMILY
  const weight = snapWeight(family, typography?.fontWeight ?? DEFAULT_FONT_WEIGHT)
  return { family, weight }
}

// ── Refs / state ─────────────────────────────────────────────────────────────

const viewerRoot = ref<HTMLElement | null>(null)
/**
 * R094 — false until the chosen face is resident (or the bounded
 * FONT_LOAD_TIMEOUT_MS elapses). Gates the slide canvas's first paint so a
 * projector never flashes a fallback font mid-service; see `showLoadingState`
 * and the font-gate block in `onMounted` below.
 */
const fontReady = ref(false)
// R061 — seeded from `initialIndex` (SlidesTab's presentStartIndex), clamped
// with the SAME formula as the length-change watcher below so the two clamps
// agree by construction rather than by two independently-written expressions
// happening to match. Not routed through goToIndex(): that function's
// pause/play lifecycle is for a slide CHANGE while already mounted — at
// mount there is no outgoing slide to pause, and onMounted's own
// slideCanvasRef.value?.play() call already handles the first slide's media.
const currentIndex = ref(
  Math.min(Math.max(props.initialIndex ?? 0, 0), Math.max(0, props.slides.length - 1)),
)
const chromeVisible = ref(true)
const isTrueFullscreen = ref(false)
let chromeTimer: ReturnType<typeof setTimeout> | null = null
let hasExited = false

// Phase 90 — the media playback handles now live inside SlideCanvas; this
// ref reaches through to its exposed play()/pause() in the same T-23-08
// pause→(index write)→play order every call site below already followed.
const slideCanvasRef = ref<InstanceType<typeof SlideCanvas> | null>(null)

// ── Computed ─────────────────────────────────────────────────────────────────

const hasSlides = computed(() => props.slides.length > 0)
const isLoadingState = computed(() => !!props.isLoading && props.slides.length === 0)
const isEmptyState = computed(() => !isLoadingState.value && props.slides.length === 0)

/**
 * R094 — true while slides are ready to show but the chosen face is not yet
 * resident (or the bounded timeout hasn't elapsed). Kept distinct from
 * `isLoadingState` (which means "assembly itself is still in flight") so
 * `hasSlides.value === false` (isEmptyState) is never gated on font load —
 * there is nothing to flash when there is nothing to show.
 */
const fontGateActive = computed(() => !fontReady.value && hasSlides.value)

/** The union the template's "Loading slideshow…" branch renders for. */
const showLoadingState = computed(() => isLoadingState.value || fontGateActive.value)

/**
 * WR-04: the exit button must stay reachable even if the idle-hide timer has
 * already fired while there is still nothing else on screen to interact
 * with (assembly taking >3s, or the rare empty/race state) — on a
 * touch-only device there would otherwise be no way to trigger Escape.
 * `chromeVisible`'s own value (and its 3s timer) are untouched; this only
 * overrides what's DISPLAYED while loading/empty. Widened (46-04) to also
 * cover the R094 font-load gate — the exit affordance must stay reachable
 * for however long that gate holds too.
 */
const exitVisible = computed(() => chromeVisible.value || showLoadingState.value || isEmptyState.value)

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

// R124 (Phase 55): the render-time `scriptureAttributionSuffix` helper that
// used to append `(ESV)`/`(NLT)` to both scripture render sites was removed —
// the owner wants clean scripture when presenting. This is a render-only
// change: the provenance helpers in `@/utils/scripture` and the per-slide
// `translationSource` field are untouched (R092 preserved), and the version
// can still be typed into a slide's own editable text.

// A live edit that shortens the show cannot leave currentIndex out of range.
// Clamping must route through the same pause/play lifecycle as goToIndex()
// (WR-03) — otherwise nothing ever calls .play() on whatever media element
// SlideCanvas mounts for the new slide. SlideCanvas's own internal watcher
// (Phase 90) resets the OLD slide's degraded-state flags on this same
// slide-identity change, so they never leak onto the clamped-to slide.
watch(
  () => props.slides.length,
  async (len) => {
    const clamped = Math.min(Math.max(currentIndex.value, 0), Math.max(0, len - 1))
    if (clamped !== currentIndex.value) {
      slideCanvasRef.value?.pause()
      currentIndex.value = clamped
      await nextTick()
      slideCanvasRef.value?.play()
    }
  },
)

/**
 * Pausing the outgoing slide's media BEFORE the index write is the whole
 * point (T-23-08) — never move this after the assignment, and never rely on
 * unmount to stop playback. Routed through `slideCanvasRef` (Phase 90) —
 * SlideCanvas now owns the actual media elements and its own degraded-state
 * reset (an internal watcher on the slide's identity).
 */
async function goToIndex(next: number) {
  if (next === currentIndex.value) return
  if (next < 0 || next > props.slides.length - 1) return
  slideCanvasRef.value?.pause()
  currentIndex.value = next
  await nextTick()
  slideCanvasRef.value?.play()
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
  slideCanvasRef.value?.pause()
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

  // R094 — the font-load gate. Runs regardless of whether there are slides
  // yet (`fontReady` only ever gates rendering when `hasSlides` is true, see
  // `fontGateActive` above), so it never races the assembly-in-flight state.
  //
  // CR-02 (46-REVIEW.md): the whole sequence — including loadFontCss's
  // unbounded network fetch, NOT just waitForSlideFont's own internal
  // timeout — is raced against ONE shared FONT_LOAD_TIMEOUT_MS timeout and
  // wrapped in try/catch/finally, so a rejected dynamic import (stale-chunk
  // deploy, flaky venue Wi-Fi) or a rejected document.fonts.load() can
  // never permanently strand fontReady at false and hang "Loading
  // slideshow…" for the rest of the service.
  try {
    const { family, weight } = resolvedFontChoice()
    await Promise.race([
      (async () => {
        if (family !== DEFAULT_FONT_FAMILY || weight !== DEFAULT_FONT_WEIGHT) {
          // On-demand load of a non-eager curated face BEFORE asking the
          // browser to resolve it — document.fonts.load() can only find a
          // face whose @font-face rule has already been registered.
          await loadFontCss(family, weight)
        }
        await waitForSlideFont(family, weight, FONT_LOAD_TIMEOUT_MS)
      })(),
      new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS)),
    ])
  } catch {
    // A rejected dynamic import / font-load call must never leave the
    // presenter stuck — degrade to "render anyway", same as a timeout.
  } finally {
    fontReady.value = true
  }

  // Deferred until AFTER the font gate (and its DOM update) so the slide
  // canvas — and the AudioPlayer/VideoPlayer refs it mounts internally —
  // actually exist by the time play() is called.
  await nextTick()
  slideCanvasRef.value?.play()
})

// slideCanvasRef.value?.pause() must run in onBeforeUnmount, not onUnmounted:
// Vue nulls out child template refs via a post-flush callback queued BEFORE
// this component's own onUnmounted runs, so by the time onUnmounted fires,
// slideCanvasRef is already null and pause() would silently no-op.
// onBeforeUnmount runs synchronously, top-down, before any of that teardown.
onBeforeUnmount(() => {
  slideCanvasRef.value?.pause()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (chromeTimer) clearTimeout(chromeTimer)
})
</script>
