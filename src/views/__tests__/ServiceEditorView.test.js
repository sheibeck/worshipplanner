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
// ── Mocks ─────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('vue-router', function () { return ({
    useRoute: function () { return ({ params: { id: 'service-1' } }); },
    useRouter: function () { return ({ push: vitest_1.vi.fn() }); },
    RouterLink: { template: '<a><slot /></a>' },
}); });
vitest_1.vi.mock('@/firebase', function () { return ({
    auth: {},
    db: {},
}); });
vitest_1.vi.mock('firebase/firestore', function () { return ({
    getFirestore: vitest_1.vi.fn(),
    collection: vitest_1.vi.fn(),
    doc: vitest_1.vi.fn(function () { return ({}); }),
    onSnapshot: vitest_1.vi.fn(),
    getDoc: vitest_1.vi.fn(function () { return Promise.resolve({ data: function () { return ({ orgIds: ['org-1'] }); } }); }),
    updateDoc: vitest_1.vi.fn(),
    serverTimestamp: vitest_1.vi.fn(function () { return ({}); }),
}); });
var mockTimestamp = { toDate: function () { return new Date('2026-03-08'); } };
var mockService = {
    id: 'service-1',
    date: '2026-03-08',
    name: '',
    progression: '1-2-2-3',
    teams: ['Choir'],
    status: 'draft',
    slots: [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
        { kind: 'SCRIPTURE', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
        { kind: 'SONG', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'PRAYER', position: 3 },
        { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
        { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
        { kind: 'MESSAGE', position: 7 },
        { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    ],
    sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
    notes: '',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
};
var mockSongs = [
    {
        id: 'song-1',
        title: 'Amazing Grace',
        ccliNumber: '22025',
        author: 'John Newton',
        themes: [],
        notes: '',
        tags: [],
        removedThemes: [],
        vwTypes: [1],
        arrangements: [
            {
                id: 'arr-1a',
                name: 'Standard',
                key: 'G',
                bpm: 84,
                lengthSeconds: null,
                chordChartUrl: '',
                notes: '',
                teamTags: [],
            },
        ],
        primaryArrangementId: null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
    },
];
vitest_1.vi.mock('@/stores/services', function () { return ({
    useServiceStore: function () { return ({
        services: [mockService],
        isLoading: false,
        orgId: null,
        subscribe: vitest_1.vi.fn(),
        updateService: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        assignSongToSlot: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        clearSongFromSlot: vitest_1.vi.fn(function () { return Promise.resolve(); }),
    }); },
}); });
vitest_1.vi.mock('@/stores/songs', function () { return ({
    useSongStore: function () { return ({
        songs: mockSongs,
        orgId: null,
        subscribe: vitest_1.vi.fn(),
    }); },
}); });
vitest_1.vi.mock('@/stores/auth', function () { return ({
    useAuthStore: function () { return ({
        user: { uid: 'user-1' },
    }); },
}); });
// ── Tests ─────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('ServiceEditorView - Print and Copy for PC buttons', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.spyOn(window, 'print').mockImplementation(function () { });
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: vitest_1.vi.fn(function () { return Promise.resolve(); }),
            },
            writable: true,
            configurable: true,
        });
    });
    function mountView() {
        return __awaiter(this, void 0, void 0, function () {
            var ServiceEditorView;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('@/views/ServiceEditorView.vue'); })];
                    case 1:
                        ServiceEditorView = (_a.sent()).default;
                        return [2 /*return*/, (0, test_utils_1.shallowMount)(ServiceEditorView, {
                                global: {
                                    stubs: {
                                        AppShell: { template: '<div><slot /></div>' },
                                        RouterLink: { template: '<a><slot /></a>' },
                                        ServicePrintLayout: true,
                                        SongBadge: true,
                                        SongSlotPicker: true,
                                        ScriptureInput: true,
                                    },
                                },
                            })];
                }
            });
        });
    }
    (0, vitest_1.it)('Print button exists and clicking it calls window.print() once', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, printBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountView()];
                case 1:
                    wrapper = _a.sent();
                    printBtn = wrapper.find('[data-testid="print-btn"]');
                    (0, vitest_1.expect)(printBtn.exists()).toBe(true);
                    return [4 /*yield*/, printBtn.trigger('click')];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(window.print).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Copy for PC button exists and clicking it shows "Copied!" text', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, copyBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountView()];
                case 1:
                    wrapper = _a.sent();
                    copyBtn = wrapper.find('[data-testid="copy-pc-btn"]');
                    (0, vitest_1.expect)(copyBtn.exists()).toBe(true);
                    return [4 /*yield*/, copyBtn.trigger('click')];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, wrapper.vm.$nextTick()];
                case 3:
                    _a.sent();
                    (0, vitest_1.expect)(copyBtn.text()).toContain('Copied!');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Copy for PC button calls navigator.clipboard.writeText with a non-empty string', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wrapper, copyBtn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mountView()];
                case 1:
                    wrapper = _a.sent();
                    copyBtn = wrapper.find('[data-testid="copy-pc-btn"]');
                    return [4 /*yield*/, copyBtn.trigger('click')];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, wrapper.vm.$nextTick()];
                case 3:
                    _a.sent();
                    (0, vitest_1.expect)(navigator.clipboard.writeText).toHaveBeenCalledWith(vitest_1.expect.stringContaining('ORDER OF SERVICE'));
                    return [2 /*return*/];
            }
        });
    }); });
});
