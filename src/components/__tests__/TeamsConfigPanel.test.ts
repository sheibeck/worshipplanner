import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamsConfigPanel from '../TeamsConfigPanel.vue'
import type { Team } from '@/types/team'

let mockTeams: Team[] = []

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    teams: mockTeams,
  }),
}))

function mountPanel() {
  return mount(TeamsConfigPanel)
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockTeams = [
    { id: 't-1', name: 'Choir', order: 0, recurrence: { ordinals: [1, 3] } },
    { id: 't-2', name: 'Orchestra', order: 1 },
  ]
})

describe('TeamsConfigPanel', () => {
  it('renders one read-only row per team, ordered, with no form controls', () => {
    const wrapper = mountPanel()
    expect(wrapper.findAll('input, select, textarea').length).toBe(0)

    const rows = wrapper.findAll('[aria-label$=" team"]')
    expect(rows.length).toBe(2)
    expect(rows[0]!.text()).toContain('Choir')
    expect(rows[1]!.text()).toContain('Orchestra')
  })

  it('shows the recurrence summary "1st & 3rd Sun" for ordinals [1,3] and "—" for none', () => {
    const wrapper = mountPanel()
    const choirRow = wrapper.find('[aria-label="Edit Choir team"]')
    expect(choirRow.text()).toContain('1st & 3rd Sun')

    const orchestraRow = wrapper.find('[aria-label="Edit Orchestra team"]')
    expect(orchestraRow.text()).toContain('—')
  })

  it('clicking a row emits edit with the team', async () => {
    const wrapper = mountPanel()
    const choirRow = wrapper.find('[aria-label="Edit Choir team"]')
    await choirRow.trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual([mockTeams[0]])
  })

  it('"+ Add team" emits add', async () => {
    const wrapper = mountPanel()
    const addButton = wrapper.findAll('button').find((b) => b.text().includes('Add team'))!
    expect(addButton).toBeTruthy()
    await addButton.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')!.length).toBe(1)
  })

  it('renders the empty state for zero teams', () => {
    mockTeams = []
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('No teams yet.')
  })
})
