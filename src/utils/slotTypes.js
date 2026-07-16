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
exports.PROGRESSION_SLOT_TYPES = void 0;
exports.slotLabel = slotLabel;
exports.createSlot = createSlot;
exports.reindexSlots = reindexSlots;
exports.buildSlots = buildSlots;
exports.PROGRESSION_SLOT_TYPES = {
    '1-2-2-3': {
        0: 1, // Song 1 — Call to Worship
        2: 2, // Song 2 — Intimate
        5: 2, // Song 3 — Intimate
        6: 3, // Song 4 — Ascription
        8: 3, // Sending Song — Ascription
    },
    '1-2-3-3': {
        0: 1, // Song 1 — Call to Worship
        2: 2, // Song 2 — Intimate
        5: 3, // Song 3 — Ascription
        6: 3, // Song 4 — Ascription
        8: 3, // Sending Song — Ascription
    },
};
/**
 * Returns a human-readable label for a slot based on its kind.
 * Replaces the old SLOT_LABELS position-keyed map.
 */
function slotLabel(slot, _index) {
    switch (slot.kind) {
        case 'SONG':
            return 'Song';
        case 'SCRIPTURE':
            return 'Scripture Reading';
        case 'PRAYER':
            return 'Prayer';
        case 'MESSAGE':
            return 'Message';
        case 'HYMN':
            return 'Hymn';
    }
}
/**
 * Factory function to create a new slot of the given kind.
 * Position defaults to 0 — it will be set to the array index via reindexSlots.
 */
function createSlot(kind, vwType) {
    switch (kind) {
        case 'SONG':
            return {
                kind: 'SONG',
                position: 0,
                requiredVwType: vwType !== null && vwType !== void 0 ? vwType : 2,
                songId: null,
                songTitle: null,
                songKey: null,
            };
        case 'SCRIPTURE':
            return {
                kind: 'SCRIPTURE',
                position: 0,
                book: null,
                chapter: null,
                verseStart: null,
                verseEnd: null,
            };
        case 'PRAYER':
            return { kind: 'PRAYER', position: 0 };
        case 'MESSAGE':
            return { kind: 'MESSAGE', position: 0 };
        case 'HYMN':
            return { kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' };
    }
}
/**
 * Normalizes slot positions to match their array index.
 * Call this after any add, remove, or reorder operation.
 */
function reindexSlots(slots) {
    return slots.map(function (slot, index) { return (__assign(__assign({}, slot), { position: index })); });
}
function buildSlots(progression) {
    var songTypeMap = exports.PROGRESSION_SLOT_TYPES[progression];
    var songSlot = function (position) { return ({
        kind: 'SONG',
        position: position,
        requiredVwType: songTypeMap[position],
        songId: null,
        songTitle: null,
        songKey: null,
    }); };
    var scriptureSlot = function (position) { return ({
        kind: 'SCRIPTURE',
        position: position,
        book: null,
        chapter: null,
        verseStart: null,
        verseEnd: null,
    }); };
    var nonAssignableSlot = function (kind, position) { return ({
        kind: kind,
        position: position,
    }); };
    return [
        songSlot(0),
        scriptureSlot(1),
        songSlot(2),
        nonAssignableSlot('PRAYER', 3),
        scriptureSlot(4),
        songSlot(5),
        songSlot(6),
        nonAssignableSlot('MESSAGE', 7),
        songSlot(8),
    ];
}
