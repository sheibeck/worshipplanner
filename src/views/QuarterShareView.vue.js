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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
var vue_1 = require("vue");
var vue_router_1 = require("vue-router");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/firebase");
var QuarterShareMatrix_vue_1 = require("@/components/QuarterShareMatrix.vue");
var useIsMobile_1 = require("@/components/useIsMobile");
// ── State ───────────────────────────────────────────────────────────────────
var route = (0, vue_router_1.useRoute)();
var router = (0, vue_router_1.useRouter)();
var isDesktop = (0, useIsMobile_1.useIsMobile)().isDesktop;
var isLoading = (0, vue_1.ref)(true);
var notFound = (0, vue_1.ref)(false);
var quarterSnapshot = (0, vue_1.ref)(null);
var initialView = (_a = route.query.view) !== null && _a !== void 0 ? _a : (isDesktop.value ? 'matrix' : 'list');
var viewMode = (0, vue_1.ref)(initialView);
// Name filter (D-15/D-16) — nameFilter is the exact, selected snapshot name (or null);
// nameQuery is the raw typeahead input text; hydrated from route.query.name on mount.
var nameFilter = (0, vue_1.ref)((_b = route.query.name) !== null && _b !== void 0 ? _b : null);
var nameQuery = (0, vue_1.ref)((_c = nameFilter.value) !== null && _c !== void 0 ? _c : '');
var nameMenuOpen = (0, vue_1.ref)(false);
// ── Computed ────────────────────────────────────────────────────────────────
// Roles grouped Band/Tech/Other, mirroring QuarterGrid/RosterPrintLayout ordering.
var GROUP_ORDER = ['band', 'tech', 'other'];
var sortedRoles = (0, vue_1.computed)(function () {
    if (!quarterSnapshot.value)
        return [];
    return __spreadArray([], quarterSnapshot.value.roles, true).sort(function (a, b) { return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group); });
});
function peopleFor(date, roleId) {
    var _a, _b, _c;
    return (_c = (_b = (_a = quarterSnapshot.value) === null || _a === void 0 ? void 0 : _a.calendar[date]) === null || _b === void 0 ? void 0 : _b[roleId]) !== null && _c !== void 0 ? _c : [];
}
// Deduped person names collected from the snapshot's own calendar — never rosterStore (D-24).
var candidateNames = (0, vue_1.computed)(function () {
    if (!quarterSnapshot.value)
        return [];
    var names = new Set();
    for (var _i = 0, _a = Object.values(quarterSnapshot.value.calendar); _i < _a.length; _i++) {
        var dateEntry = _a[_i];
        for (var _b = 0, _c = Object.values(dateEntry); _b < _c.length; _b++) {
            var people = _c[_b];
            for (var _d = 0, people_1 = people; _d < people_1.length; _d++) {
                var name = people_1[_d];
                names.add(name);
            }
        }
    }
    return __spreadArray([], names, true).sort();
});
var filteredCandidateNames = (0, vue_1.computed)(function () {
    var q = nameQuery.value.trim().toLowerCase();
    return candidateNames.value.filter(function (name) { return q === '' || name.toLowerCase().includes(q); });
});
// Dates where the selected name serves in at least one role; unfiltered when no name is set.
var filteredDates = (0, vue_1.computed)(function () {
    if (!quarterSnapshot.value)
        return [];
    if (!nameFilter.value)
        return quarterSnapshot.value.serviceDates;
    return quarterSnapshot.value.serviceDates.filter(function (date) {
        return sortedRoles.value.some(function (role) { return peopleFor(date, role.id).includes(nameFilter.value); });
    });
});
function selectName(name) {
    nameFilter.value = name;
    nameQuery.value = name;
    nameMenuOpen.value = false;
}
function clearNameFilter() {
    nameFilter.value = null;
    nameQuery.value = '';
}
function onNameBlur() {
    window.setTimeout(function () {
        nameMenuOpen.value = false;
    }, 150);
}
function formatDateLabel(date) {
    var _a = date.split('-').map(Number), year = _a[0], month = _a[1], day = _a[2];
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}
// ── URL persistence (D-16) ─────────────────────────────────────────────────
// Mirrors SongsView.vue's router.replace({query}) convention — spreads existing
// route.query and never pushes a history entry for view/filter changes.
(0, vue_1.watch)([viewMode, nameFilter], function (_a) {
    var view = _a[0], name = _a[1];
    router.replace({ query: __assign(__assign({}, route.query), { view: view, name: name || undefined }) });
});
// ── Mount ───────────────────────────────────────────────────────────────────
(0, vue_1.onMounted)(function () { return __awaiter(void 0, void 0, void 0, function () {
    var token, snap, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                token = route.params.token;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 6, 7, 8]);
                if (!token) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'shareTokens', token))];
            case 2:
                _a = _c.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'quarterShares', "".concat(route.params.slug, "__q").concat(route.params.num, "-").concat(route.params.year)))];
            case 4:
                _a = _c.sent();
                _c.label = 5;
            case 5:
                snap = _a;
                if (!snap.exists()) {
                    notFound.value = true;
                }
                else {
                    quarterSnapshot.value = snap.data().quarterSnapshot;
                }
                return [3 /*break*/, 8];
            case 6:
                _b = _c.sent();
                notFound.value = true;
                return [3 /*break*/, 8];
            case 7:
                isLoading.value = false;
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-h-screen bg-white text-gray-900 font-sans" }));
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-center min-h-screen" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-500 text-sm" }));
}
else if (__VLS_ctx.notFound) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-center min-h-screen px-4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-center" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-700 text-base mb-2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-400 text-sm" }));
}
else if (__VLS_ctx.quarterSnapshot) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "max-w-5xl mx-auto px-4 py-8 sm:px-6" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-col gap-4 mb-6 pb-4 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)(__assign({ class: "text-xl font-bold text-gray-900" }));
    (__VLS_ctx.quarterSnapshot.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-600 mt-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex flex-wrap items-center gap-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "inline-flex rounded-md border border-gray-200 overflow-hidden text-sm" }, { role: "group", 'aria-label': "Schedule view" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!!(__VLS_ctx.isLoading))
                return;
            if (!!(__VLS_ctx.notFound))
                return;
            if (!(__VLS_ctx.quarterSnapshot))
                return;
            __VLS_ctx.viewMode = 'matrix';
        } }, { type: "button" }), { class: "px-3 py-1.5" }), { class: (__VLS_ctx.viewMode === 'matrix' ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-600') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!!(__VLS_ctx.isLoading))
                return;
            if (!!(__VLS_ctx.notFound))
                return;
            if (!(__VLS_ctx.quarterSnapshot))
                return;
            __VLS_ctx.viewMode = 'list';
        } }, { type: "button" }), { class: "px-3 py-1.5 border-l border-gray-200" }), { class: (__VLS_ctx.viewMode === 'list' ? 'bg-gray-900 text-white font-semibold' : 'bg-white text-gray-600') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "relative" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign(__assign(__assign({ onFocus: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!!(__VLS_ctx.isLoading))
                return;
            if (!!(__VLS_ctx.notFound))
                return;
            if (!(__VLS_ctx.quarterSnapshot))
                return;
            __VLS_ctx.nameMenuOpen = true;
        } }, { onBlur: (__VLS_ctx.onNameBlur) }), { value: (__VLS_ctx.nameQuery), type: "text", placeholder: "Filter by name…" }), { class: "w-48 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400" }));
    if (__VLS_ctx.nameMenuOpen) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-auto" }));
        var _loop_1 = function (candidate) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign(__assign({ onMousedown: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!!(__VLS_ctx.isLoading))
                        return;
                    if (!!(__VLS_ctx.notFound))
                        return;
                    if (!(__VLS_ctx.quarterSnapshot))
                        return;
                    if (!(__VLS_ctx.nameMenuOpen))
                        return;
                    __VLS_ctx.selectName(candidate);
                } }, { key: (candidate), 'data-role': "name-candidate" }), { class: "px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 cursor-pointer" }));
            (candidate);
        };
        for (var _i = 0, _d = __VLS_getVForSourceType((__VLS_ctx.filteredCandidateNames)); _i < _d.length; _i++) {
            var candidate = _d[_i][0];
            _loop_1(candidate);
        }
        if (__VLS_ctx.filteredCandidateNames.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-3 py-2 text-sm text-gray-400" }));
        }
    }
    if (__VLS_ctx.nameFilter) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: (__VLS_ctx.clearNameFilter) }, { type: "button" }), { class: "text-sm text-gray-600 underline" }));
    }
    if (__VLS_ctx.viewMode === 'matrix') {
        /** @type {[typeof QuarterShareMatrix, ]} */ ;
        // @ts-ignore
        var __VLS_0 = __VLS_asFunctionalComponent(QuarterShareMatrix_vue_1.default, new QuarterShareMatrix_vue_1.default({
            roles: (__VLS_ctx.sortedRoles),
            dates: (__VLS_ctx.filteredDates),
            peopleFor: (__VLS_ctx.peopleFor),
            totalDateCount: (__VLS_ctx.quarterSnapshot.serviceDates.length),
            activeNameFilter: (__VLS_ctx.nameFilter),
        }));
        var __VLS_1 = __VLS_0.apply(void 0, __spreadArray([{
                roles: (__VLS_ctx.sortedRoles),
                dates: (__VLS_ctx.filteredDates),
                peopleFor: (__VLS_ctx.peopleFor),
                totalDateCount: (__VLS_ctx.quarterSnapshot.serviceDates.length),
                activeNameFilter: (__VLS_ctx.nameFilter),
            }], __VLS_functionalComponentArgsRest(__VLS_0), false));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        for (var _e = 0, _f = __VLS_getVForSourceType((__VLS_ctx.filteredDates)); _e < _f.length; _e++) {
            var date = _f[_e][0];
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (date) }, { class: "py-2.5 border-b border-gray-100" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-base font-medium text-gray-900 mb-1" }));
            (__VLS_ctx.formatDateLabel(date));
            for (var _g = 0, _h = __VLS_getVForSourceType((__VLS_ctx.sortedRoles)); _g < _h.length; _g++) {
                var role = _h[_g][0];
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ key: (role.id) }, { class: "py-0.5" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500 uppercase tracking-wider" }));
                (role.name);
                if (__VLS_ctx.peopleFor(date, role.id).length > 0) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-800" }));
                    (__VLS_ctx.peopleFor(date, role.id).join(', '));
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-400 italic text-sm" }));
                }
            }
        }
        if (__VLS_ctx.quarterSnapshot.serviceDates.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-gray-400 italic text-sm py-3" }));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400" }));
}
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['font-sans']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['top-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-48']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['underline']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            QuarterShareMatrix: QuarterShareMatrix_vue_1.default,
            isLoading: isLoading,
            notFound: notFound,
            quarterSnapshot: quarterSnapshot,
            viewMode: viewMode,
            nameFilter: nameFilter,
            nameQuery: nameQuery,
            nameMenuOpen: nameMenuOpen,
            sortedRoles: sortedRoles,
            peopleFor: peopleFor,
            filteredCandidateNames: filteredCandidateNames,
            filteredDates: filteredDates,
            selectName: selectName,
            clearNameFilter: clearNameFilter,
            onNameBlur: onNameBlur,
            formatDateLabel: formatDateLabel,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
