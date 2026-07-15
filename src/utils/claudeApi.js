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
exports.safeParseJsonArray = safeParseJsonArray;
exports.validateSongSuggestions = validateSongSuggestions;
exports.validateScriptureSuggestions = validateScriptureSuggestions;
exports.getSongSuggestions = getSongSuggestions;
exports.getScriptureSuggestions = getScriptureSuggestions;
var sdk_1 = require("@anthropic-ai/sdk");
var scripture_1 = require("@/utils/scripture");
var appAuth_1 = require("@/utils/appAuth");
// ─── System Prompts ──────────────────────────────────────────────────────────
var SONG_SYSTEM_PROMPT = "You are a worship music curator for a church that follows the Vertical Worship (VW) methodology.\nVW song types:\n- Type 1: Call to Worship \u2014 broad, corporate, celebratory; draws the congregation in\n- Type 2: Intimate \u2014 personal, devotional, inward focus; draws hearts closer to God\n- Type 3: Ascription \u2014 declaratory, bold, attributes of God; closes in exaltation\n\nYour task: suggest songs from the provided library that best fit the sermon context. Suggest broadly across the whole catalog \u2014 the slot's VW type is provided as context only and should NOT restrict your suggestions. The worship planner applies the 1-2-3 paradigm themselves; your job is to surface thematically relevant songs.\n\nWhen a song has vwType \"unset\", use the song title and CCLI number to identify the song from your knowledge. Based on the song's lyrics and character, infer which VW type it best fits.\n\nRules:\n- Respond ONLY with a valid JSON array. No markdown, no code fences, no prose.\n- Return EXACTLY 3 items in this format: [{\"songId\":\"<id>\",\"reason\":\"<5-10 word reason>\"}]\n- songId MUST be an exact ID from the provided song library \u2014 do not invent IDs\n- Prefer songs thematically connected to the sermon topic/passage\n- The slot's VW type is advisory context \u2014 do not use it as a hard filter (D-11)\n- Deprioritize songs used in the last 2 weeks (listed as recent)\n- Consider already-selected songs to build a cohesive service flow\n- If fewer than 3 suitable songs exist, return however many are available";
var SCRIPTURE_SYSTEM_PROMPT = "You are a biblical scholar helping plan worship scripture readings.\n\nYour task: suggest scripture passages thematically relevant to the given sermon context or search query.\n\nRules:\n- Respond ONLY with a valid JSON array. No markdown, no code fences, no prose.\n- Return 3-5 items in this format: [{\"book\":\"<name>\",\"chapter\":<n>,\"verseStart\":<n>,\"verseEnd\":<n>,\"reason\":\"<5-10 words>\",\"recentlyUsed\":<bool>,\"weeksAgoUsed\":<n|null>}]\n- Book names MUST match the Protestant canon exactly (e.g., \"Psalms\" not \"Psalm\", \"1 Corinthians\" not \"First Corinthians\")\n- Aim for passages around 10 verses long \u2014 not too short (under 5) or too long (over 15)\n- Prefer passages with specific verse ranges, not entire chapters\n- Note if a passage appears in the recently used list by setting recentlyUsed:true and weeksAgoUsed to the number of weeks\n- Suggest thematically strong passages even if recently used \u2014 let the planner decide";
// ─── Lazy Singleton Client ────────────────────────────────────────────────────
var _client = null;
function getClient() {
    if (!_client) {
        _client = new sdk_1.default({
            // The real key lives server-side in the /api/anthropic proxy (Cloud Function).
            // This placeholder is overwritten by the proxy and never reaches Anthropic.
            apiKey: 'proxied-server-side',
            baseURL: "".concat(window.location.origin, "/api/anthropic"),
            dangerouslyAllowBrowser: true,
        });
    }
    return _client;
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Safely parse a JSON array from AI response text.
 * Handles: clean JSON, prose-wrapped JSON, markdown-fenced JSON.
 * Returns null on any failure.
 */
function safeParseJsonArray(text) {
    if (!text || !text.trim())
        return null;
    // Try direct parse first
    try {
        var parsed = JSON.parse(text.trim());
        if (Array.isArray(parsed))
            return parsed;
        return null;
    }
    catch (_a) {
        // Fall through to regex extraction
    }
    // Try to extract array from prose or code fences using regex
    var match = text.match(/\[[\s\S]*\]/);
    if (!match)
        return null;
    try {
        var parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed))
            return parsed;
        return null;
    }
    catch (_b) {
        return null;
    }
}
/**
 * Filter AI song suggestions to only include songIds that exist in the provided song library.
 * Removes hallucinated IDs.
 */
function validateSongSuggestions(aiResult, songs) {
    var songIdSet = new Set(songs.map(function (s) { return s.id; }));
    return aiResult.filter(function (suggestion) { return songIdSet.has(suggestion.songId); });
}
/**
 * Filter AI scripture suggestions to only include books that exist in the Protestant canon.
 * Removes hallucinated or apocryphal book names.
 */
function validateScriptureSuggestions(aiResult) {
    var bookSet = new Set(scripture_1.BIBLE_BOOKS);
    return aiResult.filter(function (suggestion) { return bookSet.has(suggestion.book); });
}
/**
 * Get AI song suggestions for a specific slot.
 * Returns null on any error (API error, parse error, empty validated results).
 */
function getSongSuggestions(params) {
    return __awaiter(this, void 0, Promise, function () {
        var sermonTopic, sermonPassage, slotVwType, alreadySelectedSongIds, songLibrary_1, recentServiceSongIds, contextParts, passageStr, typeLabels, selectedTitles, recentTitles, libraryEntries, userMessage, response, _a, _b, _c, textContent, parsed, validated, err_1;
        var _d;
        var _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 3, , 4]);
                    sermonTopic = params.sermonTopic, sermonPassage = params.sermonPassage, slotVwType = params.slotVwType, alreadySelectedSongIds = params.alreadySelectedSongIds, songLibrary_1 = params.songLibrary, recentServiceSongIds = params.recentServiceSongIds;
                    contextParts = [];
                    if (sermonTopic) {
                        contextParts.push("Sermon Topic/Theme: ".concat(sermonTopic));
                    }
                    if (sermonPassage) {
                        passageStr = sermonPassage.verseStart
                            ? "".concat(sermonPassage.book, " ").concat(sermonPassage.chapter, ":").concat(sermonPassage.verseStart).concat(sermonPassage.verseEnd ? "-".concat(sermonPassage.verseEnd) : '')
                            : "".concat(sermonPassage.book, " ").concat(sermonPassage.chapter);
                        contextParts.push("Sermon Passage: ".concat(passageStr));
                    }
                    if (slotVwType) {
                        typeLabels = {
                            1: 'Type 1 (Call to Worship)',
                            2: 'Type 2 (Intimate)',
                            3: 'Type 3 (Ascription)',
                        };
                        // Advisory only (D-11): mention as context but do NOT restrict suggestions to this type
                        contextParts.push("Slot VW Type (advisory context only): ".concat((_e = typeLabels[slotVwType]) !== null && _e !== void 0 ? _e : "Type ".concat(slotVwType)));
                    }
                    if (alreadySelectedSongIds.length > 0) {
                        selectedTitles = alreadySelectedSongIds
                            .map(function (id) {
                            var song = songLibrary_1.find(function (s) { return s.id === id; });
                            return song ? "\"".concat(song.title, "\"") : id;
                        })
                            .join(', ');
                        contextParts.push("Already selected songs in this service: ".concat(selectedTitles));
                    }
                    if (recentServiceSongIds.length > 0) {
                        recentTitles = recentServiceSongIds
                            .map(function (id) {
                            var song = songLibrary_1.find(function (s) { return s.id === id; });
                            return song ? "\"".concat(song.title, "\"") : id;
                        })
                            .join(', ');
                        contextParts.push("Recently used songs (last 2 weeks \u2014 deprioritize): ".concat(recentTitles));
                    }
                    libraryEntries = songLibrary_1.map(function (song) {
                        var parts = ["id: ".concat(song.id), "title: \"".concat(song.title, "\""), "vwTypes: ".concat(song.vwTypes.length > 0 ? song.vwTypes.join(',') : 'unset')];
                        if (song.ccliNumber) {
                            parts.push("ccli: ".concat(song.ccliNumber));
                        }
                        if (song.themes.length > 0) {
                            parts.push("themes: ".concat(song.themes.join(', ')));
                        }
                        if (song.lastUsedAt) {
                            var ms = song.lastUsedAt.toMillis();
                            var weeksAgo = Math.floor((Date.now() - ms) / (7 * 24 * 60 * 60 * 1000));
                            parts.push("lastUsed: ".concat(weeksAgo, " weeks ago"));
                        }
                        return "{ ".concat(parts.join(', '), " }");
                    });
                    userMessage = __spreadArray(__spreadArray(__spreadArray([], contextParts, true), [
                        '',
                        "Song Library (".concat(songLibrary_1.length, " songs):")
                    ], false), libraryEntries, true).join('\n');
                    _b = (_a = getClient().messages).create;
                    _c = [{
                            model: 'claude-haiku-4-5-20251001',
                            max_tokens: 512,
                            system: SONG_SYSTEM_PROMPT,
                            messages: [{ role: 'user', content: userMessage }],
                        }];
                    _d = {};
                    return [4 /*yield*/, (0, appAuth_1.getAppAuthHeaders)()];
                case 1: return [4 /*yield*/, _b.apply(_a, _c.concat([(_d.headers = _f.sent(), _d)]))];
                case 2:
                    response = _f.sent();
                    textContent = response.content.find(function (c) { return c.type === 'text'; });
                    if (!textContent || textContent.type !== 'text')
                        return [2 /*return*/, null];
                    parsed = safeParseJsonArray(textContent.text);
                    if (!parsed)
                        return [2 /*return*/, null];
                    validated = validateSongSuggestions(parsed, songLibrary_1);
                    if (validated.length === 0)
                        return [2 /*return*/, null];
                    return [2 /*return*/, validated];
                case 3:
                    err_1 = _f.sent();
                    console.error('[claudeApi] getSongSuggestions failed:', err_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get AI scripture suggestions based on sermon context or natural language query.
 * Returns null on any error (API error, parse error, empty validated results).
 */
function getScriptureSuggestions(params) {
    return __awaiter(this, void 0, Promise, function () {
        var sermonTopic, sermonPassage, query, recentScriptures, contextParts, passageStr, recentList, userMessage, response, _a, _b, _c, textContent, parsed, validated, err_2;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 3, , 4]);
                    sermonTopic = params.sermonTopic, sermonPassage = params.sermonPassage, query = params.query, recentScriptures = params.recentScriptures;
                    contextParts = [];
                    if (query) {
                        contextParts.push("Search Query: ".concat(query));
                    }
                    if (sermonTopic) {
                        contextParts.push("Sermon Topic/Theme: ".concat(sermonTopic));
                    }
                    if (sermonPassage) {
                        passageStr = sermonPassage.verseStart
                            ? "".concat(sermonPassage.book, " ").concat(sermonPassage.chapter, ":").concat(sermonPassage.verseStart).concat(sermonPassage.verseEnd ? "-".concat(sermonPassage.verseEnd) : '')
                            : "".concat(sermonPassage.book, " ").concat(sermonPassage.chapter);
                        contextParts.push("Sermon Passage: ".concat(passageStr));
                    }
                    if (recentScriptures.length > 0) {
                        recentList = recentScriptures
                            .map(function (s) {
                            if (s.verseStart) {
                                return "".concat(s.book, " ").concat(s.chapter, ":").concat(s.verseStart).concat(s.verseEnd ? "-".concat(s.verseEnd) : '');
                            }
                            return "".concat(s.book, " ").concat(s.chapter);
                        })
                            .join(', ');
                        contextParts.push("Recently used scriptures (note if suggesting these): ".concat(recentList));
                    }
                    userMessage = contextParts.join('\n');
                    _b = (_a = getClient().messages).create;
                    _c = [{
                            model: 'claude-haiku-4-5-20251001',
                            max_tokens: 512,
                            system: SCRIPTURE_SYSTEM_PROMPT,
                            messages: [{ role: 'user', content: userMessage }],
                        }];
                    _d = {};
                    return [4 /*yield*/, (0, appAuth_1.getAppAuthHeaders)()];
                case 1: return [4 /*yield*/, _b.apply(_a, _c.concat([(_d.headers = _e.sent(), _d)]))];
                case 2:
                    response = _e.sent();
                    textContent = response.content.find(function (c) { return c.type === 'text'; });
                    if (!textContent || textContent.type !== 'text')
                        return [2 /*return*/, null];
                    parsed = safeParseJsonArray(textContent.text);
                    if (!parsed)
                        return [2 /*return*/, null];
                    validated = validateScriptureSuggestions(parsed);
                    if (validated.length === 0)
                        return [2 /*return*/, null];
                    return [2 /*return*/, validated];
                case 3:
                    err_2 = _e.sent();
                    console.error('[claudeApi] getScriptureSuggestions failed:', err_2);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
