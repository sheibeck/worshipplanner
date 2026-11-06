import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// Phase 147: what the store really writes to and removes from the public share documents
// (shareTokens, serviceShares), proved over an in-memory document store keyed by path.
// See ADR-0249 (docs/adr/0249-new-services-start-with-a-default-rehearsal.md)

vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
  randomUUID: vi.fn(() => 'mock-uuid-1'),
})

const h = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  failSetDoc: new Set<string>(),
  failDeleteDoc: new Set<string>(),
  failGetDoc: new Set<string>(),
  flags: { failUpdateDoc: false },
  snap: { cb: null as null | ((s: { docs: unknown[] }) => void) },
  // JSON clone: the store hands over Vue reactive proxies, which structuredClone rejects.
  clone: <T,>(v: T): T => JSON.parse(JSON.stringify(v)),
}))

vi.mock('firebase/firestore', () => {
  const read = (path: string) => {
    const d = h.store.get(path)
    return {
      id: path.split('/').pop() as string,
      exists: () => d !== undefined,
      data: () => (d === undefined ? undefined : h.clone(d)),
    }
  }
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      id: segments[segments.length - 1] ?? 'mock-id',
      path: segments.join('/'),
    })),
    onSnapshot: vi.fn((_q: unknown, opts: unknown, cb?: (s: { docs: unknown[] }) => void) => {
      h.snap.cb = typeof opts === 'function' ? (opts as (s: { docs: unknown[] }) => void) : (cb ?? null)
      return vi.fn()
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-service-id' })),
    updateDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
      if (h.flags.failUpdateDoc) throw new Error('updateDoc failed')
      const cur = h.store.get(ref.path)
      if (cur) h.store.set(ref.path, { ...cur, ...h.clone(data) })
    }),
    deleteDoc: vi.fn(async (ref: { path: string }) => {
      if (h.failDeleteDoc.has(ref.path)) throw new Error(`deleteDoc failed: ${ref.path}`)
      h.store.delete(ref.path)
    }),
    getDoc: vi.fn(async (ref: { path: string }) => {
      if (h.failGetDoc.has(ref.path)) throw new Error(`getDoc failed: ${ref.path}`)
      return read(ref.path)
    }),
    getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
    setDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
      if (h.failSetDoc.has(ref.path)) throw new Error(`setDoc failed: ${ref.path}`)
      h.store.set(ref.path, h.clone(data))
    }),
    deleteField: vi.fn(),
    query: vi.fn((ref: unknown) => ref),
    orderBy: vi.fn(),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    limit: vi.fn((n: number) => ({ limit: n })),
    runTransaction: vi.fn(async (_db: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        get: async (ref: { path: string }) => read(ref.path),
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          h.store.set(ref.path, h.clone(data))
        },
        update: vi.fn(),
        delete: vi.fn(),
      }),
    ),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
    Timestamp: { fromMillis: vi.fn() },
  }
})

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))

vi.mock('@/stores/songs', () => ({ useSongStore: vi.fn(() => ({ songs: [] })) }))
vi.mock('@/stores/roster', () => ({ useRosterStore: vi.fn(() => ({ people: [], roles: [] })) }))
vi.mock('@/stores/quarters', () => ({ useQuartersStore: vi.fn(() => ({ quarters: [] })) }))

const mockAuthState = reactive<{
  orgName: string | null
  settings: {
    aiEnabled: boolean
    pcEnabled: boolean
    vwModeEnabled: boolean
    defaultServiceTemplate: unknown[]
    rehearsalDefaultWeekday: number | null
    rehearsalTimeDefaults: string[]
    reportTimeDefault: string
  }
}>({
  orgName: 'Grace Church',
  settings: {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    defaultServiceTemplate: [],
    rehearsalDefaultWeekday: null,
    rehearsalTimeDefaults: [],
    reportTimeDefault: '',
  },
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

const ORG = 'organizations/org-1'
const svcPath = (id: string) => `${ORG}/services/${id}`
const pagePath = (date: string) => `serviceShares/grace-church__service-${date}`

function makeService(id: string, date: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    date,
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...extra,
  }
}

function triggerSnapshot(services: ReturnType<typeof makeService>[]) {
  h.snap.cb?.({
    docs: services.map((s) => ({
      id: s.id,
      data: () => {
        const { id: _id, ...rest } = s
        return rest
      },
      metadata: { hasPendingWrites: false },
    })),
  })
}

function seedOrg() {
  h.store.set('organizations/org-1', { name: 'Grace Church', slug: 'grace-church' })
}

/** The identity doc and an old token doc, so the refresh finds a shared service. */
function seedShared(serviceId: string, token: string, date: string) {
  h.store.set(`serviceShareLinks/${serviceId}`, { token, orgId: 'org-1', serviceId })
  h.store.set(`shareTokens/${token}`, { serviceId, orgId: 'org-1', serviceSnapshot: { date, seeded: true } })
}

function seedPage(date: string, serviceId: string | undefined) {
  h.store.set(pagePath(date), {
    ...(serviceId === undefined ? {} : { serviceId }),
    orgId: 'org-1',
    orgSlug: 'grace-church',
    token: 'tok-existing',
    serviceSnapshot: { date, seeded: true },
  })
}

type PublicDoc = {
  serviceId?: string
  serviceSnapshot: { date: string; seeded?: boolean; rehearsals?: { id: string; date: string; time: string }[] }
}
const docAt = (path: string) => h.store.get(path) as PublicDoc | undefined

async function loadStore() {
  const { useServiceStore } = await import('../services')
  const store = useServiceStore()
  store.subscribe('org-1')
  return store
}

describe('public share documents (R462, R465)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    h.store.clear()
    h.failSetDoc.clear()
    h.failDeleteDoc.clear()
    h.failGetDoc.clear()
    h.flags.failUpdateDoc = false
    h.snap.cb = null
    mockAuthState.settings.rehearsalDefaultWeekday = null
    mockAuthState.settings.rehearsalTimeDefaults = []
    seedOrg()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errSpy.mockRestore()
  })

  describe('documents written at creation and after an edit carry no marker', () => {
    it('writes shareTokens and serviceShares with no marker at creation (AC-RHD-51)', async () => {
      const { addDoc } = await import('firebase/firestore')
      mockAuthState.settings.rehearsalDefaultWeekday = 3
      mockAuthState.settings.rehearsalTimeDefaults = ['18:30']
      const store = await loadStore()

      await store.createService({ date: '2026-11-08', name: '', teams: [] })

      const tokenPaths = [...h.store.keys()].filter((p) => p.startsWith('shareTokens/'))
      expect(tokenPaths).toHaveLength(1)
      const tokenDoc = docAt(tokenPaths[0]!)
      const pageDoc = docAt(pagePath('2026-11-08'))
      // The documents must exist and hold the row before "no marker" means anything.
      expect(tokenDoc).toBeDefined()
      expect(pageDoc).toBeDefined()
      for (const d of [tokenDoc!, pageDoc!]) {
        expect(d.serviceSnapshot.rehearsals).toHaveLength(1)
        expect(d.serviceSnapshot.rehearsals![0]!.date).toBe('2026-11-04')
        expect(JSON.stringify(d)).not.toContain('autoAdded')
      }
      const written = vi.mocked(addDoc).mock.calls[0]![1] as { rehearsals: { autoAdded?: boolean }[] }
      expect(written.rehearsals[0]!.autoAdded).toBe(true)
    })

    it('rewrites shareTokens and serviceShares with no marker after an edit (AC-RHD-52)', async () => {
      const { setDoc } = await import('firebase/firestore')
      const store = await loadStore()
      triggerSnapshot([
        makeService('service-1', '2026-03-08', {
          rehearsals: [{ id: 'r1', date: '2026-03-04', time: '18:30', autoAdded: true }],
        }),
      ])
      seedShared('service-1', 'tok-existing', '2026-03-08')
      seedPage('2026-03-08', 'service-1')

      await store.updateService('service-1', { notes: 'x' })

      const written = vi.mocked(setDoc).mock.calls.map((c) => (c[0] as { path: string }).path)
      expect(written).toContain('shareTokens/tok-existing')
      expect(written).toContain(pagePath('2026-03-08'))
      for (const path of ['shareTokens/tok-existing', pagePath('2026-03-08')]) {
        const d = docAt(path)!
        expect(d.serviceSnapshot.seeded).toBeUndefined()
        expect(d.serviceSnapshot.rehearsals).toHaveLength(1)
        expect(JSON.stringify(d)).not.toContain('autoAdded')
      }
    })
  })

  describe('a date change retires the old public page', () => {
    async function warmMove() {
      const store = await loadStore()
      triggerSnapshot([makeService('service-1', '2026-03-08')])
      seedShared('service-1', 'tok-existing', '2026-03-08')
      seedPage('2026-03-08', 'service-1')
      return store
    }

    it('removes the old date page and keeps the new one (AC-RHD-56)', async () => {
      const store = await warmMove()

      await store.updateService('service-1', { date: '2026-03-15' })

      expect(docAt(pagePath('2026-03-15'))).toBeDefined()
      expect(docAt(pagePath('2026-03-15'))!.serviceId).toBe('service-1')
      expect(docAt(pagePath('2026-03-08'))).toBeUndefined()
      expect(errSpy).not.toHaveBeenCalled()
    })

    it('keeps the token link working and showing the new date (AC-RHD-57)', async () => {
      const store = await warmMove()

      await store.updateService('service-1', { date: '2026-03-15' })

      const tokenDoc = docAt('shareTokens/tok-existing')
      expect(tokenDoc).toBeDefined()
      expect(tokenDoc!.serviceSnapshot.date).toBe('2026-03-15')
    })

    it('writes the new page before it removes the old one (AC-RHD-58)', async () => {
      const { setDoc, deleteDoc } = await import('firebase/firestore')
      const store = await warmMove()

      await store.updateService('service-1', { date: '2026-03-15' })

      const setIdx = vi
        .mocked(setDoc)
        .mock.calls.findIndex((c) => (c[0] as { path: string }).path === pagePath('2026-03-15'))
      expect(setIdx).toBeGreaterThanOrEqual(0)
      expect(vi.mocked(deleteDoc)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(setDoc).mock.invocationCallOrder[setIdx]!).toBeLessThan(
        vi.mocked(deleteDoc).mock.invocationCallOrder[0]!,
      )
    })

    it('keeps the old page when the new page could not be written (AC-RHD-58)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const store = await warmMove()
      h.failSetDoc.add(pagePath('2026-03-15'))

      await expect(store.updateService('service-1', { date: '2026-03-15' })).resolves.toBeUndefined()

      expect(docAt(pagePath('2026-03-15'))).toBeUndefined()
      expect(docAt(pagePath('2026-03-08'))).toBeDefined()
      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
    })

    it('does not fail the save when the removal is rejected (AC-RHD-59)', async () => {
      const store = await warmMove()
      h.failDeleteDoc.add(pagePath('2026-03-08'))

      await expect(store.updateService('service-1', { date: '2026-03-15' })).resolves.toBeUndefined()

      expect(errSpy).toHaveBeenCalled()
      expect(docAt(pagePath('2026-03-08'))).toBeDefined()
    })

    it('does not fail the save when reading the old page is rejected (AC-RHD-59)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const store = await warmMove()
      h.failGetDoc.add(pagePath('2026-03-08'))

      await expect(store.updateService('service-1', { date: '2026-03-15' })).resolves.toBeUndefined()

      expect(errSpy).toHaveBeenCalled()
      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
    })

    it('reads and removes no public page when the date is unchanged (AC-RHD-60)', async () => {
      const { deleteDoc, getDoc } = await import('firebase/firestore')
      const store = await warmMove()

      await store.updateService('service-1', { date: '2026-03-08', notes: 'x' })
      await store.updateService('service-1', { slots: [] })

      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
      const readPages = vi
        .mocked(getDoc)
        .mock.calls.map((c) => (c[0] as { path: string }).path)
        .filter((p) => p.startsWith('serviceShares/'))
      expect(readPages).toEqual([])
    })

    it('leaves an old page recorded to another service in place (AC-RHD-61)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const store = await warmMove()
      seedPage('2026-03-08', 'service-other')

      await store.updateService('service-1', { date: '2026-03-15' })

      expect(docAt(pagePath('2026-03-08'))!.serviceId).toBe('service-other')
      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
    })

    it('leaves an old page that records no service in place (AC-RHD-61)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const store = await warmMove()
      seedPage('2026-03-08', undefined)

      await store.updateService('service-1', { date: '2026-03-15' })

      expect(docAt(pagePath('2026-03-08'))).toBeDefined()
      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
    })

    it('removes no page when the service itself fails to save (AC-RHD-62)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const store = await warmMove()
      h.flags.failUpdateDoc = true

      await expect(store.updateService('service-1', { date: '2026-03-15' })).rejects.toThrow('updateDoc failed')

      expect(docAt(pagePath('2026-03-08'))).toBeDefined()
      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
    })

    it('removes the page and leaves the other service on the date unaffected (AC-RHD-68)', async () => {
      const store = await loadStore()
      triggerSnapshot([makeService('service-1', '2026-03-08'), makeService('service-2', '2026-03-08')])
      seedShared('service-1', 'tok-existing', '2026-03-08')
      seedShared('service-2', 'tok-two', '2026-03-08')
      seedPage('2026-03-08', 'service-1')
      const tokenTwoBefore = structuredClone(h.store.get('shareTokens/tok-two'))

      await store.updateService('service-1', { date: '2026-03-15' })

      expect(docAt(pagePath('2026-03-08'))).toBeUndefined()
      expect(h.store.get('shareTokens/tok-two')).toEqual(tokenTwoBefore)

      await store.updateService('service-2', { notes: 'x' })

      expect(docAt(pagePath('2026-03-08'))).toBeDefined()
      expect(docAt(pagePath('2026-03-08'))!.serviceId).toBe('service-2')
    })

    it('does not delete when the old page is absent', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const store = await loadStore()
      triggerSnapshot([makeService('service-1', '2026-03-08')])
      seedShared('service-1', 'tok-existing', '2026-03-08')

      await expect(store.updateService('service-1', { date: '2026-03-15' })).resolves.toBeUndefined()

      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
      expect(errSpy).not.toHaveBeenCalled()
    })
  })

  describe('a service missing from the local cache', () => {
    async function coldStore() {
      const store = await loadStore()
      triggerSnapshot([])
      h.store.set(svcPath('service-1'), { date: '2026-03-08', name: 'Sunday Service' })
      return store
    }

    it('removes the old page when the service is not in the local cache (AC-RHD-56)', async () => {
      const store = await coldStore()
      seedPage('2026-03-08', 'service-1')
      seedPage('2026-03-15', 'service-1')

      await store.updateService('service-1', { date: '2026-03-15' })

      expect(docAt(pagePath('2026-03-08'))).toBeUndefined()
      expect(docAt(pagePath('2026-03-15'))).toBeDefined()
    })

    it('keeps the old page when no page exists on the new date', async () => {
      const store = await coldStore()
      seedPage('2026-03-08', 'service-1')

      await expect(store.updateService('service-1', { date: '2026-03-15' })).resolves.toBeUndefined()

      expect(docAt(pagePath('2026-03-08'))).toBeDefined()
    })

    it('still saves, and removes nothing, when the stored date cannot be read', async () => {
      const { updateDoc, deleteDoc } = await import('firebase/firestore')
      const store = await coldStore()
      seedPage('2026-03-08', 'service-1')
      seedPage('2026-03-15', 'service-1')
      h.failGetDoc.add(svcPath('service-1'))

      await expect(store.updateService('service-1', { date: '2026-03-15' })).resolves.toBeUndefined()

      expect(vi.mocked(updateDoc)).toHaveBeenCalled()
      expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
      expect(errSpy).toHaveBeenCalled()
    })

    it('adds no read of the service for a write with no date, or with a warm cache', async () => {
      const { getDoc } = await import('firebase/firestore')
      const store = await coldStore()
      const servicePathReads = () =>
        vi.mocked(getDoc).mock.calls.filter((c) => (c[0] as { path: string }).path === svcPath('service-1')).length

      await store.updateService('service-1', { notes: 'x' })
      expect(servicePathReads()).toBe(0)

      triggerSnapshot([makeService('service-1', '2026-03-08')])
      await store.updateService('service-1', { date: '2026-03-15' })
      expect(servicePathReads()).toBe(0)
    })
  })

  describe('a service created earlier is left alone when the defaults change', () => {
    const ORIGINAL = [{ id: 'r1', date: '2026-03-04', time: '18:30', autoAdded: true }]

    it('keeps its rehearsals in the stored service and the public documents after a later save (AC-RHD-10)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      mockAuthState.settings.rehearsalDefaultWeekday = 3
      mockAuthState.settings.rehearsalTimeDefaults = ['18:30']
      const store = await loadStore()
      triggerSnapshot([makeService('service-1', '2026-03-08', { rehearsals: ORIGINAL })])
      h.store.set(svcPath('service-1'), makeService('service-1', '2026-03-08', { rehearsals: ORIGINAL }))
      seedShared('service-1', 'tok-existing', '2026-03-08')
      seedPage('2026-03-08', 'service-1')

      // The church changes its defaults, then the service is saved for an unrelated reason.
      mockAuthState.settings.rehearsalDefaultWeekday = 5
      mockAuthState.settings.rehearsalTimeDefaults = ['20:00']
      vi.mocked(updateDoc).mockClear()
      await store.updateService('service-1', { notes: 'x' })

      const serviceWrites = vi
        .mocked(updateDoc)
        .mock.calls.filter((c) => (c[0] as { path: string }).path === svcPath('service-1'))
      expect(serviceWrites).toHaveLength(1)
      expect(serviceWrites[0]![1]).not.toHaveProperty('rehearsals')
      expect((h.store.get(svcPath('service-1')) as { rehearsals: unknown }).rehearsals).toEqual(ORIGINAL)
      for (const path of ['shareTokens/tok-existing', pagePath('2026-03-08')]) {
        expect(docAt(path)!.serviceSnapshot.rehearsals).toEqual([{ id: 'r1', date: '2026-03-04', time: '18:30' }])
      }
    })
  })
})
