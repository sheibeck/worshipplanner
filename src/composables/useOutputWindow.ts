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
import { loadMapping, computeFingerprint, type MonitorRole, type ScreenLike } from '@/utils/monitorConfig'
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
   * R278 self-fullscreen: each output view passes its OWN static role
   * ('audience' | 'confidence') — the routes /present/audience|confidence make
   * the role statically known, so no control-side `&role=` URL param is needed.
   * When set (and the Window Management API + a saved mapping resolve the role's
   * assigned screen), the mount-time selfFullscreen() targets that screen. When
   * absent/unresolvable it degrades to a single plain requestFullscreen().
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

  // ── Self-fullscreen on load (R278) ─────────────────────────────────────────
  // Each output resolves ITS OWN assigned screen from the granted Window
  // Management permission + the saved localStorage mapping, then fullscreens
  // onto it — replacing reliance on the control's unreliable cross-document
  // requestFullscreen({ screen }). Every call is feature-detected + try/catch
  // swallowed: a missing permission, absent API, or unresolvable screen degrades
  // to a single plain requestFullscreen(), and the manual "Re-enter fullscreen"
  // affordance remains as the honest final fallback. NEVER throws.

  /** Resolve the role's saved fingerprint → the live screen with that fingerprint (mirrors RunControlView.resolveScreen). Never throws. */
  async function resolveAssignedScreen(): Promise<ScreenLike | null> {
    if (!options.role || !('getScreenDetails' in window)) return null
    try {
      const details = await (
        window as unknown as { getScreenDetails: () => Promise<{ screens: ScreenLike[] }> }
      ).getScreenDetails()
      const saved = loadMapping()
      if (!saved) return null
      const fingerprint = saved.assignments.find((a) => a.role === options.role)?.fingerprint
      if (!fingerprint) return null
      return details.screens.find((s) => computeFingerprint(s) === fingerprint) ?? null
    } catch {
      // Permission denied / API rejects — degrade to the plain-fullscreen fallback.
      return null
    }
  }

  /** Best-effort mount-time fullscreen onto the assigned screen; plain fullscreen once when unresolvable. Never throws. */
  async function selfFullscreen() {
    if (isFullscreen.value) return
    const screen = await resolveAssignedScreen()
    try {
      // Pitfall 5 — the requestFullscreen call is the FIRST statement in each
      // branch; the non-standard { screen } option is cast+guarded exactly as
      // RunControlView.openWindow does. requestFullscreen rejects ASYNC (not a
      // throw), so the returned promise is .catch-swallowed like the manual
      // affordance; the try/catch guards a synchronous absence of the method.
      const attempt = screen
        ? rootRef.value?.requestFullscreen({ screen } as unknown as FullscreenOptions)
        : rootRef.value?.requestFullscreen()
      attempt?.catch(() => {
        // Missing gesture / activation lost / unsupported — silent; the manual
        // "Re-enter fullscreen" affordance remains as the honest fallback.
      })
    } catch {
      // Synchronous absence/unsupported — silent; the manual affordance remains.
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

    // R278 — best-effort self-fullscreen onto this role's assigned monitor,
    // AFTER postHello() so channel setup is never blocked by a fullscreen await.
    void selfFullscreen()

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
