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
var auth_1 = require("@/stores/auth");
var authStore = (0, auth_1.useAuthStore)();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
if (!__VLS_ctx.authStore.isReady) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm font-semibold text-gray-200 tracking-tight" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign({ class: "w-5 h-5 animate-spin text-indigo-400" }, { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.circle, __VLS_intrinsicElements.circle)(__assign({ class: "opacity-25" }, { cx: "12", cy: "12", r: "10", stroke: "currentColor", 'stroke-width': "4" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path, __VLS_intrinsicElements.path)(__assign({ class: "opacity-75" }, { fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" }));
}
else {
    var __VLS_0 = {}.RouterView;
    /** @type {[typeof __VLS_components.RouterView, ]} */ ;
    // @ts-ignore
    var __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
    var __VLS_2 = __VLS_1.apply(void 0, __spreadArray([{}], __VLS_functionalComponentArgsRest(__VLS_1), false));
}
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-950']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-400']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            authStore: authStore,
        };
    },
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
;
