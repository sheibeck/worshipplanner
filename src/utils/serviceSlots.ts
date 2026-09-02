// The slotIndex <-> first-assembled-slide-index lookup (Phase 91, consumed by
// the Run rail in Phases 92-96) — the SINGLE shared derivation for "which
// slide does clicking this order-of-service item jump to."
// See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/serviceSlots.ts)
import type { Service, ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'

/** One service slot paired with its original (pre-sort) `service.slots` array index. */
export interface IndexedServiceSlot {
  slot: ServiceSlot
  index: number
}

/**
 * Pairs each slot with its original array index, then returns a NEW array
 * sorted by ascending `slot.position` — `service.slots` itself is never
 * mutated. Matches `assembleSlideshow`'s own ordering exactly (see module doc
 * comment); a Run rail (or any other consumer) that used a different sort
 * would visibly disagree with the assembled slideshow it is meant to navigate.
 */
export function sortedSlotsWithIndex(service: Service): IndexedServiceSlot[] {
  const indexed = service.slots.map((slot, index) => ({ slot, index }))
  return [...indexed].sort((a, b) => a.slot.position - b.slot.position)
}

/**
 * Walks the flat, already-assembled slide array in order and records, for
 * each `slotIndex`, the array index of its FIRST slide only. A slot with zero
 * assembled slides (e.g. an empty SONG slot with no songId) is simply absent
 * from the returned map — callers treat absence as "not clickable / no slide
 * to jump to", never as an error.
 */
export function firstAssembledIndexBySlot(slides: AssembledSlide[]): Map<number, number> {
  const result = new Map<number, number>()
  slides.forEach((slide, arrayIndex) => {
    if (!result.has(slide.slotIndex)) {
      result.set(slide.slotIndex, arrayIndex)
    }
  })
  return result
}
