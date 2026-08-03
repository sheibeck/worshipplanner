import { describe, it, expect } from 'vitest'
import {
  KIND_BADGE_CLASSES,
  slotDisplayTitle,
  slideContentLabel,
  slideBodyText,
  slideFooterLabel,
  bedAudioLabel,
  deleteSlideConfirmBody,
  slideActionMenuItems,
  backgroundImageLabel,
  type MenuItemKey,
} from '../slideDisplay'
import type { ServiceSlot, SlotKind } from '@/types/service'
import type { Slide } from '@/types/slide'
import type { GroupSlideEntry, SourceRef } from '@/types/slideGroup'

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

    // ME-02: `scriptureRefFromSlot` treats book + chapter as a populated
    // reference (a whole-chapter reading is a valid slide source), so the rail
    // row must name the passage rather than falling back to the generic label
    // while the slide beside it projects "Psalms 103".
    it('names a whole-chapter SCRIPTURE slot rather than falling back to the kind label', () => {
      const slot: ServiceSlot = {
        kind: 'SCRIPTURE',
        id: 'slot-scripture-chapter',
        position: 1,
        book: 'Psalms',
        chapter: 103,
        verseStart: null,
        verseEnd: null,
      }
      expect(slotDisplayTitle(slot)).toBe('Psalms 103')
    })

    it('names a single-verse SCRIPTURE slot with no verseEnd at all', () => {
      const slot: ServiceSlot = {
        kind: 'SCRIPTURE',
        id: 'slot-scripture-single-open',
        position: 1,
        book: 'Romans',
        chapter: 8,
        verseStart: 28,
        verseEnd: null,
      }
      expect(slotDisplayTitle(slot)).toBe('Romans 8:28')
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

    it('returns just the reference for a scripture slide with no text (R047 default: reference-only)', () => {
      const scripture = {
        id: 's3',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        text: '',
      } as Slide
      expect(slideBodyText(scripture)).toBe('Psalms 23:1-6')
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

  describe('backgroundImageLabel', () => {
    it('extracts the filename from a Firebase Storage download URL', () => {
      const url =
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/orgs%2Forg1%2Fbackgrounds%2Fid1%2Fstage_photo.jpg?alt=media&token=abc'
      expect(backgroundImageLabel(url)).toBe('stage_photo.jpg')
    })

    it('falls back to a generic label for a malformed URL', () => {
      expect(backgroundImageLabel('%')).toBe('Background image')
    })
  })

  describe('slideActionMenuItems (R063, 33-UI-SPEC.md §3)', () => {
    function keysOf(entry: GroupSlideEntry, planItemKind: SlotKind | undefined, canMutate: boolean): MenuItemKey[] {
      return slideActionMenuItems(entry, planItemKind, canMutate).map((item) => item.key)
    }

    function makeMenuEntry(sourceRef: SourceRef, overrides: Partial<GroupSlideEntry> = {}): GroupSlideEntry {
      return { id: 'entry-1', order: 0, sourceRef, ...overrides }
    }

    it('P-03: a lyric entry with canMutate: true returns exactly edit-details and edit-in-song', () => {
      const entry = makeMenuEntry({ kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' })
      expect(keysOf(entry, 'SONG', true)).toEqual(['edit-details', 'edit-in-song'])
    })

    it('P-03: a copyright entry with canMutate: true returns exactly edit-details and edit-in-song', () => {
      const entry = makeMenuEntry({ kind: 'copyright', songId: 'song-1' })
      expect(keysOf(entry, 'SONG', true)).toEqual(['edit-details', 'edit-in-song'])
    })

    it('a scripture entry with mutation allowed returns edit-details, edit-in-scripture, duplicate, delete', () => {
      const entry = makeMenuEntry({ kind: 'scripture' })
      expect(keysOf(entry, 'SCRIPTURE', true)).toEqual([
        'edit-details',
        'edit-in-scripture',
        'duplicate',
        'delete',
      ])
    })

    it('a hand-authored text entry with a defined body returns edit-details, edit-lyrics, duplicate, delete', () => {
      const entry = makeMenuEntry({ kind: 'text', body: 'Please stand.' })
      expect(keysOf(entry, 'PRAYER', true)).toEqual(['edit-details', 'edit-lyrics', 'duplicate', 'delete'])
    })

    it('a text entry with undefined body includes edit-lyrics for planItemKind PRAYER', () => {
      const entry = makeMenuEntry({ kind: 'text' })
      expect(keysOf(entry, 'PRAYER', true)).toContain('edit-lyrics')
    })

    it('a text entry with undefined body includes edit-lyrics for planItemKind MESSAGE', () => {
      const entry = makeMenuEntry({ kind: 'text' })
      expect(keysOf(entry, 'MESSAGE', true)).toContain('edit-lyrics')
    })

    it('Hymn discriminator: a still-pristine Hymn text entry (no body) excludes edit-lyrics; a hand-added blank one (body: "") includes it', () => {
      const pristine = makeMenuEntry({ kind: 'text' })
      expect(keysOf(pristine, 'HYMN', true)).toEqual(['edit-details', 'duplicate', 'delete'])
      expect(keysOf(pristine, 'HYMN', true)).not.toContain('edit-lyrics')

      const handAdded = makeMenuEntry({ kind: 'text', body: '' })
      expect(keysOf(handAdded, 'HYMN', true)).toContain('edit-lyrics')
    })

    it('an imported entry returns edit-details, duplicate, delete', () => {
      const entry = makeMenuEntry({ kind: 'imported', importId: 'import-1', innerSlideId: 'inner-1' })
      expect(keysOf(entry, 'IMPORTED', true)).toEqual(['edit-details', 'duplicate', 'delete'])
    })

    it('a video entry returns edit-details, duplicate, delete', () => {
      const entry = makeMenuEntry({ kind: 'video', videoSrc: 'https://example.com/clip.mp4' })
      expect(keysOf(entry, 'IMPORTED', true)).toEqual(['edit-details', 'duplicate', 'delete'])
    })

    it('mutation not allowed: duplicate and delete are absent entirely from every kind, not present-and-disabled', () => {
      const kinds: Array<{ sourceRef: SourceRef; planItemKind: SlotKind }> = [
        { sourceRef: { kind: 'scripture' }, planItemKind: 'SCRIPTURE' },
        { sourceRef: { kind: 'text', body: 'x' }, planItemKind: 'PRAYER' },
        { sourceRef: { kind: 'imported', importId: 'i', innerSlideId: 'x' }, planItemKind: 'IMPORTED' },
        { sourceRef: { kind: 'video', videoSrc: 'x' }, planItemKind: 'IMPORTED' },
      ]
      for (const { sourceRef, planItemKind } of kinds) {
        const keys = keysOf(makeMenuEntry(sourceRef), planItemKind, false)
        expect(keys).not.toContain('duplicate')
        expect(keys).not.toContain('delete')
      }
    })

    it('backstop: planItemKind undefined with an undefined body yields a list without edit-lyrics', () => {
      const entry = makeMenuEntry({ kind: 'text' })
      expect(keysOf(entry, undefined, true)).not.toContain('edit-lyrics')
    })

    it('backstop: an unknown source kind yields exactly one item, edit-details — the most conservative list', () => {
      const entry = makeMenuEntry({ kind: 'unknown-future-kind' } as unknown as SourceRef)
      expect(keysOf(entry, 'PRAYER', true)).toEqual(['edit-details'])
    })

    it('every kind\'s list is non-empty', () => {
      const entries: SourceRef[] = [
        { kind: 'lyric', songId: 's', sectionId: 'sec' },
        { kind: 'copyright', songId: 's' },
        { kind: 'scripture' },
        { kind: 'text' },
        { kind: 'imported', importId: 'i', innerSlideId: 'x' },
        { kind: 'video', videoSrc: 'x' },
      ]
      for (const sourceRef of entries) {
        expect(keysOf(makeMenuEntry(sourceRef), undefined, false).length).toBeGreaterThan(0)
      }
    })

    it('every item carries a tone of default, nav or destructive', () => {
      const entry = makeMenuEntry({ kind: 'scripture' })
      const items = slideActionMenuItems(entry, 'SCRIPTURE', true)
      for (const item of items) {
        expect(['default', 'nav', 'destructive']).toContain(item.tone)
      }
      const navItem = slideActionMenuItems(makeMenuEntry({ kind: 'scripture' }), 'SCRIPTURE', true).find(
        (item) => item.key === 'edit-in-scripture',
      )
      expect(navItem?.tone).toBe('nav')
      const deleteItem = items.find((item) => item.key === 'delete')
      expect(deleteItem?.tone).toBe('destructive')
    })
  })
})
