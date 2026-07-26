import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, h, nextTick } from 'vue'
import type { ScriptureSlot } from '@/types/service'

vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () => ({
    readings: [],
    isLoading: false,
    currentReading: null,
    subscribeReadings: vi.fn(),
    unsubscribeReadings: vi.fn(),
    createReading: vi.fn(() => Promise.resolve('new-id')),
    updateReading: vi.fn(() => Promise.resolve()),
    getReading: vi.fn(() => Promise.resolve(null)),
  }),
}))

vi.mock('@/composables/useAutoSave', () => ({
  useAutoSave: vi.fn(() => ({
    status: ref('idle'),
    flush: vi.fn(),
    cleanup: vi.fn(),
  })),
}))

vi.mock('@/utils/esvApi', () => ({
  fetchPassageText: vi.fn(() => Promise.resolve('')),
}))

vi.mock('@/utils/scriptureSplitter', () => ({
  splitPassage: vi.fn(() => []),
}))

const ScriptureSlideEditorStub = defineComponent({
  name: 'ScriptureSlideEditor',
  props: { orgId: String, readingId: String },
  template: '<div data-testid="scripture-slide-editor">ScriptureSlideEditor</div>',
})

const CongregationalEditorStub = defineComponent({
  name: 'CongregationalEditor',
  props: { orgId: String, readingId: String },
  template: '<div data-testid="congregational-editor">CongregationalEditor</div>',
})

function makeScriptureSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-0',
    position: 0,
    book: 'Romans',
    chapter: 8,
    verseStart: 28,
    verseEnd: 39,
    readingMode: 'normal',
    ...overrides,
  }
}

const TestWrapper = defineComponent({
  components: { ScriptureSlideEditorStub, CongregationalEditorStub },
  props: {
    slot: { type: Object, required: true },
    isEditor: { type: Boolean, default: true },
    isExportedLocked: { type: Boolean, default: false },
    orgId: { type: String, default: 'org-1' },
  },
  setup(props) {
    const localSlot = ref<ScriptureSlot>({ ...props.slot } as ScriptureSlot)
    const expanded = ref(false)

    function getReadingMode(): 'normal' | 'congregational' {
      return localSlot.value.readingMode ?? 'normal'
    }

    function setReadingMode(mode: 'normal' | 'congregational') {
      localSlot.value = { ...localSlot.value, readingMode: mode }
    }

    function toggleEditor() {
      expanded.value = !expanded.value
    }

    function hasReference(): boolean {
      return !!(localSlot.value.book && localSlot.value.chapter && localSlot.value.verseStart)
    }

    return { localSlot, expanded, getReadingMode, setReadingMode, toggleEditor, hasReference }
  },
  template: `
    <div>
      <p class="text-xs" data-testid="slot-label">Scripture Reading</p>
      <p data-testid="reference-display">
        {{ localSlot.book }} {{ localSlot.chapter }}:{{ localSlot.verseStart }}-{{ localSlot.verseEnd }}
      </p>

      <div v-if="isEditor && !isExportedLocked && hasReference()">
        <div class="flex items-center gap-3">
          <button
            type="button"
            data-testid="edit-scripture-slides-btn"
            @click="toggleEditor"
          >
            {{ expanded ? 'Close Slides Editor' : 'Edit Scripture Slides' }}
          </button>

          <div v-if="expanded" data-testid="reading-mode-toggle">
            <button
              type="button"
              data-testid="mode-normal"
              :class="{ active: getReadingMode() === 'normal' }"
              @click="setReadingMode('normal')"
            >Normal Reading</button>
            <button
              type="button"
              data-testid="mode-congregational"
              :class="{ active: getReadingMode() === 'congregational' }"
              @click="setReadingMode('congregational')"
            >Congregational Reading</button>
          </div>
        </div>

        <div v-if="expanded" data-testid="scripture-editor-panel">
          <ScriptureSlideEditorStub
            v-if="getReadingMode() === 'normal'"
            :orgId="orgId"
            :readingId="localSlot.scriptureReadingId ?? undefined"
          />
          <CongregationalEditorStub
            v-else
            :orgId="orgId"
            :readingId="localSlot.scriptureReadingId ?? undefined"
          />
        </div>
      </div>
    </div>
  `,
})

describe('ServiceScriptureIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Edit Scripture Slides" button for editor when scripture reference is populated', () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true },
    })
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').text()).toContain('Edit Scripture Slides')
  })

  it('does not render "Edit Scripture Slides" button for viewer', () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: false },
    })
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').exists()).toBe(false)
  })

  it('does not render "Edit Scripture Slides" button when exported/locked', () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true, isExportedLocked: true },
    })
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').exists()).toBe(false)
  })

  it('does not render "Edit Scripture Slides" button when scripture reference is empty', () => {
    const wrapper = mount(TestWrapper, {
      props: {
        slot: makeScriptureSlot({ book: null, chapter: null, verseStart: null, verseEnd: null }),
        isEditor: true,
      },
    })
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').exists()).toBe(false)
  })

  it('clicking "Edit Scripture Slides" expands the editor panel', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true },
    })
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(false)
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(true)
  })

  it('shows reading mode toggle when editor is expanded', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true },
    })
    expect(wrapper.find('[data-testid="reading-mode-toggle"]').exists()).toBe(false)
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="reading-mode-toggle"]').exists()).toBe(true)
  })

  it('renders ScriptureSlideEditor when mode is "normal"', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot({ readingMode: 'normal' }), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(false)
  })

  it('renders CongregationalEditor when mode is "congregational"', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot({ readingMode: 'congregational' }), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(true)
  })

  it('clicking toggle switches between Normal and Congregational editor', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot({ readingMode: 'normal' }), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(true)

    await wrapper.find('[data-testid="mode-congregational"]').trigger('click')
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(false)
  })

  it('clicking toggle switches from Congregational back to Normal editor', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot({ readingMode: 'congregational' }), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(true)

    await wrapper.find('[data-testid="mode-normal"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(false)
  })

  it('reading mode toggle updates the readingMode on the slot', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot({ readingMode: 'normal' }), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')

    await wrapper.find('[data-testid="mode-congregational"]').trigger('click')
    expect(wrapper.vm.localSlot.readingMode).toBe('congregational')

    await wrapper.find('[data-testid="mode-normal"]').trigger('click')
    expect(wrapper.vm.localSlot.readingMode).toBe('normal')
  })

  it('defaults to "normal" mode when readingMode is undefined', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot({ readingMode: undefined }), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(false)
  })

  it('button text changes to "Close Slides Editor" when expanded', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').text()).toContain('Close Slides Editor')
  })

  it('clicking "Close Slides Editor" collapses the editor panel', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(false)
  })

  it('passes scriptureReadingId to editor when available', async () => {
    const wrapper = mount(TestWrapper, {
      props: {
        slot: makeScriptureSlot({ scriptureReadingId: 'reading-abc' }),
        isEditor: true,
      },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    const editor = wrapper.findComponent(ScriptureSlideEditorStub)
    expect(editor.props('readingId')).toBe('reading-abc')
  })

  it('passes orgId to editor component', async () => {
    const wrapper = mount(TestWrapper, {
      props: { slot: makeScriptureSlot(), isEditor: true, orgId: 'my-org' },
    })
    await wrapper.find('[data-testid="edit-scripture-slides-btn"]').trigger('click')
    const editor = wrapper.findComponent(ScriptureSlideEditorStub)
    expect(editor.props('orgId')).toBe('my-org')
  })
})
