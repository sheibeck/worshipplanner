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
 * reaches an assembled `ScriptureSlide` on both materialization paths, is
 * stable across a group rebuild, and satisfies the exact predicate
 * `PresentationViewer.vue`'s `isCongregational` computed evaluates before it
 * will render the Leader/Congregation layout at all.
 */

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
 * both without duplicating setup. */
function assembleBothPaths(slot: ScriptureSlot): { fallback: ScriptureSlide; storedGroup: ScriptureSlide } {
  const fallbackResult = assembleSlideshow(makeService([slot]), makeInputs())

  const groupInputs = makeInputs()
  const initial = buildInitialGroup(slot, 'svc-pipeline', groupInputs)
  const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }
  const storedInputs = makeInputs({ groupsBySlotId: new Map([[slot.id, group]]) })
  const storedResult = assembleSlideshow(makeService([slot]), storedInputs)

  return {
    fallback: fallbackResult[0]!.slide as ScriptureSlide,
    storedGroup: storedResult[0]!.slide as ScriptureSlide,
  }
}

/** Builds the initial group, runs `rebuildGroup` on it (the operation
 * `useSlideshowAssembly` performs on every reconciliation pass), and
 * reassembles from the REBUILT group — proving the composed path survives a
 * rebuild, not merely a first materialization. */
function assembleAfterRebuild(slot: ScriptureSlot): ScriptureSlide {
  const inputs = makeInputs()
  const initial = buildInitialGroup(slot, 'svc-pipeline', inputs)
  const group: SlideGroup = { ...initial, createdAt: mockTimestamp, updatedAt: mockTimestamp }

  const rebuildResult = rebuildGroup(group, slot, inputs)
  const rebuiltGroup: SlideGroup = { ...group, slides: rebuildResult.slides }

  const rebuiltInputs = makeInputs({ groupsBySlotId: new Map([[slot.id, rebuiltGroup]]) })
  const result = assembleSlideshow(makeService([slot]), rebuiltInputs)
  return result[0]!.slide as ScriptureSlide
}

/** Restates `PresentationViewer.vue`'s own `isCongregational` computed
 * (lines ~493-498) rather than importing the component — the point of this
 * assertion is that the two conditions AGREE, so restating it is itself the
 * proof, not a shortcut around one. */
function presentationPredicate(slide: ScriptureSlide): boolean {
  return slide.readingMode === 'congregational' && Array.isArray(slide.sections) && slide.sections.length > 0
}

describe('congregational reading pipeline — composed slot -> group -> slide contract (R064, 34-VERIFICATION.md Truth 1)', () => {
  it('sanity: THREE_SECTIONS partitions SOURCE_PASSAGE exactly, with no gap or overlap', () => {
    expect(THREE_SECTIONS.map((s) => s.text).join('')).toBe(SOURCE_PASSAGE)
  })

  it('fallback path: a slot with three sections assembles to exactly ONE scripture slide, readingMode congregational, sections deep-equal in stored order', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const result = assembleSlideshow(makeService([slot]), makeInputs())

    expect(result).toHaveLength(1)
    const slide = result[0]!.slide as ScriptureSlide
    expect(slide.contentKind).toBe('scripture')
    expect(slide.readingMode).toBe('congregational')
    expect(slide.sections).toEqual(THREE_SECTIONS)
  })

  it('stored-group path: the same slot fed through buildInitialGroup produces the same one slide, same readingMode, same sections', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    expect(storedGroup.readingMode).toBe(fallback.readingMode)
    expect(storedGroup.sections).toEqual(fallback.sections)
    expect(storedGroup.readingMode).toBe('congregational')
    expect(storedGroup.sections).toEqual(THREE_SECTIONS)
  })

  it('rebuild stability: rebuildGroup followed by reassembly yields the same sections in the same order', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const beforeRebuild = assembleBothPaths(slot).storedGroup
    const afterRebuild = assembleAfterRebuild(slot)

    expect(afterRebuild.readingMode).toBe('congregational')
    expect(afterRebuild.sections).toEqual(beforeRebuild.sections)
    expect(afterRebuild.sections).toEqual(THREE_SECTIONS)
  })

  it('same-speaker adjacency: two consecutive CONGREGATION sections both survive to the slide, unmerged, on both paths', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slide of [fallback, storedGroup]) {
      expect(slide.sections).toHaveLength(3)
      expect(slide.sections![1]!.speaker).toBe('CONGREGATION')
      expect(slide.sections![2]!.speaker).toBe('CONGREGATION')
      expect(slide.sections![1]!.text).not.toBe(slide.sections![2]!.text)
    }
  })

  it('text adjacency: concatenating the assembled sections reproduces the source passage with nothing duplicated and nothing dropped, on both paths', () => {
    const slot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slide of [fallback, storedGroup]) {
      const reconstructed = slide.sections!.map((s) => s.text).join('')
      expect(reconstructed).toBe(SOURCE_PASSAGE)
    }
  })

  it('backward compatibility, absent: a slot with no congregationalSections assembles to readingMode normal, empty text, empty verseRange, no sections key, on both paths', () => {
    const slot = baseSlot()
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slide of [fallback, storedGroup]) {
      expect(slide.readingMode).toBe('normal')
      expect(slide.text).toBe('')
      expect(slide.verseRange).toBe('')
      expect(Object.prototype.hasOwnProperty.call(slide, 'sections')).toBe(false)
    }
  })

  it('backward compatibility, empty: a slot with congregationalSections: [] holds the same shape as absent, on both paths', () => {
    const slot = baseSlot({ congregationalSections: [] })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slide of [fallback, storedGroup]) {
      expect(slide.readingMode).toBe('normal')
      expect(slide.text).toBe('')
      expect(slide.verseRange).toBe('')
      expect(Object.prototype.hasOwnProperty.call(slide, 'sections')).toBe(false)
    }
  })

  it('encoding backstop: a section carrying curly quotes and an em dash survives the whole path with strict === equality, on both paths', () => {
    const slot = baseSlot({ congregationalSections: [NON_ASCII_SECTION] })
    const { fallback, storedGroup } = assembleBothPaths(slot)

    for (const slide of [fallback, storedGroup]) {
      expect(slide.sections).toHaveLength(1)
      expect(slide.sections![0]!.text === NON_ASCII_SECTION.text).toBe(true)
    }
  })

  it('presentation predicate: the inlined isCongregational condition is true for the congregational case and false for both backward-compatible cases', () => {
    const congregationalSlot = baseSlot({ congregationalSections: THREE_SECTIONS })
    const absentSlot = baseSlot()
    const emptySlot = baseSlot({ congregationalSections: [] })

    const congregational = assembleBothPaths(congregationalSlot)
    const absent = assembleBothPaths(absentSlot)
    const empty = assembleBothPaths(emptySlot)

    expect(presentationPredicate(congregational.fallback)).toBe(true)
    expect(presentationPredicate(congregational.storedGroup)).toBe(true)

    expect(presentationPredicate(absent.fallback)).toBe(false)
    expect(presentationPredicate(absent.storedGroup)).toBe(false)

    expect(presentationPredicate(empty.fallback)).toBe(false)
    expect(presentationPredicate(empty.storedGroup)).toBe(false)
  })
})
