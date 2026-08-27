import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamSlideOver from '../TeamSlideOver.vue'
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

const mockToastPush = vi.fn()
vi.mock('@/stores/toasts', () => ({
  useToasts: () => ({
    push: mockToastPush,
  }),
}))

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 't-1',
    name: 'Choir',
    order: 0,
    ...overrides,
  }
}

// Mirrors SongSlideOver.test.ts's mount pattern: mount closed, then flip open
// so the watch(() => props.open, ...) seed runs from a false->true transition.
async function mountDrawer(team: Team | null) {
  const wrapper = mount(TeamSlideOver, {
    props: { open: false, team },
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
  await wrapper.setProps({ open: true })
  return wrapper
}

function saveButton(wrapper: Awaited<ReturnType<typeof mountDrawer>>) {
  return wrapper.findAll('button').find((b) => b.text() === 'Save' || b.text() === 'Saving...')!
}

beforeEach(() => {
  mockAddTeam.mockClear()
  mockUpdateTeam.mockClear()
  mockDeleteTeam.mockClear()
  mockToastPush.mockClear()
  mockTeams = [
    makeTeam({ id: 't-1', name: 'Choir', order: 0, recurrence: { ordinals: [1, 3] } }),
    makeTeam({ id: 't-2', name: 'Orchestra', order: 1 }),
  ]
})

describe('TeamSlideOver', () => {
  it('open=false renders nothing', () => {
    const wrapper = mount(TeamSlideOver, {
      props: { open: false, team: null },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    expect(wrapper.find('[data-testid="team-name-input"]').exists()).toBe(false)
  })

  it('create mode: filling name and Save calls addTeam with order and recurrence only when ordinals selected, then emits saved', async () => {
    const wrapper = await mountDrawer(null)
    expect(wrapper.text()).toContain('New Team')

    await wrapper.get('[data-testid="team-name-input"]').setValue('Kids Team')
    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockAddTeam).toHaveBeenCalledWith({ name: 'Kids Team', order: 2 })
    expect(wrapper.emitted('saved')).toBeTruthy()
  })

  it('create mode: selecting ordinals includes recurrence in the addTeam payload', async () => {
    const wrapper = await mountDrawer(null)
    await wrapper.get('[data-testid="team-name-input"]').setValue('Kids Team')

    const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
    await secondSunday.trigger('click')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockAddTeam).toHaveBeenCalledWith({
      name: 'Kids Team',
      order: 2,
      recurrence: { ordinals: [2] },
    })
  })

  it('edit mode: name prefills and ordinals pre-select from team.recurrence.ordinals', async () => {
    const wrapper = await mountDrawer(makeTeam({ recurrence: { ordinals: [1, 3] } }))
    expect(wrapper.text()).toContain('Edit Team')
    expect((wrapper.get('[data-testid="team-name-input"]').element as HTMLInputElement).value).toBe('Choir')

    const firstSunday = wrapper.findAll('button').find((b) => b.text() === '1st Sunday')!
    const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
    const thirdSunday = wrapper.findAll('button').find((b) => b.text() === '3rd Sunday')!
    expect(firstSunday.attributes('aria-pressed')).toBe('true')
    expect(secondSunday.attributes('aria-pressed')).toBe('false')
    expect(thirdSunday.attributes('aria-pressed')).toBe('true')
  })

  it('a team with no recurrence starts with no ordinals selected', async () => {
    const wrapper = await mountDrawer(makeTeam({ id: 't-2', name: 'Orchestra' }))
    for (const label of ['1st Sunday', '2nd Sunday', '3rd Sunday', '4th Sunday', '5th Sunday']) {
      const btn = wrapper.findAll('button').find((b) => b.text() === label)!
      expect(btn.attributes('aria-pressed')).toBe('false')
    }
  })

  it('Clear selection empties ordinals and Save persists an empty array', async () => {
    const wrapper = await mountDrawer(makeTeam({ recurrence: { ordinals: [1, 3] } }))
    const clearBtn = wrapper.findAll('button').find((b) => b.text() === 'Clear selection')!
    await clearBtn.trigger('click')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir', recurrence: { ordinals: [] } })
  })

  it('toggling ordinals (edit mode, unchanged name) writes on the first Save with sorted ordinals', async () => {
    const wrapper = await mountDrawer(makeTeam({ id: 't-2', name: 'Orchestra' }))
    const fourthSunday = wrapper.findAll('button').find((b) => b.text() === '4th Sunday')!
    const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
    await fourthSunday.trigger('click')
    await secondSunday.trigger('click')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledTimes(1)
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-2', { name: 'Orchestra', recurrence: { ordinals: [2, 4] } })
  })

  it('write-side invariant: an unsorted + duplicate ordinal seed (e.g. from a direct Firestore edit) persists SORTED and DEDUPED on Save with no further toggles', async () => {
    // recurrence.ordinals is an un-validated number[] on the Firestore doc —
    // seed it unsorted with a duplicate and Save immediately (no toggles) to
    // guard both the read-side seed and the write-side dedupe/sort together.
    const wrapper = await mountDrawer(makeTeam({ id: 't-2', name: 'Orchestra', recurrence: { ordinals: [4, 1, 4, 3] } }))

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledWith('t-2', { name: 'Orchestra', recurrence: { ordinals: [1, 3, 4] } })
  })

  it('write-side dedupe: a duplicate ordinal seeded from a direct Firestore edit collapses to one on read and persists without a duplicate', async () => {
    const wrapper = await mountDrawer(makeTeam({ id: 't-1', name: 'Choir', recurrence: { ordinals: [1, 1, 3] } }))
    const firstSunday = wrapper.findAll('button').find((b) => b.text() === '1st Sunday')!
    // Read-side dedupe: starts pressed (the duplicate collapsed to one entry).
    expect(firstSunday.attributes('aria-pressed')).toBe('true')

    // A single click fully deselects it.
    await firstSunday.trigger('click')
    expect(firstSunday.attributes('aria-pressed')).toBe('false')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir', recurrence: { ordinals: [3] } })
  })

  it('duplicate-name guard: saving a name colliding with another team (case/whitespace-insensitive) is rejected via toast and does not write', async () => {
    const wrapper = await mountDrawer(makeTeam({ id: 't-1', name: 'Choir' }))
    await wrapper.get('[data-testid="team-name-input"]').setValue('  orchestra  ')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).not.toHaveBeenCalled()
    expect(mockToastPush).toHaveBeenCalledWith(expect.stringContaining('already exists'))
  })

  it('duplicate-name guard applies to create mode too', async () => {
    const wrapper = await mountDrawer(null)
    await wrapper.get('[data-testid="team-name-input"]').setValue(' CHOIR ')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockAddTeam).not.toHaveBeenCalled()
    expect(mockToastPush).toHaveBeenCalledWith(expect.stringContaining('already exists'))
  })

  it('WR-02 rename soft-warn: first Save on a changed name surfaces confirm and does NOT write; second confirming Save commits updateTeam', async () => {
    const wrapper = await mountDrawer(makeTeam({ id: 't-1', name: 'Choir' }))
    await wrapper.get('[data-testid="team-name-input"]').setValue('Choir Renamed')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("Rename the 'Choir' team to 'Choir Renamed'?")

    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Rename anyway')!
    await confirmBtn.trigger('click')
    await Promise.resolve()

    expect(mockUpdateTeam).toHaveBeenCalledTimes(1)
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir Renamed', recurrence: { ordinals: [] } })
  })

  it('WR-02: a recurrence-only edit (unchanged name) writes on the first Save without the rename confirm', async () => {
    const wrapper = await mountDrawer(makeTeam({ id: 't-1', name: 'Choir', recurrence: { ordinals: [1, 3] } }))
    const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
    await secondSunday.trigger('click')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(wrapper.text()).not.toContain('Rename the')
    expect(mockUpdateTeam).toHaveBeenCalledTimes(1)
    expect(mockUpdateTeam).toHaveBeenCalledWith('t-1', { name: 'Choir', recurrence: { ordinals: [1, 2, 3] } })
  })

  it('WR-02: not triggered on create mode', async () => {
    const wrapper = await mountDrawer(null)
    await wrapper.get('[data-testid="team-name-input"]').setValue('New Team')

    await saveButton(wrapper).trigger('click')
    await Promise.resolve()

    expect(mockAddTeam).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('Rename the')
  })

  it('delete (edit mode only): confirm names the team; confirming calls deleteTeam and emits deleted', async () => {
    const wrapper = await mountDrawer(makeTeam())
    const deleteLink = wrapper.findAll('button').find((b) => b.text() === 'Delete Team')!
    await deleteLink.trigger('click')

    expect(wrapper.text()).toContain("Delete the 'Choir' team?")
    expect(mockDeleteTeam).not.toHaveBeenCalled()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete Team')!
    await confirmBtn.trigger('click')
    await Promise.resolve()

    expect(mockDeleteTeam).toHaveBeenCalledWith('t-1')
    expect(wrapper.emitted('deleted')).toBeTruthy()
  })

  it('create mode has no Delete button', async () => {
    const wrapper = await mountDrawer(null)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Delete Team')).toBe(false)
  })

  it('Cancel/close emits close without saving', async () => {
    const wrapper = await mountDrawer(makeTeam())
    const closeBtn = wrapper.find('[aria-label="Close"]')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(mockUpdateTeam).not.toHaveBeenCalled()
  })

  // IN-01 (Phase 88 review fix): mirrors SongSlideOver.vue's useUnsavedGuard
  // wiring — a dirty form must prompt before discarding, a clean one must not.
  describe('unsaved-changes guard (IN-01)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('with an unsaved name edit, the × button prompts, and cancelling the prompt keeps the drawer open', async () => {
      const wrapper = await mountDrawer(makeTeam())
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      await wrapper.get('[data-testid="team-name-input"]').setValue('Choir Renamed')
      await wrapper.find('[aria-label="Close"]').trigger('click')

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('with an unsaved name edit, confirming the prompt lets the × button close the drawer', async () => {
      const wrapper = await mountDrawer(makeTeam())
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      await wrapper.get('[data-testid="team-name-input"]').setValue('Choir Renamed')
      await wrapper.find('[aria-label="Close"]').trigger('click')

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('an unsaved ordinal toggle (name unchanged) also prompts on close', async () => {
      const wrapper = await mountDrawer(makeTeam({ id: 't-2', name: 'Orchestra' }))
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      const secondSunday = wrapper.findAll('button').find((b) => b.text() === '2nd Sunday')!
      await secondSunday.trigger('click')
      await wrapper.find('[aria-label="Close"]').trigger('click')

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('with no unsaved edits, closing never calls window.confirm at all', async () => {
      const wrapper = await mountDrawer(makeTeam())
      const confirmSpy = vi.spyOn(window, 'confirm')

      await wrapper.find('[aria-label="Close"]').trigger('click')

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })
})
