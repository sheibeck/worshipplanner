import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

let snapshotCallback:
  | ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void)
  | null = null
const mockUnsubscribe = vi.fn()

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      id: segments[segments.length - 1] ?? 'mock-id',
      path: segments.join('/'),
    })),
    onSnapshot: vi.fn(
      (
        _query: unknown,
        callback: (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void,
      ) => {
        snapshotCallback = callback
        return mockUnsubscribe
      },
    ),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => false,
        id: 'mock-id',
        data: () => undefined,
      }),
    ),
    query: vi.fn((ref: unknown) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
    deleteField: vi.fn(() => '__deleteField__'),
  }
})

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

function makeGroupDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slot-1',
    serviceId: 'service-1',
    slotId: 'slot-1',
    slides: [],
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerSnapshot(docs: ReturnType<typeof makeGroupDoc>[]) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: docs.map((d) => ({
        id: d.id,
        data: () => {
          const { id: _id, ...rest } = d
          return rest
        },
      })),
    })
  }
}

describe('useSlideGroups', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
  })

  describe('initial state', () => {
    it('starts with empty groups array', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      expect(store.groups).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      expect(store.isLoading).toBe(true)
    })
  })

  describe('subscribeGroups', () => {
    it('queries the organizations/{orgId}/slideGroups collection', async () => {
      const { collection } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'organizations', 'org-1', 'slideGroups')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('calling subscribeGroups again unsubscribes the previous listener first', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      store.subscribeGroups('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })
  })

  describe('unsubscribeGroups', () => {
    it('calls the unsubscribe fn, empties groups, and resets isLoading to true', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      triggerSnapshot([makeGroupDoc()])
      expect(store.groups).toHaveLength(1)

      store.unsubscribeGroups()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.groups).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('is safe to call when no subscription is active', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      expect(() => store.unsubscribeGroups()).not.toThrow()
    })
  })

  describe('groupsBySlotId', () => {
    it('maps each group slotId to the group', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      triggerSnapshot([
        makeGroupDoc({ id: 'slot-a', slotId: 'slot-a' }),
        makeGroupDoc({ id: 'slot-b', slotId: 'slot-b' }),
      ])
      expect(store.groupsBySlotId.size).toBe(2)
      expect(store.groupsBySlotId.get('slot-a')?.id).toBe('slot-a')
      expect(store.groupsBySlotId.get('slot-b')?.id).toBe('slot-b')
    })
  })

  describe('materializeGroupIfMissing', () => {
    it('performs no write and resolves false when the doc already exists', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'slot-1',
        data: () => makeGroupDoc(),
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      const created = await store.materializeGroupIfMissing('org-1', {
        id: 'slot-1',
        serviceId: 'service-1',
        slotId: 'slot-1',
        slides: [],
      })

      expect(created).toBe(false)
      expect(setDoc).not.toHaveBeenCalled()
    })

    it('calls setDoc exactly once against the slot-id path when absent and resolves true', async () => {
      const { getDoc, setDoc, doc: docFn } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'slot-1',
        data: () => undefined,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      const created = await store.materializeGroupIfMissing('org-1', {
        id: 'slot-1',
        serviceId: 'service-1',
        slotId: 'slot-1',
        slides: [],
      })

      expect(created).toBe(true)
      expect(setDoc).toHaveBeenCalledOnce()
      expect(docFn).toHaveBeenCalledWith(
        expect.anything(),
        'organizations',
        'org-1',
        'slideGroups',
        'slot-1',
      )
    })

    it('two awaited calls in sequence produce exactly one setDoc call (idempotency)', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => false,
          id: 'slot-1',
          data: () => undefined,
        } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'slot-1',
          data: () => makeGroupDoc(),
        } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      const input = { id: 'slot-1', serviceId: 'service-1', slotId: 'slot-1', slides: [] }
      const first = await store.materializeGroupIfMissing('org-1', input)
      const second = await store.materializeGroupIfMissing('org-1', input)

      expect(first).toBe(true)
      expect(second).toBe(false)
      expect(setDoc).toHaveBeenCalledOnce()
    })

    it('carries a Phase 22 slot bedAudioUrl/bedVideoUrl onto the single setDoc payload', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'slot-1',
        data: () => undefined,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.materializeGroupIfMissing('org-1', {
        id: 'slot-1',
        serviceId: 'service-1',
        slotId: 'slot-1',
        slides: [],
        bedAudioUrl: 'https://example.com/bed.mp3',
        bedVideoUrl: 'https://example.com/bed.mp4',
      })

      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      const payload = callArgs[1] as Record<string, unknown>
      expect(payload.bedAudioUrl).toBe('https://example.com/bed.mp3')
      expect(payload.bedVideoUrl).toBe('https://example.com/bed.mp4')
    })

    it('produces no bedAudioUrl key at all when the field is absent (stripUndefined)', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'slot-1',
        data: () => undefined,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.materializeGroupIfMissing('org-1', {
        id: 'slot-1',
        serviceId: 'service-1',
        slotId: 'slot-1',
        slides: [],
      })

      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      const payload = callArgs[1] as Record<string, unknown>
      expect('bedAudioUrl' in payload).toBe(false)
    })
  })

  describe('deleteGroup', () => {
    it('calls deleteDoc against the slot-id path', async () => {
      const { deleteDoc, doc: docFn } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.deleteGroup('org-1', 'slot-1')

      expect(deleteDoc).toHaveBeenCalledOnce()
      expect(docFn).toHaveBeenCalledWith(
        expect.anything(),
        'organizations',
        'org-1',
        'slideGroups',
        'slot-1',
      )
    })

    it('resolves even when the document does not exist (deleteDoc no-op)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      vi.mocked(deleteDoc).mockResolvedValueOnce(undefined)
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await expect(store.deleteGroup('org-1', 'missing-slot')).resolves.toBeUndefined()
    })
  })

  describe('setGroupBedMedia', () => {
    it('issues an updateDoc touching only the bed field(s) and updatedAt against an existing group', async () => {
      const { getDoc, updateDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'slot-1',
        data: () => makeGroupDoc(),
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.setGroupBedMedia('org-1', 'slot-1', {
        serviceId: 'service-1',
        bedAudioUrl: 'https://example.com/bed.mp3',
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const payload = callArgs[1] as unknown as Record<string, unknown>
      expect(payload.bedAudioUrl).toBe('https://example.com/bed.mp3')
      expect(payload.updatedAt).toBeDefined()
      expect('bedVideoUrl' in payload).toBe(false)
      expect('slides' in payload).toBe(false)
    })

    it('passes the deleteField() sentinel (not undefined or null) when clearAudio is true', async () => {
      const { getDoc, updateDoc, deleteField } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'slot-1',
        data: () => makeGroupDoc({ bedAudioUrl: 'https://example.com/old.mp3' }),
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.setGroupBedMedia('org-1', 'slot-1', {
        serviceId: 'service-1',
        clearAudio: true,
      })

      expect(deleteField).toHaveBeenCalled()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const payload = callArgs[1] as unknown as Record<string, unknown>
      expect(payload.bedAudioUrl).toBe('__deleteField__')
      expect(payload.bedAudioUrl).not.toBeUndefined()
      expect(payload.bedAudioUrl).not.toBeNull()
    })

    it('creates a skeleton document with slides: [] when the group does not exist yet', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'slot-1',
        data: () => undefined,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await expect(
        store.setGroupBedMedia('org-1', 'slot-1', {
          serviceId: 'service-1',
          bedVideoUrl: 'https://example.com/bed.mp4',
        }),
      ).resolves.toBeUndefined()

      expect(setDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      const payload = callArgs[1] as Record<string, unknown>
      expect(payload.slides).toEqual([])
      expect(payload.bedVideoUrl).toBe('https://example.com/bed.mp4')
      expect(payload.serviceId).toBe('service-1')
    })
  })

  describe('replaceGroupSlides', () => {
    it('writes slides and sourceSignature together with updatedAt, touching no bed field', async () => {
      const { updateDoc, doc: docFn } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      const slides = [
        {
          id: 'gs-1',
          order: 0,
          sourceRef: { kind: 'lyric' as const, songId: 'song-1', sectionId: 'verse-1' },
        },
      ]

      await store.replaceGroupSlides('org-1', 'slot-1', slides, 'sig-abc')

      expect(updateDoc).toHaveBeenCalledOnce()
      expect(docFn).toHaveBeenCalledWith(
        expect.anything(),
        'organizations',
        'org-1',
        'slideGroups',
        'slot-1',
      )
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const payload = callArgs[1] as unknown as Record<string, unknown>
      expect(payload.slides).toEqual(slides)
      expect(payload.sourceSignature).toBe('sig-abc')
      expect(payload.updatedAt).toBeDefined()
      expect('bedAudioUrl' in payload).toBe(false)
      expect('bedVideoUrl' in payload).toBe(false)
    })

    it('omits sourceSignature key entirely when not provided', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.replaceGroupSlides('org-1', 'slot-1', [])

      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const payload = callArgs[1] as unknown as Record<string, unknown>
      expect('sourceSignature' in payload).toBe(false)
    })
  })
})
