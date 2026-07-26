import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SlotMediaAttachment from '../SlotMediaAttachment.vue'

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

describe('SlotMediaAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  it('selecting an audio file (upload resolves) emits update:audioUrl with the resolved URL', async () => {
    mockUploadMedia.mockResolvedValue('https://storage.example.com/org-1/media/abc/song.mp3')
    const wrapper = mount(SlotMediaAttachment, { props: { orgId: 'org-1' } })

    await selectFile(wrapper, 'attach-audio-input', makeFile('song.mp3', 'audio/mpeg'))

    expect(mockUploadMedia).toHaveBeenCalledWith(expect.any(File), 'org-1')
    expect(wrapper.emitted('update:audioUrl')).toEqual([
      ['https://storage.example.com/org-1/media/abc/song.mp3'],
    ])
  })

  it('a rejected upload renders media-upload-error and emits NO update event', async () => {
    mockUploadMedia.mockImplementation(() => {
      errorRef.value = 'Unsupported file type "text/plain" — only audio files can be attached.'
      return Promise.reject(new Error('Unsupported file type'))
    })
    const wrapper = mount(SlotMediaAttachment, { props: { orgId: 'org-1' } })

    await selectFile(wrapper, 'attach-audio-input', makeFile('notes.txt', 'text/plain'))
    await Promise.resolve()
    await Promise.resolve()

    const errorEl = wrapper.find('[data-testid="media-upload-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Unsupported file type')
    expect(wrapper.emitted('update:audioUrl')).toBeUndefined()
  })

  it('with audioUrl prop set, renders an AudioPlayer preview and remove-audio; clicking remove emits update:audioUrl cleared', async () => {
    const wrapper = mount(SlotMediaAttachment, {
      props: { orgId: 'org-1', audioUrl: 'https://storage.example.com/existing.mp3' },
    })

    expect(wrapper.findComponent({ name: 'AudioPlayer' }).exists() || wrapper.find('[data-testid="audio-player"]').exists()).toBe(true)
    const removeBtn = wrapper.find('[data-testid="remove-audio"]')
    expect(removeBtn.exists()).toBe(true)

    await removeBtn.trigger('click')

    expect(wrapper.emitted('update:audioUrl')).toEqual([[undefined]])
  })

  it('renders no video attach input and no video preview — the bed is audio-only (D-18)', () => {
    const wrapper = mount(SlotMediaAttachment, { props: { orgId: 'org-1' } })

    expect(wrapper.find('[data-testid="attach-video-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="video-player"]').exists()).toBe(false)
  })

  it('shows an upload progress indicator while isUploading is true', async () => {
    let resolveUpload!: (url: string) => void
    mockUploadMedia.mockImplementation(() => {
      isUploadingRef.value = true
      return new Promise<string>((resolve) => {
        resolveUpload = (url: string) => {
          isUploadingRef.value = false
          resolve(url)
        }
      })
    })
    const wrapper = mount(SlotMediaAttachment, { props: { orgId: 'org-1' } })

    await selectFile(wrapper, 'attach-audio-input', makeFile('song.mp3', 'audio/mpeg'))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="media-upload-progress"]').exists()).toBe(true)

    resolveUpload('https://storage.example.com/song.mp3')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="media-upload-progress"]').exists()).toBe(false)
  })
})
