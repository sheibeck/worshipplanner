"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatScriptureRef = formatScriptureRef;
exports.formatForPlanningCenter = formatForPlanningCenter;
/**
 * Format a ScriptureRef as "Book Chapter:VerseStart-VerseEnd"
 */
function formatScriptureRef(ref) {
    if (ref.verseStart && ref.verseEnd) {
        return "".concat(ref.book, " ").concat(ref.chapter, ":").concat(ref.verseStart, "-").concat(ref.verseEnd);
    }
    return "".concat(ref.book, " ").concat(ref.chapter);
}
/**
 * Format a service date string ("YYYY-MM-DD") as "Month Day, Year"
 * e.g., "2026-03-08" => "March 8, 2026"
 */
function formatDate(dateStr) {
    var _a, _b, _c;
    var parts = dateStr.split('-').map(Number);
    var year = (_a = parts[0]) !== null && _a !== void 0 ? _a : 0;
    var month = (_b = parts[1]) !== null && _b !== void 0 ? _b : 1;
    var day = (_c = parts[2]) !== null && _c !== void 0 ? _c : 1;
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}
/**
 * Format a service as a plain-text block suitable for Planning Center manual entry.
 *
 * @param service - The service to format
 * @param songs - The full songs array (used for CCLI number lookup)
 * @returns A multi-line plain text string
 */
function formatForPlanningCenter(service, songs) {
    var songMap = new Map(songs.map(function (s) { return [s.id, s]; }));
    var lines = [];
    // Header
    lines.push("ORDER OF SERVICE -- ".concat(formatDate(service.date)));
    if (service.name) {
        lines.push(service.name);
    }
    lines.push("Teams: ".concat(service.teams.length > 0 ? service.teams.join(', ') : 'Standard Band'));
    lines.push("Progression: ".concat(service.progression));
    lines.push('');
    // Track song count for sequential labeling
    var songCount = 0;
    // Slots
    for (var _i = 0, _a = service.slots; _i < _a.length; _i++) {
        var slot = _a[_i];
        if (slot.kind === 'SONG') {
            songCount++;
            var label = "Song ".concat(songCount);
            if (!slot.songId) {
                lines.push("".concat(label, " -- [empty]"));
            }
            else {
                var song = songMap.get(slot.songId);
                if (!song) {
                    lines.push("".concat(label, " -- [empty]"));
                }
                else {
                    var keyPart = "Key: ".concat(slot.songKey);
                    var ccliPart = song.ccliNumber ? " | CCLI #".concat(song.ccliNumber) : '';
                    lines.push("".concat(label, " -- ").concat(song.title, " (").concat(keyPart).concat(ccliPart, ")"));
                }
            }
        }
        else if (slot.kind === 'SCRIPTURE') {
            var label = 'Scripture';
            if (!slot.book) {
                lines.push("".concat(label, " -- [empty]"));
            }
            else {
                var verseRange = slot.verseStart && slot.verseEnd ? ":".concat(slot.verseStart, "-").concat(slot.verseEnd) : '';
                lines.push("".concat(label, " -- ").concat(slot.book, " ").concat(slot.chapter).concat(verseRange));
            }
        }
        else if (slot.kind === 'PRAYER') {
            lines.push('Prayer');
        }
        else if (slot.kind === 'MESSAGE') {
            if (service.sermonPassage) {
                lines.push("Message -- ".concat(formatScriptureRef(service.sermonPassage)));
            }
            else {
                lines.push('Message');
            }
        }
        else if (slot.kind === 'HYMN') {
            if (!slot.hymnName) {
                lines.push('Hymn -- [empty]');
            }
            else {
                var numPart = slot.hymnNumber ? " #".concat(slot.hymnNumber) : '';
                var versesPart = slot.verses ? " (vv. ".concat(slot.verses, ")") : '';
                lines.push("Hymn -- ".concat(slot.hymnName).concat(numPart).concat(versesPart));
            }
        }
    }
    // Notes
    if (service.notes) {
        lines.push('');
        lines.push('Notes:');
        lines.push(service.notes);
    }
    return lines.join('\n');
}
