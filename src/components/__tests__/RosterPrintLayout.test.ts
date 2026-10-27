// RosterPrintLayout brand footer (R446).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RosterPrintLayout from '../RosterPrintLayout.vue'
import type { Quarter } from '@/types/roster'
import type { Timestamp } from 'firebase/firestore'

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({ people: [] }),
}))

const mockTimestamp = { toDate: () => new Date('2026-03-04') } as unknown as Timestamp

const quarter: Quarter = {
  id: 'q-1',
  label: 'Q1 2026',
  year: 2026,
  quarter: 1,
  serviceDates: [],
  roleOverridesByDate: {},
  personQuarterData: {},
  calendar: {},
  status: 'draft',
  shareToken: null,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

describe('RosterPrintLayout — brand footer (R446)', () => {
  it('R446: the footer reads Generated from WorshipBuilder', () => {
    const wrapper = mount(RosterPrintLayout, { props: { quarter, roles: [] } })
    expect(wrapper.findAll('p').some((p) => p.text() === 'Generated from WorshipBuilder')).toBe(true)
  })
})
