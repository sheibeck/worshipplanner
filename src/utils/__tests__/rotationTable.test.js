"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var rotationTable_1 = require("@/utils/rotationTable");
function makeService(overrides) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    var id = overrides.id, date = overrides.date, _w = overrides.songSlots, songSlots = _w === void 0 ? [] : _w;
    var slots = [
        // Build a minimal 9-slot template with song slots filled from overrides
        {
            kind: 'SONG',
            position: 0,
            requiredVwType: 1,
            songId: (_b = (_a = songSlots.find(function (s) { return s.position === 0; })) === null || _a === void 0 ? void 0 : _a.songId) !== null && _b !== void 0 ? _b : null,
            songTitle: (_d = (_c = songSlots.find(function (s) { return s.position === 0; })) === null || _c === void 0 ? void 0 : _c.songTitle) !== null && _d !== void 0 ? _d : null,
            songKey: null,
        },
        { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null },
        {
            kind: 'SONG',
            position: 2,
            requiredVwType: 2,
            songId: (_f = (_e = songSlots.find(function (s) { return s.position === 2; })) === null || _e === void 0 ? void 0 : _e.songId) !== null && _f !== void 0 ? _f : null,
            songTitle: (_h = (_g = songSlots.find(function (s) { return s.position === 2; })) === null || _g === void 0 ? void 0 : _g.songTitle) !== null && _h !== void 0 ? _h : null,
            songKey: null,
        },
        { kind: 'PRAYER', position: 3 },
        { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
        {
            kind: 'SONG',
            position: 5,
            requiredVwType: 2,
            songId: (_k = (_j = songSlots.find(function (s) { return s.position === 5; })) === null || _j === void 0 ? void 0 : _j.songId) !== null && _k !== void 0 ? _k : null,
            songTitle: (_m = (_l = songSlots.find(function (s) { return s.position === 5; })) === null || _l === void 0 ? void 0 : _l.songTitle) !== null && _m !== void 0 ? _m : null,
            songKey: null,
        },
        {
            kind: 'SONG',
            position: 6,
            requiredVwType: 3,
            songId: (_p = (_o = songSlots.find(function (s) { return s.position === 6; })) === null || _o === void 0 ? void 0 : _o.songId) !== null && _p !== void 0 ? _p : null,
            songTitle: (_r = (_q = songSlots.find(function (s) { return s.position === 6; })) === null || _q === void 0 ? void 0 : _q.songTitle) !== null && _r !== void 0 ? _r : null,
            songKey: null,
        },
        { kind: 'MESSAGE', position: 7 },
        {
            kind: 'SONG',
            position: 8,
            requiredVwType: 3,
            songId: (_t = (_s = songSlots.find(function (s) { return s.position === 8; })) === null || _s === void 0 ? void 0 : _s.songId) !== null && _t !== void 0 ? _t : null,
            songTitle: (_v = (_u = songSlots.find(function (s) { return s.position === 8; })) === null || _u === void 0 ? void 0 : _u.songTitle) !== null && _v !== void 0 ? _v : null,
            songKey: null,
        },
    ];
    return {
        id: id,
        date: date,
        name: 'Sunday Service',
        progression: '1-2-2-3',
        teams: [],
        status: 'planned',
        slots: slots,
        sermonPassage: null,
        notes: '',
        createdAt: { toMillis: function () { return 0; } },
        updatedAt: { toMillis: function () { return 0; } },
    };
}
(0, vitest_1.describe)('computeRotationTable', function () {
    (0, vitest_1.it)('returns empty array for empty services list', function () {
        var result = (0, rotationTable_1.computeRotationTable)([]);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
    (0, vitest_1.it)('returns empty array when all slots are unfilled (songId null)', function () {
        var services = [makeService({ id: 'svc1', date: '2026-03-01' })];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
    (0, vitest_1.it)('includes a song that appears in one service', function () {
        var services = [
            makeService({
                id: 'svc1',
                date: '2026-03-01',
                songSlots: [{ position: 0, songId: 'song-a', songTitle: 'Song A' }],
            }),
        ];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].songId).toBe('song-a');
        (0, vitest_1.expect)(result[0].songTitle).toBe('Song A');
        (0, vitest_1.expect)(result[0].dates).toEqual(['2026-03-01']);
    });
    (0, vitest_1.it)('collects all dates when a song appears in multiple services', function () {
        var services = [
            makeService({
                id: 'svc1',
                date: '2026-03-01',
                songSlots: [{ position: 0, songId: 'song-a', songTitle: 'Song A' }],
            }),
            makeService({
                id: 'svc2',
                date: '2026-03-08',
                songSlots: [{ position: 0, songId: 'song-a', songTitle: 'Song A' }],
            }),
        ];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].songId).toBe('song-a');
        (0, vitest_1.expect)(result[0].dates).toContain('2026-03-01');
        (0, vitest_1.expect)(result[0].dates).toContain('2026-03-08');
        (0, vitest_1.expect)(result[0].dates).toHaveLength(2);
    });
    (0, vitest_1.it)('handles multiple songs across multiple services', function () {
        var services = [
            makeService({
                id: 'svc1',
                date: '2026-03-01',
                songSlots: [
                    { position: 0, songId: 'song-a', songTitle: 'Song A' },
                    { position: 2, songId: 'song-b', songTitle: 'Song B' },
                ],
            }),
            makeService({
                id: 'svc2',
                date: '2026-03-08',
                songSlots: [
                    { position: 0, songId: 'song-b', songTitle: 'Song B' },
                    { position: 5, songId: 'song-c', songTitle: 'Song C' },
                ],
            }),
        ];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result).toHaveLength(3);
        var songB = result.find(function (r) { return r.songId === 'song-b'; });
        (0, vitest_1.expect)(songB).toBeDefined();
        (0, vitest_1.expect)(songB.dates).toHaveLength(2);
    });
    (0, vitest_1.it)('skips slots with null songId (unfilled slots)', function () {
        var services = [
            makeService({
                id: 'svc1',
                date: '2026-03-01',
                songSlots: [
                    { position: 0, songId: 'song-a', songTitle: 'Song A' },
                    { position: 2, songId: null, songTitle: null },
                ],
            }),
        ];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].songId).toBe('song-a');
    });
    (0, vitest_1.it)('returns results sorted alphabetically by songTitle', function () {
        var services = [
            makeService({
                id: 'svc1',
                date: '2026-03-01',
                songSlots: [
                    { position: 0, songId: 'song-z', songTitle: 'Zebra Song' },
                    { position: 2, songId: 'song-a', songTitle: 'Amazing Grace' },
                    { position: 5, songId: 'song-m', songTitle: 'Mighty to Save' },
                ],
            }),
        ];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result[0].songTitle).toBe('Amazing Grace');
        (0, vitest_1.expect)(result[1].songTitle).toBe('Mighty to Save');
        (0, vitest_1.expect)(result[2].songTitle).toBe('Zebra Song');
    });
    (0, vitest_1.it)('does not include songs with no appearances (only filled slots count)', function () {
        var services = [makeService({ id: 'svc1', date: '2026-03-01', songSlots: [] })];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
    (0, vitest_1.it)('handles same song in multiple slots in the same service', function () {
        var services = [
            makeService({
                id: 'svc1',
                date: '2026-03-01',
                songSlots: [
                    { position: 0, songId: 'song-a', songTitle: 'Song A' },
                    { position: 2, songId: 'song-a', songTitle: 'Song A' }, // same song twice
                ],
            }),
        ];
        var result = (0, rotationTable_1.computeRotationTable)(services);
        var entry = result.find(function (r) { return r.songId === 'song-a'; });
        (0, vitest_1.expect)(entry).toBeDefined();
        // Date appears once per service (not once per slot)
        (0, vitest_1.expect)(entry.dates).toHaveLength(1);
        (0, vitest_1.expect)(entry.dates[0]).toBe('2026-03-01');
    });
});
