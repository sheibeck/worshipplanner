/**
 * Run-control core composable (Phase 97, R276 foundation).
 *
 * Extracted verbatim-in-behaviour from RunControlView.vue's <script setup> so the
 * entire Phase 92-96 control machinery lives in one seam — mirroring how
 * useOutputWindow.ts owns the output-window lifecycle. This composable owns: the
 * single-writer wp-run-{serviceId} channel (index/seq/handle + postIndex +
 * resendCurrent + the onHello resend + the on-mount slide-0 post + the
 * late-arriving-assembly post), the navigation model, the rail derivations, the
 * honest open state machine (OutputStatus + openOutputs/openPlaced/openUnplaced +
 * bothOpened), the WR-01 stale guard (goLiveRequestId/isUnmounted), the Phase
 * 96-01 live-ops recovery (closed-poll + screenschange reassign + per-role
 * reopen), the exit/teardown ordering (stopRecoveryWatchers before closeOutputs),
 * and the document keyboard handler.
 *
 * It MUST be called from inside a component setup() — it registers
 * onMounted/onUnmounted on the calling instance so the channel open + keyboard
 * listener and their teardown run on that view's lifecycle exactly as the
 * un-extracted view did. useServiceAssembly() is called FIRST so its onMounted
 * subscribe registers BEFORE this composable's channel-opening onMounted
 * (subscribe-before-channel ordering preserved, mirroring useOutputWindow).
 *
 * The template (SlideCanvas panes + markup) stays in RunControlView.vue; this
 * composable is a pure behaviour seam — ZERO behaviour change from the extraction.
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { ComputedRef } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import { useServiceAssembly } from '@/composables/useServiceAssembly'
import { useRunTimers } from '@/composables/useRunTimers'
import {
  openRunChannel,
  type BroadcastChannelFactory,
  type RunChannelHandle,
} from '@/utils/runChannel'
import { sortedSlotsWithIndex, firstAssembledIndexBySlot } from '@/utils/serviceSlots'
import {
  loadMapping,
  matchMapping,
  computeFingerprint,
  type MonitorMapping,
  type MonitorRole,
  type ScreenLike,
} from '@/utils/monitorConfig'
import { slotLabel, miscLabel } from '@/utils/slotTypes'
import { SERVICE_SECTION_LABELS, type ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'

/**
 * The enriched rail row shape the rail derivation produces (RunControlView's old
 * railRows). Exported so downstream Phase 97 child components (the rail list) can
 * type their row prop against the one source of truth.
 */
export interface RailRow {
  index: number
  section: string
  title: string
  count: number
  hasSlides: boolean
  isActive: boolean
}

export interface UseRunControlOptions {
  /**
   * Testability seam (93/95-PATTERNS): the run-channel factory is injectable so
   * tests can drive the channel deterministically with an in-memory fake.
   * Production passes nothing and openRunChannel uses the native BroadcastChannel.
   */
  channelFactory?: BroadcastChannelFactory
}

export function useRunControl(options: UseRunControlOptions = {}) {
  // Shared service-load + read-only assembly core (95-01). Owns ?org=/:serviceId
  // scoping, the localService initial-load watch, the read-only assembly, and the
  // WR-02 subscribe gate — do NOT re-do any of it here, and (deliberately) it
  // registers NO unsubscribeAll, so this in-app route never tears down peers.
  // Called FIRST so its onMounted subscribe registers before this composable's
  // channel-opening onMounted (subscribe-before-channel ordering preserved).
  const { serviceId, orgIdRef, localService, assembledSlideshow } = useServiceAssembly()
  const router = useRouter()

  // ── Wall clock + elapsed-since-go-live timers (R281) ───────────────────────
  // startElapsed() is idempotent (first go-live OR first rehearse records the
  // origin); resetElapsed() is called on exit. clock/elapsed are re-exposed for
  // the redesigned header (97-09).
  const { clock, elapsed, startElapsed, resetElapsed } = useRunTimers()

  // ── Live flag (R277) + blackout (R280) ─────────────────────────────────────
  // `live` is the HONEST session flag: set true ONLY by a successful go-live
  // (openPlaced/openUnplaced, past the bothOpened gate) AND by rehearse() — never
  // derived from outputStatus, so partial/blocked never read as live. Reset in
  // confirmExit. `blackout` is the projector-black toggle; every poster now sends
  // blackout.value (defaulting false so pre-97 { blackout:false } assertions hold).
  const live = ref(false)
  const blackout = ref(false)
  // ── Rehearse flag (owner fix #7) ───────────────────────────────────────────
  // `rehearsing` distinguishes a REHEARSAL (live UI, NO output windows) from a
  // real go-live. `live` stays true in BOTH so State B renders and the leave-guard
  // applies, but the header must read a YELLOW "Rehearsing" tile (not green "Live")
  // and its exit button "End Rehearsal". A real go-live (openPlaced/openUnplaced)
  // sets it false; rehearse() sets it true; confirmExit resets it.
  const rehearsing = ref(false)

  // ── Single-writer channel + navigation model (R266) ────────────────────────
  const index = ref<number | null>(null)
  let seq = 0
  let handle: RunChannelHandle | null = null

  /** The ONE place run state is written — every navigation flows through here. */
  function postIndex(target: number) {
    index.value = target
    seq += 1
    handle?.postState({ index: target, blackout: blackout.value, seq })
  }

  /** onHello resend — MUST advance seq so runChannel's stale-drop accepts it. */
  function resendCurrent() {
    if (index.value == null) return
    seq += 1
    handle?.postState({ index: index.value, blackout: blackout.value, seq })
  }

  /**
   * Blackout toggle (R280) — set blackout.value then re-post the CURRENT index
   * with the new blackout. MUST advance seq BEFORE posting (mirrors
   * resendCurrent) so runChannel's monotonic stale-drop accepts it; a post
   * without a seq bump would be silently swallowed and the projector would never
   * black out. No-op (only the ref update) when nothing is live yet (index null).
   */
  function postBlackout(v: boolean) {
    blackout.value = v
    if (index.value == null) return
    seq += 1
    handle?.postState({ index: index.value, blackout: blackout.value, seq })
  }

  /**
   * Rehearse (R283) — enter the live UI WITHOUT opening any output window. Sets
   * live + starts the elapsed timer and, if nothing is showing yet, posts slide 0
   * to drive the channel (a later-opened output syncs via postHello→onHello). It
   * NEVER calls openPlaced/openUnplaced/openWindow/getScreenDetails, so NO
   * window.open fires and outputStatus stays 'idle' (honest: no screens open).
   */
  function rehearse() {
    live.value = true
    // Owner fix #7: a rehearsal is NOT a real go-live — flag it so the header tile
    // reads YELLOW "Rehearsing" (not green "Live") and its exit says "End Rehearsal".
    rehearsing.value = true
    startElapsed()
    if (index.value == null && assembledSlideshow.value.length > 0) postIndex(0)
  }

  const current = computed<AssembledSlide | null>(() =>
    index.value == null ? null : (assembledSlideshow.value[index.value] ?? null),
  )
  const next = computed<AssembledSlide | null>(() =>
    index.value == null ? null : (assembledSlideshow.value[index.value + 1] ?? null),
  )
  const currentSlotIndex = computed<number | null>(() => current.value?.slotIndex ?? null)

  const rail = computed(() => (localService.value ? sortedSlotsWithIndex(localService.value) : []))
  const firstIndexBySlot = computed(() => firstAssembledIndexBySlot(assembledSlideshow.value))

  /** slotIndex -> count of assembled slides, for the rail's per-item slide count. */
  const slideCountBySlot = computed(() => {
    const counts = new Map<number, number>()
    for (const slide of assembledSlideshow.value) {
      counts.set(slide.slotIndex, (counts.get(slide.slotIndex) ?? 0) + 1)
    }
    return counts
  })

  /** A meaningful per-item title, falling back to the kind label. */
  function itemTitle(slot: ServiceSlot): string {
    switch (slot.kind) {
      case 'SONG':
        return slot.songTitle?.trim() || 'Song'
      case 'HYMN':
        return slot.hymnName?.trim() || 'Hymn'
      case 'MISC':
        return miscLabel(slot)
      default:
        return slotLabel(slot)
    }
  }

  function countLabel(count: number): string {
    return count === 1 ? '1 slide' : `${count} slides`
  }

  /** Enriched rail rows: title/section/count + has-slides + active-by-slotIndex. */
  const railRows: ComputedRef<RailRow[]> = computed(() =>
    rail.value.map((item) => {
      const count = slideCountBySlot.value.get(item.index) ?? 0
      return {
        index: item.index,
        section: item.slot.section ? SERVICE_SECTION_LABELS[item.slot.section] : '',
        title: itemTitle(item.slot),
        count,
        hasSlides: firstIndexBySlot.value.has(item.index),
        isActive: item.index === currentSlotIndex.value,
      }
    }),
  )

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goBySlide(delta: number) {
    const len = assembledSlideshow.value.length
    if (len === 0) return
    const cur = index.value ?? 0
    postIndex(Math.min(Math.max(cur + delta, 0), len - 1))
  }

  function goByItem(delta: number) {
    const rows = rail.value
    let pos = rows.findIndex((it) => it.index === currentSlotIndex.value)
    // No active item yet: +1 finds the first navigable item, -1 is a no-op.
    while (true) {
      pos += delta
      const row = rows[pos]
      if (!row) return // walked past either end
      const t = firstIndexBySlot.value.get(row.index)
      if (t !== undefined) {
        postIndex(t)
        return
      }
      // empty slot — keep walking in the same direction
    }
  }

  function jumpToSlot(slotIndex: number) {
    const t = firstIndexBySlot.value.get(slotIndex)
    if (t === undefined) return // empty slot: not clickable, no-op
    postIndex(t)
  }

  // Active-row auto-scroll now lives entirely in RunRail.vue (97-06), which owns
  // its own captureActiveRow + watch(activeIndex) scrollIntoView. The parent-side
  // copy that used to sit here was a dead extraction leftover (IN-01): the view
  // never bound the composable's railRef/captureActiveRow to the child, so its
  // watch(index) → activeItemRef?.scrollIntoView was a permanent optional-chain
  // no-op. Removed so the composable's contract matches what actually drives
  // scrolling — the child is the sole owner.

  // ── Keyboard (R265) ────────────────────────────────────────────────────────
  const confirmOpen = ref(false)
  const cancelBtnRef = ref<HTMLButtonElement | null>(null)

  function handleKeydown(e: KeyboardEvent) {
    if (confirmOpen.value) return // nav keys inert while the dialog is open
    const t = document.activeElement
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return // inert in text inputs
    // PRE-LIVE (State A, !live): ONLY Enter (go live) and Escape act. The
    // transport (arrows/Space) and blackout (B) keys are INERT — there is nothing
    // on the screens to navigate or black out before go-live, and an inert
    // pre-live keyboard complements WR-01's no-action-pre-live posture (a stray
    // keypress can no longer silently change what go-live will show). WR-02: Enter
    // fires the SAME go-live action as run-go-live-btn, wiring the "Press Enter to
    // go live" hint the pre-flight panel advertises.
    if (!live.value) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          openOutputs()
          break
        case 'Escape':
          e.preventDefault()
          confirmOpen.value = true // OPEN the confirm — never immediate teardown
          break
      }
      return
    }
    // LIVE (State B): full transport + blackout.
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
        e.preventDefault()
        goBySlide(1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        goBySlide(-1)
        break
      case 'ArrowDown':
        e.preventDefault()
        goByItem(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        goByItem(-1)
        break
      case 'Escape':
        e.preventDefault()
        // Owner UAT: branch by mode — a rehearsal ends back to pre-flight (no
        // confirm), a real live service opens the exit-confirm (never immediate
        // teardown). onExitRequest is a hoisted function declaration below.
        onExitRequest()
        break
      case 'b':
      case 'B':
        // Toggle projector blackout (R280). The early returns above already make
        // this inert while the exit dialog is open and inside text inputs.
        e.preventDefault()
        postBlackout(!blackout.value)
        break
    }
  }

  // ── Output-window orchestration (R261 / R266) ──────────────────────────────
  // The Go live gesture opens BOTH standalone output windows and (when the live
  // monitors match a saved mapping) places each on its assigned screen. This runs
  // ONLY from the run-go-live-btn click — NEVER onMounted. window.open (pop-up
  // blocker) + requestFullscreen({ screen }) require a live transient activation
  // traceable to a gesture task; after the Run click's router.push + the lazy
  // route-chunk import() + the async auth/org beforeEach guard + the mount tick,
  // Chrome/Edge no longer honor that activation on mount, so an onMounted open
  // would silently open ZERO windows on a cold first Run while claiming success.
  // The operator clicks Go live on the control screen to supply a FRESH, live
  // activation for both window.open and requestFullscreen.
  //
  // HANDSHAKE (95-03): the channel is the single writer from mount and postIndex
  // drives state whether or not a display is open; when Go live opens a window it
  // postHellos and the control's onHello (resendCurrent) resends the current
  // index — so the operator may click Go live at ANY time (even after navigating
  // several slides) and the freshly-opened output syncs to the live slide.
  type OutputStatus = 'idle' | 'opening' | 'placed' | 'partial' | 'fallback' | 'blocked'
  const outputStatus = ref<OutputStatus>('idle')
  const readyAudienceLabel = ref<string | null>(null)
  const readyConfidenceLabel = ref<string | null>(null)
  // WR-02: which display was refused when EXACTLY ONE of the two window.open
  // calls came back null (the honest 'partial' state names the dark monitor).
  const blockedRole = ref<MonitorRole | null>(null)

  // Raw window handles (NOT reactive), keyed by stable window name.
  const outputWindows: Record<string, Window | null> = {}

  // ── Live-Ops recovery (96-01) ──────────────────────────────────────────────
  // The precise ScreenDetails shape we depend on (mirrors MonitorSetupView's
  // ScreenDetailsLike): it carries the live .screens AND the add/removeEventListener
  // pair for 'screenschange'. A bare Function would defeat arity/type checking.
  interface ScreenDetailsLike {
    screens: ScreenLike[]
    addEventListener: (type: 'screenschange', listener: () => void) => void
    removeEventListener: (type: 'screenschange', listener: () => void) => void
  }

  // Per-output CLOSED flags. These do NOT extend OutputStatus (96-UI-SPEC §A): the
  // cluster stays 'placed'; only the affected subordinate line turns amber. LATCH-
  // ONLY — the poll sets them true and NEVER false, so only a successful reopen
  // clears them (a refused reopen can never silently clear the amber row).
  const audienceClosed = ref(false)
  const confidenceClosed = ref(false)
  // A mid-service monitor change (unplug/rearrange) → the reassign banner.
  const monitorChanged = ref(false)
  // The body names the specific missing role when resolvable, else this default.
  const reassignRole = ref('audience or confidence')

  // The SINGLE shared closed-poll interval id (null when not running).
  let pollId: ReturnType<typeof setInterval> | null = null
  // The HELD Go-live ScreenDetails (non-reactive) — reused by reopenOutput for a
  // synchronous same-position reopen, and the target of the screenschange listener.
  let liveScreenDetails: ScreenDetailsLike | null = null

  /** A cross-origin/torn-down handle .closed read can throw — guard it (never-throw). */
  function readClosed(name: string): boolean {
    try {
      return outputWindows[name]?.closed === true
    } catch {
      return false
    }
  }

  /**
   * The SINGLE shared ~1s closed-output poll (one interval, not one-per-window).
   * LATCH-ONLY: it only ever sets a closed ref true, never false, so a null handle
   * after a refused reopen cannot silently clear the amber row — only a successful
   * reopen does. The pollId != null guard makes a second Go-live / reopen idempotent.
   */
  function startClosedPoll() {
    if (pollId != null) return
    pollId = setInterval(() => {
      if (readClosed('wp-audience')) audienceClosed.value = true
      if (readClosed('wp-confidence')) confidenceClosed.value = true
    }, 1000)
  }

  /**
   * PER-ROLE REOPEN (R274) — re-runs the open+place for THAT role ONLY. It is
   * SYNCHRONOUS: it resolves the role's screen from the already-HELD
   * liveScreenDetails.screens via the existing resolveScreen (NO fresh
   * getScreenDetails), so it opens no stale-resolution window and needs no new
   * token — the original openOutputs().then WR-01 guard stays intact.
   * openWindow re-stores outputWindows[name] and best-effort moveTo +
   * requestFullscreen({ screen }). The closed ref is cleared ONLY on a non-null
   * handle: a pop-up-blocker-refused reopen keeps the amber row and never flips the
   * line back to green (honesty rule). Position is NOT persisted — the reopened
   * output's hello → onHello(resendCurrent) resends the CURRENT index, so it
   * returns to the exact current slide; index.value is never touched here.
   */
  function reopenOutput(role: MonitorRole) {
    // IN-03: defense-in-parity with openOutputs' async guard — never open a window
    // outside a live session. reopenOutput is synchronous and today only reachable
    // from a button rendered while placed+mounted, so this cannot fire post-exit in
    // production, but the early-return keeps it honest against a future refactor.
    if (isUnmounted) return
    // WR-01 (defense-in-depth): NEVER open an output window outside a real live
    // session that has already gone live. A reopen is only ever legitimate as a
    // recovery of a genuinely-closed output — which requires (a) live===true and
    // (b) a HELD go-live ScreenDetails (liveScreenDetails). Pre-flight (live=false)
    // and Rehearse (live=true but no getScreenDetails was ever resolved, so
    // liveScreenDetails===null) both NO-OP here, so a stray dot/panel emit can
    // never open an un-positioned window that bypasses the honest open state
    // machine (outputStatus would still read idle while a real window was live).
    if (!live.value || liveScreenDetails === null) return
    const name = role === 'audience' ? 'wp-audience' : 'wp-confidence'
    const url = role === 'audience' ? audienceUrl() : confidenceUrl()
    const saved = loadMapping()
    const screen = saved && liveScreenDetails ? resolveScreen(saved, role, liveScreenDetails.screens) : null
    const win = openWindow(url, name, screen)
    if (!win) return
    if (role === 'audience') audienceClosed.value = false
    else confidenceClosed.value = false
  }

  /**
   * IN-PLACE reassign recovery (R274 / WR-01) — the reassign banner's PRIMARY
   * action. Reopens the affected output role(s) against the CURRENT (post-change)
   * live screens WITHOUT unmounting the control, reusing the reopenOutput →
   * resolveScreen → openWindow path. Position is NOT persisted here: each reopened
   * output announces itself with a hello → onHello(resendCurrent) resends the
   * CURRENT index, so it returns to the exact live slide. If a monitor is truly
   * gone resolveScreen yields null and the output opens un-positioned (honest
   * fallback) — either way the running session (index/seq/channel + the other open
   * output) survives, unlike the old same-tab /monitor-setup navigation that tore
   * it all down. monitorChanged is cleared only AFTER the reopen has run so the
   * banner dismisses on a real recovery action; if the reopen is refused the ~1s
   * closed-poll re-surfaces the honest amber closed row.
   */
  function reopenReassignedOutputs() {
    if (reassignRole.value === 'audience') {
      reopenOutput('audience')
    } else if (reassignRole.value === 'confidence') {
      reopenOutput('confidence')
    } else {
      reopenOutput('audience')
      reopenOutput('confidence')
    }
    monitorChanged.value = false
  }

  /**
   * MONITOR-UNPLUG handler (R274) — re-runs matchMapping against the held live
   * screens. needs-reprompt (or any non-matched) → monitorChanged=true + name the
   * missing role; a still-matching change (benign refresh) → monitorChanged=false,
   * raising NO false alarm. Never guesses a new mapping from the stale one.
   */
  function onScreensChange() {
    if (!liveScreenDetails) return
    const saved = loadMapping()
    if (!saved) {
      monitorChanged.value = false
      return
    }
    const result = matchMapping(saved, liveScreenDetails.screens)
    if (result.status !== 'matched') {
      monitorChanged.value = true
      const audMissing = resolveScreen(saved, 'audience', liveScreenDetails.screens) == null
      const confMissing = resolveScreen(saved, 'confidence', liveScreenDetails.screens) == null
      reassignRole.value =
        audMissing && !confMissing ? 'audience' : confMissing && !audMissing ? 'confidence' : 'audience or confidence'
    } else {
      monitorChanged.value = false
    }
  }

  /**
   * SINGLE-TEARDOWN of both recovery watchers — clears the poll (clearInterval +
   * null the id) AND removes the screenschange listener (null the held ref),
   * null-guarded so the double call (confirmExit then onUnmounted) is safe.
   * Load-bearing: closeOutputs() does NOT null outputWindows entries, so an
   * uncleared poll would keep reading .closed===true forever and re-surface a
   * reopen chip / leak after exit.
   */
  function stopRecoveryWatchers() {
    if (pollId != null) {
      clearInterval(pollId)
      pollId = null
    }
    if (liveScreenDetails) {
      try {
        liveScreenDetails.removeEventListener?.('screenschange', onScreensChange)
      } catch {
        // a listener-less / torn-down handle removeEventListener can throw — never propagate
      }
      liveScreenDetails = null
    }
  }

  // WR-01: monotonic Go-live token + unmount flag guarding a LATE
  // getScreenDetails() resolution from re-opening orphaned output windows after
  // the operator has moved on (a fresh Go-live click, a confirmed exit, or an
  // unmount). Mirrors MonitorSetupView's detectRequestId precedent: every new
  // attempt bumps the token, and confirmExit/onUnmounted invalidate any in-flight
  // resolve so its .then/.catch is a no-op — no window is ever opened after exit.
  let goLiveRequestId = 0
  let isUnmounted = false

  /**
   * Opens ONE output window and (when a target screen is given) best-effort places
   * it there. Returns the ACTUAL window.open handle so callers gate their
   * "opened" claim on a real non-null window — a blocked pop-out (or jsdom)
   * returns null and must never be treated as opened, and must never throw.
   * PLAIN window.open (NO noopener/noreferrer): the HTML spec copies the opener's
   * sessionStorage — carrying the picked org — to the child only when the opener
   * relationship is preserved.
   */
  function openWindow(url: string, name: string, screen: ScreenLike | null): Window | null {
    // Owner UAT — auto-fullscreen the output windows. Chrome's Window Management
    // API supports opening a popup DIRECTLY in fullscreen via the `fullscreen`
    // window feature (with the window-management permission — already granted in
    // monitor setup — and this Go-live user gesture). `left`/`top` pick the
    // target monitor; `fullscreen` fills it with no chrome. These features are
    // harmless best-effort positioning.
    //
    // NOTE: we DELIBERATELY do NOT call win.document.documentElement.request-
    // Fullscreen() here. That cross-document call targets the child's still-
    // loading/blank document from the OPENER and never worked. Reliable auto-
    // fullscreen is now Fullscreen Capability Delegation: the child announces
    // { type:'wp-output-ready' } and we delegate our fullscreen capability back
    // to it (see installFullscreenDelegation / handleOutputReady) while this
    // Go-live click's transient activation is still valid — plus the child's
    // one-tap-anywhere affordance as the guaranteed fallback.
    const features = screen
      ? `fullscreen,popup,left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`
      : ''
    const win = window.open(url, name, screen ? features : '')
    outputWindows[name] = win
    if (!win) return null
    if (screen) {
      try {
        win.moveTo(screen.left, screen.top)
      } catch {
        // best-effort placement — never throw
      }
    }
    return win
  }

  // ── Fullscreen Capability Delegation (opener side) ──────────────────────────
  // A popup cannot self-fullscreen (it loses its own activation to its bootstrap),
  // but WE (the control window) still hold transient activation from the Go-live
  // click. When an opened output posts { type:'wp-output-ready' } back to us, we
  // delegate our fullscreen capability to that exact window via postMessage with
  // the non-standard { delegate:'fullscreen' } option, so the child may then
  // requestFullscreen() with no gesture of its own. Trust is gated on same-origin
  // AND event.source being one of OUR opened output handles. Feature-detected by
  // being ignored: a browser without capability delegation simply drops the option
  // and the child uses its one-tap-anywhere fallback. Never throws.
  let fullscreenDelegationInstalled = false

  function handleOutputReady(event: MessageEvent) {
    if (event.origin !== window.location.origin) return
    const data = event.data as { type?: string } | null
    if (!data || data.type !== 'wp-output-ready') return
    const source = event.source
    if (!source) return
    // Only delegate to a window WE opened (one of the stored output handles).
    const isOurs = Object.keys(outputWindows).some((name) => outputWindows[name] === source)
    if (!isOurs) return
    try {
      ;(source as Window).postMessage(
        { type: 'wp-fullscreen-delegate' },
        // The non-standard `delegate` option is not in the base TS lib's
        // WindowPostMessageOptions — cast it. Ignored by browsers without
        // Fullscreen Capability Delegation (the child then uses its tap fallback).
        { targetOrigin: window.location.origin, delegate: 'fullscreen' } as unknown as WindowPostMessageOptions,
      )
    } catch {
      // cross-origin / torn-down source / unsupported — best-effort, never throw
    }
  }

  function installFullscreenDelegation() {
    if (fullscreenDelegationInstalled) return
    window.addEventListener('message', handleOutputReady)
    fullscreenDelegationInstalled = true
  }

  function removeFullscreenDelegation() {
    if (!fullscreenDelegationInstalled) return
    window.removeEventListener('message', handleOutputReady)
    fullscreenDelegationInstalled = false
  }

  /** Resolve a role → its saved fingerprint → the live screen with that fingerprint. */
  function resolveScreen(saved: MonitorMapping, role: MonitorRole, screens: ScreenLike[]): ScreenLike | null {
    const fingerprint = saved.assignments.find((a) => a.role === role)?.fingerprint
    if (!fingerprint) return null
    return screens.find((s) => computeFingerprint(s) === fingerprint) ?? null
  }

  function screenLabel(screen: ScreenLike | null): string {
    return screen?.label && screen.label.length > 0 ? screen.label : 'display'
  }

  /**
   * WR-02 — honest gate on the TWO output handles before any success claim.
   * A "placed"/"fallback" claim requires BOTH windows to have real (non-null)
   * handles, because some browsers grant only ONE window per user activation:
   *  - both null → 'blocked' (pop-ups refused, nothing opened)
   *  - one null  → 'partial' (one display is live, the other is dark) — the
   *                banner names the refused role and offers retry, NEVER green
   *  - both open → returns true so the caller may make its success claim
   * Returns true ONLY when both windows opened.
   */
  function bothOpened(aWin: Window | null, cWin: Window | null): boolean {
    if (aWin && cWin) return true
    if (!aWin && !cWin) {
      outputStatus.value = 'blocked'
      return false
    }
    // Exactly one opened: name the display that was refused (the null handle).
    blockedRole.value = aWin ? 'confidence' : 'audience'
    outputStatus.value = 'partial'
    return false
  }

  /** MATCHED path — open + place each output on its assigned monitor. */
  function openPlaced(saved: MonitorMapping, screens: ScreenLike[]) {
    const audienceScreen = resolveScreen(saved, 'audience', screens)
    const confidenceScreen = resolveScreen(saved, 'confidence', screens)
    const aWin = openWindow(audienceUrl(), 'wp-audience', audienceScreen)
    const cWin = openWindow(confidenceUrl(), 'wp-confidence', confidenceScreen)
    // Gate the success claim on BOTH real windows (WR-02): fewer than two → an
    // honest blocked/partial state, never a green "Displays ready" over a dark
    // monitor.
    if (!bothOpened(aWin, cWin)) return
    readyAudienceLabel.value = screenLabel(audienceScreen)
    readyConfidenceLabel.value = screenLabel(confidenceScreen)
    outputStatus.value = 'placed'
    // Honest live flag (R277): both outputs opened — this is a genuine go-live.
    live.value = true
    // Owner fix #7: a real go-live is NOT a rehearsal — turn the yellow tile green.
    rehearsing.value = false
    startElapsed()
    // Start the closed-output poll once the outputs have actually opened
    // (idempotent via the pollId != null guard).
    startClosedPoll()
  }

  /** FALLBACK path — open both outputs un-positioned (operator drags + fullscreens). */
  function openUnplaced() {
    const aWin = openWindow(audienceUrl(), 'wp-audience', null)
    const cWin = openWindow(confidenceUrl(), 'wp-confidence', null)
    // WR-02: the amber "two windows opened" fallback claim requires BOTH handles;
    // both-null is blocked, exactly-one-null is the honest partial state.
    if (!bothOpened(aWin, cWin)) return
    outputStatus.value = 'fallback'
    // Honest live flag (R277): both outputs opened (un-positioned) — a genuine
    // go-live, so enter the live state and start the elapsed timer.
    live.value = true
    // Owner fix #7: a real go-live is NOT a rehearsal — turn the yellow tile green.
    rehearsing.value = false
    startElapsed()
    // Start the closed-output poll once the outputs have actually opened
    // (idempotent via the pollId != null guard).
    startClosedPoll()
  }

  // URLs computed at open time so they read the CURRENT serviceId/org.
  function audienceUrl(): string {
    return `/present/audience/${serviceId.value}?org=${orgIdRef.value ?? ''}`
  }
  function confidenceUrl(): string {
    return `/present/confidence/${serviceId.value}?org=${orgIdRef.value ?? ''}`
  }

  /**
   * The Go-live gesture entry — bound to the run-go-live-btn click, run
   * SYNCHRONOUSLY. getScreenDetails() is the FIRST statement after the plain
   * feature-detect (the only line before it is a synchronous ref set), with NO
   * await/store/router before it, so its .then runs while the click's transient
   * activation is still live and window.open + requestFullscreen({ screen })
   * inside openPlaced act within the sanctioned one-gesture window (Pitfall 1/5).
   * Mirrors MonitorSetupView.onDetectClick.
   */
  function openOutputs() {
    // WR-01: claim a fresh token for THIS gesture. A second Go-live click, a
    // confirmed exit, or an unmount bumps goLiveRequestId, so an earlier in-flight
    // getScreenDetails() resolve becomes stale and is dropped below.
    const requestId = ++goLiveRequestId
    outputStatus.value = 'opening'
    // Start listening for output-window readiness BEFORE any window.open, so the
    // Fullscreen Capability Delegation handshake is armed the instant a child
    // signals ready — while THIS click's transient activation is still valid.
    installFullscreenDelegation()
    // Control-screen fullscreen on go-live. This runs SYNCHRONOUSLY inside the
    // run-go-live-btn click / Enter handler (nothing is awaited before it), so the
    // click's live transient activation still authorizes it — the operator asked
    // for the CONTROL window to also go fullscreen when running the service. Plain
    // requestFullscreen() on the document root, feature-detected + .catch-swallowed
    // (never throws, never tears down); Rehearse does NOT call openOutputs, so it
    // stays windowed. Exited again in confirmExit.
    document.documentElement.requestFullscreen?.().catch(() => {
      // Activation lost / unsupported — silent; running continues windowed.
    })
    if (!('getScreenDetails' in window)) {
      openUnplaced()
      return
    }
    ;(window as unknown as { getScreenDetails: () => Promise<ScreenDetailsLike> })
      .getScreenDetails()
      .then((details) => {
        // Stale (a newer attempt superseded us) or the view has torn down — do
        // NOT open windows that would be orphaned (Pitfall 6 / WR-01).
        if (isUnmounted || requestId !== goLiveRequestId) return
        // MONITOR-UNPLUG (R274): HOLD this Go-live ScreenDetails and attach the
        // screenschange listener — AFTER the WR-01 stale guard so a late resolve
        // after exit attaches nothing. Swap off any prior handle first (mirrors
        // MonitorSetupView). The typeof guard is load-bearing: a ScreenDetails
        // without listener support (older engines / a partial test fake) is
        // skipped rather than throwing into the .catch.
        if (liveScreenDetails && liveScreenDetails !== details) {
          try {
            liveScreenDetails.removeEventListener?.('screenschange', onScreensChange)
          } catch {
            // listener-less / torn-down prior handle — never propagate
          }
        }
        liveScreenDetails = details
        if (typeof details.addEventListener === 'function') {
          details.addEventListener('screenschange', onScreensChange)
        }
        const saved = loadMapping()
        if (!saved) {
          openUnplaced()
          return
        }
        const result = matchMapping(saved, details.screens)
        if (result.status !== 'matched') {
          openUnplaced()
          return
        }
        openPlaced(saved, details.screens)
      })
      .catch(() => {
        if (isUnmounted || requestId !== goLiveRequestId) return
        openUnplaced()
      })
  }

  /** Guarded teardown of every opened output window — called first on exit. */
  function closeOutputs() {
    for (const name of Object.keys(outputWindows)) {
      try {
        outputWindows[name]?.close()
      } catch {
        // a closed/cross-origin window .close() can throw — never propagate
      }
    }
  }

  // ── Exit confirm ───────────────────────────────────────────────────────────
  // Owner fix #6: while live (which INCLUDES rehearsing) any attempt to leave the
  // control screen — an in-app route change, browser Back, or a tab close/refresh —
  // must prompt to confirm ENDING the service and actually end it before leaving.
  // A cancelled in-app leave is remembered here so CONFIRM proceeds to the ORIGINAL
  // destination (not the service-editor default) after teardown.
  const pendingLeaveTo = ref<RouteLocationNormalized | null>(null)

  function openExitConfirm() {
    confirmOpen.value = true
  }
  function cancelExit() {
    confirmOpen.value = false
    // A cancelled route-leave must not "stick" — clear it so a later deliberate
    // End Service goes to the service-editor default rather than the stale target.
    pendingLeaveTo.value = null
  }

  /**
   * The shared end-service teardown (R266/R277/R280/R281) — everything confirmExit
   * does EXCEPT the final navigation. Extracted so both the End Service button and
   * the confirmed in-app route-leave (owner fix #6) run the identical teardown.
   */
  function endServiceTeardown() {
    // WR-01: invalidate any in-flight Go-live resolve so a late getScreenDetails()
    // cannot re-open orphaned output windows after the operator has exited.
    goLiveRequestId += 1
    // Stop the recovery watchers BEFORE closeOutputs() — closeOutputs() does NOT
    // null outputWindows entries, so an uncleared poll would latch a closed ref
    // for a window the operator deliberately closed on exit and re-surface a
    // reopen chip after teardown (96-01 endurance fix). Null-guarded for the
    // double call with onUnmounted.
    stopRecoveryWatchers()
    // Stop listening for output-window readiness — the run session is ending, so
    // no further fullscreen delegation should fire (and the listener must not leak).
    removeFullscreenDelegation()
    // Leave the live state: drop live + rehearsing + blackout and reset the elapsed
    // timer (R277/R280/R281). Order relative to the window teardown does not matter.
    live.value = false
    rehearsing.value = false
    blackout.value = false
    resetElapsed()
    // Blank the projector FIRST — close the output windows before the channel
    // close + navigation, so ending run mode tears down the real displays (R266).
    closeOutputs()
    handle?.close()
    // Leave the control-screen fullscreen entered on go-live (only when we are
    // actually fullscreen — a rehearse exit never entered it). Feature-detected +
    // .catch-swallowed so a reject/absence never blocks teardown or navigation.
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {
        // Already exited / unsupported — never block the exit path.
      })
    }
  }

  /**
   * END REHEARSAL (owner UAT) — return to the pre-flight "Ready when you are"
   * screen (State A) WITHOUT tearing down or navigating away. A rehearsal opened
   * NO output windows and holds no getScreenDetails (liveScreenDetails===null), so
   * there is nothing on the congregation screens to close: we simply drop live +
   * rehearsing (→ State A renders via v-if="!live"), reset the elapsed timer, and
   * clear blackout so a later Go live starts clean. The run channel handle stays
   * open (the operator is still in the console); when they click Go live the
   * existing openOutputs path re-drives everything and the freshly-opened outputs
   * sync via the hello→resend handshake. Deliberately NEVER window.open,
   * router.push, or the confirmExit teardown — ending a rehearsal is low-stakes and
   * needs no confirm.
   */
  function endRehearsal() {
    rehearsing.value = false
    live.value = false
    blackout.value = false
    resetElapsed()
  }

  /**
   * EXIT affordance router (owner UAT) — the header @exit branches by mode. During
   * a REHEARSAL (rehearsing) it ends low-stakes back to pre-flight (endRehearsal:
   * no confirm, no teardown, no navigation). During a real LIVE service
   * (live && !rehearsing) it opens the exit-confirm dialog, whose confirm runs the
   * full teardown + navigation (unchanged). Pre-flight (!live) never reaches this —
   * the header exit button only renders in the live states.
   */
  function onExitRequest() {
    if (rehearsing.value) {
      endRehearsal()
    } else {
      openExitConfirm()
    }
  }

  function confirmExit() {
    confirmOpen.value = false
    endServiceTeardown()
    // Owner fix #6: if this confirm resolves a cancelled in-app route-leave, proceed
    // to the ORIGINAL destination — teardown already set live=false, so the re-fired
    // leave-guard allows it (no double-prompt, no double-navigate). Otherwise the
    // deliberate End Service returns to the service editor.
    const dest = pendingLeaveTo.value
    pendingLeaveTo.value = null
    if (dest) {
      router.push(dest.fullPath)
    } else {
      router.push({ name: 'service-editor', params: { id: serviceId.value } })
    }
  }

  // ── Leave guards (owner fix #6, scoped to a TRULY-LIVE service — owner UAT) ──
  // IN-APP navigation: only a REAL live service (live && !rehearsing — outputs are
  // on the congregation screens) CANCELs the leave and opens the exit-confirm
  // dialog, remembering the destination; CONFIRM tears down then proceeds, CANCEL
  // stays. A REHEARSAL puts nothing on the screens, so leaving it is UNGUARDED
  // (End Rehearsal returns to pre-flight instead); not-live leaves pass straight
  // through too.
  onBeforeRouteLeave((to) => {
    if (!live.value || rehearsing.value) return true
    pendingLeaveTo.value = to
    confirmOpen.value = true
    return false
  })

  // TAB CLOSE / REFRESH: a beforeunload listener (present ONLY during a truly-live
  // service, live && !rehearsing) triggers the browser's native "Leave site?"
  // prompt. The browser will NOT run app teardown on a hard unload — the confirm
  // itself is the requirement. Rehearse never arms it (nothing is on the screens).
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault()
    e.returnValue = ''
  }
  watch(
    () => live.value && !rehearsing.value,
    (guarded) => {
      if (guarded) {
        window.addEventListener('beforeunload', handleBeforeUnload)
      } else {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    },
  )
  watch(confirmOpen, async (open) => {
    if (!open) return
    await nextTick()
    cancelBtnRef.value?.focus()
  })

  /**
   * Owner UAT: the run header should show the SERVICE DATE (services are
   * identified by date, like the editor's own title), formatted as
   * "Sunday, MM/DD/YYYY" — not the generic service name. Parses the stored
   * YYYY-MM-DD as a LOCAL date (avoids the UTC off-by-one a bare `new Date(str)`
   * would give) and falls back to the raw string / name if unparseable.
   */
  function formatServiceDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map((n) => Number(n))
    if (!y || !m || !d) return dateStr
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
  const serviceHeading = computed(() => {
    const svc = localService.value
    if (!svc) return ''
    return svc.date ? formatServiceDate(svc.date) : svc.name
  })

  /** Bare service name (no date) — the RunPreflightPanel `serviceName` prop. */
  const serviceName = computed(() => localService.value?.name ?? '')

  // ── Pre-flight readiness (R276) — HONEST, from renderState (NOT CCLI) ───────
  const slideCount = computed(() => assembledSlideshow.value.length)
  /** Number of rail items (the RunPreflightPanel `itemCount` prop). */
  const itemCount = computed(() => railRows.value.length)
  /**
   * Count of assembled slides that are drawable now: renderState is undefined
   * (a 'pending'/'failed' PPTX render is NOT ready). See slide.ts (:50-62).
   */
  const renderedCount = computed(
    () => assembledSlideshow.value.filter((s) => s.slide.renderState === undefined).length,
  )
  /** Honest 'all N slides rendered' — every slide drawable, and at least one exists. */
  const allRendered = computed(() => slideCount.value > 0 && renderedCount.value === slideCount.value)

  // ── Monitor labels (from the saved mapping fingerprints) + open flags ───────
  /** The saved-mapping display label for a role, or an honest 'no monitor' note. */
  function mappingLabel(role: MonitorRole): string {
    const saved = loadMapping()
    const fp = saved?.assignments.find((a) => a.role === role)?.fingerprint
    if (!fp) return 'No monitor assigned'
    // The fingerprint's first colon-segment is the display label (monitorConfig :69-72).
    return fp.split(':')[0] || 'Assigned display'
  }
  const audienceLabel = computed(() => mappingLabel('audience'))
  const confidenceLabel = computed(() => mappingLabel('confidence'))
  /** open = the output is live/placed (placed|fallback) AND not closed. */
  const audienceOpen = computed(
    () => (outputStatus.value === 'placed' || outputStatus.value === 'fallback') && !audienceClosed.value,
  )
  const confidenceOpen = computed(
    () => (outputStatus.value === 'placed' || outputStatus.value === 'fallback') && !confidenceClosed.value,
  )
  /** Objects for RunDisplaysPanel's `{ open, label }` per-output prop contract. */
  const audience = computed(() => ({ open: audienceOpen.value, label: audienceLabel.value }))
  const confidence = computed(() => ({ open: confidenceOpen.value, label: confidenceLabel.value }))

  // ── In-item filmstrip (R282) — the active item's slides + GLOBAL indices ────
  const filmstrip = computed(() => {
    const slides: AssembledSlide[] = []
    const indices: number[] = []
    assembledSlideshow.value.forEach((s, i) => {
      if (s.slotIndex === currentSlotIndex.value) {
        slides.push(s)
        indices.push(i)
      }
    })
    return { slides, indices }
  })
  const filmstripSlides = computed(() => filmstrip.value.slides)
  const filmstripIndices = computed(() => filmstrip.value.indices)
  /** The current slide's position WITHIN the active item (RunFilmstrip currentIndex). */
  const filmstripCurrentIndex = computed(() => index.value)

  /**
   * The active rail item's slides as { arrayIndex, label, isCurrent } — RunRail's
   * `expandedSlides` prop. Label is the lyric section label when present, else a
   * positional 'Slide N' within the item.
   */
  const expandedSlides = computed(() =>
    filmstrip.value.slides.map((s, i) => {
      const arrayIndex = filmstrip.value.indices[i] ?? -1
      const slide = s.slide
      const sectionLabel = (slide as { sectionLabel?: string }).sectionLabel
      // Owner UAT: the copyright slides at a song's start/end (CopyrightSlide —
      // contentKind 'lyric', no sectionId; carries the title/CCLI/license) have
      // no section label, so they used to fall back to a bare 'Slide N' that read
      // like a bug. Label them 'Credits' instead. 'Slide N' stays only as an
      // ultimate fallback for any other label-less slide.
      const isCopyright = slide.contentKind === 'lyric' && !('sectionId' in slide)
      return {
        arrayIndex,
        label: sectionLabel?.trim() || (isCopyright ? 'Credits' : `Slide ${i + 1}`),
        isCurrent: arrayIndex === index.value,
      }
    }),
  )

  // ── Header / transport position + progress ─────────────────────────────────
  /** 'Item X of N · slide Y of M' — item position + slide-within-item, honest. */
  const positionLabel = computed(() => {
    if (index.value == null || slideCount.value === 0) return ''
    const itemPos = railRows.value.findIndex((r) => r.index === currentSlotIndex.value)
    const within = filmstrip.value.indices.indexOf(index.value)
    const itemPart = itemPos >= 0 ? `Item ${itemPos + 1} of ${itemCount.value}` : ''
    const slidePart = within >= 0 ? `slide ${within + 1} of ${filmstrip.value.slides.length}` : ''
    return [itemPart, slidePart].filter((p) => p.length > 0).join(' · ')
  })
  /** Progress across the whole slideshow as a 0–100 percentage (RunTransportBar). */
  const progress = computed(() =>
    slideCount.value === 0 ? 0 : (((index.value ?? 0) + 1) / slideCount.value) * 100,
  )

  /**
   * Open the monitor-setup screen in a NEW TAB so the running control (index/seq/
   * channel + any open outputs) survives — mirrors the reassign banner's new-tab
   * rule. Owner fix #5: NO 'noopener'. noopener severs the opener relationship, and
   * the HTML spec only copies the opener's sessionStorage — which carries a
   * multi-church user's picked active org — to the child when that relationship is
   * preserved. With noopener the fresh tab had no active-org, so the router guard
   * bounced it to /select-church. A plain window.open (like the run/output windows
   * already use) lets the new tab inherit sessionStorage and load monitor-setup.
   */
  function openManage() {
    window.open('/monitor-setup', '_blank')
  }

  // ── Channel lifecycle + initial go-live ────────────────────────────────────
  onMounted(() => {
    handle = openRunChannel(serviceId.value, options.channelFactory)
    handle.onHello(resendCurrent)
    document.addEventListener('keydown', handleKeydown)
    if (index.value == null && assembledSlideshow.value.length > 0) postIndex(0)
  })

  // Assembly may arrive AFTER mount — go live on slide 0 once slides exist and the
  // channel is open (guarded so there is never a double slide-0 post).
  watch(assembledSlideshow, (slides) => {
    if (index.value == null && slides.length > 0) postIndex(0)
  })

  onUnmounted(() => {
    // WR-01: mark torn down so a late getScreenDetails() resolve short-circuits
    // instead of opening windows into a dead component.
    isUnmounted = true
    // Clear the closed-poll interval + remove the screenschange listener exactly
    // once here too (null-guarded, safe after a confirmExit that already ran it).
    // closeOutputs() never nulls outputWindows, so without this an uncleared poll
    // would run forever after unmount — the load-bearing endurance fix.
    stopRecoveryWatchers()
    // Never leak the fullscreen-delegation message listener past teardown.
    removeFullscreenDelegation()
    handle?.close()
    document.removeEventListener('keydown', handleKeydown)
    // Owner fix #6: never leak the live-only beforeunload listener past teardown.
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  return {
    // service/nav model
    serviceHeading,
    serviceName,
    index,
    current,
    next,
    currentSlotIndex,
    // live session + blackout + timers (R277/R280/R281)
    live,
    rehearsing,
    blackout,
    postBlackout,
    rehearse,
    clock,
    elapsed,
    // pre-flight readiness (R276) — honest, from renderState
    slideCount,
    itemCount,
    renderedCount,
    allRendered,
    // monitor labels + open flags
    audienceLabel,
    confidenceLabel,
    audienceOpen,
    confidenceOpen,
    audience,
    confidence,
    // in-item filmstrip (R282) + rail expansion
    filmstrip,
    filmstripSlides,
    filmstripIndices,
    filmstripCurrentIndex,
    expandedSlides,
    // header / transport derivations
    positionLabel,
    progress,
    openManage,
    // rail
    railRows,
    firstIndexBySlot,
    countLabel,
    jumpToSlot,
    // transport (returned for 97-08/97-09 wiring even though the current template
    // drives them via handleKeydown/jumpToSlot internally — harmless + forward-enabling)
    goBySlide,
    goByItem,
    postIndex,
    // open state machine
    outputStatus,
    readyAudienceLabel,
    readyConfidenceLabel,
    blockedRole,
    audienceClosed,
    confidenceClosed,
    monitorChanged,
    reassignRole,
    reopenOutput,
    reopenReassignedOutputs,
    openOutputs,
    // exit confirm + mode-branched exit affordance (owner UAT)
    confirmOpen,
    openExitConfirm,
    onExitRequest,
    endRehearsal,
    cancelExit,
    confirmExit,
    cancelBtnRef,
  }
}
