import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Track onSnapshot callbacks per collection path so people/roles subscriptions
// can be triggered independently. `ref` mirrors the real Firestore
// QueryDocumentSnapshot shape so per-doc migration patches (updateDoc(d.ref, ...))
// can be asserted against the specific doc they targeted.
type SnapshotDoc = { id: string; data: () => Record<string, unknown>; ref: { id: string; path: string } }
type SnapshotCallback = (snap: { docs: SnapshotDoc[] }) => void

const snapshotCallbacks: Record<string, SnapshotCallback> = {}
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((queryRef, callback) => {
      const path = (queryRef as { path?: string }).path ?? 'unknown'
      snapshotCallbacks[path] = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    })),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

function makePerson(overrides: Partial<{
  id: string
  name: string
  email: string
  phone: string
  active: boolean
  roles: string[]
  frequencyTargetN: number
  // Record<...> = force that exact map. `null` = force the field WHOLLY ABSENT
  // (pre-migration doc shape, needed to exercise the D-03 patch-on-read guard).
  // Omitted = defaults to an already-migrated map synthesized from roles x
  // frequencyTargetN, so tests unrelated to migration don't trip the D-03 guard.
  roleFrequencies: Record<string, number> | null
  pcPersonId: string | null
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}> = {}) {
  const { roleFrequencies, ...rest } = overrides
  const roles = rest.roles ?? ([] as string[])
  const frequencyTargetN = rest.frequencyTargetN ?? 4
  const defaultRoleFrequencies = Object.fromEntries(roles.map((r) => [r, frequencyTargetN]))
  return {
    id: 'person-1',
    name: 'Sarah Smith',
    email: 'sarah@example.com',
    phone: '',
    active: true,
    roles,
    frequencyTargetN,
    pcPersonId: null,
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...rest,
    ...(roleFrequencies === null ? {} : { roleFrequencies: roleFrequencies ?? defaultRoleFrequencies }),
  }
}

function makeRole(overrides: Partial<{
  id: string
  name: string
  group: 'band' | 'tech' | 'vocals' | 'other'
  defaultCount: number
  order: number
}> = {}) {
  return {
    id: 'role-1',
    name: 'guitar',
    group: 'band' as const,
    defaultCount: 1,
    order: 0,
    ...overrides,
  }
}

function triggerPeopleSnapshot(people: ReturnType<typeof makePerson>[]) {
  const cb = snapshotCallbacks['organizations/org-1/people']
  if (cb) {
    cb({
      docs: people.map((p) => ({
        id: p.id,
        data: () => {
          const { id: _id, ...rest } = p
          return rest
        },
        ref: { id: p.id, path: `organizations/org-1/people/${p.id}` },
      })),
    })
  }
}

function triggerRolesSnapshot(roles: ReturnType<typeof makeRole>[]) {
  const cb = snapshotCallbacks['organizations/org-1/roles']
  if (cb) {
    cb({
      docs: roles.map((r) => ({
        id: r.id,
        data: () => {
          const { id: _id, ...rest } = r
          return rest
        },
        ref: { id: r.id, path: `organizations/org-1/roles/${r.id}` },
      })),
    })
  }
}

describe('useRosterStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    for (const key of Object.keys(snapshotCallbacks)) delete snapshotCallbacks[key]
  })

  describe('initial state', () => {
    it('starts with empty people array', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      expect(store.people).toEqual([])
    })

    it('starts with empty roles array', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      expect(store.roles).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      expect(store.isLoading).toBe(true)
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot on the org people collection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalled()
      expect(snapshotCallbacks['organizations/org-1/people']).toBeDefined()
    })

    it('populates people from snapshot with { id, ...data } mapping', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([makePerson()])
      expect(store.people).toHaveLength(1)
      expect(store.people[0]!.id).toBe('person-1')
      expect(store.people[0]!.name).toBe('Sarah Smith')
    })

    it('sets isLoading to false after first people snapshot', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([makePerson()])
      expect(store.people).toHaveLength(1)
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.people).toEqual([])
      expect(store.roles).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('calling subscribe again unsubscribes previous listeners first', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      store.subscribe('org-2')
      // two subscriptions per call (people + roles) => 2 unsubscribes from first call
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('activePeople computed', () => {
    it('returns only people with active === true', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({ id: 'p1', name: 'Active Person', active: true }),
        makePerson({ id: 'p2', name: 'Inactive Person', active: false }),
      ])
      expect(store.activePeople).toHaveLength(1)
      expect(store.activePeople[0]!.name).toBe('Active Person')
    })
  })

  describe('addPerson', () => {
    it('calls addDoc with active:true and serverTimestamp fields', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.addPerson({ name: 'New Person', email: 'new@example.com' })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.name).toBe('New Person')
      expect(data.active).toBe(true)
      expect(data.frequencyTargetN).toBe(4)
      expect(data.roles).toEqual([])
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('updatePerson', () => {
    it('calls updateDoc with serverTimestamp for updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.updatePerson('person-1', { name: 'Updated Name' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.name).toBe('Updated Name')
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('deactivatePerson / reactivatePerson (D-20 soft-delete)', () => {
    it('deactivatePerson calls updateDoc with active:false, not deleteDoc', async () => {
      const { updateDoc, deleteDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.deactivatePerson('person-1')

      expect(deleteDoc).not.toHaveBeenCalled()
      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.active).toBe(false)
      expect(data.updatedAt).toBeDefined()
    })

    it('reactivatePerson calls updateDoc with active:true', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.reactivatePerson('person-1')

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.active).toBe(true)
      expect(data.updatedAt).toBeDefined()
    })
  })

  describe('upsertPeople — re-import upsert (D-13/D-14)', () => {
    it('creates new doc via addDoc when no match found', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([])

      const result = await store.upsertPeople([
        { name: 'Brand New Person', email: 'brand@example.com', pcPersonId: 'pc-new-1' },
      ])

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.name).toBe('Brand New Person')
      expect(data.active).toBe(true)
      expect(data.frequencyTargetN).toBe(4)
      expect(data.roles).toEqual([])
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(result).toEqual({ added: 1, updated: 0 })
    })

    it('updates existing doc via updateDoc when pcPersonId matches', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({ id: 'existing-person', name: 'Old Name', pcPersonId: 'pc-123', active: true }),
      ])

      const result = await store.upsertPeople([
        { name: 'Updated Name', email: 'updated@example.com', pcPersonId: 'pc-123' },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.name).toBe('Updated Name')
      expect(result).toEqual({ added: 0, updated: 1 })
    })

    it('merges (unions) roles on update — never removes a role the existing person already has', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({
          id: 'existing-person',
          name: 'Multi Role',
          pcPersonId: 'pc-multi',
          active: true,
          roles: ['role-projection', 'role-vocals'],
        }),
      ])

      // Import only reports the Sound role — the person's existing projection/vocals
      // roles must be preserved, not clobbered.
      await store.upsertPeople([
        { name: 'Multi Role', email: '', pcPersonId: 'pc-multi', roles: ['role-sound'] },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      const written = data.roles as string[]
      expect(new Set(written)).toEqual(new Set(['role-projection', 'role-vocals', 'role-sound']))
    })

    it('matches by normalized name (trim + collapse whitespace + lowercase) when no pcPersonId match', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({ id: 'existing-person', name: 'Sarah  Smith', pcPersonId: null, active: true }),
      ])

      await store.upsertPeople([
        { name: '  sarah smith  ', email: 'sarah@example.com' },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    it('preserves active:false on re-import — a deactivated person stays inactive', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({ id: 'deactivated-person', name: 'Deactivated Person', pcPersonId: 'pc-deact', active: false }),
      ])

      await store.upsertPeople([
        { name: 'Deactivated Person', email: 'x@example.com', pcPersonId: 'pc-deact' },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      // active must NOT be included in the update payload (preserves existing false)
      expect(data.active).toBeUndefined()
    })

    it('never writes blackoutDates or pairedWith to the person doc', async () => {
      const { addDoc, updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({ id: 'existing-person', name: 'Existing Person', pcPersonId: 'pc-1', active: true }),
      ])

      await store.upsertPeople([
        { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1' },
        { name: 'New Person', email: 'n@example.com', pcPersonId: 'pc-2' },
      ])

      const updateData = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const addData = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      expect(updateData.blackoutDates).toBeUndefined()
      expect(updateData.pairedWith).toBeUndefined()
      expect(addData.blackoutDates).toBeUndefined()
      expect(addData.pairedWith).toBeUndefined()
    })

    it('returns correct added/updated counts for a mixed batch', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerPeopleSnapshot([
        makePerson({ id: 'existing-person', name: 'Existing Person', pcPersonId: 'pc-1', active: true }),
      ])

      const result = await store.upsertPeople([
        { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1' },
        { name: 'New Person 1', email: 'n1@example.com', pcPersonId: 'pc-2' },
        { name: 'New Person 2', email: 'n2@example.com', pcPersonId: 'pc-3' },
      ])

      expect(result).toEqual({ added: 2, updated: 1 })
    })
  })

  describe('roles subscription + seedDefaultRolesIfEmpty (D-03)', () => {
    it('subscribe calls onSnapshot on the org roles collection ordered by "order"', async () => {
      const { onSnapshot, orderBy } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalled()
      expect(snapshotCallbacks['organizations/org-1/roles']).toBeDefined()
      expect(orderBy).toHaveBeenCalledWith('order')
    })

    it('populates roles from snapshot ordered by "order"', async () => {
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerRolesSnapshot([
        makeRole({ id: 'role-1', name: 'guitar', order: 0 }),
        makeRole({ id: 'role-2', name: 'drums', order: 1 }),
      ])
      expect(store.roles).toHaveLength(2)
      expect(store.roles[0]!.name).toBe('guitar')
    })

    it('seedDefaultRolesIfEmpty writes 8 roles when roles collection is empty', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerRolesSnapshot([])

      await store.seedDefaultRolesIfEmpty()

      expect(addDoc).toHaveBeenCalledTimes(8)
    })

    it('seedDefaultRolesIfEmpty writes nothing when roles already exist', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')
      triggerRolesSnapshot([makeRole({ id: 'role-1', name: 'guitar' })])

      await store.seedDefaultRolesIfEmpty()

      expect(addDoc).not.toHaveBeenCalled()
    })
  })

  describe('addRole / updateRole / deleteRole (D-03 editable role list)', () => {
    it('addRole calls addDoc with the given shape + timestamps', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.addRole({ name: 'keys', group: 'band', defaultCount: 1, order: 8 })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.name).toBe('keys')
      expect(data.group).toBe('band')
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    it('updateRole calls updateDoc with serverTimestamp for updatedAt', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.updateRole('role-1', { name: 'renamed-role' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.name).toBe('renamed-role')
      expect(data.updatedAt).toBeDefined()
    })

    it('deleteRole calls deleteDoc (hard delete of role config doc)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.deleteRole('role-1')

      expect(deleteDoc).toHaveBeenCalledOnce()
    })
  })

  describe('patch-on-read migrations (D-03 roleFrequencies, D-09 vocals group)', () => {
    it('D-03: backfills roleFrequencies from frequencyTargetN onto every held role when the field is wholly absent', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerPeopleSnapshot([
        makePerson({ id: 'p1', roles: ['guitar', 'vocals'], frequencyTargetN: 2, roleFrequencies: null }),
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const ref = callArgs[0] as unknown as { id: string }
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(ref.id).toBe('p1')
      expect(data).toEqual({ roleFrequencies: { guitar: 2, vocals: 2 } })
    })

    it('D-03: is idempotent — does not patch a person doc that already has roleFrequencies', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerPeopleSnapshot([
        makePerson({ id: 'p1', roles: ['guitar'], frequencyTargetN: 2, roleFrequencies: { guitar: 1 } }),
      ])

      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('D-03: only patches docs missing roleFrequencies, leaving already-migrated sibling docs untouched', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerPeopleSnapshot([
        makePerson({ id: 'p1', roles: ['guitar'], frequencyTargetN: 2, roleFrequencies: { guitar: 1 } }),
        makePerson({ id: 'p2', roles: ['bass'], frequencyTargetN: 3, roleFrequencies: null }),
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const ref = vi.mocked(updateDoc).mock.calls[0]![0] as unknown as { id: string }
      expect(ref.id).toBe('p2')
    })

    it('D-03: a person with no roles at all backfills to an empty roleFrequencies map (no throw)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerPeopleSnapshot([makePerson({ id: 'p1', roles: [], frequencyTargetN: 4, roleFrequencies: null })])

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data).toEqual({ roleFrequencies: {} })
    })

    it('D-09: patches a "vocals" role doc from group band to group vocals', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerRolesSnapshot([makeRole({ id: 'role-vocals', name: 'vocals', group: 'band' })])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const ref = callArgs[0] as unknown as { id: string }
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(ref.id).toBe('role-vocals')
      expect(data).toEqual({ group: 'vocals' })
    })

    it('D-09: name match is case-insensitive', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerRolesSnapshot([makeRole({ id: 'role-vocals', name: 'VOCALS', group: 'band' })])

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    it('D-09: is idempotent — does not patch a role already in group vocals, or an unrelated role', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      triggerRolesSnapshot([
        makeRole({ id: 'role-vocals', name: 'vocals', group: 'vocals' }),
        makeRole({ id: 'role-guitar', name: 'guitar', group: 'band' }),
      ])

      expect(updateDoc).not.toHaveBeenCalled()
    })
  })

  describe('roleFrequencies persistence + CSV graceful degrade (D-02/D-04/D-07)', () => {
    it('updatePerson persists an explicit roleFrequencies map (round-trip)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.updatePerson('person-1', { roleFrequencies: { guitar: 2, vocals: 1 } })

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data.roleFrequencies).toEqual({ guitar: 2, vocals: 1 })
    })

    it('addPerson persists an explicit roleFrequencies map (round-trip)', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.addPerson({
        name: 'New Person',
        email: 'new@example.com',
        roles: ['guitar'],
        roleFrequencies: { guitar: 3 },
      })

      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      expect(data.roleFrequencies).toEqual({ guitar: 3 })
    })

    it('addPerson synthesizes roleFrequencies from roles x frequencyTargetN when no map is supplied (D-02/D-07)', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.addPerson({
        name: 'New Person',
        email: 'new@example.com',
        roles: ['guitar', 'bass'],
        frequencyTargetN: 2,
      })

      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      expect(data.roleFrequencies).toEqual({ guitar: 2, bass: 2 })
    })

    it('addPerson defaults per-role frequency to N=4 when neither roleFrequencies nor frequencyTargetN is supplied (D-02)', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('../roster')
      const store = useRosterStore()
      store.subscribe('org-1')

      await store.addPerson({ name: 'New Person', email: 'new@example.com', roles: ['drums'] })

      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      expect(data.roleFrequencies).toEqual({ drums: 4 })
    })

    describe('upsertPeople', () => {
      it('new person: synthesizes roleFrequencies from roles x frequencyTargetN when no map is supplied (D-07 graceful degrade)', async () => {
        const { addDoc } = await import('firebase/firestore')
        const { useRosterStore } = await import('../roster')
        const store = useRosterStore()
        store.subscribe('org-1')
        triggerPeopleSnapshot([])

        await store.upsertPeople([
          { name: 'Brand New Person', email: 'brand@example.com', roles: ['guitar', 'bass'], frequencyTargetN: 2 },
        ])

        const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
        expect(data.roleFrequencies).toEqual({ guitar: 2, bass: 2 })
      })

      it('new person: defaults to per-role N=4 when neither roleFrequencies nor frequencyTargetN is supplied (D-02)', async () => {
        const { addDoc } = await import('firebase/firestore')
        const { useRosterStore } = await import('../roster')
        const store = useRosterStore()
        store.subscribe('org-1')
        triggerPeopleSnapshot([])

        await store.upsertPeople([
          { name: 'Brand New Person', email: 'brand@example.com', roles: ['drums'] },
        ])

        const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
        expect(data.roleFrequencies).toEqual({ drums: 4 })
      })

      it('existing person: an explicit roleFrequencies map on the incoming row wins outright', async () => {
        const { updateDoc } = await import('firebase/firestore')
        const { useRosterStore } = await import('../roster')
        const store = useRosterStore()
        store.subscribe('org-1')
        triggerPeopleSnapshot([
          makePerson({ id: 'existing-person', name: 'Existing Person', pcPersonId: 'pc-1', active: true, roles: ['guitar'] }),
        ])

        await store.upsertPeople([
          { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1', roles: ['guitar'], roleFrequencies: { guitar: 6 } },
        ])

        const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
        expect(data.roleFrequencies).toEqual({ guitar: 6 })
      })

      it('existing person: roles without a map synthesizes defaults for new roles while preserving already-tuned entries (T-15-03-01 non-clobber)', async () => {
        const { updateDoc } = await import('firebase/firestore')
        const { useRosterStore } = await import('../roster')
        const store = useRosterStore()
        store.subscribe('org-1')
        triggerPeopleSnapshot([
          makePerson({
            id: 'existing-person',
            name: 'Existing Person',
            pcPersonId: 'pc-1',
            active: true,
            roles: ['vocals'],
            roleFrequencies: { vocals: 3 },
          }),
        ])

        await store.upsertPeople([
          { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1', roles: ['guitar'], frequencyTargetN: 2 },
        ])

        const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
        expect(data.roleFrequencies).toEqual({ guitar: 2, vocals: 3 })
      })

      it('existing person: not supplying roles at all leaves roleFrequencies untouched', async () => {
        const { updateDoc } = await import('firebase/firestore')
        const { useRosterStore } = await import('../roster')
        const store = useRosterStore()
        store.subscribe('org-1')
        triggerPeopleSnapshot([
          makePerson({ id: 'existing-person', name: 'Existing Person', pcPersonId: 'pc-1', active: true, roleFrequencies: { guitar: 3 } }),
        ])

        await store.upsertPeople([
          { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1' },
        ])

        const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
        expect(data.roleFrequencies).toBeUndefined()
      })
    })
  })
})
