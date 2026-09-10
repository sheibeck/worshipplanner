import { describe, it, expect } from 'vitest'
import { vampFileStoragePath, VAMP_FILE_MAX_BYTES, VAMP_FILE_ALLOWED_MIME } from '@/utils/vampFiles'
import { VAMP_KEYS } from '@/constants/keys'

describe('vampFiles', () => {
  describe('vampFileStoragePath', () => {
    it('builds a path with the uploadId segment and a sanitized filename', () => {
      expect(vampFileStoragePath('orgA', 'v1', 'u1', 'My Song.mp3')).toBe(
        'orgs/orgA/vamp-files/v1/u1/My_Song.mp3',
      )
    })

    it('returns different paths for different uploadIds, same orgId/vampId/name (replace-safety)', () => {
      const first = vampFileStoragePath('orgA', 'v1', 'u1', 'track.mp3')
      const second = vampFileStoragePath('orgA', 'v1', 'u2', 'track.mp3')
      expect(first).not.toBe(second)
    })
  })

  describe('constants', () => {
    it('VAMP_FILE_MAX_BYTES is 52428800', () => {
      expect(VAMP_FILE_MAX_BYTES).toBe(52428800)
    })

    it('VAMP_FILE_ALLOWED_MIME deep-equals [\'audio/mpeg\']', () => {
      expect(VAMP_FILE_ALLOWED_MIME).toEqual(['audio/mpeg'])
    })
  })
})

describe('VAMP_KEYS', () => {
  it('has exactly 12 entries', () => {
    expect(VAMP_KEYS).toHaveLength(12)
  })

  it('equals the exact closed key set, one enharmonic spelling per pitch class', () => {
    expect(VAMP_KEYS).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])
  })
})
