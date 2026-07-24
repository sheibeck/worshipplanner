import type { ScriptureRef } from '@/types/service'

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

export function scripturesOverlap(reading: ScriptureRef, sermon: ScriptureRef): boolean {
  if (reading.book !== sermon.book || reading.chapter !== sermon.chapter) return false
  if (!reading.verseStart || !reading.verseEnd || !sermon.verseStart || !sermon.verseEnd) return true
  return reading.verseStart <= sermon.verseEnd && reading.verseEnd >= sermon.verseStart
}
