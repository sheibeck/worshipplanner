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
// Mock crypto.getRandomValues for deterministic token generation (Task 3)
vitest_1.vi.stubGlobal('crypto', {
    getRandomValues: vitest_1.vi.fn(function (arr) {
        for (var i = 0; i < arr.length; i++)
            arr[i] = i + 1;
        return arr;
    }),
});
var snapshotCallbacks = {};
var mockUnsubscribe = vitest_1.vi.fn();
// Mutable org doc fixture read by finalizeAndShare's slug resolution (Plan 16-09) — tests
// override the shape per-case; reset to a slug-less default in beforeEach below.
var mockOrgDoc = { name: 'Test Org' };
// Doc paths that getDoc should report as existing (beyond the org doc) — used by
// deleteQuarter tests to simulate present shareTokens/quarterShares docs. Reset per test.
var mockExistingSharePaths = new Set();
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
        onSnapshot: vitest_1.vi.fn(function (queryRef, callback) {
            var _a;
            var path = (_a = queryRef.path) !== null && _a !== void 0 ? _a : 'unknown';
            snapshotCallbacks[path] = callback;
            return mockUnsubscribe;
        }),
        addDoc: vitest_1.vi.fn(function () { return Promise.resolve({ id: 'new-quarter-id' }); }),
        updateDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        setDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        deleteDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        getDoc: vitest_1.vi.fn(function (docRef) {
            if ((docRef === null || docRef === void 0 ? void 0 : docRef.path) && /^organizations\/[^/]+$/.test(docRef.path)) {
                return Promise.resolve({
                    exists: function () { return Object.keys(mockOrgDoc).length > 0; },
                    data: function () { return mockOrgDoc; },
                });
            }
            if ((docRef === null || docRef === void 0 ? void 0 : docRef.path) && mockExistingSharePaths.has(docRef.path)) {
                return Promise.resolve({ exists: function () { return true; }, data: function () { return ({}); } });
            }
            return Promise.resolve({ exists: function () { return false; }, data: function () { return ({}); } });
        }),
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
// Mock the pure scheduler so propose-bridge tests can assert call arguments directly
// (the scheduler's internal algorithm is already exhaustively covered by scheduler.test.ts).
var mockProposeQuarterSchedule = vitest_1.vi.fn();
vitest_1.vi.mock('@/utils/scheduler', function () { return ({
    proposeQuarterSchedule: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return mockProposeQuarterSchedule.apply(void 0, args);
    },
}); });
// Mock the roster store — quarters.ts reads activePeople/roles/people and upserts standing fields.
var mockUpdatePerson = vitest_1.vi.fn(function () { return Promise.resolve(); });
var mockRosterState = {
    people: [],
    roles: [],
};
vitest_1.vi.mock('@/stores/roster', function () { return ({
    useRosterStore: vitest_1.vi.fn(function () { return ({
        get people() {
            return mockRosterState.people;
        },
        get activePeople() {
            // Mirror the real store: activePeople is the active subset of people.
            return mockRosterState.people.filter(function (p) { return p.active; });
        },
        get roles() {
            return mockRosterState.roles;
        },
        updatePerson: mockUpdatePerson,
    }); }),
}); });
function makePerson(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'person-1', name: 'Sarah Smith', email: 'sarah@example.com', phone: '', active: true, roles: [], pcPersonId: null, createdAt: { seconds: 1000000, nanoseconds: 0 }, updatedAt: { seconds: 1000000, nanoseconds: 0 } }, overrides);
}
function makeRole(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 }, overrides);
}
function makeQuarterDoc(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'quarter-1', label: 'Q3 2026', year: 2026, quarter: 3, serviceDates: ['2026-07-05', '2026-07-12'], roleOverridesByDate: {}, personQuarterData: {}, calendar: {}, status: 'draft', shareToken: null, createdAt: { seconds: 1000000, nanoseconds: 0 }, updatedAt: { seconds: 1000000, nanoseconds: 0 } }, overrides);
}
function triggerQuartersSnapshot(quarters) {
    var cb = snapshotCallbacks['organizations/org-1/quarters'];
    if (cb) {
        cb({
            docs: quarters.map(function (q) { return ({
                id: q.id,
                data: function () {
                    var _id = q.id, rest = __rest(q, ["id"]);
                    return rest;
                },
            }); }),
        });
    }
}
(0, vitest_1.describe)('useQuartersStore', function () {
    (0, vitest_1.beforeEach)(function () {
        (0, pinia_1.setActivePinia)((0, pinia_1.createPinia)());
        vitest_1.vi.clearAllMocks();
        for (var _i = 0, _a = Object.keys(snapshotCallbacks); _i < _a.length; _i++) {
            var key = _a[_i];
            delete snapshotCallbacks[key];
        }
        mockRosterState.people = [];
        mockRosterState.roles = [];
        mockOrgDoc = { name: 'Test Org' };
        mockExistingSharePaths = new Set();
    });
    (0, vitest_1.describe)('initial state', function () {
        (0, vitest_1.it)('starts with empty quarters array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        (0, vitest_1.expect)(store.quarters).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe / onSnapshot', function () {
        (0, vitest_1.it)('subscribe calls onSnapshot ordered by createdAt desc on the org quarters collection', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, onSnapshot, orderBy, useQuartersStore, store;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), onSnapshot = _a.onSnapshot, orderBy = _a.orderBy;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_b.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        (0, vitest_1.expect)(onSnapshot).toHaveBeenCalled();
                        (0, vitest_1.expect)(snapshotCallbacks['organizations/org-1/quarters']).toBeDefined();
                        (0, vitest_1.expect)(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('populates quarters from snapshot with { id, ...data } mapping', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc()]);
                        (0, vitest_1.expect)(store.quarters).toHaveLength(1);
                        (0, vitest_1.expect)(store.quarters[0].id).toBe('quarter-1');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('unsubscribeAll calls the unsubscribe fn and resets state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc()]);
                        store.unsubscribeAll();
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalled();
                        (0, vitest_1.expect)(store.quarters).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('createQuarter (D-01, D-06)', function () {
        (0, vitest_1.it)('creates a quarter doc with generated Sundays and empty quarter-scoped maps when no people exist', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useQuartersStore, generateSundaysInQuarter, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('@/utils/quarterDates'); })];
                    case 3:
                        generateSundaysInQuarter = (_a.sent()).generateSundaysInQuarter;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.createQuarter(2026, 3, 'Q3 2026')];
                    case 4:
                        _a.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(addDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data.serviceDates).toEqual(generateSundaysInQuarter(2026, 3));
                        (0, vitest_1.expect)(data.roleOverridesByDate).toEqual({});
                        (0, vitest_1.expect)(data.personQuarterData).toEqual({});
                        (0, vitest_1.expect)(data.calendar).toEqual({});
                        (0, vitest_1.expect)(data.status).toBe('draft');
                        (0, vitest_1.expect)(data.shareToken).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('seeds each (person, role) frequency to once/month default (N=4) when there is no prior quarter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        mockRosterState.people = [makePerson({ id: 'person-a', roles: ['role-guitar'] })];
                        return [4 /*yield*/, store.createQuarter(2026, 3, 'Q3 2026')];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(addDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-a'].roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 4 } });
                        (0, vitest_1.expect)(pqd['person-a'].pairedWith).toEqual([]);
                        (0, vitest_1.expect)(pqd['person-a'].blackoutDates).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('seeds per-role frequency and pairing from the chronologically prior quarter, always resetting blackout', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                id: 'quarter-q2',
                                year: 2026,
                                quarter: 2,
                                personQuarterData: {
                                    'person-a': {
                                        personId: 'person-a',
                                        blackoutDates: ['2026-04-05'],
                                        pairedWith: ['person-b'],
                                        roleFrequency: { 'role-guitar': { tier: 'regular', n: 2 } },
                                    },
                                },
                            }),
                        ]);
                        mockRosterState.people = [makePerson({ id: 'person-a', roles: ['role-guitar'] })];
                        return [4 /*yield*/, store.createQuarter(2026, 3, 'Q3 2026')];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(addDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-a'].roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 2 } });
                        (0, vitest_1.expect)(pqd['person-a'].pairedWith).toEqual(['person-b']);
                        (0, vitest_1.expect)(pqd['person-a'].blackoutDates).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('picks the chronologically nearest prior quarter, not just any earlier quarter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                id: 'quarter-q1',
                                year: 2026,
                                quarter: 1,
                                personQuarterData: {
                                    'person-a': {
                                        personId: 'person-a',
                                        blackoutDates: [],
                                        pairedWith: [],
                                        roleFrequency: { 'role-guitar': { tier: 'regular', n: 1 } },
                                    },
                                },
                            }),
                            makeQuarterDoc({
                                id: 'quarter-q2',
                                year: 2026,
                                quarter: 2,
                                personQuarterData: {
                                    'person-a': {
                                        personId: 'person-a',
                                        blackoutDates: [],
                                        pairedWith: [],
                                        roleFrequency: { 'role-guitar': { tier: 'regular', n: 3 } },
                                    },
                                },
                            }),
                        ]);
                        mockRosterState.people = [makePerson({ id: 'person-a', roles: ['role-guitar'] })];
                        return [4 /*yield*/, store.createQuarter(2026, 3, 'Q3 2026')];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(addDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-a'].roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 3 } });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('addServiceDate / removeServiceDate', function () {
        (0, vitest_1.it)('addServiceDate adds a sorted, de-duplicated date via updateDoc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ serviceDates: ['2026-07-05', '2026-07-12'] }),
                        ]);
                        return [4 /*yield*/, store.addServiceDate('quarter-1', '2026-07-01')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data.serviceDates).toEqual(['2026-07-01', '2026-07-05', '2026-07-12']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('removeServiceDate removes a date via updateDoc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ serviceDates: ['2026-07-05', '2026-07-12'] }),
                        ]);
                        return [4 /*yield*/, store.removeServiceDate('quarter-1', '2026-07-05')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data.serviceDates).toEqual(['2026-07-12']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('addServiceDate de-duplicates when the date already exists', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ serviceDates: ['2026-07-05', '2026-07-12'] }),
                        ]);
                        return [4 /*yield*/, store.addServiceDate('quarter-1', '2026-07-05')];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data.serviceDates).toEqual(['2026-07-05', '2026-07-12']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('setRoleOverrideForDate (D-02)', function () {
        (0, vitest_1.it)('stores config under roleOverridesByDate[date] without disturbing other dates', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data, overrides;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                roleOverridesByDate: {
                                    '2026-07-05': [{ roleId: 'role-guitar', count: 2 }],
                                },
                            }),
                        ]);
                        return [4 /*yield*/, store.setRoleOverrideForDate('quarter-1', '2026-07-12', [{ roleId: 'role-drums', count: 1 }])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        overrides = data.roleOverridesByDate;
                        (0, vitest_1.expect)(overrides['2026-07-05']).toEqual([{ roleId: 'role-guitar', count: 2 }]);
                        (0, vitest_1.expect)(overrides['2026-07-12']).toEqual([{ roleId: 'role-drums', count: 1 }]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('applyCsvToQuarter — per-person replace (D-19)', function () {
        (0, vitest_1.it)('replaces present persons personQuarterData wholesale and upserts standing fields', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                personQuarterData: {
                                    'person-a': { personId: 'person-a', blackoutDates: ['2026-07-05'], pairedWith: [] },
                                },
                            }),
                        ]);
                        return [4 /*yield*/, store.applyCsvToQuarter('quarter-1', [
                                {
                                    personId: 'person-a',
                                    standing: { name: 'Person A', roles: ['role-guitar'] },
                                    blackoutDates: ['2026-07-12'],
                                    pairedWith: [],
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(mockUpdatePerson).toHaveBeenCalledWith('person-a', { name: 'Person A', roles: ['role-guitar'] });
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-a'].blackoutDates).toEqual(['2026-07-12']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('writes the per-role roleFrequency resolved from the CSV Frequency column onto the quarter entry (no standing frequency write, D-04/D-05)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ personQuarterData: {} })]);
                        return [4 /*yield*/, store.applyCsvToQuarter('quarter-1', [
                                {
                                    personId: 'person-a',
                                    standing: { name: 'Person A', roles: ['role-guitar'] },
                                    blackoutDates: [],
                                    pairedWith: [],
                                    roleFrequency: { 'role-guitar': { tier: 'regular', n: 2 } },
                                },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(mockUpdatePerson).toHaveBeenCalledWith('person-a', { name: 'Person A', roles: ['role-guitar'] });
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-a'].roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 2 } });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('leaves an absent persons personQuarterData entry unchanged', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                personQuarterData: {
                                    'person-c': { personId: 'person-c', blackoutDates: ['2026-07-19'], pairedWith: [] },
                                },
                            }),
                        ]);
                        return [4 /*yield*/, store.applyCsvToQuarter('quarter-1', [
                                {
                                    personId: 'person-a',
                                    standing: { name: 'Person A' },
                                    blackoutDates: [],
                                    pairedWith: [],
                                },
                            ])];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-c']).toEqual({ personId: 'person-c', blackoutDates: ['2026-07-19'], pairedWith: [] });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('applies pairings bidirectionally', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data, pqd;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ personQuarterData: {} })]);
                        return [4 /*yield*/, store.applyCsvToQuarter('quarter-1', [
                                {
                                    personId: 'person-a',
                                    standing: { name: 'Person A' },
                                    blackoutDates: [],
                                    pairedWith: ['person-b'],
                                },
                            ])];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        pqd = data.personQuarterData;
                        (0, vitest_1.expect)(pqd['person-a'].pairedWith).toEqual(['person-b']);
                        (0, vitest_1.expect)(pqd['person-b'].pairedWith).toEqual(['person-a']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('setPersonAvailability (D-03, D-04, D-05, D-06)', function () {
        function seedJuliaPairedWithLisa() {
            triggerQuartersSnapshot([
                makeQuarterDoc({
                    personQuarterData: {
                        julia: {
                            personId: 'julia',
                            blackoutDates: ['2026-07-05'],
                            pairedWith: ['lisa'],
                            roleFrequency: {},
                            note: 'old note',
                        },
                        lisa: {
                            personId: 'lisa',
                            blackoutDates: [],
                            pairedWith: ['julia'],
                            roleFrequency: {},
                            note: '',
                        },
                    },
                }),
            ]);
        }
        (0, vitest_1.it)('writes the own entry under personQuarterData.{personId} with all four fields', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaPairedWithLisa();
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: ['2026-07-19'],
                                pairedWith: ['dean'],
                                note: 'x',
                                roleFrequency: {},
                            })];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['personQuarterData.julia']).toEqual({
                            personId: 'julia',
                            blackoutDates: ['2026-07-19'],
                            pairedWith: ['dean'],
                            note: 'x',
                            roleFrequency: {},
                        });
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('reciprocally adds this person to a newly paired partner who did not previously list them', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data, deanEntry, deanPairedPath, deanPairedWith;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_b.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_b.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaPairedWithLisa();
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: ['2026-07-19'],
                                pairedWith: ['dean'],
                                note: 'x',
                                roleFrequency: {},
                            })];
                    case 3:
                        _b.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        deanEntry = data['personQuarterData.dean'];
                        deanPairedPath = data['personQuarterData.dean.pairedWith'];
                        deanPairedWith = (_a = deanEntry === null || deanEntry === void 0 ? void 0 : deanEntry.pairedWith) !== null && _a !== void 0 ? _a : deanPairedPath;
                        (0, vitest_1.expect)(deanPairedWith).toContain('julia');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('reciprocally removes this person from a dropped partners pairedWith without touching other fields', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaPairedWithLisa();
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: ['2026-07-19'],
                                pairedWith: ['dean'],
                                note: 'x',
                                roleFrequency: {},
                            })];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['personQuarterData.lisa.pairedWith']).toEqual([]);
                        // scoping: partner remove must only touch pairedWith, never rewrite lisa's whole entry
                        (0, vitest_1.expect)(data['personQuarterData.lisa']).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('never writes the bare personQuarterData map key', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaPairedWithLisa();
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: ['2026-07-19'],
                                pairedWith: ['dean'],
                                note: 'x',
                                roleFrequency: {},
                            })];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data.personQuarterData).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('persists roleFrequency inside the scoped personQuarterData.{personId} write, never as a bare root key (D-04/D-05)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaPairedWithLisa();
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: ['2026-07-19'],
                                pairedWith: ['dean'],
                                note: 'x',
                                roleFrequency: { vocals: { tier: 'out', n: 4 }, guitar: { tier: 'regular', n: 4 } },
                            })];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['personQuarterData.julia']).toEqual({
                            personId: 'julia',
                            blackoutDates: ['2026-07-19'],
                            pairedWith: ['dean'],
                            note: 'x',
                            roleFrequency: { vocals: { tier: 'out', n: 4 }, guitar: { tier: 'regular', n: 4 } },
                        });
                        (0, vitest_1.expect)(data.personQuarterData).toBeUndefined();
                        // scoping: only julia's own write is affected — lisa's entry is untouched by this call
                        // (pairing-diff writes are covered by the tests above; assert they still apply unchanged)
                        (0, vitest_1.expect)(Object.keys(data)).not.toContain('personQuarterData');
                        return [2 /*return*/];
                }
            });
        }); });
        // D-05 gap closure (15-07): the reciprocal 'added' write must not silently erase an
        // already-tuned partner's roleFrequency by reconstructing their whole PersonQuarterData.
        function seedJuliaAndDeanWithRoleFrequency() {
            triggerQuartersSnapshot([
                makeQuarterDoc({
                    personQuarterData: {
                        julia: {
                            personId: 'julia',
                            blackoutDates: [],
                            pairedWith: [],
                            roleFrequency: {},
                            note: '',
                        },
                        dean: {
                            personId: 'dean',
                            blackoutDates: ['2026-07-12'],
                            pairedWith: [],
                            roleFrequency: { 'role-guitar': { tier: 'out', n: 4 } },
                            note: 'dean note',
                        },
                    },
                }),
            ]);
        }
        (0, vitest_1.it)('existing-entry reciprocal write uses a scoped pairedWith-only sub-path, preserving the partners tuned roleFrequency (D-05 gap closure)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaAndDeanWithRoleFrequency();
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: [],
                                pairedWith: ['dean'],
                                note: '',
                                roleFrequency: {},
                            })];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        // Scoped sub-path only — a whole-object replace here would silently drop dean's roleFrequency.
                        (0, vitest_1.expect)(data['personQuarterData.dean.pairedWith']).toEqual(['julia']);
                        (0, vitest_1.expect)(data['personQuarterData.dean']).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('brand-new-partner reciprocal write seeds a complete PersonQuarterData entry with blackoutDates initialized, not a pairedWith-only partial (D-05 gap closure)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        seedJuliaPairedWithLisa(); // dean is absent from personQuarterData entirely
                        return [4 /*yield*/, store.setPersonAvailability('quarter-1', 'julia', {
                                blackoutDates: ['2026-07-19'],
                                pairedWith: ['dean'],
                                note: 'x',
                                roleFrequency: {},
                            })];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['personQuarterData.dean']).toEqual({
                            personId: 'dean',
                            blackoutDates: [],
                            pairedWith: ['julia'],
                            roleFrequency: {},
                            note: '',
                        });
                        // Must not be a partial pairedWith-only sub-path write — that would leave
                        // blackoutDates undefined and crash downstream unguarded .blackoutDates.includes() reads.
                        (0, vitest_1.expect)(data['personQuarterData.dean.pairedWith']).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('buildResolveRolesForDate', function () {
        (0, vitest_1.it)('returns per-date override when present, else default template in role.order order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store, quarter, roles, resolve;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        quarter = makeQuarterDoc({
                            roleOverridesByDate: { '2026-07-05': [{ roleId: 'role-drums', count: 2 }] },
                        });
                        roles = [
                            makeRole({ id: 'role-drums', order: 1, defaultCount: 1 }),
                            makeRole({ id: 'role-guitar', order: 0, defaultCount: 1 }),
                        ];
                        resolve = store.buildResolveRolesForDate(quarter, roles);
                        (0, vitest_1.expect)(resolve('2026-07-05')).toEqual([{ roleId: 'role-drums', count: 2 }]);
                        (0, vitest_1.expect)(resolve('2026-07-12')).toEqual([
                            { roleId: 'role-guitar', count: 1 },
                            { roleId: 'role-drums', count: 1 },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('generateProposal — propose→persist bridge', function () {
        (0, vitest_1.it)('regenerate calls proposeQuarterSchedule with existingCalendar undefined and persists result', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, result, args, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } } })]);
                        mockRosterState.people = [makePerson({ id: 'person-a' })];
                        mockRosterState.roles = [makeRole()];
                        mockProposeQuarterSchedule.mockReturnValue({
                            calendar: { '2026-07-05': { 'role-guitar': ['person-b'] } },
                            servedCounts: {},
                            unfilled: [],
                            pairingConflicts: [],
                        });
                        return [4 /*yield*/, store.generateProposal('quarter-1', 'regenerate')];
                    case 3:
                        result = _a.sent();
                        (0, vitest_1.expect)(mockProposeQuarterSchedule).toHaveBeenCalledOnce();
                        args = mockProposeQuarterSchedule.mock.calls[0];
                        (0, vitest_1.expect)(args[4]).toBeUndefined();
                        (0, vitest_1.expect)(result.calendar).toEqual({ '2026-07-05': { 'role-guitar': ['person-b'] } });
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data.calendar).toEqual({ '2026-07-05': { 'role-guitar': ['person-b'] } });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('fillGaps passes the existing calendar as existingCalendar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store, existingCalendar, args;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        existingCalendar = { '2026-07-05': { 'role-guitar': ['person-a'] } };
                        triggerQuartersSnapshot([makeQuarterDoc({ calendar: existingCalendar })]);
                        mockRosterState.people = [makePerson({ id: 'person-a' })];
                        mockRosterState.roles = [makeRole()];
                        mockProposeQuarterSchedule.mockReturnValue({
                            calendar: existingCalendar,
                            servedCounts: {},
                            unfilled: [],
                            pairingConflicts: [],
                        });
                        return [4 /*yield*/, store.generateProposal('quarter-1', 'fillGaps')];
                    case 2:
                        _a.sent();
                        args = mockProposeQuarterSchedule.mock.calls[0];
                        (0, vitest_1.expect)(args[4]).toEqual(existingCalendar);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('passes a roleGroupOf built from rosterStore.roles as the final arg (D-12 wiring)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store, args, roleGroupOf;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc()]);
                        mockRosterState.people = [makePerson({ id: 'person-a' })];
                        mockRosterState.roles = [
                            makeRole({ id: 'role-sound', name: 'sound', group: 'tech' }),
                            makeRole({ id: 'role-guitar', name: 'guitar', group: 'band' }),
                        ];
                        mockProposeQuarterSchedule.mockReturnValue({
                            calendar: {},
                            servedCounts: {},
                            unfilled: [],
                            pairingConflicts: [],
                        });
                        return [4 /*yield*/, store.generateProposal('quarter-1', 'regenerate')];
                    case 2:
                        _a.sent();
                        args = mockProposeQuarterSchedule.mock.calls[0];
                        roleGroupOf = args[5];
                        (0, vitest_1.expect)(typeof roleGroupOf).toBe('function');
                        (0, vitest_1.expect)(roleGroupOf('role-sound')).toBe('tech');
                        (0, vitest_1.expect)(roleGroupOf('role-guitar')).toBe('band');
                        (0, vitest_1.expect)(roleGroupOf('role-unknown')).toBe('other');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('end-to-end: the real scheduler never double-assigns a TECH+BAND combo to the same person on one date (group rules engaged in production)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, actualScheduler, store, result, dayAssignments, soundAssignees, guitarAssignees, inBoth;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_d.sent()).useQuartersStore;
                        return [4 /*yield*/, vitest_1.vi.importActual('@/utils/scheduler')];
                    case 2:
                        actualScheduler = _d.sent();
                        mockProposeQuarterSchedule.mockImplementation(actualScheduler.proposeQuarterSchedule);
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ serviceDates: ['2026-07-05'], calendar: {}, personQuarterData: {} }),
                        ]);
                        // A single person eligible for both a TECH role and a BAND role — without roleGroupOf
                        // wired in, the pre-15-04 scheduler would happily double-book them on the same date.
                        mockRosterState.people = [
                            makePerson({ id: 'person-a', roles: ['role-sound', 'role-guitar'] }),
                        ];
                        mockRosterState.roles = [
                            makeRole({ id: 'role-sound', name: 'sound', group: 'tech', order: 0 }),
                            makeRole({ id: 'role-guitar', name: 'guitar', group: 'band', order: 1 }),
                        ];
                        return [4 /*yield*/, store.generateProposal('quarter-1', 'regenerate')];
                    case 3:
                        result = _d.sent();
                        dayAssignments = (_a = result.calendar['2026-07-05']) !== null && _a !== void 0 ? _a : {};
                        soundAssignees = (_b = dayAssignments['role-sound']) !== null && _b !== void 0 ? _b : [];
                        guitarAssignees = (_c = dayAssignments['role-guitar']) !== null && _c !== void 0 ? _c : [];
                        inBoth = soundAssignees.includes('person-a') && guitarAssignees.includes('person-a');
                        (0, vitest_1.expect)(inBoth).toBe(false);
                        // Confirm the TECH slot won the greedy pass (deterministic — processed first by role.order)
                        // and the BAND slot was left unfilled rather than illegally double-booking person-a.
                        (0, vitest_1.expect)(soundAssignees).toEqual(['person-a']);
                        (0, vitest_1.expect)(guitarAssignees).toEqual([]);
                        (0, vitest_1.expect)(result.unfilled).toContainEqual({ date: '2026-07-05', roleId: 'role-guitar' });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('cell edits — assign/clear/swap (D-22)', function () {
        (0, vitest_1.it)('assignPerson adds a personId to the target cell without duplication', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } } }),
                        ]);
                        return [4 /*yield*/, store.assignPerson('quarter-1', '2026-07-05', 'role-guitar', 'person-b')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['calendar.2026-07-05.role-guitar']).toEqual(['person-a', 'person-b']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('clearAssignment removes one personId from the target cell', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ calendar: { '2026-07-05': { 'role-guitar': ['person-a', 'person-b'] } } }),
                        ]);
                        return [4 /*yield*/, store.clearAssignment('quarter-1', '2026-07-05', 'role-guitar', 'person-a')];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['calendar.2026-07-05.role-guitar']).toEqual(['person-b']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('swapAssignment replaces fromPersonId with toPersonId in that cell only', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                calendar: {
                                    '2026-07-05': { 'role-guitar': ['person-a'], 'role-drums': ['person-c'] },
                                },
                            }),
                        ]);
                        return [4 /*yield*/, store.swapAssignment('quarter-1', '2026-07-05', 'role-guitar', 'person-a', 'person-d')];
                    case 3:
                        _a.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(data['calendar.2026-07-05.role-guitar']).toEqual(['person-d']);
                        (0, vitest_1.expect)(data['calendar.2026-07-05.role-drums']).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('finalizeAndShare — public share token (D-21, D-24)', function () {
        (0, vitest_1.it)('generates a 36-char hex token via crypto.getRandomValues (Uint8Array(18))', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useQuartersStore, store, token, calledArg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 1:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc()]);
                        mockRosterState.people = [];
                        mockRosterState.roles = [];
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 2:
                        token = _a.sent();
                        (0, vitest_1.expect)(token).toHaveLength(36);
                        (0, vitest_1.expect)(token).toMatch(/^[0-9a-f]{36}$/);
                        (0, vitest_1.expect)(crypto.getRandomValues).toHaveBeenCalledWith(vitest_1.expect.any(Uint8Array));
                        calledArg = vitest_1.vi.mocked(crypto.getRandomValues).mock.calls[0][0];
                        (0, vitest_1.expect)(calledArg.length).toBe(18);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('writes shareTokens/{token} with a denormalized quarterSnapshot resolving person NAMES', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, setDoc, doc, useQuartersStore, store, token, shareTokenCall, _b, docRef, data, writeData, snapshot, calendar;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _c.sent(), setDoc = _a.setDoc, doc = _a.doc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_c.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                label: 'Q3 2026',
                                serviceDates: ['2026-07-05'],
                                calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } },
                            }),
                        ]);
                        mockRosterState.people = [makePerson({ id: 'person-a', name: 'Sarah Smith' })];
                        mockRosterState.roles = [makeRole({ id: 'role-guitar', name: 'guitar' })];
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 3:
                        token = _c.sent();
                        shareTokenCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === "shareTokens/".concat(token); });
                        (0, vitest_1.expect)(shareTokenCall).toBeDefined();
                        _b = shareTokenCall, docRef = _b[0], data = _b[1];
                        (0, vitest_1.expect)(docRef.id).toBe(token);
                        writeData = data;
                        (0, vitest_1.expect)(writeData.orgId).toBe('org-1');
                        (0, vitest_1.expect)(writeData.quarterId).toBe('quarter-1');
                        snapshot = writeData.quarterSnapshot;
                        (0, vitest_1.expect)(snapshot.label).toBe('Q3 2026');
                        calendar = snapshot.calendar;
                        (0, vitest_1.expect)(calendar['2026-07-05']['role-guitar']).toEqual(['Sarah Smith']);
                        (0, vitest_1.expect)(doc).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('writes quarterShares/{slug}__qN-year overwritten-in-place, reusing the names-only snapshot (R-02, Pitfall 2)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var setDoc, useQuartersStore, store, shareCall, data, snapshot, calendar;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        setDoc = (_a.sent()).setDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({
                                quarter: 3,
                                year: 2026,
                                label: 'Q3 2026',
                                serviceDates: ['2026-07-05'],
                                calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } },
                            }),
                        ]);
                        mockRosterState.people = [makePerson({ id: 'person-a', name: 'Sarah Smith' })];
                        mockRosterState.roles = [makeRole({ id: 'role-guitar', name: 'guitar' })];
                        mockOrgDoc = { name: 'Grace Church', slug: 'grace-church' };
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 3:
                        _a.sent();
                        shareCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === 'quarterShares/grace-church__q3-2026'; });
                        (0, vitest_1.expect)(shareCall).toBeDefined();
                        data = shareCall[1];
                        (0, vitest_1.expect)(data.orgSlug).toBe('grace-church');
                        snapshot = data.quarterSnapshot;
                        (0, vitest_1.expect)(snapshot.label).toBe('Q3 2026');
                        calendar = snapshot.calendar;
                        (0, vitest_1.expect)(calendar['2026-07-05']['role-guitar']).toEqual(['Sarah Smith']);
                        // D-24: names-only — no email/phone anywhere in the written payload
                        (0, vitest_1.expect)(JSON.stringify(data)).not.toMatch(/email|phone/i);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('derives and claims a slug from the org name when unset, then persists it on the org doc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, setDoc, updateDoc, useQuartersStore, store, claimCall, persistCall, shareCall;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), setDoc = _a.setDoc, updateDoc = _a.updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_b.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ quarter: 1, year: 2027 })]);
                        mockRosterState.people = [];
                        mockRosterState.roles = [];
                        mockOrgDoc = { name: 'First Church' }; // no slug yet
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 3:
                        _b.sent();
                        claimCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === 'orgSlugs/first-church'; });
                        (0, vitest_1.expect)(claimCall).toBeDefined();
                        persistCall = vitest_1.vi.mocked(updateDoc).mock.calls.find(function (call) {
                            var d = call[1];
                            return d.slug === 'first-church';
                        });
                        (0, vitest_1.expect)(persistCall).toBeDefined();
                        shareCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === 'quarterShares/first-church__q1-2027'; });
                        (0, vitest_1.expect)(shareCall).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('sets the quarter status finalized + shareToken via updateDoc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useQuartersStore, store, token, updateCall, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc()]);
                        mockRosterState.people = [];
                        mockRosterState.roles = [];
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 3:
                        token = _a.sent();
                        updateCall = vitest_1.vi.mocked(updateDoc).mock.calls.find(function (call) {
                            var d = call[1];
                            return d.status === 'finalized';
                        });
                        (0, vitest_1.expect)(updateCall).toBeDefined();
                        data = updateCall[1];
                        (0, vitest_1.expect)(data.status).toBe('finalized');
                        (0, vitest_1.expect)(data.shareToken).toBe(token);
                        return [2 /*return*/];
                }
            });
        }); });
        // WR-06 regression: an org name that derives to an empty slug (blank name, or a name
        // with no [a-z0-9] characters after lowercasing, e.g. non-Latin-script) must not throw
        // inside claimSlug — it must fall back to a generic base so the memorable-URL step
        // still succeeds instead of masking the already-succeeded opaque-token finalize.
        (0, vitest_1.it)('falls back to a generic slug base when the org name derives to an empty slug', function () { return __awaiter(void 0, void 0, void 0, function () {
            var setDoc, useQuartersStore, store, token, claimCall, shareCall;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        setDoc = (_a.sent()).setDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ quarter: 4, year: 2026 })]);
                        mockRosterState.people = [];
                        mockRosterState.roles = [];
                        // '日本語' has no [a-z0-9] characters after lowercasing — deriveSlug('日本語') === ''.
                        mockOrgDoc = { name: '日本語' };
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 3:
                        token = _a.sent();
                        (0, vitest_1.expect)(token).toHaveLength(36);
                        claimCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === 'orgSlugs/org'; });
                        (0, vitest_1.expect)(claimCall).toBeDefined();
                        shareCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === 'quarterShares/org__q4-2026'; });
                        (0, vitest_1.expect)(shareCall).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        // WR-06 regression: by the time the memorable-URL slug/quarterShares write runs, the
        // opaque shareTokens doc and finalized status are already committed — a failure in this
        // step must be soft-failed (logged, swallowed), not surfaced as a thrown error that
        // would make callers believe the whole finalize failed.
        (0, vitest_1.it)('does not throw when the memorable-URL slug/quarterShares write fails — the opaque share token is still returned', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, setDoc, updateDoc, useQuartersStore, store, consoleErrorSpy, token, thrown, err_1, shareTokenCall, finalizedCall;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), setDoc = _a.setDoc, updateDoc = _a.updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_b.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ quarter: 2, year: 2026 })]);
                        mockRosterState.people = [];
                        mockRosterState.roles = [];
                        mockOrgDoc = { name: 'Grace Church', slug: 'grace-church' };
                        consoleErrorSpy = vitest_1.vi.spyOn(console, 'error').mockImplementation(function () { });
                        vitest_1.vi.mocked(setDoc).mockImplementation(function (ref) {
                            var _a;
                            var path = (_a = ref.path) !== null && _a !== void 0 ? _a : '';
                            if (path.startsWith('quarterShares/')) {
                                return Promise.reject(new Error('simulated write failure'));
                            }
                            return Promise.resolve();
                        });
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, store.finalizeAndShare('quarter-1')];
                    case 4:
                        token = _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        err_1 = _b.sent();
                        thrown = err_1;
                        return [3 /*break*/, 6];
                    case 6:
                        (0, vitest_1.expect)(thrown).toBeUndefined();
                        (0, vitest_1.expect)(token).toHaveLength(36);
                        shareTokenCall = vitest_1.vi
                            .mocked(setDoc)
                            .mock.calls.find(function (call) { return call[0].path === "shareTokens/".concat(token); });
                        (0, vitest_1.expect)(shareTokenCall).toBeDefined();
                        finalizedCall = vitest_1.vi.mocked(updateDoc).mock.calls.find(function (call) {
                            var d = call[1];
                            return d.status === 'finalized';
                        });
                        (0, vitest_1.expect)(finalizedCall).toBeDefined();
                        (0, vitest_1.expect)(consoleErrorSpy).toHaveBeenCalled();
                        // Restore the default always-resolves implementation so later tests aren't affected —
                        // vi.clearAllMocks() (in this file's beforeEach) clears call history but not overridden
                        // implementations.
                        vitest_1.vi.mocked(setDoc).mockImplementation(function () { return Promise.resolve(); });
                        consoleErrorSpy.mockRestore();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('never calls Planning Center write functions (D-21)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var fs, path, filePath, source;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('node:fs'); })];
                    case 1:
                        fs = _a.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('node:path'); })];
                    case 2:
                        path = _a.sent();
                        filePath = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../quarters.ts');
                        source = fs.readFileSync(filePath, 'utf-8');
                        (0, vitest_1.expect)(/planningCenterApi|addTeamToPlan|createPlan|createItem/.test(source)).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('deleteQuarter', function () {
        function deletePaths(deleteDocMock) {
            return vitest_1.vi
                .mocked(deleteDocMock)
                .mock.calls.map(function (c) { return c[0].path; });
        }
        (0, vitest_1.it)('deletes only the quarter doc for a never-finalized (draft) quarter — no share docs touched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var deleteDoc, useQuartersStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        deleteDoc = (_a.sent()).deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ shareToken: null })]);
                        return [4 /*yield*/, store.deleteQuarter('quarter-1')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(deletePaths(deleteDoc)).toEqual(['organizations/org-1/quarters/quarter-1']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('revokes the opaque shareTokens AND memorable quarterShares docs before deleting a finalized quarter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var deleteDoc, useQuartersStore, store, paths;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        deleteDoc = (_a.sent()).deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        mockOrgDoc = { name: 'Test Org', slug: 'test-org' };
                        mockExistingSharePaths = new Set(['shareTokens/tok-123', 'quarterShares/test-org__q3-2026']);
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([
                            makeQuarterDoc({ shareToken: 'tok-123', status: 'finalized', quarter: 3, year: 2026 }),
                        ]);
                        return [4 /*yield*/, store.deleteQuarter('quarter-1')];
                    case 3:
                        _a.sent();
                        paths = deletePaths(deleteDoc);
                        (0, vitest_1.expect)(paths).toContain('shareTokens/tok-123');
                        (0, vitest_1.expect)(paths).toContain('quarterShares/test-org__q3-2026');
                        (0, vitest_1.expect)(paths).toContain('organizations/org-1/quarters/quarter-1');
                        // The quarter doc is deleted LAST — after both public links are revoked, so a delete
                        // can never leave a live public link dangling.
                        (0, vitest_1.expect)(paths[paths.length - 1]).toBe('organizations/org-1/quarters/quarter-1');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('skips the quarterShares delete when the memorable doc does not exist', function () { return __awaiter(void 0, void 0, void 0, function () {
            var deleteDoc, useQuartersStore, store, paths;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        deleteDoc = (_a.sent()).deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../quarters'); })];
                    case 2:
                        useQuartersStore = (_a.sent()).useQuartersStore;
                        mockOrgDoc = { name: 'Test Org', slug: 'test-org' };
                        // Only the opaque token exists; the memorable share was never written.
                        mockExistingSharePaths = new Set(['shareTokens/tok-123']);
                        store = useQuartersStore();
                        store.subscribe('org-1');
                        triggerQuartersSnapshot([makeQuarterDoc({ shareToken: 'tok-123', status: 'finalized' })]);
                        return [4 /*yield*/, store.deleteQuarter('quarter-1')];
                    case 3:
                        _a.sent();
                        paths = deletePaths(deleteDoc);
                        (0, vitest_1.expect)(paths).toContain('shareTokens/tok-123');
                        (0, vitest_1.expect)(paths.some(function (p) { return p === null || p === void 0 ? void 0 : p.startsWith('quarterShares/'); })).toBe(false);
                        (0, vitest_1.expect)(paths).toContain('organizations/org-1/quarters/quarter-1');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
