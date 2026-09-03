<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Monitor Setup</h1>
        <p class="text-sm text-gray-400 mt-1">
          Set up which screens show your congregation and which show your team. You only need to
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
            <p v-for="a in matchedSummaryList" :key="a.fingerprint">
              {{ roleLabel(a.role) }} &rarr; {{ screenLabelFor(a.fingerprint) }}
            </p>
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
          <div v-if="grantedView === 'partial'" data-testid="partial-delta-notice" class="bg-amber-900/20 border border-amber-800/60 rounded-lg p-4 mb-4">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <h3 class="text-sm font-semibold text-amber-200">
                We found {{ newDisplayCount }} new display{{ newDisplayCount === 1 ? '' : 's' }}
              </h3>
            </div>
            <!-- See ADR-0215 (docs/adr/0215-layout-changed-since-the-mapping-was-saved-never-guess-the-n.md) —
                 kept assignments stay pre-selected below; only the new display(s) are left unassigned. -->
            <p class="text-xs text-amber-200/80 mt-1">Your other assignments are still set up. Assign a role to the new display below, or leave it as None.</p>
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

          <!-- See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md) -->
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
              :nickname="nicknameByFingerprint[item.fingerprint] ?? ''"
              @select-role="onSelectRole(item.fingerprint, $event)"
              @update-nickname="onUpdateNickname(item.fingerprint, $event)"
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
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import MonitorCard from '@/components/MonitorCard.vue'
import MonitorFallbackPanel from '@/components/MonitorFallbackPanel.vue'
import { useToasts } from '@/stores/toasts'
import {
  computeFingerprint,
  computeFingerprints,
  saveMapping,
  loadMapping,
  matchMapping,
  type MonitorMapping,
  type MonitorAssignment,
  type MonitorRole,
  type ScreenLike,
  type MatchResultV2,
} from '@/utils/monitorConfig'

type Phase = 'prompt' | 'detecting' | 'denied' | 'unavailable' | 'granted'
type GrantedView = 'fresh' | 'matched' | 'partial'

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
// Per-monitor role/nickname state (R325 fix): a fingerprint present in
// roleByFingerprint holds that role; absent means None. This is the exact
// replacement for the old audienceFingerprint/confidenceFingerprint singleton
// refs — mutating one fingerprint's entry never touches any other.
const roleByFingerprint = reactive<Record<string, MonitorRole>>({})
const nicknameByFingerprint = reactive<Record<string, string>>({})
// Count of currently-undetected-before displays surfaced by a 'partial' match
// (R326/R328) — drives the "we found N new displays" copy.
const newDisplayCount = ref(0)
const saveOutcome = ref<'idle' | 'saved' | 'not-persisted-warning'>('idle')

// See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
const dirtyEdits = ref(false)
const refreshNoticeVisible = ref(false)

// Not reactive — a raw handle to the live ScreenDetails object for the
// screenschange listener, removed in onUnmounted.
let screenDetailsRef: ScreenDetailsLike | null = null

// See ADR-0214 (docs/adr/0214-monotonic-token-guarding-against-a-stale-getscreendetails.md)
let detectRequestId = 0

// Fingerprints for the WHOLE live array via computeFingerprints (Plan 01) so
// identical-monitor indices match what was saved, not a per-screen lone-group
// fingerprint that would collide/misalign when two monitors share an identity.
const screensWithFingerprint = computed(() => {
  const fingerprintByScreen = computeFingerprints(liveScreens.value)
  return liveScreens.value.map((screen) => ({
    screen,
    fingerprint: fingerprintByScreen.get(screen)!,
  }))
})

function selectedRoleFor(fingerprint: string): MonitorRole | null {
  return roleByFingerprint[fingerprint] ?? null
}

function roleLabel(role: MonitorRole): string {
  return role === 'audience' ? 'Audience' : 'Confidence'
}

function screenLabelFor(fingerprint: string): string {
  const nickname = nicknameByFingerprint[fingerprint]
  if (nickname) return nickname
  const item = screensWithFingerprint.value.find((s) => s.fingerprint === fingerprint)
  if (!item) return 'Unknown'
  return `${item.screen.label || 'Unknown'} (${item.screen.width} x ${item.screen.height})`
}

// A summary list for the B2 "already configured" view — lists EVERY assigned
// monitor (any count, incl. multiple Audience), not two fixed slots.
const matchedSummaryList = computed(() =>
  Object.entries(roleByFingerprint)
    .map(([fingerprint, role]) => ({ fingerprint, role }))
    .sort((a, b) => (a.role === b.role ? a.fingerprint.localeCompare(b.fingerprint) : a.role === 'audience' ? -1 : 1)),
)

function onSelectRole(fingerprint: string, role: MonitorRole | null) {
  // This is the R325 fix: a non-null role sets ONLY this fingerprint's entry;
  // None deletes ONLY this fingerprint's entry. Never touches another card.
  if (role === null) {
    delete roleByFingerprint[fingerprint]
  } else {
    roleByFingerprint[fingerprint] = role
  }
  saveOutcome.value = 'idle'
  // See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
  dirtyEdits.value = true
  refreshNoticeVisible.value = false
}

function onUpdateNickname(fingerprint: string, value: string) {
  nicknameByFingerprint[fingerprint] = value
  saveOutcome.value = 'idle'
  // See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
  dirtyEdits.value = true
  refreshNoticeVisible.value = false
}

// See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
function onReassignRoles() {
  editingFromMatched.value = true
  dirtyEdits.value = true
  refreshNoticeVisible.value = false
}

// ≥1 Audience required to Save; Confidence optional (CONTEXT.md decision).
const canSave = computed(() => Object.values(roleByFingerprint).includes('audience'))

function assignmentSetsEqual(a: MonitorAssignment[], b: MonitorAssignment[]): boolean {
  if (a.length !== b.length) return false
  const key = (x: MonitorAssignment) => `${x.fingerprint}::${x.role}::${x.nickname ?? ''}`
  const setA = new Set(a.map(key))
  const setB = new Set(b.map(key))
  if (setA.size !== setB.size) return false
  for (const k of setA) {
    if (!setB.has(k)) return false
  }
  return true
}

function onSave() {
  if (!canSave.value) return
  const assignments: MonitorAssignment[] = Object.entries(roleByFingerprint).map(([fingerprint, role]) => {
    const nickname = nicknameByFingerprint[fingerprint]
    const assignment: MonitorAssignment = { fingerprint, role }
    if (nickname) assignment.nickname = nickname
    return assignment
  })
  const mapping: MonitorMapping = { assignments, savedAt: Date.now() }
  saveMapping(mapping)
  // Round-trip check — saveMapping() never throws and silently no-ops on
  // private-mode/disabled storage, so only a confirmed read-back proves the
  // write actually persisted (T-92-02).
  const readBack = loadMapping()
  const persisted = readBack !== null && assignmentSetsEqual(readBack.assignments, assignments)
  if (persisted) {
    saveOutcome.value = 'saved'
    // See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
    dirtyEdits.value = false
    refreshNoticeVisible.value = false
    if (grantedView.value === 'partial') {
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

function resetAssignmentMaps() {
  for (const key of Object.keys(roleByFingerprint)) delete roleByFingerprint[key]
  for (const key of Object.keys(nicknameByFingerprint)) delete nicknameByFingerprint[key]
}

function applyAssignmentsToMaps(assignments: MonitorAssignment[]) {
  for (const assignment of assignments) {
    roleByFingerprint[assignment.fingerprint] = assignment.role
    if (assignment.nickname) nicknameByFingerprint[assignment.fingerprint] = assignment.nickname
  }
}

function resolveGrantedBranch() {
  // See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
  dirtyEdits.value = false
  refreshNoticeVisible.value = false
  resetAssignmentMaps()
  newDisplayCount.value = 0
  const saved = loadMapping()
  if (!saved) {
    grantedView.value = 'fresh'
    saveOutcome.value = 'idle'
    return
  }
  const result: MatchResultV2 = matchMapping(saved, liveScreens.value)
  if (result.status === 'matched') {
    grantedView.value = 'matched'
    editingFromMatched.value = false
    applyAssignmentsToMaps(saved.assignments)
  } else if (result.status === 'partial') {
    // See ADR-0215 (docs/adr/0215-layout-changed-since-the-mapping-was-saved-never-guess-the-n.md) —
    // only the kept assignments are pre-filled; the delta is left for the
    // operator to assign, never guessed.
    grantedView.value = 'partial'
    applyAssignmentsToMaps(result.kept)
    newDisplayCount.value = result.newScreens.length
  } else {
    grantedView.value = 'fresh'
  }
  saveOutcome.value = 'idle'
}

// See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
function screenSetKey(screens: ScreenLike[]): string {
  return screens.map((s) => computeFingerprint(s)).sort().join('|')
}

/** See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md) */
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
    // See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
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

// See ADR-0216 (docs/adr/0216-the-single-most-gesture-sensitive-line-in-this-phase.md)
function onDetectClick() {
  if (!('getScreenDetails' in window)) {
    phase.value = 'unavailable'
    return
  }
  phase.value = 'detecting'
  // See ADR-0216 (docs/adr/0216-the-single-most-gesture-sensitive-line-in-this-phase.md)
  const requestId = ++detectRequestId
  ;(window as any)
    .getScreenDetails()
    .then((details: ScreenDetailsLike) => {
      // See ADR-0214 (docs/adr/0214-monotonic-token-guarding-against-a-stale-getscreendetails.md)
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
      // See ADR-0213 (docs/adr/0213-state-dirtyedits-tracks-whether-the-operator-has-made-unsave.md)
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
      // See ADR-0216 (docs/adr/0216-the-single-most-gesture-sensitive-line-in-this-phase.md)
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
