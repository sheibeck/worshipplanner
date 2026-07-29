import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SlideDropTarget from '../SlideDropTarget.vue'

function makeFile(name: string, type: string): File {
  return new File(['bytes'], name, { type })
}

describe('SlideDropTarget', () => {
  it('renders the exact drop tile heading and subtext from the copywriting contract', () => {
    const wrapper = mount(SlideDropTarget)
    expect(wrapper.text()).toContain('Drop PPTX, images, video, or audio')
    expect(wrapper.text()).toContain(
      "PPTX, image, and video appends a slide · audio sets this group's music",
    )
  })

  // R054 (Phase 30 verification defect): the tile stays mounted on a SONG
  // group because group-level music is still allowed, but SlideGrid refuses
  // every slide-appending route there. Before this fix the tile still read
  // "Drop PPTX, images, video, or audio ... appends a slide", advertising an
  // action the locked group silently rejects.
  it('advertises audio only, and points at Song Lyrics, when audioOnly is set', () => {
    const wrapper = mount(SlideDropTarget, { props: { audioOnly: true } })
    expect(wrapper.text()).toContain('Drop audio')
    expect(wrapper.text()).not.toContain('Drop PPTX, images, video, or audio')
    expect(wrapper.text()).not.toContain('appends a slide')
    expect(wrapper.text()).toContain("Audio sets this group's music")
    expect(wrapper.text()).toContain("a song's slides are managed in Song Lyrics")
  })

  it('still emits audio drops when audioOnly is set — the tile is not inert', async () => {
    const wrapper = mount(SlideDropTarget, { props: { audioOnly: true } })
    const file = makeFile('bed.mp3', 'audio/mpeg')
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('drop')![0]).toEqual([[file]])
  })

  it('does not carry the class SortableJS is scoped to', () => {
    const wrapper = mount(SlideDropTarget)
    expect(wrapper.classes()).not.toContain('slide-card')
  })

  it('emits the dropped file list on drop', async () => {
    const wrapper = mount(SlideDropTarget)
    const file = makeFile('deck.pptx', '')
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('drop')).toBeTruthy()
    expect(wrapper.emitted('drop')![0]).toEqual([[file]])
  })

  it('emits nothing when the drop carries no files', async () => {
    const wrapper = mount(SlideDropTarget)
    await wrapper.trigger('drop', { dataTransfer: { files: [] } })
    expect(wrapper.emitted('drop')).toBeUndefined()
  })

  it('performs no upload or routing decision of its own — only emits', async () => {
    const wrapper = mount(SlideDropTarget)
    const file = makeFile('a.mp3', 'audio/mpeg')
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    // The emitted payload is the raw, unclassified file list — routing is
    // the caller's (SlideGrid's) job via dropRouting.ts.
    expect(wrapper.emitted('drop')![0]).toEqual([[file]])
  })
})
