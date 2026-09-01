import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StageLayoutView from '../StageLayoutView.vue'
import type { StageMarker } from '@/types/service'

const markers: StageMarker[] = [
  { id: 'm1', label: 'Lead Vocal', kind: 'mic', zone: 'onstage', xPct: 25, yPct: 60 },
  // A band-role instrument (Instruments palette mirrors band roles): the type
  // label comes from the denormalized roleName.
  { id: 'm2', label: '', roleId: 'r1', roleName: 'Drums', zone: 'offstage', xPct: 80, yPct: 40 },
]

describe('StageLayoutView', () => {
  it('renders a single continuous room diagram (not two zone boxes)', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    expect(wrapper.find('[data-testid="stage-room"]').exists()).toBe(true)
    // The old two-box layout is gone.
    expect(wrapper.find('[data-testid="stage-zone-onstage"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stage-zone-offstage"]').exists()).toBe(false)
    // Room chrome labels read the way the room does.
    expect(wrapper.text()).toContain('Back of stage')
    expect(wrapper.text()).toContain('Audience')
  })

  it('renders one marker tile per element inside the room', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    const room = wrapper.find('[data-testid="stage-room"]')
    expect(room.findAll('[data-testid="stage-marker"]')).toHaveLength(2)
  })

  it('renders each marker at the exact xPct/yPct given via inline style (R314 reload fidelity)', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    const chips = wrapper.findAll('[data-testid="stage-marker"]')
    const leadVocalChip = chips.find((c) => c.text().includes('Lead Vocal'))!
    const drumsChip = chips.find((c) => c.text().includes('Drums'))!

    expect(leadVocalChip.attributes('style')).toContain('left: 25%')
    expect(leadVocalChip.attributes('style')).toContain('top: 60%')
    expect(drumsChip.attributes('style')).toContain('left: 80%')
    expect(drumsChip.attributes('style')).toContain('top: 40%')
  })

  it('placement style is percentage-only, never a pixel/measured value (resize-stable by construction)', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    const style = wrapper.find('[data-testid="stage-marker"]').attributes('style') ?? ''
    expect(style).toMatch(/left:\s*\d+(\.\d+)?%/)
    expect(style).toMatch(/top:\s*\d+(\.\d+)?%/)
    expect(style).not.toMatch(/px/)
  })

  it('renders no drag, edit, delete, palette, or drawer affordances (read-only)', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    expect(wrapper.find('[data-testid="marker-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="marker-inspector"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid^="palette-chip-"]').exists()).toBe(false)
    // Tiles are not marked interactive (no grab cursor / touch-none).
    const tile = wrapper.find('[data-testid="stage-marker"]')
    expect(tile.classes()).not.toContain('cursor-grab')
  })

  it('renders a label containing markup as literal text, never parsed as DOM (XSS-safe)', () => {
    const xssMarkers: StageMarker[] = [
      { id: 'm3', label: '<img src=x onerror=alert(1)>', zone: 'onstage', xPct: 10, yPct: 10 },
    ]
    const wrapper = mount(StageLayoutView, { props: { elements: xssMarkers } })
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('renders a marker note as literal read-only text when present', () => {
    const withNote: StageMarker[] = [
      { id: 'm5', label: 'Guest', kind: 'mic', zone: 'onstage', xPct: 40, yPct: 40, note: 'Handheld on standby' },
    ]
    const wrapper = mount(StageLayoutView, { props: { elements: withNote } })
    expect(wrapper.text()).toContain('Handheld on standby')
  })

  it('renders a band-role instrument type, an assigned person name, and "+ Vocal"', () => {
    const rich: StageMarker[] = [
      { id: 'm6', label: '', roleId: 'r1', roleName: 'Electric Guitar', personName: 'Dana R.', withVocal: true, zone: 'onstage', xPct: 40, yPct: 40 },
    ]
    const wrapper = mount(StageLayoutView, { props: { elements: rich } })
    expect(wrapper.text()).toContain('Dana R.')
    expect(wrapper.text()).toContain('Electric Guitar + Vocal')
  })

  it('applies a dark room by default and a light room when theme="light"', () => {
    const dark = mount(StageLayoutView, { props: { elements: markers } })
    expect(dark.find('[data-testid="stage-room"]').classes().some((c) => c.includes('#0d0f1a') || c.includes('bg-['))).toBe(true)

    const light = mount(StageLayoutView, { props: { elements: markers, theme: 'light' } })
    expect(light.find('[data-testid="stage-room"]').classes()).toContain('bg-white')
  })

  it('shows an empty-state hint and does not error with no markers', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: [] } })
    expect(wrapper.findAll('[data-testid="stage-marker"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No stage layout')
  })

  it('does not throw for a marker with no kind', () => {
    const noKind: StageMarker[] = [{ id: 'm4', label: 'Extra Speaker Mic', zone: 'onstage', xPct: 50, yPct: 50 }]
    expect(() => mount(StageLayoutView, { props: { elements: noKind } })).not.toThrow()
  })
})
