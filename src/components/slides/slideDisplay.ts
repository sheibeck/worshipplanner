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
