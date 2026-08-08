import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CongregationalEditor from '../CongregationalEditor.vue'
import { useToasts } from '@/stores/toasts'
import { useAuthStore } from '@/stores/auth'
import type { CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

// 47-02: this component was reworked from "fetch auto-splits, then a binary
// Leader/Congregation toggle" into a hand-divide editor with three equal
// seeds (AI / Alternate / Blank), a click-between-verses gap-+ divider, and a
// 3-way Leader/Congregation/All chip (R095/R096). Every test below that
// exercised the OLD auto-split-on-fetch / binary-toggle contract has been
// rewritten to the new one — this is not a mechanical append.
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

const mockFetchNltPassageText = vi.fn()
vi.mock('@/utils/nltApi', () => ({
  fetchNltPassageText: (...args: unknown[]) => mockFetchNltPassageText(...args),
}))

// splitPassage is spied (not replaced) — most seed math in the reworked
// component derives boundary indices by matching a seed's returned TEXT
// byte-exactly against sliceAtBoundaries+stripVerseMarkers, the same trick
// the AI seed needs (RESEARCH Pitfall 2). splitPerVerse is left as the real
// implementation throughout (it is not mocked at all) so the Blank seed's
// per-verse boundary alignment is exercised for real.
const mockSplitPassage = vi.fn()
vi.mock('@/utils/scriptureSplitter', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/scriptureSplitter')>('@/utils/scriptureSplitter')
  return {
    ...actual,
    splitPassage: (...args: unknown[]) => mockSplitPassage(...args),
  }
})

const mockSplitCongregationalReading = vi.fn()
vi.mock('@/utils/claudeApi', () => ({
  splitCongregationalReading: (...args: unknown[]) => mockSplitCongregationalReading(...args),
}))

const SAMPLE_REFERENCE: ScriptureRef = { book: 'Psalms', chapter: 136, verseStart: 1, verseEnd: 3 }
const SAMPLE_SECTIONS: CongregationalSection[] = [
  { speaker: 'LEADER', text: 'Give thanks to the LORD', verseRange: 'v. 1' },
  { speaker: 'CONGREGATION', text: 'for his steadfast love endures forever', verseRange: 'v. 2' },
]

// The fixture passage for every fetch-driven test below. Verified offline
// (see 47-02 execution notes) against the real computeBoundaries/
// sliceAtBoundaries/stripVerseMarkers pipeline: it has 8 boundary indices
// (0,1..6,7 — indices 0 and 7 are the anchors), 3 verses, and enough internal
// clause structure (verse 1 has two sentences) that every seed produces a
// segment with at least one interior gap to divide.
const DEFAULT_PASSAGE_TEXT =
  '[1] Leader line one. Leader line one continued. [2] Congregation line two. [3] Leader line three.'

// The two-group split every Alternate/AI seed test below uses. Verified to
// byte-exactly match sliceAtBoundaries(DEFAULT_PASSAGE_TEXT, boundaries, 0, 3)
// and (3, 7) respectively, so alignSegmentsToBoundaries locates them at
// startBoundary/endBoundary 0/3 and 3/7 — the same split either seed's real
// (non-mocked) grouping logic would have produced for this fixture.
const TWO_GROUP_SPLIT_TEXT: [string, string] = [
  'Leader line one. Leader line one continued.',
  'Congregation line two. Leader line three.',
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

function lastEmittedSections(wrapper: ReturnType<typeof mountEditor>): CongregationalSection[] {
  const emits = wrapper.emitted('update:sections')
  return emits![emits!.length - 1]![0] as CongregationalSection[]
}

async function fetchDefaultPassage(wrapper: ReturnType<typeof mountEditor>) {
  await wrapper.find('[data-testid="reference-input"]').setValue('Psalms 136:1-3')
  await wrapper.find('[data-testid="fetch-btn"]').trigger('click')
  await flushPromises()
}

describe('CongregationalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPassageText.mockResolvedValue(DEFAULT_PASSAGE_TEXT)
    mockFetchNltPassageText.mockResolvedValue(DEFAULT_PASSAGE_TEXT)
    mockSplitPassage.mockReturnValue(
      TWO_GROUP_SPLIT_TEXT.map((text, i) => ({ text, verseRange: i === 0 ? '1' : '2-3' })),
    )
  })

  // ── Baseline mount / fetch affordances ──────────────────────────────────

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

  it('does not show sections, seed row, or preview when no passage is fetched', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('[data-testid="sections-container"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="preview-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seed-alternate-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="seed-blank-btn"]').exists()).toBe(false)
  })

  it('shows error message when the (default NLT) fetch fails, and emits nothing', async () => {
    mockFetchNltPassageText.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountEditor()
    await fetchDefaultPassage(wrapper)

    const errorEl = wrapper.find('[data-testid="fetch-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Could not load passage')
    expect(customEmittedKeys(wrapper)).toHaveLength(0)
  })

  it('close control emits close and no section or reference change', async () => {
    const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })
    await wrapper.find('[data-testid="congregational-close-btn"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('update:sections')).toBeUndefined()
    expect(wrapper.emitted('update:reference')).toBeUndefined()
  })

  // ── Mounted with already-persisted sections (no fetch yet this session) ──

  describe('mounted with existing sections', () => {
    it('pre-fills the reference input and renders both sections in the preview, with no divider affordances', () => {
      const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

      expect(
        (wrapper.find('[data-testid="reference-input"]').element as HTMLInputElement).value,
      ).toBe('Psalms 136:1-3')
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="preview-section-0"]').text()).toContain(SAMPLE_SECTIONS[0]!.text)
      expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain(SAMPLE_SECTIONS[1]!.text)
      // No boundaries exist yet (rawText is fetch-only) — no divide affordance.
      expect(wrapper.find('[data-testid^="divider-insert-"]').exists()).toBe(false)
    })

    it('the 3-way chip still works for relabeling and emits update:sections with only that section changed', async () => {
      const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

      await wrapper.find('[data-testid="speaker-chip-1-leader"]').trigger('click')

      const emitted = lastEmittedSections(wrapper)
      expect(emitted[0]).toEqual(SAMPLE_SECTIONS[0])
      expect(emitted[1]).toEqual({ ...SAMPLE_SECTIONS[1], speaker: 'LEADER' })
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Leader:')
    })

    it('the chip supports the ALL role on a mounted section', async () => {
      const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

      await wrapper.find('[data-testid="speaker-chip-0-all"]').trigger('click')

      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('All:')
      const emitted = lastEmittedSections(wrapper)
      expect(emitted[0]!.speaker).toBe('ALL')
    })

    it('mounted over an existing AI-generated split with AI off: content is unaltered and a hand relabel still applies', async () => {
      useAuthStore().settings.aiEnabled = false
      const wrapper = mountEditor({ reference: SAMPLE_REFERENCE, sections: SAMPLE_SECTIONS })

      expect(wrapper.find('[data-testid="preview-section-0"]').text()).toContain(SAMPLE_SECTIONS[0]!.text)
      expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain(SAMPLE_SECTIONS[1]!.text)
      expect(mockSplitCongregationalReading).not.toHaveBeenCalled()

      await wrapper.find('[data-testid="speaker-chip-1-leader"]').trigger('click')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Leader:')
    })
  })

  // ── R096: fetch renders raw text only — no auto-split, three equal seeds ─

  describe('after fetch: three equal seeds, no auto-split', () => {
    it('renders one undivided Leader block and a "Choose a starting point" row with all three seeds (AI on)', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      expect(wrapper.find('[data-testid="sections-container"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(1)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="seed-alternate-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="seed-blank-btn"]').exists()).toBe(true)

      // Prohibition: fetch never auto-commits any seed.
      expect(mockSplitCongregationalReading).not.toHaveBeenCalled()
      expect(mockSplitPassage).not.toHaveBeenCalled()
    })

    it('emits update:reference then update:sections (one Leader section) on fetch', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      expect(customEmittedKeys(wrapper)).toEqual(['update:reference', 'update:sections'])
      const refEmits = wrapper.emitted('update:reference')
      expect(refEmits![0]).toEqual([SAMPLE_REFERENCE])

      const sections = lastEmittedSections(wrapper)
      expect(sections).toHaveLength(1)
      expect(sections[0]!.speaker).toBe('LEADER')
    })

    it('AI-off: ai-split-btn is absent while the other two seeds remain present and fully functional', async () => {
      const wrapper = mountEditor()
      // See the "explicit ESV fetch fails" precedent elsewhere in this
      // file — the setting is mutated only after the store's own async
      // onAuthStateChanged listener settles, otherwise this mutation can be
      // silently overwritten by that unrelated reset.
      await flushPromises()
      useAuthStore().settings.aiEnabled = false
      await fetchDefaultPassage(wrapper)

      expect(wrapper.find('[data-testid="ai-split-btn"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="seed-alternate-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="seed-blank-btn"]').exists()).toBe(true)

      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)
    })

    it('Pitfall 3: a passage with no internal boundary still renders one undivided block; AI stays disabled, Blank/Alternate stay usable', async () => {
      mockFetchNltPassageText.mockResolvedValueOnce('no boundaries here at all')
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      expect(wrapper.find('[data-testid="sections-container"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(1)

      const aiBtn = wrapper.find('[data-testid="ai-split-btn"]')
      expect(aiBtn.attributes('disabled')).toBeDefined()
      await aiBtn.trigger('click')
      await flushPromises()
      expect(mockSplitCongregationalReading).not.toHaveBeenCalled()

      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(1)
    })
  })

  // ── The three seeds ──────────────────────────────────────────────────────

  describe('Start Blank seed', () => {
    it('produces one segment per verse, all Leader, and does not call splitPassage', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()

      const previews = wrapper.findAll('[data-testid^="preview-section-"]')
      expect(previews).toHaveLength(3)
      for (let i = 0; i < 3; i++) {
        expect(wrapper.find(`[data-testid="preview-label-${i}"]`).text()).toBe('Leader:')
      }
      expect(mockSplitPassage).not.toHaveBeenCalled()
    })
  })

  describe('Alternate Leader/Congregation seed', () => {
    it('reproduces alternating Leader/Congregation from splitPassage grouping, boundary-aligned', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      await wrapper.find('[data-testid="seed-alternate-btn"]').trigger('click')
      await flushPromises()

      expect(mockSplitPassage).toHaveBeenCalledTimes(1)
      const previews = wrapper.findAll('[data-testid^="preview-section-"]')
      expect(previews).toHaveLength(2)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="preview-section-0"]').text()).toContain(TWO_GROUP_SPLIT_TEXT[0])
      expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain(TWO_GROUP_SPLIT_TEXT[1])
    })
  })

  describe('Split with AI seed', () => {
    it('maps the AI result into the boundary-indexed draft, and the resulting segment is sub-dividable', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      mockSplitCongregationalReading.mockResolvedValueOnce([
        { speaker: 'LEADER', text: TWO_GROUP_SPLIT_TEXT[0] },
        { speaker: 'CONGREGATION', text: TWO_GROUP_SPLIT_TEXT[1] },
      ])
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      expect(mockSplitCongregationalReading).toHaveBeenCalledWith(DEFAULT_PASSAGE_TEXT)
      let previews = wrapper.findAll('[data-testid^="preview-section-"]')
      expect(previews).toHaveLength(2)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')

      // Sub-divide the AI-produced CONGREGATION segment: pick the LAST
      // insert-gap in the document — it always belongs to the final (here,
      // CONGREGATION) segment, since gaps render in ascending boundary order
      // and the AI segment's own gaps sort after the LEADER segment's.
      const gaps = wrapper.findAll('[data-testid^="divider-insert-"]')
      expect(gaps.length).toBeGreaterThan(0)
      await gaps[gaps.length - 1]!.trigger('click')
      await flushPromises()

      previews = wrapper.findAll('[data-testid^="preview-section-"]')
      expect(previews).toHaveLength(3)
      // The new lower segment inherits the SAME speaker as its parent.
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="preview-label-2"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="preview-section-1"]').text()).toContain('Congregation line two.')
      expect(wrapper.find('[data-testid="preview-section-2"]').text()).toContain('Leader line three.')
      // Segment 0 (LEADER) is untouched by the split of segment 1.
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
    })

    it('failure: pushes exactly one verbatim toast, leaves the draft byte-identical, and emits no extra update:sections', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)
      const emissionsBefore = wrapper.emitted('update:sections')!.length

      mockSplitCongregationalReading.mockResolvedValueOnce(null)
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()

      const toasts = useToasts()
      expect(toasts.toasts).toHaveLength(1)
      expect(toasts.toasts[0]!.message).toBe(
        "Couldn't split this passage — your reading is unchanged. Build it by hand or try again.",
      )
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(1)
      expect(wrapper.emitted('update:sections')!.length).toBe(emissionsBefore)
    })
  })

  // ── CR-01 (47-REVIEW): async AI-split race safety ───────────────────────

  describe('CR-01: in-flight AI split does not silently overwrite a later edit', () => {
    it('disables Fetch/Alternate/Blank while an AI split is in flight, and re-enables them once it resolves', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      let resolveSplit!: (value: CongregationalSection[] | null) => void
      mockSplitCongregationalReading.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSplit = resolve
        }),
      )
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')

      expect(wrapper.find('[data-testid="fetch-btn"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="seed-alternate-btn"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="seed-blank-btn"]').attributes('disabled')).toBeDefined()

      resolveSplit(null)
      await flushPromises()

      expect(wrapper.find('[data-testid="fetch-btn"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-testid="seed-alternate-btn"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-testid="seed-blank-btn"]').attributes('disabled')).toBeUndefined()
    })

    it('a hand edit made while the AI request is in flight defers the resolving result behind the re-seed confirm instead of silently overwriting it, and confirming applies it without a second network call', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      let resolveSplit!: (value: CongregationalSection[] | null) => void
      mockSplitCongregationalReading.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSplit = resolve
        }),
      )
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')

      // Hand-edit the still-undivided Leader block while the AI call is
      // outstanding — the chip control is not blocked during isSplitting.
      await wrapper.find('[data-testid="speaker-chip-0-congregation"]').trigger('click')
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')
      const emissionsBeforeResolve = wrapper.emitted('update:sections')!.length

      resolveSplit([
        { speaker: 'LEADER', text: TWO_GROUP_SPLIT_TEXT[0] },
        { speaker: 'CONGREGATION', text: TWO_GROUP_SPLIT_TEXT[1] },
      ])
      await flushPromises()

      // Not silently applied: the hand edit is still showing, gated behind
      // the same confirm a same-tick re-seed click would show.
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(true)
      expect(wrapper.emitted('update:sections')!.length).toBe(emissionsBeforeResolve)

      await wrapper.find('[data-testid="reseed-confirm-replace"]').trigger('click')
      await flushPromises()

      // Confirming applies the ALREADY-fetched AI result directly — no
      // second call to splitCongregationalReading.
      expect(mockSplitCongregationalReading).toHaveBeenCalledTimes(1)
      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(false)
      const previews = wrapper.findAll('[data-testid^="preview-section-"]')
      expect(previews).toHaveLength(2)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')
    })

    it('cancelling the re-seed confirm after a mid-flight hand edit discards the deferred AI result and keeps the hand edit', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      let resolveSplit!: (value: CongregationalSection[] | null) => void
      mockSplitCongregationalReading.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSplit = resolve
        }),
      )
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await wrapper.find('[data-testid="speaker-chip-0-congregation"]').trigger('click')

      resolveSplit([
        { speaker: 'LEADER', text: TWO_GROUP_SPLIT_TEXT[0] },
        { speaker: 'CONGREGATION', text: TWO_GROUP_SPLIT_TEXT[1] },
      ])
      await flushPromises()
      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(true)

      await wrapper.find('[data-testid="reseed-confirm-cancel"]').trigger('click')

      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(1)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')

      // The discarded deferred result must not resurface on a later,
      // unrelated re-seed confirm.
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      const confirm = wrapper.find('[data-testid="reseed-confirm"]')
      expect(confirm.exists()).toBe(true)
      await wrapper.find('[data-testid="reseed-confirm-replace"]').trigger('click')
      await flushPromises()
      expect(mockSplitCongregationalReading).toHaveBeenCalledTimes(1)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)
    })
  })

  // ── R095: hand-divide — insert / remove, 3-way chip ─────────────────────

  describe('divider editing', () => {
    async function seedTwoSegments(wrapper: ReturnType<typeof mountEditor>) {
      await fetchDefaultPassage(wrapper)
      mockSplitCongregationalReading.mockResolvedValueOnce([
        { speaker: 'LEADER', text: TWO_GROUP_SPLIT_TEXT[0] },
        { speaker: 'CONGREGATION', text: TWO_GROUP_SPLIT_TEXT[1] },
      ])
      await wrapper.find('[data-testid="ai-split-btn"]').trigger('click')
      await flushPromises()
    }

    it('clicking a gap-+ inserts a divider, splitting one segment into two that together reconstruct the original text', async () => {
      const wrapper = mountEditor()
      await seedTwoSegments(wrapper)

      const gaps = wrapper.findAll('[data-testid^="divider-insert-"]')
      await gaps[gaps.length - 1]!.trigger('click')
      await flushPromises()

      const sections = lastEmittedSections(wrapper)
      expect(sections).toHaveLength(3)
      // Nothing lost: rejoining the split halves with a single space
      // reconstructs the pre-split segment's text exactly.
      expect(`${sections[1]!.text} ${sections[2]!.text}`).toBe(TWO_GROUP_SPLIT_TEXT[1])
    })

    it('clicking an existing divider removes it, merging the neighbours and keeping the UPPER segment speaker', async () => {
      const wrapper = mountEditor()
      await seedTwoSegments(wrapper)

      const removeBtn = wrapper.find('[data-testid^="divider-remove-"]')
      expect(removeBtn.exists()).toBe(true)
      await removeBtn.trigger('click')
      await flushPromises()

      const sections = lastEmittedSections(wrapper)
      expect(sections).toHaveLength(1)
      expect(sections[0]!.speaker).toBe('LEADER')
      expect(sections[0]!.text).toBe(`${TWO_GROUP_SPLIT_TEXT[0]} ${TWO_GROUP_SPLIT_TEXT[1]}`)
    })

    it('the 3-way chip sets each segment independently — a non-adjacent refrain (Psalm 136) shares a label with a different role in between', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)

      await wrapper.find('[data-testid="speaker-chip-0-congregation"]').trigger('click')
      await wrapper.find('[data-testid="speaker-chip-2-congregation"]').trigger('click')

      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="preview-label-2"]').text()).toBe('Congregation:')
    })

    it('the chip supports the ALL role', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="speaker-chip-1-all"]').trigger('click')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('All:')
    })
  })

  // ── R096: re-seed confirm ────────────────────────────────────────────────

  describe('re-seed confirm', () => {
    it('applies the FIRST seed on a freshly-fetched, never-edited draft with no confirm', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)
    })

    it('shows a confirm on re-seeding after a manual edit; cancel leaves the draft untouched', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()

      // Manual edit: relabel one segment.
      await wrapper.find('[data-testid="speaker-chip-0-congregation"]').trigger('click')

      await wrapper.find('[data-testid="seed-alternate-btn"]').trigger('click')
      const confirm = wrapper.find('[data-testid="reseed-confirm"]')
      expect(confirm.exists()).toBe(true)
      expect(confirm.text()).toContain('Replace your dividers?')
      // Not yet applied — still the Blank seed's 3 segments with the manual edit.
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')

      await wrapper.find('[data-testid="reseed-confirm-cancel"]').trigger('click')
      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Congregation:')
    })

    it('confirming replace applies the new seed', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()
      await wrapper.find('[data-testid="speaker-chip-0-congregation"]').trigger('click')

      await wrapper.find('[data-testid="seed-alternate-btn"]').trigger('click')
      await wrapper.find('[data-testid="reseed-confirm-replace"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(2)
      expect(wrapper.find('[data-testid="preview-label-0"]').text()).toBe('Leader:')
      expect(wrapper.find('[data-testid="preview-label-1"]').text()).toBe('Congregation:')

      // A fresh seed re-applies without a confirm until the user edits again.
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="reseed-confirm"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid^="preview-section-"]')).toHaveLength(3)
    })
  })

  // ── ESV/NLT routing + translationSource stamping (45-04/R092) ───────────

  describe('ESV/NLT routing + translationSource stamping', () => {
    it('bibleVersion defaults to NLT (45-02) and fetch routes to nltApi, not esvApi', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      expect(mockFetchNltPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
      expect(mockFetchPassageText).not.toHaveBeenCalled()
    })

    it('bibleVersion=ESV routes fetch to esvApi, not nltApi', async () => {
      const wrapper = mountEditor()
      await flushPromises()
      useAuthStore().settings.bibleVersion = 'ESV'
      await fetchDefaultPassage(wrapper)

      expect(mockFetchPassageText).toHaveBeenCalledWith('Psalms 136:1-3')
      expect(mockFetchNltPassageText).not.toHaveBeenCalled()
    })

    it('R092: a settings change AFTER fetch does not restamp — survives a seed AND a subsequent divider edit', async () => {
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)
      expect(lastEmittedSections(wrapper).every((s) => s.translationSource === 'NLT')).toBe(true)

      // Flip the church's setting AFTER the fetch.
      useAuthStore().settings.bibleVersion = 'ESV'

      // First seed on the unedited draft applies immediately.
      await wrapper.find('[data-testid="seed-blank-btn"]').trigger('click')
      await flushPromises()
      let sections = lastEmittedSections(wrapper)
      expect(sections).toHaveLength(3)
      expect(sections.every((s) => s.translationSource === 'NLT')).toBe(true)

      // A subsequent divider edit must not restamp either.
      const gaps = wrapper.findAll('[data-testid^="divider-insert-"]')
      expect(gaps.length).toBeGreaterThan(0)
      await gaps[0]!.trigger('click')
      await flushPromises()
      sections = lastEmittedSections(wrapper)
      expect(sections.length).toBeGreaterThan(3)
      expect(sections.every((s) => s.translationSource === 'NLT')).toBe(true)
    })

    it('a fetch failure surfaces the shared fetchError contract identically for the NLT client', async () => {
      mockFetchNltPassageText.mockRejectedValueOnce(new Error('boom'))
      const wrapper = mountEditor()
      await fetchDefaultPassage(wrapper)

      expect(wrapper.find('[data-testid="fetch-error"]').exists()).toBe(true)
    })
  })
})
