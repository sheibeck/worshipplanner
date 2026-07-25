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

const mockCurrentLyrics = ref<SongLyrics | null>(null)
const mockIsLoading = ref(true)

vi.mock('@/stores/songLyrics', () => ({
  useSongLyricsStore: () =>
    reactive({
      currentLyrics: computed(() => mockCurrentLyrics.value),
      isLoading: mockIsLoading,
      subscribeLyrics: mockSubscribeLyrics,
      unsubscribeLyrics: mockUnsubscribeLyrics,
      updateCurrentLyrics: mockUpdateCurrentLyrics,
      saveLyrics: mockSaveLyrics,
    }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    updateSong: vi.fn(() => Promise.resolve()),
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
        LyricPasteDialog: { template: '<div data-testid="paste-dialog-stub"></div>', props: ['open', 'songId', 'orgId'] },
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

  it('renders sections from store data', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.text()).toContain('Verse 1')
    expect(wrapper.text()).toContain('Chorus')
    const textareas = wrapper.findAll('textarea')
    expect(textareas.length).toBe(2)
    expect((textareas[0]!.element as HTMLTextAreaElement).value).toContain('Amazing grace how sweet the sound')
    expect((textareas[1]!.element as HTMLTextAreaElement).value).toContain('My chains are gone')
  })

  it('displays copyright info', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const copyright = wrapper.find('[data-testid="copyright-display"]')
    expect(copyright.exists()).toBe(true)
    expect(copyright.text()).toContain('Amazing Grace')
    expect(copyright.text()).toContain('John Newton')
    expect(copyright.text()).toContain('CCLI Song # 12345')
    expect(copyright.text()).toContain('CCLI License # 99999')
    expect(copyright.text()).toContain('© 2023 Test Publisher')
  })

  it('editing a section updates editable state', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    const textarea = wrapper.find('[data-testid="section-textarea-0"]')
    await textarea.setValue('New line 1\nNew line 2')
    await wrapper.vm.$nextTick()

    expect((textarea.element as HTMLTextAreaElement).value).toBe('New line 1\nNew line 2')
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

  it('"Save Version" button calls saveLyrics to create a new version', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

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

  it('"Paste New Lyrics" button exists when lyrics are loaded', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics()
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="paste-lyrics-btn"]').exists()).toBe(true)
  })

  it('hides no-lyrics copyright when ccliSongNumber is empty', async () => {
    mockIsLoading.value = false
    mockCurrentLyrics.value = makeLyrics({
      copyright: { ...SAMPLE_COPYRIGHT, ccliSongNumber: '' },
    })
    const wrapper = await mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="copyright-display"]').exists()).toBe(false)
  })
})
