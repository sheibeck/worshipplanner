import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { collectionGroup, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db, auth } from '@/firebase'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'

/** A RehearseAccessDoc plus the orgId resolved from the doc's own Firestore
 *  path (ref.parent.parent.id) — never trusted from the doc's own field,
 *  since this is a cross-org collectionGroup result (126-01-SUMMARY.md).
 *  IN-04 (126-REVIEW): `RehearseAccessDoc` already declares `orgId: string`,
 *  so this intersection is a type-level no-op (same type, doesn't widen or
 *  narrow anything) — the actual override happens at the `{ ...data, orgId:
 *  ... }` spread call site below, not here. Kept for readability/intent. */
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

  // Phase 130 (R403): session-local filter over `docs` — null means "all
  // churches". This is a pure client-side slice of already-loaded/authorized
  // docs, never a re-subscribe: this store must NEVER import the auth store
  // or invoke the admin membership-switch action, which assumes memberships
  // a zero-membership volunteer never has.
  const selectedChurch = ref<string | null>(null)

  // Distinct churches the volunteer serves, first-occurrence order — mirrors
  // rehearseAccess.ts's distinctSongSlots Set-dedupe idiom (ADR-0160), using a
  // Map for key->value dedupe. orgName is left as-is (string | undefined) so
  // each consumer (switcher UI, sidebar) applies its own fallback label.
  const churches = computed(() => {
    const byOrgId = new Map<string, string | undefined>()
    for (const d of docs.value) {
      if (!byOrgId.has(d.orgId)) byOrgId.set(d.orgId, d.orgName)
    }
    return [...byOrgId.entries()].map(([orgId, orgName]) => ({ orgId, orgName }))
  })

  const filteredDocs = computed(() => {
    if (!selectedChurch.value) return docs.value
    return docs.value.filter((d) => d.orgId === selectedChurch.value)
  })

  // A stale selectedChurch (an orgId no longer present in a freshly-loaded
  // docs array) must never coerce filteredDocs to a permanently empty list —
  // reset to null ("all") instead.
  function resetStaleSelection(): void {
    if (selectedChurch.value === null) return
    if (!docs.value.some((d) => d.orgId === selectedChurch.value)) selectedChurch.value = null
  }

  async function loadMySchedule(): Promise<void> {
    const email = auth.currentUser?.email
    if (!email) {
      docs.value = []
      isLoading.value = false
      error.value = null
      resetStaleSelection()
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
      resetStaleSelection()
    } catch (err: unknown) {
      // IN-01 (126-REVIEW): pair the swallowed error with a console.error,
      // matching services.ts's markAsPlanned/reopenService convention — a
      // missing/misconfigured composite index throws a distinctive Firestore
      // error that was previously invisible in the browser console.
      console.error('loadMySchedule failed', err)
      docs.value = []
      error.value = err instanceof Error ? err.message : 'Failed to load your schedule.'
      resetStaleSelection()
    } finally {
      isLoading.value = false
    }
  }

  return {
    docs,
    isLoading,
    error,
    selectedChurch,
    churches,
    filteredDocs,
    loadMySchedule,
  }
})
