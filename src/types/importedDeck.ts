import type { Timestamp } from 'firebase/firestore'
import type { ServiceSection } from './service'
import type { TextSlide, ImageSlide } from './slide'

/**
 * A persisted imported PPTX/image deck (Phase 21) — the imported-PPTX
 * analogue of ScriptureReading (src/types/scriptureReading.ts). One
 * ImportedSlot.importId references one ImportedDeck; assembleSlideshow
 * expands the deck's `slides` into N AssembledSlides, mirroring the way a
 * SCRIPTURE slot expands a ScriptureReading.
 */
export interface ImportedDeck {
  id: string
  sourceFileName: string
  section: ServiceSection
  slides: (TextSlide | ImageSlide)[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
