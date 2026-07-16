"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.songMatchesQuery = songMatchesQuery;
exports.getPrimaryArrangement = getPrimaryArrangement;
exports.getPrimaryKey = getPrimaryKey;
var song_1 = require("@/types/song");
/**
 * Case-insensitive substring match against a song's full searchable text field
 * set: title, CCLI number, author, themes, VW category (both the number, e.g.
 * "1", and its label, e.g. "call to worship"), user tags (which include folded
 * team names, D-01), notes, and arrangement key (exact).
 */
function matchesBareTerm(song, term) {
    var _a, _b, _c;
    var q = term.toLowerCase();
    if (!q)
        return true;
    if (song.title.toLowerCase().includes(q))
        return true;
    if (String(song.ccliNumber).includes(q))
        return true;
    if ((_a = song.author) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q))
        return true;
    if (song.themes.some(function (t) { return t.toLowerCase().includes(q); }))
        return true;
    if (song.vwTypes.some(function (vw) { return String(vw) === q || song_1.VW_TYPE_LABELS[vw].toLowerCase().includes(q); })) {
        return true;
    }
    if ((_b = song.tags) === null || _b === void 0 ? void 0 : _b.some(function (t) { return t.toLowerCase().includes(q); }))
        return true;
    if ((_c = song.notes) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(q))
        return true;
    if (song.arrangements.some(function (a) { return a.key.toLowerCase() === q; }))
        return true;
    return false;
}
var FIELD_PREFIX_RE = /^(type|key|tag|theme|team):(.*)$/i;
/** Dispatches a single field-scoped or bare token against the song. */
function matchesToken(song, token, vwModeEnabled) {
    var _a, _b;
    var prefixMatch = FIELD_PREFIX_RE.exec(token);
    if (prefixMatch) {
        var field = prefixMatch[1].toLowerCase();
        var value_1 = prefixMatch[2].trim();
        if (!value_1)
            return true;
        var lowerValue_1 = value_1.toLowerCase();
        switch (field) {
            case 'type':
                // D-16: the type: prefix is hidden app-wide when VW mode is off — no match at all.
                if (!vwModeEnabled)
                    return false;
                return song.vwTypes.some(function (vw) { return String(vw) === value_1 || song_1.VW_TYPE_LABELS[vw].toLowerCase().includes(lowerValue_1); });
            case 'key':
                return song.arrangements.some(function (a) { return a.key.toLowerCase() === lowerValue_1; });
            case 'tag':
                return ((_a = song.tags) !== null && _a !== void 0 ? _a : []).some(function (t) { return t.toLowerCase().includes(lowerValue_1); });
            case 'theme':
                return song.themes.some(function (t) { return t.toLowerCase().includes(lowerValue_1); });
            case 'team':
                // D-06: team: is aliased to a plain tag match — team names are folded into tags (D-01).
                return ((_b = song.tags) !== null && _b !== void 0 ? _b : []).some(function (t) { return t.toLowerCase().includes(lowerValue_1); });
            default:
                return matchesBareTerm(song, token);
        }
    }
    return matchesBareTerm(song, token);
}
// Recognized field-scoped prefix keywords, used both to detect a prefix
// token and as a boundary when greedily capturing a multi-word field value.
var FIELD_KEYWORDS = 'type|key|tag|theme|team';
// Captures "prefix:value", where value greedily consumes all words up to the
// next recognized "prefix:" keyword or end of string — so multi-word values
// (e.g. `tag:christmas eve`) are captured as a single field-scoped span
// instead of being split into a field token plus a stray bare term.
// Bounded, anchored regex on short user-typed query text only — no nested
// quantifiers, no ReDoS risk.
var FIELD_SPAN_RE = new RegExp("\\b(".concat(FIELD_KEYWORDS, "):\\s*([\\s\\S]*?)(?=\\s+\\b(?:").concat(FIELD_KEYWORDS, "):|$)"), 'gi');
/**
 * Multi-term AND search over a song's metadata. Supports field-scoped
 * prefixes (`type:`, `key:`, `tag:`, `theme:`, `team:`, with optional space
 * after the colon) whose value may contain multiple words (e.g.
 * `tag:christmas eve`), natural two-word phrases (`Type 1`, `Key A`), and the
 * original bare full-field substring match for any remaining text. Every
 * extracted term (field-scoped span or bare word) must match (AND).
 * `team:` is aliased to a plain tag match (D-06). `vwModeEnabled` (default
 * `true`) gates the `type:` prefix — when `false`, `type:` matches nothing,
 * hiding VW-type search app-wide when VW mode is off (D-16). Only the `type:`
 * prefix is gated; all other prefixes and bare terms are unaffected.
 */
function songMatchesQuery(song, query, vwModeEnabled) {
    var _a;
    if (vwModeEnabled === void 0) { vwModeEnabled = true; }
    var trimmed = query.trim();
    if (!trimmed)
        return true;
    // Phrase pre-parse (D-05): normalize "Type N" / "Key X" into prefix form.
    // Bounded, anchored regexes on short user-typed query text only — no
    // nested quantifiers, no ReDoS risk.
    var phraseNormalized = trimmed
        .replace(/\btype\s+([1-3])\b/gi, 'type:$1')
        .replace(/\bkey\s+([a-g](?:#|b)?m?)\b/gi, 'key:$1');
    // Extract all field-scoped spans first (each may contain multiple words),
    // then treat whatever text remains (with those spans removed) as bare
    // whitespace-separated terms.
    var fieldTerms = [];
    var remainder = phraseNormalized;
    FIELD_SPAN_RE.lastIndex = 0;
    var match;
    while ((match = FIELD_SPAN_RE.exec(phraseNormalized)) !== null) {
        var field = match[1].toLowerCase();
        var value = ((_a = match[2]) !== null && _a !== void 0 ? _a : '').trim();
        fieldTerms.push("".concat(field, ":").concat(value));
        remainder = remainder.replace(match[0], ' ');
    }
    var bareTerms = remainder
        .trim()
        .split(/\s+/)
        .filter(function (t) { return t.length > 0; });
    var terms = __spreadArray(__spreadArray([], fieldTerms, true), bareTerms, true);
    if (terms.length === 0)
        return true;
    return terms.every(function (tok) { return matchesToken(song, tok, vwModeEnabled); });
}
/**
 * The arrangement designated as the song's "play key" for transitions.
 * Falls back to the first arrangement when no primary is set (legacy songs).
 */
function getPrimaryArrangement(song) {
    if (song.primaryArrangementId) {
        var found = song.arrangements.find(function (a) { return a.id === song.primaryArrangementId; });
        if (found)
            return found;
    }
    return song.arrangements[0];
}
/** The song's primary key string (empty string when none). */
function getPrimaryKey(song) {
    var _a, _b;
    return (_b = (_a = getPrimaryArrangement(song)) === null || _a === void 0 ? void 0 : _a.key) !== null && _b !== void 0 ? _b : '';
}
