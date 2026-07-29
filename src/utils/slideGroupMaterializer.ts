/**
 * Slide-group materializer and rebuild engine (Phase 24, D-02/D-05; renamed
 * `reconcile*` -> `rebuild*` in Phase 30 when the confirm-gated reconciler
 * was replaced with one unconditional, idempotent rebuild per slot kind).
 *
 * This module is PURE: it performs no Firestore reads and touches no Pinia
 * store or Vue reactivity — callers (the composable) load data, decide, and
 * write. Mirrors `slideshowAssembler.ts`'s stated purity contract.
 *
 * `deriveGroupEntries` is the ONLY place a `GroupSlideEntry.id` is ever
 * minted (via `crypto.randomUUID()`) — the assembler (24-04) must never
 * regenerate one, since `PresentationViewer.vue` keys its per-slide
 * `AudioPlayer`/`VideoPlayer` child components on this id (Phase 23's WR-02
 * contract).
 */
import type { ServiceSlot, SongSlot, ScriptureSlot, ImportedSlot } from '@/types/service'
import type { SlideGroup, GroupSlideEntry, SourceRef, SlideGroupInput } from '@/types/slideGroup'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import { formatScriptureReference, scriptureRefFromSlot } from '@/utils/scripture'

/**
 * Derives a slide group's structure from its slot's canonical source.
 * Reproduces `assembleSlideshow`'s CURRENT per-kind emission order exactly —
 * a group derived today must produce a slideshow byte-identical to what the
 * pre-group assembler produced. Slide TEXT is never read or stored here
 * (D-02); only structural references (`sourceRef`) are minted.
 *
 * This is the ONLY place a `GroupSlideEntry.id` is ever minted.
 */
export function deriveGroupEntries(slot: ServiceSlot, inputs: AssemblyInputs): GroupSlideEntry[] {
  switch (slot.kind) {
    case 'SONG': {
      const songId = slot.songId
      if (!songId) return []
      const lyrics = inputs.songLyricsById.get(songId)
      if (!lyrics) return []

      // The lyrics document's performanceOrder is the single source of
      // truth for a song's slide order (R035/D-03) — no precedence chain.
      const order = lyrics.performanceOrder
      const entries: GroupSlideEntry[] = []
      let idx = 0

      entries.push({ id: crypto.randomUUID(), order: idx++, sourceRef: { kind: 'copyright', songId } })

      for (const sectionId of order) {
        const section = lyrics.sections.find((s) => s.id === sectionId)
        if (!section) continue
        entries.push({
          id: crypto.randomUUID(),
          order: idx++,
          sourceRef: { kind: 'lyric', songId, sectionId: section.id },
        })
      }

      entries.push({ id: crypto.randomUUID(), order: idx++, sourceRef: { kind: 'copyright', songId } })

      return entries
    }

    case 'SCRIPTURE': {
      // R047: exactly ONE reference-only entry, derived from the slot's OWN
      // reference fields — the passage the user typed on the Service Order
      // tab. No reading document, no ESV fetch, no id to link: entering or
      // changing the reference IS the source change, so the slide appears and
      // is replaced the same way a song swap replaces a song's slides.
      //
      // The ref carries no payload. `derivedIdentityKey` treats the ref KIND
      // alone as this group's identity, which is what lets a passage change
      // carry the stored entry's id/audio forward through
      // `carryStoredDerivedEntries` instead of minting a fresh id and
      // silently dropping attached audio.
      if (!scriptureRefFromSlot(slot)) return []
      return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'scripture' as const } }]
    }

    case 'IMPORTED': {
      if (!slot.importId) return []
      const deck = inputs.importedDecksById.get(slot.importId)
      if (!deck) return []

      return deck.slides.map((innerSlide, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: { kind: 'imported' as const, importId: slot.importId!, innerSlideId: innerSlide.id },
      }))
    }

    case 'PRAYER':
    case 'MESSAGE':
    case 'HYMN':
      return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'text' } }]
  }
}

/**
 * Cheap change-detection proxy (RESEARCH.md Open Question 3): the source's
 * slide count prefixed onto its joined per-slide text (or image url,
 * whichever the inner slide carries), so both an added/removed slide AND an
 * equal-count text edit are detected (Assumptions Log A2). Returns
 * `undefined` for kinds with no external source (`text`). SONG never uses
 * this for reconciliation (it diffs by `sectionId` instead), but a signature
 * is still computed here for storage parity across group documents.
 */
export function sourceSignature(slot: ServiceSlot, inputs: AssemblyInputs): string | undefined {
  switch (slot.kind) {
    case 'SONG': {
      const songId = slot.songId
      if (!songId) return undefined
      const lyrics = inputs.songLyricsById.get(songId)
      if (!lyrics) return undefined

      const order = lyrics.performanceOrder
      const texts: string[] = []
      for (const sectionId of order) {
        const section = lyrics.sections.find((s) => s.id === sectionId)
        if (section) texts.push(section.lines.join(' '))
      }
      return `${texts.length}:${texts.join('|')}`
    }

    case 'SCRIPTURE': {
      // R047: the slot's reference IS the source, so the formatted reference
      // is the whole signature — it changes exactly when the rendered slide
      // would change.
      const scriptureRef = scriptureRefFromSlot(slot)
      return scriptureRef ? formatScriptureReference(scriptureRef) : undefined
    }

    case 'IMPORTED': {
      if (!slot.importId) return undefined
      const deck = inputs.importedDecksById.get(slot.importId)
      if (!deck) return undefined
      const texts = deck.slides.map((s) => (s.contentKind === 'image' ? s.imageUrl : s.body))
      return `${texts.length}:${texts.join('|')}`
    }

    case 'PRAYER':
    case 'MESSAGE':
    case 'HYMN':
      return undefined
  }
}

/**
 * Builds the input a group is first materialized from. Sets `id`/`slotId` to
 * `slot.id` (D-01's anchor), derives `slides`, and computes `sourceSignature`.
 * The D-05 slot-media migration (copying a legacy slot `audioUrl`/`videoUrl`
 * onto the group bed) is gone entirely under D-19 — the slide area has never
 * been deployed, so there is no legacy slot media to carry forward. A newly
 * materialized group always starts with no bed; `setGroupBedMedia` is the
 * only way one is ever set.
 */
export function buildInitialGroup(slot: ServiceSlot, serviceId: string, inputs: AssemblyInputs): SlideGroupInput {
  const signature = sourceSignature(slot, inputs)
  return {
    id: slot.id,
    slotId: slot.id,
    serviceId,
    slides: deriveGroupEntries(slot, inputs),
    ...(signature !== undefined ? { sourceSignature: signature } : {}),
  }
}

/**
 * True when an entry's `sourceRef` is NOT something the current slot config
 * would ever regenerate on its own (D-17 ripple). No slot kind derives a
 * `video` entry — it only ever arrives by user action (a drop, in 25-06) — so
 * a video entry is always non-derivable. A `text` entry carrying authored
 * content (title and/or body) is likewise non-derivable: `deriveGroupEntries`
 * only ever mints a content-free `{ kind: 'text' }` ref for PRAYER/MESSAGE/
 * HYMN, so an authored one can only exist because a user added it.
 *
 * This is the predicate `survivingEntries` consults so EVERY rebuild path —
 * SONG, SCRIPTURE and IMPORTED alike — splices a user's dropped video or
 * hand-authored slide back in rather than silently losing it (T-30-02-01).
 * Phase 30 deleted the confirm dialog that used to protect this by stalling;
 * this predicate is what protects it now, by splicing instead.
 */
function isNonDerivableEntry(entry: GroupSlideEntry): boolean {
  const ref = entry.sourceRef
  if (ref.kind === 'video') return true
  if (ref.kind === 'text' && (ref.title !== undefined || ref.body !== undefined)) return true
  return false
}

/**
 * The one place any rebuild path decides what a user added by hand — every
 * `isNonDerivableEntry` entry currently stored on the group, in stored
 * order. Every `rebuild*Group` function splices this back into its fresh
 * derivation so a song swap, a passage change, or a deck re-import can never
 * silently drop a dropped video or a hand-authored slide (T-30-02-01).
 */
function survivingEntries(group: SlideGroup): GroupSlideEntry[] {
  return group.slides.filter(isNonDerivableEntry)
}

/**
 * The content-stable identity a stored entry of an unstable-id kind
 * (scripture, imported) is matched against by `carryStoredDerivedEntries`.
 * Returns `null` for kinds that either have their own dedicated identity
 * scheme (`lyric`/`copyright` diff by `sectionId` in `rebuildSongGroup`) or
 * are never derived at all (`text`, `video` — always non-derivable).
 *
 * Scripture returns the constant `'scripture'` regardless of any
 * `innerSlideId` the ref still carries: R047 narrows a scripture group to
 * exactly ONE derived entry, so the ref's KIND alone is its identity — this
 * is what lets a passage change or a reading swap carry the stored entry's
 * id, label, notes and audio forward onto the new reference (T-30-02-03).
 * Imported entries key on `importId` AND `innerSlideId` together — a deck
 * has no reference-only collapse, so each inner slide keeps its own
 * identity (before this phase, the whole group was gated by a stored
 * signature instead; this generalizes survival down to the entry level).
 */
function derivedIdentityKey(ref: SourceRef): string | null {
  switch (ref.kind) {
    case 'scripture':
      return 'scripture'
    case 'imported':
      return `imported:${ref.importId}:${ref.innerSlideId}`
    case 'lyric':
    case 'copyright':
    case 'text':
    case 'video':
      return null
  }
}

/** Renumbers a slide list to contiguous `order` values starting at 0. */
function renumbered(entries: GroupSlideEntry[]): GroupSlideEntry[] {
  return entries.map((entry, index) => ({ ...entry, order: index }))
}

/** Length-plus-per-index JSON comparison — the same equality `rebuildSongGroup`'s additive merge already used, generalized for every rebuild path's idempotence assertion. */
function slidesEqual(a: GroupSlideEntry[], b: GroupSlideEntry[]): boolean {
  return a.length === b.length && a.every((entry, index) => JSON.stringify(entry) === JSON.stringify(b[index]))
}

/**
 * Generalized survival+carry for the two unstable-id source kinds (scripture,
 * imported deck) — the exact positional-consumption-plus-last-occurrence-
 * surplus shape `rebuildSongGroup`'s additive merge already uses for lyric
 * sections (28-03's fix for the 2->4->8->16 compounding defect; 26-09's fix
 * for the Map-keying defect that silently dropped a duplicated entry),
 * generalized here so idempotence is provable on EVERY rebuild path, not
 * just SONG's (T-30-02-02).
 *
 * `fresh` is this pass's freshly DERIVED entries (`deriveGroupEntries`'s
 * output). A stored entry whose `derivedIdentityKey` appears one or more
 * times in `fresh` is CARRIED forward positionally: occurrence `i` of a key
 * in `fresh` consumes the `i`-th stored entry for that key — keeping the
 * stored entry's id/label/notes/audio/loop, but taking the FRESH entry's
 * `sourceRef` so a changed passage or a re-import renders through the SAME
 * slide (T-30-02-03). Any stored entries beyond a key's occurrence count in
 * `fresh` are that key's surplus and are emitted once, immediately after the
 * key's LAST occurrence, each carrying that occurrence's fresh `sourceRef` —
 * never re-emitted on an earlier occurrence, mirroring 26-09's
 * duplicate-survival guarantee for a kind with no fresh-side multiplicity
 * concept of its own. A stored entry whose key never appears in `fresh` at
 * all (an obsolete imported `innerSlideId` a re-import no longer produces)
 * is DROPPED — it is source-derived and the source no longer produces it;
 * only `isNonDerivableEntry` entries are user work, and those always survive
 * via `survivingEntries`, not this function.
 */
function carryStoredDerivedEntries(fresh: GroupSlideEntry[], group: SlideGroup): GroupSlideEntry[] {
  const storedByKey = new Map<string, GroupSlideEntry[]>()
  for (const entry of group.slides) {
    const key = derivedIdentityKey(entry.sourceRef)
    if (key === null) continue
    const existing = storedByKey.get(key)
    if (existing) {
      existing.push(entry)
    } else {
      storedByKey.set(key, [entry])
    }
  }

  const occurrenceTotals = new Map<string, number>()
  for (const entry of fresh) {
    const key = derivedIdentityKey(entry.sourceRef)
    if (key === null) continue
    occurrenceTotals.set(key, (occurrenceTotals.get(key) ?? 0) + 1)
  }
  const occurrencesSeen = new Map<string, number>()

  const carried: GroupSlideEntry[] = []
  for (const freshEntry of fresh) {
    const key = derivedIdentityKey(freshEntry.sourceRef)
    if (key === null) {
      carried.push(freshEntry)
      continue
    }

    const stored = storedByKey.get(key)
    const occurrenceIndex = occurrencesSeen.get(key) ?? 0
    occurrencesSeen.set(key, occurrenceIndex + 1)

    if (stored && occurrenceIndex < stored.length) {
      carried.push({ ...stored[occurrenceIndex]!, sourceRef: freshEntry.sourceRef })
    } else {
      carried.push(freshEntry)
    }

    const totalOccurrences = occurrenceTotals.get(key)!
    const isLastOccurrence = occurrenceIndex + 1 === totalOccurrences
    if (isLastOccurrence && stored && stored.length > totalOccurrences) {
      for (let surplusIndex = totalOccurrences; surplusIndex < stored.length; surplusIndex++) {
        carried.push({ ...stored[surplusIndex]!, sourceRef: freshEntry.sourceRef })
      }
    }
  }

  return carried
}

function isLyricEntry(
  entry: GroupSlideEntry,
): entry is GroupSlideEntry & { sourceRef: Extract<SourceRef, { kind: 'lyric' }> } {
  return entry.sourceRef.kind === 'lyric'
}

function isCopyrightEntry(
  entry: GroupSlideEntry,
): entry is GroupSlideEntry & { sourceRef: Extract<SourceRef, { kind: 'copyright' }> } {
  return entry.sourceRef.kind === 'copyright'
}

/**
 * Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 /
 * Pitfall 4): diffs the fresh resolved section order against the stored
 * entries by `sourceRef.sectionId` — the ONE content-stable key available for
 * songs, since `ccliParser.ts` mints ids by slugifying labels. A section
 * newly present in the source is INSERTED; a stored entry whose section
 * still resolves is KEPT BY VALUE (never rebuilt — only `order` may be
 * renumbered); a stored entry whose section no longer resolves is RETAINED,
 * never deleted. The leading/trailing `copyright` entries are matched by
 * kind and position, never by `sectionId`, and are never duplicated.
 *
 * A full song-IDENTITY swap (CR-01) is detected FIRST, before any of the
 * above additive logic runs: if the group's stored lyric/copyright entries
 * reference a `songId` different from the slot's CURRENT `songId`, the slot
 * was reassigned to a different song entirely — a source-identity change,
 * not a section-level edit within the same song. The additive by-sectionId
 * merge is only valid for edits WITHIN the same song; running it across a
 * song swap would blend the old song's copyright/lyric entries with the new
 * song's (every old entry's `sectionId` looks "unresolvable" against the new
 * song and gets retained forever). Phase 30 makes this branch UNCONDITIONAL —
 * there is no confirm gate left — but the group's surviving non-derivable
 * entries (a dropped video, a hand-authored slide) still splice in ahead of
 * the trailing copyright, the exact position the additive merge below
 * already uses for them (T-30-02-01).
 */
export function rebuildSongGroup(group: SlideGroup, slot: SongSlot, inputs: AssemblyInputs): RebuildResult {
  const songId = slot.songId
  if (!songId) return { changed: false, slides: group.slides }

  const storedSongIds = new Set(
    group.slides
      .filter(
        (e): e is GroupSlideEntry & { sourceRef: Extract<SourceRef, { kind: 'lyric' | 'copyright' }> } =>
          e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright',
      )
      .map((e) => e.sourceRef.songId),
  )
  if (storedSongIds.size > 0 && !storedSongIds.has(songId)) {
    const freshEntries = deriveGroupEntries(slot, inputs)
    // Guard (T-30-02-04): the new song's lyrics have not loaded yet — never
    // blank the group as a side effect of a loading race. Today's pre-Phase-30
    // code had no such guard here.
    if (freshEntries.length === 0) return { changed: false, slides: group.slides }

    // `deriveGroupEntries`'s SONG case always emits leading + trailing
    // copyright around zero or more lyric entries, so the last index is
    // always the trailing copyright — splice surviving entries ahead of it,
    // the same position the additive merge below already uses for them.
    const trailingCopyrightIndex = freshEntries.length - 1
    const merged = [
      ...freshEntries.slice(0, trailingCopyrightIndex),
      ...survivingEntries(group),
      ...freshEntries.slice(trailingCopyrightIndex),
    ]
    const slides = renumbered(merged)
    return { changed: !slidesEqual(slides, group.slides), slides }
  }

  const lyrics = inputs.songLyricsById.get(songId)
  if (!lyrics) return { changed: false, slides: group.slides }

  const freshOrder = lyrics.performanceOrder.filter((sectionId) =>
    lyrics.sections.some((section) => section.id === sectionId),
  )
  const freshSectionIds = new Set(freshOrder)

  const storedLyricEntries = group.slides.filter(isLyricEntry)
  // Phase 26-09 Task 1 + Plan 28-03 (D-02): indexed as an ARRAY per
  // sectionId, never collapsed to a single entry, and consumed POSITIONALLY
  // below rather than re-emitted wholesale.
  //
  // Why an array (26-09): the panel's Duplicate action can create a SECOND
  // stored entry referencing the SAME sectionId (a copy of a song-section
  // slide) — a map keyed one-entry-per-section would keep only the last
  // entry seen for a repeated key, so a copy would be silently swallowed the
  // very next time this song's sections changed, with no confirm gate,
  // because this additive merge never confirm-gates (it is the same path a
  // plain within-song edit takes).
  //
  // Why positional consumption (D-02, this plan): once a section can be
  // REFERENCED more than once in the order (a repeated chorus), the merge
  // loop below walks `freshOrder` and reaches this section's key once per
  // occurrence. Re-emitting the WHOLE array on every occurrence — the
  // pre-fix behavior — multiplies entries on every reconciliation pass (a
  // chorus with 2 stored entries and 2 occurrences would yield 4, then 8,
  // then 16). Occurrence `i` of a section now consumes stored entry `i`;
  // any stored entries beyond the section's occurrence count are surplus and
  // are emitted once, immediately after the section's LAST occurrence. When
  // occurrences and stored entries are equal in count there is no surplus
  // and no growth; when a section has exactly one occurrence and two stored
  // entries (the 26-09 Duplicate case), that occurrence is also the last, so
  // both entries still emit adjacently — byte-identical to what 26-09
  // shipped.
  const storedBySectionId = new Map<string, GroupSlideEntry[]>()
  for (const entry of storedLyricEntries) {
    const existing = storedBySectionId.get(entry.sourceRef.sectionId)
    if (existing) {
      existing.push(entry)
    } else {
      storedBySectionId.set(entry.sourceRef.sectionId, [entry])
    }
  }

  const storedCopyrightEntries = group.slides.filter(isCopyrightEntry).sort((a, b) => a.order - b.order)
  const leadingCopyright = storedCopyrightEntries[0]
  const trailingCopyright =
    storedCopyrightEntries.length >= 2 ? storedCopyrightEntries[storedCopyrightEntries.length - 1] : undefined

  const merged: GroupSlideEntry[] = []
  let order = 0

  merged.push(
    leadingCopyright
      ? { ...leadingCopyright, order: order++ }
      : { id: crypto.randomUUID(), order: order++, sourceRef: { kind: 'copyright', songId } },
  )

  // Occurrence count per section id across the whole fresh order — how many
  // times a repeated section appears, used to find each section's LAST
  // occurrence (where its stored surplus, if any, is emitted) and to know
  // when a stored array runs out and a fresh entry must be minted instead.
  const occurrenceTotals = new Map<string, number>()
  for (const sectionId of freshOrder) {
    occurrenceTotals.set(sectionId, (occurrenceTotals.get(sectionId) ?? 0) + 1)
  }
  const occurrencesSeen = new Map<string, number>()

  for (const sectionId of freshOrder) {
    const stored = storedBySectionId.get(sectionId)
    const occurrenceIndex = occurrencesSeen.get(sectionId) ?? 0
    occurrencesSeen.set(sectionId, occurrenceIndex + 1)

    if (stored && occurrenceIndex < stored.length) {
      merged.push({ ...stored[occurrenceIndex]!, order: order++ })
    } else {
      merged.push({ id: crypto.randomUUID(), order: order++, sourceRef: { kind: 'lyric', songId, sectionId } })
    }

    const totalOccurrences = occurrenceTotals.get(sectionId)!
    const isLastOccurrence = occurrenceIndex + 1 === totalOccurrences
    if (isLastOccurrence && stored && stored.length > totalOccurrences) {
      for (let surplusIndex = totalOccurrences; surplusIndex < stored.length; surplusIndex++) {
        merged.push({ ...stored[surplusIndex]!, order: order++ })
      }
    }
  }

  // Retained-but-unresolvable entries — kept relative to each other, appended
  // after the resolvable run and before the trailing copyright (Pitfall 4).
  for (const entry of storedLyricEntries) {
    if (!freshSectionIds.has(entry.sourceRef.sectionId)) {
      merged.push({ ...entry, order: order++ })
    }
  }

  // D-17: any entry whose sourceRef is neither lyric nor copyright (a video
  // entry appended by a drop, or a user-authored text entry) is not part of
  // the lyric/copyright rebuild above and would otherwise silently disappear.
  // Carry each through by value, preserving stored relative order, appended
  // after the retained-but-unresolvable lyric run and before the trailing
  // copyright entry — the exact position the rule above already uses.
  const otherEntries = group.slides.filter(
    (entry) => entry.sourceRef.kind !== 'lyric' && entry.sourceRef.kind !== 'copyright',
  )
  for (const entry of otherEntries) {
    merged.push({ ...entry, order: order++ })
  }

  merged.push(
    trailingCopyright
      ? { ...trailingCopyright, order: order++ }
      : { id: crypto.randomUUID(), order: order++, sourceRef: { kind: 'copyright', songId } },
  )

  const changed =
    merged.length !== group.slides.length ||
    merged.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(group.slides[index]))

  return changed ? { changed: true, slides: merged } : { changed: false, slides: group.slides }
}

/** Two-field result shape shared by every `rebuild*Group` function, dispatched via {@link rebuildGroup}. Phase 30 deleted the old six-field confirm-shaped result along with the confirm gate itself — every rebuild now decides and writes unconditionally. */
export interface RebuildResult {
  changed: boolean
  slides: GroupSlideEntry[]
}

/**
 * Unconditional rebuild for the two unstable-id source kinds (scripture,
 * imported deck). Derives fresh; if the derivation is empty (source not yet
 * loaded), returns the group untouched with `changed: false` (T-30-02-04) —
 * never blanking a group as a side effect of a loading race. Otherwise the
 * new slides are `carryStoredDerivedEntries`'s carried derived entries
 * followed by the group's surviving non-derivable entries, renumbered.
 * Deliberately does NOT gate on the stored `sourceSignature` — the carry
 * helper makes this path idempotent on its own, and a signature gate would
 * be a second, redundant correctness mechanism. `sourceSignature` stays
 * exported and is still written by the composable alongside the slides; it
 * is a stored change-detector now, no longer a decision input here.
 */
function rebuildUnstableIdGroup(
  group: SlideGroup,
  slot: ScriptureSlot | ImportedSlot,
  inputs: AssemblyInputs,
): RebuildResult {
  const fresh = deriveGroupEntries(slot, inputs)
  if (fresh.length === 0) return { changed: false, slides: group.slides }

  const carried = carryStoredDerivedEntries(fresh, group)
  const slides = renumbered([...carried, ...survivingEntries(group)])
  return { changed: !slidesEqual(slides, group.slides), slides }
}

/**
 * Scripture inner slide ids are purely positional (`id: \`scripture-${position}\``,
 * minted in `src/utils/scriptureSplitter.ts::buildSlide`) and are reassigned
 * wholesale by every re-split of the passage — there is no content-stable key
 * to diff a single inner slide against. R047 sidesteps this entirely: a
 * scripture group derives exactly ONE reference-only entry, so
 * `derivedIdentityKey` treats the ref kind alone as identity, letting a
 * passage change or a reading swap carry the stored entry's id/audio forward
 * (T-30-02-03) with no id-matching scheme needed.
 */
export function rebuildScriptureGroup(group: SlideGroup, slot: ScriptureSlot, inputs: AssemblyInputs): RebuildResult {
  return rebuildUnstableIdGroup(group, slot, inputs)
}

/**
 * Imported-deck slide ids are minted fresh via `crypto.randomUUID()` per
 * import (`src/components/PptxImportModal.vue`, at import-confirm time) — a
 * re-import has zero id relationship to the previous deck, so
 * `derivedIdentityKey` keys an imported entry on `importId` + `innerSlideId`
 * together rather than by id.
 */
export function rebuildImportedGroup(group: SlideGroup, slot: ImportedSlot, inputs: AssemblyInputs): RebuildResult {
  return rebuildUnstableIdGroup(group, slot, inputs)
}

/**
 * Single entry point dispatching on `slot.kind` — the composable calls only
 * this. Every branch is now unconditional (Phase 30 deleted the confirm
 * gate): SONG routes to the additive-or-swap rebuild above; SCRIPTURE/
 * IMPORTED route to the generalized carry rebuild; a `text`-kind slot
 * (PRAYER/MESSAGE/HYMN) has no rebuildable source and returns the stored
 * slides with `changed: false`.
 */
export function rebuildGroup(group: SlideGroup, slot: ServiceSlot, inputs: AssemblyInputs): RebuildResult {
  switch (slot.kind) {
    case 'SONG':
      return rebuildSongGroup(group, slot, inputs)
    case 'SCRIPTURE':
      return rebuildScriptureGroup(group, slot, inputs)
    case 'IMPORTED':
      return rebuildImportedGroup(group, slot, inputs)
    case 'PRAYER':
    case 'MESSAGE':
    case 'HYMN':
      return { changed: false, slides: group.slides }
  }
}
