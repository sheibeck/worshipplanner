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
  /**
   * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) ->
   * src/types/service.ts). NOT the SEPARATE required top-level `Service.notes` below.
   */
  notes?: string
  /**
   * intervalSeconds is SECONDS not ms. See .planning/codebase/ARCHITECTURE.md
   * (Type & View Behavioral Notes (R318) -> src/types/service.ts).
   */
  loop?: {
    enabled: boolean
    intervalSeconds: number
  }
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
  /**
   * Optional per-item override of the org-wide default Bible version (R128,
   * Phase 56). Absent => use the org default (`authStore.settings.bibleVersion`)
   * exactly as today. The only supported versions are ESV and NLT. The effective
   * version everywhere scripture TEXT is produced is `slot.bibleVersion ?? orgDefault`.
   * OPTIONAL and non-destructive: absent on every scripture slot written before
   * this field existed (no migration), and an emptied value is stored as
   * `undefined` and dropped by `stripUndefined` before the Firestore write.
   */
  bibleVersion?: 'ESV' | 'NLT'
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
  /**
   * MISC-only custom display name (R127, Phase 56). See
   * .planning/codebase/INTEGRATIONS.md (Type & View Integration Notes (R318) ->
   * src/types/service.ts).
   */
  label?: string
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

/**
 * A marker's optional kind — drives palette grouping, tile icon, and accent/neutral skin
 * (STAGE_KIND_META in src/utils/stageLayout.ts). Additive: absent on older/neutral markers.
 * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) -> src/types/service.ts).
 */
export type StageMarkerKind =
  | 'lead'
  | 'vocal'
  | 'choir'
  | 'orchestra'
  | 'instrument'
  | 'mic'
  | 'di'
  | 'monitor'
  | 'amp'
  | 'stand'
  | 'power'
  | 'tv'
  | 'misc'
  | 'communion'

export interface StageMarker {
  id: string
  label: string
  kind?: StageMarkerKind
  /**
   * A band-role instrument: the marker's TYPE is one of the org's Band roles
   * (the Instruments palette mirrors those), so the instrument lines up with
   * the role a person is assigned to. `roleName` is denormalized alongside
   * `roleId` so the read-only renderer (share/print, no store) shows the type
   * without a lookup. Mutually exclusive with `kind` in practice; absent for
   * the fixed Vocals/Mics/Gear/Orchestra/Instrument kinds. */
  roleId?: string
  roleName?: string
  /** Derived from position (`zoneFromPosition`) and stored so the data stays
   *  self-describing; 'onstage' = on the platform band, 'offstage' = a side
   *  wing or the audience apron. */
  zone: 'onstage' | 'offstage'
  xPct: number
  yPct: number
  /** Optional free-text note for the tech team (e.g. "XLR run from stage
   *  left"). Absent key when empty. Shown read-only on print/share. */
  note?: string
  /**
   * Optional person assigned to this spot, chosen from the people already
   * serving this service (its resolved role assignments) — so a planner
   * selects a name instead of hand-typing a label. `personName` is
   * denormalized alongside `personId` so the read-only renderer (share/print,
   * which imports no store) can show the name directly; `personId` keeps the
   * picker's selected state stable across identical names. Both absent when
   * the spot is unassigned (gear, spares, or an unfilled position).
   */
  personId?: string
  personName?: string
  /** For an instrument marker whose player also sings — the tile then reads
   *  e.g. "Electric + Vocal". Only meaningful for Instruments-group kinds;
   *  absent otherwise. */
  withVocal?: boolean
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
  /**
   * Per-service automatic-email overrides (R132, Phase 58). Optional —
   * absent on existing service docs, which still typecheck. Each leaf is
   * `null` when the service inherits the org-level `OrgSettings.messaging`
   * default rather than overriding it. Draft-only editable (v1.7); a locked
   * service shows the effective (inherited-or-overridden) values read-only.
   * `reminderSentAt` is an Admin-SDK-only idempotency guard written by
   * Phase 61's scheduled reminder function — never written from the client.
   */
  messaging?: {
    lockNotifyEnabled: boolean | null
    reminderEnabled: boolean | null
    reminderDaysBefore: number | null
    reminderSentAt: Timestamp | null
  }
  /**
   * Additive, no-migration (R313/R314/R315, Phase 107). See
   * .planning/codebase/STACK.md (Type & View Stack Notes (R318) -> src/types/service.ts).
   */
  stageLayout?: {
    elements: StageMarker[]
  }
}

export type ServiceInput = Omit<Service, 'id' | 'createdAt' | 'updatedAt'>
