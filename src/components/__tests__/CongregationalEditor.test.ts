import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CongregationalEditor from '../CongregationalEditor.vue'
import { useToasts } from '@/stores/toasts'
import { useAuthStore } from '@/stores/auth'
import type { CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

// Reworked from Phase 47's click-between-verses divider editor into a plain
// `---`-delimited textarea (owner feedback: the divider UX was unintuitive).
// The whole test suite below is a rewrite for that model, not an append.
//
// enableAutoUnmount matches ServiceEditorView.test.ts's precedent: Pinia wraps
// every store action (including toasts.push) to setActivePinia its own pinia
// first, so a leaked wrapper could hijack the globally-active pinia the next
// time the toasts store is touched.
beforeEach(() => {
  setActivePinia(createPinia())
})
enableAutoUnmount(afterEach)

const mockFetchPassageText = vi.fn()
vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: (...args: unknown[]) => mockFetchPassageText(...args),
}))

const mockFetchNltPassageText = vi.fn()
vi.mock('@/utils/nltApi', () => ({
  fetchNltPassageText: (...args: unknown[]) => mockFetchNltPassageText(...args),
}))

const mockSplitCongregationalReading = vi.fn()
vi.mock('@/utils/claudeApi', () => ({
  splitCongregationalReading: (...args: unknown[]) => mockSplitCongregationalReading(...args),
}))

const SAMPLE_REFERENCE: ScriptureRef = { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 }
const SAMPLE_SECTIONS: CongregationalSection[] = [
  { speaker: 'LEADER', text: 'Give thanks to the LORD', verseRange: 'v. 1', translationSource: 'ESV' },
  { speaker: 'CONGREGATION', text: 'for his steadfast love endures forever', verseRange: 'v. 2', translationSource: 'ESV' },
]

// '[N]' verse markers are stripped by stripVerseMarkers on fetch.
const DEFAULT_PASSAGE_TEXT = '[1] Give thanks to the Lord. [2] For his love endures.'
const STRIPPED_PASSAGE_TEXT = 'Give thanks to the Lord. For his love endures.'

function mountEditor(props?: { reference?: ScriptureRef | null; sections?: CongregationalSection[] }) {
  return mount(CongregationalEditor, {
    props: {
      reference: props?.reference ?? SAMPLE_REFERENCE,
      sections: props?.sections ?? [],
    },
  })
}

function textareaEl(wrapper: ReturnType<typeof mountEditor>): HTMLTextAreaElement {
  return wrapper.find('[data-testid="congregational-textarea"]').element as HTMLTextAreaElement
}

function lastEmittedSections(wrapper: ReturnType<typeof mountEditor>): CongregationalSection[] {
  const emits = wrapper.emitted('update:sections')
  return emits![emits!.length - 1]![0] as CongregationalSection[]
}

// Settle the store's onAuthStateChanged listener (which resets settings to
// defaults on the null user) BEFORE applying overrides, so a pending reset
// can't clobber them. Mirrors ServiceEditorView.test.ts's precedent.
async function applySettings(overrides: Partial<{ aiEnabled: boolean; bibleVersion: 'ESV' | 'NLT' }>) {
  const store = useAuthStore()
  await flushPromises()
  Object.assign(store.settings, overrides)
}

describe('CongregationalEditor', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetchPassageText.mockResolvedValue(DEFAULT_PASSAGE_TEXT)
    mockFetchNltPassageText.mockResolvedValue(DEFAULT_PASSAGE_TEXT)
    // WR-02 (82-REVIEW): the AI split button now gates on the two-gate
    // authStore.isAiEnabled (master gate AND settings.aiEnabled), not
    // settings.aiEnabled alone. The real store's aiMasterEnabled ref
    // defaults to false (R242, off-by-default), so it must be set true here
    // to preserve every pre-existing test's assumed "AI on" baseline. The
    // negative master-gate-off case gets its own dedicated test below.
    // Mirrors applySettings' own comment below: the store's
    // onAuthStateChanged listener resets settings/aiMasterEnabled to
    // defaults on the null user asynchronously. Trigger store creation
    // FIRST (registers the listener), THEN let it settle (flushPromises),
    // THEN set aiMasterEnabled -- otherwise the still-pending reset fires
    // after this synchronous assignment and clobbers it back to false.
    const store = useAuthStore()
    await flushPromises()
    store.aiMasterEnabled = true
    // Phase 102 (R296/R297): the real store's bibleApiEnabled ref defaults to
    // false (default OFF, Phase 101), so the dispatcher would return
    // 'disabled' and every existing auto-fetch test below would break unless
    // set true here — mirrors the aiMasterEnabled line above exactly (same
    // flushPromises-then-set ordering, since onAuthStateChanged resets it on
    // the null user). The dedicated disabled-gate test below sets it false.
    store.bibleApiEnabled = true
  })

  // ── Auto-fetch on open (no sections) ────────────────────────────────────

  it('auto-fetches on open when there are no sections, filling the textarea with "Leader\\n<passage>" and routing to NLT by default', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    expect(mockFetchNltPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
    expect(mockFetchPassageText).not.toHaveBeenCalled()
    expect(textareaEl(wrapper).value).toBe(`Leader\n${STRIPPED_PASSAGE_TEXT}`)
  })

  it('captures the NLT version at fetch time and stamps it on the saved sections', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    const sections = lastEmittedSections(wrapper)
    expect(sections).toHaveLength(1)
    expect(sections[0]).toEqual({
      speaker: 'LEADER',
      text: STRIPPED_PASSAGE_TEXT,
      translationSource: 'NLT',
    })
  })

  it('bibleVersion=ESV routes the auto-fetch to the ESV client', async () => {
    await applySettings({ bibleVersion: 'ESV' })
    const wrapper = mountEditor()
    await flushPromises()

    expect(mockFetchPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
    expect(mockFetchNltPassageText).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    expect(lastEmittedSections(wrapper)[0]!.translationSource).toBe('ESV')
  })

  // R128 (Phase 56): a per-item bibleVersion prop overrides the org default for
  // BOTH the split-time fetch AND the stamped translationSource; an absent prop
  // keeps today's org-default behavior.
  it('R128: prop bibleVersion=ESV routes the auto-fetch to ESV and stamps ESV even when the org default is NLT', async () => {
    await applySettings({ bibleVersion: 'NLT' })
    const wrapper = mount(CongregationalEditor, {
      props: { reference: SAMPLE_REFERENCE, sections: [], bibleVersion: 'ESV' as const },
    })
    await flushPromises()

    expect(mockFetchPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
    expect(mockFetchNltPassageText).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    expect(lastEmittedSections(wrapper)[0]!.translationSource).toBe('ESV')
  })

  it('R128: prop bibleVersion=NLT routes the auto-fetch to NLT and stamps NLT even when the org default is ESV', async () => {
    await applySettings({ bibleVersion: 'ESV' })
    const wrapper = mount(CongregationalEditor, {
      props: { reference: SAMPLE_REFERENCE, sections: [], bibleVersion: 'NLT' as const },
    })
    await flushPromises()

    expect(mockFetchNltPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
    expect(mockFetchPassageText).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    expect(lastEmittedSections(wrapper)[0]!.translationSource).toBe('NLT')
  })

  it('R128: no bibleVersion prop keeps the org-default (ESV) fetch and stamp', async () => {
    await applySettings({ bibleVersion: 'ESV' })
    const wrapper = mount(CongregationalEditor, {
      props: { reference: SAMPLE_REFERENCE, sections: [] },
    })
    await flushPromises()

    expect(mockFetchPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
    expect(mockFetchNltPassageText).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    expect(lastEmittedSections(wrapper)[0]!.translationSource).toBe('ESV')
  })

  // ── Open with existing sections (no fetch) ──────────────────────────────

  it('serializes existing sections into the textarea and does NOT fetch', async () => {
    const wrapper = mountEditor({ sections: SAMPLE_SECTIONS })
    await flushPromises()

    expect(mockFetchNltPassageText).not.toHaveBeenCalled()
    expect(mockFetchPassageText).not.toHaveBeenCalled()
    expect(textareaEl(wrapper).value).toBe(
      'Leader\nGive thanks to the LORD\n---\nCongregation\nfor his steadfast love endures forever',
    )
  })

  it('a save of unchanged existing sections preserves the captured translationSource', async () => {
    const wrapper = mountEditor({ sections: SAMPLE_SECTIONS })
    await flushPromises()

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    const sections = lastEmittedSections(wrapper)
    expect(sections).toEqual([
      { speaker: 'LEADER', text: 'Give thanks to the LORD', translationSource: 'ESV' },
      { speaker: 'CONGREGATION', text: 'for his steadfast love endures forever', translationSource: 'ESV' },
    ])
  })

  // ── Insert toolbar (caret insertion) ────────────────────────────────────

  it('each insert button inserts its snippet at the caret', async () => {
    const cases: Array<[string, string]> = [
      ['insert-new-slide', '\n---\n'],
      ['insert-leader', 'Leader\n'],
      ['insert-congregation', 'Congregation\n'],
      ['insert-all', 'All\n'],
    ]
    for (const [testid, snippet] of cases) {
      const wrapper = mountEditor({ sections: SAMPLE_SECTIONS })
      await flushPromises()
      const el = textareaEl(wrapper)
      await wrapper.find('[data-testid="congregational-textarea"]').setValue('AB')
      el.setSelectionRange(1, 1)

      await wrapper.find(`[data-testid="${testid}"]`).trigger('click')
      expect(textareaEl(wrapper).value).toBe(`A${snippet}B`)
    }
  })

  // ── Save ────────────────────────────────────────────────────────────────

  it('Save emits update:sections (parsed with correct speakers) then close', async () => {
    const wrapper = mountEditor({ sections: [] })
    await flushPromises()
    await wrapper.find('[data-testid="congregational-textarea"]').setValue(
      'Leader\nfirst line\n---\nCongregation\nsecond line\n---\nAll\nthird line',
    )

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')

    const sections = lastEmittedSections(wrapper)
    expect(sections.map((s) => s.speaker)).toEqual(['LEADER', 'CONGREGATION', 'ALL'])
    expect(sections.map((s) => s.text)).toEqual(['first line', 'second line', 'third line'])
    // Version captured at fetch (NLT default) is stamped.
    expect(sections.every((s) => s.translationSource === 'NLT')).toBe(true)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  it('Delete → confirm → emits delete then close; Cancel hides the confirm', async () => {
    const wrapper = mountEditor({ sections: SAMPLE_SECTIONS })
    await flushPromises()

    // Cancel path first.
    await wrapper.find('[data-testid="congregational-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="congregational-delete-confirm"]').exists()).toBe(true)
    await wrapper.find('[data-testid="congregational-delete-confirm-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="congregational-delete-confirm"]').exists()).toBe(false)
    expect(wrapper.emitted('delete')).toBeUndefined()

    // Confirm path.
    await wrapper.find('[data-testid="congregational-delete"]').trigger('click')
    await wrapper.find('[data-testid="congregational-delete-confirm-yes"]').trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  // ── AI split (aiEnabled-gated textarea fill) ────────────────────────────

  it('hides the AI split button when aiEnabled is false', async () => {
    await applySettings({ aiEnabled: false })
    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)
  })

  // WR-02 (82-REVIEW): proves the master gate is respected too, not just
  // settings.aiEnabled -- a super-admin-disabled org must hide this
  // affordance even when the church's own settings.aiEnabled reads true.
  it('hides the AI split button when the master gate (aiMasterEnabled) is off, even though settings.aiEnabled is true', async () => {
    useAuthStore().aiMasterEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)
  })

  it('clicking AI split fills the textarea from a mocked splitCongregationalReading result', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(true)

    mockSplitCongregationalReading.mockResolvedValueOnce([
      { speaker: 'LEADER', text: 'Give thanks to the Lord.' },
      { speaker: 'CONGREGATION', text: 'For his love endures.' },
    ])
    await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
    await flushPromises()

    // Called with the fetched raw passage (verse markers already stripped).
    expect(mockSplitCongregationalReading).toHaveBeenCalledWith(STRIPPED_PASSAGE_TEXT)
    expect(textareaEl(wrapper).value).toBe(
      'Leader\nGive thanks to the Lord.\n---\nCongregation\nFor his love endures.',
    )
  })

  it('a failed AI split leaves the textarea untouched and pushes the verbatim toast', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    const before = textareaEl(wrapper).value

    mockSplitCongregationalReading.mockResolvedValueOnce(null)
    await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
    await flushPromises()

    expect(textareaEl(wrapper).value).toBe(before)
    const toasts = useToasts()
    expect(toasts.toasts).toHaveLength(1)
    expect(toasts.toasts[0]!.message).toBe(
      "Couldn't split this passage — your reading is unchanged. Build it by hand or try again.",
    )
  })

  // ── Fetch error + retry ─────────────────────────────────────────────────

  it('shows the fetch-error state on failure and "Try again" re-fetches', async () => {
    mockFetchNltPassageText.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(true)

    mockFetchNltPassageText.mockResolvedValueOnce(DEFAULT_PASSAGE_TEXT)
    await wrapper.find('[data-testid="fetch-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(false)
    expect(textareaEl(wrapper).value).toBe(`Leader\n${STRIPPED_PASSAGE_TEXT}`)
  })

  it('a null reference with no sections goes straight to the fetch-error state (nothing to fetch)', async () => {
    // Mount directly — mountEditor's `?? SAMPLE_REFERENCE` default would
    // collapse an explicit null.
    const wrapper = mount(CongregationalEditor, { props: { reference: null, sections: [] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(true)
    expect(mockFetchNltPassageText).not.toHaveBeenCalled()
  })

  // ── Gated scripture fetch dispatcher (Phase 102, R296/R297) ─────────────

  it('bibleApiEnabled=false: auto-fetch on open (with a valid reference) calls neither client, sets no fetchError, leaves the textarea empty', async () => {
    useAuthStore().bibleApiEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    expect(mockFetchPassageText).not.toHaveBeenCalled()
    expect(mockFetchNltPassageText).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(false)
    expect(textareaEl(wrapper).value).toBe('')
  })

  // ── Manual fallback when Bible API is off (103-02, R298) ────────────────
  // The paste-a-passage textarea (R299) was removed per owner direction
  // (v2.6 Phase-103 follow-up): congregational readings are now composed
  // directly in the existing bottom format textarea, which can be pasted
  // into normally.

  it('renders a correct BibleGateway deep-link for a valid reference', async () => {
    useAuthStore().bibleApiEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    const link = wrapper.findAll('a').find((a) => a.text().includes('Open in BibleGateway'))
    expect(link).toBeTruthy()
    expect(link!.attributes('target')).toBe('_blank')
    expect(link!.attributes('rel')).toBe('noopener')
    expect(link!.attributes('href')).toContain('biblegateway.com/passage')
    expect(link!.attributes('href')).toContain(encodeURIComponent('Psalms 136:1-3'))

    // The existing `---`-delimited textarea remains present and functional.
    expect(wrapper.find('[data-testid="congregational-textarea"]').exists()).toBe(true)
  })

  // Regression (owner direction, v2.6 Phase-103 follow-up): the "Paste the
  // passage text" textarea is gone entirely when the API is off.
  it('does not render the paste textarea when the API is off, while the BibleGateway link is present', async () => {
    useAuthStore().bibleApiEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="congregational-paste-textarea"]').exists()).toBe(false)
    expect(wrapper.find('#congregational-paste-textarea').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Paste the passage text')
    const link = wrapper.findAll('a').find((a) => a.text().includes('Open in BibleGateway'))
    expect(link).toBeTruthy()
  })

  it('typing passage text directly into the bottom format textarea, and a subsequent Save emits sections parsed from it', async () => {
    useAuthStore().bibleApiEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    await wrapper
      .find('[data-testid="congregational-textarea"]')
      .setValue(`Leader\n${STRIPPED_PASSAGE_TEXT}`)

    await wrapper.find('[data-testid="congregational-save"]').trigger('click')
    const sections = lastEmittedSections(wrapper)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.speaker).toBe('LEADER')
    expect(sections[0]!.text).toBe(STRIPPED_PASSAGE_TEXT)
  })

  // INDEPENDENCE (R299): Bible-off + AI-on -- "Split with AI" is visible and
  // splits whatever is typed into the bottom textarea. The AI split gate
  // must never be coupled to isBibleApiEnabled.
  it('INDEPENDENCE: Bible off + AI on -- "Split with AI" is visible after typing into the bottom textarea and splits it', async () => {
    useAuthStore().bibleApiEnabled = false
    // aiMasterEnabled/settings.aiEnabled already true from the outer beforeEach.
    const wrapper = mountEditor()
    await flushPromises()

    await wrapper
      .find('[data-testid="congregational-textarea"]')
      .setValue(STRIPPED_PASSAGE_TEXT)
    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(true)

    mockSplitCongregationalReading.mockResolvedValueOnce([
      { speaker: 'LEADER', text: 'Give thanks to the Lord.' },
      { speaker: 'CONGREGATION', text: 'For his love endures.' },
    ])
    await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
    await flushPromises()

    expect(mockSplitCongregationalReading).toHaveBeenCalledWith(STRIPPED_PASSAGE_TEXT)
    expect(textareaEl(wrapper).value).toBe(
      'Leader\nGive thanks to the Lord.\n---\nCongregation\nFor his love endures.',
    )
  })

  // INDEPENDENCE (R299): Bible-off + AI-off -- no split button, but the
  // bottom textarea still works for manual entry and sectioning.
  it('INDEPENDENCE: Bible off + AI off -- no split button is rendered, but the bottom textarea still works', async () => {
    useAuthStore().bibleApiEnabled = false
    useAuthStore().aiMasterEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)

    await wrapper
      .find('[data-testid="congregational-textarea"]')
      .setValue(`Leader\n${STRIPPED_PASSAGE_TEXT}`)
    expect(textareaEl(wrapper).value).toBe(`Leader\n${STRIPPED_PASSAGE_TEXT}`)
    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)
  })

  it('renders no BibleGateway fallback link when the Bible API is enabled', async () => {
    // bibleApiEnabled=true from the outer beforeEach.
    const wrapper = mountEditor()
    await flushPromises()

    const link = wrapper.findAll('a').find((a) => a.text().includes('Open in BibleGateway'))
    expect(link).toBeFalsy()
    expect(wrapper.find('[data-testid="congregational-paste-textarea"]').exists()).toBe(false)
  })

  // WR-02 (103-REVIEW): text typed directly (any version) must not be
  // stamped with the org's stored bibleVersion -- that setting has no
  // relationship to whatever the user actually typed.
  it('WR-02: Save on a manually-entered reading (Bible API off, never fetched) does not stamp the org-default translationSource', async () => {
    useAuthStore().bibleApiEnabled = false
    const wrapper = mountEditor()
    await flushPromises()

    await wrapper
      .find('[data-testid="congregational-textarea"]')
      .setValue(`Leader\n${STRIPPED_PASSAGE_TEXT}`)
    await wrapper.find('[data-testid="congregational-save"]').trigger('click')

    const sections = lastEmittedSections(wrapper)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.translationSource).toBeUndefined()
  })
})
