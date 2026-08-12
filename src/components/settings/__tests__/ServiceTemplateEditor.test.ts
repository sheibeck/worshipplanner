/**
 * Wave 2 harness (Phase 44, Plan 02) — mounts ServiceTemplateEditor.vue
 * against a mocked `@/stores/auth` (no slide-group/song-store deps, per
 * 44-02-PLAN.md's Task 1 action). Mirrors the reactive `mockAuthState`
 * pattern established in ServiceEditorView.test.ts:352-377, and the
 * `sortablejs` capture-harness pattern established in
 * ServiceEditorView.test.ts:66-107 — `Sortable.create()` never fires a real
 * browser drag in jsdom, so a capturing mock lets reorder tests invoke
 * `onEnd` directly against the exact options the mounted component
 * registered.
 *
 * The panel's entire markup lives inside a `<Teleport to="body">` (structural
 * port of EditSlideDrawer.vue), so — mirroring EditSlideDrawer.test.ts's own
 * `body()` helper — every DOM query below reads through a `DOMWrapper` over
 * `document.body` rather than the mounted `wrapper` itself, which does not
 * include teleported content in its own vnode tree. `enableAutoUnmount`
 * ensures each test's teleported panel is removed from `document.body`
 * before the next test mounts a fresh one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { Options as SortableOptions } from 'sortablejs'
import ServiceTemplateEditor from '../ServiceTemplateEditor.vue'
import type { ServiceTemplateEntry } from '@/types/organization'

enableAutoUnmount(afterEach)

function body(): DOMWrapper<HTMLElement> {
  return new DOMWrapper(document.body)
}

// ── firebase/firestore + @/firebase mocks ───────────────────────────────────
const { mockUpdateDoc } = vi.hoisted(() => ({
  mockUpdateDoc: vi.fn((_ref: unknown, _data: Record<string, unknown>) => Promise.resolve()),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  updateDoc: mockUpdateDoc,
}))

vi.mock('@/firebase', () => ({
  db: {},
}))

// ── sortablejs capture harness (ServiceEditorView.test.ts:66-107 pattern) ──
interface SortableCapture {
  el: HTMLElement
  options: SortableOptions
}
let sortableCaptures: SortableCapture[] = []
const mockSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((el: HTMLElement, options: SortableOptions) => {
      sortableCaptures.push({ el, options })
      return { destroy: mockSortableDestroy }
    }),
  },
}))

function resetSortableCaptures(): void {
  sortableCaptures = []
  mockSortableDestroy.mockClear()
}

function captureForSection(section: string): SortableCapture | undefined {
  return sortableCaptures.find((c) => c.el.dataset.section === section)
}

function captureForUngrouped(): SortableCapture | undefined {
  return sortableCaptures.find((c) => c.el.dataset.section === undefined)
}

// ── @/stores/auth mock — reactive, mirroring ServiceEditorView.test.ts:352-377 ──
const mockAuthState = reactive<{
  orgId: string | null
  isEditor: boolean
  settings: {
    aiEnabled: boolean
    pcEnabled: boolean
    vwModeEnabled: boolean
    defaultServiceTemplate: ServiceTemplateEntry[]
  }
}>({
  orgId: 'org-1',
  isEditor: true,
  settings: {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    defaultServiceTemplate: [],
  },
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

function mountEditor(isOpen = true) {
  return mount(ServiceTemplateEditor, { props: { isOpen } })
}

function templateItems() {
  return body().findAll('[data-testid="template-item"]')
}

// ── Per-row ⋯ menu helpers (Phase 57 — mirror ServiceEditorView.test.ts's
//    openRowMenu/moveSlotViaRowMenu/deleteSlotViaRowMenu). Rows render in
//    section-major order; these drive the menu by rendered index and return the
//    entry id read off the trigger's testid. ──
async function openRowMenuByIndex(index: number): Promise<string> {
  const trigger = body().findAll('[data-testid^="template-row-menu-trigger-"]')[index]!
  const id = trigger.attributes('data-testid')!.replace('template-row-menu-trigger-', '')
  await trigger.trigger('click')
  await flushPromises()
  return id
}

/** Open a row's ⋯ menu and click a Move-to-section item. `value` is a
 *  ServiceSection key, or '' for "No section" (maps to the `no-section` suffix). */
async function moveViaRowMenu(index: number, value: string): Promise<void> {
  const id = await openRowMenuByIndex(index)
  const suffix = value === '' ? 'no-section' : value
  await body().get(`[data-testid="template-row-menu-move-${id}-${suffix}"]`).trigger('click')
  await flushPromises()
}

/** Open a row's ⋯ menu and click its Delete item (fires removeEntry immediately). */
async function deleteViaRowMenu(index: number): Promise<void> {
  const id = await openRowMenuByIndex(index)
  await body().get(`[data-testid="template-row-menu-delete-${id}"]`).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  mockAuthState.orgId = 'org-1'
  mockAuthState.isEditor = true
  mockAuthState.settings.aiEnabled = true
  mockAuthState.settings.pcEnabled = true
  mockAuthState.settings.vwModeEnabled = true
  mockAuthState.settings.defaultServiceTemplate = []
  mockUpdateDoc.mockClear()
  mockUpdateDoc.mockImplementation((_ref: unknown, _data: Record<string, unknown>) => Promise.resolve())
  resetSortableCaptures()
})

describe('ServiceTemplateEditor — panel shell', () => {
  it('mounts closed: renders nothing when isOpen is false', () => {
    mountEditor(false)
    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(false)
  })

  it('opening renders the right-edge panel with title, close button, body, and footer', () => {
    mountEditor(true)
    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(true)
    expect(body().get('[data-testid="service-template-editor-title"]').text()).toBe('Edit Default Template')
    expect(body().find('[data-testid="service-template-editor-close"]').exists()).toBe(true)
    expect(body().find('[data-testid="template-editor-footer"]').exists()).toBe(true)
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountEditor(true)
    await body().get('[data-testid="service-template-editor-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('ServiceTemplateEditor — empty state (valid, not an error)', () => {
  it('renders the "No items yet" empty state on an empty template', () => {
    mountEditor(true)
    expect(body().find('[data-testid="template-empty-state"]').exists()).toBe(true)
    expect(body().text()).toContain('No items yet')
  })

  it('keeps Save Template enabled on an empty draft', () => {
    mountEditor(true)
    const saveButton = body().get('[data-testid="template-save"]')
    expect(saveButton.attributes('disabled')).toBeUndefined()
  })
})

describe('ServiceTemplateEditor — add-item palette (closed six-button set, R084)', () => {
  it('shows exactly the six Phase 43 chips and never Hymn or Imported', () => {
    mountEditor(true)
    for (const testid of [
      'palette-add-song',
      'palette-add-scripture',
      'palette-add-prayer',
      'palette-add-message',
      'palette-add-announcements',
      'palette-add-misc',
    ]) {
      expect(body().find(`[data-testid="${testid}"]`).exists()).toBe(true)
    }
    expect(body().find('[data-testid="palette-add-hymn"]').exists()).toBe(false)
    expect(body().find('[data-testid="palette-add-imported"]').exists()).toBe(false)
  })

  it('clicking a chip appends a content-free entry with a fresh id and an unset section', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()

    const items = templateItems()
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('Song')

    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(1)
    expect(entries[0]!.kind).toBe('SONG')
    expect(typeof entries[0]!.id).toBe('string')
    expect(entries[0]!.id.length).toBeGreaterThan(0)
    // section: undefined must be a legitimate, saveable value (UI-SPEC "partial" backstop) —
    // stripUndefined drops the key entirely rather than persisting `section: undefined`.
    expect(Object.keys(entries[0]!)).toEqual(['id', 'kind'])
  })

  it('two chip clicks mint two distinct ids', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await body().get('[data-testid="palette-add-prayer"]').trigger('click')
    await flushPromises()
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(2)
    expect(entries[0]!.id).not.toBe(entries[1]!.id)
  })
})

describe('ServiceTemplateEditor — per-row ⋯ menu, badge, and accessibility', () => {
  it('each row\'s ⋯ menu exposes Move-to-section (No section + SERVICE_SECTIONS) and an immediate Delete; the inline select/remove are gone', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()

    const id = await openRowMenuByIndex(0)
    // Move-to-section option set mirrors the retired section <select>: No section + the five sections.
    for (const suffix of ['no-section', 'pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(body().find(`[data-testid="template-row-menu-move-${id}-${suffix}"]`).exists()).toBe(true)
    }
    expect(body().find(`[data-testid="template-row-menu-delete-${id}"]`).exists()).toBe(true)
    // The inline controls no longer exist anywhere in the rendered DOM.
    expect(body().find('[data-testid="template-section-select"]').exists()).toBe(false)
    expect(body().find('[data-testid="template-item-remove"]').exists()).toBe(false)

    await body().get(`[data-testid="template-row-menu-delete-${id}"]`).trigger('click')
    await flushPromises()

    // Fires immediately — no confirmation dialog anywhere in the DOM.
    expect(templateItems()).toHaveLength(0)
    expect(body().find('[data-testid="template-reset-confirm"]').exists()).toBe(false)
  })

  it('the ⋯ menu Move-to-section moves the item into that section\'s group and closes the menu', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()

    await moveViaRowMenu(0, 'message')

    expect(body().find('[data-testid="template-section-header-message"]').exists()).toBe(true)
    expect(body().get('[data-testid="template-section-list-message"]').text()).toContain('Song')
    // Menu closed after the move.
    expect(body().find('[data-testid^="template-row-menu-panel-"]').exists()).toBe(false)
  })

  it('opening a second row\'s ⋯ menu closes the first (single-open); the backdrop closes the open menu', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await body().get('[data-testid="palette-add-prayer"]').trigger('click')
    await flushPromises()

    const id0 = await openRowMenuByIndex(0)
    expect(body().find(`[data-testid="template-row-menu-panel-${id0}"]`).exists()).toBe(true)

    const id1 = await openRowMenuByIndex(1)
    expect(body().find(`[data-testid="template-row-menu-panel-${id0}"]`).exists()).toBe(false)
    expect(body().find(`[data-testid="template-row-menu-panel-${id1}"]`).exists()).toBe(true)

    // Backdrop click closes the open menu (exactly one backdrop is present while a menu is open).
    await body().findAll('.fixed.inset-0.z-10')[0]!.trigger('click')
    await flushPromises()
    expect(body().find(`[data-testid="template-row-menu-panel-${id1}"]`).exists()).toBe(false)
  })

  it('renders a per-kind colored badge whose classes come from kindBadgeClass and whose text is kindLabel', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()

    const badge = body().findAll('[data-testid^="template-item-badge-"]')[0]!
    expect(badge.classes()).toContain('text-indigo-300') // SONG tint from the shared kindBadgeClass
    expect(badge.text()).toBe('Song')
  })

  it('carries aria-labels on the icon-only ⋯ menu trigger and drag-handle controls', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-scripture"]').trigger('click')
    await flushPromises()

    const menuTrigger = body().findAll('[data-testid^="template-row-menu-trigger-"]')[0]!
    expect(menuTrigger.attributes('aria-label')).toBe('Row options')
    expect(menuTrigger.attributes('aria-haspopup')).toBe('menu')

    const dragHandle = body().get('.drag-handle')
    expect(dragHandle.attributes('aria-label')).toBe('Drag to reorder Scripture Reading')
  })
})

describe('ServiceTemplateEditor — Suggested Template seed (R114)', () => {
  it('labels the seed button "Suggested Template" while keeping the template-reset testid', () => {
    mountEditor(true)
    const seedButton = body().get('[data-testid="template-reset"]')
    expect(seedButton.text()).toBe('Suggested Template')
  })

  it('applies directly (no confirm) when the draft is empty, loading a content-free 9-item shape', async () => {
    mountEditor(true)
    await body().get('[data-testid="template-reset"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="template-reset-confirm"]').exists()).toBe(false)
    expect(templateItems()).toHaveLength(9)

    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(9)
    expect(entries.map((e) => e.kind)).toEqual([
      'SONG',
      'SCRIPTURE',
      'SONG',
      'PRAYER',
      'SCRIPTURE',
      'SONG',
      'SONG',
      'MESSAGE',
      'SONG',
    ])
    // Content-free: every entry is exactly {id, kind, section} — no songId, requiredVwType,
    // or any other content field from buildSlots()'s live-slot shape leaks through.
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'kind', 'section'])
    }
  })

  it('shows the Replace Template confirm first when the draft is non-empty, and Cancel leaves it untouched', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-misc"]').trigger('click')
    await flushPromises()

    await body().get('[data-testid="template-reset"]').trigger('click')
    await flushPromises()

    expect(body().get('[data-testid="template-reset-confirm"]').text()).toContain(
      "Replace your custom template with the Suggested Template? This clears every item you've added.",
    )
    expect(templateItems()).toHaveLength(1)

    await body().get('[data-testid="template-reset-cancel"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="template-reset-confirm"]').exists()).toBe(false)
    expect(templateItems()).toHaveLength(1)
    expect(templateItems()[0]!.text()).toContain('Miscellaneous')
  })

  it('Replace Template applies the 1-2-3 shape after the confirm', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-misc"]').trigger('click')
    await flushPromises()

    await body().get('[data-testid="template-reset"]').trigger('click')
    await flushPromises()
    await body().get('[data-testid="template-reset-confirm-button"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="template-reset-confirm"]').exists()).toBe(false)
    expect(templateItems()).toHaveLength(9)
  })
})

describe('ServiceTemplateEditor — template-item body (R116)', () => {
  it('renders a template-item-body textarea for a MISC row, bound to entry.body', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'misc-1', kind: 'MISC', body: 'Canned music' }]
    mountEditor(true)
    await flushPromises()

    const bodies = body().findAll('[data-testid="template-item-body"]')
    expect(bodies).toHaveLength(1)
    expect((bodies[0]!.element as HTMLTextAreaElement).value).toBe('Canned music')
  })

  it('renders a template-item-body textarea for an ANNOUNCEMENTS row', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-announcements"]').trigger('click')
    await flushPromises()

    expect(body().findAll('[data-testid="template-item-body"]')).toHaveLength(1)
  })

  it('renders no template-item-body textarea for non-body kinds (SONG / PRAYER)', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await body().get('[data-testid="palette-add-prayer"]').trigger('click')
    await flushPromises()

    expect(body().findAll('[data-testid="template-item-body"]')).toHaveLength(0)
  })

  it('typing sets the draft entry body; the save payload carries the typed text', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-misc"]').trigger('click')
    await flushPromises()

    await body().get('[data-testid="template-item-body"]').setValue('Recurring slide content')
    await flushPromises()
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(1)
    expect(entries[0]!.kind).toBe('MISC')
    expect(entries[0]!.body).toBe('Recurring slide content')
  })

  it('clearing the body to empty leaves the saved entry bodyless (undefined stripped)', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'misc-1', kind: 'MISC', body: 'Something' }]
    mountEditor(true)
    await flushPromises()

    await body().get('[data-testid="template-item-body"]').setValue('')
    await flushPromises()
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(1)
    expect('body' in entries[0]!).toBe(false)
  })
})

describe('ServiceTemplateEditor — MISC label (R127)', () => {
  it('renders a template-item-misc-label input for a MISC row, bound to entry.label', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'misc-1', kind: 'MISC', label: 'Communion' }]
    mountEditor(true)
    await flushPromises()

    const inputs = body().findAll('[data-testid="template-item-misc-label"]')
    expect(inputs).toHaveLength(1)
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('Communion')
  })

  it('renders no template-item-misc-label input for non-MISC kinds (ANNOUNCEMENTS / SONG)', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-announcements"]').trigger('click')
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()

    expect(body().findAll('[data-testid="template-item-misc-label"]')).toHaveLength(0)
  })

  it('the MISC entry displayed name shows entry.label when set', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'misc-1', kind: 'MISC', label: 'Communion' }]
    mountEditor(true)
    await flushPromises()
    expect(body().get('[data-testid="template-item-name"]').text()).toBe('Communion')
  })

  it('the MISC entry displayed name falls back to "Miscellaneous" when the label is absent', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'misc-2', kind: 'MISC' }]
    mountEditor(true)
    await flushPromises()
    expect(body().get('[data-testid="template-item-name"]').text()).toBe('Miscellaneous')
  })

  it('typing sets the draft entry label; the save payload carries the typed text', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-misc"]').trigger('click')
    await flushPromises()

    await body().get('[data-testid="template-item-misc-label"]').setValue('Communion')
    await flushPromises()
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(1)
    expect(entries[0]!.kind).toBe('MISC')
    expect(entries[0]!.label).toBe('Communion')
  })

  it('clearing the label to empty leaves the saved entry labelless (undefined stripped)', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'misc-1', kind: 'MISC', label: 'Communion' }]
    mountEditor(true)
    await flushPromises()

    await body().get('[data-testid="template-item-misc-label"]').setValue('')
    await flushPromises()
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    expect(entries).toHaveLength(1)
    expect('label' in entries[0]!).toBe(false)
  })
})

describe('ServiceTemplateEditor — Save Template', () => {
  it('writes the dot-path leaf key with a stripUndefined payload, then reassigns the store', async () => {
    mountEditor(true)
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(['settings.defaultServiceTemplate'])
    expect(payload['settings.defaultServiceTemplate']).toEqual([])
    expect(mockAuthState.settings.defaultServiceTemplate).toEqual([])
    expect(body().text()).toContain('Saved!')
  })

  it('surfaces the shared failure copy and does not mirror-write the store on a rejected save', async () => {
    mockAuthState.settings.defaultServiceTemplate = [{ id: 'existing-1', kind: 'PRAYER' }]
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))

    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()
    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()

    expect(body().get('[data-testid="template-save-error"]').text()).toBe('Failed to save. Please try again.')
    // Store must still hold the ORIGINAL value — the failed write never reassigned it.
    expect(mockAuthState.settings.defaultServiceTemplate).toEqual([{ id: 'existing-1', kind: 'PRAYER' }])
  })
})

describe('ServiceTemplateEditor — draft cloning (Pitfall #3)', () => {
  it('opening clones the store array; editing the draft never mutates the store in place', async () => {
    const stored: ServiceTemplateEntry[] = [{ id: 'existing-1', kind: 'PRAYER', section: 'worship' }]
    mockAuthState.settings.defaultServiceTemplate = stored

    mountEditor(true)
    await flushPromises()

    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()
    await deleteViaRowMenu(0)

    // The draft was mutated (added then a remove fired), but the store's own array
    // contents are untouched until Save Template is clicked. (Not asserting reference
    // identity here: `mockAuthState` is `reactive()`, so reading the array back yields
    // a Proxy wrapper around `stored`, not `stored` itself — Vue's normal behavior, not
    // evidence of a fresh array. `draft`'s SHALLOW clone is what Pitfall #3 requires,
    // and that's what the unchanged CONTENT below actually proves.)
    expect(mockAuthState.settings.defaultServiceTemplate).toEqual([{ id: 'existing-1', kind: 'PRAYER', section: 'worship' }])
  })
})

describe('ServiceTemplateEditor — drag-reorder (SortableJS, per-section instances)', () => {
  it('creates one Sortable instance per SERVICE_SECTIONS container plus the unlabeled bucket, keyed on entry id', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await flushPromises()

    expect(sortableCaptures.length).toBeGreaterThanOrEqual(6)
    const worshipCapture = captureForSection('worship')
    expect(worshipCapture?.options.draggable).toBe('.template-item')
    expect(worshipCapture?.options.handle).toBe('.drag-handle')
  })

  it('reorders within the same section on drag end', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await body().get('[data-testid="palette-add-scripture"]').trigger('click')
    await flushPromises()

    await moveViaRowMenu(0, 'worship')
    await moveViaRowMenu(1, 'worship')
    await flushPromises()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship Sortable capture resolved')

    worshipCapture.options.onEnd?.({
      oldDraggableIndex: 0,
      newDraggableIndex: 1,
      from: worshipCapture.el,
      to: worshipCapture.el,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    await flushPromises()

    const items = templateItems()
    expect(items[0]!.text()).toContain('Scripture Reading')
    expect(items[1]!.text()).toContain('Song')
  })

  it('moves an entry into a new section on a cross-section drag, updating its section field', async () => {
    mountEditor(true)
    await body().get('[data-testid="palette-add-song"]').trigger('click')
    await body().get('[data-testid="palette-add-prayer"]').trigger('click')
    await flushPromises()

    await moveViaRowMenu(1, 'message')
    await flushPromises()

    const ungroupedCapture = captureForUngrouped()
    const messageCapture = captureForSection('message')
    if (!ungroupedCapture || !messageCapture) throw new Error('expected both ungrouped and message captures')

    ungroupedCapture.options.onEnd?.({
      oldDraggableIndex: 0,
      newDraggableIndex: 1,
      from: ungroupedCapture.el,
      to: messageCapture.el,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    await flushPromises()

    expect(body().find('[data-testid="template-section-list-ungrouped"]').exists()).toBe(false)
    expect(body().get('[data-testid="template-section-list-message"]').text()).toContain('Song')
    expect(body().get('[data-testid="template-section-list-message"]').text()).toContain('Prayer')

    await body().get('[data-testid="template-save"]').trigger('click')
    await flushPromises()
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    const entries = payload['settings.defaultServiceTemplate'] as ServiceTemplateEntry[]
    const song = entries.find((e) => e.kind === 'SONG')
    expect(song?.section).toBe('message')
  })

  // R110 (default-template editor half). The module `sortablejs` mock only captures
  // options — it NEVER relocates a DOM node (51-RESEARCH Pitfall 1) — so an onEnd-only
  // test is false-GREEN on buggy code because the reactive `draft` is already correct.
  // The defect is a SortableJS↔Vue DOM-ownership desync: SortableJS physically moves the
  // dragged row's real DOM node into the target container, and Vue — patching from state
  // it believes it owns — mints a SECOND row for that entry, leaving a handler-less
  // phantom behind. This test physically performs SortableJS's real move BEFORE onEnd,
  // then asserts on RENDERED node counts (never on the reactive array).
  it('cross-section drag leaves exactly one rendered row for the moved item — no phantom duplicate (R110)', async () => {
    mockAuthState.settings.defaultServiceTemplate = [
      { id: 'song-1', kind: 'SONG' },
      { id: 'scripture-1', kind: 'SCRIPTURE', section: 'worship' },
    ]
    mountEditor(true)
    await flushPromises()

    const ungroupedCapture = captureForUngrouped()
    const worshipCapture = captureForSection('worship')
    if (!ungroupedCapture || !worshipCapture) throw new Error('expected both ungrouped and worship captures')

    const ungroupedContainer = body().get('[data-testid="template-section-list-ungrouped"]').element
    const worshipContainer = body().get('[data-testid="template-section-list-worship"]').element

    // Simulate SortableJS's real DOM relocation of the dragged row BEFORE onEnd fires:
    // detach the "No Section" song node from the ungrouped container and append it into
    // the worship container, exactly as a live cross-section drag would.
    const draggedRow = ungroupedContainer.querySelector('[data-entry-id="song-1"]')
    if (!draggedRow) throw new Error('dragged row not found in ungrouped container')
    ungroupedContainer.removeChild(draggedRow)
    worshipContainer.appendChild(draggedRow)

    ungroupedCapture.options.onEnd?.({
      oldDraggableIndex: 0,
      newDraggableIndex: 1,
      from: ungroupedContainer,
      to: worshipContainer,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    await flushPromises()

    // (a) the source (ungrouped) list holds ZERO rows for the moved id, and
    // (b) the whole rendered subtree contains EXACTLY ONE row for that id.
    const ungroupedAfter = body().find('[data-testid="template-section-list-ungrouped"]')
    if (ungroupedAfter.exists()) {
      expect(ungroupedAfter.element.querySelectorAll('[data-entry-id="song-1"]').length).toBe(0)
    }
    expect(body().findAll('[data-entry-id="song-1"]')).toHaveLength(1)
  })
})

describe('ServiceTemplateEditor — No Section band (Phase 57)', () => {
  it('renders a muted/dashed template-no-section-band labeled "No Section" for a non-empty ungrouped bucket, distinct from the real section headers', async () => {
    // A stored entry with no section lands in the trailing ungrouped bucket.
    mockAuthState.settings.defaultServiceTemplate = [
      { id: 'song-1', kind: 'SONG', section: 'worship' },
      { id: 'prayer-1', kind: 'PRAYER' },
    ]
    mountEditor(true)
    await flushPromises()

    const band = body().find('[data-testid="template-no-section-band"]')
    expect(band.exists()).toBe(true)
    expect(band.text()).toContain('No Section')
    // Muted/dashed styling, and NOT one of the real template-section-header-* headers.
    expect(band.classes()).toContain('border-dashed')
    expect(band.attributes('data-testid')).not.toMatch(/^template-section-header-/)
  })

  it('does not render the template-no-section-band when every entry is sectioned', async () => {
    mockAuthState.settings.defaultServiceTemplate = [
      { id: 'song-1', kind: 'SONG', section: 'worship' },
      { id: 'msg-1', kind: 'MESSAGE', section: 'message' },
    ]
    mountEditor(true)
    await flushPromises()

    expect(body().find('[data-testid="template-section-list-ungrouped"]').exists()).toBe(false)
    expect(body().find('[data-testid="template-no-section-band"]').exists()).toBe(false)
  })
})
