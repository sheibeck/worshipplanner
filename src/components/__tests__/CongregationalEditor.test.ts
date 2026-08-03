import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { ref, reactive, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import CongregationalEditor from '../CongregationalEditor.vue'
import { useSaveStatus } from '@/stores/saveStatus'
import { useToasts } from '@/stores/toasts'
import type { ScriptureSlide, CongregationalSection } from '@/types/slide'
import type { ScriptureReading } from '@/types/scriptureReading'

// 32-06: the shared generic failure sentence — verbatim, the only error copy
// this editor (and its two siblings) ever renders. It has no reorder
// concept, so the reorder variant (ServiceEditorView-only) must never
// appear here.
const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."
const REORDER_ERROR_TEXT = "Couldn't save this order — reverted. Try dragging again."

// 32-06: these components now consume the real, Firestore-free useSaveStatus
// store rather than mocking it — pure client state, so a real instance is
// simpler and asserts more (matching 32-04/32-05's own precedent).
//
// enableAutoUnmount (matching ServiceEditorView.test.ts's own precedent) is
// load-bearing here, not just tidy cleanup: every mounted wrapper's
// reporting watcher stays subscribed to the shared, module-level
// autoSaveStatusRef mock until its component unmounts. Pinia wraps every
// store action (including saveStatus.set) to call setActivePinia(itsOwnPinia)
// before running -- so a single un-unmounted wrapper from an earlier test
// silently hijacks the globally-active Pinia the next time this shared ref
// changes, corrupting an unrelated, later test's "fresh" store.
beforeEach(() => {
  setActivePinia(createPinia())
})
enableAutoUnmount(afterEach)

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

// 34-04: splitCongregationalReading is mocked wholesale — this test file
// exercises the component's wiring (gating, wholesale replace, failure
// toast), not the already-tested-elsewhere (34-03) call shape/validation
// behavior of the real function.
const mockSplitCongregationalReading = vi.fn()
vi.mock('@/utils/claudeApi', () => ({
  splitCongregationalReading: (...args: unknown[]) => mockSplitCongregationalReading(...args),
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

  it('shows save status indicator for each status, reported into the shared store under the congregational: surface id', async () => {
    // readingId provided -> currentReadingId (and therefore surfaceId)
    // resolves immediately, so every status transition below is reported.
    const wrapper = mountEditor({ readingId: 'reading-1' })
    await flushPromises()

    autoSaveStatusRef.value = 'pending'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving soon…')
    expect(useSaveStatus().entryFor('congregational:reading-1').status).toBe('pending')

    autoSaveStatusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving…')

    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
    expect(useSaveStatus().entryFor('congregational:reading-1').status).toBe('saved')
  })

  it('reports the generic failure sentence on error — never the reorder variant, which belongs to ServiceEditorView alone', async () => {
    const wrapper = mountEditor({ readingId: 'reading-1' })
    await flushPromises()

    autoSaveStatusRef.value = 'error'
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
    expect(wrapper.text()).not.toContain(REORDER_ERROR_TEXT)
    expect(useSaveStatus().entryFor('congregational:reading-1').errorText).toBe(GENERIC_ERROR_TEXT)
  })

  it('clears its store entry on unmount, next to the existing composable cleanup call', async () => {
    const wrapper = mountEditor({ readingId: 'reading-1' })
    await flushPromises()
    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(useSaveStatus().entries['congregational:reading-1']).toBeDefined()

    wrapper.unmount()
    expect(useSaveStatus().entries['congregational:reading-1']).toBeUndefined()
  })

  // ── E4 backstops (32-UI-SPEC.md § UI Considerations) ────────────────────────

  it('E4 loading backstop: a freshly-mounted editor for a different record never inherits a previous record’s saved status', async () => {
    const first = mountEditor({ readingId: 'reading-old' })
    await flushPromises()
    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(useSaveStatus().entryFor('congregational:reading-old').status).toBe('saved')

    // A second, independently-mounted instance for a DIFFERENT record must
    // start idle — nothing to inherit, because its own surfaceId has never
    // been written to.
    const second = mountEditor({ readingId: 'reading-new' })
    await flushPromises()
    expect(second.find('[data-testid="save-status"]').text()).toBe('')
    expect(useSaveStatus().entryFor('congregational:reading-new').status).toBe('idle')

    first.unmount()
    second.unmount()
  })

  it('E4 partial backstop (★ sharpest correctness risk): a save armed before the surface id resolves, then the id changing again, must not misattribute the in-flight result to the new id', async () => {
    // No readingId -> currentReadingId starts null -> surfaceId unresolved.
    const wrapper = mountEditor()
    await flushPromises()

    // A save arms (e.g. sections mutated by a fetch) while the surface id is
    // still unresolved -- nothing must be registered anywhere yet.
    autoSaveStatusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('')
    expect(Object.keys(useSaveStatus().entries)).toHaveLength(0)

    // The id resolves for the FIRST time (captured once) -- this is the
    // exposed test-only seam, since currentReadingId has no reactive
    // prop-watcher of its own in production (see CongregationalEditor.vue).
    ;(wrapper.vm as unknown as { currentReadingId: string | null }).currentReadingId = 'reading-old'
    await flushPromises()
    // Capturing the id alone does not retroactively report the in-flight
    // 'saving' status -- only a further status TRANSITION does. Still
    // nothing registered for the just-captured id.
    expect(useSaveStatus().entryFor('congregational:reading-old').status).toBe('idle')

    // The id "switches" again (simulating a record swap) -- per spec the
    // surface id is captured ONCE and never re-derived, so this must NOT
    // move the target.
    ;(wrapper.vm as unknown as { currentReadingId: string | null }).currentReadingId = 'reading-new'
    await flushPromises()

    // The original in-flight save now resolves.
    autoSaveStatusRef.value = 'saved'
    await flushPromises()

    // The NEW record's indicator/entry must read idle -- the in-flight
    // result was never attributed to it.
    expect(useSaveStatus().entryFor('congregational:reading-new').status).toBe('idle')
    // The OLD (first-captured) id's entry is the one that resolves.
    expect(useSaveStatus().entryFor('congregational:reading-old').status).toBe('saved')
    expect(wrapper.find('[data-testid="save-status"]').text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
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

  // ── 34-04 Task 1: the opt-in "Split with AI" affordance ────────────────────

  describe('AI split (34-04, Task 1: affordance + success path)', () => {
    beforeEach(() => {
      mockSplitCongregationalReading.mockReset()
    })

    it('is the only new data-testid, and is disabled before a passage has been fetched', () => {
      const wrapper = mountEditor()
      const btn = wrapper.find('[data-testid="ai-split-btn"]')
      expect(btn.exists()).toBe(true)
      expect(btn.attributes('disabled')).toBeDefined()
    })

    it('is enabled after a fetch whose text has internal boundaries', async () => {
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="ai-split-btn"]').attributes('disabled')).toBeUndefined()
    })

    it('empty edge: stays disabled and issues no split call when the fetched text offers no internal boundary, leaving the manual sections untouched', async () => {
      mockFetchPassageText.mockResolvedValueOnce('no boundaries here at all')
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      const manualToggleCount = wrapper.findAll('[data-testid^="speaker-toggle-"]').length
      const btn = wrapper.find('[data-testid="ai-split-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()

      await btn.trigger('click')
      await flushPromises()

      expect(mockSplitCongregationalReading).not.toHaveBeenCalled()
      expect(wrapper.findAll('[data-testid^="speaker-toggle-"]').length).toBe(manualToggleCount)
    })

    it('disables the button and switches its label while a split is in flight', async () => {
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      let resolveSplit!: (value: CongregationalSection[] | null) => void
      mockSplitCongregationalReading.mockReturnValueOnce(
        new Promise<CongregationalSection[] | null>((resolve) => {
          resolveSplit = resolve
        }),
      )

      const clickPromise = wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      const inFlightBtn = wrapper.find('[data-testid="ai-split-btn"]')
      expect(inFlightBtn.attributes('disabled')).toBeDefined()
      expect(inFlightBtn.text()).toContain('Splitting...')

      resolveSplit([
        { speaker: 'LEADER', text: 'a' },
        { speaker: 'CONGREGATION', text: 'b' },
      ])
      await clickPromise
      await flushPromises()

      expect(wrapper.find('[data-testid="ai-split-btn"]').text()).not.toContain('Splitting...')
    })

    it('on success, replaces sections wholesale in the returned order — never merged, appended, or re-sorted', async () => {
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      const aiSections: CongregationalSection[] = [
        { speaker: 'CONGREGATION', text: 'Second thing first', verseRange: 'v. 2' },
        { speaker: 'LEADER', text: 'Then this', verseRange: 'v. 1' },
      ]
      mockSplitCongregationalReading.mockResolvedValueOnce(aiSections)

      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      const toggles = wrapper.findAll('[data-testid^="speaker-toggle-"]')
      expect(toggles).toHaveLength(2)
      expect(wrapper.find('[data-testid="preview-section-0"]').text()).toContain('Second thing first')
      expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain('Then this')
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Leader:')
    })

    it('encoding backstop: rendered section text is strictly === to the mocked section text, including curly quotes and an em dash', async () => {
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      const NON_ASCII_TEXT = '“He restores—my soul,” said the shepherd’s voice'
      mockSplitCongregationalReading.mockResolvedValueOnce([
        { speaker: 'LEADER', text: NON_ASCII_TEXT },
      ])

      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      const rendered = wrapper.find('[data-testid="preview-section-0"] span:last-child')
      expect(rendered.text() === NON_ASCII_TEXT).toBe(true)
    })

    it('a successful split leaves the manual speaker-toggle affordance working on the new sections', async () => {
      const wrapper = mountEditor()
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      mockSplitCongregationalReading.mockResolvedValueOnce([
        { speaker: 'LEADER', text: 'a' },
        { speaker: 'CONGREGATION', text: 'b' },
      ])
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
      await wrapper.find('[data-testid="speaker-toggle-0"]').trigger('click')
      expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Congregation')
    })
  })
})
