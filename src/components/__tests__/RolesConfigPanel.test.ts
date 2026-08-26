import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RolesConfigPanel from '../RolesConfigPanel.vue'
import type { Role } from '@/types/roster'

const mockAddRole = vi.fn(() => Promise.resolve('new-id'))
const mockUpdateRole = vi.fn(() => Promise.resolve())
const mockDeleteRole = vi.fn(() => Promise.resolve())

let mockRoles: Role[] = []

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    roles: mockRoles,
    addRole: mockAddRole,
    updateRole: mockUpdateRole,
    deleteRole: mockDeleteRole,
  }),
}))

function mountPanel() {
  return mount(RolesConfigPanel)
}

// Row selects/checkboxes are visually identical to the Add-Role ones (both render
// band/tech/other + a vocal checkbox) — scope queries to elements OUTSIDE the
// `data-testid="add-role"` section to target a specific row's controls.
function rowSelects(wrapper: ReturnType<typeof mountPanel>) {
  const addRoleEl = wrapper.get('[data-testid="add-role"]').element
  return wrapper.findAll('select').filter((s) => !addRoleEl.contains(s.element))
}
function rowVocalCheckboxes(wrapper: ReturnType<typeof mountPanel>) {
  const addRoleEl = wrapper.get('[data-testid="add-role"]').element
  return wrapper.findAll('input[type="checkbox"]').filter((c) => !addRoleEl.contains(c.element))
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockAddRole.mockClear()
  mockUpdateRole.mockClear()
  mockDeleteRole.mockClear()
  mockRoles = [
    { id: 'r-1', name: 'Guitar', group: 'band', defaultCount: 2, order: 0 },
    { id: 'r-2', name: 'Sound', group: 'tech', defaultCount: 1, order: 1 },
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

  it('R245: the per-row Delete button renders as a real destructive button at compact row sizing', () => {
    const wrapper = mountPanel()
    const deleteButtons = wrapper.findAll('button').filter((b) => b.text() === 'Delete')
    expect(deleteButtons.length).toBe(2)
    for (const btn of deleteButtons) {
      const classes = btn.classes()
      expect(classes).toContain('bg-red-900/20')
      expect(classes).toContain('text-red-400')
      expect(classes).toContain('text-xs')
      expect(classes).toContain('px-3')
      expect(classes).toContain('py-1.5')
    }
  })

  it('clicking Delete reveals an inline soft-warn confirm; Cancel dismisses without deleting; confirming calls deleteRole with that role id', async () => {
    const wrapper = mountPanel()
    const deleteButtons = wrapper.findAll('button').filter((b) => b.text() === 'Delete')
    await deleteButtons[0]!.trigger('click')

    expect(wrapper.text()).toContain("Delete the 'Guitar' role?")
    expect(wrapper.text()).toContain('This cannot be undone.')

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(mockDeleteRole).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain("Delete the 'Guitar' role?")

    const deleteButtonsAgain = wrapper.findAll('button').filter((b) => b.text() === 'Delete')
    await deleteButtonsAgain[0]!.trigger('click')
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete Role')!
    await confirmBtn.trigger('click')
    expect(mockDeleteRole).toHaveBeenCalledWith('r-1')
  })

  it('editing a row name then clicking Save Role calls updateRole once with the trimmed draft, not on every keystroke', async () => {
    const wrapper = mountPanel()
    const nameInput = wrapper.findAll('input[type="text"]')[0]!
    await nameInput.setValue('Lead Guitar')

    expect(mockUpdateRole).not.toHaveBeenCalled()

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Role')
    await saveButtons[0]!.trigger('click')

    expect(mockUpdateRole).toHaveBeenCalledTimes(1)
    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Lead Guitar',
      defaultCount: 2,
      group: 'band',
      vocal: false,
    })
  })

  it('WR-01: the per-row edit draft can change group and (for Band) the vocal flag, and Save Role persists both', async () => {
    const wrapper = mountPanel()
    // r-1 is a Band role (Guitar) — its row select should default to 'band' and
    // reveal the vocal checkbox, mirroring the Add-Role form's fields.
    const rowSelect = rowSelects(wrapper)[0]!
    expect(rowSelect.findAll('option').map((o) => o.attributes('value'))).toEqual(['band', 'tech', 'other'])

    const rowVocalCheckbox = rowVocalCheckboxes(wrapper)[0]!
    await rowVocalCheckbox.setValue(true)

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Role')
    await saveButtons[0]!.trigger('click')

    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Guitar',
      defaultCount: 2,
      group: 'band',
      vocal: true,
    })
  })

  it('WR-01: changing a row group away from Band hides its vocal checkbox and forces vocal:false on save', async () => {
    const wrapper = mountPanel()
    const rowSelect = rowSelects(wrapper)[0]!
    await rowSelect.setValue('tech')

    expect(rowVocalCheckboxes(wrapper)).toHaveLength(0)

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Role')
    await saveButtons[0]!.trigger('click')

    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Guitar',
      defaultCount: 2,
      group: 'tech',
      vocal: false,
    })
  })

  it('Add-Role row calls addRole with name/group/defaultCount/order', async () => {
    const wrapper = mountPanel()
    const addNameInput = wrapper.find('input[placeholder="Role name"]')
    await addNameInput.setValue('Bass')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Role' || b.text() === 'Added ✓')
    const addButton = saveButtons[saveButtons.length - 1]!
    await addButton.trigger('click')

    expect(mockAddRole).toHaveBeenCalledWith({ name: 'Bass', group: 'band', defaultCount: 1, order: 2 })
  })

  it('R250: the group select has no standalone Vocals option (band/tech/other only)', () => {
    const wrapper = mountPanel()
    const groupSelect = wrapper.findAll('select').find((s) =>
      s.findAll('option').some((o) => o.attributes('value') === 'band'),
    )!
    const optionValues = groupSelect.findAll('option').map((o) => o.attributes('value'))
    expect(optionValues).toEqual(['band', 'tech', 'other'])
    expect(optionValues).not.toContain('vocals')
  })

  it('R250: selecting the Band group reveals the "sing & play" vocal checkbox; checking it and adding a role calls addRole with vocal:true', async () => {
    const wrapper = mountPanel()
    const addRoleSection = wrapper.get('[data-testid="add-role"]')
    const groupSelect = addRoleSection.findAll('select').find((s) =>
      s.findAll('option').some((o) => o.attributes('value') === 'band'),
    )!

    // Default group is 'band' — the checkbox is visible without switching first.
    expect(addRoleSection.text()).toContain('Vocal role (can sing & play)')

    // Switching away from Band hides it; switching back reveals it again.
    await groupSelect.setValue('tech')
    expect(addRoleSection.text()).not.toContain('Vocal role (can sing & play)')
    await groupSelect.setValue('band')
    expect(addRoleSection.text()).toContain('Vocal role (can sing & play)')

    const addNameInput = wrapper.find('input[placeholder="Role name"]')
    await addNameInput.setValue('Lead Vocal')
    const vocalCheckbox = addRoleSection.find('input[type="checkbox"]')
    await vocalCheckbox.setValue(true)

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Role' || b.text() === 'Added ✓')
    const addButton = saveButtons[saveButtons.length - 1]!
    await addButton.trigger('click')

    expect(mockAddRole).toHaveBeenCalledWith({
      name: 'Lead Vocal',
      group: 'band',
      defaultCount: 1,
      order: 2,
      vocal: true,
    })
  })
})
