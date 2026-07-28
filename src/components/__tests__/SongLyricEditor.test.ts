import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, reactive } from 'vue'
import SongLyricEditor from '../SongLyricEditor.vue'
import type { SongLyrics, LyricSection, CopyrightInfo } from '@/types/songLyrics'

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

async function mountEditor() {
  const wrapper = mount(SongLyricEditor, {
    props: { songId: 'song-1', orgId: 'org-1' },
    global: {
      stubs: {
        LyricPasteDialog: { template: '<div data-testid="paste-dialog-stub" :data-open="open"></div>', props: ['open', 'songId', 'orgId'] },
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('SongLyricEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentLyrics.value = null
    mockIsLoading.value = true
    mockLyricVersions.value = []
  })

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

  it('shows auto-save status indicator for pending', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const { _statusRef } = await import('@/composables/useAutoSave') as unknown as { _statusRef: ReturnType<typeof ref<string>> }
    _statusRef.value = 'pending'
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="status-pending"]').exists()).toBe(true)
  })

  it('shows auto-save status indicator for saving', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const { _statusRef } = await import('@/composables/useAutoSave') as unknown as { _statusRef: ReturnType<typeof ref<string>> }
    _statusRef.value = 'saving'
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="status-saving"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Saving...')
  })

  it('shows auto-save status indicator for saved', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const { _statusRef } = await import('@/composables/useAutoSave') as unknown as { _statusRef: ReturnType<typeof ref<string>> }
    _statusRef.value = 'saved'
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="status-saved"]').exists()).toBe(true)
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
})
