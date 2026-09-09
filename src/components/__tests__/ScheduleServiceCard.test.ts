import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleServiceCard from '@/components/ScheduleServiceCard.vue'

// R429-R433 (Phase 139) — closes the ScheduleServiceCard.vue:40-41 "Service has
// no time-of-day/venue field yet" TODO. See 139-02-PLAN.md Task 2 <behavior>.

// Same router-link stub pattern as ServiceCard.test.ts — this component's own
// "Rehearse →" link is irrelevant to the times behavior under test.
const globalStubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}

const BASE = {
  serviceId: 'service-1',
  title: 'Sunday Gathering',
  serviceDate: '2026-09-13',
  songs: [],
  roles: [],
  isNextUp: false,
  isPast: false,
}

describe('ScheduleServiceCard — report/rehearsal times (R429-R433)', () => {
  it('renders the formatted report time and rehearsal time when both are given', () => {
    const w = mount(ScheduleServiceCard, {
      global: { stubs: globalStubs },
      props: {
        ...BASE,
        reportTime: '08:00',
        rehearsals: [{ id: 'r1', date: '2026-09-11', time: '19:00' }],
      },
    })
    expect(w.text()).toContain('8:00 AM')
    expect(w.text()).toContain('7:00 PM')
  })

  it('renders neither a report-time nor a rehearsal line when both are absent', () => {
    const w = mount(ScheduleServiceCard, {
      global: { stubs: globalStubs },
      props: { ...BASE, reportTime: undefined, rehearsals: [] },
    })
    expect(w.find('[data-testid="schedule-card-times"]').exists()).toBe(false)
  })
})
