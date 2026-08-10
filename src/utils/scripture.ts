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
 * "Romans 8:28", or "Romans 8". Single source of truth — the projector slide
 * (R047), the Planning Center export (`formatScriptureRef` delegates here) and
 * the Service Order row must never disagree about how a passage is written.
 *
 * `parseScriptureInput` can produce a verseStart with no verseEnd (a single
 * verse), which the Planning Center formatter used to collapse to a bare
 * chapter; that case is handled explicitly here.
 *
 * A DEGENERATE range (`verseEnd === verseStart`) collapses to the single verse
 * (HI-02). That state is reachable two ways — `parseScriptureInput` on
 * "John 3:16-16" runs Math.min/Math.max over [16,16], and
 * `ScriptureInput.onSelectAiScripture` writes whatever the AI returns — and the
 * rail row, the grid header and the drawer context line have always collapsed
 * it. Spelling it out here made the projected slide and the Planning Center
 * plan title read "John 3:16-16" while every other surface read "John 3:16".
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
 *
 * The reference the user types on the Service Order tab is the canonical
 * record — there is no separate reading document to fetch first, and no
 * `scriptureReadingId` to link. That indirection is why a scripture item used
 * to produce no slide at all: the id was minted only by an ESV fetch inside a
 * separate editor panel and never written back to the slot.
 *
 * Requires only book + chapter, so a whole-chapter reading is a valid source.
 * Returns `null` for a slot whose reference has not been filled in yet, which
 * is what makes `deriveGroupEntries` correctly derive zero slides for it.
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
 * R064/D1: the ONE congregational-ness predicate on the SLOT side — which
 * sections seed a Reference -> Congregational conversion (`deriveGroupEntries`
 * SCRIPTURE case) and, once seeded, which sections a rebuild diffs the stored
 * signature against (`sourceSignature` SCRIPTURE case).
 *
 * Deliberately ignores `ScriptureSlot.readingMode` — that field is declared
 * but written by no code today, and gating on both it and the sections array
 * would create two fields that can disagree, the same defect shape as Phase
 * 28's two competing `performanceOrder` fields and Phase 33's
 * partially-applied cascade. The single rule, matching `PresentationViewer`'s
 * `isCongregational` computed: sections present and non-empty means
 * congregational.
 *
 * Pure passthrough — no copying, sorting, filtering, mapping, slicing or
 * string transformation of any kind. Section text is projected verbatim to a
 * congregation, so this function must be provably byte-exact by source
 * inspection, not merely by sampling. Returns the slot's OWN array by
 * reference when non-empty (never a copy); returns `[]` — never `undefined`,
 * never the stored array with elements removed — for a slot with no sections
 * or an empty sections array.
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
 * section slide (`resolveEntryContent`'s scripture case, and
 * `rebuildScriptureGroup`'s cleared-reference branch). `speaker` present is
 * the discriminator (matching the `text` member's authored-`body` precedent
 * in `SourceRef`'s doc comment) — a Reference-state entry and a legacy
 * pre-Phase-38 entry both have no `speaker`, so both correctly return `null`
 * here regardless of any `scriptureReadingId`/`innerSlideId` they still
 * carry.
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
 * provenance. A slide/section with no stored `translationSource` predates
 * this phase, when ESV was the only source — resolves to `'ESV'`, never to
 * the org's CURRENT `bibleVersion` setting.
 *
 * This function MUST NEVER import or read `authStore`/`OrgSettings`/
 * `DEFAULT_ORG_SETTINGS` — reading the church's current setting here would
 * silently violate "changing the setting never retroactively alters an
 * existing slide" (45-RESEARCH.md § Don't Hand-Roll #4). The fallback is
 * deliberately the hardcoded literal `'ESV'`, not a lookup of any kind.
 */
export function resolveTranslationSource(slide: { translationSource?: 'ESV' | 'NLT' }): 'ESV' | 'NLT' {
  return slide.translationSource ?? 'ESV'
}

/**
 * Writes a new reference onto a `ScriptureSlot` (the same four-field spread
 * `ServiceEditorView.onScriptureChange` performs inline today) and owns ONE
 * additional rule: a stored congregational reading is never carried onto a
 * passage it was not derived from. Section text is projected verbatim to a
 * congregation, so leaving one passage's words attached to a slot that now
 * reads a different reference would project scripture under the wrong
 * heading — a correctness failure the assembler cannot detect, because by
 * then the sections look perfectly valid. Clearing on a reference change is
 * the only clearing rule; no other slot mutation clears sections, because the
 * reference is the only thing that changes which passage a stored reading
 * belongs to.
 *
 * Uses the canonical `formatScriptureReference` formatter on both sides
 * (ME-02: one canonical formatter, not a second inline copy of the
 * book/chapter/verse comparison).
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
