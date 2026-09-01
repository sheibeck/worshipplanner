import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StageLayoutView from '../StageLayoutView.vue'
import type { StageMarker } from '@/types/service'

const markers: StageMarker[] = [
  { id: 'm1', label: 'Lead Vocal', kind: 'mic', zone: 'onstage', xPct: 25, yPct: 60 },
  { id: 'm2', label: 'Drums', kind: 'instrument', zone: 'offstage', xPct: 80, yPct: 40 },
]

describe('StageLayoutView', () => {
  it('renders exactly two zone containers with the expected headings', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    expect(wrapper.find('[data-testid="stage-zone-onstage"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stage-zone-offstage"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('ON STAGE')
    expect(wrapper.text()).toContain('OFF STAGE (SIDE)')
  })

  it('renders one marker chip per element, placed inside its zone', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    const chips = wrapper.findAll('[data-testid="stage-marker"]')
    expect(chips).toHaveLength(2)

    const onstageZone = wrapper.find('[data-testid="stage-zone-onstage"]')
    const offstageZone = wrapper.find('[data-testid="stage-zone-offstage"]')
    expect(onstageZone.findAll('[data-testid="stage-marker"]')).toHaveLength(1)
    expect(offstageZone.findAll('[data-testid="stage-marker"]')).toHaveLength(1)
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
    // The component must derive left/top purely from the given xPct/yPct
    // props — never from a measured container rect — so a viewport resize
    // recomputes pixel placement via CSS alone, with no JS recalculation
    // step and no possibility of drift (R314).
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    const style = wrapper.find('[data-testid="stage-marker"]').attributes('style') ?? ''
    expect(style).toMatch(/left:\s*\d+(\.\d+)?%/)
    expect(style).toMatch(/top:\s*\d+(\.\d+)?%/)
    expect(style).not.toMatch(/px/)
  })

  it('renders no drag-grab, edit, delete, or add-marker affordances (read-only)', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    expect(wrapper.find('[data-testid="marker-edit-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="marker-remove-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-marker-button"]').exists()).toBe(false)
  })

  it('renders a label containing markup as literal text, never parsed as DOM (XSS-safe)', () => {
    const xssMarkers: StageMarker[] = [
      { id: 'm3', label: '<img src=x onerror=alert(1)>', zone: 'onstage', xPct: 10, yPct: 10 },
    ]
    const wrapper = mount(StageLayoutView, { props: { elements: xssMarkers } })
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('applies dark-mode classes by default', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    const root = wrapper.find('[data-testid="stage-layout-view"]')
    expect(root.classes().some((c) => c.includes('gray-9') || c.includes('gray-95'))).toBe(true)
  })

  it('applies light-mode classes when theme="light"', () => {
    const wrapper = mount(StageLayoutView, { props: { elements: markers, theme: 'light' } })
    const onstageZone = wrapper.find('[data-testid="stage-zone-onstage"]')
    expect(onstageZone.classes().some((c) => c.includes('gray-50') || c.includes('white'))).toBe(true)
  })

  it('renders an accent for a marker with a kind and does not error for a marker with no kind', () => {
    const noKindMarkers: StageMarker[] = [{ id: 'm4', label: 'Extra Speaker Mic', zone: 'onstage', xPct: 50, yPct: 50 }]
    expect(() => mount(StageLayoutView, { props: { elements: noKindMarkers } })).not.toThrow()
    const wrapper = mount(StageLayoutView, { props: { elements: markers } })
    expect(wrapper.html()).toContain('sky')
  })
})
