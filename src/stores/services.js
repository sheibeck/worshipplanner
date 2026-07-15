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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useServiceStore = void 0;
var vue_1 = require("vue");
var pinia_1 = require("pinia");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var songs_1 = require("@/stores/songs");
var slotTypes_1 = require("@/utils/slotTypes");
exports.useServiceStore = (0, pinia_1.defineStore)('services', function () {
    var services = (0, vue_1.ref)([]);
    var isLoading = (0, vue_1.ref)(true);
    var orgId = (0, vue_1.ref)(null);
    var unsubscribeFn = null;
    function subscribe(orgIdValue) {
        if (unsubscribeFn) {
            unsubscribeFn();
        }
        orgId.value = orgIdValue;
        var q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgIdValue, 'services'), (0, firestore_1.orderBy)('date', 'desc'));
        unsubscribeFn = (0, firestore_1.onSnapshot)(q, function (snap) {
            services.value = snap.docs.map(function (d) {
                var data = d.data();
                return __assign({ id: d.id, name: '', notes: '' }, data);
            });
            isLoading.value = false;
        });
    }
    function unsubscribeAll() {
        unsubscribeFn === null || unsubscribeFn === void 0 ? void 0 : unsubscribeFn();
        unsubscribeFn = null;
        orgId.value = null;
        services.value = [];
        isLoading.value = true;
    }
    function createService(data) {
        return __awaiter(this, void 0, Promise, function () {
            var slots, ref;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            throw new Error('No orgId set — call subscribe() first');
                        slots = (0, slotTypes_1.buildSlots)('1-2-2-3');
                        return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'services'), __assign(__assign({}, data), { progression: '1-2-2-3', slots: slots, status: 'draft', notes: '', sermonPassage: null, sermonTopic: '', createdAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        ref = _a.sent();
                        return [2 /*return*/, ref.id];
                }
            });
        });
    }
    function updateService(id, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'services', id), __assign(__assign({}, data), { updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function deleteService(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.deleteDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'services', id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function assignSongToSlot(serviceId, slotIndex, song) {
        return __awaiter(this, void 0, void 0, function () {
            var service, updatedSlots, songStore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        service = services.value.find(function (s) { return s.id === serviceId; });
                        if (!service)
                            return [2 /*return*/];
                        updatedSlots = service.slots.map(function (slot, idx) {
                            if (idx === slotIndex && slot.kind === 'SONG') {
                                return __assign(__assign({}, slot), { songId: song.id, songTitle: song.title, songKey: song.key });
                            }
                            return slot;
                        });
                        return [4 /*yield*/, updateService(serviceId, { slots: updatedSlots })
                            // Cross-store write: update lastUsedAt on the song document
                        ];
                    case 1:
                        _a.sent();
                        songStore = (0, songs_1.useSongStore)();
                        return [4 /*yield*/, songStore.updateSong(song.id, { lastUsedAt: (0, firestore_1.serverTimestamp)() })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function clearSongFromSlot(serviceId, slotIndex) {
        return __awaiter(this, void 0, void 0, function () {
            var service, updatedSlots;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        service = services.value.find(function (s) { return s.id === serviceId; });
                        if (!service)
                            return [2 /*return*/];
                        updatedSlots = service.slots.map(function (slot, idx) {
                            if (idx === slotIndex && slot.kind === 'SONG') {
                                return __assign(__assign({}, slot), { songId: null, songTitle: null, songKey: null });
                            }
                            return slot;
                        });
                        return [4 /*yield*/, updateService(serviceId, { slots: updatedSlots })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function createShareToken(service, orgIdValue) {
        return __awaiter(this, void 0, Promise, function () {
            var array, token, songStore, slotsWithBpm;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        array = new Uint8Array(18);
                        crypto.getRandomValues(array);
                        token = Array.from(array, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
                        songStore = (0, songs_1.useSongStore)();
                        slotsWithBpm = service.slots.map(function (slot) {
                            var _a, _b, _c;
                            if (slot.kind === 'SONG' && slot.songId) {
                                var songSlot_1 = slot;
                                var song = songStore.songs.find(function (s) { return s.id === songSlot_1.songId; });
                                var bpm = null;
                                if (song) {
                                    var matchingArr = song.arrangements.find(function (a) { return a.key === songSlot_1.songKey; });
                                    bpm = (_c = (_a = matchingArr === null || matchingArr === void 0 ? void 0 : matchingArr.bpm) !== null && _a !== void 0 ? _a : (_b = song.arrangements[0]) === null || _b === void 0 ? void 0 : _b.bpm) !== null && _c !== void 0 ? _c : null;
                                }
                                return __assign(__assign({}, slot), { bpm: bpm });
                            }
                            return slot;
                        });
                        return [4 /*yield*/, (0, firestore_1.setDoc)((0, firestore_1.doc)(firebase_1.db, 'shareTokens', token), {
                                serviceId: service.id,
                                orgId: orgIdValue,
                                serviceSnapshot: {
                                    date: service.date,
                                    name: service.name,
                                    progression: service.progression,
                                    teams: service.teams,
                                    slots: slotsWithBpm,
                                    sermonPassage: service.sermonPassage,
                                    notes: service.notes,
                                    status: service.status,
                                },
                                createdAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, token];
                }
            });
        });
    }
    return {
        services: services,
        isLoading: isLoading,
        orgId: orgId,
        subscribe: subscribe,
        unsubscribeAll: unsubscribeAll,
        createService: createService,
        updateService: updateService,
        deleteService: deleteService,
        assignSongToSlot: assignSongToSlot,
        clearSongFromSlot: clearSongFromSlot,
        createShareToken: createShareToken,
    };
});
