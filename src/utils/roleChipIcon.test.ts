import { describe, it, expect } from 'vitest'
import { roleChipIcon } from '@/utils/roleChipIcon'

describe('roleChipIcon', () => {
  it('maps guitar/bass role names to guitar', () => {
    expect(roleChipIcon('Acoustic guitar')).toBe('guitar')
    expect(roleChipIcon('Bass guitar')).toBe('guitar')
    expect(roleChipIcon('BASS')).toBe('guitar')
  })

  it('maps key/piano role names to piano', () => {
    expect(roleChipIcon('Keys')).toBe('piano')
    expect(roleChipIcon('Piano')).toBe('piano')
  })

  it('maps drum role names to drum', () => {
    expect(roleChipIcon('Drums')).toBe('drum')
  })

  it('maps vocal/vox/sing role names to mic', () => {
    expect(roleChipIcon('Harmony vocal')).toBe('mic')
    expect(roleChipIcon('Lead vocal')).toBe('mic')
    expect(roleChipIcon('Backing vox')).toBe('mic')
    expect(roleChipIcon('Worship singer')).toBe('mic')
  })

  it('maps strings/violin role names to strings', () => {
    expect(roleChipIcon('Strings')).toBe('strings')
    expect(roleChipIcon('Violin')).toBe('strings')
  })

  it('maps sound/tech role names to speaker', () => {
    expect(roleChipIcon('Sound tech')).toBe('speaker')
    expect(roleChipIcon('FOH tech')).toBe('speaker')
  })

  it('falls back to music for an unmatched role name', () => {
    expect(roleChipIcon('Scripture reader')).toBe('music')
  })

  it('is case-insensitive across all branches', () => {
    expect(roleChipIcon('GUITAR')).toBe('guitar')
    expect(roleChipIcon('vocal')).toBe('mic')
  })
})
