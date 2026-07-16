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
var vue_1 = require("vue");
var vue_router_1 = require("vue-router");
var auth_1 = require("@/stores/auth");
var songs_1 = require("@/stores/songs");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var SongFilters_vue_1 = require("@/components/SongFilters.vue");
var SongTable_vue_1 = require("@/components/SongTable.vue");
var SongSlideOver_vue_1 = require("@/components/SongSlideOver.vue");
var BatchQuickAssign_vue_1 = require("@/components/BatchQuickAssign.vue");
var PcImportModal_vue_1 = require("@/components/PcImportModal.vue");
var authStore = (0, auth_1.useAuthStore)();
var songStore = (0, songs_1.useSongStore)();
var route = (0, vue_router_1.useRoute)();
var router = (0, vue_router_1.useRouter)();
// Slide-over state
var selectedSong = (0, vue_1.ref)(null);
var slideOverOpen = (0, vue_1.ref)(false);
// Import modal state
var importModalOpen = (0, vue_1.ref)(false);
// Batch quick-assign mode
var batchMode = (0, vue_1.ref)(false);
// Hidden songs toggle + computed
var showHidden = (0, vue_1.ref)(false);
var hiddenSongs = (0, vue_1.computed)(function () { return songStore.songs.filter(function (s) { return s.hidden === true; }); });
function onRestoreSong(song) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, songStore.restoreSong(song.id)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Uncategorized songs (for batch assign)
var uncategorizedSongs = (0, vue_1.computed)(function () {
    return songStore.songs.filter(function (s) { return s.vwTypes.length === 0 && s.hidden !== true; });
});
// Derived filter options from current songs
var availableKeys = (0, vue_1.computed)(function () {
    var keys = new Set();
    songStore.songs.forEach(function (song) {
        // Hidden songs contribute no filter options (same guard as availableUserTags).
        if (song.hidden === true)
            return;
        song.arrangements.forEach(function (arr) {
            if (arr.key)
                keys.add(arr.key);
        });
    });
    return Array.from(keys).sort();
});
var availableUserTags = (0, vue_1.computed)(function () {
    var tags = new Set();
    songStore.songs.forEach(function (song) {
        var _a, _b;
        // Hidden (soft-deleted) songs contribute no metadata to the filter list —
        // otherwise their tags appear as checkable options that match zero visible songs.
        if (song.hidden === true)
            return;
        ((_a = song.themes) !== null && _a !== void 0 ? _a : []).forEach(function (t) { return tags.add(t); });
        ((_b = song.tags) !== null && _b !== void 0 ? _b : []).forEach(function (t) { return tags.add(t); });
    });
    return Array.from(tags).sort();
});
// ── Bulk tag selection state ───────────────────────────────────────────────────
var selectedSongIds = (0, vue_1.ref)(new Set());
var bulkTagInput = (0, vue_1.ref)('');
var songTableRef = (0, vue_1.ref)(null);
function onSelectionUpdate(ids) {
    selectedSongIds.value = ids;
}
function clearBulkSelection() {
    var _a;
    selectedSongIds.value = new Set();
    (_a = songTableRef.value) === null || _a === void 0 ? void 0 : _a.clearSelection();
}
function applyBulkTag() {
    return __awaiter(this, void 0, void 0, function () {
        var tag, songs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tag = bulkTagInput.value.trim();
                    if (!tag)
                        return [2 /*return*/];
                    songs = songStore.songs.filter(function (s) { return selectedSongIds.value.has(s.id); });
                    return [4 /*yield*/, Promise.all(songs.map(function (song) {
                            var _a;
                            var existingTags = (_a = song.tags) !== null && _a !== void 0 ? _a : [];
                            if (existingTags.includes(tag))
                                return Promise.resolve();
                            return songStore.updateSong(song.id, { tags: __spreadArray(__spreadArray([], existingTags, true), [tag], false) });
                        }))];
                case 1:
                    _a.sent();
                    clearBulkSelection();
                    bulkTagInput.value = '';
                    return [2 /*return*/];
            }
        });
    });
}
function removeBulkTag() {
    return __awaiter(this, void 0, void 0, function () {
        var tag, songs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tag = bulkTagInput.value.trim();
                    if (!tag)
                        return [2 /*return*/];
                    songs = songStore.songs.filter(function (s) { return selectedSongIds.value.has(s.id); });
                    return [4 /*yield*/, Promise.all(songs.map(function (song) {
                            var _a;
                            var existingTags = (_a = song.tags) !== null && _a !== void 0 ? _a : [];
                            if (!existingTags.includes(tag))
                                return Promise.resolve();
                            return songStore.updateSong(song.id, { tags: existingTags.filter(function (t) { return t !== tag; }) });
                        }))];
                case 1:
                    _a.sent();
                    clearBulkSelection();
                    bulkTagInput.value = '';
                    return [2 /*return*/];
            }
        });
    });
}
// Subscribe to Firestore songs collection once orgId is resolved
function initStore() {
    var orgId = authStore.orgId;
    if (!orgId)
        return;
    songStore.subscribe(orgId);
}
(0, vue_1.onMounted)(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        initStore();
        // Check for ?import=true query param — auto-open import modal
        if (route.query.import === 'true') {
            importModalOpen.value = true;
            // Clear query param without navigation
            router.replace({ query: __assign(__assign({}, route.query), { import: undefined }) });
        }
        return [2 /*return*/];
    });
}); });
(0, vue_1.onUnmounted)(function () {
    songStore.unsubscribeAll();
});
function onSelectSong(song) {
    selectedSong.value = song;
    slideOverOpen.value = true;
}
function onAddSong() {
    selectedSong.value = null;
    slideOverOpen.value = true;
}
function onImported(count) {
    importModalOpen.value = false;
    console.log("[SongsView] imported ".concat(count, " songs"));
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
/** @type {[typeof AppShell, typeof AppShell, ]} */ ;
// @ts-ignore
var __VLS_0 = __VLS_asFunctionalComponent(AppShell_vue_1.default, new AppShell_vue_1.default({}));
var __VLS_1 = __VLS_0.apply(void 0, __spreadArray([{}], __VLS_functionalComponentArgsRest(__VLS_0), false));
var __VLS_3 = {};
__VLS_2.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-6 py-8" }));
if (__VLS_ctx.batchMode) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6" }));
    /** @type {[typeof BatchQuickAssign, ]} */ ;
    // @ts-ignore
    var __VLS_4 = __VLS_asFunctionalComponent(BatchQuickAssign_vue_1.default, new BatchQuickAssign_vue_1.default(__assign({ 'onDone': {} }, { songs: (__VLS_ctx.uncategorizedSongs) })));
    var __VLS_5 = __VLS_4.apply(void 0, __spreadArray([__assign({ 'onDone': {} }, { songs: (__VLS_ctx.uncategorizedSongs) })], __VLS_functionalComponentArgsRest(__VLS_4), false));
    var __VLS_7 = void 0;
    var __VLS_8 = void 0;
    var __VLS_9 = void 0;
    var __VLS_10 = {
        onDone: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.batchMode))
                return;
            __VLS_ctx.batchMode = false;
        }
    };
    var __VLS_6;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-800" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-xl font-semibold text-gray-100" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-1" }));
    (__VLS_ctx.songStore.isLoading ? 'Loading...' : "".concat(__VLS_ctx.songStore.visibleSongs.length, " song").concat(__VLS_ctx.songStore.visibleSongs.length !== 1 ? 's' : ''));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto [&>*]:justify-center sm:[&>*]:justify-start" }));
    if (__VLS_ctx.uncategorizedSongs.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.batchMode))
                    return;
                if (!(__VLS_ctx.uncategorizedSongs.length > 0))
                    return;
                __VLS_ctx.batchMode = true;
            } }, { class: "inline-flex items-center gap-2 rounded-md border border-amber-700 bg-amber-900/20 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-900/40 hover:text-amber-200 transition-colors" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
        });
        (__VLS_ctx.uncategorizedSongs.length);
    }
    if (__VLS_ctx.hiddenSongs.length > 0 || __VLS_ctx.showHidden) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!!(__VLS_ctx.batchMode))
                    return;
                if (!(__VLS_ctx.hiddenSongs.length > 0 || __VLS_ctx.showHidden))
                    return;
                __VLS_ctx.showHidden = !__VLS_ctx.showHidden;
            } }, { class: "inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors" }));
        (__VLS_ctx.showHidden ? 'Hide Hidden' : "Hidden (".concat(__VLS_ctx.hiddenSongs.length, ")"));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!!(__VLS_ctx.batchMode))
                return;
            __VLS_ctx.importModalOpen = true;
        } }, { class: "inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: (__VLS_ctx.onAddSong) }, { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M12 4v16m8-8H4",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-4" }));
    /** @type {[typeof SongFilters, ]} */ ;
    // @ts-ignore
    var __VLS_11 = __VLS_asFunctionalComponent(SongFilters_vue_1.default, new SongFilters_vue_1.default(__assign({ 'onClearTagFilter': {} }, { searchQuery: (__VLS_ctx.songStore.searchQuery), filterVwType: (__VLS_ctx.songStore.filterVwType), filterKey: (__VLS_ctx.songStore.filterKey), tagFilterInclude: (__VLS_ctx.songStore.tagFilterInclude), tagFilterExclude: (__VLS_ctx.songStore.tagFilterExclude), availableKeys: (__VLS_ctx.availableKeys), availableUserTags: (__VLS_ctx.availableUserTags) })));
    var __VLS_12 = __VLS_11.apply(void 0, __spreadArray([__assign({ 'onClearTagFilter': {} }, { searchQuery: (__VLS_ctx.songStore.searchQuery), filterVwType: (__VLS_ctx.songStore.filterVwType), filterKey: (__VLS_ctx.songStore.filterKey), tagFilterInclude: (__VLS_ctx.songStore.tagFilterInclude), tagFilterExclude: (__VLS_ctx.songStore.tagFilterExclude), availableKeys: (__VLS_ctx.availableKeys), availableUserTags: (__VLS_ctx.availableUserTags) })], __VLS_functionalComponentArgsRest(__VLS_11), false));
    var __VLS_14 = void 0;
    var __VLS_15 = void 0;
    var __VLS_16 = void 0;
    var __VLS_17 = {
        onClearTagFilter: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!!(__VLS_ctx.batchMode))
                return;
            __VLS_ctx.songStore.clearTagFilter();
        }
    };
    var __VLS_13;
    if (__VLS_ctx.selectedSongIds.size > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-4 flex items-center gap-3 p-3 rounded-lg border border-indigo-700 bg-indigo-900/20" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-indigo-300 font-medium" }));
        (__VLS_ctx.selectedSongIds.size);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign({ onKeydown: (__VLS_ctx.applyBulkTag) }, { value: (__VLS_ctx.bulkTagInput), type: "text", list: "sv-existing-user-tags", placeholder: "Tag name" }), { class: "rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-40" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.datalist, __VLS_intrinsicElements.datalist)({
            id: "sv-existing-user-tags",
        });
        for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.songStore.allUserTags)); _i < _a.length; _i++) {
            var t = _a[_i][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option)({
                key: (t),
                value: (t),
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.applyBulkTag) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50" }), { disabled: (!__VLS_ctx.bulkTagInput.trim()) }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.removeBulkTag) }, { type: "button" }), { class: "px-3 py-1.5 rounded-md text-sm font-medium text-red-300 bg-red-900/20 border border-red-800 hover:bg-red-900/40 transition-colors disabled:opacity-50" }), { disabled: (!__VLS_ctx.bulkTagInput.trim()) }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.clearBulkSelection) }, { type: "button" }), { class: "ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors" }));
    }
    /** @type {[typeof SongTable, ]} */ ;
    // @ts-ignore
    var __VLS_18 = __VLS_asFunctionalComponent(SongTable_vue_1.default, new SongTable_vue_1.default(__assign(__assign(__assign({ 'onSelect': {} }, { 'onAdd': {} }), { 'onUpdate:selectedIds': {} }), { ref: "songTableRef", songs: (__VLS_ctx.songStore.filteredSongs), loading: (__VLS_ctx.songStore.isLoading) })));
    var __VLS_19 = __VLS_18.apply(void 0, __spreadArray([__assign(__assign(__assign({ 'onSelect': {} }, { 'onAdd': {} }), { 'onUpdate:selectedIds': {} }), { ref: "songTableRef", songs: (__VLS_ctx.songStore.filteredSongs), loading: (__VLS_ctx.songStore.isLoading) })], __VLS_functionalComponentArgsRest(__VLS_18), false));
    var __VLS_21 = void 0;
    var __VLS_22 = void 0;
    var __VLS_23 = void 0;
    var __VLS_24 = {
        onSelect: (__VLS_ctx.onSelectSong)
    };
    var __VLS_25 = {
        onAdd: (__VLS_ctx.onAddSong)
    };
    var __VLS_26 = {
        'onUpdate:selectedIds': (__VLS_ctx.onSelectionUpdate)
    };
    /** @type {typeof __VLS_ctx.songTableRef} */ ;
    var __VLS_27 = {};
    var __VLS_20;
    if (__VLS_ctx.showHidden) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-8 border border-gray-700 rounded-xl overflow-hidden" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-3 bg-gray-800 border-b border-gray-700" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-sm font-medium text-gray-300" }));
        (__VLS_ctx.hiddenSongs.length);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mt-0.5" }));
        if (__VLS_ctx.hiddenSongs.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-6 text-center text-sm text-gray-500" }));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "divide-y divide-gray-800" }));
            var _loop_1 = function (song) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (song.id) }, { class: "flex items-center justify-between px-4 py-3 hover:bg-gray-800/40" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 line-through" }));
                (song.title);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-600" }));
                (song.author || 'Unknown');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!!(__VLS_ctx.batchMode))
                            return;
                        if (!(__VLS_ctx.showHidden))
                            return;
                        if (!!(__VLS_ctx.hiddenSongs.length === 0))
                            return;
                        __VLS_ctx.onRestoreSong(song);
                    } }, { class: "text-xs px-3 py-1.5 rounded-md border border-indigo-700 text-indigo-300 hover:bg-indigo-900/30 transition-colors" }));
            };
            for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.hiddenSongs)); _b < _c.length; _b++) {
                var song = _c[_b][0];
                _loop_1(song);
            }
        }
    }
}
/** @type {[typeof SongSlideOver, ]} */ ;
// @ts-ignore
var __VLS_29 = __VLS_asFunctionalComponent(SongSlideOver_vue_1.default, new SongSlideOver_vue_1.default(__assign(__assign(__assign({ 'onClose': {} }, { 'onSaved': {} }), { 'onDeleted': {} }), { open: (__VLS_ctx.slideOverOpen), song: (__VLS_ctx.selectedSong) })));
var __VLS_30 = __VLS_29.apply(void 0, __spreadArray([__assign(__assign(__assign({ 'onClose': {} }, { 'onSaved': {} }), { 'onDeleted': {} }), { open: (__VLS_ctx.slideOverOpen), song: (__VLS_ctx.selectedSong) })], __VLS_functionalComponentArgsRest(__VLS_29), false));
var __VLS_32;
var __VLS_33;
var __VLS_34;
var __VLS_35 = {
    onClose: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.slideOverOpen = false;
    }
};
var __VLS_36 = {
    onSaved: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.slideOverOpen = false;
    }
};
var __VLS_37 = {
    onDeleted: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.slideOverOpen = false;
    }
};
var __VLS_31;
/** @type {[typeof PcImportModal, ]} */ ;
// @ts-ignore
var __VLS_38 = __VLS_asFunctionalComponent(PcImportModal_vue_1.default, new PcImportModal_vue_1.default(__assign(__assign({ 'onClose': {} }, { 'onImported': {} }), { open: (__VLS_ctx.importModalOpen) })));
var __VLS_39 = __VLS_38.apply(void 0, __spreadArray([__assign(__assign({ 'onClose': {} }, { 'onImported': {} }), { open: (__VLS_ctx.importModalOpen) })], __VLS_functionalComponentArgsRest(__VLS_38), false));
var __VLS_41;
var __VLS_42;
var __VLS_43;
var __VLS_44 = {
    onClose: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.importModalOpen = false;
    }
};
var __VLS_45 = {
    onImported: (__VLS_ctx.onImported)
};
var __VLS_40;
var __VLS_2;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['[&>*]:w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:[&>*]:w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['[&>*]:justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:[&>*]:justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-amber-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-amber-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-amber-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-40']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-900/40']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/40']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['line-through']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
// @ts-ignore
var __VLS_28 = __VLS_27;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            AppShell: AppShell_vue_1.default,
            SongFilters: SongFilters_vue_1.default,
            SongTable: SongTable_vue_1.default,
            SongSlideOver: SongSlideOver_vue_1.default,
            BatchQuickAssign: BatchQuickAssign_vue_1.default,
            PcImportModal: PcImportModal_vue_1.default,
            songStore: songStore,
            selectedSong: selectedSong,
            slideOverOpen: slideOverOpen,
            importModalOpen: importModalOpen,
            batchMode: batchMode,
            showHidden: showHidden,
            hiddenSongs: hiddenSongs,
            onRestoreSong: onRestoreSong,
            uncategorizedSongs: uncategorizedSongs,
            availableKeys: availableKeys,
            availableUserTags: availableUserTags,
            selectedSongIds: selectedSongIds,
            bulkTagInput: bulkTagInput,
            songTableRef: songTableRef,
            onSelectionUpdate: onSelectionUpdate,
            clearBulkSelection: clearBulkSelection,
            applyBulkTag: applyBulkTag,
            removeBulkTag: removeBulkTag,
            onSelectSong: onSelectSong,
            onAddSong: onAddSong,
            onImported: onImported,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
