<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Monitor Setup</h1>
        <p class="text-sm text-gray-400 mt-1">
          Set up which screen shows your congregation and which shows your team. You only need to
          do this once per computer.
        </p>
      </div>

      <!-- State D: API unavailable -->
      <MonitorFallbackPanel v-if="phase === 'unavailable'" reason="unavailable" @retry="onDetectClick" />

      <!-- State C: permission denied -->
      <MonitorFallbackPanel v-else-if="phase === 'denied'" reason="denied" @retry="onDetectClick" />

      <!-- State A: before detection -->
      <div v-else-if="phase === 'prompt' || phase === 'detecting'" class="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center max-w-md mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h2 class="text-base font-semibold text-gray-100 mt-3">Set up your displays</h2>
        <p class="text-sm text-gray-400 mt-1">Click below to find the monitors connected to this computer.</p>
        <button
          type="button"
          data-testid="detect-button"
          :disabled="phase === 'detecting'"
          class="mt-4 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
          @click="onDetectClick"
        >
          {{ phase === 'detecting' ? 'Detecting...' : 'Detect My Monitors' }}
        </button>
      </div>

      <!-- Granted -->
      <div v-else-if="phase === 'granted'">
        <!-- State B2: already configured, matches live screens -->
        <div v-if="grantedView === 'matched' && !editingFromMatched" class="rounded-lg bg-gray-900 border border-gray-800 p-4">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="text-base font-semibold text-gray-100">Your displays are set up</h2>
          </div>
          <p class="text-sm text-gray-400 mt-1">This computer's setup still matches what you saved — nothing to do.</p>
          <div class="text-sm text-gray-300 mt-3 space-y-1">
            <p>Audience &rarr; {{ screenLabelFor(audienceFingerprint) }}</p>
            <p>Confidence &rarr; {{ screenLabelFor(confidenceFingerprint) }}</p>
          </div>
          <button
            type="button"
            class="mt-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            @click="onReassignRoles"
          >
            Reassign roles
          </button>
        </div>

        <!-- State B / B3: editable grid -->
        <div v-else>
          <div v-if="grantedView === 'reprompt'" class="bg-amber-900/20 border border-amber-800/60 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <h3 class="text-sm font-semibold text-amber-200">Your monitor setup changed</h3>
            </div>
            <p class="text-xs text-amber-200/80 mt-1">We found different displays than last time. Please assign roles again below.</p>
          </div>

          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-300">Your displays</h2>
            <button
              type="button"
              class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md px-3 py-1.5"
              @click="onRedetect"
            >
              Re-detect
            </button>
          </div>

          <!-- WR-02: a re-detect / OS screenschange whose physical screen set
               is unchanged must NOT silently discard the operator's unsaved
               in-progress selections — we keep them and say so, non-blockingly. -->
          <p
            v-if="refreshNoticeVisible"
            data-testid="refresh-kept-notice"
            class="text-xs text-amber-300 mt-2"
          >
            Your displays look the same as before, so we kept your in-progress choices. Save when you're ready.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <MonitorCard
              v-for="item in screensWithFingerprint"
              :key="item.fingerprint"
              :screen="item.screen"
              :fingerprint="item.fingerprint"
              :selected-role="selectedRoleFor(item.fingerprint)"
              @select-role="onSelectRole(item.fingerprint, $event)"
            />
          </div>

          <div v-if="saveOutcome !== 'saved'" class="mt-6 flex items-center gap-3">
            <button
              type="button"
              data-testid="save-button"
              :disabled="!canSave"
              class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
              @click="onSave"
            >
              Save monitor setup
            </button>
            <p v-if="sameMonitorSelected" class="text-red-400 text-sm">Choose two different displays for Audience and Confidence.</p>
          </div>
          <div v-else class="mt-6 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-green-400 text-sm font-medium">Saved for this device</span>
            <button
              type="button"
              class="text-xs text-gray-400 underline"
              @click="saveOutcome = 'idle'"
            >
              Change
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import MonitorCard from '@/components/MonitorCard.vue'
import MonitorFallbackPanel from '@/components/MonitorFallbackPanel.vue'
import { useToasts } from '@/stores/toasts'
import {
  computeFingerprint,
  saveMapping,
  loadMapping,
  matchMapping,
  type MonitorMapping,
  type MonitorAssignment,
  type MonitorRole,
  type ScreenLike,
} from '@/utils/monitorConfig'

type Phase = 'prompt' | 'detecting' | 'denied' | 'unavailable' | 'granted'
type GrantedView = 'fresh' | 'matched' | 'reprompt'

/**
 * Precise structural shape of the live `ScreenDetails` object (REVIEW-FIX
 * IN-04): replaces the bare `Function` type, which erased call-signature
 * checking entirely (any callable of any arity would type-check).
 */
interface ScreenDetailsLike {
  screens: ScreenLike[]
  addEventListener: (type: 'screenschange', listener: () => void) => void
  removeEventListener: (type: 'screenschange', listener: () => void) => void
}

// Phase 104 (R309/R310) — the app-wide dismissible-message store. The
// save-outcome warning below is the second R310 proof case (alongside
// RunControlView.vue's monitor-reassign sticky): keyed, cleared the moment
// saveOutcome leaves 'not-persisted-warning', and manually dismissible via
// the shared host in the meantime.
const notifications = useToasts()

const phase = ref<Phase>('prompt')
const grantedView = ref<GrantedView>('fresh')
// B2's "already configured" summary expanded in place into the editable grid
// via "Reassign roles" — the ONE case pre-selection from a saved mapping is
// correct, since it's a confirmed match, not a layout-changed reprompt.
const editingFromMatched = ref(false)

const liveScreens = ref<ScreenLike[]>([])
const audienceFingerprint = ref<string | null>(null)
const confidenceFingerprint = ref<string | null>(null)
const saveOutcome = ref<'idle' | 'saved' | 'not-persisted-warning'>('idle')

// WR-02 state: `dirtyEdits` tracks whether the operator has made unsaved
// in-progress role selections (a fresh/reprompt selection, or a "Reassign
// roles" edit from the matched summary). `refreshNoticeVisible` surfaces a
// non-blocking notice when a mid-session refresh (Re-detect / OS
// screenschange) was suppressed to protect those edits because the physical
// screen set had not actually changed.
const dirtyEdits = ref(false)
const refreshNoticeVisible = ref(false)

// Not reactive — a raw handle to the live ScreenDetails object for the
// screenschange listener, removed in onUnmounted.
let screenDetailsRef: ScreenDetailsLike | null = null

// Monotonic token guarding against a stale getScreenDetails() resolution
// overriding a newer detection attempt (REVIEW-FIX WR-03). Bumped by every
// new detection attempt, so a resolution/rejection that arrives after a newer
// attempt started is a no-op.
let detectRequestId = 0

const screensWithFingerprint = computed(() =>
  liveScreens.value.map((screen) => ({ screen, fingerprint: computeFingerprint(screen) })),
)

function selectedRoleFor(fingerprint: string): MonitorRole | null {
  if (audienceFingerprint.value === fingerprint) return 'audience'
  if (confidenceFingerprint.value === fingerprint) return 'confidence'
  return null
}

function screenLabelFor(fingerprint: string | null): string {
  if (!fingerprint) return '—'
  const item = screensWithFingerprint.value.find((s) => s.fingerprint === fingerprint)
  if (!item) return '—'
  return `${item.screen.label || 'Unlabeled display'} (${item.screen.width} x ${item.screen.height})`
}

function onSelectRole(fingerprint: string, role: MonitorRole) {
  if (role === 'audience') {
    audienceFingerprint.value = fingerprint
    if (confidenceFingerprint.value === fingerprint) confidenceFingerprint.value = null
  } else {
    confidenceFingerprint.value = fingerprint
    if (audienceFingerprint.value === fingerprint) audienceFingerprint.value = null
  }
  saveOutcome.value = 'idle'
  // The operator has an unsaved edit now — a same-layout refresh must not
  // clobber it (WR-02). Clear any prior "we kept your choices" notice too.
  dirtyEdits.value = true
  refreshNoticeVisible.value = false
}

// Expanding the matched B2 summary into the editable grid is itself the start
// of an unsaved edit — mark it dirty so a same-layout Re-detect / screenschange
// can't collapse it back to the read-only summary (WR-02).
function onReassignRoles() {
  editingFromMatched.value = true
  dirtyEdits.value = true
  refreshNoticeVisible.value = false
}

const sameMonitorSelected = computed(
  () =>
    audienceFingerprint.value !== null &&
    confidenceFingerprint.value !== null &&
    audienceFingerprint.value === confidenceFingerprint.value,
)

const canSave = computed(
  () =>
    audienceFingerprint.value !== null &&
    confidenceFingerprint.value !== null &&
    audienceFingerprint.value !== confidenceFingerprint.value,
)

function assignmentSetsEqual(a: MonitorAssignment[], b: MonitorAssignment[]): boolean {
  if (a.length !== b.length) return false
  const key = (x: MonitorAssignment) => `${x.fingerprint}::${x.role}`
  const setA = new Set(a.map(key))
  const setB = new Set(b.map(key))
  if (setA.size !== setB.size) return false
  for (const k of setA) {
    if (!setB.has(k)) return false
  }
  return true
}

function onSave() {
  if (!canSave.value || !audienceFingerprint.value || !confidenceFingerprint.value) return
  const assignments: MonitorAssignment[] = [
    { fingerprint: audienceFingerprint.value, role: 'audience' },
    { fingerprint: confidenceFingerprint.value, role: 'confidence' },
  ]
  const mapping: MonitorMapping = { assignments, savedAt: Date.now() }
  saveMapping(mapping)
  // Round-trip check — saveMapping() never throws and silently no-ops on
  // private-mode/disabled storage, so only a confirmed read-back proves the
  // write actually persisted (T-92-02).
  const readBack = loadMapping()
  const persisted = readBack !== null && assignmentSetsEqual(readBack.assignments, assignments)
  if (persisted) {
    saveOutcome.value = 'saved'
    // The edit is now the saved baseline — no longer dirty (WR-02).
    dirtyEdits.value = false
    refreshNoticeVisible.value = false
    if (grantedView.value === 'reprompt') {
      grantedView.value = 'fresh'
    }
  } else {
    saveOutcome.value = 'not-persisted-warning'
  }
}

// Phase 104 (R310) — migrates the old inline v-if warning onto the shared
// sticky store. A single watcher covers every path saveOutcome can take AWAY
// from 'not-persisted-warning' (a successful save, picking a different role,
// or a fresh detection re-resolving the granted branch) rather than
// duplicating the clear call at each of those call sites; clearSticky is
// idempotent, so this is harmless even when nothing is currently set.
watch(saveOutcome, (value) => {
  if (value === 'not-persisted-warning') {
    notifications.setSticky('monitor-save-not-persisted', {
      variant: 'warning',
      heading: 'Setup not saved',
      body: "We couldn't save this on your browser (this often happens in private browsing). Your selections will work for now but will be forgotten once you close this tab.",
    })
  } else {
    notifications.clearSticky('monitor-save-not-persisted')
  }
})

function resolveGrantedBranch() {
  // A full (re)resolution establishes a clean baseline from persisted state —
  // any prior in-progress edit is intentionally being replaced here, so clear
  // the dirty/notice flags (WR-02). Callers that must PROTECT an unsaved edit
  // (applyDetectedScreens on a same-set refresh) skip calling this entirely.
  dirtyEdits.value = false
  refreshNoticeVisible.value = false
  const saved = loadMapping()
  if (!saved) {
    grantedView.value = 'fresh'
    audienceFingerprint.value = null
    confidenceFingerprint.value = null
    saveOutcome.value = 'idle'
    return
  }
  const result = matchMapping(saved, liveScreens.value)
  if (result.status === 'matched') {
    grantedView.value = 'matched'
    editingFromMatched.value = false
    const audience = saved.assignments.find((a) => a.role === 'audience')
    const confidence = saved.assignments.find((a) => a.role === 'confidence')
    audienceFingerprint.value = audience ? audience.fingerprint : null
    confidenceFingerprint.value = confidence ? confidence.fingerprint : null
  } else {
    // Layout changed since the mapping was saved — never guess the new
    // mapping from the stale one (PITFALLS Pitfall 2).
    grantedView.value = 'reprompt'
    audienceFingerprint.value = null
    confidenceFingerprint.value = null
  }
  saveOutcome.value = 'idle'
}

// A stable, order-independent key of the physical screen SET, used to decide
// whether a mid-session refresh actually changed the monitors (WR-02).
function screenSetKey(screens: ScreenLike[]): string {
  return screens.map(computeFingerprint).sort().join('|')
}

/**
 * Applies a detected `ScreenDetails` to the view and (re)attaches the
 * screenschange listener.
 *
 * `isRefresh` distinguishes a mid-session re-detect / OS screenschange (the
 * operator is already looking at the granted grid, possibly mid-edit) from an
 * initial detection. On a refresh whose physical screen SET is unchanged, an
 * unconditional `resolveGrantedBranch()` would silently discard the operator's
 * unsaved role selections (and collapse a "Reassign roles" edit back to the
 * read-only summary) — so we keep the in-progress edit and show a non-blocking
 * notice instead (WR-02). A genuine layout change still re-resolves, since
 * selections made against screens that are gone are no longer valid.
 */
function applyDetectedScreens(details: ScreenDetailsLike, isRefresh: boolean) {
  const previousKey = screenSetKey(liveScreens.value)
  const nextKey = screenSetKey(details.screens)

  if (screenDetailsRef && screenDetailsRef !== details) {
    screenDetailsRef.removeEventListener('screenschange', onScreensChange)
  }
  screenDetailsRef = details
  details.addEventListener('screenschange', onScreensChange)
  phase.value = 'granted'
  liveScreens.value = details.screens

  if (isRefresh && nextKey === previousKey && dirtyEdits.value) {
    // Same monitors, unsaved edit in flight — protect it (WR-02).
    refreshNoticeVisible.value = true
    return
  }
  resolveGrantedBranch()
}

function onScreensChange() {
  if (!screenDetailsRef) return
  applyDetectedScreens(screenDetailsRef, true)
}

function handleDetectionSuccess(details: ScreenDetailsLike) {
  applyDetectedScreens(details, false)
}

function handleRefreshSuccess(details: ScreenDetailsLike) {
  applyDetectedScreens(details, true)
}

function handleDetectionFailure() {
  phase.value = 'denied'
  // 104-REVIEW IN-01: the saveOutcome watcher only fires when saveOutcome
  // itself changes, so a stale 'not-persisted-warning' sticky from the
  // 'granted' phase would otherwise keep showing over this now-unrelated
  // fallback panel until unmount. Mirrors resolveGrantedBranch()'s existing
  // reset-to-'idle' pattern.
  saveOutcome.value = 'idle'
}

// The single most gesture-sensitive line in this phase: getScreenDetails()
// MUST be the first statement here (after the plain feature-detect guard,
// which consumes no event-loop turn) with NO await/store dispatch/router
// call before it — an intervening await loses user activation and the
// permission prompt silently fails to appear (PITFALLS Pitfall 1/9).
function onDetectClick() {
  if (!('getScreenDetails' in window)) {
    phase.value = 'unavailable'
    return
  }
  phase.value = 'detecting'
  // Synchronous ref bump, NOT an await — preserves user activation for the
  // getScreenDetails() call immediately below (PITFALLS Pitfall 1/9).
  const requestId = ++detectRequestId
  ;(window as any)
    .getScreenDetails()
    .then((details: ScreenDetailsLike) => {
      // Stale-resolution guard (REVIEW-FIX WR-03): ignore if a newer
      // detection attempt started while this was still pending.
      if (requestId === detectRequestId) handleDetectionSuccess(details)
    })
    .catch(() => {
      if (requestId === detectRequestId) handleDetectionFailure()
    })
}

// Mid-session replug refresh (no full page reload) — permission is already
// granted at this point, so no user-activation requirement applies here.
function onRedetect() {
  if (!('getScreenDetails' in window)) {
    phase.value = 'unavailable'
    return
  }
  const requestId = ++detectRequestId
  ;(window as any)
    .getScreenDetails()
    .then((details: ScreenDetailsLike) => {
      // Refresh path — protect any unsaved in-progress edit when the physical
      // screen set is unchanged (WR-02).
      if (requestId === detectRequestId) handleRefreshSuccess(details)
    })
    .catch(() => {
      if (requestId === detectRequestId) handleDetectionFailure()
    })
}

onMounted(async () => {
  if (!('getScreenDetails' in window)) {
    phase.value = 'unavailable'
    return
  }
  phase.value = 'prompt'
  try {
    if ('permissions' in navigator) {
      // Pre-read for UI state only — never the actual gate (PITFALLS Pitfall 1).
      const status = await (navigator as any).permissions.query({ name: 'window-management' })
      if (status && status.state === 'granted') {
        // Already granted for this origin — no fresh user gesture is required
        // to call getScreenDetails() again, so a returning visit feels like
        // the "one click, ever" experience (R268).
        phase.value = 'detecting'
        const requestId = ++detectRequestId
        try {
          const details = await (window as any).getScreenDetails()
          if (requestId === detectRequestId) handleDetectionSuccess(details)
        } catch {
          if (requestId === detectRequestId) handleDetectionFailure()
        }
      }
    }
  } catch {
    // permissions.query unsupported or itself throws — stay in State A and
    // wait for the Detect click; never treat this as the gate.
  }
})

onUnmounted(() => {
  if (screenDetailsRef) {
    screenDetailsRef.removeEventListener('screenschange', onScreensChange)
  }
  // R309 (no message may stay stuck on screen): the host is app-global, so a
  // save-outcome sticky raised on this view must not survive into whatever
  // screen the operator navigates to next. Idempotent no-op if already clear.
  notifications.clearSticky('monitor-save-not-persisted')
})
</script>
