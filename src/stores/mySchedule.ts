import { ref } from 'vue'
import { defineStore } from 'pinia'
import { collectionGroup, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db, auth } from '@/firebase'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'

/** A RehearseAccessDoc plus the orgId resolved from the doc's own Firestore
 *  path (ref.parent.parent.id) — never trusted from the doc's own field,
 *  since this is a cross-org collectionGroup result (126-01-SUMMARY.md). */
export type MyScheduleDoc = RehearseAccessDoc & { orgId: string }

// R378 (126-01-SUMMARY.md) — the collection-group `list` rule arm REQUIRES
// BOTH where('status','==','planned') AND
// where('assignedEmailsLower','array-contains', ownEmailLower) or Firestore
// denies the entire request outright (not a silent empty result). Do not
// drop either filter. The array-contains value is derived ONLY from
// auth.currentUser.email — never a client-suppliable argument or field
// (T-126-03, V5 input-validation defense-in-depth on top of the rule).
export const useMyScheduleStore = defineStore('mySchedule', () => {
  const docs = ref<MyScheduleDoc[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadMySchedule(): Promise<void> {
    const email = auth.currentUser?.email
    if (!email) {
      docs.value = []
      isLoading.value = false
      error.value = null
      return
    }

    const myEmailLower = email.toLowerCase()
    isLoading.value = true
    error.value = null

    try {
      const q = query(
        collectionGroup(db, 'rehearseAccess'),
        where('status', '==', 'planned'),
        where('assignedEmailsLower', 'array-contains', myEmailLower),
        orderBy('serviceDate', 'asc'),
      )
      const snap = await getDocs(q)
      docs.value = snap.docs.map((d) => {
        const data = d.data() as RehearseAccessDoc
        return { ...data, orgId: d.ref.parent.parent!.id }
      })
    } catch (err: unknown) {
      docs.value = []
      error.value = err instanceof Error ? err.message : 'Failed to load your schedule.'
    } finally {
      isLoading.value = false
    }
  }

  return {
    docs,
    isLoading,
    error,
    loadMySchedule,
  }
})
