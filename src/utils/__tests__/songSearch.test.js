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
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var songSearch_1 = require("@/utils/songSearch");
function makeSong(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '22025', author: 'John Newton', themes: ['grace', 'salvation'], notes: '', vwTypes: [1], tags: [], removedThemes: [], arrangements: [
            { id: 'arr-1', name: 'Standard', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            { id: 'arr-2', name: 'Orchestra', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
        ], primaryArrangementId: null, lastUsedAt: null, createdAt: { toMillis: function () { return 0; } }, updatedAt: { toMillis: function () { return 0; } }, pcSongId: null, hidden: false }, overrides);
}
(0, vitest_1.describe)('songMatchesQuery', function () {
    (0, vitest_1.it)('returns true for empty query', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), '')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), '   ')).toBe(true);
    });
    (0, vitest_1.it)('matches title case-insensitively', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), 'amazing')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), 'GRACE')).toBe(true);
    });
    (0, vitest_1.it)('matches CCLI number', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), '22025')).toBe(true);
    });
    (0, vitest_1.it)('matches author', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), 'newton')).toBe(true);
    });
    (0, vitest_1.it)('matches a theme', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), 'salvation')).toBe(true);
    });
    (0, vitest_1.it)('matches a folded team name via the tags bare-term scan (team names now live in tags)', function () {
        var song = makeSong({ tags: ['Choir'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'choir')).toBe(true);
    });
    (0, vitest_1.it)('matches category by number and by label', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong({ vwTypes: [1] }), '1')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong({ vwTypes: [1] }), 'call to worship')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong({ vwTypes: [2] }), 'intimate')).toBe(true);
    });
    (0, vitest_1.it)('matches user tags (case-insensitive substring)', function () {
        var song = makeSong({ tags: ['Christmas'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'christmas')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'Christ')).toBe(true);
    });
    (0, vitest_1.it)('matches notes (case-insensitive substring)', function () {
        var song = makeSong({ notes: 'quiet intro, builds slowly' });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'quiet intro')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'INTRO')).toBe(true);
    });
    (0, vitest_1.it)('matches arrangement key exactly (case-insensitive)', function () {
        // arr-1 has key 'G', arr-2 has key 'A'
        var song = makeSong();
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'g')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'G')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'a')).toBe(true);
        // Partial key should NOT match (exact match only)
        var songBb = makeSong({ title: 'Zzz', author: '', themes: [], tags: [], ccliNumber: '', vwTypes: [],
            arrangements: [{ id: 'arr-1', name: 'Std', key: 'Bb', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(songBb, 'b')).toBe(false);
    });
    (0, vitest_1.it)('returns false when nothing matches', function () {
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), 'xylophone')).toBe(false);
    });
});
(0, vitest_1.describe)('songMatchesQuery — field-scoped + phrases (Phase 12)', function () {
    (0, vitest_1.it)('matches tag: prefix as case-insensitive substring', function () {
        var song = makeSong({ tags: ['Orchestra'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag:orch')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag:xyz')).toBe(false);
    });
    (0, vitest_1.it)('matches theme: prefix as case-insensitive substring', function () {
        var song = makeSong({ themes: ['Adoration'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'theme:ador')).toBe(true);
    });
    (0, vitest_1.it)('matches team: prefix as case-insensitive substring aliased to tags (D-06)', function () {
        var song = makeSong({ tags: ['Choir'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'team:cho')).toBe(true);
    });
    (0, vitest_1.it)('team: prefix returns false for a song without the team name in its tags', function () {
        var song = makeSong({ tags: ['Orchestra'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'team:choir')).toBe(false);
    });
    (0, vitest_1.it)('matches type: prefix by number', function () {
        var song = makeSong({ vwTypes: [1] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'type:1')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'type:2')).toBe(false);
    });
    (0, vitest_1.it)('type: prefix matches by default (vwModeEnabled omitted → true, D-16)', function () {
        var song = makeSong({ vwTypes: [1] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'type:1', true)).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'type:1')).toBe(true);
    });
    (0, vitest_1.it)('type: prefix matches nothing when vwModeEnabled is false (D-16)', function () {
        var song = makeSong({ vwTypes: [1] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'type:1', false)).toBe(false);
    });
    (0, vitest_1.it)('vwModeEnabled=false does not affect tag:/theme:/key:/team:/bare matches — only type: is gated', function () {
        var song = makeSong({ tags: ['Christmas'], themes: ['grace'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag:christmas', false)).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'theme:grace', false)).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'key:g', false)).toBe(true);
        var teamSong = makeSong({ tags: ['Choir'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(teamSong, 'team:choir', false)).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(makeSong(), 'amazing', false)).toBe(true);
    });
    (0, vitest_1.it)('matches key: prefix exactly (case-insensitive)', function () {
        var song = makeSong({
            arrangements: [
                { id: 'arr-1', name: 'Std', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
                { id: 'arr-2', name: 'Alt', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            ],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'key:a')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'key:e')).toBe(false);
        var songEm = makeSong({
            arrangements: [
                { id: 'arr-1', name: 'Std', key: 'Em', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            ],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(songEm, 'key:e')).toBe(false);
    });
    (0, vitest_1.it)('tolerates a space after the prefix colon', function () {
        var song = makeSong({
            arrangements: [
                { id: 'arr-1', name: 'Std', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            ],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'key: a')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'key:a')).toBe(true);
    });
    (0, vitest_1.it)('recognizes natural two-word phrases "Type N" and "Key X"', function () {
        var songType1 = makeSong({ vwTypes: [1] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(songType1, 'Type 1')).toBe(true);
        var songKeyA = makeSong({
            arrangements: [
                { id: 'arr-1', name: 'Std', key: 'A', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            ],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(songKeyA, 'Key A')).toBe(true);
    });
    (0, vitest_1.it)('does not infer type/key from a lone bare number or letter', function () {
        var song = makeSong({
            vwTypes: [2],
            title: 'Zzz',
            tags: [],
            themes: [],
            ccliNumber: '',
            author: '',
            notes: '',
            arrangements: [],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, '1')).toBe(false);
    });
    (0, vitest_1.it)('ANDs multiple field-scoped terms together', function () {
        var song = makeSong({
            tags: ['Orchestra'],
            arrangements: [
                { id: 'a', name: 'x', key: 'E', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            ],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag:orch key:E')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag:orch key:G')).toBe(false);
    });
    (0, vitest_1.it)('ANDs multiple bare terms together', function () {
        var song = makeSong({ title: 'Amazing Grace' });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'amazing grace')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'amazing xylophone')).toBe(false);
    });
    (0, vitest_1.it)('matches a multi-word field-scoped value as a single phrase (WR-02 fix)', function () {
        var song = makeSong({ tags: ['Christmas Eve'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag: christmas eve')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag:christmas eve')).toBe(true);
        // A song without "eve" anywhere else should NOT match a query for an
        // unrelated single-word tag value.
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag: christmas day')).toBe(false);
    });
    (0, vitest_1.it)('captures a multi-word field value up to the next recognized field prefix', function () {
        var song = makeSong({
            tags: ['Christmas Eve'],
            arrangements: [
                { id: 'a', name: 'x', key: 'E', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] },
            ],
        });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag: christmas eve key:E')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'tag: christmas eve key:G')).toBe(false);
    });
    (0, vitest_1.it)('ANDs a multi-word field value with a separate bare term placed before it', function () {
        // A field-scoped value with no following recognized prefix greedily
        // captures the rest of the string, so a bare term must precede it to
        // remain a separate AND'd term (documented behavior of the greedy
        // to-end-of-string capture).
        var song = makeSong({ title: 'Silent Night', tags: ['Christmas Eve'] });
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'silent tag: christmas eve')).toBe(true);
        (0, vitest_1.expect)((0, songSearch_1.songMatchesQuery)(song, 'xylophone tag: christmas eve')).toBe(false);
    });
});
(0, vitest_1.describe)('getPrimaryArrangement / getPrimaryKey', function () {
    (0, vitest_1.it)('returns the arrangement matching primaryArrangementId', function () {
        var _a;
        var song = makeSong({ primaryArrangementId: 'arr-2' });
        (0, vitest_1.expect)((_a = (0, songSearch_1.getPrimaryArrangement)(song)) === null || _a === void 0 ? void 0 : _a.id).toBe('arr-2');
        (0, vitest_1.expect)((0, songSearch_1.getPrimaryKey)(song)).toBe('A');
    });
    (0, vitest_1.it)('falls back to first arrangement when primaryArrangementId is null', function () {
        var _a;
        var song = makeSong({ primaryArrangementId: null });
        (0, vitest_1.expect)((_a = (0, songSearch_1.getPrimaryArrangement)(song)) === null || _a === void 0 ? void 0 : _a.id).toBe('arr-1');
        (0, vitest_1.expect)((0, songSearch_1.getPrimaryKey)(song)).toBe('G');
    });
    (0, vitest_1.it)('falls back to first arrangement when primaryArrangementId is stale', function () {
        var song = makeSong({ primaryArrangementId: 'arr-gone' });
        (0, vitest_1.expect)((0, songSearch_1.getPrimaryKey)(song)).toBe('G');
    });
    (0, vitest_1.it)('returns empty string when there are no arrangements', function () {
        var song = makeSong({ arrangements: [], primaryArrangementId: null });
        (0, vitest_1.expect)((0, songSearch_1.getPrimaryArrangement)(song)).toBeUndefined();
        (0, vitest_1.expect)((0, songSearch_1.getPrimaryKey)(song)).toBe('');
    });
});
