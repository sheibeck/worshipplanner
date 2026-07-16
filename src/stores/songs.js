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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSongStore = void 0;
var vue_1 = require("vue");
var pinia_1 = require("pinia");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var songSearch_1 = require("@/utils/songSearch");
var auth_1 = require("@/stores/auth");
exports.useSongStore = (0, pinia_1.defineStore)('songs', function () {
    var songs = (0, vue_1.ref)([]);
    var isLoading = (0, vue_1.ref)(true);
    var orgId = (0, vue_1.ref)(null);
    // Filter state
    var searchQuery = (0, vue_1.ref)('');
    var filterVwType = (0, vue_1.ref)(null);
    var filterKey = (0, vue_1.ref)('');
    // D-08: shared per-tag Show/Hide tag-filter state — independent include/exclude sets
    // D-09: include set OR-combines (show if carrying ANY included tag)
    // D-10: exclude set always wins (hide if carrying ANY excluded tag), even alongside include
    var tagFilterInclude = (0, vue_1.ref)(new Set());
    var tagFilterExclude = (0, vue_1.ref)(new Set());
    // D-08/D-09/D-10: per-user, per-org column-visibility preference for the Songs
    // table (plan 05 cog UI binds to this). Title is always visible and therefore
    // has no entry here — only the toggleable columns are tracked.
    var DEFAULT_COLUMN_VISIBILITY = {
        category: true,
        key: true,
        ccli: true,
        lastUsed: true,
        tags: true,
        themes: true,
    };
    var columnVisibility = (0, vue_1.ref)(__assign({}, DEFAULT_COLUMN_VISIBILITY));
    var unsubscribeFn = null;
    var filteredSongs = (0, vue_1.computed)(function () {
        var authStore = (0, auth_1.useAuthStore)();
        return songs.value.filter(function (song) {
            var _a, _b, _c, _d;
            // Exclude hidden songs (treat undefined as false for legacy docs)
            if (song.hidden === true)
                return false;
            // D-16: gate the `type:` search prefix on VW mode so it hides app-wide when off.
            var matchesSearch = (0, songSearch_1.songMatchesQuery)(song, searchQuery.value, authStore.vwModeEnabled);
            // D-16: gate the VW-type dropdown filter on VW mode so a stale selection
            // doesn't silently keep filtering the list after VW mode is disabled.
            var matchesVwType = !authStore.vwModeEnabled ||
                filterVwType.value === null ||
                (filterVwType.value === 'uncategorized'
                    ? song.vwTypes.length === 0
                    : song.vwTypes.includes(filterVwType.value));
            var matchesKey = !filterKey.value ||
                song.arrangements.some(function (a) { return a.key === filterKey.value; });
            var include = tagFilterInclude.value;
            var exclude = tagFilterExclude.value;
            var matchesUserTags = true;
            if (exclude.size > 0) {
                var carriesExcluded = ((_a = song.themes) !== null && _a !== void 0 ? _a : []).some(function (t) { return exclude.has(t); }) ||
                    ((_b = song.tags) !== null && _b !== void 0 ? _b : []).some(function (t) { return exclude.has(t); });
                if (carriesExcluded)
                    matchesUserTags = false;
            }
            if (matchesUserTags && include.size > 0) {
                var carriesIncluded = ((_c = song.themes) !== null && _c !== void 0 ? _c : []).some(function (t) { return include.has(t); }) ||
                    ((_d = song.tags) !== null && _d !== void 0 ? _d : []).some(function (t) { return include.has(t); });
                matchesUserTags = carriesIncluded;
            }
            return matchesSearch && matchesVwType && matchesKey && matchesUserTags;
        });
    });
    // Distinct USER tags (song.tags only) across non-hidden songs, sorted — powers
    // type-ahead suggestions when adding tags so users don't create duplicates.
    var allUserTags = (0, vue_1.computed)(function () {
        var tags = new Set();
        songs.value.forEach(function (song) {
            var _a;
            if (song.hidden === true)
                return;
            ((_a = song.tags) !== null && _a !== void 0 ? _a : []).forEach(function (t) { return tags.add(t); });
        });
        return Array.from(tags).sort();
    });
    // AI song-suggestion candidate pool. Excludes soft-deleted songs — in this app
    // a soft-delete sets hidden === true (see deleteSong), so the hidden filter IS
    // the deleted-song exclusion. Treat undefined as not-hidden for legacy docs.
    var aiCandidateSongs = (0, vue_1.computed)(function () {
        return songs.value.filter(function (song) { return song.hidden !== true; });
    });
    // Active (non-soft-deleted) songs, for counts shown to users (Dashboard stat,
    // Songs-page header). Mirrors aiCandidateSongs' hidden filter — undefined is
    // treated as not-hidden for legacy docs.
    var visibleSongs = (0, vue_1.computed)(function () {
        return songs.value.filter(function (song) { return song.hidden !== true; });
    });
    // D-11: clears only the tag filter — searchQuery/filterVwType/filterKey untouched
    function clearTagFilter() {
        tagFilterInclude.value = new Set();
        tagFilterExclude.value = new Set();
    }
    // D-08: flips a single column's visibility. Reassigns a new object (rather than
    // mutating the existing one in place) to keep Vue reactivity consistent with the
    // rest of this store's ref-object patterns.
    function toggleColumn(col) {
        var _a;
        columnVisibility.value = __assign(__assign({}, columnVisibility.value), (_a = {}, _a[col] = !columnVisibility.value[col], _a));
    }
    // D-09: restores every toggleable column to visible.
    function resetColumns() {
        columnVisibility.value = __assign({}, DEFAULT_COLUMN_VISIBILITY);
    }
    // D-12/D-13: persist ONLY the tag-filter include/exclude sets to localStorage, namespaced
    // per user+org so state never bleeds across accounts on a shared browser (T-12-03).
    function tagFilterStorageKey() {
        var _a, _b;
        var auth = (0, auth_1.useAuthStore)();
        var uid = (_a = auth.user) === null || _a === void 0 ? void 0 : _a.uid;
        var org = (_b = orgId.value) !== null && _b !== void 0 ? _b : auth.orgId;
        if (!uid || !org)
            return null; // don't read/write under a shared/global key
        return "wp:tagFilter:v2:".concat(org, ":").concat(uid);
    }
    function persistTagFilter() {
        var key = tagFilterStorageKey();
        if (!key)
            return;
        try {
            localStorage.setItem(key, JSON.stringify({
                include: Array.from(tagFilterInclude.value),
                exclude: Array.from(tagFilterExclude.value),
            }));
        }
        catch ( /* ignore: private mode / quota — degrade to in-memory only */_a) { /* ignore: private mode / quota — degrade to in-memory only */ }
    }
    function hydrateTagFilter() {
        var key = tagFilterStorageKey();
        if (!key) {
            // No usable storage key (missing uid/org) — reset in-memory state so a
            // previous account's selection can't leak into this session (T-12-03).
            tagFilterInclude.value = new Set();
            tagFilterExclude.value = new Set();
            return;
        }
        try {
            var raw = localStorage.getItem(key);
            if (!raw) {
                // No saved filter for this user/org — reset rather than leaving a
                // previously-active user's in-memory selection applied (T-12-03).
                tagFilterInclude.value = new Set();
                tagFilterExclude.value = new Set();
                return;
            }
            var parsed = JSON.parse(raw);
            tagFilterInclude.value = new Set(Array.isArray(parsed.include) ? parsed.include : []);
            tagFilterExclude.value = new Set(Array.isArray(parsed.exclude) ? parsed.exclude : []);
        }
        catch (_a) {
            // Corrupt/unavailable — reset to defaults rather than keeping stale
            // in-memory state from a prior user/org.
            tagFilterInclude.value = new Set();
            tagFilterExclude.value = new Set();
        }
    }
    (0, vue_1.watch)([tagFilterInclude, tagFilterExclude], persistTagFilter, { deep: true });
    // D-10: persist ONLY the column-visibility map to localStorage, namespaced per
    // user+org so a personal view preference never bleeds across accounts on a
    // shared browser (mirrors tagFilterStorageKey's T-12-03 guard verbatim).
    function columnStorageKey() {
        var _a, _b;
        var auth = (0, auth_1.useAuthStore)();
        var uid = (_a = auth.user) === null || _a === void 0 ? void 0 : _a.uid;
        var org = (_b = orgId.value) !== null && _b !== void 0 ? _b : auth.orgId;
        if (!uid || !org)
            return null; // don't read/write under a shared/global key
        return "wp:songTableColumns:v1:".concat(org, ":").concat(uid);
    }
    function persistColumnVisibility() {
        var key = columnStorageKey();
        if (!key)
            return;
        try {
            localStorage.setItem(key, JSON.stringify(columnVisibility.value));
        }
        catch ( /* ignore: private mode / quota — degrade to in-memory only */_a) { /* ignore: private mode / quota — degrade to in-memory only */ }
    }
    function hydrateColumnVisibility() {
        var key = columnStorageKey();
        if (!key) {
            // No usable storage key (missing uid/org) — reset in-memory state so a
            // previous account's selection can't leak into this session (T-12-03).
            columnVisibility.value = __assign({}, DEFAULT_COLUMN_VISIBILITY);
            return;
        }
        try {
            var raw = localStorage.getItem(key);
            if (!raw) {
                // No saved preference for this user/org — reset rather than leaving a
                // previously-active user's in-memory selection applied (T-12-03).
                columnVisibility.value = __assign({}, DEFAULT_COLUMN_VISIBILITY);
                return;
            }
            var parsed = JSON.parse(raw);
            // Merge hydrated keys over the default map so a newly-added column key
            // defaults visible even if an older saved payload omits it.
            columnVisibility.value = __assign(__assign({}, DEFAULT_COLUMN_VISIBILITY), parsed);
        }
        catch (_a) {
            // Corrupt/unavailable — reset to defaults rather than keeping stale
            // in-memory state from a prior user/org.
            columnVisibility.value = __assign({}, DEFAULT_COLUMN_VISIBILITY);
        }
    }
    (0, vue_1.watch)(columnVisibility, persistColumnVisibility, { deep: true });
    function subscribe(orgIdValue) {
        if (unsubscribeFn) {
            unsubscribeFn();
        }
        orgId.value = orgIdValue;
        var q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgIdValue, 'songs'), (0, firestore_1.orderBy)('title'));
        unsubscribeFn = (0, firestore_1.onSnapshot)(q, function (snap) {
            songs.value = snap.docs.map(function (d) {
                var data = d.data();
                // Normalize legacy vwType scalar field to vwTypes array
                if (!Array.isArray(data.vwTypes)) {
                    data.vwTypes = data.vwType != null ? [data.vwType] : [];
                }
                // Normalize legacy docs without tags field to empty array
                if (!Array.isArray(data.tags)) {
                    data.tags = [];
                }
                // D-01: read-fold legacy teamTags into the flat tags set so every consumer
                // reading song.tags sees the merged set. teamTags itself is left untouched
                // in memory (still read directly until repointed in later waves).
                var legacyTeamTags = Array.isArray(data.teamTags) ? data.teamTags : [];
                if (legacyTeamTags.length > 0) {
                    data.tags = Array.from(new Set(__spreadArray(__spreadArray([], data.tags, true), legacyTeamTags, true)));
                }
                // D-14: default removedThemes for legacy docs missing the field.
                if (!Array.isArray(data.removedThemes)) {
                    data.removedThemes = [];
                }
                return __assign({ id: d.id }, data);
            });
            isLoading.value = false;
        });
        // Hydrate the tag filter once org+uid are resolved (mirrors how views call
        // subscribe once authStore.orgId resolves).
        hydrateTagFilter();
        hydrateColumnVisibility();
    }
    function unsubscribeAll() {
        unsubscribeFn === null || unsubscribeFn === void 0 ? void 0 : unsubscribeFn();
        unsubscribeFn = null;
        orgId.value = null;
        songs.value = [];
        isLoading.value = true;
    }
    function addSong(data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'songs'), __assign(__assign({}, data), { createdAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function updateSong(id, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'songs', id), __assign(__assign({}, data), { updatedAt: (0, firestore_1.serverTimestamp)() }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function deleteSong(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'songs', id), {
                                hidden: true,
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function restoreSong(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'songs', id), {
                                hidden: false,
                                updatedAt: (0, firestore_1.serverTimestamp)(),
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function upsertSongs(songsData) {
        return __awaiter(this, void 0, void 0, function () {
            var byPcSongId, byCcliNumber, byTitle, _i, _a, song, _loop_1, _b, songsData_1, incoming;
            var _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        byPcSongId = new Map();
                        byCcliNumber = new Map();
                        byTitle = new Map();
                        for (_i = 0, _a = songs.value; _i < _a.length; _i++) {
                            song = _a[_i];
                            if (song.pcSongId)
                                byPcSongId.set(song.pcSongId, song);
                            if (song.ccliNumber)
                                byCcliNumber.set(song.ccliNumber, song);
                            byTitle.set(song.title.toLowerCase(), song);
                        }
                        _loop_1 = function (incoming) {
                            var existing, incomingVwTypes, _hidden, incomingPrimary, _tags, _themes, _removedThemes, restIncoming, existingRemovedThemes_1, updateData, existingPrimaryStillValid;
                            return __generator(this, function (_k) {
                                switch (_k.label) {
                                    case 0:
                                        if (incoming.pcSongId) {
                                            existing = byPcSongId.get(incoming.pcSongId);
                                        }
                                        if (!existing && incoming.ccliNumber) {
                                            existing = byCcliNumber.get(incoming.ccliNumber);
                                        }
                                        if (!existing) {
                                            existing = byTitle.get(incoming.title.toLowerCase());
                                        }
                                        if (!existing) return [3 /*break*/, 2];
                                        incomingVwTypes = incoming.vwTypes, _hidden = incoming.hidden, incomingPrimary = incoming.primaryArrangementId, _tags = incoming.tags, _themes = incoming.themes, _removedThemes = incoming.removedThemes, restIncoming = __rest(incoming, ["vwTypes", "hidden", "primaryArrangementId", "tags", "themes", "removedThemes"]);
                                        existingRemovedThemes_1 = (_c = existing.removedThemes) !== null && _c !== void 0 ? _c : [];
                                        updateData = __assign(__assign({}, restIncoming), { hidden: (_d = existing.hidden) !== null && _d !== void 0 ? _d : false, 
                                            // D-05: grow-only de-duplicated union of existing user tags + incoming
                                            // (imported) team-style tags — a re-import never drops a user tag.
                                            // Tradeoff: a user-removed *tag* (as opposed to a theme) can reappear on
                                            // reimport since only themes track explicit removals this phase (D-14).
                                            tags: Array.from(new Set(__spreadArray(__spreadArray([], ((_e = existing.tags) !== null && _e !== void 0 ? _e : []), true), (_tags !== null && _tags !== void 0 ? _tags : []), true))), 
                                            // D-08/D-14: union themes with incoming, then subtract any theme the user
                                            // explicitly removed locally so a removed theme doesn't resurrect on re-import.
                                            themes: Array.from(new Set(__spreadArray(__spreadArray([], ((_f = existing.themes) !== null && _f !== void 0 ? _f : []), true), (_themes !== null && _themes !== void 0 ? _themes : []), true))).filter(function (t) { return !existingRemovedThemes_1.includes(t); }), 
                                            // D-14: removedThemes tracking is preserved verbatim across re-import.
                                            removedThemes: existingRemovedThemes_1, updatedAt: (0, firestore_1.serverTimestamp)() });
                                        // Only include vwTypes if incoming array is non-empty (preserve user-set types if incoming is empty)
                                        if (incomingVwTypes.length > 0) {
                                            updateData.vwTypes = incomingVwTypes;
                                        }
                                        existingPrimaryStillValid = existing.primaryArrangementId != null &&
                                            incoming.arrangements.some(function (a) { return a.id === existing.primaryArrangementId; });
                                        updateData.primaryArrangementId = existingPrimaryStillValid
                                            ? existing.primaryArrangementId
                                            : (incomingPrimary !== null && incomingPrimary !== void 0 ? incomingPrimary : null);
                                        return [4 /*yield*/, (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'organizations', orgId.value, 'songs', existing.id), updateData)];
                                    case 1:
                                        _k.sent();
                                        return [3 /*break*/, 4];
                                    case 2: 
                                    // Create new doc
                                    return [4 /*yield*/, (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'songs'), __assign(__assign({}, incoming), { hidden: false, tags: (_g = incoming.tags) !== null && _g !== void 0 ? _g : [], removedThemes: (_h = incoming.removedThemes) !== null && _h !== void 0 ? _h : [], createdAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)() }))];
                                    case 3:
                                        // Create new doc
                                        _k.sent();
                                        _k.label = 4;
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        _b = 0, songsData_1 = songsData;
                        _j.label = 1;
                    case 1:
                        if (!(_b < songsData_1.length)) return [3 /*break*/, 4];
                        incoming = songsData_1[_b];
                        return [5 /*yield**/, _loop_1(incoming)];
                    case 2:
                        _j.sent();
                        _j.label = 3;
                    case 3:
                        _b++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function importSongs(songsData) {
        return __awaiter(this, void 0, void 0, function () {
            var CHUNK, _loop_2, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!orgId.value)
                            return [2 /*return*/];
                        CHUNK = 499;
                        _loop_2 = function (i) {
                            var batch;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        batch = (0, firestore_1.writeBatch)(firebase_1.db);
                                        songsData.slice(i, i + CHUNK).forEach(function (song) {
                                            var ref = (0, firestore_1.doc)((0, firestore_1.collection)(firebase_1.db, 'organizations', orgId.value, 'songs'));
                                            batch.set(ref, __assign(__assign({}, song), { createdAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)() }));
                                        });
                                        return [4 /*yield*/, batch.commit()];
                                    case 1:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < songsData.length)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_2(i)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        i += CHUNK;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    return {
        songs: songs,
        isLoading: isLoading,
        orgId: orgId,
        searchQuery: searchQuery,
        filterVwType: filterVwType,
        filterKey: filterKey,
        tagFilterInclude: tagFilterInclude,
        tagFilterExclude: tagFilterExclude,
        columnVisibility: columnVisibility,
        filteredSongs: filteredSongs,
        allUserTags: allUserTags,
        aiCandidateSongs: aiCandidateSongs,
        visibleSongs: visibleSongs,
        subscribe: subscribe,
        unsubscribeAll: unsubscribeAll,
        addSong: addSong,
        updateSong: updateSong,
        deleteSong: deleteSong,
        restoreSong: restoreSong,
        importSongs: importSongs,
        upsertSongs: upsertSongs,
        clearTagFilter: clearTagFilter,
        toggleColumn: toggleColumn,
        resetColumns: resetColumns,
    };
});
