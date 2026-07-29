import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive, computed } from 'vue'
import CongregationalEditor from '../CongregationalEditor.vue'
import type { ScriptureSlide, CongregationalSection } from '@/types/slide'
import type { ScriptureReading } from '@/types/scriptureReading'

const mockCreateReading = vi.fn(() => Promise.resolve('new-reading-id'))
const mockUpdateReading = vi.fn(() => Promise.resolve())
const mockGetReading = vi.fn<() => Promise<ScriptureReading | null>>(() => Promise.resolve(null))
const mockSubscribeReadings = vi.fn()
const mockUnsubscribeReadings = vi.fn()

vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () =>
    reactive({
      readings: [],
      isLoading: false,
      currentReading: computed(() => null),
      subscribeReadings: mockSubscribeReadings,
      unsubscribeReadings: mockUnsubscribeReadings,
      createReading: mockCreateReading,
      updateReading: mockUpdateReading,
      getReading: mockGetReading,
    }),
}))

const autoSaveStatusRef = ref('idle')
const mockAutoSaveFlush = vi.fn()
const mockAutoSaveCleanup = vi.fn()
let capturedSaveFn: (() => Promise<void>) | null = null

vi.mock('@/composables/useAutoSave', () => ({
  useAutoSave: vi.fn((
    _source: unknown,
    saveFn: () => Promise<void>,
  ) => {
    capturedSaveFn = saveFn
    return {
      status: autoSaveStatusRef,
      flush: mockAutoSaveFlush,
      cleanup: mockAutoSaveCleanup,
    }
  }),
}))

const mockFetchPassageText = vi.fn()
vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: (...args: unknown[]) => mockFetchPassageText(...args),
}))

const mockSplitPassage = vi.fn()
vi.mock('@/utils/scriptureSplitter', () => ({
  splitPassage: (...args: unknown[]) => mockSplitPassage(...args),
}))

function makeSampleSlides(): ScriptureSlide[] {
  return [
    {
      id: 'scripture-0',
      position: 0,
      contentKind: 'scripture',
      reference: 'Psalm 136:1-3',
      bookRef: { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 },
      text: 'Give thanks to the LORD, for he is good,',
      verseRange: 'v. 1',
      readingMode: 'normal',
    },
    {
      id: 'scripture-1',
      position: 1,
      contentKind: 'scripture',
      reference: 'Psalm 136:1-3',
      bookRef: { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 },
      text: 'for his steadfast love endures forever.',
      verseRange: 'v. 2',
      readingMode: 'normal',
    },
    {
      id: 'scripture-2',
      position: 2,
      contentKind: 'scripture',
      reference: 'Psalm 136:1-3',
      bookRef: { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 },
      text: 'Give thanks to the God of gods,',
      verseRange: 'v. 3',
      readingMode: 'normal',
    },
  ]
}

function mountEditor(props?: Record<string, unknown>) {
  return mount(CongregationalEditor, {
    props: { orgId: 'org-1', ...props },
  })
}

describe('CongregationalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoSaveStatusRef.value = 'idle'
    capturedSaveFn = null
    mockFetchPassageText.mockResolvedValue('[1] Give thanks to the LORD...')
    mockSplitPassage.mockReturnValue(makeSampleSlides())
  })

  it('renders reference input and fetch button', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('[data-testid="reference-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fetch-btn"]').exists()).toBe(true)
  })

  it('fetch button is disabled when reference is empty', () => {
    const wrapper = mountEditor()
    const btn = wrapper.find('[data-testid="fetch-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('after fetch, displays verse chunks with speaker role toggles', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sections-container"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="speaker-toggle-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="speaker-toggle-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="speaker-toggle-2"]').exists()).toBe(true)
  })

  it('default alternating speaker assignment (LEADER, CONGREGATION, LEADER)', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
    expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Congregation')
    expect(wrapper.find('[data-testid="speaker-toggle-2"]').text()).toBe('Leader')
  })

  it('toggling speaker role updates section assignment', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
    await wrapper.find('[data-testid="speaker-toggle-0"]').trigger('click')
    expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Congregation')
  })

  it('preview shows Leader/Congregation labels with distinct styling', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="preview-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
    expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')
    expect(wrapper.find('[data-testid="preview-label-2"]').text()).toBe('Leader:')
  })

  it('saved data includes readingMode congregational and congregationalSections array', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(mockCreateReading).toHaveBeenCalledWith('org-1', expect.objectContaining({
      readingMode: 'congregational',
      congregationalSections: expect.arrayContaining([
        expect.objectContaining({ speaker: 'LEADER', text: expect.any(String) }),
        expect.objectContaining({ speaker: 'CONGREGATION', text: expect.any(String) }),
      ]),
    }))
  })

  // R047 — identical contract to ScriptureSlideEditor: a slot switched to
  // congregational mode mints its reading HERE, so this editor must surface
  // the id too or the slot links to nothing and derives no slide.
  describe('R047 — surfacing a newly minted reading id', () => {
    it('emits reading-created with the id createReading returned', async () => {
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('reading-created')).toBeTruthy()
      expect(wrapper.emitted('reading-created')![0]).toEqual(['new-reading-id'])
    })

    it('does NOT emit when a reading already exists', async () => {
      const wrapper = mountEditor({ readingId: 'existing-reading-id' })
      await flushPromises()

      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(mockCreateReading).not.toHaveBeenCalled()
      expect(wrapper.emitted('reading-created')).toBeUndefined()
    })
  })

  it('auto-save triggers on section changes via useAutoSave', async () => {
    const { useAutoSave } = await import('@/composables/useAutoSave')
    mountEditor()
    expect(useAutoSave).toHaveBeenCalled()
    expect(capturedSaveFn).toBeInstanceOf(Function)
  })

  it('auto-save save function calls updateReading with congregational data', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    mockUpdateReading.mockClear()
    expect(capturedSaveFn).toBeInstanceOf(Function)
    await capturedSaveFn!()
    expect(mockUpdateReading).toHaveBeenCalledWith(
      'org-1',
      'new-reading-id',
      expect.objectContaining({
        readingMode: 'congregational',
        congregationalSections: expect.any(Array),
      }),
    )
  })

  it('shows error message when ESV fetch fails', async () => {
    mockFetchPassageText.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="fetch-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Could not load passage')
  })

  it('shows save status indicator for each status', async () => {
    const wrapper = mountEditor()

    autoSaveStatusRef.value = 'pending'
    await flushPromises()
    expect(wrapper.find('[data-testid="status-pending"]').exists()).toBe(true)

    autoSaveStatusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="status-saving"]').exists()).toBe(true)

    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(wrapper.find('[data-testid="status-saved"]').exists()).toBe(true)
  })

  it('cleans up auto-save on unmount', () => {
    const wrapper = mountEditor()
    wrapper.unmount()
    expect(mockAutoSaveCleanup).toHaveBeenCalled()
  })

  it('loads existing reading in edit mode with congregationalSections', async () => {
    mockGetReading.mockResolvedValueOnce({
      id: 'existing-reading',
      reference: { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 },
      displayReference: 'Psalms 136:1-3',
      rawText: '[1] Give thanks...',
      readingMode: 'congregational',
      slides: [],
      congregationalSections: [
        { speaker: 'LEADER', text: 'Give thanks to the LORD', verseRange: 'v. 1' },
        { speaker: 'CONGREGATION', text: 'for his steadfast love', verseRange: 'v. 2' },
      ],
      createdAt: { seconds: 1000000, nanoseconds: 0 } as never,
      updatedAt: { seconds: 1000000, nanoseconds: 0 } as never,
    })

    const wrapper = mountEditor({ readingId: 'existing-reading' })
    await flushPromises()

    expect(mockSubscribeReadings).toHaveBeenCalledWith('org-1')
    expect(mockGetReading).toHaveBeenCalledWith('org-1', 'existing-reading')
    expect(wrapper.find('[data-testid="speaker-toggle-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
    expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Congregation')
  })

  it('does not show sections or preview when no passage is fetched', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('[data-testid="sections-container"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="preview-panel"]').exists()).toBe(false)
  })

  it('preview labels update after toggling speaker role', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
    await wrapper.find('[data-testid="speaker-toggle-0"]').trigger('click')
    expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')
  })
})
