<template>
  <!-- R272 — full-bleed band-facing confidence surface. Sibling of
       AudienceOutputView: it inherits the entire lifecycle + chrome contract via
       useOutputWindow (94-01) and diverges ONLY here — a current + next
       side-by-side left/right split (current dominant LEFT, next preview RIGHT
       scaled down) with BOTH backgrounds suppressed to plain black. The root
       carries the same `--slide-font-*` CSS-var wrapper so SlideCanvas's scoped
       per-element font rules inherit; cursor is hidden ONLY while fullscreen
       (restored windowed so the re-enter affordance stays clickable). No
       operator chrome of any kind. -->
  <div
    ref="rootRef"
    data-testid="confidence-output"
    class="fixed inset-0 bg-black flex flex-row"
    :style="rootStyle"
  >
    <!-- CURRENT region (dominant, LEFT ~60%). Drives media via currentCanvasRef.
         suppressBackground=true forces SlideCanvas's currentBackgroundUrl null
         FIRST so the actual background image is NEVER shown to the band. Rendered
         ONLY once a valid current slide exists AND the font gate has resolved;
         otherwise pure black with zero elements. No label on this pane. -->
    <div
      data-testid="confidence-current-region"
      class="relative flex-[3_1_0%] flex items-center justify-center overflow-hidden"
    >
      <SlideCanvas
        v-if="currentSlide && fontReady"
        ref="currentCanvasRef"
        :slide="currentSlide"
        :suppressBackground="true"
        :interactive="false"
      />
    </div>

    <!-- NEXT region (subordinate, RIGHT ~40%). STATIC preview — NO ref, never
         driven by play(): the band never hears the upcoming slide's audio nor
         sees its video motion. suppressBackground=true here too. On the last
         slide nextSlide is null: the region STAYS present (flex-[2_1_0%] fixed,
         pure black, "Next" tag hidden) — collapsing it would jump-resize the
         current pane in front of the band on the final advance. The
         border-l border-white/10 hairline is the seam between the left/right
         panes. R276 — the preview is scaled DOWN (SlideCanvas has no font-size
         prop) so the upcoming slide reads smaller than the current pane and fits
         the narrower right column. -->
    <div
      data-testid="confidence-next-region"
      class="relative flex-[2_1_0%] flex items-center justify-center overflow-hidden border-l border-white/10"
    >
      <div
        v-if="nextSlide && fontReady"
        class="flex items-center justify-center"
        style="transform: scale(0.8); transform-origin: center"
      >
        <SlideCanvas
          :slide="nextSlide"
          :suppressBackground="true"
          :interactive="false"
        />
      </div>
      <span
        v-if="nextSlide && fontReady"
        data-testid="confidence-next-label"
        class="absolute top-2 left-3 text-sm font-medium uppercase tracking-wide text-gray-500"
      >
        Next
      </span>
    </div>

    <!-- R280 — full-bleed blackout overlay over BOTH panes. When the control
         posts blackout:true the band monitor shows pure black (sibling of the
         region divs, after them in paint order); blackout:false removes it and
         both panes return. The reenter overlay stays AFTER this so the re-enter
         button remains reachable if fullscreen is lost mid-blackout. -->
    <div
      v-if="blackout"
      class="absolute inset-0 bg-black"
      data-testid="confidence-blackout"
      aria-hidden="true"
    ></div>

    <!-- R271 / Pitfall 6 — the ONE interactive element, shown ONLY when
         fullscreen has been lost. The WHOLE surface is the tap target (inset-0
         full-bleed button, absolutely positioned so it overlays both live panes —
         the fixed-positioned root is its containing block): one tap ANYWHERE on
         the display re-enters fullscreen synchronously (the gestured path). The
         centered pill is only a visual hint (pointer-events-none so the tap always
         lands on the button); slides keep advancing underneath. Losing fullscreen
         NEVER tears down the session, closes the channel, or unmounts the window.
         Calm neutral, NOT the app's action accent. -->
    <button
      v-if="!isFullscreen"
      type="button"
      data-testid="confidence-reenter-fullscreen"
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
// Screen Wake Lock — all inherited identically from the audience window. The
// per-canvas media plumbing stays view-local below (current pane only).
const { assembledSlideshow, index, blackout, fontReady, rootRef, rootStyle, isFullscreen, handleReenterFullscreen } =
  useOutputWindow({ channelFactory: props.channelFactory, role: 'confidence' })

// ── Current + next slides (view-local, from index + assembledSlideshow) ───────
// A null index (before the first RunState) and an out-of-range index both resolve
// to null (pure black) — a malformed/out-of-range index can never crash the band
// monitor (T-94-06).
const currentSlide = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value] ?? null),
)
// index+1 by DIRECT index access (Array.prototype.at is not in this project's TS
// lib target); out-of-range → undefined → ?? null, so the LAST slide yields null
// (pure black next pane), never a crash or a wrap to slide 0 (T-94-06).
const nextSlide = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value + 1] ?? null),
)

// ── Media invariant (CURRENT pane only) ───────────────────────────────────────
// The current pane drives its media exactly as AudienceOutputView; the next pane
// is a STATIC preview with NO ref that is NEVER driven by play() (T-94-07).
const currentCanvasRef = ref<InstanceType<typeof SlideCanvas> | null>(null)

// Drive the T-23-08 pause -> (index already written) -> play sequence through the
// exposed handles. A default (pre-flush) watcher runs BEFORE the canvas
// re-renders, so pause() hits the outgoing slide's media, then after nextTick the
// canvas holds the new slide and play() starts it.
watch(index, async () => {
  currentCanvasRef.value?.pause()
  await nextTick()
  currentCanvasRef.value?.play()
})

// Deferred first play — so the state-arrives-before-the-font-gate race still plays
// the first slide's media once: when the gate resolves and the canvas mounts,
// play() is called after the DOM update.
watch(fontReady, (ready) => {
  if (!ready) return
  void nextTick().then(() => currentCanvasRef.value?.play())
})

// currentCanvasRef is nulled by Vue before onUnmounted runs, so pause() here.
onBeforeUnmount(() => {
  currentCanvasRef.value?.pause()
})
</script>
