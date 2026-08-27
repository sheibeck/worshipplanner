import { describe, it, expect } from 'vitest'
import { MAJOR_KEYS, MINOR_KEYS } from '../keys'

describe('keys constants', () => {
  it('MAJOR_KEYS is the 14 major roots in order', () => {
    expect(MAJOR_KEYS).toEqual([
      'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
    ])
  })

  it('MINOR_KEYS is the 12 minor roots in order', () => {
    expect(MINOR_KEYS).toEqual([
      'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm',
    ])
  })
})
