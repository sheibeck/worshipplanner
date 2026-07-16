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
var test_utils_1 = require("@vue/test-utils");
// Mock vue-router
vitest_1.vi.mock('vue-router', function () { return ({
    useRoute: vitest_1.vi.fn(function () { return ({
        params: { token: 'test-token-123' },
    }); }),
}); });
// Mock @/firebase
vitest_1.vi.mock('@/firebase', function () { return ({
    db: {},
}); });
// Mock @/utils/planningCenterExport
vitest_1.vi.mock('@/utils/planningCenterExport', function () { return ({
    formatScriptureRef: vitest_1.vi.fn(function (ref) {
        return "".concat(ref.book, " ").concat(ref.chapter, ":").concat(ref.verseStart, "-").concat(ref.verseEnd);
    }),
}); });
// Mock @/utils/slotTypes
vitest_1.vi.mock('@/utils/slotTypes', function () { return ({
    slotLabel: vitest_1.vi.fn(function (slot) {
        switch (slot.kind) {
            case 'SONG': return 'Song';
            case 'SCRIPTURE': return 'Scripture Reading';
            case 'PRAYER': return 'Prayer';
            case 'MESSAGE': return 'Message';
            default: return slot.kind;
        }
    }),
}); });
// Mock firebase/firestore — getDoc is controlled per test
var mockGetDoc = vitest_1.vi.fn();
vitest_1.vi.mock('firebase/firestore', function () { return ({
    doc: vitest_1.vi.fn(function (_db) {
        var _a;
        var segments = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            segments[_i - 1] = arguments[_i];
        }
        return ({
            id: (_a = segments[segments.length - 1]) !== null && _a !== void 0 ? _a : 'mock-id',
            path: segments.join('/'),
        });
    }),
    getDoc: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return mockGetDoc.apply(void 0, args);
    },
}); });
var mockSnapshot = {
    date: '2026-03-08',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: ['Choir'],
    status: 'planned',
    sermonPassage: { book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
    notes: 'Remember to mic the choir',
    slots: [
        {
            kind: 'SONG',
            position: 0,
            requiredVwType: 1,
            songId: 'song-abc',
            songTitle: 'Amazing Grace',
            songKey: 'G',
            bpm: 120,
        },
        {
            kind: 'SCRIPTURE',
            position: 1,
            book: 'Psalm',
            chapter: 100,
            verseStart: 1,
            verseEnd: 5,
        },
        {
            kind: 'SONG',
            position: 2,
            requiredVwType: 2,
            songId: null,
            songTitle: null,
            songKey: null,
            bpm: null,
        },
        {
            kind: 'PRAYER',
            position: 3,
        },
        {
            kind: 'MESSAGE',
            position: 7,
        },
    ],
};
function mountShareView() {
    return __awaiter(this, void 0, void 0, function () {
        var ShareView;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../ShareView.vue'); })];
                case 1:
                    ShareView = (_a.sent()).default;
                    return [2 /*return*/, (0, test_utils_1.mount)(ShareView)];
            }
        });
    });
}
(0, vitest_1.describe)('ShareView', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('shows loading state initially', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Never resolve getDoc during this test
                    mockGetDoc.mockReturnValue(new Promise(function () { }));
                    return [4 /*yield*/, mountShareView()];
                case 1:
                    wrapper = _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).toContain('Loading');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('shows not-found state when token document does not exist', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockGetDoc.mockResolvedValue({
                        exists: function () { return false; },
                        data: function () { return null; },
                    });
                    return [4 /*yield*/, mountShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).toContain('no longer available');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('renders service snapshot data when token is valid', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockGetDoc.mockResolvedValue({
                        exists: function () { return true; },
                        data: function () { return ({ serviceSnapshot: mockSnapshot }); },
                    });
                    return [4 /*yield*/, mountShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()
                        // Date should be formatted
                    ];
                case 2:
                    _a.sent();
                    // Date should be formatted
                    (0, vitest_1.expect)(wrapper.text()).toContain('2026');
                    // Song title
                    (0, vitest_1.expect)(wrapper.text()).toContain('Amazing Grace');
                    // Scripture reference text
                    (0, vitest_1.expect)(wrapper.text()).toContain('Psalm');
                    (0, vitest_1.expect)(wrapper.text()).toContain('100');
                    // Notes
                    (0, vitest_1.expect)(wrapper.text()).toContain('Remember to mic the choir');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('renders not-found when getDoc throws an error', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockGetDoc.mockRejectedValue(new Error('Permission denied'));
                    return [4 /*yield*/, mountShareView()];
                case 1:
                    wrapper = _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.flushPromises)()];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(wrapper.text()).toContain('no longer available');
                    return [2 /*return*/];
            }
        });
    }); });
});
