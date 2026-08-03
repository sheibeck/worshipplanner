import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import EditSlideDrawer from '../EditSlideDrawer.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'

// --- 26-05 Task 3: the drawer calls the slideGroups store directly for its
// fresh-base label/notes writes (Pattern 2/Pitfall 2). Mocked here so Task 1's
// shell-only tests never touch Firestore, and Task 3 controls the mock's
// resolved/rejected behavior per test. 26-08 adds `setGroupBedMedia` — the
// same group-bed write path `SlideGrid.vue`'s music bar already uses. ---
const mockReplaceGroupSlides = vi.fn().mockResolvedValue(undefined)
const mockSetGroupBedMedia = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    replaceGroupSlides: mockReplaceGroupSlides,
    setGroupBedMedia: mockSetGroupBedMedia,
  }),
}))

// --- 26-07 Task 3: "Edit in song" is a real navigation via 26-02's link
// contract — mocked here so the drawer's own tests never touch a real router. ---
const mockRouterPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

// --- 26-08 Task 1: audio file attach goes through the existing upload
// composable (never a second uploader) — mocked here exactly like
// SlideGroupMusicControl.test.ts's own convention, so these tests never touch
// real Firebase Storage. ---
const audioUploadProgressRef = ref(0)
const audioUploadErrorRef = ref<string | null>(null)
const audioUploadIsUploadingRef = ref(false)
const mockUploadAudioMedia = vi.fn<(file: File, orgId: string) => Promise<string>>()
const mockResetAudioUpload = vi.fn(() => {
  audioUploadProgressRef.value = 0
  audioUploadErrorRef.value = null
  audioUploadIsUploadingRef.value = false
})
vi.mock('@/composables/useMediaUpload', () => ({
  useMediaUpload: () => ({
    progress: audioUploadProgressRef,
    error: audioUploadErrorRef,
    isUploading: audioUploadIsUploadingRef,
    uploadMedia: mockUploadAudioMedia,
    reset: mockResetAudioUpload,
  }),
}))

// Teleported content — established codebase convention (26-RESEARCH.md Pitfall 3).
enableAutoUnmount(afterEach)

function body() {
  return new DOMWrapper(document.body)
}

function makeSlot(overrides: Partial<ServiceSlot> & { kind: ServiceSlot['kind']; id: string; position: number }): ServiceSlot {
  return { ...overrides } as ServiceSlot
}

function makeEntry(overrides: Partial<GroupSlideEntry> & { id: string }): GroupSlideEntry {
  return {
    order: 0,
    sourceRef: { kind: 'text', title: 'New slide', body: '' },
    ...overrides,
  }
}

function makeGroup(overrides: Partial<SlideGroup> & { slides: GroupSlideEntry[] }): SlideGroup {
  return {
    id: 'slot-1',
    slotId: 'slot-1',
    serviceId: 'service-1',
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

function makeAssembled(overrides: Partial<AssembledSlide> = {}): AssembledSlide {
  return {
    slide: { id: 'entry-1', position: 0, contentKind: 'text', body: 'Hello world' },
    slotIndex: 0,
    slotKind: 'SONG',
    sourceId: null,
    ...overrides,
  } as AssembledSlide
}

// --- 26-07 Task 1: one entry + assembled-slide pair per `sourceRef.kind`,
// deliberately keeping the ENTRY's source kind and the SLIDE's content kind
// independently controllable — the exact split the per-kind matrix hinges on. ---
function makeLyricFixtures() {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' } }),
    assembledSlide: makeAssembled({
      slide: { id: 'entry-1', position: 0, contentKind: 'lyric', sectionId: 'sec-1', sectionLabel: 'Verse 1', lines: ['Line one', 'Line two'] } as never,
    }),
  }
}

function makeCopyrightFixtures() {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'copyright', songId: 'song-1' } }),
    assembledSlide: makeAssembled({
      slide: {
        id: 'entry-1',
        position: 0,
        contentKind: 'lyric',
        title: 'This Is Our God',
        authors: ['Author A', 'Author B'],
        ccliSongNumber: '1234567',
        copyrightLines: ['© 2020 Some Publisher'],
        ccliLicenseNumber: '7654321',
      } as never,
    }),
  }
}

function makeScriptureFixtures() {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'scripture', scriptureReadingId: 'read-1', innerSlideId: 'inner-1' } }),
    assembledSlide: makeAssembled({
      slotKind: 'SCRIPTURE',
      slide: {
        id: 'entry-1',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        bookRef: { book: 'John', chapter: 3 },
        text: 'For God so loved the world',
        verseRange: '16',
        readingMode: 'normal',
      } as never,
    }),
  }
}

function makeImportedTextFixtures() {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'imported', importId: 'import-1', innerSlideId: 'inner-1' } }),
    assembledSlide: makeAssembled({
      slotKind: 'IMPORTED',
      slide: { id: 'entry-1', position: 0, contentKind: 'text', body: 'Imported paragraph text' } as never,
    }),
  }
}

function makeImportedImageFixtures() {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'imported', importId: 'import-1', innerSlideId: 'inner-2' } }),
    assembledSlide: makeAssembled({
      slotKind: 'IMPORTED',
      slide: { id: 'entry-1', position: 0, contentKind: 'image', imageUrl: 'https://example.com/a.png', altText: 'A slide' } as never,
    }),
  }
}

function makeAuthoredTextFixtures(body = 'Authored body') {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'text', title: 'New slide', body } }),
    assembledSlide: makeAssembled({
      slide: { id: 'entry-1', position: 0, contentKind: 'text', body } as never,
    }),
  }
}

function makeVideoFixtures() {
  return {
    entry: makeEntry({ id: 'entry-1', sourceRef: { kind: 'video', videoSrc: 'https://example.com/a.mp4' } }),
    assembledSlide: makeAssembled({
      slotKind: 'IMPORTED',
      slide: { id: 'entry-1', position: 0, contentKind: 'video', videoSrc: 'https://example.com/a.mp4' } as never,
    }),
  }
}

function makeAudioFile(name = 'new.mp3'): File {
  return new File(['fake-bytes'], name, { type: 'audio/mpeg' })
}

async function selectAudioAttachFile(file: File = makeAudioFile()) {
  const input = body().find('[data-testid="audio-attach-input"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

function mountDrawer(props: Partial<InstanceType<typeof EditSlideDrawer>['$props']> = {}) {
  const entry = 'entry' in props ? props.entry : makeEntry({ id: 'entry-1' })
  return mount(EditSlideDrawer, {
    props: {
      open: true,
      entry: entry ?? null,
      group: makeGroup({ slides: entry ? [entry] : [] }),
      planItem: makeSlot({ kind: 'MESSAGE', id: 'slot-1', position: 0 } as never),
      assembledSlide: makeAssembled(),
      position: 3,
      total: 6,
      orgId: 'org-1',
      serviceId: 'service-1',
      isEditor: true,
      ...props,
    },
  })
}

describe('EditSlideDrawer (Phase 26-05 Task 1 — shell)', () => {
  beforeEach(() => {
    mockReplaceGroupSlides.mockClear()
  })

  it('mounts the panel teleported to the document body when open with a resolvable entry', () => {
    mountDrawer()
    expect(body().find('[data-testid="edit-slide-drawer"]').exists()).toBe(true)
  })

  it('renders no backdrop, scrim, or full-screen dimming element at any time', () => {
    mountDrawer()
    expect(document.body.querySelectorAll('.fixed.inset-0').length).toBe(0)
    expect(document.body.querySelectorAll('[class*="bg-black"]').length).toBe(0)
  })

  it('renders the title, the close control and its accessible name', () => {
    mountDrawer()
    expect(body().find('[data-testid="edit-slide-drawer-title"]').text()).toBe('Edit Slide')
    const close = body().find('[data-testid="edit-slide-drawer-close"]')
    expect(close.exists()).toBe(true)
    expect(close.attributes('aria-label')).toBe('Close')
  })

  it('emits a close intent when the close control is activated', async () => {
    const wrapper = mountDrawer()
    await body().find('[data-testid="edit-slide-drawer-close"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits a close intent when Escape is pressed while open', () => {
    const wrapper = mountDrawer()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits nothing on a subsequent Escape once the panel has closed', async () => {
    const wrapper = mountDrawer()
    await body().find('[data-testid="edit-slide-drawer-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.setProps({ open: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('removes the Escape listener on unmount so a torn-down panel never swallows the key', () => {
    const wrapper = mountDrawer()
    wrapper.unmount()
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow()
  })

  it("shows the context line's kind badge, source title and position within the group", () => {
    mountDrawer({ planItem: makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songTitle: 'This Is Our God' } as never) })
    expect(body().find('[data-testid="drawer-kind-badge"]').text()).toBe('SONG')
    const context = body().find('[data-testid="drawer-context-text"]').text()
    expect(context).toContain('This Is Our God')
    expect(context).toContain('slide 3 of 6')
  })

  it('previews centred text for a text-bearing slide', () => {
    mountDrawer({
      assembledSlide: makeAssembled({ slide: { id: 'entry-1', position: 0, contentKind: 'text', body: 'Hello world' } as never }),
    })
    expect(body().find('[data-testid="drawer-preview-text"]').text()).toBe('Hello world')
    expect(body().find('[data-testid="drawer-preview-image"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-preview-video-glyph"]').exists()).toBe(false)
  })

  it('previews an image for an image slide', () => {
    mountDrawer({
      assembledSlide: makeAssembled({
        slotKind: 'IMPORTED',
        slide: { id: 'entry-1', position: 0, contentKind: 'image', imageUrl: 'https://example.com/a.png', altText: 'A slide' } as never,
      }),
    })
    const img = body().find('[data-testid="drawer-preview-image"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('previews a static, non-interactive glyph and no player element for a video slide', () => {
    mountDrawer({
      assembledSlide: makeAssembled({
        slotKind: 'IMPORTED',
        slide: { id: 'entry-1', position: 0, contentKind: 'video', videoSrc: 'https://example.com/a.mp4' } as never,
      }),
    })
    expect(body().find('[data-testid="drawer-preview-video-glyph"]').exists()).toBe(true)
    expect(document.body.querySelectorAll('video').length).toBe(0)
    expect(document.body.querySelectorAll('audio').length).toBe(0)
  })

  it('renders nothing in the document body when closed', () => {
    mountDrawer({ open: false })
    expect(body().find('[data-testid="edit-slide-drawer"]').exists()).toBe(false)
  })

  it('renders nothing when open with no resolvable entry', () => {
    mountDrawer({ entry: null })
    expect(body().find('[data-testid="edit-slide-drawer"]').exists()).toBe(false)
  })

  it('renders no Save, Cancel, Tag or Details control', () => {
    const wrapper = mountDrawer()
    const text = wrapper.html() + body().html()
    expect(text).not.toContain('>Save<')
    expect(text).not.toContain('>Cancel<')
    expect(text).not.toContain('>Tag<')
    expect(text).not.toContain('>Details<')
  })
})

describe('EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows both fields with the entry's current values and the UI-SPEC's labels", () => {
    mountDrawer({ entry: makeEntry({ id: 'entry-1', label: 'Verse 1', notes: 'Dim the lights' }) })
    expect(body().find('[data-testid="drawer-label-input"]').element.getAttribute('value') ?? (body().find('[data-testid="drawer-label-input"]').element as HTMLInputElement).value).toBe('Verse 1')
    expect((body().find('[data-testid="drawer-notes-input"]').element as HTMLTextAreaElement).value).toBe('Dim the lights')
    expect(body().text()).toContain('Slide Label')
    expect(body().text()).toContain('Notes')
  })

  it('writes exactly once after the debounce period following a single label edit', async () => {
    mountDrawer({ entry: makeEntry({ id: 'entry-1', label: '' }) })
    await body().find('[data-testid="drawer-label-input"]').setValue('New Label')
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
  })

  it('collapses several rapid keystrokes into a single write, not one per keystroke', async () => {
    mountDrawer({ entry: makeEntry({ id: 'entry-1', label: '' }) })
    const input = body().find('[data-testid="drawer-label-input"]')
    await input.setValue('N')
    await input.setValue('Ne')
    await input.setValue('New')
    await input.setValue('New ')
    await input.setValue('New L')

    await vi.advanceTimersByTimeAsync(800)
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
  })

  it('writes the edit on the target entry only, passing every other entry through unchanged by value', async () => {
    const entryOne = makeEntry({ id: 'entry-1', label: 'Original' })
    const entryTwo = makeEntry({ id: 'entry-2', label: 'Untouched', notes: 'Keep me' })
    mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne, entryTwo] }) })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed')
    await vi.advanceTimersByTimeAsync(800)

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect(written.find((e) => e.id === 'entry-1')?.label).toBe('Changed')
    expect(written.find((e) => e.id === 'entry-2')).toEqual(entryTwo)
  })

  it('passes the FRESHLY-READ group slides as the write base, not the array captured when the drawer opened', async () => {
    const entryOne = makeEntry({ id: 'entry-1', label: 'Original' })
    const wrapper = mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne] }) })

    // A concurrent change lands on the group WHILE this drawer stays open —
    // e.g. another write appended a second entry.
    const entryTwo = makeEntry({ id: 'entry-2', label: 'Concurrently added' })
    const updatedGroup = makeGroup({ slides: [entryOne, entryTwo] })
    await wrapper.setProps({ group: updatedGroup })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed')
    await vi.advanceTimersByTimeAsync(800)

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const baseSlides = mockReplaceGroupSlides.mock.calls[0]![4] as GroupSlideEntry[]
    // `toBe` would fail here for a reason unrelated to freshness: Vue wraps a
    // reactive prop's array in a Proxy, so the base read from `props.group.slides`
    // is never `===` the raw array passed to `setProps` even when it IS the
    // live, current value. Structural equality against the UPDATED (not the
    // originally-mounted) array is the correct assertion of freshness here.
    expect(baseSlides).toStrictEqual(updatedGroup.slides)
    expect(baseSlides.some((e) => e.id === 'entry-2')).toBe(true)
  })

  it('flushes the pending write for the entry being left when the edited entry switches mid-edit', async () => {
    const entryOne = makeEntry({ id: 'entry-1', label: 'Original' })
    const entryTwo = makeEntry({ id: 'entry-2', label: 'Other' })
    const group = makeGroup({ slides: [entryOne, entryTwo] })
    const wrapper = mountDrawer({ entry: entryOne, group })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed before leaving')
    // Switch away before the debounce fires — the pending write must flush now.
    await wrapper.setProps({ entry: entryTwo })
    await flushPromises()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect(written.find((e) => e.id === 'entry-1')?.label).toBe('Changed before leaving')
  })

  it('CR-01 regression: flushing a Label edit and a Notes edit on the SAME entry together (switching entries before either debounce fires) commits BOTH edits, not just one', async () => {
    const entryOne = makeEntry({ id: 'entry-1', label: 'Original label', notes: 'Original notes' })
    const entryTwo = makeEntry({ id: 'entry-2', label: 'Other' })
    const group = makeGroup({ slides: [entryOne, entryTwo] })
    const wrapper = mountDrawer({ entry: entryOne, group })

    await body().find('[data-testid="drawer-label-input"]').setValue('New label')
    await body().find('[data-testid="drawer-notes-input"]').setValue('New notes')

    // `flushAll` must await the label flush before starting the notes flush,
    // so the notes write's `writeField` reads a base that already reflects
    // the label write's result — exactly what the store's own snapshot
    // round-trip would deliver between the two sequential awaits in real use.
    // Simulate that round-trip here: resolving the FIRST (label) write updates
    // the live `group` prop before the SECOND (notes) write reads it.
    mockReplaceGroupSlides.mockImplementationOnce(async () => {
      const withLabelApplied = { ...entryOne, label: 'New label' }
      await wrapper.setProps({ group: makeGroup({ slides: [withLabelApplied, entryTwo] }) })
    })

    // Switching to a different entry before the 800ms debounce fires triggers
    // `flushAll`, which must flush both the pending label and notes writes.
    await wrapper.setProps({ entry: entryTwo })
    await flushPromises()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(2)
    // The SECOND write to land (notes) is the one whose `next` must carry
    // BOTH edits — under the old parallel `Promise.all` bug, this write's
    // `next` was computed from the pre-label-write base and would silently
    // discard the label edit.
    const secondWriteNext = mockReplaceGroupSlides.mock.calls[1]![2] as GroupSlideEntry[]
    const written = secondWriteNext.find((e) => e.id === 'entry-1')
    expect(written?.label).toBe('New label')
    expect(written?.notes).toBe('New notes')
  })

  it('shows a saving state during the write and a saved state after it resolves', async () => {
    let resolveWrite: () => void = () => {}
    mockReplaceGroupSlides.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveWrite = resolve }),
    )
    mountDrawer({ entry: makeEntry({ id: 'entry-1', label: '' }) })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed')
    await vi.advanceTimersByTimeAsync(800)
    expect(body().find('[data-testid="drawer-status"]').text()).toBe('Saving…')

    resolveWrite()
    await flushPromises()
    expect(body().find('[data-testid="drawer-status"]').text()).toBe('Saved')
  })

  it('surfaces a failure (never a false saved state) on a rejected write, and does not revert the typed value', async () => {
    mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mountDrawer({ entry: makeEntry({ id: 'entry-1', label: '' }) })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()

    expect(body().find('[data-testid="drawer-status"]').text()).not.toBe('Saved')
    expect((body().find('[data-testid="drawer-label-input"]').element as HTMLInputElement).value).toBe('Changed')
    consoleErrorSpy.mockRestore()
  })

  it('renders neither field for a user without write capability, while the slide information still reads', () => {
    mountDrawer({ entry: makeEntry({ id: 'entry-1', label: 'Verse 1' }), isEditor: false })
    expect(body().find('[data-testid="drawer-label-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-notes-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-preview-text"]').exists()).toBe(true)
  })

  it("re-syncs the panel's own field copy when the persisted entry changes", async () => {
    const entryOne = makeEntry({ id: 'entry-1', label: 'Original' })
    const wrapper = mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne] }) })

    const updatedEntry = makeEntry({ id: 'entry-1', label: 'Updated elsewhere' })
    await wrapper.setProps({ entry: updatedEntry, group: makeGroup({ slides: [updatedEntry] }) })

    expect((body().find('[data-testid="drawer-label-input"]').element as HTMLInputElement).value).toBe('Updated elsewhere')
  })
})

describe('EditSlideDrawer (Phase 26-07 Task 1 — per-kind Slide Text)', () => {
  it.each([
    { name: 'lyric', fixtures: makeLyricFixtures(), expectedCaption: "From the song's Lyrics tab — editing there updates every service using this song." },
    { name: 'copyright', fixtures: makeCopyrightFixtures(), expectedCaption: "From the song's Lyrics tab — editing there updates every service using this song." },
    { name: 'scripture', fixtures: makeScriptureFixtures(), expectedCaption: 'Pulled from the passage reference — editing the reference updates this slide.' },
    { name: 'imported (text)', fixtures: makeImportedTextFixtures(), expectedCaption: 'From the imported file — re-import to change it.' },
  ])('renders the matrix treatment and caption for a $name-kind entry', ({ fixtures, expectedCaption }) => {
    mountDrawer({ entry: fixtures.entry, assembledSlide: fixtures.assembledSlide, group: makeGroup({ slides: [fixtures.entry] }) })
    expect(body().find('[data-testid="drawer-slide-text-readonly"]').exists() || body().find('[data-testid="drawer-copyright-block"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-slide-text-caption"]').text()).toBe(expectedCaption)
  })

  it('renders the lyric-section slide read-only with its lines', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-slide-text-readonly"]').text()).toBe('Line one\nLine two')
    expect(body().find('[data-testid="drawer-slide-text-editable"]').exists()).toBe(false)
  })

  it('renders the copyright slide read-only with title/authors/CCLI#/license#, from the resolved slide', () => {
    const { entry, assembledSlide } = makeCopyrightFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-copyright-title"]').text()).toBe('This Is Our God')
    expect(body().find('[data-testid="drawer-copyright-authors"]').text()).toBe('Author A, Author B')
    expect(body().find('[data-testid="drawer-copyright-ccli"]').text()).toBe('1234567')
    expect(body().find('[data-testid="drawer-copyright-license"]').text()).toBe('7654321')
  })

  it('renders the scripture slide read-only with its passage text', () => {
    const { entry, assembledSlide } = makeScriptureFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-slide-text-readonly"]').text()).toBe('For God so loved the world')
  })

  it('renders an imported slide whose resolved content is TEXT as read-only text (by its shared source kind)', () => {
    const { entry, assembledSlide } = makeImportedTextFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-slide-text-readonly"]').text()).toBe('Imported paragraph text')
  })

  it('renders an imported slide whose resolved content is a PICTURE as the picture alone, with no separate words block (by its shared source kind)', () => {
    const { entry, assembledSlide } = makeImportedImageFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-preview-image"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-slide-text-readonly"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-slide-text-caption"]').exists()).toBe(false)
  })

  it('renders no Slide Text section at all for a video slide', () => {
    const { entry, assembledSlide } = makeVideoFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-slide-text-section"]').exists()).toBe(false)
  })

  it('renders an editable field, not a read-only block, for a hand-written slide', () => {
    const { entry, assembledSlide } = makeAuthoredTextFixtures('My own words')
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect(body().find('[data-testid="drawer-slide-text-editable"]').exists()).toBe(true)
    expect((body().find('[data-testid="drawer-slide-text-editable"]').element as HTMLTextAreaElement).value).toBe('My own words')
  })

  it('renders no caption clause about affecting only this slide or only this service, for any read-only kind', () => {
    for (const fixtures of [makeLyricFixtures(), makeCopyrightFixtures(), makeScriptureFixtures(), makeImportedTextFixtures()]) {
      mountDrawer({ entry: fixtures.entry, assembledSlide: fixtures.assembledSlide, group: makeGroup({ slides: [fixtures.entry] }) })
      const caption = body().find('[data-testid="drawer-slide-text-caption"]').text()
      expect(caption).not.toMatch(/only this (slide|service)/i)
    }
  })

  it('renders no override, unlink, or copy-for-this-service control for any kind', () => {
    for (const fixtures of [
      makeLyricFixtures(),
      makeCopyrightFixtures(),
      makeScriptureFixtures(),
      makeImportedTextFixtures(),
      makeImportedImageFixtures(),
      makeAuthoredTextFixtures(),
      makeVideoFixtures(),
    ]) {
      mountDrawer({ entry: fixtures.entry, assembledSlide: fixtures.assembledSlide, group: makeGroup({ slides: [fixtures.entry] }) })
      const text = body().text()
      expect(text).not.toMatch(/unlink/i)
      expect(text).not.toMatch(/override/i)
      expect(text).not.toMatch(/copy.*this service/i)
    }
  })
})

describe('EditSlideDrawer (Phase 26-07 Task 2 — hand-written slide edited here)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the hand-written slide's editable field with its current text", () => {
    const { entry, assembledSlide } = makeAuthoredTextFixtures('Current body')
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })
    expect((body().find('[data-testid="drawer-slide-text-editable"]').element as HTMLTextAreaElement).value).toBe('Current body')
  })

  it('writes exactly once after the debounce period following a single edit, replacing only the body on the source ref', async () => {
    const entryOne = makeEntry({ id: 'entry-1', sourceRef: { kind: 'text', title: 'New slide', body: '' } })
    const entryTwo = makeEntry({ id: 'entry-2', label: 'Untouched', sourceRef: { kind: 'text', title: 'Other', body: 'Other body' } })
    const assembledSlide = makeAssembled({ slide: { id: 'entry-1', position: 0, contentKind: 'text', body: '' } as never })
    mountDrawer({ entry: entryOne, assembledSlide, group: makeGroup({ slides: [entryOne, entryTwo] }) })

    await body().find('[data-testid="drawer-slide-text-editable"]').setValue('New body text')
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)

    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenOne = written.find((e) => e.id === 'entry-1')!
    expect(writtenOne.sourceRef).toEqual({ kind: 'text', title: 'New slide', body: 'New body text' })
    expect(writtenOne.order).toBe(entryOne.order)
    expect(written.find((e) => e.id === 'entry-2')).toEqual(entryTwo)
  })

  it("preserves the source ref's other members (the short default title) across the write", async () => {
    const entry = makeEntry({ id: 'entry-1', sourceRef: { kind: 'text', title: 'New slide', body: '' } })
    const assembledSlide = makeAssembled({ slide: { id: 'entry-1', position: 0, contentKind: 'text', body: '' } as never })
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-slide-text-editable"]').setValue('Body only changed')
    await vi.advanceTimersByTimeAsync(800)

    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenEntry = written.find((e) => e.id === 'entry-1')!
    expect(writtenEntry.sourceRef.kind).toBe('text')
    expect((writtenEntry.sourceRef as { title?: string }).title).toBe('New slide')
  })

  it('never re-mints the entry id or order while editing', async () => {
    const entry = makeEntry({ id: 'entry-1', order: 3, sourceRef: { kind: 'text', title: 'New slide', body: '' } })
    const assembledSlide = makeAssembled({ slide: { id: 'entry-1', position: 0, contentKind: 'text', body: '' } as never })
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-slide-text-editable"]').setValue('Changed')
    await vi.advanceTimersByTimeAsync(800)

    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenEntry = written.find((e) => e.id === 'entry-1')!
    expect(writtenEntry.id).toBe('entry-1')
    expect(writtenEntry.order).toBe(3)
  })

  it('flushes a pending body write when the edited entry switches mid-edit', async () => {
    const entryOne = makeEntry({ id: 'entry-1', sourceRef: { kind: 'text', title: 'New slide', body: '' } })
    const entryTwo = makeEntry({ id: 'entry-2', sourceRef: { kind: 'text', title: 'Other', body: 'Other body' } })
    const assembledSlide = makeAssembled({ slide: { id: 'entry-1', position: 0, contentKind: 'text', body: '' } as never })
    const wrapper = mountDrawer({ entry: entryOne, assembledSlide, group: makeGroup({ slides: [entryOne, entryTwo] }) })

    await body().find('[data-testid="drawer-slide-text-editable"]').setValue('Changed before leaving')
    await wrapper.setProps({
      entry: entryTwo,
      assembledSlide: makeAssembled({ slide: { id: 'entry-2', position: 0, contentKind: 'text', body: 'Other body' } as never }),
    })
    await flushPromises()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect((written.find((e) => e.id === 'entry-1')!.sourceRef as { body?: string }).body).toBe('Changed before leaving')
  })

  it('surfaces a failure (never a false saved state) on a rejected write, and does not revert the typed value', async () => {
    mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { entry, assembledSlide } = makeAuthoredTextFixtures('')
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-slide-text-editable"]').setValue('Changed')
    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()

    expect(body().find('[data-testid="drawer-status"]').text()).not.toBe('Saved')
    expect((body().find('[data-testid="drawer-slide-text-editable"]').element as HTMLTextAreaElement).value).toBe('Changed')
    consoleErrorSpy.mockRestore()
  })

  it('renders no editable field for a user without write capability, while the text still reads', () => {
    const { entry, assembledSlide } = makeAuthoredTextFixtures('Read me')
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }), isEditor: false })
    expect(body().find('[data-testid="drawer-slide-text-editable"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-slide-text-readonly"]').text()).toBe('Read me')
  })
})

describe('EditSlideDrawer (Phase 26-07 Task 3 — routes away, guarded)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
    mockRouterPush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("pushes the song destination with that song's id and the lyrics tab for a lyric-section slide", async () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-edit-in-song-link"]').trigger('click')

    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'songs', query: { edit: 'song-1', tab: 'lyrics' } })
  })

  it('pushes the same destination on the details tab for a copyright slide', async () => {
    const { entry, assembledSlide } = makeCopyrightFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-edit-in-song-link"]').trigger('click')

    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'songs', query: { edit: 'song-1', tab: 'details' } })
  })

  it('emits a request (not a navigation) for a scripture slide', async () => {
    const { entry, assembledSlide } = makeScriptureFixtures()
    const wrapper = mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-edit-in-scripture-link"]').trigger('click')

    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(wrapper.emitted('edit-in-scripture')).toBeTruthy()
  })

  it('offers no route for an imported slide, a video slide, or a hand-written slide', () => {
    for (const fixtures of [makeImportedTextFixtures(), makeImportedImageFixtures(), makeVideoFixtures(), makeAuthoredTextFixtures()]) {
      mountDrawer({ entry: fixtures.entry, assembledSlide: fixtures.assembledSlide, group: makeGroup({ slides: [fixtures.entry] }) })
      expect(body().find('[data-testid="drawer-edit-in-song-link"]').exists()).toBe(false)
      expect(body().find('[data-testid="drawer-edit-in-scripture-link"]').exists()).toBe(false)
    }
  })

  it('proceeds immediately, with no confirmation, when nothing is pending', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-edit-in-song-link"]').trigger('click')

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('typing then following a route, declining the confirmation: nothing navigates and the pending write still lands', async () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed label')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await body().find('[data-testid="drawer-edit-in-song-link"]').trigger('click')

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    expect(mockRouterPush).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  it('typing then following a route, accepting the confirmation: navigation happens and no write lands afterward', async () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed label')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await body().find('[data-testid="drawer-edit-in-song-link"]').trigger('click')

    expect(mockRouterPush).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(800)
    await flushPromises()
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("uses the existing guard's exact wording, introducing no new confirmation string", async () => {
    const { entry, assembledSlide } = makeScriptureFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-label-input"]').setValue('Changed label')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await body().find('[data-testid="drawer-edit-in-scripture-link"]').trigger('click')

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Discard them?')
    confirmSpy.mockRestore()
  })

  it('renders neither route for a user without write capability', () => {
    for (const fixtures of [makeLyricFixtures(), makeCopyrightFixtures(), makeScriptureFixtures()]) {
      mountDrawer({ entry: fixtures.entry, assembledSlide: fixtures.assembledSlide, group: makeGroup({ slides: [fixtures.entry] }), isEditor: false })
      expect(body().find('[data-testid="drawer-edit-in-song-link"]').exists()).toBe(false)
      expect(body().find('[data-testid="drawer-edit-in-scripture-link"]').exists()).toBe(false)
    }
  })
})

describe('EditSlideDrawer (Phase 26-08 Task 2 — loop where it means something, no audio at all on a video slide)', () => {
  beforeEach(() => {
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
    mockSetGroupBedMedia.mockReset()
    mockSetGroupBedMedia.mockResolvedValue(undefined)
    mockUploadAudioMedia.mockReset()
    mockResetAudioUpload.mockClear()
    audioUploadProgressRef.value = 0
    audioUploadErrorRef.value = null
    audioUploadIsUploadingRef.value = false
  })

  // ---- R058 — the per-slide "whole group" audio scope option is gone. ----

  it('★ never renders the removed audio-scope-choice control, in every audio state', () => {
    const noAudioEntry = makeEntry({ id: 'entry-1' })
    const noAudioWrapper = mountDrawer({ entry: noAudioEntry, group: makeGroup({ slides: [noAudioEntry] }) })
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
    noAudioWrapper.unmount()

    const slideAudioEntry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3' })
    const slideAudioWrapper = mountDrawer({ entry: slideAudioEntry, group: makeGroup({ slides: [slideAudioEntry] }) })
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
    slideAudioWrapper.unmount()

    const bedEntry = makeEntry({ id: 'entry-1' })
    const bedGroup = makeGroup({ slides: [bedEntry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry: bedEntry, group: bedGroup })
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
  })

  it("★ P-02: an entry with no audio of its own still shows the group's bed via the shared caption — removing the scope choice changed nothing about what plays", () => {
    const entry = makeEntry({ id: 'entry-1' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry, group })

    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-shared-caption"]').text()).toBe('Shared with every other slide in this group')
  })

  it('★ P-02: the audio-scope-hint renders only in the nothing-attached state, naming the group music control as the replacement', () => {
    const emptyEntry = makeEntry({ id: 'entry-1' })
    const emptyGroup = makeGroup({ slides: [emptyEntry] })
    const emptyWrapper = mountDrawer({ entry: emptyEntry, group: emptyGroup })
    expect(body().find('[data-testid="audio-attach"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-scope-hint"]').text()).toBe("For audio across the whole group, use the group's music control above the grid.")
    emptyWrapper.unmount()

    const ownAudioEntry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3' })
    const ownAudioWrapper = mountDrawer({ entry: ownAudioEntry, group: makeGroup({ slides: [ownAudioEntry] }) })
    expect(body().find('[data-testid="audio-scope-hint"]').exists()).toBe(false)
    ownAudioWrapper.unmount()

    const bedEntry = makeEntry({ id: 'entry-1' })
    const bedGroup = makeGroup({ slides: [bedEntry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry: bedEntry, group: bedGroup })
    expect(body().find('[data-testid="audio-scope-hint"]').exists()).toBe(false)
  })

  it('★ concurrency backstop: the surviving attach route writes only audioUrl on the patched entry — a stale local copy cannot reintroduce the removed scope field', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    mockUploadAudioMedia.mockResolvedValueOnce('https://example.com/orgs/org-1/media/m1/new.mp3')

    await selectAudioAttachFile()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenEntry = written.find((e) => e.id === 'entry-1')!
    expect(Object.keys(writtenEntry).sort()).toEqual(['audioUrl', 'id', 'order', 'sourceRef'].sort())
    expect(writtenEntry.audioUrl).toBe('https://example.com/orgs/org-1/media/m1/new.mp3')
  })

  it("shows the loop control enabled and reflecting the entry's stored flag with the slide's own audio", () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3', audioLoop: true })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    const checkbox = body().find('[data-testid="audio-loop-checkbox"]').element as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    expect(checkbox.disabled).toBe(false)
  })

  it('toggling the loop control persists immediately, with no debounce, touching only this entry', async () => {
    const entryOne = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3', audioLoop: false })
    const entryTwo = makeEntry({ id: 'entry-2', label: 'Untouched' })
    mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne, entryTwo] }) })

    await body().find('[data-testid="audio-loop-checkbox"]').setValue(true)

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect(written.find((e) => e.id === 'entry-1')?.audioLoop).toBe(true)
    expect(written.find((e) => e.id === 'entry-2')).toEqual(entryTwo)
  })

  it('shows the loop control unavailable and unchecked with the explanatory note in the whole-group state', () => {
    const entry = makeEntry({ id: 'entry-1' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry, group })

    const checkbox = body().find('[data-testid="audio-loop-checkbox"]').element as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    expect(checkbox.disabled).toBe(true)
    expect(body().find('[data-testid="audio-loop-disabled-note"]').text()).toBe("Group music doesn't loop — it plays continuously across the group.")
  })

  it('issues no write when the unavailable loop control is toggled', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry, group })

    await body().find('[data-testid="audio-loop-checkbox"]').trigger('change')

    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
  })

  it('renders no audio section at all for a video slide — no scope choice, no attach affordance, no loop control', () => {
    const { entry, assembledSlide } = makeVideoFixtures()
    mountDrawer({ entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-audio-section"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-attach-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-loop-checkbox"]').exists()).toBe(false)
  })

  it('renders no video attachment control anywhere in the panel', () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    expect(document.body.querySelectorAll('input[accept*="video"]').length).toBe(0)
    expect(body().text()).not.toMatch(/group.*video/i)
  })
})

describe('EditSlideDrawer (Phase 26-08 Task 3 — a missing audio file says so)', () => {
  beforeEach(() => {
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
    mockSetGroupBedMedia.mockReset()
    mockSetGroupBedMedia.mockResolvedValue(undefined)
  })

  it('shows a file name derived from the stored address', () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/track.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="audio-file-name"]').text()).toBe('track.mp3')
  })

  it('marks the file unavailable when the browser reports it cannot load, and keeps the remove control', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/track.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    await body().find('audio').trigger('error')

    expect(body().find('[data-testid="audio-unavailable"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-remove"]').exists()).toBe(true)
  })

  it('clears the unavailable marker when the attached file changes', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/track.mp3' })
    const wrapper = mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    await body().find('audio').trigger('error')
    expect(body().find('[data-testid="audio-unavailable"]').exists()).toBe(true)

    const updatedEntry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/other.mp3' })
    await wrapper.setProps({ entry: updatedEntry, group: makeGroup({ slides: [updatedEntry] }) })

    expect(body().find('[data-testid="audio-unavailable"]').exists()).toBe(false)
  })

  it('clears the unavailable marker when the edited slide changes', async () => {
    const entryOne = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/track.mp3' })
    const entryTwo = makeEntry({ id: 'entry-2', audioUrl: 'https://example.com/orgs/org-1/media/m1/track.mp3' })
    const wrapper = mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne, entryTwo] }) })
    await body().find('audio').trigger('error')
    expect(body().find('[data-testid="audio-unavailable"]').exists()).toBe(true)

    await wrapper.setProps({ entry: entryTwo })

    expect(body().find('[data-testid="audio-unavailable"]').exists()).toBe(false)
  })

  it('renders no duration element when the browser has reported none', () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/track.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="audio-duration"]').exists()).toBe(false)
  })
})

describe('EditSlideDrawer (Phase 26-09 Task 2 — Duplicate, follows the copy)', () => {
  beforeEach(() => {
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
  })

  it('renders the footer row with the copy action left of the delete trigger, above a divider', () => {
    mountDrawer()
    const footer = body().find('[data-testid="drawer-footer-actions"]')
    expect(footer.exists()).toBe(true)
    expect(footer.classes()).toContain('border-t')

    const duplicate = body().find('[data-testid="drawer-duplicate"]')
    const deleteTrigger = body().find('[data-testid="drawer-delete-trigger"]')
    expect(duplicate.exists()).toBe(true)
    expect(deleteTrigger.exists()).toBe(true)

    const footerHtml = footer.html()
    expect(footerHtml.indexOf('drawer-duplicate')).toBeLessThan(footerHtml.indexOf('drawer-delete-trigger'))
  })

  it('copies a slide: the written array has one more entry, positioned directly after the original', async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const entryTwo = makeEntry({ id: 'entry-2', order: 1 })
    const group = makeGroup({ slides: [entryOne, entryTwo] })
    mountDrawer({ entry: entryOne, group })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect(written).toHaveLength(3)
    expect(written[0]!.id).toBe('entry-1')
    expect(written[1]!.id).not.toBe('entry-1')
    expect(written[1]!.id).not.toBe('entry-2')
    expect(written[2]!.id).toBe('entry-2')
  })

  it("the copy's id differs from the original's and from every other entry's", async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const entryTwo = makeEntry({ id: 'entry-2', order: 1 })
    const group = makeGroup({ slides: [entryOne, entryTwo] })
    mountDrawer({ entry: entryOne, group })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const ids = written.map((e) => e.id)
    expect(new Set(ids).size).toBe(3)
  })

  it("the copy carries the original's label, notes, audio, loop and source reference", async () => {
    const entryOne = makeEntry({
      id: 'entry-1',
      order: 0,
      label: 'My label',
      notes: 'My notes',
      audioUrl: 'https://example.com/a.mp3',
      audioLoop: true,
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' },
    })
    const group = makeGroup({ slides: [entryOne] })
    mountDrawer({ entry: entryOne, group })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const copy = written.find((e) => e.id !== 'entry-1')
    expect(copy?.label).toBe('My label')
    expect(copy?.notes).toBe('My notes')
    expect(copy?.audioUrl).toBe('https://example.com/a.mp3')
    expect(copy?.audioLoop).toBe(true)
    expect(copy?.sourceRef).toEqual({ kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' })
  })

  it("every entry's order is contiguous after the write", async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const entryTwo = makeEntry({ id: 'entry-2', order: 1 })
    const entryThree = makeEntry({ id: 'entry-3', order: 2 })
    const group = makeGroup({ slides: [entryOne, entryTwo, entryThree] })
    mountDrawer({ entry: entryTwo, group })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect(written.map((e) => e.order)).toEqual(written.map((_, i) => i))
  })

  it('passes the base snapshot reflecting the group\'s slides at write time, not at mount', async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const wrapper = mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne] }) })

    const entryTwo = makeEntry({ id: 'entry-2', order: 1 })
    const updatedGroup = makeGroup({ slides: [entryOne, entryTwo] })
    await wrapper.setProps({ group: updatedGroup })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    const baseSlides = mockReplaceGroupSlides.mock.calls[0]![4] as GroupSlideEntry[]
    expect(baseSlides).toStrictEqual(updatedGroup.slides)
  })

  it("moves the panel's selection to the copy on a successful write (emits duplicate with the new id)", async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const group = makeGroup({ slides: [entryOne] })
    const wrapper = mountDrawer({ entry: entryOne, group })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('duplicate')).toBeTruthy()
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const copyId = written.find((e) => e.id !== 'entry-1')!.id
    expect(wrapper.emitted('duplicate')![0]).toEqual([copyId])
  })

  it('reports a rejected write and does not move the selection to a non-existent entry', async () => {
    mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const wrapper = mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne] }) })

    await body().find('[data-testid="drawer-duplicate"]').trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(wrapper.emitted('duplicate')).toBeFalsy()
    consoleErrorSpy.mockRestore()
  })

  it('does not render the copy action for a user without write capability', () => {
    mountDrawer({ isEditor: false })
    expect(body().find('[data-testid="drawer-duplicate"]').exists()).toBe(false)
  })
})

describe('EditSlideDrawer (Phase 26-09 Task 3 — Delete, behind a warning naming what goes with it)', () => {
  beforeEach(() => {
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
    mockSetGroupBedMedia.mockClear()
  })

  it('activating the delete trigger reveals the inline confirm block with the correct wording, and no separate dialog element exists', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/a.mp3', notes: 'Some note' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-delete-confirm"]').exists()).toBe(false)
    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')

    const confirm = body().find('[data-testid="drawer-delete-confirm"]')
    expect(confirm.exists()).toBe(true)
    expect(body().find('[data-testid="drawer-delete-confirm-body"]').text()).toBe(
      'Deleting this slide also removes its attached audio and operator notes. This cannot be undone.',
    )
    // No separate modal/dialog element — this is an inline block inside the panel.
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(0)
  })

  it('shows the audio-only wording', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/a.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    expect(body().find('[data-testid="drawer-delete-confirm-body"]').text()).toBe(
      'Deleting this slide also removes its attached audio. This cannot be undone.',
    )
  })

  it('shows the notes-only wording', async () => {
    const entry = makeEntry({ id: 'entry-1', notes: 'Some note' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    expect(body().find('[data-testid="drawer-delete-confirm-body"]').text()).toBe(
      'Deleting this slide also removes its operator notes. This cannot be undone.',
    )
  })

  it('shows the plain wording when neither audio nor notes are present', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    expect(body().find('[data-testid="drawer-delete-confirm-body"]').text()).toBe('Delete this slide? This cannot be undone.')
  })

  it('never names the group\'s shared bed music in the warning', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/a.mp3', notes: 'note' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/bed.mp3' })
    mountDrawer({ entry, group })
    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    const text = body().find('[data-testid="drawer-delete-confirm-body"]').text().toLowerCase()
    expect(text).not.toContain('group')
    expect(text).not.toContain('bed')
    expect(text).not.toContain('shared')
  })

  it('cancelling returns the panel to normal and deletes nothing', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    expect(body().find('[data-testid="drawer-delete-confirm"]').exists()).toBe(true)

    await body().find('[data-testid="drawer-delete-cancel"]').trigger('click')

    expect(body().find('[data-testid="drawer-delete-confirm"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-delete-trigger"]').exists()).toBe(true)
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
  })

  it('confirming removes only that entry from the written array and renumbers the rest contiguous, every other entry unchanged by value', async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0, label: 'Keep me' })
    const entryTwo = makeEntry({ id: 'entry-2', order: 1 })
    const entryThree = makeEntry({ id: 'entry-3', order: 2 })
    const group = makeGroup({ slides: [entryOne, entryTwo, entryThree] })
    mountDrawer({ entry: entryTwo, group })

    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    await body().find('[data-testid="drawer-delete-confirm-button"]').trigger('click')
    await flushPromises()

    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    expect(written.map((e) => e.id)).toEqual(['entry-1', 'entry-3'])
    expect(written.map((e) => e.order)).toEqual([0, 1])
    expect(written[0]!.label).toBe('Keep me')
  })

  it('passes the base snapshot reflecting the group\'s slides at write time', async () => {
    const entryOne = makeEntry({ id: 'entry-1', order: 0 })
    const wrapper = mountDrawer({ entry: entryOne, group: makeGroup({ slides: [entryOne] }) })

    const entryTwo = makeEntry({ id: 'entry-2', order: 1 })
    const updatedGroup = makeGroup({ slides: [entryOne, entryTwo] })
    await wrapper.setProps({ group: updatedGroup })

    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    await body().find('[data-testid="drawer-delete-confirm-button"]').trigger('click')
    await flushPromises()

    const baseSlides = mockReplaceGroupSlides.mock.calls[0]![4] as GroupSlideEntry[]
    expect(baseSlides).toStrictEqual(updatedGroup.slides)
  })

  it('never calls the group-bed write during a delete', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/bed.mp3' })
    mountDrawer({ entry, group })

    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    await body().find('[data-testid="drawer-delete-confirm-button"]').trigger('click')
    await flushPromises()

    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
  })

  it('reports a rejected write and leaves the entry in place', async () => {
    mockReplaceGroupSlides.mockRejectedValueOnce(new Error('write failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="drawer-delete-trigger"]').trigger('click')
    await body().find('[data-testid="drawer-delete-confirm-button"]').trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('does not render the delete trigger for a user without write capability', () => {
    mountDrawer({ isEditor: false })
    expect(body().find('[data-testid="drawer-delete-trigger"]').exists()).toBe(false)
  })
})

describe('EditSlideDrawer (R054 — song groups are read-only)', () => {
  // Explicit opt-back-into-SONG override — mountDrawer's own default is
  // MESSAGE as of Task 1, so every test below that needs a song group must
  // pass this planItem itself.
  const songPlanItem = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songTitle: 'This Is Our God' } as never)

  beforeEach(() => {
    mockReplaceGroupSlides.mockClear()
    mockSetGroupBedMedia.mockClear()
  })

  it('renders no label input, notes textarea, audio scope choice or audio attach input for a song group', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-label-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-notes-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-attach-input"]').exists()).toBe(false)
  })

  it('renders the audio file row but no Remove control when audio is already attached to a song group slide', () => {
    const entry = makeEntry({
      id: 'entry-1',
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' },
      audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3',
    })
    mountDrawer({ planItem: songPlanItem, entry, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-remove"]').exists()).toBe(false)
  })

  it('renders no editable slide-text textarea for a song group, even for a text-kind entry', () => {
    const { entry, assembledSlide } = makeAuthoredTextFixtures('Should not be editable here')
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-slide-text-editable"]').exists()).toBe(false)
  })

  it('renders no footer actions row, Duplicate control or Delete Slide trigger for a song group', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-footer-actions"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-duplicate"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-delete-trigger"]').exists()).toBe(false)
  })

  it('still offers the Edit in song link for a lyric entry in a song group', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-edit-in-song-link"]').exists()).toBe(true)
  })

  it('still offers the Edit in song link for a copyright entry in a song group', () => {
    const { entry, assembledSlide } = makeCopyrightFixtures()
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-edit-in-song-link"]').exists()).toBe(true)
  })

  it('shows the read-only notice naming the Song Lyrics screen for a song group', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }) })

    const notice = body().find('[data-testid="drawer-song-readonly-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toMatch(/Song Lyrics/)
  })

  it('renders no read-only notice for a non-song group', () => {
    mountDrawer() // Task 1's repointed default planItem is MESSAGE
    expect(body().find('[data-testid="drawer-song-readonly-notice"]').exists()).toBe(false)
  })

  it('behaves exactly as a viewer for a song group when not an editor: no mutation control appears', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({ planItem: songPlanItem, entry, assembledSlide, group: makeGroup({ slides: [entry] }), isEditor: false })

    expect(body().find('[data-testid="drawer-label-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-notes-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-footer-actions"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-edit-in-song-link"]').exists()).toBe(false)
  })

  // ME-03: the audio-loop row was the one mutation control the R054 lock sweep
  // missed. It was gated only on `v-if="audioState"`, its :disabled binding was
  // `audioState === 'group'` alone, and `onLoopToggle` had no canMutate/isEditor
  // guard — so a SONG group entry carrying its own audioUrl rendered an ENABLED
  // checkbox that wrote the song group's slides array straight from the Slides
  // tab, which is the exact CRUD R054 says a song group must block.
  it('renders the audio-loop checkbox disabled for a song group slide that carries its own audio', () => {
    const entry = makeEntry({
      id: 'entry-1',
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' },
      audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3',
    })
    mountDrawer({ planItem: songPlanItem, entry, group: makeGroup({ slides: [entry] }) })

    const checkbox = body().find('[data-testid="audio-loop-checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
  })

  it('issues no write when the song group\'s audio-loop control is toggled anyway', async () => {
    const entry = makeEntry({
      id: 'entry-1',
      sourceRef: { kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' },
      audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3',
    })
    mountDrawer({ planItem: songPlanItem, entry, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="audio-loop-checkbox"]').trigger('change')

    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
  })

  it('renders the audio-loop checkbox disabled for a VIEWER on any group', () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }), isEditor: false }) // default planItem is MESSAGE

    const checkbox = body().find('[data-testid="audio-loop-checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
  })

  it('issues no write when a viewer toggles the audio-loop control anyway', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }), isEditor: false })

    await body().find('[data-testid="audio-loop-checkbox"]').trigger('change')

    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
  })

  it('preserves every control for a non-song group (contrast case)', () => {
    const entry = makeEntry({ id: 'entry-1', label: 'Verse 1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) }) // default planItem is MESSAGE

    expect(body().find('[data-testid="drawer-label-input"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-notes-input"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-footer-actions"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-duplicate"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-delete-trigger"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-attach-input"]').exists()).toBe(true)
  })

  it("a scripture entry's slide-text block shows the passage reference when the resolved text is empty (R047 ripple)", () => {
    const { entry, assembledSlide } = makeScriptureFixtures()
    const emptyTextSlide = makeAssembled({
      slotKind: 'SCRIPTURE',
      slide: { ...assembledSlide.slide, text: '' } as never,
    })
    mountDrawer({ entry, assembledSlide: emptyTextSlide, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="drawer-slide-text-readonly"]').text()).toBe('John 3:16')
  })
})


// ── 31-04: the drawer opens read-only on a locked service (R036) ──────────────
describe('EditSlideDrawer - locked service (R036)', () => {
  const songPlanItem = makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songTitle: 'This Is Our God' } as never)

  beforeEach(() => {
    mockReplaceGroupSlides.mockClear()
    mockSetGroupBedMedia.mockClear()
  })

  it('★ still OPENS when locked — it is the only surface showing a slide at size', () => {
    mountDrawer({ serviceLocked: true })

    expect(body().find('[data-testid="edit-slide-drawer"]').exists()).toBe(true)
    // Everything that is a VIEW affordance stays.
    expect(body().find('[data-testid="drawer-preview"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-kind-badge"]').exists()).toBe(true)
    expect(body().find('[data-testid="drawer-context-line"]').exists()).toBe(true)
  })

  it('drops every mutation control when locked', () => {
    mountDrawer({ serviceLocked: true })

    expect(body().find('[data-testid="drawer-label-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-notes-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-attach"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-footer-actions"]').exists()).toBe(false)
  })

  // ★ The dynamic :data-testid is what keeps the two pre-existing assertions in
  // this file green with zero churn: `drawer-song-readonly-notice` still means
  // "song group", and never leaks onto the lifecycle-lock state.
  it('renders drawer-service-locked-notice (NOT the song testid) for a locked non-song group', () => {
    mountDrawer({ serviceLocked: true })

    const notice = body().find('[data-testid="drawer-service-locked-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toBe('This service is locked — reopen it for editing to change this slide.')
    expect(body().find('[data-testid="drawer-song-readonly-notice"]').exists()).toBe(false)
  })

  it('★ never stacks two notices — the song-group message wins, as the more specific restriction', () => {
    const { entry, assembledSlide } = makeLyricFixtures()
    mountDrawer({
      planItem: songPlanItem,
      entry,
      assembledSlide,
      group: makeGroup({ slides: [entry] }),
      serviceLocked: true,
    })

    expect(body().findAll('[data-testid="drawer-song-readonly-notice"]')).toHaveLength(1)
    expect(body().find('[data-testid="drawer-service-locked-notice"]').exists()).toBe(false)
    // A song's slides stay non-editable here even AFTER a reopen, which is why
    // that message is the more actionable one.
    expect(body().find('[data-testid="drawer-song-readonly-notice"]').text()).toMatch(/Song Lyrics/)
  })

  it('a viewer on an unlocked service still gets no notice — role is not a lifecycle lock', () => {
    mountDrawer({ isEditor: false })
    expect(body().find('[data-testid="drawer-service-locked-notice"]').exists()).toBe(false)
    expect(body().find('[data-testid="drawer-song-readonly-notice"]').exists()).toBe(false)
  })

  it('the loop checkbox is disabled when locked, and its handler refuses the write', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://storage.example.com/a.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }), serviceLocked: true })

    const checkbox = body().find('[data-testid="audio-loop-checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect(checkbox.attributes('disabled')).toBeDefined()

    await checkbox.trigger('change')
    await flushPromises()
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
  })

  // ---- ★ Handler-level guards (30-VERIFICATION I-01) -----------------------
  it('★ every mutation handler no-ops when locked, called directly rather than through its hidden control', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://storage.example.com/a.mp3' })
    const wrapper = mountDrawer({ entry, group: makeGroup({ slides: [entry] }), serviceLocked: true })
    const vm = wrapper.vm as unknown as {
      writeField: (f: string, id: string, v: string) => Promise<void>
      onRemoveAudio: () => Promise<void>
      onDuplicate: () => Promise<void>
      onDeleteTrigger: () => void
      showDeleteConfirm: boolean
      onConfirmDelete: () => Promise<void>
    }

    await vm.writeField('label', 'entry-1', 'renamed')
    await vm.onRemoveAudio()
    await vm.onDuplicate()
    vm.onDeleteTrigger()
    await vm.onConfirmDelete()
    await flushPromises()

    expect(vm.showDeleteConfirm).toBe(false)
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    expect(wrapper.emitted('duplicate')).toBeUndefined()
  })

  it('the same handlers DO act on an unlocked service — the guard is the lock, not a blanket no-op', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    const wrapper = mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    const vm = wrapper.vm as unknown as { writeField: (f: string, id: string, v: string) => Promise<void> }

    await vm.writeField('label', 'entry-1', 'renamed')
    await flushPromises()
    expect(mockReplaceGroupSlides).toHaveBeenCalled()
  })
})
