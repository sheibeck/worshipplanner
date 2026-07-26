import { describe, it, expect } from 'vitest'
import { classifyFiles, resolveDrop, UNSUPPORTED_FILE_MESSAGE } from '../dropRouting'

function file(name: string, type: string): File {
  return new File(['bytes'], name, { type })
}

describe('dropRouting', () => {
  describe('classifyFiles', () => {
    it('classifies a .pptx, an image, a video and an audio file into their four buckets, and an unknown file as rejected', () => {
      const pptx = file('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      const image = file('photo.png', 'image/png')
      const video = file('clip.mp4', 'video/mp4')
      const audio = file('pad.mp3', 'audio/mpeg')
      const unknown = file('notes.txt', 'text/plain')

      const result = classifyFiles([pptx, image, video, audio, unknown])

      expect(result.decks).toEqual([pptx])
      expect(result.images).toEqual([image])
      expect(result.videos).toEqual([video])
      expect(result.audioFiles).toEqual([audio])
      expect(result.rejected).toEqual([unknown])
    })

    it('classifies a .pptx file with an empty MIME type as a deck (OS drops often omit it)', () => {
      const pptx = file('deck.pptx', '')
      const result = classifyFiles([pptx])
      expect(result.decks).toEqual([pptx])
      expect(result.rejected).toEqual([])
    })

    it('classifies a .pptx file by extension even when the MIME type is generic/unrelated', () => {
      const pptx = file('DECK.PPTX', 'application/octet-stream')
      const result = classifyFiles([pptx])
      expect(result.decks).toEqual([pptx])
    })

    it('classifies every file exactly once across all buckets', () => {
      const files = [
        file('a.pptx', ''),
        file('b.png', 'image/png'),
        file('c.mp4', 'video/mp4'),
        file('d.mp3', 'audio/mpeg'),
        file('e.zip', 'application/zip'),
      ]
      const result = classifyFiles(files)
      const total =
        result.decks.length +
        result.images.length +
        result.videos.length +
        result.audioFiles.length +
        result.rejected.length
      expect(total).toBe(files.length)
    })
  })

  describe('resolveDrop — resolution order for a multi-kind drop', () => {
    it('the first audio file becomes the group music; extra audio files are skipped, not acted on', () => {
      const audio1 = file('a.mp3', 'audio/mpeg')
      const audio2 = file('b.mp3', 'audio/mpeg')
      const result = resolveDrop([audio1, audio2])
      expect(result.audio).toBe(audio1)
      expect(result.skipped).toEqual([audio2])
    })

    it('every video file appends, in drop order', () => {
      const v1 = file('1.mp4', 'video/mp4')
      const v2 = file('2.mp4', 'video/mp4')
      const result = resolveDrop([v2, v1])
      expect(result.videos).toEqual([v2, v1])
    })

    it('a PPTX takes precedence over images: the first PPTX is imported, images are skipped', () => {
      const pptx1 = file('a.pptx', '')
      const pptx2 = file('b.pptx', '')
      const image = file('c.png', 'image/png')
      const result = resolveDrop([image, pptx1, pptx2])
      expect(result.deck).toBe(pptx1)
      expect(result.images).toEqual([])
      expect(result.skipped).toEqual(expect.arrayContaining([pptx2, image]))
      expect(result.skipped).toHaveLength(2)
    })

    it('every image is imported as one deck when no PPTX is present', () => {
      const image1 = file('a.png', 'image/png')
      const image2 = file('b.png', 'image/png')
      const result = resolveDrop([image1, image2])
      expect(result.deck).toBeNull()
      expect(result.images).toEqual([image1, image2])
      expect(result.skipped).toEqual([])
    })

    it('reports extra audio, PPTX-skipped images and unsupported files together in skipped, never silently dropping them', () => {
      const pptx = file('deck.pptx', '')
      const image = file('slide.png', 'image/png')
      const audio1 = file('a.mp3', 'audio/mpeg')
      const audio2 = file('b.mp3', 'audio/mpeg')
      const unsupported = file('doc.txt', 'text/plain')
      const result = resolveDrop([pptx, image, audio1, audio2, unsupported])
      expect(result.deck).toBe(pptx)
      expect(result.audio).toBe(audio1)
      expect(result.skipped).toEqual(expect.arrayContaining([image, audio2, unsupported]))
      expect(result.skipped).toHaveLength(3)
    })

    it('a drop with nothing supported resolves to all-empty/null with everything skipped', () => {
      const unsupported = file('doc.txt', 'text/plain')
      const result = resolveDrop([unsupported])
      expect(result.deck).toBeNull()
      expect(result.images).toEqual([])
      expect(result.videos).toEqual([])
      expect(result.audio).toBeNull()
      expect(result.skipped).toEqual([unsupported])
    })
  })

  it('exports the exact rejected-file copy verbatim from the UI-SPEC', () => {
    expect(UNSUPPORTED_FILE_MESSAGE).toBe('Unsupported file — drop a PPTX, image, video, or audio file.')
  })
})
