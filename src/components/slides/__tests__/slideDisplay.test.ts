import { describe, it, expect } from 'vitest'
import {
  KIND_BADGE_CLASSES,
  slotDisplayTitle,
  slideContentLabel,
  slideBodyText,
  slideFooterLabel,
  bedAudioLabel,
  reconciliationConfirmCopy,
  deleteSlideConfirmBody,
  type PendingReconciliation,
} from '../slideDisplay'
import type { ServiceSlot, SlotKind, SongSlot } from '@/types/service'
import type { Slide } from '@/types/slide'
import type { GroupSlideEntry } from '@/types/slideGroup'

const ALL_KINDS: SlotKind[] = ['SONG', 'SCRIPTURE', 'PRAYER', 'MESSAGE', 'HYMN', 'IMPORTED']

describe('slideDisplay', () => {
  describe('KIND_BADGE_CLASSES', () => {
    it('has a non-empty literal class string for every slot kind', () => {
      for (const kind of ALL_KINDS) {
        expect(KIND_BADGE_CLASSES[kind]).toBeTruthy()
        expect(typeof KIND_BADGE_CLASSES[kind]).toBe('string')
        expect(KIND_BADGE_CLASSES[kind].length).toBeGreaterThan(0)
      }
    })

    it('never interpolates the kind into the class string (static map only)', () => {
      // Every value must be a plain literal — none should contain a
      // template-string artifact like "${" or the kind's own lowercase form
      // glued into a class name that a purge-scanner couldn't find verbatim.
      for (const kind of ALL_KINDS) {
        expect(KIND_BADGE_CLASSES[kind]).not.toContain('${')
      }
    })
  })

  describe('slotDisplayTitle', () => {
    it('returns the song title for a SONG slot', () => {
      const slot: ServiceSlot = {
        kind: 'SONG',
        id: 'slot-song',
        position: 0,
        requiredVwType: 1,
        songId: 'song-1',
        songTitle: 'Amazing Grace',
        songKey: 'G',
      }
      expect(slotDisplayTitle(slot)).toBe('Amazing Grace')
    })

    it('falls back to the per-kind label when a SONG slot has no song assigned', () => {
      const slot: ServiceSlot = {
        kind: 'SONG',
        id: 'slot-song-empty',
        position: 0,
        requiredVwType: 1,
        songId: null,
        songTitle: null,
        songKey: null,
      }
      expect(slotDisplayTitle(slot)).toBe('Song')
    })

    it('returns a readable passage reference for a SCRIPTURE slot', () => {
      const slot: ServiceSlot = {
        kind: 'SCRIPTURE',
        id: 'slot-scripture',
        position: 1,
        book: 'Psalms',
        chapter: 23,
        verseStart: 1,
        verseEnd: 6,
      }
      expect(slotDisplayTitle(slot)).toBe('Psalms 23:1-6')
    })

    it('omits the range dash for a single-verse SCRIPTURE slot', () => {
      const slot: ServiceSlot = {
        kind: 'SCRIPTURE',
        id: 'slot-scripture-single',
        position: 1,
        book: 'John',
        chapter: 3,
        verseStart: 16,
        verseEnd: 16,
      }
      expect(slotDisplayTitle(slot)).toBe('John 3:16')
    })

    it('falls back to the per-kind label for an empty SCRIPTURE slot', () => {
      const slot: ServiceSlot = {
        kind: 'SCRIPTURE',
        id: 'slot-scripture-empty',
        position: 1,
        book: null,
        chapter: null,
        verseStart: null,
        verseEnd: null,
      }
      expect(slotDisplayTitle(slot)).toBe('Scripture Reading')
    })

    it('returns the hymn name for a HYMN slot', () => {
      const slot: ServiceSlot = {
        kind: 'HYMN',
        id: 'slot-hymn',
        position: 2,
        hymnName: 'Holy, Holy, Holy',
        hymnNumber: '1',
        verses: '1,2,3',
      }
      expect(slotDisplayTitle(slot)).toBe('Holy, Holy, Holy')
    })

    it('falls back to the per-kind label for an empty HYMN slot', () => {
      const slot: ServiceSlot = {
        kind: 'HYMN',
        id: 'slot-hymn-empty',
        position: 2,
        hymnName: '',
        hymnNumber: '',
        verses: '',
      }
      expect(slotDisplayTitle(slot)).toBe('Hymn')
    })

    it('returns the per-kind label for PRAYER, MESSAGE and IMPORTED slots', () => {
      const prayer: ServiceSlot = { kind: 'PRAYER', id: 'slot-prayer', position: 3 }
      const message: ServiceSlot = { kind: 'MESSAGE', id: 'slot-message', position: 4 }
      const imported: ServiceSlot = { kind: 'IMPORTED', id: 'slot-imported', position: 5, importId: null }
      expect(slotDisplayTitle(prayer)).toBe('Prayer')
      expect(slotDisplayTitle(message)).toBe('Message')
      expect(slotDisplayTitle(imported)).toBe('Imported Slides')
    })
  })

  describe('slideContentLabel', () => {
    it('returns the uppercased section label for a lyric slide', () => {
      const slide = {
        id: 's1',
        position: 0,
        contentKind: 'lyric',
        sectionId: 'sec-1',
        sectionLabel: 'Verse 1',
        lines: ['line'],
      } as Slide
      expect(slideContentLabel(slide)).toBe('VERSE 1')
    })

    it('returns TITLE for a copyright slide (lyric contentKind, no sectionId)', () => {
      const slide = {
        id: 's2',
        position: 0,
        contentKind: 'lyric',
        title: 'Amazing Grace',
        authors: ['John Newton'],
        ccliSongNumber: '1',
        copyrightLines: [],
        ccliLicenseNumber: '1',
      } as Slide
      expect(slideContentLabel(slide)).toBe('TITLE')
    })

    it('returns SCRIPTURE, IMAGE and VIDEO for their respective content kinds', () => {
      const scripture = { id: 's3', position: 0, contentKind: 'scripture' } as Slide
      const image = { id: 's4', position: 0, contentKind: 'image' } as Slide
      const video = { id: 's5', position: 0, contentKind: 'video' } as Slide
      expect(slideContentLabel(scripture)).toBe('SCRIPTURE')
      expect(slideContentLabel(image)).toBe('IMAGE')
      expect(slideContentLabel(video)).toBe('VIDEO')
    })

    it('returns the uppercased title for a text slide with a title, TEXT otherwise', () => {
      const withTitle = { id: 's6', position: 0, contentKind: 'text', title: 'Welcome', body: '' } as Slide
      const withoutTitle = { id: 's7', position: 0, contentKind: 'text', body: '' } as Slide
      expect(slideContentLabel(withTitle)).toBe('WELCOME')
      expect(slideContentLabel(withoutTitle)).toBe('TEXT')
    })
  })

  describe('slideBodyText', () => {
    it('returns joined lines for a lyric slide and the title for a copyright slide', () => {
      const lyric = {
        id: 's1',
        position: 0,
        contentKind: 'lyric',
        sectionId: 'sec-1',
        sectionLabel: 'Verse 1',
        lines: ['Line one', 'Line two'],
      } as Slide
      const copyright = {
        id: 's2',
        position: 0,
        contentKind: 'lyric',
        title: 'Amazing Grace',
        authors: [],
        ccliSongNumber: '1',
        copyrightLines: [],
        ccliLicenseNumber: '1',
      } as Slide
      expect(slideBodyText(lyric)).toBe('Line one\nLine two')
      expect(slideBodyText(copyright)).toBe('Amazing Grace')
    })

    it('combines the reference and text for a scripture slide', () => {
      const scripture = {
        id: 's3',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        text: 'The LORD is my shepherd',
      } as Slide
      expect(slideBodyText(scripture)).toBe('Psalms 23:1-6\nThe LORD is my shepherd')
    })

    it('returns the body for a text slide', () => {
      const text = { id: 's4', position: 0, contentKind: 'text', body: 'Please stand.' } as Slide
      expect(slideBodyText(text)).toBe('Please stand.')
    })

    it("names the file for a video slide when it has one, falling back to 'Video'", () => {
      const withFile = { id: 's5', position: 0, contentKind: 'video', videoSrc: 'x', originalFileName: 'clip.mp4' } as Slide
      const withoutFile = { id: 's6', position: 0, contentKind: 'video', videoSrc: 'x' } as Slide
      expect(slideBodyText(withFile)).toBe('Video: clip.mp4')
      expect(slideBodyText(withoutFile)).toBe('Video')
    })
  })

  describe('slideFooterLabel', () => {
    it('returns the natural-case section label / title for lyric and copyright slides', () => {
      const lyric = {
        id: 's1',
        position: 0,
        contentKind: 'lyric',
        sectionId: 'sec-1',
        sectionLabel: 'Verse 1',
        lines: [],
      } as Slide
      const copyright = {
        id: 's2',
        position: 0,
        contentKind: 'lyric',
        title: 'Amazing Grace',
        authors: [],
        ccliSongNumber: '1',
        copyrightLines: [],
        ccliLicenseNumber: '1',
      } as Slide
      expect(slideFooterLabel(lyric)).toBe('Verse 1')
      expect(slideFooterLabel(copyright)).toBe('Amazing Grace')
    })

    it('returns the reference for a scripture slide', () => {
      const scripture = { id: 's3', position: 0, contentKind: 'scripture', reference: 'John 3:16' } as Slide
      expect(slideFooterLabel(scripture)).toBe('John 3:16')
    })

    it("returns the title for a text slide, 'Text' otherwise", () => {
      const withTitle = { id: 's4', position: 0, contentKind: 'text', title: 'Welcome', body: '' } as Slide
      const withoutTitle = { id: 's5', position: 0, contentKind: 'text', body: '' } as Slide
      expect(slideFooterLabel(withTitle)).toBe('Welcome')
      expect(slideFooterLabel(withoutTitle)).toBe('Text')
    })

    it("returns 'Image' for an image slide", () => {
      const image = { id: 's6', position: 0, contentKind: 'image' } as Slide
      expect(slideFooterLabel(image)).toBe('Image')
    })

    it("names the file for a video slide when it has one, falling back to 'Video'", () => {
      const withFile = { id: 's7', position: 0, contentKind: 'video', videoSrc: 'x', originalFileName: 'clip.mp4' } as Slide
      const withoutFile = { id: 's8', position: 0, contentKind: 'video', videoSrc: 'x' } as Slide
      expect(slideFooterLabel(withFile)).toBe('clip.mp4')
      expect(slideFooterLabel(withoutFile)).toBe('Video')
    })
  })

  describe('bedAudioLabel', () => {
    it('extracts the filename from a Firebase Storage download URL', () => {
      const url =
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/orgs%2Forg1%2Fmedia%2Fid1%2Fpad_Cmaj_soft.mp3?alt=media&token=abc'
      expect(bedAudioLabel(url)).toBe('pad_Cmaj_soft.mp3')
    })

    it('falls back to a generic label for a malformed URL', () => {
      expect(bedAudioLabel('%')).toBe('Group music')
    })
  })

  // --- 26-04 Task 3: the reconciliation confirm dialog's warning wording ---
  describe('reconciliationConfirmCopy', () => {
    function proposedEntries(count: number): GroupSlideEntry[] {
      return Array.from({ length: count }, (_, i) => ({
        id: `proposed-${i}`,
        order: i,
        sourceRef: { kind: 'text' as const },
      }))
    }

    function scriptureSlot(): ServiceSlot {
      return {
        kind: 'SCRIPTURE',
        id: 'slot-scripture',
        position: 0,
        book: 'Psalms',
        chapter: 23,
        verseStart: 1,
        verseEnd: 6,
      }
    }

    function songSlot(): SongSlot {
      return {
        kind: 'SONG',
        id: 'slot-song',
        position: 0,
        requiredVwType: 1,
        songId: 'song-b',
        songTitle: 'New Song Title',
        songKey: null,
      }
    }

    it('produces the generic heading and body naming the plan item and both media counts for several slides', () => {
      const pending: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(3),
        loss: { customizedEntries: 3, withAudio: 1, withNotes: 2 },
      }
      const { heading, body } = reconciliationConfirmCopy(pending, scriptureSlot())

      expect(heading).toBe("Update this group's slides?")
      expect(body).toBe(
        '"Psalms 23:1-6"\'s source content has changed since these slides were generated. Applying the update will replace 3 slides you added, including 1 with attached audio, 2 with operator notes. This cannot be undone.',
      )
    })

    it('produces the song-reassignment heading and body naming the old and the new song', () => {
      const pending: PendingReconciliation = {
        slotId: 'slot-song',
        proposed: proposedEntries(2),
        loss: { customizedEntries: 2, withAudio: 0, withNotes: 0 },
        oldSongTitle: 'Old Song Title',
        newSongTitle: 'New Song Title',
      }
      const { heading, body } = reconciliationConfirmCopy(pending, songSlot())

      expect(heading).toBe('Replace "Old Song Title" with "New Song Title"?')
      expect(body).toBe(
        'This group\'s slides currently come from "Old Song Title". Applying the update will switch them to "New Song Title" and replace 2 slides you added. This cannot be undone.',
      )
    })

    it('uses the singular form for exactly one slide and the plural form for more than one', () => {
      const singular: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(1),
        loss: { customizedEntries: 1, withAudio: 0, withNotes: 0 },
      }
      const plural: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(2),
        loss: { customizedEntries: 2, withAudio: 0, withNotes: 0 },
      }
      expect(reconciliationConfirmCopy(singular, scriptureSlot()).body).toContain('replace 1 slide you added')
      expect(reconciliationConfirmCopy(plural, scriptureSlot()).body).toContain('replace 2 slides you added')
    })

    it('names only the non-zero media kind when only one is non-zero', () => {
      const audioOnly: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(3),
        loss: { customizedEntries: 3, withAudio: 1, withNotes: 0 },
      }
      const notesOnly: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(3),
        loss: { customizedEntries: 3, withAudio: 0, withNotes: 2 },
      }
      expect(reconciliationConfirmCopy(audioOnly, scriptureSlot()).body).toBe(
        '"Psalms 23:1-6"\'s source content has changed since these slides were generated. Applying the update will replace 3 slides you added, including 1 with attached audio. This cannot be undone.',
      )
      expect(reconciliationConfirmCopy(notesOnly, scriptureSlot()).body).toBe(
        '"Psalms 23:1-6"\'s source content has changed since these slides were generated. Applying the update will replace 3 slides you added, including 2 with operator notes. This cannot be undone.',
      )
    })

    it('drops the "including" clause entirely when neither attached audio nor operator notes are at risk', () => {
      const pending: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(2),
        loss: { customizedEntries: 2, withAudio: 0, withNotes: 0 },
      }
      expect(reconciliationConfirmCopy(pending, scriptureSlot()).body).toBe(
        '"Psalms 23:1-6"\'s source content has changed since these slides were generated. Applying the update will replace 2 slides you added. This cannot be undone.',
      )
    })

    it('falls back to the number of proposed slides when loss counts are missing altogether', () => {
      const pending: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(4),
      }
      expect(reconciliationConfirmCopy(pending, scriptureSlot()).body).toContain('replace 4 slides you added')
    })

    it('never builds a per-slide list, a diff, or a before-and-after — only counts and kinds', () => {
      const pending: PendingReconciliation = {
        slotId: 'slot-scripture',
        proposed: proposedEntries(3),
        loss: { customizedEntries: 3, withAudio: 1, withNotes: 1 },
      }
      const { heading, body } = reconciliationConfirmCopy(pending, scriptureSlot())
      for (const entry of pending.proposed) {
        expect(body).not.toContain(entry.id)
      }
      expect(heading).not.toContain('\n')
      expect(body).not.toContain('\n')
    })
  })

  describe('deleteSlideConfirmBody (Phase 26-09 Task 3)', () => {
    function makeEntry(overrides: Partial<GroupSlideEntry> = {}): GroupSlideEntry {
      return { id: 'entry-1', order: 0, sourceRef: { kind: 'text' }, ...overrides }
    }

    it('names both attached audio and operator notes when both are present', () => {
      const entry = makeEntry({ audioUrl: 'https://example.com/a.mp3', notes: 'Some note' })
      expect(deleteSlideConfirmBody(entry)).toBe(
        'Deleting this slide also removes its attached audio and operator notes. This cannot be undone.',
      )
    })

    it('names only attached audio when notes are absent', () => {
      const entry = makeEntry({ audioUrl: 'https://example.com/a.mp3' })
      expect(deleteSlideConfirmBody(entry)).toBe(
        'Deleting this slide also removes its attached audio. This cannot be undone.',
      )
    })

    it('names only operator notes when audio is absent', () => {
      const entry = makeEntry({ notes: 'Some note' })
      expect(deleteSlideConfirmBody(entry)).toBe(
        'Deleting this slide also removes its operator notes. This cannot be undone.',
      )
    })

    it('states the plain case when neither is present', () => {
      const entry = makeEntry()
      expect(deleteSlideConfirmBody(entry)).toBe('Delete this slide? This cannot be undone.')
    })

    it('treats an empty-string notes value the same as absent (never a false positive)', () => {
      const entry = makeEntry({ notes: '' })
      expect(deleteSlideConfirmBody(entry)).toBe('Delete this slide? This cannot be undone.')
    })

    it('never names the group\'s shared bed music — only the entry\'s own audioUrl', () => {
      const entry = makeEntry()
      const body = deleteSlideConfirmBody(entry)
      expect(body.toLowerCase()).not.toContain('group')
      expect(body.toLowerCase()).not.toContain('bed')
      expect(body.toLowerCase()).not.toContain('shared')
    })
  })
})
