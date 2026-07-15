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
var csvImport_1 = require("@/utils/csvImport");
var firestore_1 = require("firebase/firestore");
// Helper to create a minimal existing Song for duplicate detection tests
function makeSong(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '22025', author: 'John Newton', themes: [], notes: '', tags: [], removedThemes: [], vwTypes: [], arrangements: [], primaryArrangementId: null, lastUsedAt: null, hidden: false, pcSongId: null, createdAt: firestore_1.Timestamp.fromMillis(0), updatedAt: firestore_1.Timestamp.fromMillis(0) }, overrides);
}
(0, vitest_1.describe)('mapRowToSong', function () {
    (0, vitest_1.it)('maps "Title" header to song title', function () {
        var row = { Title: 'Amazing Grace', 'CCLI Number': '22025', Author: 'John Newton' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.title).toBe('Amazing Grace');
    });
    (0, vitest_1.it)('maps "Song Title" header variant to song title', function () {
        var row = { 'Song Title': 'Holy Holy Holy', 'CCLI Number': '123' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.title).toBe('Holy Holy Holy');
    });
    (0, vitest_1.it)('maps "CCLI Number" header to ccliNumber', function () {
        var row = { Title: 'Test', 'CCLI Number': '12345' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.ccliNumber).toBe('12345');
    });
    (0, vitest_1.it)('maps "CCLI" header variant to ccliNumber', function () {
        var row = { Title: 'Test', CCLI: '12345' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.ccliNumber).toBe('12345');
    });
    (0, vitest_1.it)('maps "CCLI #" header variant to ccliNumber', function () {
        var row = { Title: 'Test', 'CCLI #': '12345' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.ccliNumber).toBe('12345');
    });
    (0, vitest_1.it)('maps "Author" header to author', function () {
        var row = { Title: 'Test', Author: 'Chris Tomlin' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.author).toBe('Chris Tomlin');
    });
    (0, vitest_1.it)('maps "Copyright" header variant to author', function () {
        var row = { Title: 'Test', Copyright: 'Hillsong' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.author).toBe('Hillsong');
    });
    (0, vitest_1.it)('maps "Themes" header to themes array split on comma', function () {
        var row = { Title: 'Test', Themes: 'Worship, Praise, Christmas' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.themes).toEqual(['Worship', 'Praise', 'Christmas']);
    });
    (0, vitest_1.it)('maps "Tags" header variant to themes array', function () {
        var row = { Title: 'Test', Tags: 'Easter,Advent' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.themes).toEqual(['Easter', 'Advent']);
    });
    (0, vitest_1.it)('maps Notes header to notes', function () {
        var row = { Title: 'Test', Notes: 'Important song' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.notes).toBe('Important song');
    });
    (0, vitest_1.it)('sets vwType to null always (user categorizes later)', function () {
        var row = { Title: 'Test' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.vwTypes).toEqual([]);
    });
    (0, vitest_1.it)('starts with isDuplicate false', function () {
        var row = { Title: 'Test' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result.isDuplicate).toBe(false);
    });
    (0, vitest_1.it)('has empty _warnings for valid rows', function () {
        var row = { Title: 'Test', 'CCLI Number': '111' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result._warnings).toEqual([]);
    });
    (0, vitest_1.it)('adds "Missing title" warning for empty title', function () {
        var row = { Title: '', Author: 'Someone' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result._warnings).toContain('Missing title');
    });
    (0, vitest_1.it)('adds "Missing title" warning when title headers absent', function () {
        var row = { Author: 'Someone', Notes: 'test' };
        var result = (0, csvImport_1.mapRowToSong)(row);
        (0, vitest_1.expect)(result._warnings).toContain('Missing title');
    });
});
(0, vitest_1.describe)('parseArrangementFromRow', function () {
    (0, vitest_1.it)('returns null when arrangement name is empty', function () {
        var row = { Title: 'Test' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('parses arrangement name from "Arrangement N Name" column', function () {
        var row = { 'Arrangement 1 Name': 'Default' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result.name).toBe('Default');
    });
    (0, vitest_1.it)('parses arrangement name from "Arrangement N" column variant', function () {
        var row = { 'Arrangement 1': 'Acoustic' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result.name).toBe('Acoustic');
    });
    (0, vitest_1.it)('parses BPM as number', function () {
        var row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 BPM': '120' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.bpm).toBe(120);
    });
    (0, vitest_1.it)('parses BPM from Tempo column variant', function () {
        var row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 Tempo': '72' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.bpm).toBe(72);
    });
    (0, vitest_1.it)('sets BPM to null when empty', function () {
        var row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 BPM': '' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.bpm).toBeNull();
    });
    (0, vitest_1.it)('sets BPM to null when non-numeric', function () {
        var row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 BPM': 'fast' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.bpm).toBeNull();
    });
    (0, vitest_1.it)('parses key from "Arrangement N Keys" column', function () {
        var row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 Keys': 'G' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.key).toBe('G');
    });
    (0, vitest_1.it)('parses key from "Arrangement N Key" column variant', function () {
        var row = { 'Arrangement 1 Name': 'Standard', 'Arrangement 1 Key': 'Bb' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.key).toBe('Bb');
    });
    (0, vitest_1.it)('parses teamTags from "Arrangement N Tags" column split on comma', function () {
        var row = { 'Arrangement 1 Name': 'Full Band', 'Arrangement 1 Tags': 'Band, Strings, Acoustic' };
        var result = (0, csvImport_1.parseArrangementFromRow)(row, 1);
        (0, vitest_1.expect)(result.teamTags).toEqual(['Band', 'Strings', 'Acoustic']);
    });
    (0, vitest_1.it)('generates a unique id for each arrangement', function () {
        var row1 = { 'Arrangement 1 Name': 'A' };
        var row2 = { 'Arrangement 2 Name': 'B' };
        var r1 = (0, csvImport_1.parseArrangementFromRow)(row1, 1);
        var r2 = (0, csvImport_1.parseArrangementFromRow)(row2, 2);
        (0, vitest_1.expect)(r1.id).not.toBe(r2.id);
        (0, vitest_1.expect)(r1.id.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('parses up to 5 arrangements from a row', function () {
        var row = {};
        for (var i = 1; i <= 5; i++) {
            row["Arrangement ".concat(i, " Name")] = "Arr ".concat(i);
        }
        // Build full song and check 5 arrangements come back
        var song = (0, csvImport_1.mapRowToSong)(__assign({ Title: 'Test' }, row));
        (0, vitest_1.expect)(song.arrangements.length).toBe(5);
    });
});
(0, vitest_1.describe)('detectDuplicates', function () {
    (0, vitest_1.it)('returns songs with isDuplicate false when no existing songs', function () {
        var row = { Title: 'New Song', 'CCLI Number': '99999' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, []);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(false);
    });
    (0, vitest_1.it)('flags duplicate by CCLI number match', function () {
        var existing = [makeSong({ ccliNumber: '22025' })];
        var row = { Title: 'Amazing Grace Different Spelling', 'CCLI Number': '22025' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(true);
    });
    (0, vitest_1.it)('does not flag non-duplicate when CCLI numbers differ', function () {
        var existing = [makeSong({ ccliNumber: '11111' })];
        var row = { Title: 'Different Song', 'CCLI Number': '99999' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(false);
    });
    (0, vitest_1.it)('flags duplicate by case-insensitive title when no CCLI on parsed song', function () {
        var existing = [makeSong({ title: 'Amazing Grace', ccliNumber: '' })];
        var row = { Title: 'amazing grace', 'CCLI Number': '' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(true);
    });
    (0, vitest_1.it)('flags duplicate by title case-insensitively with uppercase/mixed', function () {
        var existing = [makeSong({ title: 'How Great Is Our God', ccliNumber: '' })];
        var row = { Title: 'HOW GREAT IS OUR GOD' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(true);
    });
    (0, vitest_1.it)('does not use title matching when parsed song has CCLI (even if title matches)', function () {
        var existing = [makeSong({ title: 'Amazing Grace', ccliNumber: '99999' })];
        // Parsed song has different CCLI but same title — should NOT be flagged (CCLI mismatch)
        var row = { Title: 'Amazing Grace', 'CCLI Number': '11111' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(false);
    });
    (0, vitest_1.it)('handles multiple songs: flags only actual duplicates', function () {
        var existing = [makeSong({ ccliNumber: '22025', title: 'Amazing Grace' })];
        var rows = [
            (0, csvImport_1.mapRowToSong)({ Title: 'Amazing Grace', 'CCLI Number': '22025' }), // duplicate
            (0, csvImport_1.mapRowToSong)({ Title: 'New Song', 'CCLI Number': '99999' }), // new
        ];
        var result = (0, csvImport_1.detectDuplicates)(rows, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(true);
        (0, vitest_1.expect)(result[1].isDuplicate).toBe(false);
    });
    (0, vitest_1.it)('skips CCLI-based match when existing song has no CCLI', function () {
        var existing = [makeSong({ ccliNumber: '', title: 'Some Song' })];
        var row = { Title: 'Other Song', 'CCLI Number': '' };
        var parsed = [(0, csvImport_1.mapRowToSong)(row)];
        var result = (0, csvImport_1.detectDuplicates)(parsed, existing);
        (0, vitest_1.expect)(result[0].isDuplicate).toBe(false);
    });
});
