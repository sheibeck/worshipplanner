import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((_query: unknown, callback: (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) => {
      snapshotCallback = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-reading-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        id: 'reading-1',
        data: () => ({
          reference: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
          displayReference: 'John 3:16-17',
          rawText: 'For God so loved the world...',
          readingMode: 'normal',
          slides: [],
          createdAt: { seconds: 1000000, nanoseconds: 0 },
          updatedAt: { seconds: 1000000, nanoseconds: 0 },
        }),
      }),
    ),
    query: vi.fn((ref: unknown) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

function makeReadingDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reading-1',
    reference: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
    displayReference: 'John 3:16-17',
    rawText: 'For God so loved the world...',
    readingMode: 'normal' as const,
    slides: [],
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerSnapshot(docs: ReturnType<typeof makeReadingDoc>[]) {
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

describe('useScriptureSlides', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
  })

  describe('initial state', () => {
    it('starts with empty readings array', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      expect(store.readings).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      expect(store.isLoading).toBe(true)
    })

    it('currentReading is null initially', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      expect(store.currentReading).toBeNull()
    })
  })

  describe('subscribeReadings', () => {
    it('calls onSnapshot on the scriptureReadings collection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('populates readings from snapshot with { id, ...data } mapping', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      triggerSnapshot([makeReadingDoc()])
      expect(store.readings).toHaveLength(1)
      expect(store.readings[0]!.id).toBe('reading-1')
      expect(store.readings[0]!.displayReference).toBe('John 3:16-17')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('calling subscribeReadings again unsubscribes previous listener first', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      store.subscribeReadings('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })
  })

  describe('currentReading', () => {
    it('returns the first (most recent) reading', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      triggerSnapshot([
        makeReadingDoc({ id: 'reading-newest', updatedAt: { seconds: 3000000, nanoseconds: 0 } }),
        makeReadingDoc({ id: 'reading-oldest', updatedAt: { seconds: 1000000, nanoseconds: 0 } }),
      ])
      expect(store.currentReading!.id).toBe('reading-newest')
    })

    it('returns null when no readings exist', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      triggerSnapshot([])
      expect(store.currentReading).toBeNull()
    })
  })

  describe('createReading', () => {
    it('calls addDoc with correct path and serverTimestamp', async () => {
      const { addDoc, collection: collFn, serverTimestamp } = await import('firebase/firestore')
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()

      const id = await store.createReading('org-1', {
        reference: { book: 'Psalm', chapter: 23, verseStart: 1 },
        displayReference: 'Psalm 23:1',
        rawText: 'The Lord is my shepherd...',
        readingMode: 'normal',
        slides: [],
      })

      expect(id).toBe('new-reading-id')
      expect(addDoc).toHaveBeenCalledOnce()
      expect(collFn).toHaveBeenCalledWith(expect.anything(), 'organizations', 'org-1', 'scriptureReadings')
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.displayReference).toBe('Psalm 23:1')
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('updateReading', () => {
    it('calls updateDoc with correct path and serverTimestamp for updatedAt', async () => {
      const { updateDoc, doc: docFn, serverTimestamp } = await import('firebase/firestore')
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()

      await store.updateReading('org-1', 'reading-1', {
        rawText: 'Updated text',
        readingMode: 'congregational',
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      expect(docFn).toHaveBeenCalledWith(expect.anything(), 'organizations', 'org-1', 'scriptureReadings', 'reading-1')
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.rawText).toBe('Updated text')
      expect(data.readingMode).toBe('congregational')
      expect(data.updatedAt).toBeDefined()
      expect(data.createdAt).toBeUndefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('getReading', () => {
    it('returns reading data when doc exists', async () => {
      const { getDoc, doc: docFn } = await import('firebase/firestore')
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()

      const reading = await store.getReading('org-1', 'reading-1')

      expect(getDoc).toHaveBeenCalledOnce()
      expect(docFn).toHaveBeenCalledWith(expect.anything(), 'organizations', 'org-1', 'scriptureReadings', 'reading-1')
      expect(reading).not.toBeNull()
      expect(reading!.id).toBe('reading-1')
      expect(reading!.displayReference).toBe('John 3:16-17')
    })

    it('returns null when doc does not exist', async () => {
      const { getDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'nonexistent',
        data: () => null,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()

      const reading = await store.getReading('org-1', 'nonexistent')
      expect(reading).toBeNull()
    })
  })

  describe('unsubscribeReadings', () => {
    it('calls the unsubscribe fn and resets state', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      store.subscribeReadings('org-1')
      triggerSnapshot([makeReadingDoc()])
      expect(store.readings).toHaveLength(1)

      store.unsubscribeReadings()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.readings).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('is safe to call when no subscription is active', async () => {
      const { useScriptureSlides } = await import('../scriptureSlides')
      const store = useScriptureSlides()
      expect(() => store.unsubscribeReadings()).not.toThrow()
    })
  })
})
