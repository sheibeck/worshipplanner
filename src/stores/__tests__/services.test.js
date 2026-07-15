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
// Mock crypto.getRandomValues for deterministic token generation
vitest_1.vi.stubGlobal('crypto', {
    getRandomValues: vitest_1.vi.fn(function (arr) {
        for (var i = 0; i < arr.length; i++)
            arr[i] = i + 1;
        return arr;
    }),
});
// Track onSnapshot callbacks and unsubscribe fns
var snapshotCallback = null;
var mockUnsubscribe = vitest_1.vi.fn();
// Mock firebase/firestore module
vitest_1.vi.mock('firebase/firestore', function () {
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
        addDoc: vitest_1.vi.fn(function () { return Promise.resolve({ id: 'new-service-id' }); }),
        updateDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        deleteDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        setDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
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
// Mock the useSongStore for cross-store writes
var mockUpdateSong = vitest_1.vi.fn(function () { return Promise.resolve(); });
vitest_1.vi.mock('@/stores/songs', function () { return ({
    useSongStore: vitest_1.vi.fn(function () { return ({
        updateSong: mockUpdateSong,
        songs: [
            {
                id: 'song-abc',
                title: 'Amazing Grace',
                ccliNumber: '12345',
                arrangements: [
                    { key: 'G', bpm: 120 },
                    { key: 'C', bpm: 110 },
                ],
            },
        ],
    }); }),
}); });
function makeService(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'service-1', date: '2026-03-08', name: 'Sunday Service', progression: '1-2-2-3', teams: [], status: 'draft', slots: [], sermonPassage: null, notes: '', createdAt: { seconds: 1000000, nanoseconds: 0 }, updatedAt: { seconds: 1000000, nanoseconds: 0 } }, overrides);
}
function triggerSnapshot(services) {
    if (snapshotCallback) {
        snapshotCallback({
            docs: services.map(function (s) { return ({
                id: s.id,
                data: function () {
                    var _id = s.id, rest = __rest(s, ["id"]);
                    return rest;
                },
            }); }),
        });
    }
}
(0, vitest_1.describe)('useServiceStore', function () {
    (0, vitest_1.beforeEach)(function () {
        (0, pinia_1.setActivePinia)((0, pinia_1.createPinia)());
        vitest_1.vi.clearAllMocks();
        snapshotCallback = null;
    });
    (0, vitest_1.describe)('initial state', function () {
        (0, vitest_1.it)('starts with empty services array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        (0, vitest_1.expect)(store.services).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('starts with isLoading true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        (0, vitest_1.expect)(store.isLoading).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe / onSnapshot', function () {
        (0, vitest_1.it)('subscribe calls onSnapshot on the org services collection', function () { return __awaiter(void 0, void 0, void 0, function () {
            var onSnapshot, useServiceStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        onSnapshot = (_a.sent()).onSnapshot;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        (0, vitest_1.expect)(onSnapshot).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('populates services from snapshot with { id, ...data } mapping', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store, service;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        service = makeService();
                        triggerSnapshot([service]);
                        (0, vitest_1.expect)(store.services).toHaveLength(1);
                        (0, vitest_1.expect)(store.services[0].id).toBe('service-1');
                        (0, vitest_1.expect)(store.services[0].date).toBe('2026-03-08');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('sets isLoading to false after first snapshot', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        triggerSnapshot([]);
                        (0, vitest_1.expect)(store.isLoading).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('unsubscribeAll calls the unsubscribe fn and resets state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store, service;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        service = makeService();
                        triggerSnapshot([service]);
                        (0, vitest_1.expect)(store.services).toHaveLength(1);
                        store.unsubscribeAll();
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalled();
                        (0, vitest_1.expect)(store.services).toEqual([]);
                        (0, vitest_1.expect)(store.isLoading).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('calling subscribe again unsubscribes previous listener first', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        store.subscribe('org-2');
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('createService', function () {
        (0, vitest_1.it)('calls addDoc with correct shape including serverTimestamp', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, addDoc, serverTimestamp, useServiceStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), addDoc = _a.addDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_b.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createService({
                                date: '2026-03-08',
                                name: '',
                                teams: [],
                            })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.date).toBe('2026-03-08');
                        (0, vitest_1.expect)(data.progression).toBe('1-2-2-3');
                        (0, vitest_1.expect)(data.createdAt).toBeDefined();
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createService builds a 9-slot template from progression', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useServiceStore, store, callArgs, data, slots;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createService({
                                date: '2026-03-08',
                                name: '',
                                teams: [],
                            })];
                    case 3:
                        _a.sent();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        slots = data.slots;
                        (0, vitest_1.expect)(slots).toHaveLength(9);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createService 1-2-2-3: song slots get correct VW types', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useServiceStore, store, callArgs, data, slots, songSlots;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createService({
                                date: '2026-03-08',
                                name: '',
                                teams: [],
                            })];
                    case 3:
                        _a.sent();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        slots = data.slots;
                        songSlots = slots.filter(function (s) { return s.kind === 'SONG'; });
                        (0, vitest_1.expect)(songSlots).toHaveLength(5);
                        (0, vitest_1.expect)(songSlots[0].requiredVwType).toBe(1); // position 0
                        (0, vitest_1.expect)(songSlots[1].requiredVwType).toBe(2); // position 2
                        (0, vitest_1.expect)(songSlots[2].requiredVwType).toBe(2); // position 5
                        (0, vitest_1.expect)(songSlots[3].requiredVwType).toBe(3); // position 6
                        (0, vitest_1.expect)(songSlots[4].requiredVwType).toBe(3); // position 8
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createService 1-2-3-3: song slots get correct VW types', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useServiceStore, store, callArgs, data, slots, songSlots;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createService({
                                date: '2026-03-15',
                                name: '',
                                teams: [],
                            })];
                    case 3:
                        _a.sent();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        slots = data.slots;
                        songSlots = slots.filter(function (s) { return s.kind === 'SONG'; });
                        (0, vitest_1.expect)(songSlots[0].requiredVwType).toBe(1);
                        (0, vitest_1.expect)(songSlots[1].requiredVwType).toBe(2);
                        (0, vitest_1.expect)(songSlots[2].requiredVwType).toBe(2);
                        (0, vitest_1.expect)(songSlots[3].requiredVwType).toBe(3);
                        (0, vitest_1.expect)(songSlots[4].requiredVwType).toBe(3);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createService sets status to draft', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useServiceStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createService({
                                date: '2026-03-08',
                                name: '',
                                teams: [],
                            })];
                    case 3:
                        _a.sent();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.status).toBe('draft');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createService returns the new document id', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createService({
                                date: '2026-03-08',
                                name: '',
                                teams: [],
                            })];
                    case 2:
                        id = _a.sent();
                        (0, vitest_1.expect)(id).toBe('new-service-id');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('updateService', function () {
        (0, vitest_1.it)('calls updateDoc with serverTimestamp for updatedAt', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, updateDoc, serverTimestamp, useServiceStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), updateDoc = _a.updateDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_b.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.updateService('service-1', { notes: 'Updated notes' })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.notes).toBe('Updated notes');
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('deleteService', function () {
        (0, vitest_1.it)('calls deleteDoc with the correct doc reference', function () { return __awaiter(void 0, void 0, void 0, function () {
            var deleteDoc, useServiceStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        deleteDoc = (_a.sent()).deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.deleteService('service-1')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(deleteDoc).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('assignSongToSlot', function () {
        (0, vitest_1.it)('calls updateService with updated slots when assigning a song', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useServiceStore, store, slots, callArgs, data, updatedSlots, slot0;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        slots = [
                            { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
                            { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null },
                            { kind: 'SONG', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
                            { kind: 'PRAYER', position: 3 },
                            { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
                            { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
                            { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
                            { kind: 'MESSAGE', position: 7 },
                            { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
                        ];
                        triggerSnapshot([makeService({ id: 'service-1', slots: slots })]);
                        return [4 /*yield*/, store.assignSongToSlot('service-1', 0, {
                                id: 'song-abc',
                                title: 'Amazing Grace',
                                key: 'G',
                            })];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        updatedSlots = data.slots;
                        slot0 = updatedSlots.find(function (s) { return s.position === 0; });
                        (0, vitest_1.expect)(slot0 === null || slot0 === void 0 ? void 0 : slot0.songId).toBe('song-abc');
                        (0, vitest_1.expect)(slot0 === null || slot0 === void 0 ? void 0 : slot0.songTitle).toBe('Amazing Grace');
                        (0, vitest_1.expect)(slot0 === null || slot0 === void 0 ? void 0 : slot0.songKey).toBe('G');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('calls useSongStore().updateSong with lastUsedAt serverTimestamp (cross-store link)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store, slots, _a, songId, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_b.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        slots = [
                            { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
                        ];
                        triggerSnapshot([makeService({ id: 'service-1', slots: slots })]);
                        return [4 /*yield*/, store.assignSongToSlot('service-1', 0, {
                                id: 'song-abc',
                                title: 'Amazing Grace',
                                key: 'G',
                            })];
                    case 2:
                        _b.sent();
                        (0, vitest_1.expect)(mockUpdateSong).toHaveBeenCalledOnce();
                        _a = mockUpdateSong.mock.calls[0], songId = _a[0], data = _a[1];
                        (0, vitest_1.expect)(songId).toBe('song-abc');
                        (0, vitest_1.expect)(data.lastUsedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('clearSongFromSlot', function () {
        (0, vitest_1.it)('calls updateService with null fields on the target slot', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useServiceStore, store, slots, callArgs, data, updatedSlots, slot0;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        slots = [
                            { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-abc', songTitle: 'Amazing Grace', songKey: 'G' },
                        ];
                        triggerSnapshot([makeService({ id: 'service-1', slots: slots })]);
                        return [4 /*yield*/, store.clearSongFromSlot('service-1', 0)];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        updatedSlots = data.slots;
                        slot0 = updatedSlots.find(function (s) { return s.position === 0; });
                        (0, vitest_1.expect)(slot0 === null || slot0 === void 0 ? void 0 : slot0.songId).toBeNull();
                        (0, vitest_1.expect)(slot0 === null || slot0 === void 0 ? void 0 : slot0.songTitle).toBeNull();
                        (0, vitest_1.expect)(slot0 === null || slot0 === void 0 ? void 0 : slot0.songKey).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('createShareToken', function () {
        (0, vitest_1.it)('createShareToken returns a 36-character hex string', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useServiceStore, store, service, token;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 1:
                        useServiceStore = (_a.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        service = makeService();
                        return [4 /*yield*/, store.createShareToken(service, 'org-1')];
                    case 2:
                        token = _a.sent();
                        (0, vitest_1.expect)(token).toHaveLength(36);
                        (0, vitest_1.expect)(token).toMatch(/^[0-9a-f]{36}$/);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createShareToken calls setDoc with token as document ID', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, setDoc, doc, useServiceStore, store, service, token, _b, docRef, data, writeData, snapshot;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _c.sent(), setDoc = _a.setDoc, doc = _a.doc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_c.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        service = makeService();
                        return [4 /*yield*/, store.createShareToken(service, 'org-1')];
                    case 3:
                        token = _c.sent();
                        (0, vitest_1.expect)(setDoc).toHaveBeenCalledOnce();
                        _b = vitest_1.vi.mocked(setDoc).mock.calls[0], docRef = _b[0], data = _b[1];
                        (0, vitest_1.expect)(docRef.id).toBe(token);
                        writeData = data;
                        (0, vitest_1.expect)(writeData.serviceId).toBe(service.id);
                        (0, vitest_1.expect)(writeData.orgId).toBe('org-1');
                        (0, vitest_1.expect)(writeData.serviceSnapshot).toBeDefined();
                        snapshot = writeData.serviceSnapshot;
                        (0, vitest_1.expect)(snapshot.date).toBe(service.date);
                        (0, vitest_1.expect)(snapshot.notes).toBe(service.notes);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('createShareToken embeds BPM from song store into song slots', function () { return __awaiter(void 0, void 0, void 0, function () {
            var setDoc, useServiceStore, store, slots, service, _a, data, writeData, snapshot, snapshotSlots, songSlot;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        setDoc = (_b.sent()).setDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../services'); })];
                    case 2:
                        useServiceStore = (_b.sent()).useServiceStore;
                        store = useServiceStore();
                        store.subscribe('org-1');
                        slots = [
                            { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-abc', songTitle: 'Amazing Grace', songKey: 'G' },
                        ];
                        service = makeService({ slots: slots });
                        return [4 /*yield*/, store.createShareToken(service, 'org-1')];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(setDoc).toHaveBeenCalledOnce();
                        _a = vitest_1.vi.mocked(setDoc).mock.calls[0], data = _a[1];
                        writeData = data;
                        snapshot = writeData.serviceSnapshot;
                        snapshotSlots = snapshot.slots;
                        songSlot = snapshotSlots.find(function (s) { return s.position === 0; });
                        (0, vitest_1.expect)(songSlot === null || songSlot === void 0 ? void 0 : songSlot.bpm).toBe(120);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
