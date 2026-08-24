import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Team } from '@/types/team'
import { DEFAULT_TEAMS } from '@/types/team'

// Phase 79 (R228/R241) — the single shared per-org teams source. Mirrors
// `roster.ts`'s roles half exactly (subcollection CRUD + idempotent seed);
// no people-half equivalent, no grouping, no vocals-style migration block.
export const useTeamsStore = defineStore('teams', () => {
  const teams = ref<Team[]>([])
  const orgId = ref<string | null>(null)

  let unsubscribeTeamsFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeTeamsFn) {
      unsubscribeTeamsFn()
    }
    orgId.value = orgIdValue

    // Ordered by `order` ascending — the order-sorted array consumers iterate
    // directly (mirrors `roster.roles`).
    const teamsQuery = query(
      collection(db, 'organizations', orgIdValue, 'teams'),
      orderBy('order'),
    )
    unsubscribeTeamsFn = onSnapshot(teamsQuery, (snap) => {
      teams.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team)
    })
  }

  function unsubscribeAll() {
    unsubscribeTeamsFn?.()
    unsubscribeTeamsFn = null
    orgId.value = null
    teams.value = []
  }

  // Seeds the default team list (Choir/Orchestra/Communion/Special) only when
  // the org has no teams yet. Calling this again once teams exist writes
  // nothing — first-writer-wins, never clobbers an org that already edited
  // its list (RESEARCH Pitfall 4).
  async function seedDefaultTeamsIfEmpty(): Promise<void> {
    if (!orgId.value) return
    if (teams.value.length !== 0) return
    for (const team of DEFAULT_TEAMS) {
      await addDoc(collection(db, 'organizations', orgId.value, 'teams'), {
        ...team,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  async function addTeam(input: Omit<Team, 'id'>): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'teams'), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  async function updateTeam(id: string, patch: Partial<Omit<Team, 'id'>>): Promise<void> {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'teams', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteTeam(id: string): Promise<void> {
    if (!orgId.value) return
    await deleteDoc(doc(db, 'organizations', orgId.value, 'teams', id))
  }

  return {
    teams,
    orgId,
    subscribe,
    unsubscribeAll,
    seedDefaultTeamsIfEmpty,
    addTeam,
    updateTeam,
    deleteTeam,
  }
})
