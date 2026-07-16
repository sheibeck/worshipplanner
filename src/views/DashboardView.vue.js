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
var auth_1 = require("@/stores/auth");
var songs_1 = require("@/stores/songs");
var services_1 = require("@/stores/services");
var roster_1 = require("@/stores/roster");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var GettingStarted_vue_1 = require("@/components/GettingStarted.vue");
var authStore = (0, auth_1.useAuthStore)();
var songStore = (0, songs_1.useSongStore)();
var serviceStore = (0, services_1.useServiceStore)();
var rosterStore = (0, roster_1.useRosterStore)();
var displayName = (0, vue_1.computed)(function () {
    var _a, _b, _c;
    return ((_a = authStore.user) === null || _a === void 0 ? void 0 : _a.displayName) || ((_c = (_b = authStore.user) === null || _b === void 0 ? void 0 : _b.email) === null || _c === void 0 ? void 0 : _c.split('@')[0]) || '';
});
var todayStr = (0, vue_1.computed)(function () {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return "".concat(y, "-").concat(m, "-").concat(d);
});
// ── Services (next + upcoming) ────────────────────────────────────────────────
var upcomingServices = (0, vue_1.computed)(function () {
    return serviceStore.services
        .filter(function (s) { return s.date >= todayStr.value; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); });
});
var nextService = (0, vue_1.computed)(function () { var _a; return (_a = upcomingServices.value[0]) !== null && _a !== void 0 ? _a : null; });
var upcomingAfterNext = (0, vue_1.computed)(function () { return upcomingServices.value.slice(1, 6); });
function serviceSongStats(service) {
    var songSlots = service.slots.filter(function (s) { return s.kind === 'SONG'; });
    var filled = songSlots.filter(function (s) { return s.kind === 'SONG' && s.songId; }).length;
    return { filled: filled, total: songSlots.length };
}
function hasScripture(service) {
    var scriptureFilled = service.slots.some(function (s) { return s.kind === 'SCRIPTURE' && s.book; });
    return scriptureFilled || service.sermonPassage != null;
}
function isServiceReady(service) {
    var _a = serviceSongStats(service), filled = _a.filled, total = _a.total;
    return total > 0 && filled === total;
}
function formatServiceDate(date) {
    var _a = date.split('-').map(Number), y = _a[0], m = _a[1], d = _a[2];
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}
// ── Volunteer & role coverage ─────────────────────────────────────────────────
// A role is "under-staffed" when fewer than 2 active volunteers can fill it —
// a single point of failure (or none at all) for that role.
var MIN_VOLUNTEERS_PER_ROLE = 2;
var understaffedRoles = (0, vue_1.computed)(function () {
    return rosterStore.rolesSorted
        .map(function (role) { return ({
        role: role,
        count: rosterStore.activePeople.filter(function (p) { return p.roles.includes(role.id); }).length,
    }); })
        .filter(function (entry) { return entry.count < MIN_VOLUNTEERS_PER_ROLE; });
});
// ── Song library health ───────────────────────────────────────────────────────
var activeSongs = (0, vue_1.computed)(function () { return songStore.visibleSongs; });
var uncategorizedCount = (0, vue_1.computed)(function () { return activeSongs.value.filter(function (s) { return s.vwTypes.length === 0; }).length; });
// Coerce with String() before trimming — imported data can carry a numeric
// ccliNumber / arrangement key, which would blow up a bare .trim() call.
var missingKeyCount = (0, vue_1.computed)(function () {
    return activeSongs.value.filter(function (s) {
        return s.arrangements.length === 0 ||
            s.arrangements.every(function (a) { var _a; return String((_a = a.key) !== null && _a !== void 0 ? _a : '').trim() === ''; });
    }).length;
});
var missingCcliCount = (0, vue_1.computed)(function () { return activeSongs.value.filter(function (s) { var _a; return String((_a = s.ccliNumber) !== null && _a !== void 0 ? _a : '').trim() === ''; }).length; });
// Stale = last scheduled more than ~6 months ago. Never-used songs (lastUsedAt null)
// are excluded — a brand-new song shouldn't read as stale.
var staleCount = (0, vue_1.computed)(function () {
    var cutoffMs = Date.now() - 1000 * 60 * 60 * 24 * 182;
    return activeSongs.value.filter(function (s) {
        return s.lastUsedAt &&
            typeof s.lastUsedAt.toMillis === 'function' &&
            s.lastUsedAt.toMillis() < cutoffMs;
    }).length;
});
var songTiles = (0, vue_1.computed)(function () { return __spreadArray(__spreadArray([
    { label: 'Songs', value: activeSongs.value.length, to: '/songs', warn: false }
], (authStore.vwModeEnabled
    ? [{ label: 'Uncategorized', value: uncategorizedCount.value, to: '/songs', warn: true }]
    : []), true), [
    { label: 'Missing key', value: missingKeyCount.value, to: '/songs', warn: true },
    { label: 'Missing CCLI', value: missingCcliCount.value, to: '/songs', warn: true },
    { label: 'Stale (6+ mo)', value: staleCount.value, to: '/songs', warn: true },
], false); });
// Subscribe to songs, services, and roster so dashboard data is reactive
(0, vue_1.onMounted)(function () {
    var orgId = authStore.orgId;
    if (!orgId)
        return;
    if (!songStore.orgId) {
        songStore.subscribe(orgId);
    }
    if (!serviceStore.orgId) {
        serviceStore.subscribe(orgId);
    }
    if (!rosterStore.orgId) {
        rosterStore.subscribe(orgId);
    }
});
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mb-6 pb-4 border-b border-gray-800" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-xl font-semibold text-gray-100" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-1" }));
(__VLS_ctx.displayName ? ", ".concat(__VLS_ctx.displayName) : '');
if (__VLS_ctx.authStore.isEditor) {
    /** @type {[typeof GettingStarted, ]} */ ;
    // @ts-ignore
    var __VLS_4 = __VLS_asFunctionalComponent(GettingStarted_vue_1.default, new GettingStarted_vue_1.default(__assign({ class: "mb-6" })));
    var __VLS_5 = __VLS_4.apply(void 0, __spreadArray([__assign({ class: "mb-6" })], __VLS_functionalComponentArgsRest(__VLS_4), false));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between mb-3" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-xs font-semibold uppercase tracking-widest text-gray-500" }));
if (__VLS_ctx.upcomingServices.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-600" }));
    (__VLS_ctx.upcomingServices.length);
}
if (__VLS_ctx.nextService) {
    var __VLS_7 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    var __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7(__assign({ to: ("/services/".concat(__VLS_ctx.nextService.id)) }, { class: "block rounded-lg border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/50 transition-colors" })));
    var __VLS_9 = __VLS_8.apply(void 0, __spreadArray([__assign({ to: ("/services/".concat(__VLS_ctx.nextService.id)) }, { class: "block rounded-lg border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/50 transition-colors" })], __VLS_functionalComponentArgsRest(__VLS_8), false));
    __VLS_10.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-start justify-between gap-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-w-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-base font-semibold text-gray-100 truncate" }));
    (__VLS_ctx.nextService.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mt-0.5" }));
    (__VLS_ctx.formatServiceDate(__VLS_ctx.nextService.date));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-gray-500 shrink-0 mt-1" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M9 5l7 7-7 7",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-4 flex items-center gap-2 flex-wrap" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border" }, { class: (__VLS_ctx.serviceSongStats(__VLS_ctx.nextService).total > 0 && __VLS_ctx.serviceSongStats(__VLS_ctx.nextService).filled === __VLS_ctx.serviceSongStats(__VLS_ctx.nextService).total
            ? 'bg-green-900/40 border-green-700/50 text-green-300'
            : 'bg-amber-900/40 border-amber-700/50 text-amber-300') }));
    (__VLS_ctx.serviceSongStats(__VLS_ctx.nextService).filled);
    (__VLS_ctx.serviceSongStats(__VLS_ctx.nextService).total);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border" }, { class: (__VLS_ctx.hasScripture(__VLS_ctx.nextService)
            ? 'bg-green-900/40 border-green-700/50 text-green-300'
            : 'bg-gray-800 border-gray-700 text-gray-400') }));
    (__VLS_ctx.hasScripture(__VLS_ctx.nextService) ? 'Scripture set' : 'No scripture');
    var __VLS_10;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-dashed border-gray-700 p-6 text-center" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400" }));
    var __VLS_11 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    var __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11(__assign({ to: "/services" }, { class: "text-indigo-400 hover:text-indigo-300" })));
    var __VLS_13 = __VLS_12.apply(void 0, __spreadArray([__assign({ to: "/services" }, { class: "text-indigo-400 hover:text-indigo-300" })], __VLS_functionalComponentArgsRest(__VLS_12), false));
    __VLS_14.slots.default;
    var __VLS_14;
}
if (__VLS_ctx.upcomingAfterNext.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-3 divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden" }));
    for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.upcomingAfterNext)); _i < _a.length; _i++) {
        var s = _a[_i][0];
        var __VLS_15 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        var __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15(__assign({ key: (s.id), to: ("/services/".concat(s.id)) }, { class: "flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-800/40 transition-colors" })));
        var __VLS_17 = __VLS_16.apply(void 0, __spreadArray([__assign({ key: (s.id), to: ("/services/".concat(s.id)) }, { class: "flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-800/40 transition-colors" })], __VLS_functionalComponentArgsRest(__VLS_16), false));
        __VLS_18.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-w-0" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-200" }));
        (s.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-500 ml-2" }));
        (__VLS_ctx.formatServiceDate(s.date));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign(__assign({ class: "h-2 w-2 rounded-full shrink-0" }, { class: (__VLS_ctx.isServiceReady(s) ? 'bg-green-500' : 'bg-amber-500') }), { title: (__VLS_ctx.isServiceReady(s) ? 'All songs assigned' : 'Songs still needed') }));
        var __VLS_18;
    }
}
if (__VLS_ctx.authStore.isEditor) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-gray-800 bg-gray-900 p-5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-8 flex-wrap mb-4" }));
    var __VLS_19 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    var __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19(__assign({ to: "/volunteers" }, { class: "block" })));
    var __VLS_21 = __VLS_20.apply(void 0, __spreadArray([__assign({ to: "/volunteers" }, { class: "block" })], __VLS_functionalComponentArgsRest(__VLS_20), false));
    __VLS_22.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-2xl font-bold text-gray-100" }));
    (__VLS_ctx.rosterStore.activePeople.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
    var __VLS_22;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-2xl font-bold" }, { class: (__VLS_ctx.understaffedRoles.length > 0 ? 'text-amber-400' : 'text-gray-100') }));
    (__VLS_ctx.understaffedRoles.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
    if (__VLS_ctx.understaffedRoles.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap gap-2" }));
        for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.understaffedRoles)); _b < _c.length; _b++) {
            var entry = _c[_b][0];
            var __VLS_23 = {}.RouterLink;
            /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
            // @ts-ignore
            var __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23(__assign(__assign({ key: (entry.role.id), to: "/volunteers" }, { class: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border" }), { class: (entry.count === 0
                    ? 'bg-red-900/40 border-red-700/50 text-red-300'
                    : 'bg-amber-900/40 border-amber-700/50 text-amber-300') })));
            var __VLS_25 = __VLS_24.apply(void 0, __spreadArray([__assign(__assign({ key: (entry.role.id), to: "/volunteers" }, { class: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border" }), { class: (entry.count === 0
                        ? 'bg-red-900/40 border-red-700/50 text-red-300'
                        : 'bg-amber-900/40 border-amber-700/50 text-amber-300') })], __VLS_functionalComponentArgsRest(__VLS_24), false));
            __VLS_26.slots.default;
            (entry.role.name);
            (entry.count === 0 ? 'none' : "".concat(entry.count, " volunteer").concat(entry.count === 1 ? '' : 's'));
            var __VLS_26;
        }
    }
    else if (__VLS_ctx.rosterStore.roles.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-500" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-500" }));
        var __VLS_27 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        var __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27(__assign({ to: "/volunteers" }, { class: "text-indigo-400 hover:text-indigo-300" })));
        var __VLS_29 = __VLS_28.apply(void 0, __spreadArray([__assign({ to: "/volunteers" }, { class: "text-indigo-400 hover:text-indigo-300" })], __VLS_functionalComponentArgsRest(__VLS_28), false));
        __VLS_30.slots.default;
        var __VLS_30;
    }
}
if (__VLS_ctx.authStore.isEditor) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)(__assign({ class: "lg:col-span-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" }));
    for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.songTiles)); _d < _e.length; _d++) {
        var tile = _e[_d][0];
        var __VLS_31 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        var __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31(__assign({ key: (tile.label), to: (tile.to) }, { class: "bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors" })));
        var __VLS_33 = __VLS_32.apply(void 0, __spreadArray([__assign({ key: (tile.label), to: (tile.to) }, { class: "bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors" })], __VLS_functionalComponentArgsRest(__VLS_32), false));
        __VLS_34.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-2xl font-bold" }, { class: (tile.warn && tile.value > 0 ? 'text-amber-400' : 'text-gray-100') }));
        (tile.value);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
        (tile.label);
        var __VLS_34;
    }
}
var __VLS_2;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
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
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/40']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-5']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            AppShell: AppShell_vue_1.default,
            GettingStarted: GettingStarted_vue_1.default,
            authStore: authStore,
            rosterStore: rosterStore,
            displayName: displayName,
            upcomingServices: upcomingServices,
            nextService: nextService,
            upcomingAfterNext: upcomingAfterNext,
            serviceSongStats: serviceSongStats,
            hasScripture: hasScripture,
            isServiceReady: isServiceReady,
            formatServiceDate: formatServiceDate,
            understaffedRoles: understaffedRoles,
            songTiles: songTiles,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
