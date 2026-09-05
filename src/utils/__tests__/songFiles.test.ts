import { describe, it, expect } from 'vitest'
import { SONG_FILE_MAX_BYTES, SONG_FILE_ALLOWED_MIME, songFileStoragePath } from '../songFiles'

describe('songFiles', () => {
  describe('SONG_FILE_MAX_BYTES', () => {
    it('is 50MB (same value as MEDIA_MAX_BYTES)', () => {
      expect(SONG_FILE_MAX_BYTES).toBe(52428800)
    })
  })

  describe('SONG_FILE_ALLOWED_MIME', () => {
    it('contains exactly application/pdf and audio/mpeg', () => {
      expect(SONG_FILE_ALLOWED_MIME).toContain('application/pdf')
      expect(SONG_FILE_ALLOWED_MIME).toContain('audio/mpeg')
      expect(SONG_FILE_ALLOWED_MIME).toHaveLength(2)
    })
  })

  describe('songFileStoragePath', () => {
    it('builds orgs/{orgId}/song-files/{attachmentId}/{sanitizedName}', () => {
      expect(songFileStoragePath('orgA', 'att1', 'My Chart.pdf')).toBe(
        'orgs/orgA/song-files/att1/My_Chart.pdf',
      )
    })

    it('sanitizes characters outside [a-zA-Z0-9._-] by replacing with underscore', () => {
      expect(songFileStoragePath('orgA', 'att1', 'chart (final)!.pdf')).toBe(
        'orgs/orgA/song-files/att1/chart__final__.pdf',
      )
    })

    it('always begins with orgs/{orgId}/song-files/', () => {
      const path = songFileStoragePath('orgB', 'att2', 'track.mp3')
      expect(path.startsWith('orgs/orgB/song-files/')).toBe(true)
    })

    it('is outside media/ — does not contain /media/', () => {
      const path = songFileStoragePath('orgA', 'att1', 'chart.pdf')
      expect(path).not.toContain('/media/')
    })
  })
})
