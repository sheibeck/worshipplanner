/**
 * Slide-group materializer and rebuild engine (Phase 24, D-02/D-05; renamed
 * `reconcile*` -> `rebuild*` in Phase 30 when the confirm-gated reconciler
 * was replaced with one unconditional, idempotent rebuild per slot kind).
 *
 * This module is PURE: it performs no Firestore reads and touches no Pinia
 * store or Vue reactivity — callers (the composable) load data, decide, and
 * write. Mirrors `slideshowAssembler.ts`'s stated purity contract.
 *
 * The load-bearing id invariant is that an entry id is minted ONCE and never
 * REgenerated for an existing entry — `PresentationViewer.vue` keys its
 * per-slide `AudioPlayer`/`VideoPlayer` child components on this id (Phase 23's
 * WR-02 contract), so regenerating one leaks stale muted/blocked media state
 * from one slide onto another. Every carry/merge path below therefore spreads
 * the stored entry (`{ ...stored }`) rather than rebuilding it, and the
 * assembler (24-04) never mints at all.
 *
 * This is NOT the same as "only `deriveGroupEntries` mints", which this comment
 * used to claim and which has been false for several phases (LO-04):
 * `rebuildSongGroup` mints for a newly-resolved section and for absent
 * leading/trailing copyright entries, and `SlideGrid.vue` and
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
 * Derives a slide group's structure from its slot's canonical source.
 * Reproduces `assembleSlideshow`'s CURRENT per-kind emission order exactly —
 * a group derived today must produce a slideshow byte-identical to what the
 * pre-group assembler produced. Slide TEXT is never read or stored here
 * (D-02) for every kind EXCEPT the SCRIPTURE Congregational state (Phase 38,
 * D1/D2): there, `sourceRef` mints the section's own `speaker`/`text`
 * directly, because a converted section slide has no live source left to
 * resolve against — the words themselves ARE what makes it detached (see
 * `SourceRef`'s doc comment in `slideGroup.ts`). Every other kind, and a
 * scripture slot with no sections, still mints only structural references.
 *
 * Every entry this returns is NEW, so every id here is freshly minted. It is
 * not the only minting site in the codebase — see the module doc comment.
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
      // R047/D1: no reference means no slides, exactly as before. Once a
      // reference exists, the group has exactly two possible shapes — never a
      // mix — decided by `congregationalSectionsFromSlot`, R064's ONE
      // congregational-ness predicate:
      //
      // - Reference state (default, unchanged): no sections, so ONE
      //   reference-only entry, derived from the slot's OWN reference fields —
      //   the passage the user typed on the Service Order tab. The ref
      //   carries no payload. `derivedIdentityKey` treats the ref KIND alone
      //   as this group's identity, which is what lets a passage change carry
      //   the stored entry's id/audio forward through
      //   `carryStoredDerivedEntries` instead of minting a fresh id and
      //   silently dropping attached audio.
      // - Congregational state (D1, opt-in): sections present, so ONE entry
      //   PER SECTION — the same one-entry-per-fragment shape the IMPORTED
      //   case above already uses — each carrying that section's own
      //   `speaker`/`text`/`verseRange`. This is what `deriveGroupEntries`
      //   produces on a fresh conversion; `rebuildScriptureGroup` below is
      //   what keeps a group that has ALREADY converted from re-deriving
      //   here on every pass.
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

      // In the ready state an identity is the reconciler's synthetic
      // `rendered-page-N` string, page-scoped rather than a parsed inner
      // slide id — never `deck.slides[i].id` (no positional pairing exists,
      // 42-RESEARCH.md Pitfall 1). In every other mode it IS a parsed inner
      // slide id, unchanged from before this phase. A deck with no
      // `renderImportId` resolves to `parsed` mode here, which is
      // byte-identical to the pre-Phase-42 behaviour (D-16).
      return identities.map((innerSlideId, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: { kind: 'imported' as const, importId: slot.importId!, innerSlideId },
      }))
    }

    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'MISC':
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
      // R047/D1: the slot's reference is always the base of the signature.
      // With no sections it is the WHOLE signature, byte-identical to before
      // this phase — every existing Reference-state group's stored signature
      // stays unchanged, so deploying this phase rebuilds nothing that was
      // not already congregational.
      //
      // With sections present, this is no longer only a stored
      // change-detector: `rebuildScriptureGroup` reads it back as the ONE
      // durable marker of "already materialized from THIS reading" (detached)
      // vs "not yet" (rebuild). So the encoding must be deterministic,
      // order-sensitive and field-explicit — NOT `JSON.stringify` on the
      // section objects, whose key order is not guaranteed to match between
      // the AI-split path and the manual path; a signature that flips on key
      // order would rebuild groups at random. Separators are ASCII control
      // characters (\x1e/\x1f) that cannot occur in typed or ESV-sourced
      // scripture text.
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

      // D-09: `importedSourceSignature` folds in BOTH the resolved mode and,
      // for a ready render, the page count — a re-render that changes the
      // count while staying `ready` therefore produces a different
      // signature. It also replaces the old pipe/colon-delimited
      // count-then-texts form with the `\x1e`/`\x1f` ASCII control-character
      // encoding the SCRIPTURE branch above already uses and justifies:
      // PPTX-parsed text can itself contain either legacy delimiter
      // character, so two distinct decks or render states could otherwise
      // collide on one signature (T-42-10). A deck with no `renderImportId`
      // resolves to `parsed` mode, which signs byte-identically to the old
      // parsed-only path's slide count/text (D-16) — only the delimiter
      // changed, not what is compared.
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
 * could have produced — i.e. the entry is source-derived and the rebuild owns
 * it. Everything else on the group is user work.
 *
 * Keying off the SLOT rather than the ref kind alone is the whole point (BL-01,
 * Phase 30 review). The predicate this replaced returned "non-derivable" only
 * for `video` and authored-`text`, which meant an imported deck or a set of
 * dropped images the user appended into a SCRIPTURE or IMPORTED group was in
 * neither the carried list nor the surviving list, and the first unconditional
 * rebuild destroyed it silently — the D-02 regression the deleted confirm gate
 * used to stall. `＋ Add slide` and `⇪ Import into this group` are offered on
 * every non-song group (`SlideGrid.vue`), so those entries are reachable and
 * are, by definition, user work: no SCRIPTURE derivation ever emits an
 * `imported` ref, and no IMPORTED derivation ever emits one for a deck other
 * than the slot's own `importId`.
 *
 * SONG deliberately answers on ref KIND alone, not on `songId`: a full
 * song-identity swap is detected and handled by `rebuildSongGroup` itself,
 * which rebuilds from the new song's derivation. Matching `songId` here would
 * classify the OLD song's lyric/copyright entries as user work and splice the
 * entire previous song back into the swapped group.
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
 * The one place any rebuild path decides what a user added by hand — every
 * stored entry this slot's own derivation could not have produced, in stored
 * order. Every `rebuild*Group` function splices this back into its fresh
 * derivation so a song swap, a passage change, or a deck re-import can never
 * silently drop a dropped video, a hand-authored slide, or a deck the user
 * imported into the group (T-30-02-01, BL-01).
 *
 * The IMPORTED case still DROPS an entry whose `importId` matches the slot but
 * whose `innerSlideId` the current deck no longer contains — that is the
 * intended re-import behaviour, and it stays where it was, inside
 * `carryStoredDerivedEntries`. This function only ever rescues refs a FOREIGN
 * source produced.
 */
function survivingEntries(group: SlideGroup, slot: ServiceSlot): GroupSlideEntry[] {
  return group.slides.filter((entry) => !isSlotDerivableRef(slot, entry.sourceRef))
}

/**
 * The content-stable identity a stored entry of an unstable-id kind
 * (scripture, imported) is matched against by `carryStoredDerivedEntries`.
 * Returns `null` for kinds that either have their own dedicated identity
 * scheme (`lyric`/`copyright` diff by `sectionId` in `rebuildSongGroup`) or
 * are never derived at all (`text`, `video` — always non-derivable).
 *
 * Scripture returns the constant `'scripture'` regardless of any
 * `innerSlideId` the ref still carries: R047 narrows a REFERENCE-state
 * scripture group to exactly ONE derived entry, so the ref's KIND alone is
 * its identity — this is what lets a passage change or a reading swap carry
 * the stored entry's id, label, notes and audio forward onto the new
 * reference (T-30-02-03). Phase 38 (D1) widens the Congregational state to N
 * derived entries — one per section — but every one of them still returns
 * this SAME constant key, not a per-section key. That is deliberate: it is
 * what lets `carryStoredDerivedEntries` match N fresh section entries against
 * N stored ones positionally (survives an edit/delete/reorder) and, on a
 * DESTROY back to the Reference state, is exactly what makes the surplus
 * suppression below collapse the group to one entry instead of stranding the
 * other N-1.
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

/**
 * Re-sorts a rebuilt slide list into the group's STORED order (BL-02, Phase 30
 * review). The stored order is the USER's: `SlideGrid.vue` offers drag-reorder
 * on every non-song group, and the drop paths append at a user-chosen position.
 * Before this, `rebuildUnstableIdGroup` rebuilt the array from `fresh` and
 * concatenated survivors after it, so the derivation's order always won — a
 * drag-reorder committed successfully and was then reverted by the very next
 * rebuild, with no error shown, and a hand-added video was relocated to the end
 * of the group.
 *
 * Every entry that already exists in the group sorts by its stored index. A
 * NEWLY derived entry has no stored index, so it is anchored to the nearest
 * carried entry that does have one — just after the closest preceding one, or
 * just before the closest following one, or ahead of the whole group when NO
 * derived entry has a stored index at all. That last case is the re-import: a
 * re-import mints entirely fresh `innerSlideId`s (`PptxImportModal.vue` mints
 * per import), so every derived entry is new, and the whole fresh deck block
 * lands where the previous deck's block was rather than behind an entry the
 * user appended after it.
 *
 * Anchor fractions are strictly increasing across the derived run and stay
 * inside `(0, 1)`, so an anchored entry can never sort past the stored
 * neighbour it was anchored to, a run of new entries keeps its derivation
 * order, and no anchored key can ever collide with an integer stored index.
 *
 * Idempotent by construction: after one pass every entry has a stored index
 * equal to its own position, so a second pass is the identity sort.
 *
 * NOT used by `rebuildSongGroup`. A song's slide order is dictated by the
 * lyrics document's `performanceOrder` — the single source of truth, no
 * precedence chain (R035/D-03) — and a song group is read-only in the Slides
 * tab (R054), so there is no user order to preserve there.
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
 * concept of its own — EXCEPT for scripture, whose surplus is ALWAYS
 * discarded rather than emitted, in EVERY state (R047 Reference; Phase 38 D1
 * Congregational alike), because `derivedIdentityKey` keys every scripture
 * ref — one or N of them — on the same constant (HI-01: otherwise a
 * pre-5c531b1 group stabilised at N identical reference slides and never
 * converged; the same suppression is what keeps a Congregational RE-SPLIT
 * from growing — a re-split from 3 sections to 2 must yield exactly 2, never
 * 5). A stored entry whose key never appears in `fresh` at
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

    // R047 (HI-01): surplus is meaningful only for kinds with real fresh-side
    // multiplicity. `derivedIdentityKey` returns the constant 'scripture' for
    // every scripture ref regardless of state — so a group written before
    // 5c531b1 (one entry per split passage fragment, each with its own
    // innerSlideId) had N stored entries under that one key, and the surplus
    // loop below re-emitted stored[1..N-1] rewritten to the fresh
    // reference-only ref. That is STABLE, so such a group never converged: it
    // projected the same reference string N times forever. Suppressing
    // surplus for scripture is what makes a Reference-state rebuild converge
    // to exactly ONE reference-only slide, true for stored data as well as
    // for a fresh derivation.
    //
    // Phase 38 (D1): the SAME suppression applies unconditionally in the
    // Congregational state too, not just Reference — `fresh` there can
    // legitimately have N>1 entries (one per section), and a re-split that
    // shrinks the section count (e.g. 3 sections down to 2) relies on this
    // exact line to discard the now-stale stored entries beyond the new
    // count rather than re-emitting them as "surplus". A future edit that
    // widened `carriesSurplus` to admit scripture surplus in the
    // Congregational state would make RE-SPLIT grow instead of replace.
    //
    // In every case the first stored entry at each position is still
    // carried, so its id, label, notes and audio come forward.
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

/**
 * Two-field result shape shared by every `rebuild*Group` function, dispatched via {@link rebuildGroup}. Phase 30 deleted the old six-field confirm-shaped result along with the confirm gate itself — every rebuild now decides and writes unconditionally.
 *
 * 38-REVIEW CR-01: `sourceSignature` is an OPTIONAL third field, read only by
 * the composable's write step (`useSlideshowAssembly.ts`) when present.
 * `undefined` (the field simply absent, the default for every branch except
 * the one below) means "no opinion — the composable's own freshly-recomputed
 * signature governs, exactly as before this field existed." An explicit
 * `null` means "clear the stored signature," which the composable and
 * `replaceGroupSlides` must turn into a real Firestore `deleteField()`, not
 * an omitted key — `stripUndefined` treats an omitted key and `undefined` as
 * "no change," which cannot express "remove this," the same distinction
 * `setGroupBedMedia`'s `clearAudio` flag exists to make. Only
 * `rebuildScriptureGroup`'s CLEARED REFERENCE branch sets this today: it is
 * the one branch that empties a group's derived slides via a path where the
 * freshly-computed signature is `undefined` for a reason OTHER than "no
 * opinion" (there is no reference left to sign at all), so the ordinary
 * fall-through would leave a stale congregational signature on the group
 * forever.
 */
export interface RebuildResult {
  changed: boolean
  slides: GroupSlideEntry[]
  sourceSignature?: string | null
}

/**
 * Unconditional rebuild for the two unstable-id source kinds (scripture,
 * imported deck). Derives fresh; if the derivation is empty (source not yet
 * loaded), returns the group untouched with `changed: false` (T-30-02-04) —
 * never blanking a group as a side effect of a loading race. Otherwise the
 * new slides are `carryStoredDerivedEntries`'s carried derived entries plus
 * the group's surviving user-added entries, re-sorted into the group's STORED
 * order by `orderedByStoredPosition` (BL-02 — the stored order is the user's
 * and a rebuild must not overwrite it) and renumbered.
 * THIS FUNCTION deliberately does not gate on the stored `sourceSignature` —
 * the carry helper makes this path idempotent on its own, and a signature
 * gate would be a second, redundant correctness mechanism here.
 *
 * That is no longer true of the module as a whole: Phase 38 (D1) gave
 * `sourceSignature` a real reader. `rebuildScriptureGroup` consults it BEFORE
 * ever calling this function, as the one durable marker of "already
 * materialized from this reading" (detached, Congregational) vs "not yet"
 * (delegate here) — see that function's own doc comment. So `sourceSignature`
 * is a decision input for scripture groups now; it is simply not read a
 * second time once execution reaches this function.
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
 * Scripture inner slide ids are purely positional (`id: \`scripture-${position}\``,
 * minted in `src/utils/scriptureSplitter.ts::buildSlide`) and are reassigned
 * wholesale by every re-split of the passage — there is no content-stable key
 * to diff a single inner slide against. R047 sidesteps this entirely for the
 * Reference state: a scripture group derives exactly ONE reference-only
 * entry, so `derivedIdentityKey` treats the ref kind alone as identity,
 * letting a passage change or a reading swap carry the stored entry's
 * id/audio forward (T-30-02-03) with no id-matching scheme needed.
 *
 * D1 adds a second state on top of that: once a scripture group has been
 * materialized from the slot's CURRENT congregational reading, it is
 * DETACHED — freely editable, and no longer re-derived on every rebuild pass,
 * even when entries have been edited or deleted. Two states, decided in
 * order:
 *
 * 1. DETACHED: the slot has sections AND the group's stored
 *    `sourceSignature` already equals `sourceSignature(slot, inputs)` — this
 *    group was materialized from EXACTLY this reading. Return the stored
 *    slides untouched, `changed: false`, unconditionally — not gated on the
 *    group being non-empty, because a user who deleted every section slide
 *    must get an empty group that STAYS empty until the scripture itself
 *    changes. This is the one branch that makes a per-slide edit survive and
 *    a deletion stick.
 * 2. NOT YET MATERIALIZED: the slot has sections but the signature does not
 *    match — first conversion, a re-split from the congregational editor, or
 *    an existing Phase-34 service reaching this code for the first time.
 *    Delegate to `rebuildUnstableIdGroup` exactly as the Reference state
 *    always has: `deriveGroupEntries` now yields the N section entries, and
 *    the existing carry/order/renumber machinery does the rest with no
 *    change. `carryStoredDerivedEntries`'s scripture-surplus suppression
 *    (HI-01) is what collapses this back down to exactly one entry on a
 *    DESTROY (case 4 below) — that suppression was written for pre-5c531b1
 *    multi-fragment groups, which is structurally the SAME shape a
 *    congregational group has. It is reused here, not reimplemented; do not
 *    "fix" it into re-emitting surplus, or a destroyed conversion will
 *    silently resurrect N reference slides instead of collapsing to one.
 * 3. CLEARED REFERENCE: the slot has no sections AND no reference at all, AND
 *    the group still holds at least one section entry — the reference is
 *    gone, so the group must be emptied of its derived section entries,
 *    retaining only what `survivingEntries` classifies as user work
 *    (renumbered). For SCRIPTURE an absent reference is a REAL absent
 *    reference, never a loading race (R047: the slot IS the source) — unlike
 *    `rebuildUnstableIdGroup`'s loading-race guard, which exists for
 *    IMPORTED's asynchronously-arriving deck. Without this branch a section
 *    entry keeps projecting its stored words under a reference that no
 *    longer exists, because its content comes from ITSELF, not the slot. A
 *    group with NO section entries and an absent reference falls through to
 *    case 4 unchanged — `rebuildUnstableIdGroup`'s own loading-race guard
 *    already leaves it alone (T-30-02-04), and widening this branch to cover
 *    it too would be a behaviour change this plan does not make.
 * 4. Otherwise (Reference state throughout, or a DESTROY — sections were
 *    just cleared by a reference change): delegate to `rebuildUnstableIdGroup`
 *    unchanged. Its carry/collapse machinery (case 2's HI-01 note) is what
 *    turns N stored section entries into exactly ONE payload-free entry when
 *    the fresh derivation is the single-entry Reference shape.
 */
export function rebuildScriptureGroup(group: SlideGroup, slot: ScriptureSlot, inputs: AssemblyInputs): RebuildResult {
  const sections = congregationalSectionsFromSlot(slot)

  // Phase 38 (D1) in one paragraph, for a reader who skipped the doc comment
  // above: a scripture group has exactly two states — Reference (no
  // sections) and Congregational (sections present). The ONE marker that
  // tells them apart is `sourceSignature`: once it equals THIS reading's
  // current signature, the group was already materialized from it and is
  // detached — return its stored slides untouched, unconditionally, even if
  // every section has been deleted. Anything else falls through to the
  // ordinary derive/carry machinery below.
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
      // 38-REVIEW CR-01: this is the one branch that empties a Congregational
      // group's section entries via a reference clear, where the freshly
      // computed `sourceSignature(slot, inputs)` is `undefined` because there
      // is no reference left to sign — NOT because there is "no opinion."
      // Without an explicit `sourceSignature: null` here, the write path's
      // `stripUndefined` would leave the group's stale congregational
      // signature stored, and a later re-entry of the identical reading would
      // hit the DETACHED short-circuit above against a permanently-empty
      // `slides` array. See `RebuildResult`'s doc comment.
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
