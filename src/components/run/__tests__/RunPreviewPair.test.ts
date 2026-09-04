/**
 * Owner UAT — the On-screen (program) preview must mirror "go to black" so the
 * projectionist can SEE that the audience is blacked out, not stare at a preview
 * that looks broken/empty. RunPreviewPair renders a BLACK overlay + a "Black" label
 * over the program pane when `blackout` is true, and clears it when false.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RunPreviewPair from '../RunPreviewPair.vue'

// SlideCanvas is a heavy child (fonts, media lifecycle); stub it so the pair renders
// in isolation. current:null already skips it, but the stub keeps the mount safe.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'SlideCanvas', setup: () => () => h('div') }) }
})

describe('RunPreviewPair — On-screen pane share (R330)', () => {
  it('no longer gives the On-screen pane the dominant lg:col-span-2 share', () => {
    const w = mount(RunPreviewPair, {
      props: { current: null, next: null, live: false },
    })
    const onScreenPane = w.find('[data-testid="run-current-pane"]')
    expect(onScreenPane.exists()).toBe(true)
    expect(onScreenPane.classes()).not.toContain('lg:col-span-2')
  })
})

describe('RunPreviewPair — blackout mirror on the On-screen preview (owner UAT)', () => {
  it('shows a BLACK overlay on the program preview when blackout is true', () => {
    const w = mount(RunPreviewPair, {
      props: { current: null, next: null, live: true, blackout: true },
    })
    const overlay = w.find('[data-testid="run-current-blackout"]')
    expect(overlay.exists()).toBe(true)
    expect(overlay.text()).toContain('Black')
  })

  it('hides the overlay when blackout is false (or omitted)', () => {
    const off = mount(RunPreviewPair, {
      props: { current: null, next: null, live: true, blackout: false },
    })
    expect(off.find('[data-testid="run-current-blackout"]').exists()).toBe(false)

    const omitted = mount(RunPreviewPair, { props: { current: null, next: null, live: true } })
    expect(omitted.find('[data-testid="run-current-blackout"]').exists()).toBe(false)
  })
})
