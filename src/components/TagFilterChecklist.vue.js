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
var vue_1 = require("vue");
var props = withDefaults(defineProps(), { align: 'left' });
var emit = defineEmits();
var open = (0, vue_1.ref)(false);
// Ephemeral local filter for the tag list — intentionally not persisted anywhere.
var tagQuery = (0, vue_1.ref)('');
// Reset the ephemeral filter each time the popover closes so it doesn't persist across reopens.
(0, vue_1.watch)(open, function (isOpen) {
    if (!isOpen)
        tagQuery.value = '';
});
var filteredTags = (0, vue_1.computed)(function () {
    var q = tagQuery.value.trim().toLowerCase();
    if (!q)
        return props.availableUserTags;
    return props.availableUserTags.filter(function (t) { return t.toLowerCase().includes(q); });
});
function rowClass(tag) {
    if (props.includeTags.has(tag))
        return 'border-indigo-800 bg-indigo-900/40 text-indigo-200';
    if (props.excludeTags.has(tag))
        return 'border-red-900 bg-red-950/40 text-red-300';
    return 'border-gray-700 bg-gray-800 text-gray-300';
}
// Toggling Show on adds to include and removes from exclude (mutual exclusivity);
// toggling Show off just removes it from include.
function toggleInclude(tag) {
    var nextInclude = new Set(props.includeTags);
    if (nextInclude.has(tag)) {
        nextInclude.delete(tag);
    }
    else {
        nextInclude.add(tag);
        if (props.excludeTags.has(tag)) {
            var nextExclude = new Set(props.excludeTags);
            nextExclude.delete(tag);
            emit('update:excludeTags', nextExclude);
        }
    }
    emit('update:includeTags', nextInclude);
}
// Toggling Hide on adds to exclude and removes from include (mutual exclusivity);
// toggling Hide off just removes it from exclude.
function toggleExclude(tag) {
    var nextExclude = new Set(props.excludeTags);
    if (nextExclude.has(tag)) {
        nextExclude.delete(tag);
    }
    else {
        nextExclude.add(tag);
        if (props.includeTags.has(tag)) {
            var nextInclude = new Set(props.includeTags);
            nextInclude.delete(tag);
            emit('update:includeTags', nextInclude);
        }
    }
    emit('update:excludeTags', nextExclude);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
var __VLS_withDefaultsArg = (function (t) { return t; })({ align: 'left' });
var __VLS_ctx = {};
var __VLS_components;
var __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "relative" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
        var _a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            _a[_i] = arguments[_i];
        }
        var $event = _a[0];
        __VLS_ctx.open = !__VLS_ctx.open;
    } }, { type: "button" }), { class: "flex items-center gap-1.5 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
if (__VLS_ctx.includeTags.size > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs font-semibold text-indigo-300" }));
    (__VLS_ctx.includeTags.size);
}
if (__VLS_ctx.includeTags.size > 0 && __VLS_ctx.excludeTags.size > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs text-gray-500" }));
}
if (__VLS_ctx.excludeTags.size > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "text-xs font-semibold text-red-300" }));
    (__VLS_ctx.excludeTags.size);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)(__assign(__assign({ xmlns: "http://www.w3.org/2000/svg" }, { class: "h-4 w-4 text-gray-500" }), { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", 'stroke-width': "2" }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    d: "M19 9l-7 7-7-7",
});
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.open))
                return;
            __VLS_ctx.open = false;
        } }, { class: "fixed inset-0 z-30" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "absolute z-40 mt-1 w-64 rounded-md bg-gray-800 border border-gray-700 shadow-xl p-2" }, { class: (__VLS_ctx.align === 'right' ? 'right-0' : 'left-0') }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "flex items-center justify-end gap-2 mb-1.5" }));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign({ onClick: function () {
            var _a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                _a[_i] = arguments[_i];
            }
            var $event = _a[0];
            if (!(__VLS_ctx.open))
                return;
            __VLS_ctx.$emit('clear');
        } }, { type: "button", title: "Clear tag filter" }), { class: "text-xs text-gray-500 hover:text-gray-300 transition-colors" }));
    if (__VLS_ctx.availableUserTags.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)(__assign({ value: (__VLS_ctx.tagQuery), type: "text", placeholder: "Filter tags…" }, { class: "w-full mb-1.5 rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" }));
    }
    if (__VLS_ctx.filteredTags.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "max-h-48 overflow-y-auto space-y-0.5" }));
        var _loop_1 = function (tag) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign(__assign({ key: (tag) }, { class: "flex items-center justify-between gap-2 py-1 px-2 rounded border text-xs" }), { class: (__VLS_ctx.rowClass(tag)) }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "truncate" }));
            (tag);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)(__assign({ class: "flex items-center gap-1 shrink-0" }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(__VLS_ctx.filteredTags.length > 0))
                        return;
                    __VLS_ctx.toggleInclude(tag);
                } }, { type: "button", title: "Show only songs with this tag" }), { class: "px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors" }), { class: (__VLS_ctx.includeTags.has(tag)
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200') }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)(__assign(__assign(__assign({ onClick: function () {
                    var _a = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        _a[_i] = arguments[_i];
                    }
                    var $event = _a[0];
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(__VLS_ctx.filteredTags.length > 0))
                        return;
                    __VLS_ctx.toggleExclude(tag);
                } }, { type: "button", title: "Hide songs with this tag" }), { class: "px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors" }), { class: (__VLS_ctx.excludeTags.has(tag)
                    ? 'border-red-600 bg-red-700 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200') }));
        };
        for (var _i = 0, _a = __VLS_getVForSourceType((__VLS_ctx.filteredTags)); _i < _a.length; _i++) {
            var tag = _a[_i][0];
            _loop_1(tag);
        }
    }
    else if (__VLS_ctx.availableUserTags.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-4 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
        (__VLS_ctx.tagQuery);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)(__assign({ class: "px-4 py-6 text-center" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-sm text-gray-400" }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)(__assign({ class: "text-xs text-gray-500" }));
    }
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-indigo-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-48']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
var __VLS_dollars;
var __VLS_self = (await Promise.resolve().then(function () { return require('vue'); })).defineComponent({
    setup: function () {
        return {
            open: open,
            tagQuery: tagQuery,
            filteredTags: filteredTags,
            rowClass: rowClass,
            toggleInclude: toggleInclude,
            toggleExclude: toggleExclude,
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
