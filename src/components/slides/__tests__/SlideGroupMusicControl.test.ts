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

const vamp3NoFile: Vamp = {
  id: 'vamp-3',
  name: 'Quiet Bed',
  key: 'D',
  tempo: undefined,
  attachment: null,
  createdAt: {} as never,
  updatedAt: {} as never,
} as Vamp

describe('SlideGroupMusicControl — audioTab derivation (142)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('no props: None tab is active with the silent copy, and every state renders exactly three tabs in a tablist', () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })

    const tablist = wrapper.get('[role="tablist"]')
    expect(tablist.attributes('aria-label')).toBe('Audio source')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="group-music-audio-tab-none"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="group-music-audio-tab-track"]').attributes('aria-selected')).toBe('false')
    expect(wrapper.get('[data-testid="group-music-audio-tab-vamp"]').attributes('aria-selected')).toBe('false')
    expect(wrapper.text()).toContain('Silent — the room mix carries this group.')
    expect(wrapper.text()).toContain('one source per group')
  })

  it('audioUrl only: Track tab is active with the track row and no duration/vamp-warning', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { audioUrl: 'https://storage.example.com/org-1/media/abc/pad_Cmaj_soft.mp3', orgId: 'org-1', isEditor: true },
    })

    expect(wrapper.get('[data-testid="group-music-audio-tab-track"]').attributes('aria-selected')).toBe('true')
    const row = wrapper.get('[data-testid="group-music-track-row"]')
    expect(row.get('[data-testid="group-music-track-filename"]').text()).toBe('pad_Cmaj_soft.mp3')
    expect(row.find('[data-testid="group-music-preview"]').exists()).toBe(true)
    expect(row.get('[data-testid="group-music-track-replace"]').text()).toContain('Replace')
    expect(row.find('[data-testid="group-music-input"]').exists()).toBe(true)
    expect(row.find('[data-testid="group-music-track-remove"]').exists()).toBe(true)
    expect(row.find('[data-testid="group-music-track-duration"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-vamp-warning"]').exists()).toBe(false)
  })

  it('bedVampId + audioUrl: Vamp tab active, VampPicker mounted with fill/allowUnattached/selectedVampId, no warning', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/open-response.mp3',
        bedVampId: 'vamp-1',
        bedVampLabel: 'Open Response · G',
        vamps: [vamp1],
        orgId: 'org-1',
        isEditor: true,
      },
    })

    expect(wrapper.get('[data-testid="group-music-audio-tab-vamp"]').attributes('aria-selected')).toBe('true')
    const picker = wrapper.findComponent(VampPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props('fill')).toBe(true)
    expect(picker.props('allowUnattached')).toBe(true)
    expect(picker.props('selectedVampId')).toBe('vamp-1')
    expect(wrapper.find('[data-testid="group-music-vamp-warning"]').exists()).toBe(false)
  })

  it('bedVampId WITHOUT audioUrl: Vamp tab active with the amber warning and no track row (RESEARCH.md Pitfall 2 is closed)', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        bedVampId: 'vamp-3',
        bedVampLabel: 'Quiet Bed · D',
        vamps: [vamp3NoFile],
        orgId: 'org-1',
        isEditor: true,
      },
    })

    expect(wrapper.get('[data-testid="group-music-audio-tab-vamp"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="group-music-vamp-warning"]').text()).toBe(
      '⚠ No MP3 attached yet — band plays it live.',
    )
    expect(wrapper.find('[data-testid="group-music-track-row"]').exists()).toBe(false)
    // Never the OLD empty-state buttons for a bed that IS assigned.
    expect(wrapper.find('[data-testid="group-music-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-music-choose-vamp"]').exists()).toBe(false)
  })
})

describe('SlideGroupMusicControl — None tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('clicking None while a track is attached emits remove once, no attach/attach-vamp', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { audioUrl: 'https://storage.example.com/existing.mp3', orgId: 'org-1', isEditor: true },
    })

    await wrapper.get('[data-testid="group-music-audio-tab-none"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.emitted('attach')).toBeUndefined()
    expect(wrapper.emitted('attach-vamp')).toBeUndefined()
  })

  it('clicking None while a vamp bed is attached emits remove once', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { bedVampId: 'vamp-1', bedVampLabel: 'Open Response · G', vamps: [vamp1], orgId: 'org-1', isEditor: true },
    })

    await wrapper.get('[data-testid="group-music-audio-tab-none"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[]])
  })

  it('clicking None with nothing attached emits nothing', async () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })

    await wrapper.get('[data-testid="group-music-audio-tab-none"]').trigger('click')

    expect(wrapper.emitted('remove')).toBeUndefined()
  })
})

describe('SlideGroupMusicControl — Track tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('clicking Track from the None state emits nothing and renders the upload affordance', async () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })

    await wrapper.get('[data-testid="group-music-audio-tab-track"]').trigger('click')

    expect(wrapper.emitted('attach')).toBeUndefined()
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.text()).toContain('Upload a track')
    expect(wrapper.find('[data-testid="group-music-input"]').exists()).toBe(true)
  })

  it('selecting an audio file uploads it and emits the resolved URL exactly once', async () => {
    mockUploadMedia.mockResolvedValue('https://storage.example.com/org-1/media/def/pad.mp3')
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })
    await wrapper.get('[data-testid="group-music-audio-tab-track"]').trigger('click')

    await selectFile(wrapper, 'group-music-input', makeFile('pad.mp3', 'audio/mpeg'))

    expect(mockUploadMedia).toHaveBeenCalledWith(expect.any(File), 'org-1')
    expect(wrapper.emitted('attach')).toEqual([['https://storage.example.com/org-1/media/def/pad.mp3']])
  })

  it('a rejected upload emits nothing and renders media-upload-error', async () => {
    mockUploadMedia.mockImplementation(() => {
      errorRef.value = 'Unsupported file type "text/plain" — only audio or video files can be attached.'
      return Promise.reject(new Error('Unsupported file type'))
    })
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })
    await wrapper.get('[data-testid="group-music-audio-tab-track"]').trigger('click')

    await selectFile(wrapper, 'group-music-input', makeFile('notes.txt', 'text/plain'))
    await Promise.resolve()
    await Promise.resolve()

    const errorEl = wrapper.find('[data-testid="media-upload-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Unsupported file type')
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
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })
    await wrapper.get('[data-testid="group-music-audio-tab-track"]').trigger('click')

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

  it('Track row Replace uploads a new file and emits attach; Remove emits remove once with no confirm dialog', async () => {
    mockUploadMedia.mockResolvedValue('https://storage.example.com/org-1/media/new.mp3')
    const wrapper = mount(SlideGroupMusicControl, {
      props: { audioUrl: 'https://storage.example.com/existing.mp3', orgId: 'org-1', isEditor: true },
    })

    await selectFile(wrapper, 'group-music-input', makeFile('new.mp3', 'audio/mpeg'))
    expect(wrapper.emitted('attach')).toEqual([['https://storage.example.com/org-1/media/new.mp3']])

    await wrapper.get('[data-testid="group-music-track-remove"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[]])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text().toLowerCase()).not.toContain('confirm')
  })

  it('AudioPlayer loadedmetadata renders a formatted duration; a subsequent audioUrl change clears it', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { audioUrl: 'https://storage.example.com/existing.mp3', orgId: 'org-1', isEditor: true },
    })

    await wrapper.findComponent(AudioPlayer).vm.$emit('loadedmetadata', 134)
    expect(wrapper.get('[data-testid="group-music-track-duration"]').text()).toBe('2:14')

    await wrapper.setProps({ audioUrl: 'https://storage.example.com/other.mp3' })
    await wrapper.findComponent(AudioPlayer).vm.$emit('loadedmetadata', 61)
    expect(wrapper.get('[data-testid="group-music-track-duration"]').text()).toBe('1:01')

    await wrapper.setProps({ audioUrl: 'https://storage.example.com/third.mp3' })
    expect(wrapper.find('[data-testid="group-music-track-duration"]').exists()).toBe(false)
  })
})

describe('SlideGroupMusicControl — Vamp tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('clicking Vamp from the None state emits nothing and mounts VampPicker', async () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true, vamps: [vamp1, vamp3NoFile] } })

    await wrapper.get('[data-testid="group-music-audio-tab-vamp"]').trigger('click')

    expect(wrapper.emitted('attach')).toBeUndefined()
    expect(wrapper.emitted('attach-vamp')).toBeUndefined()
    expect(wrapper.findComponent(VampPicker).exists()).toBe(true)
  })

  it('VampPicker select emits attach-vamp with the no-MP3 vamp; cancel emits close', async () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true, vamps: [vamp1, vamp3NoFile] } })
    await wrapper.get('[data-testid="group-music-audio-tab-vamp"]').trigger('click')

    const picker = wrapper.findComponent(VampPicker)
    await picker.vm.$emit('select', vamp3NoFile)
    expect(wrapper.emitted('attach-vamp')).toEqual([[vamp3NoFile]])

    await picker.vm.$emit('cancel')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('after attach-vamp, when props update to the assigned vamp the Vamp tab stays active; clearing props resets to None', async () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true, vamps: [vamp3NoFile] } })
    await wrapper.get('[data-testid="group-music-audio-tab-vamp"]').trigger('click')

    await wrapper.setProps({ bedVampId: 'vamp-3', bedVampLabel: 'Quiet Bed · D' })
    expect(wrapper.get('[data-testid="group-music-audio-tab-vamp"]').attributes('aria-selected')).toBe('true')

    await wrapper.setProps({ bedVampId: undefined, bedVampLabel: undefined })
    expect(wrapper.get('[data-testid="group-music-audio-tab-none"]').attributes('aria-selected')).toBe('true')
  })

  it('a vamp not in the loaded library shows the stale hint when not loading, and hides it while loading', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { bedVampId: 'vamp-gone', bedVampLabel: 'Gone · A', vamps: [vamp1], vampsLoading: false, orgId: 'org-1', isEditor: true },
    })
    expect(wrapper.text()).toContain('(no longer in library)')

    const loadingWrapper = mount(SlideGroupMusicControl, {
      props: { bedVampId: 'vamp-gone', bedVampLabel: 'Gone · A', vamps: [vamp1], vampsLoading: true, orgId: 'org-1', isEditor: true },
    })
    expect(loadingWrapper.text()).not.toContain('(no longer in library)')
  })
})

describe('SlideGroupMusicControl — viewer / flush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('isEditor false with a track: tabs disabled, filename + preview render, no Replace/Remove', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { audioUrl: 'https://storage.example.com/existing.mp3', orgId: 'org-1', isEditor: false },
    })

    for (const id of ['none', 'track', 'vamp']) {
      expect(wrapper.get(`[data-testid="group-music-audio-tab-${id}"]`).attributes('disabled')).toBeDefined()
    }
    const row = wrapper.get('[data-testid="group-music-track-row"]')
    expect(row.find('[data-testid="group-music-track-filename"]').exists()).toBe(true)
    expect(row.find('[data-testid="group-music-preview"]').exists()).toBe(true)
    expect(row.find('[data-testid="group-music-track-replace"]').exists()).toBe(false)
    expect(row.find('[data-testid="group-music-track-remove"]').exists()).toBe(false)
  })

  it('isEditor false with a vamp: tabs disabled, no VampPicker, a text line with the vamp label', () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: {
        audioUrl: 'https://cdn.example/open-response.mp3',
        bedVampId: 'vamp-1',
        bedVampLabel: 'Open Response · G',
        vamps: [vamp1],
        orgId: 'org-1',
        isEditor: false,
      },
    })

    expect(wrapper.findComponent(VampPicker).exists()).toBe(false)
    expect(wrapper.text()).toContain('Open Response · G')
  })

  it('clicking a disabled tab emits nothing', async () => {
    const wrapper = mount(SlideGroupMusicControl, {
      props: { audioUrl: 'https://storage.example.com/existing.mp3', orgId: 'org-1', isEditor: false },
    })

    await wrapper.get('[data-testid="group-music-audio-tab-none"]').trigger('click')

    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('defaults to its own bordered/background root chrome when flush is not passed', () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true } })
    const classes = wrapper.get('[data-testid="slide-group-music-control"]').classes()
    expect(classes).toContain('rounded-md')
    expect(classes).toContain('border')
    expect(classes).toContain('border-gray-800')
    expect(classes).toContain('bg-gray-900')
  })

  it('flush: true drops the border/background/rounding root chrome so it can render inside a shared panel wrapper', () => {
    const wrapper = mount(SlideGroupMusicControl, { props: { orgId: 'org-1', isEditor: true, flush: true } })
    const classes = wrapper.get('[data-testid="slide-group-music-control"]').classes()
    expect(classes).not.toContain('rounded-md')
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('border-gray-800')
    expect(classes).not.toContain('bg-gray-900')
  })
})
