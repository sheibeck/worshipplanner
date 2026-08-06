import { describe, it, expect } from 'vitest'
import {
  buildSongEditLink,
  parseSongEditRequest,
  clearSongEditRequest,
} from '../songEditLink'

describe('songEditLink — buildSongEditLink', () => {
  it('returns a location naming the song list route with the song id and tab in its query', () => {
    const location = buildSongEditLink('song-1', 'lyrics')
    expect(location).toEqual({
      name: 'songs',
      query: { edit: 'song-1', tab: 'lyrics' },
    })
  })

  it('accepts the details tab too', () => {
    const location = buildSongEditLink('song-2', 'details')
    expect(location.query.tab).toBe('details')
  })
})

describe('songEditLink — parseSongEditRequest', () => {
  it('returns the song id and tab for a well-formed query', () => {
    const request = parseSongEditRequest({ edit: 'song-1', tab: 'lyrics' })
    expect(request).toEqual({ songId: 'song-1', tab: 'lyrics' })
  })

  it('returns null for a query with no song request', () => {
    const request = parseSongEditRequest({ import: 'true' })
    expect(request).toBeNull()
  })

  it('returns null when the query is entirely empty', () => {
    expect(parseSongEditRequest({})).toBeNull()
  })

  it('takes the first value when a parameter arrives as an array', () => {
    const request = parseSongEditRequest({ edit: ['song-1', 'song-2'], tab: ['lyrics', 'details'] })
    expect(request).toEqual({ songId: 'song-1', tab: 'lyrics' })
  })

  it('returns no tab when the tab parameter is absent', () => {
    const request = parseSongEditRequest({ edit: 'song-1' })
    expect(request).toEqual({ songId: 'song-1' })
    expect(request?.tab).toBeUndefined()
  })

  it('returns no tab when the tab parameter is unrecognised', () => {
    const request = parseSongEditRequest({ edit: 'song-1', tab: 'notarealtab' })
    expect(request).toEqual({ songId: 'song-1' })
    expect(request?.tab).toBeUndefined()
  })
})

describe('songEditLink — clearSongEditRequest', () => {
  it('removes only the request keys and preserves an unrelated parameter', () => {
    const cleared = clearSongEditRequest({ edit: 'song-1', tab: 'lyrics', import: 'true' })
    expect(cleared).toEqual({ import: 'true' })
  })

  it('is a no-op on a query with no song request', () => {
    const cleared = clearSongEditRequest({ import: 'true' })
    expect(cleared).toEqual({ import: 'true' })
  })
})
