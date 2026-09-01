import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SlotLoopControl from '../SlotLoopControl.vue'
import type { ServiceSlot } from '@/types/service'

type Loop = { enabled: boolean; intervalSeconds: number }

function slot(loop?: Loop): ServiceSlot {
  return { id: 's1', kind: 'MISC', position: 0, ...(loop ? { loop } : {}) } as unknown as ServiceSlot
}

function mountControl(loop?: Loop, editable = true) {
  return mount(SlotLoopControl, { props: { slot: slot(loop), editable } })
}

function lastChange(wrapper: ReturnType<typeof mountControl>): Loop {
  const events = wrapper.emitted('change')!
  return events[events.length - 1]![0] as Loop
}

describe('SlotLoopControl', () => {
  it('renders the checkbox unchecked with the interval control hidden until Loop is on', () => {
    const wrapper = mountControl()
    const checkbox = wrapper.get('[data-testid="slot-loop-checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.find('[data-testid="slot-loop-preset"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slot-loop-custom-seconds"]').exists()).toBe(false)
  })

  it('checking emits change { enabled: true, intervalSeconds: 10 } (R307 default 10s)', async () => {
    const wrapper = mountControl()
    await wrapper.get('[data-testid="slot-loop-checkbox"]').setValue(true)
    expect(lastChange(wrapper)).toEqual({ enabled: true, intervalSeconds: 10 })
  })

  it('with loop on, the preset dropdown shows the current interval and a preset pick emits it', async () => {
    const wrapper = mountControl({ enabled: true, intervalSeconds: 10 })
    const preset = wrapper.get('[data-testid="slot-loop-preset"]')
    expect((preset.element as HTMLSelectElement).value).toBe('10')
    await preset.setValue('30')
    expect(lastChange(wrapper)).toEqual({ enabled: true, intervalSeconds: 30 })
  })

  it('selecting Custom keeps the current interval and reveals the seconds input pre-filled with it', async () => {
    const wrapper = mountControl({ enabled: true, intervalSeconds: 30 })
    await wrapper.get('[data-testid="slot-loop-preset"]').setValue('custom')
    expect(lastChange(wrapper)).toEqual({ enabled: true, intervalSeconds: 30 })
    const custom = wrapper.get('[data-testid="slot-loop-custom-seconds"]')
    expect((custom.element as HTMLInputElement).value).toBe('30')
  })

  it('a non-preset interval (45) round-trips as Custom with the number field showing 45', () => {
    const wrapper = mountControl({ enabled: true, intervalSeconds: 45 })
    expect((wrapper.get('[data-testid="slot-loop-preset"]').element as HTMLSelectElement).value).toBe('custom')
    expect((wrapper.get('[data-testid="slot-loop-custom-seconds"]').element as HTMLInputElement).value).toBe('45')
  })

  it.each([
    ['0', 1],
    ['-5', 1],
    ['', 10],
    ['not-a-number', 10],
    ['9999', 3600],
  ])('blurring the custom field with %s clamps to %i', async (raw, expected) => {
    const wrapper = mountControl({ enabled: true, intervalSeconds: 10 })
    await wrapper.get('[data-testid="slot-loop-preset"]').setValue('custom')
    const custom = wrapper.get('[data-testid="slot-loop-custom-seconds"]')
    await custom.setValue(raw)
    await custom.trigger('blur')
    expect(lastChange(wrapper)).toEqual({ enabled: true, intervalSeconds: expected })
  })

  it('unchecking emits enabled:false while retaining the interval (so re-checking restores it)', async () => {
    const wrapper = mountControl({ enabled: true, intervalSeconds: 30 })
    await wrapper.get('[data-testid="slot-loop-checkbox"]').setValue(false)
    expect(lastChange(wrapper)).toEqual({ enabled: false, intervalSeconds: 30 })
  })

  it('is inert (no emit) when not editable', async () => {
    const wrapper = mountControl({ enabled: true, intervalSeconds: 10 }, false)
    expect((wrapper.get('[data-testid="slot-loop-checkbox"]').element as HTMLInputElement).disabled).toBe(true)
    await wrapper.get('[data-testid="slot-loop-preset"]').setValue('30')
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
