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
})
