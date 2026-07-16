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
exports.parseArrangementTags = parseArrangementTags;
exports.parseArrangementFromRow = parseArrangementFromRow;
exports.mapRowToSong = mapRowToSong;
exports.detectDuplicates = detectDuplicates;
/**
 * Parse a comma-separated tag string into a trimmed array.
 * e.g. "Band, Strings, Acoustic" -> ["Band", "Strings", "Acoustic"]
 */
function parseArrangementTags(tagString) {
    if (!tagString || !tagString.trim())
        return [];
    return tagString
        .split(',')
        .map(function (t) { return t.trim(); })
        .filter(function (t) { return t.length > 0; });
}
/**
 * Parse an arrangement from a CSV row at the given 1-based index.
 * Returns null if the arrangement has no name (not present in this row).
 */
function parseArrangementFromRow(row, index) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
    var name = (_d = (_b = (_a = row["Arrangement ".concat(index, " Name")]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : (_c = row["Arrangement ".concat(index)]) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
    if (!name)
        return null;
    var bpmRaw = (_h = (_f = (_e = row["Arrangement ".concat(index, " BPM")]) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : (_g = row["Arrangement ".concat(index, " Tempo")]) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : '';
    var bpmNum = parseFloat(bpmRaw);
    var bpm = bpmRaw && !isNaN(bpmNum) ? bpmNum : null;
    var key = (_m = (_k = (_j = row["Arrangement ".concat(index, " Keys")]) === null || _j === void 0 ? void 0 : _j.trim()) !== null && _k !== void 0 ? _k : (_l = row["Arrangement ".concat(index, " Key")]) === null || _l === void 0 ? void 0 : _l.trim()) !== null && _m !== void 0 ? _m : '';
    var lengthRaw = (_r = (_p = (_o = row["Arrangement ".concat(index, " Length")]) === null || _o === void 0 ? void 0 : _o.trim()) !== null && _p !== void 0 ? _p : (_q = row["Arrangement ".concat(index, " Length (Seconds)")]) === null || _q === void 0 ? void 0 : _q.trim()) !== null && _r !== void 0 ? _r : '';
    var lengthNum = parseFloat(lengthRaw);
    var lengthSeconds = lengthRaw && !isNaN(lengthNum) ? lengthNum : null;
    var tagsRaw = (_v = (_t = (_s = row["Arrangement ".concat(index, " Tags")]) === null || _s === void 0 ? void 0 : _s.trim()) !== null && _t !== void 0 ? _t : (_u = row["Arrangement ".concat(index, " Tag")]) === null || _u === void 0 ? void 0 : _u.trim()) !== null && _v !== void 0 ? _v : '';
    var teamTags = parseArrangementTags(tagsRaw);
    var chordChartUrl = (_z = (_x = (_w = row["Arrangement ".concat(index, " Chord Chart")]) === null || _w === void 0 ? void 0 : _w.trim()) !== null && _x !== void 0 ? _x : (_y = row["Arrangement ".concat(index, " Chord Chart URL")]) === null || _y === void 0 ? void 0 : _y.trim()) !== null && _z !== void 0 ? _z : '';
    var notes = (_1 = (_0 = row["Arrangement ".concat(index, " Notes")]) === null || _0 === void 0 ? void 0 : _0.trim()) !== null && _1 !== void 0 ? _1 : '';
    return {
        id: crypto.randomUUID(),
        name: name,
        key: key,
        bpm: bpm,
        lengthSeconds: lengthSeconds,
        chordChartUrl: chordChartUrl,
        notes: notes,
        teamTags: teamTags,
    };
}
/**
 * Map a single CSV row to a ParsedSongPreview.
 * Handles multiple Planning Center CSV column header variants defensively.
 */
function mapRowToSong(row) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    var warnings = [];
    // Title: try multiple header variants
    var title = (_d = (_b = (_a = row['Title']) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : (_c = row['Song Title']) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
    if (!title) {
        warnings.push('Missing title');
    }
    // CCLI Number: try multiple header variants
    var ccliNumber = (_k = (_h = (_f = (_e = row['CCLI Number']) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : (_g = row['CCLI']) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : (_j = row['CCLI #']) === null || _j === void 0 ? void 0 : _j.trim()) !== null && _k !== void 0 ? _k : '';
    // Author: try Author then Copyright
    var author = (_p = (_m = (_l = row['Author']) === null || _l === void 0 ? void 0 : _l.trim()) !== null && _m !== void 0 ? _m : (_o = row['Copyright']) === null || _o === void 0 ? void 0 : _o.trim()) !== null && _p !== void 0 ? _p : '';
    // Themes/Tags: split on comma
    var themesRaw = (_t = (_r = (_q = row['Themes']) === null || _q === void 0 ? void 0 : _q.trim()) !== null && _r !== void 0 ? _r : (_s = row['Tags']) === null || _s === void 0 ? void 0 : _s.trim()) !== null && _t !== void 0 ? _t : '';
    var themes = themesRaw
        ? themesRaw.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 0; })
        : [];
    // Notes
    var notes = (_v = (_u = row['Notes']) === null || _u === void 0 ? void 0 : _u.trim()) !== null && _v !== void 0 ? _v : '';
    // Parse up to 5 arrangements
    var arrangements = [];
    for (var i = 1; i <= 5; i++) {
        var arr = parseArrangementFromRow(row, i);
        if (arr)
            arrangements.push(arr);
    }
    return {
        title: title,
        ccliNumber: ccliNumber,
        author: author,
        themes: themes,
        notes: notes,
        vwTypes: [],
        tags: [], // D-01: CSV import never sets user tags
        arrangements: arrangements,
        primaryArrangementId: (_x = (_w = arrangements[0]) === null || _w === void 0 ? void 0 : _w.id) !== null && _x !== void 0 ? _x : null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        isDuplicate: false,
        _warnings: warnings,
    };
}
/**
 * Check parsed songs against existing songs to flag duplicates.
 * Match order:
 * 1. CCLI number match (when both parsed and existing have a non-empty CCLI)
 * 2. Case-insensitive title match (when parsed song has no CCLI)
 */
function detectDuplicates(parsed, existing) {
    return parsed.map(function (song) {
        var isDuplicate = false;
        if (song.ccliNumber) {
            // Match by CCLI number
            isDuplicate = existing.some(function (e) { return e.ccliNumber && e.ccliNumber === song.ccliNumber; });
        }
        else {
            // Fall back to case-insensitive title match
            var lowerTitle_1 = song.title.toLowerCase();
            isDuplicate = existing.some(function (e) { return e.title.toLowerCase() === lowerTitle_1; });
        }
        return __assign(__assign({}, song), { isDuplicate: isDuplicate });
    });
}
