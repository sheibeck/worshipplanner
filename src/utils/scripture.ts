import type { ScriptureRef, ScriptureSlot } from '@/types/service'
import type { CongregationalSection } from '@/types/slide'
import type { SourceRef } from '@/types/slideGroup'

export const BIBLE_BOOKS: readonly string[] = [
  // Old Testament (39 books)
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'Song of Solomon',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  // New Testament (27 books)
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
] as const

export function esvLink(book: string, chapter: number): string {
  const bookSlug = book.replace(/\s+/g, '+')
  return `https://www.esv.org/${bookSlug}+${chapter}`
}

/**
 * Public NLT reader link. NLT's own host (`api.nlt.to`) is a JSON/HTML API,
 * not a human-facing reader, so the "View on ..." affordance points at
 * BibleGateway, which serves the NLT and accepts a free-form `Book Chapter`
 * search string plus a `version` param.
 */
export function nltLink(book: string, chapter: number): string {
  const search = encodeURIComponent(`${book} ${chapter}`)
  return `https://www.biblegateway.com/passage/?search=${search}&version=NLT`
}

/**
 * Version-aware reader link (R090). Routes to the church's chosen translation
 * so an NLT church's "View on ..." link never silently lands on ESV — the
 * bug behind the service editor showing "View on ESV.org" while NLT was the
 * selected version.
 */
export function scriptureWebLink(
  book: string,
  chapter: number,
  version: 'ESV' | 'NLT',
): string {
  return version === 'NLT' ? nltLink(book, chapter) : esvLink(book, chapter)
}

/**
 * R298: BibleGateway deep-link for a reference, usable with ANY version — the
 * manual fallback when an org's Bible API is off. Both the reference and the
 * version are `encodeURIComponent`-ed before interpolation (T-103-01).
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scripture.ts)
 */
export function bibleGatewayLink(ref: ScriptureRef, version?: string): string {
  const search = encodeURIComponent(formatScriptureReference(ref))
  const base = `https://www.biblegateway.com/passage/?search=${search}`
  return version ? `${base}&version=${encodeURIComponent(version)}` : base
}

export function parseScriptureInput(text: string): ScriptureRef | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // Match: "<book text> <chapter>[:<verse expression>]"
  const match = trimmed.match(/^(.+?)\s+(\d+)(?::(.+))?$/)
  if (!match) return null

  const [, bookToken, chapterToken, verseExpr] = match

  // Resolve book name
  const inputLower = bookToken!.trim().toLowerCase()
  let resolvedBook: string | null = null

  // Exact match (case-insensitive) wins
  const exactMatch = BIBLE_BOOKS.find((b) => b.toLowerCase() === inputLower)
  if (exactMatch) {
    resolvedBook = exactMatch
  } else {
    // Prefix match: canonical name starts with the input token.
    // Require at least 4 characters to prevent short ambiguous tokens (e.g. "joh").
    if (inputLower.length < 4) return null
    const prefixMatches = BIBLE_BOOKS.filter((b) =>
      b.toLowerCase().startsWith(inputLower),
    )
    if (prefixMatches.length === 1) {
      resolvedBook = prefixMatches[0]!
    } else {
      return null // ambiguous or no match
    }
  }

  // Parse chapter
  const chapter = parseInt(chapterToken!, 10)
  if (isNaN(chapter) || chapter <= 0) return null

  // Parse verse expression (optional)
  let verseStart: number | undefined
  let verseEnd: number | undefined

  if (verseExpr !== undefined) {
    const verseStr = verseExpr.trim()
    // Collect all numbers from potentially multi-range expressions like "1-10,15-20"
    const numberMatches = verseStr.match(/\d+/g)
    if (!numberMatches || numberMatches.length === 0) return null

    const numbers = numberMatches.map((n) => parseInt(n, 10))
    if (numbers.some(isNaN)) return null

    if (numbers.length === 1) {
      // Single verse: "28"
      verseStart = numbers[0]
    } else {
      // Range or multi-range: verseStart = min, verseEnd = max
      verseStart = Math.min(...numbers)
      verseEnd = Math.max(...numbers)
    }
  }

  const result: ScriptureRef = { book: resolvedBook, chapter }
  if (verseStart !== undefined) result.verseStart = verseStart
  if (verseEnd !== undefined) result.verseEnd = verseEnd

  return result
}

/**
 * The canonical human-readable form of a reference: "Romans 8:1-11",
 * "Romans 8:28", or "Romans 8". Single source of truth — the projector slide,
 * the Planning Center export, and the Service Order row must never disagree.
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scripture.ts)
 */
export function formatScriptureReference(ref: ScriptureRef): string {
  if (ref.verseStart && ref.verseEnd && ref.verseEnd !== ref.verseStart) {
    return `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
  }
  if (ref.verseStart) return `${ref.book} ${ref.chapter}:${ref.verseStart}`
  return `${ref.book} ${ref.chapter}`
}

/**
 * R047: a SCRIPTURE slot's OWN reference fields are the slide's source.
 * Returns `null` for a slot whose reference has not been filled in yet.
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scripture.ts)
 */
export function scriptureRefFromSlot(slot: ScriptureSlot): ScriptureRef | null {
  if (!slot.book || !slot.chapter) return null
  const ref: ScriptureRef = { book: slot.book, chapter: slot.chapter }
  if (slot.verseStart != null) ref.verseStart = slot.verseStart
  if (slot.verseEnd != null) ref.verseEnd = slot.verseEnd
  return ref
}

export function scripturesOverlap(reading: ScriptureRef, sermon: ScriptureRef): boolean {
  if (reading.book !== sermon.book || reading.chapter !== sermon.chapter) return false
  if (!reading.verseStart || !reading.verseEnd || !sermon.verseStart || !sermon.verseEnd) return true
  return reading.verseStart <= sermon.verseEnd && reading.verseEnd >= sermon.verseStart
}

/**
 * R064/D1: the ONE congregational-ness predicate on the SLOT side. Pure
 * passthrough (no copy/sort/filter/transform) — section text is projected
 * verbatim to a congregation, so this must be provably byte-exact by
 * inspection. Returns the slot's OWN array by reference when non-empty, `[]`
 * otherwise (never `undefined`).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/scripture.ts)
 */
export function congregationalSectionsFromSlot(slot: ScriptureSlot): CongregationalSection[] {
  if (Array.isArray(slot.congregationalSections) && slot.congregationalSections.length > 0) {
    return slot.congregationalSections
  }
  return []
}

/**
 * R064/D1: the mirror predicate on the ENTRY side — the ONLY place any
 * consumer decides whether a stored `GroupSlideEntry` is a congregational
 * section slide. `speaker` present is the discriminator.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/scripture.ts)
 */
export function congregationalSectionFromRef(ref: SourceRef): CongregationalSection | null {
  if (ref.kind !== 'scripture' || ref.speaker === undefined) return null
  return {
    speaker: ref.speaker,
    text: ref.text ?? '',
    ...(ref.verseRange !== undefined ? { verseRange: ref.verseRange } : {}),
    // IN-02 (47-REVIEW): defense-in-depth — thread translationSource through
    // so a future consumer that treats this return value as a COMPLETE
    // CongregationalSection (as its name implies) doesn't silently lose
    // translation provenance. Today's two callers are unaffected either
    // way (slideshowAssembler.ts re-reads ref.translationSource directly;
    // EditSlideDrawer.vue spreads the whole sourceRef, preserving it as a
    // sibling field), so this is additive, not a behavior change.
    ...(ref.translationSource !== undefined ? { translationSource: ref.translationSource } : {}),
  }
}

/**
 * R091: initials-only scripture attribution, shared by BOTH the
 * scripture-slide path and the congregational-reading path (CONTEXT.md Area
 * 2 — "build once, shared", not a second copy inline in a render component).
 * Non-saleable projected media needs only the initials, never a full
 * copyright notice.
 */
export function scriptureAttribution(version: 'ESV' | 'NLT'): string {
  return `(${version})`
}

/**
 * R092: the ONE field-less-fallback decision point for translation
 * provenance. MUST NEVER import or read `authStore`/`OrgSettings`/
 * `DEFAULT_ORG_SETTINGS` — the fallback is the hardcoded literal `'ESV'`.
 * See .planning/codebase/INTEGRATIONS.md (Utils Integration Notes — src/utils/scripture.ts)
 */
export function resolveTranslationSource(slide: { translationSource?: 'ESV' | 'NLT' }): 'ESV' | 'NLT' {
  return slide.translationSource ?? 'ESV'
}

/**
 * Writes a new reference onto a `ScriptureSlot` and owns ONE additional rule:
 * a stored congregational reading is never carried onto a passage it was not
 * derived from — clearing on a reference change is the only clearing rule.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/scripture.ts)
 */
export function scriptureSlotAfterReferenceChange(
  slot: ScriptureSlot,
  ref: ScriptureRef | null,
): ScriptureSlot {
  const currentRef = scriptureRefFromSlot(slot)
  const currentText = currentRef ? formatScriptureReference(currentRef) : ''
  const newText = ref ? formatScriptureReference(ref) : ''

  const nextSlot: ScriptureSlot = {
    ...slot,
    book: ref?.book ?? null,
    chapter: ref?.chapter ?? null,
    verseStart: ref?.verseStart ?? null,
    verseEnd: ref?.verseEnd ?? null,
  }

  const referenceChanged = currentText !== newText
  const hasSections = Array.isArray(slot.congregationalSections) && slot.congregationalSections.length > 0

  if (referenceChanged && hasSections) {
    delete nextSlot.congregationalSections
  }

  return nextSlot
}
