"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var suggestions_1 = require("@/utils/suggestions");
// Helper to create a mock Song with lastUsedAt as a timestamp-like object
function makeSong(overrides) {
    var lastUsedMs = overrides.lastUsedMs, rest = __rest(overrides, ["lastUsedMs"]);
    return __assign({ id: 'song-1', title: 'Test Song', ccliNumber: '', author: '', themes: [], notes: '', tags: [], removedThemes: [], vwTypes: [1], arrangements: [], primaryArrangementId: null, lastUsedAt: lastUsedMs != null ? { toMillis: function () { return lastUsedMs; } } : null, createdAt: { toMillis: function () { return 0; } }, updatedAt: { toMillis: function () { return 0; } }, pcSongId: null, hidden: false }, rest);
}
var NOW_MS = new Date('2026-03-04T00:00:00Z').getTime();
var ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
var TWO_WEEKS_MS = 2 * ONE_WEEK_MS;
var THREE_WEEKS_MS = 3 * ONE_WEEK_MS;
var TEN_WEEKS_MS = 10 * ONE_WEEK_MS;
(0, vitest_1.describe)('rankSongsForSlot - VW type (type-agnostic, D-10)', function () {
    (0, vitest_1.it)('returns empty array when songs array is empty', function () {
        var results = (0, suggestions_1.rankSongsForSlot)([], 1, [], NOW_MS);
        (0, vitest_1.expect)(results).toHaveLength(0);
    });
    (0, vitest_1.it)('returns ALL songs regardless of VW type (no hard filter)', function () {
        var songs = [
            makeSong({ id: 's1', title: 'Type 1 Song', vwTypes: [1] }),
            makeSong({ id: 's2', title: 'Type 2 Song', vwTypes: [2] }),
            makeSong({ id: 's3', title: 'Type 3 Song', vwTypes: [3] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results).toHaveLength(3);
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s1');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s2');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s3');
    });
    (0, vitest_1.it)('uncategorized songs (vwTypes: []) appear in results (not filtered out)', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1] }),
            makeSong({ id: 's2', vwTypes: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results).toHaveLength(2);
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s1');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s2');
    });
    (0, vitest_1.it)('type-matching and non-matching songs score EQUALLY (no typeBonus, D-10)', function () {
        // Both songs never used, same recency — with typeBonus removed they must score identically
        var songs = [
            makeSong({ id: 'match', vwTypes: [1] }), // never used: 500
            makeSong({ id: 'nomatch', vwTypes: [2] }), // never used: 500
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        var matchResult = results.find(function (r) { return r.song.id === 'match'; });
        var noMatchResult = results.find(function (r) { return r.song.id === 'nomatch'; });
        (0, vitest_1.expect)(matchResult.score).toBe(noMatchResult.score);
        (0, vitest_1.expect)(matchResult.score).toBe(500);
    });
    (0, vitest_1.it)('uncategorized songs score the same as type-matching songs (all get 500 base, no bonus)', function () {
        var songs = [
            makeSong({ id: 'no-type', vwTypes: [] }), // never used: 500
            makeSong({ id: 'match', vwTypes: [2] }), // never used: 500 (no typeBonus anymore)
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 2, [], NOW_MS);
        var nullResult = results.find(function (r) { return r.song.id === 'no-type'; });
        var matchResult = results.find(function (r) { return r.song.id === 'match'; });
        // Both get same base score — type match no longer adds any bonus
        (0, vitest_1.expect)(matchResult.score).toBe(500);
        (0, vitest_1.expect)(nullResult.score).toBe(500);
    });
    (0, vitest_1.it)('with mixed VW types, all never-used songs share the same score regardless of type', function () {
        var songs = [
            makeSong({ id: 'type2', vwTypes: [2] }),
            makeSong({ id: 'type1', vwTypes: [1] }),
            makeSong({ id: 'no-type', vwTypes: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        // All three never-used and no orchestra bonus — all score 500
        (0, vitest_1.expect)(results.every(function (r) { return r.score === 500; })).toBe(true);
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('type1');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('type2');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('no-type');
    });
    (0, vitest_1.it)('multi-type songs score the same as single-type or no-type songs with equal recency', function () {
        var songs = [
            makeSong({ id: 'multi', vwTypes: [1, 2] }), // never used: 500
            makeSong({ id: 'type3', vwTypes: [3] }), // never used: 500
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        var multiResult = results.find(function (r) { return r.song.id === 'multi'; });
        var type3Result = results.find(function (r) { return r.song.id === 'type3'; });
        (0, vitest_1.expect)(multiResult.score).toBe(500);
        (0, vitest_1.expect)(type3Result.score).toBe(500);
    });
});
(0, vitest_1.describe)('rankSongsForSlot - team softening: no hard filter (D-03)', function () {
    (0, vitest_1.it)('returns all songs when serviceTeams is empty (no team filter)', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], tags: ['Choir'] }),
            makeSong({ id: 's2', vwTypes: [2], tags: ['Orchestra'] }),
            makeSong({ id: 's3', vwTypes: [1], tags: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results).toHaveLength(3);
    });
    (0, vitest_1.it)('returns ALL songs regardless of tag match when serviceTeams is non-empty (no hard filter)', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], tags: ['Choir'] }), // matches scheduled team
            makeSong({ id: 's2', vwTypes: [1], tags: [] }), // no tags at all
            makeSong({ id: 's3', vwTypes: [1], tags: ['Orchestra'] }), // tagged with a non-scheduled team
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['Choir'], NOW_MS);
        (0, vitest_1.expect)(results).toHaveLength(3);
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s1');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s2');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('s3');
    });
    (0, vitest_1.it)('returns all songs even when scheduled with multiple teams and no song matches any', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], tags: [] }),
            makeSong({ id: 's2', vwTypes: [1], tags: ['Drama'] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['Choir', 'Orchestra'], NOW_MS);
        (0, vitest_1.expect)(results).toHaveLength(2);
    });
});
(0, vitest_1.describe)('rankSongsForSlot - scoring', function () {
    (0, vitest_1.it)('never-used songs get score 500 (base only, no typeBonus)', function () {
        var songs = [makeSong({ id: 's1', vwTypes: [1], lastUsedMs: undefined })];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].score).toBe(500);
        (0, vitest_1.expect)(results[0].weeksAgo).toBeNull();
        (0, vitest_1.expect)(results[0].isRecent).toBe(false);
    });
    (0, vitest_1.it)('never-used songs of any VW type all get score 500 (type is irrelevant to score)', function () {
        var songs = [makeSong({ id: 's1', vwTypes: [2], lastUsedMs: undefined })];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].score).toBe(500);
    });
    (0, vitest_1.it)('recently-used songs (within 2 weeks) get score below 200', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].score).toBeLessThan(200);
        (0, vitest_1.expect)(results[0].isRecent).toBe(true);
    });
    (0, vitest_1.it)('songs used exactly 1 week ago get score 60 (50 base + 1*10 staleness, no typeBonus)', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].score).toBe(60); // 50 + 1*10
        (0, vitest_1.expect)(results[0].weeksAgo).toBe(1);
    });
    (0, vitest_1.it)('songs used more than 2 weeks ago get score 200 or above', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].score).toBeGreaterThanOrEqual(200);
        (0, vitest_1.expect)(results[0].isRecent).toBe(false);
    });
    (0, vitest_1.it)('songs used 3 weeks ago get score 245 (200 + 3*15, no typeBonus)', function () {
        var songs = [
            makeSong({ id: 's1', vwTypes: [1], lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].score).toBe(245); // 200 + 3*15
        (0, vitest_1.expect)(results[0].weeksAgo).toBe(3);
    });
    (0, vitest_1.it)('older songs score higher than newer songs (staleness scoring)', function () {
        var songs = [
            makeSong({ id: 's_old', vwTypes: [1], lastUsedMs: NOW_MS - TEN_WEEKS_MS }),
            makeSong({ id: 's_new', vwTypes: [1], lastUsedMs: NOW_MS - THREE_WEEKS_MS }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].song.id).toBe('s_old');
        (0, vitest_1.expect)(results[0].score).toBeGreaterThan(results[1].score);
    });
});
(0, vitest_1.describe)('rankSongsForSlot - sorting', function () {
    (0, vitest_1.it)('returns results sorted by score descending (best suggestions first)', function () {
        var songs = [
            makeSong({ id: 's_recent', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
            makeSong({ id: 's_never', vwTypes: [1], lastUsedMs: undefined }),
            makeSong({ id: 's_stale', vwTypes: [1], lastUsedMs: NOW_MS - TEN_WEEKS_MS }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(results[0].song.id).toBe('s_never'); // score 500 (base only)
        (0, vitest_1.expect)(results[1].song.id).toBe('s_stale'); // score 500 (capped staleness) or 200+
        (0, vitest_1.expect)(results[2].song.id).toBe('s_recent'); // score 60 (1 week)
    });
    (0, vitest_1.it)('songs used in last 2 weeks appear in results but with lower score (deprioritized, not hidden)', function () {
        var songs = [
            makeSong({ id: 's_recent', vwTypes: [1], lastUsedMs: NOW_MS - ONE_WEEK_MS }),
            makeSong({ id: 's_never', vwTypes: [1], lastUsedMs: undefined }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        // Both songs appear
        (0, vitest_1.expect)(results).toHaveLength(2);
        // Recent song is last
        (0, vitest_1.expect)(results[results.length - 1].song.id).toBe('s_recent');
        (0, vitest_1.expect)(results[0].song.id).toBe('s_never');
    });
    (0, vitest_1.it)('songs of different VW types score equally when recency is the same (type-agnostic, D-10)', function () {
        var songs = [
            makeSong({ id: 'type2-never', vwTypes: [2] }), // 500 (no bonus)
            makeSong({ id: 'type1-never', vwTypes: [1] }), // 500 (no bonus)
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        // Both score 500 — neither has advantage over the other
        (0, vitest_1.expect)(results[0].score).toBe(500);
        (0, vitest_1.expect)(results[1].score).toBe(500);
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('type1-never');
        (0, vitest_1.expect)(results.map(function (r) { return r.song.id; })).toContain('type2-never');
    });
});
(0, vitest_1.describe)('rankSongsForSlot - result shape', function () {
    (0, vitest_1.it)('returns SuggestionResult with song, score, weeksAgo, and isRecent', function () {
        var songs = [makeSong({ id: 's1', vwTypes: [2] })];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 2, [], NOW_MS);
        (0, vitest_1.expect)(results[0]).toHaveProperty('song');
        (0, vitest_1.expect)(results[0]).toHaveProperty('score');
        (0, vitest_1.expect)(results[0]).toHaveProperty('weeksAgo');
        (0, vitest_1.expect)(results[0]).toHaveProperty('isRecent');
    });
});
(0, vitest_1.describe)('rankSongsForSlot - team-tag soft bonus (D-04)', function () {
    (0, vitest_1.it)('a song tagged with a scheduled team scores strictly higher than the same song without it', function () {
        var songs = [
            makeSong({ id: 'tagged', vwTypes: [1], tags: ['Choir'] }),
            makeSong({ id: 'untagged', vwTypes: [1], tags: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['Choir'], NOW_MS);
        var tagged = results.find(function (r) { return r.song.id === 'tagged'; });
        var untagged = results.find(function (r) { return r.song.id === 'untagged'; });
        (0, vitest_1.expect)(tagged.score).toBeGreaterThan(untagged.score);
        (0, vitest_1.expect)(tagged.score - untagged.score).toBe(200);
        (0, vitest_1.expect)(results[0].song.id).toBe('tagged');
    });
    (0, vitest_1.it)('the team-name match is case-insensitive (serviceTeams "orchestra" boosts a song tagged "Orchestra")', function () {
        var songs = [
            makeSong({ id: 'orch', vwTypes: [1], tags: ['Orchestra'] }),
            makeSong({ id: 'plain', vwTypes: [1], tags: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['orchestra'], NOW_MS);
        var orch = results.find(function (r) { return r.song.id === 'orch'; });
        var plain = results.find(function (r) { return r.song.id === 'plain'; });
        (0, vitest_1.expect)(orch.score - plain.score).toBe(200);
        (0, vitest_1.expect)(results[0].song.id).toBe('orch');
    });
    (0, vitest_1.it)('multiple scheduled teams each contribute an additive bonus (data-driven, no hardcoded team list)', function () {
        var songs = [
            makeSong({ id: 'both', vwTypes: [1], tags: ['Choir', 'Orchestra'] }),
            makeSong({ id: 'one', vwTypes: [1], tags: ['Choir'] }),
            makeSong({ id: 'none', vwTypes: [1], tags: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['Choir', 'Orchestra'], NOW_MS);
        var both = results.find(function (r) { return r.song.id === 'both'; });
        var one = results.find(function (r) { return r.song.id === 'one'; });
        var none = results.find(function (r) { return r.song.id === 'none'; });
        (0, vitest_1.expect)(both.score - one.score).toBe(200);
        (0, vitest_1.expect)(one.score - none.score).toBe(200);
        (0, vitest_1.expect)(results[0].song.id).toBe('both');
    });
    (0, vitest_1.it)('a non-scheduled team tag does not contribute a bonus', function () {
        var songs = [
            makeSong({ id: 'wrong-team', vwTypes: [1], tags: ['SpecialService'] }),
            makeSong({ id: 'no-tags', vwTypes: [1], tags: [] }),
        ];
        var results = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['Choir'], NOW_MS);
        var wrong = results.find(function (r) { return r.song.id === 'wrong-team'; });
        var none = results.find(function (r) { return r.song.id === 'no-tags'; });
        (0, vitest_1.expect)(wrong.score).toBe(none.score);
    });
    (0, vitest_1.it)('no bonus applied when serviceTeams is empty, even if the song has team-name tags', function () {
        var songs = [makeSong({ id: 's1', vwTypes: [1], tags: ['Choir', 'Orchestra'] })];
        var withTeams = (0, suggestions_1.rankSongsForSlot)(songs, 1, ['Choir', 'Orchestra'], NOW_MS);
        var withoutTeams = (0, suggestions_1.rankSongsForSlot)(songs, 1, [], NOW_MS);
        (0, vitest_1.expect)(withTeams[0].score - withoutTeams[0].score).toBe(400);
    });
});
