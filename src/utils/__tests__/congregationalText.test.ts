import { describe, it, expect } from 'vitest'
import {
  SPEAKER_LABELS,
  parseCongregationalText,
  serializeCongregationalSections,
} from '@/utils/congregationalText'
import type { CongregationalSection } from '@/types/slide'

// The owner's canonical example — must yield exactly 3 sections.
const CANONICAL = `Leader
How lonely sits the city that was full of people!
---
Congregation
She weeps bitterly in the night,
---
Leader
Judah has gone into exile`

describe('congregationalText', () => {
  describe('parseCongregationalText', () => {
    it("parses the owner's canonical example into exactly 3 Leader/Congregation/Leader sections", () => {
      const sections = parseCongregationalText(CANONICAL)
      expect(sections).toHaveLength(3)
      expect(sections[0]).toEqual({
        speaker: 'LEADER',
        text: 'How lonely sits the city that was full of people!',
      })
      expect(sections[1]).toEqual({
        speaker: 'CONGREGATION',
        text: 'She weeps bitterly in the night,',
      })
      expect(sections[2]).toEqual({ speaker: 'LEADER', text: 'Judah has gone into exile' })
    })

    it('recognizes speaker labels case-insensitively (leader / LEADER / Leader)', () => {
      const text = `leader
lower text
---
LEADER
upper text
---
Leader
title text
---
congregation
cong text
---
ALL
all text`
      const sections = parseCongregationalText(text)
      expect(sections.map((s) => s.speaker)).toEqual([
        'LEADER',
        'LEADER',
        'LEADER',
        'CONGREGATION',
        'ALL',
      ])
      expect(sections[0]!.text).toBe('lower text')
      expect(sections[4]!.text).toBe('all text')
    })

    it('defaults a chunk with no recognized label to LEADER with the whole chunk as text', () => {
      const sections = parseCongregationalText('Just some words\nover two lines')
      expect(sections).toHaveLength(1)
      expect(sections[0]).toEqual({ speaker: 'LEADER', text: 'Just some words\nover two lines' })
    })

    it('preserves multi-line body text after a label', () => {
      const sections = parseCongregationalText('Congregation\nline one\nline two')
      expect(sections).toHaveLength(1)
      expect(sections[0]).toEqual({ speaker: 'CONGREGATION', text: 'line one\nline two' })
    })

    it('skips blank chunks and lone-label chunks', () => {
      const text = `Leader
real text
---

---
Congregation
---
All
more text`
      const sections = parseCongregationalText(text)
      // blank chunk (between the two ---) skipped; lone "Congregation" skipped.
      expect(sections).toHaveLength(2)
      expect(sections[0]).toEqual({ speaker: 'LEADER', text: 'real text' })
      expect(sections[1]).toEqual({ speaker: 'ALL', text: 'more text' })
    })

    it('tolerates whitespace-padded --- delimiter lines', () => {
      const text = 'Leader\na\n   ---   \nCongregation\nb'
      const sections = parseCongregationalText(text)
      expect(sections).toHaveLength(2)
      expect(sections[1]).toEqual({ speaker: 'CONGREGATION', text: 'b' })
    })

    it('returns an empty array for empty or whitespace-only input', () => {
      expect(parseCongregationalText('')).toEqual([])
      expect(parseCongregationalText('   \n  \n ')).toEqual([])
    })

    it('stamps translationSource only when provided', () => {
      const withVersion = parseCongregationalText('Leader\ntext', 'NLT')
      expect(withVersion[0]).toEqual({ speaker: 'LEADER', text: 'text', translationSource: 'NLT' })

      const withoutVersion = parseCongregationalText('Leader\ntext')
      expect(withoutVersion[0]).toEqual({ speaker: 'LEADER', text: 'text' })
      expect('translationSource' in withoutVersion[0]!).toBe(false)
    })
  })

  describe('serializeCongregationalSections', () => {
    it('joins sections with the label above the text, separated by --- lines', () => {
      const sections: CongregationalSection[] = [
        { speaker: 'LEADER', text: 'first' },
        { speaker: 'CONGREGATION', text: 'second' },
      ]
      expect(serializeCongregationalSections(sections)).toBe('Leader\nfirst\n---\nCongregation\nsecond')
    })

    it('uses the canonical speaker labels', () => {
      expect(SPEAKER_LABELS).toEqual({ LEADER: 'Leader', CONGREGATION: 'Congregation', ALL: 'All' })
    })
  })

  describe('round-trip', () => {
    it('parse(serialize(sections)) preserves speakers and text', () => {
      const sections: CongregationalSection[] = [
        { speaker: 'LEADER', text: 'How lonely sits the city' },
        { speaker: 'CONGREGATION', text: 'She weeps bitterly' },
        { speaker: 'ALL', text: 'Judah has gone into exile' },
      ]
      const round = parseCongregationalText(serializeCongregationalSections(sections))
      expect(round).toEqual(sections)
    })
  })
})
