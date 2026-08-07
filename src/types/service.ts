import type { Timestamp } from 'firebase/firestore'
import type { VWType } from './song'
import type { CongregationalSection } from './slide'

export type Progression = '1-2-2-3' | '1-2-3-3'
export type ServiceStatus = 'draft' | 'planned' | 'exported'
export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC' | 'HYMN' | 'IMPORTED'

/**
 * Formalized service sections (D005). Exactly these five members — no others.
 * SERVICE_SECTIONS below is the single source of truth for the section set;
 * a future per-church configurable section list is a localized change here.
 * `'post-service'` was appended last (Phase 29, D-Post-Service) — it is
 * purely additive: `ServiceSlot.section` is already optional, so widening
 * this union needs no migration or backfill against shipped v1.0 service
 * documents, which simply render the new section empty.
 */
export type ServiceSection = 'pre-service' | 'worship' | 'message' | 'sending' | 'post-service'

export const SERVICE_SECTIONS: readonly ServiceSection[] = ['pre-service', 'worship', 'message', 'sending', 'post-service']

export const SERVICE_SECTION_LABELS: Record<ServiceSection, string> = {
  'pre-service': 'Pre-Service',
  worship: 'Worship',
  message: 'Message',
  sending: 'Sending',
  'post-service': 'Post-Service',
}

/**
 * Mixed into every `ServiceSlot` variant to carry the slot's stable identity.
 * Originally named for the Phase 22 slot-level media fields it also carried
 * (R013/R014) — those fields were deleted under D-19 (the slide area has
 * never shipped, so there was no legacy media worth preserving; media now
 * lives exclusively on the `slideGroups/{slotId}` group bed, written via
 * `setGroupBedMedia`). The interface name is kept because `id` is still what
 * every `ServiceSlot` union member needs.
 */
export interface MediaAttachableSlot {
  /**
   * Stable slot identity (D-01, Phase 24). Minted by `createSlot()`/
   * `buildSlots()` for brand-new slots and by `backfillSlotIds()` for legacy
   * documents read before this field existed. This is the anchor every
   * `slideGroups/{slotId}` document is keyed on — never array index or
   * `position`, both of which a drag-reorder rewrites.
   */
  id: string
}

export interface SongSlot extends MediaAttachableSlot {
  kind: 'SONG'
  position: number
  requiredVwType: VWType
  songId: string | null
  songTitle: string | null
  songKey: string | null
  section?: ServiceSection
}

export interface ScriptureSlot extends MediaAttachableSlot {
  kind: 'SCRIPTURE'
  position: number
  book: string | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  scriptureReadingId?: string | null
  readingMode?: 'normal' | 'congregational'
  congregationalSections?: CongregationalSection[]
  section?: ServiceSection
}

export interface NonAssignableSlot extends MediaAttachableSlot {
  kind: 'PRAYER' | 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC'
  position: number
  /**
   * The single free-text field shared by MESSAGE, ANNOUNCEMENTS and MISC
   * (R081/R082/R083). Named `body` to match the existing `TextSlide.body`
   * in `src/types/slide.ts` — same concept, same word. OPTIONAL because
   * every PRAYER and MESSAGE slot already in production lacks it; a
   * required field would break every stored service and force a migration
   * this phase is not authorized to write.
   */
  body?: string
  linkUrl?: string
  linkLabel?: string
  section?: ServiceSection
}

export interface HymnSlot extends MediaAttachableSlot {
  kind: 'HYMN'
  position: number
  hymnName: string
  hymnNumber: string
  verses: string
  section?: ServiceSection
}

/**
 * A slot referencing a persisted imported PPTX/image deck (Phase 21).
 * Mirrors ScriptureSlot's reference-by-id shape — the deck itself lives in
 * the importedSlides store, keyed by `importId`.
 */
export interface ImportedSlot extends MediaAttachableSlot {
  kind: 'IMPORTED'
  position: number
  importId: string | null
  section?: ServiceSection
}

export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot | ImportedSlot

export interface ScriptureRef {
  book: string
  chapter: number
  verseStart?: number
  verseEnd?: number
}

export interface Service {
  id: string
  date: string
  name: string
  progression: Progression
  teams: string[]
  status: ServiceStatus
  slots: ServiceSlot[]
  sermonPassage: ScriptureRef | null
  sermonTopic?: string
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
  pcExportedAt?: Timestamp | null
  pcPlanId?: string | null
  /** roleId -> personId[]; absent key = inherit from schedule, present key = override.
   *  Mirrors Quarter.roleOverridesByDate's sparse-override-map precedent (src/types/roster.ts). */
  roleAssignmentOverrides?: Record<string, string[]>
}

export type ServiceInput = Omit<Service, 'id' | 'createdAt' | 'updatedAt'>
