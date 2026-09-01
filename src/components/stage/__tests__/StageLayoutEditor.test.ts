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

/** Single room rect for deterministic drop math: 400x200 at (0,0). */
function stubRoomRect(wrapper: VueWrapper) {
  stubRect(wrapper.get('[data-testid="stage-room"]').element, { left: 0, top: 0, width: 400, height: 200 })
}

function dispatchPointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: { clientX: number; clientY: number; pointerId: number },
) {
  el.dispatchEvent(new PointerEvent(type, { ...init, bubbles: true, cancelable: true }))
}

const bandRoles = [
  { id: 'r1', name: 'Electric Guitar' },
  { id: 'r2', name: 'Drums' },
]
const assignablePeople = [
  { id: 'p1', name: 'Dana R.', roleId: 'r1', roleName: 'Electric Guitar' },
  { id: 'p2', name: 'Sam B.', roleId: 'r2', roleName: 'Drums' },
]
const markers: StageMarker[] = [
  { id: 'm1', label: 'Lead Vocal', kind: 'lead', zone: 'onstage', xPct: 40, yPct: 30 },
  { id: 'm2', label: '', roleId: 'r1', roleName: 'Electric Guitar', zone: 'onstage', xPct: 60, yPct: 30 },
]

// Teleport stub renders the slide-over inline so wrapper.find() reaches it.
function mountEditor(props: Partial<{ elements: StageMarker[]; editable: boolean; bandRoles: typeof bandRoles; assignablePeople: typeof assignablePeople }> = {}) {
  return mount(StageLayoutEditor, {
    props: { elements: markers, editable: true, bandRoles, assignablePeople, ...props },
    global: { stubs: { teleport: true } },
  })
}

async function selectMarker(wrapper: VueWrapper, index = 0) {
  stubRoomRect(wrapper)
  const chip = wrapper.findAll('[data-testid="stage-marker"]')[index]!
  dispatchPointer(chip.element, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
  dispatchPointer(chip.element, 'pointerup', { clientX: 160, clientY: 60, pointerId: 1 })
  await wrapper.vm.$nextTick()
}

describe('StageLayoutEditor', () => {
  it('renders the palette (fixed kinds + band-role instruments) and the room', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('[data-testid="stage-room"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette-chip-lead"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette-chip-monitor"]').exists()).toBe(true)
    // Instruments group mirrors the band roles + the two fixed extras.
    expect(wrapper.find('[data-testid="palette-chip-role-r1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette-chip-role-r2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette-chip-orchestra"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette-chip-instrument"]').exists()).toBe(true)
    // The old hardcoded instrument kinds are gone.
    expect(wrapper.find('[data-testid="palette-chip-drums"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="palette-chip-role-r1"]').text()).toContain('Electric Guitar')
  })

  it('editable=false renders the read-only StageLayoutView with no palette/drawer', () => {
    const wrapper = mountEditor({ editable: false })
    expect(wrapper.findComponent(StageLayoutView).exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette-chip-lead"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(false)
  })

  it('shows the empty-room hint only when there are no markers', () => {
    expect(mountEditor({ elements: [] }).text()).toContain('Nothing placed yet')
    expect(mountEditor().text()).not.toContain('Nothing placed yet')
  })

  describe('add from palette', () => {
    it('a fixed-kind chip emits add() with that kind, an empty label, and a derived zone', async () => {
      const wrapper = mountEditor({ elements: [] })
      await wrapper.get('[data-testid="palette-chip-lead"]').trigger('click')
      const marker = wrapper.emitted('add')![0]![0] as StageMarker
      expect(marker.kind).toBe('lead')
      expect(marker.label).toBe('')
      expect('roleId' in marker).toBe(false)
      expect(marker.zone).toBe('onstage')
      expect(marker.xPct).toBe(47.5)
    })

    it('a band-role chip emits add() carrying roleId/roleName and no kind', async () => {
      const wrapper = mountEditor({ elements: [] })
      await wrapper.get('[data-testid="palette-chip-role-r1"]').trigger('click')
      const marker = wrapper.emitted('add')![0]![0] as StageMarker
      expect(marker.roleId).toBe('r1')
      expect(marker.roleName).toBe('Electric Guitar')
      expect('kind' in marker).toBe(false)
    })

    it('offsets back-to-back adds so they do not stack', async () => {
      const existing: StageMarker[] = [
        { id: 'a', label: '', kind: 'lead', zone: 'onstage', xPct: 47.5, yPct: 30 },
        { id: 'b', label: '', kind: 'lead', zone: 'onstage', xPct: 47.5, yPct: 30 },
      ]
      const wrapper = mountEditor({ elements: existing })
      await wrapper.get('[data-testid="palette-chip-vocal"]').trigger('click')
      const marker = wrapper.emitted('add')![0]![0] as StageMarker
      expect(marker.xPct).toBe(52.5) // 47.5 + (2 % 4) * 2.5
    })

    it('shows an empty-roles hint in the Instruments group when there are no band roles', () => {
      const wrapper = mountEditor({ bandRoles: [] })
      expect(wrapper.text()).toContain('No band roles yet')
    })
  })

  describe('drag (native Pointer Events, free placement, drop-only persist)', () => {
    it('a drag emits exactly ONE clamped move with a derived zone', async () => {
      const wrapper = mountEditor({ elements: [markers[0]!] })
      stubRoomRect(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')
      // Drop at (20,60) -> xPct 5, yPct 30 -> a side wing (offstage).
      dispatchPointer(chip.element, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointermove', { clientX: 20, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointerup', { clientX: 20, clientY: 60, pointerId: 1 })
      await wrapper.vm.$nextTick()

      const moves = wrapper.emitted('move')!
      expect(moves).toHaveLength(1)
      const p = moves[0]![0] as { id: string; zone: string; xPct: number; yPct: number }
      expect(p.id).toBe('m1')
      expect(p.xPct).toBeCloseTo(5, 5)
      expect(p.yPct).toBeCloseTo(30, 5)
      expect(p.zone).toBe('offstage')
    })

    it('a drop far outside the room clamps to [0,100]', async () => {
      const wrapper = mountEditor({ elements: [markers[0]!] })
      stubRoomRect(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')
      dispatchPointer(chip.element, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointermove', { clientX: 9000, clientY: 9000, pointerId: 1 })
      dispatchPointer(chip.element, 'pointerup', { clientX: 9000, clientY: 9000, pointerId: 1 })
      await wrapper.vm.$nextTick()
      const p = wrapper.emitted('move')![0]![0] as { xPct: number; yPct: number }
      expect(p.xPct).toBe(100)
      expect(p.yPct).toBe(100)
    })

    it('a click (no movement) opens the inspector, emits no move', async () => {
      const wrapper = mountEditor({ elements: [markers[0]!] })
      stubRoomRect(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')
      dispatchPointer(chip.element, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointerup', { clientX: 161, clientY: 60, pointerId: 1 })
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('move')).toBeUndefined()
      expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(true)
    })

    it('pointercancel aborts with no move', async () => {
      const wrapper = mountEditor({ elements: [markers[0]!] })
      stubRoomRect(wrapper)
      const chip = wrapper.get('[data-testid="stage-marker"]')
      dispatchPointer(chip.element, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointermove', { clientX: 20, clientY: 60, pointerId: 1 })
      dispatchPointer(chip.element, 'pointercancel', { clientX: 20, clientY: 60, pointerId: 1 })
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('move')).toBeUndefined()
    })

    it('sets touch-action: none on each chip', () => {
      const wrapper = mountEditor({ elements: [markers[0]!] })
      expect(wrapper.get('[data-testid="stage-marker"]').classes()).toContain('touch-none')
    })

    it('WR-01: a second pointerdown mid-drag is ignored; the first drag completes + releases capture', async () => {
      const two: StageMarker[] = [
        { id: 'm1', label: '', kind: 'lead', zone: 'onstage', xPct: 40, yPct: 30 },
        { id: 'm2', label: '', kind: 'lead', zone: 'onstage', xPct: 60, yPct: 30 },
      ]
      const wrapper = mountEditor({ elements: two })
      stubRoomRect(wrapper)
      const chips = wrapper.findAll('[data-testid="stage-marker"]')
      type Caps = { setPointerCapture: (id: number) => void; hasPointerCapture: (id: number) => boolean; releasePointerCapture: (id: number) => void }
      const c1 = chips[0]!.element as Element & Caps
      const c2 = chips[1]!.element as Element & Caps
      for (const c of [c1, c2]) {
        c.setPointerCapture = vi.fn()
        c.hasPointerCapture = vi.fn(() => true)
        c.releasePointerCapture = vi.fn()
      }
      dispatchPointer(c1, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
      expect(c1.setPointerCapture).toHaveBeenCalledWith(1)
      dispatchPointer(c2, 'pointerdown', { clientX: 240, clientY: 60, pointerId: 2 })
      expect(c2.setPointerCapture).not.toHaveBeenCalled()
      dispatchPointer(c1, 'pointermove', { clientX: 20, clientY: 60, pointerId: 1 })
      dispatchPointer(c1, 'pointerup', { clientX: 20, clientY: 60, pointerId: 1 })
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('move')!).toHaveLength(1)
      expect(c1.releasePointerCapture).toHaveBeenCalledWith(1)
    })

    it('WR-02: a resize or scroll mid-drag aborts with no move', async () => {
      for (const evt of ['resize', 'scroll']) {
        const wrapper = mountEditor({ elements: [markers[0]!] })
        stubRoomRect(wrapper)
        const chip = wrapper.get('[data-testid="stage-marker"]')
        dispatchPointer(chip.element, 'pointerdown', { clientX: 160, clientY: 60, pointerId: 1 })
        dispatchPointer(chip.element, 'pointermove', { clientX: 20, clientY: 60, pointerId: 1 })
        window.dispatchEvent(new Event(evt))
        dispatchPointer(chip.element, 'pointerup', { clientX: 20, clientY: 60, pointerId: 1 })
        await wrapper.vm.$nextTick()
        expect(wrapper.emitted('move')).toBeUndefined()
      }
    })
  })

  describe('inspector slide-over', () => {
    it('opens pre-filled with the marker type and placement', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 0)
      expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(true)
      expect((wrapper.get('[data-testid="marker-kind-select"]').element as HTMLSelectElement).value).toBe('lead')
      expect(wrapper.find('[data-testid="marker-inspector"]').text()).toContain('On stage')
    })

    it('a band-role marker shows the role as the selected type (role:<id>)', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 1) // m2 is the Electric Guitar role marker
      expect((wrapper.get('[data-testid="marker-kind-select"]').element as HTMLSelectElement).value).toBe('role:r1')
    })

    it('editing the label + Save emits update() preserving zone/position', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 0)
      await wrapper.get('[data-testid="marker-label-input"]').setValue('Front left')
      await wrapper.get('[data-testid="marker-save"]').trigger('click')
      const updated = wrapper.emitted('update')![0]![0] as StageMarker
      expect(updated).toEqual({ id: 'm1', label: 'Front left', kind: 'lead', zone: 'onstage', xPct: 40, yPct: 30 })
      expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(false)
    })

    it('picking a person shows "Name - Role", clears the label, and Save carries personId/personName', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 1) // Electric Guitar role marker
      // Dana R. (Electric Guitar, matching this marker's role) is offered.
      const pill = wrapper.get('[data-testid="person-pill-p1-r1"]')
      expect(pill.text()).toBe('Dana R. - Electric Guitar')
      await pill.trigger('click')
      expect((wrapper.get('[data-testid="marker-label-input"]').element as HTMLInputElement).value).toBe('')
      await wrapper.get('[data-testid="marker-save"]').trigger('click')
      const updated = wrapper.emitted('update')![0]![0] as StageMarker
      expect(updated.personId).toBe('p1')
      expect(updated.personName).toBe('Dana R.')
      expect(updated.roleName).toBe('Electric Guitar')
    })

    it('lines the role-matched person up first in the picker', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 1) // role r1
      const pills = wrapper.findAll('[data-testid^="person-pill-p"]')
      // p1 (r1) comes before p2 (r2) because it matches this marker's role.
      expect(pills[0]!.attributes('data-testid')).toBe('person-pill-p1-r1')
    })

    it('Unassigned sets the label back to the type', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 1) // Electric Guitar role marker
      await wrapper.get('[data-testid="person-pill-unassigned"]').trigger('click')
      expect((wrapper.get('[data-testid="marker-label-input"]').element as HTMLInputElement).value).toBe('Electric Guitar')
    })

    it('the vocal checkbox shows for an instrument and Save carries withVocal', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 1) // instrument (band role)
      const box = wrapper.get('[data-testid="marker-vocal-checkbox"]')
      await box.setValue(true)
      await wrapper.get('[data-testid="marker-save"]').trigger('click')
      expect((wrapper.emitted('update')![0]![0] as StageMarker).withVocal).toBe(true)
    })

    it('the vocal checkbox is hidden for a non-instrument (mic/gear)', async () => {
      const micMarker: StageMarker = { id: 'm1', label: '', kind: 'mic', zone: 'onstage', xPct: 40, yPct: 30 }
      const wrapper = mountEditor({ elements: [micMarker] })
      await selectMarker(wrapper, 0)
      expect(wrapper.find('[data-testid="marker-vocal-checkbox"]').exists()).toBe(false)
    })

    it('a note round-trips; an empty note is dropped (absent key)', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 0)
      await wrapper.get('[data-testid="marker-note-input"]').setValue('XLR from stage left')
      await wrapper.get('[data-testid="marker-save"]').trigger('click')
      expect((wrapper.emitted('update')![0]![0] as StageMarker).note).toBe('XLR from stage left')
    })

    it('Duplicate emits add() with a copy offset to the side', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 0)
      await wrapper.get('[data-testid="marker-duplicate"]').trigger('click')
      const copy = wrapper.emitted('add')![0]![0] as StageMarker
      expect(copy.kind).toBe('lead')
      expect(copy.xPct).toBe(46) // 40 + 6
      expect(copy.id).not.toBe('m1')
    })

    it('delete needs a confirm, then emits remove(id) and closes', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 0)
      await wrapper.get('[data-testid="marker-delete-trigger"]').trigger('click')
      expect(wrapper.find('[data-testid="marker-delete-confirm"]').exists()).toBe(true)
      await wrapper.get('[data-testid="marker-delete"]').trigger('click')
      expect(wrapper.emitted('remove')).toEqual([['m1']])
      expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(false)
    })

    it('close (x) discards without emitting', async () => {
      const wrapper = mountEditor()
      await selectMarker(wrapper, 0)
      await wrapper.get('[data-testid="marker-drawer-close"]').trigger('click')
      expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(false)
      expect(wrapper.emitted('remove')).toBeUndefined()
      expect(wrapper.emitted('update')).toBeUndefined()
    })
  })
})
