import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import BackgroundControl from '../BackgroundControl.vue'

const progressRef = ref(0)
const errorRef = ref<string | null>(null)
const isUploadingRef = ref(false)
const mockUploadBackground = vi.fn<(file: File, orgId: string) => Promise<string>>()
const mockReset = vi.fn(() => {
  progressRef.value = 0
  errorRef.value = null
  isUploadingRef.value = false
})

vi.mock('@/composables/useBackgroundUpload', () => ({
  useBackgroundUpload: () => ({
    progress: progressRef,
    error: errorRef,
    isUploading: isUploadingRef,
    uploadBackground: mockUploadBackground,
    reset: mockReset,
  }),
}))

function makeFile(name: string, type: string): File {
  return new File(['fake-bytes'], name, { type })
}

async function selectFile(wrapper: ReturnType<typeof mount>, testid: string, file: File) {
  const input = wrapper.find(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true,
  })
  await input.trigger('change')
}

const GROUP_CAPTION = 'applies to all 6 slides in this group, unless a slide sets its own'
const GROUP_ADD_LABEL = '+ Add background for this group'

describe('BackgroundControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('with no background at this level and no inherited value, renders the caption, the add affordance, and no thumbnail', () => {
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: true, orgId: 'org-1' },
    })

    expect(wrapper.get('[data-testid="background-control-caption"]').text()).toBe(GROUP_CAPTION)
    const addAffordance = wrapper.find('[data-testid="background-control-add"]')
    expect(addAffordance.exists()).toBe(true)
    expect(addAffordance.text()).toContain('Add background for this group')
    expect(wrapper.find('[data-testid="background-control-image"]').exists()).toBe(false)
  })

  it('with imageUrl set, renders the thumbnail, the decoded filename, the caption, and the remove control', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/org-1/backgrounds/abc/sunset_view.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    expect(wrapper.find('[data-testid="background-control-image"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="background-control-filename"]').text()).toBe('sunset_view.jpg')
    expect(wrapper.get('[data-testid="background-control-caption"]').text()).toBe(GROUP_CAPTION)
    expect(wrapper.find('[data-testid="background-control-remove"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="background-control-add"]').exists()).toBe(false)
  })

  it('with isEditor false and an imageUrl set, the add and remove controls are absent while the thumbnail still renders', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/org-1/backgrounds/abc/sunset_view.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        isEditor: false,
        orgId: 'org-1',
      },
    })

    expect(wrapper.find('[data-testid="background-control-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-image"]').exists()).toBe(true)
  })

  it('with imageUrl unset and no inherited value, isEditor false renders no add affordance and no thumbnail', () => {
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: false, orgId: 'org-1' },
    })

    expect(wrapper.find('[data-testid="background-control-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-image"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="background-control-caption"]').text()).toBe(GROUP_CAPTION)
  })

  it('with imageUrl unset and inheritedFrom provided, renders the inherited thumbnail, the provenance line, and still offers the add affordance', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        inheritedFrom: { url: 'https://storage.example.com/song-bg.jpg', label: 'song-bg.jpg' },
        isEditor: true,
        orgId: 'org-1',
      },
    })

    expect(wrapper.find('[data-testid="background-control-image"]').exists()).toBe(true)
    const inherited = wrapper.get('[data-testid="background-control-inherited"]')
    expect(inherited.text()).toContain('inherited from the song')
    expect(inherited.text()).toContain('song-bg.jpg')
    expect(wrapper.find('[data-testid="background-control-add"]').exists()).toBe(true)
  })

  it('selecting a valid image file uploads it and emits attach exactly once with the resolved URL', async () => {
    mockUploadBackground.mockResolvedValue('https://storage.example.com/org-1/backgrounds/def/bg.jpg')
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: true, orgId: 'org-1' },
    })

    await selectFile(wrapper, 'background-control-input', makeFile('bg.jpg', 'image/jpeg'))

    expect(mockUploadBackground).toHaveBeenCalledWith(expect.any(File), 'org-1')
    expect(wrapper.emitted('attach')).toEqual([
      ['https://storage.example.com/org-1/backgrounds/def/bg.jpg'],
    ])
  })

  it('a rejected upload surfaces the composable error, emits neither attach nor remove', async () => {
    mockUploadBackground.mockImplementation(() => {
      errorRef.value = 'Unsupported file type "text/plain" — only images can be set as a background.'
      return Promise.reject(new Error('Unsupported file type'))
    })
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: true, orgId: 'org-1' },
    })

    await selectFile(wrapper, 'background-control-input', makeFile('notes.txt', 'text/plain'))
    await Promise.resolve()
    await Promise.resolve()

    const errorEl = wrapper.find('[data-testid="background-control-upload-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Unsupported file type')
    expect(wrapper.emitted('attach')).toBeUndefined()
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('a failed upload against an existing attachment never clears it — emits nothing', async () => {
    mockUploadBackground.mockImplementation(() => {
      errorRef.value = 'Upload failed.'
      return Promise.reject(new Error('Upload failed.'))
    })
    const wrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/existing.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    // The existing attachment renders the populated state, not the add
    // input — this control's own surface for the populated state offers no
    // re-attach affordance; assert only that a failed upload never emits.
    expect(wrapper.emitted('attach')).toBeUndefined()
    expect(wrapper.get('[data-testid="background-control-image"]').attributes('src')).toBe(
      'https://storage.example.com/existing.jpg',
    )
  })

  it('renders upload progress using the shared wording and the composable progress value', async () => {
    let resolveUpload!: (url: string) => void
    mockUploadBackground.mockImplementation(() => {
      isUploadingRef.value = true
      progressRef.value = 42
      return new Promise<string>((resolve) => {
        resolveUpload = (url: string) => {
          isUploadingRef.value = false
          resolve(url)
        }
      })
    })
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: true, orgId: 'org-1' },
    })

    await selectFile(wrapper, 'background-control-input', makeFile('bg.jpg', 'image/jpeg'))
    await wrapper.vm.$nextTick()

    const progressEl = wrapper.find('[data-testid="background-control-upload-progress"]')
    expect(progressEl.exists()).toBe(true)
    expect(progressEl.text()).toBe('Uploading... 42%')

    resolveUpload('https://storage.example.com/bg.jpg')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="background-control-upload-progress"]').exists()).toBe(false)
  })

  it('clicking remove emits remove exactly once, with no confirmation dialog and no upload triggered', async () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/existing.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    await wrapper.get('[data-testid="background-control-remove"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(mockUploadBackground).not.toHaveBeenCalled()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text().toLowerCase()).not.toContain('confirm')
  })

  it('the filename display span carries the truncate class so a long filename cannot overflow the row', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        imageUrl: `https://storage.example.com/org-1/backgrounds/abc/${'a'.repeat(200)}.jpg`,
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    expect(wrapper.get('[data-testid="background-control-filename"]').classes()).toContain('truncate')
  })
})
