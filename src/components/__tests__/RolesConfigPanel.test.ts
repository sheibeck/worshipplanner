import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RolesConfigPanel from '../RolesConfigPanel.vue'
import type { Role } from '@/types/roster'

let mockRoles: Role[] = []

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    roles: mockRoles,
  }),
}))

function mountPanel() {
  return mount(RolesConfigPanel)
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockRoles = [
    { id: 'r-1', name: 'Guitar', group: 'band', defaultCount: 2, order: 0 },
    { id: 'r-2', name: 'Sound', group: 'tech', defaultCount: 1, order: 1 },
    { id: 'r-3', name: 'Vocals', group: 'band', multiRole: true, defaultCount: 1, order: 2 },
  ]
})

describe('RolesConfigPanel', () => {
  it('R246: header copy states the scheduler auto-fills the count each service, dropping the old soft-target framing', () => {
    const wrapper = mountPanel()
    const text = wrapper.text().toLowerCase()
    expect(text).toContain('auto-fill')
    expect(text).toContain('each service')
    // <!-- planner-discipline-allow: soft planning target -->
    expect(text).not.toContain('soft planning target')
    // <!-- planner-discipline-allow: not a hard cap -->
    expect(text).not.toContain('not a hard cap')
  })

  // R256 (87-01): verify-first — a repo-wide grep found no straggler UI surface
  // still using the deprecated soft-target phrasing, so no production change was
  // made here. This test locks the accurate copy in place: a positive assertion
  // on the real "auto-fill … each service" wording plus the negative assertions
  // above, so a future edit reintroducing soft-target framing fails loudly.
  it('R256: the default-count copy is verified accurate and locked against soft-target framing regressing', () => {
    const wrapper = mountPanel()
    const text = wrapper.text().toLowerCase()
    expect(text).toContain('default count is the number of volunteers the scheduler auto-fills for this role each service')
    // <!-- planner-discipline-allow: soft planning target -->
    expect(text).not.toContain('soft planning target')
    // <!-- planner-discipline-allow: not a hard cap -->
    expect(text).not.toContain('not a hard cap')
  })

  it('renders no form controls anywhere in the panel', () => {
    const wrapper = mountPanel()
    expect(wrapper.findAll('input, select, textarea').length).toBe(0)
  })

  it('renders a labeled column header row (Role, Positions, Multi-role)', () => {
    const wrapper = mountPanel()
    const header = wrapper.get('[data-testid="roles-columns"]')
    expect(header.text()).toContain('Role')
    expect(header.text()).toContain('Positions')
    expect(header.text()).toContain('Multi-role')
    // Group is conveyed by the Band/Tech/Other section headers, not a per-row column.
    expect(header.text()).not.toContain('Group')
  })

  it('still groups roles under Band/Tech/Other headers', () => {
    const wrapper = mountPanel()
    const text = wrapper.text()
    expect(text).toContain('Band')
    expect(text).toContain('Tech')
    expect(text).toContain('Other')
  })

  it('clicking a role row emits edit with the matching role', async () => {
    const wrapper = mountPanel()
    const row = wrapper.find('[aria-label="Edit Guitar role"]')
    expect(row.exists()).toBe(true)
    await row.trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual([mockRoles[0]])
  })

  it('a "+ Add role" affordance emits add', async () => {
    const wrapper = mountPanel()
    const addButton = wrapper.findAll('button').find((b) => b.text().includes('Add role'))!
    expect(addButton).toBeTruthy()
    await addButton.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')!.length).toBe(1)
  })

  it('shows "Yes" in the Multi-role column for a multi-role role and not for a non-multi-role one', () => {
    const wrapper = mountPanel()
    // The Multi-role column data reads "Yes" when true (the "Multi-role" text lives only in the header).
    const vocalRow = wrapper.find('[aria-label="Edit Vocals role"]')
    expect(vocalRow.text()).toContain('Yes')

    const guitarRow = wrapper.find('[aria-label="Edit Guitar role"]')
    // Guitar is not multi-role — its Multi-role cell shows the muted em dash, not "Yes".
    const guitarText = guitarRow.text()
    expect(guitarText).not.toContain('Yes')
    expect(guitarText).toContain('—')
  })
})
