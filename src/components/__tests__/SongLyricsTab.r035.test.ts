// R035's acceptance block — named for the requirement so a future reader can
// find what proves it without tracing it through component-named test files.
//
// R035, verbatim: the song lyrics editor presents one scroll surface and one
// list that IS the slide order — no nested scrollbar, no duplicated
// Available-Sections / Performance-Order lists.
//
// Both structural conditions are asserted over the MOUNTED SongSlideOver +
// SongLyricEditor subtree together (never the editor alone) — the defect
// R035 names was a panel scrolling inside a panel, which only appears once
// both components are mounted together (28-04's own tests proved each half
// separately; this file proves the composed whole). Also re-checks the four
// hard constraints 28-CONTEXT.md called out as must-not-break: the
// Edit-in-song link, D006's CCLI paste/parse, D002/D007's live reference
// contract, and Phase 26-09's reconciliation-safe live rendering.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { ref, computed, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Options as SortableOptions } from 'sortablejs'
import SongSlideOver from '../SongSlideOver.vue'
import { buildSongEditLink, parseSongEditRequest } from '@/utils/songEditLink'
import { parseCCLIPaste } from '@/utils/ccliParser'
import { normalizeParsedSections } from '@/utils/songSectionOrder'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type { Song } from '@/types/song'
import type { SongLyrics, LyricSection, CopyrightInfo } from '@/types/songLyrics'
import type { Service, SongSlot } from '@/types/service'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import type { LyricSlide } from '@/types/slide'

// --- Reproduces 28-05's sortablejs mock convention: capture the options
// handed to Sortable.create so onEnd can be invoked directly. jsdom cannot
// produce a real drag. ---
let capturedSortableOptions: SortableOptions | undefined
const mockSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((_el: HTMLElement, options: SortableOptions) => {
      capturedSortableOptions = options
      return { destroy: mockSortableDestroy }
    }),
  },
}))

const mockAddSong = vi.fn((_data: Record<string, unknown>) => Promise.resolve())
const mockUpdateSong = vi.fn((_id: string, _data: Record<string, unknown>) => Promise.resolve())
const mockDeleteSong = vi.fn((_id: string) => Promise.resolve())
const mockSongStore = {
  allUserTags: [] as string[],
  addSong: mockAddSong,
  updateSong: mockUpdateSong,
  deleteSong: mockDeleteSong,
}
vi.mock('@/stores/songs', () => ({ useSongStore: () => mockSongStore }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ vwModeEnabled: true, orgId: 'org-1' }),
}))

const mockSubscribeLyrics = vi.fn()
const mockUnsubscribeLyrics = vi.fn()
const mockUpdateCurrentLyrics = vi.fn(() => Promise.resolve())
const mockSaveLyrics = vi.fn(() => Promise.resolve())
const mockRevertToVersion = vi.fn(() => Promise.resolve())
const mockCurrentLyrics = ref<SongLyrics | null>(null)
const mockIsLoading = ref(false)
const mockLyricVersions = ref<SongLyrics[]>([])

vi.mock('@/stores/songLyrics', () => ({
  useSongLyricsStore: () =>
    reactive({
      currentLyrics: computed(() => mockCurrentLyrics.value),
      lyricVersions: computed(() => mockLyricVersions.value),
      isLoading: mockIsLoading,
      subscribeLyrics: mockSubscribeLyrics,
      unsubscribeLyrics: mockUnsubscribeLyrics,
      updateCurrentLyrics: mockUpdateCurrentLyrics,
      saveLyrics: mockSaveLyrics,
      revertToVersion: mockRevertToVersion,
    }),
}))

vi.mock('@/composables/useAutoSave', () => {
  const statusRef = ref('idle')
  return {
    useAutoSave: vi.fn((_source: unknown, _saveFn: unknown, _isDirty: unknown) => ({
      status: statusRef,
      flush: vi.fn(),
      cleanup: vi.fn(),
    })),
    _statusRef: statusRef,
  }
})

// Teleported content — established codebase convention (26-RESEARCH.md
// Pitfall 3; see EditSlideDrawer.test.ts / ServiceEditorView.test.ts).
// SongSlideOver's own root teleports the whole panel to document.body.
// SongLyricEditor's inline paste region (35-04, R066) is mounted in place —
// no second Teleport nests inside it anymore.
enableAutoUnmount(afterEach)

function body() {
  return new DOMWrapper(document.body)
}

const SAMPLE_COPYRIGHT: CopyrightInfo = {
  title: 'Amazing Grace',
  authors: ['John Newton'],
  ccliSongNumber: '12345',
  copyrightLines: ['© 2023 Test Publisher'],
  ccliLicenseNumber: '99999',
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '12345',
    author: 'John Newton',
    themes: [],
    notes: '',
    vwTypes: [1],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    pcSongId: null,
    hidden: false,
    tags: [],
    removedThemes: [],
    ...overrides,
  }
}

// Order [chorus, verse-1, chorus, verse-2] — the third row (the second
// `chorus` entry) is a D-02 repeat REFERENCE to row 1's pooled section, not
// a copy. Used throughout as the fixture that exercises the repeat case.
const REPEAT_SECTIONS: LyricSection[] = [
  { id: 'chorus', label: 'Chorus', lines: ['Bless the Lord', 'O my soul'] },
  { id: 'verse-1', label: 'Verse 1', lines: ["The sun comes up", "it's a new day dawning"] },
  { id: 'verse-2', label: 'Verse 2', lines: ["You're rich in love", "and You're slow to anger"] },
]
const REPEAT_ORDER = ['chorus', 'verse-1', 'chorus', 'verse-2']

function makeLyrics(overrides?: Partial<SongLyrics>): SongLyrics {
  return {
    id: 'lyrics-1',
    songId: 'song-1',
    sections: REPEAT_SECTIONS,
    copyright: SAMPLE_COPYRIGHT,
    performanceOrder: REPEAT_ORDER,
    createdAt: {} as SongLyrics['createdAt'],
    updatedAt: {} as SongLyrics['updatedAt'],
    ...overrides,
  }
}

async function mountDrawer(song: Song, initialTab?: 'details' | 'lyrics') {
  const wrapper = mount(SongSlideOver, {
    props: { open: false, song, initialTab },
  })
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}

function simulateDragEnd(oldIndex: number, newIndex: number, rowCount: number) {
  const parent = document.createElement('div')
  const children = Array.from({ length: rowCount }, () => document.createElement('div'))
  children.forEach((c) => parent.appendChild(c))
  const item = children[oldIndex]!
  return capturedSortableOptions!.onEnd!({ oldIndex, newIndex, item } as never)
}

describe('R035 — one scroll surface, one list, and the phase-wide hard constraints', () => {
  // 32-06: SongLyricEditor now consumes the real, Firestore-free
  // useSaveStatus store (SaveStatusIndicator swap) -- this composed
  // SongSlideOver + SongLyricEditor mount needs an active Pinia for that,
  // same as SongLyricEditor.test.ts itself. enableAutoUnmount is already
  // imported/used below; see CongregationalEditor.test.ts for the
  // rationale (a Pinia-action-triggered setActivePinia hijack from an
  // un-unmounted zombie wrapper).
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCurrentLyrics.value = null
    mockIsLoading.value = false
    mockLyricVersions.value = []
    capturedSortableOptions = undefined
    mockSortableDestroy.mockClear()
  })

  // ── Structural condition 1: no nested scrollbar ─────────────────────────

  it('R035: mounting the Lyrics tab (panel + editor together) yields exactly one element declaring vertical-overflow scrolling', async () => {
    mockCurrentLyrics.value = makeLyrics()
    await mountDrawer(makeSong(), 'lyrics')

    const scrollers = body().findAll('[class*="overflow-y-auto"]')
    expect(scrollers, `R035 violated: expected exactly one scroll surface, found ${scrollers.length}`).toHaveLength(1)
    expect(scrollers[0]!.attributes('data-testid')).toBe('lyrics-scroll-region')
  })

  // ── Structural condition 2: exactly one list ────────────────────────────

  it('R035: the tab renders exactly one ordered row container — no duplicated Available-Sections / Performance-Order lists', async () => {
    mockCurrentLyrics.value = makeLyrics()
    await mountDrawer(makeSong(), 'lyrics')

    const lists = body().findAll('[data-testid="section-rows"]')
    expect(lists, `R035 violated: expected exactly one list, found ${lists.length}`).toHaveLength(1)
    // Regression guard: Phase 18's second list must never come back.
    expect(body().find('[data-testid="performance-order-builder"]').exists()).toBe(false)
  })

  // ── The list IS the order, in both directions ───────────────────────────

  it('the rendered row sequence, top to bottom, equals the stored order element for element — including a repeat at each of its positions', async () => {
    mockCurrentLyrics.value = makeLyrics()
    await mountDrawer(makeSong(), 'lyrics')

    const rows = body().findAll('[data-testid="section-rows"] > div')
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual([
      'section-row-chorus#0',
      'section-row-verse-1#0',
      'section-row-chorus#1',
      'section-row-verse-2#0',
    ])
    expect(rows[2]!.attributes('data-repeat')).toBe('true')
  })

  it('reordering the list changes what is saved as the order — the list IS the order, not a view onto it', async () => {
    mockCurrentLyrics.value = makeLyrics()
    await mountDrawer(makeSong(), 'lyrics')

    const { useAutoSave } = (await import('@/composables/useAutoSave')) as unknown as {
      useAutoSave: ReturnType<typeof vi.fn>
    }
    const saveFn = useAutoSave.mock.calls[0]![1] as () => Promise<void>

    // REPEAT_ORDER = [chorus, verse-1, chorus, verse-2]; moving index 0 to
    // index 2 yields [verse-1, chorus, chorus, verse-2].
    await simulateDragEnd(0, 2, 4)
    await flushPromises()

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()

    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith(
      'org-1',
      'song-1',
      'lyrics-1',
      expect.objectContaining({ performanceOrder: ['verse-1', 'chorus', 'chorus', 'verse-2'] }),
    )
  })

  // ── Hard constraint 1 (Phase 26): the Edit-in-song link still lands ─────

  it("a link built for a song's lyrics parses back to the same song id and the lyrics tab; handing that tab to the slide-over opens it on the Lyrics tab showing the editor", async () => {
    const link = buildSongEditLink('song-1', 'lyrics')
    const parsed = parseSongEditRequest(link.query)
    expect(parsed).toEqual({ songId: 'song-1', tab: 'lyrics' })

    mockCurrentLyrics.value = makeLyrics()
    const song = makeSong({ id: parsed!.songId })
    await mountDrawer(song, parsed!.tab)

    expect(body().find('[data-testid="lyrics-tab-content"]').exists()).toBe(true)
    expect(body().find('[data-testid="lyrics-scroll-region"]').exists()).toBe(true)
    expect(body().find('input[placeholder="Song title"]').exists()).toBe(false)
  })

  // ── Hard constraint 2 (D006): CCLI paste/parse still works ──────────────

  it('a CCLI paste with section markers still parses into sections, and a paste naming the same section twice normalises to one pooled section referenced twice', () => {
    const raw = [
      'Amazing Grace',
      '',
      'Verse 1',
      'Amazing grace how sweet the sound',
      'That saved a wretch like me',
      '',
      'Chorus',
      'My chains are gone',
      "I've been set free",
      '',
      'Verse 2',
      'Twas grace that taught my heart to fear',
      '',
      'Chorus',
      'My chains are gone',
      "I've been set free",
    ].join('\n')

    const parsed = parseCCLIPaste(raw)
    expect(parsed.sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2', 'Chorus'])

    const normalized = normalizeParsedSections(parsed)
    const chorusPoolEntries = normalized.sections.filter((s) => s.label === 'Chorus')
    expect(chorusPoolEntries).toHaveLength(1)

    const chorusId = chorusPoolEntries[0]!.id
    expect(normalized.performanceOrder.filter((id) => id === chorusId)).toHaveLength(2)
  })

  // ── Hard constraint 3/4 (D002/D007, Phase 24 D-02): a lyrics edit reaches
  // every service referencing that song, read live through slide entries ──

  it('editing a section referenced twice and resolving the slide entries that reference it produces the edited words for both entries', () => {
    const slot: SongSlot = {
      kind: 'SONG',
      id: 'slot-song-0',
      position: 0,
      requiredVwType: 1,
      songId: 'song-1',
      songTitle: 'Amazing Grace',
      songKey: null,
    }
    const service: Service = {
      id: 'svc-1',
      date: '2026-01-04',
      name: 'Test Service',
      progression: '1-2-2-3',
      teams: [],
      status: 'draft',
      slots: [slot],
      sermonPassage: null,
      notes: '',
      createdAt: {} as never,
      updatedAt: {} as never,
    }

    const followedEntry: GroupSlideEntry = {
      id: 'entry-followed',
      order: 0,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' },
    }
    const repeatEntry: GroupSlideEntry = {
      id: 'entry-repeat',
      order: 1,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'chorus' },
    }
    const group: SlideGroup = {
      id: 'slot-song-0',
      slotId: 'slot-song-0',
      serviceId: 'svc-1',
      slides: [followedEntry, repeatEntry],
      createdAt: {} as never,
      updatedAt: {} as never,
    }

    function inputsFor(lyrics: SongLyrics): AssemblyInputs {
      return {
        songLyricsById: new Map([['song-1', lyrics]]),
        scriptureReadingsById: new Map(),
        importedDecksById: new Map(),
        groupsBySlotId: new Map([['slot-song-0', group]]),
      }
    }

    const before = assembleSlideshow(service, inputsFor(makeLyrics()))
    expect((before[0]!.slide as LyricSlide).lines).toEqual(['Bless the Lord', 'O my soul'])
    expect((before[1]!.slide as LyricSlide).lines).toEqual(['Bless the Lord', 'O my soul'])

    const edited = makeLyrics({
      sections: REPEAT_SECTIONS.map((s) => (s.id === 'chorus' ? { ...s, lines: ['Edited words'] } : s)),
    })
    const after = assembleSlideshow(service, inputsFor(edited))
    expect((after[0]!.slide as LyricSlide).lines).toEqual(['Edited words'])
    expect((after[1]!.slide as LyricSlide).lines).toEqual(['Edited words'])
    // The stored group entries are never rewritten — resolution is live.
    expect(group.slides).toEqual([followedEntry, repeatEntry])
  })
})
