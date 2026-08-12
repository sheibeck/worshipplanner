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
import { slotLabel } from '@/utils/slotTypes'
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
  // ANNOUNCEMENTS and MISC reuse PRAYER's neutral family — no new colour
  // token introduced for this phase.
  ANNOUNCEMENTS: 'bg-gray-800 text-gray-400 border-gray-700',
  MISC: 'bg-gray-800 text-gray-400 border-gray-700',
  // Reuses SongBadge's Type-3 amber exactly.
  IMPORTED: 'bg-amber-900/50 text-amber-300 border-amber-800',
}

/**
 * Static, fully-spelled-out failure-reason → human-sentence lookup — the
 * copywriting-contract table from 42-UI-SPEC.md, reproduced verbatim, in the
 * same shape as `KIND_BADGE_CLASSES` above: a complete literal `Record`,
 * never a value built by string interpolation. The backend's `failureReason`
 * slug space is open (`functions/src/index.ts` can add a new reason without a
 * client deploy), so this table is deliberately NOT exhaustive — see
 * `RENDER_FAILURE_FALLBACK_SENTENCE` and `renderFailureSentence` below for
 * the arm that covers everything this table doesn't name, including
 * `incomplete-render` (a real backend value the UI-SPEC's contract
 * deliberately leaves unmapped; see 42-06-PLAN.md's recorded decision).
 */
export const RENDER_FAILURE_SENTENCES: Record<string, string> = {
  'missing-render-doc': "This deck's render record is missing.",
  'missing-storage-path': "The rendered file couldn't be located.",
}

/** The fallback sentence `renderFailureSentence` returns for any input not a key of `RENDER_FAILURE_SENTENCES` — including `undefined`, the empty string, and any value a tampered document might carry (T-42-04). */
export const RENDER_FAILURE_FALLBACK_SENTENCE = "This slide couldn't be rendered."

/**
 * The ONE sanctioned route from a render document's raw `failureReason` slug
 * to the DOM (`SlideBase.renderFailureReason`'s own doc comment names this
 * function as its only legal consumer). Never render `failureReason` any
 * other way.
 *
 * The fallback arm is written out explicitly rather than left to
 * exhaustiveness — the same defensive posture `slideActionMenuItems`'s
 * `default` arm takes below, and for the same reason: the key space here is
 * open. This closes off T-42-04 structurally — whatever string a tampered
 * render document carries, including markup, the return value is always one
 * of exactly three authored sentences, and the input string itself never
 * appears in the output.
 */
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
    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'MISC':
    case 'IMPORTED':
      return slotLabel(slot)
  }
}

/**
 * Readable, natural-case speaker name for a congregational section's
 * `speaker` enum value (Phase 38-03, widened Phase 47 R095) — `'LEADER'` ->
 * `'Leader'`, `'CONGREGATION'` -> `'Congregation'`, `'ALL'` -> `'All'`. This
 * module already exists so the rail and the grid never fork the kind-badge
 * vocabulary; the three speaker words are exactly that kind of vocabulary,
 * so this is the ONE producer of them — `slideContentLabel`'s eyebrow
 * (uppercased from this), `slideFooterLabel`'s footer, and
 * `EditSlideDrawer.vue`'s speaker control all read through this rather than
 * re-deriving the spelling. Widening this single 3-way match is what
 * propagates 'ALL' -> 'All' to every one of those call sites automatically.
 */
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
      // R047: a Reference-state slide (no congregational section) defaults
      // to reference-only (empty text) — return just the reference, with no
      // trailing blank line. A Congregational-state section slide (Phase
      // 38-01/38-02) carries that section's own words in `text`, so the
      // joined form applies for that slide only.
      //
      // R124 (Phase 55): the slideshow preview no longer auto-appends the
      // Bible version (ESV/NLT) to scripture slides — the owner wants clean
      // scripture when presenting. This is a RENDER-ONLY change: the
      // provenance helpers (scriptureAttribution/resolveTranslationSource) and
      // the per-slide `translationSource` field are UNTOUCHED (R092 capture-
      // once immutability preserved), and the version can still be added by
      // typing it into the slide's own editable text. Nothing to attribute is
      // rendered here anymore.
      //
      // R105 (Phase 49): the reference now lives on its OWN dedicated slide
      // (the assembler emits it as a synthetic leading slide), so NO section
      // slide prefixes the reference — the gate is simply `!slide.section`. A
      // Reference-state slide (no `section`) always shows its reference; every
      // congregational section slide returns just its own words.
      // This gate applies ONLY to this prefix — `slideContentLabel`'s eyebrow
      // and `slideFooterLabel`'s footer below are NOT reference-gated; they
      // name the speaker per-slide regardless of position.
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
  'edit-in-song': 'Edit in song',
  // 34-07 (owner UAT F1): this key now opens the congregational-reading
  // editor in place (a modal over the Slides tab), not a navigation away
  // from it — 'edit-in-song' stays 'nav' below because IT still routes to
  // the song editor. The label is relabelled to name what actually opens.
  //
  // Relabelled again 2026-08-05 (owner): "Edit scripture text" promised
  // something the destination does not offer. What opens is the modal titled
  // "Congregational Reading" — enter a reference, Fetch, AI-split, and toggle
  // each section's speaker. There is deliberately NO free-text scripture
  // override anywhere in it (34-07: the owner was shown the D-13/D-15
  // shadow-copy tension and declined it), so a label promising text editing
  // described a feature that does not and will not exist here. Named for the
  // purpose instead — the owner's words were "it's simply a place to make it
  // congregational reading".
  //
  // Kept as an action phrase because every sibling here is one ('Edit
  // details', 'Duplicate', 'Delete Slide'). "Set up" reads slightly oddly when
  // revisiting a reading that already exists — accepted, because the modal's
  // own heading names the state correctly once open, and the previous label
  // was actively wrong on every visit rather than mildly imprecise on some.
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

/**
 * Pure per-kind 3-dot slide action menu item list (R063). Synchronous, no
 * store/composable reads — follows this file's established pure-helper
 * convention (`KIND_BADGE_CLASSES`, `deleteSlideConfirmBody`). Item order is
 * fixed and identical across kinds for shared items: edit-details, then the
 * navigation item (where one exists), then duplicate, then delete.
 *
 * ★ Deliberate divergence from 33-UI-SPEC.md §3's stated 4-parameter
 * signature: the fourth parameter `canMutateBackground` is NOT threaded
 * through. Nothing in §3's table branches on it — per §11, "Edit details" is
 * unconditional, since the drawer it opens is a view affordance too — so it
 * would be an unused parameter the lint config's default `args: 'after-used'`
 * rule would flag. Do not "restore" it; background-mutation gating lives
 * entirely inside `EditSlideDrawer.vue`'s own `canMutateBackground` computed.
 *
 * ★ D2 (260805-bvo) — the Hymn carve-out is REVERSED, on the owner's explicit
 * authority, superseding 33-UI-SPEC.md §3 row 3a and §4. This paragraph used
 * to describe an anti-shadow-copy discriminator (`sourceRef.body !==
 * undefined` combined with `planItemKind`) that withheld a second edit
 * affordance from a HYMN group's auto-derived pristine text slide. That
 * discriminator, and the second affordance it gated, are both gone. Owner
 * verbatim: *"This only non-editable thing should be Song. Everything else
 * can be editable. Hymns are a special thing for now only. In the future
 * we'll get rid of that item and just make them regular songs again, but not
 * yet."* Every `text` entry now returns the SAME menu regardless of whether
 * its body is defined or which plan item kind it belongs to — including a
 * HYMN group's auto-derived slide, which can now diverge from its Service
 * Order Hymn fields when edited here. The owner accepts that divergence as
 * temporary (T-bvo-03). R054/P-03 is explicitly NOT dropped by this reversal
 * — see the paragraph below.
 *
 * ★ `planItemKind` is now UNCONSULTED by every branch below — kept as part
 * of R063's signature rather than removed, since removing it would churn
 * eight call sites for no behavioural gain: the root tsconfigs do not set
 * `noUnusedParameters`, and this repo's ESLint runs the default `args:
 * 'after-used'`, under which an unused parameter followed by a used one
 * (`canMutate`) is not reported. If tooling ever does flag it, prefix it
 * with an underscore rather than changing the signature's arity.
 *
 * ★ Backstop: when `sourceRef.kind` matches no known union member, the
 * `default` arm returns `[{ key: 'edit-details', ... }]` — the most
 * conservative list, never the most permissive — implemented via an explicit
 * `default` rather than relying on exhaustiveness alone, since a future union
 * member would otherwise fall through to nothing.
 *
 * ★ Prohibition P-03 is structural here: `lyric` and `copyright` entries are
 * always inside a SONG group (R054), and their rows never include
 * `duplicate` or `delete` under any argument combination — not even when
 * `canMutate` is true. Both branches return immediately after pushing their
 * two fixed items, so `canMutate` is never consulted for them. D2 does not
 * touch this: those two branches are unchanged by the reversal above.
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
