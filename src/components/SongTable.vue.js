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
exports.SortArrow = void 0;
var vue_1 = require("vue");
var SongBadge_vue_1 = require("@/components/SongBadge.vue");
var VwExplainer_vue_1 = require("@/components/VwExplainer.vue");
var songSearch_1 = require("@/utils/songSearch");
var songs_1 = require("@/stores/songs");
var auth_1 = require("@/stores/auth");
var vue_2 = require("vue");
exports.SortArrow = (0, vue_2.defineComponent)({
    props: {
        active: { type: Boolean, default: false },
        dir: { type: String, default: 'asc' },
    },
    setup: function (props) {
        return function () {
            var color = props.active ? 'text-indigo-400' : 'text-gray-600';
            var path;
            if (props.active && props.dir === 'asc') {
                path = 'M5 15l7-7 7 7';
            }
            else if (props.active && props.dir === 'desc') {
                path = 'M19 9l-7 7-7-7';
            }
            else {
                path = 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4';
            }
            return (0, vue_2.h)('svg', {
                xmlns: 'http://www.w3.org/2000/svg',
                class: "h-3.5 w-3.5 ".concat(color),
                fill: 'none',
                viewBox: '0 0 24 24',
                stroke: 'currentColor',
                'stroke-width': '2',
            }, [
                (0, vue_2.h)('path', {
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                    d: path,
                }),
            ]);
        };
    },
});
debugger; /* PartiallyEnd: #3632/both.vue */
exports.default = await (function () { return __awaiter(void 0, void 0, void 0, function () {
    function toggleSort(field) {
        if (sortField.value === field) {
            sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
        }
        else {
            sortField.value = field;
            sortDir.value = 'asc';
        }
    }
    function sortKey(song) {
        var _a, _b;
        switch (sortField.value) {
            case 'key': return (0, songSearch_1.getPrimaryKey)(song).toLowerCase();
            case 'lastUsed': return (_b = (_a = song.lastUsedAt) === null || _a === void 0 ? void 0 : _a.toMillis()) !== null && _b !== void 0 ? _b : 0;
            default: return song.title.toLowerCase();
        }
    }
    // Click-to-filter (checkpoint feedback): clicking a Category badge, Tag, or Theme
    // pill APPENDS a field-scoped term to the shared search bar, reusing the existing
    // songMatchesQuery multi-term AND behavior (no parallel filter path) so successive
    // clicks keep narrowing the list. Free text the user already typed is preserved;
    // re-clicking the same pill is a no-op (de-duped). searchQuery is bound to
    // SongFilters' input via SongsView's v-model.
    function filterByPill(field, value) {
        var term = "".concat(field, ":").concat(value);
        var current = songStore.searchQuery.trim();
        if (!current) {
            songStore.searchQuery = term;
            return;
        }
        // De-dupe: skip if the exact term is already present as a whole field-scoped
        // span. A whitespace-token check breaks for multi-word values (e.g.
        // "tag:Christmas Eve"), since splitting on whitespace would fragment the term
        // itself into separate tokens that never match.
        var alreadyPresent = current === term ||
            current.startsWith(term + ' ') ||
            current.includes(' ' + term + ' ') ||
            current.endsWith(' ' + term);
        if (alreadyPresent)
            return;
        songStore.searchQuery = "".concat(current, " ").concat(term);
    }
    function toggleSelect(id) {
        var next = new Set(selectedIds.value);
        if (next.has(id)) {
            next.delete(id);
        }
        else {
            next.add(id);
        }
        selectedIds.value = next;
        emit('update:selectedIds', next);
    }
    function toggleSelectAll() {
        if (selectedIds.value.size === sortedSongs.value.length) {
            selectedIds.value = new Set();
        }
        else {
            selectedIds.value = new Set(sortedSongs.value.map(function (s) { return s.id; }));
        }
        emit('update:selectedIds', selectedIds.value);
    }
    function clearSelection() {
        selectedIds.value = new Set();
        emit('update:selectedIds', selectedIds.value);
    }
    function loadMore() {
        visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, sortedSongs.value.length);
    }
    function formatDate(ts) {
        if (!ts)
            return '—';
        try {
            var date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        catch (_a) {
            return '—';
        }
    }
    var props, emit, songStore, authStore, cogOpen, toggleableColumns, sortField, sortDir, sortedSongs, selectedIds, __VLS_exposed, BATCH_SIZE, visibleCount, visibleSongs, hasMore, sentinelRef, observer, __VLS_ctx, __VLS_components, __VLS_directives, __VLS_0, __VLS_1, __VLS_2, __VLS_3, __VLS_4, __VLS_5, __VLS_6, __VLS_8, __VLS_9, __VLS_11, __VLS_12, __VLS_13, __VLS_15, __VLS_16, __VLS_17, _loop_1, _i, _a, col, _loop_2, __VLS_21, _b, _c, song, __VLS_dollars, __VLS_self;
    var _d, _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                props = defineProps();
                emit = defineEmits();
                songStore = (0, songs_1.useSongStore)();
                authStore = (0, auth_1.useAuthStore)();
                cogOpen = (0, vue_1.ref)(false);
                toggleableColumns = [
                    { key: 'category', label: 'Category' },
                    { key: 'key', label: 'Key' },
                    { key: 'ccli', label: 'CCLI' },
                    { key: 'lastUsed', label: 'Last Used' },
                    { key: 'tags', label: 'Tags' },
                    { key: 'themes', label: 'Themes' },
                ];
                sortField = (0, vue_1.ref)('title');
                sortDir = (0, vue_1.ref)('asc');
                sortedSongs = (0, vue_1.computed)(function () {
                    return __spreadArray([], props.songs, true).sort(function (a, b) {
                        var aVal = sortKey(a);
                        var bVal = sortKey(b);
                        var cmp;
                        if (typeof aVal === 'number' && typeof bVal === 'number') {
                            cmp = aVal - bVal;
                        }
                        else {
                            cmp = String(aVal).localeCompare(String(bVal));
                        }
                        return sortDir.value === 'asc' ? cmp : -cmp;
                    });
                });
                selectedIds = (0, vue_1.ref)(new Set());
                __VLS_exposed = { selectedIds: selectedIds, clearSelection: clearSelection };
                defineExpose(__VLS_exposed);
                BATCH_SIZE = 50;
                visibleCount = (0, vue_1.ref)(BATCH_SIZE);
                visibleSongs = (0, vue_1.computed)(function () { return sortedSongs.value.slice(0, visibleCount.value); });
                hasMore = (0, vue_1.computed)(function () { return visibleCount.value < sortedSongs.value.length; });
                // Reset visible count when sort changes (new sort = fresh ordering)
                (0, vue_1.watch)(sortField, function () {
                    visibleCount.value = BATCH_SIZE;
                });
                (0, vue_1.watch)(sortDir, function () {
                    visibleCount.value = BATCH_SIZE;
                });
                // Reset visible count when the (filtered) song list changes so the slice
                // always starts from the top of the new list — fixes "only a–g show" bug.
                (0, vue_1.watch)(function () { return props.songs; }, function () {
                    visibleCount.value = BATCH_SIZE;
                });
                sentinelRef = (0, vue_1.ref)(null);
                observer = null;
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
                debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
                __VLS_ctx = {};
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-gray-800 overflow-hidden flex flex-col" }));
                if (__VLS_ctx.loading) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-center py-16" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-3 text-gray-400" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "h-5 w-5 animate-spin" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm" }));
                }
                else if (__VLS_ctx.songs.length === 0) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col items-center justify-center py-20 px-6 text-center" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-12 w-12 text-gray-600 mx-auto mb-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "1" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-base font-medium text-gray-300 mb-2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-500 max-w-sm" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col sm:flex-row items-center gap-3" }));
                    __VLS_0 = {}.RouterLink;
                    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
                    __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0(__assign({ to: "/songs?import=true" }, { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" })));
                    __VLS_2 = __VLS_1.apply(void 0, __spreadArray([__assign({ to: "/songs?import=true" }, { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" })], __VLS_functionalComponentArgsRest(__VLS_1), false));
                    __VLS_3.slots.default;
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign({ onClick: function () {
                            var _a = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                _a[_i] = arguments[_i];
                            }
                            var $event = _a[0];
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!(__VLS_ctx.songs.length === 0))
                                return;
                            __VLS_ctx.$emit('add');
                        } }, { class: "text-sm text-indigo-400 hover:text-indigo-300 transition-colors" }));
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "overflow-x-auto" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)(__assign({ class: "w-full text-sm" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ class: "border-b border-gray-800 bg-gray-900/50" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ scope: "col" }, { class: "px-3 py-3 w-8" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign(__assign(__assign({ onChange: (__VLS_ctx.toggleSelectAll) }, { onClick: function () { } }), { type: "checkbox" }), { class: "rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900" }), { checked: (__VLS_ctx.selectedIds.size > 0 && __VLS_ctx.selectedIds.size === __VLS_ctx.sortedSongs.length), indeterminate: (__VLS_ctx.selectedIds.size > 0 && __VLS_ctx.selectedIds.size < __VLS_ctx.sortedSongs.length) }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign(__assign({ onClick: function () {
                            var _a = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                _a[_i] = arguments[_i];
                            }
                            var $event = _a[0];
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.songs.length === 0))
                                return;
                            __VLS_ctx.toggleSort('title');
                        } }, { scope: "col" }), { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-1" }));
                    __VLS_4 = {}.SortArrow;
                    /** @type {[typeof __VLS_components.SortArrow, ]} */ ;
                    __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
                        active: (__VLS_ctx.sortField === 'title'),
                        dir: (__VLS_ctx.sortDir),
                    }));
                    __VLS_6 = __VLS_5.apply(void 0, __spreadArray([{
                            active: (__VLS_ctx.sortField === 'title'),
                            dir: (__VLS_ctx.sortDir),
                        }], __VLS_functionalComponentArgsRest(__VLS_5), false));
                    if (__VLS_ctx.authStore.vwModeEnabled && __VLS_ctx.songStore.columnVisibility.category) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ scope: "col" }, { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-1" }));
                        /** @type {[typeof VwExplainer, ]} */ ;
                        __VLS_8 = __VLS_asFunctionalComponent(VwExplainer_vue_1.default, new VwExplainer_vue_1.default({}));
                        __VLS_9 = __VLS_8.apply(void 0, __spreadArray([{}], __VLS_functionalComponentArgsRest(__VLS_8), false));
                    }
                    if (__VLS_ctx.songStore.columnVisibility.key) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign(__assign({ onClick: function () {
                                var _a = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    _a[_i] = arguments[_i];
                                }
                                var $event = _a[0];
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.songs.length === 0))
                                    return;
                                if (!(__VLS_ctx.songStore.columnVisibility.key))
                                    return;
                                __VLS_ctx.toggleSort('key');
                            } }, { scope: "col" }), { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-1" }));
                        __VLS_11 = {}.SortArrow;
                        /** @type {[typeof __VLS_components.SortArrow, ]} */ ;
                        __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
                            active: (__VLS_ctx.sortField === 'key'),
                            dir: (__VLS_ctx.sortDir),
                        }));
                        __VLS_13 = __VLS_12.apply(void 0, __spreadArray([{
                                active: (__VLS_ctx.sortField === 'key'),
                                dir: (__VLS_ctx.sortDir),
                            }], __VLS_functionalComponentArgsRest(__VLS_12), false));
                    }
                    if (__VLS_ctx.songStore.columnVisibility.ccli) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ scope: "col" }, { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
                    }
                    if (__VLS_ctx.songStore.columnVisibility.lastUsed) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign(__assign({ onClick: function () {
                                var _a = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    _a[_i] = arguments[_i];
                                }
                                var $event = _a[0];
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.songs.length === 0))
                                    return;
                                if (!(__VLS_ctx.songStore.columnVisibility.lastUsed))
                                    return;
                                __VLS_ctx.toggleSort('lastUsed');
                            } }, { scope: "col" }), { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-1" }));
                        __VLS_15 = {}.SortArrow;
                        /** @type {[typeof __VLS_components.SortArrow, ]} */ ;
                        __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
                            active: (__VLS_ctx.sortField === 'lastUsed'),
                            dir: (__VLS_ctx.sortDir),
                        }));
                        __VLS_17 = __VLS_16.apply(void 0, __spreadArray([{
                                active: (__VLS_ctx.sortField === 'lastUsed'),
                                dir: (__VLS_ctx.sortDir),
                            }], __VLS_functionalComponentArgsRest(__VLS_16), false));
                    }
                    if (__VLS_ctx.songStore.columnVisibility.tags) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ scope: "col" }, { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
                    }
                    if (__VLS_ctx.songStore.columnVisibility.themes) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ scope: "col" }, { class: "px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
                    }
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ scope: "col" }, { class: "px-4 py-3 w-10 text-right relative" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                            var _a = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                _a[_i] = arguments[_i];
                            }
                            var $event = _a[0];
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.songs.length === 0))
                                return;
                            __VLS_ctx.cogOpen = !__VLS_ctx.cogOpen;
                        } }, { type: "button" }), { class: "text-gray-500 hover:text-gray-300" }), { title: "Column settings", 'aria-label': "Column settings" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                        d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
                    });
                    if (__VLS_ctx.cogOpen) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: function () {
                                var _a = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    _a[_i] = arguments[_i];
                                }
                                var $event = _a[0];
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.songs.length === 0))
                                    return;
                                if (!(__VLS_ctx.cogOpen))
                                    return;
                                __VLS_ctx.cogOpen = false;
                            } }, { class: "fixed inset-0 z-30" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "absolute z-40 right-0 mt-1 w-48 rounded-md bg-gray-900 border border-gray-800 shadow-xl p-2 text-left normal-case tracking-normal font-normal" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between mb-1.5" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs font-medium text-gray-300" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                                var _a = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    _a[_i] = arguments[_i];
                                }
                                var $event = _a[0];
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.songs.length === 0))
                                    return;
                                if (!(__VLS_ctx.cogOpen))
                                    return;
                                __VLS_ctx.songStore.resetColumns();
                            } }, { type: "button" }), { class: "text-xs text-gray-500 hover:text-gray-300" }));
                        _loop_1 = function (col) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)(__assign({ key: (col.key) }, { class: "flex items-center gap-2 py-1 px-1 text-xs text-gray-300 hover:bg-gray-800 rounded cursor-pointer" }));
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign(__assign({ onChange: function () {
                                    var _a = [];
                                    for (var _i = 0; _i < arguments.length; _i++) {
                                        _a[_i] = arguments[_i];
                                    }
                                    var $event = _a[0];
                                    if (!!(__VLS_ctx.loading))
                                        return;
                                    if (!!(__VLS_ctx.songs.length === 0))
                                        return;
                                    if (!(__VLS_ctx.cogOpen))
                                        return;
                                    __VLS_ctx.songStore.toggleColumn(col.key);
                                } }, { type: "checkbox" }), { class: "rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900" }), { checked: (__VLS_ctx.songStore.columnVisibility[col.key]) }));
                            (col.label);
                        };
                        for (_i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.toggleableColumns)); _i < _a.length; _i++) {
                            col = _a[_i][0];
                            _loop_1(col);
                        }
                    }
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)(__assign({ class: "divide-y divide-gray-800" }));
                    _loop_2 = function (song) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign(__assign(__assign({ onClick: function () {
                                var _a = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    _a[_i] = arguments[_i];
                                }
                                var $event = _a[0];
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.songs.length === 0))
                                    return;
                                __VLS_ctx.$emit('select', song);
                            } }, { key: (song.id) }), { class: "cursor-pointer hover:bg-gray-800/50 transition-colors" }), { class: (__VLS_ctx.selectedIds.has(song.id) ? 'bg-indigo-900/10' : '') }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ onClick: function () { } }, { class: "px-3 py-3" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign(__assign(__assign({ onChange: function () {
                                var _a = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    _a[_i] = arguments[_i];
                                }
                                var $event = _a[0];
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.songs.length === 0))
                                    return;
                                __VLS_ctx.toggleSelect(song.id);
                            } }, { onClick: function () { } }), { type: "checkbox" }), { class: "rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900" }), { checked: (__VLS_ctx.selectedIds.has(song.id)) }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "font-medium text-gray-100" }));
                        (song.title);
                        if (song.author) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-gray-500 mt-0.5" }));
                            (song.author);
                        }
                        if (__VLS_ctx.authStore.vwModeEnabled && __VLS_ctx.songStore.columnVisibility.category) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ onClick: function () { } }, { class: "px-4 py-3" }));
                            /** @type {[typeof SongBadge, ]} */ ;
                            // @ts-ignore
                            var __VLS_19 = __VLS_asFunctionalComponent(SongBadge_vue_1.default, new SongBadge_vue_1.default(__assign({ 'onSelect': {} }, { types: ((_d = song.vwTypes) !== null && _d !== void 0 ? _d : []), clickable: true })));
                            var __VLS_20 = __VLS_19.apply(void 0, __spreadArray([__assign({ 'onSelect': {} }, { types: ((_e = song.vwTypes) !== null && _e !== void 0 ? _e : []), clickable: true })], __VLS_functionalComponentArgsRest(__VLS_19), false));
                            var __VLS_22 = void 0;
                            var __VLS_23 = void 0;
                            var __VLS_24 = void 0;
                            var __VLS_25 = {
                                onSelect: function () {
                                    var _a = [];
                                    for (var _i = 0; _i < arguments.length; _i++) {
                                        _a[_i] = arguments[_i];
                                    }
                                    var $event = _a[0];
                                    if (!!(__VLS_ctx.loading))
                                        return;
                                    if (!!(__VLS_ctx.songs.length === 0))
                                        return;
                                    if (!(__VLS_ctx.authStore.vwModeEnabled && __VLS_ctx.songStore.columnVisibility.category))
                                        return;
                                    __VLS_ctx.filterByPill('type', $event);
                                }
                            };
                        }
                        if (__VLS_ctx.songStore.columnVisibility.key) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-300" }));
                            (__VLS_ctx.getPrimaryKey(song) || '&mdash;');
                        }
                        if (__VLS_ctx.songStore.columnVisibility.ccli) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-300" }));
                            if (song.ccliNumber) {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)(__assign(__assign({ onClick: function () { } }, { href: ("https://songselect.ccli.com/songs/".concat(song.ccliNumber)), target: "_blank", rel: "noopener" }), { class: "text-indigo-400 hover:text-indigo-300 hover:underline" }));
                                (song.ccliNumber);
                            }
                            else {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                            }
                        }
                        if (__VLS_ctx.songStore.columnVisibility.lastUsed) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-gray-400" }));
                            (__VLS_ctx.formatDate(song.lastUsedAt));
                        }
                        if (__VLS_ctx.songStore.columnVisibility.tags) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-1 items-center" }));
                            var _loop_3 = function (t) {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign(__assign(__assign({ onClick: function () {
                                        var _a = [];
                                        for (var _i = 0; _i < arguments.length; _i++) {
                                            _a[_i] = arguments[_i];
                                        }
                                        var $event = _a[0];
                                        if (!!(__VLS_ctx.loading))
                                            return;
                                        if (!!(__VLS_ctx.songs.length === 0))
                                            return;
                                        if (!(__VLS_ctx.songStore.columnVisibility.tags))
                                            return;
                                        __VLS_ctx.filterByPill('tag', t);
                                    } }, { key: ('us-' + t) }), { class: "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-pink-900/50 text-pink-300 border-pink-800 cursor-pointer hover:bg-pink-800/60" }), { title: "Filter by this tag" }));
                                (t);
                            };
                            for (var _l = 0, _m = __VLS_getVForSourceType((((_f = song.tags) !== null && _f !== void 0 ? _f : []))); _l < _m.length; _l++) {
                                var t = _m[_l][0];
                                _loop_3(t);
                            }
                            if (!((_g = song.tags) !== null && _g !== void 0 ? _g : []).length) {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600" }));
                            }
                        }
                        if (__VLS_ctx.songStore.columnVisibility.themes) {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3" }));
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-1 items-center" }));
                            var _loop_4 = function (t) {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign(__assign(__assign({ onClick: function () {
                                        var _a = [];
                                        for (var _i = 0; _i < arguments.length; _i++) {
                                            _a[_i] = arguments[_i];
                                        }
                                        var $event = _a[0];
                                        if (!!(__VLS_ctx.loading))
                                            return;
                                        if (!!(__VLS_ctx.songs.length === 0))
                                            return;
                                        if (!(__VLS_ctx.songStore.columnVisibility.themes))
                                            return;
                                        __VLS_ctx.filterByPill('theme', t);
                                    } }, { key: ('th-' + t) }), { class: "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-teal-900/50 text-teal-300 border-teal-800 cursor-pointer hover:bg-teal-800/60" }), { title: "Filter by this theme" }));
                                (t);
                            };
                            for (var _o = 0, _p = __VLS_getVForSourceType((((_h = song.themes) !== null && _h !== void 0 ? _h : []))); _o < _p.length; _o++) {
                                var t = _p[_o][0];
                                _loop_4(t);
                            }
                            if (!((_j = song.themes) !== null && _j !== void 0 ? _j : []).length) {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600" }));
                            }
                        }
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-4 py-3 text-right" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-gray-500" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                            'stroke-linecap': "round",
                            'stroke-linejoin': "round",
                            d: "M9 5l7 7-7 7",
                        });
                    };
                    for (_b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.visibleSongs)); _b < _c.length; _b++) {
                        song = _c[_b][0];
                        _loop_2(song);
                    }
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div)(__assign({ ref: "sentinelRef" }, { class: "h-1" }));
                /** @type {typeof __VLS_ctx.sentinelRef} */ ;
                if (!__VLS_ctx.loading && __VLS_ctx.songs.length > 0) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-800" }));
                    (__VLS_ctx.visibleSongs.length);
                    (__VLS_ctx.sortedSongs.length);
                    if (__VLS_ctx.hasMore) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    }
                }
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-16']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
                /** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-20']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-12']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-12']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-gray-900/50']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ ;
                /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
                /** @type {__VLS_StyleScopedClasses['relative']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
                /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['z-30']} */ ;
                /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
                /** @type {__VLS_StyleScopedClasses['z-40']} */ ;
                /** @type {__VLS_StyleScopedClasses['right-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-48']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['normal-case']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-normal']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
                /** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
                /** @type {__VLS_StyleScopedClasses['divide-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/50']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-indigo-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['focus:ring-offset-gray-900']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:underline']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-pink-900/50']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-pink-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-pink-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-pink-800/60']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-teal-900/50']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-teal-300']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-teal-800']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-teal-800/60']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
                return [4 /*yield*/, Promise.resolve().then(function () { return require('vue'); })];
            case 1:
                __VLS_self = (_k.sent()).defineComponent({
                    setup: function () {
                        return {
                            SongBadge: SongBadge_vue_1.default,
                            VwExplainer: VwExplainer_vue_1.default,
                            getPrimaryKey: songSearch_1.getPrimaryKey,
                            songStore: songStore,
                            authStore: authStore,
                            cogOpen: cogOpen,
                            toggleableColumns: toggleableColumns,
                            sortField: sortField,
                            sortDir: sortDir,
                            toggleSort: toggleSort,
                            filterByPill: filterByPill,
                            sortedSongs: sortedSongs,
                            selectedIds: selectedIds,
                            toggleSelect: toggleSelect,
                            toggleSelectAll: toggleSelectAll,
                            visibleSongs: visibleSongs,
                            hasMore: hasMore,
                            sentinelRef: sentinelRef,
                            formatDate: formatDate,
                            SortArrow: exports.SortArrow,
                        };
                    },
                    __typeEmits: {},
                    __typeProps: {},
                });
                return [4 /*yield*/, Promise.resolve().then(function () { return require('vue'); })];
            case 2: return [2 /*return*/, (_k.sent()).defineComponent({
                    setup: function () {
                        return __assign({}, __VLS_exposed);
                    },
                    __typeEmits: {},
                    __typeProps: {},
                })];
        }
    });
}); })(); /* PartiallyEnd: #4569/main.vue */
