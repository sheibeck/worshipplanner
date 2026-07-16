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
Object.defineProperty(exports, "__esModule", { value: true });
var __VLS_props = withDefaults(defineProps(), { clickable: false });
var __VLS_emit = defineEmits();
// Static map prevents Tailwind v4 purge of dynamic class strings
var badgeClasses = {
    1: 'bg-blue-900/50 text-blue-300 border-blue-800',
    2: 'bg-purple-900/50 text-purple-300 border-purple-800',
    3: 'bg-amber-900/50 text-amber-300 border-amber-800',
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_withDefaultsArg = (function (t) { return t; })({ clickable: false });
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-flex items-center gap-1" }));
if (__VLS_ctx.types.length > 0) {
    var _loop_1 = function (t) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign(__assign(__assign({ onClick: function () {
                var _a = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _a[_i] = arguments[_i];
                }
                var $event = _a[0];
                if (!(__VLS_ctx.types.length > 0))
                    return;
                __VLS_ctx.clickable && __VLS_ctx.$emit('select', t);
            } }, { key: (t) }), { class: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border" }), { class: ([__VLS_ctx.badgeClasses[t], __VLS_ctx.clickable ? 'cursor-pointer hover:brightness-125 transition' : '']) }));
        (t);
    };
    for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.types)); _i < _a.length; _i++) {
        var t = _a[_i][0];
        _loop_1(t);
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700" }));
}
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            badgeClasses: badgeClasses,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
exports.default = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
