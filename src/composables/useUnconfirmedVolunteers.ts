// Phase 135 Plan 02 (R417) — bounded ≤6-service read-only fan-out for the
// dashboard's Unconfirmed volunteers card. Mirrors ServiceEditorView.vue's
// subscribeConfirmations LIVE onSnapshot pattern (never getDoc/getDocs) and
// useServicePresence.ts's multi-listener teardown discipline, generalized
// from one service to N. READ-ONLY: never writes or deletes any document —
// this composable only aggregates what Phase 133 already wrote.
//
// organizations/{orgId}/rehearseAccess/{serviceId} (roleAssignmentsByEmailLower)
// organizations/{orgId}/services/{serviceId}/confirmations
import { ref, computed, watch, onUnmounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { doc, collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import type { Service } from '@/types/service'
import { confirmationKey, type ConfirmationStatus } from '@/utils/confirmations'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'
import { unconfirmedAssignments, type UnconfirmedAssignment } from '@/utils/unconfirmedAssignments'

export interface UnconfirmedVolunteerRow extends UnconfirmedAssignment {
  serviceId: string
  serviceName: string
  serviceDate: string
  /** Re-derived from the same confirmationStatuses map the pure diff already
   *  consulted — 'unconfirmed' is the implicit no-doc default (never stored),
   *  distinguishing it from a stored 'needsReconfirmation' so the view can
   *  pick the identical gray-vs-amber chip ServiceEditorView.vue uses. */
  status: ConfirmationStatus | 'unconfirmed'
}

interface ServiceListenerState {
  roleAssignmentsByEmailLower: RehearseAccessDoc['roleAssignmentsByEmailLower']
  confirmationStatuses: Map<string, ConfirmationStatus>
  hasRehearseSnapshot: boolean
  hasConfirmationsSnapshot: boolean
  // CR-01 (135-REVIEW): per-service, not a single shared flag — a listener
  // that recovers (a later successful snapshot) clears only its OWN
  // contribution, so one transient error on one of the ≤12 listeners can
  // never permanently poison the aggregate `error` for the rest of the
  // session/every subsequently-switched-to org.
  hasError: boolean
  unsubRehearse: Unsubscribe | null
  unsubConfirmations: Unsubscribe | null
}

export function useUnconfirmedVolunteers(
  orgId: MaybeRefOrGetter<string | null | undefined>,
  services: MaybeRefOrGetter<Service[]>,
) {
  // Not a Vue ref-of-Map on purpose: mutations are tracked via the `version`
  // bump below rather than relying on Vue's reactive-Map instrumentation, so
  // the per-listener state objects can be mutated in place without surprises.
  const statesByServiceId = new Map<string, ServiceListenerState>()
  const version = ref(0)

  function teardownState(state: ServiceListenerState): void {
    state.unsubRehearse?.()
    state.unsubConfirmations?.()
  }

  function teardownAll(): void {
    for (const state of statesByServiceId.values()) teardownState(state)
    statesByServiceId.clear()
  }

  function subscribeService(org: string, serviceId: string): ServiceListenerState {
    const state: ServiceListenerState = {
      roleAssignmentsByEmailLower: undefined,
      confirmationStatuses: new Map(),
      hasRehearseSnapshot: false,
      hasConfirmationsSnapshot: false,
      hasError: false,
      unsubRehearse: null,
      unsubConfirmations: null,
    }

    state.unsubRehearse = onSnapshot(
      doc(db, 'organizations', org, 'rehearseAccess', serviceId),
      (snap) => {
        const data = snap.data() as RehearseAccessDoc | undefined
        state.roleAssignmentsByEmailLower = data?.roleAssignmentsByEmailLower
        state.hasRehearseSnapshot = true
        // CR-01: a successful delivery on this listener clears ONLY this
        // service's error contribution — the other listener below can still
        // be independently erroring.
        state.hasError = false
        version.value++
      },
      (err: unknown) => {
        // Mirrors ServiceEditorView's confirmations-subscription convention —
        // a missing/misconfigured rule or index is otherwise invisible.
        console.error('useUnconfirmedVolunteers: rehearseAccess subscription failed', err)
        state.hasError = true
        version.value++
      },
    )

    state.unsubConfirmations = onSnapshot(
      collection(db, 'organizations', org, 'services', serviceId, 'confirmations'),
      (snap) => {
        const next = new Map<string, ConfirmationStatus>()
        for (const d of snap.docs) {
          const data = d.data() as { roleId?: string; emailLower?: string; status?: ConfirmationStatus }
          if (!data.roleId || !data.emailLower || !data.status) continue
          next.set(confirmationKey(data.roleId, data.emailLower), data.status)
        }
        state.confirmationStatuses = next
        state.hasConfirmationsSnapshot = true
        state.hasError = false
        version.value++
      },
      (err: unknown) => {
        console.error('useUnconfirmedVolunteers: confirmations subscription failed', err)
        state.hasError = true
        version.value++
      },
    )

    return state
  }

  // Re-reconciles whenever orgId or the bounded window's service-id set
  // changes: tear down listeners for services that fell out of the window
  // (all of them on an orgId change), then open listeners for any new ones.
  // Never opens more listeners than the caller's window — reconcile() only
  // ever iterates `windowServices`, which the caller guarantees is ≤6.
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
        statesByServiceId.set(service.id, subscribeService(org, service.id))
      }
    }

    version.value++
  }

  watch(
    () => [toValue(orgId), toValue(services).map((s) => s.id).join(',')] as const,
    ([newOrg], previous) => {
      const oldOrg = previous?.[0]
      if (newOrg !== oldOrg) {
        teardownAll()
      }
      reconcile()
    },
    { immediate: true },
  )

  onUnmounted(() => {
    teardownAll()
  })

  const rows = computed<UnconfirmedVolunteerRow[]>(() => {
    void version.value
    const windowServices = toValue(services)
    const result: UnconfirmedVolunteerRow[] = []
    for (const service of windowServices) {
      const state = statesByServiceId.get(service.id)
      if (!state) continue
      const diff = unconfirmedAssignments(state.roleAssignmentsByEmailLower, state.confirmationStatuses)
      for (const row of diff) {
        const status = state.confirmationStatuses.get(confirmationKey(row.roleId, row.emailLower)) ?? 'unconfirmed'
        result.push({ ...row, serviceId: service.id, serviceName: service.name, serviceDate: service.date, status })
      }
    }
    return result
  })

  // True until every service currently in the window has resolved its first
  // snapshot from BOTH listeners.
  const loading = computed(() => {
    void version.value
    const windowServices = toValue(services)
    if (windowServices.length === 0) return false
    for (const service of windowServices) {
      const state = statesByServiceId.get(service.id)
      if (!state || !state.hasRehearseSnapshot || !state.hasConfirmationsSnapshot) return true
    }
    return false
  })

  // CR-01: derived (not a sticky ref) from the CURRENT set of per-service
  // states — a service that fell out of the window is gone from
  // `statesByServiceId` entirely (reconcile() tears it down), and any
  // service whose listeners recovered has already flipped its own
  // `hasError` back to false above. teardownAll() (org switch / no org)
  // clears the map, so this naturally reads false again with no separate
  // reset needed.
  const error = computed(() => {
    void version.value
    for (const state of statesByServiceId.values()) {
      if (state.hasError) return true
    }
    return false
  })

  // WR-02 (135-REVIEW): a service whose rehearseAccess snapshot HAS arrived
  // but carries no `roleAssignmentsByEmailLower` projection (locked before
  // Phase 133, never relocked) must not be silently folded into "all
  // confirmed" — this flags that at least one in-window service has no
  // assignment data to check confirmations against, so the view can render
  // an honest "unknown" state instead of a false positive.
  const hasStaleAssignmentData = computed(() => {
    void version.value
    const windowServices = toValue(services)
    for (const service of windowServices) {
      const state = statesByServiceId.get(service.id)
      if (state?.hasRehearseSnapshot && state.roleAssignmentsByEmailLower === undefined) return true
    }
    return false
  })

  return { rows, loading, error, hasStaleAssignmentData }
}
