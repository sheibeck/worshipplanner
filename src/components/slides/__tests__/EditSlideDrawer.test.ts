import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import EditSlideDrawer from '../EditSlideDrawer.vue'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'

// --- 26-05 Task 3: the drawer calls the slideGroups store directly for its
// fresh-base label/notes writes (Pattern 2/Pitfall 2). Mocked here so Task 1's
// shell-only tests never touch Firestore, and Task 3 controls the mock's
// resolved/rejected behavior per test. ---
const mockReplaceGroupSlides = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    replaceGroupSlides: mockReplaceGroupSlides,
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
    mockReplaceGroupSlides.mockImplementationOnce(() => new Promise((resolve) => { resolveWrite = resolve }))
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
