import { ref } from 'vue'
import { defineStore } from 'pinia'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { ignorePermissionDenied } from '@/utils/firestoreListener'

/**
 * R356/ARCH-008 — owns the org's members-collection count listener, moved out
 * of a one-off onSnapshot previously inline in GettingStarted.vue. Org-scoped:
 * registered in resetOrgScopedStores() (src/stores/orgScopedStores.ts) for
 * org-switch teardown parity with the other org-scoped stores. Suppresses the
 * same benign permission-denied the component used to guard.
 */
export const useMembersStore = defineStore('members', () => {
  const memberCount = ref(0)

  let unsub: Unsubscribe | null = null

  function subscribe(orgId: string | null): void {
    unsub?.()
    unsub = null
    memberCount.value = 0
    if (!orgId) return
    unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'members'),
      (snap) => {
        memberCount.value = snap.size
      },
      ignorePermissionDenied('members store memberCount'),
    )
  }

  function unsubscribeAll(): void {
    unsub?.()
    unsub = null
    memberCount.value = 0
  }

  return {
    memberCount,
    subscribe,
    unsubscribeAll,
  }
})
