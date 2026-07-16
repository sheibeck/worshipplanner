"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRotationTable = computeRotationTable;
/**
 * Computes a rotation table from an array of services.
 *
 * For each song that appears in at least one service, returns an entry with
 * the song's ID, title, and the ISO date strings of services where it appears.
 *
 * A song appearing in multiple slots within the same service is counted once
 * per service (not once per slot).
 *
 * Pure function — no Firestore reads, operates entirely on in-memory data.
 *
 * @param services - Array of service documents from the service store
 * @returns Array of RotationEntry sorted alphabetically by songTitle
 */
function computeRotationTable(services) {
    // Map from songId to { title, Set<date> }
    var songMap = new Map();
    for (var _i = 0, services_1 = services; _i < services_1.length; _i++) {
        var service = services_1[_i];
        for (var _a = 0, _b = service.slots; _a < _b.length; _a++) {
            var slot = _b[_a];
            if (slot.kind !== 'SONG')
                continue;
            var songId = slot.songId, songTitle = slot.songTitle;
            if (!songId || !songTitle)
                continue;
            var existing = songMap.get(songId);
            if (existing) {
                existing.dateSet.add(service.date);
            }
            else {
                songMap.set(songId, { songTitle: songTitle, dateSet: new Set([service.date]) });
            }
        }
    }
    var entries = [];
    for (var _c = 0, _d = songMap.entries(); _c < _d.length; _c++) {
        var _e = _d[_c], songId = _e[0], _f = _e[1], songTitle = _f.songTitle, dateSet = _f.dateSet;
        entries.push({
            songId: songId,
            songTitle: songTitle,
            dates: Array.from(dateSet),
        });
    }
    // Sort alphabetically by songTitle
    entries.sort(function (a, b) { return a.songTitle.localeCompare(b.songTitle); });
    return entries;
}
