import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { ref, reactive, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import ScriptureSlideEditor from '../ScriptureSlideEditor.vue'
import { useSaveStatus } from '@/stores/saveStatus'
import type { ScriptureSlide } from '@/types/slide'
import type { ScriptureReading } from '@/types/scriptureReading'

// 32-06: verbatim, the only error copy this editor (and its two siblings)
// ever renders — see CongregationalEditor.test.ts for the full rationale.
const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."
const REORDER_ERROR_TEXT = "Couldn't save this order — reverted. Try dragging again."

// 32-06: real, Firestore-free useSaveStatus store — see
// CongregationalEditor.test.ts for the enableAutoUnmount rationale
// (a Pinia-action-triggered setActivePinia hijack from an un-unmounted
// zombie wrapper, not just tidy cleanup).
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

// WR-01 (102-REVIEW): the component now routes through the scriptureApi.ts
// dispatcher (the phase's single choke point) instead of calling
// fetchPassageText directly, so this test mocks the dispatcher itself rather
// than esvApi. The dispatcher's own gate/dispatch behavior is covered by
// scriptureApi.test.ts; this file only proves the component uses it
// correctly (enabled → 'ok'/'error' branching; the 'disabled' branch is
// exercised by its own dedicated test below).
const mockFetchScriptureText = vi.fn()
vi.mock('@/utils/scriptureApi', () => ({
  fetchScriptureText: (...args: unknown[]) => mockFetchScriptureText(...args),
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
    mockFetchScriptureText.mockResolvedValue({ status: 'ok', text: '[28] And we know that...' })
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

  it('clicking fetch calls the scriptureApi dispatcher with correct query and ESV version', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(mockFetchScriptureText).toHaveBeenCalledWith('Romans 8:28-30', 'ESV')
  })

  // Phase 102 (R297): a disabled org's dispatcher gate must produce ZERO
  // proxy calls (already true — this is the mock boundary) and no error UI
  // -- a graceful no-op, not a thrown error.
  it('dispatcher returns disabled: no slides/reading are created and no fetch-error is shown', async () => {
    mockFetchScriptureText.mockResolvedValueOnce({ status: 'disabled' })
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Romans 8:28-30')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slides-container"]').exists()).toBe(false)
    expect(mockCreateReading).not.toHaveBeenCalled()
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

  it('shows error message when ESV fetch fails', async () => {
    mockFetchScriptureText.mockResolvedValueOnce({ status: 'error' })
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

  it('shows save status indicator for each status, reported into the shared store under the scripture: surface id', async () => {
    const wrapper = mountEditor({ readingId: 'reading-1' })
    await flushPromises()

    autoSaveStatusRef.value = 'pending'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving soon…')
    expect(useSaveStatus().entryFor('scripture:reading-1').status).toBe('pending')

    autoSaveStatusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving…')

    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
    expect(useSaveStatus().entryFor('scripture:reading-1').status).toBe('saved')
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
    expect(useSaveStatus().entryFor('scripture:reading-1').errorText).toBe(GENERIC_ERROR_TEXT)
  })

  it('clears its store entry on unmount, next to the existing composable cleanup call', async () => {
    const wrapper = mountEditor({ readingId: 'reading-1' })
    await flushPromises()
    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(useSaveStatus().entries['scripture:reading-1']).toBeDefined()

    wrapper.unmount()
    expect(useSaveStatus().entries['scripture:reading-1']).toBeUndefined()
  })

  // ── E4 backstops (32-UI-SPEC.md § UI Considerations) ────────────────────────

  it('E4 loading backstop: a freshly-mounted editor for a different record never inherits a previous record’s saved status', async () => {
    const first = mountEditor({ readingId: 'reading-old' })
    await flushPromises()
    autoSaveStatusRef.value = 'saved'
    await flushPromises()
    expect(useSaveStatus().entryFor('scripture:reading-old').status).toBe('saved')

    const second = mountEditor({ readingId: 'reading-new' })
    await flushPromises()
    expect(second.find('[data-testid="save-status"]').text()).toBe('')
    expect(useSaveStatus().entryFor('scripture:reading-new').status).toBe('idle')

    first.unmount()
    second.unmount()
  })

  it('E4 partial backstop (★ sharpest correctness risk): a save armed before the surface id resolves, then the id changing again, must not misattribute the in-flight result to the new id', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    autoSaveStatusRef.value = 'saving'
    await flushPromises()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('')
    expect(Object.keys(useSaveStatus().entries)).toHaveLength(0)

    ;(wrapper.vm as unknown as { currentReadingId: string | null }).currentReadingId = 'reading-old'
    await flushPromises()
    expect(useSaveStatus().entryFor('scripture:reading-old').status).toBe('idle')

    ;(wrapper.vm as unknown as { currentReadingId: string | null }).currentReadingId = 'reading-new'
    await flushPromises()

    autoSaveStatusRef.value = 'saved'
    await flushPromises()

    expect(useSaveStatus().entryFor('scripture:reading-new').status).toBe('idle')
    expect(useSaveStatus().entryFor('scripture:reading-old').status).toBe('saved')
    expect(wrapper.find('[data-testid="save-status"]').text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
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

  // R354/ARCH-003: an org change while mounted must tear down the old
  // readings subscription and re-subscribe with the new orgId.
  it('re-subscribes when props.orgId changes while mounted (R354/ARCH-003)', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    expect(mockSubscribeReadings).toHaveBeenCalledWith('org-1')

    mockUnsubscribeReadings.mockClear()
    mockSubscribeReadings.mockClear()

    await wrapper.setProps({ orgId: 'org-2' })
    await flushPromises()

    expect(mockUnsubscribeReadings).toHaveBeenCalled()
    expect(mockSubscribeReadings).toHaveBeenCalledWith('org-2')
  })
})
