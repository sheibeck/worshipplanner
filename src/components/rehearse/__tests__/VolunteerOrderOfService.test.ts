import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VolunteerOrderOfService from '../VolunteerOrderOfService.vue'
import type { ServiceSlot } from '@/types/service'
import type { RehearseRoleAssignment } from '@/utils/rehearseAccess'

describe('VolunteerOrderOfService', () => {
  it('renders the empty-order copy when orderOfService is empty', () => {
    const wrapper = mount(VolunteerOrderOfService, {
      props: { orderOfService: [], roleAssignments: [] },
    })
    expect(wrapper.text()).toContain("This service's order hasn't been built yet.")
  })

  it('renders a SONG slot title + key', () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's1', kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Way Maker', songKey: 'Bb' },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('Way Maker')
    expect(wrapper.text()).toContain('Key: Bb')
  })

  it("renders '[not assigned]' for a SONG slot with no songId", () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's1', kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('[not assigned]')
  })

  it('renders a SCRIPTURE slot reference', () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's2', kind: 'SCRIPTURE', position: 1, book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('Scripture Reading')
    expect(wrapper.text()).toContain('John 3:16-17')
  })

  it("renders '[not assigned]' for a SCRIPTURE slot missing fields", () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's2', kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('[not assigned]')
  })

  it('renders a HYMN slot name, number, and verses', () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's3', kind: 'HYMN', position: 2, hymnName: 'Amazing Grace', hymnNumber: '42', verses: '1,2,4' },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('Amazing Grace')
    expect(wrapper.text()).toContain('#42')
    expect(wrapper.text()).toContain('vv. 1,2,4')
  })

  it('renders PRAYER, MESSAGE, and ANNOUNCEMENTS labels', () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's4', kind: 'PRAYER', position: 3 },
      { id: 's5', kind: 'MESSAGE', position: 4 },
      { id: 's6', kind: 'ANNOUNCEMENTS', position: 5 },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('Prayer')
    expect(wrapper.text()).toContain('Message')
    expect(wrapper.text()).toContain('Announcements')
  })

  it('renders a MISC slot with a custom label, falling back to Miscellaneous', () => {
    const orderOfService: ServiceSlot[] = [
      { id: 's7', kind: 'MISC', position: 6, label: 'Offering' },
      { id: 's8', kind: 'MISC', position: 7 },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).toContain('Offering')
    expect(wrapper.text()).toContain('Miscellaneous')
  })

  it("renders the Who's Serving card from roleAssignments, with '[not assigned]' for an empty role", () => {
    const roleAssignments: RehearseRoleAssignment[] = [
      { roleId: 'r1', roleName: 'Sound', group: 'tech', personNames: ['Jamie Lee'] },
      { roleId: 'r2', roleName: 'Vocals', group: 'band', personNames: [] },
    ]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService: [], roleAssignments } })
    expect(wrapper.text()).toContain("Who's Serving")
    expect(wrapper.text()).toContain('Sound')
    expect(wrapper.text()).toContain('Jamie Lee')
    expect(wrapper.text()).toContain('Vocals')
    expect(wrapper.text()).toContain('[not assigned]')
  })

  it('never renders a stray notes/body field even if a fixture tries to smuggle one', () => {
    const orderOfService = [
      {
        id: 's9',
        kind: 'MESSAGE',
        position: 0,
        // Stray free-text field a corrupt/legacy fixture might carry — the
        // component reads no such field (R346/SEC-S-04 discipline).
        notes: 'SECRET-LEADER-NOTE-DO-NOT-SHOW',
        body: 'SECRET-BODY-DO-NOT-SHOW',
      },
    ] as unknown as ServiceSlot[]
    const wrapper = mount(VolunteerOrderOfService, { props: { orderOfService, roleAssignments: [] } })
    expect(wrapper.text()).not.toContain('SECRET-LEADER-NOTE-DO-NOT-SHOW')
    expect(wrapper.text()).not.toContain('SECRET-BODY-DO-NOT-SHOW')
  })
})
