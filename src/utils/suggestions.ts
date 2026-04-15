import type { Song, VWType } from '@/types/song'

const RECENT_WEEKS = 2
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export interface SuggestionResult {
  song: Song
  score: number
  weeksAgo: number | null
  isRecent: boolean
}

/**
 * Returns songs ranked for a given slot, prioritized by VW type and filtered by team.
 * All songs are returned (no hard VW type filter) — matching-type songs receive a +100
 * score bonus so they appear first. Pure function — no side effects, easily testable.
 *
 * @param songs - All songs from the song store
 * @param requiredVwType - The VW type constraint for this slot (soft priority, not hard filter)
 * @param serviceTeams - Active teams for this service. 'Orchestra' uses a soft +200 bonus;
 *                       all other teams use AND-logic hard filter.
 * @param nowMs - Current time in ms (defaults to Date.now(), injectable for testing)
 */
export function rankSongsForSlot(
  songs: Song[],
  requiredVwType: VWType,
  serviceTeams: string[],
  nowMs: number = Date.now(),
): SuggestionResult[] {
  const twoWeeksAgo = nowMs - RECENT_WEEKS * MS_PER_WEEK

  // 1. Filter: team compatibility (applied to ALL songs regardless of VW type)
  // Orchestra is a soft-bonus team, not a hard-filter team (D-07)
  // If serviceTeams is empty (or only Orchestra), no hard filtering applies.
  // If serviceTeams contains non-Orchestra teams, song must either:
  //   (a) have no teamTags (universal — works for all configurations), OR
  //   (b) include ALL non-Orchestra active teams (AND logic)
  const hasOrchestra = serviceTeams.includes('Orchestra')
  const nonOrchestraTeams = serviceTeams.filter((t) => t !== 'Orchestra')

  const teamFiltered =
    nonOrchestraTeams.length === 0
      ? songs
      : songs.filter(
          (s) =>
            s.teamTags.length === 0 ||
            nonOrchestraTeams.every((team) => s.teamTags.includes(team)),
        )

  // 2. Score each song
  return teamFiltered
    .map((song) => {
      const lastUsedMs = song.lastUsedAt ? song.lastUsedAt.toMillis() : null
      const weeksAgo =
        lastUsedMs !== null ? Math.floor((nowMs - lastUsedMs) / MS_PER_WEEK) : null
      const isRecent = lastUsedMs !== null ? lastUsedMs > twoWeeksAgo : false

      // Scoring: higher = better suggestion
      // Never used: 500 (highest priority)
      // Used but not recent: 200 + staleness bonus (older = higher, capped at +300)
      // Used in last 2 weeks: 50 + recency penalty (low score, still appears)
      let score: number
      if (lastUsedMs === null) {
        score = 500
      } else if (isRecent) {
        score = 50 + (weeksAgo ?? 0) * 10
      } else {
        score = 200 + Math.min((weeksAgo ?? 0) * 15, 300)
      }

      // Type bonus: matching VW type gets +100 (soft priority, not a hard filter)
      const typeBonus = song.vwTypes.includes(requiredVwType) ? 100 : 0
      // Orchestra bonus: +200 when service is orchestra and song is orchestra-tagged (D-07)
      const orchestraBonus = hasOrchestra && song.teamTags.includes('Orchestra') ? 200 : 0
      score += typeBonus + orchestraBonus

      return { song, score, weeksAgo, isRecent }
    })
    .sort((a, b) => b.score - a.score)
}
