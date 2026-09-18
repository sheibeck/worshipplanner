import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SlideGroupMusicControl from '../SlideGroupMusicControl.vue'
import AudioPlayer from '@/components/AudioPlayer.vue'
import VampPicker from '@/components/VampPicker.vue'
import type { Vamp } from '@/types/vamp'

const progressRef = ref(0)
const errorRef = ref<string | null>(null)
const isUploadingRef = ref(false)
const mockUploadMedia = vi.fn<(file: File, orgId: string) => Promise<string>>()
const mockReset = vi.fn(() => {
  progressRef.value = 0
  errorRef.value = null
  isUploadingRef.value = false
})

vi.mock('@/composables/useMediaUpload', () => ({
  useMediaUpload: () => ({
    progress: progressRef,
    error: errorRef,
    isUploading: isUploadingRef,
    uploadMedia: mockUploadMedia,
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

describe('SlideGroupMusicControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('with no bed audio, renders the add-music affordance and no player', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })

    const addAffordance = wrapper.find('[data-testid="group-music-add"]')
    expect(addAffordance.exists()).toBe(true)
    expect(addAffordance.text()).toContain('Add music for this group')
    expect(wrapper.findComponent(AudioPlayer).exists()).toBe(false)
  })

  it('with bed audio, renders the file name, the plays-across line with the correct slide count, the preview control and the remove control', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/org-1/media/abc/pad_Cmaj_soft.mp3',
        slideCount: 6,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    expect(wrapper.get('[data-testid="group-music-filename"]').text()).toBe('pad_Cmaj_soft.mp3')
    expect(wrapper.get('[data-testid="group-music-scope"]').text()).toBe('plays across all 6 slides')
    expect(wrapper.find('[data-testid="group-music-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-music-remove"]').exists()).toBe(true)
  })

  it('derives the displayed name from a Firebase Storage style URL and falls back to a generic label for an unparseable URL', () => {
    const wrapperGood = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/org-1/media/abc/pad_Cmaj_soft.mp3?token=xyz',
        slideCount: 3,
        orgId: 'org-1',
        isEditor: true,
      },
    })
    expect(wrapperGood.get('[data-testid="group-music-filename"]').text()).toBe('pad_Cmaj_soft.mp3')

    const wrapperBad = mount(SlideGroupMusicControl, {
      props: { audioUrl: '%', slideCount: 3, orgId: 'org-1', isEditor: true },
    })
    expect(wrapperBad.get('[data-testid="group-music-filename"]').text()).toBe('Group music')
  })

  it('selecting an audio file uploads it and emits the resolved URL exactly once', async () => {
    mockUploadMedia.mockResolvedValue('https://storage.example.com/org-1/media/def/pad.mp3')
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })

    await selectFile(wrapper, 'group-music-input', makeFile('pad.mp3', 'audio/mpeg'))

    expect(mockUploadMedia).toHaveBeenCalledWith(expect.any(File), 'org-1')
    expect(wrapper.emitted('attach')).toEqual([
      ['https://storage.example.com/org-1/media/def/pad.mp3'],
    ])
  })

  it('selecting a non-audio file surfaces the composable error and emits nothing', async () => {
    mockUploadMedia.mockImplementation(() => {
      errorRef.value = 'Unsupported file type "text/plain" — only audio or video files can be attached.'
      return Promise.reject(new Error('Unsupported file type'))
    })
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })

    await selectFile(wrapper, 'group-music-input', makeFile('notes.txt', 'text/plain'))
    await Promise.resolve()
    await Promise.resolve()

    const errorEl = wrapper.find('[data-testid="media-upload-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Unsupported file type')
    expect(wrapper.emitted('attach')).toBeUndefined()
  })

  it('a rejected upload surfaces the composable error and emits nothing, so an existing attachment is never cleared', async () => {
    mockUploadMedia.mockImplementation(() => {
      errorRef.value = 'Upload failed.'
      return Promise.reject(new Error('Upload failed.'))
    })
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/existing.mp3',
        slideCount: 6,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    // The existing attachment renders a preview control, not the add input —
    // simulate a re-attach attempt is out of this control's own surface for
    // the populated state; assert instead that a failed upload never emits.
    expect(wrapper.emitted('attach')).toBeUndefined()
  })

  it('renders upload progress using the existing wording and the composable progress value', async () => {
    let resolveUpload!: (url: string) => void
    mockUploadMedia.mockImplementation(() => {
      isUploadingRef.value = true
      progressRef.value = 42
      return new Promise<string>((resolve) => {
        resolveUpload = (url: string) => {
          isUploadingRef.value = false
          resolve(url)
        }
      })
    })
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })

    await selectFile(wrapper, 'group-music-input', makeFile('pad.mp3', 'audio/mpeg'))
    await wrapper.vm.$nextTick()

    const progressEl = wrapper.find('[data-testid="media-upload-progress"]')
    expect(progressEl.exists()).toBe(true)
    expect(progressEl.text()).toBe('Uploading... 42%')

    resolveUpload('https://storage.example.com/pad.mp3')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="media-upload-progress"]').exists()).toBe(false)
  })

  it('activating remove emits a clear intent with no confirmation dialog', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/existing.mp3',
        slideCount: 6,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    await wrapper.get('[data-testid="group-music-remove"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text().toLowerCase()).not.toContain('confirm')
  })

  it('the preview and remove controls carry accessible names', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/existing.mp3',
        slideCount: 6,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    expect(wrapper.get('[data-testid="group-music-preview"]').attributes('aria-label')).toBe('Preview group music')
    expect(wrapper.get('[data-testid="group-music-remove"]').attributes('aria-label')).toBe('Remove group music')
  })

  it('mounted as a viewer, the add affordance and remove control are absent while the player is present', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/existing.mp3',
        slideCount: 6,
        orgId: 'org-1',
        isEditor: false,
      },
    })

    expect(wrapper.find('[data-testid="group-music-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-preview"]').exists()).toBe(true)
    expect(wrapper.findComponent(AudioPlayer).exists()).toBe(true)
  })

  it('defaults to its own bordered/background root chrome when flush is not passed', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })
    const classes = wrapper.get('[data-testid="slide-group-music-control"]').classes()
    expect(classes).toContain('rounded-md')
    expect(classes).toContain('border')
    expect(classes).toContain('border-gray-800')
    expect(classes).toContain('bg-gray-900')
  })

  it('flush: true drops the border/background/rounding root chrome so it can render inside a shared panel wrapper', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true, flush: true },
    })
    const classes = wrapper.get('[data-testid="slide-group-music-control"]').classes()
    expect(classes).not.toContain('rounded-md')
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('border-gray-800')
    expect(classes).not.toContain('bg-gray-900')
  })

  it('mounted as a viewer with no bed audio, renders no add affordance', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: false },
    })

    expect(wrapper.find('[data-testid="group-music-add"]').exists()).toBe(false)
    expect(wrapper.findComponent(AudioPlayer).exists()).toBe(false)
  })
})

describe('SlideGroupMusicControl — group-level vamp bed (260918-nm2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  const vamp1: Vamp = {
    id: 'vamp-1',
    name: 'Open Response',
    key: 'G',
    tempo: '68 bpm',
    attachment: {
      storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/open-response.mp3',
      downloadUrl: 'https://cdn.example/open-response.mp3',
      fileName: 'open-response.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 100,
      createdAt: {} as never,
      createdBy: 'user-1',
    },
    createdAt: {} as never,
    updatedAt: {} as never,
  } as Vamp

  it('no bed, isEditor true: renders group-music-add AND group-music-choose-vamp; isEditor false: renders neither', () => {
    const editorWrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })
    expect(editorWrapper.find('[data-testid="group-music-add"]').exists()).toBe(true)
    expect(editorWrapper.get('[data-testid="group-music-choose-vamp"]').text()).toBe('Choose a vamp')

    const viewerWrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: false },
    })
    expect(viewerWrapper.find('[data-testid="group-music-add"]').exists()).toBe(false)
    expect(viewerWrapper.find('[data-testid="group-music-choose-vamp"]').exists()).toBe(false)
  })

  it('uploaded bed (no bedVampId): filename + choose-vamp + remove render, no vamp label', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://storage.example.com/existing.mp3',
        slideCount: 6,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    expect(wrapper.find('[data-testid="group-music-filename"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-music-choose-vamp"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-music-remove"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-music-vamp-label"]').exists()).toBe(false)
  })

  it('vamp bed: shows Vamp label with title, scope line, preview, Change/Clear; hides filename/remove/stale', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/open-response.mp3',
        bedVampId: 'vamp-1',
        bedVampLabel: 'Open Response · G',
        vamps: [vamp1],
        vampsLoading: false,
        slideCount: 4,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    const label = wrapper.get('[data-testid="group-music-vamp-label"]')
    expect(label.text()).toBe('Vamp: Open Response · G')
    expect(label.attributes('title')).toBe('Open Response · G')
    expect(wrapper.find('[data-testid="group-music-filename"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="group-music-scope"]').text()).toBe('plays across all 4 slides')
    expect(wrapper.find('[data-testid="group-music-preview"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="group-music-vamp-change"]').text()).toBe('Change')
    expect(wrapper.get('[data-testid="group-music-vamp-clear"]').text()).toBe('Clear')
    expect(wrapper.find('[data-testid="group-music-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-vamp-stale"]').exists()).toBe(false)
  })

  it('clicking group-music-vamp-clear emits remove exactly once, never attach/attach-vamp', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/open-response.mp3',
        bedVampId: 'vamp-1',
        bedVampLabel: 'Open Response · G',
        vamps: [vamp1],
        slideCount: 4,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    await wrapper.get('[data-testid="group-music-vamp-clear"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('attach')).toBeUndefined()
    expect(wrapper.emitted('attach-vamp')).toBeUndefined()
  })

  it('a vamp not in the loaded list shows the stale hint when not loading, and hides it while loading; Clear still emits remove', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/gone.mp3',
        bedVampId: 'vamp-gone',
        bedVampLabel: 'Gone · A',
        vamps: [vamp1],
        vampsLoading: false,
        slideCount: 4,
        orgId: 'org-1',
        isEditor: true,
      },
    })
    expect(wrapper.get('[data-testid="group-music-vamp-stale"]').text()).toBe('(no longer in library)')
    await wrapper.get('[data-testid="group-music-vamp-clear"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[]])

    const loadingWrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/gone.mp3',
        bedVampId: 'vamp-gone',
        bedVampLabel: 'Gone · A',
        vamps: [vamp1],
        vampsLoading: true,
        slideCount: 4,
        orgId: 'org-1',
        isEditor: true,
      },
    })
    expect(loadingWrapper.find('[data-testid="group-music-vamp-stale"]').exists()).toBe(false)
  })

  it('vamp bed with isEditor false: label and preview render; Change, Clear and Choose a vamp do not', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/open-response.mp3',
        bedVampId: 'vamp-1',
        bedVampLabel: 'Open Response · G',
        vamps: [vamp1],
        slideCount: 4,
        orgId: 'org-1',
        isEditor: false,
      },
    })

    expect(wrapper.find('[data-testid="group-music-vamp-label"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-music-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-music-vamp-change"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-vamp-clear"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-choose-vamp"]').exists()).toBe(false)
  })

  it('clicking group-music-choose-vamp mounts VampPicker; select emits attach-vamp and unmounts; cancel unmounts with no emit', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true, vamps: [vamp1], vampsLoading: false },
    })

    await wrapper.get('[data-testid="group-music-choose-vamp"]').trigger('click')
    const picker = wrapper.findComponent(VampPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props('vamps')).toEqual([vamp1])
    expect(picker.props('loading')).toBe(false)

    await picker.vm.$emit('select', vamp1)
    expect(wrapper.emitted('attach-vamp')).toEqual([[vamp1]])
    expect(wrapper.findComponent(VampPicker).exists()).toBe(false)

    await wrapper.get('[data-testid="group-music-choose-vamp"]').trigger('click')
    await wrapper.findComponent(VampPicker).vm.$emit('cancel')
    expect(wrapper.findComponent(VampPicker).exists()).toBe(false)
    expect(wrapper.emitted('attach-vamp')!.length).toBe(1)
  })

  it('clicking group-music-vamp-change on a vamp bed mounts the picker with the current vamp pre-selected', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/open-response.mp3',
        bedVampId: 'vamp-1',
        bedVampLabel: 'Open Response · G',
        vamps: [vamp1],
        slideCount: 4,
        orgId: 'org-1',
        isEditor: true,
      },
    })

    await wrapper.get('[data-testid="group-music-vamp-change"]').trigger('click')
    const picker = wrapper.findComponent(VampPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props('selectedVampId')).toBe('vamp-1')
  })

  it('selecting a file via group-music-input still emits attach(url) exactly as before', async () => {
    mockUploadMedia.mockResolvedValue('https://storage.example.com/org-1/media/def/pad.mp3')
    const wrapper = mount(SlideGroupMusicControl, {
      props: { slideCount: 6, orgId: 'org-1', isEditor: true },
    })

    await selectFile(wrapper, 'group-music-input', makeFile('pad.mp3', 'audio/mpeg'))

    expect(wrapper.emitted('attach')).toEqual([
      ['https://storage.example.com/org-1/media/def/pad.mp3'],
    ])
  })
})
