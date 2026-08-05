import type { Timestamp } from 'firebase/firestore'

/**
 * A persisted slide group (Phase 24, D-01/D-02/D-04) — the structure, order,
 * audio, labels and notes a service's plan item (`ServiceSlot`) has been
 * given, anchored to that slot's stable `id`. Lives at
 * `organizations/{orgId}/slideGroups/{slotId}` — one document per slot, keyed
 * by the SAME id as the slot it anchors to.
 *
 * Load-bearing invariants:
 * 1. `SlideGroup.id === SlideGroup.slotId === the anchoring ServiceSlot.id`.
 *    This is the deterministic Firestore doc id every later plan in this
 *    phase relies on — groups anchor to `slot.id`, never to array index or
 *    `position`, so a drag-reorder on the Service Order tab can never
 *    re-point a group at the wrong plan item (D-01).
 * 2. `GroupSlideEntry.id` is minted ONCE (`crypto.randomUUID()`) at
 *    materialization and is NEVER regenerated afterward. Phase 23's WR-02
 *    contract keys `PresentationViewer`'s per-slide `AudioPlayer`/
 *    `VideoPlayer` child component instances on this id specifically so a
 *    reorder or reconciliation never leaks stale muted/blocked media state
 *    from one slide onto another.
 * 3. Slide TEXT is never stored on this document — it resolves LIVE from
 *    the canonical song / scripture / imported-deck record via `sourceRef`
 *    (D-02). Editing a song's lyrics updates every service referencing it;
 *    there is no per-service text override and no "Generate missing slides"
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
   * Opaque signature of the source content this group was last rebuilt
   * against. Phase 30 deleted the confirm-gated reconciler that used to
   * compare against it, but Phase 38 (D1) gives it a new reader:
   * `rebuildScriptureGroup` consults it as the ONE durable marker
   * distinguishing "this group was already materialized from the slot's
   * CURRENT reading" (detached, freely editable) from "not yet" (still
   * slot-derived). Every other rebuild path still treats it as a stored
   * change-detector only, written for storage parity and not read back.
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
 * Discriminated union of every kind of content a `GroupSlideEntry` can point
 * at, narrowed on `kind`. The `copyright` member is a planner addition to
 * research's four-member shape: `assembleSlideshow` emits a copyright slide
 * BEFORE and AFTER a song's lyric sections, so a song group needs two entries
 * that carry no `sectionId`. Encoding them as `kind: 'copyright'` keeps song
 * reconciliation's diff-by-`sectionId` from ever seeing a section-less entry.
 *
 * The `video` member (D-17) is unlike every other member here: it references
 * no canonical record. A dropped video has no document behind it — the
 * storage URL itself IS the reference, carried on `videoSrc` (same field name
 * as `VideoSlide`'s own-source field). Video is slide-only (D-18) — there is
 * no group bed video, so there is nothing for this field to collide with.
 *
 * The `text` member is widened with optional authored `title`/`body` (D-17
 * ripple) so a user-added blank slide (`＋ Add slide` on a SONG/SCRIPTURE/
 * IMPORTED group) has somewhere to store its own words — today a `text` entry
 * carries nothing and its content derives entirely from the owning slot,
 * which stays correct for the auto-derived PRAYER/MESSAGE/HYMN entry. Both
 * fields are optional so every entry written before this change stays valid.
 *
 * `scripture` (Phase 38, D1/D2) is either of TWO shapes — a scripture group
 * has exactly two states, never a mix:
 *
 * - REFERENCE (default, Phase 30's hard lock, unchanged): the ref carries NO
 *   payload at all (R047). Content comes from the owning SCRIPTURE slot's own
 *   reference fields, resolved live at render time — exactly like the
 *   auto-derived `text` entry, and for the same reason: the slot IS the
 *   canonical record. A `scriptureReadingId` pointing at a separately-fetched
 *   reading document was the previous source, and it never worked — nothing
 *   wrote the id back onto the slot, so a scripture item produced no slide.
 * - CONGREGATIONAL (opt-in, D1): the ref carries `speaker` — its PRESENCE is
 *   the discriminator, the same present-or-absent test the `text` member's
 *   `body` already uses above — plus that section's own `text` and, when the
 *   section has one, `verseRange`. This entry's words are the GROUP's, not
 *   the slot's (D2): converting to congregational deliberately detaches the
 *   group from slot-driven re-derivation, so there is no live source left to
 *   resolve against. `derivedIdentityKey` still keys every scripture ref —
 *   Reference or Congregational — on the ref KIND alone, so this widening
 *   changes nothing about how a stored entry is matched during a rebuild.
 *
 * Both `scriptureReadingId` and `innerSlideId` stay in the union as OPTIONAL
 * legacy fields rather than being removed: every entry written before Phase
 * 38 stays readable (both fields are ignored on read).
 */
export type SourceRef =
  | { kind: 'lyric'; songId: string; sectionId: string }
  | { kind: 'copyright'; songId: string }
  | {
      kind: 'scripture'
      scriptureReadingId?: string
      innerSlideId?: string
      speaker?: 'LEADER' | 'CONGREGATION'
      text?: string
      verseRange?: string
    }
  | { kind: 'imported'; importId: string; innerSlideId: string }
  | { kind: 'text'; title?: string; body?: string }
  | { kind: 'video'; videoSrc: string; originalFileName?: string }

/** The shape the store's create action accepts before it stamps server timestamps. */
export type SlideGroupInput = Omit<SlideGroup, 'createdAt' | 'updatedAt'>
