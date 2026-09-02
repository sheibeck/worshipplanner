/**
 * Slide-group materializer and rebuild engine (Phase 24, D-02/D-05; renamed
 * `reconcile*` -> `rebuild*` in Phase 30 when the confirm-gated reconciler
 * was replaced with one unconditional, idempotent rebuild per slot kind).
 *
 * This module is PURE: it performs no Firestore reads and touches no Pinia
  * See ADR-0194 (docs/adr/0194-store-or-vue-reactivity-callers-the-composable-load-data-dec.md)
 * `EditSlideDrawer.vue` each mint for a user-added or duplicated slide. Minting
 * for a NEW entry is fine; only regenerating an EXISTING entry's id is not.
 */
import type { ServiceSlot, SongSlot, ScriptureSlot, ImportedSlot } from '@/types/service'
import type { SlideGroup, GroupSlideEntry, SourceRef, SlideGroupInput } from '@/types/slideGroup'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import {
  formatScriptureReference,
  scriptureRefFromSlot,
  congregationalSectionsFromSlot,
  congregationalSectionFromRef,
} from '@/utils/scripture'
import { resolveImportedRender, importedEntryIdentities, importedSourceSignature } from '@/utils/importedRenderReconciler'

/**
 * Derives a slide group's structure from its slot's canonical source. Every
 * entry this returns is NEW, so every id here is freshly minted.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
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
      // R047/D1: no reference means no slides. Once a reference exists, the
      // group has exactly two shapes (Reference vs Congregational) — never a
      // mix — decided by congregationalSectionsFromSlot.
      // See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes —
      // src/utils/slideGroupMaterializer.ts)
      if (!scriptureRefFromSlot(slot)) return []
      const sections = congregationalSectionsFromSlot(slot)
      if (sections.length === 0) {
        return [{ id: crypto.randomUUID(), order: 0, sourceRef: { kind: 'scripture' as const } }]
      }
      return sections.map((section, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: {
          kind: 'scripture' as const,
          speaker: section.speaker,
          text: section.text,
          ...(section.verseRange !== undefined ? { verseRange: section.verseRange } : {}),
          // R092: a passthrough spread of the section's OWN stamped value —
          // never recomputed from the org's current bibleVersion setting.
          // Kept out of sourceSignature() below on purpose (provenance, not
          // structure) so a setting change can never trigger a rebuild.
          ...(section.translationSource !== undefined ? { translationSource: section.translationSource } : {}),
        },
      }))
    }

    case 'IMPORTED': {
      // Loading-race guards, unchanged (`rebuildUnstableIdGroup` relies on
      // the second one to leave a group untouched rather than blank it while
      // a deck is still loading, T-30-02-04).
      if (!slot.importId) return []
      const deck = inputs.importedDecksById.get(slot.importId)
      if (!deck) return []

      // Phase 42 (R079/R080): the render document, if one exists, is looked
      // up ONLY through the deck's own `renderImportId` — never through
      // `slot.importId`, which is a different identifier entirely
      // (T-42-07). `resolveImportedRender`/`importedEntryIdentities` are the
      // ONE shared decision table imported above; this branch never
      // re-derives entry count or identity itself.
      const render = deck.renderImportId ? inputs.pptxRendersByImportId?.get(deck.renderImportId) : undefined
      const resolution = resolveImportedRender(deck, render)
      const identities = importedEntryIdentities(deck, resolution)

      // See ADR-0178 (docs/adr/0178-in-the-ready-state-an-identity-is-the-reconciler-s-synthetic.md)
      return identities.map((innerSlideId, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: { kind: 'imported' as const, importId: slot.importId!, innerSlideId },
      }))
    }

    // R123: a Miscellaneous item starts with NO derived slides. Split out of
    // the one-text-slide fall-through so a new MISC slot materializes empty;
    // the user can still hand-add slides. Existing MISC groups are untouched —
    // rebuildGroup(MISC) stays a no-op below, so their legacy blank auto-slide
    // and any hand-added slides persist byte-identical (54-RESEARCH.md).
    case 'MISC':
      return []
    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
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
      // R047/D1: the slot's reference is always the base of the signature;
      // rebuildScriptureGroup reads it back as the marker of "already
      // materialized from THIS reading." See .planning/codebase/
      // INTEGRATIONS.md (Utils Integration Notes — src/utils/slideGroupMaterializer.ts)
      const scriptureRef = scriptureRefFromSlot(slot)
      if (!scriptureRef) return undefined
      const formatted = formatScriptureReference(scriptureRef)
      const sections = congregationalSectionsFromSlot(slot)
      if (sections.length === 0) return formatted
      const encodedSections = sections
        .map((section) => `${section.speaker}\x1f${section.verseRange ?? ''}\x1f${section.text}`)
        .join('\x1e')
      return `${formatted}\x1e${sections.length}\x1e${encodedSections}`
    }

    case 'IMPORTED': {
      // Same two loading-race guards as `deriveGroupEntries`'s IMPORTED case.
      if (!slot.importId) return undefined
      const deck = inputs.importedDecksById.get(slot.importId)
      if (!deck) return undefined

      // D-09: importedSourceSignature folds in BOTH the resolved mode and the
      // ready-render page count (T-42-10).
      // See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/importedRenderReconciler.ts)
      const render = deck.renderImportId ? inputs.pptxRendersByImportId?.get(deck.renderImportId) : undefined
      return importedSourceSignature(deck, resolveImportedRender(deck, render))
    }

    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'MISC':
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
 * True when an entry's `sourceRef` is something THIS SLOT's own derivation
 * could have produced. Keying off the SLOT rather than the ref kind alone is
 * the whole point (BL-01, Phase 30 review).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
 */
function isSlotDerivableRef(slot: ServiceSlot, ref: SourceRef): boolean {
  switch (slot.kind) {
    case 'SONG':
      return ref.kind === 'lyric' || ref.kind === 'copyright'
    case 'SCRIPTURE':
      return ref.kind === 'scripture'
    case 'IMPORTED':
      return ref.kind === 'imported' && ref.importId === slot.importId
    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'MISC':
    case 'HYMN':
      return ref.kind === 'text' && ref.title === undefined && ref.body === undefined
  }
}

/**
 * The one place any rebuild path decides what a user added by hand (T-30-02-01, BL-01).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
 */
function survivingEntries(group: SlideGroup, slot: ServiceSlot): GroupSlideEntry[] {
  return group.slides.filter((entry) => !isSlotDerivableRef(slot, entry.sourceRef))
}

/**
 * The content-stable identity a stored entry of an unstable-id kind
 * (scripture, imported) is matched against by `carryStoredDerivedEntries`.
 * Scripture always returns the constant `'scripture'` (T-30-02-03); imported
 * entries key on `importId` + `innerSlideId` together.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
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

/**
 * Re-sorts a rebuilt slide list into the group's STORED order (BL-02, Phase 30
 * review) — the stored order is the USER's, not the derivation's. Idempotent
 * by construction; NOT used by `rebuildSongGroup` (R035/D-03).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
 */
function orderedByStoredPosition(
  carried: GroupSlideEntry[],
  surviving: GroupSlideEntry[],
  group: SlideGroup,
): GroupSlideEntry[] {
  const storedIndexById = new Map(group.slides.map((entry, index) => [entry.id, index]))
  const carriedStored = carried.map((entry) => storedIndexById.get(entry.id))

  // Nearest stored index strictly BEFORE / AFTER each position in the carried
  // (derivation-ordered) run.
  const anchorBefore: (number | undefined)[] = []
  let lastSeen: number | undefined
  for (const stored of carriedStored) {
    anchorBefore.push(lastSeen)
    if (stored !== undefined) lastSeen = stored
  }
  const anchorAfter: (number | undefined)[] = new Array<number | undefined>(carried.length)
  let nextSeen: number | undefined
  for (let index = carried.length - 1; index >= 0; index--) {
    anchorAfter[index] = nextSeen
    const stored = carriedStored[index]
    if (stored !== undefined) nextSeen = stored
  }

  const step = 1 / (carried.length + 1)
  const positioned: { entry: GroupSlideEntry; key: number }[] = carried.map((entry, index) => {
    const stored = carriedStored[index]
    if (stored !== undefined) return { entry, key: stored }
    const before = anchorBefore[index]
    const after = anchorAfter[index]
    const anchor = before !== undefined ? before : after !== undefined ? after - 1 : -1
    return { entry, key: anchor + (index + 1) * step }
  })

  for (const entry of surviving) {
    positioned.push({ entry, key: storedIndexById.get(entry.id) ?? Number.MAX_SAFE_INTEGER })
  }

  return positioned.sort((a, b) => a.key - b.key).map((p) => p.entry)
}

/** Length-plus-per-index JSON comparison — the same equality `rebuildSongGroup`'s additive merge already used, generalized for every rebuild path's idempotence assertion. */
function slidesEqual(a: GroupSlideEntry[], b: GroupSlideEntry[]): boolean {
  return a.length === b.length && a.every((entry, index) => JSON.stringify(entry) === JSON.stringify(b[index]))
}

/**
 * Generalized survival+carry for the two unstable-id source kinds (scripture,
 * imported deck) — positional-consumption-plus-last-occurrence-surplus,
 * generalized so idempotence is provable on EVERY rebuild path (T-30-02-02).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
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

    // R047 (HI-01): scripture surplus is ALWAYS discarded, never emitted — do
    // NOT widen this to admit scripture surplus (a re-split would grow
    // instead of replace). See .planning/codebase/ARCHITECTURE.md
    // (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
    const carriesSurplus = freshEntry.sourceRef.kind !== 'scripture'
    const totalOccurrences = occurrenceTotals.get(key)!
    const isLastOccurrence = occurrenceIndex + 1 === totalOccurrences
    if (carriesSurplus && isLastOccurrence && stored && stored.length > totalOccurrences) {
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

/** See ADR-0195 (docs/adr/0195-additive-only-song-rebuild-d-02-research-md-pattern-3-strate.md) */
export function rebuildSongGroup(group: SlideGroup, slot: SongSlot, inputs: AssemblyInputs): RebuildResult {
  const songId = slot.songId
  if (!songId) {
    // R235/999.2: the song was cleared from THIS slot. Its group must empty,
    // even when the same song is still assigned to another slot elsewhere in
    // the service — that other slot has its OWN group doc, keyed by its own
    // slot.id, and is untouched by this write. Gate on there actually being
    // something to clear so a second reactive pass over an already-empty
    // group stays idempotent (changed: false), matching every other
    // rebuild*'s contract (see rebuildScriptureGroup's CLEARED REFERENCE
    // branch below for the same idiom).
    if (group.slides.length === 0) return { changed: false, slides: group.slides }
    return { changed: true, slides: [] }
  }

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
      ...survivingEntries(group, slot),
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
  // sectionId, consumed POSITIONALLY — re-emitting the whole array per
  // occurrence would compound (2 stored x 2 occurrences -> 4, 8, 16...).
  // See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes —
  // src/utils/slideGroupMaterializer.ts)
  //
  // When occurrences and stored entries are equal in count there is no
  // surplus and no growth; when a section has exactly one occurrence and two stored
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

  // See ADR-0196 (docs/adr/0196-retained-but-unresolvable-entries-kept-relative-to-each-othe.md)
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

/** See ADR-0140 (docs/adr/0140-this-is-the-one-branch-that-empties-a-congregational-group-s.md) */
export interface RebuildResult {
  changed: boolean
  slides: GroupSlideEntry[]
  sourceSignature?: string | null
}

/**
 * Unconditional rebuild for the two unstable-id source kinds (scripture,
 * imported deck). Returns the group untouched with `changed: false`
 * (T-30-02-04) if the derivation is empty (source not yet loaded) — never
 * blanking a group as a side effect of a loading race. Does not gate on the
 * stored `sourceSignature` itself; `rebuildScriptureGroup` consults that
 * BEFORE calling this function instead.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
 */
function rebuildUnstableIdGroup(
  group: SlideGroup,
  slot: ScriptureSlot | ImportedSlot,
  inputs: AssemblyInputs,
): RebuildResult {
  const fresh = deriveGroupEntries(slot, inputs)
  if (fresh.length === 0) return { changed: false, slides: group.slides }

  const carried = carryStoredDerivedEntries(fresh, group)
  const slides = renumbered(orderedByStoredPosition(carried, survivingEntries(group, slot), group))
  return { changed: !slidesEqual(slides, group.slides), slides }
}

/**
 * Scripture inner slide ids are purely positional and are reassigned
 * wholesale by every re-split of the passage. Four cases, decided in order:
 * (1) DETACHED — sections present and the stored signature already matches;
 * (2) NOT YET MATERIALIZED — sections present but signature differs, delegate
 * to `rebuildUnstableIdGroup`; (3) CLEARED REFERENCE — no sections, no
 * reference, but stored section entries remain — empty them; (4) otherwise
 * delegate to `rebuildUnstableIdGroup` unchanged.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
 */
export function rebuildScriptureGroup(group: SlideGroup, slot: ScriptureSlot, inputs: AssemblyInputs): RebuildResult {
  const sections = congregationalSectionsFromSlot(slot)

  // Phase 38 (D1): a scripture group has exactly two states — Reference (no
  // sections) and Congregational (sections present) — told apart by
  // `sourceSignature`. See .planning/codebase/ARCHITECTURE.md
  // (Utils Behavioral Notes — src/utils/slideGroupMaterializer.ts)
  if (sections.length > 0) {
    if (group.sourceSignature !== undefined && group.sourceSignature === sourceSignature(slot, inputs)) {
      return { changed: false, slides: group.slides }
    }
    return rebuildUnstableIdGroup(group, slot, inputs)
  }

  const hasReference = scriptureRefFromSlot(slot) !== null
  if (!hasReference) {
    const hasSectionEntries = group.slides.some(
      (entry) => entry.sourceRef.kind === 'scripture' && congregationalSectionFromRef(entry.sourceRef) !== null,
    )
    if (hasSectionEntries) {
      const slides = renumbered(survivingEntries(group, slot))
      // See ADR-0140 (docs/adr/0140-this-is-the-one-branch-that-empties-a-congregational-group-s.md)
      return { changed: !slidesEqual(slides, group.slides), slides, sourceSignature: null }
    }
  }

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
    case 'ANNOUNCEMENTS':
    case 'MISC':
    case 'HYMN':
      return { changed: false, slides: group.slides }
  }
}
