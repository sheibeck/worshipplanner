"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var scripture_1 = require("@/utils/scripture");
(0, vitest_1.describe)('BIBLE_BOOKS', function () {
    (0, vitest_1.it)('contains exactly 66 books', function () {
        (0, vitest_1.expect)(scripture_1.BIBLE_BOOKS).toHaveLength(66);
    });
    (0, vitest_1.it)('starts with Genesis', function () {
        (0, vitest_1.expect)(scripture_1.BIBLE_BOOKS[0]).toBe('Genesis');
    });
    (0, vitest_1.it)('ends with Revelation', function () {
        (0, vitest_1.expect)(scripture_1.BIBLE_BOOKS[65]).toBe('Revelation');
    });
    (0, vitest_1.it)('contains Psalms', function () {
        (0, vitest_1.expect)(scripture_1.BIBLE_BOOKS).toContain('Psalms');
    });
    (0, vitest_1.it)('contains John', function () {
        (0, vitest_1.expect)(scripture_1.BIBLE_BOOKS).toContain('John');
    });
});
(0, vitest_1.describe)('esvLink', function () {
    (0, vitest_1.it)('generates correct URL for Psalm 23', function () {
        (0, vitest_1.expect)((0, scripture_1.esvLink)('Psalm', 23)).toBe('https://www.esv.org/Psalm+23');
    });
    (0, vitest_1.it)('generates correct URL for 1 John 3 (spaces become +)', function () {
        (0, vitest_1.expect)((0, scripture_1.esvLink)('1 John', 3)).toBe('https://www.esv.org/1+John+3');
    });
    (0, vitest_1.it)('generates correct URL for John 3', function () {
        (0, vitest_1.expect)((0, scripture_1.esvLink)('John', 3)).toBe('https://www.esv.org/John+3');
    });
    (0, vitest_1.it)('handles single-word book names', function () {
        (0, vitest_1.expect)((0, scripture_1.esvLink)('Romans', 8)).toBe('https://www.esv.org/Romans+8');
    });
    (0, vitest_1.it)('handles books with numbers (e.g., 2 Corinthians)', function () {
        (0, vitest_1.expect)((0, scripture_1.esvLink)('2 Corinthians', 5)).toBe('https://www.esv.org/2+Corinthians+5');
    });
});
(0, vitest_1.describe)('scripturesOverlap', function () {
    (0, vitest_1.it)('returns true when same book, same chapter, overlapping verse ranges', function () {
        var reading = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 6 };
        var sermon = { book: 'Psalm', chapter: 23, verseStart: 4, verseEnd: 10 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(true);
    });
    (0, vitest_1.it)('returns true when verse ranges are identical', function () {
        var reading = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 };
        var sermon = { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(true);
    });
    (0, vitest_1.it)('returns true when reading contains sermon', function () {
        var reading = { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 39 };
        var sermon = { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(true);
    });
    (0, vitest_1.it)('returns false when different books', function () {
        var reading = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 6 };
        var sermon = { book: 'John', chapter: 23, verseStart: 1, verseEnd: 6 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(false);
    });
    (0, vitest_1.it)('returns false when different chapters', function () {
        var reading = { book: 'John', chapter: 3, verseStart: 1, verseEnd: 21 };
        var sermon = { book: 'John', chapter: 4, verseStart: 1, verseEnd: 21 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(false);
    });
    (0, vitest_1.it)('returns false when non-overlapping verse ranges', function () {
        var reading = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 3 };
        var sermon = { book: 'Psalm', chapter: 23, verseStart: 4, verseEnd: 6 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(false);
    });
    (0, vitest_1.it)('returns true when verse ranges are adjacent at boundary (touching)', function () {
        // verseStart <= sermon.verseEnd (4 <= 4) && verseEnd >= sermon.verseStart (4 >= 4)
        var reading = { book: 'Psalm', chapter: 23, verseStart: 1, verseEnd: 4 };
        var sermon = { book: 'Psalm', chapter: 23, verseStart: 4, verseEnd: 8 };
        (0, vitest_1.expect)((0, scripture_1.scripturesOverlap)(reading, sermon)).toBe(true);
    });
});
(0, vitest_1.describe)('parseScriptureInput', function () {
    (0, vitest_1.it)('returns null for empty string', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('')).toBeNull();
    });
    (0, vitest_1.it)('returns null for whitespace-only string', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('   ')).toBeNull();
    });
    (0, vitest_1.it)('returns null for book only (no chapter)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('John')).toBeNull();
    });
    (0, vitest_1.it)('returns null for partial/unrecognized book name', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('joh 3:16')).toBeNull();
    });
    (0, vitest_1.it)('parses "Isaiah 53:1-6" correctly', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('Isaiah 53:1-6')).toEqual({
            book: 'Isaiah',
            chapter: 53,
            verseStart: 1,
            verseEnd: 6,
        });
    });
    (0, vitest_1.it)('parses "Psalm 23" (chapter only, no verses)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('Psalm 23')).toEqual({
            book: 'Psalms',
            chapter: 23,
        });
    });
    (0, vitest_1.it)('parses "Romans 8:28" (single verse, no verseEnd)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('Romans 8:28')).toEqual({
            book: 'Romans',
            chapter: 8,
            verseStart: 28,
        });
    });
    (0, vitest_1.it)('parses "John 1:1-10,15-20" (multi-range: outer range)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('John 1:1-10,15-20')).toEqual({
            book: 'John',
            chapter: 1,
            verseStart: 1,
            verseEnd: 20,
        });
    });
    (0, vitest_1.it)('parses "John 1:1-2,6-9" (multi-range with comma: min/max outer range)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('John 1:1-2,6-9')).toEqual({
            book: 'John',
            chapter: 1,
            verseStart: 1,
            verseEnd: 9,
        });
    });
    (0, vitest_1.it)('parses "1 Corinthians 13:4-7" (numbered book)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('1 Corinthians 13:4-7')).toEqual({
            book: '1 Corinthians',
            chapter: 13,
            verseStart: 4,
            verseEnd: 7,
        });
    });
    (0, vitest_1.it)('parses "Song of Solomon 2:1" (multi-word book)', function () {
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('Song of Solomon 2:1')).toEqual({
            book: 'Song of Solomon',
            chapter: 2,
            verseStart: 1,
        });
    });
    (0, vitest_1.it)('exact match wins: "John 3:16" resolves to John not 1/2/3 John', function () {
        var result = (0, scripture_1.parseScriptureInput)('John 3:16');
        (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.book).toBe('John');
    });
    (0, vitest_1.it)('"1 john 4:8" resolves to "1 John" (case-insensitive)', function () {
        var result = (0, scripture_1.parseScriptureInput)('1 john 4:8');
        (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.book).toBe('1 John');
    });
    (0, vitest_1.it)('case-insensitive exact match: "psalms 23" resolves to Psalms', function () {
        var result = (0, scripture_1.parseScriptureInput)('psalms 23');
        (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.book).toBe('Psalms');
    });
    (0, vitest_1.it)('returns null for ambiguous prefix with multiple matches (no exact match)', function () {
        // 'Samuel' is ambiguous: matches '1 Samuel' and '2 Samuel' by prefix, no exact match
        (0, vitest_1.expect)((0, scripture_1.parseScriptureInput)('Samuel 1:1')).toBeNull();
    });
    (0, vitest_1.it)('returns the canonical book casing', function () {
        var result = (0, scripture_1.parseScriptureInput)('isaiah 53:1');
        (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.book).toBe('Isaiah');
    });
});
