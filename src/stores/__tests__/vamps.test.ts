import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { VampAttachment } from '@/types/vamp'
import { todayYmd } from '@/utils/myScheduleGrouping'

// Track onSnapshot callbacks and unsubscribe fns
let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((_query, callback) => {
      snapshotCallback = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-vamp-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
    deleteField: vi.fn(() => ({ __sentinel: 'deleteField' })),
  }
})

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}))

// Mock firebase/storage — deleteVamp's best-effort Storage cascade
vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path: string) => ({ path })),
  deleteObject: vi.fn(() => Promise.resolve()),
}))

function makeVamp(overrides: Partial<{
  id: string
  name: string
  key: string
  tempo?: string
  attachment?: { storagePath: string; downloadUrl: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: unknown; createdBy: string } | null
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}> = {}) {
  return {
    id: 'vamp-1',
    name: 'Open Response',
    key: 'G',
    tempo: '68 bpm',
    attachment: null,
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerSnapshot(vamps: ReturnType<typeof makeVamp>[]) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: vamps.map((v) => ({
        id: v.id,
        data: () => {
          const { id: _id, ...rest } = v
          return rest
        },
      })),
    })
  }
}

describe('useVampStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
  })

  describe('initial state', () => {
    it('starts with empty vamps array', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      expect(store.vamps).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      expect(store.isLoading).toBe(true)
    })

    it('filteredVamps is empty initially', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      expect(store.filteredVamps).toEqual([])
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot on the org vamps collection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('populates vamps from snapshot with { id, ...data } mapping', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp()])
      expect(store.vamps).toHaveLength(1)
      expect(store.vamps[0]!.id).toBe('vamp-1')
      expect(store.vamps[0]!.name).toBe('Open Response')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp()])
      expect(store.vamps).toHaveLength(1)
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.vamps).toEqual([])
      expect(store.isLoading).toBe(true)
      expect(store.orgId).toBeNull()
    })

    it('calling subscribe again unsubscribes previous listener first', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      store.subscribe('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })
  })

  describe('addVamp', () => {
    it('calls addDoc with serverTimestamp createdAt/updatedAt and resolves to the new doc id', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      const id = await store.addVamp({ name: 'Open Response', key: 'G', tempo: '68 bpm' })

      expect(addDoc).toHaveBeenCalledOnce()
      const [, payload] = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(payload.createdAt).toEqual(serverTimestamp())
      expect(payload.updatedAt).toEqual(serverTimestamp())
      expect(id).toBe('new-vamp-id')
    })

    // Prod bug 2026-09-18: VampSlideOver sends `tempo: undefined` when the
    // optional BPM is blank and the Firestore SDK rejects undefined values
    // ("Unsupported field value: undefined (found in field tempo)").
    it('omits undefined optional fields from the addDoc payload (blank tempo)', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      await store.addVamp({ name: 'Open Response', key: 'G', tempo: undefined, attachment: null })

      const [, payload] = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect('tempo' in payload).toBe(false)
      expect(payload.attachment).toBeNull()
      expect(Object.values(payload)).not.toContain(undefined)
    })
  })

  describe('updateVamp', () => {
    it('turns an explicit undefined tempo into deleteField() so clearing the BPM persists', async () => {
      const { updateDoc, deleteField } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      await store.updateVamp('vamp-1', { name: 'Open Response', key: 'G', tempo: undefined })

      const [, payload] = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(payload.tempo).toEqual(deleteField())
      expect(payload.name).toBe('Open Response')
      expect(Object.values(payload)).not.toContain(undefined)
    })

    it('leaves tempo untouched when the key is absent from the partial update', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      await store.updateVamp('vamp-1', { name: 'Renamed' })

      const [, payload] = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect('tempo' in payload).toBe(false)
    })

    it('calls updateDoc on the vamp doc with serverTimestamp updatedAt', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      await store.updateVamp('vamp-1', { name: 'New Name' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const [, payload] = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(payload.name).toBe('New Name')
      expect(payload.updatedAt).toBeDefined()
    })

    it('sets the attachment field as a plain write (not arrayUnion)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      const attachment = {
        storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/track.mp3',
        downloadUrl: 'https://cdn.example.com/track.mp3',
        fileName: 'track.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 2048,
        createdAt: { seconds: 1, nanoseconds: 0 },
        createdBy: 'user-1',
      }
      await store.updateVamp('vamp-1', { attachment: attachment as any })

      const [, payload] = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(payload.attachment).toEqual(attachment)
    })
  })

  describe('deleteVamp', () => {
    it('deletes the Storage attachment then the doc when an attachment exists', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({
        attachment: {
          storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/track.mp3',
          downloadUrl: 'https://cdn.example.com/track.mp3',
          fileName: 'track.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 2048,
          createdAt: { seconds: 1, nanoseconds: 0 },
          createdBy: 'user-1',
        },
      })])

      await store.deleteVamp('vamp-1')

      expect(deleteObject).toHaveBeenCalledOnce()
      expect(deleteDoc).toHaveBeenCalledOnce()
    })

    it('skips deleteObject when there is no attachment', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment: null })])

      await store.deleteVamp('vamp-1')

      expect(deleteObject).not.toHaveBeenCalled()
      expect(deleteDoc).toHaveBeenCalledOnce()
    })

    it('a failed Storage delete is logged and never aborts the doc delete', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      ;(deleteObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({
        attachment: {
          storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/track.mp3',
          downloadUrl: 'https://cdn.example.com/track.mp3',
          fileName: 'track.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 2048,
          createdAt: { seconds: 1, nanoseconds: 0 },
          createdBy: 'user-1',
        },
      })])

      await store.deleteVamp('vamp-1')

      expect(consoleSpy).toHaveBeenCalled()
      expect(deleteDoc).toHaveBeenCalledOnce()
      consoleSpy.mockRestore()
    })
  })

  describe('countAssignments (R440)', () => {
    it('counts distinct upcoming services and calls getDoc once per distinct serviceId', async () => {
      const { getDocs, getDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      const yesterday = (() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return todayYmd(d)
      })()

      ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        docs: [
          { id: 'sg-1', data: () => ({ serviceId: 'svc-A', slides: [{ id: 's1', vampId: 'vamp-1' }, { id: 's2', vampId: 'vamp-1' }] }) },
          { id: 'sg-2', data: () => ({ serviceId: 'svc-B', slides: [{ id: 's3', vampId: 'vamp-1' }] }) },
          { id: 'sg-3', data: () => ({ serviceId: 'svc-C', slides: [{ id: 's4', vampId: 'other-vamp' }] }) },
        ],
      })
      ;(getDoc as ReturnType<typeof vi.fn>).mockImplementation((ref: { id: string }) => {
        if (ref.id === 'svc-A') return Promise.resolve({ exists: () => true, data: () => ({ date: todayYmd() }) })
        if (ref.id === 'svc-B') return Promise.resolve({ exists: () => true, data: () => ({ date: yesterday }) })
        return Promise.resolve({ exists: () => false, data: () => ({}) })
      })

      const result = await store.countAssignments('vamp-1')

      expect(result).toEqual({ assignedAnywhere: true, upcomingServiceCount: 1 })
      expect(getDoc).toHaveBeenCalledTimes(2)
    })

    it('does not count a service whose getDoc reports it does not exist', async () => {
      const { getDocs, getDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        docs: [{ id: 'sg-1', data: () => ({ serviceId: 'svc-A', slides: [{ id: 's1', vampId: 'vamp-1' }] }) }],
      })
      ;(getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ exists: () => false, data: () => ({}) })

      const result = await store.countAssignments('vamp-1')

      expect(result).toEqual({ assignedAnywhere: true, upcomingServiceCount: 0 })
    })

    it('returns assignedAnywhere false and upcomingServiceCount 0 with no matching slideGroups, and never calls getDoc', async () => {
      const { getDocs, getDoc } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        docs: [{ id: 'sg-1', data: () => ({ serviceId: 'svc-A', slides: [{ id: 's1', vampId: 'other-vamp' }] }) }],
      })

      const result = await store.countAssignments('vamp-1')

      expect(result).toEqual({ assignedAnywhere: false, upcomingServiceCount: 0 })
      expect(getDoc).not.toHaveBeenCalled()
    })

    it('resolves null (never throws) when getDocs rejects, and logs the error', async () => {
      const { getDocs } = await import('firebase/firestore')
      ;(getDocs as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')

      const result = await store.countAssignments('vamp-1')

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('resolves null without calling getDocs when orgId is unset', async () => {
      const { getDocs } = await import('firebase/firestore')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()

      const result = await store.countAssignments('vamp-1')

      expect(result).toBeNull()
      expect(getDocs).not.toHaveBeenCalled()
    })
  })

  describe('deleteVamp — conditional Storage keep (R440)', () => {
    const attachment = {
      storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/a.mp3',
      downloadUrl: 'https://cdn.example.com/a.mp3',
      fileName: 'a.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 2048,
      createdAt: { seconds: 1, nanoseconds: 0 },
      createdBy: 'user-1',
    }

    it('keeps the MP3 when the scan reports assignedAnywhere true, even with upcomingServiceCount 0 (past-only assignment)', async () => {
      const { getDocs, getDoc, deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment })])

      const yesterday = (() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return todayYmd(d)
      })()
      ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        docs: [{ id: 'sg-1', data: () => ({ serviceId: 'svc-A', slides: [{ id: 's1', vampId: 'vamp-1' }] }) }],
      })
      ;(getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ exists: () => true, data: () => ({ date: yesterday }) })

      await store.deleteVamp('vamp-1')

      expect(deleteObject).not.toHaveBeenCalled()
      expect(deleteDoc).toHaveBeenCalledOnce()
    })

    it('cascades the Storage delete when the scan reports assignedAnywhere false (Phase 140 behavior preserved)', async () => {
      const { getDocs, deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment })])

      ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ docs: [] })

      await store.deleteVamp('vamp-1')

      expect(deleteObject).toHaveBeenCalledOnce()
      expect(deleteDoc).toHaveBeenCalledOnce()
      const deleteObjectCallOrder = (deleteObject as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!
      const deleteDocCallOrder = (deleteDoc as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!
      expect(deleteObjectCallOrder).toBeLessThan(deleteDocCallOrder)
    })

    it('keeps the MP3 (fail-safe) when the scan fails', async () => {
      const { getDocs, deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      ;(getDocs as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment })])

      await store.deleteVamp('vamp-1')

      expect(deleteObject).not.toHaveBeenCalled()
      expect(deleteDoc).toHaveBeenCalledOnce()
      consoleSpy.mockRestore()
    })

    it('deleteVamp on a missing vamp id resolves without throwing (idempotent)', async () => {
      const { getDocs, deleteDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ id: 'vamp-1', attachment })])

      ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ docs: [] })

      await expect(store.deleteVamp('missing-id')).resolves.toBeUndefined()

      expect(deleteObject).not.toHaveBeenCalled()
      expect(deleteDoc).toHaveBeenCalledOnce()
    })
  })

  describe('setAttachment / removeAttachment (WR-02)', () => {
    const existing = {
      storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/old.mp3',
      downloadUrl: 'https://cdn.example.com/old.mp3',
      fileName: 'old.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1024,
      createdAt: { seconds: 1, nanoseconds: 0 } as unknown as VampAttachment['createdAt'],
      createdBy: 'user-1',
    } satisfies VampAttachment

    it('removeAttachment nulls the slot then deletes the superseded Storage object', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment: existing })])

      await store.removeAttachment('vamp-1')

      const [, payload] = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect((payload as { attachment: unknown }).attachment).toBeNull()
      expect(deleteObject).toHaveBeenCalledOnce()
      const [ref] = (deleteObject as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect((ref as { path: string }).path).toBe(existing.storagePath)
    })

    it('setAttachment with a replacement deletes only the previous object', async () => {
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment: existing })])

      await store.setAttachment('vamp-1', { ...existing, storagePath: 'orgs/org-1/vamp-files/vamp-1/u2/new.mp3', fileName: 'new.mp3' })

      expect(deleteObject).toHaveBeenCalledOnce()
      const [ref] = (deleteObject as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect((ref as { path: string }).path).toBe(existing.storagePath)
    })

    it('setAttachment skips deleteObject when there was no previous attachment', async () => {
      const { deleteObject } = await import('firebase/storage')
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment: null })])

      await store.setAttachment('vamp-1', existing)

      expect(deleteObject).not.toHaveBeenCalled()
    })

    it('a failed Storage delete is logged and never rejects the write', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { deleteObject } = await import('firebase/storage')
      ;(deleteObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ attachment: existing })])

      await expect(store.removeAttachment('vamp-1')).resolves.toBeUndefined()

      expect(updateDoc).toHaveBeenCalledOnce()
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  describe('filteredVamps', () => {
    it('returns all vamps when searchQuery is empty', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ id: 'v1', name: 'Open Response', key: 'G' }), makeVamp({ id: 'v2', name: 'Closing', key: 'D' })])
      expect(store.filteredVamps).toHaveLength(2)
    })

    it('filters by name substring, case-insensitive', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ id: 'v1', name: 'Open Response', key: 'G' }), makeVamp({ id: 'v2', name: 'Closing', key: 'D' })])
      store.searchQuery = 'open'
      expect(store.filteredVamps).toHaveLength(1)
      expect(store.filteredVamps[0]!.id).toBe('v1')
    })

    it('filters by key substring, case-insensitive', async () => {
      const { useVampStore } = await import('../vamps')
      const store = useVampStore()
      store.subscribe('org-1')
      triggerSnapshot([makeVamp({ id: 'v1', name: 'Open Response', key: 'G' }), makeVamp({ id: 'v2', name: 'Closing', key: 'D' })])
      store.searchQuery = 'd'
      expect(store.filteredVamps).toHaveLength(1)
      expect(store.filteredVamps[0]!.id).toBe('v2')
    })
  })
})
