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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var pinia_1 = require("pinia");
// Track onSnapshot callbacks and unsubscribe fns
var snapshotCallback = null;
var mockUnsubscribe = vitest_1.vi.fn();
// Track batch operations for upsertSongs tests
var mockBatchOps = [];
// Mock firebase/firestore module
vitest_1.vi.mock('firebase/firestore', function () {
    var mockBatch = {
        set: vitest_1.vi.fn(function (ref, data) { mockBatchOps.push({ type: 'set', ref: ref, data: data }); }),
        update: vitest_1.vi.fn(function (ref, data) { mockBatchOps.push({ type: 'update', ref: ref, data: data }); }),
        commit: vitest_1.vi.fn(function () { return Promise.resolve(); }),
    };
    return {
        getFirestore: vitest_1.vi.fn(function () { return ({}); }),
        collection: vitest_1.vi.fn(function (db) {
            var segments = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                segments[_i - 1] = arguments[_i];
            }
            return ({ path: segments.join('/') });
        }),
        doc: vitest_1.vi.fn(function (db) {
            var _a;
            var segments = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                segments[_i - 1] = arguments[_i];
            }
            return ({ id: (_a = segments[segments.length - 1]) !== null && _a !== void 0 ? _a : 'mock-id', path: segments.join('/') });
        }),
        onSnapshot: vitest_1.vi.fn(function (_query, callback) {
            snapshotCallback = callback;
            return mockUnsubscribe;
        }),
        addDoc: vitest_1.vi.fn(function () { return Promise.resolve({ id: 'new-song-id' }); }),
        updateDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        deleteDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        writeBatch: vitest_1.vi.fn(function () { return (__assign({}, mockBatch)); }),
        query: vitest_1.vi.fn(function (ref) { return ref; }),
        orderBy: vitest_1.vi.fn(),
        serverTimestamp: vitest_1.vi.fn(function () { return ({ seconds: 1000000, nanoseconds: 0 }); }),
    };
});
// Mock @/firebase module
vitest_1.vi.mock('@/firebase', function () { return ({
    auth: {},
    db: {},
}); });
// Mock @/stores/auth — songs store reads useAuthStore().user/orgId for tag-filter persistence keying
// and useAuthStore().vwModeEnabled to gate the search `type:` prefix + filterVwType dropdown (CR-01).
var mockAuthUser = null;
var mockAuthOrgId = null;
var mockAuthVwModeEnabled = true;
vitest_1.vi.mock('@/stores/auth', function () { return ({
    useAuthStore: vitest_1.vi.fn(function () { return ({
        get user() { return mockAuthUser; },
        get orgId() { return mockAuthOrgId; },
        get vwModeEnabled() { return mockAuthVwModeEnabled; },
    }); }),
}); });
function makeSong(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '12345', author: 'John Newton', vwTypes: [1], teamTags: ['Choir'], tags: [], removedThemes: [], arrangements: [
            {
                id: 'arr-1',
                name: 'Original',
                key: 'G',
                bpm: 120,
                lengthSeconds: 240,
                chordChartUrl: '',
                notes: '',
                teamTags: ['Choir'],
            },
        ], themes: ['grace'], notes: '', primaryArrangementId: null, lastUsedAt: null, createdAt: { seconds: 1000000, nanoseconds: 0 }, updatedAt: { seconds: 1000000, nanoseconds: 0 }, pcSongId: null, hidden: false }, overrides);
}
function triggerSnapshot(songs) {
    if (snapshotCallback) {
        snapshotCallback({
            docs: songs.map(function (s) { return ({
                id: s.id,
                data: function () {
                    var _id = s.id, rest = __rest(s, ["id"]);
                    return rest;
                },
            }); }),
        });
    }
}
(0, vitest_1.describe)('useSongStore', function () {
    (0, vitest_1.beforeEach)(function () {
        (0, pinia_1.setActivePinia)((0, pinia_1.createPinia)());
        vitest_1.vi.clearAllMocks();
        snapshotCallback = null;
        mockBatchOps = [];
        mockAuthUser = null;
        mockAuthOrgId = null;
        mockAuthVwModeEnabled = true;
        localStorage.clear();
    });
    (0, vitest_1.describe)('initial state', function () {
        (0, vitest_1.it)('starts with empty songs array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)(store.songs).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('starts with isLoading true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)(store.isLoading).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('filteredSongs is empty initially', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)(store.filteredSongs).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe / onSnapshot', function () {
        (0, vitest_1.it)('subscribe calls onSnapshot on the org songs collection', function () { return __awaiter(void 0, void 0, void 0, function () {
            var onSnapshot, useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        onSnapshot = (_a.sent()).onSnapshot;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        (0, vitest_1.expect)(onSnapshot).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('populates songs from snapshot with { id, ...data } mapping', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store, song;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        song = makeSong();
                        triggerSnapshot([song]);
                        (0, vitest_1.expect)(store.songs).toHaveLength(1);
                        (0, vitest_1.expect)(store.songs[0].id).toBe('song-1');
                        (0, vitest_1.expect)(store.songs[0].title).toBe('Amazing Grace');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('sets isLoading to false after first snapshot', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([]);
                        (0, vitest_1.expect)(store.isLoading).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('unsubscribeAll calls the unsubscribe fn and resets state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store, song;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        song = makeSong();
                        triggerSnapshot([song]);
                        (0, vitest_1.expect)(store.songs).toHaveLength(1);
                        store.unsubscribeAll();
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalled();
                        (0, vitest_1.expect)(store.songs).toEqual([]);
                        (0, vitest_1.expect)(store.isLoading).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('calling subscribe again unsubscribes previous listener first', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        store.subscribe('org-2');
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('Firestore normalization — legacy vwType scalar', function () {
        (0, vitest_1.it)('normalizes legacy vwType scalar to vwTypes array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        // Simulate a legacy song doc with vwType scalar instead of vwTypes array
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'legacy-song',
                                        data: function () { return ({
                                            title: 'Legacy Song',
                                            ccliNumber: '99999',
                                            author: 'Old Author',
                                            vwType: 2, // legacy scalar field
                                            teamTags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            hidden: false,
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.songs[0].vwTypes).toEqual([2]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('normalizes legacy vwType null to empty vwTypes array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'legacy-null-song',
                                        data: function () { return ({
                                            title: 'Null Type Song',
                                            ccliNumber: '11111',
                                            author: 'Author',
                                            vwType: null, // legacy null
                                            teamTags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            hidden: false,
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.songs[0].vwTypes).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('preserves vwTypes array from doc if already present', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'new-song',
                                        data: function () { return ({
                                            title: 'New Song',
                                            ccliNumber: '22222',
                                            author: 'Author',
                                            vwTypes: [1, 3], // already array
                                            teamTags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            hidden: false,
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.songs[0].vwTypes).toEqual([1, 3]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe — teamTags fold into tags (D-01)', function () {
        (0, vitest_1.it)('folds teamTags into tags, de-duplicated (order-insensitive)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', teamTags: ['Orchestra'], tags: ['Christmas'] }),
                        ]);
                        (0, vitest_1.expect)(new Set(store.songs[0].tags)).toEqual(new Set(['Christmas', 'Orchestra']));
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not duplicate a teamTags value that already exists in tags', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', teamTags: ['Orchestra'], tags: ['Orchestra'] }),
                        ]);
                        (0, vitest_1.expect)(store.songs[0].tags).toEqual(['Orchestra']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not fold when teamTags is empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', teamTags: [], tags: ['Christmas'] }),
                        ]);
                        (0, vitest_1.expect)(store.songs[0].tags).toEqual(['Christmas']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe — removedThemes default (D-14)', function () {
        (0, vitest_1.it)('defaults removedThemes to [] for a legacy doc missing the field', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'legacy-no-removed-themes',
                                        data: function () { return ({
                                            title: 'Legacy Song',
                                            ccliNumber: '66666',
                                            author: 'Old Author',
                                            vwTypes: [],
                                            teamTags: [],
                                            tags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            hidden: false,
                                            // removedThemes field intentionally omitted — legacy doc
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.songs[0].removedThemes).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — hidden songs', function () {
        (0, vitest_1.it)('excludes songs where hidden is true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
                            makeSong({ id: 'song-2', title: 'Hidden Song', hidden: true }),
                        ]);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Visible Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('includes songs where hidden is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
                        ]);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('allUserTags excludes tags carried only by hidden songs (deduped + sorted)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Visible', hidden: false, teamTags: [], tags: ['Zeal', 'Grace'] }),
                            makeSong({ id: 'song-2', title: 'Also Visible', hidden: false, teamTags: [], tags: ['Grace'] }),
                            makeSong({ id: 'song-3', title: 'Hidden', hidden: true, teamTags: [], tags: ['Repentance'] }),
                        ]);
                        // 'Repentance' lives only on the hidden song, so it must not appear;
                        // 'Grace' is deduped; result is sorted.
                        (0, vitest_1.expect)(store.allUserTags).toEqual(['Grace', 'Zeal']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('includes songs where hidden is undefined (legacy docs)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        // Simulate a legacy song doc without hidden field
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'legacy-song',
                                        data: function () { return ({
                                            title: 'Legacy Song',
                                            ccliNumber: '99999',
                                            author: 'Old Author',
                                            vwTypes: [],
                                            teamTags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            // hidden field intentionally omitted to simulate legacy doc
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Legacy Song');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('aiCandidateSongs — soft-deleted exclusion', function () {
        (0, vitest_1.it)('excludes a soft-deleted (hidden: true) song from the AI candidate pool', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
                            makeSong({ id: 'song-2', title: 'Soft-Deleted Song', hidden: true }),
                        ]);
                        (0, vitest_1.expect)(store.aiCandidateSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.aiCandidateSongs[0].id).toBe('song-1');
                        (0, vitest_1.expect)(store.aiCandidateSongs[0].title).toBe('Visible Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('includes songs where hidden is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
                        ]);
                        (0, vitest_1.expect)(store.aiCandidateSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.aiCandidateSongs[0].id).toBe('song-1');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('includes songs where hidden is undefined (legacy docs)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        // Simulate a legacy song doc without hidden field
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'legacy-song',
                                        data: function () { return ({
                                            title: 'Legacy Song',
                                            ccliNumber: '99999',
                                            author: 'Old Author',
                                            vwTypes: [],
                                            teamTags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            // hidden field intentionally omitted to simulate legacy doc
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.aiCandidateSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.aiCandidateSongs[0].title).toBe('Legacy Song');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — search', function () {
        (0, vitest_1.it)('returns all songs when searchQuery is empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([makeSong({ id: 'song-1', title: 'Amazing Grace' }), makeSong({ id: 'song-2', title: 'How Great Thou Art' })]);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(2);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('filters by title (case insensitive)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([makeSong({ id: 'song-1', title: 'Amazing Grace' }), makeSong({ id: 'song-2', title: 'How Great Thou Art' })]);
                        store.searchQuery = 'amazing';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Amazing Grace');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('filters by CCLI number', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '11111' }),
                            makeSong({ id: 'song-2', title: 'How Great Thou Art', ccliNumber: '99999' }),
                        ]);
                        store.searchQuery = '11111';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].ccliNumber).toBe('11111');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('returns empty when no title or CCLI matches', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([makeSong({ title: 'Amazing Grace', ccliNumber: '11111' })]);
                        store.searchQuery = 'zzz';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — vwType filter', function () {
        (0, vitest_1.it)('filters by vwType 1 (song with vwTypes including 1)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Type1 Song', vwTypes: [1] }),
                            makeSong({ id: 'song-2', title: 'Type2 Song', vwTypes: [2] }),
                            makeSong({ id: 'song-3', title: 'Type3 Song', vwTypes: [3] }),
                        ]);
                        store.filterVwType = 1;
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].vwTypes).toContain(1);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('shows multi-type songs when filter matches one of their types', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Type1 and 2 Song', vwTypes: [1, 2] }),
                            makeSong({ id: 'song-2', title: 'Type3 only Song', vwTypes: [3] }),
                        ]);
                        store.filterVwType = 1;
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Type1 and 2 Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('filters uncategorized songs when filterVwType is "uncategorized"', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Categorized', vwTypes: [1] }),
                            makeSong({ id: 'song-2', title: 'Uncategorized', vwTypes: [] }),
                        ]);
                        store.filterVwType = 'uncategorized';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Uncategorized');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('returns all songs when filterVwType is null', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', vwTypes: [1] }),
                            makeSong({ id: 'song-2', vwTypes: [] }),
                        ]);
                        store.filterVwType = null;
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(2);
                        return [2 /*return*/];
                }
            });
        }); });
        // CR-01: a stale filterVwType selection must not silently keep filtering
        // once VW mode is turned off — mirrors the search `type:` prefix gate.
        (0, vitest_1.it)('D-16/CR-01: does not filter by numeric vwType when VW mode is disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthVwModeEnabled = false;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Type1 Song', vwTypes: [1] }),
                            makeSong({ id: 'song-2', title: 'Type2 Song', vwTypes: [2] }),
                        ]);
                        store.filterVwType = 2;
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(2);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('D-16/CR-01: does not filter by "uncategorized" vwType when VW mode is disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthVwModeEnabled = false;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Categorized', vwTypes: [1] }),
                            makeSong({ id: 'song-2', title: 'Uncategorized', vwTypes: [] }),
                        ]);
                        store.filterVwType = 'uncategorized';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(2);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — key filter', function () {
        (0, vitest_1.it)('filters by key scanning arrangements array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Song in G', arrangements: [{ id: 'arr-1', name: 'Original', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] }),
                            makeSong({ id: 'song-2', title: 'Song in D', arrangements: [{ id: 'arr-2', name: 'Original', key: 'D', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] }),
                        ]);
                        store.filterKey = 'G';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Song in G');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('returns no results when key does not match any arrangement', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', arrangements: [{ id: 'arr-1', name: 'Original', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] }),
                        ]);
                        store.filterKey = 'C#';
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — team tag filter', function () {
        (0, vitest_1.it)('filters by teamTag', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Choir Song', teamTags: ['Choir'] }),
                            makeSong({ id: 'song-2', title: 'Band Song', teamTags: ['Band'] }),
                        ]);
                        store.tagFilterInclude = new Set(['Choir']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Choir Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('include/exclude matching is unaffected by the teamTags→tags read-fold (D-01)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            // 'Orchestra' now also lives in the folded tags set, but filter matching
                            // against the raw teamTags union must still behave identically.
                            makeSong({ id: 'song-1', title: 'Orchestra Song', teamTags: ['Orchestra'], tags: [] }),
                            makeSong({ id: 'song-2', title: 'Other Song', teamTags: [], tags: [] }),
                        ]);
                        (0, vitest_1.expect)(new Set(store.songs[0].tags)).toEqual(new Set(['Orchestra']));
                        store.tagFilterInclude = new Set(['Orchestra']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Orchestra Song');
                        store.tagFilterInclude = new Set();
                        store.tagFilterExclude = new Set(['Orchestra']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Other Song');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — combined filters (AND logic)', function () {
        (0, vitest_1.it)('combines search + vwType filter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Amazing Grace', vwTypes: [1] }),
                            makeSong({ id: 'song-2', title: 'Amazing Love', vwTypes: [2] }),
                            makeSong({ id: 'song-3', title: 'How Great', vwTypes: [1] }),
                        ]);
                        store.searchQuery = 'amazing';
                        store.filterVwType = 1;
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Amazing Grace');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('combines key + tag filter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Match', teamTags: ['Choir'], arrangements: [{ id: 'a1', name: 'O', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: ['Choir'] }] }),
                            makeSong({ id: 'song-2', title: 'Wrong Tag', teamTags: ['Band'], arrangements: [{ id: 'a2', name: 'O', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: ['Band'] }] }),
                            makeSong({ id: 'song-3', title: 'Wrong Key', teamTags: ['Choir'], arrangements: [{ id: 'a3', name: 'O', key: 'D', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: ['Choir'] }] }),
                        ]);
                        store.filterKey = 'G';
                        store.tagFilterInclude = new Set(['Choir']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Match');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('addSong', function () {
        (0, vitest_1.it)('calls addDoc with correct shape including serverTimestamp', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, addDoc, serverTimestamp, useSongStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), addDoc = _a.addDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_b.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.addSong({
                                title: 'New Song',
                                ccliNumber: '',
                                author: '',
                                themes: [],
                                notes: '',
                                vwTypes: [],
                                tags: [],
                                removedThemes: [],
                                arrangements: [],
                                primaryArrangementId: null,
                                lastUsedAt: null,
                                pcSongId: null,
                                hidden: false,
                            })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.title).toBe('New Song');
                        (0, vitest_1.expect)(data.createdAt).toBeDefined();
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('updateSong', function () {
        (0, vitest_1.it)('calls updateDoc with serverTimestamp for updatedAt', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, updateDoc, serverTimestamp, useSongStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), updateDoc = _a.updateDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_b.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.updateSong('song-1', { title: 'Updated Title' })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.title).toBe('Updated Title');
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('deleteSong', function () {
        (0, vitest_1.it)('calls updateDoc with hidden:true, not deleteDoc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, updateDoc, deleteDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), updateDoc = _a.updateDoc, deleteDoc = _a.deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_b.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.deleteSong('song-1')];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(deleteDoc).not.toHaveBeenCalled();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.hidden).toBe(true);
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('restoreSong', function () {
        (0, vitest_1.it)('calls updateDoc with hidden:false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.restoreSong('song-1')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.hidden).toBe(false);
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('upsertSongs', function () {
        (0, vitest_1.it)('creates new doc via addDoc when no match found', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Brand New Song',
                                    ccliNumber: '99999',
                                    author: 'New Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-new-1',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.title).toBe('Brand New Song');
                        (0, vitest_1.expect)(data.hidden).toBe(false);
                        (0, vitest_1.expect)(data.createdAt).toBeDefined();
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('updates existing doc via updateDoc when pcSongId matches', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'existing-song', title: 'Old Title', pcSongId: 'pc-123', ccliNumber: '11111', hidden: false }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Updated Title',
                                    ccliNumber: '11111',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [1],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-123',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.title).toBe('Updated Title');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('updates existing doc when ccliNumber matches (no pcSongId)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'existing-song', title: 'Old Title', pcSongId: null, ccliNumber: '55555', hidden: false }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Updated Via CCLI',
                                    ccliNumber: '55555',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: null,
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.title).toBe('Updated Via CCLI');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('preserves hidden:true when updating existing song', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'hidden-song', title: 'Hidden Song', pcSongId: 'pc-hidden', ccliNumber: '77777', hidden: true }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Hidden Song Updated',
                                    ccliNumber: '77777',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-hidden',
                                    hidden: false, // incoming says not hidden, but existing is hidden — preserve hidden
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.hidden).toBe(true); // preserved from existing song
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('only sets vwTypes when incoming vwTypes is non-empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-with-type', title: 'Typed Song', pcSongId: 'pc-typed', ccliNumber: '88888', vwTypes: [2], hidden: false }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Typed Song',
                                    ccliNumber: '88888',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [], // incoming vwTypes is empty — should preserve existing
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-typed',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        // vwTypes should NOT be in the update data (preserving the existing value)
                        (0, vitest_1.expect)(data.vwTypes).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('includes vwTypes in update when incoming is non-empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-update', title: 'Song', pcSongId: 'pc-update', ccliNumber: '99911', vwTypes: [], hidden: false }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Song',
                                    ccliNumber: '99911',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [1, 3],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-update',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.vwTypes).toEqual([1, 3]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('upsertSongs — tag preservation and theme merge (D-02, D-08)', function () {
        (0, vitest_1.it)('preserves existing user tags when re-importing (tags from import are ignored)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-tagged', title: 'Tagged Song', pcSongId: 'pc-tagged', ccliNumber: '11111', teamTags: [], tags: ['Christmas'] }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Tagged Song',
                                    ccliNumber: '11111',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: [], // import sends empty tags — must NOT overwrite existing user tags
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-tagged',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.tags).toEqual(['Christmas']); // preserved from existing song
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('unions themes on re-import (existing themes not lost)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data, themes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-themes', title: 'Theme Song', pcSongId: 'pc-themes', ccliNumber: '22222', themes: ['grace', 'salvation'] }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Theme Song',
                                    ccliNumber: '22222',
                                    author: 'Author',
                                    themes: ['salvation', 'worship'], // incoming has one overlap + one new
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-themes',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        themes = data.themes;
                        (0, vitest_1.expect)(themes).toContain('grace'); // existing theme preserved
                        (0, vitest_1.expect)(themes).toContain('salvation'); // overlap deduplicated
                        (0, vitest_1.expect)(themes).toContain('worship'); // new theme added
                        (0, vitest_1.expect)(themes.filter(function (t) { return t === 'salvation'; })).toHaveLength(1); // no duplicates
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('new song gets tags: [] when import has tags: []', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'New Song With No Tags',
                                    ccliNumber: '33333',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-new',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.tags).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('upsertSongs — tag union + theme-removal-aware merge (D-05, D-14)', function () {
        (0, vitest_1.it)('unions incoming team tags into existing tags without dropping the user tag', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-union', title: 'Union Song', pcSongId: 'pc-union', ccliNumber: '44001', teamTags: [], tags: ['Christmas'] }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Union Song',
                                    ccliNumber: '44001',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: ['Orchestra'], // imported team-style tag
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-union',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(new Set(data.tags)).toEqual(new Set(['Christmas', 'Orchestra']));
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('a theme listed in existing.removedThemes is NOT present in the written themes after re-import', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data, themes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({
                                id: 'song-removed-theme',
                                title: 'Removed Theme Song',
                                pcSongId: 'pc-removed-theme',
                                ccliNumber: '44002',
                                teamTags: [],
                                themes: ['grace'],
                                removedThemes: ['salvation'],
                            }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Removed Theme Song',
                                    ccliNumber: '44002',
                                    author: 'Author',
                                    themes: ['salvation', 'worship'], // PC still sends the removed theme back
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [],
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-removed-theme',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        themes = data.themes;
                        (0, vitest_1.expect)(themes).toContain('grace');
                        (0, vitest_1.expect)(themes).toContain('worship');
                        (0, vitest_1.expect)(themes).not.toContain('salvation'); // user-removed theme stays removed
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('removedThemes survives an upsert unchanged', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useSongStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({
                                id: 'song-preserve-removed',
                                title: 'Preserve Removed',
                                pcSongId: 'pc-preserve-removed',
                                ccliNumber: '44003',
                                teamTags: [],
                                removedThemes: ['salvation'],
                            }),
                        ]);
                        return [4 /*yield*/, store.upsertSongs([
                                {
                                    title: 'Preserve Removed',
                                    ccliNumber: '44003',
                                    author: 'Author',
                                    themes: [],
                                    notes: '',
                                    vwTypes: [],
                                    tags: [],
                                    removedThemes: [], // import never sets removedThemes itself
                                    arrangements: [],
                                    primaryArrangementId: null,
                                    lastUsedAt: null,
                                    pcSongId: 'pc-preserve-removed',
                                    hidden: false,
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.removedThemes).toEqual(['salvation']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe — legacy tags backfill (D-01)', function () {
        (0, vitest_1.it)('normalizes missing tags field to [] for legacy docs', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'legacy-no-tags',
                                        data: function () { return ({
                                            title: 'Legacy Song',
                                            ccliNumber: '44444',
                                            author: 'Old Author',
                                            vwTypes: [],
                                            teamTags: [],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            hidden: false,
                                            // tags field intentionally omitted — legacy doc
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.songs[0].tags).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('preserves existing tags array for docs that already have it', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        if (snapshotCallback) {
                            snapshotCallback({
                                docs: [
                                    {
                                        id: 'song-with-tags',
                                        data: function () { return ({
                                            title: 'Tagged Song',
                                            ccliNumber: '55555',
                                            author: 'Author',
                                            vwTypes: [],
                                            teamTags: [],
                                            tags: ['Christmas', 'Advent'],
                                            arrangements: [],
                                            themes: [],
                                            notes: '',
                                            lastUsedAt: null,
                                            createdAt: { seconds: 1000000, nanoseconds: 0 },
                                            updatedAt: { seconds: 1000000, nanoseconds: 0 },
                                            hidden: false,
                                        }); },
                                    },
                                ],
                            });
                        }
                        (0, vitest_1.expect)(store.songs[0].tags).toEqual(['Christmas', 'Advent']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('filteredSongs — tag-filter checklist (D-08/D-09/D-10)', function () {
        (0, vitest_1.it)('default state, empty include+exclude sets returns all non-hidden songs (unchanged behavior)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
                            makeSong({ id: 'song-2', title: 'Regular Song', tags: [] }),
                        ]);
                        (0, vitest_1.expect)(store.tagFilterInclude.size).toBe(0);
                        (0, vitest_1.expect)(store.tagFilterExclude.size).toBe(0);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(2);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('include Set(["Christmas"]) shows only songs carrying that tag', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
                            makeSong({ id: 'song-2', title: 'Easter Song', tags: ['Easter'] }),
                        ]);
                        store.tagFilterInclude = new Set(['Christmas']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Christmas Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('include OR: Set(["Christmas","Easter"]) broadens to include either tag', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store, titles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
                            makeSong({ id: 'song-2', title: 'Easter Song', tags: ['Easter'] }),
                            makeSong({ id: 'song-3', title: 'Regular Song', tags: [] }),
                        ]);
                        store.tagFilterInclude = new Set(['Christmas', 'Easter']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(2);
                        titles = store.filteredSongs.map(function (s) { return s.title; });
                        (0, vitest_1.expect)(titles).toContain('Christmas Song');
                        (0, vitest_1.expect)(titles).toContain('Easter Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('exclude set: excluded tags are EXCLUDED, others appear', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
                            makeSong({ id: 'song-2', title: 'Regular Song', tags: [] }),
                        ]);
                        store.tagFilterExclude = new Set(['Christmas']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Regular Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('clearTagFilter() empties both include and exclude sets, leaves other filters untouched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        store.searchQuery = 'amazing';
                        store.filterVwType = 1;
                        store.filterKey = 'G';
                        store.tagFilterInclude = new Set(['Orchestra']);
                        store.tagFilterExclude = new Set(['Christmas']);
                        store.clearTagFilter();
                        (0, vitest_1.expect)(store.tagFilterInclude.size).toBe(0);
                        (0, vitest_1.expect)(store.tagFilterExclude.size).toBe(0);
                        (0, vitest_1.expect)(store.searchQuery).toBe('amazing');
                        (0, vitest_1.expect)(store.filterVwType).toBe(1);
                        (0, vitest_1.expect)(store.filterKey).toBe('G');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('tagFilterInclude, tagFilterExclude, and clearTagFilter are exported from store', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)('tagFilterInclude' in store).toBe(true);
                        (0, vitest_1.expect)('tagFilterExclude' in store).toBe(true);
                        (0, vitest_1.expect)('clearTagFilter' in store).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('include value matching a song\'s themes shows that song (union)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Grace Song', themes: ['grace'] }),
                            makeSong({ id: 'song-2', title: 'Other Song', themes: ['salvation'] }),
                        ]);
                        store.tagFilterInclude = new Set(['grace']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Grace Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('include value matching a song\'s teamTags shows that song (union)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Orchestra Song', teamTags: ['Orchestra'] }),
                            makeSong({ id: 'song-2', title: 'Other Song', teamTags: ['Band'] }),
                        ]);
                        store.tagFilterInclude = new Set(['Orchestra']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Orchestra Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('exclude themes value excludes the song carrying it (union)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Grace Song', themes: ['grace'] }),
                            makeSong({ id: 'song-2', title: 'Other Song', themes: ['salvation'] }),
                        ]);
                        store.tagFilterExclude = new Set(['grace']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Other Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('simultaneous include+exclude: excluding a tag wins even when the song also carries an included tag', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            // Carries BOTH the included ("Orchestra") and excluded ("Christmas") tags — must be dropped.
                            makeSong({ id: 'song-1', title: 'Orchestra Christmas Song', teamTags: ['Orchestra'], tags: ['Christmas'] }),
                            // Carries only the included tag — must appear.
                            makeSong({ id: 'song-2', title: 'Orchestra Song', teamTags: ['Orchestra'], tags: [] }),
                            // Carries only the excluded tag — must be dropped.
                            makeSong({ id: 'song-3', title: 'Christmas Song', teamTags: [], tags: ['Christmas'] }),
                            // Carries neither — must be dropped (include set is non-empty, so it must match to pass).
                            makeSong({ id: 'song-4', title: 'Unrelated Song', teamTags: [], tags: [] }),
                        ]);
                        store.tagFilterInclude = new Set(['Orchestra']);
                        store.tagFilterExclude = new Set(['Christmas']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(1);
                        (0, vitest_1.expect)(store.filteredSongs[0].title).toBe('Orchestra Song');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('include-only across the union (teamTags ∪ themes ∪ tags) still works with exclude empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store, titles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        triggerSnapshot([
                            makeSong({ id: 'song-1', title: 'Team Match', teamTags: ['Orchestra'], themes: [], tags: [] }),
                            makeSong({ id: 'song-2', title: 'Theme Match', teamTags: [], themes: ['grace'], tags: [] }),
                            makeSong({ id: 'song-3', title: 'User Tag Match', teamTags: [], themes: [], tags: ['Christmas'] }),
                            makeSong({ id: 'song-4', title: 'No Match', teamTags: [], themes: [], tags: [] }),
                        ]);
                        store.tagFilterInclude = new Set(['Orchestra', 'grace', 'Christmas']);
                        (0, vitest_1.expect)(store.filteredSongs).toHaveLength(3);
                        titles = store.filteredSongs.map(function (s) { return s.title; });
                        (0, vitest_1.expect)(titles).toContain('Team Match');
                        (0, vitest_1.expect)(titles).toContain('Theme Match');
                        (0, vitest_1.expect)(titles).toContain('User Tag Match');
                        (0, vitest_1.expect)(titles).not.toContain('No Match');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('importSongs — batch chunking', function () {
        (0, vitest_1.it)('chunks 600 songs into 2 batches of 499 max', function () { return __awaiter(void 0, void 0, void 0, function () {
            var writeBatch, useSongStore, store, songs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        writeBatch = (_a.sent()).writeBatch;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        songs = Array.from({ length: 600 }, function (_, i) { return ({
                            title: "Song ".concat(i),
                            ccliNumber: '',
                            author: '',
                            themes: [],
                            notes: '',
                            vwTypes: [],
                            teamTags: [],
                            tags: [],
                            removedThemes: [],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                        }); });
                        return [4 /*yield*/, store.importSongs(songs)
                            // 600 songs / 499 = 2 batches (499 + 101)
                        ];
                    case 3:
                        _a.sent();
                        // 600 songs / 499 = 2 batches (499 + 101)
                        (0, vitest_1.expect)(writeBatch).toHaveBeenCalledTimes(2);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('creates a single batch for 499 or fewer songs', function () { return __awaiter(void 0, void 0, void 0, function () {
            var writeBatch, useSongStore, store, songs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        writeBatch = (_a.sent()).writeBatch;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 2:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        songs = Array.from({ length: 499 }, function (_, i) { return ({
                            title: "Song ".concat(i),
                            ccliNumber: '',
                            author: '',
                            themes: [],
                            notes: '',
                            vwTypes: [],
                            teamTags: [],
                            tags: [],
                            removedThemes: [],
                            arrangements: [],
                            primaryArrangementId: null,
                            lastUsedAt: null,
                            hidden: false,
                            pcSongId: null,
                        }); });
                        return [4 /*yield*/, store.importSongs(songs)];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(writeBatch).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('tag-filter persistence (D-12/D-13)', function () {
        (0, vitest_1.it)('persists include + exclude sets to localStorage under a per-user/org v2 key on change', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store, raw, parsed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-1' };
                        mockAuthOrgId = 'org-1';
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        store.tagFilterInclude = new Set(['Orchestra']);
                        store.tagFilterExclude = new Set(['Christmas']);
                        return [4 /*yield*/, vitest_1.vi.waitFor(function () {
                                var raw = localStorage.getItem('wp:tagFilter:v2:org-1:uid-1');
                                (0, vitest_1.expect)(raw).not.toBeNull();
                            })];
                    case 2:
                        _a.sent();
                        raw = localStorage.getItem('wp:tagFilter:v2:org-1:uid-1');
                        parsed = JSON.parse(raw);
                        (0, vitest_1.expect)(parsed.include).toEqual(['Orchestra']);
                        (0, vitest_1.expect)(parsed.exclude).toEqual(['Christmas']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not read or write localStorage when uid is missing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = null;
                        mockAuthOrgId = 'org-1';
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        store.tagFilterInclude = new Set(['Christmas']);
                        (0, vitest_1.expect)(localStorage.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not read or write localStorage when org is missing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-1' };
                        mockAuthOrgId = null;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        // subscribe() sets orgId.value, but tagFilterStorageKey falls back to auth.orgId
                        // when orgId.value is set via subscribe — so simulate missing auth entirely by
                        // not calling subscribe (orgId.value stays null) and auth.orgId also null.
                        store.tagFilterInclude = new Set(['Christmas']);
                        (0, vitest_1.expect)(localStorage.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('hydrates tagFilterInclude/tagFilterExclude from localStorage on subscribe', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-2' };
                        mockAuthOrgId = 'org-2';
                        localStorage.setItem('wp:tagFilter:v2:org-2:uid-2', JSON.stringify({ include: ['Easter', 'Advent'], exclude: ['Christmas'] }));
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-2');
                        (0, vitest_1.expect)(Array.from(store.tagFilterInclude)).toEqual(['Easter', 'Advent']);
                        (0, vitest_1.expect)(Array.from(store.tagFilterExclude)).toEqual(['Christmas']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('silently ignores corrupt localStorage JSON and keeps in-memory defaults', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-3' };
                        mockAuthOrgId = 'org-3';
                        localStorage.setItem('wp:tagFilter:v2:org-3:uid-3', '{not valid json');
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)(function () { return store.subscribe('org-3'); }).not.toThrow();
                        (0, vitest_1.expect)(store.tagFilterInclude.size).toBe(0);
                        (0, vitest_1.expect)(store.tagFilterExclude.size).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('silently ignores localStorage.setItem failures (quota/private mode)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var setItemSpy, useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-4' };
                        mockAuthOrgId = 'org-4';
                        setItemSpy = vitest_1.vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function () {
                            throw new Error('QuotaExceededError');
                        });
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-4');
                        (0, vitest_1.expect)(function () {
                            store.tagFilterInclude = new Set(['Christmas']);
                        }).not.toThrow();
                        setItemSpy.mockRestore();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('resets in-memory tag filter when switching to a user/org with no stored entry (WR-01, T-12-03)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // User A has a non-default tag filter saved and active in memory.
                        mockAuthUser = { uid: 'uid-a' };
                        mockAuthOrgId = 'org-a';
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-a');
                        store.tagFilterInclude = new Set(['Orchestra']);
                        store.tagFilterExclude = new Set(['Christmas']);
                        return [4 /*yield*/, vitest_1.vi.waitFor(function () {
                                (0, vitest_1.expect)(localStorage.getItem('wp:tagFilter:v2:org-a:uid-a')).not.toBeNull();
                            })];
                    case 2:
                        _a.sent();
                        (0, vitest_1.expect)(store.tagFilterInclude.size).toBe(1);
                        (0, vitest_1.expect)(store.tagFilterExclude.size).toBe(1);
                        // User B logs in within the same tab/session (singleton store) — no
                        // stored filter exists yet for User B's user/org key.
                        mockAuthUser = { uid: 'uid-b' };
                        mockAuthOrgId = 'org-b';
                        store.subscribe('org-b');
                        // User A's in-memory selection must NOT leak into User B's session.
                        (0, vitest_1.expect)(store.tagFilterInclude.size).toBe(0);
                        (0, vitest_1.expect)(store.tagFilterExclude.size).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('column visibility (D-08/D-09/D-10)', function () {
        (0, vitest_1.it)('defaults all six toggleable columns to visible, with no title key', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)(store.columnVisibility).toEqual({
                            category: true,
                            key: true,
                            ccli: true,
                            lastUsed: true,
                            tags: true,
                            themes: true,
                        });
                        (0, vitest_1.expect)('title' in store.columnVisibility).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('toggleColumn flips only the targeted key', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.toggleColumn('tags');
                        (0, vitest_1.expect)(store.columnVisibility.tags).toBe(false);
                        (0, vitest_1.expect)(store.columnVisibility.category).toBe(true);
                        (0, vitest_1.expect)(store.columnVisibility.key).toBe(true);
                        (0, vitest_1.expect)(store.columnVisibility.ccli).toBe(true);
                        (0, vitest_1.expect)(store.columnVisibility.lastUsed).toBe(true);
                        (0, vitest_1.expect)(store.columnVisibility.themes).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('resetColumns restores every key to true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.toggleColumn('tags');
                        store.toggleColumn('key');
                        store.resetColumns();
                        (0, vitest_1.expect)(store.columnVisibility).toEqual({
                            category: true,
                            key: true,
                            ccli: true,
                            lastUsed: true,
                            tags: true,
                            themes: true,
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('column-visibility persistence (D-08/D-09/D-10)', function () {
        (0, vitest_1.it)('persists columnVisibility to localStorage under a per-user/org namespaced key on change', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store, raw, parsed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-1' };
                        mockAuthOrgId = 'org-1';
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        store.toggleColumn('tags');
                        return [4 /*yield*/, vitest_1.vi.waitFor(function () {
                                var raw = localStorage.getItem('wp:songTableColumns:v1:org-1:uid-1');
                                (0, vitest_1.expect)(raw).not.toBeNull();
                            })];
                    case 2:
                        _a.sent();
                        raw = localStorage.getItem('wp:songTableColumns:v1:org-1:uid-1');
                        parsed = JSON.parse(raw);
                        (0, vitest_1.expect)(parsed.tags).toBe(false);
                        (0, vitest_1.expect)(parsed.category).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not read or write localStorage when uid is missing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = null;
                        mockAuthOrgId = 'org-1';
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-1');
                        store.toggleColumn('tags');
                        (0, vitest_1.expect)(localStorage.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not read or write localStorage when org is missing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-1' };
                        mockAuthOrgId = null;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.toggleColumn('tags');
                        (0, vitest_1.expect)(localStorage.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('hydrates columnVisibility from localStorage on subscribe', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-2' };
                        mockAuthOrgId = 'org-2';
                        localStorage.setItem('wp:songTableColumns:v1:org-2:uid-2', JSON.stringify({ category: false, key: true, ccli: true, lastUsed: true, tags: true, themes: true }));
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-2');
                        (0, vitest_1.expect)(store.columnVisibility.category).toBe(false);
                        (0, vitest_1.expect)(store.columnVisibility.tags).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('resets to all-true when the saved payload is corrupt', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-3' };
                        mockAuthOrgId = 'org-3';
                        localStorage.setItem('wp:songTableColumns:v1:org-3:uid-3', '{not valid json');
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        (0, vitest_1.expect)(function () { return store.subscribe('org-3'); }).not.toThrow();
                        (0, vitest_1.expect)(store.columnVisibility).toEqual({
                            category: true,
                            key: true,
                            ccli: true,
                            lastUsed: true,
                            tags: true,
                            themes: true,
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('resets to all-true when no saved key exists', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-4' };
                        mockAuthOrgId = 'org-4';
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-4');
                        (0, vitest_1.expect)(store.columnVisibility).toEqual({
                            category: true,
                            key: true,
                            ccli: true,
                            lastUsed: true,
                            tags: true,
                            themes: true,
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('merges hydrated keys over the default map so a newly-added column key defaults visible', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useSongStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockAuthUser = { uid: 'uid-5' };
                        mockAuthOrgId = 'org-5';
                        // Simulate an older saved payload missing the 'themes' key entirely.
                        localStorage.setItem('wp:songTableColumns:v1:org-5:uid-5', JSON.stringify({ category: false, key: true, ccli: true, lastUsed: true, tags: true }));
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../songs'); })];
                    case 1:
                        useSongStore = (_a.sent()).useSongStore;
                        store = useSongStore();
                        store.subscribe('org-5');
                        (0, vitest_1.expect)(store.columnVisibility.category).toBe(false);
                        (0, vitest_1.expect)(store.columnVisibility.themes).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
