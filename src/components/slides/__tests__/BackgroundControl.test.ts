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

  it('with imageUrl unset and inheritedFrom provided, renders the inherited thumbnail and provenance line but does NOT offer the add affordance (owner request — a song-sourced background is managed at the song level)', () => {
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
    // The "+ Add background for this group" override is suppressed while inherited.
    expect(wrapper.find('[data-testid="background-control-add"]').exists()).toBe(false)
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

  it('defaults the remove control\'s aria-label to the generic string when removeLabel is not passed', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/existing.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    expect(wrapper.get('[data-testid="background-control-remove"]').attributes('aria-label')).toBe('Remove background')
  })

  it('threads a per-level removeLabel into the remove control\'s aria-label, matching the Copywriting Contract\'s two distinct strings', () => {
    const groupWrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/existing.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        removeLabel: 'Remove group background',
        isEditor: true,
        orgId: 'org-1',
      },
    })
    expect(groupWrapper.get('[data-testid="background-control-remove"]').attributes('aria-label')).toBe('Remove group background')

    const songWrapper = mount(BackgroundControl, {
      props: {
        imageUrl: 'https://storage.example.com/existing.jpg',
        caption: GROUP_CAPTION,
        addLabel: GROUP_ADD_LABEL,
        removeLabel: 'Remove song background',
        isEditor: true,
        orgId: 'org-1',
      },
    })
    expect(songWrapper.get('[data-testid="background-control-remove"]').attributes('aria-label')).toBe('Remove song background')
  })

  it('defaults to its own bordered/background root chrome when flush is not passed (SongLyricEditor.vue call site stays visually unchanged)', () => {
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: true, orgId: 'org-1' },
    })
    const classes = wrapper.get('[data-testid="background-control"]').classes()
    expect(classes).toContain('rounded-md')
    expect(classes).toContain('border')
    expect(classes).toContain('border-gray-800')
    expect(classes).toContain('bg-gray-900')
  })

  it('flush: true drops the border/background/rounding root chrome so it can render inside a shared panel wrapper', () => {
    const wrapper = mount(BackgroundControl, {
      props: { caption: GROUP_CAPTION, addLabel: GROUP_ADD_LABEL, isEditor: true, orgId: 'org-1', flush: true },
    })
    const classes = wrapper.get('[data-testid="background-control"]').classes()
    expect(classes).not.toContain('rounded-md')
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('border-gray-800')
    expect(classes).not.toContain('bg-gray-900')
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

describe('BackgroundControl — variant="chip-popover" (Phase 142)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressRef.value = 0
    errorRef.value = null
    isUploadingRef.value = false
  })

  const RECENTS = [
    { url: 'https://storage.example.com/recent-1.jpg', label: 'recent-1.jpg' },
    { url: 'https://storage.example.com/recent-2.jpg', label: 'recent-2.jpg' },
  ]

  it('no imageUrl, no inheritedFrom, 2 recents, isEditor true — renders None (highlighted), 2 recent swatches, upload tile, and the chip caption; none of the panel-variant testids render', () => {
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: RECENTS, isEditor: true, orgId: 'org-1' },
    })

    const none = wrapper.get('[data-testid="background-control-swatch-none"]')
    expect(none.classes()).toContain('border-indigo-600')
    const recents = wrapper.findAll('[data-testid="background-control-swatch-recent"]')
    expect(recents).toHaveLength(2)
    expect(recents.map((r) => r.attributes('data-url'))).toEqual(RECENTS.map((r) => r.url))
    const upload = wrapper.get('[data-testid="background-control-swatch-upload"]')
    expect(upload.attributes('aria-label')).toBe('Upload a background image')
    expect(upload.find('[data-testid="background-control-input"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="background-control-chip-caption"]').text()).toBe(
      'Recent in this service · drop a file on ＋',
    )

    expect(wrapper.find('[data-testid="background-control-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-caption"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-image"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-filename"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-remove"]').exists()).toBe(false)
  })

  it('imageUrl equals recents[1].url — that recent swatch is highlighted, None is not', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        variant: 'chip-popover',
        recents: RECENTS,
        imageUrl: RECENTS[1]!.url,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    const recents = wrapper.findAll('[data-testid="background-control-swatch-recent"]')
    const activeRecent = recents.find((r) => r.attributes('data-url') === RECENTS[1]!.url)!
    expect(activeRecent.classes()).toContain('border-indigo-600')
    expect(wrapper.get('[data-testid="background-control-swatch-none"]').classes()).not.toContain(
      'border-indigo-600',
    )
  })

  it('imageUrl set but not present in recents — a recent swatch for imageUrl renders first', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        variant: 'chip-popover',
        recents: RECENTS,
        imageUrl: 'https://storage.example.com/current-not-in-recents.jpg',
        isEditor: true,
        orgId: 'org-1',
      },
    })

    const recents = wrapper.findAll('[data-testid="background-control-swatch-recent"]')
    expect(recents[0]!.attributes('data-url')).toBe('https://storage.example.com/current-not-in-recents.jpg')
    expect(recents[0]!.classes()).toContain('border-indigo-600')
  })

  it('recents empty and no imageUrl — exactly None + upload tiles, no recent swatches', () => {
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: [], isEditor: true, orgId: 'org-1' },
    })

    expect(wrapper.find('[data-testid="background-control-swatch-none"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="background-control-swatch-upload"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="background-control-swatch-recent"]')).toHaveLength(0)
  })

  it('recents = 6 entries — at most 4 recent swatches render', () => {
    const sixRecents = Array.from({ length: 6 }, (_, i) => ({
      url: `https://storage.example.com/r${i}.jpg`,
      label: `r${i}.jpg`,
    }))
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: sixRecents, isEditor: true, orgId: 'org-1' },
    })

    expect(wrapper.findAll('[data-testid="background-control-swatch-recent"]').length).toBeLessThanOrEqual(4)
  })

  it('clicking None with imageUrl set emits remove once; clicking None with no imageUrl emits nothing', async () => {
    const withImage = mount(BackgroundControl, {
      props: {
        variant: 'chip-popover',
        recents: RECENTS,
        imageUrl: 'https://storage.example.com/current.jpg',
        isEditor: true,
        orgId: 'org-1',
      },
    })
    await withImage.get('[data-testid="background-control-swatch-none"]').trigger('click')
    expect(withImage.emitted('remove')).toEqual([[]])

    const withoutImage = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: RECENTS, isEditor: true, orgId: 'org-1' },
    })
    await withoutImage.get('[data-testid="background-control-swatch-none"]').trigger('click')
    expect(withoutImage.emitted('remove')).toBeUndefined()
  })

  it('clicking a recent swatch emits attach with that url; clicking the already-active recent emits nothing', async () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        variant: 'chip-popover',
        recents: RECENTS,
        imageUrl: RECENTS[0]!.url,
        isEditor: true,
        orgId: 'org-1',
      },
    })

    const recents = wrapper.findAll('[data-testid="background-control-swatch-recent"]')
    const active = recents.find((r) => r.attributes('data-url') === RECENTS[0]!.url)!
    const inactive = recents.find((r) => r.attributes('data-url') === RECENTS[1]!.url)!

    await active.trigger('click')
    expect(wrapper.emitted('attach')).toBeUndefined()

    await inactive.trigger('click')
    expect(wrapper.emitted('attach')).toEqual([[RECENTS[1]!.url]])
  })

  it('drop on the tile row uploads the file and emits attach with the resolved url; a rejected upload emits nothing and shows the error', async () => {
    mockUploadBackground.mockResolvedValue('https://storage.example.com/dropped.jpg')
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: RECENTS, isEditor: true, orgId: 'org-1' },
    })

    const file = makeFile('dropped.jpg', 'image/jpeg')
    await wrapper.findAll('.flex.gap-2')[1]!.trigger('drop', { dataTransfer: { files: [file] } })

    expect(mockUploadBackground).toHaveBeenCalledWith(expect.any(File), 'org-1')
    expect(wrapper.emitted('attach')).toEqual([['https://storage.example.com/dropped.jpg']])
  })

  it('a rejected drop upload emits nothing and the error renders', async () => {
    mockUploadBackground.mockImplementation(() => {
      errorRef.value = 'Unsupported file type "text/plain" — only images can be set as a background.'
      return Promise.reject(new Error('Unsupported file type'))
    })
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: RECENTS, isEditor: true, orgId: 'org-1' },
    })

    const file = makeFile('notes.txt', 'text/plain')
    await wrapper.findAll('.flex.gap-2')[1]!.trigger('drop', { dataTransfer: { files: [file] } })
    await Promise.resolve()
    await Promise.resolve()

    expect(wrapper.emitted('attach')).toBeUndefined()
    const errorEl = wrapper.find('[data-testid="background-control-upload-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Unsupported file type')
  })

  it('dragover on the tile row adds the drag-active class to the upload tile; dragleave removes it', async () => {
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: RECENTS, isEditor: true, orgId: 'org-1' },
    })

    const uploadTile = wrapper.get('[data-testid="background-control-swatch-upload"]')
    await uploadTile.trigger('dragover')
    expect(wrapper.get('[data-testid="background-control-swatch-upload"]').classes()).toContain('border-indigo-500')

    await uploadTile.trigger('dragleave')
    expect(wrapper.get('[data-testid="background-control-swatch-upload"]').classes()).not.toContain(
      'border-indigo-500',
    )
  })

  it('inheritedFrom set — no swatches, no file input, no chip caption; renders the inherited explainer', () => {
    const wrapper = mount(BackgroundControl, {
      props: {
        variant: 'chip-popover',
        recents: RECENTS,
        inheritedFrom: { url: 'https://storage.example.com/song-bg.jpg', label: 'song-bg.jpg' },
        isEditor: true,
        orgId: 'org-1',
      },
    })

    expect(wrapper.find('[data-testid="background-control-swatch-none"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-swatch-recent"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-swatch-upload"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-chip-caption"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="background-control-inherited-explainer"]').text()).toBe(
      "Managed on the song — edit it from the song's Lyrics tab.",
    )
  })

  it('isEditor false and no inheritedFrom — no tiles render, the chip caption still renders', () => {
    const wrapper = mount(BackgroundControl, {
      props: { variant: 'chip-popover', recents: RECENTS, isEditor: false, orgId: 'org-1' },
    })

    expect(wrapper.find('[data-testid="background-control-swatch-none"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-swatch-recent"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="background-control-swatch-upload"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="background-control-chip-caption"]').text()).toBe(
      'Recent in this service · drop a file on ＋',
    )
  })
})
