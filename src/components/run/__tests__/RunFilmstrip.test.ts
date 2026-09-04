/**
 * Phase 97 Plan 05 (R282). The RunFilmstrip array-index emit contract.
 *
 * This is the load-bearing assertion of the in-item filmstrip: each thumb emits
 * the slide's GLOBAL array index (from the parent-supplied `indices`), NOT the
 * local v-for loop index. The parent (97-08) maps @jump straight to postIndex,
 * so a loop-index emit would jump click-to-jump to the wrong slide (T-97-05-01).
 * The test mounts with indices = [2, 3, 4] deliberately offset from [0, 1, 2],
 * so a loop-index regression would emit 0/1/2 and fail here loudly.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AssembledSlide } from '@/types/slide'
import RunFilmstrip from '../RunFilmstrip.vue'

// Lightweight SlideCanvas stub rendering the slide id, mirroring the control
// suite's stub (RunControlView.test.ts) so the thumbs need no real render path.
vi.mock('@/components/slides/SlideCanvas.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'SlideCanvasStub',
      props: {
        slide: { type: Object, required: false, default: undefined },
        interactive: { type: Boolean, default: false },
      },
      setup(props) {
        return () =>
          h(
            'div',
            { 'data-testid': 'slide-canvas' },
            (props.slide as { slide?: { id?: string } } | undefined)?.slide?.id ?? '',
          )
      },
    }),
  }
})

function fakeSlide(id: string): AssembledSlide {
  return {
    slide: {
      id,
      position: 0,
      contentKind: 'text',
      body: id,
    },
    slotIndex: 0,
    slotKind: 'MISC',
    sourceId: null,
  } as AssembledSlide
}

describe('RunFilmstrip — array-index click-to-jump contract (R282)', () => {
  it('renders one thumb per slide, frames the current one, and emits the ARRAY index (not the loop index)', async () => {
    const wrapper = mount(RunFilmstrip, {
      props: {
        slides: [fakeSlide('a'), fakeSlide('b'), fakeSlide('c')],
        indices: [2, 3, 4],
        currentIndex: 3,
      },
    })

    const thumbs = wrapper.findAll('[data-testid="run-filmstrip-slide"]')
    expect(thumbs).toHaveLength(3)

    // The current slide is the one whose ARRAY index === currentIndex (3),
    // i.e. the SECOND thumb — it carries the green live frame, the others do not.
    const current = thumbs.find((t) => t.attributes('data-index') === '3')
    expect(current).toBeTruthy()
    expect(current!.classes()).toContain('ring-green-500')
    expect(thumbs[0]!.classes()).not.toContain('ring-green-500')
    expect(thumbs[2]!.classes()).not.toContain('ring-green-500')

    // Clicking the FIRST thumb emits indices[0] === 2 (NOT the loop index 0).
    await thumbs[0]!.trigger('click')
    // Clicking the THIRD thumb emits indices[2] === 4 (NOT the loop index 2).
    await thumbs[2]!.trigger('click')

    const jumps = wrapper.emitted('jump')
    expect(jumps).toBeTruthy()
    expect(jumps).toEqual([[2], [4]])
  })

  it('renders thumbs at the enlarged R330 width (w-48)', () => {
    const wrapper = mount(RunFilmstrip, {
      props: { slides: [fakeSlide('a')], indices: [0], currentIndex: 0 },
    })
    expect(wrapper.find('[data-testid="run-filmstrip-slide"]').classes()).toContain('w-48')
  })
})

describe('RunFilmstrip — auto-scroll keeps the current thumb left-most (owner UAT)', () => {
  it('scrolls the active thumb with inline:"start" on mount and on currentIndex change', async () => {
    // jsdom does not implement scrollIntoView; define it so the component's
    // optional-chained call is observable.
    const proto = HTMLElement.prototype as unknown as { scrollIntoView?: unknown }
    const original = proto.scrollIntoView
    const scrollSpy = vi.fn()
    proto.scrollIntoView = scrollSpy

    try {
      const wrapper = mount(RunFilmstrip, {
        props: {
          slides: [fakeSlide('a'), fakeSlide('b'), fakeSlide('c')],
          indices: [0, 1, 2],
          currentIndex: 0,
        },
      })
      await wrapper.vm.$nextTick()

      // On mount the current (first) thumb is aligned to the strip's start.
      expect(scrollSpy).toHaveBeenCalled()
      const mountCalls = scrollSpy.mock.calls
      expect(mountCalls[mountCalls.length - 1]![0]).toMatchObject({ inline: 'start', block: 'nearest' })

      scrollSpy.mockClear()
      await wrapper.setProps({ currentIndex: 2 })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick() // flush:'post' watcher

      // Advancing re-scrolls so the new current thumb is again left-most —
      // this is what brings the trailing end-cap into view near the end.
      expect(scrollSpy).toHaveBeenCalled()
      const changeCalls = scrollSpy.mock.calls
      expect(changeCalls[changeCalls.length - 1]![0]).toMatchObject({ inline: 'start' })

      wrapper.unmount()
    } finally {
      if (original) proto.scrollIntoView = original
      else delete (proto as Record<string, unknown>).scrollIntoView
    }
  })
})

describe('RunFilmstrip — end-of-item cap (R331)', () => {
  it('names the next item when nextItemLabel is present', () => {
    const wrapper = mount(RunFilmstrip, {
      props: { slides: [fakeSlide('a')], indices: [0], currentIndex: 0, nextItemLabel: 'Sermon' },
    })
    const cap = wrapper.find('[data-testid="run-filmstrip-endcap"]')
    expect(cap.text()).toContain('Sermon')
  })

  it('shows end-of-service copy (no next-name) when nextItemLabel is null', () => {
    const wrapper = mount(RunFilmstrip, {
      props: { slides: [fakeSlide('a')], indices: [0], currentIndex: 0, nextItemLabel: null },
    })
    const cap = wrapper.find('[data-testid="run-filmstrip-endcap"]')
    expect(cap.text()).toContain('End of service')
    expect(cap.text()).not.toContain('Next:')
  })
})
