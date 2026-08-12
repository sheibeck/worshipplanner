import { describe, it, expect } from 'vitest'
import {
  PROGRESSION_SLOT_TYPES,
  buildSlots,
  createSlot,
  reindexSlots,
  slotLabel,
  miscLabel,
  backfillSlotIds,
  groupBySection,
  flattenBySection,
  orderSlotsBySection,
  progressionVwTypeSequence,
  buildSlotsFromTemplate,
  buildSuggestedTemplateEntries,
} from '@/utils/slotTypes'
import { SERVICE_SECTIONS, type SongSlot, type ScriptureSlot, type NonAssignableSlot, type HymnSlot, type ImportedSlot, type Service, type ServiceSlot } from '@/types/service'
import type { ServiceTemplateEntry } from '@/types/organization'

describe('PROGRESSION_SLOT_TYPES', () => {
  it('maps 1-2-2-3 progression correctly', () => {
    const types = PROGRESSION_SLOT_TYPES['1-2-2-3']
    expect(types[0]).toBe(1)
    expect(types[2]).toBe(2)
    expect(types[5]).toBe(2)
    expect(types[6]).toBe(3)
    expect(types[8]).toBe(3)
  })

  it('maps 1-2-3-3 progression correctly', () => {
    const types = PROGRESSION_SLOT_TYPES['1-2-3-3']
    expect(types[0]).toBe(1)
    expect(types[2]).toBe(2)
    expect(types[5]).toBe(3)
    expect(types[6]).toBe(3)
    expect(types[8]).toBe(3)
  })
})

describe('buildSlots', () => {
  it('returns exactly 9 slots for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    expect(slots).toHaveLength(9)
  })

  it('returns nine slots with nine distinct ids (D-01)', () => {
    const slots = buildSlots('1-2-2-3')
    const ids = new Set(slots.map((s) => s.id))
    expect(ids.size).toBe(9)
    for (const slot of slots) {
      expect(typeof slot.id).toBe('string')
      expect(slot.id.length).toBeGreaterThan(0)
    }
  })

  it('returns exactly 9 slots for 1-2-3-3', () => {
    const slots = buildSlots('1-2-3-3')
    expect(slots).toHaveLength(9)
  })

  it('position 0 is SongSlot with requiredVwType 1 for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[0] as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.position).toBe(0)
    expect(slot.requiredVwType).toBe(1)
    expect(slot.songId).toBeNull()
    expect(slot.songTitle).toBeNull()
    expect(slot.songKey).toBeNull()
  })

  it('position 1 is ScriptureSlot for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[1] as ScriptureSlot
    expect(slot.kind).toBe('SCRIPTURE')
    expect(slot.position).toBe(1)
    expect(slot.book).toBeNull()
    expect(slot.chapter).toBeNull()
    expect(slot.verseStart).toBeNull()
    expect(slot.verseEnd).toBeNull()
  })

  it('position 2 is SongSlot with requiredVwType 2 for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[2] as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.position).toBe(2)
    expect(slot.requiredVwType).toBe(2)
  })

  it('position 3 is Prayer NonAssignableSlot for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[3] as NonAssignableSlot
    expect(slot.kind).toBe('PRAYER')
    expect(slot.position).toBe(3)
  })

  it('position 4 is ScriptureSlot for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[4] as ScriptureSlot
    expect(slot.kind).toBe('SCRIPTURE')
    expect(slot.position).toBe(4)
  })

  it('position 5 is SongSlot with requiredVwType 2 for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[5] as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.position).toBe(5)
    expect(slot.requiredVwType).toBe(2)
  })

  it('position 6 is SongSlot with requiredVwType 3 for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[6] as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.position).toBe(6)
    expect(slot.requiredVwType).toBe(3)
  })

  it('position 7 is Message NonAssignableSlot for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[7] as NonAssignableSlot
    expect(slot.kind).toBe('MESSAGE')
    expect(slot.position).toBe(7)
  })

  it('position 8 is SongSlot with requiredVwType 3 for 1-2-2-3', () => {
    const slots = buildSlots('1-2-2-3')
    const slot = slots[8] as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.position).toBe(8)
    expect(slot.requiredVwType).toBe(3)
  })

  it('1-2-3-3 progression: song positions get types 1,2,3,3,3', () => {
    const slots = buildSlots('1-2-3-3')
    expect((slots[0] as SongSlot).requiredVwType).toBe(1)
    expect((slots[2] as SongSlot).requiredVwType).toBe(2)
    expect((slots[5] as SongSlot).requiredVwType).toBe(3)
    expect((slots[6] as SongSlot).requiredVwType).toBe(3)
    expect((slots[8] as SongSlot).requiredVwType).toBe(3)
  })

  it('all SongSlots initialize with null fields', () => {
    const slots = buildSlots('1-2-3-3')
    const songSlots = slots.filter((s) => s.kind === 'SONG') as SongSlot[]
    for (const slot of songSlots) {
      expect(slot.songId).toBeNull()
      expect(slot.songTitle).toBeNull()
      expect(slot.songKey).toBeNull()
    }
  })

  it('all ScriptureSlots initialize with null fields', () => {
    const slots = buildSlots('1-2-3-3')
    const scriptureSlots = slots.filter((s) => s.kind === 'SCRIPTURE') as ScriptureSlot[]
    for (const slot of scriptureSlots) {
      expect(slot.book).toBeNull()
      expect(slot.chapter).toBeNull()
      expect(slot.verseStart).toBeNull()
      expect(slot.verseEnd).toBeNull()
    }
  })
})

describe('createSlot', () => {
  it('creates a SONG slot with default vwType 2', () => {
    const slot = createSlot('SONG') as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.requiredVwType).toBe(2)
    expect(slot.position).toBe(0)
    expect(slot.songId).toBeNull()
    expect(slot.songTitle).toBeNull()
    expect(slot.songKey).toBeNull()
  })

  it('id is a non-empty string, and two calls return different ids (D-01)', () => {
    const a = createSlot('SONG')
    const b = createSlot('SONG')
    expect(typeof a.id).toBe('string')
    expect(a.id.length).toBeGreaterThan(0)
    expect(a.id).not.toBe(b.id)
  })

  it('creates a SONG slot with specified vwType 1', () => {
    const slot = createSlot('SONG', 1) as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.requiredVwType).toBe(1)
  })

  it('creates a SONG slot with specified vwType 3', () => {
    const slot = createSlot('SONG', 3) as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.requiredVwType).toBe(3)
  })

  it('creates a SCRIPTURE slot with null fields', () => {
    const slot = createSlot('SCRIPTURE') as ScriptureSlot
    expect(slot.kind).toBe('SCRIPTURE')
    expect(slot.position).toBe(0)
    expect(slot.book).toBeNull()
    expect(slot.chapter).toBeNull()
    expect(slot.verseStart).toBeNull()
    expect(slot.verseEnd).toBeNull()
  })

  it('creates a PRAYER slot', () => {
    const slot = createSlot('PRAYER') as NonAssignableSlot
    expect(slot.kind).toBe('PRAYER')
    expect(slot.position).toBe(0)
  })

  it('creates a MESSAGE slot', () => {
    const slot = createSlot('MESSAGE') as NonAssignableSlot
    expect(slot.kind).toBe('MESSAGE')
    expect(slot.position).toBe(0)
  })

  it('creates an IMPORTED slot with importId null and position 0', () => {
    const slot = createSlot('IMPORTED') as ImportedSlot
    expect(slot.kind).toBe('IMPORTED')
    expect(slot.position).toBe(0)
    expect(slot.importId).toBeNull()
  })

  it('creates an IMPORTED slot with a section when passed', () => {
    const slot = createSlot('IMPORTED', undefined, 'pre-service') as ImportedSlot
    expect(slot.kind).toBe('IMPORTED')
    expect(slot.section).toBe('pre-service')
  })

  it('creates an IMPORTED slot omitting the section key when no section is passed', () => {
    const slot = createSlot('IMPORTED') as ImportedSlot
    expect(slot.section).toBeUndefined()
    expect('section' in slot).toBe(false)
  })
})

describe('reindexSlots', () => {
  it('normalizes positions to match array index', () => {
    const slots = [
      { kind: 'SONG' as const, id: 's-1', position: 5, requiredVwType: 1 as const, songId: null, songTitle: null, songKey: null },
      { kind: 'PRAYER' as const, id: 's-2', position: 2 },
      { kind: 'MESSAGE' as const, id: 's-3', position: 8 },
    ]
    const reindexed = reindexSlots(slots)
    expect(reindexed[0]!.position).toBe(0)
    expect(reindexed[1]!.position).toBe(1)
    expect(reindexed[2]!.position).toBe(2)
  })

  it('preserves slot data when reindexing', () => {
    const slots = [
      { kind: 'SONG' as const, id: 's-1', position: 99, requiredVwType: 2 as const, songId: 'abc', songTitle: 'Test', songKey: 'G' },
    ]
    const reindexed = reindexSlots(slots)
    const slot = reindexed[0]! as SongSlot
    expect(slot.position).toBe(0)
    expect(slot.songId).toBe('abc')
    expect(slot.songTitle).toBe('Test')
    expect(slot.songKey).toBe('G')
  })

  it('returns a new array (does not mutate original)', () => {
    const slots = [{ kind: 'PRAYER' as const, id: 's-1', position: 5 }]
    const reindexed = reindexSlots(slots)
    expect(reindexed).not.toBe(slots)
    expect(slots[0]!.position).toBe(5) // original unchanged
  })

  it('preserves id through a reorder (D-01)', () => {
    const slots = [
      { kind: 'SONG' as const, id: 'id-a', position: 2, requiredVwType: 1 as const, songId: null, songTitle: null, songKey: null },
      { kind: 'PRAYER' as const, id: 'id-b', position: 0 },
      { kind: 'MESSAGE' as const, id: 'id-c', position: 1 },
    ]
    const reindexed = reindexSlots(slots)
    expect(reindexed[0]!.id).toBe('id-a')
    expect(reindexed[1]!.id).toBe('id-b')
    expect(reindexed[2]!.id).toBe('id-c')
  })
})

describe('slotLabel', () => {
  it('returns "Song" for a SONG slot', () => {
    const slot: SongSlot = { kind: 'SONG', id: 's-1', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null }
    expect(slotLabel(slot, 0)).toBe('Song')
  })

  it('returns "Scripture Reading" for a SCRIPTURE slot', () => {
    const slot: ScriptureSlot = { kind: 'SCRIPTURE', id: 's-2', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null }
    expect(slotLabel(slot, 1)).toBe('Scripture Reading')
  })

  it('returns "Prayer" for a PRAYER slot', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', id: 's-3', position: 3 }
    expect(slotLabel(slot, 3)).toBe('Prayer')
  })

  it('returns "Message" for a MESSAGE slot', () => {
    const slot: NonAssignableSlot = { kind: 'MESSAGE', id: 's-4', position: 7 }
    expect(slotLabel(slot, 7)).toBe('Message')
  })

  it('returns "Hymn" for a HYMN slot', () => {
    const slot: HymnSlot = { kind: 'HYMN', id: 's-5', position: 4, hymnName: '', hymnNumber: '', verses: '' }
    expect(slotLabel(slot, 4)).toBe('Hymn')
  })

  it('returns "Imported Slides" for an IMPORTED slot', () => {
    const slot: ImportedSlot = { kind: 'IMPORTED', id: 's-6', position: 0, importId: null }
    expect(slotLabel(slot, 0)).toBe('Imported Slides')
  })
})

describe('createSlot - HYMN', () => {
  it('creates a HYMN slot with empty string fields', () => {
    const slot = createSlot('HYMN') as HymnSlot
    expect(slot.kind).toBe('HYMN')
    expect(slot.position).toBe(0)
    expect(slot.hymnName).toBe('')
    expect(slot.hymnNumber).toBe('')
    expect(slot.verses).toBe('')
  })
})

describe('buildSlots — default section assignment (D005)', () => {
  it('1-2-2-3: indices 0-6 are worship, index 7 is message, index 8 is sending', () => {
    const slots = buildSlots('1-2-2-3')
    for (let i = 0; i <= 6; i++) {
      expect(slots[i]!.section).toBe('worship')
    }
    expect(slots[7]!.section).toBe('message')
    expect(slots[8]!.section).toBe('sending')
  })

  it('1-2-3-3: indices 0-6 are worship, index 7 is message, index 8 is sending', () => {
    const slots = buildSlots('1-2-3-3')
    for (let i = 0; i <= 6; i++) {
      expect(slots[i]!.section).toBe('worship')
    }
    expect(slots[7]!.section).toBe('message')
    expect(slots[8]!.section).toBe('sending')
  })
})

describe('buildSlots section defaults', () => {
  // Pins defaultSectionForPosition (audited Phase 29 plan 02: purely
  // position-keyed, no SERVICE_SECTIONS.length arithmetic, no "last section"
  // derivation) so widening SERVICE_SECTIONS (Phase 29 adds Post-Service)
  // cannot silently change which default section a template slot gets.
  it.each(['1-2-2-3', '1-2-3-3'] as const)(
    '%s: positions 0-6 are worship, position 7 is message, position 8 is sending, and no slot is section-less',
    (progression) => {
      const slots = buildSlots(progression)
      for (let i = 0; i <= 6; i++) {
        expect(slots[i]!.section).toBe('worship')
      }
      expect(slots[7]!.section).toBe('message')
      expect(slots[8]!.section).toBe('sending')
      for (const slot of slots) {
        expect(slot.section).not.toBeUndefined()
      }
    },
  )

  it('produces no slot in the first SERVICE_SECTIONS member (the template has no default Pre-Service slot by design)', () => {
    const slots = buildSlots('1-2-2-3')
    const firstSection = SERVICE_SECTIONS[0]
    expect(slots.some((s) => s.section === firstSection)).toBe(false)
  })
})

describe('createSlot — section parameter', () => {
  it('createSlot(SONG, 2, sending) returns a SongSlot with section === sending', () => {
    const slot = createSlot('SONG', 2, 'sending') as SongSlot
    expect(slot.kind).toBe('SONG')
    expect(slot.section).toBe('sending')
  })

  it('createSlot(PRAYER) with no section arg has section === undefined (backward-compatible)', () => {
    const slot = createSlot('PRAYER') as NonAssignableSlot
    expect(slot.section).toBeUndefined()
  })
})

describe('reindexSlots — preserves section', () => {
  it('preserves each slot section unchanged, only rewrites position', () => {
    const slots = [
      { kind: 'SONG' as const, id: 's-1', position: 5, requiredVwType: 1 as const, songId: null, songTitle: null, songKey: null, section: 'sending' as const },
      { kind: 'PRAYER' as const, id: 's-2', position: 2 },
      { kind: 'MESSAGE' as const, id: 's-3', position: 8, section: 'message' as const },
    ]
    const reindexed = reindexSlots(slots)
    expect(reindexed[0]!.position).toBe(0)
    expect(reindexed[0]!.section).toBe('sending')
    expect(reindexed[1]!.position).toBe(1)
    expect(reindexed[1]!.section).toBeUndefined()
    expect(reindexed[2]!.position).toBe(2)
    expect(reindexed[2]!.section).toBe('message')
  })
})

describe('backfillSlotIds', () => {
  function makeService(slots: Service['slots']): Service {
    return {
      id: 'svc-1',
      date: '2026-08-02',
      name: 'Sunday Service',
      progression: '1-2-2-3',
      teams: [],
      status: 'draft',
      slots,
      sermonPassage: null,
      notes: '',
      createdAt: null as unknown as Service['createdAt'],
      updatedAt: null as unknown as Service['updatedAt'],
    }
  }

  it('returns the SAME object reference when every slot already has an id', () => {
    const service = makeService([
      { kind: 'PRAYER', id: 'existing-1', position: 0 },
      { kind: 'MESSAGE', id: 'existing-2', position: 1 },
    ])
    const result = backfillSlotIds(service)
    expect(result).toBe(service)
  })

  it('mints a distinct id for every slot on a service with no ids, leaving other keys byte-identical', () => {
    const service = makeService([
      { kind: 'PRAYER', id: '', position: 0 },
      { kind: 'MESSAGE', id: '', position: 1 },
    ] as unknown as Service['slots'])
    const result = backfillSlotIds(service)
    expect(result).not.toBe(service)
    const ids = result.slots.map((s) => s.id)
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
    expect(result.slots[0]!.kind).toBe('PRAYER')
    expect(result.slots[0]!.position).toBe(0)
    expect(result.slots[1]!.kind).toBe('MESSAGE')
    expect(result.slots[1]!.position).toBe(1)
  })

  it('two-argument form reuses the reference id for a same-kind slot at the same index', () => {
    const remote = makeService([
      { kind: 'PRAYER', id: '', position: 0 },
      { kind: 'MESSAGE', id: '', position: 1 },
    ] as unknown as Service['slots'])
    const local = makeService([
      { kind: 'PRAYER', id: 'local-prayer-id', position: 0 },
      { kind: 'MESSAGE', id: 'local-message-id', position: 1 },
    ])
    const result = backfillSlotIds(remote, local)
    expect(result.slots[0]!.id).toBe('local-prayer-id')
    expect(result.slots[1]!.id).toBe('local-message-id')
  })

  it('mints a fresh id when the reference slot kind differs', () => {
    const remote = makeService([
      { kind: 'MESSAGE', id: '', position: 0 },
    ] as unknown as Service['slots'])
    const local = makeService([
      { kind: 'PRAYER', id: 'local-prayer-id', position: 0 },
    ])
    const result = backfillSlotIds(remote, local)
    expect(result.slots[0]!.id).not.toBe('local-prayer-id')
    expect(result.slots[0]!.id.length).toBeGreaterThan(0)
  })

  it('mints a fresh id when the reference slot is absent (index out of range)', () => {
    const remote = makeService([
      { kind: 'PRAYER', id: '', position: 0 },
    ] as unknown as Service['slots'])
    const local = makeService([])
    const result = backfillSlotIds(remote, local)
    expect(result.slots[0]!.id.length).toBeGreaterThan(0)
  })
})

describe('groupBySection', () => {
  it('groups four sectioned slots in scrambled order into SERVICE_SECTIONS-ordered buckets, preserving within-bucket relative order', () => {
    const slots: ServiceSlot[] = [
      { kind: 'SONG', id: 's-sending', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'sending' },
      { kind: 'PRAYER', id: 's-worship-1', position: 1, section: 'worship' },
      { kind: 'MESSAGE', id: 's-message', position: 2, section: 'message' },
      { kind: 'PRAYER', id: 's-worship-2', position: 3, section: 'worship' },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    expect(grouped.sections['pre-service']).toEqual([])
    expect(grouped.sections['worship'].map((s) => s.id)).toEqual(['s-worship-1', 's-worship-2'])
    expect(grouped.sections['message'].map((s) => s.id)).toEqual(['s-message'])
    expect(grouped.sections['sending'].map((s) => s.id)).toEqual(['s-sending'])
    expect(grouped.legacy).toEqual([])
  })

  it('routes every slot to the trailing legacy bucket, in input order, when all slots lack a section', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 's-1', position: 0 },
      { kind: 'MESSAGE', id: 's-2', position: 1 },
      { kind: 'PRAYER', id: 's-3', position: 2 },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    for (const section of SERVICE_SECTIONS) {
      expect(grouped.sections[section]).toEqual([])
    }
    expect(grouped.legacy.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3'])
  })

  it('mixed input: section-less slots go to the legacy bucket, sectioned slots stay untouched in their own bucket', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 's-legacy-1', position: 0 },
      { kind: 'MESSAGE', id: 's-message', position: 1, section: 'message' },
      { kind: 'PRAYER', id: 's-legacy-2', position: 2 },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    expect(grouped.sections['message'].map((s) => s.id)).toEqual(['s-message'])
    expect(grouped.legacy.map((s) => s.id)).toEqual(['s-legacy-1', 's-legacy-2'])
  })

  it('routes a section value outside SERVICE_SECTIONS to legacy rather than dropping the slot (production-data safety)', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 's-unknown', position: 0, section: 'not-a-real-section' as ServiceSlot['section'] },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    for (const section of SERVICE_SECTIONS) {
      expect(grouped.sections[section]).toEqual([])
    }
    expect(grouped.legacy.map((s) => s.id)).toEqual(['s-unknown'])
  })

  it('buckets a post-service slot under the fifth (last) SERVICE_SECTIONS key, alongside the other four (29-05)', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 's-post', position: 0, section: 'post-service' },
      { kind: 'MESSAGE', id: 's-message', position: 1, section: 'message' },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    expect(grouped.sections['post-service'].map((s) => s.id)).toEqual(['s-post'])
    expect(grouped.sections['message'].map((s) => s.id)).toEqual(['s-message'])
    expect(grouped.legacy).toEqual([])
    // Confirmation-by-test, not rework (PATTERNS.md): groupBySection needed no
    // source change for the fifth member — it iterates SERVICE_SECTIONS.
  })
})

describe('flattenBySection', () => {
  it('concatenates the section buckets in SERVICE_SECTIONS order, then the legacy bucket last', () => {
    const slots: ServiceSlot[] = [
      { kind: 'SONG', id: 's-sending', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'sending' },
      { kind: 'PRAYER', id: 's-legacy', position: 1 },
      { kind: 'MESSAGE', id: 's-message', position: 2, section: 'message' },
      { kind: 'PRAYER', id: 's-worship', position: 3, section: 'worship' },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    const flattened = flattenBySection(grouped)
    expect(flattened.map((s) => s.id)).toEqual(['s-worship', 's-message', 's-sending', 's-legacy'])
  })

  it('every SERVICE_SECTIONS key is present even when empty, and flattening an all-legacy input yields legacy in input order', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 's-1', position: 0 },
      { kind: 'MESSAGE', id: 's-2', position: 1 },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    expect(Object.keys(grouped.sections).sort()).toEqual([...SERVICE_SECTIONS].sort())
    expect(flattenBySection(grouped).map((s) => s.id)).toEqual(['s-1', 's-2'])
  })

  it('flattens a post-service slot after every other named section but before legacy (29-05)', () => {
    const slots: ServiceSlot[] = [
      { kind: 'PRAYER', id: 's-post', position: 0, section: 'post-service' },
      { kind: 'PRAYER', id: 's-legacy', position: 1 },
      { kind: 'MESSAGE', id: 's-message', position: 2, section: 'message' },
      { kind: 'PRAYER', id: 's-worship', position: 3, section: 'worship' },
      { kind: 'SONG', id: 's-sending', position: 4, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'sending' },
    ]
    const grouped = groupBySection(slots, (s) => s.section)
    const flattened = flattenBySection(grouped)
    expect(flattened.map((s) => s.id)).toEqual(['s-worship', 's-message', 's-sending', 's-post', 's-legacy'])
  })
})

describe('orderSlotsBySection', () => {
  it('reorders an interleaved array (worship, sending, worship, message) into section-major order by id', () => {
    const worship1: ServiceSlot = { kind: 'SONG', id: 'w-1', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'worship' }
    const sending1: ServiceSlot = { kind: 'PRAYER', id: 'se-1', position: 1, section: 'sending' }
    const worship2: ServiceSlot = { kind: 'PRAYER', id: 'w-2', position: 2, section: 'worship' }
    const message1: ServiceSlot = { kind: 'MESSAGE', id: 'm-1', position: 3, section: 'message' }
    const input = [worship1, sending1, worship2, message1]

    const result = orderSlotsBySection(input)

    expect(result.map((s) => s.id)).toEqual(['w-1', 'w-2', 'm-1', 'se-1'])
  })

  it('returns the SAME array reference (identity, not a copy) when the input is already section-major', () => {
    const slots: ServiceSlot[] = [
      { kind: 'SONG', id: 'w-1', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'worship' },
      { kind: 'MESSAGE', id: 'm-1', position: 1, section: 'message' },
      { kind: 'PRAYER', id: 'se-1', position: 2, section: 'sending' },
    ]

    const result = orderSlotsBySection(slots)

    expect(result).toBe(slots)
  })

  it('is a total, reference-preserving permutation — never adds, drops, mutates, or re-mints a slot', () => {
    const slotSending: ServiceSlot = { kind: 'SONG', id: 'a', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'sending' }
    const slotWorship1: ServiceSlot = { kind: 'PRAYER', id: 'b', position: 1, section: 'worship' }
    const slotLegacy: ServiceSlot = { kind: 'MESSAGE', id: 'c', position: 2 } // legacy — no section
    const slotMessage: ServiceSlot = { kind: 'PRAYER', id: 'd', position: 3, section: 'message' }
    const slotWorship2: ServiceSlot = { kind: 'SONG', id: 'e', position: 4, requiredVwType: 2, songId: null, songTitle: null, songKey: null, section: 'worship' }
    const slots: ServiceSlot[] = [slotSending, slotWorship1, slotLegacy, slotMessage, slotWorship2]

    const result = orderSlotsBySection(slots)

    // Total: output ids are exactly a permutation of input ids.
    expect(result).toHaveLength(slots.length)
    expect(new Set(result.map((s) => s.id))).toEqual(new Set(slots.map((s) => s.id)))
    expect(result.map((s) => s.id).sort()).toEqual(slots.map((s) => s.id).sort())

    // Reference-preserving: every slot object in the output is the SAME object
    // reference as the corresponding input slot — nothing was cloned or rebuilt.
    for (const slot of slots) {
      expect(result).toContain(slot)
    }

    // Explicit expected section-major sequence, asserted with toBe per-element
    // to prove reference identity at each position (not just membership).
    expect(result[0]).toBe(slotWorship1) // worship
    expect(result[1]).toBe(slotWorship2) // worship
    expect(result[2]).toBe(slotMessage) // message
    expect(result[3]).toBe(slotSending) // sending
    expect(result[4]).toBe(slotLegacy) // legacy, trailing
  })
})

describe('ANNOUNCEMENTS and MISC (43-01)', () => {
  it('createSlot(ANNOUNCEMENTS) returns kind, a non-empty id, position 0, and omits body entirely', () => {
    const slot = createSlot('ANNOUNCEMENTS') as NonAssignableSlot
    expect(slot.kind).toBe('ANNOUNCEMENTS')
    expect(typeof slot.id).toBe('string')
    expect(slot.id.length).toBeGreaterThan(0)
    expect(slot.position).toBe(0)
    // Absent-key assertion, not toBeUndefined() — a key set to undefined and
    // an absent key are indistinguishable to toBeUndefined(), but the whole
    // point of the optional field is that a brand-new slot has the same
    // absent-body shape as every stored legacy PRAYER/MESSAGE slot.
    expect('body' in slot).toBe(false)
  })

  it('createSlot(MISC) returns kind, a non-empty id, position 0, and omits body entirely', () => {
    const slot = createSlot('MISC') as NonAssignableSlot
    expect(slot.kind).toBe('MISC')
    expect(typeof slot.id).toBe('string')
    expect(slot.id.length).toBeGreaterThan(0)
    expect(slot.position).toBe(0)
    expect('body' in slot).toBe(false)
  })

  it('createSlot(MISC, undefined, undefined, body) sets slot.body to the passed text (R116)', () => {
    const slot = createSlot('MISC', undefined, undefined, 'canned music') as NonAssignableSlot
    expect(slot.kind).toBe('MISC')
    expect(slot.body).toBe('canned music')
  })

  it('createSlot(ANNOUNCEMENTS, undefined, undefined, body) sets slot.body to the passed text (R116)', () => {
    const slot = createSlot('ANNOUNCEMENTS', undefined, undefined, 'more announcement slides') as NonAssignableSlot
    expect(slot.kind).toBe('ANNOUNCEMENTS')
    expect(slot.body).toBe('more announcement slides')
  })

  it('createSlot(MISC, undefined, section, body) carries both section and body (R116)', () => {
    const slot = createSlot('MISC', undefined, 'worship', 'pre-service music') as NonAssignableSlot
    expect(slot.section).toBe('worship')
    expect(slot.body).toBe('pre-service music')
  })

  it('two successive createSlot(ANNOUNCEMENTS) calls return different ids', () => {
    const a = createSlot('ANNOUNCEMENTS')
    const b = createSlot('ANNOUNCEMENTS')
    expect(a.id).not.toBe(b.id)
  })

  it('slotLabel returns "Announcements" for ANNOUNCEMENTS and "Miscellaneous" for MISC', () => {
    const announcements: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 's-7', position: 0 }
    const misc: NonAssignableSlot = { kind: 'MISC', id: 's-8', position: 0 }
    expect(slotLabel(announcements)).toBe('Announcements')
    expect(slotLabel(misc)).toBe('Miscellaneous')
  })

  it('the six pre-existing slotLabel values are unchanged', () => {
    const song: SongSlot = { kind: 'SONG', id: 's-1', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null }
    const scripture: ScriptureSlot = { kind: 'SCRIPTURE', id: 's-2', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null }
    const prayer: NonAssignableSlot = { kind: 'PRAYER', id: 's-3', position: 3 }
    const message: NonAssignableSlot = { kind: 'MESSAGE', id: 's-4', position: 7 }
    const hymn: HymnSlot = { kind: 'HYMN', id: 's-5', position: 4, hymnName: '', hymnNumber: '', verses: '' }
    const imported: ImportedSlot = { kind: 'IMPORTED', id: 's-6', position: 0, importId: null }
    expect(slotLabel(song)).toBe('Song')
    expect(slotLabel(scripture)).toBe('Scripture Reading')
    expect(slotLabel(prayer)).toBe('Prayer')
    expect(slotLabel(message)).toBe('Message')
    expect(slotLabel(hymn)).toBe('Hymn')
    expect(slotLabel(imported)).toBe('Imported Slides')
  })

  it('HYMN survives at the type layer: createSlot(HYMN) is unchanged and slotLabel still returns "Hymn" (R084 is palette-only, not a type change)', () => {
    const slot = createSlot('HYMN') as HymnSlot
    expect(slot.kind).toBe('HYMN')
    expect(slot.hymnName).toBe('')
    expect(slot.hymnNumber).toBe('')
    expect(slot.verses).toBe('')
    expect(slotLabel(slot)).toBe('Hymn')
  })

  // E-01/E-05 (adjacency): two adjacent slots of the same new kind, with
  // distinct body values, remain two distinct array entries — nothing merges
  // or dedupes equal-kind neighbours.
  it('E-01: two adjacent ANNOUNCEMENTS slots remain two distinct entries with distinct ids and independent body values after reindexSlots', () => {
    const a: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'ann-a', position: 0, body: 'First announcement' }
    const b: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'ann-b', position: 1, body: 'Second announcement' }
    const slots: ServiceSlot[] = [a, b]

    const reindexed = reindexSlots(slots)

    expect(reindexed).toHaveLength(2)
    expect(reindexed[0]!.id).not.toBe(reindexed[1]!.id)
    expect((reindexed[0] as NonAssignableSlot).body).toBe('First announcement')
    expect((reindexed[1] as NonAssignableSlot).body).toBe('Second announcement')
  })

  it('E-05: two adjacent MISC slots remain two distinct entries with distinct ids and independent body values after reindexSlots', () => {
    const a: NonAssignableSlot = { kind: 'MISC', id: 'misc-a', position: 0, body: 'First misc item' }
    const b: NonAssignableSlot = { kind: 'MISC', id: 'misc-b', position: 1, body: 'Second misc item' }
    const slots: ServiceSlot[] = [a, b]

    const reindexed = reindexSlots(slots)

    expect(reindexed).toHaveLength(2)
    expect(reindexed[0]!.id).not.toBe(reindexed[1]!.id)
    expect((reindexed[0] as NonAssignableSlot).body).toBe('First misc item')
    expect((reindexed[1] as NonAssignableSlot).body).toBe('Second misc item')
  })

  // R127 (Phase 56) — miscLabel: the single "label-or-Miscellaneous" helper.
  describe('miscLabel (R127)', () => {
    it('returns the custom label when set', () => {
      const slot: NonAssignableSlot = { kind: 'MISC', id: 'm-1', position: 0, label: 'Communion' }
      expect(miscLabel(slot)).toBe('Communion')
    })

    it('trims a padded label', () => {
      const slot: NonAssignableSlot = { kind: 'MISC', id: 'm-2', position: 0, label: '  Offering  ' }
      expect(miscLabel(slot)).toBe('Offering')
    })

    it('returns "Miscellaneous" for a whitespace-only label', () => {
      const slot: NonAssignableSlot = { kind: 'MISC', id: 'm-3', position: 0, label: '   ' }
      expect(miscLabel(slot)).toBe('Miscellaneous')
    })

    it('returns "Miscellaneous" for an absent label (today\'s behavior)', () => {
      const slot: NonAssignableSlot = { kind: 'MISC', id: 'm-4', position: 0 }
      expect(miscLabel(slot)).toBe('Miscellaneous')
    })
  })

  // E-03/E-07 (encoding): body survives reindexSlots and orderSlotsBySection
  // byte-for-byte — no trim, no case-fold, no Unicode normalization.
  const ENCODING_PROBE_BODY = '  leading and trailing spaces\nwith an embedded newline, a café (multi-byte) and an emoji 🎉  '

  it('E-03: an ANNOUNCEMENTS body round-trips verbatim through reindexSlots and orderSlotsBySection', () => {
    const slot: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'ann-enc', position: 0, section: 'worship', body: ENCODING_PROBE_BODY }
    const afterReindex = reindexSlots([slot])
    expect((afterReindex[0] as NonAssignableSlot).body).toBe(ENCODING_PROBE_BODY)

    const afterOrder = orderSlotsBySection([slot])
    expect((afterOrder[0] as NonAssignableSlot).body).toBe(ENCODING_PROBE_BODY)
  })

  it('E-07: a MISC body round-trips verbatim through reindexSlots and orderSlotsBySection', () => {
    const slot: NonAssignableSlot = { kind: 'MISC', id: 'misc-enc', position: 0, section: 'worship', body: ENCODING_PROBE_BODY }
    const afterReindex = reindexSlots([slot])
    expect((afterReindex[0] as NonAssignableSlot).body).toBe(ENCODING_PROBE_BODY)

    const afterOrder = orderSlotsBySection([slot])
    expect((afterOrder[0] as NonAssignableSlot).body).toBe(ENCODING_PROBE_BODY)
  })

  // E-04/E-08 (ordering): a slot created with a section carries it, and
  // reindexSlots renumbers position to array index while preserving the
  // relative order of equal-kind neighbours.
  it('E-04: createSlot(ANNOUNCEMENTS, undefined, section) carries the section, and reindexSlots renumbers position while preserving relative order of equal-kind neighbours', () => {
    const slot = createSlot('ANNOUNCEMENTS', undefined, 'sending') as NonAssignableSlot
    expect(slot.section).toBe('sending')

    const first: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'ord-a', position: 9, section: 'worship' }
    const second: NonAssignableSlot = { kind: 'ANNOUNCEMENTS', id: 'ord-b', position: 2, section: 'worship' }
    const reindexed = reindexSlots([first, second])
    expect(reindexed[0]!.position).toBe(0)
    expect(reindexed[0]!.id).toBe('ord-a')
    expect(reindexed[1]!.position).toBe(1)
    expect(reindexed[1]!.id).toBe('ord-b')
  })

  it('E-08: createSlot(MISC, undefined, section) carries the section, and reindexSlots renumbers position while preserving relative order of equal-kind neighbours', () => {
    const slot = createSlot('MISC', undefined, 'pre-service') as NonAssignableSlot
    expect(slot.section).toBe('pre-service')

    const first: NonAssignableSlot = { kind: 'MISC', id: 'ord-c', position: 9, section: 'worship' }
    const second: NonAssignableSlot = { kind: 'MISC', id: 'ord-d', position: 2, section: 'worship' }
    const reindexed = reindexSlots([first, second])
    expect(reindexed[0]!.position).toBe(0)
    expect(reindexed[0]!.id).toBe('ord-c')
    expect(reindexed[1]!.position).toBe(1)
    expect(reindexed[1]!.id).toBe('ord-d')
  })
})

describe('progressionVwTypeSequence (44-01)', () => {
  it("'1-2-2-3' reads PROGRESSION_SLOT_TYPES position-sorted as an ordered sequence: [1, 2, 2, 3, 3]", () => {
    expect(progressionVwTypeSequence('1-2-2-3')).toEqual([1, 2, 2, 3, 3])
  })

  it("'1-2-3-3' reads PROGRESSION_SLOT_TYPES position-sorted as an ordered sequence: [1, 2, 3, 3, 3]", () => {
    expect(progressionVwTypeSequence('1-2-3-3')).toEqual([1, 2, 3, 3, 3])
  })
})

describe('buildSlotsFromTemplate (44-01)', () => {
  function entry(kind: ServiceTemplateEntry['kind'], section?: ServiceTemplateEntry['section']): ServiceTemplateEntry {
    return { id: crypto.randomUUID?.() ?? Math.random().toString(36), kind, ...(section ? { section } : {}) }
  }

  it('empty template → zero slots', () => {
    expect(buildSlotsFromTemplate([], true)).toEqual([])
  })

  it('3 SONG entries with VW on → requiredVwType follows the ORDINAL sequence [1, 2, 2], not array-position lookup', () => {
    const template: ServiceTemplateEntry[] = [entry('SONG'), entry('SONG'), entry('SONG')]
    const slots = buildSlotsFromTemplate(template, true) as SongSlot[]
    expect(slots).toHaveLength(3)
    expect(slots.every((s) => s.kind === 'SONG')).toBe(true)
    expect(slots[0]!.requiredVwType).toBe(1)
    expect(slots[1]!.requiredVwType).toBe(2)
    expect(slots[2]!.requiredVwType).toBe(2)
  })

  it('mixed template (SONG, SCRIPTURE, SONG, PRAYER, SONG) with VW on → only SONG slots consume the sequence, in order; other kinds interleaved at their array positions', () => {
    const template: ServiceTemplateEntry[] = [
      entry('SONG', 'worship'),
      entry('SCRIPTURE', 'worship'),
      entry('SONG', 'worship'),
      entry('PRAYER', 'worship'),
      entry('SONG', 'sending'),
    ]
    const slots = buildSlotsFromTemplate(template, true)
    expect(slots.map((s) => s.kind)).toEqual(['SONG', 'SCRIPTURE', 'SONG', 'PRAYER', 'SONG'])
    const songSlots = slots.filter((s) => s.kind === 'SONG') as SongSlot[]
    expect(songSlots.map((s) => s.requiredVwType)).toEqual([1, 2, 2])
    expect(slots[4]!.section).toBe('sending')
  })

  it('7 SONG entries with VW on → songs 6 and 7 cycle via modulo (sequence[5 % 5]=1, sequence[6 % 5]=2)', () => {
    const template: ServiceTemplateEntry[] = Array.from({ length: 7 }, () => entry('SONG'))
    const slots = buildSlotsFromTemplate(template, true) as SongSlot[]
    expect(slots.map((s) => s.requiredVwType)).toEqual([1, 2, 2, 3, 3, 1, 2])
  })

  it('VW OFF → SONG slots carry createSlot default requiredVwType (2), the ordinal sequence is never consulted', () => {
    const template: ServiceTemplateEntry[] = [entry('SONG'), entry('SONG'), entry('SONG')]
    const slots = buildSlotsFromTemplate(template, false) as SongSlot[]
    expect(slots.every((s) => s.requiredVwType === 2)).toBe(true)
  })

  it('output slots have contiguous positions 0..n-1 (reindexSlots applied), and kind/section preserved', () => {
    const template: ServiceTemplateEntry[] = [entry('PRAYER', 'worship'), entry('MESSAGE', 'message'), entry('SONG', 'sending')]
    const slots = buildSlotsFromTemplate(template, true)
    expect(slots.map((s) => s.position)).toEqual([0, 1, 2])
    expect(slots.map((s) => s.kind)).toEqual(['PRAYER', 'MESSAGE', 'SONG'])
    expect(slots[0]!.section).toBe('worship')
    expect(slots[1]!.section).toBe('message')
    expect(slots[2]!.section).toBe('sending')
  })

  it('an entry whose kind is not a recognized SlotKind is skipped rather than producing an undefined-kind slot (T-44-03)', () => {
    const template = [
      entry('SONG'),
      { id: 'bad-1', kind: 'NOT_A_REAL_KIND' } as unknown as ServiceTemplateEntry,
      entry('PRAYER'),
    ]
    const slots = buildSlotsFromTemplate(template, true)
    expect(slots).toHaveLength(2)
    expect(slots.map((s) => s.kind)).toEqual(['SONG', 'PRAYER'])
    expect(slots.map((s) => s.position)).toEqual([0, 1])
  })

  it('an entry { kind: MISC, body } threads body into the built slot (R116)', () => {
    const template: ServiceTemplateEntry[] = [{ id: 'm-1', kind: 'MISC', body: 'x' }]
    const slots = buildSlotsFromTemplate(template, true)
    expect(slots).toHaveLength(1)
    expect((slots[0] as NonAssignableSlot).body).toBe('x')
  })

  it('an entry { kind: MISC } with no body yields a slot where the body key is absent (R116 — legacy shape preserved)', () => {
    const template: ServiceTemplateEntry[] = [{ id: 'm-2', kind: 'MISC' }]
    const slots = buildSlotsFromTemplate(template, true)
    expect(slots).toHaveLength(1)
    expect('body' in (slots[0] as NonAssignableSlot)).toBe(false)
  })
})

describe('buildSuggestedTemplateEntries (52-01)', () => {
  const SUGGESTED_KINDS = ['SONG', 'SCRIPTURE', 'SONG', 'PRAYER', 'SCRIPTURE', 'SONG', 'SONG', 'MESSAGE', 'SONG']

  it('returns 9 entries whose kinds match the 1-2-2-3-derived suggested order', () => {
    const entries = buildSuggestedTemplateEntries()
    expect(entries).toHaveLength(9)
    expect(entries.map((e) => e.kind)).toEqual(SUGGESTED_KINDS)
  })

  it('every entry has a non-empty string id', () => {
    const entries = buildSuggestedTemplateEntries()
    for (const e of entries) {
      expect(typeof e.id).toBe('string')
      expect(e.id.length).toBeGreaterThan(0)
    }
  })

  it('two successive calls return different ids for the same ordinal position (fresh ids per call)', () => {
    const a = buildSuggestedTemplateEntries()
    const b = buildSuggestedTemplateEntries()
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.id).not.toBe(b[i]!.id)
    }
  })

  it('sections match buildSlots(1-2-2-3) defaults: worship for positions 0-6, message for 7, sending for 8', () => {
    const entries = buildSuggestedTemplateEntries()
    expect(entries.map((e) => e.section)).toEqual([
      'worship',
      'worship',
      'worship',
      'worship',
      'worship',
      'worship',
      'worship',
      'message',
      'sending',
    ])
  })

  it('buildSlotsFromTemplate(buildSuggestedTemplateEntries(), true) yields 5 SONG slots with requiredVwType [1,2,2,3,3]', () => {
    const slots = buildSlotsFromTemplate(buildSuggestedTemplateEntries(), true)
    const songSlots = slots.filter((s) => s.kind === 'SONG') as SongSlot[]
    expect(songSlots.map((s) => s.requiredVwType)).toEqual([1, 2, 2, 3, 3])
  })
})
