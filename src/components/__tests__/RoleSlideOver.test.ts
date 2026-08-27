import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleSlideOver from '../RoleSlideOver.vue'
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

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r-1',
    name: 'Guitar',
    group: 'band',
    defaultCount: 2,
    order: 0,
    ...overrides,
  }
}

// Mirrors SongSlideOver.test.ts's mount pattern: mount closed, then flip open
// so the watch(() => props.open, ...) seed runs from a false->true transition.
async function mountDrawer(role: Role | null) {
  const wrapper = mount(RoleSlideOver, {
    props: { open: false, role },
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
  await wrapper.setProps({ open: true })
  return wrapper
}

beforeEach(() => {
  mockAddRole.mockClear()
  mockUpdateRole.mockClear()
  mockDeleteRole.mockClear()
  mockRoles = [
    makeRole({ id: 'r-1', name: 'Guitar', group: 'band', defaultCount: 2, order: 0 }),
    makeRole({ id: 'r-2', name: 'Sound', group: 'tech', defaultCount: 1, order: 1 }),
  ]
})

describe('RoleSlideOver', () => {
  it('open=false renders nothing', () => {
    const wrapper = mount(RoleSlideOver, {
      props: { open: false, role: null },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    expect(wrapper.find('[data-testid="role-name-input"]').exists()).toBe(false)
  })

  it('create mode: filling name and clicking Save calls addRole with vocal only when Band+checked, then emits saved', async () => {
    const wrapper = await mountDrawer(null)
    expect(wrapper.text()).toContain('New Role')

    await wrapper.get('[data-testid="role-name-input"]').setValue('Bass')
    await wrapper.get('[data-testid="role-vocal-checkbox"]').setValue(true)

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockAddRole).toHaveBeenCalledWith({
      name: 'Bass',
      group: 'band',
      defaultCount: 1,
      order: 2,
      vocal: true,
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('create mode: leaving the vocal checkbox unchecked omits vocal from the payload', async () => {
    const wrapper = await mountDrawer(null)
    await wrapper.get('[data-testid="role-name-input"]').setValue('Bass')

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockAddRole).toHaveBeenCalledWith({
      name: 'Bass',
      group: 'band',
      defaultCount: 1,
      order: 2,
    })
  })

  it('edit mode: fields prefill from the role', async () => {
    const wrapper = await mountDrawer(makeRole())
    expect(wrapper.text()).toContain('Edit Role')
    expect((wrapper.get('[data-testid="role-name-input"]').element as HTMLInputElement).value).toBe('Guitar')
    expect((wrapper.get('[data-testid="role-group-select"]').element as HTMLSelectElement).value).toBe('band')
    expect((wrapper.get('[data-testid="role-count-input"]').element as HTMLInputElement).value).toBe('2')
  })

  it('edit mode: changing fields and Save calls updateRole with trimmed name and vocal, then emits saved', async () => {
    const wrapper = await mountDrawer(makeRole())
    await wrapper.get('[data-testid="role-name-input"]').setValue('  Lead Guitar  ')
    await wrapper.get('[data-testid="role-vocal-checkbox"]').setValue(true)

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Lead Guitar',
      group: 'band',
      defaultCount: 2,
      vocal: true,
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  // WR-01 (Phase 88 review fix): Save is a plain button, so the number
  // input's min="1" never runs HTML5 constraint validation. Clearing the
  // Default count field must not persist an empty string / NaN to Firestore.
  it('create mode: clearing Default count before Save persists defaultCount as 1, not ""', async () => {
    const wrapper = await mountDrawer(null)
    await wrapper.get('[data-testid="role-name-input"]').setValue('Bass')
    await wrapper.get('[data-testid="role-count-input"]').setValue('')

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockAddRole).toHaveBeenCalledWith({
      name: 'Bass',
      group: 'band',
      defaultCount: 1,
      order: 2,
    })
  })

  it('edit mode: clearing Default count before Save persists defaultCount as 1, not ""', async () => {
    const wrapper = await mountDrawer(makeRole())
    await wrapper.get('[data-testid="role-count-input"]').setValue('')

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Guitar',
      group: 'band',
      defaultCount: 1,
      vocal: false,
    })
  })

  it('edit mode: setting Default count to a value below 1 (e.g. 0) floors it to 1 on Save', async () => {
    const wrapper = await mountDrawer(makeRole())
    await wrapper.get('[data-testid="role-count-input"]').setValue('0')

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Guitar',
      group: 'band',
      defaultCount: 1,
      vocal: false,
    })
  })

  it('vocal checkbox is present only while group===band; switching away hides it and forces vocal:false on save', async () => {
    const wrapper = await mountDrawer(makeRole({ vocal: true }))
    expect(wrapper.find('[data-testid="role-vocal-checkbox"]').exists()).toBe(true)

    await wrapper.get('[data-testid="role-group-select"]').setValue('tech')
    expect(wrapper.find('[data-testid="role-vocal-checkbox"]').exists()).toBe(false)

    const saveBtn = wrapper.findAll('button').find((b) => b.text().startsWith('Save'))!
    await saveBtn.trigger('click')
    await Promise.resolve()

    expect(mockUpdateRole).toHaveBeenCalledWith('r-1', {
      name: 'Guitar',
      group: 'tech',
      defaultCount: 2,
      vocal: false,
    })
  })

  it('delete (edit mode only): first click reveals confirm copy naming the role; confirming calls deleteRole and emits deleted', async () => {
    const wrapper = await mountDrawer(makeRole())
    const deleteLink = wrapper.findAll('button').find((b) => b.text() === 'Delete Role')!
    await deleteLink.trigger('click')

    expect(wrapper.text()).toContain("Delete the 'Guitar' role?")
    expect(wrapper.text()).toContain('cleared')
    expect(mockDeleteRole).not.toHaveBeenCalled()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete Role')!
    await confirmBtn.trigger('click')
    await Promise.resolve()

    expect(mockDeleteRole).toHaveBeenCalledWith('r-1')
    expect(wrapper.emitted('deleted')).toBeTruthy()
  })

  it('delete confirm Cancel dismisses without deleting', async () => {
    const wrapper = await mountDrawer(makeRole())
    const deleteLink = wrapper.findAll('button').find((b) => b.text() === 'Delete Role')!
    await deleteLink.trigger('click')

    const cancelBtn = wrapper.findAll('button').filter((b) => b.text() === 'Cancel')[1]!
    await cancelBtn.trigger('click')

    expect(mockDeleteRole).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain("Delete the 'Guitar' role?")
  })

  it('create mode has no Delete button', async () => {
    const wrapper = await mountDrawer(null)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Delete Role')).toBe(false)
  })

  it('Cancel/close emits close without saving', async () => {
    const wrapper = await mountDrawer(makeRole())
    const closeBtn = wrapper.find('[aria-label="Close"]')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(mockUpdateRole).not.toHaveBeenCalled()
  })
})
