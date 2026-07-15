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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var suggestions_1 = require("@/utils/suggestions");
var songSearch_1 = require("@/utils/songSearch");
var SongBadge_vue_1 = require("@/components/SongBadge.vue");
var TeamTagPill_vue_1 = require("@/components/TeamTagPill.vue");
var TagFilterChecklist_vue_1 = require("@/components/TagFilterChecklist.vue");
var songs_1 = require("@/stores/songs");
var auth_1 = require("@/stores/auth");
var props = defineProps();
var emit = defineEmits();
// ── State ──────────────────────────────────────────────────────────────────────
var songStore = (0, songs_1.useSongStore)();
var authStore = (0, auth_1.useAuthStore)();
var isOpen = (0, vue_1.ref)(false);
var searchQuery = (0, vue_1.ref)('');
var triggerRef = (0, vue_1.ref)(null);
var searchInputRef = (0, vue_1.ref)(null);
// IN-01: omit the `type:` prefix from the tooltip when VW mode is off, since
// it's gated to match nothing in that state (songSearch.ts).
var searchFieldHint = (0, vue_1.computed)(function () {
    return authStore.vwModeEnabled
        ? 'Filter by field: tag: key: type: theme: team:'
        : 'Filter by field: tag: key: theme: team:';
});
var dropdownStyle = (0, vue_1.ref)({});
// ── Tag filter (D-14: shared with Songs panel via songStore) ─────────────────
/**
 * Non-hidden songs only. Hidden (soft-deleted) songs must not surface anywhere in the
 * picker — not as suggestions/search results, and not as tag options in the checklist.
 */
var visibleSongs = (0, vue_1.computed)(function () { return props.songs.filter(function (s) { return s.hidden !== true; }); });
/** Distinct tags across visible songs (themes ∪ tags) — populates the shared checklist */
var availableTags = (0, vue_1.computed)(function () {
    var _a, _b;
    var tagSet = new Set();
    for (var _i = 0, _c = visibleSongs.value; _i < _c.length; _i++) {
        var song = _c[_i];
        for (var _d = 0, _e = ((_a = song.themes) !== null && _a !== void 0 ? _a : []); _d < _e.length; _d++) {
            var t = _e[_d];
            tagSet.add(t);
        }
        for (var _f = 0, _g = ((_b = song.tags) !== null && _b !== void 0 ? _b : []); _f < _g.length; _f++) {
            var t = _g[_f];
            tagSet.add(t);
        }
    }
    return Array.from(tagSet).sort();
});
/**
 * Visible songs filtered by the shared store tag-filter state (D-09/D-10: independent
 * per-tag Show/Hide sets — exclusion always wins; include set OR-combines when non-empty).
 */
var tagFilteredSongs = (0, vue_1.computed)(function () {
    var include = songStore.tagFilterInclude;
    var exclude = songStore.tagFilterExclude;
    if (include.size === 0 && exclude.size === 0)
        return visibleSongs.value;
    return visibleSongs.value.filter(function (s) {
        var _a, _b, _c, _d;
        if (exclude.size > 0) {
            var carriesExcluded = ((_a = s.themes) !== null && _a !== void 0 ? _a : []).some(function (t) { return exclude.has(t); }) ||
                ((_b = s.tags) !== null && _b !== void 0 ? _b : []).some(function (t) { return exclude.has(t); });
            if (carriesExcluded)
                return false;
        }
        if (include.size > 0) {
            var carriesIncluded = ((_c = s.themes) !== null && _c !== void 0 ? _c : []).some(function (t) { return include.has(t); }) ||
                ((_d = s.tags) !== null && _d !== void 0 ? _d : []).some(function (t) { return include.has(t); });
            return carriesIncluded;
        }
        return true;
    });
});
// ── Computed — full ranked/search lists ───────────────────────────────────────
var suggestions = (0, vue_1.computed)(function () {
    // No Orchestra special-casing and no automatic team scoping — the picker just
    // ranks by rotation/recency, and users filter by hand with the tag checkboxes.
    // Passing [] means rankSongsForSlot applies no team hard-filter and no Orchestra
    // sort-bonus.
    return (0, suggestions_1.rankSongsForSlot)(tagFilteredSongs.value, props.requiredVwType, []);
});
var searchResults = (0, vue_1.computed)(function () {
    if (!searchQuery.value)
        return [];
    var q = searchQuery.value;
    // No Orchestra-first ordering — results keep the underlying song order.
    return tagFilteredSongs.value.filter(function (s) { return (0, songSearch_1.songMatchesQuery)(s, q, authStore.vwModeEnabled); });
});
var resolvedAiSuggestions = (0, vue_1.computed)(function () {
    if (!props.aiSuggestions)
        return [];
    return props.aiSuggestions
        .map(function (ai) {
        // Resolve against visibleSongs so a cached suggestion for a since-hidden song
        // never surfaces in the picker (WR-01).
        var song = visibleSongs.value.find(function (s) { return s.id === ai.songId; });
        return song ? { song: song, reason: ai.reason } : null;
    })
        .filter(function (item) { return item !== null; });
});
// ── IntersectionObserver load-more batching (D-12) ────────────────────────────
var BATCH_SIZE = 50;
var visibleCount = (0, vue_1.ref)(BATCH_SIZE);
/** Slice of rotation suggestions visible so far */
var visibleSuggestions = (0, vue_1.computed)(function () {
    return suggestions.value.slice(0, visibleCount.value);
});
/** Slice of search results visible so far */
var visibleSearchResults = (0, vue_1.computed)(function () {
    return searchResults.value.slice(0, visibleCount.value);
});
/** Total items in the active list (rotation or search) */
var totalVisible = (0, vue_1.computed)(function () {
    return searchQuery.value ? searchResults.value.length : suggestions.value.length;
});
/** How many are currently rendered */
var currentlyShowing = (0, vue_1.computed)(function () {
    return searchQuery.value ? visibleSearchResults.value.length : visibleSuggestions.value.length;
});
var hasMore = (0, vue_1.computed)(function () { return visibleCount.value < totalVisible.value; });
function loadMore() {
    visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, totalVisible.value);
}
// Reset visibleCount when active source changes
(0, vue_1.watch)(searchQuery, function () { visibleCount.value = BATCH_SIZE; });
(0, vue_1.watch)(function () { return songStore.tagFilterInclude; }, function () { visibleCount.value = BATCH_SIZE; }, { deep: true });
(0, vue_1.watch)(function () { return songStore.tagFilterExclude; }, function () { visibleCount.value = BATCH_SIZE; }, { deep: true });
(0, vue_1.watch)(function () { return props.songs; }, function () { visibleCount.value = BATCH_SIZE; });
// Sentinel element at bottom of scroll container triggers loadMore
var sentinelRef = (0, vue_1.ref)(null);
var observer = null;
(0, vue_1.onMounted)(function () {
    observer = new IntersectionObserver(function (entries) {
        var _a;
        if (((_a = entries[0]) === null || _a === void 0 ? void 0 : _a.isIntersecting) && hasMore.value) {
            loadMore();
        }
    }, { rootMargin: '200px' });
    if (sentinelRef.value) {
        observer.observe(sentinelRef.value);
    }
});
(0, vue_1.onUnmounted)(function () {
    observer === null || observer === void 0 ? void 0 : observer.disconnect();
});
// ── Helpers ────────────────────────────────────────────────────────────────────
function preferredKey(song) {
    return (0, songSearch_1.getPrimaryKey)(song) || '—';
}
// ── Dropdown open/close ────────────────────────────────────────────────────────
function openDropdown() {
    if (!triggerRef.value)
        return;
    var rect = triggerRef.value.getBoundingClientRect();
    var maxH = 600; // matches max-h-[600px]
    var minH = 420; // stable floor so the panel doesn't jump around as the result count changes
    var gap = 4;
    var spaceBelow = window.innerHeight - rect.bottom - gap;
    var spaceAbove = rect.top - gap;
    var fitsBelow = spaceBelow >= maxH;
    var w = "".concat(Math.max(rect.width, 280), "px");
    if (fitsBelow) {
        dropdownStyle.value = {
            top: "".concat(rect.bottom + gap, "px"),
            left: "".concat(rect.left, "px"),
            width: w,
            minHeight: "".concat(minH, "px"),
        };
    }
    else if (spaceAbove > spaceBelow) {
        // Flip above, cap height to available space
        var h = Math.min(maxH, spaceAbove);
        dropdownStyle.value = {
            bottom: "".concat(window.innerHeight - rect.top + gap, "px"),
            left: "".concat(rect.left, "px"),
            width: w,
            maxHeight: "".concat(h, "px"),
            minHeight: "".concat(Math.min(minH, h), "px"),
        };
    }
    else {
        // Not enough room above either — show below but cap height
        dropdownStyle.value = {
            top: "".concat(rect.bottom + gap, "px"),
            left: "".concat(rect.left, "px"),
            width: w,
            maxHeight: "".concat(spaceBelow, "px"),
            minHeight: "".concat(Math.min(minH, spaceBelow), "px"),
        };
    }
    isOpen.value = true;
    searchQuery.value = '';
    visibleCount.value = BATCH_SIZE;
    // Request AI suggestions on open if context exists but suggestions not yet fetched
    if (props.hasSermonContext && !props.aiSuggestions && !props.aiLoading) {
        emit('requestAiSuggestions');
    }
    // Focus search input after DOM update
    (0, vue_1.nextTick)(function () {
        var _a;
        (_a = searchInputRef.value) === null || _a === void 0 ? void 0 : _a.focus();
        // Re-observe sentinel after DOM update (teleported, so it's only in DOM when isOpen)
        if (sentinelRef.value && observer) {
            observer.observe(sentinelRef.value);
        }
    });
}
function closeDropdown() {
    isOpen.value = false;
    searchQuery.value = '';
}
// ── Selection ──────────────────────────────────────────────────────────────────
function onSelect(song) {
    var _a, _b;
    var key = (_b = (_a = song.arrangements[0]) === null || _a === void 0 ? void 0 : _a.key) !== null && _b !== void 0 ? _b : '';
    emit('select', { id: song.id, title: song.title, key: key });
    closeDropdown();
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "triggerRef",
});
/** @type {typeof __VLS_ctx.triggerRef} */ ;
if (!__VLS_ctx.currentSongId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.openDropdown) }, { type: "button" }), { class: "w-full flex items-center gap-2 rounded-md border border-dashed border-gray-700 px-3 py-2 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M12 4v16m8-8H4",
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.openDropdown) }, { type: "button" }), { class: "mt-1 text-xs text-gray-500 hover:text-gray-300 transition-colors" }));
}
var __VLS_0 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
var __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "body",
}));
var __VLS_2 = __VLS_1.apply(void 0, __spreadArray([{
        to: "body",
    }], __VLS_functionalComponentArgsRest(__VLS_1), false));
__VLS_3.slots.default;
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.closeDropdown) }, { class: "fixed inset-0 z-30" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-[600px] overflow-y-auto" }, { style: (__VLS_ctx.dropdownStyle) }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ ref: "searchInputRef", value: (__VLS_ctx.searchQuery), type: "text", placeholder: "Search songs...", title: (__VLS_ctx.searchFieldHint) }, { class: "w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
    /** @type {typeof __VLS_ctx.searchInputRef} */ ;
    /** @type {[typeof TagFilterChecklist, ]} */ ;
    // @ts-ignore
    var __VLS_4 = __VLS_asFunctionalComponent(TagFilterChecklist_vue_1.default, new TagFilterChecklist_vue_1.default(__assign(__assign(__assign({ 'onUpdate:includeTags': {} }, { 'onUpdate:excludeTags': {} }), { 'onClear': {} }), { availableUserTags: (__VLS_ctx.availableTags), includeTags: (__VLS_ctx.songStore.tagFilterInclude), excludeTags: (__VLS_ctx.songStore.tagFilterExclude) })));
    var __VLS_5 = __VLS_4.apply(void 0, __spreadArray([__assign(__assign(__assign({ 'onUpdate:includeTags': {} }, { 'onUpdate:excludeTags': {} }), { 'onClear': {} }), { availableUserTags: (__VLS_ctx.availableTags), includeTags: (__VLS_ctx.songStore.tagFilterInclude), excludeTags: (__VLS_ctx.songStore.tagFilterExclude) })], __VLS_functionalComponentArgsRest(__VLS_4), false));
    var __VLS_7 = void 0;
    var __VLS_8 = void 0;
    var __VLS_9 = void 0;
    var __VLS_10 = {
        'onUpdate:includeTags': function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.isOpen))
                return;
            __VLS_ctx.songStore.tagFilterInclude = $event;
        }
    };
    var __VLS_11 = {
        'onUpdate:excludeTags': function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.isOpen))
                return;
            __VLS_ctx.songStore.tagFilterExclude = $event;
        }
    };
    var __VLS_12 = {
        onClear: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.isOpen))
                return;
            __VLS_ctx.songStore.clearTagFilter();
        }
    };
    var __VLS_6;
    if (!__VLS_ctx.searchQuery) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.hasSermonContext !== false) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            if (__VLS_ctx.aiLoading) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-3 py-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "px-0 pt-1 pb-1 text-xs font-semibold text-indigo-400 uppercase tracking-wider" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-1.5" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 bg-gray-700/60 rounded animate-pulse" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 bg-gray-700/60 rounded animate-pulse w-5/6" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "h-8 bg-gray-700/60 rounded animate-pulse w-4/6" }));
            }
            else if (__VLS_ctx.aiError) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-3 py-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!(!__VLS_ctx.searchQuery))
                            return;
                        if (!(__VLS_ctx.hasSermonContext !== false))
                            return;
                        if (!!(__VLS_ctx.aiLoading))
                            return;
                        if (!(__VLS_ctx.aiError))
                            return;
                        __VLS_ctx.emit('requestAiSuggestions');
                    } }, { class: "text-indigo-400 hover:text-indigo-300 ml-1" }));
            }
            else if (__VLS_ctx.resolvedAiSuggestions.length > 0) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "px-3 pt-2 pb-1 text-xs font-semibold text-indigo-400 uppercase tracking-wider" }));
                var _loop_1 = function (item) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                            var _a = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                _a[_i] = arguments[_i];
                            }
                            var $event = _a[0];
                            if (!(__VLS_ctx.isOpen))
                                return;
                            if (!(!__VLS_ctx.searchQuery))
                                return;
                            if (!(__VLS_ctx.hasSermonContext !== false))
                                return;
                            if (!!(__VLS_ctx.aiLoading))
                                return;
                            if (!!(__VLS_ctx.aiError))
                                return;
                            if (!(__VLS_ctx.resolvedAiSuggestions.length > 0))
                                return;
                            __VLS_ctx.onSelect(item.song);
                        } }, { key: (item.song.id), type: "button" }), { class: "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 min-w-0" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-100 truncate" }));
                    (item.song.title);
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-indigo-400/80 mt-0.5" }));
                    (item.reason);
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-1 mt-1" }));
                    for (var _m = 0, _o = __VLS_getVForSourceType((item.song.themes)); _m < _o.length; _m++) {
                        var t = _o[_m][0];
                        /** @type {[typeof TeamTagPill, ]} */ ;
                        // @ts-ignore
                        var __VLS_13 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
                            key: ('th-' + t),
                            tag: (t),
                            variant: "theme",
                        }));
                        var __VLS_14 = __VLS_13.apply(void 0, __spreadArray([{
                                key: ('th-' + t),
                                tag: (t),
                                variant: "theme",
                            }], __VLS_functionalComponentArgsRest(__VLS_13), false));
                    }
                    for (var _p = 0, _q = __VLS_getVForSourceType((item.song.tags)); _p < _q.length; _p++) {
                        var t = _q[_p][0];
                        /** @type {[typeof TeamTagPill, ]} */ ;
                        // @ts-ignore
                        var __VLS_16 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
                            key: ('us-' + t),
                            tag: (t),
                            variant: "user",
                        }));
                        var __VLS_17 = __VLS_16.apply(void 0, __spreadArray([{
                                key: ('us-' + t),
                                tag: (t),
                                variant: "user",
                            }], __VLS_functionalComponentArgsRest(__VLS_16), false));
                    }
                    if (__VLS_ctx.authStore.vwModeEnabled) {
                        /** @type {[typeof SongBadge, ]} */ ;
                        // @ts-ignore
                        var __VLS_19 = __VLS_asFunctionalComponent(SongBadge_vue_1.default, new SongBadge_vue_1.default({
                            types: ((_a = item.song.vwTypes) !== null && _a !== void 0 ? _a : []),
                        }));
                        var __VLS_20 = __VLS_19.apply(void 0, __spreadArray([{
                                types: ((_b = item.song.vwTypes) !== null && _b !== void 0 ? _b : []),
                            }], __VLS_functionalComponentArgsRest(__VLS_19), false));
                    }
                };
                for (var _i = 0, _g = __VLS_getVForSourceType((__VLS_ctx.resolvedAiSuggestions)); _i < _g.length; _i++) {
                    var item = _g[_i][0];
                    _loop_1(item);
                }
            }
            else if (!__VLS_ctx.hasSermonContext) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-3 py-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 italic" }));
            }
            if (__VLS_ctx.resolvedAiSuggestions.length > 0 || __VLS_ctx.aiLoading || __VLS_ctx.aiError) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "border-t border-gray-700 my-1" }));
            }
        }
        if (__VLS_ctx.visibleSuggestions.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider" }));
            var _loop_2 = function (result) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!(!__VLS_ctx.searchQuery))
                            return;
                        if (!(__VLS_ctx.visibleSuggestions.length > 0))
                            return;
                        __VLS_ctx.onSelect(result.song);
                    } }, { key: (result.song.id), type: "button" }), { class: "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 min-w-0" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-100 truncate" }));
                (result.song.title);
                if (result.isRecent) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-amber-400 shrink-0" }));
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mt-0.5" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400" }));
                (__VLS_ctx.preferredKey(result.song));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-700" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-500" }));
                (result.weeksAgo !== null ? "Last used ".concat(result.weeksAgo, "w ago") : 'Never used');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-1 mt-1" }));
                for (var _r = 0, _s = __VLS_getVForSourceType((result.song.themes)); _r < _s.length; _r++) {
                    var t = _s[_r][0];
                    /** @type {[typeof TeamTagPill, ]} */ ;
                    // @ts-ignore
                    var __VLS_22 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
                        key: ('th-' + t),
                        tag: (t),
                        variant: "theme",
                    }));
                    var __VLS_23 = __VLS_22.apply(void 0, __spreadArray([{
                            key: ('th-' + t),
                            tag: (t),
                            variant: "theme",
                        }], __VLS_functionalComponentArgsRest(__VLS_22), false));
                }
                for (var _t = 0, _u = __VLS_getVForSourceType((result.song.tags)); _t < _u.length; _t++) {
                    var t = _u[_t][0];
                    /** @type {[typeof TeamTagPill, ]} */ ;
                    // @ts-ignore
                    var __VLS_25 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
                        key: ('us-' + t),
                        tag: (t),
                        variant: "user",
                    }));
                    var __VLS_26 = __VLS_25.apply(void 0, __spreadArray([{
                            key: ('us-' + t),
                            tag: (t),
                            variant: "user",
                        }], __VLS_functionalComponentArgsRest(__VLS_25), false));
                }
                if (__VLS_ctx.authStore.vwModeEnabled) {
                    /** @type {[typeof SongBadge, ]} */ ;
                    // @ts-ignore
                    var __VLS_28 = __VLS_asFunctionalComponent(SongBadge_vue_1.default, new SongBadge_vue_1.default({
                        types: ((_c = result.song.vwTypes) !== null && _c !== void 0 ? _c : []),
                    }));
                    var __VLS_29 = __VLS_28.apply(void 0, __spreadArray([{
                            types: ((_d = result.song.vwTypes) !== null && _d !== void 0 ? _d : []),
                        }], __VLS_functionalComponentArgsRest(__VLS_28), false));
                }
            };
            for (var _h = 0, _j = __VLS_getVForSourceType((__VLS_ctx.visibleSuggestions)); _h < _j.length; _h++) {
                var result = _j[_h][0];
                _loop_2(result);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-6 text-center" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mb-2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
            var __VLS_31 = {}.RouterLink;
            /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
            // @ts-ignore
            var __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31(__assign(__assign({ 'onClick': {} }, { to: "/songs" }), { class: "text-indigo-400 hover:text-indigo-300" })));
            var __VLS_33 = __VLS_32.apply(void 0, __spreadArray([__assign(__assign({ 'onClick': {} }, { to: "/songs" }), { class: "text-indigo-400 hover:text-indigo-300" })], __VLS_functionalComponentArgsRest(__VLS_32), false));
            var __VLS_35 = void 0;
            var __VLS_36 = void 0;
            var __VLS_37 = void 0;
            var __VLS_38 = {
                onClick: function () { }
            };
            __VLS_34.slots.default;
            var __VLS_34;
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider" }));
        if (__VLS_ctx.visibleSearchResults.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            var _loop_3 = function (song) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.isOpen))
                            return;
                        if (!!(!__VLS_ctx.searchQuery))
                            return;
                        if (!(__VLS_ctx.visibleSearchResults.length > 0))
                            return;
                        __VLS_ctx.onSelect(song);
                    } }, { key: (song.id), type: "button" }), { class: "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 min-w-0" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-100 truncate block" }));
                (song.title);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400" }));
                (__VLS_ctx.preferredKey(song));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-1 mt-1" }));
                for (var _v = 0, _w = __VLS_getVForSourceType((song.themes)); _v < _w.length; _v++) {
                    var t = _w[_v][0];
                    /** @type {[typeof TeamTagPill, ]} */ ;
                    // @ts-ignore
                    var __VLS_39 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
                        key: ('th-' + t),
                        tag: (t),
                        variant: "theme",
                    }));
                    var __VLS_40 = __VLS_39.apply(void 0, __spreadArray([{
                            key: ('th-' + t),
                            tag: (t),
                            variant: "theme",
                        }], __VLS_functionalComponentArgsRest(__VLS_39), false));
                }
                for (var _x = 0, _y = __VLS_getVForSourceType((song.tags)); _x < _y.length; _x++) {
                    var t = _y[_x][0];
                    /** @type {[typeof TeamTagPill, ]} */ ;
                    // @ts-ignore
                    var __VLS_42 = __VLS_asFunctionalComponent(TeamTagPill_vue_1.default, new TeamTagPill_vue_1.default({
                        key: ('us-' + t),
                        tag: (t),
                        variant: "user",
                    }));
                    var __VLS_43 = __VLS_42.apply(void 0, __spreadArray([{
                            key: ('us-' + t),
                            tag: (t),
                            variant: "user",
                        }], __VLS_functionalComponentArgsRest(__VLS_42), false));
                }
                if (__VLS_ctx.authStore.vwModeEnabled) {
                    /** @type {[typeof SongBadge, ]} */ ;
                    // @ts-ignore
                    var __VLS_45 = __VLS_asFunctionalComponent(SongBadge_vue_1.default, new SongBadge_vue_1.default({
                        types: ((_e = song.vwTypes) !== null && _e !== void 0 ? _e : []),
                    }));
                    var __VLS_46 = __VLS_45.apply(void 0, __spreadArray([{
                            types: ((_f = song.vwTypes) !== null && _f !== void 0 ? _f : []),
                        }], __VLS_functionalComponentArgsRest(__VLS_45), false));
                }
            };
            for (var _k = 0, _l = __VLS_getVForSourceType((__VLS_ctx.visibleSearchResults)); _k < _l.length; _k++) {
                var song = _l[_k][0];
                _loop_3(song);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-4 text-center" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400" }));
            (__VLS_ctx.searchQuery);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)(__assign({ ref: "sentinelRef" }, { class: "h-1" }));
    /** @type {typeof __VLS_ctx.sentinelRef} */ ;
    if (__VLS_ctx.totalVisible > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-800" }));
        (__VLS_ctx.currentlyShowing);
        (__VLS_ctx.totalVisible);
        if (__VLS_ctx.hasMore) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        }
    }
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[600px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
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
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700/60']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700/60']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5/6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700/60']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4/6']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['my-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            SongBadge: SongBadge_vue_1.default,
            TeamTagPill: TeamTagPill_vue_1.default,
            TagFilterChecklist: TagFilterChecklist_vue_1.default,
            emit: emit,
            songStore: songStore,
            authStore: authStore,
            isOpen: isOpen,
            searchQuery: searchQuery,
            triggerRef: triggerRef,
            searchInputRef: searchInputRef,
            searchFieldHint: searchFieldHint,
            dropdownStyle: dropdownStyle,
            availableTags: availableTags,
            resolvedAiSuggestions: resolvedAiSuggestions,
            visibleSuggestions: visibleSuggestions,
            visibleSearchResults: visibleSearchResults,
            totalVisible: totalVisible,
            currentlyShowing: currentlyShowing,
            hasMore: hasMore,
            sentinelRef: sentinelRef,
            preferredKey: preferredKey,
            openDropdown: openDropdown,
            closeDropdown: closeDropdown,
            onSelect: onSelect,
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
