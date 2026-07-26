import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, computed, nextTick, effectScope, type EffectScope } from 'vue'
import { useSlideshowAssembly as useSlideshowAssemblyImpl } from '@/composables/useSlideshowAssembly'
import type { Service, ServiceSlot, HymnSlot, SongSlot, ScriptureSlot } from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { Song } from '@/types/song'
import type { ImportedDeck } from '@/types/importedDeck'
import type { SlideGroup } from '@/types/slideGroup'

// --- Stubbed scriptureSlides store (D001/D005 pattern used by ScriptureSlideEditor.test.ts) ---
const mockSubscribeReadings = vi.fn()
const scriptureState = reactive<{ readings: ScriptureReading[] }>({ readings: [] })

vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () =>
    reactive({
      readings: scriptureState.readings,
      isLoading: false,
      currentReading: computed(() => null),
      subscribeReadings: mockSubscribeReadings,
      unsubscribeReadings: vi.fn(),
      createReading: vi.fn(),
      updateReading: vi.fn(),
      getReading: vi.fn(),
    }),
}))

// --- Stubbed importedSlides store (Phase 21, mirrors the scriptureSlides stub above) ---
const mockSubscribeDecks = vi.fn()
const importedState = reactive<{ decks: ImportedDeck[] }>({ decks: [] })

vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () =>
    reactive({
      decks: importedState.decks,
      isLoading: false,
      subscribeDecks: mockSubscribeDecks,
      unsubscribeDecks: vi.fn(),
      createDeck: vi.fn(),
      updateDeck: vi.fn(),
      getDeck: vi.fn(),
    }),
}))

// --- Stubbed songs store — composable only reads `.songs` ---
const songsState = reactive<{ songs: Song[] }>({ songs: [] })

vi.mock('@/stores/songs', () => ({
  useSongStore: () =>
    reactive({
      songs: songsState.songs,
      isLoading: false,
      orgId: 'org-1',
    }),
}))

// --- Stubbed slideGroups store (24-02/24-04, wired live in 24-05) ---
// Real reactive state so subscribeGroups/materializeGroupIfMissing/
// replaceGroupSlides call-tracking and groupsBySlotId derivation all behave
// like the real Pinia store, without ever installing a real Pinia instance
// (this file's other stores follow the same convention).
const mockSubscribeGroups = vi.fn()
const mockUnsubscribeGroups = vi.fn()
const slideGroupsState = reactive<{ groups: SlideGroup[] }>({ groups: [] })
// materializeGroupIfMissing's mock pushes the created group into
// slideGroupsState.groups — mirroring the real store's onSnapshot round-trip
// after a real Firestore write lands, so a materialized slot stops appearing
// as a "missing group" candidate on the next reactive recompute (exactly the
// condition the reorder-issues-zero-writes tests below depend on).
const mockMaterializeGroupIfMissing = vi.fn(async (_orgId: string, input: SlideGroup) => {
  slideGroupsState.groups.push({ ...input, createdAt: {} as never, updatedAt: {} as never })
  return true
})
const mockDeleteGroup = vi.fn()
const mockSetGroupBedMedia = vi.fn()
const mockReplaceGroupSlides = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () =>
    reactive({
      groups: slideGroupsState.groups,
      isLoading: false,
      groupsBySlotId: computed(() => {
        const map = new Map<string, SlideGroup>()
        for (const group of slideGroupsState.groups) map.set(group.slotId, group)
        return map
      }),
      subscribeGroups: mockSubscribeGroups,
      unsubscribeGroups: mockUnsubscribeGroups,
      materializeGroupIfMissing: mockMaterializeGroupIfMissing,
      deleteGroup: mockDeleteGroup,
      setGroupBedMedia: mockSetGroupBedMedia,
      replaceGroupSlides: mockReplaceGroupSlides,
    }),
}))

// Every call site below invokes the composable directly (not through a
// mounted component), so `onUnmounted(cleanup)` inside it never actually
// registers (Vue warns "no active component instance") and its internal
// `watch()`es would otherwise keep running for the rest of the test file,
// recomputing against the module-level mock state (`slideGroupsState`,
// `scriptureState`, `importedState`) that later tests' `beforeEach` mutates.
// Task 2's materialization writes are the first thing in this suite whose
// re-triggering is actually OBSERVABLE (a call count), so that latent leak
// needs fixing here: wrap every invocation in its own `effectScope`, whose
// `.stop()` disposes every `watch`/`computed` created inside — independent
// of `onUnmounted` — and tear every scope down after each test.
const activeScopes: EffectScope[] = []

function useSlideshowAssembly(
  ...args: Parameters<typeof useSlideshowAssemblyImpl>
): ReturnType<typeof useSlideshowAssemblyImpl> {
  const scope = effectScope()
  let result!: ReturnType<typeof useSlideshowAssemblyImpl>
  scope.run(() => {
    result = useSlideshowAssemblyImpl(...args)
  })
  activeScopes.push(scope)
  return result
}

afterEach(() => {
  activeScopes.splice(0).forEach((scope) => scope.stop())
})

function makeService(slots: ServiceSlot[]): Service {
  return {
    id: 'service-1',
    date: '2026-01-04',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots,
    sermonPassage: null,
    notes: '',
    createdAt: {} as never,
    updatedAt: {} as never,
  }
}

function hymnSlot(overrides: Partial<HymnSlot>): HymnSlot {
  return {
    kind: 'HYMN',
    id: 'slot-hymn-0',
    position: 0,
    hymnName: 'Untitled',
    hymnNumber: '',
    verses: '',
    ...overrides,
  }
}

function songSlot(overrides: Partial<SongSlot>): SongSlot {
  return {
    kind: 'SONG',
    id: 'slot-song-0',
    position: 0,
    requiredVwType: 1,
    songId: null,
    songTitle: null,
    songKey: null,
    ...overrides,
  }
}

function scriptureSlot(overrides: Partial<ScriptureSlot>): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-0',
    position: 0,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    ...overrides,
  }
}

function makeLyrics(songId: string): SongLyrics {
  return {
    id: `lyrics-${songId}`,
    songId,
    sections: [{ id: 'v1', label: 'Verse 1', lines: [`${songId} line 1`] }],
    copyright: {
      title: `${songId} Title`,
      authors: ['Author'],
      ccliSongNumber: '123',
      copyrightLines: ['(c) 2026'],
      ccliLicenseNumber: 'LIC-1',
    },
    performanceOrder: ['v1'],
    createdAt: {} as never,
    updatedAt: {} as never,
  }
}

describe('useSlideshowAssembly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scriptureState.readings = []
    importedState.decks = []
    songsState.songs = []
    slideGroupsState.groups = []
  })

  it('reorders assembledSlideshow when service slots are reordered (R006)', async () => {
    const service = ref<Service | null>(
      makeService([
        hymnSlot({ position: 0, hymnName: 'Amazing Grace' }),
        hymnSlot({ position: 1, hymnName: 'How Great Thou Art' }),
      ]),
    )

    const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1')
    await nextTick()

    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ body: 'Amazing Grace' })
    expect(assembledSlideshow.value[1]!.slide).toMatchObject({ body: 'How Great Thou Art' })

    // Reorder: swap positions with no manual re-sync call.
    service.value = makeService([
      hymnSlot({ position: 1, hymnName: 'Amazing Grace' }),
      hymnSlot({ position: 0, hymnName: 'How Great Thou Art' }),
    ])
    await nextTick()

    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ body: 'How Great Thou Art' })
    expect(assembledSlideshow.value[1]!.slide).toMatchObject({ body: 'Amazing Grace' })
  })

  it('adds and removes slides when slots are added/removed', async () => {
    const service = ref<Service | null>(
      makeService([hymnSlot({ position: 0, hymnName: 'Hymn One' })]),
    )

    const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1')
    await nextTick()
    expect(assembledSlideshow.value).toHaveLength(1)

    // Add a slot
    service.value = makeService([
      hymnSlot({ position: 0, hymnName: 'Hymn One' }),
      hymnSlot({ position: 1, hymnName: 'Hymn Two' }),
    ])
    await nextTick()
    expect(assembledSlideshow.value).toHaveLength(2)

    // Remove a slot
    service.value = makeService([hymnSlot({ position: 0, hymnName: 'Hymn Two' })])
    await nextTick()
    expect(assembledSlideshow.value).toHaveLength(1)
    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ body: 'Hymn Two' })
  })

  it('gathers current lyrics for EVERY distinct song in the service, not just one', async () => {
    songsState.songs = [
      { id: 'song-a', performanceOrder: ['v1'] } as Song,
      { id: 'song-b', performanceOrder: ['v1'] } as Song,
    ]

    const fakeLyricsLoader = vi.fn(async (_orgId: string, songId: string) => makeLyrics(songId))

    const service = ref<Service | null>(
      makeService([
        songSlot({ position: 0, songId: 'song-a' }),
        songSlot({ position: 1, songId: 'song-b' }),
      ]),
    )

    const { assembledSlideshow, isLoading } = useSlideshowAssembly(service, 'org-1', {
      lyricsLoader: fakeLyricsLoader,
    })

    // Flush the async lyrics-loading watcher.
    await nextTick()
    await nextTick()
    await vi.waitFor(() => expect(isLoading.value).toBe(false))

    expect(fakeLyricsLoader).toHaveBeenCalledWith('org-1', 'song-a')
    expect(fakeLyricsLoader).toHaveBeenCalledWith('org-1', 'song-b')
    expect(fakeLyricsLoader).toHaveBeenCalledTimes(2)

    // Each song contributes leading copyright + 1 lyric slide + trailing copyright = 3 slides.
    expect(assembledSlideshow.value).toHaveLength(6)
    const songATitles = assembledSlideshow.value
      .filter((s) => s.sourceId === 'song-a')
      .map((s) => (s.slide as { title?: string }).title)
    const songBTitles = assembledSlideshow.value
      .filter((s) => s.sourceId === 'song-b')
      .map((s) => (s.slide as { title?: string }).title)
    expect(songATitles).toContain('song-a Title')
    expect(songBTitles).toContain('song-b Title')

    // A song with no lyrics doc is simply absent — does not fetch again for a
    // songId already present in songLyricsById.
    fakeLyricsLoader.mockClear()
    service.value = makeService([
      songSlot({ position: 0, songId: 'song-a' }),
      songSlot({ position: 1, songId: 'song-b' }),
    ])
    await nextTick()
    expect(fakeLyricsLoader).not.toHaveBeenCalled()
  })

  it('derives scriptureReadingsById from the scriptureSlides store and subscribes once per org', async () => {
    scriptureState.readings = [
      {
        id: 'reading-1',
        reference: { book: 'John', chapter: 3 },
        displayReference: 'John 3',
        rawText: 'text',
        readingMode: 'normal',
        slides: [
          {
            id: 'orig-id',
            position: 0,
            contentKind: 'scripture',
            reference: 'John 3:16',
            bookRef: { book: 'John', chapter: 3 },
            text: 'For God so loved the world...',
            verseRange: '16',
            readingMode: 'normal',
          },
        ],
        createdAt: {} as never,
        updatedAt: {} as never,
      },
    ]

    const service = ref<Service | null>(
      makeService([scriptureSlot({ position: 0, scriptureReadingId: 'reading-1' })]),
    )

    const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1')
    await nextTick()

    expect(mockSubscribeReadings).toHaveBeenCalledTimes(1)
    expect(mockSubscribeReadings).toHaveBeenCalledWith('org-1')
    expect(mockSubscribeDecks).toHaveBeenCalledTimes(1)
    expect(mockSubscribeDecks).toHaveBeenCalledWith('org-1')
    expect(assembledSlideshow.value).toHaveLength(1)
    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ text: 'For God so loved the world...' })

    // Re-render with the same orgId must not re-subscribe (T-20-03-DoS guard).
    service.value = makeService([scriptureSlot({ position: 0, scriptureReadingId: 'reading-1' })])
    await nextTick()
    expect(mockSubscribeReadings).toHaveBeenCalledTimes(1)
    expect(mockSubscribeDecks).toHaveBeenCalledTimes(1)
  })

  it('derives importedDecksById from the importedSlides store and expands an IMPORTED slot', async () => {
    importedState.decks = [
      {
        id: 'deck-1',
        sourceFileName: 'announcements.pptx',
        section: 'pre-service',
        slides: [
          { id: 'orig-id', position: 0, contentKind: 'text', title: 'Welcome', body: 'Welcome everyone' },
        ],
        createdAt: {} as never,
        updatedAt: {} as never,
      },
    ]

    const service = ref<Service | null>(
      makeService([{ kind: 'IMPORTED', id: 'slot-imported-0', position: 0, importId: 'deck-1', section: 'pre-service' }]),
    )

    const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1')
    await nextTick()

    expect(assembledSlideshow.value).toHaveLength(1)
    expect(assembledSlideshow.value[0]!.slotKind).toBe('IMPORTED')
    expect(assembledSlideshow.value[0]!.sourceId).toBe('deck-1')
    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ body: 'Welcome everyone' })
  })

  it('assembledSections groups slides by section in SERVICE_SECTIONS order, plus an undefined-section group', async () => {
    const service = ref<Service | null>(
      makeService([
        hymnSlot({ position: 0, hymnName: 'Sending Hymn', section: 'sending' }),
        hymnSlot({ position: 1, hymnName: 'Worship Hymn', section: 'worship' }),
        hymnSlot({ position: 2, hymnName: 'Legacy Hymn' }), // no section — legacy
        hymnSlot({ position: 3, hymnName: 'Message Hymn', section: 'message' }),
      ]),
    )

    const { assembledSections } = useSlideshowAssembly(service, 'org-1')
    await nextTick()

    // SERVICE_SECTIONS order: pre-service, worship, message, sending — plus a
    // trailing undefined-section group for legacy (section-less) slides.
    expect(assembledSections.value.map((g) => g.section)).toEqual([
      'worship',
      'message',
      'sending',
      undefined,
    ])
    expect(assembledSections.value.map((g) => g.label)).toEqual([
      'Worship',
      'Message',
      'Sending',
      'Ungrouped',
    ])
    expect(assembledSections.value.find((g) => g.section === 'worship')!.slides).toHaveLength(1)
    expect(assembledSections.value.find((g) => g.section === undefined)!.slides).toHaveLength(1)
    expect(assembledSections.value.find((g) => g.section === undefined)!.slides[0]!.slide).toMatchObject({
      body: 'Legacy Hymn',
    })
  })

  it('returns an empty assembledSlideshow when the service is null', async () => {
    const service = ref<Service | null>(null)
    const { assembledSlideshow, assembledSections } = useSlideshowAssembly(service, 'org-1')
    await nextTick()
    expect(assembledSlideshow.value).toEqual([])
    expect(assembledSections.value).toEqual([])
  })

  // --- Task 1: slideGroups subscription rides the existing org watcher ---
  describe('slideGroups subscription (Task 1)', () => {
    it('calls subscribeGroups exactly once alongside scripture/imported on first org id resolution', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0 })]))
      useSlideshowAssembly(service, 'org-1')
      await nextTick()

      expect(mockSubscribeGroups).toHaveBeenCalledTimes(1)
      expect(mockSubscribeGroups).toHaveBeenCalledWith('org-1')
    })

    it('does not re-subscribe slideGroups for a repeated identical org id', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0 })]))
      useSlideshowAssembly(service, 'org-1')
      await nextTick()
      expect(mockSubscribeGroups).toHaveBeenCalledTimes(1)

      service.value = makeService([hymnSlot({ position: 0, hymnName: 'Renamed' })])
      await nextTick()
      expect(mockSubscribeGroups).toHaveBeenCalledTimes(1)
    })

    it('exposes groupsBySlotId re-derived from the store', async () => {
      slideGroupsState.groups = [
        {
          id: 'slot-hymn-0',
          slotId: 'slot-hymn-0',
          serviceId: 'service-1',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-0' })]))
      const { groupsBySlotId } = useSlideshowAssembly(service, 'org-1')
      await nextTick()

      expect(groupsBySlotId.value.has('slot-hymn-0')).toBe(true)
    })
  })

  // --- Task 2: lazy materialization + D-05 media migration, zero writes on reorder ---
  describe('lazy materialization (Task 2)', () => {
    it('materializes one group per slot with a resolving source when canWrite is true', async () => {
      const service = ref<Service | null>(
        makeService([
          hymnSlot({ position: 0, id: 'slot-hymn-a', hymnName: 'Hymn A' }),
          hymnSlot({ position: 1, id: 'slot-hymn-b', hymnName: 'Hymn B' }),
        ]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(2)
      const slotIds = mockMaterializeGroupIfMissing.mock.calls.map((call) => (call[1] as SlideGroup).slotId).sort()
      expect(slotIds).toEqual(['slot-hymn-a', 'slot-hymn-b'])
    })

    it('canWrite defaulting to false (option omitted) issues zero materialization calls', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0 })]))
      useSlideshowAssembly(service, 'org-1')
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })

    it('canWrite explicitly false issues zero materialization calls', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0 })]))
      useSlideshowAssembly(service, 'org-1', { canWrite: false })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })

    it('a slot that already has a materialized group triggers no call', async () => {
      slideGroupsState.groups = [
        {
          id: 'slot-hymn-a',
          slotId: 'slot-hymn-a',
          serviceId: 'service-1',
          slides: [{ id: 'existing', order: 0, sourceRef: { kind: 'text' } }],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-a' })]))
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })

    it('a SONG slot with songId null produces no call; assigning a song later produces exactly one call carrying bedAudioUrl', async () => {
      const fakeLyricsLoader = vi.fn(async (_orgId: string, songId: string) => makeLyrics(songId))
      songsState.songs = [{ id: 'song-a', performanceOrder: ['v1'] } as Song]
      const service = ref<Service | null>(
        makeService([
          songSlot({ position: 0, id: 'slot-song-a', songId: null, audioUrl: 'https://cdn/bed.mp3' }),
        ]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()

      service.value = makeService([
        songSlot({ position: 0, id: 'slot-song-a', songId: 'song-a', audioUrl: 'https://cdn/bed.mp3' }),
      ])
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
      const [, input] = mockMaterializeGroupIfMissing.mock.calls[0]!
      expect((input as SlideGroup).slotId).toBe('slot-song-a')
      expect((input as SlideGroup).bedAudioUrl).toBe('https://cdn/bed.mp3')
    })

    it('reordering slots after materialization settles issues zero further materialization calls', async () => {
      const service = ref<Service | null>(
        makeService([
          hymnSlot({ position: 0, id: 'slot-hymn-a', hymnName: 'Hymn A' }),
          hymnSlot({ position: 1, id: 'slot-hymn-b', hymnName: 'Hymn B' }),
        ]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(2)

      mockMaterializeGroupIfMissing.mockClear()
      service.value = makeService([
        hymnSlot({ position: 1, id: 'slot-hymn-a', hymnName: 'Hymn A' }),
        hymnSlot({ position: 0, id: 'slot-hymn-b', hymnName: 'Hymn B' }),
      ])
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })

    it('the same song assigned to two different slots produces two calls with two distinct slotId values', async () => {
      songsState.songs = [{ id: 'song-a', performanceOrder: ['v1'] } as Song]
      const fakeLyricsLoader = vi.fn(async () => makeLyrics('song-a'))
      const service = ref<Service | null>(
        makeService([
          songSlot({ position: 0, id: 'slot-song-a', songId: 'song-a' }),
          songSlot({ position: 1, id: 'slot-song-b', songId: 'song-a' }),
        ]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(2)
      const slotIds = mockMaterializeGroupIfMissing.mock.calls.map((call) => (call[1] as SlideGroup).slotId).sort()
      expect(slotIds).toEqual(['slot-song-a', 'slot-song-b'])
    })

    it('a service with zero slots triggers zero materialization calls', async () => {
      const service = ref<Service | null>(makeService([]))
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })
  })
})
