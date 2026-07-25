import type { ScriptureRef } from '@/types/service'
import type { ScriptureSlide } from '@/types/slide'

interface SplitOptions {
  wordsPerSlide?: number
}

interface Verse {
  number: number
  text: string
}

const DEFAULT_WORDS_PER_SLIDE = 50

function formatReference(ref: ScriptureRef): string {
  if (ref.verseStart == null) return `${ref.book} ${ref.chapter}`
  if (ref.verseEnd == null || ref.verseEnd === ref.verseStart)
    return `${ref.book} ${ref.chapter}:${ref.verseStart}`
  return `${ref.book} ${ref.chapter}:${ref.verseStart}-${ref.verseEnd}`
}

function formatVerseRange(verses: Verse[]): string {
  if (verses.length === 0) return ''
  // Guaranteed present: the checks above narrow this to exactly-1 and 2-or-more.
  if (verses.length === 1) return `v. ${verses[0]!.number}`
  return `vv. ${verses[0]!.number}-${verses[verses.length - 1]!.number}`
}

function parseVerses(text: string): Verse[] {
  const parts = text.split(/\[(\d+)\]/).filter(Boolean)
  const verses: Verse[] = []
  for (let i = 0; i < parts.length; i += 2) {
    // i < parts.length is the loop condition, so parts[i] is always in bounds.
    const num = parseInt(parts[i]!, 10)
    const content = parts[i + 1]?.trim() ?? ''
    if (!isNaN(num) && content) {
      verses.push({ number: num, text: content })
    }
  }
  return verses
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function splitBySentences(text: string, threshold: number): string[][] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  const groups: string[][] = []
  let current: string[] = []
  let count = 0

  for (const sentence of sentences) {
    const words = wordCount(sentence)
    if (count > 0 && count + words > threshold) {
      groups.push(current)
      current = [sentence.trim()]
      count = words
    } else {
      current.push(sentence.trim())
      count += words
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function buildSlide(
  text: string,
  verseRange: string,
  ref: ScriptureRef,
  position: number,
): ScriptureSlide {
  return {
    id: `scripture-${position}`,
    position,
    contentKind: 'scripture',
    reference: formatReference(ref),
    bookRef: ref,
    text,
    verseRange,
    readingMode: 'normal',
  }
}

export function splitPassage(
  text: string,
  ref: ScriptureRef,
  opts?: SplitOptions,
): ScriptureSlide[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const threshold = opts?.wordsPerSlide ?? DEFAULT_WORDS_PER_SLIDE

  const verses = parseVerses(trimmed)

  if (verses.length === 0) {
    if (wordCount(trimmed) <= threshold) {
      return [buildSlide(trimmed, '', ref, 0)]
    }
    const groups = splitBySentences(trimmed, threshold)
    return groups.map((sentences, i) => buildSlide(sentences.join(' '), '', ref, i))
  }

  if (verses.reduce((sum, v) => sum + wordCount(v.text), 0) <= threshold) {
    const combined = verses.map((v) => v.text).join(' ')
    return [buildSlide(combined, formatVerseRange(verses), ref, 0)]
  }

  const slides: ScriptureSlide[] = []
  let currentVerses: Verse[] = []
  let currentWords = 0

  for (const verse of verses) {
    const vWords = wordCount(verse.text)
    if (currentWords > 0 && currentWords + vWords > threshold) {
      const combined = currentVerses.map((v) => v.text).join(' ')
      slides.push(buildSlide(combined, formatVerseRange(currentVerses), ref, slides.length))
      currentVerses = [verse]
      currentWords = vWords
    } else {
      currentVerses.push(verse)
      currentWords += vWords
    }
  }

  if (currentVerses.length > 0) {
    const combined = currentVerses.map((v) => v.text).join(' ')
    slides.push(buildSlide(combined, formatVerseRange(currentVerses), ref, slides.length))
  }

  return slides
}
