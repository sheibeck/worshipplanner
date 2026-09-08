import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SlotVideoOutputControl from '../SlotVideoOutputControl.vue'
import type { ServiceSlot } from '@/types/service'

type VideoOutput = { mode: 'banner' | 'fullscreen' }

function slot(videoOutput?: VideoOutput): ServiceSlot {
  return { id: 's1', kind: 'MISC', position: 0, ...(videoOutput ? { videoOutput } : {}) } as unknown as ServiceSlot
}

function mountControl(videoOutput?: VideoOutput, editable = true) {
  return mount(SlotVideoOutputControl, { props: { slot: slot(videoOutput), editable } })
}

function lastChange(wrapper: ReturnType<typeof mountControl>): VideoOutput {
  const events = wrapper.emitted('change')!
  return events[events.length - 1]![0] as VideoOutput
}

describe('SlotVideoOutputControl', () => {
  it('with no slot.videoOutput, renders Full-screen active and Banner inactive (schema default = UI default)', () => {
    const wrapper = mountControl()
    expect(wrapper.get('[data-testid="slot-video-output-fullscreen-btn"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="slot-video-output-banner-btn"]').attributes('aria-checked')).toBe('false')
  })

  it("with mode: 'banner', renders Banner active", () => {
    const wrapper = mountControl({ mode: 'banner' })
    expect(wrapper.get('[data-testid="slot-video-output-banner-btn"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="slot-video-output-fullscreen-btn"]').attributes('aria-checked')).toBe('false')
  })

  it('clicking Banner while fullscreen emits change { mode: "banner" }', async () => {
    const wrapper = mountControl()
    await wrapper.get('[data-testid="slot-video-output-banner-btn"]').trigger('click')
    expect(lastChange(wrapper)).toEqual({ mode: 'banner' })
  })

  it('clicking Full-screen while banner emits change { mode: "fullscreen" }', async () => {
    const wrapper = mountControl({ mode: 'banner' })
    await wrapper.get('[data-testid="slot-video-output-fullscreen-btn"]').trigger('click')
    expect(lastChange(wrapper)).toEqual({ mode: 'fullscreen' })
  })

  it('clicking the already-active segment does not emit change (radio semantics, no spurious autosave)', async () => {
    const wrapper = mountControl()
    await wrapper.get('[data-testid="slot-video-output-fullscreen-btn"]').trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('is inert (no emit) when not editable, while both segments still render', async () => {
    const wrapper = mountControl(undefined, false)
    expect((wrapper.get('[data-testid="slot-video-output-fullscreen-btn"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((wrapper.get('[data-testid="slot-video-output-banner-btn"]').element as HTMLButtonElement).disabled).toBe(true)
    await wrapper.get('[data-testid="slot-video-output-banner-btn"]').trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('caption copy states scope: "Video output only"', () => {
    const wrapper = mountControl()
    expect(wrapper.get('[data-testid="slot-video-output-caption"]').text()).toBe('Video output only')
  })
})
