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
import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import type { Service } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useSlideshowAssembly } from '@/composables/useSlideshowAssembly'
import { openRunChannel, type BroadcastChannelFactory, type RunChannelHandle } from '@/utils/runChannel'
import { SLIDE_FONTS } from '@/config/slideFonts'
import { cssVarsFor, snapWeight, waitForSlideFont, loadFontCss, FONT_LOAD_TIMEOUT_MS } from '@/utils/slideTypography'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'

/**
 * Testability seam (93-PATTERNS §4): the run-channel factory is injectable so
 * tests can drive `onState` deterministically with an in-memory fake. Production
 * passes nothing and `openRunChannel` uses the native BroadcastChannel.
 */
const props = defineProps<{
  channelFactory?: BroadcastChannelFactory
}>()

const route = useRoute()
const authStore = useAuthStore()
const serviceStore = useServiceStore()

// ── Org + service scoping ────────────────────────────────────────────────────
// serviceId from the route param; org from the ?org= query (the self-scoping
// convention per 93-CONTEXT), falling back to the auth store's active org.
const serviceId = computed(() => route.params.serviceId as string)
const orgIdRef = computed(() => (route.query.org as string | undefined) ?? authStore.orgId ?? null)

// Read-only viewer: the initial-load branch ONLY — no backfillSlotIds, no
// JSON clone, no dirty tracking, no remote-merge (all editor machinery).
const localService = ref<Service | null>(null)
watch(
  () => serviceStore.services,
  (services) => {
    if (localService.value) return // initial-load only
    const found = services.find((s) => s.id === serviceId.value)
    if (found) {
      localService.value = found
    }
  },
  { immediate: true },
)

// In-window assembly — canWrite OMITTED so it stays its false default: a viewer
// never attempts a materialize/rebuild write its Firestore rules would deny.
const { assembledSlideshow } = useSlideshowAssembly(localService, orgIdRef)

// ── Run channel (receive-only) ───────────────────────────────────────────────
const index = ref<number | null>(null)
const blackout = ref(false) // read for forward-compat; drives NO UI this milestone
let handle: RunChannelHandle | null = null

// ── Current slide + media invariant ──────────────────────────────────────────
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

// ── Font gate (congregation-safe first paint) ────────────────────────────────
const DEFAULT_FONT_FAMILY = 'Inter'
const DEFAULT_FONT_WEIGHT = 400
const fontReady = ref(false)

/** The root's CSS-var typography wrapper + the fullscreen-only cursor hide. */
const rootStyle = computed(() => ({
  ...cssVarsFor(authStore.settings.slideTypography),
  fontFamily: 'var(--slide-font-family)',
  cursor: isFullscreen.value ? 'none' : 'auto',
}))

function resolvedFontChoice(): { family: string; weight: number } {
  const typography = authStore.settings.slideTypography
  const family =
    typography?.fontFamily !== undefined && SLIDE_FONTS[typography.fontFamily]
      ? typography.fontFamily
      : DEFAULT_FONT_FAMILY
  const weight = snapWeight(family, typography?.fontWeight ?? DEFAULT_FONT_WEIGHT)
  return { family, weight }
}

// ── Fullscreen loss recovery (learn the idiom, DIVERGE from teardown) ─────────
// jsdom reports document.fullscreenElement as `undefined`, real browsers as
// `null` when not fullscreen — `!!` treats both as "not fullscreen".
const rootRef = ref<HTMLElement | null>(null)
const isFullscreen = ref<boolean>(!!document.fullscreenElement)

// This listener ONLY updates isFullscreen. It must NEVER call any exit/teardown/
// close/unmount path — the single most dangerous copy-paste risk from
// PresentationViewer.handleFullscreenChange (Pitfall 6).
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function handleReenterFullscreen() {
  // Pitfall 5 — only a synchronous in-window gesture can re-enter; the
  // requestFullscreen() call MUST be the handler's first statement, no await.
  rootRef.value?.requestFullscreen().catch(() => {
    // Rejection is a common, expected outcome (missing gesture, embedding
    // context) — swallow silently, never surface an error to the congregation.
  })
}

// ── Screen Wake Lock (R271; no in-repo analog) ───────────────────────────────
const wakeLock = ref<WakeLockSentinel | null>(null)

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return // feature-detect; absence is non-fatal
  try {
    wakeLock.value = await navigator.wakeLock.request('screen')
  } catch {
    // Rejection (no gesture, policy, hidden tab) is non-fatal — never a toast.
  }
}

function handleVisibilityChange() {
  // The lock auto-releases when the tab hides, so re-acquire on return.
  if (document.visibilityState === 'visible') {
    void acquireWakeLock()
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Service subscription — key the service source off the SAME resolved orgId
  // useSlideshowAssembly subscribes content to, not off "is the store fresh?".
  //
  // WR-02 (93-REVIEW): the old `!serviceStore.orgId` gate assumed a fresh Pinia
  // singleton (the standalone window.open path). But this is also a directly-
  // loadable SPA route: on a same-tab navigation where the store is ALREADY
  // subscribed to org X while this URL's `?org=` is Y, that gate skipped the
  // re-subscribe, leaving `services` sourced from X while the assembly reads Y —
  // a silent cross-org desync on the congregation surface (never-found service →
  // permanent black, or an X service assembled against Y's content maps). Gate on
  // an org MISMATCH instead: subscribe() is idempotent (it tears down the prior
  // listener first), so re-subscribing when the requested org differs re-keys the
  // service source to `orgIdRef` and eliminates the bleed. Skipping when the org
  // already matches preserves the existing subscription (no redundant re-listen).
  const orgId = orgIdRef.value
  if (orgId && serviceStore.orgId !== orgId) {
    serviceStore.subscribe(orgId)
  }

  // Receive-only channel: set the index from control's state, announce our
  // (re)mount so control re-sends current state, and NEVER post state ourselves.
  handle = openRunChannel(serviceId.value, props.channelFactory)
  handle.onState((state) => {
    index.value = state.index
    blackout.value = state.blackout
  })
  handle.postHello()

  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void acquireWakeLock()

  // Bounded font-load gate — a rejected import or timeout must never strand the
  // projector, so try/catch/finally always resolves fontReady (mirrors
  // PresentationViewer's R094 gate).
  try {
    const { family, weight } = resolvedFontChoice()
    await Promise.race([
      (async () => {
        if (family !== DEFAULT_FONT_FAMILY || weight !== DEFAULT_FONT_WEIGHT) {
          await loadFontCss(family, weight)
        }
        await waitForSlideFont(family, weight, FONT_LOAD_TIMEOUT_MS)
      })(),
      new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS)),
    ])
  } catch {
    // Degrade to "render anyway" — same as a timeout.
  } finally {
    fontReady.value = true
  }

  // Deferred first play until AFTER the font gate (and its DOM update) so the
  // canvas — and the media refs it mounts — exist by the time play() is called.
  await nextTick()
  slideCanvasRef.value?.play()
})

// slideCanvasRef is nulled by Vue before onUnmounted runs, so pause() here.
onBeforeUnmount(() => {
  slideCanvasRef.value?.pause()
})

onUnmounted(async () => {
  handle?.close()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  try {
    await wakeLock.value?.release()
  } catch {
    // Releasing an already-released lock can reject — never block teardown on it.
  }
  wakeLock.value = null
  // Safe here: this standalone window is the sole consumer of the store, unlike
  // ServiceEditorView which deliberately leaves the subscription up for peers.
  serviceStore.unsubscribeAll()
})
</script>
