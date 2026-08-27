import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ArrangementAccordion from '../ArrangementAccordion.vue'
import { MAJOR_KEYS } from '@/constants/keys'
import type { Arrangement } from '@/types/song'

function makeArrangement(overrides: Partial<Arrangement> = {}): Arrangement {
  return {
    id: 'a1',
    name: 'Default',
    key: '',
    bpm: null,
    lengthSeconds: null,
    chordChartUrl: '',
    notes: '',
    teamTags: [],
    ...overrides,
  }
}

describe('ArrangementAccordion — key options (shared constant)', () => {
  it('renders the Major optgroup options from the shared MAJOR_KEYS constant', async () => {
    const wrapper = mount(ArrangementAccordion, {
      props: { arrangement: makeArrangement(), availableTags: [] },
    })

    // Open the accordion body so the Key <select> is rendered.
    await wrapper.find('div.cursor-pointer').trigger('click')

    const optgroups = wrapper.findAll('optgroup')
    const majorGroup = optgroups.find((g) => g.attributes('label') === 'Major')
    expect(majorGroup).toBeTruthy()

    const optionValues = majorGroup!.findAll('option').map((o) => o.attributes('value'))
    expect(optionValues).toEqual(MAJOR_KEYS as unknown as string[])
  })
})
