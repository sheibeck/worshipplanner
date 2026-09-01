import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import StageLayoutEditor from '../StageLayoutEditor.vue'
import StageLayoutView from '../StageLayoutView.vue'
import type { StageMarker } from '@/types/service'

function stubRect(el: Element, rect: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect)
}

/** Stubs the two zone containers' bounding rects for a deterministic drag
 *  drop calculation — a 400x200 On Stage box at (0,0) and a 200x200 Off
 *  Stage box directly beside it at (420,0). Called AFTER mount, mirroring
 *  the plan's "stub getBoundingClientRect on the zone elements" contract. */
function stubZoneRects(wrapper: VueWrapper) {
  stubRect(wrapper.get('[data-testid="stage-zone-onstage"]').element, { left: 0, top: 0, width: 400, height: 200 })
  stubRect(wrapper.get('[data-testid="stage-zone-offstage"]').element, { left: 420, top: 0, width: 200, height: 200 })
}

/**
 * Dispatches a REAL PointerEvent directly (bypassing @vue/test-utils'
 * `.trigger()`), which fails for pointer* events under this jsdom version:
 * `createDOMEvent` tries to POST-ASSIGN `clientX`/`clientY` onto an
 * already-constructed event, but those are inherited read-only getters on
 * MouseEvent.prototype (PointerEvent's own prototype has no OWN descriptor
 * for them, so VTU's `canSetProperty` guard — which only checks for an
 * explicit `set: undefined` on an EXISTING own descriptor — never trips,
 * and the assignment throws "which has only a getter"). Constructing the
 * event ourselves sets these via the (correctly writable-at-construction)
 * PointerEventInit dict instead, exactly like a real browser dispatch.
 */
function dispatchPointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: { clientX: number; clientY: number; pointerId: number },
) {
  el.dispatchEvent(new PointerEvent(type, { ...init, bubbles: true, cancelable: true }))
}

const markers: StageMarker[] = [
  { id: 'm1', label: 'Lead Vocal', kind: 'mic', zone: 'onstage', xPct: 25, yPct: 60 },
]

describe('StageLayoutEditor', () => {
  it('editable=true renders the add-marker toolbar and two zone containers', () => {
    const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
    expect(wrapper.find('[data-testid="add-marker-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stage-zone-onstage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stage-zone-offstage"]').exists()).toBe(true)
  })

  it('editable=false renders the shared read-only StageLayoutView with no add/edit/delete controls (theme dark)', () => {
    const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: false } })
    const readOnly = wrapper.findComponent(StageLayoutView)
    expect(readOnly.exists()).toBe(true)
    expect(readOnly.props('theme')).toBe('dark')
    expect(wrapper.find('[data-testid="add-marker-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-marker-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="marker-edit-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="marker-remove-button"]').exists()).toBe(false)
  })

  it('shows the "No stage layout yet" heading+body only when BOTH zones are empty', () => {
    const empty = mount(StageLayoutEditor, { props: { elements: [], editable: true } })
    expect(empty.text()).toContain('No stage layout yet')
    expect(empty.text()).toContain('Drop markers here')

    const populated = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
    expect(populated.text()).not.toContain('No stage layout yet')
    // The still-empty Off Stage zone keeps its own per-zone placeholder.
    expect(populated.text()).toContain('Drop markers here')
  })

  describe('add marker', () => {
    it('opens the form on click; submit stays disabled until the label has non-whitespace content', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: [], editable: true } })
      await wrapper.get('[data-testid="add-marker-button"]').trigger('click')
      expect(wrapper.find('[data-testid="add-marker-form"]').exists()).toBe(true)

      const submit = wrapper.get('[data-testid="add-marker-submit"]')
      expect(submit.attributes('disabled')).toBeDefined()

      await wrapper.get('[data-testid="add-marker-label-input"]').setValue('   ')
      expect(wrapper.get('[data-testid="add-marker-submit"]').attributes('disabled')).toBeDefined()

      await wrapper.get('[data-testid="add-marker-label-input"]').setValue('Drums')
      expect(wrapper.get('[data-testid="add-marker-submit"]').attributes('disabled')).toBeUndefined()
    })

    it('submitting emits add() with a fresh marker dropped at the chosen zone center', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: [], editable: true } })
      await wrapper.get('[data-testid="add-marker-button"]').trigger('click')
      await wrapper.get('[data-testid="add-marker-label-input"]').setValue('Guest Speaker Mic')
      await wrapper.get('[data-testid="add-marker-kind-select"]').setValue('mic')
      await wrapper.get('[data-testid="add-marker-zone-offstage"]').trigger('click')
      await wrapper.get('[data-testid="add-marker-submit"]').trigger('click')

      const emitted = wrapper.emitted('add')
      expect(emitted).toHaveLength(1)
      const marker = emitted![0]![0] as StageMarker
      expect(marker.label).toBe('Guest Speaker Mic')
      expect(marker.kind).toBe('mic')
      expect(marker.zone).toBe('offstage')
      expect(marker.xPct).toBe(50)
      expect(marker.yPct).toBe(50)
      expect(typeof marker.id).toBe('string')
      expect(wrapper.find('[data-testid="add-marker-form"]').exists()).toBe(false)
    })

    it('omits the kind key entirely when "No kind" is left selected (never kind: undefined)', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: [], editable: true } })
      await wrapper.get('[data-testid="add-marker-button"]').trigger('click')
      await wrapper.get('[data-testid="add-marker-label-input"]').setValue('Drums')
      await wrapper.get('[data-testid="add-marker-submit"]').trigger('click')

      const marker = wrapper.emitted('add')![0]![0] as StageMarker
      expect('kind' in marker).toBe(false)
    })

    it('defaults the zone toggle to On Stage on first open, then to the last-interacted zone', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: [], editable: true } })
      await wrapper.get('[data-testid="add-marker-button"]').trigger('click')
      expect(wrapper.get('[data-testid="add-marker-zone-onstage"]').classes()).toContain('bg-indigo-600')

      await wrapper.get('[data-testid="add-marker-label-input"]').setValue('Piano')
      await wrapper.get('[data-testid="add-marker-zone-offstage"]').trigger('click')
      await wrapper.get('[data-testid="add-marker-submit"]').trigger('click')

      await wrapper.get('[data-testid="add-marker-button"]').trigger('click')
      expect(wrapper.get('[data-testid="add-marker-zone-offstage"]').classes()).toContain('bg-indigo-600')
    })

    it('Cancel closes the form without emitting add', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: [], editable: true } })
      await wrapper.get('[data-testid="add-marker-button"]').trigger('click')
      await wrapper.get('[data-testid="add-marker-label-input"]').setValue('Drums')
      await wrapper.get('[data-testid="add-marker-cancel"]').trigger('click')

      expect(wrapper.find('[data-testid="add-marker-form"]').exists()).toBe(false)
      expect(wrapper.emitted('add')).toBeUndefined()
    })
  })

  describe('drag (native Pointer Events, drop-only persist)', () => {
    it('a pointerdown -> pointermove -> pointerup drag emits exactly ONE clamped, zone-resolved move payload', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      stubZoneRects(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')

      dispatchPointer(chip.element, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 1 })
      dispatchPointer(chip.element, 'pointermove', { clientX: 460, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointerup', { clientX: 460, clientY: 60, pointerId: 1 })
      await wrapper.vm.$nextTick()

      const moveEvents = wrapper.emitted('move')
      expect(moveEvents).toHaveLength(1)
      const payload = moveEvents![0]![0] as { id: string; zone: string; xPct: number; yPct: number }
      expect(payload.id).toBe('m1')
      expect(payload.zone).toBe('offstage')
      expect(payload.xPct).toBeGreaterThanOrEqual(0)
      expect(payload.xPct).toBeLessThanOrEqual(100)
      expect(payload.yPct).toBeGreaterThanOrEqual(0)
      expect(payload.yPct).toBeLessThanOrEqual(100)
      // Off Stage rect is left:420 width:200 -> (460-420)/200*100 = 20
      expect(payload.xPct).toBeCloseTo(20, 5)
      // Off Stage rect is top:0 height:200 -> 60/200*100 = 30
      expect(payload.yPct).toBeCloseTo(30, 5)
    })

    it("a drop outside both zones falls back to the marker's CURRENT zone, with xPct/yPct clamped to [0,100] against that zone's rect", async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      stubZoneRects(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')

      // Marker starts onstage; dropped far outside BOTH zone rects (isPointInRect
      // rejects it from either), so zoneFromPoint falls back to the current zone
      // ('onstage') — and pctWithinRect independently clamps each axis against
      // that zone's rect (width 400 / height 200) rather than exceeding 100.
      dispatchPointer(chip.element, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 1 })
      dispatchPointer(chip.element, 'pointermove', { clientX: 9000, clientY: 9000, pointerId: 1 })
      dispatchPointer(chip.element, 'pointerup', { clientX: 9000, clientY: 9000, pointerId: 1 })
      await wrapper.vm.$nextTick()

      const payload = wrapper.emitted('move')![0]![0] as { zone: string; xPct: number; yPct: number }
      expect(payload.zone).toBe('onstage')
      expect(payload.xPct).toBe(100)
      expect(payload.yPct).toBe(100)
    })

    it('a click (pointerdown/pointerup with no meaningful movement) does NOT emit move — it opens the edit popover instead', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      stubZoneRects(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')

      dispatchPointer(chip.element, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 1 })
      dispatchPointer(chip.element, 'pointerup', { clientX: 101, clientY: 100, pointerId: 1 })
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('move')).toBeUndefined()
      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(true)
      expect((wrapper.get('[data-testid="edit-marker-label-input"]').element as HTMLInputElement).value).toBe('Lead Vocal')
    })

    it('pointercancel aborts the drag with no move emitted and no popover opened', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      stubZoneRects(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')

      dispatchPointer(chip.element, 'pointerdown', { clientX: 100, clientY: 100, pointerId: 1 })
      dispatchPointer(chip.element, 'pointermove', { clientX: 460, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointercancel', { clientX: 460, clientY: 60, pointerId: 1 })
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('move')).toBeUndefined()
      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(false)
    })

    it('renders each marker via percentage left/top styling derived purely from props, never a measured pixel (resize-stable by construction)', () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      const style = wrapper.get('[data-testid="stage-marker"]').attributes('style') ?? ''
      expect(style).toContain('left: 25%')
      expect(style).toContain('top: 60%')
      expect(style).not.toMatch(/left:\s*\d+px/)
      expect(style).not.toMatch(/top:\s*\d+px/)
    })

    it('sets touch-action: none on the drag surface (both zone containers and every chip)', () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      expect(wrapper.get('[data-testid="stage-zone-onstage"]').classes()).toContain('touch-none')
      expect(wrapper.get('[data-testid="stage-zone-offstage"]').classes()).toContain('touch-none')
      expect(wrapper.get('[data-testid="stage-marker"]').classes()).toContain('touch-none')
    })
  })

  describe('edit popover', () => {
    it('the pencil "Edit marker" icon opens the popover pre-filled with the marker\'s current label/kind', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')

      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(true)
      expect((wrapper.get('[data-testid="edit-marker-label-input"]').element as HTMLInputElement).value).toBe('Lead Vocal')
      expect((wrapper.get('[data-testid="edit-marker-kind-select"]').element as HTMLSelectElement).value).toBe('mic')
    })

    it('editing the label and kind then Save emits update() with the new fields, preserving zone/position', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')
      await wrapper.get('[data-testid="edit-marker-label-input"]').setValue('Lead Vocalist')
      await wrapper.get('[data-testid="edit-marker-kind-select"]').setValue('other')
      await wrapper.get('[data-testid="marker-edit-save"]').trigger('click')

      const updated = wrapper.emitted('update')![0]![0] as StageMarker
      expect(updated).toEqual({ id: 'm1', label: 'Lead Vocalist', kind: 'other', zone: 'onstage', xPct: 25, yPct: 60 })
      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(false)
    })

    it('selecting "No kind" and saving omits the kind key entirely', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')
      await wrapper.get('[data-testid="edit-marker-kind-select"]').setValue('')
      await wrapper.get('[data-testid="marker-edit-save"]').trigger('click')

      const updated = wrapper.emitted('update')![0]![0] as StageMarker
      expect('kind' in updated).toBe(false)
    })

    it('Save stays disabled when the label is emptied to whitespace-only', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')
      await wrapper.get('[data-testid="edit-marker-label-input"]').setValue('   ')
      expect(wrapper.get('[data-testid="marker-edit-save"]').attributes('disabled')).toBeDefined()
      expect(wrapper.emitted('update')).toBeUndefined()
    })

    it('Cancel closes the popover without emitting update', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')
      await wrapper.get('[data-testid="edit-marker-label-input"]').setValue('Something else entirely')
      await wrapper.get('[data-testid="marker-edit-cancel"]').trigger('click')

      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(false)
      expect(wrapper.emitted('update')).toBeUndefined()
    })

    it('"Move to Off Stage (Side)" emits move to the opposite zone, keeping the same position, and closes the popover', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')
      const moveBtn = wrapper.get('[data-testid="move-zone-button"]')
      expect(moveBtn.text()).toContain('Off Stage (Side)')
      await moveBtn.trigger('click')

      const payload = wrapper.emitted('move')![0]![0] as { id: string; zone: string; xPct: number; yPct: number }
      expect(payload).toEqual({ id: 'm1', zone: 'offstage', xPct: 25, yPct: 60 })
      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(false)
    })

    it('the trash "Remove marker" icon opens the SAME popover directly to its remove-confirm row', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-remove-button"]').trigger('click')

      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="marker-remove-confirm"]').exists()).toBe(true)
      expect(wrapper.text()).toContain("Remove this marker? This can't be undone.")
    })

    it('Cancel on the remove-confirm row backs out to the edit fields (RoleSlideOver pattern) without emitting remove', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-remove-button"]').trigger('click')
      await wrapper.get('[data-testid="marker-remove-cancel-button"]').trigger('click')

      expect(wrapper.emitted('remove')).toBeUndefined()
      // Mirrors RoleSlideOver.vue: Cancel on the inline confirm row returns to
      // the underlying form (still open), it does not close the whole panel.
      expect(wrapper.find('[data-testid="marker-remove-confirm"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="edit-marker-label-input"]').exists()).toBe(true)
    })

    it('confirming Remove emits remove(id) and closes the popover', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-remove-button"]').trigger('click')
      await wrapper.get('[data-testid="marker-remove-confirm-button"]').trigger('click')

      expect(wrapper.emitted('remove')).toEqual([['m1']])
      expect(wrapper.find('[data-testid="marker-edit-popover"]').exists()).toBe(false)
    })

    it('the popover\'s own "Remove marker" text trigger reveals the same confirm row (RoleSlideOver delete-confirm-row pattern)', async () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      await wrapper.get('[data-testid="marker-edit-button"]').trigger('click')
      expect(wrapper.find('[data-testid="marker-remove-confirm"]').exists()).toBe(false)

      await wrapper.get('[data-testid="marker-edit-remove-trigger"]').trigger('click')
      expect(wrapper.find('[data-testid="marker-remove-confirm"]').exists()).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('edit and delete icon buttons carry the required aria-labels and a 44px minimum touch target', () => {
      const wrapper = mount(StageLayoutEditor, { props: { elements: markers, editable: true } })
      const editBtn = wrapper.get('[data-testid="marker-edit-button"]')
      const removeBtn = wrapper.get('[data-testid="marker-remove-button"]')

      expect(editBtn.attributes('aria-label')).toBe('Edit marker')
      expect(removeBtn.attributes('aria-label')).toBe('Remove marker')
      expect(editBtn.classes().some((c) => c.includes('44px'))).toBe(true)
      expect(removeBtn.classes().some((c) => c.includes('44px'))).toBe(true)
    })
  })
})
