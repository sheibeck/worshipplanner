import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { ref, computed, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Options as SortableOptions } from 'sortablejs'
import SongLyricEditor from '../SongLyricEditor.vue'
import BackgroundControl from '../slides/BackgroundControl.vue'
import { useSaveStatus } from '@/stores/saveStatus'
import type { SongLyrics, LyricSection, CopyrightInfo } from '@/types/songLyrics'

// 32-06: the shared generic failure sentence — verbatim, the only error copy
// this editor (and its two siblings) ever renders — see
// CongregationalEditor.test.ts for the full rationale.
const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."
const REORDER_ERROR_TEXT = "Couldn't save this order — reverted. Try dragging again."

// --- 28-05 Task 1: capture the options passed to Sortable.create so onEnd can
// be invoked directly — reproduces the SlideGrid.test.ts / ServiceEditorView
// convention. jsdom cannot produce a real drag. ---
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

const SAMPLE_COPYRIGHT: CopyrightInfo = {
  title: 'Amazing Grace',
  authors: ['John Newton'],
  ccliSongNumber: '12345',
  copyrightLines: ['© 2023 Test Publisher'],
  ccliLicenseNumber: '99999',
}

const SAMPLE_SECTIONS: LyricSection[] = [
  { id: 'verse-1', label: 'Verse 1', lines: ['Amazing grace how sweet the sound', 'That saved a wretch like me'] },
  { id: 'chorus', label: 'Chorus', lines: ['My chains are gone', "I've been set free"] },
]

function makeLyrics(overrides?: Partial<SongLyrics>): SongLyrics {
  return {
    id: 'lyrics-1',
    songId: 'song-1',
    sections: SAMPLE_SECTIONS,
    copyright: SAMPLE_COPYRIGHT,
    performanceOrder: ['verse-1', 'chorus'],
    createdAt: {} as SongLyrics['createdAt'],
    updatedAt: {} as SongLyrics['updatedAt'],
    ...overrides,
  }
}

// A document whose order is [chorus, verse-1, chorus, verse-2] — row 3
// (the second `chorus` entry) is a D-02 repeat reference to row 1's pooled
// section, not a copy.
const REPEAT_SECTIONS: LyricSection[] = [
  { id: 'chorus', label: 'Chorus', lines: ['Bless the Lord', 'O my soul'] },
  { id: 'verse-1', label: 'Verse 1', lines: ["The sun comes up", "it's a new day dawning"] },
  { id: 'verse-2', label: 'Verse 2', lines: ["You're rich in love", "and You're slow to anger"] },
]
const REPEAT_ORDER = ['chorus', 'verse-1', 'chorus', 'verse-2']

function makeRepeatLyrics(overrides?: Partial<SongLyrics>): SongLyrics {
  return makeLyrics({ sections: REPEAT_SECTIONS, performanceOrder: REPEAT_ORDER, ...overrides })
}

const mockSubscribeLyrics = vi.fn()
const mockUnsubscribeLyrics = vi.fn()
const mockUpdateCurrentLyrics = vi.fn(() => Promise.resolve())
const mockSaveLyrics = vi.fn(() => Promise.resolve())
const mockRevertToVersion = vi.fn(() => Promise.resolve())
const mockSetSongBackground = vi.fn(() => Promise.resolve())

const mockCurrentLyrics = ref<SongLyrics | null>(null)
const mockIsLoading = ref(true)
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
      setSongBackground: mockSetSongBackground,
    }),
}))

// 33-06: viewer/editor gating for the new song-level background control —
// this editor has no other editor gate today, so this is the first
// useAuthStore mock in this file.
const mockIsEditor = ref(true)
vi.mock('@/stores/auth', () => ({
  useAuthStore: () =>
    reactive({
      isEditor: computed(() => mockIsEditor.value),
    }),
}))

// 33-06: BackgroundControl (mounted un-stubbed below) pulls in
// useBackgroundUpload, which touches '@/firebase' storage — mocked out here
// exactly like BackgroundControl.test.ts's own idiom, since none of this
// file's cases drive an actual file upload.
vi.mock('@/composables/useBackgroundUpload', () => ({
  useBackgroundUpload: () => ({
    progress: ref(0),
    error: ref(null),
    isUploading: ref(false),
    uploadBackground: vi.fn(),
    reset: vi.fn(),
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

async function mountEditor(songId = 'song-1') {
  const wrapper = mount(SongLyricEditor, {
    props: { songId, orgId: 'org-1' },
    global: {
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

// A minimal CCLI sample local to this file — the plan directs reusing a
// constant defined here rather than importing one from LyricPasteRegion.test.ts.
const SAMPLE_CCLI = `Amazing Grace

Verse 1
Amazing grace how sweet the sound
That saved a wretch like me

Chorus
My chains are gone
I've been set free

CCLI Song # 12345
John Newton
© 2023 Test Publisher
For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com
CCLI License # 99999`

describe('SongLyricEditor', () => {
  // 32-06: real, Firestore-free useSaveStatus store — see
  // CongregationalEditor.test.ts for the enableAutoUnmount rationale (a
  // Pinia-action-triggered setActivePinia hijack from an un-unmounted
  // zombie wrapper, not just tidy cleanup). This file's `_statusRef` is
  // module-level and shared across every mounted instance, exactly like
  // the other two editors' `autoSaveStatusRef`, so the same hazard applies.
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCurrentLyrics.value = null
    mockIsLoading.value = true
    mockLyricVersions.value = []
    mockIsEditor.value = true
    capturedSortableOptions = undefined
    // Reset the shared mocked composable's status ref between tests -- it
    // is module-level and persists its last value otherwise, which masks a
    // no-op re-assignment (Vue's watch() only fires on an actual VALUE
    // change) when two adjacent tests happen to drive it to the same
    // status back-to-back.
    const { _statusRef } = (await import('@/composables/useAutoSave')) as unknown as {
      _statusRef: ReturnType<typeof ref<string>>
    }
    _statusRef.value = 'idle'
    mockSortableDestroy.mockClear()
  })
  enableAutoUnmount(afterEach)

  it('subscribes to lyrics on mount', async () => {
    await mountEditor()
    expect(mockSubscribeLyrics).toHaveBeenCalledWith('org-1', 'song-1')
  })

  it('shows loading state', async () => {
    const wrapper = await mountEditor()
    expect(wrapper.text()).toContain('Loading lyrics')
  })

  it('shows empty state when no lyrics exist', async () => {
    mockIsLoading.value = false
    const wrapper = await mountEditor()
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="paste-cta-btn"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No lyrics yet')
    expect(wrapper.text()).toContain('Paste Lyrics from SongSelect')
  })

  it('shows "Paste lyrics" and "History" as the only header actions when lyrics are loaded', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const pasteBtn = wrapper.find('[data-testid="paste-lyrics-btn"]')
    const historyBtn = wrapper.find('[data-testid="history-toggle-btn"]')
    expect(pasteBtn.exists()).toBe(true)
    expect(pasteBtn.text()).toBe('Paste lyrics')
    expect(historyBtn.exists()).toBe(true)
    expect(historyBtn.text()).toBe('History')
    // "Save Version" no longer lives directly in the header — it moved behind
    // History, since 2a's header carries only these two buttons.
    expect(wrapper.find('[data-testid="save-version-btn"]').exists()).toBe(false)
  })

  it('has exactly one scrolling element, and the header and closing note live outside it', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const scrollers = wrapper.findAll('[class*="overflow-y-auto"]')
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0]!.attributes('data-testid')).toBe('lyrics-scroll-region')

    expect(wrapper.find('[data-testid="lyrics-header"]').exists()).toBe(true)
    expect(scrollers[0]!.find('[data-testid="lyrics-header"]').exists()).toBe(false)

    expect(scrollers[0]!.find('[data-testid="closing-note"]').exists()).toBe(true)
  })

  it('history list is not rendered until activated, and activating it reveals the list', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    mockLyricVersions.value = [makeLyrics()]
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="history-panel"]').exists()).toBe(false)
    await wrapper.find('[data-testid="history-toggle-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="history-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-entry"]').exists()).toBe(true)
  })

  it('choosing to restore a version from the history panel calls the store revert action', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ id: 'lyrics-1' })
    mockLyricVersions.value = [
      makeLyrics({ id: 'lyrics-1' }),
      makeLyrics({ id: 'lyrics-0' }),
    ]
    const wrapper = await mountEditor()
    await flushPromises()

    await wrapper.find('[data-testid="history-toggle-btn"]').trigger('click')
    await wrapper.find('[data-testid="revert-btn"]').trigger('click')

    expect(mockRevertToVersion).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-0')
  })

  it('the "Save Version" action lives inside the history panel and calls saveLyrics', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    await wrapper.find('[data-testid="history-toggle-btn"]').trigger('click')
    await wrapper.find('[data-testid="save-version-btn"]').trigger('click')
    await flushPromises()

    expect(mockSaveLyrics).toHaveBeenCalledWith('org-1', 'song-1', expect.objectContaining({
      sections: expect.arrayContaining([
        expect.objectContaining({ id: 'verse-1', label: 'Verse 1' }),
        expect.objectContaining({ id: 'chorus', label: 'Chorus' }),
      ]),
      copyright: SAMPLE_COPYRIGHT,
      performanceOrder: ['verse-1', 'chorus'],
    }))
  })

  it('useAutoSave is wired with correct arguments', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    await mountEditor()
    await flushPromises()

    const { useAutoSave } = await import('@/composables/useAutoSave')
    expect(useAutoSave).toHaveBeenCalled()
  })

  async function importStatusRef() {
    const { _statusRef } = await import('@/composables/useAutoSave') as unknown as { _statusRef: ReturnType<typeof ref<string>> }
    return _statusRef
  }

  it('shows save status indicator for each status, reported into the shared store under the song-lyrics: surface id', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const statusRef = await importStatusRef()
    const wrapper = await mountEditor()
    await flushPromises()

    statusRef.value = 'pending'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving soon…')
    expect(useSaveStatus().entryFor('song-lyrics:song-1').status).toBe('pending')

    statusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving…')

    statusRef.value = 'saved'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
    expect(useSaveStatus().entryFor('song-lyrics:song-1').status).toBe('saved')
  })

  it('reports the generic failure sentence on error — never the reorder variant, which belongs to ServiceEditorView alone', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const statusRef = await importStatusRef()
    const wrapper = await mountEditor()
    await flushPromises()

    statusRef.value = 'error'
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
    expect(wrapper.text()).not.toContain(REORDER_ERROR_TEXT)
    expect(useSaveStatus().entryFor('song-lyrics:song-1').errorText).toBe(GENERIC_ERROR_TEXT)
  })

  it('clears its store entry on unmount, next to the existing composable cleanup call', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const statusRef = await importStatusRef()
    const wrapper = await mountEditor()
    await flushPromises()
    statusRef.value = 'saved'
    await flushPromises()
    expect(useSaveStatus().entries['song-lyrics:song-1']).toBeDefined()

    wrapper.unmount()
    expect(useSaveStatus().entries['song-lyrics:song-1']).toBeUndefined()
  })

  // ── E4 backstops (32-UI-SPEC.md § UI Considerations) ────────────────────────

  it('E4 loading backstop: a freshly-mounted editor for a different song never inherits a previous song’s saved status', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const statusRef = await importStatusRef()

    const first = await mountEditor('song-old')
    await flushPromises()
    statusRef.value = 'saved'
    await flushPromises()
    expect(useSaveStatus().entryFor('song-lyrics:song-old').status).toBe('saved')

    const second = await mountEditor('song-new')
    await flushPromises()
    expect(second.find('[data-testid="save-status"]').text()).toBe('')
    expect(useSaveStatus().entryFor('song-lyrics:song-new').status).toBe('idle')

    first.unmount()
    second.unmount()
  })

  it('E4 partial backstop, defensive: switching the songId prop on an already-mounted instance must not misattribute an in-flight save to the new song (not currently reachable in production — see SUMMARY)', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const statusRef = await importStatusRef()
    const wrapper = await mountEditor()
    await flushPromises()
    // songId is non-null from mount, so surfaceId resolves immediately to
    // song-lyrics:song-1 (see mountEditor's fixed props).
    expect(useSaveStatus().entryFor('song-lyrics:song-1').status).toBe('idle')

    statusRef.value = 'saving'
    await flushPromises()
    expect(useSaveStatus().entryFor('song-lyrics:song-1').status).toBe('saving')

    // Simulate the parent swapping which song is open on the SAME instance
    // (not reachable today: SongSlideOver only renders this editor while
    // open behind a click-blocking backdrop, and SongsView always sets the
    // selection and the open flag together — see 32-RESEARCH.md). The
    // capture-once guard must still hold even if that ever changes.
    await wrapper.setProps({ songId: 'song-new' })
    await flushPromises()
    expect(useSaveStatus().entryFor('song-lyrics:song-new').status).toBe('idle')

    statusRef.value = 'saved'
    await flushPromises()

    expect(useSaveStatus().entryFor('song-lyrics:song-new').status).toBe('idle')
    expect(useSaveStatus().entryFor('song-lyrics:song-1').status).toBe('saved')
  })

  it('E1/E4 overflow backstop: the 59-char generic error string renders without a truncation class inside this editor’s own (narrowest of the three) header', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const statusRef = await importStatusRef()
    const wrapper = await mountEditor()
    await flushPromises()

    statusRef.value = 'error'
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.classes().join(' ')).not.toMatch(/truncate|overflow-hidden|text-ellipsis|line-clamp/)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
    expect(GENERIC_ERROR_TEXT.length).toBe(59)
  })

  // ── Task 2 (R035/D-01/D-02): the ordered row list ──────────────────────────

  it('renders rows in order, numbered 1..N, with the repeat marked and naming the position it follows', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(4)

    const positions = rows.map((r) => r.find('[data-testid="row-position"]').text())
    expect(positions).toEqual(['1', '2', '3', '4'])

    expect(rows[0]!.attributes('data-repeat')).toBe('false')
    expect(rows[1]!.attributes('data-repeat')).toBe('false')
    expect(rows[2]!.attributes('data-repeat')).toBe('true')
    expect(rows[3]!.attributes('data-repeat')).toBe('false')

    expect(rows[2]!.find('[data-testid="row-repeat-note"]').text()).toContain('1')
    expect(rows[2]!.find('[data-testid="row-linked"]').text()).toBe('linked')
  })

  it('a collapsed row shows its label, a words preview, and its line count', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const verse1Row = rows[1]!
    expect(verse1Row.text()).toContain('VERSE 1')
    expect(verse1Row.find('[data-testid="row-preview"]').text()).toContain('The sun comes up')
    expect(verse1Row.find('[data-testid="row-line-count"]').text()).toBe('2 lines')
  })

  it('expanding a row reveals an editable field; collapsing returns the one-line summary', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const verse1Row = rows[1]!
    expect(verse1Row.find('textarea').exists()).toBe(false)

    await verse1Row.find('[data-testid^="row-toggle-"]').trigger('click')
    const textarea = verse1Row.find('[data-testid="row-textarea-verse-1"]')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe("The sun comes up\nit's a new day dawning")

    await verse1Row.find('[data-testid^="row-toggle-"]').trigger('click')
    expect(verse1Row.find('[data-testid="row-textarea-verse-1"]').exists()).toBe(false)
    expect(verse1Row.find('[data-testid="row-preview"]').exists()).toBe(true)
  })

  it('editing a section that appears twice changes the words shown by BOTH rows (D-02)', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const primaryChorusRow = rows[0]!
    const repeatChorusRow = rows[2]!

    await primaryChorusRow.find('[data-testid^="row-toggle-"]').trigger('click')
    const textarea = primaryChorusRow.find('[data-testid="row-textarea-chorus"]')
    await textarea.setValue('New chorus line one\nNew chorus line two')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('New chorus line one\nNew chorus line two')

    // The repeat row has no edit point of its own — expanding it shows the
    // shared (already-updated) words as read-only text, no textarea.
    await repeatChorusRow.find('[data-testid^="row-toggle-"]').trigger('click')
    expect(repeatChorusRow.find('textarea').exists()).toBe(false)
    const sharedText = repeatChorusRow.find('[data-testid="row-shared-text-chorus#1"]')
    expect(sharedText.exists()).toBe(true)
    expect(sharedText.text()).toContain('New chorus line one')
    expect(sharedText.text()).toContain('New chorus line two')
  })

  it('a trailing newline in the textarea does not persist a spurious blank line (WR-02)', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()
    const saveFn = await saveFnFor(wrapper)

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    const textarea = rows[0]!.find('[data-testid="row-textarea-verse-1"]')
    // Simulates pressing Enter after the last line — the textarea's raw
    // value ends in '\n'.
    await textarea.setValue('Line one\nLine two\n')

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()

    expect(mockUpdateCurrentLyrics).toHaveBeenCalledTimes(1)
    const call = mockUpdateCurrentLyrics.mock.calls[0] as unknown as [string, string, string, { sections: LyricSection[] }]
    const verse1 = call[3].sections.find((s) => s.id === 'verse-1')
    expect(verse1?.lines).toEqual(['Line one', 'Line two'])
  })

  it('clearing a textarea entirely still stores a single empty line, not zero lines (WR-02 guard does not over-strip)', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()
    const saveFn = await saveFnFor(wrapper)

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    const textarea = rows[0]!.find('[data-testid="row-textarea-verse-1"]')
    await textarea.setValue('')

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()

    const call = mockUpdateCurrentLyrics.mock.calls[0] as unknown as [string, string, string, { sections: LyricSection[] }]
    const verse1 = call[3].sections.find((s) => s.id === 'verse-1')
    expect(verse1?.lines).toEqual([''])
  })

  it("the closing note's count equals the number of rows", async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="closing-note"]').text()).toContain('4 sections')
  })

  it('after an edit settles, the lyrics document is updated once with sections and performanceOrder together', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const { useAutoSave } = await import('@/composables/useAutoSave') as unknown as {
      useAutoSave: ReturnType<typeof vi.fn>
    }
    const saveFn = useAutoSave.mock.calls[0]![1] as () => Promise<void>

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[1]!.find('[data-testid^="row-toggle-"]').trigger('click')
    await rows[1]!.find('[data-testid="row-textarea-verse-1"]').setValue('Edited line')

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()

    expect(mockUpdateCurrentLyrics).toHaveBeenCalledTimes(1)
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', expect.objectContaining({
      sections: expect.any(Array),
      performanceOrder: REPEAT_ORDER,
    }))
  })

  it('drops a stray order entry with no pooled section, and persists the repair via the same autosave path', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({
      sections: SAMPLE_SECTIONS,
      performanceOrder: ['verse-1', 'bridge-ghost', 'chorus'],
    })
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(2)

    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', expect.objectContaining({
      performanceOrder: ['verse-1', 'chorus'],
    }))
  })

  it('a document already satisfying the pool/order invariants triggers no write on open', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    await mountEditor()
    await flushPromises()

    expect(mockUpdateCurrentLyrics).not.toHaveBeenCalled()
  })

  // ── Task 1 (R035/D-01): always-on drag reorder by handle ───────────────────

  function simulateDragEnd(oldIndex: number, newIndex: number, rowCount: number) {
    const parent = document.createElement('div')
    const children = Array.from({ length: rowCount }, () => document.createElement('div'))
    children.forEach((c) => parent.appendChild(c))
    const item = children[oldIndex]!
    return capturedSortableOptions!.onEnd!({ oldIndex, newIndex, item } as never)
  }

  it('creates the drag instance over the row list, handle-scoped, matching the slot list animation/ghost config', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    await mountEditor()
    await flushPromises()

    expect(capturedSortableOptions).toBeDefined()
    expect(capturedSortableOptions!.handle).toBe('.drag-handle')
    expect(capturedSortableOptions!.animation).toBe(150)
    expect(capturedSortableOptions!.ghostClass).toBe('opacity-30')
  })

  it('invoking the captured end handler reorders the rendered rows and the editable order to the moved sequence', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    // REPEAT_ORDER = ['chorus', 'verse-1', 'chorus', 'verse-2']; moving index
    // 0 to index 2 yields ['verse-1', 'chorus', 'chorus', 'verse-2'].
    await simulateDragEnd(0, 2, 4)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(4)
    const sectionIds = rows.map((r) => r.attributes('data-testid'))
    expect(sectionIds).toEqual([
      'section-row-verse-1#0',
      'section-row-chorus#0',
      'section-row-chorus#1',
      'section-row-verse-2#0',
    ])
  })

  it('is a no-op when old and new index are equal', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    await simulateDragEnd(1, 1, 4)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual([
      'section-row-chorus#0',
      'section-row-verse-1#0',
      'section-row-chorus#1',
      'section-row-verse-2#0',
    ])
  })

  it('is a no-op when either index is absent', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const parent = document.createElement('div')
    const item = document.createElement('div')
    parent.appendChild(item)
    await capturedSortableOptions!.onEnd!({ oldIndex: undefined, newIndex: 2, item } as never)
    await capturedSortableOptions!.onEnd!({ oldIndex: 0, newIndex: undefined, item } as never)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual([
      'section-row-chorus#0',
      'section-row-verse-1#0',
      'section-row-chorus#1',
      'section-row-verse-2#0',
    ])
  })

  it('moving one occurrence of a twice-referenced section moves only that occurrence, leaving the sibling in place', async () => {
    mockIsLoading.value = false
    // Order: [chorus, verse-1, verse-2, chorus] — move verse-1 (index 1) to
    // the end (index 3): [chorus, verse-2, chorus, verse-1]. Neither chorus
    // occurrence should move.
    mockCurrentLyrics.value = makeLyrics({
      sections: REPEAT_SECTIONS,
      performanceOrder: ['chorus', 'verse-1', 'verse-2', 'chorus'],
    })
    const wrapper = await mountEditor()
    await flushPromises()

    await simulateDragEnd(1, 3, 4)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual([
      'section-row-chorus#0',
      'section-row-verse-2#0',
      'section-row-chorus#1',
      'section-row-verse-1#0',
    ])
  })

  it('row numbering re-derives after a move, reading 1..N with no gaps', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    await simulateDragEnd(0, 2, 4)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const positions = rows.map((r) => r.find('[data-testid="row-position"]').text())
    expect(positions).toEqual(['1', '2', '3', '4'])
  })

  it('a repeat dragged above the row it followed becomes the followed row, and the other becomes the repeat', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    // REPEAT_ORDER = ['chorus', 'verse-1', 'chorus', 'verse-2']; the chorus
    // at index 2 is currently the repeat (follows row 1). Move it to index 0
    // so it becomes the earliest occurrence.
    await simulateDragEnd(2, 0, 4)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows[0]!.attributes('data-repeat')).toBe('false')
    // The chorus now at the later position is the repeat, following row 1.
    const repeatRow = rows.find((r) => r.attributes('data-repeat') === 'true')
    expect(repeatRow).toBeDefined()
    expect(repeatRow!.find('[data-testid="row-repeat-note"]').text()).toContain('1')
  })

  it('reordering a twice-referenced section keeps expand state attached to the physical row the user opened, not the stale positional key (WR-01)', async () => {
    mockIsLoading.value = false
    // Order [chorus, verse-1, chorus] — the second chorus (index 2) is the
    // repeat (chorus#1). rowKey is positionally derived, so a drag that
    // changes which occurrence comes first reassigns rowKeys to different
    // physical rows; stableKey must not.
    mockCurrentLyrics.value = makeLyrics({
      sections: REPEAT_SECTIONS,
      performanceOrder: ['chorus', 'verse-1', 'chorus'],
    })
    const wrapper = await mountEditor()
    await flushPromises()

    // Expand the REPEAT (chorus#1) — the read-only "shared text" panel.
    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const repeatRowBefore = rows[2]!
    expect(repeatRowBefore.attributes('data-testid')).toBe('section-row-chorus#1')
    await repeatRowBefore.find('[data-testid^="row-toggle-"]').trigger('click')
    expect(repeatRowBefore.find('[data-testid="row-shared-text-chorus#1"]').exists()).toBe(true)

    // Drag the FOLLOWED chorus (index 0) past the repeat, to the end:
    // [chorus, verse-1, chorus] -> [verse-1, chorus, chorus]. The physical
    // row the user expanded is now the FOLLOWED occurrence (its rowKey
    // shifts from chorus#1 to chorus#0), and the row that was never
    // expanded is now the repeat (chorus#1).
    await simulateDragEnd(0, 2, 3)
    await flushPromises()

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const followedRowAfter = rows.find((r) => r.attributes('data-testid') === 'section-row-chorus#0')!
    const repeatRowAfter = rows.find((r) => r.attributes('data-testid') === 'section-row-chorus#1')!

    // The physically-expanded row followed the drag: it is now rendered as
    // the non-repeat occurrence and still shows its editable textarea.
    expect(followedRowAfter.find('[data-testid="row-textarea-chorus"]').exists()).toBe(true)
    // The row that was never expanded stays collapsed — no stale key
    // reattached expand state to it.
    expect(repeatRowAfter.find('[data-testid="row-shared-text-chorus#1"]').exists()).toBe(false)
  })

  it('destroys the drag instance on unmount', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    expect(capturedSortableOptions).toBeDefined()
    wrapper.unmount()
    expect(mockSortableDestroy).toHaveBeenCalled()
  })

  it('after a move settles, the lyrics document is updated once with sections and order together', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    await mountEditor()
    await flushPromises()

    const { useAutoSave } = await import('@/composables/useAutoSave') as unknown as {
      useAutoSave: ReturnType<typeof vi.fn>
    }
    const saveFn = useAutoSave.mock.calls[0]![1] as () => Promise<void>

    await simulateDragEnd(0, 2, 4)
    await flushPromises()

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()

    expect(mockUpdateCurrentLyrics).toHaveBeenCalledTimes(1)
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', expect.objectContaining({
      sections: expect.any(Array),
      performanceOrder: ['verse-1', 'chorus', 'chorus', 'verse-2'],
    }))
  })

  // ── Task 2 (R035/D-02): Duplicate, Remove, and the Add-section row ─────────

  async function saveFnFor(wrapper: Awaited<ReturnType<typeof mountEditor>>) {
    const { useAutoSave } = await import('@/composables/useAutoSave') as unknown as {
      useAutoSave: ReturnType<typeof vi.fn>
    }
    void wrapper
    return useAutoSave.mock.calls[0]![1] as () => Promise<void>
  }

  it('an expanded row shows Duplicate then Remove before the collapse control', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const verse1Row = rows[0]!
    await verse1Row.find('[data-testid^="row-toggle-"]').trigger('click')

    const dup = verse1Row.find('[data-testid="row-duplicate-verse-1#0"]')
    const rem = verse1Row.find('[data-testid="row-remove-verse-1#0"]')
    expect(dup.exists()).toBe(true)
    expect(dup.text()).toBe('Duplicate')
    expect(rem.exists()).toBe(true)
    expect(rem.text()).toBe('Remove')

    const html = verse1Row.html()
    expect(html.indexOf('row-duplicate-verse-1#0')).toBeLessThan(html.indexOf('row-remove-verse-1#0'))
    expect(html.indexOf('row-remove-verse-1#0')).toBeLessThan(html.indexOf('row-toggle-verse-1#0'))
  })

  it('Duplicate is also available on a repeat card (duplicating a repeat adds another reference)', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const repeatRow = rows[2]! // chorus#1, the repeat
    await repeatRow.find('[data-testid^="row-toggle-"]').trigger('click')
    expect(repeatRow.find('[data-testid="row-duplicate-chorus#1"]').exists()).toBe(true)
    expect(repeatRow.find('[data-testid="row-remove-chorus#1"]').exists()).toBe(true)
  })

  it('activating Duplicate inserts a new linked-repeat row directly beneath, sharing the original words', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    await rows[0]!.find('[data-testid="row-duplicate-verse-1#0"]').trigger('click')
    await flushPromises()

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.attributes('data-testid')).toBe('section-row-verse-1#0')
    expect(rows[1]!.attributes('data-testid')).toBe('section-row-verse-1#1')
    expect(rows[1]!.attributes('data-repeat')).toBe('true')
    expect(rows[1]!.find('[data-testid="row-linked"]').text()).toBe('linked')

    // The row duplicated FROM (verse-1#0) was expanded, so the new repeat
    // auto-expands too — no forced-open toggle needed here.
    expect(rows[1]!.find('[data-testid="row-shared-text-verse-1#1"]').text()).toContain('Amazing grace how sweet the sound')
  })

  it('editing the followed row after duplicating updates both rows (D-02, not a copy)', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    await rows[0]!.find('[data-testid="row-duplicate-verse-1#0"]').trigger('click')
    await flushPromises()

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const textarea = rows[0]!.find('[data-testid="row-textarea-verse-1"]')
    await textarea.setValue('Brand new words')

    // The duplicate auto-expanded (its source row was expanded) — assert
    // directly on its already-visible shared text.
    expect(rows[1]!.find('[data-testid="row-shared-text-verse-1#1"]').text()).toContain('Brand new words')
  })

  it('Remove on a row referenced elsewhere removes only that occurrence; the section keeps its words on the other row', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const repeatRow = rows[2]! // chorus#1
    await repeatRow.find('[data-testid^="row-toggle-"]').trigger('click')
    await repeatRow.find('[data-testid="row-remove-chorus#1"]').trigger('click')
    await flushPromises()

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual([
      'section-row-chorus#0',
      'section-row-verse-1#0',
      'section-row-verse-2#0',
    ])
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    const textarea = rows[0]!.find('[data-testid="row-textarea-chorus"]')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Bless the Lord\nO my soul')
  })

  it("Remove on a section's only occurrence removes both the row and the section's words from the document", async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const chorusRow = rows[1]!
    await chorusRow.find('[data-testid^="row-toggle-"]').trigger('click')
    await chorusRow.find('[data-testid="row-remove-chorus#0"]').trigger('click')
    await flushPromises()

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(1)
    expect(wrapper.text()).not.toContain('My chains are gone')

    const saveFn = await saveFnFor(wrapper)
    mockUpdateCurrentLyrics.mockClear()
    await saveFn()
    const call = mockUpdateCurrentLyrics.mock.calls[0] as unknown as [string, string, string, { sections: LyricSection[] }]
    const sections = call[3].sections
    expect(sections.find((s) => s.id === 'chorus')).toBeUndefined()
  })

  it('removing the followed row of a repeated pair leaves the survivor as an ordinary row, not a repeat pointing at nothing', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeRepeatLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const followedChorusRow = rows[0]! // chorus#0
    await followedChorusRow.find('[data-testid^="row-toggle-"]').trigger('click')
    await followedChorusRow.find('[data-testid="row-remove-chorus#0"]').trigger('click')
    await flushPromises()

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(3)
    const survivor = rows.find((r) => r.attributes('data-testid') === 'section-row-chorus#0')
    expect(survivor).toBeDefined()
    expect(survivor!.attributes('data-repeat')).toBe('false')
  })

  it('the add row renders the five quick-add chips in mockup order', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const addRow = wrapper.find('[data-testid="add-section-row"]')
    expect(addRow.exists()).toBe(true)
    const chips = addRow.findAll('button')
    expect(chips.map((c) => c.text())).toEqual(['Verse', 'Chorus', 'Bridge', 'Tag', 'Ending'])
  })

  it('activating a chip appends a new empty row under that kind, and expands it', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    await wrapper.find('[data-testid="add-section-chip-Chorus"]').trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(3)
    const newRow = rows[2]!
    expect(newRow.text()).toContain('CHORUS 2')
    const textarea = newRow.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('activating the same chip twice yields two distinct sections with distinct labels and ids', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ sections: [], performanceOrder: [] })
    const wrapper = await mountEditor()
    await flushPromises()

    await wrapper.find('[data-testid="add-section-chip-Verse"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="add-section-chip-Verse"]').trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    expect(rows).toHaveLength(2)
    const testids = rows.map((r) => r.attributes('data-testid'))
    expect(testids[0]).not.toBe(testids[1])
    expect(rows[0]!.text()).toContain('VERSE')
    expect(rows[1]!.text()).toContain('VERSE 2')
  })

  it("the closing note's count tracks duplicate, remove, and add actions", async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()
    expect(wrapper.find('[data-testid="closing-note"]').text()).toContain('2 sections')

    await wrapper.find('[data-testid="add-section-chip-Bridge"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="closing-note"]').text()).toContain('3 sections')

    let rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    await rows[0]!.find('[data-testid="row-duplicate-verse-1#0"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="closing-note"]').text()).toContain('4 sections')

    rows = wrapper.findAll('[data-testid="section-rows"] > div')
    const lastRow = rows[rows.length - 1]!
    // The Bridge row added above auto-expanded itself (addSection expands
    // its new row), so Duplicate/Remove are already visible here.
    const removeBtn = lastRow.find('button[data-testid^="row-remove-"]')
    await removeBtn.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="closing-note"]').text()).toContain('3 sections')
  })

  it('Duplicate saves once with both fields', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()
    const saveFn = await saveFnFor(wrapper)

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[0]!.find('[data-testid^="row-toggle-"]').trigger('click')
    await rows[0]!.find('[data-testid="row-duplicate-verse-1#0"]').trigger('click')
    await flushPromises()

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledTimes(1)
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', expect.objectContaining({
      performanceOrder: ['verse-1', 'verse-1', 'chorus'],
    }))
  })

  it('Remove saves once with both fields', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()
    const saveFn = await saveFnFor(wrapper)

    const rows = wrapper.findAll('[data-testid="section-rows"] > div')
    await rows[1]!.find('[data-testid^="row-toggle-"]').trigger('click')
    await rows[1]!.find('[data-testid="row-remove-chorus#0"]').trigger('click')
    await flushPromises()

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledTimes(1)
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', expect.objectContaining({
      performanceOrder: ['verse-1'],
    }))
  })

  // ── 28-06: restore the CCLI copyright display dropped in 28-04 ─────────────

  it('shows the copyright display, inside the single scroll region, when ccliSongNumber is present', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const scroller = wrapper.find('[data-testid="lyrics-scroll-region"]')
    const copyright = scroller.find('[data-testid="copyright-display"]')
    expect(copyright.exists()).toBe(true)
    expect(copyright.text()).toContain('Amazing Grace')
    expect(copyright.text()).toContain('John Newton')
    expect(copyright.text()).toContain('© 2023 Test Publisher')
    expect(copyright.text()).toContain('CCLI Song # 12345')
    expect(copyright.text()).toContain('CCLI License # 99999')
  })

  it('hides the copyright display when ccliSongNumber is absent', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({
      copyright: { ...SAMPLE_COPYRIGHT, ccliSongNumber: '' },
    })
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="copyright-display"]').exists()).toBe(false)
  })

  it('Add section saves once with both fields', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()
    const saveFn = await saveFnFor(wrapper)

    await wrapper.find('[data-testid="add-section-chip-Tag"]').trigger('click')
    await flushPromises()

    mockUpdateCurrentLyrics.mockClear()
    await saveFn()
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledTimes(1)
    expect(mockUpdateCurrentLyrics).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', expect.objectContaining({
      performanceOrder: ['verse-1', 'chorus', 'tag'],
    }))
  })

  // ── 33-06: song-level background control (R057) ────────────────────────────

  const EMPTY_BACKGROUND_CAPTION = 'Applies to every service using this song, unless a group or slide overrides it.'
  const SET_BACKGROUND_CAPTION = 'Applies wherever this song appears — services can override it.'
  const SAMPLE_BG_URL = 'https://storage.example.com/org-1/backgrounds/abc/sunset.jpg'

  it('background: with lyrics loaded and no background set, renders the row with the empty-state caption and the add affordance', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const row = wrapper.find('[data-testid="song-background-row"]')
    expect(row.exists()).toBe(true)
    expect(row.get('[data-testid="background-control-caption"]').text()).toBe(EMPTY_BACKGROUND_CAPTION)
    expect(row.find('[data-testid="background-control-add"]').exists()).toBe(true)
  })

  it('background: with a background set, shows the populated-state caption, thumbnail, filename and Remove', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ backgroundImageUrl: SAMPLE_BG_URL })
    const wrapper = await mountEditor()
    await flushPromises()

    const row = wrapper.find('[data-testid="song-background-row"]')
    expect(row.get('[data-testid="background-control-caption"]').text()).toBe(SET_BACKGROUND_CAPTION)
    expect(row.find('[data-testid="background-control-image"]').exists()).toBe(true)
    expect(row.get('[data-testid="background-control-filename"]').text()).toBe('sunset.jpg')
    expect(row.find('[data-testid="background-control-remove"]').exists()).toBe(true)
  })

  it("background: the Remove control's aria-label is the song-level string declared in the Copywriting Contract, distinct from the group level's", async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ backgroundImageUrl: SAMPLE_BG_URL })
    const wrapper = await mountEditor()
    await flushPromises()

    const row = wrapper.find('[data-testid="song-background-row"]')
    expect(row.get('[data-testid="background-control-remove"]').attributes('aria-label')).toBe('Remove song background')
  })

  it("background: the control's attach emit results in exactly one setSongBackground call whose fourth argument is the emitted URL", async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ id: 'lyrics-1' })
    const wrapper = await mountEditor()
    await flushPromises()

    const control = wrapper.findComponent(BackgroundControl)
    control.vm.$emit('attach', SAMPLE_BG_URL)
    await flushPromises()

    expect(mockSetSongBackground).toHaveBeenCalledTimes(1)
    expect(mockSetSongBackground).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', SAMPLE_BG_URL)
  })

  it("background: the control's remove emit results in one setSongBackground call whose fourth argument is null", async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ id: 'lyrics-1', backgroundImageUrl: SAMPLE_BG_URL })
    const wrapper = await mountEditor()
    await flushPromises()

    const control = wrapper.findComponent(BackgroundControl)
    control.vm.$emit('remove')
    await flushPromises()

    expect(mockSetSongBackground).toHaveBeenCalledTimes(1)
    expect(mockSetSongBackground).toHaveBeenCalledWith('org-1', 'song-1', 'lyrics-1', null)
  })

  it('background: with no lyrics loaded, the row does not render at all', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = null
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="song-background-row"]').exists()).toBe(false)
  })

  it('background: with a viewer role, the add and remove controls are absent while the thumbnail and caption still render', async () => {
    mockIsEditor.value = false
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({ backgroundImageUrl: SAMPLE_BG_URL })
    const wrapper = await mountEditor()
    await flushPromises()

    const row = wrapper.find('[data-testid="song-background-row"]')
    expect(row.get('[data-testid="background-control-caption"]').text()).toBe(SET_BACKGROUND_CAPTION)
    expect(row.find('[data-testid="background-control-image"]').exists()).toBe(true)
    expect(row.find('[data-testid="background-control-add"]').exists()).toBe(false)
    expect(row.find('[data-testid="background-control-remove"]').exists()).toBe(false)
  })

  it('background: the row sits between the header and the loading/empty/scroll-region branch chain, a sibling of both, nested in neither', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const header = wrapper.find('[data-testid="lyrics-header"]')
    const scrollRegion = wrapper.find('[data-testid="lyrics-scroll-region"]')
    expect(header.find('[data-testid="song-background-row"]').exists()).toBe(false)
    expect(scrollRegion.find('[data-testid="song-background-row"]').exists()).toBe(false)

    const html = wrapper.html()
    expect(html.indexOf('data-testid="lyrics-header"')).toBeLessThan(html.indexOf('data-testid="song-background-row"'))
    expect(html.indexOf('data-testid="song-background-row"')).toBeLessThan(html.indexOf('data-testid="lyrics-scroll-region"'))
  })

  it('background: the mounted BackgroundControl never receives an inheritedFrom prop — the song is the least specific level', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const control = wrapper.findComponent(BackgroundControl)
    expect(control.exists()).toBe(true)
    expect(control.props('inheritedFrom')).toBeUndefined()
  })

  // ── 35-04 (R066): the lyric paste happens inline, not in a modal ───────────
  // These are the re-homed rows 12-13 of plan 03's migration map for the now-
  // deleted modal's test file ("renders nothing when closed" and "resets
  // textarea when reopened") — the open/closed and reopen-reset mechanisms
  // are now the host's v-if/mount-unmount, not the old dialog's `open` prop,
  // so they live here rather than in LyricPasteRegion.test.ts.
  describe('paste mode — the lyric paste happens inline, not in a modal (R066)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('re-homed row 12: paste-region does not exist until paste-lyrics-btn is clicked; lyrics-header does', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const wrapper = await mountEditor()
      await flushPromises()

      expect(wrapper.find('[data-testid="lyrics-header"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(false)

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(true)
    })

    it('header swap: entering paste mode replaces the Sections view entirely', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="lyrics-paste-header"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="lyrics-header"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="song-background-row"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="lyrics-scroll-region"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="section-rows"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="add-section-row"]').exists()).toBe(false)
    })

    it('re-homed row 13 (E6): reopening paste mode always starts with an empty textarea, never pre-filled', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
      await flushPromises()

      await wrapper.find('[data-testid="paste-cancel-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(false)

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()

      const textarea = wrapper.find('[data-testid="paste-textarea"]')
      expect((textarea.element as HTMLTextAreaElement).value).toBe('')
    })

    it('E10: both exits fire the unsaved-changes guard, and declining it leaves the paste intact', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
      await flushPromises()

      await wrapper.find('[data-testid="paste-back-btn"]').trigger('click')
      await flushPromises()
      expect(confirmSpy).toHaveBeenCalled()
      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(true)
      expect((wrapper.find('[data-testid="paste-textarea"]').element as HTMLTextAreaElement).value).toBe(SAMPLE_CCLI)

      confirmSpy.mockClear()
      await wrapper.find('[data-testid="paste-cancel-btn"]').trigger('click')
      await flushPromises()
      expect(confirmSpy).toHaveBeenCalled()
      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(true)
      expect((wrapper.find('[data-testid="paste-textarea"]').element as HTMLTextAreaElement).value).toBe(SAMPLE_CCLI)
    })

    it('paste-back-btn closes without any confirm prompt, and without saving, when the textarea is empty', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const confirmSpy = vi.spyOn(window, 'confirm')
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="paste-back-btn"]').trigger('click')
      await flushPromises()

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="lyrics-header"]').exists()).toBe(true)
    })

    it('paste-cancel-btn closes without any confirm prompt, and without saving, when the textarea is empty', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const confirmSpy = vi.spyOn(window, 'confirm')
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="paste-cancel-btn"]').trigger('click')
      await flushPromises()

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="lyrics-header"]').exists()).toBe(true)
    })

    it('the empty-state CTA reaches the same paste region as the header button', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = null
      const wrapper = await mountEditor()
      await flushPromises()

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
      await wrapper.find('[data-testid="paste-cta-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="lyrics-paste-header"]').exists()).toBe(true)
    })

    it('R066: the paste region is a plain in-place descendant — no Teleported modal chrome anywhere', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()

      const region = wrapper.find('[data-testid="paste-region"]')
      expect(region.exists()).toBe(true)
      expect(wrapper.element.contains(region.element)).toBe(true)
      expect(wrapper.html()).not.toMatch(/fixed inset-0/)
    })

    it('a successful paste returns to the Sections view', async () => {
      mockIsLoading.value = false
      mockCurrentLyrics.value = makeLyrics()
      const wrapper = await mountEditor()
      await flushPromises()

      await wrapper.find('[data-testid="paste-lyrics-btn"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="paste-textarea"]').setValue(SAMPLE_CCLI)
      await flushPromises()

      await wrapper.find('[data-testid="paste-replace-btn"]').trigger('click')
      await vi.waitFor(() => {
        expect(mockSaveLyrics).toHaveBeenCalled()
      })
      await flushPromises()

      expect(wrapper.find('[data-testid="paste-region"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="lyrics-header"]').exists()).toBe(true)
    })
  })
})
