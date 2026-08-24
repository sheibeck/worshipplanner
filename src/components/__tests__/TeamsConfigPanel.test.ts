import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamsConfigPanel from '../TeamsConfigPanel.vue'
import type { Team } from '@/types/team'

const mockAddTeam = vi.fn(() => Promise.resolve('new-id'))
const mockUpdateTeam = vi.fn(() => Promise.resolve())
const mockDeleteTeam = vi.fn(() => Promise.resolve())

let mockTeams: Team[] = []
let mockAllUserTags: string[] = []

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    teams: mockTeams,
    addTeam: mockAddTeam,
    updateTeam: mockUpdateTeam,
    deleteTeam: mockDeleteTeam,
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    allUserTags: mockAllUserTags,
  }),
}))

function mountPanel() {
  return mount(TeamsConfigPanel)
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockAddTeam.mockClear()
  mockUpdateTeam.mockClear()
  mockDeleteTeam.mockClear()
  mockTeams = [
    { id: 't-1', name: 'Choir', order: 0 },
    { id: 't-2', name: 'Orchestra', order: 1, songFilterTag: 'Orchestra' },
  ]
  mockAllUserTags = ['Orchestra', 'Christmas']
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

  it('song-tag select shows "No filter" + one option per allUserTags entry and reflects the team songFilterTag', () => {
    const wrapper = mountPanel()
    const selects = wrapper.findAll('select')
    // 2 team rows + 1 add-row select
    expect(selects.length).toBe(3)
    const orchestraSelect = selects[1]!
    const options = orchestraSelect.findAll('option').map((o) => o.text())
    expect(options).toEqual(['No filter', 'Orchestra', 'Christmas'])
    expect((orchestraSelect.element as HTMLSelectElement).value).toBe('Orchestra')

    const choirSelect = selects[0]!
    expect((choirSelect.element as HTMLSelectElement).value).toBe('')
  })

  it('the song-tag select still renders (only "No filter") and is never disabled when there are zero song tags', () => {
    mockAllUserTags = []
    const wrapper = mountPanel()
    const firstSelect = wrapper.findAll('select')[0]!
    expect(firstSelect.findAll('option').map((o) => o.text())).toEqual(['No filter'])
    expect(firstSelect.attributes('disabled')).toBeUndefined()
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
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir Renamed', songFilterTag: '' })
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

  it('WR-02: saving a song-tag-only edit (no name change) does not require rename confirmation', async () => {
    const wrapper = mountPanel()
    const select = wrapper.find('select[aria-label="Song-tag filter for Choir"]')
    await select.setValue('Christmas')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team')
    await saveButtons[0]!.trigger('click')

    expect(mockUpdateTeam).toHaveBeenCalledTimes(1)
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir', songFilterTag: 'Christmas' })
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

  it('Add-Team row calls addTeam with name/order/songFilterTag and clears the inputs afterward', async () => {
    const wrapper = mountPanel()
    const addNameInput = wrapper.find('input[aria-label="New team name"]')
    await addNameInput.setValue('Kids Team')

    const addSelect = wrapper.find('select[aria-label="Song-tag filter for new team"]')
    await addSelect.setValue('Christmas')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text() === 'Save Team' || b.text() === 'Added ✓')
    const addButton = saveButtons[saveButtons.length - 1]!
    await addButton.trigger('click')

    expect(mockAddTeam).toHaveBeenCalledWith({ name: 'Kids Team', order: 2, songFilterTag: 'Christmas' })
    expect((addNameInput.element as HTMLInputElement).value).toBe('')
  })

  it('every team name input and song-tag select has a non-empty aria-label', () => {
    const wrapper = mountPanel()
    wrapper.findAll('input[type="text"]').forEach((input) => {
      expect(input.attributes('aria-label')).toBeTruthy()
    })
    wrapper.findAll('select').forEach((select) => {
      expect(select.attributes('aria-label')).toBeTruthy()
    })
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
})
