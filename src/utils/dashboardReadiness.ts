// Pure worst-of readiness rollup for the Dashboard "needs your attention"
// feed (Phase 135, R416). REUSES readinessOf from myScheduleGrouping.ts —
// the only media-readiness definition in this codebase — rather than
// redefining what "media ready" means. No I/O, no store imports.

import type { Service, SongSlot } from '@/types/service'
import type { Song } from '@/types/song'
import { readinessOf } from '@/utils/myScheduleGrouping'
import type { RehearseSong } from '@/utils/rehearseAccess'

export type DashboardReadinessState = 'songs-needed' | 'media-missing' | 'draft' | 'ready'

export interface DashboardReadiness {
  state: DashboardReadinessState
  songsNeeded: number
  missingMediaCount: number
}

/** One RehearseSong per distinct filled SONG slot, first-occurrence order —
 *  mirrors rehearseAccess.ts's distinctSongSlots dedupe idiom. A songId no
 *  longer resolvable in songsById becomes a stub with zero attachments
 *  (mirrors buildRehearseAccess's stub), so it still counts as missing
 *  media instead of silently disappearing from the rollup. */
export function serviceReadinessSongs(service: Service, songsById: Map<string, Song>): RehearseSong[] {
  const seen = new Set<string>()
  const result: RehearseSong[] = []
  for (const slot of service.slots) {
    if (slot.kind !== 'SONG' || !(slot as SongSlot).songId) continue
    const songId = (slot as SongSlot).songId as string
    if (seen.has(songId)) continue
    seen.add(songId)
    const song = songsById.get(songId)
    result.push(
      song
        ? {
            id: song.id,
            title: song.title,
            attachments: (song.attachments ?? []).map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
          }
        : { id: songId, title: '(song removed)', attachments: [] },
    )
  }
  return result
}

/** Worst-of rollup (135-UI-SPEC.md Widget 1, order 1-worst to 4-best):
 *  songs-needed -> media-missing -> draft -> ready. Both songs-needed and
 *  media-missing are gated on `total > 0` so a zero-SONG-slot service falls
 *  straight through to the draft/ready check instead of readinessOf([])'s
 *  own 'waiting' default leaking in as a false "missing media" (R416
 *  zero-slots guard). */
export function dashboardReadinessOf(
  songStats: { filled: number; total: number },
  songs: RehearseSong[],
  status: Service['status'],
): DashboardReadiness {
  const { filled, total } = songStats

  if (total > 0 && filled < total) {
    return { state: 'songs-needed', songsNeeded: total - filled, missingMediaCount: 0 }
  }

  if (total > 0) {
    const media = readinessOf(songs)
    if (media.state !== 'ready') {
      return { state: 'media-missing', songsNeeded: 0, missingMediaCount: media.missingCount }
    }
  }

  if (status === 'draft') {
    return { state: 'draft', songsNeeded: 0, missingMediaCount: 0 }
  }

  return { state: 'ready', songsNeeded: 0, missingMediaCount: 0 }
}
