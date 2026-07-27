import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

let snapshotCallback:
  | ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void)
  | null = null
const mockUnsubscribe = vi.fn()

vi.mock('firebase/firestore', () => {
  const getDocMock = vi.fn((_ref?: unknown) =>
    Promise.resolve({
      exists: () => false,
      id: 'mock-id',
      data: () => undefined,
    }),
  )
  const updateDocMock = vi.fn((_ref?: unknown, _data?: unknown) => Promise.resolve())

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
    updateDoc: updateDocMock,
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDoc: getDocMock,
    // CR-02: `runTransaction`'s `tx.get`/`tx.update` delegate straight to the
    // SAME `getDoc`/`updateDoc` mock instances returned above, so existing
    // tests that drive `getDoc`'s resolved value via `mockResolvedValueOnce`
    // and assert against `updateDoc`'s recorded calls keep working
    // unmodified for the transaction path too.
    runTransaction: vi.fn(async (_db: unknown, updateFunction: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: (ref: unknown) => getDocMock(ref),
        update: (ref: unknown, data: unknown) => updateDocMock(ref, data),
      }
      return updateFunction(tx)
    }),
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

    it('carries a Phase 22 slot bedAudioUrl onto the single setDoc payload', async () => {
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
      })

      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      const payload = callArgs[1] as Record<string, unknown>
      expect(payload.bedAudioUrl).toBe('https://example.com/bed.mp3')
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

    // CR-01: the other half of the WR-01 race. setGroupBedMedia's own
    // skeleton-create was made a merge write specifically because it races
    // this function; this function's create must be a merge write too, or a
    // concurrently-landing bed-media skeleton's bedAudioUrl is wiped by this
    // function's full-document overwrite.
    it('creates the group with { merge: true } so a racing bed-media skeleton write is not clobbered', async () => {
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
        slides: [{ id: 'gs-1', order: 0, sourceRef: { kind: 'text' } }],
      })

      expect(setDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      expect(callArgs[2]).toEqual({ merge: true })
      const payload = callArgs[1] as Record<string, unknown>
      // Never claims the bed field — a concurrently-landed setGroupBedMedia
      // skeleton's bedAudioUrl survives this merge write precisely because
      // this payload omits the key entirely.
      expect('bedAudioUrl' in payload).toBe(false)
    })

    // CR-01 reverse-order reproduction: setGroupBedMedia's own merging
    // skeleton-create (Phase 24 WR-01) lands FIRST, materializeGroupIfMissing
    // lands SECOND. Both independently saw the document absent before either
    // write landed (two sequential getDoc-absent reads), matching the race
    // window the review describes. Both creates being merge writes is the
    // mechanism that guarantees the first write's bedAudioUrl survives the
    // second: the second payload never carries a bedAudioUrl key at all.
    it('reverse-order race: a setGroupBedMedia skeleton landing before materializeGroupIfMissing is not erased', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => false,
          id: 'slot-1',
          data: () => undefined,
        } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)
        .mockResolvedValueOnce({
          exists: () => false,
          id: 'slot-1',
          data: () => undefined,
        } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      // setGroupBedMedia's skeleton-create lands first.
      await store.setGroupBedMedia('org-1', 'slot-1', {
        serviceId: 'service-1',
        bedAudioUrl: 'https://example.com/bed.mp3',
      })
      // materializeGroupIfMissing lands second, with the group's real derived slides.
      await store.materializeGroupIfMissing('org-1', {
        id: 'slot-1',
        serviceId: 'service-1',
        slotId: 'slot-1',
        slides: [{ id: 'gs-1', order: 0, sourceRef: { kind: 'text' } }],
      })

      expect(setDoc).toHaveBeenCalledTimes(2)
      const firstCall = vi.mocked(setDoc).mock.calls[0]!
      const secondCall = vi.mocked(setDoc).mock.calls[1]!
      // Both writes are merge writes — the mechanism CR-01 relies on.
      expect(firstCall[2]).toEqual({ merge: true })
      expect(secondCall[2]).toEqual({ merge: true })
      // The second (materialize) write's payload never carries a bedAudioUrl
      // key, so Firestore's merge semantics leave the first write's
      // bedAudioUrl field on the live document untouched by this call.
      const secondPayload = secondCall[1] as Record<string, unknown>
      expect('bedAudioUrl' in secondPayload).toBe(false)
      expect((secondPayload.slides as unknown[]).length).toBe(1)
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
      expect(Object.keys(payload).filter((k) => k.toLowerCase().includes('video'))).toEqual([])
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
          bedAudioUrl: 'https://example.com/bed.mp3',
        }),
      ).resolves.toBeUndefined()

      expect(setDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      const payload = callArgs[1] as Record<string, unknown>
      expect(payload.slides).toEqual([])
      expect(payload.bedAudioUrl).toBe('https://example.com/bed.mp3')
      expect(payload.serviceId).toBe('service-1')
    })

    // WR-01: the skeleton-create setDoc must be a merge write, so a
    // concurrently-landing materializeGroupIfMissing write's populated
    // `slides` field is never clobbered back to an empty array.
    it('creates the skeleton document with { merge: true } so a racing materialize write is not clobbered', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        id: 'slot-1',
        data: () => undefined,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.setGroupBedMedia('org-1', 'slot-1', {
        serviceId: 'service-1',
        bedAudioUrl: 'https://example.com/bed.mp3',
      })

      expect(setDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(setDoc).mock.calls[0]!
      expect(callArgs[2]).toEqual({ merge: true })
    })
  })

  describe('dismissReconciliation', () => {
    it('issues a scoped updateDoc against the org/planItem path carrying only dismissedSignature and updatedAt', async () => {
      const { updateDoc, doc: docFn } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.dismissReconciliation('org-1', 'slot-1', 'sig-declined')

      expect(updateDoc).toHaveBeenCalledOnce()
      expect(docFn).toHaveBeenCalledWith(
        expect.anything(),
        'organizations',
        'org-1',
        'slideGroups',
        'slot-1',
      )
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(payload.dismissedSignature).toBe('sig-declined')
      expect(payload.updatedAt).toBeDefined()
      expect(Object.keys(payload).sort()).toEqual(['dismissedSignature', 'updatedAt'])
    })

    it('the payload carries no slides key, no bed key, and no source-signature key', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.dismissReconciliation('org-1', 'slot-1', 'sig-declined')

      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect('slides' in payload).toBe(false)
      expect('bedAudioUrl' in payload).toBe(false)
      expect('sourceSignature' in payload).toBe(false)
    })

    it('does not call the whole-array replace function', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      vi.mocked(updateDoc).mockClear()
      await store.dismissReconciliation('org-1', 'slot-1', 'sig-declined')

      // The replace function always writes a `slides` key; the dismissal
      // write never does, so a payload check doubles as proof the two write
      // paths are distinct and this action never routed through replace.
      expect(vi.mocked(updateDoc).mock.calls).toHaveLength(1)
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect('slides' in payload).toBe(false)
    })

    it('resolves without throwing', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await expect(store.dismissReconciliation('org-1', 'slot-1', 'sig-declined')).resolves.toBeUndefined()
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
      expect(Object.keys(payload).filter((k) => k.toLowerCase().includes('bed'))).toEqual([])
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

    // CR-02: with no `baseSlides` argument, behavior is byte-identical to the
    // pre-fix plain overwrite — no transaction is used at all. This is the
    // legacy fast path any not-yet-updated caller keeps getting.
    it('with no baseSlides, uses a plain updateDoc and never opens a transaction', async () => {
      const { updateDoc, runTransaction } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      await store.replaceGroupSlides(
        'org-1',
        'slot-1',
        [{ id: 'e1', order: 0, sourceRef: { kind: 'text' } }],
        'sig-1',
      )

      expect(updateDoc).toHaveBeenCalledOnce()
      expect(runTransaction).not.toHaveBeenCalled()
    })

    it('with baseSlides and no concurrent change, writes the caller\'s slides unmodified via a transaction', async () => {
      const { getDoc, updateDoc, runTransaction } = await import('firebase/firestore')
      const base = [{ id: 'e1', order: 0, sourceRef: { kind: 'text' as const } }]
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'slot-1',
        data: () => ({ slides: base }),
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      const next = [...base, { id: 'e2', order: 1, sourceRef: { kind: 'text' as const } }]
      await store.replaceGroupSlides('org-1', 'slot-1', next, 'sig-2', base)

      expect(runTransaction).toHaveBeenCalledOnce()
      expect(updateDoc).toHaveBeenCalledOnce()
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect((payload.slides as { id: string }[]).map((e) => e.id)).toEqual(['e1', 'e2'])
      expect(payload.sourceSignature).toBe('sig-2')
    })

    // CR-02 regression (WR-02's required coverage): two callers read the SAME
    // stale `base` before either write lands — mirrors a fast double-click on
    // "+ Add slide", or two independent append call sites (add-slide,
    // import, video-append) overlapping. The "other" caller's write commits
    // first (so the live document now carries its new entry); this caller's
    // own write, computed from the same stale base, must not erase it.
    it('a concurrently-added entry (live but unknown to this caller) survives instead of being overwritten', async () => {
      const { getDoc, updateDoc } = await import('firebase/firestore')
      const base = [{ id: 'e1', order: 0, sourceRef: { kind: 'text' as const } }]
      const liveAfterOtherCallersWrite = [
        ...base,
        { id: 'e-from-other-caller', order: 1, sourceRef: { kind: 'text' as const } },
      ]
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'slot-1',
        data: () => ({ slides: liveAfterOtherCallersWrite }),
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      // This caller's own append, computed from the SAME stale `base` — it
      // never saw the other caller's entry.
      const thisCallersNext = [...base, { id: 'e-from-this-caller', order: 1, sourceRef: { kind: 'text' as const } }]
      await store.replaceGroupSlides('org-1', 'slot-1', thisCallersNext, undefined, base)

      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const ids = (payload.slides as { id: string }[]).map((e) => e.id)
      expect(ids).toContain('e-from-other-caller')
      expect(ids).toContain('e-from-this-caller')
      expect(ids).toContain('e1')
      expect(ids).toHaveLength(3)
    })

    // CR-02 regression: the append-vs-reorder case named explicitly in the
    // review. A drag-reorder computes its full-array overwrite entirely from
    // `base` (what props.group.slides held at drag-end) with no knowledge of
    // an entry appended elsewhere between that read and this write landing.
    it("a drag-reorder's full-array overwrite still recovers a concurrently-appended entry it never knew about", async () => {
      const { getDoc, updateDoc } = await import('firebase/firestore')
      const base = [
        { id: 'e1', order: 0, sourceRef: { kind: 'text' as const } },
        { id: 'e2', order: 1, sourceRef: { kind: 'text' as const } },
      ]
      const liveWithConcurrentAppend = [
        ...base,
        { id: 'e3-appended-elsewhere', order: 2, sourceRef: { kind: 'text' as const } },
      ]
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'slot-1',
        data: () => ({ slides: liveWithConcurrentAppend }),
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()

      // Reorder swaps e1/e2 — computed entirely from `base`.
      const reordered = [
        { id: 'e2', order: 0, sourceRef: { kind: 'text' as const } },
        { id: 'e1', order: 1, sourceRef: { kind: 'text' as const } },
      ]
      await store.replaceGroupSlides('org-1', 'slot-1', reordered, undefined, base)

      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const ids = (payload.slides as { id: string }[]).map((e) => e.id)
      expect(ids).toEqual(['e2', 'e1', 'e3-appended-elsewhere'])
    })

    // Task 3 (26-01): pins the exact write shape every Edit Slide drawer
    // field-write uses (label, notes, audio, loop, duplicate, delete) --
    // a read-modify-write that changes ONE field on ONE entry, leaving the
    // rest of the array identical. Distinct from the append/reorder shapes
    // covered above. This describe block's name is the validation strategy's
    // compare-and-swap filter target (26-VALIDATION.md CAS row).
    describe('compare-and-swap — single-field slide edit (drawer write shape)', () => {
      it('an uncontended single-field edit with a current base snapshot persists exactly the caller\'s array', async () => {
        const { getDoc, updateDoc } = await import('firebase/firestore')
        const base = [
          { id: 'e1', order: 0, sourceRef: { kind: 'text' as const }, label: 'Old label' },
          { id: 'e2', order: 1, sourceRef: { kind: 'text' as const } },
        ]
        // Live document is unchanged from base -- the uncontended case.
        vi.mocked(getDoc).mockResolvedValueOnce({
          exists: () => true,
          id: 'slot-1',
          data: () => ({ slides: base }),
        } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

        const { useSlideGroups } = await import('../slideGroups')
        const store = useSlideGroups()

        // Edit ONE field on ONE entry; everything else stays identical.
        const edited = [{ ...base[0]!, label: 'New label' }, base[1]!]
        await store.replaceGroupSlides('org-1', 'slot-1', edited, undefined, base)

        const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
        expect(payload.slides).toEqual(edited)
      })

      it('a single-field edit with a concurrently-added entry persists the edit PLUS that entry, id intact and ordered last', async () => {
        const { getDoc, updateDoc } = await import('firebase/firestore')
        const base = [
          { id: 'e1', order: 0, sourceRef: { kind: 'text' as const }, label: 'Old label' },
          { id: 'e2', order: 1, sourceRef: { kind: 'text' as const } },
        ]
        // Another writer concurrently appended e3 -- absent from base AND
        // from this caller's own computed payload.
        const liveWithConcurrentAppend = [
          ...base,
          { id: 'e3-appended-elsewhere', order: 2, sourceRef: { kind: 'text' as const } },
        ]
        vi.mocked(getDoc).mockResolvedValueOnce({
          exists: () => true,
          id: 'slot-1',
          data: () => ({ slides: liveWithConcurrentAppend }),
        } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

        const { useSlideGroups } = await import('../slideGroups')
        const store = useSlideGroups()

        const edited = [{ ...base[0]!, label: 'New label' }, base[1]!]
        await store.replaceGroupSlides('org-1', 'slot-1', edited, undefined, base)

        const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
        const slides = payload.slides as { id: string; order: number; label?: string }[]
        expect(slides.map((e) => e.id)).toEqual(['e1', 'e2', 'e3-appended-elsewhere'])
        expect(slides.find((e) => e.id === 'e1')?.label).toBe('New label')
        // The recovered entry keeps its own id and is ordered after the
        // caller's own entries.
        expect(slides[slides.length - 1]!.id).toBe('e3-appended-elsewhere')
        expect(slides[slides.length - 1]!.order).toBeGreaterThan(slides[0]!.order)
        expect(slides[slides.length - 1]!.order).toBeGreaterThan(slides[1]!.order)
      })

      // Negative control: the exact same contended situation, but with NO
      // base snapshot passed -- this is the behaviour every drawer write must
      // avoid by always passing a FRESH base, never a captured-at-open one
      // (research Pitfall 2). Stated explicitly here so the reason is pinned
      // in the suite, not only in prose.
      it('the SAME contended situation with NO base snapshot falls back to a plain overwrite and DISCARDS the concurrently-added entry', async () => {
        const { updateDoc, getDoc } = await import('firebase/firestore')
        const base = [
          { id: 'e1', order: 0, sourceRef: { kind: 'text' as const }, label: 'Old label' },
          { id: 'e2', order: 1, sourceRef: { kind: 'text' as const } },
        ]

        const { useSlideGroups } = await import('../slideGroups')
        const store = useSlideGroups()

        const edited = [{ ...base[0]!, label: 'New label' }, base[1]!]
        // No baseSlides argument -- omitting it is the mistake this test pins.
        await store.replaceGroupSlides('org-1', 'slot-1', edited, undefined)

        // No CAS path was even entered -- getDoc (used by the transaction
        // read) is never called on the no-baseSlides fast path.
        expect(getDoc).not.toHaveBeenCalled()
        const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
        const ids = (payload.slides as { id: string }[]).map((e) => e.id)
        expect(ids).toEqual(['e1', 'e2'])
        expect(ids).not.toContain('e3-appended-elsewhere')
      })
    })
  })
})
