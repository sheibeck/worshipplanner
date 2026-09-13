import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { VampAttachment } from '@/types/vamp'

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
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
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
  })

  describe('updateVamp', () => {
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
