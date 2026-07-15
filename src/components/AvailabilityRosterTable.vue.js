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
var roster_1 = require("@/stores/roster");
var props = defineProps();
var emit = defineEmits();
var rosterStore = (0, roster_1.useRosterStore)();
// ── Static class maps (never dynamically constructed — Tailwind v4 purge safety) ──
var ROLE_CHIP_CLASS = {
    band: 'text-blue-300 bg-blue-900/40 border border-blue-700/50',
    tech: 'text-purple-300 bg-purple-900/40 border border-purple-700/50',
    vocals: 'text-pink-300 bg-pink-900/40 border border-pink-700/50',
    other: 'text-gray-300 bg-gray-800 border border-gray-700',
};
var FILTER_ON_CLASS = 'bg-gray-700 border-gray-600 text-white';
var FILTER_OFF_CLASS = 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200';
// D-04/D-05: per-role tier read from the single quarter-scoped source of
// truth — roleFrequency?.[roleId]?.tier, defaulting to 'regular' when the
// role has no tuned entry (or no personQuarterData entry exists at all).
function tierOf(personId, roleId) {
    var _a, _b, _c, _d;
    var pqd = (_a = props.quarter) === null || _a === void 0 ? void 0 : _a.personQuarterData[personId];
    return (_d = (_c = (_b = pqd === null || pqd === void 0 ? void 0 : pqd.roleFrequency) === null || _b === void 0 ? void 0 : _b[roleId]) === null || _c === void 0 ? void 0 : _c.tier) !== null && _d !== void 0 ? _d : 'regular';
}
// Aggregate a person's per-role tiers across their held roles into a single status
// for this admin table, most-restrictive-wins (out > fillin > regular) — a person
// out for ANY held role must surface as 'out' here, the primary admin audit surface
// for the per-role frequency feature (D-05). Defaults to 'regular' when no
// roleFrequency map exists (greenfield — no legacy-data migration per D-04).
function aggregateTier(person) {
    var _a;
    var pqd = (_a = props.quarter) === null || _a === void 0 ? void 0 : _a.personQuarterData[person.id];
    if (!(pqd === null || pqd === void 0 ? void 0 : pqd.roleFrequency) || Object.keys(pqd.roleFrequency).length === 0) {
        return 'regular';
    }
    var tiers = person.roles.map(function (roleId) { return tierOf(person.id, roleId); });
    if (tiers.includes('out'))
        return 'out';
    if (tiers.includes('fillin'))
        return 'fillin';
    return 'regular';
}
// ── Quarter-scoped data lookup, defaulted per Phase 14 convention (lazy-default
// on read — a quarter with no personQuarterData entry for this person at all) ──
function quarterDataFor(person) {
    var _a, _b, _c, _d;
    var pqd = (_a = props.quarter) === null || _a === void 0 ? void 0 : _a.personQuarterData[person.id];
    return {
        blackoutDates: (_b = pqd === null || pqd === void 0 ? void 0 : pqd.blackoutDates) !== null && _b !== void 0 ? _b : [],
        pairedWith: (_c = pqd === null || pqd === void 0 ? void 0 : pqd.pairedWith) !== null && _c !== void 0 ? _c : [],
        tier: aggregateTier(person),
        note: (_d = pqd === null || pqd === void 0 ? void 0 : pqd.note) !== null && _d !== void 0 ? _d : '',
    };
}
// ── Search + filter toolbar ──────────────────────────────────────────────────
var searchQuery = (0, vue_1.ref)('');
var activeFilter = (0, vue_1.ref)('all');
var filteredPeople = (0, vue_1.computed)(function () {
    var list = rosterStore.activePeople;
    var q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(function (p) { return p.name.toLowerCase().includes(q); });
    }
    if (activeFilter.value === 'out') {
        list = list.filter(function (p) { return quarterDataFor(p).tier === 'out'; });
    }
    return list;
});
// ── Role chips ────────────────────────────────────────────────────────────────
function roleName(roleId) {
    var _a, _b;
    return (_b = (_a = rosterStore.roles.find(function (r) { return r.id === roleId; })) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : roleId;
}
function roleChipClass(roleId) {
    var _a, _b;
    var group = (_b = (_a = rosterStore.roles.find(function (r) { return r.id === roleId; })) === null || _a === void 0 ? void 0 : _a.group) !== null && _b !== void 0 ? _b : 'other';
    return ROLE_CHIP_CLASS[group];
}
// ── Per-role frequency (Roles & Frequency column) ────────────────────────────
function freqLabel(n) {
    if (n <= 1)
        return 'Every week';
    if (n <= 2)
        return 'Twice a month';
    if (n <= 4)
        return 'Monthly';
    return "1-in-".concat(n);
}
// D-04/D-05: per-role cadence read from the quarter-scoped roleFrequency map,
// defaulting to N=4 when a held role has no tuned entry.
function roleFrequencyN(personId, roleId) {
    var _a, _b, _c, _d;
    var pqd = (_a = props.quarter) === null || _a === void 0 ? void 0 : _a.personQuarterData[personId];
    return (_d = (_c = (_b = pqd === null || pqd === void 0 ? void 0 : pqd.roleFrequency) === null || _b === void 0 ? void 0 : _b[roleId]) === null || _c === void 0 ? void 0 : _c.n) !== null && _d !== void 0 ? _d : 4;
}
// Human label for a single held role's cadence — 'out'/'fillin' tiers win over
// the numeric cadence so an out/fill-in role reads plainly next to its chip.
// Each held role is shown with its OWN frequency (a volunteer with multiple roles
// no longer collapses to one aggregate badge).
function roleFreqLabel(personId, roleId) {
    var tier = tierOf(personId, roleId);
    if (tier === 'out')
        return 'Out this quarter';
    if (tier === 'fillin')
        return 'Fill-in';
    return freqLabel(roleFrequencyN(personId, roleId));
}
// ── Blackout dates + note (Blackout & Note column) ───────────────────────────
var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Format an ISO 'YYYY-MM-DD' as e.g. 'Jul 5' WITHOUT constructing a Date (avoids
// the UTC-vs-local off-by-one that new Date('2026-07-05') introduces). Falls back
// to the raw string if it doesn't parse.
function formatShortDate(iso) {
    var parts = iso.split('-');
    if (parts.length !== 3)
        return iso;
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    if (!month || !day || month < 1 || month > 12)
        return iso;
    return "".concat(MONTH_ABBR[month - 1], " ").concat(day);
}
// The person's actual blacked-out service dates for this quarter, chronologically
// sorted and human-formatted (not just a count).
function blackoutDatesFormatted(person) {
    return __spreadArray([], quarterDataFor(person).blackoutDates, true).sort().map(formatShortDate);
}
// Per-quarter, per-person free-text note (PersonQuarterData.note).
function noteSummary(person) {
    return quarterDataFor(person).note.trim();
}
// ── Pairing summary (sketch pairChipsHtml()/firstName()) ─────────────────────
function firstName(id) {
    var _a;
    var name = (_a = rosterStore.people.find(function (p) { return p.id === id; })) === null || _a === void 0 ? void 0 : _a.name;
    return name ? name.split(' ')[0] : id;
}
function pairSummary(person) {
    var pairedWith = quarterDataFor(person).pairedWith;
    if (pairedWith.length === 0)
        return '';
    return '↔ ' + pairedWith.map(function (id) { return firstName(id); }).join(', ');
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 flex-wrap mb-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.searchQuery), type: "text", placeholder: "Search volunteers&hellip;" }, { class: "flex-1 min-w-[180px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.activeFilter = 'all';
    } }, { type: "button" }), { class: "text-xs px-3 py-1.5 rounded-full border transition-colors" }), { class: (__VLS_ctx.activeFilter === 'all' ? __VLS_ctx.FILTER_ON_CLASS : __VLS_ctx.FILTER_OFF_CLASS) }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.activeFilter = 'out';
    } }, { type: "button" }), { class: "text-xs px-3 py-1.5 rounded-full border transition-colors" }), { class: (__VLS_ctx.activeFilter === 'out' ? __VLS_ctx.FILTER_ON_CLASS : __VLS_ctx.FILTER_OFF_CLASS) }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "overflow-x-auto" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)(__assign({ class: "w-full text-sm border-collapse" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "px-3 py-2" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
var _loop_1 = function (person) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            __VLS_ctx.emit('select', person.id);
        } }, { key: (person.id) }), { class: "border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/40 transition-colors" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-3 py-2.5 font-medium text-gray-100 whitespace-nowrap align-top" }));
    (person.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-3 py-2.5 align-top" }));
    for (var _b = 0, _c = __VLS_getVForSourceType((person.roles)); _b < _c.length; _b++) {
        var roleId = _c[_b][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (roleId) }, { class: "flex items-center gap-2 mb-1 last:mb-0 whitespace-nowrap" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-block text-xs font-semibold px-2 py-0.5 rounded-full" }, { class: (__VLS_ctx.roleChipClass(roleId)) }));
        (__VLS_ctx.roleName(roleId));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-400" }));
        (__VLS_ctx.roleFreqLabel(person.id, roleId));
    }
    if (person.roles.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600 italic text-xs" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-3 py-2.5 text-gray-400 max-w-[20rem] align-top" }));
    if (__VLS_ctx.blackoutDatesFormatted(person).length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-amber-300/90 mb-1" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-[10px] uppercase tracking-wide text-gray-500 mr-1" }));
        (__VLS_ctx.blackoutDatesFormatted(person).join(', '));
    }
    if (__VLS_ctx.noteSummary(person)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "whitespace-pre-wrap text-gray-300" }));
        (__VLS_ctx.noteSummary(person));
    }
    if (!__VLS_ctx.blackoutDatesFormatted(person).length && !__VLS_ctx.noteSummary(person)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600 italic" }));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-3 py-2.5 text-purple-300 text-xs align-top" }));
    (__VLS_ctx.pairSummary(person));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "px-3 py-2.5 text-gray-600 text-base align-top" }));
};
for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.filteredPeople)); _i < _a.length; _i++) {
    var person = _a[_i][0];
    _loop_1(person);
}
if (__VLS_ctx.filteredPeople.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ colspan: "5" }, { class: "px-3 py-6 text-center text-sm text-gray-600" }));
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[180px]']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/40']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['last:mb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[20rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-300/90']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            emit: emit,
            FILTER_ON_CLASS: FILTER_ON_CLASS,
            FILTER_OFF_CLASS: FILTER_OFF_CLASS,
            searchQuery: searchQuery,
            activeFilter: activeFilter,
            filteredPeople: filteredPeople,
            roleName: roleName,
            roleChipClass: roleChipClass,
            roleFreqLabel: roleFreqLabel,
            blackoutDatesFormatted: blackoutDatesFormatted,
            noteSummary: noteSummary,
            pairSummary: pairSummary,
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
