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
  /**
   * The Storage-side import id (Phase 37, R062) -- the same crypto.randomUUID()
   * value pptxUpload.ts's generateImportId() produces, which scopes
   * orgs/{orgId}/pptx-imports/{importId}/ and organizations/{orgId}/pptxRenders/{importId}.
   * Deliberately distinct from this interface's own `id`, which Firestore assigns
   * via addDoc() when importedSlidesStore.createDeck() confirms the deck. Without
   * this field nothing can join a confirmed deck to its render record -- the two
   * identifiers were structurally unlinked before this field existed.
   * Optional because decks confirmed before this phase have no render record, and
   * because image-only imports (no source.pptx, nothing to render) never produce one.
   */
  renderImportId?: string
}
