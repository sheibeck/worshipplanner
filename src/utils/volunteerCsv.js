"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.frequencyLabelToN = frequencyLabelToN;
exports.expandBlackoutCell = expandBlackoutCell;
exports.parseVolunteerCsvRow = parseVolunteerCsvRow;
exports.matchNameToPerson = matchNameToPerson;
/**
 * Split a ';'-separated multi-value cell, trimming each part and dropping
 * empties (D-15). Mirrors the comma-split pattern in csvImport.ts but for ';'.
 */
function splitMultiValueCell(cell) {
    if (!cell || !cell.trim())
        return [];
    return cell
        .split(';')
        .map(function (v) { return v.trim(); })
        .filter(function (v) { return v.length > 0; });
}
/**
 * Map a friendly frequency label (or bare integer, or "1-in-N" string) to a
 * 1-in-N integer. Unknown labels default to 4 (~monthly).
 */
function frequencyLabelToN(label) {
    var normalized = label.trim().toLowerCase();
    if (normalized === 'weekly')
        return 1;
    if (normalized === 'twice a month')
        return 2;
    if (normalized === 'once a month')
        return 4;
    var bareInt = Number(normalized);
    if (normalized !== '' && Number.isInteger(bareInt) && bareInt > 0) {
        return bareInt;
    }
    // WR-03: mirror the bareInt branch's `> 0` guard — "1-in-0" (and any other non-positive N)
    // must fall through to the same default-4 path as an invalid bare integer, never accepted
    // as a literal 0 (which would produce an Infinity deficit score in scheduler.ts).
    var oneInNMatch = normalized.match(/^1-in-(\d+)$/);
    if (oneInNMatch) {
        var n = Number(oneInNMatch[1]);
        if (n > 0)
            return n;
    }
    return 4;
}
/**
 * Expand a blackout cell against the quarter's generated Sundays (D-17).
 * Iterates only the finite serviceDates list (never a raw day-by-day walk),
 * so malformed or enormous ranges cannot blow up memory (T-13-03-01).
 * Dates outside serviceDates are silently ignored (no matching Sunday) —
 * surfaced as a per-row import warning by the caller, not a hard failure here.
 */
function expandBlackoutCell(cell, serviceDates) {
    var parts = cell
        .split(';')
        .map(function (p) { return p.trim(); })
        .filter(Boolean);
    var result = new Set();
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        if (part.includes('..')) {
            var _a = part.split('..').map(function (s) { return s.trim(); }), start = _a[0], end = _a[1];
            if (!start || !end)
                continue;
            for (var _b = 0, serviceDates_1 = serviceDates; _b < serviceDates_1.length; _b++) {
                var date = serviceDates_1[_b];
                if (date >= start && date <= end)
                    result.add(date);
            }
        }
        else if (serviceDates.includes(part)) {
            result.add(part);
        }
    }
    return Array.from(result).sort();
}
/**
 * Parse a single quarterly volunteer CSV row into a ParsedVolunteerRow.
 * Mirrors mapRowToSong's defensive-header + warnings-array pattern, but
 * splits multi-value cells on ';' (D-15) rather than ','.
 */
function parseVolunteerCsvRow(row) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var warnings = [];
    var name = (_b = (_a = row['Name']) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
    if (!name) {
        warnings.push('Missing name');
    }
    var rolesRaw = splitMultiValueCell((_d = (_c = row['Roles']) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '');
    var frequencyRaw = (_f = (_e = row['Frequency']) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : '';
    var frequencyN = frequencyLabelToN(frequencyRaw);
    // WR-03: a "1-in-N" cell only counts as a known/recognized label when N is actually a
    // positive integer — "1-in-0" must surface the same unrecognized/defaulted warning as an
    // invalid bare integer, not be silently accepted as N=0.
    var oneInNMatch = frequencyRaw.trim().match(/^1-in-(\d+)$/i);
    var oneInNIsValid = oneInNMatch !== null && Number(oneInNMatch[1]) > 0;
    var isKnownLabel = frequencyRaw.trim().toLowerCase() === 'weekly' ||
        frequencyRaw.trim().toLowerCase() === 'twice a month' ||
        frequencyRaw.trim().toLowerCase() === 'once a month' ||
        /^\d+$/.test(frequencyRaw.trim()) ||
        oneInNIsValid;
    if (frequencyRaw !== '' && !isKnownLabel) {
        warnings.push("Frequency unrecognized \u2014 defaulted to N=".concat(frequencyN));
    }
    var blackoutCellRaw = (_h = (_g = row['Blackout Dates']) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : '';
    var serveWithRaw = splitMultiValueCell((_k = (_j = row['Serve-With']) === null || _j === void 0 ? void 0 : _j.trim()) !== null && _k !== void 0 ? _k : '');
    return {
        name: name,
        rolesRaw: rolesRaw,
        frequencyN: frequencyN,
        blackoutCellRaw: blackoutCellRaw,
        serveWithRaw: serveWithRaw,
        warnings: warnings,
    };
}
/**
 * Normalize a name for comparison: trim, collapse internal whitespace,
 * lowercase. Used to match CSV names against roster people (D-16, Pitfall 4).
 */
function normalizeName(s) {
    return s.trim().replace(/\s+/g, ' ').toLowerCase();
}
/**
 * Match a CSV name to an existing roster person, normalizing both sides
 * (trim + collapse whitespace + lowercase) before comparing. Never
 * fuzzy-matches beyond that — any non-exact-after-normalization case is
 * surfaced as 'unmatched'/'ambiguous' for human resolution (D-16, T-13-03-02).
 */
function matchNameToPerson(name, roster) {
    var target = normalizeName(name);
    var matches = roster.filter(function (person) { return normalizeName(person.name) === target; });
    if (matches.length === 0) {
        return { status: 'unmatched', personId: null, candidates: [] };
    }
    if (matches.length === 1) {
        return { status: 'matched', personId: matches[0].id, candidates: [] };
    }
    return {
        status: 'ambiguous',
        personId: null,
        candidates: matches.map(function (p) { return p.id; }),
    };
}
