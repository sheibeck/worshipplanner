import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { isValidExternalLink, inferLinkSource, buildLinkAttachment } from '@/utils/songLinks'

describe('isValidExternalLink', () => {
  it('accepts a well-formed https URL', () => {
    expect(isValidExternalLink('https://youtu.be/abc')).toBe(true)
  })

  it('rejects a non-https URL', () => {
    expect(isValidExternalLink('http://example.com')).toBe(false)
  })

  it('rejects an unparseable string', () => {
    expect(isValidExternalLink('not a url')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidExternalLink('')).toBe(false)
  })

  it('rejects a javascript: URL', () => {
    expect(isValidExternalLink('javascript:alert(1)')).toBe(false)
  })

  it('rejects a data: URL', () => {
    expect(isValidExternalLink('data:text/html,x')).toBe(false)
  })
})

describe('inferLinkSource', () => {
  it('infers youtube from youtube.com', () => {
    expect(inferLinkSource('https://www.youtube.com/watch?v=x')).toBe('youtube')
  })

  it('infers youtube from youtu.be', () => {
    expect(inferLinkSource('https://youtu.be/x')).toBe('youtube')
  })

  it('infers drive from drive.google.com', () => {
    expect(inferLinkSource('https://drive.google.com/file/d/x')).toBe('drive')
  })

  it('infers drive from docs.google.com', () => {
    expect(inferLinkSource('https://docs.google.com/document/d/x')).toBe('drive')
  })

  it('infers dropbox from dropbox.com', () => {
    expect(inferLinkSource('https://www.dropbox.com/s/x')).toBe('dropbox')
  })

  it('infers other for an unrecognized host', () => {
    expect(inferLinkSource('https://vimeo.com/x')).toBe('other')
  })
})

describe('buildLinkAttachment', () => {
  it('builds a kind:link SongAttachment with inferred source, href, name, createdBy, and a Timestamp', () => {
    const attachment = buildLinkAttachment({
      href: 'https://www.youtube.com/watch?v=x',
      name: 'Live version',
      createdBy: 'user1',
    })

    expect(attachment.kind).toBe('link')
    expect(attachment.linkSource).toBe('youtube')
    expect(attachment.href).toBe('https://www.youtube.com/watch?v=x')
    expect(attachment.name).toBe('Live version')
    expect(attachment.createdBy).toBe('user1')
    expect(attachment.createdAt).toBeInstanceOf(Timestamp)
    expect(attachment.id).toBeTruthy()
  })

  it('falls back to the host when no name is given', () => {
    const attachment = buildLinkAttachment({
      href: 'https://www.dropbox.com/s/x',
      createdBy: 'user1',
    })

    expect(attachment.name).toBeTruthy()
    expect(attachment.name).not.toBe('')
  })

  it('trims a whitespace-only name and falls back to the host', () => {
    const attachment = buildLinkAttachment({
      href: 'https://www.dropbox.com/s/x',
      name: '   ',
      createdBy: 'user1',
    })

    expect(attachment.name).toBe('www.dropbox.com')
  })

  it('omits storagePath/downloadUrl/mimeType/sizeBytes keys entirely', () => {
    const attachment = buildLinkAttachment({
      href: 'https://vimeo.com/x',
      createdBy: 'user1',
    })

    expect('storagePath' in attachment).toBe(false)
    expect('downloadUrl' in attachment).toBe(false)
    expect('mimeType' in attachment).toBe(false)
    expect('sizeBytes' in attachment).toBe(false)
  })
})
