/**
 * Shared display module for the Slides tab (Phase 25). Every component under
 * `src/components/slides/` reads display data through here rather than
 * re-deriving it, so the rail (25-03) and the grid/card (25-04) never fork
 * the kind-badge vocabulary or the title-fallback rule.
 *
 * This module is pure — no Vue reactivity, no store reads, no composables —
 * so it is the cheapest place to unit-test the badge map's completeness.
 */
import type { ServiceSlot, SlotKind } from '@/types/service'
import type { Slide } from '@/types/slide'
import type { GroupSlideEntry } from '@/types/slideGroup'
import { slotLabel } from '@/utils/slotTypes'

/**
 * Static, fully-spelled-out kind-badge class map keyed by `SlotKind` — per
 * 25-UI-SPEC.md's Color § "Kind badge color map". Tailwind v4 silently
 * purges any class name built by string interpolation (e.g. `` `bg-${kind}-900` ``)
 * from the production bundle; this codebase has shipped that exact bug twice
 * already (`SongBadge.vue`, `TeamTagPill.vue`). Every value below is a
 * complete, literal class string for that reason — never build one from a
 * template string.
 */
export const KIND_BADGE_CLASSES: Record<SlotKind, string> = {
  // SONG and HYMN share the indigo/accent family.
  SONG: 'bg-indigo-950/50 text-indigo-300 border-indigo-800',
  HYMN: 'bg-indigo-950/50 text-indigo-300 border-indigo-800',
  // Reuses TeamTagPill's `theme` variant exactly.
  SCRIPTURE: 'bg-teal-900/50 text-teal-300 border-teal-800',
  // Reuses TeamTagPill's `team` (neutral) variant exactly.
  PRAYER: 'bg-gray-800 text-gray-400 border-gray-700',
  // Reuses TeamTagPill's `user` variant exactly.
  MESSAGE: 'bg-pink-900/50 text-pink-300 border-pink-800',
  // Reuses SongBadge's Type-3 amber exactly.
  IMPORTED: 'bg-amber-900/50 text-amber-300 border-amber-800',
}

/**
 * Display title for a plan item's rail row. Returns the song title for a
 * SONG slot, a readable passage reference for a SCRIPTURE slot, the hymn
 * name for a HYMN slot, and the existing per-kind label (`slotLabel`) for
 * every other kind — falling back to that same per-kind label whenever the
 * kind-specific field is empty/null, so a row is never blank.
 */
export function slotDisplayTitle(slot: ServiceSlot): string {
  switch (slot.kind) {
    case 'SONG':
      return slot.songTitle && slot.songTitle.trim() ? slot.songTitle : slotLabel(slot)
    case 'SCRIPTURE': {
      if (slot.book && slot.chapter != null && slot.verseStart != null) {
        const range =
          slot.verseEnd != null && slot.verseEnd !== slot.verseStart ? `-${slot.verseEnd}` : ''
        return `${slot.book} ${slot.chapter}:${slot.verseStart}${range}`
      }
      return slotLabel(slot)
    }
    case 'HYMN':
      return slot.hymnName && slot.hymnName.trim() ? slot.hymnName : slotLabel(slot)
    case 'PRAYER':
    case 'MESSAGE':
    case 'IMPORTED':
      return slotLabel(slot)
  }
}

/**
 * Short uppercase content-kind label for one assembled slide — defined here
 * (rather than in 25-04) because it shares the exact same kind vocabulary
 * the rail's title helper draws on; 25-04's slide card consumes this
 * directly for its top-left kind label (`TITLE`/`VERSE 1`/`CHORUS`/`IMAGE`/`VIDEO`).
 */
export function slideContentLabel(slide: Slide): string {
  switch (slide.contentKind) {
    case 'lyric':
      // LyricSlide and CopyrightSlide both carry contentKind 'lyric' (D001)
      // and are distinguished by shape — CopyrightSlide has no sectionId.
      return 'sectionId' in slide ? slide.sectionLabel.toUpperCase() : 'TITLE'
    case 'scripture':
      return 'SCRIPTURE'
    case 'text':
      return slide.title && slide.title.trim() ? slide.title.toUpperCase() : 'TEXT'
    case 'image':
      return 'IMAGE'
    case 'video':
      return 'VIDEO'
  }
}

/**
 * Main preview-body text for one assembled slide — 25-04's `SlideCard` reads
 * this rather than re-deriving it, so the lyric/copyright shape-narrowing
 * (both share `contentKind: 'lyric'` and are told apart only by the presence
 * of `sectionId`) is never duplicated a third time (`PresentationViewer.vue`
 * already carries its own local copy).
 * Image slides render their own `<img>` in the card and don't consume this
 * string; it is still defined for every kind so the switch stays exhaustive.
 */
export function slideBodyText(slide: Slide): string {
  switch (slide.contentKind) {
    case 'lyric':
      return 'sectionId' in slide ? slide.lines.join('\n') : slide.title
    case 'scripture':
      return `${slide.reference}\n${slide.text}`
    case 'text':
      return slide.body
    case 'image':
      return slide.altText ?? ''
    case 'video':
      return slide.originalFileName ? `Video: ${slide.originalFileName}` : 'Video'
  }
}

/**
 * Readable (non-eyebrow, natural-case) footer label for one assembled slide —
 * distinct from `slideContentLabel`'s small uppercase eyebrow text over the
 * preview. Feeds the card footer's label line (D-10).
 */
export function slideFooterLabel(slide: Slide): string {
  switch (slide.contentKind) {
    case 'lyric':
      return 'sectionId' in slide ? slide.sectionLabel : slide.title
    case 'scripture':
      return slide.reference
    case 'text':
      return slide.title && slide.title.trim() ? slide.title : 'Text'
    case 'image':
      return 'Image'
    case 'video':
      return slide.originalFileName ?? 'Video'
  }
}

/**
 * A confirm-required reconciliation — mirrors the page's assembly
 * composable's own shape exactly, but is never imported from it; nothing
 * under `src/components/slides/` may import or call that composable, per
 * 25-04's hard constraints. Defined once here so `SlidesTab.vue` and
 * `SlideGrid.vue` share a single local copy instead of each duplicating it
 * (25-03 duplicated it directly in `SlidesTab.vue`; 25-04 centralizes it
 * here).
 *
 * 26-04 widens this identically to the composable's own copy (`freshSignature`,
 * `oldSongTitle`, `newSongTitle`) — the two are kept in step deliberately, not
 * accidentally: the reconciliation confirm dialog under this folder reads the
 * widened fields directly off this LOCAL copy, and would otherwise have
 * nothing to read.
 */
export interface PendingReconciliation {
  slotId: string
  proposed: GroupSlideEntry[]
  loss?: { customizedEntries: number; withAudio: number; withNotes: number }
  /** The divergence this pending entry was computed against — `Apply` writes THIS value, never a recomputed one. */
  freshSignature?: string
  /** Populated only for a song-identity-swap reconciliation (D-08); resolved one layer up, never in the pure reconciler. */
  oldSongTitle?: string
  newSongTitle?: string
}

/**
 * Result shape of `useSlideshowAssembly`'s `ensureGroupMaterialized` (25-05
 * Task 1) — mirrored here BY VALUE rather than imported, for the same reason
 * `PendingReconciliation` is: nothing under `src/components/slides/` may
 * import the assembly composable itself. `SlidesTab.vue` and `SlideGrid.vue`
 * both type their `ensureGroupMaterialized` prop against this shape.
 */
export interface EnsureGroupMaterializedResult {
  entries: GroupSlideEntry[]
  sourceSignature?: string
}

/**
 * Builds the reconciliation confirm dialog's heading and body (D-05..D-08,
 * 26-UI-SPEC.md § "Reconciliation Confirm Modal") — the exact two copy tables
 * there, reproduced verbatim, never paraphrased. D-06 traded away a diff
 * view; this wording's concreteness (exact counts and kinds of what's at
 * risk) is the ENTIRE compensation for that trade-off, so do not "improve"
 * it later by adding a diff, a per-slide list, or a before-and-after — that
 * would silently re-introduce what the user explicitly declined.
 *
 * Branches on whether `pending` carries BOTH song titles (D-08, populated
 * only for a song-identity-swap reconciliation): with them, the
 * song-reassignment copy; without them, the generic copy naming `slot`'s
 * display title.
 */
export function reconciliationConfirmCopy(
  pending: PendingReconciliation,
  slot: ServiceSlot,
): { heading: string; body: string } {
  // The count falls back to the number of proposed slides when `loss` is
  // absent altogether — the same fallback the passive banner already uses —
  // rather than ever reading zero.
  const count = pending.loss?.customizedEntries ?? pending.proposed.length
  const slideWord = count === 1 ? 'slide' : 'slides'

  // Mirrors ServiceEditorView.vue's `deleteConfirmBody` (D-03 precedent):
  // include a phrase only for a kind whose count is non-zero, join the
  // included ones, and drop the whole "including" clause when neither is at
  // risk — never emit an empty or zero-valued phrase.
  const mediaParts: string[] = []
  if (pending.loss?.withAudio) mediaParts.push(`${pending.loss.withAudio} with attached audio`)
  if (pending.loss?.withNotes) mediaParts.push(`${pending.loss.withNotes} with operator notes`)
  const mediaClause = mediaParts.length > 0 ? `, including ${mediaParts.join(', ')}` : ''

  if (pending.oldSongTitle && pending.newSongTitle) {
    return {
      heading: `Replace "${pending.oldSongTitle}" with "${pending.newSongTitle}"?`,
      body: `This group's slides currently come from "${pending.oldSongTitle}". Applying the update will switch them to "${pending.newSongTitle}" and replace ${count} ${slideWord} you added${mediaClause}. This cannot be undone.`,
    }
  }

  const title = slotDisplayTitle(slot)
  return {
    heading: `Update this group's slides?`,
    body: `"${title}"'s source content has changed since these slides were generated. Applying the update will replace ${count} ${slideWord} you added${mediaClause}. This cannot be undone.`,
  }
}

/**
 * The Edit Slide drawer's delete-confirm body (26-UI-SPEC.md § "Duplicate and
 * Delete Slide", Phase 24 D-03 precedent) — the four wordings, reproduced
 * verbatim, branching on whether THIS entry (never the group) has its own
 * attached audio and/or operator notes. `entry.audioUrl` is the entry's OWN
 * per-slide audio, distinct from the group's shared bed music
 * (`SlideGroup.bedAudioUrl`) — deleting a slide never touches the bed, and
 * this wording must never imply otherwise by naming media that belongs to
 * the group instead of the slide.
 */
export function deleteSlideConfirmBody(entry: GroupSlideEntry): string {
  const hasAudio = !!entry.audioUrl
  const hasNotes = !!entry.notes
  if (hasAudio && hasNotes) {
    return 'Deleting this slide also removes its attached audio and operator notes. This cannot be undone.'
  }
  if (hasAudio) {
    return 'Deleting this slide also removes its attached audio. This cannot be undone.'
  }
  if (hasNotes) {
    return 'Deleting this slide also removes its operator notes. This cannot be undone.'
  }
  return 'Delete this slide? This cannot be undone.'
}

/**
 * Extracts a human-readable filename from a Firebase Storage download URL
 * (`useMediaUpload`'s upload path is `orgs/{orgId}/media/{mediaId}/{fileName}`).
 * Used by the rail's group-music line to name the bed (25-UI-SPEC.md
 * Copywriting Contract — "Group music — populated": `{filename}`). Falls
 * back to a generic label rather than throwing on a malformed URL.
 */
export function bedAudioLabel(url: string): string {
  try {
    const withoutQuery = url.split('?')[0] ?? url
    const decoded = decodeURIComponent(withoutQuery)
    const segments = decoded.split('/')
    const last = segments[segments.length - 1]
    return last && last.trim() ? last : 'Group music'
  } catch {
    return 'Group music'
  }
}
