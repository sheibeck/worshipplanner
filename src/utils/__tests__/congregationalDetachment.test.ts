import { describe, it, expect } from 'vitest'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import { buildInitialGroup, rebuildGroup, sourceSignature } from '@/utils/slideGroupMaterializer'
import {
  scriptureSlotAfterReferenceChange,
  scriptureRefFromSlot,
  formatScriptureReference,
  congregationalSectionFromRef,
} from '@/utils/scripture'
import type { Service, ServiceSlot, ScriptureSlot, ScriptureRef } from '@/types/service'
import type { ScriptureSlide, CongregationalSection } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry, SourceRef } from '@/types/slideGroup'
import type { Timestamp } from 'firebase/firestore'

/**
 * `congregationalReadingPipeline.test.ts` (38-01) asserts the composed
 * slot -> group -> slide contract at ONE instant — build a group, rebuild it
 * ONCE, assert the result. This file is a SIBLING, not a replacement: it
 * asserts the SAME contract holds across REPEATED rebuild ticks, because a
 * rebuild that reverts a user's edit does so on a LATER reactive tick, not
 * the first one. `useSlideshowAssembly`'s `rebuildOutcomes` computed reruns
 * `rebuildGroup` on every reactive recompute of the service/groups it
 * depends on — every keystroke elsewhere in the service, every remote
 * snapshot — so a single-tick test cannot see a bug that only resurrects a
 * deleted slide, reverts an edit, or fails to converge on tick TWO.
 */

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

function makeService(slots: ServiceSlot[]): Service {
  return {
    id: 'svc-detachment',
    date: '2026-01-04',
    name: 'Durability Test Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots,
    sermonPassage: null,
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  }
}

function makeInputs(overrides: Partial<AssemblyInputs> = {}): AssemblyInputs {
  return {
    songLyricsById: new Map(),
    scriptureReadingsById: new Map(),
    importedDecksById: new Map(),
    groupsBySlotId: new Map(),
    ...overrides,
  }
}

function baseSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-detachment',
    position: 0,
    book: 'Psalms',
    chapter: 23,
    verseStart: 1,
    verseEnd: 3,
    ...overrides,
  }
}

// Same partition technique as congregationalReadingPipeline.test.ts's
// fixture: one source passage genuinely split into three sections (not
// merely concatenated back together after the fact), with the third
// section deliberately repeating the second's speaker so the same-speaker
// case rides on the SAME fixture every other case uses.
const SOURCE_PASSAGE =
  'The Lord is my shepherd; I shall not want. ' +
  'He makes me lie down in green pastures. ' +
  'He leads me beside still waters.'

const THREE_SECTIONS: CongregationalSection[] = [
  { speaker: 'LEADER', text: 'The Lord is my shepherd; I shall not want. ' },
  { speaker: 'CONGREGATION', text: 'He makes me lie down in green pastures. ' },
  { speaker: 'CONGREGATION', text: 'He leads me beside still waters.' },
]

// RE-SPLIT's replacement sections — deliberately a DIFFERENT passage and a
// different count (2, not 3) so a re-split that accidentally concatenates
// rather than replaces is visible immediately.
const TWO_SECTIONS: CongregationalSection[] = [
  { speaker: 'LEADER', text: 'Praise the Lord, O my soul, ' },
  { speaker: 'CONGREGATION', text: 'and all that is within me, bless his holy name!' },
]

// Encoding backstop fixture: curly quotes (U+2018/U+2019/U+201C/U+201D) and
// an em dash (U+2014), mirroring the sibling file's own NON_ASCII_SECTION —
// strict `===` end to end, no normalization.
const NON_ASCII_SECTION: CongregationalSection = {
  speaker: 'LEADER',
  text: '‘He restores my soul’ — “he leads me in paths of righteousness.”',
}

/**
 * Narrows a `GroupSlideEntry`'s `sourceRef` to the `scripture` member so a
 * test can build an edited/flipped copy without an `as` cast at every call
 * site. Throws (never silently narrows) if handed a non-scripture entry —
 * every case in this file only ever calls this on an entry it just proved
 * is a congregational section.
 */
function asScriptureRef(entry: GroupSlideEntry): Extract<SourceRef, { kind: 'scripture' }> {
  if (entry.sourceRef.kind !== 'scripture') throw new Error('expected a scripture entry')
  return entry.sourceRef
}

/**
 * Applies ONE rebuild tick the way `useSlideshowAssembly`'s
 * `applyRebuildOutcomes` actually does (`src/composables/useSlideshowAssembly.ts`):
 * run `rebuildGroup`, and when it reports a change, write BOTH the returned
 * slides AND a signature back onto the group — never only the slides.
 *
 * 38-REVIEW CR-01: the signature to write is a TRI-STATE, mirroring the
 * composable's own `freshSignature` computation exactly — `result.sourceSignature`
 * (set only by `rebuildScriptureGroup`'s CLEARED REFERENCE branch) takes
 * precedence when present; otherwise it falls back to a fresh
 * `sourceSignature(slot, inputs)` call, matching every other branch. The
 * three cases then map onto the production write path
 * (`slideGroupsStore.replaceGroupSlides`, which runs `stripUndefined` for
 * "no opinion" but an explicit `deleteField()` for "clear") exactly:
 *
 * - `undefined` ("no opinion"): the STORED field is left untouched — mirrors
 *   `stripUndefined` omitting the key from the Firestore update.
 * - `null` ("explicitly clear"): the STORED field is removed from the group
 *   object entirely — mirrors a Firestore `deleteField()` write. Before this
 *   fix, this helper (like production) could only ever omit-or-set, never
 *   clear, which is exactly the gap CR-01 found: a cleared congregational
 *   reference left the OLD signature stored, so a later identical re-entry
 *   hit the DETACHED short-circuit against a permanently-empty `slides` array.
 * - a string ("set"): the STORED field is set to that value, as before.
 *
 * If this helper wrote the slides but not the refreshed signature, every
 * detachment case below would still look like it passed by coincidence —
 * `rebuildUnstableIdGroup`'s carry-by-position machinery re-derives content
 * that happens to be idempotent when nothing changed, so `changed` would
 * still read `false`. That is exactly the failure this helper exists to
 * rule out, which is why the CONVERT case below asserts the written
 * `sourceSignature` value directly, not merely the `changed` flag.
 */
function tick(
  group: SlideGroup,
  slot: ScriptureSlot,
  inputs: AssemblyInputs,
): { group: SlideGroup; changed: boolean } {
  const result = rebuildGroup(group, slot, inputs)
  if (!result.changed) return { group, changed: false }
  const freshSignature =
    result.sourceSignature !== undefined ? result.sourceSignature : sourceSignature(slot, inputs)

  const nextGroup: SlideGroup = { ...group, slides: result.slides }
  if (freshSignature === null) {
    delete nextGroup.sourceSignature
  } else if (freshSignature !== undefined) {
    nextGroup.sourceSignature = freshSignature
  }
  return { group: nextGroup, changed: true }
}

/**
 * Produces the "already converted" starting group every case past CONVERT
 * needs, by actually RUNNING a conversion through {@link tick} — a
 * Reference-state group (built the way a service really starts, via
 * `buildInitialGroup` on a slot with no sections yet) ticked once against the
 * SAME slot widened with sections. This is real production shape twice over:
 * the Reference-state starting group is what `buildInitialGroup` produces for
 * every ordinary scripture item, and the conversion itself is exactly what
 * CONVERT below proves works — reusing it here means every later case starts
 * from a state this file has already validated, not a hand-assembled one.
 */
function convertedGroup(sectionsSlot: ScriptureSlot, inputs: AssemblyInputs): SlideGroup {
  const { congregationalSections: _omit, ...referenceOnly } = sectionsSlot
  const referenceSlot = referenceOnly as ScriptureSlot
  const initial = buildInitialGroup(referenceSlot, 'svc-detachment', inputs)
  const referenceGroup: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }
  return tick(referenceGroup, sectionsSlot, inputs).group
}

describe('congregational detachment — composed durability across repeated rebuild ticks (D1, roadmap criteria 4 & 5)', () => {
  it('sanity: THREE_SECTIONS partitions SOURCE_PASSAGE exactly, with no gap or overlap', () => {
    expect(THREE_SECTIONS.map((s) => s.text).join('')).toBe(SOURCE_PASSAGE)
  })

  it('CONVERT then IDLE: a Reference-state group on a slot given three sections converts to three section entries on tick one and reports no change on ticks two and three', () => {
    const referenceSlot = baseSlot()
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()

    const initial = buildInitialGroup(referenceSlot, 'svc-detachment', inputs)
    const referenceGroup: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }
    expect(referenceGroup.slides).toHaveLength(1)
    expect(congregationalSectionFromRef(referenceGroup.slides[0]!.sourceRef)).toBeNull()

    const tick1 = tick(referenceGroup, sectionsSlot, inputs)
    expect(tick1.changed).toBe(true)
    expect(tick1.group.slides).toHaveLength(3)
    for (let i = 0; i < 3; i++) {
      expect(congregationalSectionFromRef(tick1.group.slides[i]!.sourceRef)).toEqual(THREE_SECTIONS[i])
    }
    // Helper fidelity (see the tick() doc comment): the group's OWN stored
    // signature, not merely a passing `changed` flag, must equal the slot's
    // current signature after a changed tick — this is what makes tick2/3
    // hit the detach short-circuit instead of silently re-deriving forever.
    expect(tick1.group.sourceSignature).toBe(sourceSignature(sectionsSlot, inputs))

    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)
    expect(tick2.group.slides).toEqual(tick1.group.slides)

    const tick3 = tick(tick2.group, sectionsSlot, inputs)
    expect(tick3.changed).toBe(false)
    expect(tick3.group.slides).toEqual(tick1.group.slides)
  })

  it('DELETE ONE STAYS DELETED: after conversion, removing the middle entry and running two further ticks leaves exactly two entries, in order, carrying the first and third sections\' speakers and words — the removed section\'s words appear nowhere in the group', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)
    expect(converted.slides).toHaveLength(3)

    // The array shape a real delete action writes — never the tick helper's
    // internals, and never a hand-edited slot.
    const afterDelete: SlideGroup = { ...converted, slides: [converted.slides[0]!, converted.slides[2]!] }

    const tick1 = tick(afterDelete, sectionsSlot, inputs)
    expect(tick1.changed).toBe(false)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toHaveLength(2)
    const sections = tick2.group.slides.map((entry) => congregationalSectionFromRef(entry.sourceRef))
    expect(sections).toEqual([THREE_SECTIONS[0], THREE_SECTIONS[2]])

    const survivingWords = sections.map((s) => s!.text).join('')
    expect(survivingWords).not.toContain(THREE_SECTIONS[1]!.text.trim())
  })

  it('DELETE ALL STAYS DELETED: after conversion, removing every entry and running two further ticks leaves an empty group', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const afterDeleteAll: SlideGroup = { ...converted, slides: [] }

    const tick1 = tick(afterDeleteAll, sectionsSlot, inputs)
    expect(tick1.changed).toBe(false)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toEqual([])
  })

  it("EDIT SURVIVES: after conversion, changing one entry's stored words and running two further ticks leaves that entry carrying the changed words and every sibling byte-identical", () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const editedText = 'He restores my soul; he leads me in paths of righteousness.'
    const target = converted.slides[1]!
    const editedEntry: GroupSlideEntry = { ...target, sourceRef: { ...asScriptureRef(target), text: editedText } }
    const editedGroup: SlideGroup = {
      ...converted,
      slides: converted.slides.map((entry) => (entry.id === target.id ? editedEntry : entry)),
    }

    const tick1 = tick(editedGroup, sectionsSlot, inputs)
    expect(tick1.changed).toBe(false)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toHaveLength(3)
    expect(congregationalSectionFromRef(tick2.group.slides[1]!.sourceRef)!.text).toBe(editedText)
    expect(tick2.group.slides[0]).toEqual(converted.slides[0])
    expect(tick2.group.slides[2]).toEqual(converted.slides[2])
  })

  it('SPEAKER FLIP SURVIVES: the same, for a changed speaker', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const target = converted.slides[0]!
    expect(asScriptureRef(target).speaker).toBe('LEADER')
    const flippedEntry: GroupSlideEntry = {
      ...target,
      sourceRef: { ...asScriptureRef(target), speaker: 'CONGREGATION' },
    }
    const flippedGroup: SlideGroup = {
      ...converted,
      slides: converted.slides.map((entry) => (entry.id === target.id ? flippedEntry : entry)),
    }

    const tick1 = tick(flippedGroup, sectionsSlot, inputs)
    expect(tick1.changed).toBe(false)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toHaveLength(3)
    expect(congregationalSectionFromRef(tick2.group.slides[0]!.sourceRef)!.speaker).toBe('CONGREGATION')
    expect(tick2.group.slides[1]).toEqual(converted.slides[1])
    expect(tick2.group.slides[2]).toEqual(converted.slides[2])
  })

  it('REORDER SURVIVES: after conversion, reversing the entries and running two further ticks leaves them in the reversed order', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const reversed = [...converted.slides].reverse()
    const reorderedGroup: SlideGroup = { ...converted, slides: reversed }

    const tick1 = tick(reorderedGroup, sectionsSlot, inputs)
    expect(tick1.changed).toBe(false)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides.map((entry) => entry.id)).toEqual(reversed.map((entry) => entry.id))
    expect(tick2.group.slides.map((entry) => congregationalSectionFromRef(entry.sourceRef))).toEqual(
      [...THREE_SECTIONS].reverse(),
    )
  })

  it('DESTROY ON REFERENCE CHANGE: after conversion, moving the slot to a different passage via scriptureSlotAfterReferenceChange and running two ticks leaves exactly ONE entry whose sourceRef deep-equals the payload-free scripture ref, and assembling that group yields exactly one slide showing the NEW reference with an empty passage body', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const newRef: ScriptureRef = { book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 }
    const newSlot = scriptureSlotAfterReferenceChange(sectionsSlot, newRef)
    expect(newSlot.congregationalSections).toBeUndefined()

    const tick1 = tick(converted, newSlot, inputs)
    expect(tick1.changed).toBe(true)
    const tick2 = tick(tick1.group, newSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toHaveLength(1)
    expect(tick2.group.slides[0]!.sourceRef).toEqual({ kind: 'scripture' })

    const result = assembleSlideshow(
      makeService([newSlot]),
      makeInputs({ groupsBySlotId: new Map([[newSlot.id, tick2.group]]) }),
    )
    expect(result).toHaveLength(1)
    const slide = result[0]!.slide as ScriptureSlide
    expect(slide.readingMode).toBe('normal')
    expect(slide.reference).toBe(formatScriptureReference(newRef))
    expect(slide.text).toBe('')
  })

  it("DESTROY ON CLEARED REFERENCE: after conversion, clearing the slot's reference via the same function and running two ticks leaves no scripture entry, while a hand-added video entry appended before the clear is still present", () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const videoEntry: GroupSlideEntry = {
      id: 'video-hand-added',
      order: converted.slides.length,
      sourceRef: { kind: 'video', videoSrc: 'https://storage.example/video.mp4' },
    }
    const withVideo: SlideGroup = { ...converted, slides: [...converted.slides, videoEntry] }

    const clearedSlot = scriptureSlotAfterReferenceChange(sectionsSlot, null)
    expect(clearedSlot.congregationalSections).toBeUndefined()
    expect(scriptureRefFromSlot(clearedSlot)).toBeNull()

    const tick1 = tick(withVideo, clearedSlot, inputs)
    expect(tick1.changed).toBe(true)
    const tick2 = tick(tick1.group, clearedSlot, inputs)
    expect(tick2.changed).toBe(false)

    const scriptureEntries = tick2.group.slides.filter((entry) => entry.sourceRef.kind === 'scripture')
    expect(scriptureEntries).toHaveLength(0)

    const videoEntries = tick2.group.slides.filter((entry) => entry.sourceRef.kind === 'video')
    expect(videoEntries).toHaveLength(1)
    expect(videoEntries[0]!.id).toBe(videoEntry.id)
    expect(videoEntries[0]!.sourceRef).toEqual(videoEntry.sourceRef)
  })

  it('CR-01 REGRESSION: clearing the reference then re-entering the IDENTICAL reading does not strand the group at zero slides', () => {
    // 38-REVIEW CR-01: CONVERT -> CLEAR REFERENCE -> RE-CONVERT WITH
    // IDENTICAL CONTENT. Before the fix, clearing the reference emptied
    // `slides` but left the OLD congregational `sourceSignature` stored
    // (the fresh signature for a no-reference slot is `undefined`, and the
    // write path's `stripUndefined` treats `undefined` as "no opinion, leave
    // it alone"). Re-entering the exact same reading then reproduces the
    // exact same signature string, which matches the stale stored one, so
    // `rebuildScriptureGroup`'s DETACHED short-circuit returned the group's
    // now-permanently-empty `slides` array forever — the group never
    // re-converts. This test fails on the pre-fix code with `tick3.group.slides`
    // stuck at length 0, and passes once the CLEARED REFERENCE branch
    // explicitly clears the stored signature (`RebuildResult.sourceSignature: null`).
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)
    expect(converted.slides).toHaveLength(3)
    const originalSignature = converted.sourceSignature
    expect(originalSignature).toBe(sourceSignature(sectionsSlot, inputs))

    // Clear the reference entirely (mirrors DESTROY ON CLEARED REFERENCE).
    const clearedSlot = scriptureSlotAfterReferenceChange(sectionsSlot, null)
    expect(clearedSlot.congregationalSections).toBeUndefined()
    expect(scriptureRefFromSlot(clearedSlot)).toBeNull()

    const tick1 = tick(converted, clearedSlot, inputs)
    expect(tick1.changed).toBe(true)
    expect(tick1.group.slides).toHaveLength(0)
    // The load-bearing assertion this regression closes: the stale
    // congregational signature must actually be CLEARED, not merely
    // survive because the fresh no-reference signature is `undefined`.
    expect(tick1.group.sourceSignature).toBeUndefined()

    const tick2 = tick(tick1.group, clearedSlot, inputs)
    expect(tick2.changed).toBe(false)
    expect(tick2.group.slides).toHaveLength(0)

    // Re-enter the reference AND sections, reproducing the IDENTICAL
    // reading byte-for-byte (same sectionsSlot as the original conversion) —
    // this recomputes the exact same signature as `originalSignature`.
    expect(sourceSignature(sectionsSlot, inputs)).toBe(originalSignature)

    const tick3 = tick(tick2.group, sectionsSlot, inputs)
    expect(tick3.changed).toBe(true)
    expect(tick3.group.slides).toHaveLength(3)
    expect(tick3.group.slides.map((entry) => congregationalSectionFromRef(entry.sourceRef))).toEqual(THREE_SECTIONS)

    // Settles: a further identical tick reports no change once re-detached.
    const tick4 = tick(tick3.group, sectionsSlot, inputs)
    expect(tick4.changed).toBe(false)
    expect(tick4.group.slides).toHaveLength(3)
  })

  it('RE-CONVERT: after a destroy-by-reference-change, giving the new slot three sections and running a tick converts again to three section entries — the owner must opt back in, and opting back in must work', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const newRef: ScriptureRef = { book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 }
    const destroyedSlot = scriptureSlotAfterReferenceChange(sectionsSlot, newRef)
    const destroyed = tick(converted, destroyedSlot, inputs).group
    expect(destroyed.slides).toHaveLength(1)
    expect(congregationalSectionFromRef(destroyed.slides[0]!.sourceRef)).toBeNull()

    const reconvertedSlot: ScriptureSlot = { ...destroyedSlot, congregationalSections: THREE_SECTIONS }
    const tick1 = tick(destroyed, reconvertedSlot, inputs)
    expect(tick1.changed).toBe(true)
    expect(tick1.group.slides).toHaveLength(3)
    expect(tick1.group.slides.map((entry) => congregationalSectionFromRef(entry.sourceRef))).toEqual(THREE_SECTIONS)

    const tick2 = tick(tick1.group, reconvertedSlot, inputs)
    expect(tick2.changed).toBe(false)
  })

  it("RE-SPLIT: after conversion, replacing the slot's sections with two different ones and running two ticks yields exactly two entries carrying the new sections — never five, never a growing list", () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    const resplitSlot: ScriptureSlot = { ...sectionsSlot, congregationalSections: TWO_SECTIONS }
    const tick1 = tick(converted, resplitSlot, inputs)
    expect(tick1.changed).toBe(true)
    const tick2 = tick(tick1.group, resplitSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toHaveLength(2)
    expect(tick2.group.slides.map((entry) => congregationalSectionFromRef(entry.sourceRef))).toEqual(TWO_SECTIONS)
  })

  it('MIGRATION, congregational: a group in the shape a Phase-34 service actually holds today (one payload-free entry, sourceSignature equal to the bare formatted reference) on a slot that already carries three sections converts to three section entries on tick one and reports no change on tick two — assembling yields three slides', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const bareSignature = formatScriptureReference(scriptureRefFromSlot(sectionsSlot)!)

    const legacyGroup: SlideGroup = {
      id: sectionsSlot.id,
      slotId: sectionsSlot.id,
      serviceId: 'svc-migration',
      slides: [{ id: 'legacy-scripture-entry', order: 0, sourceRef: { kind: 'scripture' } }],
      sourceSignature: bareSignature,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    }

    const tick1 = tick(legacyGroup, sectionsSlot, inputs)
    expect(tick1.changed).toBe(true)
    expect(tick1.group.slides).toHaveLength(3)
    expect(tick1.group.slides.map((entry) => congregationalSectionFromRef(entry.sourceRef))).toEqual(THREE_SECTIONS)

    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    const result = assembleSlideshow(
      makeService([sectionsSlot]),
      makeInputs({ groupsBySlotId: new Map([[sectionsSlot.id, tick2.group]]) }),
    )
    expect(result).toHaveLength(3)
  })

  it('MIGRATION, non-regression: a group in that same stored shape on a slot with NO sections reports no change on the very first tick — deploying this phase must not rewrite a single ordinary scripture group', () => {
    const referenceSlot = baseSlot()
    const inputs = makeInputs()
    const bareSignature = formatScriptureReference(scriptureRefFromSlot(referenceSlot)!)

    const legacyGroup: SlideGroup = {
      id: referenceSlot.id,
      slotId: referenceSlot.id,
      serviceId: 'svc-migration',
      slides: [{ id: 'legacy-scripture-entry', order: 0, sourceRef: { kind: 'scripture' } }],
      sourceSignature: bareSignature,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    }

    const tick1 = tick(legacyGroup, referenceSlot, inputs)
    expect(tick1.changed).toBe(false)
  })

  it('PROJECTED OUTPUT: after conversion, assembleSlideshow over the group yields one slide per surviving entry, each carrying its own speaker and words, in group order', () => {
    const sectionsSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)

    // Fold in a deletion so this also proves the PROJECTED output reflects
    // the surviving set, not merely the original conversion.
    const afterDelete: SlideGroup = { ...converted, slides: [converted.slides[0]!, converted.slides[2]!] }
    const tick1 = tick(afterDelete, sectionsSlot, inputs)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    const result = assembleSlideshow(
      makeService([sectionsSlot]),
      makeInputs({ groupsBySlotId: new Map([[sectionsSlot.id, tick2.group]]) }),
    )
    expect(result).toHaveLength(2)
    const slides = result.map((r) => r.slide as ScriptureSlide)
    expect(slides[0]!.section).toEqual(THREE_SECTIONS[0])
    expect(slides[1]!.section).toEqual(THREE_SECTIONS[2])
    expect(slides[0]!.text).toBe(THREE_SECTIONS[0]!.text)
    expect(slides[1]!.text).toBe(THREE_SECTIONS[2]!.text)
  })

  it('encoding backstop: a section carrying curly quotes and an em dash survives conversion and two further ticks with strict === equality', () => {
    const sectionsSlot = baseSlot({ congregationalSections: [NON_ASCII_SECTION] })
    const inputs = makeInputs()
    const converted = convertedGroup(sectionsSlot, inputs)
    expect(converted.slides).toHaveLength(1)

    const tick1 = tick(converted, sectionsSlot, inputs)
    expect(tick1.changed).toBe(false)
    const tick2 = tick(tick1.group, sectionsSlot, inputs)
    expect(tick2.changed).toBe(false)

    expect(tick2.group.slides).toHaveLength(1)
    const section = congregationalSectionFromRef(tick2.group.slides[0]!.sourceRef)
    expect(section).not.toBeNull()
    expect(section!.text === NON_ASCII_SECTION.text).toBe(true)
  })
})
