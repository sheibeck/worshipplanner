import { describe, it, expect } from 'vitest'
import { sortedSlotsWithIndex, firstAssembledIndexBySlot } from '@/utils/serviceSlots'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import type { Service, ServiceSlot, NonAssignableSlot, ScriptureSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { Timestamp } from 'firebase/firestore'

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

function makeService(slots: ServiceSlot[]): Service {
  return {
    id: 'svc-1',
    date: '2026-01-04',
    name: 'Test Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots,
    sermonPassage: null,
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  }
}

function makePrayerSlot(overrides: Partial<NonAssignableSlot> = {}): NonAssignableSlot {
  return {
    id: overrides.id ?? 'slot-prayer',
    kind: 'PRAYER',
    position: overrides.position ?? 0,
    ...overrides,
  }
}

const emptyInputs: AssemblyInputs = {
  songLyricsById: new Map(),
  scriptureReadingsById: new Map(),
  importedDecksById: new Map(),
  groupsBySlotId: new Map(),
}

describe('sortedSlotsWithIndex', () => {
  it('orders by ascending position while carrying each slot\'s original array index', () => {
    const slotA = makePrayerSlot({ id: 'a', position: 20 })
    const slotB = makePrayerSlot({ id: 'b', position: 10 })
    const slotC = makePrayerSlot({ id: 'c', position: 30 })
    const service = makeService([slotA, slotB, slotC]) // array order: A(0), B(1), C(2)

    const result = sortedSlotsWithIndex(service)

    expect(result.map((r) => r.slot.id)).toEqual(['b', 'a', 'c']) // position order: 10, 20, 30
    expect(result.find((r) => r.slot.id === 'a')!.index).toBe(0)
    expect(result.find((r) => r.slot.id === 'b')!.index).toBe(1)
    expect(result.find((r) => r.slot.id === 'c')!.index).toBe(2)
  })

  it('does not mutate service.slots', () => {
    const slotA = makePrayerSlot({ id: 'a', position: 20 })
    const slotB = makePrayerSlot({ id: 'b', position: 10 })
    const service = makeService([slotA, slotB])
    const originalOrder = service.slots.map((s) => s.id)

    sortedSlotsWithIndex(service)

    expect(service.slots.map((s) => s.id)).toEqual(originalOrder)
  })

  it('returns an empty array for a service with no slots', () => {
    expect(sortedSlotsWithIndex(makeService([]))).toEqual([])
  })
})

describe('firstAssembledIndexBySlot', () => {
  it('maps each slotIndex to the first occurrence index in the flat array', () => {
    const slides: AssembledSlide[] = [
      { slide: { id: 's0', position: 0, contentKind: 'text', body: 'x' }, slotIndex: 2, slotKind: 'PRAYER', sourceId: null },
      { slide: { id: 's1', position: 1, contentKind: 'text', body: 'x' }, slotIndex: 0, slotKind: 'PRAYER', sourceId: null },
      { slide: { id: 's2', position: 2, contentKind: 'text', body: 'x' }, slotIndex: 0, slotKind: 'PRAYER', sourceId: null },
      { slide: { id: 's3', position: 3, contentKind: 'text', body: 'x' }, slotIndex: 1, slotKind: 'PRAYER', sourceId: null },
    ]

    const result = firstAssembledIndexBySlot(slides)

    expect(result.get(2)).toBe(0) // first occurrence of slotIndex 2 is array index 0
    expect(result.get(0)).toBe(1) // first (not second) occurrence of slotIndex 0
    expect(result.get(1)).toBe(3)
  })

  it('omits a slotIndex with zero assembled slides', () => {
    const slides: AssembledSlide[] = [
      { slide: { id: 's0', position: 0, contentKind: 'text', body: 'x' }, slotIndex: 0, slotKind: 'PRAYER', sourceId: null },
    ]
    const result = firstAssembledIndexBySlot(slides)
    expect(result.has(5)).toBe(false)
  })

  it('returns an empty map for an empty slide array', () => {
    expect(firstAssembledIndexBySlot([])).toEqual(new Map())
  })
})

describe('assembler agreement', () => {
  it('agrees with slideshowAssembler.ts on slotIndex provenance and first-slide ordering', () => {
    // Non-sequential positions on purpose — the load-bearing case.
    const slotHigh = makePrayerSlot({ id: 'slot-high', position: 30 })
    const slotLow = makePrayerSlot({ id: 'slot-low', position: 10 })
    const slotMid: ScriptureSlot = {
      id: 'slot-mid',
      kind: 'SCRIPTURE',
      position: 20,
      book: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
    }
    // Array order: high(0), low(1), mid(2) — deliberately NOT position order.
    const service = makeService([slotHigh, slotLow, slotMid])

    const slides = assembleSlideshow(service, emptyInputs)
    const firstIndexBySlot = firstAssembledIndexBySlot(slides)
    const sorted = sortedSlotsWithIndex(service)

    for (const { index: originalIndex } of sorted) {
      const firstSlideArrayIndex = firstIndexBySlot.get(originalIndex)
      expect(firstSlideArrayIndex).toBeDefined()
      const firstSlide = slides[firstSlideArrayIndex as number]!
      expect(firstSlide.slotIndex).toBe(originalIndex)
      // It must be the FIRST occurrence — no earlier slide in the array shares this slotIndex.
      const earlierMatch = slides.slice(0, firstSlideArrayIndex as number).some((s) => s.slotIndex === originalIndex)
      expect(earlierMatch).toBe(false)
    }
  })
})
