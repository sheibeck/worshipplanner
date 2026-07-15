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
var vue_1 = require("vue");
var scripture_1 = require("@/utils/scripture");
var esvApi_1 = require("@/utils/esvApi");
var claudeApi_1 = require("@/utils/claudeApi");
var props = defineProps();
var emit = defineEmits();
// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRef(scriptureRef) {
    if (!scriptureRef)
        return '';
    var book = scriptureRef.book, chapter = scriptureRef.chapter, verseStart = scriptureRef.verseStart, verseEnd = scriptureRef.verseEnd;
    if (verseStart !== undefined && verseEnd !== undefined) {
        return "".concat(book, " ").concat(chapter, ":").concat(verseStart, "-").concat(verseEnd);
    }
    if (verseStart !== undefined) {
        return "".concat(book, " ").concat(chapter, ":").concat(verseStart);
    }
    return "".concat(book, " ").concat(chapter);
}
// ── Local state ────────────────────────────────────────────────────────────────
var localText = (0, vue_1.ref)(formatRef(props.modelValue));
var parseError = (0, vue_1.ref)('');
// Flag to prevent the watch from overwriting localText when the change came from
// the user typing (onTextInput emits → parent updates prop → watch fires → would
// reset the field mid-edit). Only external changes (e.g. AI suggestion selection
// in the parent) should re-sync the text field.
var skipNextWatchSync = false;
// Keep in sync when modelValue changes externally (e.g. AI selection from parent)
(0, vue_1.watch)(function () { return props.modelValue; }, function (val) {
    if (skipNextWatchSync) {
        skipNextWatchSync = false;
        return;
    }
    // Don't overwrite user's text if it already parses to the same value.
    // This guards against timing races where the flag alone isn't sufficient.
    var currentParsed = (0, scripture_1.parseScriptureInput)(localText.value);
    var sameValue = val === null && currentParsed === null
        ? true
        : val !== null &&
            currentParsed !== null &&
            val.book === currentParsed.book &&
            val.chapter === currentParsed.chapter &&
            val.verseStart === currentParsed.verseStart &&
            val.verseEnd === currentParsed.verseEnd;
    if (sameValue)
        return;
    localText.value = formatRef(val);
    parseError.value = '';
});
// ── AI state ──────────────────────────────────────────────────────────────────
var aiQuery = (0, vue_1.ref)('');
var aiLoading = (0, vue_1.ref)(false);
var aiError = (0, vue_1.ref)(false);
var aiResults = (0, vue_1.ref)([]);
var expandedPreview = (0, vue_1.ref)(null);
var aiPreviewText = (0, vue_1.ref)('');
var aiPreviewLoading = (0, vue_1.ref)(false);
var aiPreviewError = (0, vue_1.ref)(false);
// ── Computed ───────────────────────────────────────────────────────────────────
var currentRef = (0, vue_1.computed)(function () {
    return (0, scripture_1.parseScriptureInput)(localText.value);
});
var canPreview = (0, vue_1.computed)(function () { return currentRef.value !== null; });
var esvUrl = (0, vue_1.computed)(function () {
    if (!currentRef.value)
        return '';
    return (0, scripture_1.esvLink)(currentRef.value.book, currentRef.value.chapter);
});
var isComplete = (0, vue_1.computed)(function () {
    var r = currentRef.value;
    return r !== null && r.verseStart !== undefined && r.verseEnd !== undefined;
});
var hasOverlap = (0, vue_1.computed)(function () {
    if (!currentRef.value || !props.sermonPassage)
        return false;
    return (0, scripture_1.scripturesOverlap)(currentRef.value, props.sermonPassage);
});
var hasSermonContext = (0, vue_1.computed)(function () {
    var _a;
    return !!(((_a = props.sermonTopic) === null || _a === void 0 ? void 0 : _a.trim()) || props.sermonPassage);
});
var canAiSearch = (0, vue_1.computed)(function () {
    return !!(aiQuery.value.trim() || hasSermonContext.value);
});
// ── Preview state ──────────────────────────────────────────────────────────────
var previewText = (0, vue_1.ref)('');
var previewLoading = (0, vue_1.ref)(false);
var previewError = (0, vue_1.ref)('');
var previewRef = (0, vue_1.ref)('');
var passageQuery = (0, vue_1.computed)(function () {
    var r = currentRef.value;
    if (!r)
        return '';
    var base = "".concat(r.book, " ").concat(r.chapter);
    if (r.verseStart !== undefined && r.verseEnd !== undefined) {
        return "".concat(base, ":").concat(r.verseStart, "-").concat(r.verseEnd);
    }
    if (r.verseStart !== undefined) {
        return "".concat(base, ":").concat(r.verseStart);
    }
    return base;
});
var showPreviewButton = (0, vue_1.computed)(function () { return canPreview.value && passageQuery.value !== previewRef.value; });
function dismissPreview() {
    previewText.value = '';
    previewRef.value = '';
    previewError.value = '';
}
function fetchPreview() {
    return __awaiter(this, void 0, void 0, function () {
        var query, text, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = passageQuery.value;
                    if (!query)
                        return [2 /*return*/];
                    previewLoading.value = true;
                    previewError.value = '';
                    previewText.value = '';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, esvApi_1.fetchPassageText)(query)];
                case 2:
                    text = _b.sent();
                    previewText.value = text || 'No passage text found for this reference.';
                    previewRef.value = query;
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    previewError.value = 'Could not load passage. Check your connection and try again.';
                    return [3 /*break*/, 5];
                case 4:
                    previewLoading.value = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ── Text input handler ─────────────────────────────────────────────────────────
function onTextInput() {
    var text = localText.value;
    if (!text.trim()) {
        skipNextWatchSync = true;
        parseError.value = '';
        emit('update:modelValue', null);
        // Clear preview state when input is cleared
        previewText.value = '';
        previewRef.value = '';
        previewError.value = '';
        return;
    }
    var parsed = (0, scripture_1.parseScriptureInput)(text);
    skipNextWatchSync = true;
    if (parsed) {
        parseError.value = '';
        emit('update:modelValue', parsed);
    }
    else {
        parseError.value = 'Unrecognized reference — try "Book Chapter:Verse-Verse"';
        emit('update:modelValue', null);
    }
    // Clear cached preview when text changes
    if (passageQuery.value !== previewRef.value) {
        previewText.value = '';
        previewRef.value = '';
        previewError.value = '';
    }
}
// ── AI functions ───────────────────────────────────────────────────────────────
function onAiSearch() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    aiLoading.value = true;
                    aiError.value = false;
                    aiResults.value = [];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, (0, claudeApi_1.getScriptureSuggestions)({
                            sermonTopic: (_a = props.sermonTopic) !== null && _a !== void 0 ? _a : null,
                            sermonPassage: props.sermonPassage,
                            query: aiQuery.value,
                            recentScriptures: (_b = props.recentScriptures) !== null && _b !== void 0 ? _b : [],
                        })];
                case 2:
                    result = _c.sent();
                    if (result !== null) {
                        aiResults.value = result;
                    }
                    else {
                        aiError.value = true;
                    }
                    return [3 /*break*/, 4];
                case 3:
                    aiLoading.value = false;
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function onAiSuggest() {
    aiQuery.value = '';
    onAiSearch();
}
function onAiRetry() {
    aiError.value = false;
    onAiSearch();
}
function togglePreview(index) {
    return __awaiter(this, void 0, void 0, function () {
        var r, query, text, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (expandedPreview.value === index) {
                        expandedPreview.value = null;
                        return [2 /*return*/];
                    }
                    expandedPreview.value = index;
                    aiPreviewText.value = '';
                    aiPreviewError.value = false;
                    aiPreviewLoading.value = true;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    r = aiResults.value[index];
                    if (!r)
                        return [2 /*return*/];
                    query = "".concat(r.book, " ").concat(r.chapter, ":").concat(r.verseStart, "-").concat(r.verseEnd);
                    return [4 /*yield*/, (0, esvApi_1.fetchPassageText)(query)];
                case 2:
                    text = _b.sent();
                    aiPreviewText.value = text || 'No passage text found.';
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    aiPreviewError.value = true;
                    return [3 /*break*/, 5];
                case 4:
                    aiPreviewLoading.value = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function onSelectAiScripture(result) {
    localText.value = formatRef({
        book: result.book,
        chapter: result.chapter,
        verseStart: result.verseStart,
        verseEnd: result.verseEnd,
    });
    onTextInput();
    aiResults.value = [];
    aiQuery.value = '';
    expandedPreview.value = null;
    aiPreviewText.value = '';
}
function aiResultOverlapsSermon(result) {
    if (!props.sermonPassage)
        return false;
    var ref = {
        book: result.book,
        chapter: result.chapter,
        verseStart: result.verseStart,
        verseEnd: result.verseEnd,
    };
    return (0, scripture_1.scripturesOverlap)(ref, props.sermonPassage);
}
// Suppress unused warning for isComplete — available for future template use
void isComplete;
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-2" }));
if (__VLS_ctx.showAiSuggest) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex gap-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onKeydown: (__VLS_ctx.onAiSearch) }, { value: (__VLS_ctx.aiQuery), type: "text", placeholder: "Search passages... e.g. 'comfort in suffering'" }), { class: "flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.onAiSearch) }, { type: "button", disabled: (!__VLS_ctx.canAiSearch || __VLS_ctx.aiLoading) }), { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border" }), { class: (__VLS_ctx.canAiSearch && !__VLS_ctx.aiLoading
            ? 'text-indigo-400 bg-gray-800 border-gray-700 hover:bg-gray-700'
            : 'text-gray-600 bg-gray-900 border-gray-800 cursor-not-allowed') }));
    if (__VLS_ctx.aiLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "h-3.5 w-3.5 animate-spin" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.circle, __VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path, __VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3.5 w-3.5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
        });
    }
    (__VLS_ctx.aiLoading ? 'Searching...' : 'Search');
    if (!__VLS_ctx.aiQuery && __VLS_ctx.hasSermonContext && __VLS_ctx.aiResults.length === 0 && !__VLS_ctx.aiLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.onAiSuggest) }, { type: "button" }), { class: "inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3 w-3" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
        });
    }
    if (__VLS_ctx.aiError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-gray-500" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onAiRetry) }, { class: "text-indigo-400 hover:text-indigo-300 ml-1" }));
    }
    if (__VLS_ctx.aiResults.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-1" }));
        var _loop_1 = function (result, ri) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign(__assign({ key: (ri) }, { class: "rounded-md text-sm border transition-colors" }), { class: (__VLS_ctx.expandedPreview === ri
                    ? 'bg-gray-800/80 border-gray-700'
                    : 'border-transparent hover:bg-gray-800/80 hover:border-gray-700') }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.showAiSuggest))
                        return;
                    if (!(__VLS_ctx.aiResults.length > 0))
                        return;
                    __VLS_ctx.togglePreview(ri);
                } }, { type: "button" }), { class: "w-full text-left px-3 py-2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between gap-2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "font-medium text-gray-100" }));
            (result.book);
            (result.chapter);
            (result.verseStart);
            (result.verseEnd);
            if (result.recentlyUsed) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-amber-400 shrink-0" }));
                (result.weeksAgoUsed);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-indigo-400/80 mt-0.5" }));
            (result.reason);
            if (__VLS_ctx.aiResultOverlapsSermon(result)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-amber-400 mt-0.5" }));
            }
            if (__VLS_ctx.expandedPreview === ri) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-3 pb-3 space-y-2" }));
                if (__VLS_ctx.aiPreviewLoading) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 text-xs text-gray-400" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "h-3 w-3 animate-spin" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.circle, __VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path, __VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" }));
                }
                else if (__VLS_ctx.aiPreviewText) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-sm text-gray-300 bg-gray-900/50 border border-gray-700/50 rounded px-3 py-2 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto" }));
                    (__VLS_ctx.aiPreviewText);
                }
                else if (__VLS_ctx.aiPreviewError) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-red-400" }));
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.showAiSuggest))
                            return;
                        if (!(__VLS_ctx.aiResults.length > 0))
                            return;
                        if (!(__VLS_ctx.expandedPreview === ri))
                            return;
                        __VLS_ctx.onSelectAiScripture(result);
                    } }, { type: "button" }), { class: "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors" }));
            }
        };
        for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.aiResults)); _i < _a.length; _i++) {
            var _b = _a[_i], result = _b[0], ri = _b[1];
            _loop_1(result, ri);
        }
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign(__assign({ onInput: (__VLS_ctx.onTextInput) }, { value: (__VLS_ctx.localText), type: "text", placeholder: (__VLS_ctx.label === 'Sermon Passage' ? 'e.g. Romans 8:28' : 'e.g. Isaiah 53:1-6') }), { class: "w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" }), { class: (__VLS_ctx.parseError ? 'border-red-700 focus:ring-red-500' : '') }));
if (__VLS_ctx.parseError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-red-400 mt-1" }));
    (__VLS_ctx.parseError);
}
if (__VLS_ctx.canPreview) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign({ href: (__VLS_ctx.esvUrl), target: "_blank", rel: "noopener" }, { class: "inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3 w-3" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
    });
}
if (__VLS_ctx.showPreviewButton || __VLS_ctx.previewLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.fetchPreview) }, { disabled: (__VLS_ctx.previewLoading), type: "button" }), { class: "inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-wait" }));
    if (!__VLS_ctx.previewLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3 w-3" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "h-3 w-3 animate-spin" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.circle, __VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path, __VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" }));
    }
    (__VLS_ctx.previewLoading ? 'Loading...' : 'Preview passage');
}
if (__VLS_ctx.previewText) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-start gap-2 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 text-sm text-gray-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto" }));
    (__VLS_ctx.previewText);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.dismissPreview) }, { type: "button", 'aria-label': "Close preview" }), { class: "shrink-0 text-gray-500 hover:text-gray-300 transition-colors text-xs leading-none mt-0.5" }));
}
if (__VLS_ctx.previewError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1" }));
    (__VLS_ctx.previewError);
}
if (__VLS_ctx.showOverlapWarning && __VLS_ctx.hasOverlap) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-amber-400 bg-amber-950/50 border border-amber-800/50 rounded px-2 py-1" }));
}
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-48']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-wait']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-48']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-950/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-950/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            localText: localText,
            parseError: parseError,
            aiQuery: aiQuery,
            aiLoading: aiLoading,
            aiError: aiError,
            aiResults: aiResults,
            expandedPreview: expandedPreview,
            aiPreviewText: aiPreviewText,
            aiPreviewLoading: aiPreviewLoading,
            aiPreviewError: aiPreviewError,
            canPreview: canPreview,
            esvUrl: esvUrl,
            hasOverlap: hasOverlap,
            hasSermonContext: hasSermonContext,
            canAiSearch: canAiSearch,
            previewText: previewText,
            previewLoading: previewLoading,
            previewError: previewError,
            showPreviewButton: showPreviewButton,
            dismissPreview: dismissPreview,
            fetchPreview: fetchPreview,
            onTextInput: onTextInput,
            onAiSearch: onAiSearch,
            onAiSuggest: onAiSuggest,
            onAiRetry: onAiRetry,
            togglePreview: togglePreview,
            onSelectAiScripture: onSelectAiScripture,
            aiResultOverlapsSermon: aiResultOverlapsSermon,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
