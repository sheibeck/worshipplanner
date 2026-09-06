import { ref, watch, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useMyScheduleStore } from '@/stores/mySchedule'
import { isPermissionDenied } from '@/utils/firestoreListener'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'

export type VolunteerServiceDocState = 'loading' | 'loaded' | 'access-denied' | 'load-failure'

/**
 * Resolves `orgId` for the standalone `/volunteer/service/:serviceId` route
 * (R384/T-127-02) — that route carries `serviceId` only, by design (the
 * volunteer session isn't org-scoped; 127-RESEARCH.md Pitfall 1). `orgId` is
 * NEVER accepted as an argument here or read from a route param/query:
 * it comes exclusively from matching `serviceId` against the volunteer's own
 * server-filtered `mySchedule.docs` (each doc carries `orgId` from its
 * Firestore path — see mySchedule.ts's `d.ref.parent.parent!.id`), falling
 * back to one `loadMySchedule()` call on cold navigation/refresh.
 *
 * Once a match is found, a FRESH `getDoc` re-checks the live get arm
 * (R377 parentIsPlanned + assigned-email + email_verified, enforced by
 * firestore.rules) rather than trusting the possibly-stale list-arm doc
 * already cached in the store (T-127-03).
 *
 * `serviceId` is a ref/getter, not a plain string (WR-02, 127-REVIEW): Vue
 * Router reuses the component instance (does not re-run `setup()`) when
 * navigating between two routes matching the same record with only the
 * dynamic segment changing, so a plain string captured once would pin this
 * composable to whichever service was current at mount time. Watching the
 * reactive source with `immediate: true` re-runs `load()` on every id change.
 */
export function useVolunteerServiceDoc(serviceId: MaybeRefOrGetter<string>) {
  const state = ref<VolunteerServiceDocState>('loading')
  const doc_ = ref<RehearseAccessDoc | null>(null)

  async function load(): Promise<void> {
    const id = toValue(serviceId)
    state.value = 'loading'
    doc_.value = null

    const mySchedule = useMyScheduleStore()
    let match = mySchedule.docs.find((d) => d.serviceId === id)
    if (!match) {
      await mySchedule.loadMySchedule()
      match = mySchedule.docs.find((d) => d.serviceId === id)
    }
    if (!match) {
      // T-127-05 — no store match means either the volunteer was never
      // assigned or the link is stale/guessed. Never attempt a getDoc with a
      // guessed/absent orgId; the client must not leak whether the doc exists.
      state.value = 'access-denied'
      return
    }

    try {
      const snap = await getDoc(doc(db, 'organizations', match.orgId, 'rehearseAccess', id))
      if (snap.exists()) {
        doc_.value = snap.data() as RehearseAccessDoc
        state.value = 'loaded'
      } else {
        state.value = 'access-denied'
      }
    } catch (err: unknown) {
      // A permission-denied getDoc (the live get arm re-check failing, e.g.
      // the service was reopened/un-Planned since the list arm cached it)
      // maps to the same access-denied state as a missing doc — the client
      // never distinguishes "denied" from "doesn't exist" to the volunteer.
      // Any other error (network/unknown) is retryable: load-failure.
      state.value = isPermissionDenied(err) ? 'access-denied' : 'load-failure'
    }
  }

  function retry(): Promise<void> {
    return load()
  }

  // immediate: true replaces the old `void load()` call-on-mount — this also
  // re-triggers `load()` whenever the underlying route param changes.
  watch(() => toValue(serviceId), () => void load(), { immediate: true })

  return {
    state,
    doc: doc_,
    retry,
  }
}
