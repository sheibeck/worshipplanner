"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankSongsForSlot = rankSongsForSlot;
var RECENT_WEEKS = 2;
var MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
var TEAM_TAG_BONUS = 200;
/**
 * Returns songs ranked for a given slot. Every song is always eligible — there is no hard
 * team filter (D-03). Service team scheduling is a soft nudge only: for each scheduled team
 * whose name matches (case-insensitively) one of the song's `tags`, the song's score gets an
 * additive bonus (D-04) — data-driven, no hardcoded team list.
 * The VW type is accepted for API compatibility (caller passes slot type) but no longer
 * influences the score — songs are ranked purely by rotation/recency plus the team-tag bonus.
 * Pure function — no side effects, easily testable.
 *
 * @param songs - All songs from the song store
 * @param requiredVwType - Accepted for API compatibility; no longer contributes to scoring (D-10)
 * @param serviceTeams - Active teams for this service (D-02, unchanged scheduling concept).
 *                       Consumed only as a soft nudge here — each team name matching a song's
 *                       tags (case-insensitive) adds a bonus; no team gates eligibility (D-03/D-04).
 * @param nowMs - Current time in ms (defaults to Date.now(), injectable for testing)
 */
function rankSongsForSlot(songs, requiredVwType, serviceTeams, nowMs) {
    if (nowMs === void 0) { nowMs = Date.now(); }
    var twoWeeksAgo = nowMs - RECENT_WEEKS * MS_PER_WEEK;
    var lowerServiceTeams = serviceTeams.map(function (t) { return t.toLowerCase(); });
    // Score every song — no hard team filter (D-03). All songs are always eligible.
    return songs
        .map(function (song) {
        var lastUsedMs = song.lastUsedAt ? song.lastUsedAt.toMillis() : null;
        var weeksAgo = lastUsedMs !== null ? Math.floor((nowMs - lastUsedMs) / MS_PER_WEEK) : null;
        var isRecent = lastUsedMs !== null ? lastUsedMs > twoWeeksAgo : false;
        // Scoring: higher = better suggestion
        // Never used: 500 (highest priority)
        // Used but not recent: 200 + staleness bonus (older = higher, capped at +300)
        // Used in last 2 weeks: 50 + recency penalty (low score, still appears)
        var score;
        if (lastUsedMs === null) {
            score = 500;
        }
        else if (isRecent) {
            score = 50 + (weeksAgo !== null && weeksAgo !== void 0 ? weeksAgo : 0) * 10;
        }
        else {
            score = 200 + Math.min((weeksAgo !== null && weeksAgo !== void 0 ? weeksAgo : 0) * 15, 300);
        }
        // Type bonus removed (D-10): slot VW type no longer influences picker ranking.
        // The badge remains visible as information only; ordering is purely rotation/recency.
        // Team-tag soft bonus (D-04): each scheduled team whose name matches (case-insensitive)
        // one of the song's tags adds a bonus. Data-driven — no hardcoded team list — and every
        // song remains eligible regardless of match (D-03).
        var lowerTags = song.tags.map(function (t) { return t.toLowerCase(); });
        var teamBonus = lowerServiceTeams.reduce(function (total, team) { return total + (lowerTags.includes(team) ? TEAM_TAG_BONUS : 0); }, 0);
        score += teamBonus;
        return { song: song, score: score, weeksAgo: weeksAgo, isRecent: isRecent };
    })
        .sort(function (a, b) { return b.score - a.score; });
}
