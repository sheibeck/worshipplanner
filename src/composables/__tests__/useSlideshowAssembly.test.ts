import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, computed, nextTick, effectScope, type EffectScope } from 'vue'
import { useSlideshowAssembly as useSlideshowAssemblyImpl } from '@/composables/useSlideshowAssembly'
import { renderedPagePath } from '@/utils/renderedPagePaths'
import type { Service, ServiceSlot, HymnSlot, SongSlot, ScriptureSlot } from '@/types/service'
import type { SongLyrics } from '@/types/songLyrics'
import type { ScriptureReading } from '@/types/scriptureReading'
import type { Song } from '@/types/song'
import type { ImportedDeck } from '@/types/importedDeck'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'

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

// --- Stubbed pptxRenders store (Phase 42, 42-02 Task 3 — Wave 0 scaffolding) ---
//
// Both mocks in this block are INERT right now: nothing in useSlideshowAssembly.ts
// imports either `@/stores/pptxRenders` or `@/utils/pptxUpload` yet (that wiring is a
// later plan in this phase). They exist here so every IMPORTED-with-render test a later
// plan writes can fail only for the right reason, rather than for a missing mock — the
// Phase-41 precedent this task exists to avoid repeating: `services.test.ts`'s
// firestore mock lacked `where`/`getDocs`, discovered late, and it blocked every
// adoption test (42-RESEARCH.md § Wave 0 Gaps).
//
// `rendersByImportId` is a real `reactive(new Map())` a test can write into directly —
// mirroring the hand-rolled reactive-stub style of every other store mock in this file
// — and `syncSubscriptions`/`unsubscribeAll` are `vi.fn()` spies so a later plan can
// assert subscription and teardown wiring by call.
const pptxRendersState = reactive({ rendersByImportId: new Map<string, unknown>() })
const mockSyncPptxRenderSubscriptions = vi.fn()
const mockUnsubscribeAllPptxRenders = vi.fn()

vi.mock('@/stores/pptxRenders', () => ({
  usePptxRenders: () =>
    reactive({
      rendersByImportId: pptxRendersState.rendersByImportId,
      syncSubscriptions: mockSyncPptxRenderSubscriptions,
      unsubscribeAll: mockUnsubscribeAllPptxRenders,
    }),
}))

// --- Stubbed pptxUpload's resolveImageUrl (Phase 42, 42-02 Task 3) ---
//
// `resolveImageUrl` resolves a deterministic fake URL derived from its path argument, so
// a later test can assert WHICH path was resolved, not merely that something was.
// `importActual` preserves every other export (generateImportId, uploadPptx,
// uploadImage, PPTX_MAX_BYTES, PptxFileTooLargeError, isPptxFileTooLarge,
// validatePptxSize) in case a later addition to this suite relies on them.
//
// Component-suite finding recorded per this task's instructions (see SUMMARY):
// `SlideCard.vue` (imageSrc, line 150) and `PresentationViewer.vue` (image branch, line
// 184) both consume an already-resolved `imageUrl` off the assembled slide and neither
// calls Storage — so `SlideCard.test.ts`/`PresentationViewer.test.ts` need NO
// `resolveImageUrl`/`getDownloadURL` mock. URL resolution is this composable's job
// alone.
// `vi.hoisted` (not a bare `const mockXxx = vi.fn(...)`) — Phase 42 finding: this
// mock's factory was INERT (never executed) until this plan wired `resolveImageUrl`
// into `useSlideshowAssembly.ts`'s own import graph. Once it actually runs, the
// factory below is invoked while the module graph resolves — BEFORE this file's own
// top-level `const` statements have executed — so a plain `const mockResolveImageUrl
// = vi.fn(...)` throws "Cannot access 'mockResolveImageUrl' before initialization".
// `vi.hoisted` guarantees the value exists before any `vi.mock` factory can run.
const mockResolveImageUrl = vi.hoisted(() =>
  vi.fn((path: string) => Promise.resolve(`https://fake-storage.test/${path}`)),
)

vi.mock('@/utils/pptxUpload', async (importActual) => {
  const actual = await importActual<typeof import('@/utils/pptxUpload')>()
  return {
    ...actual,
    resolveImageUrl: mockResolveImageUrl,
  }
})

// Every call site below invokes the composable directly (not through a
// mounted component), so a lifecycle hook that only registers against a live
// component instance (`onUnmounted`) would be a silent no-op here (Vue warns
// "no active component instance") and its internal `watch()`es would
// otherwise keep running for the rest of the test file, recomputing against
// the module-level mock state (`slideGroupsState`, `scriptureState`,
// `importedState`) that later tests' `beforeEach` mutates. Task 2's
// materialization writes are the first thing in this suite whose
// re-triggering is actually OBSERVABLE (a call count), so that latent leak
// needed fixing here: wrap every invocation in its own `effectScope`, whose
// `.stop()` disposes every `watch`/`computed` created inside AND triggers the
// composable's own `onScopeDispose(cleanup)` (Phase 42 Task 1 — switched from
// `onUnmounted` for exactly this reason: `onScopeDispose` fires on ANY active
// scope's disposal, component-mounted or manually created, so the render
// listener teardown this phase adds is testable without a full component
// mount). Every scope is torn down after each test below.
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

// R047: the slot's OWN reference is the scripture slide's source, so the
// default fixture carries one, formatting to "John 3:16-18".
function scriptureSlot(overrides: Partial<ScriptureSlot>): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-0',
    position: 0,
    book: 'John',
    chapter: 3,
    verseStart: 16,
    verseEnd: 18,
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
    // Phase 42: the pptxRenders store's map is not a vi.fn() mock, so
    // `vi.clearAllMocks()` above never touches it — reset it explicitly, or a
    // render document set by one test would leak into the next.
    pptxRendersState.rendersByImportId.clear()
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
      { id: 'song-a' } as Song,
      { id: 'song-b' } as Song,
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
    // R047: a scripture slot's derivation is reference-only — text is always
    // empty, and the reference comes from the SLOT's own fields, not from the
    // reading document or any inner slide's text. The readings subscription is
    // still asserted above because Phase 34's congregational reading needs it.
    expect(assembledSlideshow.value[0]!.slide).toMatchObject({ text: '', reference: 'John 3:16-18' })

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

  it('assembledSections places a Post-Service group after Sending and before the trailing Ungrouped group, and still omits sections with no slides (29-05)', async () => {
    const service = ref<Service | null>(
      makeService([
        hymnSlot({ position: 0, hymnName: 'Sending Hymn', section: 'sending' }),
        hymnSlot({ position: 1, hymnName: 'Legacy Hymn' }), // no section — legacy
        hymnSlot({ position: 2, hymnName: 'Post-Service Hymn', section: 'post-service' }),
        hymnSlot({ position: 3, hymnName: 'Message Hymn', section: 'message' }),
        // No 'worship' or 'pre-service' slot — both sections must be omitted entirely,
        // confirming this composable's assembled-*output* omission behavior is
        // unchanged (distinct from the editor's always-visible empty sections, R043).
      ]),
    )

    const { assembledSections } = useSlideshowAssembly(service, 'org-1')
    await nextTick()

    expect(assembledSections.value.map((g) => g.section)).toEqual([
      'message',
      'sending',
      'post-service',
      undefined,
    ])
    expect(assembledSections.value.map((g) => g.label)).toEqual([
      'Message',
      'Sending',
      'Post-Service',
      'Ungrouped',
    ])
    expect(assembledSections.value.find((g) => g.section === 'post-service')!.slides[0]!.slide).toMatchObject({
      body: 'Post-Service Hymn',
    })
    // 'worship'/'pre-service' had zero slides — omitted, not emitted empty.
    expect(assembledSections.value.some((g) => g.section === 'worship')).toBe(false)
    expect(assembledSections.value.some((g) => g.section === 'pre-service')).toBe(false)
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

    // ME-04 (R045 membership): `confirmSlotDelete` awaits `deleteGroup` BEFORE
    // splicing the slot, by design. Firestore applies a delete to its LOCAL
    // cache and raises onSnapshot immediately, while `deleteDoc` resolves only
    // on server ack — so for the length of that ack the slot is still in the
    // service with no group, which is precisely the shape
    // `materializationCandidates` treats as "materialize me". The watcher then
    // re-created the document the cascade had just deleted, and the slot was
    // spliced out afterwards with no second cascade, leaving an orphan group
    // document behind forever.
    /** The local-cache `onSnapshot` a cascade delete raises before its server ack. */
    function dropGroupFromLocalCache(slotId: string): void {
      const index = slideGroupsState.groups.findIndex((g) => g.slotId === slotId)
      if (index >= 0) slideGroupsState.groups.splice(index, 1)
    }

    it('a slot whose delete is in flight is not re-materialized when the local cache drops its group', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-a', hymnName: 'Hymn A' })]))
      const { suppressMaterialization } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
      mockMaterializeGroupIfMissing.mockClear()

      // confirmSlotDelete marks the slot, then awaits deleteGroup. The local
      // cache drops the group immediately; the slot is still in the service.
      const release = suppressMaterialization('slot-hymn-a')
      dropGroupFromLocalCache('slot-hymn-a')
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()

      // Releasing without splicing the slot proves this test is exercising the
      // real window: with no hold, the watcher re-creates the deleted document.
      release()
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
    })

    it('suppression is scoped to the named slot — a neighbour whose group also vanished still materializes', async () => {
      const service = ref<Service | null>(
        makeService([
          hymnSlot({ position: 0, id: 'slot-hymn-a', hymnName: 'Hymn A' }),
          hymnSlot({ position: 1, id: 'slot-hymn-b', hymnName: 'Hymn B' }),
        ]),
      )
      const { suppressMaterialization } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      mockMaterializeGroupIfMissing.mockClear()

      suppressMaterialization('slot-hymn-a')
      dropGroupFromLocalCache('slot-hymn-a')
      dropGroupFromLocalCache('slot-hymn-b')
      await nextTick()
      await nextTick()

      const slotIds = mockMaterializeGroupIfMissing.mock.calls.map((call) => (call[1] as SlideGroup).slotId)
      expect(slotIds).toEqual(['slot-hymn-b'])
    })

    it('the on-demand materializer refuses a slot whose delete is in flight too', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-a', hymnName: 'Hymn A' })]))
      const { suppressMaterialization, ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', {
        canWrite: true,
      })
      await nextTick()
      await nextTick()
      mockMaterializeGroupIfMissing.mockClear()

      suppressMaterialization('slot-hymn-a')
      dropGroupFromLocalCache('slot-hymn-a')
      await nextTick()

      await expect(ensureGroupMaterialized('slot-hymn-a')).resolves.toBeUndefined()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })

    it('a SONG slot with songId null produces no call; assigning a song later produces exactly one call carrying no bed (D-19: no legacy slot-media migration)', async () => {
      const fakeLyricsLoader = vi.fn(async (_orgId: string, songId: string) => makeLyrics(songId))
      songsState.songs = [{ id: 'song-a' } as Song]
      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-a', songId: null })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()

      service.value = makeService([songSlot({ position: 0, id: 'slot-song-a', songId: 'song-a' })])
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
      const [, input] = mockMaterializeGroupIfMissing.mock.calls[0]!
      expect((input as SlideGroup).slotId).toBe('slot-song-a')
      expect('bedAudioUrl' in (input as SlideGroup)).toBe(false)
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
      songsState.songs = [{ id: 'song-a' } as Song]
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

  // --- Phase 30 (R046): rebuild and write unconditionally, no confirm state ---
  describe('unconditional rebuild-and-write (R046 — no confirm state)', () => {
    it('a song group whose source gained a section reconciles automatically, preserving the pre-existing customized entry', async () => {
      songsState.songs = [{ id: 'song-a' } as Song]
      const twoSectionLyrics: SongLyrics = {
        id: 'lyrics-song-a',
        songId: 'song-a',
        sections: [
          { id: 'v1', label: 'Verse 1', lines: ['song-a line 1'] },
          { id: 'v2', label: 'Verse 2', lines: ['song-a line 2'] },
        ],
        copyright: {
          title: 'song-a Title',
          authors: ['Author'],
          ccliSongNumber: '123',
          copyrightLines: ['(c) 2026'],
          ccliLicenseNumber: 'LIC-1',
        },
        performanceOrder: ['v1', 'v2'],
        createdAt: {} as never,
        updatedAt: {} as never,
      }
      const fakeLyricsLoader = vi.fn(async () => twoSectionLyrics)

      slideGroupsState.groups = [
        {
          id: 'slot-song-a',
          slotId: 'slot-song-a',
          serviceId: 'service-1',
          slides: [
            { id: 'cr-1', order: 0, sourceRef: { kind: 'copyright', songId: 'song-a' } },
            {
              id: 'ly-v1',
              order: 1,
              sourceRef: { kind: 'lyric', songId: 'song-a', sectionId: 'v1' },
              label: 'Custom Label',
            },
            { id: 'cr-2', order: 2, sourceRef: { kind: 'copyright', songId: 'song-a' } },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-a', songId: 'song-a' })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [orgIdArg, slotIdArg, slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(orgIdArg).toBe('org-1')
      expect(slotIdArg).toBe('slot-song-a')
      const slides = slidesArg as GroupSlideEntry[]
      const v1Entry = slides.find((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'v1')
      expect(v1Entry?.label).toBe('Custom Label')
      expect(slides.some((e) => e.sourceRef.kind === 'lyric' && e.sourceRef.sectionId === 'v2')).toBe(true)
    })

    // --- CR-01 regression: reassigning a SONG slot's songId is a source-
    // identity swap, not a section-level edit — it must never blend the old
    // song's copyright/lyric entries with the new song's.
    it('an uncustomized group replaces wholesale when slot.songId changes to a different song, with no stale entries from the old song', async () => {
      songsState.songs = [{ id: 'song-a' } as Song, { id: 'song-b' } as Song]
      const fakeLyricsLoader = vi.fn(async (_orgId: string, songId: string) => makeLyrics(songId))

      slideGroupsState.groups = [
        {
          id: 'slot-song-swap',
          slotId: 'slot-song-swap',
          serviceId: 'service-1',
          slides: [
            { id: 'cr-1', order: 0, sourceRef: { kind: 'copyright', songId: 'song-a' } },
            { id: 'ly-v1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-a', sectionId: 'v1' } },
            { id: 'cr-2', order: 2, sourceRef: { kind: 'copyright', songId: 'song-a' } },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      // The slot now points at song-b — the user picked a different song for the same slot.
      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-swap', songId: 'song-b' })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, slotIdArg, slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(slotIdArg).toBe('slot-song-swap')
      const slides = slidesArg as GroupSlideEntry[]
      const songRefEntries = slides.filter(
        (e): e is GroupSlideEntry & { sourceRef: { songId: string } } =>
          e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright',
      )
      expect(songRefEntries.every((e) => e.sourceRef.songId === 'song-b')).toBe(true)
    })

    it('R046: a group with a labeled lyric entry (source-derived) is STILL replaced wholesale, immediately, with a single write and no confirm state anywhere on the return', async () => {
      songsState.songs = [{ id: 'song-a' } as Song, { id: 'song-b' } as Song]
      const fakeLyricsLoader = vi.fn(async (_orgId: string, songId: string) => makeLyrics(songId))

      slideGroupsState.groups = [
        {
          id: 'slot-song-swap-2',
          slotId: 'slot-song-swap-2',
          serviceId: 'service-1',
          slides: [
            { id: 'cr-1', order: 0, sourceRef: { kind: 'copyright', songId: 'song-a' } },
            {
              id: 'ly-v1',
              order: 1,
              sourceRef: { kind: 'lyric', songId: 'song-a', sectionId: 'v1' },
              label: 'Custom Label',
            },
            { id: 'cr-2', order: 2, sourceRef: { kind: 'copyright', songId: 'song-a' } },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-swap-2', songId: 'song-b' })]),
      )
      const returned = useSlideshowAssembly(service, 'org-1', {
        canWrite: true,
        lyricsLoader: fakeLyricsLoader,
      })
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      expect(mockReplaceGroupSlides.mock.calls[0]![1]).toBe('slot-song-swap-2')
      expect('pendingReconciliations' in returned).toBe(false)
    })

    it('a scripture group whose slot is reassigned to a DIFFERENT reading rebuilds and writes immediately, preserving the stored entry\'s label and pointing at the new reading — no confirm state consulted', async () => {
      scriptureState.readings = [
        {
          id: 'reading-1',
          reference: { book: 'John', chapter: 3 },
          displayReference: 'John 3',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
        {
          id: 'reading-2',
          reference: { book: 'Psalm', chapter: 23 },
          displayReference: 'Psalm 23',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      slideGroupsState.groups = [
        {
          id: 'slot-scripture-a',
          slotId: 'slot-scripture-a',
          serviceId: 'service-1',
          slides: [
            {
              id: 'ss-1',
              order: 0,
              sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1' },
              label: 'Custom label',
            },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      // The slot now points at reading-2 — the user picked a different reading for the same slot.
      const service = ref<Service | null>(
        makeService([scriptureSlot({ position: 0, id: 'slot-scripture-a', scriptureReadingId: 'reading-2' })]),
      )
      const returned = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, slotIdArg, slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(slotIdArg).toBe('slot-scripture-a')
      const slides = slidesArg as GroupSlideEntry[]
      expect(slides).toHaveLength(1)
      expect(slides[0]!.id).toBe('ss-1')
      expect(slides[0]!.label).toBe('Custom label')
      // R047: the rebuild normalizes a legacy reading-document ref to the
      // payload-free shape, carrying the user's label across. The reference
      // itself is no longer stored — it resolves from the slot at render time.
      expect(slides[0]!.sourceRef).toEqual({ kind: 'scripture' })
      expect('pendingReconciliations' in returned).toBe(false)
    })

    it('a scripture group already in sync (freshly-shaped stored entry) issues no write', async () => {
      scriptureState.readings = [
        {
          id: 'reading-1',
          reference: { book: 'John', chapter: 3 },
          displayReference: 'John 3',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      slideGroupsState.groups = [
        {
          id: 'slot-scripture-c',
          slotId: 'slot-scripture-c',
          serviceId: 'service-1',
          slides: [
            { id: 'ss-1', order: 0, sourceRef: { kind: 'scripture' } },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([scriptureSlot({ position: 0, id: 'slot-scripture-c' })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    })

    it('canWrite false issues zero rebuild writes', async () => {
      scriptureState.readings = [
        {
          id: 'reading-1',
          reference: { book: 'John', chapter: 3 },
          displayReference: 'John 3',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
        {
          id: 'reading-2',
          reference: { book: 'Psalm', chapter: 23 },
          displayReference: 'Psalm 23',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      slideGroupsState.groups = [
        {
          id: 'slot-scripture-d',
          slotId: 'slot-scripture-d',
          serviceId: 'service-1',
          slides: [
            { id: 'ss-1', order: 0, sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1' } },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([scriptureSlot({ position: 0, id: 'slot-scripture-d', scriptureReadingId: 'reading-2' })]),
      )
      useSlideshowAssembly(service, 'org-1')
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    })

    it('the write passes the group\'s PRE-rebuild slides as the compare-and-swap base (CR-02), so a concurrent write is merged, not overwritten', async () => {
      songsState.songs = [{ id: 'song-a' } as Song]
      const twoSectionLyrics: SongLyrics = {
        id: 'lyrics-song-a',
        songId: 'song-a',
        sections: [
          { id: 'v1', label: 'Verse 1', lines: ['song-a line 1'] },
          { id: 'v2', label: 'Verse 2', lines: ['song-a line 2'] },
        ],
        copyright: {
          title: 'song-a Title',
          authors: ['Author'],
          ccliSongNumber: '123',
          copyrightLines: ['(c) 2026'],
          ccliLicenseNumber: 'LIC-1',
        },
        performanceOrder: ['v1', 'v2'],
        createdAt: {} as never,
        updatedAt: {} as never,
      }
      const fakeLyricsLoader = vi.fn(async () => twoSectionLyrics)

      const preRebuildSlides: GroupSlideEntry[] = [
        { id: 'cr-1', order: 0, sourceRef: { kind: 'copyright', songId: 'song-a' } },
        { id: 'ly-v1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-a', sectionId: 'v1' } },
        { id: 'cr-2', order: 2, sourceRef: { kind: 'copyright', songId: 'song-a' } },
      ]
      slideGroupsState.groups = [
        {
          id: 'slot-song-base',
          slotId: 'slot-song-base',
          serviceId: 'service-1',
          slides: preRebuildSlides,
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-base', songId: 'song-a' })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const baseSlidesArg = mockReplaceGroupSlides.mock.calls[0]![4]
      // `slideGroupsState` is Vue-`reactive()`, so the array the composable
      // reads back is a Proxy over (not the same object identity as)
      // `preRebuildSlides` — assert deep equality, which is what "the
      // pre-rebuild snapshot, unmutated" actually means here.
      expect(baseSlidesArg).toEqual(preRebuildSlides)
    })
  })

  // --- R046: end-to-end guard that a dropped video / hand-authored slide
  // survives a live rebuild tick, across all three slot kinds. This is the
  // highest-consequence regression this phase can produce: a video a user
  // dropped disappearing on the next lyric edit, reading swap, or re-import —
  // with no confirm dialog left to have ever caught it. Adds no production
  // assertions beyond what the store received (mockReplaceGroupSlides args)
  // and the assembled output, not internal composable state.
  describe('D-17 / T-30-02-01 — dropped video survives an unconditional rebuild (end-to-end)', () => {
    it('a song group holding a video entry keeps that entry in the slide list passed to replaceGroupSlides after a lyric change triggers reconciliation', async () => {
      songsState.songs = [{ id: 'song-a' } as Song]
      const twoSectionLyrics: SongLyrics = {
        id: 'lyrics-song-a',
        songId: 'song-a',
        sections: [
          { id: 'v1', label: 'Verse 1', lines: ['song-a line 1'] },
          { id: 'v2', label: 'Verse 2', lines: ['song-a line 2'] },
        ],
        copyright: {
          title: 'song-a Title',
          authors: ['Author'],
          ccliSongNumber: '123',
          copyrightLines: ['(c) 2026'],
          ccliLicenseNumber: 'LIC-1',
        },
        performanceOrder: ['v1', 'v2'],
        createdAt: {} as never,
        updatedAt: {} as never,
      }
      const fakeLyricsLoader = vi.fn(async () => twoSectionLyrics)

      // Stored group is missing 'v2' (the lyric section just added) and
      // carries a video entry a user dropped onto this song group.
      slideGroupsState.groups = [
        {
          id: 'slot-song-video',
          slotId: 'slot-song-video',
          serviceId: 'service-1',
          slides: [
            { id: 'cr-1', order: 0, sourceRef: { kind: 'copyright', songId: 'song-a' } },
            { id: 'ly-v1', order: 1, sourceRef: { kind: 'lyric', songId: 'song-a', sectionId: 'v1' } },
            {
              id: 'entry-video',
              order: 2,
              sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' },
            },
            { id: 'cr-2', order: 3, sourceRef: { kind: 'copyright', songId: 'song-a' } },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-video', songId: 'song-a' })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await vi.waitFor(() => expect(fakeLyricsLoader).toHaveBeenCalled())
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, slotIdArg, slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      expect(slotIdArg).toBe('slot-song-video')
      const slides = slidesArg as GroupSlideEntry[]
      const videoEntry = slides.find((e) => e.id === 'entry-video')
      expect(videoEntry).toBeDefined()
      expect(videoEntry?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })
    })

    it('a dropped video on a SCRIPTURE group survives a reading swap end-to-end: the write includes it, and the assembled output still shows the video slide', async () => {
      scriptureState.readings = [
        {
          id: 'reading-1',
          reference: { book: 'John', chapter: 3 },
          displayReference: 'John 3',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
        {
          id: 'reading-2',
          reference: { book: 'Psalm', chapter: 23 },
          displayReference: 'Psalm 23',
          rawText: 'text',
          readingMode: 'normal',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      slideGroupsState.groups = [
        {
          id: 'slot-scripture-video',
          slotId: 'slot-scripture-video',
          serviceId: 'service-1',
          slides: [
            { id: 'ss-1', order: 0, sourceRef: { kind: 'scripture', scriptureReadingId: 'reading-1' } },
            {
              id: 'entry-video',
              order: 1,
              sourceRef: { kind: 'video', videoSrc: 'https://example.com/dropped.mp4' },
            },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      // The slot is reassigned to reading-2 — the source has changed.
      const service = ref<Service | null>(
        makeService([scriptureSlot({ position: 0, id: 'slot-scripture-video', scriptureReadingId: 'reading-2' })]),
      )
      const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      const videoEntry = slides.find((e) => e.id === 'entry-video')
      expect(videoEntry).toBeDefined()
      expect(videoEntry?.sourceRef).toEqual({ kind: 'video', videoSrc: 'https://example.com/dropped.mp4' })

      // The store mock does not itself apply the write, so the assembled
      // output still resolves from the ORIGINAL stored slides at this point
      // (a real Firestore round trip lands async) — assert the video slide
      // is present in the CURRENT assembled output either way, since the
      // video entry was never removed from the group by this rebuild.
      const videoSlide = assembledSlideshow.value.find((s) => s.slide.contentKind === 'video')
      expect(videoSlide).toBeDefined()
      expect(videoSlide!.slide.id).toBe('entry-video')
    })

    it('an authored-text entry on an IMPORTED group survives a re-import end-to-end: the write includes it', async () => {
      importedState.decks = [
        {
          id: 'deck-1',
          sourceFileName: 'announcements.pptx',
          section: 'pre-service',
          slides: [
            { id: 'new-1', position: 0, contentKind: 'text', title: 'New', body: 'New body' },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      slideGroupsState.groups = [
        {
          id: 'slot-imported-authored',
          slotId: 'slot-imported-authored',
          serviceId: 'service-1',
          slides: [
            { id: 'is-old', order: 0, sourceRef: { kind: 'imported', importId: 'deck-1', innerSlideId: 'old-1' } },
            {
              id: 'entry-authored',
              order: 1,
              sourceRef: { kind: 'text', title: 'My Slide', body: 'My words' },
            },
          ],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]

      const service = ref<Service | null>(
        makeService([{ kind: 'IMPORTED', id: 'slot-imported-authored', position: 0, importId: 'deck-1', section: 'pre-service' }]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()

      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
      const [, , slidesArg] = mockReplaceGroupSlides.mock.calls[0]!
      const slides = slidesArg as GroupSlideEntry[]
      const authoredEntry = slides.find((e) => e.id === 'entry-authored')
      expect(authoredEntry).toBeDefined()
      expect(authoredEntry?.sourceRef).toEqual({ kind: 'text', title: 'My Slide', body: 'My words' })
    })
  })

  // --- 25-05 Task 1: on-demand materialization for an explicit user write ---
  // ── HI-01: a denied group write must be contained, not escape ──────────────
  //
  // Both apply loops are invoked fire-and-forget (`void applyRebuildOutcomes(…)`)
  // from `{ immediate: true }` watchers, and both `await`ed their store writes
  // with no `try`/`catch`. Before Phase 31 those writes always succeeded
  // (`allow write: if isOrgEditor`); the new `/slideGroups` rule denies them the
  // instant the parent service leaves `draft`. A denied write therefore both
  // escapes as an unhandled `permission-denied` AND aborts the loop, so every
  // LATER slot in the same batch is silently skipped with nothing on screen.
  describe('HI-01 — a denied group write is contained, and does not abort the batch', () => {
    it('a rejected materialization still lets the remaining candidates through, and is logged', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockMaterializeGroupIfMissing.mockRejectedValueOnce(
        new Error('FirebaseError: Missing or insufficient permissions'),
      )

      const service = ref<Service | null>(
        makeService([
          hymnSlot({ position: 0, id: 'slot-denied', hymnName: 'Denied' }),
          hymnSlot({ position: 1, id: 'slot-after', hymnName: 'After' }),
        ]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 0))

      const attempted = mockMaterializeGroupIfMissing.mock.calls.map(
        ([, input]) => (input as SlideGroup).slotId,
      )
      expect(attempted).toContain('slot-denied')
      // The bug: the rejection propagated out of the `for` loop, so this one
      // was never attempted at all.
      expect(attempted).toContain('slot-after')
      expect(errSpy).toHaveBeenCalledWith(
        '[useSlideshowAssembly] group materialization write failed:',
        expect.any(Error),
      )

      errSpy.mockRestore()
    })

    it('a rejected rebuild write is logged and releases its applied-guard so a retry is possible', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      songsState.songs = [{ id: 'song-a' } as Song]
      const fakeLyricsLoader = vi.fn(async (_orgId: string, songId: string) => makeLyrics(songId))

      // A group missing the lyric entry its source now derives ⇒ `rebuildGroup`
      // reports `changed`, so the watcher issues a `replaceGroupSlides`.
      slideGroupsState.groups = [
        {
          id: 'slot-song-a',
          slotId: 'slot-song-a',
          serviceId: 'service-1',
          slides: [],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      mockReplaceGroupSlides.mockRejectedValueOnce(
        new Error('FirebaseError: Missing or insufficient permissions'),
      )

      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-a', songId: 'song-a' })]),
      )
      useSlideshowAssembly(service, 'org-1', { canWrite: true, lyricsLoader: fakeLyricsLoader })
      await nextTick()
      await vi.waitFor(() => expect(mockReplaceGroupSlides).toHaveBeenCalled())
      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(errSpy).toHaveBeenCalledWith(
        '[useSlideshowAssembly] group rebuild write failed:',
        expect.any(Error),
      )

      errSpy.mockRestore()
    })

    it('drainGroupWrites resolves only once an in-flight group write has settled', async () => {
      let releaseWrite!: () => void
      mockMaterializeGroupIfMissing.mockImplementationOnce(
        () => new Promise<boolean>((resolve) => { releaseWrite = () => resolve(true) }),
      )

      const service = ref<Service | null>(
        makeService([hymnSlot({ position: 0, id: 'slot-slow', hymnName: 'Slow' })]),
      )
      const { drainGroupWrites } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      expect(mockMaterializeGroupIfMissing).toHaveBeenCalled()

      let drained = false
      const draining = drainGroupWrites().then(() => { drained = true })
      await new Promise((resolve) => setTimeout(resolve, 0))
      // Still in flight — this is the window `onMarkAsPlanned` used to flip the
      // status through, leaving the write to be denied on arrival.
      expect(drained).toBe(false)

      releaseWrite()
      await draining
      expect(drained).toBe(true)
    })
  })

  describe('ensureGroupMaterialized (25-05 Task 1)', () => {
    it('resolves with the existing group\'s entries and signature and calls no store create action when a group already exists', async () => {
      slideGroupsState.groups = [
        {
          id: 'slot-hymn-a',
          slotId: 'slot-hymn-a',
          serviceId: 'service-1',
          sourceSignature: 'sig-1',
          slides: [{ id: 'existing-1', order: 0, sourceRef: { kind: 'text' } }],
          createdAt: {} as never,
          updatedAt: {} as never,
        },
      ]
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-a' })]))
      const { ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()

      const result = await ensureGroupMaterialized('slot-hymn-a')
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
      expect(result?.entries).toEqual([{ id: 'existing-1', order: 0, sourceRef: { kind: 'text' } }])
      expect(result?.sourceSignature).toBe('sig-1')
    })

    it('creates the group and resolves with the derived entries when no group exists yet', async () => {
      const service = ref<Service | null>(
        makeService([hymnSlot({ position: 0, id: 'slot-hymn-b', hymnName: 'Hymn B' })]),
      )
      const { ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()

      const result = await ensureGroupMaterialized('slot-hymn-b')
      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
      const [orgIdArg, input] = mockMaterializeGroupIfMissing.mock.calls[0]!
      expect(orgIdArg).toBe('org-1')
      expect((input as SlideGroup).slotId).toBe('slot-hymn-b')
      expect(result?.entries).toEqual((input as SlideGroup).slides)
      expect(result?.entries.length).toBeGreaterThan(0)
    })

    it('still creates a group for a slot whose source derives zero slides, resolving with an empty entry list', async () => {
      const service = ref<Service | null>(
        makeService([songSlot({ position: 0, id: 'slot-song-empty', songId: null })]),
      )
      const { ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()

      const result = await ensureGroupMaterialized('slot-song-empty')
      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
      expect(result?.entries).toEqual([])
    })

    it('resolves without writing when the caller is not an editor', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-c' })]))
      const { ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', { canWrite: false })
      await nextTick()

      const result = await ensureGroupMaterialized('slot-hymn-c')
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('resolves undefined for a slot id that does not exist on the service', async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0, id: 'slot-hymn-d' })]))
      const { ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      // The automatic watcher (Task 2, unrelated to this test) may already
      // have materialized `slot-hymn-d` itself by this point — clear so only
      // this test's own call against a NONEXISTENT slot id is asserted on.
      mockMaterializeGroupIfMissing.mockClear()

      const result = await ensureGroupMaterialized('slot-does-not-exist')
      expect(result).toBeUndefined()
      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
    })

    it('issues at most one create for two concurrent calls on the same slot', async () => {
      const service = ref<Service | null>(
        makeService([hymnSlot({ position: 0, id: 'slot-hymn-e', hymnName: 'Hymn E' })]),
      )
      const { ensureGroupMaterialized } = useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()

      const [resultA, resultB] = await Promise.all([
        ensureGroupMaterialized('slot-hymn-e'),
        ensureGroupMaterialized('slot-hymn-e'),
      ])
      expect(mockMaterializeGroupIfMissing).toHaveBeenCalledTimes(1)
      expect(resultA?.entries).toEqual(resultB?.entries)
    })
  })

  // --- Phase 42 (R079/R080): render-status subscription lifecycle (42-08 Task 1) ---
  describe('PPTX render subscription lifecycle (Task 1)', () => {
    function importedSlot(id: string, importId: string, position = 0): ServiceSlot {
      return { kind: 'IMPORTED', id, position, importId, section: 'pre-service' }
    }

    function deckWithRender(id: string, renderImportId?: string): ImportedDeck {
      return {
        id,
        sourceFileName: `${id}.pptx`,
        section: 'pre-service',
        slides: [{ id: `${id}-inner-1`, position: 0, contentKind: 'text', title: 'T', body: 'B' }],
        ...(renderImportId !== undefined ? { renderImportId } : {}),
        createdAt: {} as never,
        updatedAt: {} as never,
      }
    }

    it('calls syncSubscriptions with the org id and exactly the renderImportIds of IMPORTED decks that have one', async () => {
      importedState.decks = [
        deckWithRender('deck-1', 'render-1'),
        deckWithRender('deck-2'), // no renderImportId — contributes nothing
      ]
      const service = ref<Service | null>(
        makeService([importedSlot('slot-imported-1', 'deck-1', 0), importedSlot('slot-imported-2', 'deck-2', 1)]),
      )
      useSlideshowAssembly(service, 'org-1')
      await nextTick()

      expect(mockSyncPptxRenderSubscriptions).toHaveBeenCalledWith('org-1', ['render-1'])
    })

    it('re-calls syncSubscriptions with the reduced set when an IMPORTED slot referencing a rendered deck is removed', async () => {
      importedState.decks = [deckWithRender('deck-1', 'render-1'), deckWithRender('deck-2', 'render-2')]
      const service = ref<Service | null>(
        makeService([importedSlot('slot-imported-1', 'deck-1', 0), importedSlot('slot-imported-2', 'deck-2', 1)]),
      )
      useSlideshowAssembly(service, 'org-1')
      await nextTick()
      const calls = mockSyncPptxRenderSubscriptions.mock.calls
      const lastCallIds = calls[calls.length - 1]![1] as string[]
      expect([...lastCallIds].sort()).toEqual(['render-1', 'render-2'])

      service.value = makeService([importedSlot('slot-imported-1', 'deck-1', 0)])
      await nextTick()
      expect(mockSyncPptxRenderSubscriptions).toHaveBeenLastCalledWith('org-1', ['render-1'])
    })

    it("calls unsubscribeAll exactly once when the composable's effect scope is stopped", async () => {
      const service = ref<Service | null>(makeService([hymnSlot({ position: 0 })]))
      useSlideshowAssembly(service, 'org-1')
      await nextTick()
      expect(mockUnsubscribeAllPptxRenders).not.toHaveBeenCalled()

      activeScopes.splice(0).forEach((scope) => scope.stop())
      expect(mockUnsubscribeAllPptxRenders).toHaveBeenCalledTimes(1)
    })
  })

  // --- Phase 42 (R079/R080): resolved rendered-page URL caching (42-08 Task 2) ---
  describe('rendered-page URL resolution and caching (Task 2)', () => {
    function importedSlot(id: string, importId: string): ServiceSlot {
      return { kind: 'IMPORTED', id, position: 0, importId, section: 'pre-service' }
    }

    function deckWithRender(id: string, renderImportId: string, slideIds: string[]): ImportedDeck {
      return {
        id,
        sourceFileName: `${id}.pptx`,
        section: 'pre-service',
        slides: slideIds.map((slideId, i) => ({
          id: slideId,
          position: i,
          contentKind: 'text',
          title: `T${i}`,
          body: `B${i}`,
        })),
        renderImportId,
        createdAt: {} as never,
        updatedAt: {} as never,
      }
    }

    function fakeUrl(path: string): string {
      return `https://fake-storage.test/${path}`
    }

    it('resolves one URL per rendered page for a ready render, with the correct 1-based padded path for the first and last page', async () => {
      importedState.decks = [deckWithRender('deck-1', 'render-1', ['inner-1'])]
      const service = ref<Service | null>(makeService([importedSlot('slot-imported-a', 'deck-1')]))
      useSlideshowAssembly(service, 'org-1')
      await nextTick()

      pptxRendersState.rendersByImportId.set('render-1', { status: 'ready', renderedCount: 3 })
      await nextTick()
      await vi.waitFor(() => expect(mockResolveImageUrl).toHaveBeenCalledTimes(3))

      expect(mockResolveImageUrl).toHaveBeenCalledWith(renderedPagePath('org-1', 'render-1', 1))
      expect(mockResolveImageUrl).toHaveBeenCalledWith(renderedPagePath('org-1', 'render-1', 3))
    })

    it('accessing assembledSlideshow.value repeatedly does not re-issue Storage calls for an already-resolved render (42-RESEARCH.md Pitfall 4)', async () => {
      importedState.decks = [deckWithRender('deck-1', 'render-1', ['inner-1'])]
      const service = ref<Service | null>(makeService([importedSlot('slot-imported-a', 'deck-1')]))
      const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1')

      pptxRendersState.rendersByImportId.set('render-1', { status: 'ready', renderedCount: 1 })
      await nextTick()
      await vi.waitFor(() => expect(mockResolveImageUrl).toHaveBeenCalledTimes(1))

      void assembledSlideshow.value
      void assembledSlideshow.value
      void assembledSlideshow.value
      expect(mockResolveImageUrl).toHaveBeenCalledTimes(1)
    })

    it('a renderedCount change re-resolves and the exposed slideshow serves the NEW array, never the previous one (T-42-07)', async () => {
      importedState.decks = [deckWithRender('deck-1', 'render-1', ['inner-1'])]
      const service = ref<Service | null>(makeService([importedSlot('slot-imported-a', 'deck-1')]))
      const { assembledSlideshow } = useSlideshowAssembly(service, 'org-1')

      pptxRendersState.rendersByImportId.set('render-1', { status: 'ready', renderedCount: 1 })
      await nextTick()
      await vi.waitFor(() => expect(mockResolveImageUrl).toHaveBeenCalledTimes(1))
      expect(assembledSlideshow.value).toHaveLength(1)
      expect((assembledSlideshow.value[0]!.slide as { imageUrl?: string }).imageUrl).toBe(
        fakeUrl(renderedPagePath('org-1', 'render-1', 1)),
      )

      mockResolveImageUrl.mockClear()
      pptxRendersState.rendersByImportId.set('render-1', { status: 'ready', renderedCount: 2 })
      await nextTick()
      await vi.waitFor(() => expect(mockResolveImageUrl).toHaveBeenCalledTimes(2))

      const slides = assembledSlideshow.value
      expect(slides).toHaveLength(2)
      expect((slides[0]!.slide as { imageUrl?: string }).imageUrl).toBe(fakeUrl(renderedPagePath('org-1', 'render-1', 1)))
      expect((slides[1]!.slide as { imageUrl?: string }).imageUrl).toBe(fakeUrl(renderedPagePath('org-1', 'render-1', 2)))
    })
  })

  // --- Phase 42 (R079/R080): a render transition writes the group exactly
  // once, with no special case for the state it started from (42-08 Task 2) ---
  describe('render-status transition write count (D-10 / D-12)', () => {
    function importedSlot(id: string, importId: string): ServiceSlot {
      return { kind: 'IMPORTED', id, position: 0, importId, section: 'pre-service' }
    }

    function deckWithRender(id: string, renderImportId: string, slideIds: string[]): ImportedDeck {
      return {
        id,
        sourceFileName: `${id}.pptx`,
        section: 'pre-service',
        slides: slideIds.map((slideId, i) => ({
          id: slideId,
          position: i,
          contentKind: 'text',
          title: `T${i}`,
          body: `B${i}`,
        })),
        renderImportId,
        createdAt: {} as never,
        updatedAt: {} as never,
      }
    }

    /** A group whose stored entries already match the deck's pending/failed
     * (parsed-identity) fallback derivation, so the FIRST recompute after
     * mount is a no-op (`changed: false`) — isolating the assertion to the
     * transition itself, not to an unrelated initial materialization. */
    function matchingImportedGroup(slotId: string, importId: string, slideIds: string[]): SlideGroup {
      return {
        id: slotId,
        slotId,
        serviceId: 'service-1',
        slides: slideIds.map((innerSlideId, i) => ({
          id: `${slotId}-entry-${i}`,
          order: i,
          sourceRef: { kind: 'imported', importId, innerSlideId },
        })),
        createdAt: {} as never,
        updatedAt: {} as never,
      }
    }

    it('a pending → ready transition issues exactly ONE replaceGroupSlides call, and no more on subsequent recomputes (D-10)', async () => {
      importedState.decks = [deckWithRender('deck-1', 'render-1', ['inner-1', 'inner-2'])]
      slideGroupsState.groups = [matchingImportedGroup('slot-imported-a', 'deck-1', ['inner-1', 'inner-2'])]
      const service = ref<Service | null>(makeService([importedSlot('slot-imported-a', 'deck-1')]))
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      // No render document yet → pending mode, byte-identical to the stored group.
      await nextTick()
      await nextTick()
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()

      pptxRendersState.rendersByImportId.set('render-1', { status: 'ready', renderedCount: 2 })
      await nextTick()
      await nextTick()
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)

      // Further recomputes against the SAME unrebuilt stored group (e.g. the
      // async URL resolution settling) must not re-issue the write.
      await nextTick()
      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    })

    it('a failed → ready transition produces an identical single-write result, with no special case (D-12)', async () => {
      importedState.decks = [deckWithRender('deck-2', 'render-2', ['inner-1', 'inner-2'])]
      slideGroupsState.groups = [matchingImportedGroup('slot-imported-b', 'deck-2', ['inner-1', 'inner-2'])]
      pptxRendersState.rendersByImportId.set('render-2', { status: 'failed', renderedCount: 0, failureReason: 'x' })
      const service = ref<Service | null>(makeService([importedSlot('slot-imported-b', 'deck-2')]))
      useSlideshowAssembly(service, 'org-1', { canWrite: true })
      await nextTick()
      await nextTick()
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()

      pptxRendersState.rendersByImportId.set('render-2', { status: 'ready', renderedCount: 2 })
      await nextTick()
      await nextTick()
      expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    })
  })
})
