import { describe, it, expect } from 'vitest'
import { parseCCLIPaste } from '@/utils/ccliParser'

describe('parseCCLIPaste', () => {
  it('returns empty result for empty input', () => {
    const result = parseCCLIPaste('')
    expect(result.title).toBe('')
    expect(result.sections).toEqual([])
    expect(result.copyright.ccliSongNumber).toBe('')
  })

  it('returns empty result for whitespace-only input', () => {
    const result = parseCCLIPaste('   \n  \n   ')
    expect(result.title).toBe('')
    expect(result.sections).toEqual([])
  })

  it('parses title-only input with no sections', () => {
    const result = parseCCLIPaste('Great Is Thy Faithfulness')
    expect(result.title).toBe('Great Is Thy Faithfulness')
    expect(result.sections).toEqual([])
  })

  it('parses legacy format with pipe-delimited authors', () => {
    const input = [
      'Amazing Grace',
      '',
      'Verse 1',
      'How sweet the sound',
      'That saved someone like me',
      '',
      'Chorus',
      'Grace grace grace',
      'How wonderful',
      '',
      'CCLI Song # 1234567',
      'John Newton | Chris Tomlin',
      '© 2011 Test Publishing (Admin. by Test Admin)',
      'For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com',
      'CCLI License # 9876543',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.title).toBe('Amazing Grace')
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]!.id).toBe('verse-1')
    expect(result.sections[0]!.label).toBe('Verse 1')
    expect(result.sections[0]!.lines).toEqual([
      'How sweet the sound',
      'That saved someone like me',
    ])
    expect(result.sections[1]!.id).toBe('chorus')
    expect(result.sections[1]!.label).toBe('Chorus')
    expect(result.sections[1]!.lines).toEqual([
      'Grace grace grace',
      'How wonderful',
    ])
    expect(result.copyright.title).toBe('Amazing Grace')
    expect(result.copyright.authors).toEqual(['John Newton', 'Chris Tomlin'])
    expect(result.copyright.ccliSongNumber).toBe('1234567')
    expect(result.copyright.ccliLicenseNumber).toBe('9876543')
    expect(result.copyright.copyrightLines).toHaveLength(1)
  })

  it('parses 2023 format with comma-delimited authors', () => {
    const input = [
      'Test Song 2023',
      '',
      'Verse 1',
      'Line one of verse one',
      'Line two of verse one',
      '',
      'Verse 2',
      'Line one of verse two',
      'Line two of verse two',
      '',
      'Author Alpha, Author Beta',
      'CCLI Song #654321',
      '© 2023 Test Music Co',
      'For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com',
      'CCLI License #11111',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.title).toBe('Test Song 2023')
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]!.id).toBe('verse-1')
    expect(result.sections[1]!.id).toBe('verse-2')
    expect(result.copyright.authors).toEqual(['Author Alpha', 'Author Beta'])
    expect(result.copyright.ccliSongNumber).toBe('654321')
    expect(result.copyright.ccliLicenseNumber).toBe('11111')
  })

  it('handles missing section numbers (defaults to unnumbered slug)', () => {
    const input = [
      'Simple Song',
      '',
      'Verse',
      'Only one verse here',
      '',
      'Chorus',
      'Only one chorus here',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]!.id).toBe('verse')
    expect(result.sections[0]!.label).toBe('Verse')
    expect(result.sections[1]!.id).toBe('chorus')
    expect(result.sections[1]!.label).toBe('Chorus')
  })

  it('handles Pre-Chorus as a standalone section header', () => {
    const input = [
      'Test Song',
      '',
      'Verse 1',
      'Verse line',
      '',
      'Pre-Chorus',
      'Building up here',
      '',
      'Chorus',
      'The main part',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(3)
    expect(result.sections[0]!.id).toBe('verse-1')
    expect(result.sections[1]!.id).toBe('pre-chorus')
    expect(result.sections[1]!.label).toBe('Pre-Chorus')
    expect(result.sections[1]!.lines).toEqual(['Building up here'])
    expect(result.sections[2]!.id).toBe('chorus')
  })

  it('handles parenthetical section marker as first lyric line', () => {
    const input = [
      'Test Song',
      '',
      'Misc 1',
      '(PRE-CHORUS)',
      'Building up to the chorus',
      'Getting louder now',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]!.id).toBe('pre-chorus')
    expect(result.sections[0]!.label).toBe('Pre-Chorus')
    expect(result.sections[0]!.lines).toEqual([
      'Building up to the chorus',
      'Getting louder now',
    ])
  })

  it('handles standalone parenthetical marker without a preceding header', () => {
    const input = [
      'Test Song',
      '',
      '(BRIDGE)',
      'Bridge lyric line one',
      'Bridge lyric line two',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]!.id).toBe('bridge')
    expect(result.sections[0]!.label).toBe('Bridge')
    expect(result.sections[0]!.lines).toEqual([
      'Bridge lyric line one',
      'Bridge lyric line two',
    ])
  })

  it('handles multiple copyright lines', () => {
    const input = [
      'Multi Copyright Song',
      '',
      'Verse 1',
      'Some lyrics here',
      '',
      'CCLI Song # 9999999',
      'Writer One | Writer Two',
      '© 2011 Publisher One (Admin. by Admin Co)',
      '© 2015 Publisher Two',
      'For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com',
      'CCLI License # 55555',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.copyright.copyrightLines).toHaveLength(2)
    expect(result.copyright.copyrightLines[0]).toContain('Publisher One')
    expect(result.copyright.copyrightLines[1]).toContain('Publisher Two')
  })

  it('handles ASCII (c) copyright symbol', () => {
    const input = [
      'ASCII Copyright Song',
      '',
      'Verse 1',
      'Lyrics here',
      '',
      'CCLI Song # 1111111',
      'Test Author',
      '(c) 2020 Test Publisher',
      'CCLI License # 22222',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.copyright.copyrightLines).toHaveLength(1)
    expect(result.copyright.copyrightLines[0]).toContain('Test Publisher')
  })

  it('handles uppercase (C) copyright symbol', () => {
    const input = [
      'Test Song',
      '',
      'Verse 1',
      'Some words',
      '',
      'CCLI Song # 3333333',
      'Author Name',
      '(C) 2022 Some Publisher',
      'CCLI License # 44444',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.copyright.copyrightLines).toHaveLength(1)
  })

  it('handles CCLI Song # with no space before number', () => {
    const input = [
      'No Space Song',
      '',
      'Verse 1',
      'Test lyrics',
      '',
      'CCLI Song #7654321',
      'Author Name',
      'CCLI License #12345',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.copyright.ccliSongNumber).toBe('7654321')
    expect(result.copyright.ccliLicenseNumber).toBe('12345')
  })

  it('generates correct section IDs (slugification)', () => {
    const input = [
      'Slug Test Song',
      '',
      'Verse 1',
      'First verse',
      '',
      'Verse 2',
      'Second verse',
      '',
      'Pre-Chorus 1',
      'Building up',
      '',
      'Chorus',
      'Main chorus',
      '',
      'Bridge',
      'Bridge part',
      '',
      'Ending',
      'Outro lyrics',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections.map((s) => s.id)).toEqual([
      'verse-1',
      'verse-2',
      'pre-chorus-1',
      'chorus',
      'bridge',
      'ending',
    ])
  })

  it('handles Tag and Misc section types', () => {
    const input = [
      'Extended Song',
      '',
      'Verse 1',
      'Verse content',
      '',
      'Tag',
      'Short tag line',
      '',
      'Misc 1',
      'Miscellaneous content',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(3)
    expect(result.sections[1]!.id).toBe('tag')
    expect(result.sections[1]!.label).toBe('Tag')
    expect(result.sections[2]!.id).toBe('misc-1')
    expect(result.sections[2]!.label).toBe('Misc 1')
  })

  it('handles Intro section type', () => {
    const input = [
      'Intro Song',
      '',
      'Intro',
      'Instrumental intro notes',
      '',
      'Verse 1',
      'First verse lyrics',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]!.id).toBe('intro')
    expect(result.sections[0]!.label).toBe('Intro')
  })

  it('handles Windows-style line endings (CRLF)', () => {
    const input = 'Test Song\r\n\r\nVerse 1\r\nLine one\r\nLine two\r\n'

    const result = parseCCLIPaste(input)

    expect(result.title).toBe('Test Song')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]!.lines).toEqual(['Line one', 'Line two'])
  })

  it('case-insensitive section header matching', () => {
    const input = [
      'Case Test',
      '',
      'VERSE 1',
      'Upper case verse',
      '',
      'chorus',
      'Lower case chorus',
      '',
      'BRIDGE',
      'Upper case bridge',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.sections).toHaveLength(3)
    expect(result.sections[0]!.label).toBe('Verse 1')
    expect(result.sections[1]!.label).toBe('Chorus')
    expect(result.sections[2]!.label).toBe('Bridge')
  })

  it('skips the SongSelect usage terms line in footer', () => {
    const input = [
      'Terms Test',
      '',
      'Verse 1',
      'Some lyrics',
      '',
      'CCLI Song # 1111111',
      'Author Name',
      '© 2020 Publisher',
      'For use solely with the SongSelect Terms of Use.  All rights reserved. http://ccli.com',
      'CCLI License # 22222',
    ].join('\n')

    const result = parseCCLIPaste(input)

    expect(result.copyright.authors).toEqual(['Author Name'])
    expect(result.copyright.ccliSongNumber).toBe('1111111')
    expect(result.copyright.ccliLicenseNumber).toBe('22222')
  })
})
