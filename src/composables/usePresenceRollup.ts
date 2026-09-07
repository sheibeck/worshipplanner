// Phase 135 Plan 03 (R418) — bounded ≤6-service READ-ONLY fan-out for the
// dashboard's "Currently editing" card. Copies useServicePresence.ts's
// onSnapshot read shape (collection listen + lastSeen.toMillis() mapping)
// and its nowMs NOW_TICK_MS staleness tick, generalized from one service to
// N — mirrors useUnconfirmedVolunteers.ts's multi-listener teardown
// discipline. READ-ONLY: this composable contains no write path of any
// kind (no doc mutation, no heartbeat, no tab-visibility write handler) —
// the dashboard viewer is not editing a specific service.
//
// organizations/{orgId}/services/{serviceId}/presence/{uid}
import { ref, computed, watch, onUnmounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { collection, onSnapshot, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import type { Service } from '@/types/service'
import type { PresenceDoc } from '@/utils/presence'
import { PRESENCE_STALE_TTL_MS } from '@/utils/presence'
import { activePresenceRows, type PresenceRollupRow } from '@/utils/presenceRollup'

/** Mirrors useServicePresence.ts's NOW_TICK_MS — recomputes staleness on a
 *  clock tick even without a new snapshot (forced-disconnect case). */
const NOW_TICK_MS = 10000

interface ServicePresenceState {
  rows: PresenceRollupRow[]
  unsub: Unsubscribe | null
}

export function usePresenceRollup(
  orgId: MaybeRefOrGetter<string | null | undefined>,
  services: MaybeRefOrGetter<Service[]>,
) {
  // Not a Vue ref-of-Map on purpose, same rationale as
  // useUnconfirmedVolunteers.ts: mutations are tracked via the `version`
  // bump so per-listener state objects can be mutated in place.
  const statesByServiceId = new Map<string, ServicePresenceState>()
  const version = ref(0)
  const nowMs = ref(Date.now())
  let nowInterval: ReturnType<typeof setInterval> | null = null

  function teardownState(state: ServicePresenceState): void {
    state.unsub?.()
  }

  function teardownAll(): void {
    for (const state of statesByServiceId.values()) teardownState(state)
    statesByServiceId.clear()
  }

  function subscribeService(org: string, service: Service): ServicePresenceState {
    const state: ServicePresenceState = { rows: [], unsub: null }
    state.unsub = onSnapshot(
      collection(db, 'organizations', org, 'services', service.id, 'presence'),
      (snap) => {
        state.rows = snap.docs.map((d) => {
          const data = d.data() as Partial<PresenceDoc>
          const lastSeen = (data.lastSeen ?? null) as Timestamp | null
          const lastSeenMs = lastSeen && typeof lastSeen.toMillis === 'function' ? lastSeen.toMillis() : null
          return {
            serviceId: service.id,
            serviceName: service.name,
            uid: data.uid ?? d.id,
            displayName: data.displayName ?? 'Someone',
            lastSeenMs,
          }
        })
        version.value++
      },
      (err: unknown) => {
        // Presence is a nice-to-have signal — never worth a visible error;
        // treat this service's rows as empty (135-UI-SPEC.md Widget 3 Error).
        console.error('usePresenceRollup: presence subscription failed', err)
        state.rows = []
        version.value++
      },
    )
    return state
  }

  // Re-reconciles whenever orgId or the bounded window's service-id set
  // changes: tear down listeners for services that fell out of the window
  // (all of them on an orgId change), then open listeners for any new ones.
  // Never opens more listeners than the caller's window (≤6, caller-bounded).
  function reconcile(): void {
    const org = toValue(orgId)
    const windowServices = toValue(services)
    const windowIds = new Set(windowServices.map((s) => s.id))

    if (!org) {
      teardownAll()
      version.value++
      return
    }

    for (const [id, state] of statesByServiceId) {
      if (!windowIds.has(id)) {
        teardownState(state)
        statesByServiceId.delete(id)
      }
    }

    for (const service of windowServices) {
      if (!statesByServiceId.has(service.id)) {
        statesByServiceId.set(service.id, subscribeService(org, service))
      }
    }

    version.value++
  }

  watch(
    () => [toValue(orgId), toValue(services).map((s) => s.id).join(',')] as const,
    ([newOrg], previous) => {
      const oldOrg = previous?.[0]
      if (newOrg !== oldOrg) teardownAll()
      reconcile()
    },
    { immediate: true },
  )

  nowInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, NOW_TICK_MS)

  onUnmounted(() => {
    teardownAll()
    if (nowInterval !== null) {
      clearInterval(nowInterval)
      nowInterval = null
    }
  })

  const activeEditors = computed<PresenceRollupRow[]>(() => {
    void version.value
    const allRows: PresenceRollupRow[] = []
    for (const state of statesByServiceId.values()) allRows.push(...state.rows)
    return activePresenceRows(allRows, nowMs.value, PRESENCE_STALE_TTL_MS)
  })

  return { activeEditors }
}
