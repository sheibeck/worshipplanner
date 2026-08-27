import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScriptureRotationTable from '../ScriptureRotationTable.vue'
import type { Service, ScriptureSlot, ScriptureRef } from '@/types/service'

function makeService(overrides: {
  id: string
  date: string
  scriptureSlots?: Array<{ book: string; chapter: number; verseStart?: number | null; verseEnd?: number | null }>
  sermonPassage?: ScriptureRef | null
}): Service {
  const { id, date, scriptureSlots = [], sermonPassage = null } = overrides

  const slots: Service['slots'] = scriptureSlots.map((s, i) => ({
    kind: 'SCRIPTURE',
    position: i,
    book: s.book,
    chapter: s.chapter,
    verseStart: s.verseStart ?? null,
    verseEnd: s.verseEnd ?? null,
  } as ScriptureSlot))

  return {
    id,
    date,
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'planned',
    slots,
    sermonPassage,
    notes: '',
    createdAt: { toMillis: () => 0 } as never,
    updatedAt: { toMillis: () => 0 } as never,
  }
}

function mountTable(services: Service[]) {
  return mount(ScriptureRotationTable, { props: { services } })
}

describe('ScriptureRotationTable — sermon exclusion (R253)', () => {
  it('R253: excludes the sermon passage from rotation rows while including SCRIPTURE slots', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        scriptureSlots: [{ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }],
        sermonPassage: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 28 },
      }),
    ]
    const wrapper = mountTable(services)

    expect(wrapper.text()).toContain('John 3:16')
    expect(wrapper.text()).not.toContain('Romans 8:28')
  })

  it('shows the empty state when a service has only a sermon passage and no SCRIPTURE slots', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        scriptureSlots: [],
        sermonPassage: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 28 },
      }),
    ]
    const wrapper = mountTable(services)

    expect(wrapper.text()).not.toContain('Romans 8:28')
    expect(wrapper.text()).toContain('No scripture passages found in these services.')
    expect(wrapper.text()).not.toContain('sermon passage')
  })

  it('lists both dates when two services share the same SCRIPTURE passage', () => {
    const services = [
      makeService({
        id: 'svc1',
        date: '2026-03-01',
        scriptureSlots: [{ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }],
      }),
      makeService({
        id: 'svc2',
        date: '2026-03-08',
        scriptureSlots: [{ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }],
      }),
    ]
    const wrapper = mountTable(services)

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(1)
    // Two date columns should each have a filled dot for this passage's row.
    expect(rows[0]!.findAll('span.rounded-full')).toHaveLength(2)
  })
})
