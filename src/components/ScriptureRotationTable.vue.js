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
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var props = defineProps();
var passageFilter = (0, vue_1.ref)('');
// Format a ScriptureRef or ScriptureSlot into a human-readable passage key
function formatPassageKey(book, chapter, verseStart, verseEnd) {
    if (verseStart != null && verseEnd != null) {
        return "".concat(book, " ").concat(chapter, ":").concat(verseStart, "-").concat(verseEnd);
    }
    if (verseStart != null) {
        return "".concat(book, " ").concat(chapter, ":").concat(verseStart);
    }
    return "".concat(book, " ").concat(chapter);
}
// Compute rotation entries: each unique passage key -> list of service dates
var rotationEntries = (0, vue_1.computed)(function () {
    var _a, _b;
    // Map: passageKey -> Set<serviceDate>
    var map = new Map();
    for (var _i = 0, _c = props.services; _i < _c.length; _i++) {
        var service = _c[_i];
        var keysForService = new Set();
        // Scripture slots
        for (var _d = 0, _e = service.slots; _d < _e.length; _d++) {
            var slot = _e[_d];
            if (slot.kind !== 'SCRIPTURE')
                continue;
            var s = slot;
            if (s.book == null || s.chapter == null)
                continue;
            var key = formatPassageKey(s.book, s.chapter, s.verseStart, s.verseEnd);
            keysForService.add(key);
        }
        // Sermon passage
        if (service.sermonPassage != null) {
            var sp = service.sermonPassage;
            var key = formatPassageKey(sp.book, sp.chapter, (_a = sp.verseStart) !== null && _a !== void 0 ? _a : null, (_b = sp.verseEnd) !== null && _b !== void 0 ? _b : null);
            keysForService.add(key);
        }
        // Add date to each unique passage key for this service
        for (var _f = 0, keysForService_1 = keysForService; _f < keysForService_1.length; _f++) {
            var key = keysForService_1[_f];
            if (!map.has(key)) {
                map.set(key, new Set());
            }
            map.get(key).add(service.date);
        }
    }
    // Convert to array, sort alphabetically by key
    return Array.from(map.entries())
        .map(function (_a) {
        var key = _a[0], dates = _a[1];
        return ({ key: key, dates: Array.from(dates).sort() });
    })
        .sort(function (a, b) { return a.key.localeCompare(b.key); });
});
// All unique dates across all services, sorted ascending
var sortedDates = (0, vue_1.computed)(function () {
    var dateSet = new Set();
    for (var _i = 0, _a = props.services; _i < _a.length; _i++) {
        var service = _a[_i];
        dateSet.add(service.date);
    }
    return Array.from(dateSet).sort();
});
// Filter entries by passage key
var filteredEntries = (0, vue_1.computed)(function () {
    if (!passageFilter.value.trim())
        return rotationEntries.value;
    var q = passageFilter.value.toLowerCase();
    return rotationEntries.value.filter(function (e) { return e.key.toLowerCase().includes(q); });
});
// Format a date column header: "Mar 8"
function formatColumnDate(dateStr) {
    var _a = dateStr.split('-').map(Number), year = _a[0], month = _a[1], day = _a[2];
    var d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// Build a lookup: passageKey -> Set<date> for O(1) cell lookups
var passageDateMap = (0, vue_1.computed)(function () {
    var map = new Map();
    for (var _i = 0, _a = rotationEntries.value; _i < _a.length; _i++) {
        var entry = _a[_i];
        map.set(entry.key, new Set(entry.dates));
    }
    return map;
});
// For consecutive repeat detection: build a map passageKey -> sorted dates array
var passageSortedDates = (0, vue_1.computed)(function () {
    var map = new Map();
    for (var _i = 0, _a = rotationEntries.value; _i < _a.length; _i++) {
        var entry = _a[_i];
        map.set(entry.key, __spreadArray([], entry.dates, true).sort());
    }
    return map;
});
// Check if a given date is a consecutive repeat for a passage
// A date is a "consecutive repeat" if the previous date column in sortedDates
// also has this passage
function isConsecutiveRepeat(passageKey, date) {
    var datesWithPassage = passageSortedDates.value.get(passageKey);
    if (!datesWithPassage || !datesWithPassage.includes(date))
        return false;
    var allDates = sortedDates.value;
    var idx = allDates.indexOf(date);
    if (idx <= 0)
        return false;
    var prevDate = allDates[idx - 1];
    return prevDate !== undefined && datesWithPassage.includes(prevDate);
}
// Get cell background class
function getCellClass(passageKey, date) {
    var datesForPassage = passageDateMap.value.get(passageKey);
    if (!(datesForPassage === null || datesForPassage === void 0 ? void 0 : datesForPassage.has(date)))
        return '';
    if (isConsecutiveRepeat(passageKey, date)) {
        return 'bg-amber-900/30';
    }
    return 'bg-sky-900/40';
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
if (__VLS_ctx.services.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-dashed border-gray-700 py-10 text-center" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400" }));
}
else if (__VLS_ctx.rotationEntries.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-dashed border-gray-700 py-10 text-center" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400" }));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 mb-3" }));
    (__VLS_ctx.sortedDates.length);
    (__VLS_ctx.sortedDates.length !== 1 ? 's' : '');
    if (__VLS_ctx.rotationEntries.length > 20) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-4" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.passageFilter), type: "text", placeholder: "Filter by passage..." }, { class: "w-full max-w-xs rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-gray-800 overflow-x-auto" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)(__assign({ class: "w-full text-sm border-collapse" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ class: "bg-gray-700" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "text-left px-3 py-2 text-xs font-semibold text-gray-300 border-b border-gray-800 min-w-[160px] sticky left-0 bg-gray-700 z-10" }));
    for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.sortedDates)); _i < _a.length; _i++) {
        var date = _a[_i][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ key: (date) }, { class: "px-3 py-2 text-xs font-semibold text-gray-400 border-b border-gray-800 border-l border-l-gray-800 text-center min-w-[80px] whitespace-nowrap" }));
        (__VLS_ctx.formatColumnDate(date));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)(__assign({ class: "bg-gray-900" }));
    for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.filteredEntries)); _b < _c.length; _b++) {
        var entry = _c[_b][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign({ key: (entry.key) }, { class: "border-b border-gray-800 last:border-b-0 hover:bg-gray-800/30 transition-colors" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-3 py-2 text-xs font-medium text-gray-100 sticky left-0 bg-gray-900 z-10 border-r border-gray-800" }));
        (entry.key);
        for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.sortedDates)); _d < _e.length; _d++) {
            var date = _e[_d][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign(__assign({ key: (date) }, { class: "px-3 py-2 text-center border-l border-gray-800" }), { class: (__VLS_ctx.getCellClass(entry.key, date)) }));
            if (entry.dates.includes(date)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-block w-2.5 h-2.5 rounded-full" }, { class: (__VLS_ctx.isConsecutiveRepeat(entry.key, date) ? 'bg-amber-400' : 'bg-sky-300') }));
            }
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-4 mt-3 text-xs text-gray-500" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-1.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-block w-2.5 h-2.5 rounded-full bg-sky-300" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-1.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-block w-2.5 h-2.5 rounded-full bg-amber-400" }));
}
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
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
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[160px]']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[80px]']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/30']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-sky-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-amber-400']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            passageFilter: passageFilter,
            rotationEntries: rotationEntries,
            sortedDates: sortedDates,
            filteredEntries: filteredEntries,
            formatColumnDate: formatColumnDate,
            isConsecutiveRepeat: isConsecutiveRepeat,
            getCellClass: getCellClass,
        };
    },
    __typeProps: {},
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
