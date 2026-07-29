import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive, computed } from 'vue'
import ScriptureSlideEditor from '../ScriptureSlideEditor.vue'
import type { ScriptureSlide } from '@/types/slide'
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
      reference: 'Romans 8:28-30',
      bookRef: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 },
      text: 'And we know that for those who love God all things work together for good.',
      verseRange: 'vv. 28-29',
      readingMode: 'normal',
    },
    {
      id: 'scripture-1',
      position: 1,
      contentKind: 'scripture',
      reference: 'Romans 8:28-30',
      bookRef: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 },
      text: 'For those whom he foreknew he also predestined to be conformed to the image of his Son.',
      verseRange: 'v. 30',
      readingMode: 'normal',
    },
  ]
}

function mountEditor(props?: Record<string, unknown>) {
  return mount(ScriptureSlideEditor, {
    props: { orgId: 'org-1', ...props },
  })
}

describe('ScriptureSlideEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoSaveStatusRef.value = 'idle'
    capturedSaveFn = null
    mockFetchPassageText.mockResolvedValue('[28] And we know that...')
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

  it('fetch button is enabled when a valid reference is entered', async () => {
    const wrapper = mountEditor()
    const input = wrapper.find('[data-testid="reference-input"]')
    await input.setValue('Romans 8:28-30')
    expect(wrapper.find('[data-testid="fetch-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('clicking fetch calls fetchPassageText with correct query', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(mockFetchPassageText).toHaveBeenCalledWith('Romans 8:28-30')
  })

  it('after fetch, displays split slides with verse range labels', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="slides-container"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-textarea-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-textarea-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('vv. 28-29')
    expect(wrapper.text()).toContain('v. 30')
  })

  it('calls splitPassage with fetched text and parsed reference', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(mockSplitPassage).toHaveBeenCalledWith(
      '[28] And we know that...',
      { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 },
    )
  })

  it('editing a slide textarea updates local state', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    const textarea = wrapper.find('[data-testid="slide-textarea-0"]')
    await textarea.setValue('Edited slide text')
    await textarea.trigger('input')

    expect((textarea.element as HTMLTextAreaElement).value).toBe('Edited slide text')
  })

  it('marks a manually edited slide with the override visual-distinction class (Phase 19 carryover gap)', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    // Before any edit: neither slide card carries the override class or badge.
    expect(wrapper.find('[data-testid="slide-card-0"]').classes()).not.toContain('border-amber-500/70')
    expect(wrapper.find('[data-testid="slide-card-1"]').classes()).not.toContain('border-amber-500/70')
    expect(wrapper.find('[data-testid="edited-badge-0"]').exists()).toBe(false)

    const textarea = wrapper.find('[data-testid="slide-textarea-0"]')
    await textarea.setValue('Edited slide text')
    await textarea.trigger('input')
    await wrapper.vm.$nextTick()

    // Edited slide (index 0) gains the override class + badge; the untouched
    // slide (index 1) still carries neither.
    expect(wrapper.find('[data-testid="slide-card-0"]').classes()).toContain('border-amber-500/70')
    expect(wrapper.find('[data-testid="edited-badge-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-card-1"]').classes()).not.toContain('border-amber-500/70')
    expect(wrapper.find('[data-testid="edited-badge-1"]').exists()).toBe(false)
  })

  it('auto-save triggers on slide edits via useAutoSave', async () => {
    const { useAutoSave } = await import('@/composables/useAutoSave')
    mountEditor()
    expect(useAutoSave).toHaveBeenCalled()
    expect(capturedSaveFn).toBeInstanceOf(Function)
  })

  it('auto-save save function calls updateReading on the store', async () => {
    const wrapper = mountEditor()

    // Simulate a fetch to set up currentReadingId
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    // The save function captured by useAutoSave should call updateReading
    expect(capturedSaveFn).toBeInstanceOf(Function)
    await capturedSaveFn!()
    expect(mockUpdateReading).toHaveBeenCalledWith(
      'org-1',
      'new-reading-id',
      expect.objectContaining({ slides: expect.any(Array) }),
    )
  })

  // R047 (Phase 30 verification defect): the reading document minted here is
  // the ONLY link between a SCRIPTURE slot and its passage. The id used to be
  // kept in a local ref and never surfaced, so `slot.scriptureReadingId`
  // stayed null, `deriveGroupEntries` returned zero entries, and adding a
  // scripture item produced NO slide on the Slides tab at all.
  describe('R047 — surfacing a newly minted reading id', () => {
    it('emits reading-created with the id createReading returned', async () => {
      const wrapper = mountEditor()

      await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(mockCreateReading).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('reading-created')).toBeTruthy()
      expect(wrapper.emitted('reading-created')![0]).toEqual(['new-reading-id'])
    })

    it('does NOT emit when a reading already exists — that id is already on the slot', async () => {
      mockGetReading.mockResolvedValueOnce(null)
      const wrapper = mountEditor({ readingId: 'existing-reading-id' })
      await flushPromises()

      await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(mockCreateReading).not.toHaveBeenCalled()
      expect(mockUpdateReading).toHaveBeenCalled()
      expect(wrapper.emitted('reading-created')).toBeUndefined()
    })

    it('emits exactly once across repeated fetches — the second reuses the id', async () => {
      const wrapper = mountEditor()

      await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="reference-input"]').setValue('Psalm 103:1-5')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(mockCreateReading).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('reading-created')!.length).toBe(1)
    })

    it('emits nothing when the ESV fetch fails — no reading was minted', async () => {
      mockFetchPassageText.mockRejectedValueOnce(new Error('Network error'))
      const wrapper = mountEditor()

      await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('reading-created')).toBeUndefined()
    })
  })

  it('shows error message when ESV fetch fails', async () => {
    mockFetchPassageText.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="fetch-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Could not load passage')
  })

  it('does not show error when fetch succeeds', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(false)
  })

  it('shows save status indicator for each status', async () => {
    const wrapper = mountEditor()

    autoSaveStatusRef.value = 'pending'
    await flushPromises()
    expect(wrapper.find('[data-testid="status-pending"]').exists()).toBe(true)

    autoSaveStatusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="status-saving"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Saving...')

    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(wrapper.find('[data-testid="status-saved"]').exists()).toBe(true)
  })

  it('creates a new reading on first fetch', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(mockCreateReading).toHaveBeenCalledWith('org-1', expect.objectContaining({
      reference: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 },
      readingMode: 'normal',
      slides: expect.any(Array),
    }))
  })

  it('cleans up auto-save on unmount', () => {
    const wrapper = mountEditor()
    wrapper.unmount()
    expect(mockAutoSaveCleanup).toHaveBeenCalled()
  })

  it('loads existing reading in edit mode', async () => {
    mockGetReading.mockResolvedValueOnce({
      id: 'existing-reading',
      reference: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
      displayReference: 'John 3:16-17',
      rawText: '[16] For God so loved...',
      readingMode: 'normal',
      slides: makeSampleSlides(),
      createdAt: { seconds: 1000000, nanoseconds: 0 } as never,
      updatedAt: { seconds: 1000000, nanoseconds: 0 } as never,
    })

    const wrapper = mountEditor({ readingId: 'existing-reading' })
    await flushPromises()

    expect(mockSubscribeReadings).toHaveBeenCalledWith('org-1')
    expect(mockGetReading).toHaveBeenCalledWith('org-1', 'existing-reading')
    expect(wrapper.find('[data-testid="slide-textarea-0"]').exists()).toBe(true)
  })
})
