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
var test_utils_1 = require("@vue/test-utils");
var ServicePrintLayout_vue_1 = require("../ServicePrintLayout.vue");
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
        { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
        { kind: 'MESSAGE', position: 7 },
        { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    ],
    sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
    notes: 'Communion Sunday — extended prayer time',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
};
(0, vitest_1.describe)('ServicePrintLayout', function () {
    (0, vitest_1.it)('renders all 9 slot rows from the service prop', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        // Each slot should be rendered; check slot container has 9 children
        var slotRows = wrapper.findAll('[data-slot-row]');
        (0, vitest_1.expect)(slotRows).toHaveLength(9);
    });
    (0, vitest_1.it)('renders song title and key for a populated song slot', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Come Thou Fount');
        (0, vitest_1.expect)(wrapper.text()).toContain('Key: G');
    });
    (0, vitest_1.it)('renders BPM for a song slot when available from arrangement', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        // Come Thou Fount has BPM 96 in the G arrangement
        (0, vitest_1.expect)(wrapper.text()).toContain('96');
    });
    (0, vitest_1.it)('renders "[not assigned]" for empty song slots (songId is null)', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('[not assigned]');
    });
    (0, vitest_1.it)('renders sermon passage in the Message row when sermonPassage exists', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Romans 8:1-11');
    });
    (0, vitest_1.it)('does not render sermon passage in Message row when sermonPassage is null', function () {
        var serviceNoPassage = __assign(__assign({}, mockService), { sermonPassage: null });
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: serviceNoPassage, songs: mockSongs },
        });
        // Should still have Message label but no passage text
        (0, vitest_1.expect)(wrapper.text()).toContain('Message');
        (0, vitest_1.expect)(wrapper.text()).not.toContain('Romans');
    });
    (0, vitest_1.it)('renders notes section when service.notes is non-empty', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Notes');
        (0, vitest_1.expect)(wrapper.text()).toContain('Communion Sunday');
    });
    (0, vitest_1.it)('does not render notes section when service.notes is empty string', function () {
        var serviceNoNotes = __assign(__assign({}, mockService), { notes: '' });
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: serviceNoNotes, songs: mockSongs },
        });
        (0, vitest_1.expect)(wrapper.text()).not.toContain('Notes');
    });
    (0, vitest_1.it)('renders the formatted date in the header', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        // date: '2026-03-08' should render as "Sunday, March 8, 2026"
        (0, vitest_1.expect)(wrapper.text()).toContain('March 8, 2026');
    });
    (0, vitest_1.it)('renders teams display in the header', function () {
        var wrapper = (0, test_utils_1.mount)(ServicePrintLayout_vue_1.default, {
            props: { service: mockService, songs: mockSongs },
        });
        (0, vitest_1.expect)(wrapper.text()).toContain('Choir');
        (0, vitest_1.expect)(wrapper.text()).toContain('Orchestra');
    });
});
