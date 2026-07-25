import type { Timestamp } from 'firebase/firestore'
import type { VWType } from './song'

export type Progression = '1-2-2-3' | '1-2-3-3'
export type ServiceStatus = 'draft' | 'planned' | 'exported'
export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'HYMN' | 'IMPORTED'

/**
 * Formalized service sections (D005). Exactly these four members — no others.
 * SERVICE_SECTIONS below is the single source of truth for the section set;
 * a future per-church configurable section list is a localized change here.
 */
export type ServiceSection = 'pre-service' | 'worship' | 'message' | 'sending'

export const SERVICE_SECTIONS: readonly ServiceSection[] = ['pre-service', 'worship', 'message', 'sending']

export const SERVICE_SECTION_LABELS: Record<ServiceSection, string> = {
  'pre-service': 'Pre-Service',
  worship: 'Worship',
  message: 'Message',
  sending: 'Sending',
}

/**
 * Media-attachment fields mixed into every `ServiceSlot` variant (Phase 22,
 * R013/R014). Media attaches at the SLOT level — service-scoped — and is
 * deliberately NOT part of the canonical song/scripture/deck content (D002):
 * an announcement video attached to one Sunday's slot must not follow the
 * song into every other service that references it. `slideshowAssembler`
 * copies these onto the first `AssembledSlide.slide` it emits for the slot
 * (see `SlideBase.audioUrl`/`videoUrl`).
 */
export interface MediaAttachableSlot {
  audioUrl?: string
  videoUrl?: string
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
  section?: ServiceSection
}

export interface NonAssignableSlot extends MediaAttachableSlot {
  kind: 'PRAYER' | 'MESSAGE'
  position: number
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
