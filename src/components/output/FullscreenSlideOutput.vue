<template>
  <!-- R270 — full-bleed pure-black congregation-facing surface. The root
       carries the same `--slide-font-*` CSS-var wrapper PresentationViewer
       sets so SlideCanvas's scoped per-element font rules inherit; cursor is
       hidden ONLY while fullscreen (restored windowed so the re-enter
       affordance stays clickable). No operator chrome of any kind.
       R426 — this is the SHARED fullscreen render: AudienceOutputView and
       VideoOutputView both delegate here (role + testid parameterized)
       instead of forking the render. -->
  <div
    :ref="setRootRefs"
    :data-testid="`${testid}-output`"
    class="fixed inset-0 bg-black flex items-center justify-center"
    :style="[rootStyle, bannerBackgroundStyle]"
  >
    <!-- R329 canonical stage — a fixed 1280x720 box (REFERENCE_WIDTH/HEIGHT) that
         SlideCanvas always fills, so its per-slide auto-fit measures against the
         SAME frame the Run-screen previews/thumbnails use (WYSIWYG). The stage is
         transform-scaled to CONTAIN this fixed root (useContainScale — letterboxed,
         never stretched). Rendered ONLY once a valid current slide exists AND the
         bounded font gate has resolved; otherwise the surface is pure black with
         zero elements (deliberate divergence from PresentationViewer's spinner +
         "Loading slideshow…" heading — a projector must never flash a spinner or
         copy at a congregation). isVideoBanner is always false for every non-video
         role, so this branch is UNCHANGED for them (R427 is Video-only). -->
    <div
      v-if="currentSlide && fontReady && !isVideoBanner"
      :data-testid="`${testid}-stage`"
      class="relative overflow-hidden"
      :style="stageStyle"
    >
      <SlideCanvas
        ref="slideCanvasRef"
        :slide="currentSlide"
        :interactive="false"
      />
    </div>

    <!-- R427 — the Video-only banner branch: a bottom lower-third band (28% of
         the frame height) instead of the full-stage. A SECOND, smaller
         useContainScale region (1280x200) mirrors the full-stage pattern above,
         with its own title-safe inset (64px horizontal / 16px top / 12px
         bottom) wrapping SlideCanvas. The band itself carries NO background so
         the root's transparent/key-color fill (bannerBackgroundStyle) shows
         through any letterbox bars inside it. -->
    <div
      v-if="currentSlide && fontReady && isVideoBanner"
      ref="bannerContainerRef"
      :data-testid="`${testid}-banner-band`"
      class="absolute inset-x-0 bottom-0 overflow-hidden flex items-center justify-center"
      style="height: 28%"
    >
      <div class="relative overflow-hidden" :style="bannerStageStyle">
        <div
          class="absolute inset-0 flex items-center justify-center"
          style="padding: 16px 64px 12px 64px"
        >
          <SlideCanvas
            ref="bannerSlideCanvasRef"
            :slide="currentSlide"
            :interactive="false"
          />
        </div>
      </div>
    </div>

    <!-- R280 — full-bleed blackout overlay. When the control posts blackout:true
         the projector shows pure black, painting OVER the live slide (sibling of
         SlideCanvas, after it in paint order); blackout:false removes it and the
         slide returns. No partial reveal (T-97-03-03). The reenter overlay stays
         AFTER this so the re-enter button remains reachable if fullscreen is lost
         mid-blackout. -->
    <div
      v-if="blackout"
      class="absolute inset-0 bg-black"
      :data-testid="`${testid}-blackout`"
      aria-hidden="true"
    ></div>

    <!-- See ADR-0209 (docs/adr/0209-r271-pitfall-6-the-one-interactive-element-in-this-view-show.md) -->
    <button
      v-if="!isFullscreen"
      type="button"
      :data-testid="`${testid}-reenter-fullscreen`"
      aria-label="Re-enter fullscreen"
      class="absolute inset-0 flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
      @click="handleReenterFullscreen"
    >
      <span
        class="pointer-events-none inline-flex items-center gap-2 rounded-full bg-gray-900/80 backdrop-blur-sm px-4 min-h-11 min-w-11 text-base font-medium text-gray-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
        Re-enter fullscreen
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick, type ComponentPublicInstance, type CSSProperties } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import { useOutputWindow } from '@/composables/useOutputWindow'
import { useContainScale, REFERENCE_WIDTH, REFERENCE_HEIGHT } from '@/composables/useSlideAutoFit'
import type { BroadcastChannelFactory } from '@/utils/runChannel'
import { loadVideoKeyColor, type MonitorRole } from '@/utils/monitorConfig'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'

/** The band's reference geometry (R427/137-UI-SPEC.md Surface 2) — 1280x200,
 *  ~28% of the 1280x720 full-stage reference height. A second, smaller
 *  useContainScale region alongside the main stage's, never replacing it. */
const BANNER_REFERENCE_WIDTH = 1280
const BANNER_REFERENCE_HEIGHT = 200

/**
 * Testability seam (93-PATTERNS §4): the run-channel factory is injectable so
 * tests can drive `onState` deterministically with an in-memory fake. Production
 * passes nothing and `openRunChannel` uses the native BroadcastChannel. The prop
 * is forwarded into useOutputWindow so the composable threads it to openRunChannel.
 *
 * R426 — `role` and `testid` parameterize this ONE render definition across the
 * Audience and Video output windows (and future output roles): `role` is
 * forwarded into useOutputWindow so the reportFullscreenState payload identifies
 * the correct window; `testid` is the data-testid prefix so each caller keeps its
 * own stable testids (`audience-*`, `video-*`, ...) without a copy-pasted render.
 */
const props = defineProps<{
  role: MonitorRole
  channelFactory?: BroadcastChannelFactory
  testid: string
}>()

// See ADR-0210 (docs/adr/0210-the-shared-output-window-lifecycle-core-r272-reuse-not-fork.md)
const {
  assembledSlideshow,
  localService,
  index,
  blackout,
  fontReady,
  rootRef,
  rootStyle,
  isFullscreen,
  handleReenterFullscreen,
} = useOutputWindow({ channelFactory: props.channelFactory, role: props.role })

// R329 — the canonical 1280x720 stage scaled to CONTAIN this fixed root
// (letterboxed, never stretched); containerRef shares the same DOM node as
// useOutputWindow's rootRef (fullscreen target), merged via setRootRefs below.
const { containerRef, scale: containScale } = useContainScale()
function setRootRefs(el: Element | ComponentPublicInstance | null) {
  rootRef.value = el as HTMLElement | null
  containerRef.value = el as HTMLElement | null
}
const stageStyle = computed(() => ({
  width: `${REFERENCE_WIDTH}px`,
  height: `${REFERENCE_HEIGHT}px`,
  transform: `scale(${containScale.value})`,
  transformOrigin: 'center',
}))

// ── Current slide + media invariant (view-local per-canvas plumbing) ──────────
// A null index (before the first RunState) and an out-of-range index both
// resolve to null (pure black) — a malformed/out-of-range index can never crash
// the projector (T-93-01).
const currentSlide = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value] ?? null),
)
const slideCanvasRef = ref<InstanceType<typeof SlideCanvas> | null>(null)

// ── R427 — Video-only banner branch ──────────────────────────────────────────
// Resolved the same way useRunControl's currentLoopSlot() resolves `loop`:
// localService.slots[currentSlide.slotIndex]?.videoOutput?.mode — no new
// wiring, just a second field read off the same slot. Strict `=== 'banner'`:
// absent, 'fullscreen', or any tampered value degrades to the unchanged
// full-stage render (T-137-02 — no crash surface).
const currentSlideVideoOutputMode = computed<string | undefined>(
  () => localService.value?.slots[currentSlide.value?.slotIndex ?? -1]?.videoOutput?.mode,
)
const isVideoBanner = computed(() => props.role === 'video' && currentSlideVideoOutputMode.value === 'banner')

// Read once at setup — this standalone output window opens fresh per launch,
// so a live storage-event listener is unnecessary (discretionary per plan).
const keyColor = loadVideoKeyColor()
const bannerBackgroundStyle = computed<CSSProperties>(() => {
  if (!isVideoBanner.value) return {}
  return { background: keyColor.enabled ? keyColor.colorHex : 'transparent' }
})

// A SECOND, smaller useContainScale region (1280x200) for the band — mirrors
// the full-stage containerRef/stageStyle pattern above, never replacing it.
const { containerRef: bannerContainerRef, scale: bannerContainScale } = useContainScale({
  refW: BANNER_REFERENCE_WIDTH,
  refH: BANNER_REFERENCE_HEIGHT,
})
const bannerStageStyle = computed(() => ({
  width: `${BANNER_REFERENCE_WIDTH}px`,
  height: `${BANNER_REFERENCE_HEIGHT}px`,
  transform: `scale(${bannerContainScale.value})`,
  transformOrigin: 'center',
}))
const bannerSlideCanvasRef = ref<InstanceType<typeof SlideCanvas> | null>(null)

/** Only one of the two branches renders at a time, so exactly one ref is non-null. */
function activeSlideCanvasRef() {
  return slideCanvasRef.value ?? bannerSlideCanvasRef.value
}

// Drive the T-23-08 pause -> (index already written) -> play sequence through the
// exposed handles exactly as PresentationViewer.goToIndex. A default (pre-flush)
// watcher runs BEFORE the canvas re-renders, so pause() hits the outgoing slide's
// media, then after nextTick the canvas holds the new slide and play() starts it.
watch(index, async () => {
  activeSlideCanvasRef()?.pause()
  await nextTick()
  activeSlideCanvasRef()?.play()
})

// Deferred first play — re-homed from the old onMounted (audience 256-259) to a
// view-local watch(fontReady) so the state-arrives-before-the-font-gate race still
// plays the first slide's media once: when the gate resolves and the canvas
// mounts, play() is called after the DOM update.
watch(fontReady, (ready) => {
  if (!ready) return
  void nextTick().then(() => activeSlideCanvasRef()?.play())
})

// Refs are nulled by Vue before onUnmounted runs, so pause() here.
onBeforeUnmount(() => {
  activeSlideCanvasRef()?.pause()
})
</script>
