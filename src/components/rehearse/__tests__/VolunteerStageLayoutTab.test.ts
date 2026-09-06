import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VolunteerStageLayoutTab from '../VolunteerStageLayoutTab.vue'
import StageLayoutView from '@/components/stage/StageLayoutView.vue'
import type { PublicStageMarker } from '@/stores/services'

function makeMarker(overrides: Partial<PublicStageMarker> = {}): PublicStageMarker {
  return {
    id: 'm1',
    label: 'Lead Vocal',
    zone: 'onstage',
    xPct: 50,
    yPct: 50,
    ...overrides,
  }
}

describe('VolunteerStageLayoutTab', () => {
  it('renders StageLayoutView with theme=dark, print=false, and the passed elements when markers exist', () => {
    const elements = [makeMarker()]
    const wrapper = mount(VolunteerStageLayoutTab, { props: { elements } })

    const stageLayoutView = wrapper.findComponent(StageLayoutView)
    expect(stageLayoutView.exists()).toBe(true)
    expect(stageLayoutView.props('theme')).toBe('dark')
    expect(stageLayoutView.props('print')).toBe(false)
    expect(stageLayoutView.props('elements')).toEqual(elements)
  })

  it('renders the empty-stage copy (and no StageLayoutView) when there are no markers', () => {
    const wrapper = mount(VolunteerStageLayoutTab, { props: { elements: [] } })

    expect(wrapper.text()).toContain('No stage layout has been set up for this service.')
    expect(wrapper.findComponent(StageLayoutView).exists()).toBe(false)
  })

  it('renders the empty-stage copy when elements is undefined', () => {
    const wrapper = mount(VolunteerStageLayoutTab, { props: {} })

    expect(wrapper.text()).toContain('No stage layout has been set up for this service.')
    expect(wrapper.findComponent(StageLayoutView).exists()).toBe(false)
  })

  it('renders no Print button', () => {
    const elements = [makeMarker()]
    const wrapper = mount(VolunteerStageLayoutTab, { props: { elements } })

    const buttons = wrapper.findAll('button')
    for (const button of buttons) {
      expect(button.text().toLowerCase()).not.toContain('print')
    }
    expect(wrapper.find('[aria-label*="Print" i]').exists()).toBe(false)
  })
})
