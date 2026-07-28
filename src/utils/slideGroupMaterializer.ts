/**
 * Slide-group materializer and reconciler (Phase 24, D-02/D-05).
 *
 * This module is PURE: it performs no Firestore reads and touches no Pinia
 * store or Vue reactivity — callers (the composable in 24-05) load data,
 * decide, and write. Mirrors `slideshowAssembler.ts`'s stated purity
 * contract.
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
      if (!slot.scriptureReadingId) return []
      const reading = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
      if (!reading) return []

      return reading.slides.map((innerSlide, index) => ({
        id: crypto.randomUUID(),
        order: index,
        sourceRef: {
          kind: 'scripture' as const,
          scriptureReadingId: slot.scriptureReadingId!,
          innerSlideId: innerSlide.id,
        },
      }))
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
      if (!slot.scriptureReadingId) return undefined
      const reading = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
      if (!reading) return undefined
      const texts = reading.slides.map((s) => s.text)
      return `${texts.length}:${texts.join('|')}`
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
 * This is the predicate `hasCustomization` and `computeLoss` both consult so
 * a re-split scripture passage or a re-imported deck can never silently
 * delete a user's dropped video or hand-authored slide.
 */
function isNonDerivableEntry(entry: GroupSlideEntry): boolean {
  const ref = entry.sourceRef
  if (ref.kind === 'video') return true
  if (ref.kind === 'text' && (ref.title !== undefined || ref.body !== undefined)) return true
  return false
}

/**
 * Gates the reconciliation confirm (Phase 26 dialog) — true when there is
 * user-authored work to potentially lose. This looks like a cosmetic
 * predicate but is in fact the deletion gate: `reconcileUnstableIdGroup`
 * consults it before replacing a scripture or imported group's slides
 * wholesale with a fresh derivation. Without counting non-derivable entries
 * (D-17: a video entry, or a text entry with authored content), a re-split
 * passage or a re-imported deck would delete a user's dropped video with no
 * confirm and no trace.
 */
export function hasCustomization(group: SlideGroup): boolean {
  if (group.bedAudioUrl) return true
  return group.slides.some(
    (entry) => !!entry.label || !!entry.notes || !!entry.audioUrl || isNonDerivableEntry(entry),
  )
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
 * Additive-only song reconciliation (D-02, RESEARCH.md Pattern 3 strategy 1
 * / Pitfall 4): diffs the fresh resolved section order against the stored
 * entries by `sourceRef.sectionId` — the ONE content-stable key available for
 * songs, since `ccliParser.ts` mints ids by slugifying labels. A section
 * newly present in the source is INSERTED; a stored entry whose section
 * still resolves is KEPT BY VALUE (never rebuilt — only `order` may be
 * renumbered); a stored entry whose section no longer resolves is RETAINED,
 * never deleted — removing it is a Phase 26 user action, never an automatic
 * consequence of the source changing shape. The leading/trailing `copyright`
 * entries are matched by kind and position, never by `sectionId`, and are
 * never duplicated.
 *
 * A full song-IDENTITY swap (CR-01) is detected FIRST, before any of the
 * above additive logic runs: if the group's stored lyric/copyright entries
 * reference a `songId` different from the slot's CURRENT `songId`, the slot
 * was reassigned to a different song entirely — a source-identity change,
 * not a section-level edit within the same song. The additive by-sectionId
 * merge is only valid for edits WITHIN the same song; running it across a
 * song swap would blend the old song's copyright/lyric entries with the new
 * song's (every old entry's `sectionId` looks "unresolvable" against the new
 * song and gets retained forever). This case is routed through the same
 * signature+customization confirm gate `reconcileUnstableIdGroup` uses for
 * scripture/imported groups: an uncustomized group replaces silently, a
 * customized one requires confirm.
 */
export function reconcileSongGroup(group: SlideGroup, slot: SongSlot, inputs: AssemblyInputs): ReconcileResult {
  const songId = slot.songId
  if (!songId) return { needsConfirm: false, changed: false, slides: group.slides }

  const storedSongIds = new Set(
    group.slides
      .filter(
        (e): e is GroupSlideEntry & { sourceRef: Extract<SourceRef, { kind: 'lyric' | 'copyright' }> } =>
          e.sourceRef.kind === 'lyric' || e.sourceRef.kind === 'copyright',
      )
      .map((e) => e.sourceRef.songId),
  )
  if (storedSongIds.size > 0 && !storedSongIds.has(songId)) {
    if (!hasCustomization(group)) {
      return { needsConfirm: false, changed: true, slides: deriveGroupEntries(slot, inputs) }
    }
    // storedSongIds is a Set built by mapping group.slides in stored order, so
    // Set iteration order is insertion order — the first value is "the first
    // id in stored order" per the action's stated tie-break for a
    // multi-song-blended group (a prior bug's leftovers).
    const oldSongId = storedSongIds.values().next().value as string
    return {
      needsConfirm: true,
      changed: false,
      slides: group.slides,
      proposed: deriveGroupEntries(slot, inputs),
      loss: computeLoss(group),
      songSwap: { oldSongId, newSongId: songId },
    }
  }

  const lyrics = inputs.songLyricsById.get(songId)
  if (!lyrics) return { needsConfirm: false, changed: false, slides: group.slides }

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

  return changed
    ? { needsConfirm: false, changed: true, slides: merged }
    : { needsConfirm: false, changed: false, slides: group.slides }
}

/** Result shape shared by every reconciler, dispatched via {@link reconcileGroup}. */
export interface ReconcileResult {
  needsConfirm: boolean
  changed: boolean
  slides: GroupSlideEntry[]
  proposed?: GroupSlideEntry[]
  loss?: { customizedEntries: number; withAudio: number; withNotes: number }
  /**
   * Populated ONLY on a customized song-identity swap (D-08) — the one branch
   * of `reconcileSongGroup` that already holds both the old (stored) and new
   * (slot-assigned) song ids in scope at the moment it decides a confirmation
   * is required. Ids only: this module is pure and has no song-catalog access,
   * so title resolution is 26-04's job, one layer up. Every other reconciler
   * branch (uncustomized swap, within-song edits, scripture/imported confirm)
   * leaves this undefined — there is either nothing to confirm or the swap is
   * not a song-identity change.
   */
  songSwap?: { oldSongId: string; newSongId: string }
}

function computeLoss(group: SlideGroup): { customizedEntries: number; withAudio: number; withNotes: number } {
  let customizedEntries = 0
  let withAudio = 0
  let withNotes = 0
  for (const entry of group.slides) {
    // Counts non-derivable entries (D-17: a video entry, or authored text) as
    // user work too, so the count a confirm dialog shows can never read zero
    // while a video entry is at stake.
    if (entry.label || entry.notes || entry.audioUrl || isNonDerivableEntry(entry)) customizedEntries++
    if (entry.audioUrl) withAudio++
    if (entry.notes) withNotes++
  }
  return { customizedEntries, withAudio, withNotes }
}

/**
 * Shared three-branch shape for the two unstable-id source kinds (scripture,
 * imported deck): compare the stored `sourceSignature`; if unchanged, no
 * work. If diverged and the group has no customization, replace silently
 * (nothing user-authored to lose). If diverged and the group IS customized,
 * return the stored slides untouched, `needsConfirm: true`, and a `proposed`
 * list + `loss` summary the Phase 26 confirm dialog can render.
 */
function reconcileUnstableIdGroup(
  group: SlideGroup,
  slot: ScriptureSlot | ImportedSlot,
  inputs: AssemblyInputs,
): ReconcileResult {
  const freshSignature = sourceSignature(slot, inputs)
  if (freshSignature === group.sourceSignature) {
    return { needsConfirm: false, changed: false, slides: group.slides }
  }

  if (!hasCustomization(group)) {
    return { needsConfirm: false, changed: true, slides: deriveGroupEntries(slot, inputs) }
  }

  return {
    needsConfirm: true,
    changed: false,
    slides: group.slides,
    proposed: deriveGroupEntries(slot, inputs),
    loss: computeLoss(group),
  }
}

/**
 * Scripture inner slide ids are purely positional (`id: \`scripture-${position}\``,
 * minted in `src/utils/scriptureSplitter.ts::buildSlide`) and are reassigned
 * wholesale by every re-split of the passage — there is no content-stable key
 * to diff against. Matching on them would silently attach a user's audio/
 * notes to the wrong text, so this function never diffs by id; it compares
 * the stored `sourceSignature` and gates on customization instead.
 */
export function reconcileScriptureGroup(group: SlideGroup, slot: ScriptureSlot, inputs: AssemblyInputs): ReconcileResult {
  return reconcileUnstableIdGroup(group, slot, inputs)
}

/**
 * Imported-deck slide ids are minted fresh via `crypto.randomUUID()` per
 * import (`src/components/PptxImportModal.vue`, at import-confirm time) — a
 * re-import has zero id relationship to the previous deck. This function
 * never diffs by id either, for the same reason as the scripture reconciler.
 */
export function reconcileImportedGroup(group: SlideGroup, slot: ImportedSlot, inputs: AssemblyInputs): ReconcileResult {
  return reconcileUnstableIdGroup(group, slot, inputs)
}

/**
 * Single entry point dispatching on `slot.kind` — the composable in 24-05
 * calls only this. SONG routes to the additive merge for edits WITHIN the
 * same song (never confirm-gated for those), but confirm-gates a full
 * song-identity swap exactly like the unstable-id kinds (CR-01);
 * SCRIPTURE/IMPORTED route to the signature-detected, confirm-gated path; a
 * `text`-kind slot (PRAYER/MESSAGE/HYMN) has no reconcilable source and
 * returns the stored slides with both flags false.
 */
export function reconcileGroup(group: SlideGroup, slot: ServiceSlot, inputs: AssemblyInputs): ReconcileResult {
  switch (slot.kind) {
    case 'SONG':
      return reconcileSongGroup(group, slot, inputs)
    case 'SCRIPTURE':
      return reconcileScriptureGroup(group, slot, inputs)
    case 'IMPORTED':
      return reconcileImportedGroup(group, slot, inputs)
    case 'PRAYER':
    case 'MESSAGE':
    case 'HYMN':
      return { needsConfirm: false, changed: false, slides: group.slides }
  }
}
