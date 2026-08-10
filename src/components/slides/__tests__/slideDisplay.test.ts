import { describe, it, expect } from 'vitest'
import {
  KIND_BADGE_CLASSES,
  slotDisplayTitle,
  slideContentLabel,
  slideBodyText,
  slideFooterLabel,
  speakerDisplayName,
  bedAudioLabel,
  deleteSlideConfirmBody,
  slideActionMenuItems,
  backgroundImageLabel,
  RENDER_FAILURE_SENTENCES,
  RENDER_FAILURE_FALLBACK_SENTENCE,
  renderFailureSentence,
  type MenuItemKey,
} from '../slideDisplay'
import type { ServiceSlot, SlotKind } from '@/types/service'
import type { Slide } from '@/types/slide'
import type { GroupSlideEntry, SourceRef } from '@/types/slideGroup'

const ALL_KINDS: SlotKind[] = ['SONG', 'SCRIPTURE', 'PRAYER', 'MESSAGE', 'ANNOUNCEMENTS', 'MISC', 'HYMN', 'IMPORTED']

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

  describe('renderFailureSentence', () => {
    it('maps missing-render-doc to its authored sentence', () => {
      expect(renderFailureSentence('missing-render-doc')).toBe("This deck's render record is missing.")
    })

    it('maps missing-storage-path to its authored sentence', () => {
      expect(renderFailureSentence('missing-storage-path')).toBe("The rendered file couldn't be located.")
    })

    it('falls back to the generic sentence for undefined', () => {
      expect(renderFailureSentence(undefined)).toBe(RENDER_FAILURE_FALLBACK_SENTENCE)
    })

    it('falls back to the generic sentence for incomplete-render, a real backend value the table deliberately does not map', () => {
      expect(renderFailureSentence('incomplete-render')).toBe(RENDER_FAILURE_FALLBACK_SENTENCE)
    })

    it('falls back to the generic sentence for the empty string', () => {
      expect(renderFailureSentence('')).toBe(RENDER_FAILURE_FALLBACK_SENTENCE)
    })

    it('falls back to the generic sentence for a markup-shaped string, and never echoes it back', () => {
      const hostile = '<script>alert(1)</script>'
      const result = renderFailureSentence(hostile)
      expect(result).toBe(RENDER_FAILURE_FALLBACK_SENTENCE)
      expect(result).not.toContain(hostile)
    })

    it('returns one of exactly three authored sentences for any hostile or unexpected input', () => {
      const authoredSentences = [
        "This deck's render record is missing.",
        "The rendered file couldn't be located.",
        RENDER_FAILURE_FALLBACK_SENTENCE,
      ]
      const hostileInputs = [
        '',
        'incomplete-render',
        '<script>alert(1)</script>',
        'MISSING-RENDER-DOC',
        '   ',
        'undefined',
        'null',
        '{"injected":true}',
        'missing-render-doc; DROP TABLE renders;',
      ]
      for (const input of hostileInputs) {
        expect(authoredSentences).toContain(renderFailureSentence(input))
      }
    })

    it('RENDER_FAILURE_SENTENCES contains no value built by string interpolation', () => {
      for (const value of Object.values(RENDER_FAILURE_SENTENCES)) {
        expect(value).not.toContain('${')
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

    it('returns the canonical label for ANNOUNCEMENTS and MISC slots (43-01)', () => {
      const announcements: ServiceSlot = { kind: 'ANNOUNCEMENTS', id: 'slot-announcements', position: 6 }
      const misc: ServiceSlot = { kind: 'MISC', id: 'slot-misc', position: 7 }
      expect(slotDisplayTitle(announcements)).toBe('Announcements')
      expect(slotDisplayTitle(misc)).toBe('Miscellaneous')
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

    // Phase 38-03: a Congregational-state section slide names its speaker in
    // the eyebrow instead of the generic 'SCRIPTURE' word, so N section
    // slides from one reading are told apart at a glance.
    it('names the speaker in the eyebrow for a LEADER or CONGREGATION section slide, and keeps SCRIPTURE for a Reference-state slide', () => {
      const leader = {
        id: 's8',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        section: { speaker: 'LEADER', text: 'For God so loved the world' },
      } as Slide
      const congregation = {
        id: 's9',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        section: { speaker: 'CONGREGATION', text: 'that he gave his only Son' },
      } as Slide
      const referenceState = { id: 's10', position: 0, contentKind: 'scripture', reference: 'John 3:16' } as Slide
      expect(slideContentLabel(leader)).toBe('LEADER')
      expect(slideContentLabel(congregation)).toBe('CONGREGATION')
      expect(slideContentLabel(referenceState)).toBe('SCRIPTURE')
      expect(slideContentLabel(leader)).not.toBe(slideContentLabel(congregation))
      expect(slideContentLabel(leader)).not.toBe(slideContentLabel(referenceState))
    })

    // R095/R105: the ALL role names itself in the eyebrow too — the eyebrow
    // names the speaker on every section slide, regardless of position in the
    // reading.
    it('names ALL in the eyebrow on any section slide', () => {
      const allLater = {
        id: 's11',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        section: { speaker: 'ALL', text: 'y' },
      } as Slide
      expect(slideContentLabel(allLater)).toBe('ALL')
    })
  })

  describe('speakerDisplayName (Phase 38-03, widened Phase 47 R095)', () => {
    it('returns readable natural-case names for all three speakers, including ALL', () => {
      expect(speakerDisplayName('LEADER')).toBe('Leader')
      expect(speakerDisplayName('CONGREGATION')).toBe('Congregation')
      expect(speakerDisplayName('ALL')).toBe('All')
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

    // 45-04/R091: a field-less slide (no translationSource, matching every
    // pre-phase slide) resolves to '(ESV)' via resolveTranslationSource's
    // fallback — proving the suffix does not depend on the org's current
    // bibleVersion setting.
    it('combines the reference and text for a scripture slide, appending the (ESV) attribution suffix for a field-less slide', () => {
      const scripture = {
        id: 's3',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        text: 'The LORD is my shepherd',
      } as Slide
      expect(slideBodyText(scripture)).toBe('Psalms 23:1-6\nThe LORD is my shepherd (ESV)')
    })

    it('appends (NLT) when the slide carries a stamped NLT translationSource', () => {
      const scripture = {
        id: 's3-nlt',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        text: 'The LORD is my shepherd',
        translationSource: 'NLT',
      } as Slide
      expect(slideBodyText(scripture)).toBe('Psalms 23:1-6\nThe LORD is my shepherd (NLT)')
    })

    it('returns just the reference for a scripture slide with no text (R047 default: reference-only) — no attribution suffix', () => {
      const scripture = {
        id: 's3',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        text: '',
      } as Slide
      expect(slideBodyText(scripture)).toBe('Psalms 23:1-6')
    })

    // R105 (Phase 49): the reference now has its OWN dedicated slide, so a
    // congregational section slide NEVER prefixes the reference — regardless
    // of position. It returns only its own words + attribution suffix.
    it('a Congregational-state section slide returns only its words + attribution — never the reference prefix', () => {
      const scripture = {
        id: 's3b',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        text: 'For God so loved the world',
        section: { speaker: 'LEADER', text: 'For God so loved the world' },
      } as Slide
      expect(slideBodyText(scripture)).toBe('For God so loved the world (ESV)')
      expect(slideBodyText(scripture)).not.toContain('John 3:16')
    })

    // R105: the same holds for any later section slide — no reference prefix.
    it('omits the reference for a LATER Congregational-state section slide too', () => {
      const scripture = {
        id: 's3b-later',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        text: 'that he gave his only Son',
        section: { speaker: 'CONGREGATION', text: 'that he gave his only Son' },
      } as Slide
      expect(slideBodyText(scripture)).toBe('that he gave his only Son (ESV)')
      expect(slideBodyText(scripture)).not.toContain('John 3:16')
    })

    // R105: a Reference-state slide (no section at all) — including the new
    // dedicated reference slide — always shows its reference, exactly as before.
    it('a Reference-state slide (no section) still returns its reference', () => {
      const scripture = {
        id: 's3b-ref',
        position: 0,
        contentKind: 'scripture',
        reference: 'Psalms 23:1-6',
        text: 'The LORD is my shepherd',
      } as Slide
      expect(slideBodyText(scripture)).toBe('Psalms 23:1-6\nThe LORD is my shepherd (ESV)')
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

    // Phase 38-03: a Congregational-state section slide's footer names both
    // the reference AND its speaker; a Reference-state slide (asserted above)
    // keeps the bare reference.
    it('names the reference AND the readable speaker name for a section slide', () => {
      const leader = {
        id: 's3c',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        section: { speaker: 'LEADER', text: 'x' },
      } as Slide
      const congregation = {
        id: 's3d',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        section: { speaker: 'CONGREGATION', text: 'x' },
      } as Slide
      expect(slideFooterLabel(leader)).toBe('John 3:16 · Leader')
      expect(slideFooterLabel(congregation)).toBe('John 3:16 · Congregation')
    })

    // R105 (key_links): slideFooterLabel still names the reference AND the
    // speaker on EVERY section slide — the card footer is a planning aid, not
    // the congregation-facing projection, so it is left unchanged. Only the
    // projected eyebrow/body drops the reference on a section slide.
    it('still names the reference and speaker on a LATER section slide — footer is unchanged by R105', () => {
      const later = {
        id: 's3e',
        position: 0,
        contentKind: 'scripture',
        reference: 'John 3:16',
        section: { speaker: 'ALL', text: 'x' },
      } as Slide
      expect(slideFooterLabel(later)).toBe('John 3:16 · All')
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

    it('a scripture entry with mutation allowed returns edit-details, duplicate, delete (congregational reading moved to a group-level button)', () => {
      const entry = makeMenuEntry({ kind: 'scripture' })
      expect(keysOf(entry, 'SCRIPTURE', true)).toEqual([
        'edit-details',
        'duplicate',
        'delete',
      ])
    })

    // Phase 38-03: standing guard that a later menu change cannot quietly
    // remove deletion from a Congregational-state section entry — this menu
    // already offered duplicate/delete for every scripture-kind entry before
    // this phase (the `kind === 'scripture'` branch does not consult
    // `speaker`), so this asserts that finding holds for a section entry too.
    it('a Congregational-state scripture SECTION entry with mutation allowed still includes duplicate and delete', () => {
      const entry = makeMenuEntry({ kind: 'scripture', speaker: 'LEADER', text: 'For God so loved the world' })
      expect(keysOf(entry, 'SCRIPTURE', true)).toEqual([
        'edit-details',
        'duplicate',
        'delete',
      ])
    })

    // The congregational-reading action moved out of the 3-dot menu to a
    // discoverable group-level button beside "+ Add background for this group"
    // (owner request — the menu item was too buried). The scripture 3-dot menu
    // therefore no longer offers 'edit-in-scripture' for either canMutate value.
    it('the scripture 3-dot menu no longer offers edit-in-scripture (moved to a group-level button)', () => {
      for (const canMutate of [true, false]) {
        const entry = makeMenuEntry({ kind: 'scripture' })
        const items = slideActionMenuItems(entry, 'SCRIPTURE', canMutate)
        expect(items.map((item) => item.key)).not.toContain('edit-in-scripture')
        expect(items.map((item) => item.key)).toEqual(
          canMutate ? ['edit-details', 'duplicate', 'delete'] : ['edit-details'],
        )
      }
    })

    it('34-07: no item returned for a scripture entry ever mentions lyrics, for either canMutate value', () => {
      for (const canMutate of [true, false]) {
        const entry = makeMenuEntry({ kind: 'scripture' })
        const items = slideActionMenuItems(entry, 'SCRIPTURE', canMutate)
        for (const item of items) {
          expect(item.label).not.toMatch(/lyric/i)
        }
      }
    })

    it('D2 (260805-bvo): a hand-authored text entry with a defined body returns exactly edit-details, duplicate, delete — no separate edit-lyrics affordance', () => {
      const entry = makeMenuEntry({ kind: 'text', body: 'Please stand.' })
      expect(keysOf(entry, 'PRAYER', true)).toEqual(['edit-details', 'duplicate', 'delete'])
    })

    it('D2 (260805-bvo): a text entry with an undefined body for planItemKind PRAYER returns the SAME exact list — the plan-item-kind branch of the old discriminator is gone', () => {
      const entry = makeMenuEntry({ kind: 'text' })
      expect(keysOf(entry, 'PRAYER', true)).toEqual(['edit-details', 'duplicate', 'delete'])
    })

    it('D2 (260805-bvo): a text entry with an undefined body for planItemKind MESSAGE returns the SAME exact list', () => {
      const entry = makeMenuEntry({ kind: 'text' })
      expect(keysOf(entry, 'MESSAGE', true)).toEqual(['edit-details', 'duplicate', 'delete'])
    })

    it('D2 (260805-bvo), owner-authorised reversal of the Hymn carve-out: a still-pristine Hymn text entry (no body) and a hand-added blank one (body: "") return IDENTICAL menu lists', () => {
      const pristine = makeMenuEntry({ kind: 'text' })
      const handAdded = makeMenuEntry({ kind: 'text', body: '' })
      expect(keysOf(pristine, 'HYMN', true)).toEqual(['edit-details', 'duplicate', 'delete'])
      expect(keysOf(handAdded, 'HYMN', true)).toEqual(['edit-details', 'duplicate', 'delete'])
      expect(keysOf(pristine, 'HYMN', true)).toEqual(keysOf(handAdded, 'HYMN', true))
    })

    it('D2 (260805-bvo): no item returned for a text entry ever mentions lyrics, for either canMutate value', () => {
      for (const canMutate of [true, false]) {
        const entry = makeMenuEntry({ kind: 'text' })
        const items = slideActionMenuItems(entry, 'PRAYER', canMutate)
        for (const item of items) {
          expect(item.label).not.toMatch(/lyric/i)
        }
      }
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

    it('D2 (260805-bvo): planItemKind undefined with an undefined body yields the same exact list — the parameter is no longer consulted by this branch', () => {
      const entry = makeMenuEntry({ kind: 'text' })
      expect(keysOf(entry, undefined, true)).toEqual(['edit-details', 'duplicate', 'delete'])
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
      // 'edit-in-scripture' is no longer in the scripture menu (moved to a
      // group-level button), so there is no scripture route item to tone-check
      // here. 'edit-in-song' still routes away and keeps the 'nav' tone.
      const songNavItem = slideActionMenuItems(
        makeMenuEntry({ kind: 'lyric', songId: 'song-1', sectionId: 'sec-1' }),
        'SONG',
        true,
      ).find((item) => item.key === 'edit-in-song')
      expect(songNavItem?.tone).toBe('nav')
      const deleteItem = items.find((item) => item.key === 'delete')
      expect(deleteItem?.tone).toBe('destructive')
    })
  })
})
