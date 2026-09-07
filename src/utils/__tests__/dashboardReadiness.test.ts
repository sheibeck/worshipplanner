import { describe, it, expect } from 'vitest'
import { dashboardReadinessOf, serviceReadinessSongs } from '@/utils/dashboardReadiness'
import type { RehearseSong } from '@/utils/rehearseAccess'
import type { Service, SongSlot } from '@/types/service'
import type { Song } from '@/types/song'

function song(id: string, attachments: RehearseSong['attachments'] = []): RehearseSong {
  return { id, title: `Song ${id}`, attachments }
}

function docAttachment(id: string): RehearseSong['attachments'][number] {
  return { id, name: `file-${id}`, kind: 'document' }
}

describe('dashboardReadinessOf', () => {
  it('songs-needed: total > 0 and filled < total wins over everything else', () => {
    const result = dashboardReadinessOf({ filled: 1, total: 3 }, [song('a', [docAttachment('x')])], 'planned')
    expect(result).toEqual({ state: 'songs-needed', songsNeeded: 2, missingMediaCount: 0 })
  })

  it('media-missing (partial): all slots filled but readinessOf reports partial', () => {
    const songs = [song('a', [docAttachment('x')]), song('b', [])]
    const result = dashboardReadinessOf({ filled: 2, total: 2 }, songs, 'planned')
    expect(result).toEqual({ state: 'media-missing', songsNeeded: 0, missingMediaCount: 1 })
  })

  it('media-missing (waiting): all slots filled but every song is missing media', () => {
    const songs = [song('a', []), song('b', [])]
    const result = dashboardReadinessOf({ filled: 2, total: 2 }, songs, 'planned')
    expect(result).toEqual({ state: 'media-missing', songsNeeded: 0, missingMediaCount: 2 })
  })

  it('draft: songs filled + media ready but service.status is draft', () => {
    const songs = [song('a', [docAttachment('x')])]
    const result = dashboardReadinessOf({ filled: 1, total: 1 }, songs, 'draft')
    expect(result).toEqual({ state: 'draft', songsNeeded: 0, missingMediaCount: 0 })
  })

  it('ready: songs filled + media ready + not draft', () => {
    const songs = [song('a', [docAttachment('x')])]
    const result = dashboardReadinessOf({ filled: 1, total: 1 }, songs, 'planned')
    expect(result).toEqual({ state: 'ready', songsNeeded: 0, missingMediaCount: 0 })
  })

  describe('zero-slots guard (R416 edge case)', () => {
    it('total === 0 and status planned never reads as media-missing — falls through to ready', () => {
      const result = dashboardReadinessOf({ filled: 0, total: 0 }, [], 'planned')
      expect(result).toEqual({ state: 'ready', songsNeeded: 0, missingMediaCount: 0 })
    })

    it('total === 0 and status draft falls through to draft, not media-missing', () => {
      const result = dashboardReadinessOf({ filled: 0, total: 0 }, [], 'draft')
      expect(result).toEqual({ state: 'draft', songsNeeded: 0, missingMediaCount: 0 })
    })
  })
})

describe('serviceReadinessSongs', () => {
  function slot(songId: string | null, id = songId ?? 'slot'): SongSlot {
    return {
      id,
      kind: 'SONG',
      position: 0,
      requiredVwType: 1,
      songId,
      songTitle: null,
      songKey: null,
    }
  }

  function baseService(slots: Service['slots']): Service {
    return {
      id: 'svc1',
      date: '2026-09-13',
      name: 'Test Service',
      progression: '1-2-2-3',
      teams: [],
      status: 'planned',
      slots,
      sermonPassage: null,
      notes: '',
      createdAt: null as never,
      updatedAt: null as never,
    }
  }

  function makeSong(id: string, attachments: Song['attachments'] = []): Song {
    return {
      id,
      title: `Song ${id}`,
      ccliNumber: '',
      author: '',
      themes: [],
      notes: '',
      vwTypes: [],
      arrangements: [],
      primaryArrangementId: null,
      lastUsedAt: null,
      createdAt: null as never,
      updatedAt: null as never,
      pcSongId: null,
      hidden: false,
      tags: [],
      removedThemes: [],
      attachments,
    }
  }

  it('dedupes by songId, first-occurrence order, ignoring non-SONG/empty slots', () => {
    const songsById = new Map([
      ['s1', makeSong('s1')],
      ['s2', makeSong('s2')],
    ])
    const service = baseService([slot('s1', 'slotA'), slot('s2', 'slotB'), slot('s1', 'slotC'), slot(null, 'slotD')])
    const result = serviceReadinessSongs(service, songsById)
    expect(result.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('stubs a songId missing from songsById as "(song removed)" with no attachments, counting as missing media', () => {
    const songsById = new Map<string, Song>()
    const service = baseService([slot('gone', 'slotA')])
    const result = serviceReadinessSongs(service, songsById)
    expect(result).toEqual([{ id: 'gone', title: '(song removed)', attachments: [] }])
  })

  it('maps a resolved song to its id/title/attachments', () => {
    const songsById = new Map([['s1', makeSong('s1', [{ id: 'att1', kind: 'document', name: 'chart.pdf', createdAt: null as never, createdBy: 'u1' }])]])
    const service = baseService([slot('s1', 'slotA')])
    const result = serviceReadinessSongs(service, songsById)
    expect(result).toEqual([
      { id: 's1', title: 'Song s1', attachments: [{ id: 'att1', name: 'chart.pdf', kind: 'document' }] },
    ])
  })
})
