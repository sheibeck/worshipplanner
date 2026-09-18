import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VampPickerSlideOver from '../VampPickerSlideOver.vue'
import VampPicker from '../VampPicker.vue'
import type { Vamp } from '@/types/vamp'

function makeVamp(overrides: Partial<Vamp> = {}): Vamp {
  return {
    id: 'vamp-1',
    name: 'Open Response',
    key: 'G',
    tempo: '68 bpm',
    attachment: {
      storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/open-response.mp3',
      downloadUrl: 'https://cdn.example/open-response.mp3',
      fileName: 'open-response.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 100,
      createdAt: {} as never,
      createdBy: 'user-1',
    },
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

const vamp1 = makeVamp()
const vamp2 = makeVamp({ id: 'vamp-2', name: 'No File', attachment: null })

function mountSlideOver(
  props: { open: boolean; vamps?: Vamp[]; loading?: boolean; selectedVampId?: string | null } = { open: true },
) {
  return mount(VampPickerSlideOver, {
    props: { vamps: [vamp1, vamp2], loading: false, selectedVampId: null, ...props },
    global: {
      // Mirrors VampSlideOver.test.ts / RoleSlideOver.test.ts: render Teleport's
      // default slot in place so teleported markup is reachable via wrapper.find.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('VampPickerSlideOver', () => {
  it('hosts VampPicker with fill so the list grows to the panel height (260918-pms)', () => {
    const wrapper = mountSlideOver({ open: true })
    expect(wrapper.findComponent(VampPicker).props('fill')).toBe(true)
  })

  it('open: false renders nothing — no slide-over, no backdrop, no VampPicker', () => {
    const wrapper = mountSlideOver({ open: false })
    expect(wrapper.find('[data-testid="vamp-picker-slide-over"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="vamp-picker-slide-over-backdrop"]').exists()).toBe(false)
    expect(wrapper.findComponent(VampPicker).exists()).toBe(false)
  })

  it('open: true renders the shell with the title, close button, and VampPicker hosted inside the panel, props passed through', () => {
    const wrapper = mountSlideOver({ open: true, vamps: [vamp1, vamp2], loading: true, selectedVampId: 'vamp-1' })

    const slideOver = wrapper.get('[data-testid="vamp-picker-slide-over"]')
    expect(wrapper.get('[data-testid="vamp-picker-slide-over-title"]').text()).toBe('Choose a vamp')
    expect(wrapper.get('[data-testid="vamp-picker-slide-over-close"]').attributes('aria-label')).toBe('Close')

    const picker = wrapper.findComponent(VampPicker)
    expect(picker.exists()).toBe(true)
    expect(picker.props('vamps')).toEqual([vamp1, vamp2])
    expect(picker.props('loading')).toBe(true)
    expect(picker.props('selectedVampId')).toBe('vamp-1')

    // The picker is hosted in the body, not beside the panel.
    expect(slideOver.find('[data-testid="vamp-picker-panel"]').exists()).toBe(true)
  })

  it('selecting a vamp row re-emits select with the vamp and does not close it itself', async () => {
    const wrapper = mountSlideOver({ open: true, vamps: [vamp1, vamp2] })

    await wrapper.get('[data-testid="vamp-picker-row"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[vamp1]])
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it("VampPicker's own Cancel closes the slide-over with no select", async () => {
    const wrapper = mountSlideOver({ open: true })

    await wrapper.findComponent(VampPicker).vm.$emit('cancel')

    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('clicking the header close button closes the slide-over', async () => {
    const wrapper = mountSlideOver({ open: true })

    await wrapper.get('[data-testid="vamp-picker-slide-over-close"]').trigger('click')

    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('clicking the backdrop closes the slide-over', async () => {
    const wrapper = mountSlideOver({ open: true })

    await wrapper.get('[data-testid="vamp-picker-slide-over-backdrop"]').trigger('click')

    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('Escape closes the slide-over while open; a non-Escape key emits nothing', () => {
    const wrapper = mountSlideOver({ open: true })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(wrapper.emitted('close')).toBeUndefined()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('once closed via props, a subsequent Escape emits nothing further', async () => {
    const wrapper = mountSlideOver({ open: true })

    await wrapper.setProps({ open: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('removes the Escape listener on unmount so a torn-down slide-over never swallows the key', () => {
    const wrapper = mountSlideOver({ open: true })
    wrapper.unmount()

    expect(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow()
  })
})
