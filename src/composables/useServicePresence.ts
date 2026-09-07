// Phase 134 Plan 02 (R422) — the live "who's here" composable for
// ServiceEditorView. Firestore has no onDisconnect() (RTDB-only), so the
// client soft-TTL filter below (not the onSnapshot alone) is the real-time
// correctness mechanism for a crashed/closed tab; see 134-CONTEXT.md.
//
// organizations/{orgId}/services/{serviceId}/presence/{uid}
import { ref, computed, watch, onUnmounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { doc, setDoc, deleteDoc, collection, onSnapshot, serverTimestamp, type Timestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { type PresenceDoc, isPresenceStale, PRESENCE_HEARTBEAT_MS, PRESENCE_STALE_TTL_MS } from '@/utils/presence'

/** The subset of authStore.user this composable needs — uid + displayName. */
export interface PresenceUser {
  uid: string
  displayName: string | null
}

interface PresenceRow {
  uid: string
  displayName: string
  lastSeen: Timestamp | null
  lastSeenMs: number | null
}

/** How often the clock-driven staleness tick recomputes — well under the
 *  ~60s TTL so a stale viewer drops within ~10s of going stale, even with
 *  no new snapshot (forced-disconnect case). */
const NOW_TICK_MS = 10000

export function useServicePresence(
  orgId: MaybeRefOrGetter<string | null | undefined>,
  serviceId: MaybeRefOrGetter<string | null | undefined>,
  currentUser: MaybeRefOrGetter<PresenceUser | null | undefined>,
) {
  const presenceDocs = ref<PresenceRow[]>([])
  const nowMs = ref(Date.now())

  let unsubscribe: Unsubscribe | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null
  let nowInterval: ReturnType<typeof setInterval> | null = null
  let activeServiceId: string | null = null

  function presenceDocRef(org: string, svc: string, uid: string) {
    return doc(db, 'organizations', org, 'services', svc, 'presence', uid)
  }

  function writeHeartbeat(): void {
    if (document.hidden) return
    const org = toValue(orgId)
    const svc = toValue(serviceId)
    const user = toValue(currentUser)
    if (!org || !svc || !user?.uid) return
    // No merge: a full replace of exactly the 3 allowlisted fields, matching
    // the write rule's hasOnly(['uid', 'displayName', 'lastSeen']).
    void setDoc(presenceDocRef(org, svc, user.uid), {
      uid: user.uid,
      displayName: user.displayName || 'Someone',
      lastSeen: serverTimestamp(),
    })
  }

  function onVisibilityChange(): void {
    // Resume immediately on becoming visible; the hidden branch is a no-op —
    // readers should still see OTHER present viewers while this tab is
    // backgrounded, we only pause OUR OWN writes (cost discipline).
    if (!document.hidden) writeHeartbeat()
  }

  function clearHeartbeat(): void {
    if (heartbeatInterval !== null) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  function unsubscribeSnapshot(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  /** Best-effort teardown for `previousServiceId`: delete the current user's
   *  own presence doc there, unsubscribe the snapshot, clear the heartbeat. */
  function stop(previousServiceId: string | null): void {
    const org = toValue(orgId)
    const user = toValue(currentUser)
    if (org && previousServiceId && user?.uid) {
      void deleteDoc(presenceDocRef(org, previousServiceId, user.uid))
    }
    unsubscribeSnapshot()
    clearHeartbeat()
  }

  function start(): void {
    const org = toValue(orgId)
    const svc = toValue(serviceId)
    const user = toValue(currentUser)
    activeServiceId = svc ?? null
    if (!org || !svc || !user?.uid) {
      presenceDocs.value = []
      return
    }

    // Immediate write so the viewer appears without waiting a full heartbeat.
    writeHeartbeat()
    heartbeatInterval = setInterval(writeHeartbeat, PRESENCE_HEARTBEAT_MS)

    unsubscribe = onSnapshot(
      collection(db, 'organizations', org, 'services', svc, 'presence'),
      (snap) => {
        presenceDocs.value = snap.docs.map((d) => {
          const data = d.data() as Partial<PresenceDoc>
          const lastSeen = (data.lastSeen ?? null) as Timestamp | null
          const lastSeenMs = lastSeen && typeof lastSeen.toMillis === 'function' ? lastSeen.toMillis() : null
          return { uid: data.uid ?? d.id, displayName: data.displayName ?? 'Someone', lastSeen, lastSeenMs }
        })
      },
      (err: unknown) => {
        // Mirrors ServiceEditorView's confirmations-subscription convention —
        // a missing/misconfigured rule or index is otherwise invisible.
        console.error('presence subscription failed', err)
      },
    )
  }

  // Re-inits on every serviceId change, including the Router-reuses-the-
  // mounted-editor-instance case (onUnmounted alone does NOT fire on a param
  // change — see 134-CONTEXT.md). The immediate first run does the initial start.
  watch(
    () => toValue(serviceId),
    (_newId, oldId) => {
      if (oldId) stop(oldId)
      start()
    },
    { immediate: true },
  )

  document.addEventListener('visibilitychange', onVisibilityChange)
  nowInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, NOW_TICK_MS)

  onUnmounted(() => {
    stop(activeServiceId)
    if (nowInterval !== null) {
      clearInterval(nowInterval)
      nowInterval = null
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  const presentViewers = computed<PresenceDoc[]>(() =>
    presenceDocs.value
      .filter((row) => !isPresenceStale(row.lastSeenMs, nowMs.value, PRESENCE_STALE_TTL_MS))
      .map((row) => ({ uid: row.uid, displayName: row.displayName, lastSeen: row.lastSeen as Timestamp })),
  )

  return { presentViewers }
}
