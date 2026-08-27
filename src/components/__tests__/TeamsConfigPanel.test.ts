import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamsConfigPanel from '../TeamsConfigPanel.vue'
import type { Team } from '@/types/team'

const mockAddTeam = vi.fn(() => Promise.resolve('new-id'))
const mockUpdateTeam = vi.fn(() => Promise.resolve())
const mockDeleteTeam = vi.fn(() => Promise.resolve())

let mockTeams: Team[] = []

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    teams: mockTeams,
    addTeam: mockAddTeam,
    updateTeam: mockUpdateTeam,
    deleteTeam: mockDeleteTeam,
  }),
}))

function mountPanel() {
  return mount(TeamsConfigPanel, {
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockAddTeam.mockClear()
  mockUpdateTeam.mockClear()
  mockDeleteTeam.mockClear()
  mockTeams = [
    { id: 't-1', name: 'Choir', order: 0, recurrence: { ordinals: [1, 3] } },
    { id: 't-2', name: 'Orchestra', order: 1 },
  ]
})

describe('TeamsConfigPanel', () => {
  it('renders one row per team, ordered', () => {
    const wrapper = mountPanel()
    const nameInputs = wrapper
      .findAll('input[type="text"]')
      .filter((i) => (i.attributes('aria-label') ?? '').startsWith('Team name for'))
    expect(nameInputs.length).toBe(2)
    expect((nameInputs[0]!.element as HTMLInputElement).value).toBe('Choir')
    expect((nameInputs[1]!.element as HTMLInputElement).value).toBe('Orchestra')
  })

  it('editing a name then clicking Save Team does not save on every keystroke', async () => {
    const wrapper = mountPanel()
    const nameInput = wrapper
      .findAll('input[type="text"]')
      .find((i) => i.attributes('aria-label') === 'Team name for Choir')!
    await nameInput.setValue('Choir Renamed')

    expect(mockUpdateTeam).not.toHaveBeenCalled()
  })

  it('WR-02: renaming a team surfaces a soft-warn confirm instead of saving immediately; confirming calls updateTeam with the draft', async () => {
    const wrapper = mountPanel()
    const nameInput = wrapper
      .findAll('input[type="text"]')
      .find((i) => i.attributes('aria-label') === 'Team name for Choir')!
    await nameInput.setValue('Choir Renamed')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team')
    await saveButtons[0]!.trigger('click')

    // First click surfaces the rename warning — does not save yet.
    expect(mockUpdateTeam).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("Rename the 'Choir' team to 'Choir Renamed'?")

    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Rename Team')!
    await confirmBtn.trigger('click')

    expect(mockUpdateTeam).toHaveBeenCalledTimes(1)
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir Renamed' })
  })

  it('WR-02: Cancel on the rename warning dismisses it without saving', async () => {
    const wrapper = mountPanel()
    const nameInput = wrapper
      .findAll('input[type="text"]')
      .find((i) => i.attributes('aria-label') === 'Team name for Choir')!
    await nameInput.setValue('Choir Renamed')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team')
    await saveButtons[0]!.trigger('click')
    expect(wrapper.text()).toContain("Rename the 'Choir' team to 'Choir Renamed'?")

    const cancelBtn = wrapper.findAll('button').filter((b) => b.text() === 'Cancel')[0]!
    await cancelBtn.trigger('click')

    expect(mockUpdateTeam).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain("Rename the 'Choir' team")
  })

  it('clicking Delete reveals an inline soft-warn confirm; Cancel dismisses without deleting; confirming calls deleteTeam', async () => {
    const wrapper = mountPanel()
    const deleteLinks = wrapper.findAll('button').filter((b) => b.text() === 'Delete')
    await deleteLinks[0]!.trigger('click')

    expect(wrapper.text()).toContain("Delete the 'Choir' team?")
    expect(wrapper.text()).toContain('This cannot be undone.')

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')!
    await cancelBtn.trigger('click')
    expect(mockDeleteTeam).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain("Delete the 'Choir' team?")

    await deleteLinks[0]!.trigger('click')
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete Team')!
    await confirmBtn.trigger('click')
    expect(mockDeleteTeam).toHaveBeenCalledWith('t-1')
  })

  it('Add-Team row calls addTeam with name/order and clears the input afterward', async () => {
    const wrapper = mountPanel()
    const addNameInput = wrapper.find('input[aria-label="New team name"]')
    await addNameInput.setValue('Kids Team')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team' || b.text() === 'Added ✓')
    const addButton = saveButtons[saveButtons.length - 1]!
    await addButton.trigger('click')

    expect(mockAddTeam).toHaveBeenCalledWith({ name: 'Kids Team', order: 2 })
    expect((addNameInput.element as HTMLInputElement).value).toBe('')
  })

  it('every team name input has a non-empty aria-label', () => {
    const wrapper = mountPanel()
    wrapper.findAll('input[type="text"]').forEach((input) => {
      expect(input.attributes('aria-label')).toBeTruthy()
    })
  })

  it('IN-02: each row Delete button carries a per-row aria-label naming the team', () => {
    const wrapper = mountPanel()
    const deleteButtons = wrapper.findAll('button').filter((b) => b.text() === 'Delete')
    expect(deleteButtons.map((b) => b.attributes('aria-label'))).toEqual(['Delete Choir team', 'Delete Orchestra team'])
  })

  it('R245: the per-row Delete button renders as a real destructive button', () => {
    const wrapper = mountPanel()
    const deleteButtons = wrapper.findAll('button').filter((b) => b.text() === 'Delete')
    for (const btn of deleteButtons) {
      const classes = btn.classes()
      expect(classes).toContain('bg-red-900/20')
      expect(classes).toContain('text-red-400')
    }
  })

  it('renders the empty state above the always-visible Add Team row when there are zero teams', () => {
    mockTeams = []
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('No teams yet.')
    expect(wrapper.text()).toContain('Add your first team below.')
    expect(wrapper.find('input[aria-label="New team name"]').exists()).toBe(true)
  })

  it('WR-01: renaming a team to a name that collides with another team (case/whitespace-insensitive) is rejected, not saved', async () => {
    const wrapper = mountPanel()
    const nameInput = wrapper
      .findAll('input[type="text"]')
      .find((i) => i.attributes('aria-label') === 'Team name for Choir')!
    await nameInput.setValue('  orchestra  ')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team')
    await saveButtons[0]!.trigger('click')

    expect(mockUpdateTeam).not.toHaveBeenCalled()
  })

  it('WR-01: adding a team whose name collides with an existing team (case/whitespace-insensitive) is rejected, not added', async () => {
    const wrapper = mountPanel()
    const addNameInput = wrapper.find('input[aria-label="New team name"]')
    await addNameInput.setValue(' CHOIR ')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team' || b.text() === 'Added ✓')
    const addButton = saveButtons[saveButtons.length - 1]!
    await addButton.trigger('click')

    expect(mockAddTeam).not.toHaveBeenCalled()
  })

  it('WR-04: a second Add-Team click while the first request is in flight does not call addTeam twice', async () => {
    let resolveAdd: (() => void) | undefined
    mockAddTeam.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveAdd = () => resolve('new-id')
        }),
    )
    const wrapper = mountPanel()
    const addNameInput = wrapper.find('input[aria-label="New team name"]')
    await addNameInput.setValue('Kids Team')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team' || b.text() === 'Added ✓' || b.text() === 'Saving…')
    const addButton = saveButtons[saveButtons.length - 1]!

    // Fire the click handler twice back-to-back before the first await resolves.
    await addButton.trigger('click')
    await addButton.trigger('click')

    expect(mockAddTeam).toHaveBeenCalledTimes(1)

    resolveAdd?.()
    await Promise.resolve()
  })

  // ── R254: recurring-schedule slide-over ──────────────────────────────────

  it('R254: each team row exposes a > chevron with a per-team aria-label', () => {
    const wrapper = mountPanel()
    const chevron = wrapper.find('[aria-label="Edit recurring schedule for Choir"]')
    expect(chevron.exists()).toBe(true)
  })

  it('R254: clicking a chevron opens the slide-over with that team\'s saved ordinals pre-selected', async () => {
    const wrapper = mountPanel()
    const chevron = wrapper.find('[aria-label="Edit recurring schedule for Choir"]')
    await chevron.trigger('click')

    const firstSunday = wrapper.findAll('button').find((b) => b.text() === '1st Sunday')!
    const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
    const thirdSunday = wrapper.findAll('button').find((b) => b.text() === '3rd Sunday')!

    expect(firstSunday.attributes('aria-pressed')).toBe('true')
    expect(secondSunday.attributes('aria-pressed')).toBe('false')
    expect(thirdSunday.attributes('aria-pressed')).toBe('true')
  })

  it('R254: a team opened with no recurrence starts with nothing selected', async () => {
    const wrapper = mountPanel()
    const chevron = wrapper.find('[aria-label="Edit recurring schedule for Orchestra"]')
    await chevron.trigger('click')

    for (const label of ['1st Sunday', '2nd Sunday', '3rd Sunday', '4th Sunday', '5th Sunday']) {
      const btn = wrapper.findAll('button').find((b) => b.text() === label)!
      expect(btn.attributes('aria-pressed')).toBe('false')
    }
  })

  it('R254: toggling ordinals and clicking Save calls updateTeam with the sorted selection', async () => {
    const wrapper = mountPanel()
    const chevron = wrapper.find('[aria-label="Edit recurring schedule for Orchestra"]')
    await chevron.trigger('click')

    const fourthSunday = wrapper.findAll('button').find((b) => b.text() === '4th Sunday')!
    const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
    await fourthSunday.trigger('click')
    await secondSunday.trigger('click')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledWith('t-2', { recurrence: { ordinals: [2, 4] } })
  })

  it('R254: clearing to none then Save persists an empty ordinals array', async () => {
    const wrapper = mountPanel()
    const chevron = wrapper.find('[aria-label="Edit recurring schedule for Choir"]')
    await chevron.trigger('click')

    const clearButton = wrapper.findAll('button').find((b) => b.text() === 'Clear selection')!
    await clearButton.trigger('click')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { recurrence: { ordinals: [] } })
  })

  it('WR-02: a duplicate ordinal from a direct Firestore edit is de-duplicated on open, so one click fully deselects it, and Save persists no duplicate', async () => {
    mockTeams = [
      { id: 't-1', name: 'Choir', order: 0, recurrence: { ordinals: [1, 1, 3] } },
      { id: 't-2', name: 'Orchestra', order: 1 },
    ]
    const wrapper = mountPanel()
    const chevron = wrapper.find('[aria-label="Edit recurring schedule for Choir"]')
    await chevron.trigger('click')

    const firstSunday = wrapper.findAll('button').find((b) => b.text() === '1st Sunday')!
    // Read-side dedupe: starts pressed (the duplicate collapsed to one entry).
    expect(firstSunday.attributes('aria-pressed')).toBe('true')

    // A single click fully deselects it — with the pre-fix undeduped seed,
    // toggleOrdinal's indexOf/splice would only remove ONE copy, leaving the
    // button stuck showing as pressed.
    await firstSunday.trigger('click')
    expect(firstSunday.attributes('aria-pressed')).toBe('false')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')
    await Promise.resolve()

    // Write-side dedupe: persists exactly [3], never [1, 3] or a stray duplicate.
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { recurrence: { ordinals: [3] } })
  })
})
