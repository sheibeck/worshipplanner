/**
 * Shared output-window lifecycle-core (Phase 94, R272 reuse-not-fork).
 *
 * Extracted verbatim-in-behavior from AudienceOutputView.vue so the audience
 * window and the Phase 94 confidence window share ONE lifecycle-core instead of
 * copy-pasting it. This composable owns: the `?org=`/`:serviceId` scoping, the
 * WR-02 org-mismatch subscribe gate, the read-only `useSlideshowAssembly`
 * (canWrite omitted), the receive-only run channel (onState/postHello/close —
 * NEVER postState), the bounded font gate, `rootStyle` (CSS-var wrapper +
 * cursor:none-while-fullscreen), non-teardown fullscreen-loss recovery, and the
 * Screen Wake Lock.
 *
 * It MUST be called from inside a component `setup()` — it registers
 * `onMounted`/`onUnmounted` on the calling instance so cleanup (channel close,
 * listener removal, wake-lock release, unsubscribeAll) runs on that view's
 * unmount exactly as the un-extracted view did.
 *
 * The per-canvas media play/pause plumbing (slideCanvasRef + watch(index) +
 * deferred first-play + pre-unmount pause) deliberately STAYS IN EACH VIEW: the
 * audience window has one live canvas; the confidence window has one live canvas
 * plus one inert preview. Each view builds `currentSlide` (and confidence's
 * `nextSlide`) locally from the returned `index` + `assembledSlideshow`.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useServiceAssembly } from '@/composables/useServiceAssembly'
import { openRunChannel, type BroadcastChannelFactory, type RunChannelHandle } from '@/utils/runChannel'
import { type MonitorRole } from '@/utils/monitorConfig'
import { SLIDE_FONTS } from '@/config/slideFonts'
import { cssVarsFor, snapWeight, waitForSlideFont, loadFontCss, FONT_LOAD_TIMEOUT_MS } from '@/utils/slideTypography'

export interface UseOutputWindowOptions {
  /**
   * Testability seam (93-PATTERNS §4): the run-channel factory is injectable so
   * tests can drive `onState` deterministically with an in-memory fake. Each
   * consuming view forwards its own `channelFactory` prop into this argument.
   * Production passes nothing and `openRunChannel` uses native BroadcastChannel.
   */
  channelFactory?: BroadcastChannelFactory
  /**
   * Each output view passes its OWN static role ('audience' | 'confidence') — the
   * routes /present/audience|confidence make the role statically known. Retained as
   * a harmless identity option; fullscreen is no longer resolved from it. The
   * control creates + positions each window on its assigned monitor via window.open
   * features, and auto-fullscreen is driven by Fullscreen Capability Delegation from
   * the opener (see handleDelegationMessage) rather than any self-request here.
   */
  role?: MonitorRole
}

export function useOutputWindow(options: UseOutputWindowOptions = {}) {
  const authStore = useAuthStore()
  const serviceStore = useServiceStore()

  // ── Shared service-load + read-only assembly slice (Phase 95) ───────────────
  // useServiceAssembly owns the serviceId/org scoping, the localService
  // initial-load watch, the read-only useSlideshowAssembly (canWrite omitted),
  // and the WR-02 org-mismatch subscribe gate (in ITS onMounted). It is called
  // FIRST here so that onMounted registers BEFORE this composable's onMounted —
  // preserving the subscribe-before-channel ordering (the subscribe fires before
  // the run channel opens). This composable keeps the output-only lifecycle
  // (channel, font gate, cursor, fullscreen recovery, wake lock, and the
  // onUnmounted serviceStore.unsubscribeAll()).
  const { serviceId, assembledSlideshow } = useServiceAssembly()

  // ── Run channel (receive-only) ─────────────────────────────────────────────
  const index = ref<number | null>(null)
  const blackout = ref(false) // R280 — returned so each view renders a full-bleed black overlay when true
  let handle: RunChannelHandle | null = null

  // ── Font gate (congregation-safe first paint) ──────────────────────────────
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

  // ── Fullscreen loss recovery (learn the idiom, DIVERGE from teardown) ───────
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

  // ── Fullscreen Capability Delegation (best-effort zero-tap) ─────────────────
  // A popup opened via window.open loses its OWN transient user-activation the
  // moment its SPA/auth bootstrap runs, so a mount-time requestFullscreen() here
  // always rejected ("API can only be initiated by a user gesture") — the console
  // error the owner saw. The correct mechanism is Fullscreen Capability
  // Delegation: the OPENER (control window), which still HAS activation from the
  // Go-live click, delegates its fullscreen capability to us. We (a) announce
  // readiness so the opener knows to delegate, and (b) on receiving the delegation
  // message call requestFullscreen() — now permitted WITHOUT our own gesture. A
  // browser that does not implement capability delegation simply never enables us,
  // and the one-tap-anywhere affordance (rendered while !isFullscreen) guarantees
  // a usable result. All best-effort: never throws, never surfaces an error.
  function handleDelegationMessage(event: MessageEvent) {
    // Trust ONLY same-origin messages (the opener is our own app on our origin).
    if (event.origin !== window.location.origin) return
    const data = event.data as { type?: string } | null
    if (!data || data.type !== 'wp-fullscreen-delegate') return
    // Permitted now via the delegated capability — swallow any rejection so a
    // browser without delegation (or a lost activation) falls back to the tap.
    try {
      const result = document.documentElement.requestFullscreen?.()
      if (result) result.catch(() => {})
    } catch {
      // Absent API / disallowed — silent; the one-tap affordance is the fallback.
    }
  }

  // ── Screen Wake Lock (R271; no in-repo analog) ─────────────────────────────
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

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  // NOTE: the WR-02 org-mismatch subscribe gate now lives in useServiceAssembly's
  // onMounted, which — because useServiceAssembly() is called first in this
  // setup — registers and fires BEFORE this onMounted. So the service source is
  // (re)keyed to the resolved org before this handler opens the run channel.
  onMounted(async () => {
    // Receive-only channel: set the index from control's state, announce our
    // (re)mount so control re-sends current state, and NEVER post state ourselves.
    handle = openRunChannel(serviceId.value, options.channelFactory)
    handle.onState((state) => {
      index.value = state.index
      blackout.value = state.blackout
    })
    handle.postHello()

    // Fullscreen Capability Delegation — the ZERO-TAP path (replaces the old
    // un-gestured mount-time requestFullscreen() that only ever threw the console
    // error). Listen for the opener's delegation message, then announce readiness
    // to the opener so it delegates its fullscreen capability back to us while its
    // Go-live click's transient activation is still valid. Both wrapped so an
    // absent/cross-origin opener never throws; if delegation never lands, the
    // one-tap-anywhere affordance (rendered while !isFullscreen) is the fallback.
    window.addEventListener('message', handleDelegationMessage)
    try {
      window.opener?.postMessage({ type: 'wp-output-ready' }, window.location.origin)
    } catch {
      // No opener / cross-origin opener — best-effort; the tap fallback remains.
    }

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

    // NOTE: the deferred first-play (audience old onMounted 256-259) is NOT here —
    // it references the view's canvas ref and is re-homed to a view-local
    // watch(fontReady) in each consuming view.
  })

  onUnmounted(async () => {
    handle?.close()
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('message', handleDelegationMessage)
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

  return { assembledSlideshow, index, blackout, fontReady, rootRef, rootStyle, isFullscreen, handleReenterFullscreen }
}
