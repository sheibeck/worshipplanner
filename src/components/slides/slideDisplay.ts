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
import type { CongregationalSection, Slide } from '@/types/slide'
import type { GroupSlideEntry } from '@/types/slideGroup'
import { slotLabel, miscLabel } from '@/utils/slotTypes'
import { formatScriptureReference, scriptureRefFromSlot } from '@/utils/scripture'

/** One key in the 3-dot slide action menu (33-UI-SPEC.md § Copywriting Contract). */
export type MenuItemKey =
  | 'edit-details'
  | 'edit-in-song'
  | 'edit-in-scripture'
  | 'duplicate'
  | 'delete'

/** One rendered row of `SlideActionMenu.vue` — `slideActionMenuItems` is the only producer. */
export interface MenuItem {
  key: MenuItemKey
  label: string
  tone: 'default' | 'nav' | 'destructive'
}

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "KIND_BADGE_CLASSES/RENDER_FAILURE_SENTENCES")
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
  // ANNOUNCEMENTS and MISC reuse PRAYER's neutral family — no new colour
  // token introduced for this phase.
  ANNOUNCEMENTS: 'bg-gray-800 text-gray-400 border-gray-700',
  MISC: 'bg-gray-800 text-gray-400 border-gray-700',
  // Reuses SongBadge's Type-3 amber exactly.
  IMPORTED: 'bg-amber-900/50 text-amber-300 border-amber-800',
}

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "KIND_BADGE_CLASSES/RENDER_FAILURE_SENTENCES")
export const RENDER_FAILURE_SENTENCES: Record<string, string> = {
  'missing-render-doc': "This deck's render record is missing.",
  'missing-storage-path': "The rendered file couldn't be located.",
}

/** The fallback sentence `renderFailureSentence` returns for any input not a key of `RENDER_FAILURE_SENTENCES` — including `undefined`, the empty string, and any value a tampered document might carry (T-42-04). */
export const RENDER_FAILURE_FALLBACK_SENTENCE = "This slide couldn't be rendered."

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "KIND_BADGE_CLASSES/RENDER_FAILURE_SENTENCES")
export function renderFailureSentence(reason: string | undefined): string {
  if (reason === undefined) return RENDER_FAILURE_FALLBACK_SENTENCE
  return RENDER_FAILURE_SENTENCES[reason] ?? RENDER_FAILURE_FALLBACK_SENTENCE
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
      // HI-02/ME-02: the canonical primitives, not a private formatter. The
      // one this replaced required `verseStart`, so a whole-chapter reading —
      // which R047 treats as a fully valid slide source — fell back to the
      // generic "Scripture Reading" label while the slide beside it projected
      // "Psalms 103".
      const ref = scriptureRefFromSlot(slot)
      return ref ? formatScriptureReference(ref) : slotLabel(slot)
    }
    case 'HYMN':
      return slot.hymnName && slot.hymnName.trim() ? slot.hymnName : slotLabel(slot)
    // MISC shows its custom label (2026-08-12) so the Slides tab matches the
    // Service Order badge; miscLabel falls back to "Miscellaneous" when unset.
    case 'MISC':
      return miscLabel(slot)
    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'IMPORTED':
      return slotLabel(slot)
  }
}

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "speakerDisplayName")
export function speakerDisplayName(speaker: CongregationalSection['speaker']): string {
  if (speaker === 'LEADER') return 'Leader'
  if (speaker === 'CONGREGATION') return 'Congregation'
  return 'All'
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
      // Phase 38-03: a Congregational-state section slide names its speaker
      // in the eyebrow instead of the generic kind word — the same rule the
      // lyric case above already follows, where the eyebrow carries the
      // section's own label rather than a generic kind word. Without this, N
      // section slides from one reading show N identical SCRIPTURE badges
      // and the planner cannot tell which is which. A Reference-state slide
      // (no `section`) keeps today's bare 'SCRIPTURE' value.
      return slide.section ? speakerDisplayName(slide.section.speaker).toUpperCase() : 'SCRIPTURE'
    case 'text':
      return slide.title && slide.title.trim() ? slide.title.toUpperCase() : 'TEXT'
    case 'image':
      return 'IMAGE'
    case 'video':
      return 'VIDEO'
    case 'blackout':
      // Phase 105 (105-UI-SPEC.md Copywriting Contract): a blackout slide
      // carries no text/label — the eyebrow names the kind itself.
      return 'BLACKOUT'
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
    case 'scripture': {
      // See .planning/codebase/INTEGRATIONS.md (§ Component & Composable Integration Notes (R318) -> src/components/slides/slideDisplay.ts)
      if (!slide.text) return slide.reference
      const showReference = !slide.section
      return showReference ? `${slide.reference}\n${slide.text}` : slide.text
    }
    case 'text':
      return slide.body
    case 'image':
      return slide.altText ?? ''
    case 'video':
      return slide.originalFileName ? `Video: ${slide.originalFileName}` : 'Video'
    case 'blackout':
      // Phase 105 (105-UI-SPEC.md Copywriting Contract): the preview-body
      // caption for a blackout card — the card itself renders solid black;
      // this muted caption is what a planner sees in the grid/list view.
      return 'Solid black'
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
      // Phase 38-03: a Congregational-state section slide names its speaker
      // alongside the reference, using the same "·" separator the drawer's
      // context line already uses — a Reference-state slide (no `section`)
      // keeps the bare reference, unchanged.
      return slide.section ? `${slide.reference} · ${speakerDisplayName(slide.section.speaker)}` : slide.reference
    case 'text':
      return slide.title && slide.title.trim() ? slide.title : 'Text'
    case 'image':
      return 'Image'
    case 'video':
      return slide.originalFileName ?? 'Video'
    case 'blackout':
      // Phase 105 (105-UI-SPEC.md Copywriting Contract): the natural-case
      // footer label for a blackout card.
      return 'Black Slide'
  }
}

/**
 * Result shape of `useSlideshowAssembly`'s `ensureGroupMaterialized` (25-05
 * Task 1) — mirrored here BY VALUE rather than imported; nothing under
 * `src/components/slides/` may import the assembly composable itself.
 * `SlidesTab.vue` and `SlideGrid.vue` both type their `ensureGroupMaterialized`
 * prop against this shape.
 */
export interface EnsureGroupMaterializedResult {
  entries: GroupSlideEntry[]
  sourceSignature?: string
}

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "deleteSlideConfirmBody")
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

/**
 * Extracts a human-readable filename from a Firebase Storage download URL,
 * structurally mirroring `bedAudioLabel` above (split off the query string,
 * `decodeURIComponent`, take the last path segment, try/catch). Defined as
 * its own function rather than reusing `bedAudioLabel` because the fallback
 * text differs — a background is never "Group music" — per 33-UI-SPEC.md's
 * Task 1 behavior contract.
 */
export function backgroundImageLabel(url: string): string {
  try {
    const withoutQuery = url.split('?')[0] ?? url
    const decoded = decodeURIComponent(withoutQuery)
    const segments = decoded.split('/')
    const last = segments[segments.length - 1]
    return last && last.trim() ? last : 'Background image'
  } catch {
    return 'Background image'
  }
}

/** Fixed enum labels, verbatim from 33-UI-SPEC.md § Copywriting Contract — never user-supplied text. */
const MENU_ITEM_LABELS: Record<MenuItemKey, string> = {
  'edit-details': 'Edit details',
  'edit-in-song': 'Edit in song',
  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "MENU_ITEM_LABELS['edit-in-scripture'] relabeling history")
  'edit-in-scripture': 'Congregational Reading',
  duplicate: 'Duplicate',
  delete: 'Delete Slide',
}

function menuItemToneFor(key: MenuItemKey): MenuItem['tone'] {
  // 34-07: 'edit-in-scripture' no longer routes away — it opens an editor in
  // place, so it takes the default tone like 'edit-details' rather than the
  // navigation tone. 'edit-in-song' is unchanged: it still routes away.
  if (key === 'edit-in-song') return 'nav'
  if (key === 'delete') return 'destructive'
  return 'default'
}

function menuItem(key: MenuItemKey): MenuItem {
  return { key, label: MENU_ITEM_LABELS[key], tone: menuItemToneFor(key) }
}

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/slideDisplay.ts, "slideActionMenuItems")
export function slideActionMenuItems(
  entry: GroupSlideEntry,
  planItemKind: SlotKind | undefined,
  canMutate: boolean,
): MenuItem[] {
  const kind = entry.sourceRef.kind
  switch (kind) {
    case 'lyric':
    case 'copyright':
      // P-03/R054: always inside a SONG group — canMutate is never consulted.
      return [menuItem('edit-details'), menuItem('edit-in-song')]

    case 'scripture': {
      // The congregational-reading action moved OUT of the 3-dot menu to a
      // discoverable group-level button beside "+ Add background for this group"
      // (owner request — the menu item was too buried). See SlideGrid.vue's
      // `edit-congregational` emit → SlidesTab's `onEditCongregational`, which
      // relays to the same editor `requestEditInScripture` opens. The
      // 'edit-in-scripture' key + relay are retained for that button; only the
      // menu no longer offers it.
      const items = [menuItem('edit-details')]
      if (canMutate) items.push(menuItem('duplicate'), menuItem('delete'))
      return items
    }

    // D2 (260805-bvo): kept as its own case even though it now returns the
    // same list as the imported/video branch below — deliberately, because
    // `text` is the one kind whose body the drawer edits and whose contract
    // is the likeliest to diverge again.
    case 'text': {
      const items = [menuItem('edit-details')]
      if (canMutate) items.push(menuItem('duplicate'), menuItem('delete'))
      return items
    }

    case 'imported':
    case 'video': {
      const items = [menuItem('edit-details')]
      if (canMutate) items.push(menuItem('duplicate'), menuItem('delete'))
      return items
    }

    default:
      // Backstop: an unrecognised/future sourceRef.kind falls back to the
      // single most conservative item, never a permissive branch.
      return [menuItem('edit-details')]
  }
}
