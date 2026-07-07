import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Person, UpsertPersonInput } from '@/types/roster'

// Normalize a name for re-import matching: trim, collapse internal whitespace, lowercase.
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export const useRosterStore = defineStore('roster', () => {
  const people = ref<Person[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  let unsubscribePeopleFn: Unsubscribe | null = null

  // active === true only — inactive (soft-deleted) people are excluded (D-20).
  const activePeople = computed(() => people.value.filter((p) => p.active))

  function subscribe(orgIdValue: string) {
    if (unsubscribePeopleFn) {
      unsubscribePeopleFn()
    }
    orgId.value = orgIdValue
    const peopleQuery = query(
      collection(db, 'organizations', orgIdValue, 'people'),
      orderBy('name'),
    )
    unsubscribePeopleFn = onSnapshot(peopleQuery, (snap) => {
      people.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Person)
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribePeopleFn?.()
    unsubscribePeopleFn = null
    orgId.value = null
    people.value = []
    isLoading.value = true
  }

  async function addPerson(input: UpsertPersonInput): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'people'), {
      name: input.name,
      email: input.email,
      phone: input.phone ?? '',
      roles: input.roles ?? [],
      frequencyTargetN: input.frequencyTargetN ?? 4,
      pcPersonId: input.pcPersonId ?? null,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  async function updatePerson(id: string, patch: Partial<UpsertPersonInput>): Promise<void> {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'people', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
  }

  async function deactivatePerson(id: string): Promise<void> {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'people', id), {
      active: false,
      updatedAt: serverTimestamp(),
    })
  }

  async function reactivatePerson(id: string): Promise<void> {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'people', id), {
      active: true,
      updatedAt: serverTimestamp(),
    })
  }

  async function upsertPeople(
    inputs: UpsertPersonInput[],
  ): Promise<{ added: number; updated: number }> {
    if (!orgId.value) return { added: 0, updated: 0 }

    // Build lookup maps for O(1) matching: pcPersonId first, then normalized name.
    const byPcId = new Map<string, Person>()
    const byName = new Map<string, Person>()

    for (const person of people.value) {
      if (person.pcPersonId) byPcId.set(person.pcPersonId, person)
      byName.set(normalizeName(person.name), person)
    }

    let added = 0
    let updated = 0

    for (const incoming of inputs) {
      let existing: Person | undefined
      if (incoming.pcPersonId) {
        existing = byPcId.get(incoming.pcPersonId)
      }
      if (!existing) {
        existing = byName.get(normalizeName(incoming.name))
      }

      if (existing) {
        // Update ONLY standing fields — never include `active`, never write
        // quarter-scoped availability/serve-with data (that lives on the
        // quarter doc from Plan 06, never on this person doc).
        const updateData: Record<string, unknown> = {
          name: incoming.name,
          email: incoming.email,
          updatedAt: serverTimestamp(),
        }
        if (incoming.phone !== undefined) updateData.phone = incoming.phone
        if (incoming.roles !== undefined) updateData.roles = incoming.roles
        if (incoming.frequencyTargetN !== undefined) updateData.frequencyTargetN = incoming.frequencyTargetN
        if (incoming.pcPersonId !== undefined) updateData.pcPersonId = incoming.pcPersonId
        await updateDoc(doc(db, 'organizations', orgId.value!, 'people', existing.id), updateData)
        updated++
      } else {
        await addDoc(collection(db, 'organizations', orgId.value!, 'people'), {
          name: incoming.name,
          email: incoming.email,
          phone: incoming.phone ?? '',
          roles: incoming.roles ?? [],
          frequencyTargetN: incoming.frequencyTargetN ?? 4,
          pcPersonId: incoming.pcPersonId ?? null,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        added++
      }
    }

    return { added, updated }
  }

  return {
    people,
    isLoading,
    orgId,
    activePeople,
    subscribe,
    unsubscribeAll,
    addPerson,
    updatePerson,
    deactivatePerson,
    reactivatePerson,
    upsertPeople,
  }
})
