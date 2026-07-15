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
exports.mapPcSongToUpsert = mapPcSongToUpsert;
exports.fetchAllPcSongs = fetchAllPcSongs;
exports.fetchAndMapPcSongs = fetchAndMapPcSongs;
exports.partitionPcSongs = partitionPcSongs;
exports.importFromPc = importFromPc;
var firestore_1 = require("firebase/firestore");
var planningCenterApi_1 = require("@/utils/planningCenterApi");
/**
 * Base URL for Planning Center API — same as PC_BASE_URL in planningCenterApi.ts.
 * Duplicated here to avoid importing from planningCenterApi just for the constant,
 * which would require the full module in mocks.
 */
var PC_SONGS_BASE_URL = '/api/planningcenter/services/v2';
/**
 * Pattern to detect category tags. Matches "category 1", "category 2", "category 3"
 * case-insensitively with optional whitespace between "category" and the number.
 */
var CATEGORY_1_RE = /^category\s*1$/i;
var CATEGORY_2_RE = /^category\s*2$/i;
var CATEGORY_3_RE = /^category\s*3$/i;
function isCategoryTag(name) {
    return CATEGORY_1_RE.test(name) || CATEGORY_2_RE.test(name) || CATEGORY_3_RE.test(name);
}
/**
 * Map a Planning Center song + resolved tags + arrangements to a UpsertSongInput.
 * This is a pure function with no side effects.
 *
 * @param pcSong - The PC song data object
 * @param tags - Resolved tag objects for this song (id + name)
 * @param arrangements - Resolved arrangement objects (id + name)
 * @param lastArrangementId - Arrangement id from the song's most recent PC schedule
 *   (the "play key"); used to default primaryArrangementId. Optional.
 * @returns UpsertSongInput ready for store.upsertSongs
 */
function mapPcSongToUpsert(pcSong, tags, arrangements, lastArrangementId) {
    var _a, _b, _c, _d;
    var attributes = pcSong.attributes;
    // Determine vwTypes from category tags (collect ALL matching categories)
    var vwTypes = [];
    for (var _i = 0, tags_1 = tags; _i < tags_1.length; _i++) {
        var tag = tags_1[_i];
        if (CATEGORY_1_RE.test(tag.name))
            vwTypes.push(1);
        else if (CATEGORY_2_RE.test(tag.name))
            vwTypes.push(2);
        else if (CATEGORY_3_RE.test(tag.name))
            vwTypes.push(3);
    }
    // team-style tags = non-category tag names + "Orchestra" if any arrangement matches.
    // D-01: these are written into the flat `tags` field (not `teamTags`) below.
    var teamStyleTags = tags
        .filter(function (tag) { return !isCategoryTag(tag.name); })
        .map(function (tag) { return tag.name; });
    var hasOrchestra = arrangements.some(function (arr) { return /orchestra/i.test(arr.name); });
    if (hasOrchestra) {
        teamStyleTags.push('Orchestra');
    }
    // Map last_scheduled_at to Firestore Timestamp
    var lastUsedAt = attributes.last_scheduled_at != null
        ? firestore_1.Timestamp.fromDate(new Date(attributes.last_scheduled_at))
        : null;
    // Parse themes: comma-separated string → trimmed array (filter empty)
    var themes = attributes.themes
        ? attributes.themes
            .split(',')
            .map(function (t) { return t.trim(); })
            .filter(Boolean)
        : [];
    // Map arrangements to the Arrangement shape with defaults
    var mappedArrangements = arrangements.map(function (arr) { return ({
        id: arr.id,
        name: arr.name,
        key: arr.key,
        bpm: null,
        lengthSeconds: null,
        chordChartUrl: '',
        notes: '',
        teamTags: [],
    }); });
    // Primary "play key": the last-scheduled arrangement when it exists in this
    // song's arrangements, otherwise the first arrangement.
    var primaryArrangementId = lastArrangementId && mappedArrangements.some(function (a) { return a.id === lastArrangementId; })
        ? lastArrangementId
        : ((_b = (_a = mappedArrangements[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null);
    return {
        title: attributes.title,
        ccliNumber: (_c = attributes.ccli_number) !== null && _c !== void 0 ? _c : '',
        author: (_d = attributes.author) !== null && _d !== void 0 ? _d : '',
        themes: themes,
        notes: '',
        vwTypes: vwTypes,
        // D-01: team-style tag names (Orchestra + non-category PC tags) now go into the flat
        // tags field; upsertSongs unions this into any pre-existing user tags on re-import.
        tags: teamStyleTags,
        removedThemes: [], // D-14: PC import never removes themes itself
        arrangements: mappedArrangements,
        primaryArrangementId: primaryArrangementId,
        lastUsedAt: lastUsedAt,
        pcSongId: pcSong.id,
        hidden: false,
    };
}
/**
 * Fetch all songs from Planning Center, following pagination via links.next.
 * Songs are fetched with ?include=tags to sideload tag data in a single request.
 *
 * @param appId - PC API Application ID
 * @param secret - PC API Secret
 * @returns Array of { song: PcSongData, tags: { id, name }[] } — one entry per song
 */
function fetchAllPcSongs(appId, secret) {
    return __awaiter(this, void 0, Promise, function () {
        var authHeader, url, allSongs, tagMap, response, _loop_1, attempt, state_1, json, _i, _a, included;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    authHeader = 'Basic ' + btoa(appId + ':' + secret);
                    url = "".concat(PC_SONGS_BASE_URL, "/songs?include=tags&per_page=100");
                    allSongs = [];
                    tagMap = new Map() // id → name
                    ;
                    _c.label = 1;
                case 1:
                    if (!url) return [3 /*break*/, 7];
                    response = void 0;
                    _loop_1 = function (attempt) {
                        var retryAfter, waitMs;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, fetch(url, {
                                        headers: { Authorization: authHeader, Accept: 'application/json' },
                                    })];
                                case 1:
                                    response = _d.sent();
                                    if (response.status !== 429 || attempt >= 3)
                                        return [2 /*return*/, "break"];
                                    retryAfter = response.headers.get('Retry-After');
                                    waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 60000;
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, waitMs); })];
                                case 2:
                                    _d.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _c.label = 2;
                case 2: return [5 /*yield**/, _loop_1(attempt)];
                case 3:
                    state_1 = _c.sent();
                    if (state_1 === "break")
                        return [3 /*break*/, 5];
                    _c.label = 4;
                case 4:
                    attempt++;
                    return [3 /*break*/, 2];
                case 5:
                    if (!response.ok) {
                        throw new Error("Failed to fetch PC songs: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 6:
                    json = (_c.sent());
                    // Collect songs
                    allSongs.push.apply(allSongs, json.data);
                    // Collect tags from this page's included sideloads
                    for (_i = 0, _a = (_b = json.included) !== null && _b !== void 0 ? _b : []; _i < _a.length; _i++) {
                        included = _a[_i];
                        if (included.type === 'Tag') {
                            tagMap.set(included.id, included.attributes.name);
                        }
                    }
                    // Follow pagination — rewrite absolute PC URL to local proxy path
                    if (json.links.next) {
                        url = json.links.next.replace('https://api.planningcenteronline.com/services/v2', PC_SONGS_BASE_URL);
                    }
                    else {
                        url = undefined;
                    }
                    return [3 /*break*/, 1];
                case 7: 
                // Resolve tags per song using the accumulated tagMap
                return [2 /*return*/, allSongs.map(function (song) {
                        var _a, _b, _c;
                        var tagRefs = (_c = (_b = (_a = song.relationships) === null || _a === void 0 ? void 0 : _a.tags) === null || _b === void 0 ? void 0 : _b.data) !== null && _c !== void 0 ? _c : [];
                        var tags = tagRefs
                            .map(function (ref) {
                            var name = tagMap.get(ref.id);
                            return name ? { id: ref.id, name: name } : null;
                        })
                            .filter(function (t) { return t !== null; });
                        return { song: song, tags: tags };
                    })];
            }
        });
    });
}
/**
 * Fetch all PC songs and map them to UpsertSongInput[] without writing to Firestore.
 * This is the function called by PcImportModal to get preview data before user confirms.
 *
 * Fetches arrangements per song (in batches of 10) to detect Orchestra tag.
 *
 * @param appId - PC API Application ID
 * @param secret - PC API Secret
 * @returns UpsertSongInput[] ready for display or import
 */
function fetchAndMapPcSongs(appId, secret) {
    return __awaiter(this, void 0, Promise, function () {
        var allSongData, BATCH_SIZE, results, i, batch, mappedBatch;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchAllPcSongs(appId, secret)
                    // Fetch arrangements in batches of 3 to stay under PC rate limits
                ];
                case 1:
                    allSongData = _a.sent();
                    BATCH_SIZE = 3;
                    results = [];
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < allSongData.length)) return [3 /*break*/, 5];
                    batch = allSongData.slice(i, i + BATCH_SIZE);
                    return [4 /*yield*/, Promise.all(batch.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var arrangements, lastArrangementId, lastScheduled;
                            var _c;
                            var song = _b.song, tags = _b.tags;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0: return [4 /*yield*/, (0, planningCenterApi_1.fetchSongArrangements)(appId, secret, song.id)
                                        // Only resolve the last-scheduled arrangement when there are multiple to
                                        // choose from — avoids an extra API call for single-arrangement songs.
                                    ];
                                    case 1:
                                        arrangements = _d.sent();
                                        lastArrangementId = null;
                                        if (!(arrangements.length > 1)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, (0, planningCenterApi_1.fetchLastScheduledItem)(appId, secret, song.id)];
                                    case 2:
                                        lastScheduled = _d.sent();
                                        lastArrangementId = (_c = lastScheduled === null || lastScheduled === void 0 ? void 0 : lastScheduled.arrangementId) !== null && _c !== void 0 ? _c : null;
                                        _d.label = 3;
                                    case 3: return [2 /*return*/, mapPcSongToUpsert(song, tags, arrangements, lastArrangementId)];
                                }
                            });
                        }); }))];
                case 3:
                    mappedBatch = _a.sent();
                    results.push.apply(results, mappedBatch);
                    _a.label = 4;
                case 4:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Split mapped PC songs into "new" (not yet in the library) and "already-imported"
 * (matches an existing song) based on the shared triple-key matching rule:
 * pcSongId (exact) OR ccliNumber (exact, non-empty) OR title (case-insensitive).
 *
 * This is a pure function — no side effects, no store access. It centralizes the
 * matching logic previously duplicated in PcImportModal's classifySongs and in
 * importFromPc's inline counting.
 *
 * @param mapped - Mapped PC songs (from fetchAndMapPcSongs) to classify
 * @param existing - Existing library songs to match against
 * @returns { newSongs, existingSongs } — both preserve the original `mapped` order
 */
function partitionPcSongs(mapped, existing) {
    var byPcId = new Set(existing.filter(function (s) { return s.pcSongId; }).map(function (s) { return s.pcSongId; }));
    var byCcli = new Set(existing.filter(function (s) { return s.ccliNumber; }).map(function (s) { return s.ccliNumber; }));
    var byTitle = new Set(existing.map(function (s) { return s.title.toLowerCase(); }));
    var newSongs = [];
    var existingSongs = [];
    for (var _i = 0, mapped_1 = mapped; _i < mapped_1.length; _i++) {
        var song = mapped_1[_i];
        var isExisting = (song.pcSongId != null && byPcId.has(song.pcSongId)) ||
            (song.ccliNumber !== '' && byCcli.has(song.ccliNumber)) ||
            byTitle.has(song.title.toLowerCase());
        if (isExisting) {
            existingSongs.push(song);
        }
        else {
            newSongs.push(song);
        }
    }
    return { newSongs: newSongs, existingSongs: existingSongs };
}
/**
 * Import all songs from Planning Center into the WorshipPlanner store.
 * Orchestrates: fetch → map → upsert, reporting progress along the way.
 *
 * @param appId - PC API Application ID
 * @param secret - PC API Secret
 * @param store - Song store with songs array and upsertSongs method
 * @param onProgress - Optional progress callback (current, total)
 * @returns Summary of { added, updated, errors }
 */
function importFromPc(appId, secret, store, onProgress) {
    return __awaiter(this, void 0, Promise, function () {
        var allMapped, existingPcSongIds, existingCcliNumbers, existingTitles, added, updated, _i, allMapped_1, song, isExisting;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Step 1: Fetch and map all songs
                    onProgress === null || onProgress === void 0 ? void 0 : onProgress(0, 2);
                    return [4 /*yield*/, fetchAndMapPcSongs(appId, secret)];
                case 1:
                    allMapped = _a.sent();
                    onProgress === null || onProgress === void 0 ? void 0 : onProgress(1, 2);
                    existingPcSongIds = new Set(store.songs.map(function (s) { return s.pcSongId; }).filter(Boolean));
                    existingCcliNumbers = new Set(store.songs.map(function (s) { return s.ccliNumber; }).filter(Boolean));
                    existingTitles = new Set(store.songs.map(function (s) { return s.title.toLowerCase(); }));
                    added = 0;
                    updated = 0;
                    for (_i = 0, allMapped_1 = allMapped; _i < allMapped_1.length; _i++) {
                        song = allMapped_1[_i];
                        isExisting = (song.pcSongId != null && existingPcSongIds.has(song.pcSongId)) ||
                            (song.ccliNumber !== '' && existingCcliNumbers.has(song.ccliNumber)) ||
                            existingTitles.has(song.title.toLowerCase());
                        if (isExisting) {
                            updated++;
                        }
                        else {
                            added++;
                        }
                    }
                    // Step 2: Upsert all songs into the store
                    return [4 /*yield*/, store.upsertSongs(allMapped)];
                case 2:
                    // Step 2: Upsert all songs into the store
                    _a.sent();
                    onProgress === null || onProgress === void 0 ? void 0 : onProgress(2, 2);
                    return [2 /*return*/, { added: added, updated: updated, errors: [] }];
            }
        });
    });
}
