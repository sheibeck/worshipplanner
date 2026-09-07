import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore'
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

// Phase 130 (rework): the volunteer's single-church choice persists across
// sessions/reloads under this localStorage key. Restored on the next data load
// if the church is still among `churches`, else the first church wins.
const SELECTED_CHURCH_KEY = 'volunteerSelectedChurch'

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

  // Phase 130 (rework, R403): the volunteer serves ONE church at a time — never
  // a combined all-churches view. `selectedChurch` is null ONLY when the
  // volunteer has zero churches; with one or more it is always a real orgId
  // (defaulted to the first church once docs load, or the persisted choice if
  // still valid). This store must NEVER import the auth store or invoke the
  // admin membership-switch action, which assumes memberships a zero-membership
  // volunteer never has — church selection here is a pure client-side slice of
  // already-loaded/authorized docs, never a re-subscribe.
  const selectedChurch = ref<string | null>(null)

  let unsubscribeFn: Unsubscribe | null = null

  // Distinct churches the volunteer serves, first-occurrence order — mirrors
  // rehearseAccess.ts's distinctSongSlots Set-dedupe idiom (ADR-0160), using a
  // Map for key->value dedupe. orgName is left as-is (string | undefined) so
  // each consumer (switcher UI, sidebar) applies its own fallback label.
  //
  // 130-REVIEW CR-01: `docs` is ordered serviceDate asc, so a plain "first
  // write wins" guard would permanently lock onto whichever doc for an org is
  // encountered first — an older doc with no orgName (e.g. a pre-Phase-130 doc,
  // deferred backfill) would out-rank a later doc that carries the real name.
  // Instead: prefer a DEFINED name over an undefined/empty one for the same
  // orgId regardless of doc order, and never let a later undefined overwrite a
  // name already recorded.
  const churches = computed(() => {
    const byOrgId = new Map<string, string | undefined>()
    for (const d of docs.value) {
      if (!byOrgId.has(d.orgId) || (!byOrgId.get(d.orgId) && d.orgName)) {
        byOrgId.set(d.orgId, d.orgName)
      }
    }
    return [...byOrgId.entries()].map(([orgId, orgName]) => ({ orgId, orgName }))
  })

  // Single-church slice: null selection (zero churches) yields an empty list;
  // otherwise ONLY the selected church's docs — never a combined list.
  const filteredDocs = computed(() => {
    if (!selectedChurch.value) return []
    return docs.value.filter((d) => d.orgId === selectedChurch.value)
  })

  function readPersistedChurch(): string | null {
    try {
      return localStorage.getItem(SELECTED_CHURCH_KEY)
    } catch {
      return null
    }
  }

  function persistSelectedChurch(orgId: string): void {
    try {
      localStorage.setItem(SELECTED_CHURCH_KEY, orgId)
    } catch {
      // Private windows / disabled storage — selection still works in-memory.
    }
  }

  // Reconcile `selectedChurch` against a freshly-loaded `churches` list. Keeps
  // resetStaleSelection's original invariant (a selection no longer present
  // must never coerce filteredDocs to a permanently empty list) but now DEFAULTS
  // to the first church instead of null: with >=1 church, selectedChurch is
  // always a real orgId. Preference order: keep a still-valid current selection,
  // else the persisted choice if still valid, else the first church.
  function reconcileSelectedChurch(): void {
    const list = churches.value
    if (list.length === 0) {
      selectedChurch.value = null
      return
    }
    if (selectedChurch.value && list.some((c) => c.orgId === selectedChurch.value)) return
    const persisted = readPersistedChurch()
    if (persisted && list.some((c) => c.orgId === persisted)) {
      selectedChurch.value = persisted
      return
    }
    selectedChurch.value = list[0]!.orgId
  }

  // R403: explicit single-church selection from the sidebar switcher. Persists
  // the choice; NEVER touches the auth store / selectOrg.
  function setSelectedChurch(orgId: string): void {
    selectedChurch.value = orgId
    persistSelectedChurch(orgId)
  }

  // Same collection-group query for both the live subscription and the one-shot
  // loadMySchedule fallback (R378 — both filters are mandatory).
  function buildQuery(myEmailLower: string): Query {
    return query(
      collectionGroup(db, 'rehearseAccess'),
      where('status', '==', 'planned'),
      where('assignedEmailsLower', 'array-contains', myEmailLower),
      orderBy('serviceDate', 'asc'),
    )
  }

  function mapSnapDocs(snapDocs: { data: () => unknown; ref: { parent: { parent: { id: string } | null } } }[]): MyScheduleDoc[] {
    return snapDocs.map((d) => {
      const data = d.data() as RehearseAccessDoc
      return { ...data, orgId: d.ref.parent.parent!.id }
    })
  }

  // Live subscription (Phase 130 rework, Change A) — editor changes to a
  // planned service now reflect on My Schedule without a reload. Idempotent:
  // tears down any prior listener first (mirrors roster.ts/songs.ts/quarters.ts).
  // A volunteer isn't org-scoped, so resetOrgScopedStores never tears this down
  // — the mounting view unsubscribes on unmount instead.
  function subscribe(): void {
    if (unsubscribeFn) {
      unsubscribeFn()
      unsubscribeFn = null
    }

    const email = auth.currentUser?.email
    if (!email) {
      docs.value = []
      isLoading.value = false
      error.value = null
      reconcileSelectedChurch()
      return
    }

    const myEmailLower = email.toLowerCase()
    isLoading.value = true
    error.value = null

    unsubscribeFn = onSnapshot(
      buildQuery(myEmailLower),
      (snap) => {
        docs.value = mapSnapDocs(snap.docs)
        reconcileSelectedChurch()
        error.value = null
        isLoading.value = false
      },
      (err: unknown) => {
        // IN-01 (126-REVIEW): pair the swallowed error with a console.error,
        // matching services.ts's convention — a missing/misconfigured composite
        // index throws a distinctive Firestore error otherwise invisible in the
        // browser console.
        console.error('mySchedule subscription failed', err)
        docs.value = []
        error.value = err instanceof Error ? err.message : 'Failed to load your schedule.'
        reconcileSelectedChurch()
        isLoading.value = false
      },
    )
  }

  function unsubscribe(): void {
    unsubscribeFn?.()
    unsubscribeFn = null
  }

  // One-shot getDocs fallback — retained for useVolunteerServiceDoc's cold-nav
  // path (127-RESEARCH.md Pitfall 1), which awaits it to populate `docs` before
  // resolving an orgId from a match. The live view uses subscribe() instead.
  async function loadMySchedule(): Promise<void> {
    const email = auth.currentUser?.email
    if (!email) {
      docs.value = []
      isLoading.value = false
      error.value = null
      reconcileSelectedChurch()
      return
    }

    const myEmailLower = email.toLowerCase()
    isLoading.value = true
    error.value = null

    try {
      const snap = await getDocs(buildQuery(myEmailLower))
      docs.value = mapSnapDocs(snap.docs)
      reconcileSelectedChurch()
    } catch (err: unknown) {
      // IN-01 (126-REVIEW): see subscribe()'s error path.
      console.error('loadMySchedule failed', err)
      docs.value = []
      error.value = err instanceof Error ? err.message : 'Failed to load your schedule.'
      reconcileSelectedChurch()
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
    setSelectedChurch,
    subscribe,
    unsubscribe,
    loadMySchedule,
  }
})
