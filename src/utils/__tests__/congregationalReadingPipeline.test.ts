import { describe, it, expect } from 'vitest'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import type { AssemblyInputs } from '@/utils/slideshowAssembler'
import { buildInitialGroup, rebuildGroup } from '@/utils/slideGroupMaterializer'
import type { Service, ServiceSlot, ScriptureSlot } from '@/types/service'
import type { ScriptureSlide, CongregationalSection } from '@/types/slide'
import type { SlideGroup } from '@/types/slideGroup'
import type { Timestamp } from 'firebase/firestore'

/**
 * 34-VERIFICATION.md Truth 1 FAILED because `CongregationalEditor.vue` had
 * zero production mount points — every piece of the slot -> group -> slide
 * machinery passed 118 targeted tests while no user could reach any of it.
 * This file is deliberately NOT another test of any one piece. It asserts
 * the COMPOSITION: a congregational reading stored on a `ScriptureSlot`
 * reaches N+1 assembled `ScriptureSlide`s — a dedicated leading reference
 * slide plus one per section (Phase 49, R105; refines Phase 38 D1) — on both
 * materialization paths, SURVIVES a group rebuild without re-deriving (D1's
 * detachment guarantee, the whole point of converting), and satisfies the
 * exact predicate `PresentationViewer.vue`'s `isCongregational` computed
 * evaluates before it will render the Leader/Congregation layout at all.
 *
 * R105 (Phase 49): the reference is no longer an eyebrow on the first section
 * slide — it is emitted as a synthetic leading reference slide (readingMode
 * 'normal', no section) at assembly time on BOTH paths. So a reading with N
 * sections assembles to N+1 slides: index 0 the reference slide, indices 1..N
 * the sections. The group-rebuild/carry machinery is UNTOUCHED (approach B) —
 * the stored group still holds exactly N section entries, and the reference
 * slide is added purely at assembly time.
 */

/** Helper: the section slides of an assembled reading (everything after the
 * synthetic leading reference slide at index 0). */
function sectionsOf(slides: ScriptureSlide[]): ScriptureSlide[] {
  return slides.slice(1)
}

/** Helper: assert a slide is the dedicated leading reference slide (R105). */
function expectReferenceSlide(slide: ScriptureSlide): void {
  expect(slide.readingMode).toBe('normal')
  expect(slide.text).toBe('')
  expect(Object.prototype.hasOwnProperty.call(slide, 'section')).toBe(false)
}

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp

function makeService(slots: ServiceSlot[]): Service {
  return {
    id: 'svc-pipeline',
    date: '2026-01-04',
    name: 'Pipeline Test Service',
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

// One source passage, partitioned (not merely concatenated back together
// after the fact) into three sections so the adjacency/concatenation checks
// below are meaningful rather than circular. The third section deliberately
// repeats the second's speaker so the non-merging case lives in the SAME
// fixture every other case uses, rather than a special-cased one.
const SOURCE_PASSAGE =
  'The Lord is my shepherd; I shall not want. ' +
  'He makes me lie down in green pastures. ' +
  'He leads me beside still waters.'

const THREE_SECTIONS: CongregationalSection[] = [
  { speaker: 'LEADER', text: 'The Lord is my shepherd; I shall not want. ' },
  { speaker: 'CONGREGATION', text: 'He makes me lie down in green pastures. ' },
  { speaker: 'CONGREGATION', text: 'He leads me beside still waters.' },
]

// Encoding backstop fixture: curly quotes (U+2018/U+2019/U+201C/U+201D) and
// an em dash (U+2014), mirroring scriptureBoundaries.test.ts's
// NON_ASCII_FIXTURE technique — strict `===` end to end, no normalization.
const NON_ASCII_SECTION: CongregationalSection = {
  speaker: 'LEADER',
  text: '‘He restores my soul’ — “he leads me in paths of righteousness.”',
}

function baseSlot(overrides: Partial<ScriptureSlot> = {}): ScriptureSlot {
  return {
    kind: 'SCRIPTURE',
    id: 'slot-scripture-pipeline',
    position: 0,
    book: 'Psalms',
    chapter: 23,
    verseStart: 1,
    verseEnd: 3,
    ...overrides,
  }
}

/** Assembles the same slot through both materialization paths: an empty
 * `groupsBySlotId` (fallback — no group materialized yet) and a group built
 * from `buildInitialGroup` (stored-group — the shape a real service reaches
 * once `useSlideshowAssembly` has run). Every case below asserts against
 * both without duplicating setup. Returns every assembled scripture slide
 * for the slot (N of them for a congregational reading), not just the first. */
function assembleBothPaths(slot: ScriptureSlot): { fallback: ScriptureSlide[]; storedGroup: ScriptureSlide[] } {
  const fallbackResult = assembleSlideshow(makeService([slot]), makeInputs())

  const groupInputs = makeInputs()
  const initial = buildInitialGroup(slot, 'svc-pipeline', groupInputs)
  const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }
  const storedInputs = makeInputs({ groupsBySlotId: new Map([[slot.id, group]]) })
  const storedResult = assembleSlideshow(makeService([slot]), storedInputs)

  return {
    fallback: fallbackResult.map((r) => r.slide as ScriptureSlide),
    storedGroup: storedResult.map((r) => r.slide as ScriptureSlide),
  }
}

/** Builds the initial group, runs `rebuildGroup` on it ONCE (the operation
 * `useSlideshowAssembly` performs on every reconciliation pass), and
 * reassembles from the REBUILT group — proving the composed path survives a
 * rebuild, not merely a first materialization. Runs `rebuildGroup` a SECOND
 * time over its own output to prove the detached state is a fixed point, not
 * merely stable for one pass. */
function assembleAfterRebuild(slot: ScriptureSlot): ScriptureSlide[] {
  const inputs = makeInputs()
  const initial = buildInitialGroup(slot, 'svc-pipeline', inputs)
  const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }

  const firstRebuild = rebuildGroup(group, slot, inputs)
  const rebuiltGroup: SlideGroup = { ...group, slides: firstRebuild.slides }

  const secondRebuild = rebuildGroup(rebuiltGroup, slot, inputs)
  expect(secondRebuild.changed).toBe(false)
  expect(secondRebuild.slides).toEqual(firstRebuild.slides)

  const rebuiltInputs = makeInputs({ groupsBySlotId: new Map([[slot.id, rebuiltGroup]]) })
  const result = assembleSlideshow(makeService([slot]), rebuiltInputs)
  return result.map((r) => r.slide as ScriptureSlide)
}

/** Restates `PresentationViewer.vue`'s own `isCongregational` computed
 * (lines ~492-497) rather than importing the component — the point of this
 * assertion is that the two conditions AGREE, so restating it is itself the
 * proof, not a shortcut around one. Each assembled congregational slide
 * carries `readingMode: 'congregational'` and the singular `section` field
 * (38-02) — a Reference-state slide has no `section` at all. */
function presentationPredicate(slide: ScriptureSlide): boolean {
  return slide.readingMode === 'congregational' && slide.section !== undefined
}

describe('congregational reading pipeline — composed slot -> group -> slide contract (D1, 34-VERIFICATION.md Truth 1)', () => {
  it('sanity: THREE_SECTIONS partitions SOURCE_PASSAGE exactly, with no gap or overlap', () => {
    expect(THREE_SECTIONS.map((s) => s.text).join('')).toBe(SOURCE_PASSAGE)
  })

  it('fallback path: a slot with three sections assembles to N+1 = FOUR scripture slides — the reference slide, then one congregational slide per section', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const result = assembleSlideshow(makeService([slot]), makeInputs())

    expect(result).toHaveLength(4)
    const slides = result.map((r) => r.slide as ScriptureSlide)
    expectReferenceSlide(slides[0]!)
    const sections = sectionsOf(slides)
    for (let i = 0; i < 3; i++) {
      expect(sections[i]!.contentKind).toBe('scripture')
      expect(sections[i]!.readingMode).toBe('congregational')
      expect(sections[i]!.section).toEqual(THREE_SECTIONS[i])
      expect(sections[i]!.text).toBe(THREE_SECTIONS[i]!.text)
    }
  })

  it('stored-group path: the same slot fed through buildInitialGroup produces the same N+1 slides — reference slide then per-section slides, identical to the fallback path', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    expect(storedGroup).toHaveLength(4)
    expect(fallback).toHaveLength(4)
    // Index 0: the dedicated reference slide, identical on both paths.
    expectReferenceSlide(storedGroup[0]!)
    expectReferenceSlide(fallback[0]!)
    expect(storedGroup[0]!.reference).toBe(fallback[0]!.reference)
    // Indices 1..N: the sections.
    const storedSections = sectionsOf(storedGroup)
    const fallbackSections = sectionsOf(fallback)
    for (let i = 0; i < 3; i++) {
      expect(storedSections[i]!.readingMode).toBe(fallbackSections[i]!.readingMode)
      expect(storedSections[i]!.section).toEqual(fallbackSections[i]!.section)
      expect(storedSections[i]!.readingMode).toBe('congregational')
      expect(storedSections[i]!.section).toEqual(THREE_SECTIONS[i])
    }
  })

  it('rebuild survival (D1 detachment): rebuildGroup followed by reassembly yields the reference slide + the SAME three sections in order — not re-derived, not collapsed', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const beforeRebuild = sectionsOf(assembleBothPaths(slot).storedGroup)
    const afterRebuild = assembleAfterRebuild(slot)

    expect(afterRebuild).toHaveLength(4)
    expectReferenceSlide(afterRebuild[0]!)
    const afterSections = sectionsOf(afterRebuild)
    for (let i = 0; i < 3; i++) {
      expect(afterSections[i]!.readingMode).toBe('congregational')
      expect(afterSections[i]!.section).toEqual(beforeRebuild[i]!.section)
      expect(afterSections[i]!.section).toEqual(THREE_SECTIONS[i])
    }
  })

  it('rebuild survival: a hand-deleted section slide STAYS deleted across a rebuild pass — the detachment guarantee D1 exists for', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const initial = buildInitialGroup(slot, 'svc-pipeline', inputs)
    const fullGroup: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }

    // The user deletes the middle section slide. The stored group holds only
    // section entries (approach B — no stored reference entry), so it drops to
    // two entries.
    const editedGroup: SlideGroup = { ...fullGroup, slides: [fullGroup.slides[0]!, fullGroup.slides[2]!] }

    const rebuildResult = rebuildGroup(editedGroup, slot, inputs)
    expect(rebuildResult.changed).toBe(false)
    expect(rebuildResult.slides).toHaveLength(2)

    const rebuiltInputs = makeInputs({
      groupsBySlotId: new Map([[slot.id, { ...editedGroup, slides: rebuildResult.slides }]]),
    })
    const result = assembleSlideshow(makeService([slot]), rebuiltInputs)
    // N+1: the synthetic reference slide plus the two surviving sections.
    expect(result).toHaveLength(3)
    const slides = result.map((r) => r.slide as ScriptureSlide)
    expectReferenceSlide(slides[0]!)
    expect(sectionsOf(slides).map((s) => s.text)).toEqual([THREE_SECTIONS[0]!.text, THREE_SECTIONS[2]!.text])
  })

  it('destroy: changing the slot to a different passage (which clears congregationalSections) collapses the group to exactly ONE Reference-state slide on the next rebuild', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const inputs = makeInputs()
    const initial = buildInitialGroup(slot, 'svc-pipeline', inputs)
    const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }

    const newPassageSlot = baseSlot({ book: 'Psalms', chapter: 100, verseStart: 1, verseEnd: 5 })
    const rebuildResult = rebuildGroup(group, newPassageSlot, inputs)

    expect(rebuildResult.changed).toBe(true)
    expect(rebuildResult.slides).toHaveLength(1)

    const rebuiltInputs = makeInputs({
      groupsBySlotId: new Map([[slot.id, { ...group, slides: rebuildResult.slides }]]),
    })
    const result = assembleSlideshow(makeService([newPassageSlot]), rebuiltInputs)
    expect(result).toHaveLength(1)
    const slide = result[0]!.slide as ScriptureSlide
    expect(slide.readingMode).toBe('normal')
    expect(slide.text).toBe('')
  })

  it('same-speaker adjacency: two consecutive CONGREGATION sections both survive as separate slides, unmerged, on both paths', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slides of [fallback, storedGroup]) {
      expect(slides).toHaveLength(4)
      const sections = sectionsOf(slides)
      // THREE_SECTIONS[1] and [2] are the two consecutive CONGREGATION sections.
      expect(sections[1]!.section!.speaker).toBe('CONGREGATION')
      expect(sections[2]!.section!.speaker).toBe('CONGREGATION')
      expect(sections[1]!.text).not.toBe(sections[2]!.text)
    }
  })

  it('text adjacency: concatenating the assembled section slides\' text reproduces the source passage with nothing duplicated and nothing dropped, on both paths', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slides of [fallback, storedGroup]) {
      // Skip the index-0 reference slide (empty text); concatenate the sections.
      const reconstructed = sectionsOf(slides).map((s) => s.text).join('')
      expect(reconstructed).toBe(SOURCE_PASSAGE)
    }
  })

  it('backward compatibility, absent: a slot with no congregationalSections assembles to exactly ONE slide, readingMode normal, empty text, empty verseRange, no section key, on both paths', () => {
    const slot = baseSlot()
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slides of [fallback, storedGroup]) {
      expect(slides).toHaveLength(1)
      const slide = slides[0]!
      expect(slide.readingMode).toBe('normal')
      expect(slide.text).toBe('')
      expect(slide.verseRange).toBe('')
      expect(Object.prototype.hasOwnProperty.call(slide, 'section')).toBe(false)
    }
  })

  it('backward compatibility, empty: a slot with congregationalSections: [] holds the same one-slide shape as absent, on both paths', () => {
    const slot = baseSlot({ congregationalSections: [] })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slides of [fallback, storedGroup]) {
      expect(slides).toHaveLength(1)
      const slide = slides[0]!
      expect(slide.readingMode).toBe('normal')
      expect(slide.text).toBe('')
      expect(slide.verseRange).toBe('')
      expect(Object.prototype.hasOwnProperty.call(slide, 'section')).toBe(false)
    }
  })

  it('encoding backstop: a section carrying curly quotes and an em dash survives the whole path with strict === equality, on both paths', () => {
    const slot = baseSlot({ congregationalSections: [NON_ASCII_SECTION] })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slides of [fallback, storedGroup]) {
      // N+1: the reference slide plus the single section slide.
      expect(slides).toHaveLength(2)
      const section = slides[1]!
      expect(section.section).toBeDefined()
      expect(section.section!.text === NON_ASCII_SECTION.text).toBe(true)
      expect(section.text === NON_ASCII_SECTION.text).toBe(true)
    }
  })

  it('presentation predicate: the inlined isCongregational condition is true for every congregational SECTION slide, false for the dedicated reference slide and for both backward-compatible cases', () => {
    const congregationalSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const absentSlot = baseSlot()
    const emptySlot = baseSlot({ congregationalSections: [] })

    const congregational = assembleBothPaths(congregationalSlot)
    const absent = assembleBothPaths(absentSlot)
    const empty = assembleBothPaths(emptySlot)

    // R105: the dedicated reference slide (index 0) is a Reference-state slide
    // — the predicate is FALSE for it, exactly as for a plain scripture slide.
    expect(presentationPredicate(congregational.fallback[0]!)).toBe(false)
    expect(presentationPredicate(congregational.storedGroup[0]!)).toBe(false)

    // Every SECTION slide (indices 1..N) satisfies the predicate.
    for (const slide of [...sectionsOf(congregational.fallback), ...sectionsOf(congregational.storedGroup)]) {
      expect(presentationPredicate(slide)).toBe(true)
    }

    for (const slide of [...absent.fallback, ...absent.storedGroup, ...empty.fallback, ...empty.storedGroup]) {
      expect(presentationPredicate(slide)).toBe(false)
    }
  })
})
