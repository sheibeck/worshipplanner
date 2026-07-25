import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import ImportedSlideEditor from '../ImportedSlideEditor.vue'
import type { ImportedDeck } from '@/types/importedDeck'
import type { TextSlide, ImageSlide } from '@/types/slide'

const mockGetDeck = vi.fn<() => Promise<ImportedDeck | null>>(() => Promise.resolve(null))
const mockUpdateDeck = vi.fn(() => Promise.resolve())

vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () =>
    reactive({
      decks: [],
      isLoading: false,
      getDeck: mockGetDeck,
      updateDeck: mockUpdateDeck,
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

function makeSampleSlides(): (TextSlide | ImageSlide)[] {
  return [
    {
      id: 'slide-0',
      position: 0,
      contentKind: 'text',
      title: 'Welcome',
      body: 'Welcome to our service this morning.',
    },
    {
      id: 'slide-1',
      position: 1,
      contentKind: 'image',
      imageUrl: 'https://example.com/slide-1.png',
      altText: 'An announcement graphic',
    },
  ]
}

function makeDeck(overrides?: Partial<ImportedDeck>): ImportedDeck {
  return {
    id: 'import-1',
    sourceFileName: 'announcements.pptx',
    section: 'pre-service',
    slides: makeSampleSlides(),
    createdAt: { seconds: 1000000, nanoseconds: 0 } as never,
    updatedAt: { seconds: 1000000, nanoseconds: 0 } as never,
    ...overrides,
  }
}

function mountEditor(props?: Record<string, unknown>) {
  return mount(ImportedSlideEditor, {
    props: { orgId: 'org-1', ...props },
  })
}

describe('ImportedSlideEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoSaveStatusRef.value = 'idle'
    capturedSaveFn = null
    mockGetDeck.mockResolvedValue(makeDeck())
  })

  it('loads a deck by orgId+importId and renders its slides', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()

    expect(mockGetDeck).toHaveBeenCalledWith('org-1', 'import-1')
    expect(wrapper.find('[data-testid="slides-container"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-card-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-card-1"]').exists()).toBe(true)
  })

  it('renders an editable text body for a text slide', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()

    const body = wrapper.find('[data-testid="slide-body-0"]')
    expect(body.exists()).toBe(true)
    expect((body.element as HTMLTextAreaElement).value).toBe('Welcome to our service this morning.')
  })

  it('renders the image and an editable alt-text field for an image slide', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()

    const img = wrapper.find('[data-testid="slide-image-1"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/slide-1.png')

    const altText = wrapper.find('[data-testid="slide-alttext-1"]')
    expect(altText.exists()).toBe(true)
    expect((altText.element as HTMLInputElement).value).toBe('An announcement graphic')
  })

  it('editing a text body marks the editor dirty and calls updateDeck through auto-save', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()

    const body = wrapper.find('[data-testid="slide-body-0"]')
    await body.setValue('Edited body text')
    await body.trigger('input')

    expect((body.element as HTMLTextAreaElement).value).toBe('Edited body text')
    expect(capturedSaveFn).toBeInstanceOf(Function)

    await capturedSaveFn!()
    expect(mockUpdateDeck).toHaveBeenCalledWith(
      'org-1',
      'import-1',
      expect.objectContaining({
        slides: expect.arrayContaining([
          expect.objectContaining({ id: 'slide-0', body: 'Edited body text' }),
        ]),
      }),
    )
  })

  it('editing image alt text updates local state', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()

    const altText = wrapper.find('[data-testid="slide-alttext-1"]')
    await altText.setValue('Updated alt text')
    await altText.trigger('input')

    expect((altText.element as HTMLInputElement).value).toBe('Updated alt text')
  })

  it('does not fire a save on initial load', async () => {
    mountEditor({ importId: 'import-1' })
    await flushPromises()

    expect(mockUpdateDeck).not.toHaveBeenCalled()
  })

  it('shows save status indicator for each status', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()

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

  it('cleans up auto-save on unmount', async () => {
    const wrapper = mountEditor({ importId: 'import-1' })
    await flushPromises()
    wrapper.unmount()
    expect(mockAutoSaveCleanup).toHaveBeenCalled()
  })

  it('renders an empty state with no importId', async () => {
    const wrapper = mountEditor()
    await flushPromises()

    expect(mockGetDeck).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No slides in this deck.')
  })
})
