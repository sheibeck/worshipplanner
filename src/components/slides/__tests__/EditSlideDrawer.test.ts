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
      planItem: makeSlot({ kind: 'SONG', id: 'slot-1', position: 0, songTitle: 'This Is Our God' } as never),
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
    mountDrawer()
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

describe('EditSlideDrawer (Phase 26-08 Task 1 — audio scope and its two write routes)', () => {
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

  it('shows the scope choice defaulted to this-slide-only and an attach affordance when nothing is attached', () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-scope-slide"]').classes()).toContain('bg-indigo-600')
    expect(body().find('[data-testid="audio-scope-group"]').classes()).not.toContain('bg-indigo-600')
    expect(body().find('[data-testid="audio-attach-input"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(false)
  })

  it("shows the slide's own audio file with a remove control, and the scope reads as this slide only", () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3', audioScope: 'slide' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-file-name"]').text()).toBe('song.mp3')
    expect(body().find('[data-testid="audio-remove"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-scope-slide"]').classes()).toContain('bg-indigo-600')
    expect(body().find('[data-testid="audio-shared-caption"]').exists()).toBe(false)
  })

  it("shows the group's shared music with the shared caption, and the scope reads as the whole group", () => {
    const entry = makeEntry({ id: 'entry-1', audioScope: 'group' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry, group })

    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-file-name"]').text()).toBe('bed.mp3')
    expect(body().find('[data-testid="audio-shared-caption"]').text()).toBe('Shared with every other slide in this group')
    expect(body().find('[data-testid="audio-scope-group"]').classes()).toContain('bg-indigo-600')
  })

  it('attaches a file with this-slide-only chosen: the per-entry write carries the URL and the stamped scope, and the group-music write is not called', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    mockUploadAudioMedia.mockResolvedValueOnce('https://example.com/orgs/org-1/media/m1/new.mp3')

    await selectAudioAttachFile()

    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenEntry = written.find((e) => e.id === 'entry-1')!
    expect(writtenEntry.audioUrl).toBe('https://example.com/orgs/org-1/media/m1/new.mp3')
    expect(writtenEntry.audioScope).toBe('slide')
  })

  it("attaches a file with the whole group chosen: the group-music write carries the URL, and the per-entry write stamps the scope without setting the entry's own audio", async () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    mockUploadAudioMedia.mockResolvedValueOnce('https://example.com/orgs/org-1/media/m1/new.mp3')

    await body().find('[data-testid="audio-scope-group"]').trigger('click')
    await selectAudioAttachFile()

    expect(mockSetGroupBedMedia).toHaveBeenCalledWith('org-1', 'slot-1', {
      serviceId: 'service-1',
      bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/new.mp3',
    })
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenEntry = written.find((e) => e.id === 'entry-1')!
    expect(writtenEntry.audioUrl).toBeUndefined()
    expect(writtenEntry.audioScope).toBe('group')
  })

  it('changes the scope choice with a file already attached and moves nothing', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3', audioScope: 'slide' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="audio-scope-group"]').trigger('click')

    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-file-name"]').text()).toBe('song.mp3')
  })

  it('removes the slide\'s own audio: the written entry has no audio key at all, and the group-music write is not called', async () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3', audioScope: 'slide' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })

    await body().find('[data-testid="audio-remove"]').trigger('click')
    await flushPromises()

    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
    expect(mockReplaceGroupSlides).toHaveBeenCalledTimes(1)
    const written = mockReplaceGroupSlides.mock.calls[0]![2] as GroupSlideEntry[]
    const writtenEntry = written.find((e) => e.id === 'entry-1')!
    expect('audioUrl' in writtenEntry).toBe(false)
  })

  it("removes while the group's music is shown: the group-music write uses the explicit clear flag", async () => {
    const entry = makeEntry({ id: 'entry-1', audioScope: 'group' })
    const group = makeGroup({ slides: [entry], bedAudioUrl: 'https://example.com/orgs/org-1/media/m1/bed.mp3' })
    mountDrawer({ entry, group })

    await body().find('[data-testid="audio-remove"]').trigger('click')
    await flushPromises()

    expect(mockSetGroupBedMedia).toHaveBeenCalledWith('org-1', 'slot-1', { serviceId: 'service-1', clearAudio: true })
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
  })

  it('forces an upload failure: the error renders and no write occurs', async () => {
    const entry = makeEntry({ id: 'entry-1' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }) })
    mockUploadAudioMedia.mockImplementationOnce(() => {
      audioUploadErrorRef.value = 'Unsupported file type "text/plain" — only audio or video files can be attached.'
      return Promise.reject(new Error('Unsupported file type.'))
    })

    await selectAudioAttachFile()

    expect(body().find('[data-testid="audio-upload-error"]').text()).toBe('Unsupported file type "text/plain" — only audio or video files can be attached.')
    expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    expect(mockSetGroupBedMedia).not.toHaveBeenCalled()
  })

  it('renders no attach, scope or remove control for a user without write capability, while an attached file still previews', () => {
    const entry = makeEntry({ id: 'entry-1', audioUrl: 'https://example.com/orgs/org-1/media/m1/song.mp3' })
    mountDrawer({ entry, group: makeGroup({ slides: [entry] }), isEditor: false })

    expect(body().find('[data-testid="audio-attach-input"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-scope-choice"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-remove"]').exists()).toBe(false)
    expect(body().find('[data-testid="audio-file-row"]').exists()).toBe(true)
    expect(body().find('[data-testid="audio-file-name"]').text()).toBe('song.mp3')
  })
})

describe('EditSlideDrawer (Phase 26-08 Task 2 — loop where it means something, no audio at all on a video slide)', () => {
  beforeEach(() => {
    mockReplaceGroupSlides.mockReset()
    mockReplaceGroupSlides.mockResolvedValue(undefined)
    mockSetGroupBedMedia.mockReset()
    mockSetGroupBedMedia.mockResolvedValue(undefined)
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

