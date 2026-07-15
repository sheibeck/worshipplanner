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
var snapshotCallbacks = {};
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
        onSnapshot: vitest_1.vi.fn(function (queryRef, callback) {
            var _a;
            var path = (_a = queryRef.path) !== null && _a !== void 0 ? _a : 'unknown';
            snapshotCallbacks[path] = callback;
            return mockUnsubscribe;
        }),
        addDoc: vitest_1.vi.fn(function () { return Promise.resolve({ id: 'new-id' }); }),
        updateDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        deleteDoc: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        writeBatch: vitest_1.vi.fn(function () { return ({
            set: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            commit: vitest_1.vi.fn(function () { return Promise.resolve(); }),
        }); }),
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
// Standing person doc shape (D-04) — no per-person frequency fields at all.
function makePerson(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'person-1', name: 'Sarah Smith', email: 'sarah@example.com', phone: '', active: true, roles: [], pcPersonId: null, createdAt: { seconds: 1000000, nanoseconds: 0 }, updatedAt: { seconds: 1000000, nanoseconds: 0 } }, overrides);
}
function makeRole(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ id: 'role-1', name: 'guitar', group: 'band', defaultCount: 1, order: 0 }, overrides);
}
function triggerPeopleSnapshot(people) {
    var cb = snapshotCallbacks['organizations/org-1/people'];
    if (cb) {
        cb({
            docs: people.map(function (p) { return ({
                id: p.id,
                data: function () {
                    var _id = p.id, rest = __rest(p, ["id"]);
                    return rest;
                },
                ref: { id: p.id, path: "organizations/org-1/people/".concat(p.id) },
            }); }),
        });
    }
}
function triggerRolesSnapshot(roles) {
    var cb = snapshotCallbacks['organizations/org-1/roles'];
    if (cb) {
        cb({
            docs: roles.map(function (r) { return ({
                id: r.id,
                data: function () {
                    var _id = r.id, rest = __rest(r, ["id"]);
                    return rest;
                },
                ref: { id: r.id, path: "organizations/org-1/roles/".concat(r.id) },
            }); }),
        });
    }
}
(0, vitest_1.describe)('useRosterStore', function () {
    (0, vitest_1.beforeEach)(function () {
        (0, pinia_1.setActivePinia)((0, pinia_1.createPinia)());
        vitest_1.vi.clearAllMocks();
        for (var _i = 0, _a = Object.keys(snapshotCallbacks); _i < _a.length; _i++) {
            var key = _a[_i];
            delete snapshotCallbacks[key];
        }
    });
    (0, vitest_1.describe)('initial state', function () {
        (0, vitest_1.it)('starts with empty people array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        (0, vitest_1.expect)(store.people).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('starts with empty roles array', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        (0, vitest_1.expect)(store.roles).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('starts with isLoading true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        (0, vitest_1.expect)(store.isLoading).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('subscribe / onSnapshot', function () {
        (0, vitest_1.it)('subscribe calls onSnapshot on the org people collection', function () { return __awaiter(void 0, void 0, void 0, function () {
            var onSnapshot, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        onSnapshot = (_a.sent()).onSnapshot;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        (0, vitest_1.expect)(onSnapshot).toHaveBeenCalled();
                        (0, vitest_1.expect)(snapshotCallbacks['organizations/org-1/people']).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('populates people from snapshot with { id, ...data } mapping', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([makePerson()]);
                        (0, vitest_1.expect)(store.people).toHaveLength(1);
                        (0, vitest_1.expect)(store.people[0].id).toBe('person-1');
                        (0, vitest_1.expect)(store.people[0].name).toBe('Sarah Smith');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('sets isLoading to false after first people snapshot', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([]);
                        (0, vitest_1.expect)(store.isLoading).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('does not issue any patch write on a plain people snapshot (D-04 — no standing-frequency migration)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([makePerson({ id: 'p1', roles: ['guitar'] })]);
                        (0, vitest_1.expect)(updateDoc).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('unsubscribeAll calls the unsubscribe fn and resets state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([makePerson()]);
                        (0, vitest_1.expect)(store.people).toHaveLength(1);
                        store.unsubscribeAll();
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalled();
                        (0, vitest_1.expect)(store.people).toEqual([]);
                        (0, vitest_1.expect)(store.roles).toEqual([]);
                        (0, vitest_1.expect)(store.isLoading).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('calling subscribe again unsubscribes previous listeners first', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        store.subscribe('org-2');
                        // two subscriptions per call (people + roles) => 2 unsubscribes from first call
                        (0, vitest_1.expect)(mockUnsubscribe).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('activePeople computed', function () {
        (0, vitest_1.it)('returns only people with active === true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({ id: 'p1', name: 'Active Person', active: true }),
                            makePerson({ id: 'p2', name: 'Inactive Person', active: false }),
                        ]);
                        (0, vitest_1.expect)(store.activePeople).toHaveLength(1);
                        (0, vitest_1.expect)(store.activePeople[0].name).toBe('Active Person');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('addPerson (D-04 — standing fields only, no frequency persistence)', function () {
        (0, vitest_1.it)('calls addDoc with active:true and serverTimestamp fields', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, addDoc, serverTimestamp, useRosterStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), addDoc = _a.addDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.addPerson({ name: 'New Person', email: 'new@example.com' })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.name).toBe('New Person');
                        (0, vitest_1.expect)(data.active).toBe(true);
                        (0, vitest_1.expect)(data.roles).toEqual([]);
                        (0, vitest_1.expect)(data.createdAt).toBeDefined();
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('never writes a standing per-person cadence field, even when the caller supplies one', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useRosterStore, store, legacyScalarKey, legacyMapKey, data, writtenKeys;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_b.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        legacyScalarKey = ['frequency', 'TargetN'].join('');
                        legacyMapKey = ['role', 'Frequencies'].join('');
                        return [4 /*yield*/, store.addPerson(__assign({ name: 'New Person', email: 'new@example.com', roles: ['guitar'] }, (_a = {}, _a[legacyScalarKey] = 2, _a[legacyMapKey] = { guitar: 2 }, _a)))];
                    case 3:
                        _b.sent();
                        data = vitest_1.vi.mocked(addDoc).mock.calls[0][1];
                        writtenKeys = Object.keys(data);
                        (0, vitest_1.expect)(writtenKeys).toEqual(['name', 'email', 'phone', 'roles', 'pcPersonId', 'active', 'createdAt', 'updatedAt']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('updatePerson (D-04 — standing fields only)', function () {
        (0, vitest_1.it)('calls updateDoc with serverTimestamp for updatedAt', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, updateDoc, serverTimestamp, useRosterStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), updateDoc = _a.updateDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.updatePerson('person-1', { name: 'Updated Name' })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.name).toBe('Updated Name');
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('never forwards a legacy per-person cadence field to Firestore', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, legacyScalarKey, legacyMapKey, data;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_b.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        legacyScalarKey = ['frequency', 'TargetN'].join('');
                        legacyMapKey = ['role', 'Frequencies'].join('');
                        return [4 /*yield*/, store.updatePerson('person-1', __assign({ name: 'Updated Name' }, (_a = {}, _a[legacyScalarKey] = 2, _a[legacyMapKey] = { guitar: 2 }, _a)))];
                    case 3:
                        _b.sent();
                        data = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(Object.keys(data)).toEqual(['updatedAt', 'name']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('deactivatePerson / reactivatePerson (D-20 soft-delete)', function () {
        (0, vitest_1.it)('deactivatePerson calls updateDoc with active:false, not deleteDoc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, updateDoc, deleteDoc, useRosterStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), updateDoc = _a.updateDoc, deleteDoc = _a.deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.deactivatePerson('person-1')];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(deleteDoc).not.toHaveBeenCalled();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.active).toBe(false);
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('reactivatePerson calls updateDoc with active:true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.reactivatePerson('person-1')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.active).toBe(true);
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('upsertPeople — re-import upsert (D-13/D-14, D-04 no frequency persistence)', function () {
        (0, vitest_1.it)('creates new doc via addDoc when no match found', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useRosterStore, store, result, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([]);
                        return [4 /*yield*/, store.upsertPeople([
                                { name: 'Brand New Person', email: 'brand@example.com', pcPersonId: 'pc-new-1' },
                            ])];
                    case 3:
                        result = _a.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.name).toBe('Brand New Person');
                        (0, vitest_1.expect)(data.active).toBe(true);
                        (0, vitest_1.expect)(data.roles).toEqual([]);
                        (0, vitest_1.expect)(data.createdAt).toBeDefined();
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(result).toEqual({ added: 1, updated: 0 });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('updates existing doc via updateDoc when pcPersonId matches', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, result, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({ id: 'existing-person', name: 'Old Name', pcPersonId: 'pc-123', active: true }),
                        ]);
                        return [4 /*yield*/, store.upsertPeople([
                                { name: 'Updated Name', email: 'updated@example.com', pcPersonId: 'pc-123' },
                            ])];
                    case 3:
                        result = _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.name).toBe('Updated Name');
                        (0, vitest_1.expect)(result).toEqual({ added: 0, updated: 1 });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('merges (unions) roles on update — never removes a role the existing person already has', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, callArgs, data, written;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({
                                id: 'existing-person',
                                name: 'Multi Role',
                                pcPersonId: 'pc-multi',
                                active: true,
                                roles: ['role-projection', 'role-vocals'],
                            }),
                        ]);
                        // Import only reports the Sound role — the person's existing projection/vocals
                        // roles must be preserved, not clobbered.
                        return [4 /*yield*/, store.upsertPeople([
                                { name: 'Multi Role', email: '', pcPersonId: 'pc-multi', roles: ['role-sound'] },
                            ])];
                    case 3:
                        // Import only reports the Sound role — the person's existing projection/vocals
                        // roles must be preserved, not clobbered.
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        written = data.roles;
                        (0, vitest_1.expect)(new Set(written)).toEqual(new Set(['role-projection', 'role-vocals', 'role-sound']));
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('matches by normalized name (trim + collapse whitespace + lowercase) when no pcPersonId match', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({ id: 'existing-person', name: 'Sarah  Smith', pcPersonId: null, active: true }),
                        ]);
                        return [4 /*yield*/, store.upsertPeople([
                                { name: '  sarah smith  ', email: 'sarah@example.com' },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('preserves active:false on re-import — a deactivated person stays inactive', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({ id: 'deactivated-person', name: 'Deactivated Person', pcPersonId: 'pc-deact', active: false }),
                        ]);
                        return [4 /*yield*/, store.upsertPeople([
                                { name: 'Deactivated Person', email: 'x@example.com', pcPersonId: 'pc-deact' },
                            ])];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        // active must NOT be included in the update payload (preserves existing false)
                        (0, vitest_1.expect)(data.active).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('never writes blackoutDates, pairedWith, or a standing cadence field to the person doc', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, addDoc, updateDoc, useRosterStore, store, updateData, addData;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), addDoc = _a.addDoc, updateDoc = _a.updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({ id: 'existing-person', name: 'Existing Person', pcPersonId: 'pc-1', active: true }),
                        ]);
                        return [4 /*yield*/, store.upsertPeople([
                                { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1' },
                                { name: 'New Person', email: 'n@example.com', pcPersonId: 'pc-2' },
                            ])];
                    case 3:
                        _b.sent();
                        updateData = vitest_1.vi.mocked(updateDoc).mock.calls[0][1];
                        addData = vitest_1.vi.mocked(addDoc).mock.calls[0][1];
                        (0, vitest_1.expect)(updateData.blackoutDates).toBeUndefined();
                        (0, vitest_1.expect)(updateData.pairedWith).toBeUndefined();
                        (0, vitest_1.expect)(Object.keys(addData)).toEqual(['name', 'email', 'phone', 'roles', 'pcPersonId', 'active', 'createdAt', 'updatedAt']);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('returns correct added/updated counts for a mixed batch', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerPeopleSnapshot([
                            makePerson({ id: 'existing-person', name: 'Existing Person', pcPersonId: 'pc-1', active: true }),
                        ]);
                        return [4 /*yield*/, store.upsertPeople([
                                { name: 'Existing Person', email: 'e@example.com', pcPersonId: 'pc-1' },
                                { name: 'New Person 1', email: 'n1@example.com', pcPersonId: 'pc-2' },
                                { name: 'New Person 2', email: 'n2@example.com', pcPersonId: 'pc-3' },
                            ])];
                    case 2:
                        result = _a.sent();
                        (0, vitest_1.expect)(result).toEqual({ added: 2, updated: 1 });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('roles subscription + seedDefaultRolesIfEmpty (D-03)', function () {
        (0, vitest_1.it)('subscribe calls onSnapshot on the org roles collection ordered by "order"', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, onSnapshot, orderBy, useRosterStore, store;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), onSnapshot = _a.onSnapshot, orderBy = _a.orderBy;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        (0, vitest_1.expect)(onSnapshot).toHaveBeenCalled();
                        (0, vitest_1.expect)(snapshotCallbacks['organizations/org-1/roles']).toBeDefined();
                        (0, vitest_1.expect)(orderBy).toHaveBeenCalledWith('order');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('populates roles from snapshot ordered by "order"', function () { return __awaiter(void 0, void 0, void 0, function () {
            var useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 1:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerRolesSnapshot([
                            makeRole({ id: 'role-1', name: 'guitar', order: 0 }),
                            makeRole({ id: 'role-2', name: 'drums', order: 1 }),
                        ]);
                        (0, vitest_1.expect)(store.roles).toHaveLength(2);
                        (0, vitest_1.expect)(store.roles[0].name).toBe('guitar');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('seedDefaultRolesIfEmpty writes 8 roles when roles collection is empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerRolesSnapshot([]);
                        return [4 /*yield*/, store.seedDefaultRolesIfEmpty()];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledTimes(8);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('seedDefaultRolesIfEmpty writes nothing when roles already exist', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        addDoc = (_a.sent()).addDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerRolesSnapshot([makeRole({ id: 'role-1', name: 'guitar' })]);
                        return [4 /*yield*/, store.seedDefaultRolesIfEmpty()];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(addDoc).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('addRole / updateRole / deleteRole (D-03 editable role list)', function () {
        (0, vitest_1.it)('addRole calls addDoc with the given shape + timestamps', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, addDoc, serverTimestamp, useRosterStore, store, callArgs, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        _a = _b.sent(), addDoc = _a.addDoc, serverTimestamp = _a.serverTimestamp;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_b.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.addRole({ name: 'keys', group: 'band', defaultCount: 1, order: 8 })];
                    case 3:
                        _b.sent();
                        (0, vitest_1.expect)(addDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(addDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.name).toBe('keys');
                        (0, vitest_1.expect)(data.group).toBe('band');
                        (0, vitest_1.expect)(data.createdAt).toBeDefined();
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        (0, vitest_1.expect)(serverTimestamp).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('updateRole calls updateDoc with serverTimestamp for updatedAt', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, callArgs, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.updateRole('role-1', { name: 'renamed-role' })];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(data.name).toBe('renamed-role');
                        (0, vitest_1.expect)(data.updatedAt).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('deleteRole calls deleteDoc (hard delete of role config doc)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var deleteDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        deleteDoc = (_a.sent()).deleteDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        return [4 /*yield*/, store.deleteRole('role-1')];
                    case 3:
                        _a.sent();
                        (0, vitest_1.expect)(deleteDoc).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('patch-on-read migrations (D-09 vocals group)', function () {
        (0, vitest_1.it)('D-09: patches a "vocals" role doc from group band to group vocals', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store, callArgs, ref, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerRolesSnapshot([makeRole({ id: 'role-vocals', name: 'vocals', group: 'band' })]);
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        callArgs = vitest_1.vi.mocked(updateDoc).mock.calls[0];
                        ref = callArgs[0];
                        data = callArgs[1];
                        (0, vitest_1.expect)(ref.id).toBe('role-vocals');
                        (0, vitest_1.expect)(data).toEqual({ group: 'vocals' });
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('D-09: name match is case-insensitive', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerRolesSnapshot([makeRole({ id: 'role-vocals', name: 'VOCALS', group: 'band' })]);
                        (0, vitest_1.expect)(updateDoc).toHaveBeenCalledOnce();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('D-09: is idempotent — does not patch a role already in group vocals, or an unrelated role', function () { return __awaiter(void 0, void 0, void 0, function () {
            var updateDoc, useRosterStore, store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('firebase/firestore'); })];
                    case 1:
                        updateDoc = (_a.sent()).updateDoc;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../roster'); })];
                    case 2:
                        useRosterStore = (_a.sent()).useRosterStore;
                        store = useRosterStore();
                        store.subscribe('org-1');
                        triggerRolesSnapshot([
                            makeRole({ id: 'role-vocals', name: 'vocals', group: 'vocals' }),
                            makeRole({ id: 'role-guitar', name: 'guitar', group: 'band' }),
                        ]);
                        (0, vitest_1.expect)(updateDoc).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
