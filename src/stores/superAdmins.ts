import { ref } from 'vue'
import { defineStore } from 'pinia'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { isPermissionDenied } from '@/utils/firestoreListener'

export interface SuperAdminEntry {
  uid: string
  email: string
  grantedBy?: string
  grantedAt: { toDate?: () => Date } | null
}

/**
 * R356/ARCH-008 — owns the GLOBAL superAdmins-collection listener, moved out
 * of a one-off onSnapshot previously inline in ConfigurationTab.vue. This is
 * NOT org-scoped (like appConfig) — do NOT register it in
 * resetOrgScopedStores(). Suppresses ONLY the benign permission-denied a
 * super-admin's own logout can trigger (Bug 2b), mirroring appConfig.ts's
 * subscribe() error handler.
 */
export const useSuperAdminsStore = defineStore('superAdmins', () => {
  const superAdmins = ref<SuperAdminEntry[]>([])
  const loaded = ref(false)

  let unsub: Unsubscribe | null = null

  function subscribe(): void {
    unsub = onSnapshot(
      collection(db, 'superAdmins'),
      (snap) => {
        superAdmins.value = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as Omit<SuperAdminEntry, 'uid'>),
        }))
        loaded.value = true
      },
      (err) => {
        // Bug 2b (quick 260830-l9c) — a super-admin's own logout can hit this
        // handler with a benign permission-denied once the token is revoked;
        // suppress ONLY the console.error for that code, state-setting below
        // stays unchanged for a genuine error.
        if (!isPermissionDenied(err)) {
          console.error('[superAdmins store] subscription error:', err)
        }
        loaded.value = true
      },
    )
  }

  function unsubscribe(): void {
    unsub?.()
    unsub = null
  }

  return {
    superAdmins,
    loaded,
    subscribe,
    unsubscribe,
  }
})
