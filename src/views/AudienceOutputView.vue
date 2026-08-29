<template>
  <!-- R270 — full-bleed pure-black congregation-facing surface. The root
       carries the same `--slide-font-*` CSS-var wrapper PresentationViewer
       sets so SlideCanvas's scoped per-element font rules inherit; cursor is
       hidden ONLY while fullscreen (restored windowed so the re-enter
       affordance stays clickable). No operator chrome of any kind. -->
  <div
    ref="rootRef"
    data-testid="audience-output"
    class="fixed inset-0 bg-black flex items-center justify-center"
    :style="rootStyle"
  >
    <!-- Live slide — background ON (no suppressBackground; that is Phase 94's
         confidence job). Rendered ONLY once a valid current slide exists AND
         the bounded font gate has resolved; otherwise the surface is pure
         black with zero elements (deliberate divergence from
         PresentationViewer's spinner + "Loading slideshow…" heading — a
         projector must never flash a spinner or copy at a congregation). -->
    <SlideCanvas
      v-if="currentSlide && fontReady"
      ref="slideCanvasRef"
      :slide="currentSlide"
      :interactive="false"
    />

    <!-- R280 — full-bleed blackout overlay. When the control posts blackout:true
         the projector shows pure black, painting OVER the live slide (sibling of
         SlideCanvas, after it in paint order); blackout:false removes it and the
         slide returns. No partial reveal (T-97-03-03). The reenter overlay stays
         AFTER this so the re-enter button remains reachable if fullscreen is lost
         mid-blackout. -->
    <div
      v-if="blackout"
      class="absolute inset-0 bg-black"
      data-testid="audience-blackout"
      aria-hidden="true"
    ></div>

    <!-- R271 / Pitfall 6 — the ONE interactive element in this view, shown
         ONLY when fullscreen has been lost. It overlays the live slide (no
         black scrim — slides keep advancing underneath). Its click re-enters
         fullscreen synchronously; losing fullscreen NEVER tears down the
         session, closes the channel, or unmounts the window. Calm neutral,
         NOT the app's action accent. -->
    <div
      v-if="!isFullscreen"
      class="absolute inset-0 flex items-center justify-center"
    >
      <button
        type="button"
        data-testid="audience-reenter-fullscreen"
        aria-label="Re-enter fullscreen"
        class="inline-flex items-center gap-2 rounded-full bg-gray-900/80 backdrop-blur-sm px-4 min-h-11 min-w-11 text-base font-medium text-gray-100"
        @click="handleReenterFullscreen"
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
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import type { AssembledSlide } from '@/types/slide'
import { useOutputWindow } from '@/composables/useOutputWindow'
import type { BroadcastChannelFactory } from '@/utils/runChannel'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'

/**
 * Testability seam (93-PATTERNS §4): the run-channel factory is injectable so
 * tests can drive `onState` deterministically with an in-memory fake. Production
 * passes nothing and `openRunChannel` uses the native BroadcastChannel. The prop
 * is forwarded into useOutputWindow so the composable threads it to openRunChannel.
 */
const props = defineProps<{
  channelFactory?: BroadcastChannelFactory
}>()

// The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId
// scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel,
// font gate, rootStyle cursor coupling, non-teardown fullscreen recovery, and the
// Screen Wake Lock — all registered on THIS view's instance via its onMounted/
// onUnmounted. The per-canvas media plumbing stays view-local below.
const { assembledSlideshow, index, blackout, fontReady, rootRef, rootStyle, isFullscreen, handleReenterFullscreen } =
  useOutputWindow({ channelFactory: props.channelFactory, role: 'audience' })

// ── Current slide + media invariant (view-local per-canvas plumbing) ──────────
// A null index (before the first RunState) and an out-of-range index both
// resolve to null (pure black) — a malformed/out-of-range index can never crash
// the projector (T-93-01).
const currentSlide = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value] ?? null),
)
const slideCanvasRef = ref<InstanceType<typeof SlideCanvas> | null>(null)

// Drive the T-23-08 pause -> (index already written) -> play sequence through the
// exposed handles exactly as PresentationViewer.goToIndex. A default (pre-flush)
// watcher runs BEFORE the canvas re-renders, so pause() hits the outgoing slide's
// media, then after nextTick the canvas holds the new slide and play() starts it.
watch(index, async () => {
  slideCanvasRef.value?.pause()
  await nextTick()
  slideCanvasRef.value?.play()
})

// Deferred first play — re-homed from the old onMounted (audience 256-259) to a
// view-local watch(fontReady) so the state-arrives-before-the-font-gate race still
// plays the first slide's media once: when the gate resolves and the canvas
// mounts, play() is called after the DOM update.
watch(fontReady, (ready) => {
  if (!ready) return
  void nextTick().then(() => slideCanvasRef.value?.play())
})

// slideCanvasRef is nulled by Vue before onUnmounted runs, so pause() here.
onBeforeUnmount(() => {
  slideCanvasRef.value?.pause()
})
</script>
