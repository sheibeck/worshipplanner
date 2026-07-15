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
var services_1 = require("@/stores/services");
var AppShell_vue_1 = require("@/components/AppShell.vue");
var ServiceCard_vue_1 = require("@/components/ServiceCard.vue");
var NewServiceDialog_vue_1 = require("@/components/NewServiceDialog.vue");
var RotationTable_vue_1 = require("@/components/RotationTable.vue");
var ScriptureRotationTable_vue_1 = require("@/components/ScriptureRotationTable.vue");
var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
var router = (0, vue_router_1.useRouter)();
var authStore = (0, auth_1.useAuthStore)();
var serviceStore = (0, services_1.useServiceStore)();
var activeTab = (0, vue_1.ref)('services');
var dialogOpen = (0, vue_1.ref)(false);
var showPast = (0, vue_1.ref)(false);
// User-selected month (0-11) and year — null means "use smart default"
var selectedMonth = (0, vue_1.ref)(null);
var selectedYear = (0, vue_1.ref)(null);
// Compute today's ISO date string for comparison
var todayStr = (0, vue_1.computed)(function () {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return "".concat(y, "-").concat(m, "-").concat(d);
});
// Upcoming: date >= today, sorted ascending
var upcomingServices = (0, vue_1.computed)(function () {
    return serviceStore.services
        .filter(function (s) { return s.date >= todayStr.value; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); });
});
// Past: date < today, sorted descending (most recent first)
var pastServices = (0, vue_1.computed)(function () {
    return serviceStore.services
        .filter(function (s) { return s.date < todayStr.value; })
        .sort(function (a, b) { return b.date.localeCompare(a.date); });
});
// Rotation window: services within 4 weeks past and 4 weeks ahead of today
var rotationServices = (0, vue_1.computed)(function () {
    var today = new Date();
    var windowStart = new Date(today);
    windowStart.setDate(today.getDate() - 28);
    var windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + 28);
    var fmt = function (d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return "".concat(y, "-").concat(m, "-").concat(day);
    };
    var start = fmt(windowStart);
    var end = fmt(windowEnd);
    return serviceStore.services.filter(function (s) { return s.date >= start && s.date <= end; });
});
// Unique month/year pairs from pastServices, sorted descending (most recent first)
var availableMonths = (0, vue_1.computed)(function () {
    var _a;
    var seen = new Set();
    var result = [];
    for (var _i = 0, _b = pastServices.value; _i < _b.length; _i++) {
        var s = _b[_i];
        var d = new Date(s.date + 'T00:00:00');
        var month = d.getMonth();
        var year = d.getFullYear();
        var key = "".concat(year, "-").concat(month);
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ month: month, year: year, monthName: (_a = MONTH_NAMES[month]) !== null && _a !== void 0 ? _a : '' });
        }
    }
    // Already sorted descending because pastServices is sorted descending
    return result;
});
// Unique years from pastServices, sorted descending
var availableYears = (0, vue_1.computed)(function () {
    var years = new Set();
    for (var _i = 0, _a = availableMonths.value; _i < _a.length; _i++) {
        var entry = _a[_i];
        years.add(entry.year);
    }
    return Array.from(years).sort(function (a, b) { return b - a; });
});
// Smart default: current month if it has past services, otherwise most recent month
var smartDefault = (0, vue_1.computed)(function () {
    if (availableMonths.value.length === 0)
        return null;
    var now = new Date();
    var curMonth = now.getMonth();
    var curYear = now.getFullYear();
    var hasCurrentMonth = availableMonths.value.some(function (e) { return e.month === curMonth && e.year === curYear; });
    if (hasCurrentMonth)
        return { month: curMonth, year: curYear };
    return { month: availableMonths.value[0].month, year: availableMonths.value[0].year };
});
// Active year: user selection or smart default
var activeYear = (0, vue_1.computed)(function () {
    var _a, _b;
    if (selectedYear.value !== null)
        return selectedYear.value;
    return (_b = (_a = smartDefault.value) === null || _a === void 0 ? void 0 : _a.year) !== null && _b !== void 0 ? _b : null;
});
// Months available for the active year
var monthsForActiveYear = (0, vue_1.computed)(function () {
    if (activeYear.value === null)
        return [];
    return availableMonths.value.filter(function (e) { return e.year === activeYear.value; });
});
// Active month: user selection (if valid for active year) or smart default month for active year
var activeMonth = (0, vue_1.computed)(function () {
    var _a, _b;
    if (activeYear.value === null)
        return null;
    if (selectedMonth.value !== null) {
        // Validate the selected month exists in the active year
        var valid = monthsForActiveYear.value.some(function (e) { return e.month === selectedMonth.value; });
        if (valid)
            return selectedMonth.value;
    }
    // Fall back: use smart default month if it matches this year, else first available month in year
    if (smartDefault.value !== null &&
        smartDefault.value.year === activeYear.value) {
        return smartDefault.value.month;
    }
    return (_b = (_a = monthsForActiveYear.value[0]) === null || _a === void 0 ? void 0 : _a.month) !== null && _b !== void 0 ? _b : null;
});
// Services displayed in the past section — ALL services from active month/year
var displayedPastServices = (0, vue_1.computed)(function () {
    if (activeMonth.value === null || activeYear.value === null)
        return [];
    return pastServices.value.filter(function (s) {
        var d = new Date(s.date + 'T00:00:00');
        return d.getMonth() === activeMonth.value && d.getFullYear() === activeYear.value;
    });
});
function onMonthChange(event) {
    selectedMonth.value = Number(event.target.value);
}
function onYearChange(event) {
    var newYear = Number(event.target.value);
    selectedYear.value = newYear;
    // Reset month selection — activeMonth computed will pick the best default for the new year
    selectedMonth.value = null;
}
// Subscribe to Firestore services collection once orgId is resolved
function initStore() {
    var orgId = authStore.orgId;
    if (!orgId)
        return;
    serviceStore.subscribe(orgId);
}
(0, vue_1.onMounted)(function () {
    initStore();
});
(0, vue_1.onUnmounted)(function () {
    serviceStore.unsubscribeAll();
});
function onCreateService(data) {
    return __awaiter(this, void 0, void 0, function () {
        var id;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dialogOpen.value = false;
                    return [4 /*yield*/, serviceStore.createService(data)];
                case 1:
                    id = _a.sent();
                    return [4 /*yield*/, router.push("/services/".concat(id))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-1 mb-6 border-b border-gray-800 pb-0" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.activeTab = 'services';
    } }, { type: "button" }), { class: "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2" }), { class: (__VLS_ctx.activeTab === 'services'
        ? 'text-indigo-300 border-indigo-500 bg-gray-900'
        : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600') }));
if (__VLS_ctx.authStore.isEditor) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.authStore.isEditor))
                return;
            __VLS_ctx.activeTab = 'rotation';
        } }, { type: "button" }), { class: "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2" }), { class: (__VLS_ctx.activeTab === 'rotation'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600') }));
}
if (__VLS_ctx.authStore.isEditor) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.authStore.isEditor))
                return;
            __VLS_ctx.activeTab = 'scripture-rotation';
        } }, { type: "button" }), { class: "px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2" }), { class: (__VLS_ctx.activeTab === 'scripture-rotation'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600') }));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)(__assign({ class: "flex-1" }));
if (__VLS_ctx.authStore.isEditor) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.authStore.isEditor))
                return;
            __VLS_ctx.dialogOpen = true;
        } }, { type: "button" }), { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors mb-1" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        d: "M12 4v16m8-8H4",
    });
}
if (__VLS_ctx.activeTab === 'services') {
    if (__VLS_ctx.serviceStore.isLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "text-sm text-gray-400 py-8 text-center" }));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)(__assign({ class: "mb-8" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)(__assign({ class: "text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3" }));
        if (__VLS_ctx.upcomingServices.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "rounded-lg border border-dashed border-gray-700 py-10 text-center" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400 mb-3" }));
            if (__VLS_ctx.authStore.isEditor) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                        var _a = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            _a[_i] = arguments[_i];
                        }
                        var $event = _a[0];
                        if (!(__VLS_ctx.activeTab === 'services'))
                            return;
                        if (!!(__VLS_ctx.serviceStore.isLoading))
                            return;
                        if (!(__VLS_ctx.upcomingServices.length === 0))
                            return;
                        if (!(__VLS_ctx.authStore.isEditor))
                            return;
                        __VLS_ctx.dialogOpen = true;
                    } }, { type: "button" }), { class: "inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors" }));
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" }));
            for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.upcomingServices)); _i < _a.length; _i++) {
                var service = _a[_i][0];
                /** @type {[typeof ServiceCard, ]} */ ;
                // @ts-ignore
                var __VLS_4 = __VLS_asFunctionalComponent(ServiceCard_vue_1.default, new ServiceCard_vue_1.default({
                    key: (service.id),
                    service: (service),
                }));
                var __VLS_5 = __VLS_4.apply(void 0, __spreadArray([{
                        key: (service.id),
                        service: (service),
                    }], __VLS_functionalComponentArgsRest(__VLS_4), false));
            }
        }
        if (__VLS_ctx.pastServices.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.activeTab === 'services'))
                        return;
                    if (!!(__VLS_ctx.serviceStore.isLoading))
                        return;
                    if (!(__VLS_ctx.pastServices.length > 0))
                        return;
                    __VLS_ctx.showPast = !__VLS_ctx.showPast;
                } }, { type: "button" }), { class: "flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors mb-3" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-3.5 w-3.5 transition-transform" }), { class: (__VLS_ctx.showPast ? 'rotate-90' : '') }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M9 5l7 7-7 7",
            });
            if (__VLS_ctx.showPast) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center gap-2 mb-3" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign(__assign({ onChange: (__VLS_ctx.onMonthChange) }, { value: (__VLS_ctx.activeMonth) }), { class: "bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500" }));
                for (var _b = 0, _c = __VLS_getVForSourceType((__VLS_ctx.monthsForActiveYear)); _b < _c.length; _b++) {
                    var entry = _c[_b][0];
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                        key: (entry.month),
                        value: (entry.month),
                    });
                    (entry.monthName);
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)(__assign(__assign({ onChange: (__VLS_ctx.onYearChange) }, { value: (__VLS_ctx.activeYear) }), { class: "bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500" }));
                for (var _d = 0, _e = __VLS_getVForSourceType((__VLS_ctx.availableYears)); _d < _e.length; _d++) {
                    var year = _e[_d][0];
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                        key: (year),
                        value: (year),
                    });
                    (year);
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" }));
                for (var _f = 0, _g = __VLS_getVForSourceType((__VLS_ctx.displayedPastServices)); _f < _g.length; _f++) {
                    var service = _g[_f][0];
                    /** @type {[typeof ServiceCard, ]} */ ;
                    // @ts-ignore
                    var __VLS_7 = __VLS_asFunctionalComponent(ServiceCard_vue_1.default, new ServiceCard_vue_1.default({
                        key: (service.id),
                        service: (service),
                    }));
                    var __VLS_8 = __VLS_7.apply(void 0, __spreadArray([{
                            key: (service.id),
                            service: (service),
                        }], __VLS_functionalComponentArgsRest(__VLS_7), false));
                }
            }
        }
    }
}
else if (__VLS_ctx.activeTab === 'rotation') {
    /** @type {[typeof RotationTable, ]} */ ;
    // @ts-ignore
    var __VLS_10 = __VLS_asFunctionalComponent(RotationTable_vue_1.default, new RotationTable_vue_1.default({
        services: (__VLS_ctx.rotationServices),
    }));
    var __VLS_11 = __VLS_10.apply(void 0, __spreadArray([{
            services: (__VLS_ctx.rotationServices),
        }], __VLS_functionalComponentArgsRest(__VLS_10), false));
}
else if (__VLS_ctx.activeTab === 'scripture-rotation') {
    /** @type {[typeof ScriptureRotationTable, ]} */ ;
    // @ts-ignore
    var __VLS_13 = __VLS_asFunctionalComponent(ScriptureRotationTable_vue_1.default, new ScriptureRotationTable_vue_1.default({
        services: (__VLS_ctx.rotationServices),
    }));
    var __VLS_14 = __VLS_13.apply(void 0, __spreadArray([{
            services: (__VLS_ctx.rotationServices),
        }], __VLS_functionalComponentArgsRest(__VLS_13), false));
}
if (__VLS_ctx.authStore.isEditor) {
    /** @type {[typeof NewServiceDialog, ]} */ ;
    // @ts-ignore
    var __VLS_16 = __VLS_asFunctionalComponent(NewServiceDialog_vue_1.default, new NewServiceDialog_vue_1.default(__assign(__assign({ 'onClose': {} }, { 'onCreate': {} }), { open: (__VLS_ctx.dialogOpen) })));
    var __VLS_17 = __VLS_16.apply(void 0, __spreadArray([__assign(__assign({ 'onClose': {} }, { 'onCreate': {} }), { open: (__VLS_ctx.dialogOpen) })], __VLS_functionalComponentArgsRest(__VLS_16), false));
    var __VLS_19 = void 0;
    var __VLS_20 = void 0;
    var __VLS_21 = void 0;
    var __VLS_22 = {
        onClose: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.authStore.isEditor))
                return;
            __VLS_ctx.dialogOpen = false;
        }
    };
    var __VLS_23 = {
        onCreate: (__VLS_ctx.onCreateService)
    };
    var __VLS_18;
}
var __VLS_2;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-md']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['-mb-px']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-md']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['-mb-px']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-md']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['-mb-px']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
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
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            AppShell: AppShell_vue_1.default,
            ServiceCard: ServiceCard_vue_1.default,
            NewServiceDialog: NewServiceDialog_vue_1.default,
            RotationTable: RotationTable_vue_1.default,
            ScriptureRotationTable: ScriptureRotationTable_vue_1.default,
            authStore: authStore,
            serviceStore: serviceStore,
            activeTab: activeTab,
            dialogOpen: dialogOpen,
            showPast: showPast,
            upcomingServices: upcomingServices,
            pastServices: pastServices,
            rotationServices: rotationServices,
            availableYears: availableYears,
            activeYear: activeYear,
            monthsForActiveYear: monthsForActiveYear,
            activeMonth: activeMonth,
            displayedPastServices: displayedPastServices,
            onMonthChange: onMonthChange,
            onYearChange: onYearChange,
            onCreateService: onCreateService,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
