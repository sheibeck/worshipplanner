"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
// Mock firebase/firestore Timestamp
vitest_1.vi.mock('firebase/firestore', function () { return ({
    Timestamp: {
        fromDate: function (d) { return ({
            seconds: Math.floor(d.getTime() / 1000),
            nanoseconds: 0,
        }); },
    },
}); });
// Mock fetchSongArrangements + fetchLastScheduledItem from planningCenterApi
vitest_1.vi.mock('@/utils/planningCenterApi', function () { return ({
    fetchSongArrangements: vitest_1.vi.fn(),
    fetchLastScheduledItem: vitest_1.vi.fn(),
}); });
var pcSongImport_1 = require("@/utils/pcSongImport");
var planningCenterApi_1 = require("@/utils/planningCenterApi");
// Helper to build a minimal PC song object
function makePcSong(overrides) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (overrides === void 0) { overrides = {}; }
    return {
        id: (_a = overrides.id) !== null && _a !== void 0 ? _a : 'pc-song-1',
        attributes: {
            title: (_b = overrides.title) !== null && _b !== void 0 ? _b : 'Amazing Grace',
            // Use explicit 'ccli_number' in overrides, fallback only when undefined (not when null)
            ccli_number: 'ccli_number' in overrides ? (_c = overrides.ccli_number) !== null && _c !== void 0 ? _c : null : '12345',
            author: (_d = overrides.author) !== null && _d !== void 0 ? _d : 'John Newton',
            last_scheduled_at: (_e = overrides.last_scheduled_at) !== null && _e !== void 0 ? _e : null,
            themes: (_f = overrides.themes) !== null && _f !== void 0 ? _f : '',
        },
        relationships: {
            tags: {
                data: ((_g = overrides.tagIds) !== null && _g !== void 0 ? _g : []).map(function (id) { return ({ type: 'Tag', id: id }); }),
            },
        },
    };
}
// Helper to build tag objects
function makeTag(id, name) {
    return { id: id, name: name };
}
// Helper to build arrangement objects
function makeArrangement(id, name, key) {
    if (key === void 0) { key = ''; }
    return { id: id, name: name, key: key };
}
(0, vitest_1.describe)('mapPcSongToUpsert', function () {
    (0, vitest_1.describe)('vwTypes mapping from category tags', function () {
        (0, vitest_1.it)('maps "Category 1" tag to vwTypes: [1]', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat1'] });
            var tags = [makeTag('tag-cat1', 'Category 1')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([1]);
        });
        (0, vitest_1.it)('maps "Category 2" tag to vwTypes: [2]', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat2'] });
            var tags = [makeTag('tag-cat2', 'Category 2')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([2]);
        });
        (0, vitest_1.it)('maps "Category 3" tag to vwTypes: [3]', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat3'] });
            var tags = [makeTag('tag-cat3', 'Category 3')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([3]);
        });
        (0, vitest_1.it)('sets vwTypes to [] when no category tag exists', function () {
            var pcSong = makePcSong({ tagIds: ['tag-ballad'] });
            var tags = [makeTag('tag-ballad', 'Ballad')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([]);
        });
        (0, vitest_1.it)('maps "category 1" (lowercase) to vwTypes: [1] (case-insensitive)', function () {
            var pcSong = makePcSong({ tagIds: ['tag-lower-cat1'] });
            var tags = [makeTag('tag-lower-cat1', 'category 1')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([1]);
        });
        (0, vitest_1.it)('maps Category 1 AND Category 2 tags to vwTypes: [1, 2]', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat1', 'tag-cat2'] });
            var tags = [makeTag('tag-cat1', 'Category 1'), makeTag('tag-cat2', 'Category 2')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([1, 2]);
        });
        (0, vitest_1.it)('maps Category 1 AND Category 3 tags to vwTypes: [1, 3]', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat1', 'tag-cat3'] });
            var tags = [makeTag('tag-cat1', 'Category 1'), makeTag('tag-cat3', 'Category 3')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([1, 3]);
        });
        (0, vitest_1.it)('maps all three category tags to vwTypes: [1, 2, 3]', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat1', 'tag-cat2', 'tag-cat3'] });
            var tags = [
                makeTag('tag-cat1', 'Category 1'),
                makeTag('tag-cat2', 'Category 2'),
                makeTag('tag-cat3', 'Category 3'),
            ];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.vwTypes).toEqual([1, 2, 3]);
        });
    });
    (0, vitest_1.describe)('Orchestra arrangement → tags (D-01: team-style tags write into tags, not teamTags)', function () {
        (0, vitest_1.it)('adds "Orchestra" to tags when an arrangement named "Orchestra" exists', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], [makeArrangement('arr-1', 'Orchestra')]);
            (0, vitest_1.expect)(result.tags).toContain('Orchestra');
        });
        (0, vitest_1.it)('adds "Orchestra" to tags when arrangement named "orchestra" (lowercase) exists', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], [makeArrangement('arr-1', 'orchestra')]);
            (0, vitest_1.expect)(result.tags).toContain('Orchestra');
        });
        (0, vitest_1.it)('does NOT add "Orchestra" when no arrangement has that name', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], [makeArrangement('arr-1', 'Standard')]);
            (0, vitest_1.expect)(result.tags).not.toContain('Orchestra');
        });
        (0, vitest_1.it)('does NOT add "Orchestra" when arrangements array is empty', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.tags).not.toContain('Orchestra');
        });
    });
    (0, vitest_1.describe)('lastUsedAt mapping', function () {
        (0, vitest_1.it)('maps last_scheduled_at ISO string to Firestore Timestamp', function () {
            var pcSong = makePcSong({ last_scheduled_at: '2026-01-15T00:00:00Z' });
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.lastUsedAt).not.toBeNull();
            // Check it has the Timestamp shape (seconds, nanoseconds)
            var ts = result.lastUsedAt;
            (0, vitest_1.expect)(typeof ts.seconds).toBe('number');
            (0, vitest_1.expect)(ts.nanoseconds).toBe(0);
            // Verify the timestamp corresponds to 2026-01-15
            (0, vitest_1.expect)(ts.seconds).toBe(Math.floor(new Date('2026-01-15T00:00:00Z').getTime() / 1000));
        });
        (0, vitest_1.it)('sets lastUsedAt to null when last_scheduled_at is null', function () {
            var pcSong = makePcSong({ last_scheduled_at: null });
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.lastUsedAt).toBeNull();
        });
    });
    (0, vitest_1.describe)('core field mapping', function () {
        (0, vitest_1.it)('sets pcSongId from PC song id attribute', function () {
            var pcSong = makePcSong({ id: 'pc-99' });
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.pcSongId).toBe('pc-99');
        });
        (0, vitest_1.it)('sets hidden to false', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.hidden).toBe(false);
        });
        (0, vitest_1.it)('sets notes to empty string', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.notes).toBe('');
        });
        (0, vitest_1.it)('maps ccliNumber from ccli_number attribute', function () {
            var pcSong = makePcSong({ ccli_number: '67890' });
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.ccliNumber).toBe('67890');
        });
        (0, vitest_1.it)('sets ccliNumber to empty string when ccli_number is null', function () {
            var pcSong = makePcSong({ ccli_number: null });
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.ccliNumber).toBe('');
        });
        (0, vitest_1.it)('sets removedThemes to [] (D-14) — Song.teamTags no longer exists (D-01)', function () {
            var pcSong = makePcSong({ tagIds: ['tag-ballad'] });
            var tags = [makeTag('tag-ballad', 'Ballad')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, [makeArrangement('arr-1', 'Orchestra')]);
            (0, vitest_1.expect)(result.removedThemes).toEqual([]);
        });
    });
    (0, vitest_1.describe)('non-category tags go into tags (D-01)', function () {
        (0, vitest_1.it)('puts non-category PC tags into tags', function () {
            var pcSong = makePcSong({ tagIds: ['tag-ballad'] });
            var tags = [makeTag('tag-ballad', 'Ballad')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.tags).toContain('Ballad');
        });
        (0, vitest_1.it)('does NOT put category tags into tags', function () {
            var pcSong = makePcSong({ tagIds: ['tag-cat1'] });
            var tags = [makeTag('tag-cat1', 'Category 1')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, []);
            (0, vitest_1.expect)(result.tags).not.toContain('Category 1');
            // Category tags still map to vwTypes, not tags
            (0, vitest_1.expect)(result.vwTypes).toEqual([1]);
        });
        (0, vitest_1.it)('combines non-category tags with Orchestra when both present', function () {
            var pcSong = makePcSong({ tagIds: ['tag-ballad'] });
            var tags = [makeTag('tag-ballad', 'Ballad')];
            var arrangements = [makeArrangement('arr-1', 'Orchestra')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, tags, arrangements);
            (0, vitest_1.expect)(result.tags).toContain('Ballad');
            (0, vitest_1.expect)(result.tags).toContain('Orchestra');
        });
    });
    (0, vitest_1.describe)('primaryArrangementId', function () {
        (0, vitest_1.it)('defaults to the first arrangement when no last-scheduled id is given', function () {
            var pcSong = makePcSong();
            var arrangements = [makeArrangement('arr-1', 'Standard'), makeArrangement('arr-2', 'Orchestra')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], arrangements);
            (0, vitest_1.expect)(result.primaryArrangementId).toBe('arr-1');
        });
        (0, vitest_1.it)('uses the last-scheduled arrangement id when it exists among arrangements', function () {
            var pcSong = makePcSong();
            var arrangements = [makeArrangement('arr-1', 'Standard'), makeArrangement('arr-2', 'Orchestra')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], arrangements, 'arr-2');
            (0, vitest_1.expect)(result.primaryArrangementId).toBe('arr-2');
        });
        (0, vitest_1.it)('falls back to first arrangement when last-scheduled id is not among arrangements', function () {
            var pcSong = makePcSong();
            var arrangements = [makeArrangement('arr-1', 'Standard')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], arrangements, 'arr-unknown');
            (0, vitest_1.expect)(result.primaryArrangementId).toBe('arr-1');
        });
        (0, vitest_1.it)('is null when there are no arrangements', function () {
            var pcSong = makePcSong();
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], []);
            (0, vitest_1.expect)(result.primaryArrangementId).toBeNull();
        });
    });
    (0, vitest_1.describe)('arrangements mapping', function () {
        (0, vitest_1.it)('maps input arrangements to Arrangement shape with defaults', function () {
            var pcSong = makePcSong();
            var arrangements = [makeArrangement('arr-1', 'Standard')];
            var result = (0, pcSongImport_1.mapPcSongToUpsert)(pcSong, [], arrangements);
            (0, vitest_1.expect)(result.arrangements).toHaveLength(1);
            var arr = result.arrangements[0];
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.id).toBe('arr-1');
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.name).toBe('Standard');
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.key).toBe('');
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.bpm).toBeNull();
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.lengthSeconds).toBeNull();
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.chordChartUrl).toBe('');
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.notes).toBe('');
            (0, vitest_1.expect)(arr === null || arr === void 0 ? void 0 : arr.teamTags).toEqual([]);
        });
    });
});
(0, vitest_1.describe)('fetchAllPcSongs', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('follows links.next to fetch all pages', function () { return __awaiter(void 0, void 0, void 0, function () {
        var page1Response, page2Response, mockFetch, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    page1Response = {
                        data: [
                            {
                                id: 'song-1',
                                attributes: { title: 'Song 1', ccli_number: '11111', author: 'Author 1', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [{ type: 'Tag', id: 'tag-1' }] } },
                            },
                        ],
                        included: [
                            { type: 'Tag', id: 'tag-1', attributes: { name: 'Ballad' } },
                        ],
                        links: {
                            self: '/api/planningcenter/services/v2/songs?per_page=100&offset=0',
                            next: '/api/planningcenter/services/v2/songs?per_page=100&offset=100',
                        },
                        meta: { total_count: 2 },
                    };
                    page2Response = {
                        data: [
                            {
                                id: 'song-2',
                                attributes: { title: 'Song 2', ccli_number: '22222', author: 'Author 2', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [] } },
                            },
                        ],
                        included: [],
                        links: {
                            self: '/api/planningcenter/services/v2/songs?per_page=100&offset=100',
                        },
                        meta: { total_count: 2 },
                    };
                    mockFetch = vitest_1.vi.fn()
                        .mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(page1Response); } })
                        .mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(page2Response); } });
                    global.fetch = mockFetch;
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAllPcSongs)('app-id', 'secret')
                        // fetch called twice (2 pages)
                    ];
                case 1:
                    result = _a.sent();
                    // fetch called twice (2 pages)
                    (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(2);
                    // returns both songs
                    (0, vitest_1.expect)(result).toHaveLength(2);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns all songs from all pages combined', function () { return __awaiter(void 0, void 0, void 0, function () {
        var page1Response, page2Response, mockFetch, result;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    page1Response = {
                        data: [
                            {
                                id: 'song-1',
                                attributes: { title: 'Song 1', ccli_number: '11111', author: 'Author 1', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [{ type: 'Tag', id: 'tag-ballad' }] } },
                            },
                        ],
                        included: [
                            { type: 'Tag', id: 'tag-ballad', attributes: { name: 'Ballad' } },
                        ],
                        links: {
                            self: '/api/planningcenter/services/v2/songs',
                            next: '/api/planningcenter/services/v2/songs?page=2',
                        },
                        meta: { total_count: 2 },
                    };
                    page2Response = {
                        data: [
                            {
                                id: 'song-2',
                                attributes: { title: 'Song 2', ccli_number: '22222', author: 'Author 2', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [] } },
                            },
                        ],
                        included: [],
                        links: {
                            self: '/api/planningcenter/services/v2/songs?page=2',
                        },
                        meta: { total_count: 2 },
                    };
                    mockFetch = vitest_1.vi.fn()
                        .mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(page1Response); } })
                        .mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(page2Response); } });
                    global.fetch = mockFetch;
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAllPcSongs)('app-id', 'secret')];
                case 1:
                    result = _e.sent();
                    (0, vitest_1.expect)(result).toHaveLength(2);
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.song.id).toBe('song-1');
                    (0, vitest_1.expect)((_b = result[1]) === null || _b === void 0 ? void 0 : _b.song.id).toBe('song-2');
                    // First song should have its tag resolved
                    (0, vitest_1.expect)((_c = result[0]) === null || _c === void 0 ? void 0 : _c.tags).toEqual([{ id: 'tag-ballad', name: 'Ballad' }]);
                    // Second song has no tags
                    (0, vitest_1.expect)((_d = result[1]) === null || _d === void 0 ? void 0 : _d.tags).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('fetchAndMapPcSongs', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('returns a flat UpsertSongInput[] with correct field values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var singlePageResponse, mockFetch, result, song;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    singlePageResponse = {
                        data: [
                            {
                                id: 'pc-song-abc',
                                attributes: {
                                    title: 'How Great Thou Art',
                                    ccli_number: '78890',
                                    author: 'Stuart K. Hine',
                                    last_scheduled_at: '2026-02-01T00:00:00Z',
                                    themes: '',
                                },
                                relationships: {
                                    tags: { data: [{ type: 'Tag', id: 'tag-cat2' }] },
                                },
                            },
                        ],
                        included: [
                            { type: 'Tag', id: 'tag-cat2', attributes: { name: 'Category 2' } },
                        ],
                        links: {
                            self: '/api/planningcenter/services/v2/songs',
                        },
                        meta: { total_count: 1 },
                    };
                    mockFetch = vitest_1.vi.fn()
                        .mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(singlePageResponse); } });
                    global.fetch = mockFetch;
                    vitest_1.vi.mocked(planningCenterApi_1.fetchSongArrangements).mockResolvedValueOnce([
                        { id: 'arr-orchestra', name: 'Orchestra', key: '' },
                    ]);
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAndMapPcSongs)('app-id', 'secret')];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toHaveLength(1);
                    song = result[0];
                    (0, vitest_1.expect)(song.pcSongId).toBe('pc-song-abc');
                    (0, vitest_1.expect)(song.title).toBe('How Great Thou Art');
                    (0, vitest_1.expect)(song.ccliNumber).toBe('78890');
                    (0, vitest_1.expect)(song.vwTypes).toEqual([2]);
                    (0, vitest_1.expect)(song.tags).toContain('Orchestra');
                    (0, vitest_1.expect)(song.lastUsedAt).not.toBeNull();
                    (0, vitest_1.expect)(song.hidden).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('calls fetchSongArrangements for each song to resolve Orchestra tag', function () { return __awaiter(void 0, void 0, void 0, function () {
        var singlePageResponse, mockFetch, result;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    singlePageResponse = {
                        data: [
                            {
                                id: 'pc-song-1',
                                attributes: { title: 'Song 1', ccli_number: '11111', author: '', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [] } },
                            },
                            {
                                id: 'pc-song-2',
                                attributes: { title: 'Song 2', ccli_number: '22222', author: '', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [] } },
                            },
                        ],
                        included: [],
                        links: {
                            self: '/api/planningcenter/services/v2/songs',
                        },
                        meta: { total_count: 2 },
                    };
                    mockFetch = vitest_1.vi.fn()
                        .mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(singlePageResponse); } });
                    global.fetch = mockFetch;
                    vitest_1.vi.mocked(planningCenterApi_1.fetchSongArrangements)
                        .mockResolvedValueOnce([{ id: 'arr-1', name: 'Standard', key: '' }])
                        .mockResolvedValueOnce([{ id: 'arr-2', name: 'Orchestra', key: '' }]);
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAndMapPcSongs)('app-id', 'secret')
                        // fetchSongArrangements should be called once per song
                    ];
                case 1:
                    result = _c.sent();
                    // fetchSongArrangements should be called once per song
                    (0, vitest_1.expect)(planningCenterApi_1.fetchSongArrangements).toHaveBeenCalledTimes(2);
                    (0, vitest_1.expect)(planningCenterApi_1.fetchSongArrangements).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-1');
                    (0, vitest_1.expect)(planningCenterApi_1.fetchSongArrangements).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-2');
                    // Song 2 has Orchestra arrangement
                    (0, vitest_1.expect)((_a = result[1]) === null || _a === void 0 ? void 0 : _a.tags).toContain('Orchestra');
                    // Song 1 does not
                    (0, vitest_1.expect)((_b = result[0]) === null || _b === void 0 ? void 0 : _b.tags).not.toContain('Orchestra');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('resolves the last-scheduled arrangement as the primary key when multiple arrangements exist', function () { return __awaiter(void 0, void 0, void 0, function () {
        var singlePageResponse, result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    singlePageResponse = {
                        data: [
                            {
                                id: 'pc-song-multi',
                                attributes: { title: 'Multi Key Song', ccli_number: '33333', author: '', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [] } },
                            },
                        ],
                        included: [],
                        links: { self: '/api/planningcenter/services/v2/songs' },
                        meta: { total_count: 1 },
                    };
                    global.fetch = vitest_1.vi.fn().mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(singlePageResponse); } });
                    vitest_1.vi.mocked(planningCenterApi_1.fetchSongArrangements).mockResolvedValueOnce([
                        { id: 'arr-g', name: 'Key of G', key: 'G' },
                        { id: 'arr-a', name: 'Key of A', key: 'A' },
                    ]);
                    vitest_1.vi.mocked(planningCenterApi_1.fetchLastScheduledItem).mockResolvedValueOnce({ notes: [], arrangementId: 'arr-a' });
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAndMapPcSongs)('app-id', 'secret')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(planningCenterApi_1.fetchLastScheduledItem).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-multi');
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.primaryArrangementId).toBe('arr-a');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('does NOT call fetchLastScheduledItem for single-arrangement songs', function () { return __awaiter(void 0, void 0, void 0, function () {
        var singlePageResponse, result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    singlePageResponse = {
                        data: [
                            {
                                id: 'pc-song-single',
                                attributes: { title: 'Single', ccli_number: '44444', author: '', last_scheduled_at: null, themes: '' },
                                relationships: { tags: { data: [] } },
                            },
                        ],
                        included: [],
                        links: { self: '/api/planningcenter/services/v2/songs' },
                        meta: { total_count: 1 },
                    };
                    global.fetch = vitest_1.vi.fn().mockResolvedValueOnce({ ok: true, json: function () { return Promise.resolve(singlePageResponse); } });
                    vitest_1.vi.mocked(planningCenterApi_1.fetchSongArrangements).mockResolvedValueOnce([{ id: 'arr-only', name: 'Standard', key: 'C' }]);
                    return [4 /*yield*/, (0, pcSongImport_1.fetchAndMapPcSongs)('app-id', 'secret')];
                case 1:
                    result = _b.sent();
                    (0, vitest_1.expect)(planningCenterApi_1.fetchLastScheduledItem).not.toHaveBeenCalled();
                    (0, vitest_1.expect)((_a = result[0]) === null || _a === void 0 ? void 0 : _a.primaryArrangementId).toBe('arr-only');
                    return [2 /*return*/];
            }
        });
    }); });
});
// Helper to build a minimal UpsertSongInput fixture for partitionPcSongs tests
function makeMappedSong(overrides) {
    var _a, _b, _c;
    if (overrides === void 0) { overrides = {}; }
    return {
        title: (_a = overrides.title) !== null && _a !== void 0 ? _a : 'Some Song',
        ccliNumber: (_b = overrides.ccliNumber) !== null && _b !== void 0 ? _b : '',
        author: '',
        themes: [],
        notes: '',
        vwTypes: [],
        arrangements: [],
        primaryArrangementId: null,
        lastUsedAt: null,
        pcSongId: (_c = overrides.pcSongId) !== null && _c !== void 0 ? _c : null,
        hidden: false,
        tags: [],
        removedThemes: [],
    };
}
// Helper to build a minimal existing-song fixture (the shape partitionPcSongs expects)
function makeExisting(overrides) {
    var _a, _b, _c;
    if (overrides === void 0) { overrides = {}; }
    return {
        pcSongId: (_a = overrides.pcSongId) !== null && _a !== void 0 ? _a : null,
        ccliNumber: (_b = overrides.ccliNumber) !== null && _b !== void 0 ? _b : '',
        title: (_c = overrides.title) !== null && _c !== void 0 ? _c : 'Some Song',
    };
}
(0, vitest_1.describe)('partitionPcSongs', function () {
    (0, vitest_1.it)('classifies a song as existing when pcSongId matches exactly', function () {
        var _a;
        var mapped = [makeMappedSong({ pcSongId: 'pc-1', title: 'A' })];
        var existing = [makeExisting({ pcSongId: 'pc-1', title: 'Different Title' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, existing);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(0);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(1);
        (0, vitest_1.expect)((_a = result.existingSongs[0]) === null || _a === void 0 ? void 0 : _a.pcSongId).toBe('pc-1');
    });
    (0, vitest_1.it)('classifies a song as existing when ccliNumber matches exactly', function () {
        var mapped = [makeMappedSong({ ccliNumber: '12345', title: 'A' })];
        var existing = [makeExisting({ ccliNumber: '12345', title: 'Different Title' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, existing);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(0);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(1);
    });
    (0, vitest_1.it)('classifies a song as existing when title matches case-insensitively', function () {
        var mapped = [makeMappedSong({ title: 'Amazing Grace' })];
        var existing = [makeExisting({ title: 'amazing grace' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, existing);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(0);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(1);
    });
    (0, vitest_1.it)('classifies a song as new when no key matches', function () {
        var mapped = [makeMappedSong({ pcSongId: 'pc-2', ccliNumber: '99999', title: 'Brand New Song' })];
        var existing = [makeExisting({ pcSongId: 'pc-1', ccliNumber: '11111', title: 'Old Song' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, existing);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(1);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(0);
    });
    (0, vitest_1.it)('does NOT match on empty-string ccliNumber alone', function () {
        var mapped = [makeMappedSong({ ccliNumber: '', title: 'Unique Title Here' })];
        var existing = [makeExisting({ ccliNumber: '', title: 'Other Title' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, existing);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(1);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(0);
    });
    (0, vitest_1.it)('treats all mapped songs as new when existing list is empty', function () {
        var mapped = [makeMappedSong({ title: 'Song A' }), makeMappedSong({ title: 'Song B' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, []);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(2);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(0);
    });
    (0, vitest_1.it)('returns empty arrays when mapped list is empty', function () {
        var existing = [makeExisting({ title: 'Song A' })];
        var result = (0, pcSongImport_1.partitionPcSongs)([], existing);
        (0, vitest_1.expect)(result.newSongs).toHaveLength(0);
        (0, vitest_1.expect)(result.existingSongs).toHaveLength(0);
    });
    (0, vitest_1.it)('preserves original input order across both output arrays', function () {
        var mapped = [
            makeMappedSong({ pcSongId: 'pc-new-1', title: 'New One' }),
            makeMappedSong({ pcSongId: 'pc-existing', title: 'Existing One' }),
            makeMappedSong({ pcSongId: 'pc-new-2', title: 'New Two' }),
        ];
        var existing = [makeExisting({ pcSongId: 'pc-existing', title: 'Existing One' })];
        var result = (0, pcSongImport_1.partitionPcSongs)(mapped, existing);
        (0, vitest_1.expect)(result.newSongs.map(function (s) { return s.title; })).toEqual(['New One', 'New Two']);
        (0, vitest_1.expect)(result.existingSongs.map(function (s) { return s.title; })).toEqual(['Existing One']);
    });
});
