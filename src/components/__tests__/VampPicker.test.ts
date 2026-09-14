import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VampPicker from '../VampPicker.vue'
import type { Vamp } from '@/types/vamp'

function makeVamp(overrides: Partial<Vamp> = {}): Vamp {
  return {
    id: 'vamp-1',
    name: 'Open Response',
    key: 'G',
    tempo: '68 bpm',
    attachment: {
      storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/track.mp3',
      downloadUrl: 'https://example.com/track.mp3',
      fileName: 'track.mp3',
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

describe('VampPicker', () => {
  it('renders two enabled rows and one disabled no-MP3 row from three vamps', () => {
    const vamps = [
      makeVamp({ id: 'v-waiting', name: 'Waiting', key: 'D' }),
      makeVamp({ id: 'v-no-file', name: 'No File', key: 'A', attachment: null }),
      makeVamp({ id: 'v-open', name: 'Open Response', key: 'G' }),
    ]
    const wrapper = mount(VampPicker, { props: { vamps } })

    expect(wrapper.findAll('[data-testid="vamp-picker-row"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="vamp-picker-row-disabled"]')).toHaveLength(1)
  })

  it('sorts rows by name (checked via data-vamp-id order across both enabled/disabled)', () => {
    const vamps = [
      makeVamp({ id: 'v-waiting', name: 'Waiting', key: 'D' }),
      makeVamp({ id: 'v-open', name: 'Open Response', key: 'G' }),
    ]
    const wrapper = mount(VampPicker, { props: { vamps } })
    const rows = wrapper.findAll('[data-testid="vamp-picker-row"]')
    expect(rows.map((r) => r.attributes('data-vamp-id'))).toEqual(['v-open', 'v-waiting'])
  })

  it('shows each enabled row name, key chip, and tempo (or em-dash when absent)', () => {
    const vamps = [makeVamp({ id: 'v1', name: 'Open Response', key: 'G', tempo: '68 bpm' }), makeVamp({ id: 'v2', name: 'Quiet', key: 'D', tempo: undefined })]
    const wrapper = mount(VampPicker, { props: { vamps } })
    const rows = wrapper.findAll('[data-testid="vamp-picker-row"]')
    expect(rows[0]!.text()).toContain('Open Response')
    expect(rows[0]!.text()).toContain('G')
    expect(rows[0]!.text()).toContain('68 bpm')
    expect(rows[1]!.text()).toContain('—')
  })

  it('renders a disabled row with aria-disabled and No MP3, and emits nothing on click', async () => {
    const vamps = [makeVamp({ id: 'v-no-file', name: 'No File', key: 'A', attachment: null })]
    const wrapper = mount(VampPicker, { props: { vamps } })
    const disabledRow = wrapper.get('[data-testid="vamp-picker-row-disabled"]')
    expect(disabledRow.attributes('aria-disabled')).toBe('true')
    expect(disabledRow.text()).toContain('No MP3')
    await disabledRow.trigger('click')
    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('filters rows by name (case-insensitive substring)', async () => {
    const vamps = [makeVamp({ id: 'v1', name: 'Open Response', key: 'G' }), makeVamp({ id: 'v2', name: 'Waiting', key: 'D' })]
    const wrapper = mount(VampPicker, { props: { vamps } })
    await wrapper.get('[data-testid="vamp-picker-search"]').setValue('open')
    const rows = wrapper.findAll('[data-testid="vamp-picker-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Open Response')
  })

  it('filters rows by key and shows no-match copy when nothing matches', async () => {
    const vamps = [makeVamp({ id: 'v1', name: 'Open Response', key: 'G' }), makeVamp({ id: 'v2', name: 'Waiting', key: 'D' })]
    const wrapper = mount(VampPicker, { props: { vamps } })
    await wrapper.get('[data-testid="vamp-picker-search"]').setValue('d')
    let rows = wrapper.findAll('[data-testid="vamp-picker-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Waiting')

    await wrapper.get('[data-testid="vamp-picker-search"]').setValue('zzz')
    rows = wrapper.findAll('[data-testid="vamp-picker-row"]')
    expect(rows).toHaveLength(0)
    expect(wrapper.get('[data-testid="vamp-picker-no-match"]').text()).toBe('No vamps match your search.')
  })

  it('shows empty copy when there are zero vamps, and loading copy when loading is true', () => {
    const empty = mount(VampPicker, { props: { vamps: [] } })
    expect(empty.get('[data-testid="vamp-picker-empty"]').text()).toBe('No vamps yet — add one from the Vamps tab.')

    const loading = mount(VampPicker, { props: { vamps: [], loading: true } })
    expect(loading.get('[data-testid="vamp-picker-loading"]').text()).toBe('Loading vamps...')
  })

  it('emits select with the clicked vamp exactly once', async () => {
    const vamp = makeVamp({ id: 'v1' })
    const wrapper = mount(VampPicker, { props: { vamps: [vamp] } })
    await wrapper.get('[data-testid="vamp-picker-row"]').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')?.[0]).toEqual([vamp])
  })

  it('WR-02: emits cancel exactly once from its own Cancel button, with no select', async () => {
    const vamp = makeVamp({ id: 'v1' })
    const wrapper = mount(VampPicker, { props: { vamps: [vamp] } })
    await wrapper.get('[data-testid="vamp-picker-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('highlights the row matching selectedVampId with the selected classes and checkmark', () => {
    const vamps = [makeVamp({ id: 'v1', name: 'A' }), makeVamp({ id: 'v2', name: 'B' })]
    const wrapper = mount(VampPicker, { props: { vamps, selectedVampId: 'v2' } })
    const rows = wrapper.findAll('[data-testid="vamp-picker-row"]')
    const selectedRow = rows.find((r) => r.attributes('data-vamp-id') === 'v2')!
    const unselectedRow = rows.find((r) => r.attributes('data-vamp-id') === 'v1')!
    expect(selectedRow.classes()).toContain('bg-indigo-950/40')
    expect(selectedRow.find('svg').exists()).toBe(true)
    expect(unselectedRow.classes()).not.toContain('bg-indigo-950/40')
    expect(unselectedRow.find('svg').exists()).toBe(false)
  })
})
