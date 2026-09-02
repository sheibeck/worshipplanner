/** See ADR-0123 (docs/adr/0123-lifecycle.md) */
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
  /** See .planning/codebase/STACK.md (§ Component & Composable Stack Notes (R318) -> src/composables/useOutputWindow.ts, "role option") */
  role?: MonitorRole
}

export function useOutputWindow(options: UseOutputWindowOptions = {}) {
  const authStore = useAuthStore()
  const serviceStore = useServiceStore()

  // See ADR-0123 (docs/adr/0123-lifecycle.md)
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

  // See ADR-0124 (docs/adr/0124-this-listener-only-updates-isfullscreen-it-must-never-call-a.md)
  function handleFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement
    reportFullscreenState()
  }

  // Report REAL fullscreen state to the opener (control) so each per-display
  // "Go fullscreen" button reflects ground truth: it shows a done ✓ when the display
  // is ACTUALLY fullscreen, and flips back to "Go fullscreen" the instant someone
  // presses Escape (a real fullscreenchange) — not merely whether the button was
  // clicked. Lets the projectionist see, at the booth, which displays still need a
  // click. Best-effort; no/cross-origin opener → silent.
  function reportFullscreenState() {
    try {
      window.opener?.postMessage(
        { type: 'wp-fullscreen-state', role: options.role ?? null, fullscreen: isFullscreen.value },
        window.location.origin,
      )
    } catch {
      /* no / cross-origin opener */
    }
  }

  function handleReenterFullscreen() {
    // See ADR-0125 (docs/adr/0125-5-only-a-synchronous-in-window-gesture-can-re-enter-the.md)
    rootRef.value?.requestFullscreen().catch(() => {
      // Rejection is a common, expected outcome (missing gesture, embedding
      // context) — swallow silently, never surface an error to the congregation.
    })
  }

  // See .planning/codebase/STACK.md (§ Component & Composable Stack Notes (R318) -> src/composables/useOutputWindow.ts, "Fullscreen Capability Delegation (best-effort zero-tap)")
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

  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useOutputWindow.ts, "Automatic Fullscreen content setting")
  async function attemptAutoFullscreen() {
    try {
      // The { name:'fullscreen', allowWithoutGesture:true } descriptor is not in the
      // base TS lib's PermissionDescriptor — cast it. A browser without it THROWS.
      const status = await navigator.permissions.query(
        { name: 'fullscreen', allowWithoutGesture: true } as unknown as PermissionDescriptor,
      )
      if (status.state === 'granted') {
        // PLAIN — no { screen }. The window is already positioned on its monitor.
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch {
      // Absent Permissions API / unsupported descriptor / query rejection — silent.
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

  // See ADR-0123 (docs/adr/0123-lifecycle.md)
  onMounted(async () => {
    // Receive-only channel: set the index from control's state, announce our
    // (re)mount so control re-sends current state, and NEVER post state ourselves.
    handle = openRunChannel(serviceId.value, options.channelFactory)
    handle.onState((state) => {
      index.value = state.index
      blackout.value = state.blackout
    })
    handle.postHello()

    // Best-effort automatic fullscreen where the browser honors the content setting
    // (fire-and-forget; a silent no-op where it does not — see attemptAutoFullscreen).
    void attemptAutoFullscreen()

    // Fullscreen Capability Delegation — ALWAYS listen, so each per-display
    // "Go fullscreen" button on the control's Displays panel works: that button click
    // delegates ITS gesture to THIS window, which then requestFullscreen()s reliably
    // (the window is already open + loaded, so the gesture is not eaten by a load
    // race). We deliberately do NOT auto-announce readiness on mount anymore —
    // auto-delegating on open raced the automatic path and produced the "every other
    // open" flakiness. Fullscreen is now explicit and deterministic: one delegated
    // button click per display, all in one place at the booth. The one-tap-anywhere
    // overlay (rendered while !isFullscreen) remains as a last resort.
    window.addEventListener('message', handleDelegationMessage)

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    // Announce initial fullscreen state (normally false) so the control's per-display
    // button starts in the correct "Go fullscreen" state without waiting for a change.
    reportFullscreenState()
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

    // See .planning/codebase/CONCERNS.md (§ Component & Composable Concern Notes (R318) -> src/composables/useOutputWindow.ts)
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
