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
var quarters_1 = require("@/stores/quarters");
var roster_1 = require("@/stores/roster");
var scheduler_1 = require("@/utils/scheduler");
var props = withDefaults(defineProps(), { changedDates: function () { return []; } });
var quartersStore = (0, quarters_1.useQuartersStore)();
var rosterStore = (0, roster_1.useRosterStore)();
// ── Static class maps (never dynamically constructed — Tailwind v4 purge safety) ──
var groupHeaderBg = {
    band: 'bg-blue-900/50',
    tech: 'bg-purple-900/50',
    vocals: 'bg-pink-900/50',
    other: 'bg-gray-800',
};
var GROUP_ORDER = ['band', 'vocals', 'tech', 'other'];
// ── Roles grouped Band/Tech/Other, ordered within group ────────────────────────
var sortedRoles = (0, vue_1.computed)(function () {
    return __spreadArray([], props.roles, true).sort(function (a, b) {
        var groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
        if (groupDiff !== 0)
            return groupDiff;
        return a.order - b.order;
    });
});
// ── Cell data helpers ────────────────────────────────────────────────────────────
function cellPeople(date, roleId) {
    var _a, _b;
    return (_b = (_a = props.quarter.calendar[date]) === null || _a === void 0 ? void 0 : _a[roleId]) !== null && _b !== void 0 ? _b : [];
}
function namesFor(date, roleId) {
    return cellPeople(date, roleId).map(personName).join(', ');
}
function effectiveCountFor(date, roleId) {
    var _a;
    var override = props.quarter.roleOverridesByDate[date];
    var overrideMatch = override === null || override === void 0 ? void 0 : override.find(function (r) { return r.roleId === roleId; });
    if (overrideMatch)
        return overrideMatch.count;
    var role = props.roles.find(function (r) { return r.id === roleId; });
    return (_a = role === null || role === void 0 ? void 0 : role.defaultCount) !== null && _a !== void 0 ? _a : 0;
}
// Live-computed from the calendar + effective count (NOT props.lastProposeResult.unfilled,
// which is a static snapshot from the last propose and does NOT update when a slot is filled
// by hand — using it here left the red "unfilled" tag stuck after a manual assignment).
function cellIsUnfilled(date, roleId) {
    return cellPeople(date, roleId).length < effectiveCountFor(date, roleId);
}
function cellHasConflict(date, roleId) {
    var _a, _b;
    var conflicts = (_b = (_a = props.lastProposeResult) === null || _a === void 0 ? void 0 : _a.pairingConflicts.filter(function (c) { return c.date === date; })) !== null && _b !== void 0 ? _b : [];
    if (conflicts.length === 0)
        return false;
    var assigned = cellPeople(date, roleId);
    return assigned.some(function (id) { return conflicts.some(function (c) { return c.personId === id || c.partnerId === id; }); });
}
// ── Group co-occurrence warning (D-11, warn-don't-block) ────────────────────────
var roleGroupById = (0, vue_1.computed)(function () {
    var m = new Map();
    for (var _i = 0, _a = props.roles; _i < _a.length; _i++) {
        var r = _a[_i];
        m.set(r.id, r.group);
    }
    return m;
});
function roleGroupOf(roleId) {
    var _a;
    return (_a = roleGroupById.value.get(roleId)) !== null && _a !== void 0 ? _a : 'other';
}
// Live-computed from props.quarter.calendar + props.roles (NOT props.lastProposeResult) —
// works for a loaded historical calendar, not only immediately after a fresh propose.
function cellHasGroupViolation(date, roleId) {
    var _a;
    var peopleInCell = cellPeople(date, roleId);
    if (peopleInCell.length === 0)
        return false;
    var calendarForDate = (_a = props.quarter.calendar[date]) !== null && _a !== void 0 ? _a : {};
    return peopleInCell.some(function (personId) {
        var roleIdsThisDate = Object.entries(calendarForDate)
            .filter(function (_a) {
            var ids = _a[1];
            return ids.includes(personId);
        })
            .map(function (_a) {
            var rId = _a[0];
            return rId;
        });
        return !(0, scheduler_1.evaluateGroupCombo)(roleIdsThisDate, roleGroupOf).ok;
    });
}
function personName(id) {
    var _a, _b;
    return (_b = (_a = rosterStore.people.find(function (p) { return p.id === id; })) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '(unknown)';
}
function formatDateLabel(date) {
    var d = new Date("".concat(date, "T00:00:00"));
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
// ── Change highlight (last regenerate) ──────────────────────────────────────────
function isChanged(date) {
    return props.changedDates.includes(date);
}
// ── Blackout + candidate helpers (D-23) ─────────────────────────────────────────
function isBlackedOut(personId, date) {
    var _a, _b;
    return (_b = (_a = props.quarter.personQuarterData[personId]) === null || _a === void 0 ? void 0 : _a.blackoutDates.includes(date)) !== null && _b !== void 0 ? _b : false;
}
function hasRole(person, roleId) {
    return person.roles.includes(roleId);
}
// D-04/D-05: 'out'-tier people must never be offered as a manual gap-filling candidate.
function tierOf(personId, roleId) {
    var _a, _b, _c;
    var pqd = props.quarter.personQuarterData[personId];
    return (_c = (_b = (_a = pqd === null || pqd === void 0 ? void 0 : pqd.roleFrequency) === null || _a === void 0 ? void 0 : _a[roleId]) === null || _b === void 0 ? void 0 : _b.tier) !== null && _c !== void 0 ? _c : 'regular';
}
// Available-unassigned for (date, roleId) = activePeople with roleId in roles,
// NOT blacked out that date, NOT already in that cell, NOT 'out'-tier for this role.
function availableUnassigned(date, roleId) {
    var assigned = new Set(cellPeople(date, roleId));
    return rosterStore.activePeople.filter(function (p) {
        return hasRole(p, roleId) &&
            !isBlackedOut(p.id, date) &&
            !assigned.has(p.id) &&
            tierOf(p.id, roleId) !== 'out';
    });
}
// Blacked-out-today for a (date, roleId) gap = active people who could fill this role
// but are blacked out that date and not already assigned to the cell.
function blackedOutToday(date, roleId) {
    var assigned = new Set(cellPeople(date, roleId));
    return rosterStore.activePeople.filter(function (p) { return hasRole(p, roleId) && isBlackedOut(p.id, date) && !assigned.has(p.id); });
}
// ── Expanded row state (click-to-edit whole date) ───────────────────────────────
var expandedDate = (0, vue_1.ref)(null);
var activeDate = (0, vue_1.computed)(function () { var _a; return (_a = expandedDate.value) !== null && _a !== void 0 ? _a : ''; });
// Per-role "add a person" selection, keyed by roleId (reset each open/close).
var addSelectByRole = (0, vue_1.ref)({});
function openRow(date) {
    expandedDate.value = date;
    addSelectByRole.value = {};
}
function closeDrawer() {
    expandedDate.value = null;
    addSelectByRole.value = {};
}
// ── Store actions — scoped Firestore dot-path updates only (D-22, T-13-09-02) ──
function onClear(date, roleId, personId) {
    quartersStore.clearAssignment(props.quarter.id, date, roleId, personId);
}
function onAdd(roleId) {
    var personId = addSelectByRole.value[roleId];
    if (!expandedDate.value || !personId)
        return;
    quartersStore.assignPerson(props.quarter.id, expandedDate.value, roleId, personId);
    addSelectByRole.value[roleId] = '';
}
function onQuickAssign(date, roleId, personId) {
    quartersStore.assignPerson(props.quarter.id, date, roleId, personId);
}
function onSwapSelect(event, date, roleId, fromPersonId) {
    var select = event.target;
    var toPersonId = select.value;
    if (!toPersonId)
        return;
    quartersStore.swapAssignment(props.quarter.id, date, roleId, fromPersonId, toPersonId);
    select.value = '';
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_withDefaultsArg = (function (t) { return t; })({ changedDates: function () { return []; } });
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "overflow-x-auto" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)(__assign({ class: "w-full text-sm border-collapse" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign({ class: "sticky left-0 z-10 bg-gray-900 px-2 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }));
for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.sortedRoles)); _i < _a.length; _i++) {
    var role = _a[_i][0];
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)(__assign(__assign({ key: (role.id) }, { class: "px-2 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" }), { class: (__VLS_ctx.groupHeaderBg[role.group]) }));
    (role.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
var _loop_1 = function (date) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            __VLS_ctx.openRow(date);
        } }, { key: (date), 'data-date': (date) }), { class: "border-b border-gray-800/50 cursor-pointer transition-colors hover:bg-gray-800/40" }), { class: (__VLS_ctx.isChanged(date) ? 'bg-indigo-950/30' : '') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ class: "sticky left-0 z-10 bg-gray-900 px-2 py-2 text-sm font-medium text-gray-100 whitespace-nowrap align-top border-l-2" }, { class: (__VLS_ctx.isChanged(date) ? 'border-indigo-500' : 'border-transparent') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2" }));
    (__VLS_ctx.formatDateLabel(date));
    if (__VLS_ctx.isChanged(date)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/50 border border-indigo-700/50 text-indigo-300" }));
    }
    for (var _f = 0, _g = __VLS_getVForSourceType((__VLS_ctx.sortedRoles)); _f < _g.length; _f++) {
        var role = _g[_f][0];
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)(__assign({ key: (role.id), 'data-role-id': (role.id), 'data-date': (date) }, { class: "px-2 py-2 align-top" }));
        if (__VLS_ctx.cellPeople(date, role.id).length || !__VLS_ctx.cellIsUnfilled(date, role.id)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-xs text-gray-300 leading-snug" }));
            if (__VLS_ctx.cellPeople(date, role.id).length) {
                (__VLS_ctx.namesFor(date, role.id));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-gray-600" }));
            }
        }
        if (__VLS_ctx.cellIsUnfilled(date, role.id) || __VLS_ctx.cellHasConflict(date, role.id) || __VLS_ctx.cellHasGroupViolation(date, role.id)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-0.5 flex flex-wrap gap-x-2 text-xs" }));
            if (__VLS_ctx.cellIsUnfilled(date, role.id)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-red-400" }));
            }
            if (__VLS_ctx.cellHasConflict(date, role.id)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-amber-400" }));
            }
            if (__VLS_ctx.cellHasGroupViolation(date, role.id)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-orange-400" }));
            }
        }
    }
};
for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.quarter.serviceDates)); _b < _c.length; _b++) {
    var date = _c[_b][0];
    _loop_1(date);
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
var __VLS_4 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    enterActiveClass: "transition-opacity duration-200 ease-out",
    enterFromClass: "opacity-0",
    enterToClass: "opacity-100",
    leaveActiveClass: "transition-opacity duration-150 ease-in",
    leaveFromClass: "opacity-100",
    leaveToClass: "opacity-0",
}));
var __VLS_6 = __VLS_5.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-opacity duration-200 ease-out",
        enterFromClass: "opacity-0",
        enterToClass: "opacity-100",
        leaveActiveClass: "transition-opacity duration-150 ease-in",
        leaveFromClass: "opacity-100",
        leaveToClass: "opacity-0",
    }], __VLS_functionalComponentArgsRest(__VLS_5), false));
__VLS_7.slots.default;
if (__VLS_ctx.expandedDate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: (__VLS_ctx.closeDrawer) }, { class: "fixed inset-0 z-40 bg-black/60" }));
}
var __VLS_7;
var __VLS_8 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
var __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    enterActiveClass: "transition-transform duration-200 ease-out",
    enterFromClass: "translate-x-full",
    enterToClass: "translate-x-0",
    leaveActiveClass: "transition-transform duration-150 ease-in",
    leaveFromClass: "translate-x-0",
    leaveToClass: "translate-x-full",
}));
var __VLS_10 = __VLS_9.apply(void 0, __spreadArray([{
        enterActiveClass: "transition-transform duration-200 ease-out",
        enterFromClass: "translate-x-full",
        enterToClass: "translate-x-0",
        leaveActiveClass: "transition-transform duration-150 ease-in",
        leaveFromClass: "translate-x-0",
        leaveToClass: "translate-x-full",
    }], __VLS_functionalComponentArgsRest(__VLS_9), false));
__VLS_11.slots.default;
if (__VLS_ctx.expandedDate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-base font-semibold text-gray-100" }));
    (__VLS_ctx.formatDateLabel(__VLS_ctx.activeDate));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: (__VLS_ctx.closeDrawer) }, { type: "button" }), { class: "p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" }), { 'aria-label': "Close editor" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-5 w-5" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M6 18L18 6M6 6l12 12",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex-1 overflow-y-auto px-6 py-5 space-y-5" }));
    var _loop_2 = function (role) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (role.id), 'data-role-section': (role.id) }, { class: "border-t border-gray-800 pt-4 first:border-t-0 first:pt-0" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-between mb-2" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)(__assign({ class: "text-sm font-semibold text-gray-100" }));
        (role.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs" }, { class: (__VLS_ctx.cellIsUnfilled(__VLS_ctx.activeDate, role.id) ? 'text-red-400' : 'text-gray-500') }));
        (__VLS_ctx.cellPeople(__VLS_ctx.activeDate, role.id).length);
        (__VLS_ctx.effectiveCountFor(__VLS_ctx.activeDate, role.id));
        if (__VLS_ctx.cellPeople(__VLS_ctx.activeDate, role.id).length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "space-y-2 mb-3" }));
            var _loop_3 = function (personId) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (personId) }, { class: "flex items-center gap-3 flex-wrap" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-sm text-gray-200 min-w-[8rem]" }));
                (__VLS_ctx.personName(personId));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.expandedDate))
                            return;
                        if (!(__VLS_ctx.cellPeople(__VLS_ctx.activeDate, role.id).length > 0))
                            return;
                        __VLS_ctx.onClear(__VLS_ctx.activeDate, role.id, personId);
                    } }, { type: "button" }), { class: "text-xs px-2 py-1 rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign(__assign({ onChange: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.expandedDate))
                            return;
                        if (!(__VLS_ctx.cellPeople(__VLS_ctx.activeDate, role.id).length > 0))
                            return;
                        __VLS_ctx.onSwapSelect($event, __VLS_ctx.activeDate, role.id, personId);
                    } }, { class: "text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" }), { value: "" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    value: "",
                });
                for (var _r = 0, _s = __VLS_getVForSourceType((__VLS_ctx.availableUnassigned(__VLS_ctx.activeDate, role.id))); _r < _s.length; _r++) {
                    var candidate = _s[_r][0];
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                        key: (candidate.id),
                        value: (candidate.id),
                    });
                    (candidate.name);
                }
            };
            for (var _h = 0, _j = __VLS_getVForSourceType((__VLS_ctx.cellPeople(__VLS_ctx.activeDate, role.id))); _h < _j.length; _h++) {
                var personId = _j[_h][0];
                _loop_3(personId);
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-2 flex-wrap" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign({ value: (__VLS_ctx.addSelectByRole[role.id]) }, { class: "text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "",
        });
        for (var _k = 0, _l = __VLS_getVForSourceType((__VLS_ctx.availableUnassigned(__VLS_ctx.activeDate, role.id))); _k < _l.length; _k++) {
            var candidate = _l[_k][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (candidate.id),
                value: (candidate.id),
            });
            (candidate.name);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.expandedDate))
                    return;
                __VLS_ctx.onAdd(role.id);
            } }, { type: "button" }), { class: "text-xs px-3 py-1.5 rounded-md text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" }), { disabled: (!__VLS_ctx.addSelectByRole[role.id]) }));
        if (__VLS_ctx.cellIsUnfilled(__VLS_ctx.activeDate, role.id)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-1 gap-3 pt-2" }));
            if (__VLS_ctx.blackedOutToday(__VLS_ctx.activeDate, role.id).length > 0) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-medium text-gray-400 uppercase tracking-wider mb-1" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)(__assign({ class: "space-y-1" }));
                for (var _m = 0, _o = __VLS_getVForSourceType((__VLS_ctx.blackedOutToday(__VLS_ctx.activeDate, role.id))); _m < _o.length; _m++) {
                    var p = _o[_m][0];
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)(__assign({ key: (p.id) }, { class: "text-sm text-gray-500 line-through" }));
                    (p.name);
                }
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs font-medium text-gray-400 uppercase tracking-wider mb-1" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)(__assign({ class: "space-y-1" }));
            var _loop_4 = function (p) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)(__assign({ key: (p.id) }, { class: "flex items-center justify-between gap-2 text-sm px-2 py-1 rounded-md bg-green-900/30 text-green-400" }));
                (p.name);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.expandedDate))
                            return;
                        if (!(__VLS_ctx.cellIsUnfilled(__VLS_ctx.activeDate, role.id)))
                            return;
                        __VLS_ctx.onQuickAssign(__VLS_ctx.activeDate, role.id, p.id);
                    } }, { type: "button" }), { class: "text-xs text-green-300 hover:text-green-200 underline" }));
            };
            for (var _p = 0, _q = __VLS_getVForSourceType((__VLS_ctx.availableUnassigned(__VLS_ctx.activeDate, role.id))); _p < _q.length; _p++) {
                var p = _q[_p][0];
                _loop_4(p);
            }
            if (__VLS_ctx.availableUnassigned(__VLS_ctx.activeDate, role.id).length === 0) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)(__assign({ class: "text-xs text-gray-600" }));
            }
        }
    };
    for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.sortedRoles)); _d < _e.length; _d++) {
        var role = _e[_d][0];
        _loop_2(role);
    }
}
var __VLS_11;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800/50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800/40']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-900/50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-700/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['align-top']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-snug']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-400']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-5']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['first:border-t-0']} */ ;
/** @type {__VLS_StyleScopedClasses['first:pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[8rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['line-through']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-green-200']} */ ;
/** @type {__VLS_StyleScopedClasses['underline']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            groupHeaderBg: groupHeaderBg,
            sortedRoles: sortedRoles,
            cellPeople: cellPeople,
            namesFor: namesFor,
            effectiveCountFor: effectiveCountFor,
            cellIsUnfilled: cellIsUnfilled,
            cellHasConflict: cellHasConflict,
            cellHasGroupViolation: cellHasGroupViolation,
            personName: personName,
            formatDateLabel: formatDateLabel,
            isChanged: isChanged,
            availableUnassigned: availableUnassigned,
            blackedOutToday: blackedOutToday,
            expandedDate: expandedDate,
            activeDate: activeDate,
            addSelectByRole: addSelectByRole,
            openRow: openRow,
            closeDrawer: closeDrawer,
            onClear: onClear,
            onAdd: onAdd,
            onQuickAssign: onQuickAssign,
            onSwapSelect: onSwapSelect,
        };
    },
    __typeProps: {},
    props: {},
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
