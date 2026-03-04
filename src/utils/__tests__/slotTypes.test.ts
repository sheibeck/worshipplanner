import { describe, it, expect } from 'vitest'
import { PROGRESSION_SLOT_TYPES, buildSlots, createSlot, reindexSlots, slotLabel } from '@/utils/slotTypes'
import type { SongSlot, ScriptureSlot, NonAssignableSlot } from '@/types/service'

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
})

describe('reindexSlots', () => {
  it('normalizes positions to match array index', () => {
    const slots = [
      { kind: 'SONG' as const, position: 5, requiredVwType: 1 as const, songId: null, songTitle: null, songKey: null },
      { kind: 'PRAYER' as const, position: 2 },
      { kind: 'MESSAGE' as const, position: 8 },
    ]
    const reindexed = reindexSlots(slots)
    expect(reindexed[0]!.position).toBe(0)
    expect(reindexed[1]!.position).toBe(1)
    expect(reindexed[2]!.position).toBe(2)
  })

  it('preserves slot data when reindexing', () => {
    const slots = [
      { kind: 'SONG' as const, position: 99, requiredVwType: 2 as const, songId: 'abc', songTitle: 'Test', songKey: 'G' },
    ]
    const reindexed = reindexSlots(slots)
    const slot = reindexed[0]! as SongSlot
    expect(slot.position).toBe(0)
    expect(slot.songId).toBe('abc')
    expect(slot.songTitle).toBe('Test')
    expect(slot.songKey).toBe('G')
  })

  it('returns a new array (does not mutate original)', () => {
    const slots = [{ kind: 'PRAYER' as const, position: 5 }]
    const reindexed = reindexSlots(slots)
    expect(reindexed).not.toBe(slots)
    expect(slots[0]!.position).toBe(5) // original unchanged
  })
})

describe('slotLabel', () => {
  it('returns "Song" for a SONG slot', () => {
    const slot: SongSlot = { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null }
    expect(slotLabel(slot, 0)).toBe('Song')
  })

  it('returns "Scripture Reading" for a SCRIPTURE slot', () => {
    const slot: ScriptureSlot = { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null }
    expect(slotLabel(slot, 1)).toBe('Scripture Reading')
  })

  it('returns "Prayer" for a PRAYER slot', () => {
    const slot: NonAssignableSlot = { kind: 'PRAYER', position: 3 }
    expect(slotLabel(slot, 3)).toBe('Prayer')
  })

  it('returns "Message" for a MESSAGE slot', () => {
    const slot: NonAssignableSlot = { kind: 'MESSAGE', position: 7 }
    expect(slotLabel(slot, 7)).toBe('Message')
  })
})
