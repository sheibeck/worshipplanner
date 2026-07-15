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
// Use vi.hoisted to ensure mockCreate is available at mock factory hoisting time
var mockCreate = vitest_1.vi.hoisted(function () {
    var mockCreate = vitest_1.vi.fn();
    return { mockCreate: mockCreate };
}).mockCreate;
// The proxy holds the real key server-side; the client only attaches an app-auth
// token. Mock the helper so unit tests don't touch Firebase Auth.
vitest_1.vi.mock('@/utils/appAuth', function () { return ({
    getAppAuthHeaders: vitest_1.vi.fn().mockResolvedValue({ 'X-App-Auth': 'test-token' }),
}); });
// Mock the Anthropic SDK using the hoisted mockCreate
vitest_1.vi.mock('@anthropic-ai/sdk', function () {
    function MockAnthropic() {
        return {
            messages: {
                create: mockCreate,
            },
        };
    }
    return {
        default: MockAnthropic,
    };
});
var claudeApi_1 = require("@/utils/claudeApi");
(0, vitest_1.describe)('safeParseJsonArray', function () {
    (0, vitest_1.it)('parses clean JSON array', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('[ {"a":1} ]');
        (0, vitest_1.expect)(result).toEqual([{ a: 1 }]);
    });
    (0, vitest_1.it)('extracts JSON array from prose-wrapped response', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('Here are results: [{"a":1}]');
        (0, vitest_1.expect)(result).toEqual([{ a: 1 }]);
    });
    (0, vitest_1.it)('returns null when no JSON array present', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('no json here');
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('extracts JSON array from markdown code fences', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('```json\n[{"a":1}]\n```');
        (0, vitest_1.expect)(result).toEqual([{ a: 1 }]);
    });
    (0, vitest_1.it)('returns null for empty string', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('');
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('returns null for plain object (not array)', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('{"a":1}');
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)('parses nested objects in array', function () {
        var result = (0, claudeApi_1.safeParseJsonArray)('[{"songId":"abc","reason":"Good match"}]');
        (0, vitest_1.expect)(result).toEqual([{ songId: 'abc', reason: 'Good match' }]);
    });
});
(0, vitest_1.describe)('validateSongSuggestions', function () {
    var songs = [
        { id: 'song-1' },
        { id: 'song-2' },
        { id: 'song-3' },
    ];
    (0, vitest_1.it)('filters out suggestions with songId not in provided song list (hallucinated IDs)', function () {
        var suggestions = [
            { songId: 'hallucinated-id', reason: 'Thematic match' },
            { songId: 'song-1', reason: 'Valid match' },
        ];
        var result = (0, claudeApi_1.validateSongSuggestions)(suggestions, songs);
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].songId).toBe('song-1');
    });
    (0, vitest_1.it)('keeps suggestions whose songId matches a provided song', function () {
        var suggestions = [
            { songId: 'song-1', reason: 'Call to worship' },
            { songId: 'song-2', reason: 'Intimate praise' },
            { songId: 'song-3', reason: 'Ascription' },
        ];
        var result = (0, claudeApi_1.validateSongSuggestions)(suggestions, songs);
        (0, vitest_1.expect)(result).toHaveLength(3);
    });
    (0, vitest_1.it)('returns empty array when all suggestions are hallucinated', function () {
        var suggestions = [
            { songId: 'fake-1', reason: 'Hallucinated' },
            { songId: 'fake-2', reason: 'Also hallucinated' },
        ];
        var result = (0, claudeApi_1.validateSongSuggestions)(suggestions, songs);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
    (0, vitest_1.it)('returns empty array when input is empty', function () {
        var result = (0, claudeApi_1.validateSongSuggestions)([], songs);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
});
(0, vitest_1.describe)('validateScriptureSuggestions', function () {
    (0, vitest_1.it)('filters out suggestions with book not in BIBLE_BOOKS', function () {
        var suggestions = [
            {
                book: 'Psalm 151',
                chapter: 1,
                verseStart: 1,
                verseEnd: 7,
                reason: 'Invalid book',
                recentlyUsed: false,
                weeksAgoUsed: null,
            },
        ];
        var result = (0, claudeApi_1.validateScriptureSuggestions)(suggestions);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
    (0, vitest_1.it)('keeps suggestions whose book is in BIBLE_BOOKS', function () {
        var suggestions = [
            {
                book: 'Psalms',
                chapter: 23,
                verseStart: 1,
                verseEnd: 6,
                reason: 'Shepherd psalm',
                recentlyUsed: false,
                weeksAgoUsed: null,
            },
            {
                book: 'Romans',
                chapter: 8,
                verseStart: 28,
                verseEnd: 39,
                reason: 'Nothing separates us',
                recentlyUsed: true,
                weeksAgoUsed: 3,
            },
        ];
        var result = (0, claudeApi_1.validateScriptureSuggestions)(suggestions);
        (0, vitest_1.expect)(result).toHaveLength(2);
    });
    (0, vitest_1.it)('filters mixed valid and invalid books', function () {
        var suggestions = [
            {
                book: 'Psalms',
                chapter: 23,
                verseStart: 1,
                verseEnd: 6,
                reason: 'Valid',
                recentlyUsed: false,
                weeksAgoUsed: null,
            },
            {
                book: 'Hezekiah',
                chapter: 1,
                verseStart: 1,
                verseEnd: 5,
                reason: 'Invalid book',
                recentlyUsed: false,
                weeksAgoUsed: null,
            },
        ];
        var result = (0, claudeApi_1.validateScriptureSuggestions)(suggestions);
        (0, vitest_1.expect)(result).toHaveLength(1);
        (0, vitest_1.expect)(result[0].book).toBe('Psalms');
    });
    (0, vitest_1.it)('returns empty array when input is empty', function () {
        var result = (0, claudeApi_1.validateScriptureSuggestions)([]);
        (0, vitest_1.expect)(result).toHaveLength(0);
    });
});
(0, vitest_1.describe)('getSongSuggestions', function () {
    (0, vitest_1.beforeEach)(function () {
        mockCreate.mockReset();
    });
    (0, vitest_1.it)('returns null when API throws an error', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockRejectedValueOnce(new Error('Unauthorized'));
                    return [4 /*yield*/, (0, claudeApi_1.getSongSuggestions)({
                            sermonTopic: 'Grace',
                            sermonPassage: null,
                            slotVwType: 1,
                            alreadySelectedSongIds: [],
                            songLibrary: [{ id: 'song-1', title: 'Amazing Grace', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
                            recentServiceSongIds: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns validated array when API returns valid JSON response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockResolvedValueOnce({
                        content: [
                            {
                                type: 'text',
                                text: '[{"songId":"song-1","reason":"Matches grace theme"}]',
                            },
                        ],
                    });
                    return [4 /*yield*/, (0, claudeApi_1.getSongSuggestions)({
                            sermonTopic: 'Grace',
                            sermonPassage: null,
                            slotVwType: 1,
                            alreadySelectedSongIds: [],
                            songLibrary: [{ id: 'song-1', title: 'Amazing Grace', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
                            recentServiceSongIds: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).not.toBeNull();
                    (0, vitest_1.expect)(result).toHaveLength(1);
                    (0, vitest_1.expect)(result[0].songId).toBe('song-1');
                    (0, vitest_1.expect)(result[0].reason).toBe('Matches grace theme');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when API returns response with no valid JSON', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockResolvedValueOnce({
                        content: [
                            {
                                type: 'text',
                                text: 'I cannot suggest songs at this time.',
                            },
                        ],
                    });
                    return [4 /*yield*/, (0, claudeApi_1.getSongSuggestions)({
                            sermonTopic: 'Grace',
                            sermonPassage: null,
                            slotVwType: 1,
                            alreadySelectedSongIds: [],
                            songLibrary: [],
                            recentServiceSongIds: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when validated results are empty (all hallucinated IDs)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockResolvedValueOnce({
                        content: [
                            {
                                type: 'text',
                                text: '[{"songId":"hallucinated-id","reason":"Hallucinated"}]',
                            },
                        ],
                    });
                    return [4 /*yield*/, (0, claudeApi_1.getSongSuggestions)({
                            sermonTopic: 'Grace',
                            sermonPassage: null,
                            slotVwType: 1,
                            alreadySelectedSongIds: [],
                            songLibrary: [{ id: 'real-song', title: 'Real Song', ccliNumber: '1234567', vwTypes: [1], themes: [], lastUsedAt: null }],
                            recentServiceSongIds: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, vitest_1.describe)('getScriptureSuggestions', function () {
    (0, vitest_1.beforeEach)(function () {
        mockCreate.mockReset();
    });
    (0, vitest_1.it)('returns null when API throws an error', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockRejectedValueOnce(new Error('Network error'));
                    return [4 /*yield*/, (0, claudeApi_1.getScriptureSuggestions)({
                            sermonTopic: 'Forgiveness',
                            sermonPassage: null,
                            query: 'passages about forgiveness',
                            recentScriptures: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns validated array when API returns valid JSON response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockResolvedValueOnce({
                        content: [
                            {
                                type: 'text',
                                text: '[{"book":"Psalms","chapter":103,"verseStart":1,"verseEnd":12,"reason":"God forgives all our sins","recentlyUsed":false,"weeksAgoUsed":null}]',
                            },
                        ],
                    });
                    return [4 /*yield*/, (0, claudeApi_1.getScriptureSuggestions)({
                            sermonTopic: 'Forgiveness',
                            sermonPassage: null,
                            query: 'passages about forgiveness',
                            recentScriptures: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).not.toBeNull();
                    (0, vitest_1.expect)(result).toHaveLength(1);
                    (0, vitest_1.expect)(result[0].book).toBe('Psalms');
                    (0, vitest_1.expect)(result[0].chapter).toBe(103);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when API returns response with invalid book names', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockResolvedValueOnce({
                        content: [
                            {
                                type: 'text',
                                text: '[{"book":"Hezekiah","chapter":1,"verseStart":1,"verseEnd":5,"reason":"Invalid book","recentlyUsed":false,"weeksAgoUsed":null}]',
                            },
                        ],
                    });
                    return [4 /*yield*/, (0, claudeApi_1.getScriptureSuggestions)({
                            sermonTopic: 'Forgiveness',
                            sermonPassage: null,
                            query: 'forgiveness passages',
                            recentScriptures: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('returns null when API returns response with no valid JSON', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockCreate.mockResolvedValueOnce({
                        content: [
                            {
                                type: 'text',
                                text: 'No suggestions available.',
                            },
                        ],
                    });
                    return [4 /*yield*/, (0, claudeApi_1.getScriptureSuggestions)({
                            sermonTopic: 'Forgiveness',
                            sermonPassage: null,
                            query: 'forgiveness',
                            recentScriptures: [],
                        })];
                case 1:
                    result = _a.sent();
                    (0, vitest_1.expect)(result).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
});
