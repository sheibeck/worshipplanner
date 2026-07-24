import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, reactive, computed, nextTick } from 'vue'
import { useSlideshowAssembly } from '@/composables/useSlideshowAssembly'
import type { Service, ServiceSlot, HymnSlot, SongSlot, ScriptureSlot } from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { Song } from '@/types/song'

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
    songsState.songs = []
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
    expect(assembledSlideshow.value).toHaveLength(1)
    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ text: 'For God so loved the world...' })

    // Re-render with the same orgId must not re-subscribe (T-20-03-DoS guard).
    service.value = makeService([scriptureSlot({ position: 0, scriptureReadingId: 'reading-1' })])
    await nextTick()
    expect(mockSubscribeReadings).toHaveBeenCalledTimes(1)
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
})
