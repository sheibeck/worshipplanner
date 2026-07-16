"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIBLE_BOOKS = void 0;
exports.esvLink = esvLink;
exports.parseScriptureInput = parseScriptureInput;
exports.scripturesOverlap = scripturesOverlap;
exports.BIBLE_BOOKS = [
    // Old Testament (39 books)
    'Genesis',
    'Exodus',
    'Leviticus',
    'Numbers',
    'Deuteronomy',
    'Joshua',
    'Judges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Kings',
    '2 Kings',
    '1 Chronicles',
    '2 Chronicles',
    'Ezra',
    'Nehemiah',
    'Esther',
    'Job',
    'Psalms',
    'Proverbs',
    'Ecclesiastes',
    'Song of Solomon',
    'Isaiah',
    'Jeremiah',
    'Lamentations',
    'Ezekiel',
    'Daniel',
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
    // New Testament (27 books)
    'Matthew',
    'Mark',
    'Luke',
    'John',
    'Acts',
    'Romans',
    '1 Corinthians',
    '2 Corinthians',
    'Galatians',
    'Ephesians',
    'Philippians',
    'Colossians',
    '1 Thessalonians',
    '2 Thessalonians',
    '1 Timothy',
    '2 Timothy',
    'Titus',
    'Philemon',
    'Hebrews',
    'James',
    '1 Peter',
    '2 Peter',
    '1 John',
    '2 John',
    '3 John',
    'Jude',
    'Revelation',
];
function esvLink(book, chapter) {
    var bookSlug = book.replace(/\s+/g, '+');
    return "https://www.esv.org/".concat(bookSlug, "+").concat(chapter);
}
function parseScriptureInput(text) {
    var trimmed = text.trim();
    if (!trimmed)
        return null;
    // Match: "<book text> <chapter>[:<verse expression>]"
    var match = trimmed.match(/^(.+?)\s+(\d+)(?::(.+))?$/);
    if (!match)
        return null;
    var bookToken = match[1], chapterToken = match[2], verseExpr = match[3];
    // Resolve book name
    var inputLower = bookToken.trim().toLowerCase();
    var resolvedBook = null;
    // Exact match (case-insensitive) wins
    var exactMatch = exports.BIBLE_BOOKS.find(function (b) { return b.toLowerCase() === inputLower; });
    if (exactMatch) {
        resolvedBook = exactMatch;
    }
    else {
        // Prefix match: canonical name starts with the input token.
        // Require at least 4 characters to prevent short ambiguous tokens (e.g. "joh").
        if (inputLower.length < 4)
            return null;
        var prefixMatches = exports.BIBLE_BOOKS.filter(function (b) {
            return b.toLowerCase().startsWith(inputLower);
        });
        if (prefixMatches.length === 1) {
            resolvedBook = prefixMatches[0];
        }
        else {
            return null; // ambiguous or no match
        }
    }
    // Parse chapter
    var chapter = parseInt(chapterToken, 10);
    if (isNaN(chapter) || chapter <= 0)
        return null;
    // Parse verse expression (optional)
    var verseStart;
    var verseEnd;
    if (verseExpr !== undefined) {
        var verseStr = verseExpr.trim();
        // Collect all numbers from potentially multi-range expressions like "1-10,15-20"
        var numberMatches = verseStr.match(/\d+/g);
        if (!numberMatches || numberMatches.length === 0)
            return null;
        var numbers = numberMatches.map(function (n) { return parseInt(n, 10); });
        if (numbers.some(isNaN))
            return null;
        if (numbers.length === 1) {
            // Single verse: "28"
            verseStart = numbers[0];
        }
        else {
            // Range or multi-range: verseStart = min, verseEnd = max
            verseStart = Math.min.apply(Math, numbers);
            verseEnd = Math.max.apply(Math, numbers);
        }
    }
    var result = { book: resolvedBook, chapter: chapter };
    if (verseStart !== undefined)
        result.verseStart = verseStart;
    if (verseEnd !== undefined)
        result.verseEnd = verseEnd;
    return result;
}
function scripturesOverlap(reading, sermon) {
    if (reading.book !== sermon.book || reading.chapter !== sermon.chapter)
        return false;
    if (!reading.verseStart || !reading.verseEnd || !sermon.verseStart || !sermon.verseEnd)
        return true;
    return reading.verseStart <= sermon.verseEnd && reading.verseEnd >= sermon.verseStart;
}
