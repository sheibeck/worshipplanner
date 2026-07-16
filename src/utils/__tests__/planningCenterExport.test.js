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
var planningCenterExport_1 = require("@/utils/planningCenterExport");
var mockTimestamp = { toDate: function () { return new Date('2026-03-04'); } };
var mockSongs = [
    {
        id: 'song-0',
        title: 'Come Thou Fount',
        ccliNumber: '22025',
        author: 'Robert Robinson',
        themes: [],
        notes: '',
        tags: [],
        removedThemes: [],
        vwTypes: [1],
        arrangements: [
            {
                id: 'arr-0a',
                name: 'Standard',
                key: 'G',
                bpm: 96,
                lengthSeconds: null,
                chordChartUrl: '',
                notes: '',
                teamTags: [],
            },
        ],
        primaryArrangementId: null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
    },
    {
        id: 'song-2',
        title: 'Great Is Thy Faithfulness',
        ccliNumber: '18723',
        author: 'Thomas Chisholm',
        themes: [],
        notes: '',
        tags: [],
        removedThemes: [],
        vwTypes: [2],
        arrangements: [
            {
                id: 'arr-2a',
                name: 'Standard',
                key: 'D',
                bpm: 72,
                lengthSeconds: null,
                chordChartUrl: '',
                notes: '',
                teamTags: [],
            },
        ],
        primaryArrangementId: null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
    },
    {
        id: 'song-5',
        title: 'Holy Holy Holy',
        ccliNumber: '',
        author: 'Reginald Heber',
        themes: [],
        notes: '',
        tags: [],
        removedThemes: [],
        vwTypes: [2],
        arrangements: [
            {
                id: 'arr-5a',
                name: 'Standard',
                key: 'Eb',
                bpm: 80,
                lengthSeconds: null,
                chordChartUrl: '',
                notes: '',
                teamTags: [],
            },
        ],
        primaryArrangementId: null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
    },
    {
        id: 'song-6',
        title: 'How Great Thou Art',
        ccliNumber: '14181',
        author: 'Carl Boberg',
        themes: [],
        notes: '',
        tags: [],
        removedThemes: [],
        vwTypes: [3],
        arrangements: [],
        primaryArrangementId: null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
    },
    {
        id: 'song-8',
        title: 'Doxology',
        ccliNumber: '56266',
        author: 'Thomas Ken',
        themes: [],
        notes: '',
        tags: [],
        removedThemes: [],
        vwTypes: [3],
        arrangements: [],
        primaryArrangementId: null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
    },
];
var mockService = {
    id: 'svc-001',
    date: '2026-03-08',
    name: '',
    progression: '1-2-2-3',
    teams: ['Choir', 'Orchestra'],
    status: 'draft',
    slots: [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-0', songTitle: 'Come Thou Fount', songKey: 'G' },
        { kind: 'SCRIPTURE', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
        { kind: 'SONG', position: 2, requiredVwType: 2, songId: 'song-2', songTitle: 'Great Is Thy Faithfulness', songKey: 'D' },
        { kind: 'PRAYER', position: 3 },
        { kind: 'SCRIPTURE', position: 4, book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
        { kind: 'SONG', position: 5, requiredVwType: 2, songId: 'song-5', songTitle: 'Holy Holy Holy', songKey: 'Eb' },
        { kind: 'SONG', position: 6, requiredVwType: 3, songId: 'song-6', songTitle: 'How Great Thou Art', songKey: 'A' },
        { kind: 'MESSAGE', position: 7 },
        { kind: 'SONG', position: 8, requiredVwType: 3, songId: 'song-8', songTitle: 'Doxology', songKey: 'G' },
    ],
    sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
    notes: 'Communion Sunday — extended prayer time',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
};
(0, vitest_1.describe)('formatForPlanningCenter', function () {
    (0, vitest_1.it)('includes the date in Month Day, Year format', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('March 8, 2026');
    });
    (0, vitest_1.it)('includes teams in the header', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('Teams: Choir, Orchestra');
    });
    (0, vitest_1.it)('includes progression in the header', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('Progression: 1-2-2-3');
    });
    (0, vitest_1.it)('formats song slots with title, key, and CCLI number', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('Song 1 -- Come Thou Fount (Key: G | CCLI #22025)');
    });
    (0, vitest_1.it)('omits CCLI when song has no CCLI number', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        // Holy Holy Holy has empty CCLI
        (0, vitest_1.expect)(result).toContain('Song 3 -- Holy Holy Holy (Key: Eb)');
        (0, vitest_1.expect)(result).not.toContain('Holy Holy Holy (Key: Eb | CCLI #)');
    });
    (0, vitest_1.it)('formats scripture slots with book, chapter, and verse range', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('Scripture -- Psalms 23:1-6');
    });
    (0, vitest_1.it)('formats prayer slot as just "Prayer"', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('\nPrayer\n');
    });
    (0, vitest_1.it)('formats message slot with sermon passage when present', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('Message -- Romans 8:1-11');
    });
    (0, vitest_1.it)('formats message slot without passage when sermonPassage is null', function () {
        var serviceNoPassage = __assign(__assign({}, mockService), { sermonPassage: null });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceNoPassage, mockSongs);
        (0, vitest_1.expect)(result).toContain('\nMessage\n');
        (0, vitest_1.expect)(result).not.toContain('Message --');
    });
    (0, vitest_1.it)('shows [empty] for song slots with no songId', function () {
        var serviceEmptySlot = __assign(__assign({}, mockService), { slots: mockService.slots.map(function (s) {
                return s.position === 0 ? __assign(__assign({}, s), { songId: null, songTitle: null, songKey: null }) : s;
            }) });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceEmptySlot, mockSongs);
        (0, vitest_1.expect)(result).toContain('Song 1 -- [empty]');
    });
    (0, vitest_1.it)('includes notes section when notes are non-empty', function () {
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(mockService, mockSongs);
        (0, vitest_1.expect)(result).toContain('Notes:');
        (0, vitest_1.expect)(result).toContain('Communion Sunday');
    });
    (0, vitest_1.it)('omits notes section when notes are empty', function () {
        var serviceNoNotes = __assign(__assign({}, mockService), { notes: '' });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceNoNotes, mockSongs);
        (0, vitest_1.expect)(result).not.toContain('Notes:');
    });
    (0, vitest_1.it)('includes service name when non-empty', function () {
        var serviceWithName = __assign(__assign({}, mockService), { name: 'Easter Sunday' });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceWithName, mockSongs);
        (0, vitest_1.expect)(result).toContain('Easter Sunday');
    });
    (0, vitest_1.it)('uses Standard Band when teams array is empty', function () {
        var serviceNoTeams = __assign(__assign({}, mockService), { teams: [] });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceNoTeams, mockSongs);
        (0, vitest_1.expect)(result).toContain('Teams: Standard Band');
    });
});
(0, vitest_1.describe)('formatForPlanningCenter - HYMN slots', function () {
    (0, vitest_1.it)('formats a filled HYMN slot as "Hymn -- {name} #{number} (vv. {verses})"', function () {
        var serviceWithHymn = __assign(__assign({}, mockService), { slots: [
                { kind: 'HYMN', position: 0, hymnName: 'Amazing Grace', hymnNumber: '337', verses: '1, 3, 4' },
            ] });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceWithHymn, mockSongs);
        (0, vitest_1.expect)(result).toContain('Hymn -- Amazing Grace #337 (vv. 1, 3, 4)');
    });
    (0, vitest_1.it)('formats a HYMN slot with empty hymnName as "Hymn -- [empty]"', function () {
        var serviceWithEmptyHymn = __assign(__assign({}, mockService), { slots: [
                { kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' },
            ] });
        var result = (0, planningCenterExport_1.formatForPlanningCenter)(serviceWithEmptyHymn, mockSongs);
        (0, vitest_1.expect)(result).toContain('Hymn -- [empty]');
    });
});
(0, vitest_1.describe)('formatScriptureRef', function () {
    (0, vitest_1.it)('formats a scripture reference correctly', function () {
        var ref = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 };
        (0, vitest_1.expect)((0, planningCenterExport_1.formatScriptureRef)(ref)).toBe('Romans 8:1-11');
    });
    (0, vitest_1.it)('formats single verse references', function () {
        var ref = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 };
        (0, vitest_1.expect)((0, planningCenterExport_1.formatScriptureRef)(ref)).toBe('John 3:16-16');
    });
});
