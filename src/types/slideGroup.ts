import type { Timestamp } from 'firebase/firestore'

/**
 * A persisted slide group (Phase 24, D-01/D-02/D-04) — the structure, order,
 * audio, labels and notes a service's plan item (`ServiceSlot`) has been
 * given, anchored to that slot's stable `id`. Lives at
 * `organizations/{orgId}/slideGroups/{slotId}` — one document per slot, keyed
 * by the SAME id as the slot it anchors to.
 *
 * Load-bearing invariants:
  * See ADR-0174 (docs/adr/0174-1-slidegroup-id-slidegroup-slotid-the-anchoring.md)
 *    step, because groups are always populated from the live source.
 *
 *    EXCEPTION (Phase 38, D1/D2): a scripture group's CONGREGATIONAL-state
 *    entries are the one deliberate departure from this invariant. Converting
 *    a scripture reading to congregational sections detaches the group from
 *    the slot on purpose — the whole point is per-slide editing and deletion
 *    with no write-back to the reading — so once detached there is no
 *    canonical record left for a section entry to resolve against; its own
 *    `speaker`/`text`/`verseRange` ARE the group's stored words. Nothing else
 *    stores text this way: every other entry kind on every other slot kind
 *    still resolves live, exactly as this invariant states.
 *
 * `slides` is an EMBEDDED ARRAY field on this document, NOT a nested
 * Firestore subcollection — a nested `slideGroups/{slotId}/slides/{id}`
 * subcollection would fall through the existing `firestore.rules` generic
 * single-segment catch-all to a global deny, forcing a rules change this
 * phase is forbidden from testing (see RESEARCH.md Pattern 4/5).
 */
export interface SlideGroup {
  /** Equals `slotId` and the anchoring `ServiceSlot.id` — the Firestore doc id. */
  id: string
  serviceId: string
  /** Redundant with `id`, kept explicit for query readability and the delete cascade. */
  slotId: string
  /** Group-level audio bed, set via `setGroupBedMedia` (D-18); no legacy slot-media migration feeds this (D-19). */
  bedAudioUrl?: string
  /** Group-level background image (R055) — the middle tier of the slide/group/song cascade `resolveEntryMedia` resolves; greenfield, no migration (D-19). */
  backgroundImageUrl?: string
  /**
   * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) ->
   * src/types/slideGroup.ts).
   */
  sourceSignature?: string
  slides: GroupSlideEntry[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * One slide within a `SlideGroup`. `id` is minted once and never regenerated
 * (see invariant 2 above) — it is the id `PresentationViewer` keys media
 * components on.
 */
export interface GroupSlideEntry {
  id: string
  order: number
  sourceRef: SourceRef
  /**
   * LEGACY, no longer authored. The Slide Label input that wrote this field was
   * removed once it turned out nothing read it back — not the slide card, the
   * grid, the projected slide, or the PPTX export. The field stays declared so
   * documents written before the removal remain valid, and stays OPTIONAL so
   * nothing new is obliged to set it. Do not reintroduce an editor for it; if a
   * per-slide caption is ever wanted, give it a name that says where it shows.
   */
  label?: string
  notes?: string
  /** Per-slide audio (R030) — audio only, there is no per-slide video layer. */
  audioUrl?: string
  /** D-04: loop is a per-slide flag only — a group bed never loops. */
  audioLoop?: boolean
  /** Per-slide background image (R056) — the most specific tier of the slide/group/song cascade `resolveEntryMedia` resolves; greenfield, no migration (D-19). */
  backgroundImageUrl?: string
}

/**
 * Discriminated union of every kind of content a `GroupSlideEntry` can point at,
 * narrowed on `kind`. See .planning/codebase/ARCHITECTURE.md (Type & View
 * Behavioral Notes (R318) -> src/types/slideGroup.ts) for the per-member rationale
 * (copyright, video, text, scripture's two-shape contract, imported's innerSlideId/
 * renderedPage provenance).
 */
export type SourceRef =
  | { kind: 'lyric'; songId: string; sectionId: string }
  | { kind: 'copyright'; songId: string }
  | {
      kind: 'scripture'
      scriptureReadingId?: string
      innerSlideId?: string
      /** Widened Phase 47 (R095/R096/R097) to admit 'ALL', matching CongregationalSection.speaker — additive, no migration. */
      speaker?: 'LEADER' | 'CONGREGATION' | 'ALL'
      text?: string
      verseRange?: string
      /**
       * R092 (Phase 45): passthrough of the owning `CongregationalSection`'s
       * `translationSource` — spread in by `deriveGroupEntries`'s SCRIPTURE
       * branch, never recomputed here. Optional for the same
       * field-less-fallback reason as the type it mirrors.
       */
      translationSource?: 'ESV' | 'NLT'
    }
  | { kind: 'imported'; importId: string; innerSlideId: string; renderedPage?: number }
  | { kind: 'text'; title?: string; body?: string }
  | { kind: 'video'; videoSrc: string; originalFileName?: string }

/** The shape the store's create action accepts before it stamps server timestamps. */
export type SlideGroupInput = Omit<SlideGroup, 'createdAt' | 'updatedAt'>
