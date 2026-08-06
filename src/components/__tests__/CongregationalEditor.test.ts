import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CongregationalEditor from '../CongregationalEditor.vue'
import { useToasts } from '@/stores/toasts'
import { useAuthStore } from '@/stores/auth'
import type { ScriptureSlide, CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

// 34-06: this component is now a controlled prop/emit component that
// persists NOTHING itself — the reading-document store (`useScriptureSlides`)
// and auto-save/save-status machinery it used to own were removed, so those
// mocks and the tests that asserted against them are gone too.
//
// enableAutoUnmount (matching ServiceEditorView.test.ts's own precedent) is
// still load-bearing: Pinia wraps every store action (including
// `toasts.push`) to call `setActivePinia(itsOwnPinia)` before running, so a
// single un-unmounted wrapper from an earlier test could still hijack the
// globally-active Pinia the next time the (real) toasts store is touched.
beforeEach(() => {
  setActivePinia(createPinia())
})
enableAutoUnmount(afterEach)

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

const SAMPLE_REFERENCE: ScriptureRef = { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 }
const SAMPLE_SECTIONS: CongregationalSection[] = [
  { speaker: 'LEADER', text: 'Give thanks to the LORD', verseRange: 'v. 1' },
  { speaker: 'CONGREGATION', text: 'for his steadfast love endures forever', verseRange: 'v. 2' },
]

function mountEditor(props?: { reference?: ScriptureRef | null; sections?: CongregationalSection[] }) {
  return mount(CongregationalEditor, {
    props: {
      reference: props?.reference ?? null,
      sections: props?.sections ?? [],
    },
  })
}

// @vue/test-utils's wrapper.emitted() also records the RAW native DOM events
// dispatched by `.trigger()`/`.setValue()` (e.g. 'input', 'change', 'click'
// bubbling off the reference input / fetch button) alongside this
// component's own custom emits — not just events sent through Vue's `emit`.
// Any test that both interacts with the DOM and asserts on the emitted-event
// set must filter down to this component's declared contract first.
const CUSTOM_EVENT_NAMES = ['update:sections', 'update:reference', 'close']
function customEmittedKeys(wrapper: ReturnType<typeof mountEditor>): string[] {
  return Object.keys(wrapper.emitted()).filter((key) => CUSTOM_EVENT_NAMES.includes(key))
}

describe('CongregationalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPassageText.mockResolvedValue('[1] Give thanks to the LORD...')
    mockSplitPassage.mockReturnValue(makeSampleSlides())
  })

  it('renders reference input and fetch button, and emits nothing on a bare mount', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('[data-testid="reference-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fetch-btn"]').exists()).toBe(true)
    expect(Object.keys(wrapper.emitted())).toHaveLength(0)
  })

  it('fetch button is disabled when reference is empty', () => {
    const wrapper = mountEditor()
    const btn = wrapper.find('[data-testid="fetch-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('mounted with two sections and a reference: reference input is pre-filled and both sections render', () => {
    const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

    expect((wrapper.find('[data-testid="reference-input"]').element as HTMLInputElement).value).toBe(
      'Psalms 136:1-3',
    )
    expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
    expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Congregation')
    expect(wrapper.find('[data-testid="preview-section-0"]').text()).toContain(SAMPLE_SECTIONS[0]!.text)
    expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain(SAMPLE_SECTIONS[1]!.text)
  })

  it('prohibition: mounting with populated props and immediately unmounting emits zero events', () => {
    const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })
    expect(Object.keys(wrapper.emitted())).toHaveLength(0)

    wrapper.unmount()
    expect(Object.keys(wrapper.emitted())).toHaveLength(0)
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

  it('Fetch Passage success emits update:reference then update:sections with alternating speakers', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    // Object key insertion order proves emission order: update:reference,
    // then update:sections — the reference the user fetched must never be
    // recorded as belonging to a different passage than the sections.
    expect(customEmittedKeys(wrapper)).toEqual(['update:reference', 'update:sections'])

    const refEmits = wrapper.emitted('update:reference')
    expect(refEmits).toHaveLength(1)
    expect(refEmits![0]).toEqual([SAMPLE_REFERENCE])

    const sectionsEmits = wrapper.emitted('update:sections')
    expect(sectionsEmits).toHaveLength(1)
    expect(sectionsEmits![0]![0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ speaker: 'LEADER' }),
        expect.objectContaining({ speaker: 'CONGREGATION' }),
      ]),
    )
  })

  it('prohibition: a successful onFetchPassage does not call the AI split util at all', async () => {
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    expect(mockSplitCongregationalReading).not.toHaveBeenCalled()
  })

  it('toggling speaker role updates section assignment and emits update:sections with the flipped speaker only', async () => {
    const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

    expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Congregation')
    await wrapper.find('[data-testid="speaker-toggle-1"]').trigger('click')
    expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Leader')

    const emits = wrapper.emitted('update:sections')
    expect(emits).toHaveLength(1)
    const emitted = emits![0]![0] as CongregationalSection[]
    expect(emitted[0]).toEqual(SAMPLE_SECTIONS[0])
    expect(emitted[1]).toEqual({ ...SAMPLE_SECTIONS[1], speaker: 'LEADER' })
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

  it('shows error message when ESV fetch fails, and emits nothing', async () => {
    mockFetchPassageText.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountEditor()
    await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
    await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
    await flushPromises()

    const errorEl = wrapper.find('[data-testid="fetch-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Could not load passage')
    expect(customEmittedKeys(wrapper)).toHaveLength(0)
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

  it('close control emits close and no section or reference change', async () => {
    const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })
    await wrapper.find('[data-testid="congregational-close-btn"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('update:sections')).toBeUndefined()
    expect(wrapper.emitted('update:reference')).toBeUndefined()
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

    it('on success, replaces sections wholesale in the returned order and emits update:sections — never merged, appended, or re-sorted', async () => {
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

      // update:sections is emitted twice here — once by the preceding fetch,
      // once by the split — the split's own emission is the last one and
      // carries exactly the returned array.
      const sectionsEmits = wrapper.emitted('update:sections')
      expect(sectionsEmits).toHaveLength(2)
      expect(sectionsEmits![1]![0]).toEqual(aiSections)
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

  // ── 34-04 Task 2: the failure path and the manual-path regression proof ────

  describe('AI split (34-04, Task 2: failure path)', () => {
    const FAILURE_TOAST_TEXT =
      "Couldn't split this passage — your reading is unchanged. Build it by hand or try again."

    beforeEach(() => {
      mockSplitCongregationalReading.mockReset()
    })

    async function fetchAndPrime(wrapper: ReturnType<typeof mountEditor>) {
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()
    }

    // Reads a snapshot of the rendered sections (speaker + text per row) via
    // the DOM rather than an internal expose — `draftSections` itself is not
    // part of this component's public seam (there is no defineExpose at all
    // any more), so the DOM is the honest external observation point for
    // "did anything change".
    function sectionsSnapshot(wrapper: ReturnType<typeof mountEditor>) {
      const toggles = wrapper.findAll('[data-testid^="speaker-toggle-"]')
      return toggles.map((toggle, idx) => ({
        speaker: toggle.text(),
        text: wrapper.find(`[data-testid="preview-section-${idx}"] span:last-child`).text(),
      }))
    }

    it('pushes exactly one verbatim toast, leaves sections byte-identical, and emits no additional update:sections when the split resolves null', async () => {
      const wrapper = mountEditor()
      await fetchAndPrime(wrapper)
      const before = sectionsSnapshot(wrapper)
      // The preceding fetch already emitted update:sections once (34-06's
      // contract); a failed split must add NO further emission. Since a
      // split can only be attempted after a fetch (rawText is fetch-only,
      // per 34-06's documented AI-split-needs-a-fetch-first consequence),
      // "wrapper.emitted('update:sections') is undefined" cannot be tested
      // literally in this state — the count-stays-flat assertion below is
      // the equivalent proof.
      const emissionsBeforeSplit = wrapper.emitted('update:sections')?.length ?? 0

      mockSplitCongregationalReading.mockResolvedValueOnce(null)
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      const toasts = useToasts()
      expect(toasts.toasts).toHaveLength(1)
      expect(toasts.toasts[0]!.message).toBe(FAILURE_TOAST_TEXT)
      expect(sectionsSnapshot(wrapper)).toEqual(before)
      expect(wrapper.emitted('update:sections')?.length ?? 0).toBe(emissionsBeforeSplit)
    })

    it('pushes the same toast, leaves sections unchanged and emits no additional update:sections when the split call rejects, with no error escaping the handler', async () => {
      const wrapper = mountEditor()
      await fetchAndPrime(wrapper)
      const before = sectionsSnapshot(wrapper)
      const emissionsBeforeSplit = wrapper.emitted('update:sections')?.length ?? 0

      mockSplitCongregationalReading.mockRejectedValueOnce(new Error('network down'))

      await expect(
        wrapper.find('[data-testid="ai-split-btn"]').trigger('click'),
      ).resolves.not.toThrow()
      await flushPromises()

      const toasts = useToasts()
      expect(toasts.toasts).toHaveLength(1)
      expect(toasts.toasts[0]!.message).toBe(FAILURE_TOAST_TEXT)
      expect(sectionsSnapshot(wrapper)).toEqual(before)
      expect(wrapper.emitted('update:sections')?.length ?? 0).toBe(emissionsBeforeSplit)
    })

    it('clears isSplitting (button usable again) after both a null result and a rejection', async () => {
      const wrapper = mountEditor()
      await fetchAndPrime(wrapper)

      mockSplitCongregationalReading.mockResolvedValueOnce(null)
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="ai-split-btn"]').attributes('disabled')).toBeUndefined()

      mockSplitCongregationalReading.mockRejectedValueOnce(new Error('boom'))
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="ai-split-btn"]').attributes('disabled')).toBeUndefined()
    })

    it('pushes no toast on a successful split — this surface is failure-only', async () => {
      const wrapper = mountEditor()
      await fetchAndPrime(wrapper)

      mockSplitCongregationalReading.mockResolvedValueOnce([
        { speaker: 'LEADER', text: 'a' },
        { speaker: 'CONGREGATION', text: 'b' },
      ])
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      expect(useToasts().toasts).toHaveLength(0)
    })

    it('regression: after a failed split, the manual speaker-toggle still works and the manual Fetch Passage flow still rebuilds sections', async () => {
      const wrapper = mountEditor()
      await fetchAndPrime(wrapper)

      mockSplitCongregationalReading.mockResolvedValueOnce(null)
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      // Manual toggle still works.
      expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
      await wrapper.find('[data-testid="speaker-toggle-0"]').trigger('click')
      expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Congregation')

      // Manual fetch-and-build flow still works, from scratch.
      mockSplitPassage.mockReturnValueOnce(makeSampleSlides())
      await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
      await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
      expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Congregation')
      expect(wrapper.find('[data-testid="speaker-toggle-2"]').text()).toBe('Leader')
    })

    it('does not add any new data-testid beyond ai-split-btn and congregational-close-btn', () => {
      const wrapper = mountEditor()
      const html = wrapper.html()
      const testIds = [...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]!)
      const knownPrefixes = [
        'reference-input',
        'fetch-btn',
        'ai-split-btn',
        'fetch-error',
        'sections-container',
        'speaker-toggle-',
        'preview-panel',
        'preview-section-',
        'preview-label-',
        'congregational-close-btn',
      ]
      for (const id of testIds) {
        expect(knownPrefixes.some((prefix) => id === prefix || id.startsWith(prefix))).toBe(true)
      }
    })
  })

  // ── 39-04: AI toggle — hide the AI split button, prove existing splits ────
  // are never altered when AI is off. A real Pinia is already active
  // (beforeEach above) and useAuthStore().settings is a plain writable ref
  // defaulting to DEFAULT_ORG_SETTINGS (aiEnabled: true), so tests flip it
  // directly rather than mocking the store.
  describe('AI toggle (39-04)', () => {
    it('renders the AI split button when AI is on', () => {
      const wrapper = mountEditor()
      expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(true)
    })

    it('hides the AI split button when AI is off, while Fetch Passage and the reference input still render', () => {
      useAuthStore().settings.aiEnabled = false
      const wrapper = mountEditor()

      expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="fetch-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="reference-input"]').exists()).toBe(true)
    })

    it('mounted over an existing AI-generated split with AI off: content is unaltered and a hand edit (speaker toggle) still applies', async () => {
      useAuthStore().settings.aiEnabled = false
      const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

      // Not cleared, not regenerated, not made read-only — every section
      // renders exactly the content passed in.
      expect(wrapper.find('[data-testid="preview-section-0"]').text()).toContain(SAMPLE_SECTIONS[0]!.text)
      expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain(SAMPLE_SECTIONS[1]!.text)
      expect(wrapper.find('[data-testid="speaker-toggle-0"]').text()).toBe('Leader')
      expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Congregation')
      expect(mockSplitCongregationalReading).not.toHaveBeenCalled()

      // Hand-dividing still works: a speaker toggle takes effect and is
      // reported upward via update:sections, same as with AI on.
      await wrapper.find('[data-testid="speaker-toggle-1"]').trigger('click')
      expect(wrapper.find('[data-testid="speaker-toggle-1"]').text()).toBe('Leader')

      const emits = wrapper.emitted('update:sections')
      expect(emits).toHaveLength(1)
      const emitted = emits![0]![0] as CongregationalSection[]
      expect(emitted[0]).toEqual(SAMPLE_SECTIONS[0])
      expect(emitted[1]).toEqual({ ...SAMPLE_SECTIONS[1], speaker: 'LEADER' })
    })
  })
})
