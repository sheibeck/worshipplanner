import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Person, Role, UpsertPersonInput } from '@/types/roster'
import { DEFAULT_ROLES } from '@/types/roster'

// Normalize a name for re-import matching: trim, collapse internal whitespace, lowercase.
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export const useRosterStore = defineStore('roster', () => {
  const people = ref<Person[]>([])
  const roles = ref<Role[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  let unsubscribePeopleFn: Unsubscribe | null = null
  let unsubscribeRolesFn: Unsubscribe | null = null

  // active === true only — inactive (soft-deleted) people are excluded (D-20).
  const activePeople = computed(() => people.value.filter((p) => p.active))

  // Alphabetical view of roles for DISPLAY only (dropdowns/checklists) — logic
  // and lookups (find-by-id, membership tests) must keep using `roles` (ordered
  // by `order`, which drives the scheduler's stable inner loop).
  const rolesSorted = computed(() => [...roles.value].sort((a, b) => a.name.localeCompare(b.name)))

  function subscribe(orgIdValue: string) {
    if (unsubscribePeopleFn) {
      unsubscribePeopleFn()
    }
    if (unsubscribeRolesFn) {
      unsubscribeRolesFn()
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

    // Roles ordered by `order` ascending — drives the scheduler's stable inner loop.
    const rolesQuery = query(
      collection(db, 'organizations', orgIdValue, 'roles'),
      orderBy('order'),
    )
    unsubscribeRolesFn = onSnapshot(rolesQuery, (snap) => {
      roles.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role)
    })
  }

  function unsubscribeAll() {
    unsubscribePeopleFn?.()
    unsubscribePeopleFn = null
    unsubscribeRolesFn?.()
    unsubscribeRolesFn = null
    orgId.value = null
    people.value = []
    roles.value = []
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
        // Roles are MERGED (union), never replaced — an import must never remove a
        // role an existing volunteer already has in Worship Planner. A PC/CSV import
        // only ever tells us the roles that source knows about; roles added in-app
        // (or from a different team's import) must be preserved.
        if (incoming.roles !== undefined) {
          updateData.roles = Array.from(new Set([...(existing.roles ?? []), ...incoming.roles]))
        }
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

  // HARD-deletes every person doc for the org (irreversible). Used to clear a
  // bad wholesale import before re-importing selectively. Does NOT touch roles
  // or quarter docs. Batched at Firestore's 500-op limit. Returns count deleted.
  async function deleteAllPeople(): Promise<number> {
    if (!orgId.value) return 0
    const snap = await getDocs(collection(db, 'organizations', orgId.value, 'people'))
    let deleted = 0
    let batch = writeBatch(db)
    let ops = 0
    for (const d of snap.docs) {
      batch.delete(d.ref)
      deleted++
      ops++
      if (ops === 500) {
        await batch.commit()
        batch = writeBatch(db)
        ops = 0
      }
    }
    if (ops > 0) await batch.commit()
    return deleted
  }

  // Seeds the grouped default role list (guitar/drums/vocals/bass/sound/
  // livestream/projection/scripture reader — see DEFAULT_ROLES) only when the
  // org has no roles yet. Calling this again once roles exist writes nothing.
  async function seedDefaultRolesIfEmpty(): Promise<void> {
    if (!orgId.value) return
    if (roles.value.length !== 0) return
    for (const role of DEFAULT_ROLES) {
      await addDoc(collection(db, 'organizations', orgId.value, 'roles'), {
        ...role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  async function addRole(input: Omit<Role, 'id'>): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'roles'), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  async function updateRole(id: string, patch: Partial<Omit<Role, 'id'>>): Promise<void> {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'roles', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteRole(id: string): Promise<void> {
    if (!orgId.value) return
    // Hard-delete the role config doc — clearing this role's assignments
    // across quarters is handled by the quarters store / UI (Plan 06/08).
    await deleteDoc(doc(db, 'organizations', orgId.value, 'roles', id))
  }

  return {
    people,
    roles,
    isLoading,
    orgId,
    activePeople,
    rolesSorted,
    subscribe,
    unsubscribeAll,
    addPerson,
    updatePerson,
    deactivatePerson,
    reactivatePerson,
    upsertPeople,
    deleteAllPeople,
    seedDefaultRolesIfEmpty,
    addRole,
    updateRole,
    deleteRole,
  }
})
