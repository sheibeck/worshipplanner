"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var slotTypes_1 = require("@/utils/slotTypes");
(0, vitest_1.describe)('PROGRESSION_SLOT_TYPES', function () {
    (0, vitest_1.it)('maps 1-2-2-3 progression correctly', function () {
        var types = slotTypes_1.PROGRESSION_SLOT_TYPES['1-2-2-3'];
        (0, vitest_1.expect)(types[0]).toBe(1);
        (0, vitest_1.expect)(types[2]).toBe(2);
        (0, vitest_1.expect)(types[5]).toBe(2);
        (0, vitest_1.expect)(types[6]).toBe(3);
        (0, vitest_1.expect)(types[8]).toBe(3);
    });
    (0, vitest_1.it)('maps 1-2-3-3 progression correctly', function () {
        var types = slotTypes_1.PROGRESSION_SLOT_TYPES['1-2-3-3'];
        (0, vitest_1.expect)(types[0]).toBe(1);
        (0, vitest_1.expect)(types[2]).toBe(2);
        (0, vitest_1.expect)(types[5]).toBe(3);
        (0, vitest_1.expect)(types[6]).toBe(3);
        (0, vitest_1.expect)(types[8]).toBe(3);
    });
});
(0, vitest_1.describe)('buildSlots', function () {
    (0, vitest_1.it)('returns exactly 9 slots for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        (0, vitest_1.expect)(slots).toHaveLength(9);
    });
    (0, vitest_1.it)('returns exactly 9 slots for 1-2-3-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-3-3');
        (0, vitest_1.expect)(slots).toHaveLength(9);
    });
    (0, vitest_1.it)('position 0 is SongSlot with requiredVwType 1 for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[0];
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.position).toBe(0);
        (0, vitest_1.expect)(slot.requiredVwType).toBe(1);
        (0, vitest_1.expect)(slot.songId).toBeNull();
        (0, vitest_1.expect)(slot.songTitle).toBeNull();
        (0, vitest_1.expect)(slot.songKey).toBeNull();
    });
    (0, vitest_1.it)('position 1 is ScriptureSlot for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[1];
        (0, vitest_1.expect)(slot.kind).toBe('SCRIPTURE');
        (0, vitest_1.expect)(slot.position).toBe(1);
        (0, vitest_1.expect)(slot.book).toBeNull();
        (0, vitest_1.expect)(slot.chapter).toBeNull();
        (0, vitest_1.expect)(slot.verseStart).toBeNull();
        (0, vitest_1.expect)(slot.verseEnd).toBeNull();
    });
    (0, vitest_1.it)('position 2 is SongSlot with requiredVwType 2 for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[2];
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.position).toBe(2);
        (0, vitest_1.expect)(slot.requiredVwType).toBe(2);
    });
    (0, vitest_1.it)('position 3 is Prayer NonAssignableSlot for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[3];
        (0, vitest_1.expect)(slot.kind).toBe('PRAYER');
        (0, vitest_1.expect)(slot.position).toBe(3);
    });
    (0, vitest_1.it)('position 4 is ScriptureSlot for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[4];
        (0, vitest_1.expect)(slot.kind).toBe('SCRIPTURE');
        (0, vitest_1.expect)(slot.position).toBe(4);
    });
    (0, vitest_1.it)('position 5 is SongSlot with requiredVwType 2 for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[5];
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.position).toBe(5);
        (0, vitest_1.expect)(slot.requiredVwType).toBe(2);
    });
    (0, vitest_1.it)('position 6 is SongSlot with requiredVwType 3 for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[6];
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.position).toBe(6);
        (0, vitest_1.expect)(slot.requiredVwType).toBe(3);
    });
    (0, vitest_1.it)('position 7 is Message NonAssignableSlot for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[7];
        (0, vitest_1.expect)(slot.kind).toBe('MESSAGE');
        (0, vitest_1.expect)(slot.position).toBe(7);
    });
    (0, vitest_1.it)('position 8 is SongSlot with requiredVwType 3 for 1-2-2-3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
        var slot = slots[8];
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.position).toBe(8);
        (0, vitest_1.expect)(slot.requiredVwType).toBe(3);
    });
    (0, vitest_1.it)('1-2-3-3 progression: song positions get types 1,2,3,3,3', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-3-3');
        (0, vitest_1.expect)(slots[0].requiredVwType).toBe(1);
        (0, vitest_1.expect)(slots[2].requiredVwType).toBe(2);
        (0, vitest_1.expect)(slots[5].requiredVwType).toBe(3);
        (0, vitest_1.expect)(slots[6].requiredVwType).toBe(3);
        (0, vitest_1.expect)(slots[8].requiredVwType).toBe(3);
    });
    (0, vitest_1.it)('all SongSlots initialize with null fields', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-3-3');
        var songSlots = slots.filter(function (s) { return s.kind === 'SONG'; });
        for (var _i = 0, songSlots_1 = songSlots; _i < songSlots_1.length; _i++) {
            var slot = songSlots_1[_i];
            (0, vitest_1.expect)(slot.songId).toBeNull();
            (0, vitest_1.expect)(slot.songTitle).toBeNull();
            (0, vitest_1.expect)(slot.songKey).toBeNull();
        }
    });
    (0, vitest_1.it)('all ScriptureSlots initialize with null fields', function () {
        var slots = (0, slotTypes_1.buildSlots)('1-2-3-3');
        var scriptureSlots = slots.filter(function (s) { return s.kind === 'SCRIPTURE'; });
        for (var _i = 0, scriptureSlots_1 = scriptureSlots; _i < scriptureSlots_1.length; _i++) {
            var slot = scriptureSlots_1[_i];
            (0, vitest_1.expect)(slot.book).toBeNull();
            (0, vitest_1.expect)(slot.chapter).toBeNull();
            (0, vitest_1.expect)(slot.verseStart).toBeNull();
            (0, vitest_1.expect)(slot.verseEnd).toBeNull();
        }
    });
});
(0, vitest_1.describe)('createSlot', function () {
    (0, vitest_1.it)('creates a SONG slot with default vwType 2', function () {
        var slot = (0, slotTypes_1.createSlot)('SONG');
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.requiredVwType).toBe(2);
        (0, vitest_1.expect)(slot.position).toBe(0);
        (0, vitest_1.expect)(slot.songId).toBeNull();
        (0, vitest_1.expect)(slot.songTitle).toBeNull();
        (0, vitest_1.expect)(slot.songKey).toBeNull();
    });
    (0, vitest_1.it)('creates a SONG slot with specified vwType 1', function () {
        var slot = (0, slotTypes_1.createSlot)('SONG', 1);
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.requiredVwType).toBe(1);
    });
    (0, vitest_1.it)('creates a SONG slot with specified vwType 3', function () {
        var slot = (0, slotTypes_1.createSlot)('SONG', 3);
        (0, vitest_1.expect)(slot.kind).toBe('SONG');
        (0, vitest_1.expect)(slot.requiredVwType).toBe(3);
    });
    (0, vitest_1.it)('creates a SCRIPTURE slot with null fields', function () {
        var slot = (0, slotTypes_1.createSlot)('SCRIPTURE');
        (0, vitest_1.expect)(slot.kind).toBe('SCRIPTURE');
        (0, vitest_1.expect)(slot.position).toBe(0);
        (0, vitest_1.expect)(slot.book).toBeNull();
        (0, vitest_1.expect)(slot.chapter).toBeNull();
        (0, vitest_1.expect)(slot.verseStart).toBeNull();
        (0, vitest_1.expect)(slot.verseEnd).toBeNull();
    });
    (0, vitest_1.it)('creates a PRAYER slot', function () {
        var slot = (0, slotTypes_1.createSlot)('PRAYER');
        (0, vitest_1.expect)(slot.kind).toBe('PRAYER');
        (0, vitest_1.expect)(slot.position).toBe(0);
    });
    (0, vitest_1.it)('creates a MESSAGE slot', function () {
        var slot = (0, slotTypes_1.createSlot)('MESSAGE');
        (0, vitest_1.expect)(slot.kind).toBe('MESSAGE');
        (0, vitest_1.expect)(slot.position).toBe(0);
    });
});
(0, vitest_1.describe)('reindexSlots', function () {
    (0, vitest_1.it)('normalizes positions to match array index', function () {
        var slots = [
            { kind: 'SONG', position: 5, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
            { kind: 'PRAYER', position: 2 },
            { kind: 'MESSAGE', position: 8 },
        ];
        var reindexed = (0, slotTypes_1.reindexSlots)(slots);
        (0, vitest_1.expect)(reindexed[0].position).toBe(0);
        (0, vitest_1.expect)(reindexed[1].position).toBe(1);
        (0, vitest_1.expect)(reindexed[2].position).toBe(2);
    });
    (0, vitest_1.it)('preserves slot data when reindexing', function () {
        var slots = [
            { kind: 'SONG', position: 99, requiredVwType: 2, songId: 'abc', songTitle: 'Test', songKey: 'G' },
        ];
        var reindexed = (0, slotTypes_1.reindexSlots)(slots);
        var slot = reindexed[0];
        (0, vitest_1.expect)(slot.position).toBe(0);
        (0, vitest_1.expect)(slot.songId).toBe('abc');
        (0, vitest_1.expect)(slot.songTitle).toBe('Test');
        (0, vitest_1.expect)(slot.songKey).toBe('G');
    });
    (0, vitest_1.it)('returns a new array (does not mutate original)', function () {
        var slots = [{ kind: 'PRAYER', position: 5 }];
        var reindexed = (0, slotTypes_1.reindexSlots)(slots);
        (0, vitest_1.expect)(reindexed).not.toBe(slots);
        (0, vitest_1.expect)(slots[0].position).toBe(5); // original unchanged
    });
});
(0, vitest_1.describe)('slotLabel', function () {
    (0, vitest_1.it)('returns "Song" for a SONG slot', function () {
        var slot = { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null };
        (0, vitest_1.expect)((0, slotTypes_1.slotLabel)(slot, 0)).toBe('Song');
    });
    (0, vitest_1.it)('returns "Scripture Reading" for a SCRIPTURE slot', function () {
        var slot = { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null };
        (0, vitest_1.expect)((0, slotTypes_1.slotLabel)(slot, 1)).toBe('Scripture Reading');
    });
    (0, vitest_1.it)('returns "Prayer" for a PRAYER slot', function () {
        var slot = { kind: 'PRAYER', position: 3 };
        (0, vitest_1.expect)((0, slotTypes_1.slotLabel)(slot, 3)).toBe('Prayer');
    });
    (0, vitest_1.it)('returns "Message" for a MESSAGE slot', function () {
        var slot = { kind: 'MESSAGE', position: 7 };
        (0, vitest_1.expect)((0, slotTypes_1.slotLabel)(slot, 7)).toBe('Message');
    });
    (0, vitest_1.it)('returns "Hymn" for a HYMN slot', function () {
        var slot = { kind: 'HYMN', position: 4, hymnName: '', hymnNumber: '', verses: '' };
        (0, vitest_1.expect)((0, slotTypes_1.slotLabel)(slot, 4)).toBe('Hymn');
    });
});
(0, vitest_1.describe)('createSlot - HYMN', function () {
    (0, vitest_1.it)('creates a HYMN slot with empty string fields', function () {
        var slot = (0, slotTypes_1.createSlot)('HYMN');
        (0, vitest_1.expect)(slot.kind).toBe('HYMN');
        (0, vitest_1.expect)(slot.position).toBe(0);
        (0, vitest_1.expect)(slot.hymnName).toBe('');
        (0, vitest_1.expect)(slot.hymnNumber).toBe('');
        (0, vitest_1.expect)(slot.verses).toBe('');
    });
});
