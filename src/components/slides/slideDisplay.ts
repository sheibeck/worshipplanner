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
import { formatScriptureReference, scriptureRefFromSlot } from '@/utils/scripture'

/** One key in the 3-dot slide action menu (33-UI-SPEC.md § Copywriting Contract). */
export type MenuItemKey =
  | 'edit-details'
  | 'edit-lyrics'
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
      // R047: a scripture slide defaults to reference-only (empty text) —
      // return just the reference, with no trailing blank line. Phase 34's
      // congregational reading feature will populate `text` again, at which
      // point the joined form below applies.
      return slide.text ? `${slide.reference}\n${slide.text}` : slide.reference
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
  'edit-lyrics': 'Edit lyrics',
  'edit-in-song': 'Edit in song',
  // 34-07 (owner UAT F1): this key now opens the congregational-reading
  // editor in place (a modal over the Slides tab), not a navigation away
  // from it — 'edit-in-song' stays 'nav' below because IT still routes to
  // the song editor. The label is relabelled to name what actually opens.
  'edit-in-scripture': 'Edit scripture text',
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

/**
 * Pure per-kind 3-dot slide action menu item list (R063), matching
 * 33-UI-SPEC.md § Phase-Specific Component Contracts §3's table exhaustively,
 * including row 3a's Hymn refinement. Synchronous, no store/composable reads —
 * follows this file's established pure-helper convention (`KIND_BADGE_CLASSES`,
 * `deleteSlideConfirmBody`). Item order is fixed and identical across kinds for
 * shared items: edit-details, then edit-lyrics, then the navigation item, then
 * duplicate, then delete.
 *
 * ★ Deliberate divergence from §3's stated 4-parameter signature: the fourth
 * parameter `canMutateBackground` is NOT threaded through. Nothing in §3's
 * table branches on it — per §11, "Edit details" is unconditional, since the
 * drawer it opens is a view affordance too — so it would be an unused
 * parameter the lint config's default `args: 'after-used'` rule would flag.
 * Do not "restore" it; background-mutation gating lives entirely inside
 * `EditSlideDrawer.vue`'s own `canMutateBackground` computed.
 *
 * ★ The Hymn discriminator (§3 row 3a): `sourceRef.kind` ALONE cannot express
 * "hand-authored". A HYMN group's auto-derived text slide is also `kind:
 * 'text'`, created by `slideGroupMaterializer.ts` with NO `body` at all, while
 * `SlideGrid.vue`'s add-slide path always sets `body: ''`. The discriminator
 * is therefore `entry.sourceRef.body !== undefined` combined with
 * `planItemKind`: offer `edit-lyrics` when the body is defined (any plan item
 * kind), or when the body is undefined and the plan item kind is `PRAYER` or
 * `MESSAGE`. Withhold it when the body is undefined and every other case
 * (including `HYMN` and `undefined` itself) — that slide's canonical source is
 * the Service Order tab's own Hymn fields, and a second silently-diverging
 * editor here would create exactly the shadow copy the song/scripture
 * read-only routing exists to prevent.
 *
 * ★ Backstops: when `planItemKind` is `undefined`, the conservative branch
 * (no `edit-lyrics`) is taken automatically by the same condition above — a
 * partially-resolved plan item never grants an affordance the phase
 * deliberately withholds. When `sourceRef.kind` matches no known union
 * member, the `default` arm returns `[{ key: 'edit-details', ... }]` — the
 * most conservative list, never the most permissive — implemented via an
 * explicit `default` rather than relying on exhaustiveness alone, since a
 * future union member would otherwise fall through to nothing.
 *
 * ★ Prohibition P-03 is structural here: `lyric` and `copyright` entries are
 * always inside a SONG group (R054), and their rows never include
 * `edit-lyrics`, `duplicate` or `delete` under any argument combination — not
 * even when `canMutate` is true. Both branches return immediately after
 * pushing their two fixed items, so `canMutate` is never consulted for them.
 */
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
      const items = [menuItem('edit-details'), menuItem('edit-in-scripture')]
      if (canMutate) items.push(menuItem('duplicate'), menuItem('delete'))
      return items
    }

    case 'text': {
      const items = [menuItem('edit-details')]
      const hasBody = entry.sourceRef.body !== undefined
      const offersEditLyrics = hasBody || planItemKind === 'PRAYER' || planItemKind === 'MESSAGE'
      if (offersEditLyrics) items.push(menuItem('edit-lyrics'))
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
