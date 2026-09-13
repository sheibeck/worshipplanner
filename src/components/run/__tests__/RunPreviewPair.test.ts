/**
 * Owner UAT — the On-screen (program) preview must mirror "go to black" so the
 * projectionist can SEE that the audience is blacked out, not stare at a preview
 * that looks broken/empty. RunPreviewPair renders a BLACK overlay + a "Black" label
 * over the program pane when `blackout` is true, and clears it when false.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RunPreviewPair from '../RunPreviewPair.vue'
import type { AssembledSlide } from '@/types/slide'

// Phase 141 (R438) — records every suppressAudio value the stub was mounted
// with, so the "inert preview canvases" defense-in-depth can be proven.
const canvasSuppressAudio: boolean[] = []

// SlideCanvas is a heavy child (fonts, media lifecycle); stub it so the pair renders
// in isolation. current:null already skips it, but the stub keeps the mount safe.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvas',
      props: { suppressAudio: { type: Boolean, default: false } },
      setup: (props) => {
        canvasSuppressAudio.push(props.suppressAudio)
        return () => h('div')
      },
    }),
  }
})

/** A minimal AssembledSlide — just enough for a SlideCanvas mount (R438 suppress-audio proof). */
function fakeSlide(id: string): AssembledSlide {
  return {
    slide: { id, position: 0, contentKind: 'lyric', sectionId: `sec-${id}`, lines: [id] },
    slotIndex: 0,
    slotKind: 'SONG',
    sourceId: 'song-0',
  } as unknown as AssembledSlide
}

describe('RunPreviewPair — ♪ Vamp badges (R438, Phase 141)', () => {
  it('renders the current-pane badge with the full label, title, and font-medium (not font-semibold)', () => {
    const w = mount(RunPreviewPair, {
      props: { current: null, next: null, live: true, currentVampLabel: 'Open Response · G' },
    })
    const badge = w.find('[data-testid="run-current-vamp-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('♪ Vamp: Open Response · G')
    expect(badge.attributes('title')).toBe('Open Response · G')
    expect(badge.classes()).toContain('font-medium')
    expect(badge.classes()).toContain('max-w-[220px]')
    expect(badge.classes()).toContain('truncate')
    expect(badge.classes()).not.toContain('font-semibold')
  })

  it('renders the next-pane badge; omitting/nulling both props renders neither badge', () => {
    const w = mount(RunPreviewPair, {
      props: { current: null, next: null, live: true, nextVampLabel: 'Waiting · D' },
    })
    const badge = w.find('[data-testid="run-next-vamp-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('♪ Vamp: Waiting · D')

    const none = mount(RunPreviewPair, {
      props: { current: null, next: null, live: true, currentVampLabel: null, nextVampLabel: null },
    })
    expect(none.find('[data-testid="run-current-vamp-badge"]').exists()).toBe(false)
    expect(none.find('[data-testid="run-next-vamp-badge"]').exists()).toBe(false)
  })

  it('renders "♪ Vamp" with no label when assigned without one (E6 partial)', () => {
    const w = mount(RunPreviewPair, {
      props: { current: null, next: null, live: true, currentVampLabel: '' },
    })
    expect(w.find('[data-testid="run-current-vamp-badge"]').text()).toBe('♪ Vamp')
  })

  it('passes suppress-audio to both preview SlideCanvas mounts (defense-in-depth)', () => {
    canvasSuppressAudio.length = 0
    mount(RunPreviewPair, {
      props: { current: fakeSlide('a'), next: fakeSlide('b'), live: true },
    })
    expect(canvasSuppressAudio.length).toBeGreaterThan(0)
    expect(canvasSuppressAudio.every((v) => v === true)).toBe(true)
  })
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
